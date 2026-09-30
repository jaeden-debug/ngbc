#!/usr/bin/env node
/**
 * What production actually serves for every catalogue species, recorded so the
 * readiness report's PRODUCTION_VERIFIED stage is a measurement, not a belief.
 *
 * Per species: the profile page's HTTP status, and whether the Hunt picker in
 * the served /hunt HTML carries it. A species Hunt must not offer (NON_QUARRY,
 * UNKNOWN) passes only when the picker does NOT carry it.
 *
 *   node scripts/verify-species-production.mjs [--base https://www.northgroundbushcraft.com]
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = resolve(ROOT, "research/hunting/species-production-verification.json");
const base = process.argv.includes("--base") ? process.argv[process.argv.indexOf("--base") + 1] : "https://www.northgroundbushcraft.com";
const OFFERED = new Set(["HUNTABLE", "LIMITED_TAKE", "NUISANCE_OR_INVASIVE_TAKE"]);

const species = [];
for (const file of (await readdir(resolve(ROOT, "content/published"))).filter((name) => name.startsWith("species-wave") || name === "en-CA.json")) {
  for (const resource of JSON.parse(await readFile(resolve(ROOT, "content/published", file), "utf8")).resources ?? []) {
    if (resource.type === "species") species.push({ id: resource.speciesProfile.speciesId, slug: resource.slug, eligibility: resource.speciesProfile.takeEligibility });
  }
}

const hunt = await fetch(`${base}/hunt`, { headers: { "accept-encoding": "gzip" } });
const huntHtml = await hunt.text();
const deployment = hunt.headers.get("x-vercel-id") ?? null;

const results = {};
let cursor = 0;
async function worker() {
  while (cursor < species.length) {
    const item = species[cursor++];
    let pageStatus = null;
    for (let attempt = 0; attempt < 3 && pageStatus === null; attempt += 1) {
      pageStatus = await fetch(`${base}/hunting/species/${item.slug}`, { method: "GET", redirect: "manual" }).then((response) => response.status).catch(() => null);
    }
    /* The picker's packed tuple opens with the species id. */
    const inPicker = huntHtml.includes(`[\\"${item.id}\\",`) || huntHtml.includes(`["${item.id}",`);
    const offered = OFFERED.has(item.eligibility);
    results[item.id] = { pageStatus, inPicker, pickerCorrect: inPicker === offered };
  }
}
await Promise.all(Array.from({ length: 8 }, worker));

const values = Object.values(results);
const summary = {
  species: values.length,
  pagesOk: values.filter((row) => row.pageStatus === 200).length,
  pickerCorrect: values.filter((row) => row.pickerCorrect).length,
};
await writeFile(OUT, `${JSON.stringify({ base, checkedAt: new Date().toISOString(), huntStatus: hunt.status, deployment, summary, species: Object.fromEntries(Object.entries(results).sort(([a], [b]) => a.localeCompare(b))) }, null, 1)}\n`);
console.log(JSON.stringify(summary));
for (const [id, row] of Object.entries(results)) if (row.pageStatus !== 200 || !row.pickerCorrect) console.log("FAIL", id, JSON.stringify(row));
