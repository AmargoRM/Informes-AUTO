# Informes por coordenada (Streamlit)

Aplicación local en Streamlit para generar informes Word (.docx) a partir de una coordenada ingresada por el usuario.

## Requisitos

- Python 3.9+
- Dependencias en `requirements.txt`

## Estructura del proyecto

```
.
├── app.py
├── data/                # Coloque aquí shapefiles y DEM reales
├── src/
│   ├── __init__.py
│   ├── dem.py            # Lectura de altitud desde DEM
│   ├── gis.py            # Reproyección y spatial joins
│   └── word_fill.py      # Relleno de plantilla Word
├── templates/
│   └── plantilla.docx    # Plantilla Word de ejemplo
└── requirements.txt
```

## Instalación

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Ejecutar la app

```bash
streamlit run app.py
```

## Datos de entrada

- **Shapefiles**: colocar en `data/` (por ejemplo `capas.shp`).
- **DEM**: colocar en `data/` (por ejemplo `dem.tif`).
- **Plantilla**: usar `templates/plantilla.docx` o reemplazarla por otra.

## Notas

- Esta base incluye solo flujo GIS y generación de Word. No implementa cálculos hidráulicos ni lectura de Excel.
- La plantilla utiliza placeholders tipo `{{ variable }}` para rellenar valores en el informe.
