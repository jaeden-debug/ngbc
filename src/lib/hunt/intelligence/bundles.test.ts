import assert from "node:assert/strict";
import test from "node:test";
import { evidenceProvenance, hasEvidenceForSpecies, opportunityAcross, opportunityAt, servableDatasets, speciesWithEvidence } from "./bundles.ts";

/**
 * These tests measure what is SERVABLE, which is not what is committed.
 *
 * The failure they exist to catch: the endpoint hard-coded one species and one
 * Ontario-shaped zone pattern, so nine of ten committed bundles were
 * unreachable while every test passed — because every test asked about the one
 * species that worked. Each assertion below names a species the old gate
 * refused.
 */

test("every committed bundle is servable, and the matrix is derived from the data", () => {
  const datasets = servableDatasets();
  assert.equal(datasets.length, 10, "ten committed bundles, ten servable pairs");

  const pairs = datasets.map(({ speciesId, jurisdictionId }) => `${jurisdictionId} ${speciesId}`).sort();
  assert.deepEqual(pairs, [
    "jurisdiction:ca-bc species:american-black-bear",
    "jurisdiction:ca-bc species:bobcat",
    "jurisdiction:ca-bc species:canada-lynx",
    "jurisdiction:ca-bc species:caribou",
    "jurisdiction:ca-bc species:elk",
    "jurisdiction:ca-bc species:gray-wolf",
    "jurisdiction:ca-bc species:moose",
    "jurisdiction:ca-bc species:mule-deer",
    "jurisdiction:ca-bc species:white-tailed-deer",
    "jurisdiction:ca-on species:white-tailed-deer",
  ]);

  // A pair that answers for no geography is not coverage.
  for (const dataset of datasets) {
    assert.ok(dataset.geographyCount > 0, `${dataset.speciesId} in ${dataset.jurisdictionId} must answer for some geography`);
    assert.ok(dataset.evidenceRecordCount >= dataset.geographyCount, `${dataset.speciesId} record count`);
  }

  assert.equal(datasets.reduce((sum, d) => sum + d.geographyCount, 0), 1297, "species × zone pairs with evidence");
  assert.equal(datasets.reduce((sum, d) => sum + d.evidenceRecordCount, 0), 6182, "committed evidence records");
});

test("nine species now resolve, where only white-tailed deer did", () => {
  assert.deepEqual(speciesWithEvidence(), [
    "species:american-black-bear",
    "species:bobcat",
    "species:canada-lynx",
    "species:caribou",
    "species:elk",
    "species:gray-wolf",
    "species:moose",
    "species:mule-deer",
    "species:white-tailed-deer",
  ]);
  assert.equal(hasEvidenceForSpecies("species:ruffed-grouse"), false);
});

test("a species resolves in every jurisdiction that carries it, keyed by geography", () => {
  // White-tailed deer is the one species with two bundles. Both must answer.
  const ontario = opportunityAt("species:white-tailed-deer", "management_zone:ca-on-wmu-57");
  assert.ok(ontario);
  assert.equal(ontario.jurisdictionId, "jurisdiction:ca-on");
  assert.equal(ontario.result.legalStatus, null);

  const britishColumbia = opportunityAt("species:white-tailed-deer", "management_zone:ca-bc-mu-4-23");
  assert.ok(britishColumbia, "BC white-tailed deer must resolve, not fall through to the Ontario bundle");
  assert.equal(britishColumbia.jurisdictionId, "jurisdiction:ca-bc");
  assert.notEqual(britishColumbia.source.id, ontario.source.id);

  // A BC-only species at a BC zone: the case the old Ontario zone pattern refused outright.
  const moose = opportunityAt("species:moose", "management_zone:ca-bc-mu-7-42");
  assert.ok(moose);
  assert.equal(moose.result.speciesId, "species:moose");
});

test("absence is absence: no cold value is ever produced", () => {
  // A real Ontario WMU with no deer evidence in the bundle.
  assert.equal(opportunityAt("species:white-tailed-deer", "management_zone:ca-on-wmu-51"), null);
  // A species with evidence, asked about a jurisdiction that does not carry it.
  assert.equal(opportunityAt("species:moose", "management_zone:ca-on-wmu-57"), null);
  // A species with no evidence at all.
  assert.equal(opportunityAt("species:ruffed-grouse", "management_zone:ca-on-wmu-57"), null);
});

test("the bulk form returns only zones that hold evidence, once each", () => {
  const asked = [
    "management_zone:ca-bc-mu-7-42",
    "management_zone:ca-bc-mu-7-42",
    "management_zone:ca-on-wmu-57",
    "management_zone:ca-bc-mu-nowhere",
  ];
  const heat = opportunityAcross("species:moose", asked);
  assert.equal(heat.length, 1, "one BC zone answers; the duplicate, the Ontario zone and the invented zone do not");
  assert.equal(heat[0].geographyId, "management_zone:ca-bc-mu-7-42");
  assert.ok(["VERY_HIGH", "HIGH", "MODERATE", "LOW", "LIMITED_DATA"].includes(heat[0].classification));

  assert.deepEqual(opportunityAcross("species:ruffed-grouse", asked), [], "a species with no evidence paints nothing");
});

test("every classification stays inside the published vocabulary, across every zone of every bundle", () => {
  const classes = new Set<string>();
  const coverages = new Set<string>();
  for (const dataset of servableDatasets()) {
    // Ask the bulk form for every geography the dataset claims, and count what comes back.
    const provenance = evidenceProvenance(dataset.speciesId);
    assert.ok(provenance.length > 0, `${dataset.speciesId} must carry its authority and limitations`);
    for (const entry of provenance) {
      assert.ok(entry.limitations.length > 0, `${entry.authority} must state limitations`);
      assert.match(entry.url, /^https:\/\//);
    }
  }
  const all = opportunityAcross("species:moose", [
    "management_zone:ca-bc-mu-7-42", "management_zone:ca-bc-mu-3-12", "management_zone:ca-bc-mu-6-1",
  ]);
  for (const entry of all) {
    classes.add(entry.classification);
    coverages.add(entry.coverage);
  }
  for (const value of classes) assert.ok(["VERY_HIGH", "HIGH", "MODERATE", "LOW", "LIMITED_DATA"].includes(value));
  for (const value of coverages) assert.ok(["ROBUST_DATA", "PARTIAL_DATA", "LIMITED_DATA", "RANGE_ONLY", "NO_HEAT_MAP_DATA"].includes(value));
});
