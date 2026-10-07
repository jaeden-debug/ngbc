#!/usr/bin/env python3
"""Which state or province each 0.1 degree cell lies in, on the land-cover grid.

    python3 scripts/build-jurisdiction-foundation.py --out content/intelligence/foundation

WHY. A published range statement names places a box cannot draw: "strays wander
north as far as Canada", "strays as far as Florida, Louisiana, Kansas". To keep
records inside — or outside — the geography a statement names, the range
builder has to know which state or province a record square lies in. It is used
for that alone: never drawn, never a hunting zone, never a regulatory boundary
(CLAUDE.md 41A: a cartographic boundary is not a regulatory one).

SOURCES, both cartographic boundary files published for reuse:

  - United States: U.S. Census Bureau, Cartographic Boundary File, States,
    2023, 1:20,000,000 (cb_2023_us_state_20m). A work of the United States
    Government, in the public domain.
  - Canada: Statistics Canada, Provinces/Territories Cartographic Boundary
    File, 2021 Census (lpr_000b21a_e). Statistics Canada Open Licence.

WHAT IT WRITES. One uint8 per cell (row 0 at the NORTH edge, the land-cover
grid exactly): 0 for no state or province (sea, or outside both countries),
otherwise an index into the manifest's `codes`. A cell takes the jurisdiction
its CENTRE lies in. The Aleutians west of 180 are written where the grid keeps
them, below -180.
"""

import argparse
import gzip
import hashlib
import json
import os
import urllib.request
import zipfile

import fiona
import numpy as np
from fiona.transform import transform_geom
from rasterio.features import rasterize
from rasterio.transform import from_origin

USER_AGENT = "NorthGroundBushcraft/1.0 (+https://www.northgroundbushcraft.com)"
SOURCES = {
    "us": {
        "title": "U.S. Census Bureau, Cartographic Boundary File, States, 2023, 1:20,000,000",
        "url": "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_state_20m.zip",
        "licence": "Public domain (work of the United States Government)",
    },
    "ca": {
        "title": "Statistics Canada, Provinces/Territories Cartographic Boundary File, 2021 Census",
        "url": "https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/boundary-limites/files-fichiers/lpr_000b21a_e.zip",
        "licence": "Statistics Canada Open Licence",
    },
}
# Statistics Canada's province codes to ISO 3166-2 subdivisions.
CA_CODES = {"10": "NL", "11": "PE", "12": "NS", "13": "NB", "24": "QC", "35": "ON", "46": "MB", "47": "SK", "48": "AB", "59": "BC", "60": "YT", "61": "NT", "62": "NU"}


def sha(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return "sha256:" + digest.hexdigest()


def fetch(url, path):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=600) as response, open(path, "wb") as out:
        while True:
            chunk = response.read(1 << 22)
            if not chunk:
                break
            out.write(chunk)


def shifted(geometry, by):
    """The same geometry, one turn round: longitudes moved by `by` degrees."""
    def move(coords):
        if isinstance(coords[0], (int, float)):
            return [coords[0] + by, *coords[1:]]
        return [move(part) for part in coords]
    return {"type": geometry["type"], "coordinates": move(geometry["coordinates"])}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--cache", default=".research/jurisdictions")
    args = parser.parse_args()
    os.makedirs(args.cache, exist_ok=True)
    landcover = json.load(open(os.path.join(args.out, "landcover-2019-0.1deg.json")))
    grid = landcover["grid"]
    transform = from_origin(grid["west"], grid["north"], grid["cell"], grid["cell"])
    shape = (grid["rows"], grid["columns"])

    codes = [{"index": 0, "code": None, "name": "No state or province (sea, or outside Canada and the United States)"}]
    shapes = []
    provenance = []
    for country, source in SOURCES.items():
        archive = os.path.join(args.cache, os.path.basename(source["url"]))
        if not os.path.exists(archive):
            fetch(source["url"], archive)
        retrieved = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
        provenance.append({**source, "sha256": sha(archive), "retrievedAt": retrieved})
        folder = archive[:-4]
        with zipfile.ZipFile(archive) as bundle:
            bundle.extractall(folder)
        shapefile = next(os.path.join(folder, name) for name in os.listdir(folder) if name.endswith(".shp"))
        with fiona.open(shapefile) as layer:
            crs = layer.crs_wkt
            for feature in layer:
                props = feature["properties"]
                if country == "us":
                    code = f"US-{props['STUSPS']}"
                    name = props["NAME"]
                else:
                    code = f"CA-{CA_CODES[str(props['PRUID'])]}"
                    name = props.get("PRENAME") or props.get("PRNAME")
                geometry = transform_geom(crs, "EPSG:4326", feature["geometry"])
                index = len(codes)
                codes.append({"index": index, "code": code, "name": name})
                shapes.append((geometry, index))
                # Ground west of 180 (Attu at 172 E) is stored by the grid below -180.
                shapes.append((shifted(geometry, -360), index))
                print(f"{code:6s} {name}")

    raster = rasterize(shapes, out_shape=shape, transform=transform, fill=0, all_touched=False, dtype="uint8")
    counts = {entry["code"]: int((raster == entry["index"]).sum()) for entry in codes[1:]}
    os.makedirs(args.out, exist_ok=True)
    artifact = os.path.join(args.out, "jurisdictions-0.1deg.u8.gz")
    with gzip.GzipFile(artifact, "wb", mtime=0) as handle:
        handle.write(raster.astype(np.uint8).tobytes())
    manifest = {
        "id": "foundation:jurisdictions-0.1deg",
        "version": "1.0.0",
        "description": "The state or province each 0.1 degree cell's centre lies in, from cartographic boundary files. Used only to keep a species' records inside or outside the geography its published range statement names; never drawn and never a hunting or regulatory boundary.",
        "grid": {**grid, "layout": "row, column; uint8 index into codes"},
        "codes": codes,
        "cells": counts,
        "sources": provenance,
        "artifact": {"file": os.path.basename(artifact), "sha256": sha(artifact), "bytes": os.path.getsize(artifact)},
    }
    with open(os.path.join(args.out, "jurisdictions-0.1deg.json"), "w") as handle:
        json.dump(manifest, handle, indent=1, ensure_ascii=False)
        handle.write("\n")
    print(f"{len(codes) - 1} jurisdictions; cells per code: {json.dumps(counts)}")


if __name__ == "__main__":
    main()
