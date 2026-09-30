import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { catalogueSpecies } from "../hunt/intelligence/species-catalogue.ts";
import { servableSurfaceEntries, speciesSurfaces, hasCertifiedSurface } from "../hunt/intelligence/surface.ts";
import { opportunityAcross, heatMethodology } from "../hunt/intelligence/bundles.ts";
import {
  eligibilityFromBundles,
  grantsHuntingOpportunity,
  offeredAsQuarry,
  permitsHuntingOpportunity,
  SPECIES_TAKE_ELIGIBILITY,
  takeEligibilityOf,
} from "./species-eligibility.ts";

/**
 * Trumpeter swan reached production with a "where to look for this animal" layer
 * through a pipeline in which every part behaved correctly. These tests hold the
 * allowlist at each layer, and the one that matters most is the fourth: a NEW
 * protected species inherits every refusal without anyone editing a list.
 */

const bundle = (speciesId: string, takeEligibility?: string) => ({
  resources: [{ type: "species", speciesProfile: { speciesId, ...(takeEligibility ? { takeEligibility } : {}) } }],
});

test("every published species declares an eligibility, and the two readers agree", () => {
  const catalogue = catalogueSpecies();
  assert.equal(SPECIES_TAKE_ELIGIBILITY.size, catalogue.length);
  for (const { speciesId, takeEligibility } of catalogue) assert.equal(takeEligibilityOf(speciesId), takeEligibility, speciesId);
});

test("a profile without an eligibility fails the load rather than defaulting to game", () => {
  assert.throws(() => eligibilityFromBundles([bundle("species:new-bird")]), /no take eligibility/);
  assert.throws(() => eligibilityFromBundles([bundle("species:new-bird", "GAME")]), /no take eligibility/);
});

test("only HUNTABLE and REMOVAL grant hunting opportunity; unknown is refused", () => {
  assert.equal(grantsHuntingOpportunity("HUNTABLE"), true);
  assert.equal(grantsHuntingOpportunity("REMOVAL"), true);
  assert.equal(grantsHuntingOpportunity("PROTECTED"), false);
  assert.equal(grantsHuntingOpportunity("UNVERIFIED"), false);
  assert.equal(takeEligibilityOf("species:never-published"), "UNVERIFIED");
  assert.equal(permitsHuntingOpportunity("species:never-published"), false);
});

test("a new protected species inherits every refusal without editing any list", () => {
  const eligibility = eligibilityFromBundles([bundle("species:new-protected-bird", "PROTECTED"), bundle("species:new-game-bird", "HUNTABLE")]);
  const permits = (id: string) => grantsHuntingOpportunity(eligibility.get(id) ?? "UNVERIFIED");
  /* builder and registry share this decision */
  assert.deepEqual(
    servableSurfaceEntries([{ speciesId: "species:new-protected-bird" }, { speciesId: "species:new-game-bird" }], permits).map(({ speciesId }) => speciesId),
    ["species:new-game-bird"],
  );
  /* the selector */
  const resources = [
    { type: "species", speciesProfile: { speciesId: "species:new-protected-bird" } },
    { type: "species", speciesProfile: { speciesId: "species:ruffed-grouse" } },
  ];
  assert.deepEqual(offeredAsQuarry(resources).map((r) => r.speciesProfile.speciesId), ["species:ruffed-grouse"]);
});

test("the classification the research supports", () => {
  for (const id of ["species:whooping-crane", "species:trumpeter-swan", "species:gunnison-sage-grouse"]) assert.equal(takeEligibilityOf(id), "PROTECTED", id);
  /* not over-corrected: invasive and nuisance take is not protection */
  for (const id of ["species:wild-boar", "species:nutria", "species:mute-swan"]) assert.equal(takeEligibilityOf(id), "REMOVAL", id);
  /* a hunted lookalike stays huntable */
  for (const id of ["species:sandhill-crane", "species:tundra-swan", "species:greater-sage-grouse"]) assert.equal(takeEligibilityOf(id), "HUNTABLE", id);
});

test("the committed registry, the surface API and the heat API all refuse a protected species", () => {
  const registry = JSON.parse(readFileSync("content/intelligence/surface-registry.json", "utf8")) as {
    surfaces: Array<{ speciesId: string }>;
    declined: Array<{ speciesId: string; reason: string }>;
  };
  assert.ok(registry.surfaces.length > 0, "an empty registry would pass vacuously");
  const refused = [...SPECIES_TAKE_ELIGIBILITY].filter(([, e]) => !grantsHuntingOpportunity(e)).map(([id]) => id);
  assert.ok(refused.length >= 3, "the refused set should not be empty");
  for (const id of refused) {
    assert.ok(!registry.surfaces.some((entry) => entry.speciesId === id), `${id} has a committed surface`);
    assert.equal(hasCertifiedSurface(id), false, id);
    assert.deepEqual(speciesSurfaces(id).surfaces, [], id);
    assert.deepEqual(opportunityAcross(id, ["management_zone:ca-on-wmu-57"]), [], id);
    assert.equal(heatMethodology(id), null, id);
  }
  for (const entry of registry.declined) {
    if (takeEligibilityOf(entry.speciesId) === "PROTECTED") assert.equal(entry.reason, "PROTECTED_NOT_HUNTED", entry.speciesId);
  }
  /* positive control: a served species still answers */
  assert.ok(hasCertifiedSurface(registry.surfaces[0].speciesId));
});
