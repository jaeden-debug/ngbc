#!/usr/bin/env python3
"""The terrain foundation species surfaces stand on: how high the ground is and
how broken it is, per 0.1 degree cell, on the same grid as the land cover.

    python3 scripts/build-terrain-foundation.py --out content/intelligence/foundation

SOURCE. NOAA NCEI ETOPO 2022 Global Relief Model, 60 arc-second surface
elevation (GeoTIFF). A work of the United States Government, in the public
domain. DOI 10.25921/fd45-gt74.

WHAT IT WRITES. For each 0.1 degree cell (the land-cover grid: 24N to 84N,
170W to 50W, 1200 x 600, row 0 at the NORTH edge):

  - MEAN elevation in metres (int16; below sea level is negative), and
  - LOCAL RELIEF in metres (uint16): the highest sample minus the lowest in the
    cell, from the 36 one-arc-minute samples inside it — the classic measure of
    how broken the ground is. Cliffs and mountain faces are high; plains, lakes
    and sea are near zero.

As one gzipped little-endian array of (mean, relief) pairs, cell-major, with a
manifest carrying the grid, the source's URL, sha256, DOI and licence.

WHAT IT DOES NOT DO. It does not smooth, fill or decide anything about an
animal. A species profile decides what height or relief means for that species.
"""

import argparse
import gzip
import hashlib
import json
import os
import urllib.request

import numpy as np
import rasterio
from rasterio.windows import from_bounds

SOURCES = [
    "https://www.ngdc.noaa.gov/thredds/fileServer/global/ETOPO2022/60s/60s_surface_elev_gtif/ETOPO_2022_v1_60s_N90W180_surface.tif",
    "https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/data/60s/60s_surface_elev_gtif/ETOPO_2022_v1_60s_N90W180_surface.tif",
]


def fetch(cache):
    if os.path.exists(cache):
        return None
    last = None
    for url in SOURCES:
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "NorthGroundBushcraft/1.0"})
            with urllib.request.urlopen(request, timeout=600) as response, open(cache, "wb") as out:
                while True:
                    chunk = response.read(16 * 1024 * 1024)
                    if not chunk:
                        break
                    out.write(chunk)
            return url
        except Exception as error:  # noqa: BLE001 — every refusal is reported, then the next official path is tried
            last = f"{url}: {error}"
            print(f"could not read {last}")
            if os.path.exists(cache):
                os.remove(cache)
    raise SystemExit(f"no official ETOPO 2022 path answered; last: {last}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--west", type=float, default=-170.0)
    parser.add_argument("--east", type=float, default=-50.0)
    parser.add_argument("--south", type=float, default=17.5)
    parser.add_argument("--north", type=float, default=84.0)
    parser.add_argument("--cell", type=float, default=0.1)
    parser.add_argument("--cache", default="/tmp/etopo2022-60s.tif")
    args = parser.parse_args()

    url = fetch(args.cache) or SOURCES[0]
    digest = hashlib.sha256()
    with open(args.cache, "rb") as handle:
        for chunk in iter(lambda: handle.read(16 * 1024 * 1024), b""):
            digest.update(chunk)

    cols = round((args.east - args.west) / args.cell)
    rows = round((args.north - args.south) / args.cell)
    with rasterio.open(args.cache) as source:
        window = from_bounds(args.west, args.south, args.east, args.north, source.transform)
        data = source.read(1, window=window.round_offsets().round_lengths(), boundless=True, fill_value=0).astype(np.float32)
        transform = source.window_transform(window.round_offsets().round_lengths())
        print(f"source {source.width}x{source.height}, res {source.res}, window {data.shape}, origin {transform.c:.5f},{transform.f:.5f}")

    # Assign every sample to the output cell its centre falls in.
    sample_rows, sample_cols = data.shape
    lon = transform.c + (np.arange(sample_cols) + 0.5) * transform.a
    lat = transform.f + (np.arange(sample_rows) + 0.5) * transform.e
    col_of = np.floor((lon - args.west) / args.cell).astype(np.int64)
    row_of = np.floor((args.north - lat) / args.cell).astype(np.int64)
    keep_c = (col_of >= 0) & (col_of < cols)
    keep_r = (row_of >= 0) & (row_of < rows)
    data = data[np.ix_(keep_r, keep_c)]
    row_of = row_of[keep_r]
    col_of = col_of[keep_c]
    cell = (row_of[:, None] * cols + col_of[None, :]).ravel()
    values = data.ravel()
    count = np.bincount(cell, minlength=rows * cols).astype(np.float64)
    total = np.bincount(cell, weights=values, minlength=rows * cols)
    order = np.argsort(cell, kind="stable")
    sorted_cells = cell[order]
    sorted_values = values[order]
    starts = np.searchsorted(sorted_cells, np.arange(rows * cols))
    has = count > 0
    high = np.full(rows * cols, 0.0, dtype=np.float64)
    low = np.full(rows * cols, 0.0, dtype=np.float64)
    high[has] = np.maximum.reduceat(sorted_values, starts[has])
    low[has] = np.minimum.reduceat(sorted_values, starts[has])
    mean = np.where(has, total / np.maximum(count, 1), 0)
    relief = np.where(has, high - low, 0)
    print(f"samples per cell: min {int(count[has].min())}, max {int(count.max())}; cells without samples {int((~has).sum())}")

    out = np.empty(rows * cols * 2, dtype="<i2")
    out[0::2] = np.clip(np.round(mean), -32768, 32767).astype("<i2")
    out[1::2] = np.clip(np.round(relief), 0, 32767).astype("<i2")
    raw = out.tobytes()
    packed = gzip.compress(raw, compresslevel=9, mtime=0)
    os.makedirs(args.out, exist_ok=True)
    name = "terrain-etopo2022-0.1deg.i16.gz"
    with open(os.path.join(args.out, name), "wb") as handle:
        handle.write(packed)
    manifest = {
        "id": "foundation:terrain-etopo2022-0.1deg",
        "version": "1.0.0",
        "description": "Mean elevation and local relief (highest minus lowest of the one-arc-minute samples) per 0.1 degree cell, from NOAA ETOPO 2022. A summary of the source per cell, not a model.",
        "grid": {"west": args.west, "east": args.east, "south": args.south, "north": args.north, "cell": args.cell, "columns": cols, "rows": rows, "rowOrder": "NORTH_TO_SOUTH", "layout": "row, column, [meanMetres int16, reliefMetres int16], little-endian"},
        "source": {
            "title": "ETOPO 2022 15 Arc-Second Global Relief Model family: 60 arc-second surface elevation",
            "url": url,
            "doi": "10.25921/fd45-gt74",
            "sha256": f"sha256:{digest.hexdigest()}",
            "licence": "Public domain (work of the United States Government, NOAA National Centers for Environmental Information)",
            "attribution": "NOAA National Centers for Environmental Information. 2022: ETOPO 2022 15 Arc-Second Global Relief Model. doi:10.25921/fd45-gt74.",
        },
        "artifact": {"file": name, "sha256": f"sha256:{hashlib.sha256(packed).hexdigest()}", "bytes": len(packed)},
    }
    with open(os.path.join(args.out, "terrain-etopo2022-0.1deg.json"), "w") as handle:
        json.dump(manifest, handle, indent=2)
        handle.write("\n")
    print(json.dumps(manifest["artifact"]))


if __name__ == "__main__":
    main()
