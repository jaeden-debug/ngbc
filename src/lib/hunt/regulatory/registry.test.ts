import assert from "node:assert/strict";
import test from "node:test";
import { isFederalMigratoryBird } from "./federal.ts";
import { ZONE_LAYERS } from "../zone-layers.ts";
import { isCertifiedSpecies, REGULATORY_REGISTRY, regulatoryEntryFor } from "./registry.ts";
import { CANADA_JURISDICTIONS } from "../canada/registry.ts";
import { unitedStatesJurisdictionById } from "../united-states/registry.ts";
import { jurisdictionScopeServing } from "../jurisdiction-scope-declarations.ts";
import { IOWA_BUNDLE } from "./iowa.ts";

/**
 * The registry's two invariants, held here so neither can drift.
 *
 * Coverage copy that reaches the browser (coverage.ts) names every served
 * layer as a place with certified rules, because it cannot load the bundles to
 * check. That is only true while every served layer has an entry. And an entry
 * counts only while its layer is served, so rules Hunt cannot place in a zone
 * are never advertised.
 */

test("a layer whose rules are certified has rules behind it, and one drawn without them says so", () => {
  for (const layer of ZONE_LAYERS.filter((candidate) => candidate.serving)) {
    const entry = regulatoryEntryFor(layer.jurisdictionId);
    if (layer.rulesServing) {
      assert.ok(entry, `${layer.jurisdictionName} answers rules but has no regulatory entry`);
      assert.ok(entry.coverage().species.length > 0, `${layer.jurisdictionName} has an entry with no species`);
    } else {
      /* Boundary-only: drawn, named and resolved, with no rules answering. The
         person is sent to the authority instead, so the jurisdiction must name
         where its own rules live. */
      assert.equal(entry, undefined, `${layer.jurisdictionName} is drawn without certified rules but an entry answers`);
      /* The obligation is the same in both countries and the lookup was Canada's
         only: Massachusetts is the first U.S. layer drawn without rules, and a
         Canada-only lookup reported it as failing to name its authority when it
         names one. A boundary-only jurisdiction must say where its rules live,
         wherever it is. */
      const authorityUrl = layer.country === "CA"
        ? CANADA_JURISDICTIONS.find((candidate) => candidate.id === layer.jurisdictionId)?.regulatory.huntingAuthorityUrl
        : unitedStatesJurisdictionById(layer.jurisdictionId)?.authority.url;
      assert.ok(authorityUrl, `${layer.jurisdictionName} must link its own hunting rules`);
    }
  }
});

test("an entry answers only where its layer is served and its rules are certified", () => {
  for (const entry of REGULATORY_REGISTRY) {
    const byLayer = ZONE_LAYERS.some((layer) =>
      layer.jurisdictionId === entry.jurisdictionId && layer.serving && layer.rulesServing);
    /* The second road in (§41A): no layer at all, every rule whole-jurisdiction,
       and the jurisdiction's boundary declared serving. Never both — a state
       with a layer reaches its statewide rules through that layer's points. */
    const byBoundary = entry.resolvesBy === "JURISDICTION_BOUNDARY" &&
      !ZONE_LAYERS.some((layer) => layer.jurisdictionId === entry.jurisdictionId) &&
      jurisdictionScopeServing(entry.jurisdictionId);
    assert.equal(Boolean(regulatoryEntryFor(entry.jurisdictionId)), byLayer || byBoundary, entry.jurisdictionId);
  }
  /* Saskatchewan WAS the example here and now answers, so the example moves to a
     jurisdiction that is still drawn without certified rules. Prince Edward
     Island's layer serves a provincial outline and its rules are not certified. */
  assert.equal(regulatoryEntryFor("jurisdiction:ca-pe"), undefined);
  assert.equal(regulatoryEntryFor("jurisdiction:ca-yt"), undefined);
  /* Positive control: the boundary road is actually exercised, or the line above tests nothing. */
  assert.ok(REGULATORY_REGISTRY.some((entry) => entry.resolvesBy === "JURISDICTION_BOUNDARY" && regulatoryEntryFor(entry.jurisdictionId)));
  assert.equal(regulatoryEntryFor(undefined), undefined);
});

test("a whole-jurisdiction entry's rules are all whole-jurisdiction", () => {
  /* The boundary may place a point only for rules whose own scope is the whole
     jurisdiction. An entry reached that way holding even one unit rule would
     let the state boundary stand in for the unit. */
  for (const entry of REGULATORY_REGISTRY.filter((candidate) => candidate.resolvesBy === "JURISDICTION_BOUNDARY")) {
    assert.ok(entry.jurisdictionId === "jurisdiction:us-ia", "a new whole-jurisdiction entry needs its bundle read here");
    for (const rule of IOWA_BUNDLE.rules) {
      assert.equal(rule.geography?.include.jurisdiction, entry.jurisdictionId, rule.id);
      assert.deepEqual([rule.geography?.include.ghas, rule.geography?.include.special, rule.geography?.include.gbhz], [[], [], []], rule.id);
    }
  }
});

test("each jurisdiction appears once", () => {
  const ids = REGULATORY_REGISTRY.map((entry) => entry.jurisdictionId);
  assert.equal(new Set(ids).size, ids.length);
});

test("an evaluation accepts exactly the species some served jurisdiction certifies", () => {
  const served = REGULATORY_REGISTRY.filter((entry) => regulatoryEntryFor(entry.jurisdictionId));
  const certified = new Set(served.flatMap((entry) => entry.coverage().species.map((row) => row.speciesId)));
  assert.ok(certified.size > 0);
  for (const speciesId of certified) assert.equal(isCertifiedSpecies(speciesId), true, speciesId);

  // Certified only by a jurisdiction that is not served: refused until it is.
  const unserved = REGULATORY_REGISTRY.filter((entry) => !regulatoryEntryFor(entry.jurisdictionId));
  for (const entry of unserved) {
    for (const row of entry.coverage().species) {
      if (!certified.has(row.speciesId)) assert.equal(isCertifiedSpecies(row.speciesId), false, row.speciesId);
    }
  }
  /*
   * Published in the species library with no certified rules anywhere.
   *
   * THE TEST ASSERTS ITS OWN PREMISE FIRST. A test whose example was chosen
   * for a property our own work can change stops testing anything the day that
   * property changes, and passes while doing it: `species:mallard` was used
   * exactly this way as "not certified", and went on passing after the federal
   * rules made it certified, because the assertion had become trivially true
   * of a species nobody would now pick. Here, if the example is ever certified,
   * this fails and SAYS to pick another rather than quietly going hollow.
   *
   * IT DID. The example was `species:gray-wolf` until Saskatchewan landed on
   * 2026-10-01 and certified it from The Open Seasons Game Regulations, 2009
   * s. 29.2 — and this assertion failed with its own instruction rather than
   * passing hollowly, which is the second time the guard has earned itself.
   * Bighorn sheep replaces it: published in the species library, certified in no
   * bundle, and not a federal migratory bird.
   */
  const stillUncertified = !REGULATORY_REGISTRY
    .filter((entry) => regulatoryEntryFor(entry.jurisdictionId))
    .some((entry) => entry.coverage().species.some((row) => row.speciesId === "species:bighorn-sheep"))
    && !isFederalMigratoryBird("species:bighorn-sheep");
  assert.ok(
    stillUncertified,
    "species:bighorn-sheep is now certified somewhere — this test needs a different uncertified example, not a passing assertion",
  );
  assert.equal(isCertifiedSpecies("species:bighorn-sheep"), false);
  assert.equal(isCertifiedSpecies(42), false);
});
