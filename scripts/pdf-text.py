#!/usr/bin/env python3
"""Plain text of a PDF, page by page, for the regulatory builders.

    python3 scripts/pdf-text.py < file.pdf

Reads the PDF from stdin and writes JSON: {"pypdf": version, "pages": [text, ...]}.

The builders parse official U.S. regulation booklets that exist only as PDF.
Text extraction must be reproducible, or a rebuild from an unchanged source
would differ and the generated-bundle check would be red for no reason, so the
builder refuses to run unless pypdf is exactly the pinned version below (the
same version CI installs). This script does no interpretation: it returns what
pypdf extracts, and every rule the builders read from it is matched against
expected wording that refuses on drift.
"""

import io
import json
import sys

import pypdf

PINNED = "6.19.0"


def main() -> None:
    if pypdf.__version__ != PINNED:
        sys.stderr.write(f"pypdf {pypdf.__version__} is installed; the builders are pinned to {PINNED}\n")
        sys.exit(4)
    reader = pypdf.PdfReader(io.BytesIO(sys.stdin.buffer.read()))
    pages = [page.extract_text() or "" for page in reader.pages]
    json.dump({"pypdf": pypdf.__version__, "pages": pages}, sys.stdout)


if __name__ == "__main__":
    main()
