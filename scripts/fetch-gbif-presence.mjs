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
 * WHAT IT READS. GBIF's map API aggregates matching records into squares of
 * 0.3515625° (64 of 4,096 units in a zoom-3 EPSG:4326 tile, 22.5° wide).
 * Every tile over North America is read, and the square's own count kept.
 * Attribution: the datasets that contributed, with their record counts, so
 * every CC BY publisher can be credited.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readTile } from "./lib/mvt.mjs";
import { catalogueSpecies } from "../src/lib/hunt/intelligence/species-catalogue.ts";
import { surfaceRegistry } from "../src/lib/hunt/intelligence/surface.ts";

const args = process.argv.slice(2);
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : ".research/gbif";
const only = args.find((a) => a.startsWith("--species="))?.split("=")[1];
mkdirSync(OUT, { recursive: true });
const USER_AGENT = "NorthGroundBushcraft/1.0 (+https://www.northgroundbushcraft.com)";

const ZOOM = 3;
const TILE_DEGREES = 180 / 2 ** ZOOM;
const SQUARE_UNITS = 64;
const FILTER = [
  "country=CA", "country=US",
  "license=CC0_1_0", "license=CC_BY_4_0",
  "hasCoordinate=true", "hasGeospatialIssue=false", "occurrenceStatus=PRESENT", "year=2000,2026",
  "basisOfRecord=HUMAN_OBSERVATION", "basisOfRecord=PRESERVED_SPECIMEN", "basisOfRecord=MATERIAL_SAMPLE", "basisOfRecord=MACHINE_OBSERVATION", "basisOfRecord=OBSERVATION",
].join("&");

let last = 0;
async function get(url, as = "json") {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const wait = Math.max(0, last + 1100 - Date.now());
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    last = Date.now();
    try {
      const response = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(120_000) });
      if (response.status === 429 || response.status >= 500) throw Object.assign(new Error(`HTTP ${response.status}`), { retry: true });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return as === "json" ? await response.json() : Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt === 6) throw new Error(`${url.slice(0, 180)}: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, (error.retry ? 20_000 : 4_000) * attempt));
    }
  }
}

/* Tiles over Canada and the United States: lon -180..-45, lat 15..85. */
const tiles = [];
for (let x = Math.floor((-180 + 180) / TILE_DEGREES); x <= Math.floor((-45 + 180) / TILE_DEGREES); x += 1) {
  for (let y = Math.floor((90 - 85) / TILE_DEGREES); y <= Math.floor((90 - 15) / TILE_DEGREES); y += 1) tiles.push([x, y]);
}

const surfaced = new Set(surfaceRegistry().surfaces.map((entry) => entry.speciesId));
const wanting = catalogueSpecies().filter((s) => !surfaced.has(s.speciesId) && ["HUNTABLE", "REMOVAL"].includes(s.takeEligibility) && (!only || s.speciesId === only));
const datasetTitles = new Map();
const summary = [];
for (const species of wanting) {
  const match = await get(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(species.scientificName)}&strict=true`);
  const row = { speciesId: species.speciesId, scientificName: species.scientificName, usageKey: match.usageKey ?? null, matchType: match.matchType, rank: match.rank ?? null, status: match.status ?? null };
  if (!match.usageKey || match.matchType !== "EXACT") {
    writeFileSync(join(OUT, `${species.speciesId.replace("species:", "")}.json`), `${JSON.stringify({ ...row, refused: "no exact GBIF name match" })}\n`);
    summary.push({ ...row, squares: 0, records: 0 });
    continue;
  }
  const search = `https://api.gbif.org/v1/occurrence/search?taxonKey=${match.usageKey}&${FILTER}`;
  const facets = await get(`${search}&limit=0&facet=datasetKey&facetLimit=2000`);
  const datasets = (facets.facets?.[0]?.counts ?? []).map(({ name, count }) => ({ datasetKey: name, count }));
  const squares = [];
  for (const [x, y] of tiles) {
    const west = -180 + x * TILE_DEGREES;
    const north = 90 - y * TILE_DEGREES;
    const tile = readTile(await get(`https://api.gbif.org/v2/map/occurrence/adhoc/${ZOOM}/${x}/${y}.mvt?srs=EPSG:4326&bin=square&squareSize=${SQUARE_UNITS}&taxonKey=${match.usageKey}&${FILTER}`, "bytes"));
    for (const feature of tile) {
      const ring = feature.rings[0];
      if (!ring?.length || typeof feature.properties.total !== "number") continue;
      const xs = ring.map(([u]) => u);
      const ys = ring.map(([, v]) => v);
      const scale = TILE_DEGREES / feature.extent;
      squares.push([
        Number((west + Math.min(...xs) * scale).toFixed(6)),
        Number((north - Math.max(...ys) * scale).toFixed(6)),
        feature.properties.total,
      ]);
    }
  }
  const records = squares.reduce((sum, [, , total]) => sum + total, 0);
  writeFileSync(join(OUT, `${species.speciesId.replace("species:", "")}.json`), `${JSON.stringify({
    ...row, retrievedAt: new Date().toISOString().slice(0, 10), filter: FILTER, portalQuery: `https://www.gbif.org/occurrence/search?taxon_key=${match.usageKey}&${FILTER.toLowerCase()}`,
    squareDegrees: TILE_DEGREES * SQUARE_UNITS / 4096, openRecordCount: facets.count, datasets,
    columns: ["west", "south", "records"], squares,
  })}\n`);
  for (const { datasetKey } of datasets) datasetTitles.set(datasetKey, null);
  summary.push({ ...row, squares: squares.length, records, openRecordCount: facets.count, datasets: datasets.length });
  process.stdout.write(`${species.speciesId.padEnd(38)} ${String(facets.count).padStart(7)} open records · ${squares.length} squares · ${datasets.length} datasets\n`);
}

/* Who to credit: every contributing dataset's title and publisher. */
for (const key of datasetTitles.keys()) {
  try {
    const dataset = await get(`https://api.gbif.org/v1/dataset/${key}`);
    const publisher = dataset.publishingOrganizationKey ? await get(`https://api.gbif.org/v1/organization/${dataset.publishingOrganizationKey}`) : null;
    datasetTitles.set(key, { title: dataset.title, license: dataset.license, doi: dataset.doi ?? null, publisher: publisher?.title ?? null });
  } catch (error) {
    datasetTitles.set(key, { error: String(error.message).slice(0, 160) });
  }
}
writeFileSync(join(OUT, "_datasets.json"), `${JSON.stringify(Object.fromEntries(datasetTitles), null, 1)}\n`);
writeFileSync(join(OUT, "_summary.json"), `${JSON.stringify(summary, null, 1)}\n`);
