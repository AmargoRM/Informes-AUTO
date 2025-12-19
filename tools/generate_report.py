"""Generate a Word report from CLI inputs."""
from __future__ import annotations

import argparse
from datetime import datetime
import os
from pathlib import Path

from src.word_fill import render_docx_from_template


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Genera un informe Word desde una coordenada.")
    parser.add_argument("--x", required=True, help="Coordenada X")
    parser.add_argument("--y", required=True, help="Coordenada Y")
    parser.add_argument("--crs", required=True, help="CRS de la coordenada")
    parser.add_argument("--template", required=True, help="Ruta a la plantilla DOCX")
    parser.add_argument(
        "--output-name",
        default="informe",
        help="Nombre base del archivo de salida",
    )
    parser.add_argument(
        "--out",
        help="Ruta de salida completa (sobrescribe el nombre por defecto)",
    )
    return parser.parse_args()


def resolve_output_path(output_name: str, out_override: str | None) -> Path:
    if out_override:
        return Path(out_override)

    run_id = os.environ.get("GITHUB_RUN_ID")
    if not run_id:
        run_id = datetime.now().strftime("%Y%m%d%H%M%S")
    return Path("output") / f"{output_name}_{run_id}.docx"


def main() -> None:
    args = parse_args()

    data = {
        "X": args.x,
        "Y": args.y,
        "CRS": args.crs,
        "FECHA_GEN": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }

    output_path = resolve_output_path(args.output_name, args.out)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    docx_bytes = render_docx_from_template(Path(args.template), data)
    output_path.write_bytes(docx_bytes)


if __name__ == "__main__":
    main()
