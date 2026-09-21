import assert from "node:assert/strict";
import test from "node:test";
import { ZONE_LAYERS } from "../zone-layers.ts";
import { REGULATORY_REGISTRY, regulatoryEntryFor } from "./registry.ts";

/**
 * The registry's two invariants, held here so neither can drift.
 *
 * Coverage copy that reaches the browser (coverage.ts) names every served
 * layer as a place with certified rules, because it cannot load the bundles to
 * check. That is only true while every served layer has an entry. And an entry
 * counts only while its layer is served, so rules Hunt cannot place in a zone
 * are never advertised.
 */

test("every served zone layer has certified rules behind it", () => {
  for (const layer of ZONE_LAYERS.filter((candidate) => candidate.serving)) {
    const entry = regulatoryEntryFor(layer.jurisdictionId);
    assert.ok(entry, `${layer.jurisdictionName} is drawn and resolved but has no regulatory entry`);
    assert.ok(entry.coverage().species.length > 0, `${layer.jurisdictionName} has an entry with no species`);
  }
});

test("an entry answers only where its layer is served", () => {
  for (const entry of REGULATORY_REGISTRY) {
    const served = ZONE_LAYERS.some((layer) => layer.jurisdictionId === entry.jurisdictionId && layer.serving);
    assert.equal(Boolean(regulatoryEntryFor(entry.jurisdictionId)), served, entry.jurisdictionId);
  }
  assert.equal(regulatoryEntryFor("jurisdiction:ca-sk"), undefined);
  assert.equal(regulatoryEntryFor(undefined), undefined);
});

test("each jurisdiction appears once", () => {
  const ids = REGULATORY_REGISTRY.map((entry) => entry.jurisdictionId);
  assert.equal(new Set(ids).size, ids.length);
});
