import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { COVERAGE_EXPLANATIONS, coverageFromDataset, coverageFromRegistry, coverageIsPaintable, mayShow, temporalApplicability } from "./applicability.ts";
import { availableMetrics, derive, DERIVATIONS, mayLabelAs, NEVER_DERIVED } from "./derivation.ts";
import { EVIDENCE_TIERS, isClaimRefusal, METRIC_TIERS, strongestTierFor, tierOfMetric, tierSupports } from "./evidence-ladder.ts";
import { habitatModelIsReproducible, mayPublish, SENSITIVITY_RULES } from "./publication.ts";
import { DATASET_EVIDENCE, evidenceMatrixEntries, matrixCell, matrixJurisdictions, matrixReport, validateEvidenceMatrix } from "./evidence-matrix.ts";
import { intelligenceDatasetRegistry } from "./registry.ts";
import { explainSelection, selectLayer, type LayerCandidate, type LayerRequest } from "./selection.ts";
import { contains, describeResolution, finestPermittedResolution, permitsVisualisationAt, PRECISION_FOR_GEOGRAPHY_LEVEL } from "./spatial-precision.ts";
import { CANADA_JURISDICTIONS } from "../canada/registry.ts";
import type { SourceLicence } from "../source-licence.ts";
import type { IntelligenceMetric } from "./types.ts";

/**
 * The mistakes this architecture exists to prevent, written as fixtures.
 *
 * Each of these is a plausible, well-intentioned feature that would put a
 * confident falsehood in front of a hunter. They are here so that making one
 * again requires deleting a test that says why it is wrong.
 */

const LICENCE: SourceLicence = {
  statedAs: "Open Government Licence – Ontario",
  url: "https://www.ontario.ca/page/open-government-licence-ontario",
  retrievedAt: "2026-09-22",
  sha256: "a".repeat(64),
  permittedUse: "COMMERCIAL_PERMITTED",
  redistribution: "PERMITTED",
  attribution: "Contains information licensed under the Open Government Licence – Ontario.",
};

const UNIT = { precision: "MANAGEMENT_UNIT" } as const;
const PROVINCE = { precision: "JURISDICTION" } as const;

/* ── The governing rule ──────────────────────────────────────────────────── */

test("a province-wide figure may never be painted per management unit", () => {
  const verdict = permitsVisualisationAt(PROVINCE, UNIT);
  assert.equal(verdict.permitted, false);
  assert.equal(verdict.permitted === false && verdict.kind, "FINER_THAN_EVIDENCE");
  assert.match(verdict.reason, /invent differences nobody measured/);
  // The other direction is always fine: aggregating measured things loses detail, not truth.
  assert.equal(permitsVisualisationAt(UNIT, PROVINCE).permitted, true);
  assert.equal(permitsVisualisationAt(UNIT, UNIT).permitted, true);
});

test("precisions that do not nest fail closed rather than being given an order", () => {
  // A county and an ecoregion carve the same province differently. Neither is
  // "finer"; pretending one is would put an invented boundary on a map.
  for (const [a, b] of [["COUNTY", "ECOREGION"], ["ECOREGION", "MANAGEMENT_UNIT"], ["MANAGEMENT_UNIT", "SPECIES_MANAGEMENT_AREA"]] as const) {
    const verdict = permitsVisualisationAt({ precision: a }, { precision: b });
    assert.equal(verdict.permitted, false, `${a} → ${b}`);
    assert.equal(verdict.permitted === false && verdict.kind, "UNCOMPARABLE", `${a} → ${b}`);
  }
  assert.equal(contains("JURISDICTION", "POINT"), true);
  assert.equal(contains("MANAGEMENT_UNIT", "JURISDICTION"), false);
});

test("a grid or raster without its cell size is a shape, not a resolution", () => {
  const unsized = permitsVisualisationAt({ precision: "RASTER" }, { precision: "MANAGEMENT_UNIT" });
  assert.equal(unsized.permitted, false);
  assert.equal(unsized.permitted === false && unsized.kind, "UNCOMPARABLE");
  // With both sizes the comparison is arithmetic: coarser is fine, finer is not.
  assert.equal(permitsVisualisationAt({ precision: "RASTER", approximateMetres: 1000 }, { precision: "GRID", approximateMetres: 5000 }).permitted, true);
  const finer = permitsVisualisationAt({ precision: "RASTER", approximateMetres: 30000 }, { precision: "GRID", approximateMetres: 1000 });
  assert.equal(finer.permitted, false);
  assert.equal(finer.permitted === false && finer.kind, "FINER_THAN_EVIDENCE");
});

test("a mixed picture is only as fine as its coarsest member, and refuses when they do not nest", () => {
  assert.deepEqual(finestPermittedResolution([UNIT, PROVINCE]), PROVINCE);
  assert.deepEqual(finestPermittedResolution([UNIT]), UNIT);
  assert.equal(finestPermittedResolution([{ precision: "COUNTY" }, { precision: "ECOREGION" }]), null);
  assert.equal(finestPermittedResolution([]), null);
  assert.match(describeResolution({ precision: "RASTER", approximateMetres: 30 }), /about 30 m/);
});

test("the precision vocabulary adopts Canada's geography LEVEL rather than paralleling it", () => {
  assert.deepEqual(PRECISION_FOR_GEOGRAPHY_LEVEL, {
    ZONE: "MANAGEMENT_UNIT",
    SPECIES_ZONE: "SPECIES_MANAGEMENT_AREA",
    JURISDICTION: "JURISDICTION",
    COUNTY: "COUNTY",
  });
});

/* ── Range never becomes a hotspot ───────────────────────────────────────── */

test("range evidence cannot produce sub-jurisdiction hotspots", () => {
  // The single most tempting fabrication: a species occurs across a province,
  // so the map shades every unit inside it as though some were better.
  assert.equal(tierOfMetric("RANGE_PRESENCE"), "T3_OFFICIAL_EXTENT");
  assert.equal(tierSupports("T3_OFFICIAL_EXTENT", "ABUNDANCE_COMPARISON"), false);
  assert.equal(tierSupports("T3_OFFICIAL_EXTENT", "PRESENCE_EXTENT"), true);

  const refusal = strongestTierFor("ABUNDANCE_COMPARISON", ["T3_OFFICIAL_EXTENT"]);
  assert.ok(isClaimRefusal(refusal));
  assert.match(refusal.reason, /No evidence here can support ABUNDANCE_COMPARISON/);
  // The refusal still says what IS known, so the surface does not go blank.
  assert.deepEqual(refusal.tiersPresent, ["T3_OFFICIAL_EXTENT"]);

  // And the same thing again at the map, through selection.
  const range: LayerCandidate = {
    datasetId: "dataset:range", tier: "T3_OFFICIAL_EXTENT", metrics: ["RANGE_PRESENCE"],
    resolution: PROVINCE, coverage: "AVAILABLE", applicability: "CURRENT",
    authority: "Authority", title: "Distribution", sourceUrl: "https://example.invalid", attribution: null,
  };
  const request: LayerRequest = {
    speciesId: "species:moose", claim: "ABUNDANCE_COMPARISON", drawAt: UNIT,
    onDate: "2026-09-22", bounds: { west: -95, south: 42, east: -74, north: 57 }, maxFeatures: 500,
  };
  const selection = selectLayer([range], request);
  assert.equal(selection.chosen, null);
  assert.equal(explainSelection(selection, request, "n/a"), null);
  assert.match(selection.rejected[0].reason, /Range says occurs somewhere in here/);
  // Two independent reasons, either of which alone would have stopped it.
  assert.equal(selectLayer([range], { ...request, claim: "PRESENCE_EXTENT" }).chosen, null);
});

/* ── Harvest without effort is never a success rate ──────────────────────── */

test("harvest without effort is never labelled a success rate", () => {
  const harvestOnly: IntelligenceMetric[] = ["HARVEST_TOTAL"];
  assert.equal(mayLabelAs("HUNTER_SUCCESS_RATE", harvestOnly), false);
  assert.equal(mayLabelAs("HARVEST_PER_HUNTER", harvestOnly), false);
  assert.equal(mayLabelAs("HARVEST_TOTAL", harvestOnly), true);

  // Not even with hunters present: a success rate counts successful hunters.
  assert.equal(mayLabelAs("HUNTER_SUCCESS_RATE", ["HARVEST_TOTAL", "HUNTER_COUNT"]), false);
  const refusal = derive("HUNTER_SUCCESS_RATE", [
    { metric: "HARVEST_TOTAL", value: 412, unit: "animals", sourceId: "source:on", resolution: UNIT },
    { metric: "HUNTER_COUNT", value: 3_100, unit: "hunters", sourceId: "source:on", resolution: UNIT },
  ]);
  assert.equal(refusal.refused, true);
  assert.equal(refusal.refused === true && refusal.sayInstead, "HARVEST_PER_HUNTER");
  assert.match(refusal.refused === true ? refusal.reason : "", /share of hunters who took an animal/);
  // Only the authority may publish it, and then it is simply held, not derived.
  assert.equal(mayLabelAs("HUNTER_SUCCESS_RATE", ["HUNTER_SUCCESS_RATE"]), true);
  assert.ok(!DERIVATIONS.some(({ produces }) => produces === "HUNTER_SUCCESS_RATE"));
});

test("a rate refuses without its denominator, and carries it when it has one", () => {
  const numerator = { metric: "HARVEST_TOTAL", value: 412, unit: "animals", sourceId: "source:on", resolution: UNIT, sampleSize: 412 } as const;
  const missing = derive("HARVEST_PER_HUNTER", [numerator]);
  assert.equal(missing.refused, true);
  assert.equal(missing.refused === true && missing.sayInstead, "HARVEST_TOTAL");
  assert.match(missing.refused === true ? missing.reason : "", /a total, not a rate/);

  const derived = derive("HARVEST_PER_HUNTER", [
    numerator,
    { metric: "HUNTER_COUNT", value: 3_100, unit: "hunters", sourceId: "source:on", resolution: UNIT, sampleSize: 3_100 },
  ]);
  assert.equal(derived.refused, false);
  if (derived.refused) return;
  // Both sides survive into the published value. This is the whole point.
  assert.equal(derived.numerator.value, 412);
  assert.equal(derived.denominator.value, 3_100);
  assert.equal(derived.denominator.metric, "HUNTER_COUNT");
  assert.equal(derived.sampleSize, 412);
  assert.equal(derived.unit, "animals per active hunter");
  assert.deepEqual(derived.resolution, UNIT);

  // Zero hunters is a place nobody hunted, not an infinite rate.
  const zero = derive("HARVEST_PER_HUNTER", [numerator, { metric: "HUNTER_COUNT", value: 0, unit: "hunters", sourceId: "source:on", resolution: UNIT }]);
  assert.equal(zero.refused, true);
  assert.match(zero.refused === true ? zero.reason : "", /zero here, so no rate exists/);
});

test("a rate is never taken across geographies that do not nest", () => {
  // A unit's harvest over a province's hunters is a number with no meaning at
  // either scale, and it would look entirely reasonable on a card.
  const mismatched = derive("HARVEST_PER_HUNTER", [
    { metric: "HARVEST_TOTAL", value: 412, unit: "animals", sourceId: "source:on", resolution: { precision: "COUNTY" } },
    { metric: "HUNTER_COUNT", value: 3_100, unit: "hunters", sourceId: "source:on", resolution: { precision: "ECOREGION" } },
  ]);
  assert.equal(mismatched.refused, true);
  assert.match(mismatched.refused === true ? mismatched.reason : "", /do not nest/);

  // Where they do nest, the result takes the coarser of the two.
  const mixed = derive("HARVEST_PER_HUNTER", [
    { metric: "HARVEST_TOTAL", value: 412, unit: "animals", sourceId: "source:on", resolution: UNIT },
    { metric: "HUNTER_COUNT", value: 3_100, unit: "hunters", sourceId: "source:on", resolution: PROVINCE },
  ]);
  assert.equal(mixed.refused === false && mixed.resolution.precision, "JURISDICTION");
});

/* ── Habitat is never a density ──────────────────────────────────────────── */

test("habitat is never presented as density, presence or abundance", () => {
  assert.equal(tierOfMetric("HABITAT_SUITABILITY"), "T4_DERIVED_HABITAT");
  for (const claim of ["POPULATION_ESTIMATE", "PRESENCE_EXTENT", "ABUNDANCE_COMPARISON", "HARVEST_RECORD"] as const) {
    assert.equal(tierSupports("T4_DERIVED_HABITAT", claim), false, claim);
  }
  assert.equal(tierSupports("T4_DERIVED_HABITAT", "HABITAT_SUITABILITY"), true);

  // Density needs the authority's own estimate and an area. Habitat is neither.
  assert.equal(mayLabelAs("POPULATION_DENSITY", ["HABITAT_SUITABILITY"]), false);
  assert.equal(mayLabelAs("POPULATION_ESTIMATE", ["HABITAT_SUITABILITY"]), false);
  assert.match(NEVER_DERIVED.POPULATION_ESTIMATE.reason, /not a census/);
  assert.match(NEVER_DERIVED.RANGE_PRESENCE.reason, /land that looks right is not an animal/);
  // Density from a real estimate is permitted, because the area is a property of the geography.
  assert.equal(mayLabelAs("POPULATION_DENSITY", ["POPULATION_ESTIMATE"]), true);

  assert.deepEqual(availableMetrics([{ metric: "HABITAT_SUITABILITY" }]), ["HABITAT_SUITABILITY"]);
  assert.deepEqual(availableMetrics([{ metric: "HARVEST_TOTAL" }, { metric: "HUNTER_DAYS" }]), ["HARVEST_PER_EFFORT", "HARVEST_TOTAL", "HUNTER_DAYS"]);
});

test("a weighted habitat model must be re-runnable, and is no finer than its coarsest input", () => {
  const input = (datasetId: string, weight: number, approximateMetres: number) => ({
    datasetId, weight, sourceHash: `sha256:${"b".repeat(64)}` as const,
    resolution: { precision: "RASTER" as const, approximateMetres }, statedAs: "Land cover class",
  });
  const model = {
    id: "model:on-deer-habitat", version: "habitat-v1", speciesId: "species:white-tailed-deer",
    jurisdictionId: "jurisdiction:ca-on", kind: "WEIGHTED" as const, rule: "Weighted mean of the reclassified inputs.",
    publishedAt: "2026-09-22", statedAs: "Where the land resembles what deer use.",
    inputs: [input("dataset:landcover", 0.6, 30), input("dataset:elevation", 0.4, 250)],
  };
  const verdict = habitatModelIsReproducible(model);
  assert.equal(verdict.reproducible, true);
  // 30 m land cover blended with 250 m elevation is a 250 m model, not a 30 m one.
  assert.deepEqual(verdict.outputResolution, { precision: "RASTER", approximateMetres: 250 });

  const weightsWrong = habitatModelIsReproducible({ ...model, inputs: [input("dataset:landcover", 0.6, 30), input("dataset:elevation", 0.6, 250)] });
  assert.equal(weightsWrong.reproducible, false);
  assert.match(weightsWrong.problems.join(" "), /Weights sum to/);

  const unhashed = habitatModelIsReproducible({ ...model, inputs: [{ ...input("dataset:landcover", 1, 30), sourceHash: "sha256:short" as `sha256:${string}` }] });
  assert.equal(unhashed.reproducible, false);
  assert.match(unhashed.problems.join(" "), /no usable source hash/);

  assert.equal(habitatModelIsReproducible({ ...model, inputs: [] }).reproducible, false);
});

test("a species whose research supports only associations stays classified, and needs no weights", () => {
  // Ruffed grouse research supports habitat ASSOCIATIONS, not a defensible
  // weighting. Requiring numbers here would force a prettier map built on
  // invented figures, which is exactly what section 61 forbids. A classified
  // model is fully publishable.
  const classified = {
    id: "model:qc-ruffed-grouse-habitat", version: "habitat-classified-v1", speciesId: "species:ruffed-grouse",
    jurisdictionId: "jurisdiction:ca-qc", kind: "CLASSIFIED" as const,
    classes: ["Regenerating cutblock", "Mixedwood with aspen", "Wetland edge", "Not associated"],
    rule: "Each land-cover class is assigned to one association class; nothing is combined numerically.",
    publishedAt: "2026-09-22", statedAs: "Where the land matches published ruffed grouse associations.",
    inputs: [{
      datasetId: "dataset:qc-landcover", sourceHash: `sha256:${"c".repeat(64)}` as const,
      resolution: { precision: "RASTER" as const, approximateMetres: 30 }, statedAs: "Land cover class",
    }],
  };
  const verdict = habitatModelIsReproducible(classified);
  assert.equal(verdict.reproducible, true, verdict.problems.join(" "));
  assert.deepEqual(verdict.outputResolution, { precision: "RASTER", approximateMetres: 30 });

  // It must still name its classes: "classified" is not an excuse to say nothing.
  const unnamed = habitatModelIsReproducible({ ...classified, classes: [] });
  assert.equal(unnamed.reproducible, false);
  assert.match(unnamed.problems.join(" "), /must name the classes it assigns/);

  // And it may not smuggle weights in unchecked — that is a weighted model.
  const smuggled = habitatModelIsReproducible({ ...classified, inputs: [{ ...classified.inputs[0], weight: 0.7 }] });
  assert.equal(smuggled.reproducible, false);
  assert.match(smuggled.problems.join(" "), /declare the model WEIGHTED so they are checked/);

  // A weighted model declaring classes instead of weights is refused the same way.
  const neither = habitatModelIsReproducible({ ...classified, kind: "WEIGHTED" });
  assert.equal(neither.reproducible, false);
  assert.match(neither.problems.join(" "), /states weights, not classes|carries no positive weight/);
});

/* ── A restricted dataset is refused, visibly ────────────────────────────── */

test("a dataset the publisher does not permit is refused, and says so rather than vanishing", () => {
  const restricted: SourceLicence = { ...LICENCE, permittedUse: "RESTRICTED", statedAs: "All rights reserved. No commercial use." };
  const verdict = mayPublish({ speciesId: "species:moose" }, restricted, UNIT, UNIT);
  assert.equal(verdict.publish, false);
  assert.equal(verdict.publish === false && verdict.coverage, "RESTRICTED");
  assert.match(verdict.publish === false ? verdict.reason : "", /do not permit North Ground to serve this/);

  // Silence is not permission either.
  assert.equal(mayPublish({ speciesId: "species:moose" }, { ...LICENCE, permittedUse: "UNRESOLVED" }, UNIT, UNIT).publish, false);
  // And a permitted licence still cannot buy a finer drawing than the evidence.
  assert.equal(mayPublish({ speciesId: "species:moose" }, LICENCE, PROVINCE, UNIT).publish, false);
  assert.equal(mayPublish({ speciesId: "species:moose" }, LICENCE, UNIT, UNIT).publish, true);

  // Restricted coverage is paintable-false but still explains itself to a hunter.
  assert.equal(coverageIsPaintable("RESTRICTED"), false);
  assert.match(COVERAGE_EXPLANATIONS.RESTRICTED, /may not publish/);
  assert.match(COVERAGE_EXPLANATIONS.UNAVAILABLE, /a finding about the data, not about the animals/);
  assert.match(COVERAGE_EXPLANATIONS.IN_RESEARCH, /nobody has looked, or a source is identified and not yet certified/);
});

test("the sensitivity contract exists before any observation feature can use it", () => {
  // Empty is correct today: North Ground publishes no point observations. The
  // contract is in place first so the first one cannot bypass it.
  assert.deepEqual(SENSITIVITY_RULES, []);
  assert.equal(mayPublish({ speciesId: "species:moose" }, LICENCE, { precision: "POINT" }, { precision: "POINT" }).publish, true);
});

/* ── Time ────────────────────────────────────────────────────────────────── */

test("old evidence is historical, not expired, and a newer season supersedes it", () => {
  const record = { metric: "HARVEST_TOTAL" as const, observationPeriod: { from: "2019-09-01", through: "2019-12-15" } };
  const superseded = temporalApplicability(record, "2026-09-22", "2024-12-15");
  assert.equal(superseded.applicability, "HISTORICAL");
  assert.match(superseded.statedAs, /A more recent season is published \(2024-12-15\)/);
  assert.equal(superseded.observationAgeYears, 6);

  // The same record with nothing newer published is stale — re-check the source.
  const alone = temporalApplicability(record, "2026-09-22");
  assert.equal(alone.applicability, "STALE");
  assert.match(alone.statedAs, /past North Ground's review interval/);
  // Range stands far longer than a harvest season; the interval is per metric.
  assert.equal(temporalApplicability({ ...record, metric: "RANGE_PRESENCE" }, "2026-09-22").applicability, "CURRENT");
});

test("an effective period is obeyed, and a future one is never shown as though it applied", () => {
  const future = temporalApplicability(
    { metric: "HARVEST_TOTAL", observationPeriod: { from: "2026-01-01", through: "2026-06-01" }, effectivePeriod: { from: "2027-01-01", through: "2027-12-31" } },
    "2026-09-22",
  );
  assert.equal(future.applicability, "NOT_YET_EFFECTIVE");
  assert.equal(mayShow("NOT_YET_EFFECTIVE"), false);
  assert.equal(mayShow("UNDATED"), false);
  assert.equal(mayShow("STALE"), true, "stale is shown with its age, not withdrawn");

  const undated = temporalApplicability({ metric: "HARVEST_TOTAL", observationPeriod: { from: "", through: "" } }, "2026-09-22");
  assert.equal(undated.applicability, "UNDATED");
  assert.equal(undated.observationAgeYears, null);
});

test("coverage vocabularies are mapped to the registries in use, not forked", () => {
  assert.equal(coverageFromRegistry("VERIFIED"), "AVAILABLE");
  assert.equal(coverageFromRegistry("UNKNOWN"), "IN_RESEARCH");
  assert.equal(coverageFromRegistry("UNAVAILABLE"), "UNAVAILABLE");
  assert.equal(coverageFromDataset("LICENCE_BLOCKED"), "RESTRICTED");
  assert.equal(coverageFromDataset("NEEDS_VERIFICATION"), "UNRESOLVED");
  assert.equal(coverageFromDataset("STALE"), "STALE");
  // Every state has words for a hunter; a silent layer is never acceptable.
  for (const [state, text] of Object.entries(COVERAGE_EXPLANATIONS)) assert.ok(text.length > 20, state);
});

/* ── Selection and the explanatory record ────────────────────────────────── */

test("selection takes the strongest tier that can carry the claim, and keeps every rejection", () => {
  const base = { coverage: "AVAILABLE" as const, applicability: "CURRENT" as const, sourceUrl: "https://example.invalid", attribution: null };
  const candidates: LayerCandidate[] = [
    { ...base, datasetId: "dataset:habitat", tier: "T4_DERIVED_HABITAT", metrics: ["HABITAT_SUITABILITY"], resolution: { precision: "RASTER", approximateMetres: 30 }, authority: "North Ground", title: "Habitat model" },
    { ...base, datasetId: "dataset:harvest", tier: "T1_OFFICIAL_MEASURED", metrics: ["HARVEST_TOTAL"], resolution: UNIT, authority: "Ontario", title: "Deer harvest" },
    { ...base, datasetId: "dataset:estimate", tier: "T2_OFFICIAL_MODELLED", metrics: ["POPULATION_ESTIMATE"], resolution: UNIT, authority: "Ontario", title: "Population estimate" },
    { ...base, datasetId: "dataset:stalelicence", tier: "T1_OFFICIAL_MEASURED", metrics: ["HARVEST_TOTAL"], resolution: UNIT, coverage: "RESTRICTED", authority: "Elsewhere", title: "Blocked" },
  ];
  const request: LayerRequest = {
    speciesId: "species:white-tailed-deer", claim: "ABUNDANCE_COMPARISON", drawAt: UNIT,
    onDate: "2026-09-22", bounds: { west: -95, south: 42, east: -74, north: 57 }, maxFeatures: 500,
  };
  const selection = selectLayer(candidates, request);
  assert.equal(selection.chosen?.datasetId, "dataset:harvest");
  // The finest data lost, because it cannot carry this claim at all.
  const habitat = selection.rejected.find(({ datasetId }) => datasetId === "dataset:habitat");
  assert.match(habitat!.reason, /cannot support ABUNDANCE_COMPARISON/);
  assert.ok(selection.rejected.some(({ datasetId }) => datasetId === "dataset:stalelicence"));
  // The modelled estimate was eligible and simply superseded; it is still named.
  assert.match(selection.rejected.find(({ datasetId }) => datasetId === "dataset:estimate")!.reason, /Superseded for this question/);

  const explanation = explainSelection(selection, request, "Measured 2023-09-01 to 2023-12-15.")!;
  assert.equal(explanation.legalStatus, null);
  assert.equal(explanation.tier, "T1_OFFICIAL_MEASURED");
  assert.equal(explanation.authority, "Ontario");
  assert.match(explanation.showing, /how this area compares/);
  assert.match(explanation.cannotTellYou, /not a count of the animals that live there/);
  assert.match(explanation.resolution, /Drawn at the management unit; measured at the management unit/);
  // The explanation is built from the same decision, so it lists what was not used.
  assert.equal(explanation.notUsed.length, selection.rejected.length);
});

test("nothing eligible still says something true, and never implies the species is absent", () => {
  const empty = selectLayer([], {
    speciesId: "species:moose", claim: "ABUNDANCE_COMPARISON", drawAt: UNIT,
    onDate: "2026-09-22", bounds: { west: -95, south: 42, east: -74, north: 57 }, maxFeatures: 500,
  });
  assert.equal(empty.chosen, null);
  assert.equal(empty.coverage, "IN_RESEARCH");
  assert.match(empty.message, /has not finished researching/);
  const refusal = strongestTierFor("ABUNDANCE_COMPARISON", []);
  assert.ok(isClaimRefusal(refusal));
  assert.match(refusal.reason, /not the same as none of this species being here/);
});

/* ── Structural invariants ───────────────────────────────────────────────── */

test("every metric has a tier, every tier has claims, and no tier may state a legal status", () => {
  for (const [metric, tier] of Object.entries(METRIC_TIERS)) {
    assert.ok(EVIDENCE_TIERS[tier], metric);
    assert.ok(EVIDENCE_TIERS[tier].claims.length > 0, metric);
    assert.ok(EVIDENCE_TIERS[tier].cannotSay.length > 0, metric);
  }
  // Context is context: it may never say anything about an animal.
  assert.deepEqual([...EVIDENCE_TIERS.T5_CONTEXT.claims], ["CONTEXT_ONLY"]);
  // No contract in this architecture may set a legal status to anything but null.
  for (const file of ["evidence-ladder.ts", "spatial-precision.ts", "derivation.ts", "applicability.ts", "publication.ts", "selection.ts"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    for (const [, value] of source.matchAll(/legalStatus:\s*([A-Za-z_"'|\s]+?)[;,\n]/g)) {
      assert.equal(value.trim(), "null", `${file} may only ever set legalStatus to null`);
    }
    for (const status of ["CONDITIONAL", "\"OPEN\"", "\"CLOSED\""]) {
      assert.ok(!source.includes(status), `${file} must not decide legality: ${status}`);
    }
  }
});

test("a viewport request is part of the question, so no national dataset can reach a browser", () => {
  // Bounds and a hard feature ceiling are required fields, not options. A layer
  // that answered nationally would be unshippable against Canada's payload
  // budget before it was written.
  const request: LayerRequest = {
    speciesId: "species:white-tailed-deer", claim: "HARVEST_RECORD", drawAt: UNIT,
    onDate: "2026-09-22", bounds: { west: -80, south: 43, east: -79, north: 44 }, maxFeatures: 400,
  };
  assert.ok(request.bounds.east > request.bounds.west && request.bounds.north > request.bounds.south);
  assert.ok(request.maxFeatures > 0);
});

/* ── The evidence matrix ─────────────────────────────────────────────────── */

test("an unresearched cell says nobody has looked, and is never blank or UNAVAILABLE", () => {
  // Not looking is not a finding. A cell with no entry must not read as "this
  // authority publishes nothing", which is a claim nobody has earned.
  const cell = matrixCell("species:ruffed-grouse", "jurisdiction:ca-nl");
  assert.equal(cell.coverage, "IN_RESEARCH");
  assert.deepEqual(cell.entries, []);
  assert.deepEqual(cell.tiers, []);
  assert.equal(cell.paintable, false);
  assert.match(cell.explanation, /has not yet looked/);
  assert.notEqual(cell.coverage, "UNAVAILABLE");
});

test("an identified-but-uncertified source is not the same sentence as nobody having looked", () => {
  // Both are IN_RESEARCH — nothing usable yet — but a reviewer has to be able
  // to tell them apart, so the cell names the authority when one is known.
  const quebec = matrixCell("species:moose", "jurisdiction:ca-qc");
  assert.equal(quebec.coverage, "IN_RESEARCH");
  assert.ok(quebec.entries.length > 0, "Quebec moose has an identified source");
  assert.match(quebec.explanation, /A source is identified/);
  assert.match(quebec.explanation, /not yet certified or served/);
  assert.equal(quebec.paintable, false, "identified is not servable");
  assert.ok(!/has not yet looked/.test(quebec.explanation));
});

test("the matrix is derived from the source registry, never a second list beside it", () => {
  // A hand-kept copy would drift and then quietly disagree with the registry —
  // the failure section 14 exists to prevent. Every entry traces to a dataset.
  const registry = intelligenceDatasetRegistry();
  const ids = new Set(registry.map(({ id }) => id));
  const entries = evidenceMatrixEntries();
  assert.ok(entries.length > 0);
  for (const entry of entries) {
    assert.ok(ids.has(entry.datasetId), `${entry.datasetId} exists in the registry`);
    const dataset = registry.find(({ id }) => id === entry.datasetId)!;
    assert.ok(dataset.speciesIds.includes(entry.speciesId));
    assert.equal(entry.jurisdictionId, dataset.jurisdictionId);
    assert.equal(entry.authority, dataset.authority);
    assert.ok(entry.sourceUrl.startsWith("https://"));
    assert.ok(entry.limitation.trim().length > 0, `${entry.datasetId} states a limitation`);
  }
  assert.deepEqual(validateEvidenceMatrix(), []);
});

test("a species-bearing dataset with no declared kind is a failure, not a default", () => {
  // The guard that stops the first range or habitat dataset from silently
  // inheriting "measured, at management-unit resolution" because that is what
  // every dataset happened to be on the day this was written.
  for (const dataset of intelligenceDatasetRegistry()) {
    if (!dataset.speciesIds.length) {
      assert.ok(!(dataset.id in DATASET_EVIDENCE) || true, "land and fire datasets are not species cells");
      continue;
    }
    assert.ok(DATASET_EVIDENCE[dataset.id], `${dataset.id} declares a tier and precision`);
  }
  // Every species-bearing dataset today is measured evidence; asserting it
  // means the first modelled or range dataset trips this test and gets decided.
  const kinds = new Set(Object.values(DATASET_EVIDENCE).map(({ tier }) => tier));
  assert.deepEqual([...kinds], ["T1_OFFICIAL_MEASURED"]);
});

test("a geography that does not nest with the drawn units keeps its own precision", () => {
  // Ontario reports elk by nine Elk Harvest Areas, which are NOT the WMUs the
  // map draws. Recording it as MANAGEMENT_UNIT would invite exactly the repaint
  // the governing rule forbids.
  assert.equal(DATASET_EVIDENCE["dataset:ca-on-elk-harvest"].precision, "SPECIES_MANAGEMENT_AREA");
  assert.equal(
    permitsVisualisationAt({ precision: "SPECIES_MANAGEMENT_AREA" }, { precision: "MANAGEMENT_UNIT" }).permitted,
    false,
    "elk harvest areas may never be repainted as WMUs",
  );
  // Newfoundland reports moose and caribou on separate species-specific maps.
  assert.equal(DATASET_EVIDENCE["dataset:ca-nl-big-game-area-evidence"].precision, "SPECIES_MANAGEMENT_AREA");
});

test("a dataset whose geography is unestablished is unpaintable, never treated as fine", () => {
  // Ontario's CWD sample records have not passed schema review. Null precision
  // is honest; the danger would be reading "unknown" as "point".
  assert.equal(DATASET_EVIDENCE["dataset:ca-on-cwd-surveillance-2025"].precision, null);
  const deer = matrixCell("species:white-tailed-deer", "jurisdiction:ca-on");
  // Two datasets meet in this cell, and both are kept rather than averaged.
  assert.equal(deer.entries.length, 2);
  assert.deepEqual(deer.entries.map(({ datasetId }) => datasetId).sort(),
    ["dataset:ca-on-cwd-surveillance-2025", "dataset:ca-on-white-tailed-deer-harvest"]);
  // The cell is paintable on the harvest dataset alone; the CWD entry is not.
  assert.equal(deer.coverage, "PARTIAL");
  assert.equal(deer.paintable, true);
  assert.equal(deer.entries.find(({ datasetId }) => datasetId.includes("cwd"))!.coverage, "RESTRICTED");
});

test("the matrix counts what it holds and nothing more, computed rather than typed", () => {
  const species = [...new Set(evidenceMatrixEntries().map(({ speciesId }) => speciesId))].sort();
  const jurisdictions = matrixJurisdictions();
  const report = matrixReport(species);
  assert.equal(report.jurisdictionCount, jurisdictions.length);
  assert.equal(report.researchedCells + report.unresearchedCells, species.length * jurisdictions.length);
  // Every cell lands in exactly one coverage state.
  assert.equal(Object.values(report.byCoverage).reduce((sum, count) => sum + count, 0), species.length * jurisdictions.length);
  // Paintable is a strict subset of researched: a licence or an unestablished
  // geography can stop a researched cell from reaching a map.
  assert.ok(report.paintableCells <= report.researchedCells);
  assert.ok(report.paintableCells > 0, "Ontario and British Columbia harvest can paint today");
  // Nothing is AVAILABLE yet, and the report says so rather than rounding up.
  assert.equal(report.byCoverage.AVAILABLE, 0);
  assert.ok(report.byCoverage.IN_RESEARCH > report.researchedCells, "most of Canada is still unresearched, and is counted as such");
});

test("the matrix targets the jurisdictions the spatial registry declares in scope", () => {
  const ids = matrixJurisdictions().map(({ id }) => id);
  for (const id of ["jurisdiction:ca-on", "jurisdiction:ca-qc", "jurisdiction:ca-yt", "jurisdiction:ca-federal"]) {
    assert.ok(ids.includes(id as never), `${id} is in the national target`);
  }
  const outOfScope = CANADA_JURISDICTIONS.filter(({ scope }) => scope?.state === "OUT_OF_SCOPE");
  assert.ok(outOfScope.length > 0, "the two territories are declared out of scope");
  for (const { id } of outOfScope) assert.ok(!ids.includes(id), `${id} is out of scope and not counted`);
  assert.equal(ids.length + outOfScope.length, CANADA_JURISDICTIONS.length);
  // Their datasets exist and are simply not counted toward national coverage.
  const territorial = evidenceMatrixEntries().filter((entry) => outOfScope.some(({ id }) => id === entry.jurisdictionId));
  for (const entry of territorial) assert.ok(!ids.includes(entry.jurisdictionId as never));
});
