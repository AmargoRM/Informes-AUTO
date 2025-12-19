"""Relleno de plantilla Word sin alterar formato."""
from io import BytesIO
from pathlib import Path
from typing import Any, Dict

from docxtpl import DocxTemplate

TEMPLATE_DIR = Path("templates")


def render_report(context: Dict[str, Any], template_name: str) -> bytes:
    """Renderiza la plantilla Word y devuelve el archivo en memoria."""
    template_path = TEMPLATE_DIR / template_name
    if not template_path.exists():
        raise FileNotFoundError(
            f"No se encontró la plantilla: {template_path}."
        )

    doc = DocxTemplate(str(template_path))
    doc.render(context)

    output = BytesIO()
    doc.save(output)
    return output.getvalue()
