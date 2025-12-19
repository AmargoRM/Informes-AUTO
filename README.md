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
├── docs/                # GitHub Pages (frontend)
├── src/
│   ├── __init__.py
│   ├── dem.py            # Lectura de altitud desde DEM
│   ├── gis.py            # Reproyección y spatial joins
│   └── word_fill.py      # Relleno de plantilla Word
├── templates/
│   └── plantilla.docx    # Plantilla Word de ejemplo
├── worker/               # Cloudflare Worker (backend)
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
   - `lat`, `lon`: coordenadas WGS84.
   - `exp` (opcional): expediente.
   - `gestor` (opcional): gestor responsable.
3. Ejecutar el workflow y descargar el artifact del informe Word.

Para ver valores en el Word, la plantilla debe incluir placeholders con la forma
`{{X}}`, `{{Y}}`, `{{CRS}}`, `{{FECHA_GEN}}`.

## GitHub Pages + Cloudflare Worker (interfaz web)

Esta arquitectura evita pedir tokens al usuario final. El frontend en GitHub Pages
se comunica con un Cloudflare Worker que contiene el token como secret.

### 1) Activar GitHub Pages desde `/docs`

1. En el repositorio, ve a **Settings → Pages**.
2. Selecciona **Source: Deploy from a branch**.
3. Elige la rama `main` y carpeta `/docs`.
4. Guarda los cambios y abre la URL: `https://amargorm.github.io/Informes-AUTO/`.

### 2) Desplegar el Cloudflare Worker

1. Crea un Worker nuevo en Cloudflare.
2. Copia el contenido de `worker/index.js`.
3. Agrega los secrets:
   - `GITHUB_TOKEN`: Fine-grained PAT con acceso solo al repo `Informes-AUTO`.
   - `ALLOWED_ORIGIN`: `https://amargorm.github.io` (valor por defecto).
4. Publica el Worker y copia la URL (`https://TU-WORKER.workers.dev`).

### 3) Configurar el frontend

Edita `docs/app.js` y define la constante:

```js
const WORKER_BASE_URL = "https://TU-WORKER.workers.dev";
```

> **Nota:** el usuario nunca ingresa tokens en la web. Todo el acceso a GitHub
> se realiza desde el Worker usando secrets.

### Permisos mínimos del token

Configura un Fine-grained PAT con acceso **solo** al repositorio `Informes-AUTO` y
los siguientes permisos:

- **Actions**: Read and write
- **Contents**: Read
- **Metadata**: Read

No uses scopes amplios ni permisos adicionales.

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
