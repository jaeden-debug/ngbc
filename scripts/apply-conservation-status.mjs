#!/usr/bin/env node
/**
 * Writes each species' CONSERVATION STATUS from research/hunting/conservation-status.csv
 * onto its published profile, with a source per statement.
 *
 * Conservation status is one of three independent questions (CLAUDE.md §16):
 * it says what an authority calls the animal's protection or listing, where.
 * It never decides take eligibility and never decides legality — trumpeter swan
 * is protected in Wyoming and taken under a quota in Nevada, and both are true.
 * Only what a source states is written; a status is never inferred. Idempotent;
 * run after the wave builders.
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const BUNDLES = ["en-CA", "species-wave-1", "species-wave-2a", "species-wave-2b", "species-wave-2c", "species-wave-2d", "species-wave-3a", "species-wave-3b", "species-wave-3c", "species-wave-4a", "species-wave-4b", "species-wave-4c"];
const STATUSES = new Set(["ENDANGERED", "THREATENED", "SPECIAL_CONCERN", "PROTECTED", "CLOSED_TO_TAKE"]);

function parseCsv(input) {
  const rows = []; let row = [], cell = "", quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"') { if (quoted && input[i + 1] === '"') { cell += '"'; i += 1; } else quoted = !quoted; }
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if (char === "\n" && !quoted) { row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [headers, ...records] = rows;
  return records.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

const rows = parseCsv(await readFile(resolve(ROOT, "research/hunting/conservation-status.csv"), "utf8"));

/* Federal Endangered/Threatened listings from the committed ECOS snapshot
   (research/hunting/esa-listings.json). A listing of the species itself, of a
   subspecies or of a distinct population segment is written with its exact
   entity, so "Key deer is endangered" never reads as "white-tailed deer is". */
const esa = JSON.parse(await readFile(resolve(ROOT, "research/hunting/esa-listings.json"), "utf8"));
const binomial = (name) => name.trim().toLowerCase().split(/\s+/).slice(0, 2).join(" ");
const esaByBinomial = new Map();
for (const listing of esa.listings) {
  const key = binomial(listing.scientificName);
  esaByBinomial.set(key, [...(esaByBinomial.get(key) ?? []), listing]);
}
const isoDate = (us) => { const [m, d, y] = us.split("-"); return `${y}-${m}-${d}`; };
function esaStatements(scientificName) {
  return (esaByBinomial.get(binomial(scientificName)) ?? []).map((listing) => {
    const infra = listing.scientificName.trim().split(/\s+/).length > 2;
    const entity = listing.entity && listing.entity !== "Wherever found" ? `, ${listing.entity}` : "";
    const who = infra ? `${listing.commonName} (${listing.scientificName})${entity}` : entity ? `The ${listing.commonName.toLowerCase()}${entity}` : `The ${listing.commonName.toLowerCase()}, wherever found`;
    return {
      species_id: null, status: listing.status.toUpperCase(), jurisdiction_ids: "jurisdiction:us-federal",
      text: `${who}: listed as ${listing.status.toLowerCase()} under the Endangered Species Act since ${isoDate(listing.listed)}.`,
      source_authority: "U.S. Fish and Wildlife Service", source_title: `ECOS species profile: ${listing.commonName}`, source_url: listing.url, reviewed: "2026-09-30",
    };
  });
}
const bySpecies = new Map();
for (const row of rows) {
  if (!STATUSES.has(row.status)) throw new Error(`${row.species_id}: unknown conservation status ${row.status}`);
  if (!row.source_url) throw new Error(`${row.species_id}: a conservation status needs its source`);
  bySpecies.set(row.species_id, [...(bySpecies.get(row.species_id) ?? []), row]);
}

const applied = new Set();
for (const name of BUNDLES) {
  const path = resolve(ROOT, `content/published/${name}.json`);
  const bundle = JSON.parse(await readFile(path, "utf8"));
  bundle.sources = bundle.sources.filter((source) => !source.id.startsWith("source:conservation-"));
  for (const resource of bundle.resources.filter((item) => item.type === "species")) {
    const statements = [...(bySpecies.get(resource.id) ?? []), ...esaStatements(resource.speciesProfile.scientificName)];
    delete resource.speciesProfile.conservationStatus;
    resource.speciesProfile.sourceIds = resource.speciesProfile.sourceIds.filter((id) => !id.startsWith("source:conservation-"));
    if (!statements.length) continue;
    resource.speciesProfile.conservationStatus = statements.map((row, index) => {
      const id = `source:conservation-${resource.slug}-${index + 1}`;
      bundle.sources.push({ id, authority: row.source_authority, title: row.source_title, url: row.source_url, publisher: row.source_authority, retrievedAt: `${row.reviewed}T12:00:00Z`, type: "official", verificationStatus: "verified" });
      return { status: row.status, jurisdictionIds: row.jurisdiction_ids.split("|"), text: row.text, sourceIds: [id] };
    });
    applied.add(resource.id);
  }
  await writeFile(path, `${JSON.stringify(bundle, null, 2)}\n`);
}
const missing = [...bySpecies.keys()].filter((id) => !applied.has(id));
if (missing.length) throw new Error(`conservation status for unpublished species: ${missing.join(", ")}`);
console.log(`conservation status applied to ${applied.size} species`);
