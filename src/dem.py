"""Lectura de altitud desde un raster DEM."""
from __future__ import annotations

from pathlib import Path
import math

import pyproj
import rasterio


def get_elevation_from_dem(
    x: float,
    y: float,
    crs: str,
    dem_path: str,
) -> float | None:
    """Obtiene la altitud desde un DEM.

    Reproyecta el punto al CRS del raster si es necesario.
    """
    dem_file = Path(dem_path)
    if not dem_file.exists():
        return None

    with rasterio.open(dem_file) as dataset:
        raster_crs = dataset.crs
        sample_x, sample_y = x, y
        if raster_crs is not None and crs:
            if str(raster_crs).lower() != crs.lower():
                transformer = pyproj.Transformer.from_crs(crs, raster_crs, always_xy=True)
                sample_x, sample_y = transformer.transform(x, y)

        bounds = dataset.bounds
        if not (bounds.left <= sample_x <= bounds.right and bounds.bottom <= sample_y <= bounds.top):
            return None

        sample = next(dataset.sample([(sample_x, sample_y)]), None)
        if sample is None or len(sample) == 0:
            return None

        value = sample[0]
        if hasattr(value, "mask") and value.mask:
            return None

        nodata = dataset.nodata
        if nodata is not None and value == nodata:
            return None

        try:
            value = float(value)
        except (TypeError, ValueError):
            return None

        if math.isnan(value):
            return None

        return value
