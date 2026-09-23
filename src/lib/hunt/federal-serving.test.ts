import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { FEDERAL_MIGRATORY_SERVING, SUPPORTED_SPECIES } from "./coverage.ts";
import { isCertifiedSpecies } from "./regulatory/registry.ts";
import { federalSpeciesIds, isFederalMigratoryBird } from "./regulatory/federal.ts";

/**
 * One switch, or none.
 *
 * A species that is SELECTABLE but not ANSWERABLE sends a hunter to a request
 * that refuses them; a species ANSWERABLE but not selectable is a certified
 * fact nobody can reach. Both halves read the same flag, and this asserts they
 * cannot drift apart — whichever way it is set.
 */

const derived = JSON.parse(readFileSync("content/regulatory/ca-federal-species.generated.json", "utf8")) as {
  offered: Array<{ id: string; displayName: string; scientificName: string; resourcePath: string }>;
  withheld: Array<{ id: string; reason: string }>;
};

test("selectable and answerable agree, whichever way the flag is set", () => {
  for (const { id } of derived.offered) {
    const selectable = SUPPORTED_SPECIES.some((species) => species.id === id);
    assert.equal(selectable, FEDERAL_MIGRATORY_SERVING, `${id} selectable`);
    assert.equal(isCertifiedSpecies(id), FEDERAL_MIGRATORY_SERVING, `${id} answerable`);
  }
});

test("a withheld species is never offered, however the flag is set", () => {
  for (const { id } of derived.withheld) {
    assert.ok(!SUPPORTED_SPECIES.some((species) => species.id === id), `${id} must not be selectable`);
  }
});

test("every federal species is either offered or withheld, never neither", () => {
  const accounted = new Set([...derived.offered.map((s) => s.id), ...derived.withheld.map((s) => s.id)]);
  for (const id of federalSpeciesIds()) assert.ok(accounted.has(id), `${id} is unaccounted for`);
  assert.equal(accounted.size, federalSpeciesIds().length);
});

test("nothing offered carries a typed-looking name: every one has a scientific name and a real page", () => {
  for (const species of derived.offered) {
    assert.match(species.scientificName, /^[A-Z][a-z]+ [a-z-]+$/, species.id);
    assert.equal(species.resourcePath, `/hunting/species/${species.id.replace("species:", "")}`, species.id);
  }
});

test("every withheld species says WHY, so the gap is declared rather than silent", () => {
  for (const species of derived.withheld) assert.ok(species.reason.trim().length > 0, species.id);
});

test("the engine is ready even while the flag is off", () => {
  /* The switch controls exposure, not capability: the federal path must be
     built and working before it is turned on, or turning it on is a rewrite. */
  assert.equal(isFederalMigratoryBird("species:mallard"), true);
  assert.ok(federalSpeciesIds().length >= derived.offered.length);
});

test("a withheld species still belongs to its federal group, so shared limits stay honest", () => {
  /* American black duck and cackling goose have stub library records, but the
     regulation still counts them in the group whose limit it sets. Dropping
     them from the group to match the library would understate what a limit is
     shared with. */
  for (const { id } of derived.withheld) assert.equal(isFederalMigratoryBird(id), true, id);
});
