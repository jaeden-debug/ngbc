import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildRegistry } from "../../../../scripts/build-us-jurisdiction-registry.mjs";
import { northAmericaCoverageReport, regulatoryJurisdictionsForSpecies, unitedStatesCoverageReport } from "../north-america/report.ts";
import { regulatoryEntryFor } from "../regulatory/registry.ts";
import { ZONE_LAYERS } from "../zone-layers.ts";
import { CERTIFIED_STATES, UNITED_STATES_JURISDICTIONS } from "./registry.ts";

const research = (file: string) => readFileSync(new URL(`../../../../research/hunting/us/${file}`, import.meta.url), "utf8");

test("the registry is exactly what the research inventory produces, so fifty-one entries are never retyped", () => {
  const committed = JSON.parse(readFileSync(new URL("./jurisdictions.generated.json", import.meta.url), "utf8"));
  assert.deepEqual(committed, buildRegistry(research("state-coverage-matrix.csv"), research("source-manifest.csv")));
});

test("every state and D.C. is tracked once, plus the federal layer, and none is claimed without evidence", () => {
  const states = UNITED_STATES_JURISDICTIONS.filter((entry) => entry.kind !== "federal");
  assert.equal(states.length, 51);
  assert.equal(new Set(UNITED_STATES_JURISDICTIONS.map((entry) => entry.id)).size, 52);
  assert.ok(UNITED_STATES_JURISDICTIONS.some((entry) => entry.id === "jurisdiction:us-federal"));
  for (const entry of UNITED_STATES_JURISDICTIONS) {
    assert.ok(entry.knownGaps.length > 0 || entry.regulatory.bundleIds.length > 0, `${entry.code} declares no gaps and no bundle`);
    if (!(entry.code in CERTIFIED_STATES)) {
      assert.notEqual(entry.spatial.status, "VERIFIED", `${entry.code} is VERIFIED without a certification entry`);
      assert.equal(entry.spatial.parityCertified, false);
      assert.deepEqual(entry.regulatory.bundleIds, []);
    }
  }
});

test("a state is parity-certified in the registry only with a recorded certification and a served layer", () => {
  for (const [code, certified] of Object.entries(CERTIFIED_STATES)) {
    if (!certified.spatial.parityCertified) continue;
    const key = code.toLowerCase();
    const record = JSON.parse(readFileSync(new URL(`../../../../fixtures/hunt/${key}-spatial-parity.json`, import.meta.url), "utf8"));
    assert.equal(record.disagreements, 0, `${code} parity record has disagreements`);
    assert.ok(ZONE_LAYERS.some((layer) => layer.jurisdictionId === `jurisdiction:${key}` && layer.serving), `${code} has no served layer`);
  }
});

test("coverage is computed from the regulatory registry: a state without an entry has no rules and says so", () => {
  const report = unitedStatesCoverageReport();
  assert.equal(report.totals.statesAndDistrict, 51);
  for (const entry of report.jurisdictions) {
    const served = regulatoryEntryFor(entry.id);
    if (!served) {
      assert.equal(entry.regulatory.rules, 0, `${entry.code} reports rules with no served registry entry`);
      assert.deepEqual(entry.species, []);
    }
  }
  assert.equal(report.totals.rules, report.jurisdictions.reduce((total, entry) => total + entry.regulatory.rules, 0));
});

test("species coverage spans both countries from one report and never implies a jurisdiction without rules", () => {
  const report = northAmericaCoverageReport();
  const everywhere = [...report.canada.jurisdictions, ...report.unitedStates.jurisdictions];
  for (const speciesId of ["species:ruffed-grouse", "species:white-tailed-deer", "species:elk", "species:mallard"]) {
    const listed = regulatoryJurisdictionsForSpecies(speciesId, report).map((entry) => entry.id);
    const expected = everywhere.filter((entry) => entry.species.some((row) => row.speciesId === speciesId)).map((entry) => entry.id);
    assert.deepEqual(listed, expected);
  }
  // Waterfowl needs the federal framework on both sides of the border; nothing certifies it yet.
  assert.deepEqual(regulatoryJurisdictionsForSpecies("species:mallard", report), []);
});
