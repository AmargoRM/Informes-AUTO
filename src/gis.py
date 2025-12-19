"""Utilidades GIS: reproyección y spatial joins."""
from dataclasses import dataclass
from pathlib import Path

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
}


def build_point(x: float, y: float, crs_code: str) -> PointData:
    """Construye un punto en el CRS indicado."""
    if crs_code not in SUPPORTED_CRS:
        raise ValueError(f"CRS no soportado: {crs_code}")
    return PointData(geometry=Point(x, y), crs=SUPPORTED_CRS[crs_code])


def reproject_point(point_data: PointData, target_crs: CRS) -> PointData:
    """Reproyecta un punto al CRS objetivo."""
    gdf = gpd.GeoDataFrame(
        {"geometry": [point_data.geometry]},
        crs=point_data.crs,
    )
    reprojected = gdf.to_crs(target_crs)
    return PointData(geometry=reprojected.geometry.iloc[0], crs=target_crs)


def spatial_join_point(point_data: PointData, shapefile_name: str) -> gpd.GeoDataFrame:
    """Ejecuta un spatial join de un punto contra un shapefile de /data."""
    shp_path = DATA_DIR / shapefile_name
    if not shp_path.exists():
        raise FileNotFoundError(
            f"No se encontró el shapefile: {shp_path}. "
            "Coloque los archivos en /data."
        )

    layer_gdf = gpd.read_file(shp_path)
    point_gdf = gpd.GeoDataFrame(
        {"geometry": [point_data.geometry]},
        crs=point_data.crs,
    )

    if layer_gdf.crs is None:
        raise ValueError("El shapefile no tiene CRS definido.")

    if layer_gdf.crs != point_gdf.crs:
        point_gdf = point_gdf.to_crs(layer_gdf.crs)

    joined = gpd.sjoin(point_gdf, layer_gdf, predicate="intersects", how="left")
    return joined
