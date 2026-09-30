#!/usr/bin/env node
/**
 * Build species distribution surfaces from the North American Breeding Bird Survey.
 *
 * WHY THIS DATASET. Every species-evidence source North Ground held before this
 * one reported at management-zone resolution, so the only picture it could draw
 * was one colour per hunting unit. The BBS is different in the way that matters:
 * it is a census of SITES. Each route is a fixed 39.4 km roadside transect with
 * published coordinates, run once a breeding season by a qualified observer, and
 * its position has nothing whatever to do with where a regulator drew a zone
 * line. A surface built from it therefore crosses those lines without noticing
 * them, which is the architectural property §41B requires and a choropleth
 * cannot have.
 *
 * It is also, by a distance, the best-licensed spatial wildlife data found:
 * CC0-1.0, a public domain dedication with no restriction on commercial use or
 * redistribution. Attribution below is North Ground's own provenance standard,
 * not a licence condition.
 *
 * WHAT IT MEASURES, AND WHAT IT DOES NOT. Birds DETECTED on a standard survey.
 * That is RELATIVE ABUNDANCE — it compares places surveyed the same way — and
 * it is never to be relabelled density. Nobody counted the grouse in a square
 * kilometre. It is also a JUNE BREEDING-SEASON survey, so it describes breeding
 * distribution, not the October distribution a hunter is planning around, and
 * that limitation travels with the artifact rather than living in a footnote.
 *
 * THE TWO ZEROS. A route that was run and recorded no birds of the species has
 * NO ROW in the counts file. An ingest that reads only the rows present
 * therefore maps detections and calls the rest unknown — turning a continental
 * survey into a presence map and inflating every value. Here the denominator is
 * the RUN LIST (Weather.csv), so a route run without a detection contributes a
 * real zero. For ruffed grouse that is 3,472 of 4,121 routes: more than half of
 * what this surface knows is a negative finding, and it must stay
 * distinguishable from ground nobody surveyed.
 *
 * Usage:
 *   node --import tsx scripts/build-bbs-surface.mjs            # build every matched species
 *   node --import tsx scripts/build-bbs-surface.mjs --check    # re-derive and compare
 *   node --import tsx scripts/build-bbs-surface.mjs --species=species:ruffed-grouse
 *   node --import tsx scripts/build-bbs-surface.mjs --report   # the coverage matrix only
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { catalogueSpecies } from "../src/lib/hunt/intelligence/species-catalogue.ts";
import { grantsHuntingOpportunity } from "../src/lib/content/species-eligibility.ts";
import { intensityOf, weightedValueAt } from "../src/lib/hunt/intelligence/surface-raster.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CACHE = process.env.BBS_CACHE ?? join(ROOT, ".cache", "bbs");
const OUT_DIR = join(ROOT, "content", "intelligence", "surfaces");

/* ------------------------------------------------------------------ source */

/**
 * The release this build reads, pinned by DOI and by ScienceBase item.
 *
 * Pinned rather than "latest" deliberately: a new BBS release every summer
 * would otherwise silently move every surface in the product, and §45 requires
 * a changed source to trigger review rather than to publish itself.
 */
const RELEASE = {
  id: "source:us-bbs-2026-release",
  authority: "U.S. Geological Survey, Eastern Ecological Science Center, with the Canadian Wildlife Service",
  title: "North American Breeding Bird Survey Dataset 1966 - 2025 (2026 release)",
  url: "https://doi.org/10.5066/P144YU3S",
  catalogueUrl: "https://www.sciencebase.gov/catalog/item/6a0b0b0ab66b0188da36aedd",
  datasetIdentifier: "10.5066/P144YU3S",
  citation:
    "Ziolkowski Jr., D.J., Lutmerding, M., Skalos, S.M., English, W.B., and Hudson, M-A.R., 2026, North American Breeding Bird Survey Dataset 1966 - 2025: U.S. Geological Survey data release, https://doi.org/10.5066/P144YU3S.",
  licence: "Creative Commons Zero v1.0 Universal (CC0-1.0) public domain dedication",
  licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  /* CC0 waives the attribution requirement. North Ground attributes anyway:
     §7 says provenance is how trust is earned, and a hunter deciding whether to
     believe a map is entitled to know which agency surveyed the ground. */
  attributionRequired: false,
  attribution:
    "Contains data from the North American Breeding Bird Survey, U.S. Geological Survey and the Canadian Wildlife Service, released to the public domain under CC0-1.0.",
  commercialReuse: "ALLOWED",
  redistribution: "ALLOWED",
  legalStanding: "OFFICIAL_STATISTICAL_DATA",
  retrievedAt: "2026-09-29",
  verifiedAt: "2026-09-29",
  files: {
    "Routes.csv": "https://www.sciencebase.gov/catalog/file/get/6a0b0b0ab66b0188da36aedd?f=__disk__85%2Ff3%2F30%2F85f33018ad86e77e43031f08e198e53d73532eb8",
    "Weather.csv": "https://www.sciencebase.gov/catalog/file/get/6a0b0b0ab66b0188da36aedd?f=__disk__99%2F9b%2Faa%2F999baa5fdb09c96980a32e4d599892ae563b28c8",
    "SpeciesList.csv": "https://www.sciencebase.gov/catalog/file/get/6a0b0b0ab66b0188da36aedd?f=__disk__67%2F26%2F5b%2F67265bbc0d9312830188fb7e683ed344f19f5452",
    "States.zip": "https://www.sciencebase.gov/catalog/file/get/6a0b0b0ab66b0188da36aedd?f=__disk__fb%2Ff3%2Fb6%2Ffbf3b68cd779b281a77c7b10b8289c8bf6b77497",
  },
};

/* The authority's own statements about its own data. Shown with the surface. */
const LIMITATIONS = [
  "The survey is run in June, during the breeding season. Breeding distribution is not necessarily where a species is during a hunting season.",
  "Routes are roadside transects, so the survey describes habitat reachable by secondary road and under-samples roadless country.",
  "Counts are birds detected by a single observer in three minutes at each of 50 stops. Detection is imperfect and varies with weather, observer and the species' own behaviour.",
  "This is relative abundance: it compares places surveyed the same way. It is not a count or an estimate of the animals present.",
];

/* --------------------------------------------------------------- selection */

/**
 * Which route-years count.
 *
 * `RPID 101` is the standard protocol; other run-protocol ids are experimental
 * or supplementary runs that are not comparable with it. `RunType 1` is the
 * survey's own quality flag — the run met its weather, timing and observer
 * criteria. Including either would mix incomparable effort into a value the map
 * presents as comparable across places.
 */
const STANDARD_PROTOCOL = "101";
const ACCEPTABLE_RUN = "1";
const WINDOW = { from: 2016, through: 2025 };

/**
 * How the surface is computed. Every number below was chosen from a measurement
 * of this dataset, recorded in `docs/research/species-density-evidence.md`, and
 * not by eye.
 */
const METHODOLOGY = {
  id: "methodology:ng-bbs-relative-abundance",
  version: "1.2.0",
  effectiveFrom: "2026-09-29",
  kernel: "GAUSSIAN",
  /* THE DECLARED RESOLUTION. Measured median nearest-neighbour spacing between
     surveyed routes is 27 km and the 90th percentile is 50 km, so a 40 km
     bandwidth smooths across roughly the local sampling interval: enough to
     make a field rather than a scatter of dots, not so much that a real
     regional difference is averaged away. */
  bandwidthKm: 40,
  /* 3 sigma. Past it the Gaussian weight is under 1/700 and the arithmetic is
     noise, but the cutoff also has to be stated because it decides support. */
  truncationKm: 120,
  minimumSites: 3,
  /*
   * Nothing is painted more than this from the nearest surveyed route, however
   * many routes sit at the rim.
   *
   * 60 km in 1.1.0, down from 100. The number is a STATED RELATIONSHIP TO THE
   * DATA rather than one that produced an agreeable map: measured route spacing
   * has a p95 of 58.8 km, so 60 km admits genuinely sparse-but-real sampling and
   * refuses ground outside the regime the survey was designed to cover. At 100
   * km a cell whose nearest route is 89 km away was painted — Labrador and
   * northern Ontario — which asserts knowledge the survey design cannot carry.
   *
   * It drops those two, and they are real hunting country. NO DATA there is a
   * finding about where the Breeding Bird Survey runs its roadside routes, not
   * about the animals, and the coverage record says so.
   *
   * Derived independently from the route geometry (median nearest-neighbour
   * 27.1 km, p90 50.0, p95 58.8) and checked by place before it was adopted:
   * the Appalachians, northern Michigan, New Brunswick, Algonquin, south Texas,
   * Nevada and the Gaspé all survive it.
   */
  maximumSiteDistanceKm: 60,
  transform: "SQRT",
  /* The value mapped to full red is the 98th percentile of the supported field,
     not its maximum: a single exceptional route would otherwise set the scale
     for a continent and flatten everything else to blue. Measured on ruffed
     grouse, this spreads the non-zero cells 29/26/19/11/6/8 across the six
     bands; the maximum put 87% of them in the lowest band. */
  ceilingQuantile: 0.98,
  /*
   * PER-SPECIES SUFFICIENCY, declared beside the per-cell rule rather than
   * inherited from it.
   *
   * A species detected on a handful of routes cannot carry a continental field
   * however good the licence. 30 is the per-cell minimum of three routes taken
   * ten times over, which is a stated relationship to the support rule and not
   * a number chosen for the species it admits.
   *
   * It admits spruce grouse at 44 routes and greater scaup at 32, and the owner
   * has ruled they serve: an honest surface of a thinly detected bird is a true
   * statement about where that bird is not, and refusing it would be the
   * unnecessary refusal §8 warns about in the other direction. Their surfaces
   * are overwhelmingly surveyed-and-none-found — 20,324 and 21,697 of 22,873
   * cells — which the surface reports so a reader sees a thin bird rather than
   * a broken map.
   */
  minimumRoutesForSpecies: 30,
  yearCombination:
    "The mean over every year in the window in which the route was run to standard protocol and passed the survey's quality criteria. A year the route was run without detecting the species contributes zero, because the survey looked.",
};

/** The render grid. Both steps are FINER than the bandwidth on purpose. */
const GRID_STEP = { lat: 0.2, lon: 0.3 };
/** How far past the surveyed extent the grid is allowed to run, in degrees. */
const GRID_MARGIN = 2;

/* ------------------------------------------------------------------- input */

function sha256(buffer) {
  return `sha256:${createHash("sha256").update(buffer).digest("hex")}`;
}

/**
 * The downloads, and the hash of each one as it was actually read.
 *
 * WHY HASHES. `sha256` was defined here and never called, so the artifact
 * recorded the URLs it came from and nothing about their contents. A release
 * that is re-issued at the same URL — which ScienceBase does — would change the
 * surface with nothing in the record to show it had. Every other bundle in this
 * program can be re-derived and compared; this one could not.
 *
 * They are computed from the cached bytes rather than from the response, so a
 * stale cache is visible as a changed hash rather than as a silent old build.
 */
async function ensureCached() {
  mkdirSync(CACHE, { recursive: true });
  const hashes = {};
  for (const [name, url] of Object.entries(RELEASE.files)) {
    const path = join(CACHE, name);
    if (!existsSync(path)) {
      process.stderr.write(`  downloading ${name} …\n`);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${name}: ${response.status} from ScienceBase`);
      writeFileSync(path, Buffer.from(await response.arrayBuffer()));
    }
    hashes[name] = sha256(readFileSync(path));
  }
  const statesDir = join(CACHE, "States");
  if (!existsSync(statesDir)) {
    const { execFileSync } = await import("node:child_process");
    execFileSync("unzip", ["-o", "-q", join(CACHE, "States.zip"), "-d", CACHE]);
  }
  return hashes;
}

/** A tiny CSV reader. The BBS files are plain, unquoted, latin-1 comma files. */
function readCsv(path) {
  const text = readFileSync(path, "latin1");
  const lines = text.split(/\r?\n/);
  const header = lines[0].split(",").map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    if (!lines[i]) continue;
    const parts = lines[i].split(",");
    const row = {};
    for (let c = 0; c < header.length; c += 1) row[header[c]] = (parts[c] ?? "").trim();
    rows.push(row);
  }
  return rows;
}

const routeKey = (row) => `${row.CountryNum}|${row.StateNum}|${row.Route}`;

function loadSource() {
  const routes = new Map();
  for (const row of readCsv(join(CACHE, "Routes.csv"))) {
    routes.set(routeKey(row), {
      latitude: Number(row.Latitude),
      longitude: Number(row.Longitude),
      name: row.RouteName,
      country: row.CountryNum,
    });
  }
  /* The DENOMINATOR: every route-year actually run to standard. Without this a
     route that was surveyed and found nothing is indistinguishable from a route
     nobody visited, and the surface becomes a presence map. */
  const runs = new Map();
  for (const row of readCsv(join(CACHE, "Weather.csv"))) {
    if (row.RPID !== STANDARD_PROTOCOL || row.RunType !== ACCEPTABLE_RUN) continue;
    const year = Number(row.Year);
    if (year < WINDOW.from || year > WINDOW.through) continue;
    const key = routeKey(row);
    if (!runs.has(key)) runs.set(key, new Set());
    runs.get(key).add(year);
  }
  /* Counts, indexed by AOU so one pass over 65 MB serves every species. */
  const counts = new Map();
  for (const file of readdirSync(join(CACHE, "States"))) {
    if (!file.endsWith(".csv")) continue;
    for (const row of readCsv(join(CACHE, "States", file))) {
      if (row.RPID !== STANDARD_PROTOCOL) continue;
      const year = Number(row.Year);
      if (year < WINDOW.from || year > WINDOW.through) continue;
      const aou = row.AOU.padStart(5, "0");
      if (!counts.has(aou)) counts.set(aou, new Map());
      const byRoute = counts.get(aou);
      const key = routeKey(row);
      if (!byRoute.has(key)) byRoute.set(key, new Map());
      byRoute.get(key).set(year, Number(row.SpeciesTotal));
    }
  }
  const species = new Map();
  for (const row of readCsv(join(CACHE, "SpeciesList.csv"))) {
    const binomial = `${row.Genus} ${row.Species}`.toLowerCase();
    if (!species.has(binomial)) species.set(binomial, { aou: row.AOU.padStart(5, "0"), english: row.English_Common_Name });
  }
  return { routes, runs, counts, species };
}

/* ------------------------------------------------------------------ build */

/**
 * One value per surveyed route: the mean over the years it was run.
 *
 * Zero-filled from the run list, per the note at the top of this file.
 */
function sitesFor(aou, { routes, runs, counts }) {
  const byRoute = counts.get(aou) ?? new Map();
  const sites = [];
  let detected = 0;
  for (const [key, years] of runs) {
    const route = routes.get(key);
    if (!route) continue;
    const observed = byRoute.get(key);
    let total = 0;
    for (const year of years) total += observed?.get(year) ?? 0;
    const value = total / years.size;
    if (value > 0) detected += 1;
    sites.push({
      id: key,
      latitude: route.latitude,
      longitude: route.longitude,
      value,
      occasions: years.size,
      siteGeometry: "POINT",
    });
  }
  return { sites, detected };
}

function buildSurface(speciesId, aou, source) {
  const { sites, detected } = sitesFor(aou, source);
  if (!sites.length) return null;

  const lats = sites.map((s) => s.latitude);
  const lons = sites.map((s) => s.longitude);
  const grid = {
    latStep: GRID_STEP.lat,
    lonStep: GRID_STEP.lon,
    south: Math.floor(Math.min(...lats) - GRID_MARGIN),
    west: Math.floor(Math.min(...lons) - GRID_MARGIN),
    rows: 0,
    cols: 0,
  };
  grid.rows = Math.ceil((Math.max(...lats) + GRID_MARGIN - grid.south) / grid.latStep) + 1;
  grid.cols = Math.ceil((Math.max(...lons) + GRID_MARGIN - grid.west) / grid.lonStep) + 1;

  /* A coarse spatial index so the kernel is O(cells x local sites), not O(n^2). */
  const buckets = new Map();
  const bucketOf = (lat, lon) => `${Math.floor(lat / 2)}|${Math.floor(lon / 2)}`;
  for (const site of sites) {
    const key = bucketOf(site.latitude, site.longitude);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(site);
  }
  const bucketSpan = Math.ceil(METHODOLOGY.truncationKm / 111 / 2) + 1;
  const near = (lat, lon) => {
    const bi = Math.floor(lat / 2);
    const bj = Math.floor(lon / 2);
    const out = [];
    for (let di = -bucketSpan; di <= bucketSpan; di += 1) {
      /* One extra column each way: a degree of longitude is shorter than a
         degree of latitude everywhere north of the equator, so the same
         kilometre reach spans more columns than rows. */
      for (let dj = -bucketSpan - 1; dj <= bucketSpan + 1; dj += 1) {
        const found = buckets.get(`${bi + di}|${bj + dj}`);
        if (found) out.push(...found);
      }
    }
    return out;
  };

  const raw = [];
  for (let row = 0; row < grid.rows; row += 1) {
    const latitude = grid.south + row * grid.latStep;
    for (let col = 0; col < grid.cols; col += 1) {
      const longitude = grid.west + col * grid.lonStep;
      const answer = weightedValueAt(latitude, longitude, near(latitude, longitude), METHODOLOGY);
      if (answer) raw.push({ row, col, value: answer.value, sites: answer.sites });
    }
  }
  if (!raw.length) return null;

  const sorted = raw.map((cell) => cell.value).sort((a, b) => a - b);
  const ceiling = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * METHODOLOGY.ceilingQuantile))];

  return {
    schemaVersion: 1,
    id: `surface:bbs-${speciesId.replace("species:", "")}`,
    speciesId,
    metric: "RELATIVE_ABUNDANCE",
    unit: "birds detected per survey route",
    source: { ...RELEASE, aouCode: aou, sourceHashes },
    limitations: LIMITATIONS,
    observationPeriod: { from: `${WINDOW.from}-01-01`, through: `${WINDOW.through}-12-31` },
    methodology: METHODOLOGY,
    grid,
    ceiling: Number(ceiling.toFixed(6)),
    sitesSurveyed: sites.length,
    sitesDetected: detected,
    /* Parallel arrays: 25,000 cells as four flat lists rather than 25,000
       objects, which is a third of the bytes over the wire and slices by index
       without parsing a structure. Intensity is stored as an integer per mille
       so the artifact is stable across platforms — a float would re-serialize
       differently and make `--check` fail on nothing. */
    cells: {
      row: raw.map((cell) => cell.row),
      col: raw.map((cell) => cell.col),
      intensity: raw.map((cell) => Math.round(intensityOf(cell.value, ceiling, METHODOLOGY.transform) * 1000)),
      sites: raw.map((cell) => cell.sites),
    },
  };
}

/* ------------------------------------------------------------------- main */

const args = new Set(process.argv.slice(2));
const check = args.has("--check");
const reportOnly = args.has("--report");
const only = [...args].find((a) => a.startsWith("--species="))?.split("=")[1];

/*
 * `--fetch` makes `--check` DOWNLOAD and re-derive.
 *
 * Without it a check with no cache verifies structure only, which is the right
 * default for a developer gate and the wrong one for the daily source watch:
 * on a runner the cache is always absent, so the watch would have run the weak
 * check for ever while reporting that it had checked. The daily workflow passes
 * `--fetch`; a local run does not.
 */
const fetchSources = args.has("--fetch");
const missingCache = !existsSync(join(CACHE, "Routes.csv")) && !fetchSources;
if (missingCache && check) {
  /* A gate must not depend on a 150 MB download from a government host. With no
     cache, `--check` verifies what is committed against its own declared
     invariants, and says which check it ran so a reader is never told that the
     stronger one passed. */
  let checked = 0;
  for (const file of existsSync(OUT_DIR) ? readdirSync(OUT_DIR) : []) {
    if (!file.endsWith(".json")) continue;
    const surface = JSON.parse(readFileSync(join(OUT_DIR, file), "utf8"));
    const n = surface.cells.row.length;
    for (const key of ["col", "intensity", "sites"]) {
      if (surface.cells[key].length !== n) throw new Error(`${file}: cells.${key} has ${surface.cells[key].length} of ${n}`);
    }
    if (surface.cells.intensity.some((v) => v < 0 || v > 1000)) throw new Error(`${file}: intensity out of range`);
    if (surface.cells.row.some((r) => r < 0 || r >= surface.grid.rows)) throw new Error(`${file}: a row is outside the grid`);
    if (surface.cells.col.some((c) => c < 0 || c >= surface.grid.cols)) throw new Error(`${file}: a column is outside the grid`);
    if (surface.cells.sites.some((s) => s < surface.methodology.minimumSites)) throw new Error(`${file}: a cell is below the support rule`);
    checked += 1;
  }
  process.stdout.write(`bbs-surface --check: ${checked} artifact(s) structurally valid. Source cache absent, so values were NOT re-derived.\n`);
  process.exit(0);
}

const sourceHashes = await ensureCached();
process.stderr.write("reading the survey …\n");
const source = loadSource();

/*
 * The join key is the verified scientific name already in the Hunt species
 * catalogue. Nothing here types an AOU code, so a species cannot be attached to
 * the wrong bird by a transcription slip.
 *
 * THE UNIVERSE IS THE CATALOGUE, read from the published profiles, and not a
 * hand-kept list. It was `SUPPORTED_SPECIES` — 32 entries — so six species Hunt
 * publishes and this survey records could never receive a surface however good
 * the data. A registry certifies what a builder produced and is therefore blind
 * to a species the builder never considered, which is why no gate caught it.
 */
const matched = [];
const unmatched = [];
for (const species of catalogueSpecies().map(({ speciesId, scientificName, takeEligibility }) => ({ id: speciesId, scientificName, takeEligibility }))) {
  const bbs = source.species.get(species.scientificName.toLowerCase());
  if (bbs) matched.push({ ...species, ...bbs });
  else unmatched.push(species);
}

process.stdout.write(`\nBBS 2026 release · ${source.routes.size} routes · ${source.runs.size} surveyed ${WINDOW.from}-${WINDOW.through}\n`);
process.stdout.write(`${matched.length} Hunt species matched to a survey species; ${unmatched.length} not covered by this survey.\n\n`);

if (reportOnly) {
  for (const species of matched) {
    const { sites, detected } = sitesFor(species.aou, source);
    process.stdout.write(`  ${species.aou}  ${species.id.padEnd(40)} detected on ${String(detected).padStart(4)} of ${sites.length} surveyed routes\n`);
  }
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });
const registry = [];
const declined = [];
let built = 0;
let differed = 0;
for (const species of matched) {
  if (only && species.id !== only) continue;
  /* An ALLOWLIST, read from the catalogue before any evidence is looked at, so
     it never depends on sample size: whooping crane was once declined for route
     count, which is luck rather than a rule. A species gets a surface only if
     its eligibility grants one; a new protected species inherits the refusal
     without anyone editing a list. */
  if (!grantsHuntingOpportunity(species.takeEligibility)) {
    const isProtected = species.takeEligibility === "PROTECTED";
    process.stdout.write(`  SKIP  ${species.id} — ${species.takeEligibility}; never given a surface\n`);
    declined.push({
      speciesId: species.id,
      reason: isProtected ? "PROTECTED_NOT_HUNTED" : "ELIGIBILITY_UNVERIFIED",
      detail: isProtected
        ? "A species that must never be hunted gets no Species Heat surface. The layer answers where to look for this animal; for a protected bird that is a hunting aid."
        : "No authority North Ground has read establishes current take of this species, so it gets no Species Heat surface until one does.",
    });
    continue;
  }
  const surface = buildSurface(species.id, species.aou, source);
  if (!surface) {
    process.stdout.write(`  SKIP  ${species.id} — no supported cells\n`);
    continue;
  }
  /* A species detected on a handful of routes cannot support a continental
     surface, however good the licence. The threshold is the support rule's own
     minimum applied to the species rather than to a cell. */
  if (surface.sitesDetected < METHODOLOGY.minimumRoutesForSpecies) {
    process.stdout.write(`  SKIP  ${species.id} — detected on only ${surface.sitesDetected} routes; too thin to draw\n`);
    /* Declined species are RECORDED, not dropped. "This species has no surface"
       and "nobody looked at this species" are different answers, and the second
       is what silence says. */
    declined.push({
      speciesId: species.id,
      reason: "TOO_FEW_ROUTES",
      detail: `Detected on ${surface.sitesDetected} of ${surface.sitesSurveyed} routes, below the ${METHODOLOGY.minimumRoutesForSpecies} the methodology requires of a species.`,
    });
    continue;
  }
  const path = join(OUT_DIR, `${species.id.replace("species:", "")}.json`);
  const next = `${JSON.stringify(surface, null, 1)}\n`;
  if (check) {
    const current = existsSync(path) ? readFileSync(path, "utf8") : "";
    if (current !== next) {
      differed += 1;
      process.stdout.write(`  DIFFERS  ${path.replace(`${ROOT}/`, "")}\n`);
    }
  } else {
    writeFileSync(path, next);
  }
  /*
   * THE REGISTRY ENTRY, written beside the artifact it certifies.
   *
   * A surface becomes servable because it is here, not because a file sits in a
   * directory — the endpoint must not trust whatever it finds on disk, and a
   * generated artifact must become servable without anyone editing the
   * endpoint for its species. The hash is of the artifact as written, so a file
   * edited after certification stops matching and stops serving.
   */
  registry.push({
    speciesId: species.id,
    surfaceKind: "MODELLED_RASTER",
    artifactId: surface.id,
    artifactPath: `content/intelligence/surfaces/${species.id.replace("species:", "")}.json`,
    artifactHash: sha256(Buffer.from(next, "utf8")),
    sourceDatasetId: "dataset:na-bbs-2026-release",
    metric: surface.metric,
    unit: surface.unit,
    effectiveResolutionMetres: METHODOLOGY.bandwidthKm * 1000,
    effectiveResolutionStatedAs: `${METHODOLOGY.bandwidthKm} km Gaussian bandwidth over ${surface.sitesSurveyed} survey routes; the grid is sampled more finely than that and does not make it finer`,
    season: "June, during the breeding season",
    matchesHuntingSeason: false,
    tier: "T1_OFFICIAL_MEASURED",
    grade: "B",
    methodologyId: METHODOLOGY.id,
    methodologyVersion: METHODOLOGY.version,
    interpolationPermitted: true,
    coverage: "PARTIAL_DATA",
    unmappedGround: "NO_EVIDENCE_HELD",
    sitesSurveyed: surface.sitesSurveyed,
    sitesDetected: surface.sitesDetected,
    supportedCells: surface.cells.row.length,
    surveyedAndNoneFound: surface.cells.intensity.filter((v) => v === 0).length,
  });
  built += 1;
  const cells = surface.cells.row.length;
  const zero = surface.cells.intensity.filter((v) => v === 0).length;
  process.stdout.write(
    `  ${check ? "check" : "built"}  ${species.id.padEnd(38)} ${String(cells).padStart(6)} supported cells ` +
      `(${String(zero).padStart(6)} surveyed-and-none-found) · ${surface.sitesDetected}/${surface.sitesSurveyed} routes · ceiling ${surface.ceiling}\n`,
  );
}

const REGISTRY_PATH = join(ROOT, "content", "intelligence", "surface-registry.json");
const registryDocument = `${JSON.stringify({
  schemaVersion: 1,
  generatedBy: "scripts/build-bbs-surface.mjs",
  note:
    "Certified surfaces. The endpoint serves what is listed here and verifies each artifact's hash; a file in the surfaces directory that is not in this registry is not served, and one whose bytes have changed since certification stops serving.",
  surfaces: registry.sort((a, b) => a.speciesId.localeCompare(b.speciesId)),
  declined: declined.sort((a, b) => a.speciesId.localeCompare(b.speciesId)),
  unmatched: unmatched.map((s) => ({ speciesId: s.id, reason: "NOT_IN_SURVEY", detail: `${s.scientificName} is not a species the Breeding Bird Survey records.` })),
}, null, 2)}\n`;
if (check) {
  const current = existsSync(REGISTRY_PATH) ? readFileSync(REGISTRY_PATH, "utf8") : "";
  if (current !== registryDocument) {
    differed += 1;
    process.stdout.write("  DIFFERS  content/intelligence/surface-registry.json\n");
  }
} else {
  writeFileSync(REGISTRY_PATH, registryDocument);
}

if (check && differed) {
  /* Exit 2, the source watch's word for "a source moved and a human has to read
     the diff" — distinct from a failed read, which is exit 1. */
  process.stderr.write(`\nBreeding Bird Survey source changed: ${differed} surface(s) differ from what is committed. Re-run without --check to update.\n`);
  process.exit(2);
}
process.stdout.write(`\n${built} surface(s) ${check ? "checked" : "written"} to ${OUT_DIR.replace(`${ROOT}/`, "")}\n`);
