import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
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
  assert.equal(datasets.length, 49, "forty-nine committed bundles, forty-nine servable pairs");

  /* The thirteen harvest datasets. The thirty-six Eastern Waterfowl Survey
     bundles are asserted separately, below, because what they may claim is
     different and the difference is the point. */
  const pairs = datasets
    .filter(({ renderKind }) => renderKind !== "SAMPLE_PLOT")
    .map(({ speciesId, jurisdictionId }) => `${jurisdictionId} ${speciesId}`).sort();
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
    "jurisdiction:ca-on species:american-black-bear",
    "jurisdiction:ca-on species:moose",
    "jurisdiction:ca-on species:white-tailed-deer",
    "jurisdiction:ca-on species:wild-turkey",
  ]);

  // A pair that answers for no geography is not coverage.
  for (const dataset of datasets) {
    assert.ok(dataset.geographyCount > 0, `${dataset.speciesId} in ${dataset.jurisdictionId} must answer for some geography`);
    assert.ok(dataset.evidenceRecordCount >= dataset.geographyCount, `${dataset.speciesId} record count`);
  }

  assert.equal(datasets.reduce((sum, d) => sum + d.geographyCount, 0), 3943, "species × geography pairs with evidence");
  assert.equal(datasets.reduce((sum, d) => sum + d.evidenceRecordCount, 0), 9116, "committed evidence records");
});

test("nineteen species now resolve, where only white-tailed deer did", () => {
  assert.deepEqual(speciesWithEvidence(), [
    "species:american-black-bear",
    "species:american-black-duck",
    "species:blue-winged-teal",
    "species:bobcat",
    "species:bufflehead",
    "species:canada-goose",
    "species:canada-lynx",
    "species:caribou",
    "species:common-goldeneye",
    "species:elk",
    "species:gray-wolf",
    "species:green-winged-teal",
    "species:mallard",
    "species:moose",
    "species:mule-deer",
    "species:ring-necked-duck",
    "species:white-tailed-deer",
    "species:wild-turkey",
    "species:wood-duck",
  ]);
  assert.equal(hasEvidenceForSpecies("species:ruffed-grouse"), false);
  /* Recorded by the survey, on too few plots to rank. Refused by the plot-share
     floor rather than absent from the source — see the builder's output. */
  assert.equal(hasEvidenceForSpecies("species:barrows-goldeneye"), false);
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
  // A species with evidence in this jurisdiction, asked about a unit the
  // authority did not report it in. Ontario now carries moose, so this is the
  // stronger version of the same case: a served dataset that is silent here.
  assert.equal(opportunityAt("species:moose", "management_zone:ca-on-wmu-51"), null);
  // A species with evidence, asked about a jurisdiction that does not carry it.
  assert.equal(opportunityAt("species:bobcat", "management_zone:ca-on-wmu-57"), null);
  // A species with no evidence at all.
  assert.equal(opportunityAt("species:ruffed-grouse", "management_zone:ca-on-wmu-57"), null);
});

test("the bulk form returns only zones that hold evidence, once each", () => {
  const asked = [
    "management_zone:ca-bc-mu-7-42",
    "management_zone:ca-bc-mu-7-42",
    "management_zone:ca-on-wmu-51",
    "management_zone:ca-bc-mu-nowhere",
  ];
  const heat = opportunityAcross("species:moose", asked);
  assert.equal(heat.length, 1, "one BC zone answers; the duplicate, the unreported Ontario zone and the invented zone do not");
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

/**
 * A rank attributed to a metric it was not computed from is a fabricated
 * number on a sourced record (§61), and the composite is the mean of those
 * numbers, so it reaches the map.
 *
 * `build-bc-harvest-evidence.mjs` passed `harvestRanks` as the normalizedValue
 * for HARVEST_TOTAL, HUNTER_COUNT and HUNTER_DAYS alike. Nothing caught it:
 * the coverage class counts DISTINCT METRICS, not independent values, so five
 * metrics carrying three values still graded ROBUST_DATA. The signature is
 * structural — one metric's series being a copy of another's — so the test is
 * written against the signature rather than against the two fields that had it.
 *
 * Deliberately not "these two never tie": zero-harvest units tie legitimately,
 * and MU 3-14 and MU 3-17 tie on three of five metrics for that honest reason.
 * A copy shows up as agreement on EVERY geography at once.
 */
test("no metric's normalized series is a copy of another metric's", () => {
  const dir = new URL("../../../../content/intelligence/", import.meta.url);
  const files = readdirSync(dir).filter((name) => name.startsWith("ca-") && name.endsWith(".json"));
  assert.ok(files.length >= 10, "every committed bundle is examined");

  for (const file of files) {
    const bundle = JSON.parse(readFileSync(new URL(file, dir), "utf8")) as {
      evidence: Array<{ geographyId: string; metric: string; normalizedValue?: number }>;
    };
    const series = new Map<string, Map<string, number>>();
    for (const record of bundle.evidence) {
      if (typeof record.normalizedValue !== "number") continue;
      const byGeography = series.get(record.metric) ?? new Map<string, number>();
      byGeography.set(record.geographyId, record.normalizedValue);
      series.set(record.metric, byGeography);
    }
    const metrics = [...series.keys()].sort();
    for (let i = 0; i < metrics.length; i += 1) {
      for (let j = i + 1; j < metrics.length; j += 1) {
        const left = series.get(metrics[i])!;
        const right = series.get(metrics[j])!;
        const shared = [...left.keys()].filter((geographyId) => right.has(geographyId));
        // A series with one distinct value carries no information to copy.
        if (shared.length < 2 || new Set(shared.map((id) => left.get(id)!)).size < 2) continue;
        const identical = shared.every((geographyId) => left.get(geographyId) === right.get(geographyId));
        assert.equal(
          identical,
          false,
          `${file}: ${metrics[j]} carries ${metrics[i]}'s rank on all ${shared.length} geographies — it was never ranked on its own series`,
        );
      }
    }
  }
});
