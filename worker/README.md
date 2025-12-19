# Cloudflare Worker - Informes AUTO

Este Worker dispara el workflow de GitHub Actions del repositorio `AmargoRM/Informes-AUTO` y expone endpoints seguros para la interfaz web en GitHub Pages.

## Variables de entorno (secrets)

Configura estos secrets en Cloudflare:

- `GITHUB_TOKEN`: Fine-grained PAT con acceso **solo** al repo `Informes-AUTO`.
- `ALLOWED_ORIGIN`: origen permitido para CORS. Por defecto: `https://amargorm.github.io`.

## Endpoints

- `POST /dispatch`: dispara el workflow.
- `GET /latest-run`: devuelve la última ejecución.
- `GET /artifact`: descarga el artifact del último run (o `?run_id=`).

## Despliegue rápido

1. Crea un Worker nuevo en Cloudflare.
2. Copia el contenido de `worker/index.js`.
3. Agrega los secrets descritos arriba.
4. Publica el Worker y copia la URL para usarla en `/docs/app.js`.

## CORS

El Worker solo permite solicitudes desde:

- `https://amargorm.github.io`
- `http://localhost` / `http://127.0.0.1` (para pruebas locales)
