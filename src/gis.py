"""Utilidades GIS: reproyección y spatial joins."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
import unicodedata
import zipfile

import geopandas as gpd
from pyproj import CRS
from shapely.geometry import Point

DATA_DIR = Path("data")


@dataclass
class PointData:
    geometry: Point
    crs: CRS


SUPPORTED_CRS = {
    "EPSG:5367": CRS.from_epsg(5367),
    "EPSG:4326": CRS.from_epsg(4326),
    "5367": CRS.from_epsg(5367),
    "4326": CRS.from_epsg(4326),
}


def normalize_crs_code(crs_code: str) -> str:
    """Normaliza un CRS para manejar códigos numéricos simples."""
    cleaned = crs_code.strip().upper()
    if cleaned.startswith("EPSG:"):
        return cleaned
    if cleaned.isdigit():
        return f"EPSG:{cleaned}"
    return cleaned


def build_point(x: float, y: float, crs_code: str) -> PointData:
    """Construye un punto en el CRS indicado."""
    normalized = normalize_crs_code(crs_code)
    if normalized not in SUPPORTED_CRS:
        raise ValueError(f"CRS no soportado: {crs_code}")
    return PointData(geometry=Point(x, y), crs=SUPPORTED_CRS[normalized])


def reproject_point(point_data: PointData, target_crs: CRS) -> PointData:
    """Reproyecta un punto al CRS objetivo."""
    gdf = gpd.GeoDataFrame(
        {"geometry": [point_data.geometry]},
        crs=point_data.crs,
    )
    reprojected = gdf.to_crs(target_crs)
    return PointData(geometry=reprojected.geometry.iloc[0], crs=target_crs)


def spatial_join_point(
    point_data: PointData,
    layer_gdf: gpd.GeoDataFrame,
    *,
    predicate: str = "intersects",
) -> gpd.GeoDataFrame:
    """Ejecuta un spatial join de un punto contra un GeoDataFrame."""
    point_gdf = gpd.GeoDataFrame(
        {"geometry": [point_data.geometry]},
        crs=point_data.crs,
    )

    if layer_gdf.crs is None:
        raise ValueError("La capa GIS no tiene CRS definido.")

    if layer_gdf.crs != point_gdf.crs:
        point_gdf = point_gdf.to_crs(layer_gdf.crs)

    joined = gpd.sjoin(point_gdf, layer_gdf, predicate=predicate, how="left")
    return joined


def unzip_to_dir(zip_path: Path, out_dir: Path) -> None:
    """Extrae un zip en un directorio destino."""
    out_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "r") as archive:
        archive.extractall(out_dir)


def load_first_shp(out_dir: Path) -> gpd.GeoDataFrame:
    """Carga el primer shapefile encontrado en un directorio."""
    shp_files = sorted(out_dir.rglob("*.shp"))
    if not shp_files:
        raise FileNotFoundError(f"No se encontró un shapefile en {out_dir}")
    return gpd.read_file(shp_files[0])


def normalize_columns(layer_gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Normaliza nombres de columnas para evitar tildes y símbolos."""

    def _normalize_column(name: str) -> str:
        cleaned = unicodedata.normalize("NFKD", name)
        cleaned = cleaned.encode("ascii", "ignore").decode("ascii")
        cleaned = cleaned.replace(" ", "_")
        cleaned = re.sub(r"[^A-Za-z0-9_]", "", cleaned)
        return cleaned.upper()

    rename_map = {
        column: _normalize_column(column)
        for column in layer_gdf.columns
        if column != layer_gdf.geometry.name
    }
    return layer_gdf.rename(columns=rename_map)


def load_layer_from_zip(
    zip_path: Path,
    out_dir: Path,
    target_crs: CRS,
    *,
    buffer_lines_m: float = 0.0,
) -> gpd.GeoDataFrame:
    """Extrae y carga un shapefile desde un zip, reproyectándolo."""
    unzip_to_dir(zip_path, out_dir)
    layer_gdf = load_first_shp(out_dir)
    layer_gdf = normalize_columns(layer_gdf)
    if layer_gdf.crs is None:
        raise ValueError(f"El shapefile en {zip_path} no tiene CRS definido.")
    if layer_gdf.crs != target_crs:
        layer_gdf = layer_gdf.to_crs(target_crs)

    geom_type = layer_gdf.geom_type.unique().tolist()
    if buffer_lines_m > 0 and any("Line" in geom for geom in geom_type):
        layer_gdf = layer_gdf.copy()
        layer_gdf["geometry"] = layer_gdf.geometry.buffer(buffer_lines_m)
    return layer_gdf
