#!/usr/bin/env python3
"""
Cross-check the Alberta rows North Ground encodes against the published PDF.

    node scripts/build-alberta-regulations.mjs --emit-rows rows.json
    python3 scripts/crosscheck-alberta-guide.py guide.pdf rows.json \
        > content/regulatory/sources/ca-ab-hunting-guide-2026-crosscheck.json

The builder parses the online edition of the guide, whose tables are real HTML
cells. This script is the independent oracle: it reads the government-hosted PDF
and confirms, row by row, that the same season dates appear in the same order
and that every special-licence mark sits in the same column. It never produces a
rule. A row it cannot confirm is recorded as a disagreement, and the builder
turns that into CONFLICT rather than choosing a channel.

Requires pypdf. Not run in CI: its output is committed, and the builder refuses
to use it for any PDF whose hash differs from the one recorded here.
"""

import hashlib
import json
import re
import sys

import pypdf

DATE = re.compile(r"(Ap|Ma|Ju|A|S|O|N|D|J|F|M)(\d{1,2})\s*[-–]\s*(Ap|Ma|Ju|A|S|O|N|D|J|F|M)(\d{1,2})(,\s*\d{4})?")

# Measured on every big-game season page of the 2026 PDF: archery-only dates
# start at x 153-158 and general dates and special-licence marks at 209-237.
# Anything between is ambiguous and refused rather than assigned.
COLUMN_SPLIT = 185.0
AMBIGUOUS = (170.0, 200.0)
LINE_TOLERANCE = 2.5


def norm_date(match):
    year = (match.group(5) or "").replace(" ", "")
    return f"{match.group(1)}{int(match.group(2))} - {match.group(3)}{int(match.group(4))}{year}"


def fragments(page):
    found = []

    def visit(text, cm, tm, *_):
        text = text.strip()
        if not text:
            return
        x = cm[0] * tm[4] + cm[2] * tm[5] + cm[4]
        y = cm[1] * tm[4] + cm[3] * tm[5] + cm[5]
        found.append({"x": x, "y": y, "text": text})

    page.extract_text(visitor_text=visit)
    return found


def in_reading_order(frags):
    """Top to bottom by line, then left to right within a line."""
    ordered = sorted(frags, key=lambda f: -f["y"])
    lines = []
    for frag in ordered:
        if lines and abs(lines[-1][0]["y"] - frag["y"]) <= LINE_TOLERANCE:
            lines[-1].append(frag)
        else:
            lines.append([frag])
    return [frag for line in lines for frag in sorted(line, key=lambda f: f["x"])]


def check_big_game(page_frags, rows):
    """Rows of one region table, in printed order, against that PDF page."""
    results = []
    anchor_floor = float("inf")
    anchors = []
    for row in rows:
        first = row["wmus"][:2]
        needle = ", ".join(first)
        candidates = [
            f for f in page_frags
            if f["y"] < anchor_floor - 0.5 and re.search(r"(?<!\d)" + re.escape(needle) + r"(?!\d)", f["text"])
        ]
        if not candidates:
            anchors.append(None)
            continue
        anchor = max(candidates, key=lambda f: f["y"])
        anchors.append(anchor["y"])
        anchor_floor = anchor["y"]

    for index, row in enumerate(rows):
        if row.get("sentinel"):
            # The first row after the encoded section: it only bounds the row above.
            continue
        top = anchors[index]
        if top is None:
            results.append({"key": row["key"], "agree": False, "detail": "Row's WMU list was not found on the PDF page"})
            continue
        following = next((a for a in anchors[index + 1:] if a is not None), None)
        if following is None:
            results.append({"key": row["key"], "agree": False, "detail": "No following row bounds this row on the PDF page"})
            continue
        # A row's dates can sit a point or two above its first unit line, and its
        # continuation lines run below it until the next row's first unit line.
        band = [f for f in page_frags if following + LINE_TOLERANCE < f["y"] <= top + LINE_TOLERANCE]

        dates = []
        for frag in in_reading_order(band):
            dates.extend(norm_date(m) for m in DATE.finditer(frag["text"]))
        expected = row["archery"]["dates"] + row["general"]["dates"]

        marks = [f for f in band if f["text"] == "n"]
        ambiguous = [f for f in marks if AMBIGUOUS[0] <= f["x"] <= AMBIGUOUS[1]]
        archery_marks = sum(1 for f in marks if f["x"] < COLUMN_SPLIT)
        general_marks = sum(1 for f in marks if f["x"] >= COLUMN_SPLIT)

        problems = []
        if dates != expected:
            problems.append(f"dates in PDF order {dates} differ from the online edition {expected}")
        if ambiguous:
            problems.append("a special-licence mark sits between the columns")
        if bool(archery_marks) != row["archery"]["special"]:
            problems.append(f"archery-only special-licence mark: PDF {bool(archery_marks)}, online {row['archery']['special']}")
        if bool(general_marks) != row["general"]["special"]:
            problems.append(f"general special-licence mark: PDF {bool(general_marks)}, online {row['general']['special']}")
        results.append({"key": row["key"], "agree": not problems, "detail": "; ".join(problems) or "dates, order and special-licence columns agree"})
    return results


PLACE_NAME = re.compile(r"\s*\(([A-Za-z][^)]*)\)")


def bird_text(text):
    """Whitespace collapsed and line-break hyphenation undone ("400- 402" is 400-402)."""
    return re.sub(r"(\d)- (\d)", r"\1-\2", re.sub(r"\s+", " ", text)).strip()


def check_birds(page_text, rows):
    """
    Game-bird rows: species and limits, then the unit list and its season together.

    Compared as facts. A parenthesised place name is a label, not a unit, and the
    two channels do not always label a unit the same way; that difference is
    reported in the detail rather than hidden or treated as a changed season.
    """
    text = bird_text(page_text)
    bare = PLACE_NAME.sub("", text)
    results = []
    for row in rows:
        limits = f"{row['species']} {row['daily']} {row['possession']}"
        start = text.find(limits)
        target = f"{PLACE_NAME.sub('', bird_text(row['wmuText']))} {row['season']}"
        position = bare.find(target, PLACE_NAME.sub("", text[:start]).__len__() if start >= 0 else 0)
        agree = start >= 0 and position >= 0
        online_names = PLACE_NAME.findall(row["wmuText"])
        printed = re.search(re.escape(PLACE_NAME.sub("", bird_text(row["wmuText"]))) + r"\s*\(([^)]*)\)", text[start:] if start >= 0 else "")
        label_note = ""
        if online_names and printed and printed.group(1) != online_names[0]:
            label_note = f'; the PDF labels these units "{printed.group(1)}" where the online edition says "{online_names[0]}"'
        results.append({
            "key": row["key"],
            "agree": agree,
            "detail": ("species, limits, units and season agree" + label_note) if agree
            else f'"{limits}" then "{target}" not found in the PDF',
        })
    return results


def main():
    pdf_path, rows_path = sys.argv[1], sys.argv[2]
    with open(pdf_path, "rb") as handle:
        pdf_bytes = handle.read()
    reader = pypdf.PdfReader(pdf_path)
    manifest = json.load(open(rows_path, encoding="utf-8"))

    results = []
    for page_number, rows in manifest["bigGame"].items():
        results.extend(check_big_game(fragments(reader.pages[int(page_number) - 1]), rows))
    for page_number, rows in manifest["birds"].items():
        results.extend(check_birds(reader.pages[int(page_number) - 1].extract_text(), rows))

    json.dump({
        "purpose": (
            "An independent oracle for the Alberta builder. Rules are generated from the online edition of the "
            "2026 Alberta Guide to Hunting Regulations; this compares every generated row against the "
            "government-hosted PDF of the same guide, so a parsing error or a divergence between the two "
            "channels shows up as a disagreement instead of as a confident answer. It is never used to produce a rule."
        ),
        "pdf": {
            "url": manifest["pdfUrl"],
            "sha256": "sha256:" + hashlib.sha256(pdf_bytes).hexdigest(),
            "pages": len(reader.pages),
        },
        "rowsChecked": len(results),
        "disagreements": sum(1 for result in results if not result["agree"]),
        "rows": results,
    }, sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
