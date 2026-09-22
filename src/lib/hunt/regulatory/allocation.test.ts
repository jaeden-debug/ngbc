import assert from "node:assert/strict";
import test from "node:test";
import { drawStateOn, entitlementStatement, type DrawCycle } from "./allocation.ts";

const cycle: DrawCycle = {
  id: "draw:test-primary-2026",
  name: "2026 primary draw",
  applicationOpens: "2026-03-01",
  applicationCloses: "2026-04-07",
  resultsBy: "2026-05-29",
  secondRound: { name: "2026 secondary draw", applicationOpens: "2026-06-10", applicationCloses: "2026-06-24", resultsBy: "2026-07-08" },
  leftoverSaleOpens: "2026-08-04",
  statedAs: "Test calendar",
  sourceId: "source:test",
  sourceSection: "Draw calendar",
};

test("each phase begins on its published calendar day, inclusive at both ends of the application window", () => {
  assert.equal(drawStateOn(cycle, "2026-02-28").phase, "BEFORE_APPLICATIONS");
  assert.equal(drawStateOn(cycle, "2026-03-01").phase, "APPLICATIONS_OPEN");
  assert.equal(drawStateOn(cycle, "2026-04-07").phase, "APPLICATIONS_OPEN");
  assert.equal(drawStateOn(cycle, "2026-04-08").phase, "DRAW_CLOSED");
  assert.equal(drawStateOn(cycle, "2026-05-28").phase, "DRAW_CLOSED");
  assert.equal(drawStateOn(cycle, "2026-05-29").phase, "RESULTS_PUBLISHED");
  assert.equal(drawStateOn(cycle, "2026-06-10").phase, "SECOND_ROUND_OPEN");
  assert.equal(drawStateOn(cycle, "2026-06-25").phase, "RESULTS_PUBLISHED");
  assert.equal(drawStateOn(cycle, "2026-08-04").phase, "LEFTOVER_SALE");
});

test("published results never read as this hunter having drawn", () => {
  assert.match(drawStateOn(cycle, "2026-06-01").statedAs, /Only the authority can confirm whether you drew/);
});

test("phase boundaries are calendar days and do not move with the process time zone", () => {
  const original = process.env.TZ;
  const phases: string[] = [];
  for (const zone of ["UTC", "America/Denver", "Pacific/Kiritimati", "Pacific/Pago_Pago"]) {
    process.env.TZ = zone;
    phases.push(drawStateOn(cycle, "2026-04-07").phase, drawStateOn(cycle, "2026-04-08").phase);
  }
  process.env.TZ = original;
  assert.deepEqual([...new Set(phases)], ["APPLICATIONS_OPEN", "DRAW_CLOSED"]);
});

test("the entitlement sentence for a drawn licence can never be read as permission", () => {
  const statement = entitlementStatement({ method: "DRAW", authorityTerm: "limited licence" }, "E-E-054-O1-R");
  assert.match(statement, /only to holders of a limited licence issued through the draw/);
  assert.match(statement, /cannot see whether you applied, were drawn, or hold one/);
  assert.doesNotMatch(statement, /you can hunt/i);
  for (const method of ["OVER_THE_COUNTER", "OVER_THE_COUNTER_CAPPED", "GENERAL"] as const) {
    assert.match(entitlementStatement({ method, authorityTerm: "licence" }), /not verified that you hold one/);
  }
});
