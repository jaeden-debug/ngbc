#!/usr/bin/env node
/**
 * Where each species has been RECORDED, from openly licensed occurrence records
 * aggregated by GBIF. Reads counts per square; interprets nothing.
 *
 *   node scripts/fetch-gbif-presence.mjs --out .research/gbif [--species=species:coyote]
 *
 * WHICH RECORDS. Only records whose own licence permits commercial reuse:
 * CC0 1.0 and CC BY 4.0. The largest single source, iNaturalist, publishes
 * most of its observations under CC BY-NC; those are excluded, not
 * negotiated, which is why a species' open record count can be a quarter of
 * its total. Canada and the United States; 2000 onward; coordinates with no
 * geospatial issue flagged by GBIF; occurrence status PRESENT; human
 * observations, preserved specimens, material samples and machine
 * observations. Fossils and living specimens (zoos, collections) are
 * excluded because neither says an animal lives there now.
 *
 * WHAT IT READS. GBIF's ad-hoc map API aggregates matching records into a
 * grid of 16 × 16 cells per EPSG:4326 tile, whatever square size is asked
 * for, and draws each occupied cell as one square beside the cell's centre.
 * Established from the reads themselves: across every species read at zoom 3
 * (22.5° tiles), no 1.40625° cell ever held more than one square — house
 * sparrow's 14.8 million records came back as 763 squares, one per cell. The
 * first reads (before 2026-09-30's second pass) were therefore 1.40625° cells,
 * not the 0.35° squares they were taken for; `aggregationDegrees` now says
 * which a read is.
 *
 * So each species is read twice: a COARSE pass at zoom 3 over every tile of
 * North America, which finds the 1.40625° cells holding records, and a FINE
 * pass at zoom 5 (5.625° tiles) over only the tiles those cells fall in. At
 * zoom 5 GBIF aggregates at least as finely as 0.3515625° — the second pass
 * put more than one square in a 0.35° cell for 223 of 236 species — so every
 * square is filed under the 0.3515625° cell its centre lies in and the counts
 * of a cell's squares are added: North Ground claims 0.35°, never finer. The
 * two passes are separate queries of a live index, so the fine pass is
 * checked against the coarse one and any records it did not place are
 * recorded with the read.
 * Attribution: the datasets that contributed, with their record counts, so
 * every CC BY publisher can be credited.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readTile } from "./lib/mvt.mjs";
import { catalogueSpecies } from "../src/lib/hunt/intelligence/species-catalogue.ts";
import { surfaceRegistry } from "../src/lib/hunt/intelligence/surface.ts";
import { permitsSpeciesHeat } from "../src/lib/content/species-eligibility.ts";

const args = process.argv.slice(2);
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : ".research/gbif";
const only = args.find((a) => a.startsWith("--species="))?.split("=")[1]?.split(",").filter(Boolean);
/* A season window, for a species whose hunting-season range differs from its
   breeding range: `--months=9-12,1-2` keeps records from September to
   February. Months are GBIF's own range syntax, so the filter is the
   service's, not ours. */
const months = args.find((a) => a.startsWith("--months="))?.split("=")[1]?.split(",").filter(Boolean).map((range) => range.split("-").map(Number));
mkdirSync(OUT, { recursive: true });
const USER_AGENT = "NorthGroundBushcraft/1.0 (+https://www.northgroundbushcraft.com)";

const COARSE_ZOOM = 3;
const FINE_ZOOM = 5;
const SQUARE_UNITS = 64;
/* GBIF aggregates 16 × 16 cells per tile (see above). */
const CELLS_PER_TILE = 16;
const tileDegrees = (zoom) => 180 / 2 ** zoom;
const aggregationDegrees = (zoom) => tileDegrees(zoom) / CELLS_PER_TILE;
const FINE_DEGREES = aggregationDegrees(FINE_ZOOM);
const FILTER = [
  "country=CA", "country=US",
  "license=CC0_1_0", "license=CC_BY_4_0",
  "hasCoordinate=true", "hasGeospatialIssue=false", "occurrenceStatus=PRESENT", "year=2000,2026",
  "basisOfRecord=HUMAN_OBSERVATION", "basisOfRecord=PRESERVED_SPECIMEN", "basisOfRecord=MATERIAL_SAMPLE", "basisOfRecord=MACHINE_OBSERVATION", "basisOfRecord=OBSERVATION",
  ...(months ?? []).map(([from, to]) => `month=${from},${to ?? from}`),
].join("&");

let last = 0;
/* 429 and 5xx are the service asking us to wait; they are retried with a long
   pause. Any other refusal is an answer about the request, so it is retried
   once (in case it was a transient front-end fault) and then reported with
   the service's own words rather than retried until the run gives up. */
async function get(url, as = "json") {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    /* One request starts every 250 ms across every worker: at most four a
       second, whatever the service's latency. */
    const start = Math.max(Date.now(), last + 250);
    last = start;
    if (start > Date.now()) await new Promise((resolve) => setTimeout(resolve, start - Date.now()));
    let status = 0;
    try {
      const response = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(120_000) });
      status = response.status;
      if (status === 429 || status >= 500) throw Object.assign(new Error(`HTTP ${status}`), { retry: true });
      if (!response.ok) {
        const said = (await response.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 240);
        throw Object.assign(new Error(`HTTP ${status}${said ? `: ${said}` : ""}`), { status, refused: true });
      }
      return as === "json" ? await response.json() : Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt === 6 || (error.refused && attempt >= 2)) throw Object.assign(new Error(`${url.slice(0, 180)}: ${error.message}`), { status: error.status ?? status });
      await new Promise((resolve) => setTimeout(resolve, (error.retry ? 20_000 : 4_000) * attempt));
    }
  }
}

/* Coarse tiles over Canada and the United States: lon -180..-45, lat 15..85. */
const COARSE_DEGREES = tileDegrees(COARSE_ZOOM);
const tiles = [];
for (let x = Math.floor((-180 + 180) / COARSE_DEGREES); x <= Math.floor((-45 + 180) / COARSE_DEGREES); x += 1) {
  for (let y = Math.floor((90 - 85) / COARSE_DEGREES); y <= Math.floor((90 - 15) / COARSE_DEGREES); y += 1) tiles.push([x, y]);
}

/* Species with a measured survey surface already; recorded presence is read for the rest. */
const surfaced = new Set(surfaceRegistry().surfaces.filter((entry) => !["OCCURRENCE_RECORDS", "NORTH_GROUND_MODEL"].includes(entry.evidenceClass)).map((entry) => entry.speciesId));
/* The canonical eligibility decides which species may carry Species Heat (§16);
   this reader never redefines it. */
const wanting = catalogueSpecies().filter((s) => permitsSpeciesHeat(s.speciesId) && (only ? only.includes(s.speciesId) : !surfaced.has(s.speciesId)));

/* A species' other published scientific names, in its own profile's words:
   a genus moved (Neogale vison, once Neovison vison) or a spelling differs
   (Porphyrio martinicus / martinica). Tried in order after the catalogue name,
   so a name match is always one the profile itself records — never a guess. */
const scientificAliases = new Map();
for (const file of readdirSync("content/published").filter((f) => f.endsWith(".json"))) {
  const bundle = JSON.parse(readFileSync(join("content/published", file), "utf8"));
  for (const entity of bundle.entities ?? []) {
    const names = (entity.aliases ?? []).filter((alias) => alias.type === "scientific_name").map((alias) => alias.value);
    if (names.length) scientificAliases.set(entity.id, names);
  }
}
/* A name GBIF's backbone files the species under, DECLARED in its surface
   profile with the reason (content/intelligence/surface-profiles.json,
   `gbifName`). Tried after the profile's own names, never instead of them. */
const declaredGbif = new Map(
  Object.entries(JSON.parse(readFileSync("content/intelligence/surface-profiles.json", "utf8")).species)
    .filter(([, profile]) => profile.gbifName)
    .map(([speciesId, profile]) => [speciesId, profile.gbifName]),
);
const datasetTitles = new Map();
const summary = [];
async function readSpecies(species) {
  let match = null;
  let matchedName = species.scientificName;
  const declared = declaredGbif.get(species.speciesId);
  const names = [species.scientificName, ...(scientificAliases.get(species.speciesId) ?? []), declared?.name];
  for (const name of [...new Set(names.filter(Boolean))]) {
    const candidate = await get(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(name)}&strict=true`);
    if (candidate.usageKey && candidate.matchType === "EXACT") { match = candidate; matchedName = name; break; }
    match ??= candidate;
  }
  /* A usage key DECLARED in the profile, with its reason — for a species whose
     name GBIF's match service only offers fuzzily. Checked, never trusted: the
     key must be a species in the genus the catalogue names. */
  if ((!match?.usageKey || match.matchType !== "EXACT") && declared?.usageKey) {
    const usage = await get(`https://api.gbif.org/v1/species/${declared.usageKey}`);
    const genus = species.scientificName.split(" ")[0];
    if (usage.rank === "SPECIES" && String(usage.canonicalName ?? "").startsWith(`${genus} `)) {
      match = { usageKey: usage.key, matchType: "EXACT", rank: usage.rank, status: usage.taxonomicStatus, acceptedUsageKey: usage.acceptedKey };
      matchedName = usage.canonicalName;
    }
  }
  /* A SYNONYM's own key finds only the records filed under that exact name
     (mink under Neovison vison: 388, where beaver has 11,393). The same
     animal under another name is read as its accepted taxon — unless the
     profile declares NAMED_ONLY, because the accepted taxon is broader than
     this species (a lump, or a domestic form: GBIF files Capra aegagrus under
     the domestic goat). */
  const namedOnly = declared?.records === "NAMED_ONLY";
  const readAs = match?.status === "SYNONYM" && match.acceptedUsageKey && !namedOnly ? "ACCEPTED_TAXON" : "AS_MATCHED";
  if (readAs === "ACCEPTED_TAXON") match = { ...match, matchedUsageKey: match.usageKey, usageKey: match.acceptedUsageKey };
  const row = { speciesId: species.speciesId, scientificName: species.scientificName, matchedName, usageKey: match.usageKey ?? null, matchedUsageKey: match.matchedUsageKey ?? match.usageKey ?? null, readAs, matchType: match.matchType, rank: match.rank ?? null, status: match.status ?? null };
  if (!match.usageKey || match.matchType !== "EXACT") {
    writeFileSync(join(OUT, `${species.speciesId.replace("species:", "")}.json`), `${JSON.stringify({ ...row, refused: "no exact GBIF name match" })}\n`);
    summary.push({ ...row, squares: 0, records: 0 });
    return;
  }
  /* Further names DECLARED in the profile (`gbifName.alsoRead`), each read
     only under its own name: one animal filed under several names in the
     backbone (the mouflon complex). Every name must match exactly. Their
     records join this species' read; the profile's documented places decide
     which of them may draw a range. */
  const alsoRead = [];
  for (const name of declared?.alsoRead ?? []) {
    const extra = await get(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(name)}&strict=true`);
    if (extra.usageKey && extra.matchType === "EXACT") alsoRead.push({ name, usageKey: extra.usageKey });
    else alsoRead.push({ name, usageKey: null, refused: "no exact GBIF name match" });
  }
  const taxonKeys = [match.usageKey, ...alsoRead.filter((a) => a.usageKey).map((a) => a.usageKey)];
  const taxonQuery = taxonKeys.map((key) => `taxonKey=${key}`).join("&");
  const search = `https://api.gbif.org/v1/occurrence/search?${taxonQuery}&${FILTER}`;
  const facets = await get(`${search}&limit=0&facet=datasetKey&facetLimit=2000`);
  const datasets = (facets.facets?.[0]?.counts ?? []).map(({ name, count }) => ({ datasetKey: name, count }));
  /* A tile the service refuses is read again as its four children at the next
     zoom (its cells are then half the size, and are filed under the cell of
     the zoom being read). A child that is still refused is recorded as ground
     not read: the grid builder declines a species with any unread ground
     rather than draw it with a hole that would look like "no records". */
  const unread = [];
  const readPass = async (zoom, tileList) => {
    const cellDegrees = aggregationDegrees(zoom);
    const cells = new Map();
    let drawn = 0;
    const readSquares = async (z, x, y) => {
      const degrees = tileDegrees(z);
      const units = SQUARE_UNITS * 2 ** (z - zoom);
      const west = -180 + x * degrees;
      const north = 90 - y * degrees;
      const tile = readTile(await get(`https://api.gbif.org/v2/map/occurrence/adhoc/${z}/${x}/${y}.mvt?srs=EPSG:4326&bin=square&squareSize=${units}&${taxonQuery}&${FILTER}`, "bytes"));
      for (const feature of tile) {
        const ring = feature.rings[0];
        if (!ring?.length || typeof feature.properties.total !== "number") continue;
        const xs = ring.map(([u]) => u);
        const ys = ring.map(([, v]) => v);
        const scale = degrees / feature.extent;
        /* The drawn square's centre, filed under the aggregation cell it lies in. */
        const lon = west + ((Math.min(...xs) + Math.max(...xs)) / 2) * scale;
        const lat = north - ((Math.min(...ys) + Math.max(...ys)) / 2) * scale;
        const col = Math.floor((lon + 180) / cellDegrees);
        const row = Math.floor((90 - lat) / cellDegrees);
        const key = `${col}:${row}`;
        cells.set(key, (cells.get(key) ?? 0) + feature.properties.total);
        drawn += 1;
      }
    };
    for (const [x, y] of tileList) {
      try {
        await readSquares(zoom, x, y);
      } catch (error) {
        if (error.status !== 400) throw error;
        process.stdout.write(`  tile ${zoom}/${x}/${y} refused (${error.message.split(": ").slice(1).join(": ").slice(0, 160)}); reading its children\n`);
        for (const [cx, cy] of [[2 * x, 2 * y], [2 * x + 1, 2 * y], [2 * x, 2 * y + 1], [2 * x + 1, 2 * y + 1]]) {
          try {
            await readSquares(zoom + 1, cx, cy);
          } catch (childError) {
            unread.push({ tile: `${zoom + 1}/${cx}/${cy}`, reason: childError.message.split(": ").slice(1).join(": ").slice(0, 240) });
          }
        }
      }
    }
    const squares = [...cells].map(([key, total]) => {
      const [col, row] = key.split(":").map(Number);
      return [Number((-180 + col * cellDegrees).toFixed(7)), Number((90 - (row + 1) * cellDegrees).toFixed(7)), total];
    }).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    return { squares, drawn, cellDegrees };
  };
  /* Coarse: which 1.40625° cells hold records. Fine: only the tiles they fall in. */
  const coarse = await readPass(COARSE_ZOOM, tiles);
  const fineTiles = new Map();
  for (const [west, south] of coarse.squares) {
    const lon = west + coarse.cellDegrees / 2;
    const lat = south + coarse.cellDegrees / 2;
    const x = Math.floor((lon + 180) / tileDegrees(FINE_ZOOM));
    const y = Math.floor((90 - lat) / tileDegrees(FINE_ZOOM));
    fineTiles.set(`${x}:${y}`, [x, y]);
  }
  const fine = await readPass(FINE_ZOOM, [...fineTiles.values()]);
  const squares = fine.squares;
  const coarseRecords = coarse.squares.reduce((sum, [, , total]) => sum + total, 0);
  const records = squares.reduce((sum, [, , total]) => sum + total, 0);
  writeFileSync(join(OUT, `${species.speciesId.replace("species:", "")}.json`), `${JSON.stringify({
    ...row, retrievedAt: new Date().toISOString().slice(0, 10), filter: FILTER, portalQuery: `https://www.gbif.org/occurrence/search?${taxonKeys.map((key) => `taxon_key=${key}`).join("&")}&${FILTER.toLowerCase()}`,
    ...(alsoRead.length ? { alsoRead } : {}),
    aggregationDegrees: FINE_DEGREES, squareDegrees: FINE_DEGREES,
    aggregation: { coarseZoom: COARSE_ZOOM, fineZoom: FINE_ZOOM, coarseCells: coarse.squares.length, coarseRecords, fineTiles: fineTiles.size, drawnSquares: fine.drawn, cells: squares.length, placesEveryRecord: records === coarseRecords },
    openRecordCount: facets.count, datasets, months: months ?? null,
    columns: ["west", "south", "records"], squares, unreadTiles: unread,
  })}\n`);
  for (const { datasetKey } of datasets) datasetTitles.set(datasetKey, null);
  summary.push({ ...row, squares: squares.length, records, openRecordCount: facets.count, datasets: datasets.length });
  process.stdout.write(`${species.speciesId.padEnd(38)} ${String(facets.count).padStart(7)} open records · ${coarse.squares.length} coarse → ${squares.length} fine cells${records === coarseRecords ? "" : ` (${coarseRecords - records} records not placed)`} · ${datasets.length} datasets${unread.length ? ` · ${unread.length} tiles unread` : ""}\n`);
}

/* One species the service will not answer about must not cost every other
   species its read; it is written down with the service's reason. Three
   species are read at once, sharing the one request pace above. */
const queue = [...wanting];
async function worker() {
  for (let species = queue.shift(); species; species = queue.shift()) {
    try {
      await readSpecies(species);
    } catch (error) {
      const slug = species.speciesId.replace("species:", "");
      writeFileSync(join(OUT, `${slug}.json`), `${JSON.stringify({ speciesId: species.speciesId, scientificName: species.scientificName, refused: `read failed: ${String(error.message).slice(0, 300)}` })}\n`);
      summary.push({ speciesId: species.speciesId, scientificName: species.scientificName, failed: String(error.message).slice(0, 300) });
      process.stdout.write(`${species.speciesId.padEnd(38)} FAILED ${String(error.message).slice(0, 200)}\n`);
    }
  }
}
await Promise.all([worker(), worker(), worker()]);

/* Who to credit: every contributing dataset's title and publisher. */
const organizations = new Map();
const datasetQueue = [...datasetTitles.keys()].sort();
async function datasetWorker() {
  for (let key = datasetQueue.shift(); key; key = datasetQueue.shift()) {
    try {
      const dataset = await get(`https://api.gbif.org/v1/dataset/${key}`);
      const orgKey = dataset.publishingOrganizationKey;
      /* The lookup's promise is cached, so datasets of one publisher share one request. */
      if (orgKey && !organizations.has(orgKey)) organizations.set(orgKey, get(`https://api.gbif.org/v1/organization/${orgKey}`).catch(() => null));
      const publisher = orgKey ? await organizations.get(orgKey) : null;
      datasetTitles.set(key, { title: dataset.title, license: dataset.license, doi: dataset.doi ?? null, publisher: publisher?.title ?? null });
    } catch (error) {
      datasetTitles.set(key, { error: String(error.message).slice(0, 160) });
    }
  }
}
await Promise.all([datasetWorker(), datasetWorker(), datasetWorker()]);
/* A read of some species adds to what earlier reads recorded; it never erases
   another species' summary or the credit owed to its datasets. */
const priorTitles = existsSync(join(OUT, "_datasets.json")) ? JSON.parse(readFileSync(join(OUT, "_datasets.json"), "utf8")) : {};
const priorSummary = existsSync(join(OUT, "_summary.json")) ? JSON.parse(readFileSync(join(OUT, "_summary.json"), "utf8")) : [];
const readNow = new Set(summary.map((row) => row.speciesId));
writeFileSync(join(OUT, "_datasets.json"), `${JSON.stringify({ ...priorTitles, ...Object.fromEntries(datasetTitles) }, null, 1)}\n`);
writeFileSync(join(OUT, "_summary.json"), `${JSON.stringify([...priorSummary.filter((row) => !readNow.has(row.speciesId)), ...summary], null, 1)}\n`);
