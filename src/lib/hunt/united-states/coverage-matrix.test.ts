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
  assert.equal(byCode.get("ID")!.huntingHours.status, "RULE_CERTIFIED_EXACT_CLOCK_UNAVAILABLE");
  assert.equal(byCode.get("ID")!.readyToHunt, "PARTIAL");
  assert.equal(byCode.get("MT")!.productionStatus, "REGULATIONS_ONLY");
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
