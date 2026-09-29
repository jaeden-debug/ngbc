import assert from "node:assert/strict";
import test from "node:test";
import { servableDatasets } from "./bundles.ts";
import { classifyOpportunity, evidenceCoverage } from "./classification.ts";
import {
  METRIC_ROLES,
  METRIC_WEIGHTS,
  OPPORTUNITY_METHODOLOGY,
  appliedWeights,
  contributingMetrics,
  evidenceGrade,
  evidenceStrength,
  independentAbundanceCount,
  independentValueCount,
} from "./methodology.ts";
import type { EvidenceRecord, IntelligenceMetric } from "./types.ts";

/**
 * The defect this version exists to correct, and the guards that keep it
 * corrected.
 *
 * v1 averaged every normalized series a bundle carried, and two of British
 * Columbia's five are hunter counts and hunter days. Two fifths of the shade a
 * hunter reads as "where the animals are" was a measure of where the HUNTERS
 * were. Nothing in the suite could see it, because nothing asserted what the
 * number was made of.
 */

function record(metric: IntelligenceMetric, normalizedValue: number, overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    id: `evidence:test-${metric.toLowerCase()}`,
    speciesId: "species:moose",
    jurisdictionId: "jurisdiction:ca-on",
    geographyId: "management_zone:ca-on-wmu-57",
    geographyType: "MANAGEMENT_ZONE",
    sourceId: "source:test",
    metric,
    rawValue: 1,
    normalizedValue,
    unit: "test units",
    observationPeriod: { from: "2025-01-01", through: "2025-12-31" },
    retrievedAt: "2026-09-29",
    verifiedAt: "2026-09-29",
    confidence: "MODERATE",
    spatialPrecision: "test",
    version: "2025",
    superseded: false,
    ...overrides,
  } as EvidenceRecord;
}

test("hunting effort is carried, shown, and never allowed to move the shade", () => {
  /* The decisive case: the unit is at the very BOTTOM of its dataset for every
     measurement about the animals, and at the very TOP for both measurements
     about the hunters. v1 averaged that to 0.4 and painted it MODERATE. */
  const busyAndEmpty = [
    record("HARVEST_TOTAL", 0),
    record("HARVEST_PER_HUNTER", 0),
    record("HARVEST_PER_EFFORT", 0),
    record("HUNTER_COUNT", 1),
    record("HUNTER_DAYS", 1),
  ];
  const result = classifyOpportunity(busyAndEmpty)!;
  assert.equal(result.intensity, 0, "a unit with no animal evidence ranks at the bottom whatever its crowd");
  assert.equal(result.classification, "LOW");

  const effort = result.components.filter((component) => component.role === "EFFORT_CONTEXT");
  assert.equal(effort.length, 2, "both effort measurements are still carried — they are real, published and useful");
  for (const component of effort) {
    assert.equal(component.contributesToIntensity, false);
    assert.equal(component.appliedWeight, undefined);
    assert.match(component.meaning, /never of animals|Effort, never animals/);
  }

  /* And the mirror image, so the test cannot pass by the shade being stuck low. */
  const quietAndFull = [
    record("HARVEST_TOTAL", 1),
    record("HARVEST_PER_HUNTER", 1),
    record("HARVEST_PER_EFFORT", 1),
    record("HUNTER_COUNT", 0),
    record("HUNTER_DAYS", 0),
  ];
  assert.equal(classifyOpportunity(quietAndFull)!.intensity, 1);
  assert.equal(classifyOpportunity(quietAndFull)!.classification, "VERY_HIGH");
});

test("no metric about hunters or land may ever be given a weight", () => {
  for (const [metric, role] of Object.entries(METRIC_ROLES) as Array<[IntelligenceMetric, string]>) {
    if (role !== "ABUNDANCE_SIGNAL") {
      assert.equal(METRIC_WEIGHTS[metric], 0, `${metric} is ${role} and must carry no weight`);
      assert.ok(!contributingMetrics([metric]).length, `${metric} must never contribute`);
    }
  }
  /* A metric added later without a decision about its role would default to
     nothing here; this asserts every declared metric HAS a role. */
  assert.equal(Object.keys(METRIC_ROLES).length, Object.keys(METRIC_WEIGHTS).length);
});

test("the applied weights sum to one and are reported, whatever is present", () => {
  for (const present of [
    ["HARVEST_TOTAL"],
    ["HARVEST_TOTAL", "HARVEST_PER_HUNTER"],
    ["HARVEST_TOTAL", "HARVEST_PER_HUNTER", "HARVEST_PER_EFFORT", "HUNTER_COUNT", "HUNTER_DAYS"],
    ["POPULATION_DENSITY", "HARVEST_TOTAL"],
  ] as IntelligenceMetric[][]) {
    const weights = appliedWeights(present);
    const total = [...weights.values()].reduce((sum, weight) => sum + weight, 0);
    assert.ok(Math.abs(total - 1) < 1e-9, `${present.join("+")} weights must sum to one, got ${total}`);
  }
  // Nothing that may contribute means no weights at all — not an even split.
  assert.equal(appliedWeights(["HUNTER_COUNT", "HUNTER_DAYS"]).size, 0);
  assert.equal(appliedWeights(["RANGE_PRESENCE"]).size, 0);
});

test("a rate that carries its own denominator outweighs a raw total", () => {
  const weights = appliedWeights(["HARVEST_TOTAL", "HARVEST_PER_HUNTER"]);
  assert.ok(weights.get("HARVEST_PER_HUNTER")! > weights.get("HARVEST_TOTAL")!);
  // And an authority's own density outweighs anything derived from hunting.
  const withDensity = appliedWeights(["POPULATION_DENSITY", "HARVEST_TOTAL", "HARVEST_PER_HUNTER"]);
  assert.ok(withDensity.get("POPULATION_DENSITY")! > withDensity.get("HARVEST_PER_HUNTER")!);
});

test("coverage counts independent values, not the names they go under", () => {
  /* BC's five metrics are three published numbers and two rates derived from
     them. Counting names graded that ROBUST_DATA — the strongest word the
     product has — for restating three facts five ways. */
  const britishColumbia: IntelligenceMetric[] = ["HARVEST_TOTAL", "HUNTER_COUNT", "HUNTER_DAYS", "HARVEST_PER_HUNTER", "HARVEST_PER_EFFORT"];
  assert.equal(new Set(britishColumbia).size, 5, "five distinct metric names");
  assert.equal(independentValueCount(britishColumbia), 3, "three independently published numbers");
  assert.equal(evidenceCoverage(britishColumbia.map((metric) => ({ metric }))), "PARTIAL_DATA");

  // A rate whose denominator is NOT held cannot have been derived here, so it
  // is a fact of its own: total plus rate implies the denominator.
  assert.equal(independentValueCount(["HARVEST_TOTAL", "HARVEST_PER_HUNTER"]), 2);
  assert.equal(evidenceCoverage([]), "NO_HEAT_MAP_DATA");
  assert.equal(evidenceCoverage([{ metric: "RANGE_PRESENCE" }]), "RANGE_ONLY");
  assert.equal(evidenceCoverage([{ metric: "HARVEST_TOTAL" }]), "LIMITED_DATA");
});

test("strength is a different question from intensity, and is computed without it", () => {
  const thinButTop = [record("HARVEST_TOTAL", 1)];
  const thin = classifyOpportunity(thinButTop)!;
  assert.equal(thin.classification, "VERY_HIGH", "one thin measurement can still rank at the top");
  assert.equal(thin.strength, "WEAK", "and the product must say the evidence for that is thin");

  const broad = classifyOpportunity([
    record("HARVEST_TOTAL", 0.1),
    record("HUNTER_COUNT", 0.1),
    record("HUNTER_DAYS", 0.1),
    record("SURVEY_OBSERVATION", 0.1),
    record("POPULATION_ESTIMATE", 0.1),
  ])!;
  assert.equal(broad.classification, "LOW", "a cold zone can be very well evidenced");
  assert.equal(broad.strength, "STRONG");

  // Effort alone is not evidence about an animal, at any volume.
  assert.equal(evidenceStrength([{ metric: "HUNTER_COUNT", confidence: "HIGH" }, { metric: "HUNTER_DAYS", confidence: "HIGH" }]), "INSUFFICIENT");
});

test("a shade is never painted where the evidence refuses to rank", () => {
  const rangeOnly = classifyOpportunity([record("RANGE_PRESENCE", 1)])!;
  assert.equal(rangeOnly.classification, "LIMITED_DATA");
  assert.equal(rangeOnly.intensity, null, "null is a refusal to rank; zero is the bottom of a ranking, and they are different answers");
  assert.equal(rangeOnly.coverage, "RANGE_ONLY");

  const effortOnly = classifyOpportunity([record("HUNTER_COUNT", 1), record("HUNTER_DAYS", 1)])!;
  assert.equal(effortOnly.classification, "LIMITED_DATA");
  assert.equal(effortOnly.intensity, null, "a unit known only by its crowd cannot be ranked for animals at all");
});

test("the grade names what the evidence is, so no legend has to decide", () => {
  assert.equal(evidenceGrade(["POPULATION_DENSITY", "HARVEST_TOTAL"]), "A");
  assert.equal(evidenceGrade(["POPULATION_ESTIMATE"]), "B");
  assert.equal(evidenceGrade(["SURVEY_OBSERVATION"]), "B");
  assert.equal(evidenceGrade(["HARVEST_TOTAL", "HUNTER_COUNT"]), "C");
  assert.equal(evidenceGrade(["RANGE_PRESENCE"]), "D");
  assert.equal(evidenceGrade(["HABITAT_SUITABILITY"]), "D");
  assert.equal(evidenceGrade([]), "E");
  /* Harvest is never graded as density, whatever else is present with it. */
  assert.notEqual(evidenceGrade(["HARVEST_TOTAL", "HARVEST_PER_EFFORT", "HUNTER_DAYS"]), "A");
});

test("every committed dataset is graded from what it actually publishes", () => {
  for (const dataset of servableDatasets()) {
    const metrics = dataset.metrics.map(({ metric }) => metric);
    assert.equal(dataset.grade, evidenceGrade(metrics), `${dataset.speciesId} grade must be derived, never declared`);
    /* Not one committed dataset measures animals per square kilometre, so not
       one of them may be graded A. If that assertion ever fails, a real density
       dataset arrived — or something was mislabelled as one. */
    assert.notEqual(dataset.grade, "A", `${dataset.speciesId} has no density data and must not be graded as if it did`);
    for (const { metric, role, contributes } of dataset.metrics) {
      assert.equal(contributes, METRIC_ROLES[metric] === "ABUNDANCE_SIGNAL" && METRIC_WEIGHTS[metric] > 0);
      assert.equal(role, METRIC_ROLES[metric]);
    }
    assert.ok(dataset.independentValues >= 1 && dataset.independentValues <= dataset.metrics.length);
  }
});

test("no hunter count in any committed bundle moves any shade", () => {
  /* The falsification against the real data rather than a fixture: every
     effort record that exists, checked for the flag, across every jurisdiction
     served. A future bundle that quietly gives effort a weight fails here. */
  let effortRecords = 0;
  for (const dataset of servableDatasets()) {
    for (const { metric, contributes } of dataset.metrics) {
      if (METRIC_ROLES[metric] === "EFFORT_CONTEXT") {
        effortRecords += 1;
        assert.equal(contributes, false, `${dataset.speciesId} in ${dataset.jurisdictionId} lets ${metric} move the shade`);
      }
    }
  }
  assert.ok(effortRecords > 0, "if no effort is held anywhere, this test proves nothing and must be re-examined");
});

test("the methodology is a versioned record, not prose written next to the code", () => {
  assert.equal(OPPORTUNITY_METHODOLOGY.version, "opportunity-v2");
  assert.match(OPPORTUNITY_METHODOLOGY.effort, /never move the shade/);
  assert.match(OPPORTUNITY_METHODOLOGY.missingData, /never treated as zero/);
  assert.match(OPPORTUNITY_METHODOLOGY.statedAs, /not a count of animals/);
  assert.ok(OPPORTUNITY_METHODOLOGY.limitations.length >= 3);
  for (const dataset of servableDatasets()) {
    assert.equal(dataset.methodologyVersion, "opportunity-v1", "the bundle's own NORMALIZATION version is separate and unchanged");
  }
});

test("today every served dataset rests on ONE fact about the animals, and says so", () => {
  /* The shade a hunter sees across all of British Columbia and Ontario is a
     rank of one harvest figure per unit. The rates beside it are that same
     figure divided by effort, so they corroborate nothing.

     This is the assertion to change when a survey or a population estimate is
     ingested — and changing it should be a deliberate act, because it is the
     moment the product may start telling hunters its heat is well evidenced. */
  for (const dataset of servableDatasets()) {
    const metrics = dataset.metrics.map(({ metric }) => metric);
    assert.equal(
      independentAbundanceCount(metrics),
      1,
      `${dataset.speciesId} in ${dataset.jurisdictionId} claims more than one independent animal fact; check it is real`,
    );
    assert.equal(
      evidenceStrength(metrics.map((metric) => ({ metric, confidence: "MODERATE" as const }))),
      "WEAK",
    );
  }
});
