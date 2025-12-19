"""Generate a Word report from CLI inputs."""
from __future__ import annotations

import argparse
from datetime import datetime
import os
from pathlib import Path

from src.dem import get_elevation_from_dem
from src.gis import build_point, spatial_join_point
from src.word_fill import render_docx_from_template

DATA_DIR = Path("data")
SHAPES_DIR = DATA_DIR / "shapes"
DEM_DIR = DATA_DIR / "dem"

ADMIN_FIELD_CANDIDATES = {
    "PROVINCIA": ("provincia",),
    "CANTON": ("canton",),
    "DISTRITO": ("distrito",),
}
CUENCA_FIELD_CANDIDATES = ("cuenca",)
HOJA_FIELD_CANDIDATES = ("hoja", "carto")


def _pick_shapefile(shape_files: list[Path], keywords: tuple[str, ...]) -> Path | None:
    for keyword in keywords:
        for shp in shape_files:
            if keyword in shp.stem.lower():
                return shp
    if len(shape_files) == 1:
        return shape_files[0]
    return None


def _extract_value(joined, candidates: tuple[str, ...]) -> str:
    if joined is None or joined.empty:
        return ""
    row = joined.iloc[0]
    for candidate in candidates:
        for column in joined.columns:
            if candidate in column.lower():
                value = row.get(column)
                if value is not None:
                    return str(value)
    return ""


def _get_shape_files() -> list[Path]:
    if not SHAPES_DIR.exists():
        return []
    return sorted(SHAPES_DIR.glob("*.shp"))


def _spatial_join_values(x: float, y: float, crs_code: str) -> dict[str, str]:
    shape_files = _get_shape_files()
    if not shape_files:
        return {
            "PROVINCIA": "",
            "CANTON": "",
            "DISTRITO": "",
            "CUENCA": "",
            "HOJA_CARTO": "",
        }

    point_data = build_point(x, y, crs_code)
    admin_shp = _pick_shapefile(shape_files, ("provincia", "canton", "distrito", "admin"))
    cuenca_shp = _pick_shapefile(shape_files, ("cuenca",))
    hoja_shp = _pick_shapefile(shape_files, ("hoja", "carto"))

    provincia = canton = distrito = ""
    if admin_shp:
        joined = spatial_join_point(point_data, admin_shp.relative_to(DATA_DIR).as_posix())
        provincia = _extract_value(joined, ADMIN_FIELD_CANDIDATES["PROVINCIA"])
        canton = _extract_value(joined, ADMIN_FIELD_CANDIDATES["CANTON"])
        distrito = _extract_value(joined, ADMIN_FIELD_CANDIDATES["DISTRITO"])

    cuenca = ""
    if cuenca_shp:
        joined = spatial_join_point(point_data, cuenca_shp.relative_to(DATA_DIR).as_posix())
        cuenca = _extract_value(joined, CUENCA_FIELD_CANDIDATES)

    hoja_carto = ""
    if hoja_shp:
        joined = spatial_join_point(point_data, hoja_shp.relative_to(DATA_DIR).as_posix())
        hoja_carto = _extract_value(joined, HOJA_FIELD_CANDIDATES)

    return {
        "PROVINCIA": provincia,
        "CANTON": canton,
        "DISTRITO": distrito,
        "CUENCA": cuenca,
        "HOJA_CARTO": hoja_carto,
    }


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
        return ""
    elevation = get_elevation_from_dem(x, y, crs_code, dem_file.as_posix())
    if elevation is None:
        return ""
    rounded = round(elevation, 1)
    if rounded.is_integer():
        return str(int(rounded))
    return f"{rounded:.1f}"


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
    x = float(args.x)
    y = float(args.y)

    data = {
        "X": args.x,
        "Y": args.y,
        "CRS": args.crs,
        "FECHA_GEN": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }
    data.update(_spatial_join_values(x, y, args.crs))
    elevation = _sample_elevation(x, y, args.crs)
    data["ALTITUD_M"] = elevation
    data["ELEV_M"] = elevation

    output_path = resolve_output_path(args.output_name, args.out)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    docx_bytes = render_docx_from_template(Path(args.template), data)
    output_path.write_bytes(docx_bytes)


if __name__ == "__main__":
    main()
