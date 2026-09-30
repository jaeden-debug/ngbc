#!/usr/bin/env node
/**
 * Declares the spatial-strategy entry (family and planned evidence) for every
 * published species that has none yet. Existing entries are never touched: a
 * hand-refined plan outranks this default.
 *
 * Only the DECLARED half is written. What a species holds — a surface, plots,
 * zone evidence — is derived by src/lib/hunt/intelligence/spatial-strategy.ts
 * from the certified registries, so nothing here can make a species look
 * covered. A species whose take eligibility grants no hunting-opportunity layer
 * gets no plan at all, because a plan for one would be a plan for a hunting aid.
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const path = resolve(ROOT, "content/intelligence/spatial-strategy.json");
const declared = JSON.parse(await readFile(path, "utf8"));
const registry = JSON.parse(await readFile(resolve(ROOT, "content/intelligence/surface-registry.json"), "utf8"));
const declinedBySurvey = new Set(registry.declined.filter(({ reason }) => reason === "TOO_FEW_ROUTES").map(({ speciesId }) => speciesId));

/* Group lineage → evidence family, most specific first. */
const FAMILY = [
  ["species_group:sea-ducks", "SEA_DUCK"], ["species_group:ducks", "WATERFOWL"], ["species_group:geese", "WATERFOWL"], ["species_group:swans", "WATERFOWL"],
  ["species_group:ptarmigan", "ARCTIC_ALPINE_UPLAND_BIRD"], ["species_group:upland-game-birds", "OPEN_COUNTRY_UPLAND_BIRD"],
  ["species_group:murres", "SEABIRD"], ["species_group:cormorants", "SEABIRD"], ["species_group:unprotected-birds", "UNPROTECTED_BIRD"],
  ["species_group:raptors", "RAPTOR"], ["species_group:migratory-game-birds", "MIGRATORY_GAME_BIRD"],
  ["species_group:bears", "BEAR"], ["species_group:big-game", "UNGULATE"],
  ["species_group:furbearers", "PREDATOR_FURBEARER"], ["species_group:predators", "PREDATOR_FURBEARER"], ["species_group:small-game", "SMALL_GAME"],
  ["species_group:reptiles", "REPTILE"], ["species_group:amphibians", "AMPHIBIAN"],
];
const PLANS = {
  bbs: { strategy: "B_MEASURED_DISTRIBUTION", status: "IN_RESEARCH", plan: "The Breeding Bird Survey does not carry this species far enough to map (see the surface registry for why). No other survey mapping it finer than a jurisdiction has been checked yet." },
  none: { strategy: "C_HABITAT_MODEL", status: "IN_RESEARCH", plan: "No authority survey that maps this species finer than a jurisdiction has been found. A habitat model needs independent evidence to validate it against, and North Ground does not yet hold any for this species." },
};
const GRANTS_LAYER = new Set(["HUNTABLE", "NUISANCE_OR_INVASIVE_TAKE"]);

let added = 0;
for (const file of (await readdir(resolve(ROOT, "content/published"))).filter((name) => name.startsWith("species-wave") || name === "en-CA.json")) {
  const bundle = JSON.parse(await readFile(resolve(ROOT, "content/published", file), "utf8"));
  for (const resource of bundle.resources.filter((item) => item.type === "species")) {
    const { speciesId, speciesGroupIds, takeEligibility } = resource.speciesProfile;
    if (declared.species[speciesId]) continue;
    const family = FAMILY.find(([group]) => speciesGroupIds.includes(group))?.[1];
    if (!family) throw new Error(`${speciesId}: no evidence family for groups ${speciesGroupIds.join(", ")}`);
    const next = !GRANTS_LAYER.has(takeEligibility) ? [] : declinedBySurvey.has(speciesId) ? [PLANS.bbs] : [PLANS.none];
    declared.species[speciesId] = { family, next };
    added += 1;
  }
}
declared.species = Object.fromEntries(Object.entries(declared.species).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(path, `${JSON.stringify(declared, null, 2)}\n`);
console.log(`spatial-strategy.json: ${added} species declared`);
