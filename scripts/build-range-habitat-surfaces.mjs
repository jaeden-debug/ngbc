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
 *   - a square (GBIF's own 0.3515625° squares) is CONFIRMED with at least
 *     MIN_RECORDS_PER_SQUARE openly licensed records since 2000;
 *   - a confirmed square COUNTS only if another confirmed square lies within
 *     CLUSTER_KM, so one misplaced or vagrant cluster of records cannot draw an
 *     island of range on its own;
 *   - the range is the ground within the family's declared reach of a counted
 *     square;
 *   - a species needs MIN_SPECIES_RECORDS records and MIN_COUNTED_SQUARES
 *     counted squares, or its range is not defensible and it is declined with
 *     its counts.
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
 *   - a cell is drawn at PAINT_FLOOR or above; below that it is unsuitable
 *     and left unshaded.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync, gunzipSync } from "node:zlib";

const args = process.argv.slice(2);
const CHECK = args.includes("--check");
const IMPORT = args.includes("--import-records");
const ONLY = args.find((a) => a.startsWith("--species="))?.split("=")[1]?.split(",");

const PROFILES = "content/intelligence/surface-profiles.json";
const FOUNDATION = "content/intelligence/foundation";
const OUT = "content/intelligence/range-habitat";
const INPUTS = join(OUT, "inputs");
const REGISTRY = "content/intelligence/range-habitat-registry.json";
const METHODOLOGY = { id: "methodology:north-ground-range-habitat", version: "1.0.0", effectiveFrom: "2026-09-30" };

export const MIN_RECORDS_PER_SQUARE = 2;
export const CLUSTER_KM = 150;
export const MIN_SPECIES_RECORDS = 30;
export const MIN_COUNTED_SQUARES = 5;
export const EDGE_SHARE = 0.2;
export const PAINT_FLOOR = 0.2;
export const RANGE_ONLY_VALUE = 0.5;
/* The confidence rule for this tier, stated with every surface. */
const CONFIDENCE = { moderateRecords: 1000, moderateSquares: 100 };
const GBIF_STEP = 0.3515625;

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
      matchType: read.matchType ?? null,
      refused: read.refused ?? null,
      retrievedAt: read.retrievedAt ?? null,
      months: read.months ?? null,
      filter: read.filter ?? null,
      portalQuery: read.portalQuery ?? null,
      openRecordCount: read.openRecordCount ?? 0,
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

function rangeOf(records, reachKm) {
  const confirmed = records.squares.filter(([, , n]) => n >= MIN_RECORDS_PER_SQUARE).map(([west, south, n]) => ({ west, south, n, lat: south + GBIF_STEP / 2, lon: west + GBIF_STEP / 2 }));
  /* Clustered: another confirmed square within CLUSTER_KM. Bucketed by 2° so
     the search is local. */
  const buckets = new Map();
  const key = (lat, lon) => `${Math.floor(lat / 2)}:${Math.floor(lon / 2)}`;
  for (const square of confirmed) {
    const k = key(square.lat, square.lon);
    buckets.set(k, [...(buckets.get(k) ?? []), square]);
  }
  const counted = confirmed.filter((square) => {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -3; dx <= 3; dx += 1) {
        for (const other of buckets.get(`${Math.floor(square.lat / 2) + dy}:${Math.floor(square.lon / 2) + dx}`) ?? []) {
          if (other !== square && kmBetween(square.lat, square.lon, other.lat, other.lon) <= CLUSTER_KM) return true;
        }
      }
    }
    return false;
  });
  const inRange = new Uint8Array(G.rows * G.columns);
  for (const square of counted) {
    const dLat = reachKm / 111 + GBIF_STEP;
    const dLon = reachKm / (111 * Math.max(0.15, Math.cos((square.lat * Math.PI) / 180))) + GBIF_STEP;
    const rowTop = Math.max(0, Math.floor((G.north - (square.south + GBIF_STEP + dLat)) / G.cell));
    const rowBottom = Math.min(G.rows - 1, Math.floor((G.north - (square.south - dLat)) / G.cell));
    const colLeft = Math.max(0, Math.floor((square.west - dLon - G.west) / G.cell));
    const colRight = Math.min(G.columns - 1, Math.floor((square.west + GBIF_STEP + dLon - G.west) / G.cell));
    for (let row = rowTop; row <= rowBottom; row += 1) {
      const lat = cellLat(row);
      for (let col = colLeft; col <= colRight; col += 1) {
        const lon = cellLon(col);
        /* Distance from the cell centre to the square itself, not its centre. */
        const nearLat = Math.min(Math.max(lat, square.south), square.south + GBIF_STEP);
        const nearLon = Math.min(Math.max(lon, square.west), square.west + GBIF_STEP);
        if (kmBetween(lat, lon, nearLat, nearLon) <= reachKm) inRange[row * G.columns + col] = 1;
      }
    }
  }
  return { confirmed: confirmed.length, counted: counted.length, inRange };
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

function neighbourhoodShare(row, col, groups) {
  let sum = 0;
  let n = 0;
  for (let r = Math.max(0, row - 1); r <= Math.min(G.rows - 1, row + 1); r += 1) {
    for (let c = Math.max(0, col - 1); c <= Math.min(G.columns - 1, col + 1); c += 1) {
      const cell = r * G.columns + c;
      sum += groups.reduce((s, g) => s + share(cell, g), 0);
      n += 1;
    }
  }
  return n ? sum / n : 0;
}

function classFromThresholds(value, thresholds) {
  for (const level of ["CORE", "HIGH", "MODERATE", "LOW"]) if (thresholds[level] !== undefined && value >= thresholds[level]) return level;
  return "UNSUITABLE";
}

function scoreCell(row, col, profile, table) {
  const cell = row * G.columns + col;
  const hasSea = table.SEA !== undefined;
  const sea = share(cell, "SEA");
  const noData = share(cell, "NO_DATA");
  const total = 1 - noData;
  if (total <= 0.01) return null;
  const land = landOf(cell);
  if (!hasSea && land < 0.5) return null;
  const seaCounts = hasSea && sea > 0 && nearLand(row, col, profile.coastKm ?? 10);
  const denominator = hasSea ? land + sea : land;
  if (denominator <= 0) return null;
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
    else throw new Error(`unknown requirement ${requirement.feature}`);
    if (value === null) return undefined;
    score = Math.min(score, CLASS[classFromThresholds(value, requirement.thresholds)]);
  }
  return score;
}

/* ------------------------------------------------------------------ build */

function encode(cells) {
  /* One byte per cell over the occupied box: 0 = not drawn, v = intensity / 4. */
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
  for (const [row, col, intensity] of cells) bytes[(row - r0) * cols + (col - c0)] = Math.max(1, Math.min(250, Math.round(intensity / 4)));
  return { encoding: "U8_DEFLATE_BASE64", scale: 4, r0, c0, rows, cols, data: deflateSync(bytes, { level: 9 }).toString("base64") };
}

function buildOne(speciesId, profile) {
  const slug = slugOf(speciesId);
  const pub = published.get(speciesId);
  if (!pub) throw new Error(`${speciesId} has a surface profile and no published species profile`);
  const statement = (pub.profile.habitat ?? []).find((h) => h.text === profile.habitatStatement);
  if (!statement) throw new Error(`${speciesId}: the profile's habitat statement is not, verbatim, in the published profile`);
  const family = FAMILIES[profile.family];
  if (!family) throw new Error(`${speciesId}: unknown family ${profile.family}`);
  const tier = profile.tier ?? "RANGE_HABITAT";
  const inputPath = join(INPUTS, `${slug}.records.json`);
  if (!existsSync(inputPath)) return { declined: { speciesId, reason: "NO_RANGE_EVIDENCE_READ", detail: "No occurrence read is committed for this species yet; the range cannot be drawn until one is." } };
  const records = JSON.parse(readFileSync(inputPath, "utf8"));
  if (records.refused) {
    const failed = String(records.refused).startsWith("read failed");
    return { declined: { speciesId, reason: failed ? "READ_FAILED" : "NO_TAXON_MATCH", detail: failed ? `The occurrence service did not answer for ${records.scientificName}: ${records.refused.replace(/^read failed: /, "")}` : `GBIF holds no exact name match for ${records.scientificName}; no range evidence could be read.` } };
  }
  if (records.unreadTiles?.length) return { declined: { speciesId, reason: "INCOMPLETE_READ", detail: `The occurrence service refused ${records.unreadTiles.length} tiles for ${records.scientificName}; a range with a hole in it would draw unread ground as outside the range.` } };
  const range = rangeOf(records, family.reachKm);
  if (records.openRecordCount < MIN_SPECIES_RECORDS || range.counted < MIN_COUNTED_SQUARES) {
    return { declined: { speciesId, reason: "NO_DEFENSIBLE_RANGE", detail: `${records.openRecordCount} openly licensed records in Canada and the United States since 2000 (${records.months ? "hunting-season months only" : "all months"}), ${range.counted} clustered squares with ${MIN_RECORDS_PER_SQUARE} or more; a range needs ${MIN_SPECIES_RECORDS} records and ${MIN_COUNTED_SQUARES} squares.` } };
  }
  if ((profile.requires ?? []).some((r) => r.feature === "RELIEF_METRES") && !relief) {
    return { declined: { speciesId, reason: "FOUNDATION_MISSING", detail: "Its profile requires rugged terrain, and the terrain foundation is not built yet." } };
  }
  const table = classTable(profile);
  const cells = [];
  for (let row = 0; row < G.rows; row += 1) {
    for (let col = 0; col < G.columns; col += 1) {
      const cell = row * G.columns + col;
      if (!range.inRange[cell]) continue;
      let score;
      if (tier === "RANGE_ONLY") score = landOf(cell) >= 0.5 ? RANGE_ONLY_VALUE : null;
      else score = scoreCell(row, col, profile, table);
      if (score === null || score === undefined || score < PAINT_FLOOR) continue;
      /* South-up, like every other surface artifact. */
      cells.push([G.rows - 1 - row, col, Math.round(score * 1000)]);
    }
  }
  if (!cells.length) return { declined: { speciesId, reason: "NOTHING_SUITABLE", detail: "No ground inside the supported range reaches the lowest habitat class of the profile." } };
  cells.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const name = pub.name ?? slug;
  const confidence = records.openRecordCount >= CONFIDENCE.moderateRecords && range.counted >= CONFIDENCE.moderateSquares ? "MODERATE" : "LIMITED";
  const seasonal = profile.season === "HUNTING_SEASON_RECORDS";
  const lcInput = { id: landcover.manifest.id, hash: landcover.manifest.artifact.sha256 };
  const inputs = [lcInput, { id: `open occurrence records (${inputPath})`, hash: sha(readFileSync(inputPath)) }];
  if ((profile.requires ?? []).some((r) => r.feature === "RELIEF_METRES")) inputs.push({ id: terrain.manifest.id, hash: terrain.manifest.artifact.sha256 });
  const statementSources = (statement.sourceIds ?? []).map((id) => sources.get(id)).filter(Boolean);
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
      licence: "North Ground surface; inputs under CC BY 4.0 (Copernicus land cover), CC0 1.0 and CC BY 4.0 (occurrence records through GBIF.org)" + (inputs.length > 2 ? " and the public domain (NOAA ETOPO 2022)" : ""),
      attribution: [
        landcover.manifest.source.attribution,
        `Range from occurrence records published through GBIF.org (retrieved ${records.retrievedAt}) by the ${records.datasets.length} datasets credited in content/intelligence/range-habitat/datasets.json.`,
        ...(inputs.length > 2 ? [terrain.manifest.source.attribution] : []),
      ].join(" "),
      retrievedAt: records.retrievedAt,
      verifiedAt: records.retrievedAt,
    },
    limitations: [
      tier === "RANGE_ONLY"
        ? "The known distribution, shaded evenly. It says where records place the species, not where inside that there are more."
        : `How well the land suits ${name.toLowerCase()}, inside the range records place it. Habitat, not a count of animals and not a density.`,
      `The range is ground within ${family.reachKm} km of places where openly licensed records confirm the species; where people rarely record wildlife, real range can be missing, and records can be wrong.`,
      "Unshaded ground is outside that range or rated unsuitable. It is not a finding that the species is absent.",
      "Land cover is from 2019 and does not know forest age, recent fire or harvest.",
      ...(seasonal ? ["Drawn from records made in September to February, so it shows where the species is in the hunting season, not where it breeds."] : []),
      "Hunting geography and seasons play no part in this surface; the zone card says what is legal.",
    ],
    observationPeriod: { from: "2000-01-01", through: records.retrievedAt },
    methodology: { ...METHODOLOGY },
    methodologyStatedAs: tier === "RANGE_ONLY"
      ? `Range: ground within ${family.reachKm} km of 0.35° squares holding ${MIN_RECORDS_PER_SQUARE}+ openly licensed records since 2000, each within ${CLUSTER_KM} km of another (${range.counted} squares, ${records.openRecordCount} records). Shaded evenly; the published statement names no habitat to vary it by.`
      : `Range: ground within ${family.reachKm} km of 0.35° squares holding ${MIN_RECORDS_PER_SQUARE}+ openly licensed records since 2000, each within ${CLUSTER_KM} km of another (${range.counted} squares, ${records.openRecordCount} records${seasonal ? ", September to February" : ""}). Habitat: each 0.1° cell's land cover read through this species' categorical profile (core 1, high 0.75, moderate 0.5, low 0.25, unsuitable 0), share-weighted${profile.edge ? ", edges of forest and open land raised" : ""}${(profile.requires ?? []).length ? ", with required relationships as limiting factors" : ""}. No weight is fitted.`,
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
      literature: [
        `${statement.text} — North Ground's published profile of the species, citing ${statementSources.map((s) => `${s.authority}, ${s.title}`).join("; ") || (statement.sourceIds ?? []).join(", ")}.`,
      ],
      reading: profile.reading,
      profile: { family: profile.family, reachKm: family.reachKm, landCover: profile.landCover ?? null, edge: profile.edge ?? null, requires: profile.requires ?? [], coastKm: profile.coastKm ?? null, season: profile.season ?? null },
      range: { confirmedSquares: range.confirmed, countedSquares: range.counted, openRecords: records.openRecordCount, datasets: records.datasets.length, months: records.months ?? null },
    },
    grid: { latStep: G.cell, lonStep: G.cell, south: G.south, west: G.west, rows: G.rows, cols: G.columns },
    cellsEncoded: encode(cells),
  };
  const text = `${JSON.stringify(artifact)}\n`;
  const path = join(OUT, `${slug}.json`);
  const entry = {
    speciesId,
    surfaceKind: tier === "RANGE_ONLY" ? "RANGE_EXTENT" : "RANGE_HABITAT",
    evidenceClass: "RANGE_HABITAT_MODEL",
    surfaceTier: tier,
    confidence: {
      level: tier === "RANGE_ONLY" ? "LIMITED" : confidence,
      rule: tier === "RANGE_ONLY"
        ? "A distribution only: it does not rank places."
        : `A categorical habitat profile inside a range from occurrence records: MODERATE from ${CONFIDENCE.moderateRecords} records in ${CONFIDENCE.moderateSquares} squares, LIMITED below (${records.openRecordCount} records, ${range.counted} squares).`,
    },
    visualTransform: tier === "RANGE_ONLY"
      ? { kind: "EVEN_TONE", statedAs: "Shaded evenly inside the known distribution; the colour does not rank places." }
      : { kind: "SUITABILITY_CLASS", statedAs: "Colour is the habitat class, not a rank: red core, orange and yellow strong, green moderate, blue marginal; a cell of mixed cover takes its share-weighted class." },
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
    supportedCells: cells.length,
    surveyedAndNoneFound: 0,
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
  process.stdout.write(`${speciesId.padEnd(38)} ${built.entry.surfaceTier.padEnd(14)} ${String(built.entry.supportedCells).padStart(7)} cells · ${built.entry.confidence.level}\n`);
}
for (const row of declined) process.stdout.write(`${row.speciesId.padEnd(38)} DECLINED ${row.reason}: ${row.detail}\n`);

const registry = {
  schemaVersion: 1,
  note: "Range-and-habitat surfaces, certified by scripts/build-range-habitat-surfaces.mjs. Separate from the other registries so no builder can erase another's surfaces.",
  methodology: { ...METHODOLOGY, minimumRecordsPerSquare: MIN_RECORDS_PER_SQUARE, clusterKm: CLUSTER_KM, minimumRecordsPerSpecies: MIN_SPECIES_RECORDS, minimumCountedSquares: MIN_COUNTED_SQUARES, edgeShare: EDGE_SHARE, paintFloor: PAINT_FLOOR, classValues: CLASS },
  surfaces,
  declined,
};
const registryText = `${JSON.stringify(registry, null, 2)}\n`;
if (CHECK) {
  let stale = !existsSync(REGISTRY) || readFileSync(REGISTRY, "utf8") !== registryText;
  for (const { path, text } of artifacts) if (!existsSync(path) || readFileSync(path, "utf8") !== text) { stale = true; process.stderr.write(`stale: ${path}\n`); }
  if (stale) { process.stderr.write("range-habitat surfaces are not what the builder produces\n"); process.exit(1); }
  process.stdout.write(`range-habitat surfaces current: ${surfaces.length} surfaces, ${declined.length} declined\n`);
} else if (!ONLY) {
  mkdirSync(OUT, { recursive: true });
  for (const { path, text } of artifacts) writeFileSync(path, text);
  writeFileSync(REGISTRY, registryText);
  process.stdout.write(`${surfaces.length} surfaces; ${declined.length} declined\n`);
}
