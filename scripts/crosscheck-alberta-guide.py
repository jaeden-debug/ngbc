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
# The guide's table type runs about five points a character; a space is narrower
# than six points, and the narrowest gap between two columns is fifteen.
CHAR_WIDTH = 5.0
WORD_GAP = 6.0
# Special-licence marks sit in the season columns, from x 148; the legend's own
# mark, at x 95, explains them and is not one.
MARK_MIN_X = 140.0
# The tables' leftmost column starts at x 29; footnotes and notes start at 18-23.
TABLE_LEFT = 26.0
# Larger than any page's height: page n of a table sits this far below page n-1.
PAGE_STRIDE = 1000.0
# The black bear table: archery-only dates start at x 114-118, general at 211-212.
BEAR_COLUMN_SPLIT = 165.0


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
    return coalesce(found)


def coalesce(frags):
    """
    Some pages are set word by word ("S1", "-", "O31"). Words on one line that
    abut are joined back into the run a reader sees; a gap wider than a space
    still separates two columns. A special-licence mark is never joined.
    """
    out = []
    for line in lines_of(frags):
        for frag in sorted(line, key=lambda f: f["x"]):
            last = out[-1] if out and out[-1]["line"] is line else None
            joinable = (
                last is not None and frag["text"] != "n" and last["text"] != "n"
                and frag["x"] - (last["end"]) < WORD_GAP
            )
            if joinable:
                last["text"] += " " + frag["text"]
                last["end"] = frag["x"] + len(frag["text"]) * CHAR_WIDTH
            else:
                out.append({**frag, "line": line, "end": frag["x"] + len(frag["text"]) * CHAR_WIDTH})
    return [{"x": f["x"], "y": f["y"], "text": f["text"]} for f in out]


def lines_of(frags):
    lines = []
    for frag in sorted(frags, key=lambda f: -f["y"]):
        if lines and abs(lines[-1][0]["y"] - frag["y"]) <= LINE_TOLERANCE:
            lines[-1].append(frag)
        else:
            lines.append([frag])
    return lines


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


def pages_as_one(reader, page_numbers):
    """
    A region's table runs across several printed pages. Their fragments are laid
    end to end, each later page below the one before, so "the row below" can
    continue onto the next page exactly as a reader turns it.
    """
    frags = []
    for index, number in enumerate(page_numbers):
        for frag in fragments(reader.pages[number - 1]):
            frags.append({**frag, "y": frag["y"] - index * PAGE_STRIDE})
    floor = -(len(page_numbers) - 1) * PAGE_STRIDE - 1.0
    return frags, floor


def needle_pattern(wmus):
    """
    The row's first units as printed. The channels punctuate grouped units
    differently ("(151, 152) (156" online, "(151, 152), (156" in the PDF), so
    only the numbers and their order are matched. A footnote reference ("^1")
    may be fused into the printed number ("9361" is WMU 936, footnote 1) or set
    apart as a superscript, so it is optional.
    """
    units = re.findall(r"(\d+)(?:\^([\d.]+))?", " ".join(wmus))[:2]
    parts = [unit + (f"(?:{re.escape(refs.replace('.', ''))})?" if refs else "") for unit, refs in units]
    return r"(?<!\d)" + r"[\s,()]+".join(parts) + r"(?!\d)"


def check_big_game(page_frags, rows, floor):
    """Rows of one region table, in printed order, against that PDF page."""
    results = []
    anchor_floor = float("inf")
    anchors = []
    for row in rows:
        pattern = needle_pattern(row["wmus"][:2])
        candidates = [
            f for f in page_frags
            if f["y"] < anchor_floor - 0.5 and re.search(pattern, f["text"])
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
        # The last row of a region with nothing printed after it runs to the
        # bottom of the region's last page.
        # bottom of the region's last page, or to the first line printed in the
        # left margin below it (a footnote or a note), which the table never uses.
        following = next((a for a in anchors[index + 1:] if a is not None), None)
        if following is None:
            margin = [f["y"] for f in page_frags if f["x"] < TABLE_LEFT and f["y"] < top - LINE_TOLERANCE]
            following = max(margin, default=floor)
        # A row's dates can sit a point or two above its first unit line, and its
        # continuation lines run below it until the next row's first unit line.
        band = [f for f in page_frags if following + LINE_TOLERANCE < f["y"] <= top + LINE_TOLERANCE]

        dates = []
        for frag in in_reading_order(band):
            dates.extend(norm_date(m) for m in DATE.finditer(frag["text"]))
        # The channels space a printed year differently ("J1 - J31, 2027" and "J1 - J31,2027").
        expected = [re.sub(r",\s*", ",", date) for date in row["archery"]["dates"] + row["general"]["dates"]]

        marks = [f for f in band if f["text"] == "n" and f["x"] >= MARK_MIN_X]
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
        results.append({
            "key": row["key"],
            "agree": not problems,
            "detail": "; ".join(problems) or "dates, order and special-licence columns agree",
            # What the PDF prints for the row, so a disagreement can be narrowed
            # to the days it is about rather than spread over the whole row.
            "pdfDates": dates,
            "marksAgree": not ambiguous
            and bool(archery_marks) == row["archery"]["special"]
            and bool(general_marks) == row["general"]["special"],
        })
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


def check_text_rows(page_frags, rows):
    """
    Rows whose dates are printed as words: on the line carrying the row's first
    units, the archery-only dates then the general dates, each in its column.
    """
    results = []
    floor = float("inf")
    for row in rows:
        pattern = needle_pattern(row["wmus"])
        candidates = [f for f in page_frags if f["y"] < floor - 0.5 and re.search(pattern, f["text"])]
        if not candidates:
            results.append({"key": row["key"], "agree": False, "detail": "Row's WMU list was not found on the PDF page"})
            continue
        anchor = max(candidates, key=lambda f: f["y"])
        floor = anchor["y"]
        line = in_reading_order([f for f in page_frags if abs(f["y"] - anchor["y"]) <= LINE_TOLERANCE])
        text = re.sub(r"\s+", " ", " ".join(f["text"] for f in line))
        expected = " ".join(part for part in (row["archery"], row["general"]) if part)
        problems = []
        position = text.find(expected)
        if position < 0 or re.search(pattern, text[position + len(expected):]) is None:
            problems.append(f'"{expected}" then units "{", ".join(row["wmus"])}" not found on the printed line "{text}"')
        first_date = next((f for f in line if re.match(r"(Aug|Sept|Oct|Nov|Apr|May|June)\.? \d", f["text"])), None)
        if first_date is None:
            problems.append("no date on the printed line")
        else:
            archery_first = first_date["x"] < BEAR_COLUMN_SPLIT
            if archery_first != bool(row["archery"]):
                problems.append(f"first date printed in the {'archery-only' if archery_first else 'general'} column")
        results.append({"key": row["key"], "agree": not problems, "detail": "; ".join(problems) or "dates, columns and units agree"})
    return results


def main():
    pdf_path, rows_path = sys.argv[1], sys.argv[2]
    with open(pdf_path, "rb") as handle:
        pdf_bytes = handle.read()
    reader = pypdf.PdfReader(pdf_path)
    manifest = json.load(open(rows_path, encoding="utf-8"))

    results = []
    for pages_key, rows in manifest["bigGame"].items():
        frags, floor = pages_as_one(reader, [int(number) for number in pages_key.split(",")])
        results.extend(check_big_game(frags, rows, floor))
    for page_number, rows in manifest["birds"].items():
        results.extend(check_birds(reader.pages[int(page_number) - 1].extract_text(), rows))
    for page_number, rows in manifest.get("textRows", {}).items():
        results.extend(check_text_rows(fragments(reader.pages[int(page_number) - 1]), rows))

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
