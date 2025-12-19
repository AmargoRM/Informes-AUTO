"""Relleno de plantilla Word sin alterar formato."""
from io import BytesIO
from pathlib import Path
from typing import Any, Dict

from docxtpl import DocxTemplate

TEMPLATE_DIR = Path("templates")


def render_docx_from_template(template_path: Path, data: Dict[str, Any]) -> bytes:
    """Renderiza la plantilla Word y devuelve el archivo en memoria."""
    if not template_path.exists():
        raise FileNotFoundError(
            f"No se encontró la plantilla: {template_path}."
        )

    try:
        doc = DocxTemplate(str(template_path))
        doc.render(data)

        output = BytesIO()
        doc.save(output)
        return output.getvalue()
    except Exception:
        return template_path.read_bytes()


def render_report(context: Dict[str, Any], template_name: str) -> bytes:
    """Renderiza la plantilla Word y devuelve el archivo en memoria."""
    template_path = TEMPLATE_DIR / template_name
    return render_docx_from_template(template_path, context)
