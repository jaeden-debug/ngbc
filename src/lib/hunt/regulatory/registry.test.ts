import assert from "node:assert/strict";
import test from "node:test";
import { ZONE_LAYERS } from "../zone-layers.ts";
import { isCertifiedSpecies, REGULATORY_REGISTRY, regulatoryEntryFor } from "./registry.ts";
import { CANADA_JURISDICTIONS } from "../canada/registry.ts";

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
      const jurisdiction = CANADA_JURISDICTIONS.find((candidate) => candidate.id === layer.jurisdictionId);
      assert.ok(jurisdiction?.regulatory.huntingAuthorityUrl, `${layer.jurisdictionName} must link its own hunting rules`);
    }
  }
});

test("an entry answers only where its layer is served and its rules are certified", () => {
  for (const entry of REGULATORY_REGISTRY) {
    const answering = ZONE_LAYERS.some((layer) =>
      layer.jurisdictionId === entry.jurisdictionId && layer.serving && layer.rulesServing);
    assert.equal(Boolean(regulatoryEntryFor(entry.jurisdictionId)), answering, entry.jurisdictionId);
  }
  assert.equal(regulatoryEntryFor("jurisdiction:ca-sk"), undefined);
  assert.equal(regulatoryEntryFor(undefined), undefined);
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
  // Published in the species library with no certified rules anywhere, and not a species at all.
  assert.equal(isCertifiedSpecies("species:gray-wolf"), false);
  assert.equal(isCertifiedSpecies(42), false);
});
