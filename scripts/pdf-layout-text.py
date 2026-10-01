#!/usr/bin/env python3
"""Layout-preserving text of a PDF, page by page, for the regulatory builders.

    python3 scripts/pdf-layout-text.py < file.pdf

The companion of `pdf-text.py`, for a source whose meaning lives in its
COLUMNS. Wyoming's Chapter 7 season table prints a row's archery dates and its
regular-season dates in separate columns and leaves an empty cell blank, so a
row with two dates is an archery season or a regular season depending only on
where the dates sit. Plain extraction collapses that whitespace unevenly; layout
extraction keeps each cell at its printed column, which the builder reads.

Same contract as `pdf-text.py`: JSON {"pypdf": version, "pages": [text, ...]},
pinned to the same pypdf version so a rebuild from unchanged bytes is identical,
and no interpretation here.
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
    pages = [page.extract_text(extraction_mode="layout") or "" for page in reader.pages]
    json.dump({"pypdf": pypdf.__version__, "pages": pages}, sys.stdout)


if __name__ == "__main__":
    main()
