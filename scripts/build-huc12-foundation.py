#!/usr/bin/env python3
"""Which 12-digit hydrologic unit (HUC12) each 0.1 degree cell's centre lies in.

    python3 scripts/build-huc12-foundation.py --out content/intelligence/foundation

WHY. USGS GAP publishes each species' range as a table of HUC12 sub-watersheds,
each with its own origin, presence, reproduction and season, plus a shapefile
dissolved by season alone. The shapefile cannot tell known ground from
extirpated or merely possible ground, so 27 maps were refused whole. With the
HUC12 a cell lies in, the table itself can be read: a cell is in an
authority's range when the sub-watershed at its centre is "Known/extant".

SOURCE. U.S. Geological Survey, Watershed Boundary Dataset (WBD), national
file geodatabase, layer WBDHU12. A work of the United States Government, in
the public domain.

WHAT IT WRITES. One uint32 per cell (row 0 at the NORTH edge, the land-cover
grid exactly): 0 for no HUC12, otherwise 1 + an index into the manifest's
`hucs`. A cell takes the HUC12 its CENTRE lies in, so a sub-watershed smaller
than a cell may hold no centre and is then simply not represented — a range
read this way can only be narrower than GAP's, never wider.
"""

import argparse
import datetime
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
SOURCE = {
    "title": "U.S. Geological Survey, Watershed Boundary Dataset (WBD), national file geodatabase, layer WBDHU12",
    "url": "https://prd-tnm.s3.amazonaws.com/StagedProducts/Hydrography/WBD/National/GDB/WBD_National_GDB.zip",
    "licence": "Public domain (work of the United States Government)",
}


def sha(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return "sha256:" + digest.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--cache", default=".research/wbd")
    args = parser.parse_args()
    os.makedirs(args.cache, exist_ok=True)
    grid = json.load(open(os.path.join(args.out, "landcover-2019-0.1deg.json")))["grid"]
    transform = from_origin(grid["west"], grid["north"], grid["cell"], grid["cell"])
    shape = (grid["rows"], grid["columns"])

    archive = os.path.join(args.cache, os.path.basename(SOURCE["url"]))
    if not os.path.exists(archive):
        request = urllib.request.Request(SOURCE["url"], headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=1800) as response, open(archive, "wb") as out:
            while True:
                chunk = response.read(1 << 22)
                if not chunk:
                    break
                out.write(chunk)
    retrieved = datetime.datetime.now(datetime.timezone.utc).isoformat()
    folder = archive[:-4]
    with zipfile.ZipFile(archive) as bundle:
        bundle.extractall(folder)
    gdb = next(os.path.join(root, name) for root, dirs, _ in os.walk(folder) for name in dirs if name.lower().endswith(".gdb"))
    layer_name = next(name for name in fiona.listlayers(gdb) if name.upper() == "WBDHU12")

    hucs = []
    shapes = []
    with fiona.open(gdb, layer=layer_name) as layer:
        crs = layer.crs_wkt
        field = next(name for name in layer.schema["properties"] if name.lower() == "huc12")
        for feature in layer:
            code = feature["properties"][field]
            if not code or feature["geometry"] is None:
                continue
            hucs.append(str(code))
            shapes.append((transform_geom(crs, "EPSG:4326", feature["geometry"]), len(hucs)))
    print(f"{len(hucs)} HUC12 polygons read from {layer_name}")

    raster = rasterize(shapes, out_shape=shape, transform=transform, fill=0, all_touched=False, dtype="uint32")
    os.makedirs(args.out, exist_ok=True)
    artifact = os.path.join(args.out, "huc12-0.1deg.u32.gz")
    with gzip.GzipFile(artifact, "wb", mtime=0) as handle:
        handle.write(raster.astype("<u4").tobytes())
    held = int((raster > 0).sum())
    manifest = {
        "id": "foundation:huc12-0.1deg",
        "version": "1.0.0",
        "description": "The 12-digit hydrologic unit each 0.1 degree cell's centre lies in, from the USGS Watershed Boundary Dataset. Used only to read USGS GAP range tables (which list sub-watersheds) onto the land-cover grid; never drawn and never a hunting boundary.",
        "grid": {**grid, "layout": "row, column; little-endian uint32, 0 = none, else 1 + index into hucs"},
        "hucs": hucs,
        "cellsHeld": held,
        "source": {**SOURCE, "layer": layer_name, "sha256": sha(archive), "retrievedAt": retrieved},
        "artifact": {"file": os.path.basename(artifact), "sha256": sha(artifact), "bytes": os.path.getsize(artifact)},
    }
    with open(os.path.join(args.out, "huc12-0.1deg.json"), "w") as handle:
        json.dump(manifest, handle, ensure_ascii=False)
        handle.write("\n")
    print(f"{held} cells hold a HUC12 centre; {len(set(raster[raster > 0].tolist()))} of {len(hucs)} HUC12s hold at least one")


if __name__ == "__main__":
    main()
