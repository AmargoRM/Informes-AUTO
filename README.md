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

## Generar informe Word desde GitHub Actions

1. Ir a **Actions** → **Generar informe Word** → **Run workflow**.
2. Completar los inputs:
   - `x`, `y`: coordenadas.
   - `crs`: EPSG de la coordenada.
   - `template`: ruta a la plantilla `.docx`.
   - `output_name`: nombre base del archivo generado.
3. Ejecutar el workflow y descargar el artifact `informe-word` (contiene `output/*.docx`).

Para ver valores en el Word, la plantilla debe incluir placeholders con la forma
`{{X}}`, `{{Y}}`, `{{CRS}}`, `{{FECHA_GEN}}`.

## Altitud desde DEM (Release data-dem-v1)

El workflow **Generar informe Word** descarga automáticamente el DEM desde el release
`data-dem-v1` y lo guarda en `data/dem/MED.CR.tif` (con caché de GitHub Actions). Si
la plantilla incluye `{{ALTITUD_M}}`, se rellenará con la altitud (en metros) obtenida
del DEM; si el DEM no está disponible, el campo queda vacío y el workflow continúa.

## Datos de entrada

- **Shapefiles**: colocar en `data/` (por ejemplo `capas.shp`).
- **DEM**: colocar en `data/` (por ejemplo `dem.tif`).
- **Plantilla**: usar `templates/plantilla.docx` o reemplazarla por otra.

## Notas

- Esta base incluye solo flujo GIS y generación de Word. No implementa cálculos hidráulicos ni lectura de Excel.
- La plantilla utiliza placeholders tipo `{{ variable }}` para rellenar valores en el informe.
