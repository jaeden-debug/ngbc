#!/usr/bin/env node
/**
 * Look before building: licences, file lists and response shapes of the
 * sources the next evidence layers would stand on. Writes what it saw; builds
 * nothing.
 *
 *   node scripts/probe-research-sources.mjs --out .research/probe
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readTile } from "./lib/mvt.mjs";
import { catalogueSpecies } from "../src/lib/hunt/intelligence/species-catalogue.ts";
import { permitsSpeciesHeat } from "../src/lib/content/species-eligibility.ts";
import { surfaceRegistry } from "../src/lib/hunt/intelligence/surface.ts";

const args = process.argv.slice(2);
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : ".research/probe";
mkdirSync(OUT, { recursive: true });
const USER_AGENT = "NorthGroundBushcraft/1.0 (+https://www.northgroundbushcraft.com)";
const get = async (url, as = "json") => {
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
  return as === "json" ? response.json() : as === "text" ? response.text() : Buffer.from(await response.arrayBuffer());
};
const save = (name, body) => writeFileSync(join(OUT, name), `${JSON.stringify(body, null, 2)}\n`);
const attempt = async (name, fn) => { try { save(name, await fn()); process.stdout.write(`ok   ${name}\n`); } catch (error) { save(name, { error: String(error.message ?? error) }); process.stdout.write(`FAIL ${name}: ${error.message}\n`); } };

/* 1. Land cover: the Copernicus Global Land Service 100 m map, its licence and files. */
await attempt("landcover-zenodo.json", async () => {
  const found = await get("https://zenodo.org/api/records?q=%22Copernicus%20Global%20Land%20Service%3A%20Land%20Cover%20100m%22&size=20&sort=mostrecent");
  return found.hits.hits.map((hit) => ({
    id: hit.id, doi: hit.doi, title: hit.metadata.title, license: hit.metadata.license, published: hit.metadata.publication_date,
    files: (hit.files ?? []).map((file) => ({ key: file.key, size: file.size, url: file.links?.self })),
  }));
});
await attempt("landcover-3939050.json", async () => {
  const record = await get("https://zenodo.org/api/records/3939050");
  return { title: record.metadata.title, license: record.metadata.license, doi: record.doi, files: (record.files ?? []).map((f) => ({ key: f.key, size: f.size, url: f.links?.self })) };
});
/* The terms page the collection points to, for the record. */
await attempt("landcover-terms.json", async () => ({ text: (await get("https://land.copernicus.eu/en/data-policy", "text")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 6000) }));

/* 2. GBIF: species keys for every catalogue species without a surface, and one sample of the map API. */
const surfaced = new Set(surfaceRegistry().surfaces.map((entry) => entry.speciesId));
const wanting = catalogueSpecies().filter((s) => !surfaced.has(s.speciesId) && permitsSpeciesHeat(s.speciesId));
await attempt("gbif-species.json", async () => {
  const rows = [];
  for (const species of wanting) {
    const match = await get(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(species.scientificName)}&strict=true`);
    let counts = null;
    if (match.usageKey) {
      const base = `https://api.gbif.org/v1/occurrence/search?taxonKey=${match.usageKey}&country=CA&country=US&hasCoordinate=true&hasGeospatialIssue=false&occurrenceStatus=PRESENT&year=2000,2026&limit=0`;
      const all = await get(base);
      const open = await get(`${base}&license=CC0_1_0&license=CC_BY_4_0`);
      counts = { all: all.count, openLicence: open.count };
    }
    rows.push({ speciesId: species.speciesId, scientificName: species.scientificName, match: { usageKey: match.usageKey, matchType: match.matchType, rank: match.rank, status: match.status, canonicalName: match.canonicalName }, counts });
  }
  return rows;
});
await attempt("gbif-licence-facet.json", async () => get("https://api.gbif.org/v1/occurrence/search?taxonKey=5219142&country=CA&country=US&hasCoordinate=true&limit=0&facet=license&facet=basisOfRecord&facet=datasetKey&facetLimit=15"));
for (const [label, url] of [
  ["gbif-adhoc-4326-z1", "https://api.gbif.org/v2/map/occurrence/adhoc/1/0/0.mvt?srs=EPSG:4326&taxonKey=5219142&country=CA&country=US&license=CC0_1_0&license=CC_BY_4_0&mode=GEO_CENTROID&squareSize=64&bin=square"],
  ["gbif-adhoc-4326-z2-bounds", "https://api.gbif.org/v2/map/occurrence/adhoc/2/0/0.mvt?srs=EPSG:4326&taxonKey=5219142&license=CC0_1_0&license=CC_BY_4_0&mode=GEO_BOUNDS"],
  ["gbif-density-4326-z2", "https://api.gbif.org/v2/map/occurrence/density/2/0/0.mvt?srs=EPSG:4326&taxonKey=5219142&bin=square&squareSize=32"],
]) {
  await attempt(`${label}.json`, async () => {
    const tile = readTile(await get(url, "bytes"));
    return { url, features: tile.length, layers: [...new Set(tile.map((f) => f.layer))], extent: tile[0]?.extent, sample: tile.slice(0, 6).map(({ type, properties, rings }) => ({ type, properties, rings: rings.map((ring) => ring.slice(0, 5)) })) };
  });
}
