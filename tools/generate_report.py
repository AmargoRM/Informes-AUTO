"""Generate a Word report from CLI inputs."""
from __future__ import annotations

import argparse
from datetime import datetime
import os
from pathlib import Path

from src.dem import get_elevation_from_dem
from src.gis import (
    build_point,
    load_layer_from_zip,
    normalize_crs_code,
    reproject_point,
    spatial_join_point,
)
from src.word_fill import render_docx_from_template

DATA_DIR = Path("data")
ZIPS_DIR = DATA_DIR / "zips"
GIS_DIR = DATA_DIR / "gis"
DEM_DIR = DATA_DIR / "dem"
TARGET_CRS = build_point(0, 0, "EPSG:5367").crs

ADMIN_FIELD_CANDIDATES = {
    "PROVINCIA": ("PROVINCIA",),
    "CANTON": ("CANTON",),
    "DISTRITO": ("DISTRITO",),
}
CUENCA_FIELD_CANDIDATES = {
    "CUENCA": ("NOMBRE",),
    "CUENCA_NO": ("CUENCA_NO", "CUENCA_N"),
}
HOJA_FIELD_CANDIDATES = {
    "HOJA_NOMBRE": ("NOMBRE",),
    "HOJA_NUM": ("NUMERO", "NUM"),
}


def _extract_value(joined, candidates: tuple[str, ...]) -> str:
    if joined is None or joined.empty:
        return "N/D"
    row = joined.iloc[0]
    for candidate in candidates:
        for column in joined.columns:
            if candidate == column:
                value = row.get(column)
                if value is not None:
                    return str(value)
    return "N/D"


def _extract_values(joined, field_map: dict[str, tuple[str, ...]]) -> dict[str, str]:
    return {key: _extract_value(joined, candidates) for key, candidates in field_map.items()}


def _resolve_zip_path(zip_name: str) -> Path | None:
    candidate_paths = [
        ZIPS_DIR / zip_name,
        DATA_DIR / zip_name,
    ]
    for path in candidate_paths:
        if path.exists():
            return path
    return None


def _load_layer_if_present(zip_name: str, layer_name: str, *, buffer_m: float = 0.0):
    zip_path = _resolve_zip_path(zip_name)
    if zip_path is None:
        return None
    out_dir = GIS_DIR / layer_name
    return load_layer_from_zip(zip_path, out_dir, TARGET_CRS, buffer_lines_m=buffer_m)


def _spatial_join_values(point_data) -> dict[str, str]:
    results = {
        "PROVINCIA": "N/D",
        "CANTON": "N/D",
        "DISTRITO": "N/D",
        "CUENCA": "N/D",
        "CUENCA_NO": "N/D",
        "HOJA_NOMBRE": "N/D",
        "HOJA_NUM": "N/D",
    }

    admin_layer = _load_layer_if_present("Limites_geo.zip", "limites")
    if admin_layer is not None:
        joined = spatial_join_point(point_data, admin_layer)
        results.update(_extract_values(joined, ADMIN_FIELD_CANDIDATES))

    cuenca_layer = _load_layer_if_present("Cuencas.zip", "cuencas", buffer_m=100.0)
    if cuenca_layer is not None:
        joined = spatial_join_point(point_data, cuenca_layer)
        results.update(_extract_values(joined, CUENCA_FIELD_CANDIDATES))

    hoja_layer = _load_layer_if_present("Hojas.zip", "hojas")
    if hoja_layer is not None:
        joined = spatial_join_point(point_data, hoja_layer)
        results.update(_extract_values(joined, HOJA_FIELD_CANDIDATES))

    return results


def _find_dem_file() -> Path | None:
    if not DEM_DIR.exists():
        return None
    preferred = DEM_DIR / "MED.CR.tif"
    if preferred.exists():
        return preferred
    candidates = []
    for pattern in ("*.tif", "*.tiff", "*.img"):
        candidates.extend(DEM_DIR.glob(pattern))
    if not candidates:
        return None
    return sorted(candidates)[0]


def _sample_elevation(x: float, y: float, crs_code: str) -> str:
    dem_file = _find_dem_file()
    if not dem_file:
        return "N/D"
    elevation = get_elevation_from_dem(x, y, crs_code, dem_file.as_posix())
    if elevation is None:
        return "N/D"
    rounded = round(elevation, 1)
    if rounded.is_integer():
        return str(int(rounded))
    return f"{rounded:.1f}"


def _format_coordinate(value: float) -> str:
    rounded = round(value, 2)
    if rounded.is_integer():
        return str(int(rounded))
    return f"{rounded:.2f}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Genera un informe Word desde una coordenada.")
    parser.add_argument("--x", required=True, help="Coordenada X")
    parser.add_argument("--y", required=True, help="Coordenada Y")
    parser.add_argument("--crs", required=True, help="CRS de la coordenada")
    parser.add_argument("--template", required=True, help="Ruta a la plantilla DOCX")
    parser.add_argument(
        "--output-name",
        default="informe",
        help="Nombre base del archivo de salida",
    )
    parser.add_argument(
        "--out",
        help="Ruta de salida completa (sobrescribe el nombre por defecto)",
    )
    return parser.parse_args()


def resolve_output_path(output_name: str, out_override: str | None) -> Path:
    if out_override:
        return Path(out_override)

    run_id = os.environ.get("GITHUB_RUN_ID")
    if not run_id:
        run_id = datetime.now().strftime("%Y%m%d%H%M%S")
    return Path("output") / f"{output_name}_{run_id}.docx"


def main() -> None:
    args = parse_args()
    input_crs = normalize_crs_code(args.crs)
    x = float(args.x)
    y = float(args.y)
    point_data = build_point(x, y, input_crs)
    point_5367 = reproject_point(point_data, TARGET_CRS)

    data = {
        "X": args.x,
        "Y": args.y,
        "CRS": input_crs,
        "FECHA_GEN": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "E_5367": _format_coordinate(point_5367.geometry.x),
        "N_5367": _format_coordinate(point_5367.geometry.y),
    }
    data.update(_spatial_join_values(point_5367))
    elevation = _sample_elevation(point_5367.geometry.x, point_5367.geometry.y, "EPSG:5367")
    data["ALTITUD_M"] = elevation
    data["ELEV_M"] = elevation

    output_path = resolve_output_path(args.output_name, args.out)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    docx_bytes = render_docx_from_template(Path(args.template), data)
    output_path.write_bytes(docx_bytes)


if __name__ == "__main__":
    main()
