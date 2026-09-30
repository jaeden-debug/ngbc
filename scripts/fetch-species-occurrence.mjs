#!/usr/bin/env node
/**
 * Where each catalogue species occurs, by state and province, from NatureServe
 * Explorer's own taxon records — read live, stored as DERIVED FACTS only
 * (CLAUDE.md §44): the jurisdiction code, whether the population is native or
 * exotic, and its subnational rank, with the record's URL. Nothing else from
 * the record is kept.
 *
 * WHY. A group season ("Rattlesnakes (Crotalus)", "Ducks") legally covers every
 * member occurring in the jurisdiction. Attributing it to a member that does
 * not occur there would publish a take listing for an animal the authority
 * could never have meant — Arizona's rattlesnake rule is not a listing for the
 * eastern diamondback. Occurrence is what makes group attribution safe, and it
 * is what lets the coverage matrix say OUTSIDE_SUPPORTED_RANGE on evidence.
 *
 * The record is matched by exact scientific name (or a recorded synonym); a
 * search that returns another species is refused, never accepted.
 *
 *   node scripts/fetch-species-occurrence.mjs [--only species:slug]
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = resolve(ROOT, "research/hunting/species-occurrence.json");
const API = "https://explorer.natureserve.org/api/data";
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;

/* NatureServe's subnation codes → North Ground jurisdiction ids. */
const CA = { AB: "ca-ab", BC: "ca-bc", MB: "ca-mb", NB: "ca-nb", NL: "ca-nl", LB: "ca-nl", NF: "ca-nl", NS: "ca-ns", NT: "ca-nt", NU: "ca-nu", ON: "ca-on", PE: "ca-pe", QC: "ca-qc", SK: "ca-sk", YT: "ca-yt" };
const US = new Set("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" "));

const catalogue = [];
for (const file of (await readdir(resolve(ROOT, "content/published"))).filter((name) => name.startsWith("species-wave") || name === "en-CA.json")) {
  for (const resource of JSON.parse(await readFile(resolve(ROOT, "content/published", file), "utf8")).resources ?? []) {
    if (resource.type === "species") catalogue.push({ id: resource.speciesProfile.speciesId, scientificName: resource.speciesProfile.scientificName });
  }
}

const existing = JSON.parse(await readFile(OUT, "utf8").catch(() => '{"species":{}}'));
const binomial = (name) => name.trim().toLowerCase().split(/\s+/).slice(0, 2).join(" ");
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function json(url, init) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, { ...init, headers: { "content-type": "application/json", accept: "application/json", ...(init?.headers ?? {}) } }).catch(() => null);
    if (response?.ok) return response.json();
    await sleep(1500 * (attempt + 1));
  }
  return null;
}

/* Current NatureServe names for catalogue binomials that follow another
   authority. A naming difference only; the record must still match one of them. */
const NATURESERVE_NAMES = {
  "Bison bison": ["Bos bison"], "Pecari tajacu": ["Dicotyles tajacu"],
  "Hyla cinerea": ["Dryophytes cinereus"], "Hyla gratiosa": ["Dryophytes gratiosus"], "Hyla squirella": ["Dryophytes squirellus"],
  "Hyla avivoca": ["Dryophytes avivoca"], "Hyla chrysoscelis": ["Dryophytes chrysoscelis"], "Hyla versicolor": ["Dryophytes versicolor"],
  "Hyla femoralis": ["Dryophytes femoralis"], "Hyla arenicolor": ["Dryophytes arenicolor"],
  "Coluber flagellum": ["Masticophis flagellum"], "Coluber taeniatus": ["Masticophis taeniatus"], "Coluber lateralis": ["Masticophis lateralis"],
  "Porphyrio martinicus": ["Porphyrio martinica"], "Chionactis occipitalis": ["Sonora occipitalis"], "Regina rigida": ["Liodytes rigida"],
  "Virginia striatula": ["Haldea striatula"], "Thamnophis sauritus": ["Thamnophis saurita"], "Urosaurus nigricaudus": ["Urosaurus microscutatus"],
  "Kinosternon arizonense": ["Kinosternon stejnegeri"],
  "Dasypus novemcinctus": ["Dasypus mexicanus"], "Brachylagus idahoensis": ["Sylvilagus idahoensis"],
};
/* Records NatureServe's search does not return by name (its quick search for
   Gulo gulo answers with other taxa); pinned by the id a researcher verified. */
const NATURESERVE_IDS = { "Gulo gulo": "103092" };

async function recordFor(scientificName) {
  for (const name of [scientificName, ...(NATURESERVE_NAMES[scientificName] ?? [])]) {
    const found = await recordForName(name);
    if (found) return found;
  }
  return null;
}

async function recordForName(scientificName) {
  if (NATURESERVE_IDS[scientificName]) {
    const taxon = await json(`${API}/taxon/ELEMENT_GLOBAL.2.${NATURESERVE_IDS[scientificName]}`);
    if (taxon && binomial(taxon.scientificName ?? "") === binomial(scientificName)) return { taxon, url: `https://explorer.natureserve.org/Taxon/ELEMENT_GLOBAL.2.${NATURESERVE_IDS[scientificName]}` };
    return null;
  }
  const search = await json(`${API}/speciesSearch`, {
    method: "POST",
    body: JSON.stringify({ criteriaType: "species", textCriteria: [{ paramType: "quickSearch", searchToken: scientificName }], pagingOptions: { page: 0, recordsPerPage: 20 } }),
  });
  const hit = (search?.results ?? []).find((result) => binomial(result.scientificName ?? "") === binomial(scientificName) && /SPECIES/i.test(result.speciesGlobal?.taxlevel ?? result.recordType ?? "SPECIES"));
  if (!hit?.elementGlobalId) return null;
  const taxon = await json(`${API}/taxon/ELEMENT_GLOBAL.2.${hit.elementGlobalId}`);
  if (!taxon || binomial(taxon.scientificName ?? "") !== binomial(scientificName)) return null;
  return { taxon, url: `https://explorer.natureserve.org/Taxon/ELEMENT_GLOBAL.2.${hit.elementGlobalId}` };
}

let fetched = 0, missing = 0;
for (const species of catalogue.sort((a, b) => a.id.localeCompare(b.id))) {
  if (only && species.id !== only) continue;
  if (!only && existing.species[species.id]?.status === "FOUND") continue;
  const record = await recordFor(species.scientificName);
  if (!record) {
    existing.species[species.id] = { status: "NOT_FOUND", scientificName: species.scientificName, retrievedAt: new Date().toISOString().slice(0, 10) };
    missing += 1;
    continue;
  }
  const jurisdictions = {};
  for (const national of record.taxon.elementNationals ?? []) {
    const country = national.nation?.isoCode;
    for (const sub of national.elementSubnationals ?? []) {
      const code = sub.subnation?.subnationCode;
      const id = country === "CA" ? CA[code] : country === "US" && US.has(code) ? `us-${code.toLowerCase()}` : null;
      if (!id) continue;
      const rank = sub.roundedSRank ?? sub.srank ?? null;
      jurisdictions[`jurisdiction:${id}`] = {
        native: sub.speciesSubnational?.native ?? null,
        exotic: sub.speciesSubnational?.exotic ?? null,
        rank,
        /* SX = presumed extirpated, SH = possibly extirpated: not a current population. */
        present: !/^S[XH]/.test(rank ?? ""),
      };
    }
  }
  existing.species[species.id] = { status: "FOUND", scientificName: species.scientificName, source: record.url, retrievedAt: new Date().toISOString().slice(0, 10), jurisdictions };
  fetched += 1;
  await sleep(250);
}

existing.source = "NatureServe Explorer taxon records (explorer.natureserve.org), subnational distribution — derived facts only";
existing.species = Object.fromEntries(Object.entries(existing.species).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(OUT, `${JSON.stringify(existing, null, 1)}\n`);
console.log(`occurrence: ${fetched} fetched, ${missing} not found, ${Object.keys(existing.species).length} total`);
