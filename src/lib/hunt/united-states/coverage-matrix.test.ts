import assert from "node:assert/strict";
import test from "node:test";
import { unitedStatesCoverageMatrix } from "./coverage-matrix.ts";

test("all 50 states and D.C. have one explicit production row with official sources", () => {
  const rows = unitedStatesCoverageMatrix();
  assert.equal(rows.length, 51);
  assert.equal(new Set(rows.map((row) => row.code)).size, 51);
  for (const row of rows) {
    assert.match(row.authority.url, /^https:\/\//);
    assert.match(row.regulationsSource.url, /^https:\/\//);
    assert.ok(row.managementGeography.length > 0);
    assert.ok(row.knownGaps.length > 0);
  }
});

test("production status follows the actual serving path, not research depth", () => {
  const byCode = new Map(unitedStatesCoverageMatrix().map((row) => [row.code, row]));
  assert.equal(byCode.get("ID")!.productionStatus, "PARTIAL");
  /* Promoted 2026-09-30, on purpose. Idaho's clock is now computed for every
     CERTIFIED unit: 49 CFR § 71.9(a) runs the mountain/Pacific line along the
     Idaho County / Lemhi County boundary and then the main channel of the Salmon
     River, and Idaho County's own TIGERweb polygon used as a spatial filter
     against IDFG's GMU service shows 22 units intersecting it with NONE of the
     42 certified units among them. It stays PARTIAL rather than COMPLETE because
     one species of a 99-unit system is not a complete state. */
  assert.equal(byCode.get("ID")!.huntingHours.status, "CERTIFIED_EXACT_POINT");
  /* The scope is the load-bearing half: a clock for SOME units is not a clock
     for the state, and the record must say which. */
  assert.match(byCode.get("ID")!.huntingHours.detail, /every CERTIFIED unit/);
  assert.equal(byCode.get("ID")!.readyToHunt, "PARTIAL");
  assert.equal(byCode.get("MT")!.productionStatus, "REGULATIONS_ONLY");
  /* Wyoming's elk bundle has no law-first cases (regulations PARTIAL) and its
     layer does not serve: nothing reaches a hunter, so production is never
     PARTIAL above a state like Colorado whose rules are fully certified. */
  assert.equal(byCode.get("WY")!.regulations.status, "PARTIAL");
  assert.equal(byCode.get("WY")!.productionStatus, "REGULATIONS_ONLY");
  assert.equal(byCode.get("MT")!.huntingHours.status, "CERTIFIED_EXACT_POINT");
  assert.equal(byCode.get("ID")!.regulationsSource.verificationStatus, "CERTIFIED");
  assert.equal(byCode.get("ID")!.boundarySource?.verificationStatus, "CERTIFIED_PARITY");
  assert.ok(!byCode.get("ID")!.knownGaps.some((gap) => gap.startsWith("No geometry ingested")));
  assert.equal(byCode.get("MT")!.regulationsSource.verificationStatus, "CERTIFIED");
  assert.equal(byCode.get("MT")!.boundarySource?.verificationStatus, "CERTIFIED_PARITY");
  assert.ok(!byCode.get("MT")!.knownGaps.some((gap) => gap.startsWith("No geometry ingested")));
  assert.equal(byCode.get("AK")!.productionStatus, "UNSUPPORTED");
  assert.equal(byCode.get("HI")!.productionStatus, "UNSUPPORTED");
});

test("no state can silently claim complete before the full path is represented", () => {
  assert.deepEqual(unitedStatesCoverageMatrix().filter((row) => row.productionStatus === "COMPLETE"), []);
});
