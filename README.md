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
   - `lat`, `lon`: coordenadas (si `input_crs=5367`, se interpretan como Norte/Este).
   - `input_crs`: EPSG de la coordenada (4326 o 5367).
   - `template`: ruta a la plantilla `.docx`.
   - `output_name`: nombre base del archivo generado.
3. Ejecutar el workflow y descargar el artifact `informe-word` (contiene `output/*.docx`).

Para ver valores en el Word, la plantilla debe incluir placeholders con la forma
`{{X}}`, `{{Y}}`, `{{CRS}}`, `{{FECHA_GEN}}`.

## GitHub Pages (interfaz web)

Este repositorio incluye una interfaz web estática para disparar el workflow desde
GitHub Pages: `index.html`, `style.css` y `app.js` en la raíz del repo. Para usarla:

1. Habilita GitHub Pages en **Settings → Pages** (Source: `main` / root).
2. Abre `https://amargorm.github.io/Informes-AUTO/`.
3. Ingresa tus coordenadas (WGS84 o Lambert Norte EPSG:5367), convierte si aplica y
   pulsa **Generar informe**.

### Token requerido

La web solicita un GitHub Token (PAT) para ejecutar el workflow y descargar artifacts.
El token se guarda en `localStorage` del navegador y se puede borrar con el botón
correspondiente.

Permisos mínimos recomendados:

- **Public repo**: `actions:read`, `actions:write` (workflow).
- **Private repo**: además `repo`.

### Inputs enviados al workflow

La web envía `lat_wgs84`, `lon_wgs84`, `e_5367`, `n_5367`, `expediente`, `gestor`.
Si ingresas coordenadas EPSG:5367, la web reproyecta a WGS84 para completar los
inputs requeridos.

> Nota: la reproyección EPSG:5367 utiliza una definición CRTM05 (tmerc) en el
> navegador. Ajusta `WORKFLOW_FILE` o la definición en `app.js` si cambian.

## Altitud desde DEM (Release data-dem-v1)

El workflow **Generar informe Word** descarga automáticamente el DEM desde el release
`data-dem-v1` y lo guarda en `data/dem/MED.CR.tif` (con caché de GitHub Actions). Si
la plantilla incluye `{{ALTITUD_M}}`, se rellenará con la altitud (en metros) obtenida
del DEM; si el DEM no está disponible, el campo queda vacío y el workflow continúa.

## Datos de entrada

- **Hojas cartográficas**: se descargan desde el release llamado **Hojas** (asset `Hojas.zip`) y se guardan en `data/zips/Hojas.zip`.
- **Cuencas**: se descargan desde el release llamado **Cuenca** (asset `Cuencas.zip`) y se guardan en `data/zips/Cuencas.zip`.
- **Límites administrativos**: colocar `Limites_geo.zip` en `data/zips/` (o `data/`); el workflow lo usa si está disponible.
- **DEM**: colocar en `data/` (por ejemplo `dem.tif`).
- **Plantilla**: usar `templates/plantilla.docx` o reemplazarla por otra.

## Notas

- Esta base incluye solo flujo GIS y generación de Word. No implementa cálculos hidráulicos ni lectura de Excel.
- La plantilla utiliza placeholders tipo `{{ variable }}` para rellenar valores en el informe.
