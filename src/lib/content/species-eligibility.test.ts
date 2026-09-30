import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { CanonicalId } from "../content-contract/index.ts";
import { zoneIsGreen } from "../hunt/exploration/species-layer.ts";
import { zoneStatesForSpecies } from "../hunt/exploration/zone-summary.ts";
import { heatMethodology, opportunityAcross } from "../hunt/intelligence/bundles.ts";
import { catalogueSpecies } from "../hunt/intelligence/species-catalogue.ts";
import { hasCertifiedSurface, servableSurfaceEntries, speciesSurfaces } from "../hunt/intelligence/surface.ts";
import { contentRepository } from "./repository.ts";
import {
  capabilitiesOf,
  eligibilityFromBundles,
  offeredAsQuarry,
  offeredInHunt,
  permitsSpeciesHeat,
  SPECIES_TAKE_ELIGIBILITY,
  takeEligibilityOf,
} from "./species-eligibility.ts";
import { takeListingsFor } from "./species-take-evidence.ts";

/**
 * Conservation status, take eligibility and legality are three questions
 * (owner ruling 2026-09-30; CLAUDE.md §16). Trumpeter swan broke the model that
 * merged the first two: it is protected in several states and taken under a
 * quota in Nevada. These tests hold each question to its own evidence.
 */

const species = (id: string) => id as CanonicalId<"species">;
const bundle = (speciesId: string, takeEligibility?: string) => ({
  resources: [{ type: "species", speciesProfile: { speciesId, ...(takeEligibility ? { takeEligibility } : {}) } }],
});
/* Served zones in three jurisdictions with certified rules. */
const SERVED_ZONES = [
  { layerId: "layer:ca-on-wmu", designation: "57" },
  { layerId: "layer:ca-ab-wmu", designation: "322" },
  { layerId: "layer:ca-mb-gha", designation: "26" },
];

test("every published species declares an eligibility, and the two readers agree", () => {
  const catalogue = catalogueSpecies();
  assert.equal(SPECIES_TAKE_ELIGIBILITY.size, catalogue.length);
  for (const { speciesId, takeEligibility } of catalogue) assert.equal(takeEligibilityOf(speciesId), takeEligibility, speciesId);
});

test("a profile without a valid eligibility fails the load rather than defaulting to game", () => {
  assert.throws(() => eligibilityFromBundles([bundle("species:new-bird")]), /no take eligibility/);
  assert.throws(() => eligibilityFromBundles([bundle("species:new-bird", "PROTECTED")]), /no take eligibility/);
  assert.equal(takeEligibilityOf("species:never-published"), "UNKNOWN");
  assert.equal(offeredInHunt("species:never-published"), false);
});

test("trumpeter swan keeps its protection record and is LIMITED_TAKE", async () => {
  assert.equal(takeEligibilityOf("species:trumpeter-swan"), "LIMITED_TAKE");
  const swan = await contentRepository.getResource("species:trumpeter-swan" as CanonicalId<"species">);
  const statuses = (swan as { speciesProfile: { conservationStatus?: Array<{ status: string; jurisdictionIds: string[] }> } }).speciesProfile.conservationStatus ?? [];
  assert.ok(statuses.some(({ status, jurisdictionIds }) => status === "PROTECTED" && jurisdictionIds.includes("jurisdiction:us-wy")));
  assert.ok(statuses.some(({ status, jurisdictionIds }) => status === "CLOSED_TO_TAKE" && jurisdictionIds.includes("jurisdiction:us-ut")));
});

test("Nevada establishes trumpeter take, with its quota, and no other jurisdiction inherits it", () => {
  const listings = takeListingsFor("species:trumpeter-swan");
  assert.deepEqual(listings.map(({ jurisdictionId }) => jurisdictionId), ["jurisdiction:us-nv"]);
  assert.match(listings[0].conditions?.join(" ") ?? "", /10 trumpeter swans/);
});

test("a generic group season does not legalize every member: Idaho's swan hunt is not trumpeter take", () => {
  const rows = readFileSync("research/hunting/species-take-matrix.csv", "utf8").split("\n");
  const idaho = rows.filter((line) => line.startsWith("us-id,") && line.includes("species:trumpeter-swan"));
  assert.ok(idaho.length > 0, "the Idaho swan group row is in the matrix (positive control)");
  assert.ok(idaho.every((line) => line.includes(",N,FINDING_NOT_ESTABLISHED,")), idaho.join("\n"));
  /* while the species the group really targets is listed */
  assert.ok(takeListingsFor("species:tundra-swan").some(({ jurisdictionId }) => jurisdictionId === "jurisdiction:us-id"));
});

test("a LIMITED_TAKE species gets no green outline without a certified rule", async () => {
  const states = await zoneStatesForSpecies(species("species:trumpeter-swan"), "2026-11-01", SERVED_ZONES);
  assert.equal(states.length, SERVED_ZONES.length);
  for (const state of states) assert.equal(zoneIsGreen(state), false, `${state.layerId} ${state.designation}`);
});

test("take eligibility alone does not make a zone green: a huntable species with no rules here is not open", async () => {
  assert.equal(takeEligibilityOf("species:american-alligator"), "HUNTABLE");
  const states = await zoneStatesForSpecies(species("species:american-alligator"), "2026-09-15", SERVED_ZONES);
  for (const state of states) {
    assert.equal(zoneIsGreen(state), false);
    assert.notEqual(state.state, "CLOSED", "no rule is UNKNOWN or NOT_CERTIFIED, never CLOSED");
  }
});

test("conservation status is not an input to eligibility or its capabilities", () => {
  /* The capability table is keyed by class alone: a protected species classed
     HUNTABLE would be offered, and a species with no protection classed
     NON_QUARRY would not — status is never consulted. */
  assert.equal(capabilitiesOf("HUNTABLE").offeredInHunt, true);
  assert.equal(capabilitiesOf("NON_QUARRY").offeredInHunt, false);
  assert.equal(takeEligibilityOf("species:trumpeter-swan"), "LIMITED_TAKE", "protected in Wyoming, still limited take");
  assert.equal(offeredInHunt("species:trumpeter-swan"), true);
  assert.equal(permitsSpeciesHeat("species:trumpeter-swan"), false, "no continental where-to-look map for a quota species");
});

test("the classification the evidence supports", () => {
  for (const id of ["species:wild-boar", "species:burmese-python", "species:nutria"]) assert.equal(takeEligibilityOf(id), "NUISANCE_OR_INVASIVE_TAKE", id);
  for (const id of ["species:american-alligator", "species:sandhill-crane", "species:tundra-swan", "species:greater-sage-grouse"]) assert.equal(takeEligibilityOf(id), "HUNTABLE", id);
  for (const id of ["species:whooping-crane", "species:gunnison-sage-grouse", "species:stellers-eider", "species:spectacled-eider"]) assert.equal(takeEligibilityOf(id), "NON_QUARRY", id);
  for (const id of ["species:wild-boar", "species:american-alligator", "species:burmese-python"]) assert.equal(offeredInHunt(id), true, id);
});

test("house mouse, rats, voles, pocket gophers, moles and feral cats stay excluded despite unprotected status", () => {
  const exclusions = readFileSync("research/hunting/take-exclusions.csv", "utf8");
  for (const name of ["Mus musculus", "Rattus norvegicus", "Microtus pennsylvanicus", "Thomomys talpoides", "Scapanus orarius", "Felis catus", "Bos taurus"]) {
    assert.match(exclusions, new RegExp(`^${name},`, "m"), name);
  }
  const published = new Set(catalogueSpecies().map(({ scientificName }) => scientificName.toLowerCase()));
  for (const name of ["mus musculus", "rattus norvegicus", "felis catus"]) assert.ok(!published.has(name), name);
});

test("a new NON_QUARRY species inherits every refusal without editing any list", () => {
  const eligibility = eligibilityFromBundles([bundle("species:new-bird", "NON_QUARRY"), bundle("species:new-game-bird", "HUNTABLE"), bundle("species:new-quota-bird", "LIMITED_TAKE")]);
  const heat = (id: string) => capabilitiesOf(eligibility.get(id) ?? "UNKNOWN").speciesHeat;
  assert.deepEqual(
    servableSurfaceEntries([{ speciesId: "species:new-bird" }, { speciesId: "species:new-game-bird" }, { speciesId: "species:new-quota-bird" }], heat).map(({ speciesId }) => speciesId),
    ["species:new-game-bird"],
  );
  const resources = [
    { type: "species", speciesProfile: { speciesId: "species:whooping-crane" } },
    { type: "species", speciesProfile: { speciesId: "species:ruffed-grouse" } },
  ];
  assert.deepEqual(offeredAsQuarry(resources).map((resource) => resource.speciesProfile.speciesId), ["species:ruffed-grouse"]);
});

test("the registry, the surface API and the heat evidence refuse every species whose class grants no heat", () => {
  const registry = JSON.parse(readFileSync("content/intelligence/surface-registry.json", "utf8")) as { surfaces: Array<{ speciesId: string }> };
  assert.ok(registry.surfaces.length > 0, "an empty registry would pass vacuously");
  const refused = [...SPECIES_TAKE_ELIGIBILITY].filter(([, eligibility]) => !capabilitiesOf(eligibility).speciesHeat).map(([id]) => id);
  assert.ok(refused.includes("species:trumpeter-swan") && refused.includes("species:whooping-crane"));
  for (const id of refused) {
    assert.ok(!registry.surfaces.some((entry) => entry.speciesId === id), `${id} has a committed surface`);
    assert.equal(hasCertifiedSurface(id), false, id);
    assert.deepEqual(speciesSurfaces(id).surfaces, [], id);
    assert.deepEqual(opportunityAcross(id, ["management_zone:ca-on-wmu-57"]), [], id);
    assert.equal(heatMethodology(id), null, id);
  }
  assert.ok(hasCertifiedSurface(registry.surfaces[0].speciesId), "positive control: a served species still answers");
});
