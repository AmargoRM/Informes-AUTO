"""Lectura de altitud desde un raster DEM."""
from pathlib import Path

import rasterio
from rasterio.transform import rowcol

DATA_DIR = Path("data")


def get_elevation_from_dem(x: float, y: float, dem_name: str) -> float:
    """Obtiene la altitud desde un DEM en /data.

    Espera que el DEM tenga CRS compatible con la coordenada recibida.
    """
    dem_path = DATA_DIR / dem_name
    if not dem_path.exists():
        raise FileNotFoundError(
            f"No se encontró el DEM: {dem_path}. Coloque el raster en /data."
        )

    with rasterio.open(dem_path) as dataset:
        row, col = rowcol(dataset.transform, x, y)
        elevation = dataset.read(1)[row, col]

    return float(elevation)
