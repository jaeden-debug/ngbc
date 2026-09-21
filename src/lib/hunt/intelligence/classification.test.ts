import assert from "node:assert/strict";
import test from "node:test";
import { classifyNormalizedScore, classifyOpportunity, percentileRanks } from "./classification.ts";
import type { EvidenceRecord } from "./types.ts";

function evidence(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    id: "evidence:ca-on-wmu-57-deer-harvest-2025",
    speciesId: "species:white-tailed-deer",
    jurisdictionId: "jurisdiction:ca-on",
    geographyId: "management_zone:ca-on-wmu-57",
    geographyType: "MANAGEMENT_ZONE",
    sourceId: "source:ca-on-white-tailed-deer-harvest",
    metric: "HARVEST_TOTAL",
    rawValue: 100,
    normalizedValue: 0.82,
    unit: "estimated harvested deer",
    methodology: "Estimated from a sample of resident hunter reports.",
    observationPeriod: { from: "2025-01-01", through: "2025-12-31" },
    retrievedAt: "2026-09-21",
    verifiedAt: "2026-09-21",
    confidence: "MODERATE",
    spatialPrecision: "Ontario Wildlife Management Unit",
    version: "2025",
    superseded: false,
    ...overrides,
  };
}

test("classification thresholds are deterministic and reject false precision inputs", () => {
  assert.equal(classifyNormalizedScore(0.8), "VERY_HIGH");
  assert.equal(classifyNormalizedScore(0.6), "HIGH");
  assert.equal(classifyNormalizedScore(0.4), "MODERATE");
  assert.equal(classifyNormalizedScore(0.399), "LOW");
  assert.throws(() => classifyNormalizedScore(1.01), /between 0 and 1/);
});

test("percentile ranks are tie-aware and deterministic", () => {
  assert.deepEqual(percentileRanks([10, 20, 20, 40]), [0, 0.5, 0.5, 1]);
});

test("opportunity remains separate from legality and explains every component", () => {
  const result = classifyOpportunity([
    evidence(),
    evidence({ id: "evidence:ca-on-wmu-57-deer-per-hunter-2025", metric: "HARVEST_PER_HUNTER", rawValue: 0.2, normalizedValue: 0.62, unit: "estimated deer per active hunter" }),
  ]);
  assert.equal(result?.classification, "HIGH");
  assert.equal(result?.coverage, "PARTIAL_DATA");
  assert.equal(result?.legalStatus, null);
  assert.equal(result?.components.length, 2);
  assert.equal(result?.explanation.length, 2);
});

test("a broad range alone is labelled limited data rather than a heat map", () => {
  const result = classifyOpportunity([evidence({ metric: "RANGE_PRESENCE", rawValue: true, normalizedValue: undefined, unit: "presence" })]);
  assert.equal(result?.coverage, "RANGE_ONLY");
  assert.equal(result?.classification, "LIMITED_DATA");
});

test("mixed species or geography cannot be combined into a magic score", () => {
  assert.throws(() => classifyOpportunity([evidence(), evidence({ geographyId: "management_zone:ca-on-wmu-58" })]), /one species and one geography/);
});
