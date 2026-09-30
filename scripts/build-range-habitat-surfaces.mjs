#!/usr/bin/env node
/**
 * Range-and-habitat species surfaces: the universal fallback tier (CLAUDE.md
 * §41B, "Every Hunt-eligible species has a map"). Certified into
 * `content/intelligence/range-habitat-registry.json`.
 *
 *   node scripts/build-range-habitat-surfaces.mjs --import-records   # copy the runner's reads into committed inputs
 *   node scripts/build-range-habitat-surfaces.mjs                    # build every profile's surface
 *   node scripts/build-range-habitat-surfaces.mjs --check            # exit 1 if a committed surface is not what this builds
 *
 * WHAT A SURFACE IS. For one species: the RANGE North Ground can support (from
 * openly licensed occurrence records, under the rules below), and inside it
 * how well each 0.1° cell's land suits the species under that species' own
 * declarative profile (`content/intelligence/surface-profiles.json`). The
 * profile is categorical — CORE, HIGH, MODERATE, LOW, UNSUITABLE — and quotes
 * the habitat statement North Ground already publishes for the species, which
 * this builder checks verbatim against the published profile. No weight is
 * fitted and none is invented; the class values are a declared convention.
 *
 * THE RANGE RULES, DECLARED BEFORE ANY SPECIES WAS BUILT:
 *   - a CELL of GBIF's own aggregation is CONFIRMED with at least
 *     MIN_RECORDS_PER_SQUARE openly licensed records since 2000. A read says
 *     how large its cells are (`aggregationDegrees`, 0.3515625° since the
 *     second pass); the first reads did not, and were 1.40625° cells drawn as
 *     0.35° squares — see LEGACY_AGGREGATION_DEGREES. Each record square is
 *     used at the size of the cell it stands for, never the size it was drawn;
 *   - a confirmed square COUNTS only if another confirmed square lies within
 *     CLUSTER_KM, so one misplaced or vagrant cluster of records cannot draw an
 *     island of range on its own — UNLESS its family declares an island rule
 *     (`isolatedSquareMinRecords`) and the square alone holds that many
 *     records: a sedentary population on an island or a lone mountain is real
 *     range, and 2.0.0 stopped erasing it. Families whose animals wander as
 *     vagrants (migratory birds) declare no island rule;
 *   - the range is the ground within the family's declared reach of a counted
 *     square;
 *   - (2.1.0) gaps inside it no wider than the family's declared `gapKm` are
 *     joined: records are made where people look, so the ground between two
 *     recorded places is usually unrecorded, not empty. A closing, so it never
 *     reaches past the recorded edge (scripts/lib/range-closing.mjs);
 *   - a species needs MIN_SPECIES_RECORDS records and MIN_COUNTED_SQUARES
 *     counted squares — or, for a concentrated population (an island, one
 *     mountain range), MIN_CONCENTRATED_SQUARES squares holding
 *     MIN_CONCENTRATED_RECORDS records — or its range is not defensible and it
 *     is declined with its counts.
 *
 * THE HABITAT RULES:
 *   - a cell's land-cover score is the share-weighted class value of its cover
 *     groups (groups the profile does not name are UNSUITABLE);
 *   - sea counts for a species only within the profile's `coastKm` of land;
 *     for a species with no sea class, a cell is judged on its land and a
 *     mostly-sea cell is not drawn;
 *   - an EDGE — forest and open land each at least EDGE_SHARE of the cell —
 *     takes the profile's edge class where the published statement names edges;
 *   - a REQUIRED relationship (water, wetland, rugged terrain) is a limiting
 *     factor: the cell takes the lower of its land-cover score and that
 *     relationship's class (the minimum rule of habitat-suitability-index
 *     models);
 *   - a cell is drawn at PAINT_FLOOR or above; below that it is UNSUITABLE —
 *     its own state inside the range, never absent (outside the range) and
 *     never 0 (a measured zero);
 *   - MASKS (2.0.0): a terrestrial profile never paints open water, sea, ice
 *     or town. A cell half or more of which is a cover the profile does not
 *     name as habitat among WATER, SEA, SNOW_ICE and BUILT is UNSUITABLE
 *     whatever the land around it scores, so no deer is drawn over a lake;
 *   - values are NODE-REGISTERED: a cell's value sits at its centre, which is
 *     the grid node the renderer samples (2.0.0 fixed a half-cell offset).
 *
 * WHAT RECORDS MAY AND MAY NOT DO. Occurrence records decide only whether
 * ground is inside the range. They never set or weight a cell's value, so
 * where more people report wildlife — near towns, roads and trails — never
 * becomes where there are more animals. Sampling bias can still move the range
 * EDGE, and each family states how (`recordBias`).
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync, gunzipSync } from "node:zlib";
import { closeRange } from "./lib/range-closing.mjs";

const args = process.argv.slice(2);
const CHECK = args.includes("--check");
const IMPORT = args.includes("--import-records");
const ONLY = args.find((a) => a.startsWith("--species="))?.split("=")[1]?.split(",");

const PROFILES = "content/intelligence/surface-profiles.json";
const FOUNDATION = "content/intelligence/foundation";
const OUT = "content/intelligence/range-habitat";
const INPUTS = join(OUT, "inputs");
const REGISTRY = "content/intelligence/range-habitat-registry.json";
const METHODOLOGY = {
  id: "methodology:north-ground-range-habitat",
  version: "2.1.0",
  effectiveFrom: "2026-09-30",
  history: [
    { version: "1.0.0", detail: "First publication: range from clustered record squares, categorical habitat inside it." },
    { version: "2.0.0", detail: "Ground inside the range rated unsuitable kept as its own state; water, sea, ice and town masked for profiles that do not name them; values placed on the grid nodes the renderer samples (1.0.0 sat half a cell south-west); an island rule for sedentary families; elevation and coast requirements; confidence from components rather than record counts alone. The concentrated-population rule (2 counted squares holding 300 records) was set AFTER the first 2.0.0 build declined kalij pheasant on 15,421 records in three squares of Hawaii Island: the five-square minimum was meant to refuse a handful of scattered reports, and refused a real island population instead. Recorded as set after seeing the result." },
    { version: "2.1.0", detail: "Open water a profile names is drawn only within the profile's openWaterKm (else coastKm, else 5 km) of dry land, as the sea already was: under 2.0.0 mallard was painted across the middle of Lake Winnipeg. 'Water or wetland nearby' is a distance-weighted share falling to nothing at 20 km, replacing an unweighted 3 × 3 box that drew a hard-edged 0.3° square around every small lake (wild boar). Both set after seeing those surfaces. Gaps in the range no wider than the family's declared gapKm are joined by a morphological closing (grow by half the gap, shrink back), which can fill a hole between recorded places but never extend the range past its recorded edge or outside its convex hull; habitat and the masks still decide every joined cell. Set AFTER seeing the 2.0.0 alligator surface: 9,702 openly licensed records in 72 squares drew separate discs with central Florida blank — the records' sampling painted as absence. Recorded as set after seeing the result. And a correction, not a choice: each record square is now used at the size of the GBIF cell it stands for. The first reads' 0.35° squares were 1.40625° cells (GBIF aggregates 16 × 16 cells per map tile), so 2.0.0 drew ranges from a sixteenth of the ground the records covered, in bands with gaps between them." },
  ],
};

export const MIN_RECORDS_PER_SQUARE = 2;
export const CLUSTER_KM = 150;
export const MIN_SPECIES_RECORDS = 30;
export const MIN_COUNTED_SQUARES = 5;
/* A CONCENTRATED population — an island, one mountain range, one refuge — is
   a real range in fewer squares: at least this many counted squares holding
   at least MIN_CONCENTRATED_RECORDS records. */
export const MIN_CONCENTRATED_SQUARES = 2;
export const MIN_CONCENTRATED_RECORDS = 300;
export const EDGE_SHARE = 0.2;
export const PAINT_FLOOR = 0.2;
export const RANGE_ONLY_VALUE = 0.5;
/* The byte an unsuitable in-range cell is stored as (surface.ts UNSUITABLE_BYTE). */
const UNSUITABLE_BYTE = 255;
/* A mask applies when a cover the profile does not name makes up this share of the cell. */
export const MASK_SHARE = 0.5;
/*
 * THE CONFIDENCE RULE for this tier, from its components (§41B: confidence
 * from evidence, not tier alone). A range-and-habitat surface is never HIGH:
 * it measures no animals. MODERATE needs every component to hold; any one
 * failing leaves it LIMITED, and the reason names which.
 */
const CONFIDENCE = {
  /* Range evidence: enough records in enough squares that the range is not a handful of reports. */
  moderateRecords: 300,
  moderateSquares: 30,
  /* Habitat concordance: the record squares sit on land the profile rates at least moderate
     no less often than the range as a whole does. Below this the profile and the records disagree. */
  minimumConcordance: 1,
};
/* The square GBIF draws for a cell, and the cell the first reads (made before
   `aggregationDegrees` was recorded) really stand for. GBIF's ad-hoc map
   aggregates 16 × 16 cells per tile whatever square size is asked for; those
   reads were zoom-3 tiles, so 1.40625° cells, each drawn as one 0.35° square
   beside the cell's centre. Established from the reads: across every species,
   no 1.40625° cell ever held two squares (house sparrow: 14.8 million records,
   763 squares). */
const DRAWN_SQUARE_DEGREES = 0.3515625;
export const LEGACY_AGGREGATION_DEGREES = 1.40625;

/* A read's cells at the size they really are: [west, south, records], and that size. */
function cellsOfRead(records) {
  if (records.aggregationDegrees) return { step: records.aggregationDegrees, squares: records.squares };
  const step = LEGACY_AGGREGATION_DEGREES;
  const cells = new Map();
  for (const [west, south, n] of records.squares) {
    const col = Math.floor((west + DRAWN_SQUARE_DEGREES / 2 + 180) / step);
    const row = Math.floor((90 - (south + DRAWN_SQUARE_DEGREES / 2)) / step);
    const key = `${col}:${row}`;
    /* A tile GBIF refused was read as its four zoom-4 children, whose cells are
       0.703125°; filed under the 1.40625° cell they lie in, their counts add. */
    const prior = cells.get(key);
    cells.set(key, [Number((-180 + col * step).toFixed(7)), Number((90 - (row + 1) * step).toFixed(7)), (prior?.[2] ?? 0) + n]);
  }
  return { step, squares: [...cells.values()] };
}

const sha = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const slugOf = (speciesId) => speciesId.replace("species:", "");

/* ---------------------------------------------------------------- import */

if (IMPORT) {
  const profiles = JSON.parse(readFileSync(PROFILES, "utf8")).species;
  mkdirSync(INPUTS, { recursive: true });
  const credits = {};
  let copied = 0;
  for (const [speciesId, profile] of Object.entries(profiles)) {
    const dir = profile.season === "HUNTING_SEASON_RECORDS" ? ".research/gbif-season" : ".research/gbif";
    const path = join(dir, `${slugOf(speciesId)}.json`);
    if (!existsSync(path)) continue;
    const read = JSON.parse(readFileSync(path, "utf8"));
    const titles = existsSync(join(dir, "_datasets.json")) ? JSON.parse(readFileSync(join(dir, "_datasets.json"), "utf8")) : {};
    for (const { datasetKey } of read.datasets ?? []) if (titles[datasetKey]) credits[datasetKey] = titles[datasetKey];
    /* Only what the builder uses, sorted, so a re-import of the same read is byte-identical. */
    const kept = {
      speciesId,
      scientificName: read.scientificName,
      usageKey: read.usageKey ?? null,
      /* Which records the key reads: the accepted taxon, or only those filed under the matched name. */
      matchedUsageKey: read.matchedUsageKey ?? read.usageKey ?? null,
      readAs: read.readAs ?? "AS_MATCHED",
      matchType: read.matchType ?? null,
      refused: read.refused ?? null,
      retrievedAt: read.retrievedAt ?? null,
      months: read.months ?? null,
      filter: read.filter ?? null,
      portalQuery: read.portalQuery ?? null,
      openRecordCount: read.openRecordCount ?? 0,
      /* How large the read's cells are, and the check that its fine pass placed every record its coarse pass found. Absent on the first reads (1.40625° cells). */
      ...(read.aggregationDegrees ? { aggregationDegrees: read.aggregationDegrees, aggregation: read.aggregation } : {}),
      unreadTiles: read.unreadTiles ?? [],
      datasets: [...(read.datasets ?? [])].sort((a, b) => b.count - a.count || a.datasetKey.localeCompare(b.datasetKey)),
      columns: ["west", "south", "records"],
      squares: [...(read.squares ?? [])].sort((a, b) => a[1] - b[1] || a[0] - b[0]),
    };
    writeFileSync(join(INPUTS, `${slugOf(speciesId)}.records.json`), `${JSON.stringify(kept)}\n`);
    copied += 1;
  }
  const creditPath = join(OUT, "datasets.json");
  const prior = existsSync(creditPath) ? JSON.parse(readFileSync(creditPath, "utf8")).datasets : {};
  const merged = Object.fromEntries(Object.entries({ ...prior, ...credits }).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(creditPath, `${JSON.stringify({ note: "Every GBIF dataset whose openly licensed records (CC0 1.0, CC BY 4.0) drew a range. CC BY publishers are credited here and in each surface's provenance.", datasets: merged }, null, 1)}\n`);
  process.stdout.write(`imported ${copied} species' records into ${INPUTS}\n`);
  process.exit(0);
}

/* ------------------------------------------------------------ foundations */

function foundation(name) {
  const manifestPath = join(FOUNDATION, `${name}.json`);
  if (!existsSync(manifestPath)) return null;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const raw = readFileSync(join(FOUNDATION, manifest.artifact.file));
  if (sha(raw) !== manifest.artifact.sha256) throw new Error(`${name} does not match its manifest hash`);
  return { manifest, bytes: gunzipSync(raw) };
}

const landcover = foundation("landcover-2019-0.1deg");
if (!landcover) throw new Error("land-cover foundation missing");
const terrain = foundation("terrain-etopo2022-0.1deg");
const G = landcover.manifest.grid;
const GROUPS = landcover.manifest.groups.map((g) => g.name);
const NG = GROUPS.length;
const GI = Object.fromEntries(GROUPS.map((name, i) => [name, i]));
const shares = landcover.bytes;
/* Copied to an aligned buffer: a gunzipped Buffer can start at an odd offset. */
const relief = terrain ? new Int16Array(Uint8Array.from(terrain.bytes).buffer) : null;
if (terrain && (terrain.manifest.grid.columns !== G.columns || terrain.manifest.grid.rows !== G.rows)) throw new Error("terrain and land cover are on different grids");

const share = (cell, group) => shares[cell * NG + GI[group]] / 100;
const reliefAt = (cell) => (relief ? relief[cell * 2 + 1] : null);
const meanAt = (cell) => (relief ? relief[cell * 2] : null);
const cellLat = (row) => G.north - (row + 0.5) * G.cell;
const cellLon = (col) => G.west + (col + 0.5) * G.cell;
const FOREST = ["NEEDLELEAF_CLOSED", "NEEDLELEAF_OPEN", "BROADLEAF_CLOSED", "BROADLEAF_OPEN", "MIXED_CLOSED", "MIXED_OPEN", "FOREST_UNKNOWN"];
const OPEN = ["CROPLAND", "HERBACEOUS"];
/* Land share per cell, computed once: every group but sea and no-data. */
const LAND = new Float32Array(G.rows * G.columns);
for (let cell = 0; cell < LAND.length; cell += 1) {
  let sum = 0;
  for (let g = 0; g < NG; g += 1) if (GROUPS[g] !== "SEA" && GROUPS[g] !== "NO_DATA") sum += shares[cell * NG + g];
  LAND[cell] = sum / 100;
}
const landOf = (cell) => LAND[cell];

/* ---------------------------------------------------------------- profiles */

const profileFile = JSON.parse(readFileSync(PROFILES, "utf8"));
const CLASS = profileFile.classValues;
const ALIASES = profileFile.groupAliases;
const FAMILIES = profileFile.families;
const expand = (names) => names.flatMap((name) => ALIASES[name] ?? (GI[name] !== undefined ? [name] : (() => { throw new Error(`unknown land-cover group or alias ${name}`); })()));

function classTable(profile) {
  const table = {};
  for (const level of ["UNSUITABLE", "LOW", "MODERATE", "HIGH", "CORE"]) {
    for (const group of expand(profile.landCover?.[level] ?? [])) table[group] = CLASS[level];
  }
  return table;
}

/* How each surveyed bird moves between seasons, declared once (content/intelligence/seasonal-movement.json). */
const MOVEMENT = JSON.parse(readFileSync("content/intelligence/seasonal-movement.json", "utf8")).species;

/* The published statements the profiles quote, with their sources. */
const published = new Map();
const sources = new Map();
for (const file of readdirSync("content/published").filter((f) => f.endsWith(".json")).sort()) {
  const bundle = JSON.parse(readFileSync(join("content/published", file), "utf8"));
  for (const source of bundle.sources ?? []) sources.set(source.id, source);
  for (const resource of bundle.resources ?? []) {
    if (resource.speciesProfile) published.set(resource.speciesProfile.speciesId, { profile: resource.speciesProfile, name: resource.title });
  }
}

/* ------------------------------------------------------------------ range */

function kmBetween(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

function rangeOf(records, reachKm, isolatedMin, gapKm) {
  const { step, squares } = cellsOfRead(records);
  const confirmed = squares.filter(([, , n]) => n >= MIN_RECORDS_PER_SQUARE).map(([west, south, n]) => ({ west, south, n, lat: south + step / 2, lon: west + step / 2 }));
  /* Clustered: another confirmed square within CLUSTER_KM. Bucketed by 2° so
     the search is local. */
  const buckets = new Map();
  const key = (lat, lon) => `${Math.floor(lat / 2)}:${Math.floor(lon / 2)}`;
  for (const square of confirmed) {
    const k = key(square.lat, square.lon);
    buckets.set(k, [...(buckets.get(k) ?? []), square]);
  }
  let islands = 0;
  const counted = confirmed.filter((square) => {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -3; dx <= 3; dx += 1) {
        for (const other of buckets.get(`${Math.floor(square.lat / 2) + dy}:${Math.floor(square.lon / 2) + dx}`) ?? []) {
          if (other !== square && kmBetween(square.lat, square.lon, other.lat, other.lon) <= CLUSTER_KM) return true;
        }
      }
    }
    /* The island rule: an isolated square stands on its own records, where the family declares one. */
    if (isolatedMin && square.n >= isolatedMin) {
      islands += 1;
      return true;
    }
    return false;
  });
  const inRange = new Uint8Array(G.rows * G.columns);
  for (const square of counted) {
    const dLat = reachKm / 111 + step;
    const dLon = reachKm / (111 * Math.max(0.15, Math.cos((square.lat * Math.PI) / 180))) + step;
    const rowTop = Math.max(0, Math.floor((G.north - (square.south + step + dLat)) / G.cell));
    const rowBottom = Math.min(G.rows - 1, Math.floor((G.north - (square.south - dLat)) / G.cell));
    const colLeft = Math.max(0, Math.floor((square.west - dLon - G.west) / G.cell));
    const colRight = Math.min(G.columns - 1, Math.floor((square.west + step + dLon - G.west) / G.cell));
    for (let row = rowTop; row <= rowBottom; row += 1) {
      const lat = cellLat(row);
      for (let col = colLeft; col <= colRight; col += 1) {
        const lon = cellLon(col);
        /* Distance from the cell centre to the square itself, not its centre. */
        const nearLat = Math.min(Math.max(lat, square.south), square.south + step);
        const nearLon = Math.min(Math.max(lon, square.west), square.west + step);
        if (kmBetween(lat, lon, nearLat, nearLon) <= reachKm) inRange[row * G.columns + col] = 1;
      }
    }
  }
  /* 2.1.0: gaps between recorded ground no wider than the family's gapKm are
     joined (scripts/lib/range-closing.mjs) — never past the recorded edge. */
  const closed = closeRange(G, inRange, gapKm);
  return { step, confirmed: confirmed.length, counted: counted.length, islands, inRange: closed.inRange, joinedCells: closed.added, countedSquares: counted };
}

/* ---------------------------------------------------------------- habitat */

function nearLand(row, col, coastKm) {
  const lat = cellLat(row);
  const dr = Math.ceil(coastKm / 11.1);
  const dc = Math.ceil(coastKm / (11.1 * Math.max(0.15, Math.cos((lat * Math.PI) / 180))));
  for (let r = Math.max(0, row - dr); r <= Math.min(G.rows - 1, row + dr); r += 1) {
    for (let c = Math.max(0, col - dc); c <= Math.min(G.columns - 1, col + dc); c += 1) {
      const cell = r * G.columns + c;
      if (landOf(cell) >= 0.2 && kmBetween(lat, cellLon(col), cellLat(r), cellLon(c)) <= coastKm + 5.5) return true;
    }
  }
  return false;
}

/* The share of some covers NEAR a cell, weighted by distance: full at the
   cell, falling linearly to nothing at NEAR_KM (2.1.0; 2.0.0 took an
   unweighted 3 × 3 box, and every small lake drew a 0.3° square of "near
   water" with a hard edge). */
export const NEAR_KM = 20;
function neighbourhoodShare(row, col, groups) {
  const lat = cellLat(row);
  const kmPerRow = G.cell * 111.2;
  const kmPerCol = kmPerRow * Math.max(0.15, Math.cos((lat * Math.PI) / 180));
  const dr = Math.floor(NEAR_KM / kmPerRow);
  const dc = Math.floor(NEAR_KM / kmPerCol);
  let sum = 0;
  let weights = 0;
  for (let r = Math.max(0, row - dr); r <= Math.min(G.rows - 1, row + dr); r += 1) {
    for (let c = Math.max(0, col - dc); c <= Math.min(G.columns - 1, col + dc); c += 1) {
      const d = Math.hypot((r - row) * kmPerRow, (c - col) * kmPerCol);
      const w = 1 - d / NEAR_KM;
      if (w <= 0) continue;
      const cell = r * G.columns + c;
      sum += w * groups.reduce((total, g) => total + share(cell, g), 0);
      weights += w;
    }
  }
  return weights ? sum / weights : 0;
}

/* Dry land within km of a cell: land cover other than open water, sea and no data. */
function dryLandWithin(row, col, km) {
  const lat = cellLat(row);
  const dr = Math.ceil(km / 11.1);
  const dc = Math.ceil(km / (11.1 * Math.max(0.15, Math.cos((lat * Math.PI) / 180))));
  for (let r = Math.max(0, row - dr); r <= Math.min(G.rows - 1, row + dr); r += 1) {
    for (let c = Math.max(0, col - dc); c <= Math.min(G.columns - 1, col + dc); c += 1) {
      const cell = r * G.columns + c;
      if (landOf(cell) - share(cell, "WATER") >= 0.2 && kmBetween(lat, cellLon(col), cellLat(r), cellLon(c)) <= km + 5.5) return true;
    }
  }
  return false;
}

/* OPEN WATER (2.1.0): a profile that names open water is drawn on it only
   along its shore — within the profile's openWaterKm, else its coastKm, else
   this — as the sea already was. Mallard, whose profile names lakes, was
   painted across the middle of Lake Winnipeg under 2.0.0. */
export const OPEN_WATER_SHORE_KM = 5;

function classFromThresholds(value, thresholds) {
  for (const level of ["CORE", "HIGH", "MODERATE", "LOW"]) if (thresholds[level] !== undefined && value >= thresholds[level]) return level;
  return "UNSUITABLE";
}

/*
 * The covers a profile must NAME to be painted on: open water, sea, ice and
 * town. A cell that is mostly one of them, for a profile that does not name
 * it, is UNSUITABLE however well the rest of the cell scores.
 */
const MASKED_COVERS = ["WATER", "SEA", "SNOW_ICE", "BUILT"];

function maskOf(cell, table) {
  for (const cover of MASKED_COVERS) {
    if (table[cover] !== undefined && table[cover] > 0) continue;
    if (share(cell, cover) >= MASK_SHARE) return cover;
  }
  /* Water and sea together, for a profile that names neither. */
  if (!(table.WATER > 0) && !(table.SEA > 0) && share(cell, "WATER") + share(cell, "SEA") >= MASK_SHARE) return "WATER";
  return null;
}

/* Returns null for a cell with no land-cover data (no data, not unsuitable),
   { mask } for a masked cell, or { score }. */
function scoreCell(row, col, profile, table) {
  const cell = row * G.columns + col;
  const hasSea = table.SEA !== undefined;
  const sea = share(cell, "SEA");
  const noData = share(cell, "NO_DATA");
  const total = 1 - noData;
  if (total <= 0.01) return null;
  const mask = maskOf(cell, table);
  if (mask) return { mask };
  if (share(cell, "WATER") >= MASK_SHARE && !dryLandWithin(row, col, profile.openWaterKm ?? profile.coastKm ?? OPEN_WATER_SHORE_KM)) return { mask: "WATER" };
  const land = landOf(cell);
  if (!hasSea && land < 0.5) return { mask: "SEA" };
  const seaCounts = hasSea && sea > 0 && nearLand(row, col, profile.coastKm ?? 10);
  const denominator = hasSea ? land + sea : land;
  if (denominator <= 0) return { mask: "SEA" };
  let score = 0;
  for (const group of GROUPS) {
    if (group === "NO_DATA") continue;
    if (group === "SEA") {
      if (seaCounts) score += sea * (table.SEA ?? 0);
      continue;
    }
    score += share(cell, group) * (table[group] ?? 0);
  }
  score /= denominator;
  if (profile.edge) {
    const forest = FOREST.reduce((s, g) => s + share(cell, g), 0) / land;
    const open = OPEN.reduce((s, g) => s + share(cell, g), 0) / land;
    if (forest >= EDGE_SHARE && open >= EDGE_SHARE) score = Math.max(score, CLASS[profile.edge.class]);
  }
  for (const requirement of profile.requires ?? []) {
    let value;
    if (requirement.feature === "WATER_OR_WETLAND") value = neighbourhoodShare(row, col, ["WATER", "HERBACEOUS_WETLAND", ...(profile.coastKm ? ["SEA"] : [])]);
    else if (requirement.feature === "WETLAND") value = neighbourhoodShare(row, col, ["HERBACEOUS_WETLAND"]);
    else if (requirement.feature === "RELIEF_METRES") value = reliefAt(cell);
    else if (requirement.feature === "ELEVATION_METRES") {
      /* Bands, strongest first: the cell takes the first band its mean elevation falls in. */
      const metres = meanAt(cell);
      if (metres === null) return null;
      const level = Object.entries(requirement.bands).find(([, [low, high]]) => metres >= low && metres <= high)?.[0] ?? requirement.otherwise ?? "UNSUITABLE";
      score = Math.min(score, CLASS[level]);
      continue;
    } else if (requirement.feature === "SEA_WITHIN_KM") {
      /* Distance to the coast: the first band whose reach holds sea. */
      const level = Object.entries(requirement.bands).find(([, km]) => seaWithin(row, col, km))?.[0] ?? requirement.otherwise ?? "UNSUITABLE";
      score = Math.min(score, CLASS[level]);
      continue;
    } else throw new Error(`unknown requirement ${requirement.feature}`);
    if (value === null) return null;
    score = Math.min(score, CLASS[classFromThresholds(value, requirement.thresholds)]);
  }
  return { score };
}

function seaWithin(row, col, km) {
  const lat = cellLat(row);
  const dr = Math.ceil(km / 11.1);
  const dc = Math.ceil(km / (11.1 * Math.max(0.15, Math.cos((lat * Math.PI) / 180))));
  for (let r = Math.max(0, row - dr); r <= Math.min(G.rows - 1, row + dr); r += 1) {
    for (let c = Math.max(0, col - dc); c <= Math.min(G.columns - 1, col + dc); c += 1) {
      if (share(r * G.columns + c, "SEA") >= 0.2 && kmBetween(lat, cellLon(col), cellLat(r), cellLon(c)) <= km + 5.5) return true;
    }
  }
  return false;
}

/* ------------------------------------------------------------------ build */

function encode(cells) {
  /* One byte per cell over the occupied box: 0 = outside the range (or no data),
     255 = inside the range and rated unsuitable, v = intensity / 4. */
  let r0 = Infinity;
  let r1 = -Infinity;
  let c0 = Infinity;
  let c1 = -Infinity;
  for (const [row, col] of cells) {
    r0 = Math.min(r0, row); r1 = Math.max(r1, row);
    c0 = Math.min(c0, col); c1 = Math.max(c1, col);
  }
  const rows = r1 - r0 + 1;
  const cols = c1 - c0 + 1;
  const bytes = new Uint8Array(rows * cols);
  for (const [row, col, intensity] of cells) bytes[(row - r0) * cols + (col - c0)] = intensity < 0 ? UNSUITABLE_BYTE : Math.max(1, Math.min(250, Math.round(intensity / 4)));
  return { encoding: "U8_DEFLATE_BASE64", scale: 4, r0, c0, rows, cols, data: deflateSync(bytes, { level: 9 }).toString("base64") };
}

/* ------------------------------------------------------ recording effort */

/*
 * RECORDING EFFORT (2.1.0): how many open records of the OTHER Hunt-eligible
 * species of the same animal group a place holds — the target-group measure
 * of whether anyone records that kind of animal there at all. It never enters
 * a range or a colour. It decides only what a surface says about its own edge:
 * where the range stops at ground nobody records, the edge is where recording
 * stops, and the surface says so rather than letting it read as absence.
 * Measured on 1.40625° cells, the coarsest aggregation any read has.
 */
export const EFFORT_CELL_DEGREES = 1.40625;
export const UNRECORDED_BELOW = 10;
/* A range whose land edge borders unrecorded ground at least this often says so. */
export const EDGE_FOLLOWS_RECORDING = 0.25;
const GROUP_NOUN = { MAMMAL: "mammal", BIRD: "bird", REPTILE: "reptile", AMPHIBIAN: "amphibian" };
const groupOf = (speciesId, profile) => profile.recordGroup ?? FAMILIES[profile.family]?.recordGroup;
const effortKey = (lon, lat) => `${Math.floor((lon + 180) / EFFORT_CELL_DEGREES)}:${Math.floor((90 - lat) / EFFORT_CELL_DEGREES)}`;
let effortCache = null;
function effort() {
  if (effortCache) return effortCache;
  const totals = new Map();
  const own = new Map();
  for (const [speciesId, profile] of Object.entries(profileFile.species)) {
    const group = groupOf(speciesId, profile);
    const path = join(INPUTS, `${slugOf(speciesId)}.records.json`);
    if (!group || !existsSync(path)) continue;
    const read = JSON.parse(readFileSync(path, "utf8"));
    if (!read.squares) continue;
    const drawn = read.aggregationDegrees ?? DRAWN_SQUARE_DEGREES;
    const mine = new Map();
    for (const [west, south, n] of read.squares) {
      const key = effortKey(west + drawn / 2, south + drawn / 2);
      mine.set(key, (mine.get(key) ?? 0) + n);
    }
    own.set(speciesId, mine);
    const total = totals.get(group) ?? new Map();
    for (const [key, n] of mine) total.set(key, (total.get(key) ?? 0) + n);
    totals.set(group, total);
  }
  effortCache = { totals, own };
  return effortCache;
}
/* Records of the species' group at a place, less its own. */
function othersRecorded(speciesId, group, lon, lat) {
  const { totals, own } = effort();
  const key = effortKey(lon, lat);
  return (totals.get(group)?.get(key) ?? 0) - (own.get(speciesId)?.get(key) ?? 0);
}
/* Of the range's land edge, the share that borders ground where the group is barely recorded. */
function edgeOnUnrecorded(speciesId, group, inRange) {
  if (!group) return null;
  let edge = 0;
  let unrecorded = 0;
  for (let row = 0; row < G.rows; row += 1) {
    for (let col = 0; col < G.columns; col += 1) {
      if (!inRange[row * G.columns + col]) continue;
      for (const [r, c] of [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]) {
        if (r < 0 || r >= G.rows || c < 0 || c >= G.columns) continue;
        const cell = r * G.columns + c;
        if (inRange[cell] || landOf(cell) - share(cell, "WATER") < 0.5) continue;
        edge += 1;
        if (othersRecorded(speciesId, group, cellLon(c), cellLat(r)) < UNRECORDED_BELOW) unrecorded += 1;
      }
    }
  }
  return edge ? Math.round((unrecorded / edge) * 1000) / 1000 : null;
}

function buildOne(speciesId, profile) {
  const slug = slugOf(speciesId);
  const pub = published.get(speciesId);
  if (!pub) throw new Error(`${speciesId} has a surface profile and no published species profile`);
  const tier = profile.tier ?? "RANGE_HABITAT";
  /* A range-only profile may stand without a habitat quote — that absence is
     exactly why it is range-only — but never without saying so. */
  const statement = profile.habitatStatement === null && tier === "RANGE_ONLY"
    ? null
    : (pub.profile.habitat ?? []).find((h) => h.text === profile.habitatStatement);
  if (statement === undefined) throw new Error(`${speciesId}: the profile's habitat statement is not, verbatim, in the published profile`);
  const family = FAMILIES[profile.family];
  if (!family) throw new Error(`${speciesId}: unknown family ${profile.family}`);
  if (tier === "RANGE_ONLY" && !profile.whyNotRangeHabitat) throw new Error(`${speciesId}: a range-only profile must say why range + habitat is not defensible`);
  /* Records that cannot be a range, for a reason declared in the profile —
     another species filed under the name, or no established population. */
  if (profile.rangeNotDefensible) return { declined: { speciesId, reason: "NO_DEFENSIBLE_RANGE", detail: profile.rangeNotDefensible } };
  const inputPath = join(INPUTS, `${slug}.records.json`);
  if (!existsSync(inputPath)) return { declined: { speciesId, reason: "NO_RANGE_EVIDENCE_READ", detail: "No occurrence read is committed for this species yet; the range cannot be drawn until one is." } };
  const records = JSON.parse(readFileSync(inputPath, "utf8"));
  if (records.refused) {
    const failed = String(records.refused).startsWith("read failed");
    return { declined: { speciesId, reason: failed ? "READ_FAILED" : "NO_TAXON_MATCH", detail: failed ? `The occurrence service did not answer for ${records.scientificName}: ${records.refused.replace(/^read failed: /, "")}` : `GBIF holds no exact name match for ${records.scientificName}; no range evidence could be read.` } };
  }
  if (records.aggregation && !records.aggregation.placesEveryRecord) return { declined: { speciesId, reason: "INCOMPLETE_READ", detail: `The fine read of ${records.scientificName} placed ${records.aggregation.coarseRecords} records' worth of cells differently from its coarse read; a range from it could miss recorded ground.` } };
  if (records.unreadTiles?.length) return { declined: { speciesId, reason: "INCOMPLETE_READ", detail: `The occurrence service refused ${records.unreadTiles.length} tiles for ${records.scientificName}; a range with a hole in it would draw unread ground as outside the range.` } };
  const range = rangeOf(records, family.reachKm, family.isolatedSquareMinRecords ?? null, family.gapKm ?? null);
  const countedRecords = range.countedSquares.reduce((sum, square) => sum + square.n, 0);
  const spread = range.counted >= MIN_COUNTED_SQUARES;
  const concentrated = range.counted >= MIN_CONCENTRATED_SQUARES && countedRecords >= MIN_CONCENTRATED_RECORDS;
  if (records.openRecordCount < MIN_SPECIES_RECORDS || !(spread || concentrated)) {
    return { declined: { speciesId, reason: "NO_DEFENSIBLE_RANGE", detail: `${records.openRecordCount} openly licensed records in Canada and the United States since 2000 (${records.months ? "hunting-season months only" : "all months"}), ${range.counted} counted squares with ${MIN_RECORDS_PER_SQUARE} or more holding ${countedRecords}; a range needs ${MIN_SPECIES_RECORDS} records and ${MIN_COUNTED_SQUARES} squares, or ${MIN_CONCENTRATED_SQUARES} squares holding ${MIN_CONCENTRATED_RECORDS} records for a concentrated population.` } };
  }
  const needsTerrain = (profile.requires ?? []).some((r) => r.feature === "RELIEF_METRES" || r.feature === "ELEVATION_METRES");
  if (needsTerrain && !relief) {
    return { declined: { speciesId, reason: "FOUNDATION_MISSING", detail: "Its profile requires terrain, and the terrain foundation is not built yet." } };
  }
  const table = classTable(profile);
  const cells = [];
  const masked = {};
  let unsuitable = 0;
  let noData = 0;
  const scoreAt = new Float32Array(G.rows * G.columns).fill(NaN);
  for (let row = 0; row < G.rows; row += 1) {
    for (let col = 0; col < G.columns; col += 1) {
      const cell = row * G.columns + col;
      if (!range.inRange[cell]) continue;
      let scored;
      if (tier === "RANGE_ONLY") {
        const mask = maskOf(cell, table);
        scored = share(cell, "NO_DATA") >= 0.99 ? null : mask || landOf(cell) < 0.5 ? { mask: mask ?? "SEA" } : { score: RANGE_ONLY_VALUE };
      } else {
        scored = scoreCell(row, col, profile, table);
      }
      /* South-up and node-registered, like every other surface artifact. */
      const southRow = G.rows - 1 - row;
      if (scored === null || scored === undefined) { noData += 1; continue; }
      if (scored.mask) masked[scored.mask] = (masked[scored.mask] ?? 0) + 1;
      if (scored.mask || scored.score < PAINT_FLOOR) {
        cells.push([southRow, col, -1]);
        unsuitable += 1;
        scoreAt[cell] = 0;
        continue;
      }
      scoreAt[cell] = scored.score;
      cells.push([southRow, col, Math.round(scored.score * 1000)]);
    }
  }
  const painted = cells.filter(([, , v]) => v > 0);
  if (!painted.length) return { declined: { speciesId, reason: "NOTHING_SUITABLE", detail: "No ground inside the supported range reaches the lowest habitat class of the profile." } };
  cells.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  /* ---- confidence, from its components ---- */
  const seasonal = profile.season === "HUNTING_SEASON_RECORDS";
  const movement = MOVEMENT[speciesId]?.movement ?? null;
  const movesBetweenSeasons = movement && !["RESIDENT", "SHORT_DISTANCE"].includes(movement);
  /* Concordance: how often record squares sit on land the profile rates moderate or better, against the range as a whole. */
  const suitableShare = (list) => {
    let good = 0;
    let seen = 0;
    for (const cellIndex of list) {
      const value = scoreAt[cellIndex];
      if (Number.isNaN(value)) continue;
      seen += 1;
      if (value >= CLASS.MODERATE) good += 1;
    }
    return seen ? good / seen : null;
  };
  const rangeCells = [];
  for (let i = 0; i < scoreAt.length; i += 1) if (!Number.isNaN(scoreAt[i])) rangeCells.push(i);
  const recordCells = [];
  for (const square of range.countedSquares) {
    /* The cells inside the square, unweighted by how many records it holds: a
       square is counted once, so a popular trailhead is one square like any other. */
    for (let lat = square.south + G.cell / 2; lat < square.south + range.step; lat += G.cell) {
      for (let lon = square.west + G.cell / 2; lon < square.west + range.step; lon += G.cell) {
        const row = Math.floor((G.north - lat) / G.cell);
        const col = Math.floor((lon - G.west) / G.cell);
        if (row >= 0 && row < G.rows && col >= 0 && col < G.columns) recordCells.push(row * G.columns + col);
      }
    }
  }
  const pRange = suitableShare(rangeCells);
  const pRecords = suitableShare(recordCells);
  const concordance = tier === "RANGE_ONLY" || !pRange || pRecords === null ? null : Math.round((pRecords / pRange) * 100) / 100;
  const components = [
    { component: "range evidence", holds: records.openRecordCount >= CONFIDENCE.moderateRecords && range.counted >= CONFIDENCE.moderateSquares, detail: `${records.openRecordCount} records in ${range.counted} squares (needs ${CONFIDENCE.moderateRecords} in ${CONFIDENCE.moderateSquares})` },
    { component: "habitat concordance", holds: concordance === null ? tier === "RANGE_ONLY" : concordance >= CONFIDENCE.minimumConcordance, detail: concordance === null ? "not applicable to a distribution" : `record squares on moderate-or-better land ${Math.round((pRecords ?? 0) * 100)} in 100 against ${Math.round(pRange * 100)} in 100 across the range (ratio ${concordance}; needs ${CONFIDENCE.minimumConcordance})` },
    { component: "seasonal applicability", holds: !movesBetweenSeasons || seasonal, detail: seasonal ? "hunting-season records for the hunting season" : movesBetweenSeasons ? "all-year records for a bird that moves between seasons" : "all-year records for a species that stays" },
    { component: "source age", holds: true, detail: `records read ${records.retrievedAt?.slice(0, 10)}; land cover epoch 2019 (its age is reported with the surface)` },
    { component: "resolution", holds: true, detail: `habitat at 0.1° (about 11 km); range edge from ${range.step}° record cells and ${family.reachKm} km beyond them` },
  ];
  const failing = components.filter((c) => !c.holds);
  const level = tier === "RANGE_ONLY" ? "LIMITED" : failing.length ? "LIMITED" : "MODERATE";
  const rule = `${tier === "RANGE_ONLY" ? "A distribution does not rank places, so it is LIMITED." : "Never HIGH: a habitat profile measures no animals. MODERATE when every component holds, LIMITED otherwise."} ${components.map((c) => `${c.component}: ${c.holds ? "holds" : "fails"} (${c.detail})`).join("; ")}.`;

  /* ---- useful internal variation ---- */
  const classShares = {};
  for (const [, , v] of painted) {
    const cls = v >= 875 ? "CORE" : v >= 625 ? "HIGH" : v >= 375 ? "MODERATE" : "LOW";
    classShares[cls] = (classShares[cls] ?? 0) + 1;
  }
  for (const key of Object.keys(classShares)) classShares[key] = Math.round((classShares[key] / painted.length) * 1000) / 1000;
  const dominant = Math.max(...Object.values(classShares));
  const usefulVariation = tier !== "RANGE_ONLY" && dominant <= 0.9;

  const group = groupOf(speciesId, profile);
  const edgeUnrecorded = edgeOnUnrecorded(speciesId, group, range.inRange);
  const edgeFollowsRecording = edgeUnrecorded !== null && edgeUnrecorded >= EDGE_FOLLOWS_RECORDING;

  const name = pub.name ?? slug;
  const lcInput = { id: landcover.manifest.id, hash: landcover.manifest.artifact.sha256 };
  const inputs = [lcInput, { id: `open occurrence records (${inputPath})`, hash: sha(readFileSync(inputPath)) }];
  if (needsTerrain) inputs.push({ id: terrain.manifest.id, hash: terrain.manifest.artifact.sha256 });
  const statementSources = (statement?.sourceIds ?? []).map((id) => sources.get(id)).filter(Boolean);
  const recordBias = family.recordBias ?? "";
  const artifact = {
    id: `surface:range-habitat-${slug}-${METHODOLOGY.version}`,
    speciesId,
    metric: tier === "RANGE_ONLY" ? "KNOWN_DISTRIBUTION" : "HABITAT_SUITABILITY_IN_RANGE",
    unit: tier === "RANGE_ONLY" ? "inside the known distribution" : "habitat class inside the supported range",
    sitesSurveyed: range.counted,
    sitesDetected: range.counted,
    source: {
      authority: "North Ground (range and habitat profile)",
      title: `${name}: ${tier === "RANGE_ONLY" ? "known distribution" : "habitat opportunity inside its range"}, methodology ${METHODOLOGY.version}`,
      url: records.portalQuery ?? "https://www.gbif.org",
      licence: "North Ground surface; inputs under CC BY 4.0 (Copernicus land cover), CC0 1.0 and CC BY 4.0 (occurrence records through GBIF.org)" + (needsTerrain ? " and the public domain (NOAA ETOPO 2022)" : ""),
      attribution: [
        landcover.manifest.source.attribution,
        `Range from occurrence records published through GBIF.org (retrieved ${records.retrievedAt}) by the ${records.datasets.length} datasets credited in content/intelligence/range-habitat/datasets.json.`,
        ...(needsTerrain ? [terrain.manifest.source.attribution] : []),
      ].join(" "),
      retrievedAt: records.retrievedAt,
      verifiedAt: records.retrievedAt,
    },
    limitations: [
      tier === "RANGE_ONLY"
        ? `The known distribution, shaded evenly. It says where records place the species, not where inside that there are more. ${profile.whyNotRangeHabitat}`
        : `How well the land suits ${name.toLowerCase()}, inside the range records place it. Habitat, not a count of animals and not a density.`,
      `The range is ground within ${family.reachKm} km of places where openly licensed records confirm the species; where people rarely record wildlife, real range can be missing, and records can be wrong.`,
      ...(edgeFollowsRecording ? [`About ${Math.round(edgeUnrecorded * 100)} in 100 of this range's land edge borders ground where the records read hold almost nothing of any hunted ${GROUP_NOUN[group]} (fewer than ${UNRECORDED_BELOW} to a 1.4° cell) — remote country few people record, or ground outside Canada and the United States, which is all that is read. There the edge is where recording stops, not where the species does.`] : []),
      `Records decide only whether ground is in the range; they never set a cell's colour, so where more people report wildlife does not become where there are more animals. ${recordBias}`.trim(),
      "Unshaded ground is outside that range, rated unsuitable inside it, or open water, sea, ice or town the profile does not name as habitat. None of these is a finding that the species is absent.",
      "Land cover is from 2019 and does not know forest age, recent fire or harvest.",
      ...(seasonal ? ["Drawn from records made in September to February, so it shows where the species is in the hunting season, not where it breeds."] : []),
      "Hunting geography and seasons play no part in this surface; the zone card says what is legal.",
    ],
    observationPeriod: { from: "2000-01-01", through: records.retrievedAt },
    methodology: { ...METHODOLOGY },
    methodologyStatedAs: tier === "RANGE_ONLY"
      ? `Range: ground within ${family.reachKm} km of GBIF's ${range.step}° cells holding ${MIN_RECORDS_PER_SQUARE}+ openly licensed records since 2000, each within ${CLUSTER_KM} km of another${family.isolatedSquareMinRecords ? ` or holding ${family.isolatedSquareMinRecords}+ on its own` : ""}${family.gapKm ? `, with gaps of up to ${family.gapKm} km between recorded ground joined` : ""} (${range.counted} squares, ${records.openRecordCount} records). Shaded evenly: ${profile.whyNotRangeHabitat}`
      : `Range: ground within ${family.reachKm} km of GBIF's ${range.step}° cells holding ${MIN_RECORDS_PER_SQUARE}+ openly licensed records since 2000, each within ${CLUSTER_KM} km of another${family.isolatedSquareMinRecords ? ` or holding ${family.isolatedSquareMinRecords}+ on its own` : ""}${family.gapKm ? `, with gaps of up to ${family.gapKm} km between recorded ground joined` : ""} (${range.counted} squares, ${records.openRecordCount} records${seasonal ? ", September to February" : ""}). Habitat: each 0.1° cell's land cover read through this species' categorical profile (core 1, high 0.75, moderate 0.5, low 0.25, unsuitable 0), share-weighted${profile.edge ? ", edges of forest and open land raised" : ""}${(profile.requires ?? []).length ? ", with required relationships as limiting factors" : ""}; open water, sea, ice and town the profile does not name are masked. No weight is fitted.`,
    scaleStatedAs: tier === "RANGE_ONLY"
      ? `${name}: known distribution. Shaded evenly across it; the colour does not rank places.`
      : `${name}: habitat opportunity. Colour is the habitat class for this species inside its range — red core, orange and yellow strong, green moderate, blue marginal. Habitat, not a count of animals.`,
    season: {
      observedSeason: seasonal ? "September to February records (the hunting season)" : "All seasons (resident habitat)",
      matchesHuntingSeason: true,
      warning: seasonal
        ? "Records from September to February only, so this is the species' hunting-season distribution, not its breeding range."
        : "Habitat is read from the land, which does not change with the season; where the animals are within it can.",
    },
    model: {
      id: `model:north-ground-range-habitat-${slug}`,
      version: METHODOLOGY.version,
      claim: tier,
      inputs,
      literature: statement
        ? [`${statement.text} — North Ground's published profile of the species, citing ${statementSources.map((s) => `${s.authority}, ${s.title}`).join("; ") || (statement.sourceIds ?? []).join(", ")}.`]
        : [`No habitat statement is published for the species; the range alone is drawn. ${profile.whyNotRangeHabitat}`],
      reading: profile.reading,
      profile: { family: profile.family, reachKm: family.reachKm, landCover: profile.landCover ?? null, edge: profile.edge ?? null, requires: profile.requires ?? [], coastKm: profile.coastKm ?? null, season: profile.season ?? null, whyNotRangeHabitat: profile.whyNotRangeHabitat ?? null },
      range: { confirmedSquares: range.confirmed, countedSquares: range.counted, islandSquares: range.islands, gapKm: family.gapKm ?? null, joinedCells: range.joinedCells, recordGroup: group ?? null, edgeOnUnrecordedGround: edgeUnrecorded, openRecords: records.openRecordCount, datasets: records.datasets.length, months: records.months ?? null },
      cells: { painted: painted.length, unsuitable, masked, noData },
      variation: { classShares, usefulVariation },
      confidenceComponents: components,
    },
    /* Node-registered: the value of cell (row, col) belongs to its centre. */
    grid: { latStep: G.cell, lonStep: G.cell, south: G.south + G.cell / 2, west: G.west + G.cell / 2, rows: G.rows, cols: G.columns, registration: "CELL_CENTRE_NODES" },
    cellsEncoded: encode(cells),
  };
  const text = `${JSON.stringify(artifact)}\n`;
  const path = join(OUT, `${slug}.json`);
  const entry = {
    speciesId,
    surfaceKind: tier === "RANGE_ONLY" ? "RANGE_EXTENT" : "RANGE_HABITAT",
    evidenceClass: "RANGE_HABITAT_MODEL",
    surfaceTier: tier,
    confidence: { level, rule },
    visualTransform: tier === "RANGE_ONLY"
      ? { kind: "EVEN_TONE", statedAs: "Shaded evenly inside the known distribution; the colour does not rank places." }
      : { kind: "SUITABILITY_CLASS", statedAs: "Colour is the habitat class, not a rank: red core, orange and yellow strong, green moderate, blue marginal; a cell of mixed cover takes its share-weighted class." },
    evidenceWindow: seasonal ? "HUNTING_SEASON" : "YEAR_ROUND",
    resolution: {
      source: { metres: Math.round(range.step * 111_000), statedAs: `Range from GBIF's ${range.step}° record cells (about ${Math.round(range.step * 111)} km north to south), reaching ${family.reachKm} km beyond them; habitat from 100 m land cover` },
      model: { metres: 11_000, statedAs: "Habitat class per 0.1° cell (about 11 km); the range edge is coarser than the habitat inside it" },
    },
    inputsDated: [
      { input: "Open occurrence records through GBIF.org", kind: "OCCURRENCE_READ", datedFrom: String(records.retrievedAt).slice(0, 10) },
      { input: "Copernicus Global Land Cover, epoch 2019", kind: "LAND_COVER", datedFrom: "2019-12-31" },
      ...(needsTerrain ? [{ input: "NOAA ETOPO 2022", kind: "TERRAIN", datedFrom: "2022-12-31" }] : []),
    ],
    artifactId: artifact.id,
    artifactPath: path,
    artifactHash: sha(text),
    sourceDatasetId: artifact.model.id,
    metric: artifact.metric,
    unit: artifact.unit,
    effectiveResolutionMetres: 11000,
    effectiveResolutionStatedAs: `Land cover per 0.1° cell (about 11 km); the range edge comes from records within ${family.reachKm} km, so it is coarser than the habitat inside it`,
    season: artifact.season.observedSeason,
    matchesHuntingSeason: true,
    tier: tier === "RANGE_ONLY" ? "T3_RECORDED_PRESENCE" : "T4_DERIVED_HABITAT",
    grade: "D",
    methodologyId: METHODOLOGY.id,
    methodologyVersion: METHODOLOGY.version,
    interpolationPermitted: true,
    coverage: "PARTIAL_DATA",
    unmappedGround: "NO_EVIDENCE_HELD",
    sitesSurveyed: range.counted,
    sitesDetected: range.counted,
    supportedCells: painted.length,
    surveyedAndNoneFound: 0,
    usefulVariation,
    edgeOnUnrecordedGround: edgeUnrecorded,
  };
  return { artifact: { path, text }, entry };
}

const profiles = profileFile.species;
const surfaces = [];
const declined = [];
const artifacts = [];
for (const [speciesId, profile] of Object.entries(profiles).sort(([a], [b]) => a.localeCompare(b))) {
  if (ONLY && !ONLY.includes(speciesId)) continue;
  const built = buildOne(speciesId, profile);
  if (built.declined) {
    declined.push(built.declined);
    continue;
  }
  artifacts.push(built.artifact);
  surfaces.push(built.entry);
  process.stdout.write(`${speciesId.padEnd(38)} ${built.entry.surfaceTier.padEnd(14)} ${String(built.entry.supportedCells).padStart(7)} cells · ${built.entry.confidence.level}${built.entry.usefulVariation ? "" : " · no useful variation"}\n`);
}
for (const row of declined) process.stdout.write(`${row.speciesId.padEnd(38)} DECLINED ${row.reason}: ${row.detail}\n`);

const registry = {
  schemaVersion: 1,
  note: "Range-and-habitat surfaces, certified by scripts/build-range-habitat-surfaces.mjs. Separate from the other registries so no builder can erase another's surfaces.",
  methodology: { ...METHODOLOGY, minimumRecordsPerSquare: MIN_RECORDS_PER_SQUARE, clusterKm: CLUSTER_KM, minimumRecordsPerSpecies: MIN_SPECIES_RECORDS, minimumCountedSquares: MIN_COUNTED_SQUARES, concentratedPopulation: { squares: MIN_CONCENTRATED_SQUARES, records: MIN_CONCENTRATED_RECORDS }, edgeShare: EDGE_SHARE, paintFloor: PAINT_FLOOR, maskShare: MASK_SHARE, classValues: CLASS, confidence: CONFIDENCE },
  surfaces,
  declined,
};
const registryText = `${JSON.stringify(registry, null, 2)}\n`;
/* A surface this build declined must not stay in the tree as an artifact
   nobody certifies: only the surface files this builder writes are removed. */
const leftover = declined.map((row) => join(OUT, `${slugOf(row.speciesId)}.json`)).filter((path) => existsSync(path));
if (CHECK) {
  let stale = !existsSync(REGISTRY) || readFileSync(REGISTRY, "utf8") !== registryText;
  for (const { path, text } of artifacts) if (!existsSync(path) || readFileSync(path, "utf8") !== text) { stale = true; process.stderr.write(`stale: ${path}\n`); }
  for (const path of leftover) { stale = true; process.stderr.write(`declined, still in the tree: ${path}\n`); }
  if (stale) { process.stderr.write("range-habitat surfaces are not what the builder produces\n"); process.exit(1); }
  process.stdout.write(`range-habitat surfaces current: ${surfaces.length} surfaces, ${declined.length} declined\n`);
} else if (!ONLY) {
  mkdirSync(OUT, { recursive: true });
  for (const { path, text } of artifacts) writeFileSync(path, text);
  for (const path of leftover) rmSync(path);
  writeFileSync(REGISTRY, registryText);
  process.stdout.write(`${surfaces.length} surfaces; ${declined.length} declined\n`);
}
