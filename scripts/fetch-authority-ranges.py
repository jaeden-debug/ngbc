#!/usr/bin/env python3
"""Authoritative range maps, read and placed on the land-cover grid.

    python3 scripts/fetch-authority-ranges.py --targets .research/authority-targets.json --out .research/authority-ranges

WHY. A range drawn from occurrence records stops where people stop recording,
and 23 species' maps said so. CLAUDE.md 41B: a defensible range comes "from
authoritative distribution maps where licensed, otherwise from legally reusable
occurrence records". Two authorities publish range maps North Ground may use:

  - USGS Gap Analysis Project, Species Range Maps CONUS_2001 (doi
    10.5066/F7Q81B3R): the conterminous United States, by 12-digit hydrologic
    unit, each attributed with origin, occurrence, reproductive use and season.
    A work of the United States Government, in the public domain.
  - Environment and Climate Change Canada, Range Map extents — Species at Risk
    — Canada: range extents for species and populations assessed under SARA.
    Open Government Licence — Canada.

WHAT IT WRITES, per species matched by scientific name: the 0.1 degree cells
(land-cover grid, row 0 at the north edge) whose centre lies in the authority's
range, as [start, length] runs of row-major cell indices, with every attribute
value it saw and the exact file it read (url and sha256). Nothing is decided here about what a range means for a surface; the
range builder decides, and says so.

WHAT IT NEVER DOES. It never reads past an access control and never substitutes
an unofficial copy for a refused official one (CLAUDE.md 44). A refusal is
written down as a refusal.
"""

import argparse
import csv
import datetime
import hashlib
import io
import json
import os
import re
import shutil
import tempfile
import time
import urllib.parse
import urllib.request
import zipfile

import fiona
import numpy as np
from fiona.transform import transform_geom
from rasterio.features import rasterize
from rasterio.transform import from_origin

USER_AGENT = "NorthGroundBushcraft/1.0 (+https://www.northgroundbushcraft.com)"
GAP_ITEM = "5951527de4b062508e3b1e79"
GAP_INDEX = "https://www.sciencebase.gov/catalog/file/get/5951527de4b062508e3b1e79?f=__disk__57%2F11%2Fa6%2F5711a65eaeaf590712f9a74ee053d5ee5b0bddf2"
SAR_DIRECTORY = "https://data-donnees.ec.gc.ca/data/species/protectrestore/range-map-extents-species-at-risk-canada/"


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def get(url, binary=True):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=600) as response:
        data = response.read()
    return data if binary else data.decode("utf-8", "replace")


def sha(data):
    return "sha256:" + hashlib.sha256(data).hexdigest()


def norm(name):
    return re.sub(r"\s+", " ", (name or "").strip().lower())


def common(name):
    """A common name compared without case, apostrophes, hyphens or a trailing "(subspecies)"."""
    name = re.sub(r"\(.*?\)", "", (name or "").lower())
    return re.sub(r"[^a-z]+", " ", name.replace("'", "").replace("\u2019", "")).strip()


def runs(indices):
    """Cell indices as [start, length] runs along rows: ranges are contiguous, so this is small."""
    out = []
    for index in indices:
        if out and out[-1][0] + out[-1][1] == index:
            out[-1][1] += 1
        else:
            out.append([index, 1])
    return out


def shifted(geometry, by):
    def move(coords):
        if isinstance(coords[0], (int, float)):
            return [coords[0] + by, *coords[1:]]
        return [move(part) for part in coords]
    return {"type": geometry["type"], "coordinates": move(geometry["coordinates"])}


class Grid:
    def __init__(self, foundation):
        grid = json.load(open(os.path.join(foundation, "landcover-2019-0.1deg.json")))["grid"]
        self.grid = grid
        self.transform = from_origin(grid["west"], grid["north"], grid["cell"], grid["cell"])
        self.shape = (grid["rows"], grid["columns"])

    def cells(self, geometries):
        """Indices (row * columns + column) of the cells whose centre lies in any geometry."""
        if not geometries:
            return []
        shapes = []
        for geometry in geometries:
            shapes.append((geometry, 1))
            shapes.append((shifted(geometry, -360), 1))
        raster = rasterize(shapes, out_shape=self.shape, transform=self.transform, fill=0, all_touched=False, dtype="uint8")
        return runs(np.flatnonzero(raster).tolist())


def shapefiles_in(folder):
    found = []
    for root, _, files in os.walk(folder):
        for name in files:
            if name.lower().endswith(".shp"):
                found.append(os.path.join(root, name))
        for name in os.listdir(root):
            if name.lower().endswith(".gdb") and os.path.isdir(os.path.join(root, name)):
                found.append(os.path.join(root, name))
    return found


def read_layers(path):
    """Every (layer name, crs, schema properties, features) a file holds."""
    layers = fiona.listlayers(path) if path.lower().endswith(".gdb") else [None]
    for layer in layers:
        with fiona.open(path, layer=layer) as source:
            yield layer, source.crs_wkt, dict(source.schema["properties"]), [dict(feature) for feature in source]


def gap(targets, grid, out, log):
    """USGS GAP CONUS_2001: one item per species, matched on scientific name."""
    index = list(csv.DictReader(io.StringIO(get(GAP_INDEX, binary=False))))
    log.append(f"GAP index: {len(index)} species")
    # The species-level map ("x" suffix), never a subspecies' map for the species.
    index = [row for row in index if row["strUC"].endswith("x")]
    by_name, by_common = {}, {}
    for row in index:
        by_name.setdefault(norm(row["scientific_name"]), []).append(row)
        by_common.setdefault(common(row["common_name"]), []).append(row)
    os.makedirs(os.path.join(out, "gap"), exist_ok=True)
    unmatched = []
    for target in targets:
        rows = by_name.get(norm(target["scientificName"]), [])
        matched_by = "scientific name"
        if len(rows) != 1:
            # GAP's names are its 2001 taxonomy (Anas americana, not Mareca
            # americana), so the common name is tried, then the profile's own
            # aliases — never a qualified alias ("Elk (European usage)" is not
            # GAP's elk) — and only a single unambiguous species-level map is taken.
            rows = by_common.get(common(target.get("commonName")), [])
            matched_by = "common name"
            if len(rows) != 1:
                names = [a for a in (target.get("aliases") or []) if "(" not in a]
                rows = list({row["strUC"]: row for name in names for row in by_common.get(common(name), [])}.values())
                matched_by = "alias"
        if len(rows) != 1:
            unmatched.append({"speciesId": target["speciesId"], "scientificName": target["scientificName"], "candidates": [r["strUC"] for r in rows]})
            continue
        row = rows[0]
        record = {"speciesId": target["speciesId"], "authority": "USGS Gap Analysis Project", "dataset": "Species Range Maps CONUS_2001",
                  "matchedBy": matched_by, "code": row["strUC"], "commonName": row["common_name"], "scientificName": row["scientific_name"],
                  "doi": row["doi"], "itemUrl": row["url"], "licence": "Public domain (work of the United States Government)", "retrievedAt": now()}
        try:
            item = json.loads(get(f"https://www.sciencebase.gov/catalog/item/{row['item_#']}?format=json", binary=False))
            record["published"] = next((d["dateString"] for d in item.get("dates", []) if d.get("type") == "Publication"), None)
            record["citation"] = item.get("citation")
            archive = next(f for f in item.get("files", []) if f["name"].lower().endswith(".zip"))
            data = get(archive["url"])
            record.update({"file": archive["name"], "fileUrl": archive["url"], "sha256": sha(data), "bytes": len(data)})
            folder = tempfile.mkdtemp(prefix=row["strUC"])
            zipfile.ZipFile(io.BytesIO(data)).extractall(folder)
            record["contents"] = sorted(os.path.relpath(os.path.join(r, n), folder) for r, _, ns in os.walk(folder) for n in ns)
            for table in [n for n in record["contents"] if n.lower().endswith((".csv", ".txt"))][:3]:
                with open(os.path.join(folder, table), encoding="utf-8", errors="replace") as handle:
                    record.setdefault("tables", {})[table] = [next(handle, "") for _ in range(4)]
                # The HUC12 table is the range at its own resolution: origin,
                # presence, reproduction and season per sub-watershed. Counted
                # here so it is known whether the dissolved shapefile can hold
                # anything but known, extant ground.
                with open(os.path.join(folder, table), encoding="utf-8", errors="replace") as handle:
                    combos = {}
                    for row_ in csv.DictReader(handle):
                        key = "|".join(row_.get(k, "") for k in ("Origin", "Presence", "Reproduction", "Season"))
                        combos[key] = combos.get(key, 0) + 1
                    record.setdefault("hucCombos", {})[table] = combos
            geometries = {}
            attributes = {}
            for path in shapefiles_in(folder):
                for layer, crs, schema, features in read_layers(path):
                    record.setdefault("schema", schema)
                    for feature in features:
                        props = feature["properties"]
                        for key, value in props.items():
                            if isinstance(value, (int, str)) and len(attributes.setdefault(key, set())) < 40:
                                attributes[key].add(value)
                        signature = json.dumps({k: v for k, v in props.items() if k.lower() not in ("shape_area", "shape_leng", "shape_length", "objectid", "fid")}, sort_keys=True, default=str)
                        geometries.setdefault(signature, []).append(transform_geom(crs, "EPSG:4326", feature["geometry"]))
            record["attributes"] = {k: sorted(v, key=str) for k, v in attributes.items()}
            # Cells per distinct attribute combination, so the builder chooses
            # which origins, occurrences and seasons count — never this script.
            record["parts"] = [{"attributes": json.loads(signature), "cells": grid.cells(geoms)} for signature, geoms in geometries.items()]
            if not geometries:
                record["note"] = "The archive holds no shapefile or geodatabase; its contents are listed."
            shutil.rmtree(folder, ignore_errors=True)
            log.append(f"GAP {row['strUC']} {row['scientific_name']} ({matched_by}): {len(record['parts'])} parts, {sum(n for p in record['parts'] for _, n in p['cells'])} cells")
        except Exception as error:  # noqa: BLE001 — written down, never swallowed
            record["error"] = str(error)
            log.append(f"GAP {row['strUC']} FAILED: {error}")
        time.sleep(0.5)
        with open(os.path.join(out, "gap", target["speciesId"].split(":", 1)[1] + ".json"), "w") as handle:
            json.dump(record, handle, ensure_ascii=False)
    with open(os.path.join(out, "gap", "_unmatched.json"), "w") as handle:
        json.dump(unmatched, handle, ensure_ascii=False, indent=1)
    log.append(f"GAP unmatched: {len(unmatched)}")


def sar(targets, grid, out, log):
    """ECCC range extents for Species at Risk, from the department's data portal."""
    os.makedirs(os.path.join(out, "sar"), exist_ok=True)
    summary = {"directory": SAR_DIRECTORY, "retrievedAt": now(), "licence": "Open Government Licence - Canada"}
    try:
        # The portal is a plain directory listing; its folders are followed two
        # levels down, never outside the dataset's own directory.
        links, folders, seen = [], [SAR_DIRECTORY], set()
        for depth in range(3):
            following = []
            for folder_url in folders:
                if folder_url in seen:
                    continue
                seen.add(folder_url)
                listing = get(folder_url, binary=False)
                if folder_url == SAR_DIRECTORY:
                    with open(os.path.join(out, "sar", "_listing.html"), "w") as handle:
                        handle.write(listing[:200000])
                for href in re.findall(r"""href=["']([^"'?#]+)["']""", listing, re.I):
                    url = urllib.parse.urljoin(folder_url, href)
                    if not url.startswith(SAR_DIRECTORY) or url == folder_url:
                        continue
                    if url.endswith("/"):
                        following.append(url)
                    elif re.search(r"\.(zip|json|geojson|csv|xml|pdf|txt)$", url, re.I):
                        links.append(url)
            folders = following
        links = sorted(set(links))
        summary["links"] = links
        archives = [link for link in links if link.lower().endswith(".zip")]
        summary["archives"] = archives
        log.append(f"SAR directory: {len(links)} links, {len(archives)} archives")
        matched = {}
        names = {norm(t["scientificName"]): t for t in targets}
        # The register names a population beside the species ("Caribou (Boreal
        # population)"); a common name is compared without the bracket, and the
        # population stays in the part's attributes for the builder to read.
        commons = {}
        for t in targets:
            for name in [t.get("commonName")] + list(t.get("aliases") or []):
                if common(name):
                    commons.setdefault(common(name), t)
        for link in archives:
            url = link
            data = get(url)
            folder = tempfile.mkdtemp(prefix="sar")
            zipfile.ZipFile(io.BytesIO(data)).extractall(folder)
            summary.setdefault("files", []).append({"url": url, "sha256": sha(data), "bytes": len(data)})
            for path in shapefiles_in(folder):
                for layer, crs, schema, features in read_layers(path):
                    summary.setdefault("schemas", []).append({"file": os.path.relpath(path, folder), "layer": layer, "schema": schema, "features": len(features),
                                                             "first": {k: v for k, v in (features[0]["properties"].items() if features else []) if isinstance(v, (str, int, float))}})
                    for feature in features:
                        props = feature["properties"]
                        hit = None
                        for value in props.values():
                            if isinstance(value, str) and norm(value) in names:
                                hit = names[norm(value)]
                                break
                        if not hit:
                            for value in props.values():
                                if isinstance(value, str) and common(value) in commons:
                                    hit = commons[common(value)]
                                    break
                        if not hit:
                            continue
                        entry = matched.setdefault(hit["speciesId"], {"speciesId": hit["speciesId"], "scientificName": hit["scientificName"],
                                                                       "authority": "Environment and Climate Change Canada", "dataset": "Range Map extents - Species at Risk - Canada",
                                                                       "licence": "Open Government Licence - Canada", "source": url, "retrievedAt": now(), "parts": []})
                        entry["parts"].append({"attributes": {k: v for k, v in props.items() if isinstance(v, (str, int, float))},
                                               "cells": grid.cells([transform_geom(crs, "EPSG:4326", feature["geometry"])])})
            shutil.rmtree(folder, ignore_errors=True)
        for species_id, entry in matched.items():
            with open(os.path.join(out, "sar", species_id.split(":", 1)[1] + ".json"), "w") as handle:
                json.dump(entry, handle, ensure_ascii=False)
            log.append(f"SAR {entry['scientificName']}: {len(entry['parts'])} parts, {sum(n for p in entry['parts'] for _, n in p['cells'])} cells")
    except Exception as error:  # noqa: BLE001 — a refused official route is recorded as refused
        summary["error"] = str(error)
        log.append(f"SAR FAILED: {error}")
    with open(os.path.join(out, "sar", "_summary.json"), "w") as handle:
        json.dump(summary, handle, ensure_ascii=False, indent=1, default=str)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--targets", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--foundation", default="content/intelligence/foundation")
    args = parser.parse_args()
    targets = json.load(open(args.targets))
    grid = Grid(args.foundation)
    os.makedirs(args.out, exist_ok=True)
    log = [f"{len(targets)} target species"]
    gap(targets, grid, args.out, log)
    sar(targets, grid, args.out, log)
    with open(os.path.join(args.out, "_log.txt"), "w") as handle:
        handle.write("\n".join(log) + "\n")
    print("\n".join(log))


if __name__ == "__main__":
    main()
