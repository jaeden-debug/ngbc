#!/usr/bin/env python3
"""
Read the 2026-2028 British Columbia Hunting and Trapping Regulations Synopsis and
record, per region and species, the open-season date ranges it prints.

    curl -o synopsis.pdf <BC_SYNOPSIS_URL>
    python3 scripts/crosscheck-british-columbia-synopsis.py synopsis.pdf \
        > content/regulatory/sources/ca-bc-synopsis-2026-2028-crosscheck.json

The synopsis is a summary; the law is B.C. Reg. 190/84. This script is the
independent oracle the builder compares the law's rows against. It never
produces a rule. The builder refuses a cross-check made from a PDF whose hash
differs from the one recorded here, and every range the two disagree on must be
a reviewed, encoded dispute.

Requires pypdf. Not run in CI: its output is committed.
"""

import hashlib
import json
import re
import sys

import pypdf

# The "General Open Seasons" pages of each region (1-based), found by their
# running heads in the 2026-2028 edition. A changed PDF changes its hash, and the
# builder then refuses this record until the pages are re-read.
PAGES = {1: [23], 2: [30], 3: [36], 4: [41, 42], 5: [46], 6: [52, 53], 7: [59, 64, 65], 8: [70]}

SPECIES = {
    "black-bear": r"BLACK BEAR",
    "snowshoe-hare": r"SNOWSHOE HARE",
    "ptarmigan": r"PTARMIGAN",
    "sharp-tailed-grouse": r"SHARP-TAILED GROUSE",
    # "GROUSE: SOOTY (Blue) & RUFFED", "GROUSE: DUSKY (Blue), RUFFED & SPRUCE", "GROUSE: SPRUCE & RUFFED",
    # "SPRUCE & RUFFED GROUSE". Region 7's "DUSKY (Blue) GROUSE" row is blue grouse only and is not matched.
    "ruffed-spruce-grouse": r"(?:GROUSE:\s*(?:SOOTY|DUSKY|SPRUCE)|SPRUCE & RUFFED GROUSE)",
}

# Any all-caps species heading ends the previous species' block.
HEADING = re.compile(
    r"(?m)^(?:MULE DEER|WHITE-TAILED DEER|MOOSE|ELK|CARIBOU|BIGHORN|THINHORN|MOUNTAIN|BLACK BEAR|GRIZZLY|WOLF|COYOTE|COUGAR|BOBCAT|LYNX|RACCOON|"
    r"SNOWSHOE HARE|COLUMBIAN|GROUSE|DUSKY|SPRUCE|RUFFED|SHARP-TAILED|PTARMIGAN|CHUKAR|GRAY|PHEASANT|TURKEY|DOVE|BAND-TAILED|COMMON SNIPE|"
    r"COOTS|DUCKS|GEESE|RAVEN|BISON|FALLOW|WILD TURKEY|WOLVERINE|CALIFORNIA|QUAIL|SKUNK|MARTEN|WILD BOAR)"
)
MONTHS = {"Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "June": 6, "Jun": 6, "July": 7, "Jul": 7,
          "Aug": 8, "Sept": 9, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12}
RANGE = re.compile(r"(Jan|Feb|Mar|Apr|May|June|Jun|July|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\.?\s*(\d{1,2})\s*[-–]\s*"
                   r"(Jan|Feb|Mar|Apr|May|June|Jun|July|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\.?\s*(\d{1,2})")


def blocks(text, pattern):
    """Each block runs from a heading naming the species to the next species heading."""
    out = []
    for match in re.finditer(r"(?m)^" + pattern, text):
        rest = text[match.start():]
        # A heading can wrap ("GROUSE: DUSKY (Blue), RUFFED &\nSPRUCE"): until the block's first
        # Management Unit reference, a heading match is the same heading continuing.
        first_unit = re.search(r"\d-\d", rest)
        start = first_unit.start() if first_unit else 0
        following = [m.start() for m in HEADING.finditer(rest) if m.start() > start]
        out.append(rest[: following[0]] if following else rest[:1500])
    return out


def main():
    path = sys.argv[1]
    data = open(path, "rb").read()
    reader = pypdf.PdfReader(path)
    record = {"pdfSha256": "sha256:" + hashlib.sha256(data).hexdigest(), "pages": PAGES, "regions": {}}
    for region, pages in PAGES.items():
        text = "\n".join(reader.pages[page - 1].extract_text() or "" for page in pages)
        region_record = {}
        for species, pattern in SPECIES.items():
            ranges = set()
            quotes = []
            for block in blocks(text, pattern):
                # "per licence year (Apr 1 - Mar 31)" defines a year, not a season.
                block = re.sub(r"licence year \([^)]*\)", "licence year", block)
                quotes.append(re.sub(r"\s+", " ", block).strip()[:600])
                for m in RANGE.finditer(block):
                    ranges.add((MONTHS[m.group(1)], int(m.group(2)), MONTHS[m.group(3)], int(m.group(4))))
            if ranges:
                region_record[species] = {"ranges": sorted(list(r) for r in ranges), "blocks": quotes}
        record["regions"][str(region)] = region_record
    json.dump(record, sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
