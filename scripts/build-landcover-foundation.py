#!/usr/bin/env python3
"""The land-cover foundation species models stand on: what covers the ground,
as fractions per grid cell over Canada and the United States.

    python3 scripts/build-landcover-foundation.py --url URL --out content/intelligence/foundation

SOURCE. The Copernicus Global Land Service 100 m land cover map (collection 3,
epoch 2019), discrete classification, EPSG:4326, published on Zenodo under
CC BY 4.0. It separates needleleaf, deciduous broadleaf and mixed forest, open
and closed, which every forest species model needs and a generic "tree cover"
class cannot give.

WHAT IT WRITES. For each 0.1 degree cell, the share of the cell in each of
eighteen cover groups, as whole percents (a cell sums to 100 within rounding).
Written as a gzipped uint8 array, cell-major, row 0 at the NORTH edge, with a
manifest carrying the grid, the groups, the source's URL, sha256 and licence.
Every pixel is counted: a cell is a histogram of the source, not a sample.

WHAT IT DOES NOT DO. It does not smooth, fill, reclassify beyond grouping the
source's own classes, or decide anything about any animal.
"""

import argparse
import gzip
import hashlib
import json
import math
import os
import sys
import urllib.request

import numpy as np
import rasterio
from rasterio.windows import Window

# The source's own class codes, grouped. Order is the byte order in each cell.
GROUPS = [
    ("NEEDLELEAF_CLOSED", [111, 113]),
    ("NEEDLELEAF_OPEN", [121, 123]),
    ("BROADLEAF_CLOSED", [112, 114]),
    ("BROADLEAF_OPEN", [122, 124]),
    ("MIXED_CLOSED", [115]),
    ("MIXED_OPEN", [125]),
    ("FOREST_UNKNOWN", [116, 126]),
    ("SHRUB", [20]),
    ("HERBACEOUS", [30]),
    ("CROPLAND", [40]),
    ("BUILT", [50]),
    ("BARE_SPARSE", [60]),
    ("SNOW_ICE", [70]),
    ("WATER", [80]),
    ("HERBACEOUS_WETLAND", [90]),
    ("MOSS_LICHEN", [100]),
    ("SEA", [200]),
    ("NO_DATA", [0, 255]),
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--licence", default="CC BY 4.0")
    parser.add_argument("--title", default="Copernicus Global Land Service: Land Cover 100m, collection 3, epoch 2019 (discrete classification)")
    parser.add_argument("--doi", default="")
    parser.add_argument("--west", type=float, default=-170.0)
    parser.add_argument("--east", type=float, default=-50.0)
    parser.add_argument("--south", type=float, default=17.5)
    parser.add_argument("--north", type=float, default=84.0)
    parser.add_argument("--cell", type=float, default=0.1)
    parser.add_argument("--cache", default="/tmp/landcover.tif")
    args = parser.parse_args()

    if not os.path.exists(args.cache):
        with urllib.request.urlopen(urllib.request.Request(args.url, headers={"User-Agent": "NorthGroundBushcraft/1.0"})) as response, open(args.cache, "wb") as out:
            while True:
                chunk = response.read(16 * 1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)
    digest = hashlib.sha256()
    with open(args.cache, "rb") as handle:
        for chunk in iter(lambda: handle.read(16 * 1024 * 1024), b""):
            digest.update(chunk)
    source_hash = f"sha256:{digest.hexdigest()}"

    lookup = np.full(256, len(GROUPS) - 1, dtype=np.uint8)
    for index, (_, codes) in enumerate(GROUPS):
        for code in codes:
            lookup[code] = index

    ncols = int(round((args.east - args.west) / args.cell))
    nrows = int(round((args.north - args.south) / args.cell))
    ngroups = len(GROUPS)
    out = np.zeros((nrows, ncols, ngroups), dtype=np.uint8)

    with rasterio.open(args.cache) as src:
        if src.crs is None or src.crs.to_epsg() != 4326:
            sys.exit(f"expected EPSG:4326, got {src.crs}")
        transform = src.transform
        px_w, px_h = transform.a, -transform.e
        # Source columns spanning the bbox, and the cell each column falls in.
        col0 = int(math.floor((args.west - transform.c) / px_w))
        col1 = int(math.ceil((args.east - transform.c) / px_w))
        col_lon = transform.c + (np.arange(col0, col1) + 0.5) * px_w
        col_cell = np.floor((col_lon - args.west) / args.cell).astype(np.int64)
        col_ok = (col_cell >= 0) & (col_cell < ncols)
        for row in range(nrows):
            cell_north = args.north - row * args.cell
            cell_south = cell_north - args.cell
            r0 = int(math.floor((transform.f - cell_north) / px_h))
            r1 = int(math.ceil((transform.f - cell_south) / px_h))
            r0 = max(r0, 0)
            r1 = min(r1, src.height)
            if r1 <= r0:
                continue
            # A pixel belongs to the cell its centre falls in.
            centres = transform.f - (np.arange(r0, r1) + 0.5) * px_h
            keep_rows = (centres <= cell_north) & (centres > cell_south)
            block = src.read(1, window=Window(col0, r0, col1 - col0, r1 - r0))[keep_rows][:, col_ok]
            groups = lookup[block]
            cells = np.broadcast_to(col_cell[col_ok], groups.shape)
            counts = np.bincount((cells * ngroups + groups).ravel(), minlength=ncols * ngroups).reshape(ncols, ngroups)
            totals = counts.sum(axis=1, keepdims=True)
            with np.errstate(invalid="ignore", divide="ignore"):
                shares = np.where(totals > 0, np.rint(100.0 * counts / totals), 0)
            out[row] = shares.astype(np.uint8)
            if row % 50 == 0:
                print(f"row {row}/{nrows}", flush=True)

    os.makedirs(args.out, exist_ok=True)
    payload = gzip.compress(out.tobytes(), compresslevel=9, mtime=0)
    with open(os.path.join(args.out, "landcover-2019-0.1deg.u8.gz"), "wb") as handle:
        handle.write(payload)
    manifest = {
        "id": "foundation:landcover-cgls-lc100-2019-0.1deg",
        "version": "1.0.0",
        "description": "Share of each 0.1 degree cell in eighteen cover groups, from the Copernicus Global Land Service 100 m land cover map, 2019. A histogram of the source per cell, not a model.",
        "grid": {"west": args.west, "east": args.east, "south": args.south, "north": args.north, "cell": args.cell, "columns": ncols, "rows": nrows, "rowOrder": "NORTH_TO_SOUTH", "layout": "row, column, group; uint8 percent"},
        "groups": [{"name": name, "sourceCodes": codes} for name, codes in GROUPS],
        "source": {"title": args.title, "url": args.url, "doi": args.doi, "sha256": source_hash, "licence": args.licence, "resolution": "100 m (1/1008 degree)", "epoch": 2019,
                   "attribution": "Contains modified Copernicus Global Land Service information (2019). Buchhorn, M. et al., Copernicus Global Land Service: Land Cover 100m: collection 3: epoch 2019: Globe."},
        "artifact": {"file": "landcover-2019-0.1deg.u8.gz", "sha256": "sha256:" + hashlib.sha256(payload).hexdigest(), "bytes": len(payload)},
    }
    with open(os.path.join(args.out, "landcover-2019-0.1deg.json"), "w") as handle:
        json.dump(manifest, handle, indent=2)
        handle.write("\n")
    print(json.dumps(manifest["artifact"]))


if __name__ == "__main__":
    main()
