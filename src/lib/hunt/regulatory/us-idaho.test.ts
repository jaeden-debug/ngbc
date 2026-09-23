import assert from "node:assert/strict";
import test from "node:test";
import type { HuntDimensionAnswers } from "./dimensions.ts";
import { evaluateIdaho, IDAHO_BUNDLE, idahoCoverageReport } from "./us-idaho.ts";

/**
 * Idaho's 2026 pronghorn controlled hunts, with every expectation written from
 * the Big Game 2026 Seasons and Rules before the test was run:
 *
 *   p. 63  "All pronghorn hunting, including archery seasons, is by controlled hunt."
 *   pp. 63–66
 *          4007  Unit 39, 40 tags, Sep 25 – Oct 24 (either sex)
 *          4051  Unit 39, 5 tags, Aug 15 – Sep 15, youth, archery only
 *          4052  Unit 39, 25 tags, Oct 25 – Dec 31, youth, doe or fawn only
 *          4001  Hunt Area 29-1, 40 tags, Sep 25 – Oct 24
 *          4005  Hunt Area 37-1, 60 tags, Sep 25 – Oct 24
 *          4028  Hunt Area 30A-1, unlimited 1st choice only, Aug 15 – Sep 15, buck only, archery
 *          4027  Hunt Area 28-1, unlimited 1st choice only, Aug 15 – Sep 15, buck only, archery
 *   p. 67  Hunt Area 29-1 — All of Unit 29 except the Poison Creek drainage.
 *          Hunt Area 37-1 — All of Units 37 and 37A, and that part of Unit 29 in the
 *          Poison Creek drainage.
 *          Hunt Area 30A-1 — All of Units 21A, 29, 30, and 30A.
 *   No booklet hunt names Unit 1.
 */

const unit = (designation: string) => ({
  zoneId: `management_zone:us-id-gmu-${designation.toLowerCase()}`,
  zoneName: `Unit ${designation}`,
  latitude: 44.5,
  longitude: -114.0,
  overlays: new Set<string>(),
});

function evaluate(designation: string, date: string, answers: HuntDimensionAnswers = {}) {
  return evaluateIdaho({ speciesId: "species:pronghorn", speciesName: "pronghorn", date, answers, place: unit(designation) });
}

const status = (evaluation: ReturnType<typeof evaluate>) =>
  evaluation.completeness === "NEEDS_INPUT" ? `ASK ${evaluation.required?.id}` : evaluation.result?.status;

test("in Unit 39 the only question is which controlled hunt, offering only the hunts that reach Unit 39", () => {
  const asked = evaluate("39", "2026-10-01");
  assert.equal(status(asked), "ASK HUNT_CODE");
  assert.deepEqual(asked.required!.options.map((option) => option.value).sort(), ["4007", "4051", "4052"]);
});

test("hunt 4007 runs Sep 25 to Oct 24 inclusive, and is never said to be open to someone not drawn", () => {
  assert.equal(status(evaluate("39", "2026-09-24", { HUNT_CODE: "4007" })), "CLOSED");
  const open = evaluate("39", "2026-09-25", { HUNT_CODE: "4007" }).result!;
  assert.equal(open.status, "CONDITIONAL");
  assert.equal(status(evaluate("39", "2026-10-24", { HUNT_CODE: "4007" })), "CONDITIONAL");
  assert.equal(status(evaluate("39", "2026-10-25", { HUNT_CODE: "4007" })), "CLOSED");
  assert.ok(open.authorization, "the answer carries the controlled hunt it depends on");
  assert.equal(open.authorization!.entitlementVerified, false);
  assert.match(open.summary, /assuming you hold/);
  assert.ok(open.requirements.some((line) => /controlled hunt tag/.test(line)));
});

test("the youth doe-or-fawn hunt 4052 runs to Dec 31, across no new year", () => {
  assert.equal(status(evaluate("39", "2026-12-31", { HUNT_CODE: "4052" })), "CONDITIONAL");
  assert.equal(status(evaluate("39", "2027-01-01", { HUNT_CODE: "4052" })), "CLOSED");
});

test("a hunt whose area is only part of this unit is NEEDS_VERIFICATION, quoting the written description", () => {
  assert.equal(status(evaluate("29", "2026-08-20", { HUNT_CODE: "4028" })), "CONDITIONAL", "30A-1 includes all of Unit 29");
  for (const code of ["4001", "4005"]) {
    const result = evaluate("29", "2026-10-01", { HUNT_CODE: code }).result!;
    assert.equal(result.status, "NEEDS_VERIFICATION", code);
  }
  const partial = evaluate("29", "2026-10-01", { HUNT_CODE: "4001" }).result!;
  assert.ok(JSON.stringify(partial).includes("Poison Creek"), "the booklet's own words for the part are shown");
});

test("a tag for a hunt whose area is elsewhere is answered, never ignored", () => {
  /* 4027 is Hunt Area 28-1 and does not reach Unit 39. Dropping that answer
     would evaluate the hunts that DO reach Unit 39 and tell this hunter the
     season is open, which is the one thing their tag does not do. */
  const result = evaluate("39", "2026-08-20", { HUNT_CODE: "4027" }).result!;
  assert.equal(result.status, "CLOSED");
  assert.match(result.summary, /does not cover Unit 39/);
  assert.match(result.summary, /Hunt Area 28-1/);
  assert.match(result.summary, /does not authorise hunting here/);
});

test("a unit no booklet hunt names is UNKNOWN, never CLOSED, and says what North Ground has not certified", () => {
  const result = evaluate("1", "2026-10-01").result!;
  assert.equal(result.status, "UNKNOWN");
  assert.ok(result.limitations.some((line) => /Landowner Permission Hunts/.test(line.text)));
});

test("a date outside the 2026 booklet's period is not answered with 2026 rules", () => {
  assert.equal(status(evaluate("39", "2027-07-01", { HUNT_CODE: "4007" })), "NEEDS_VERIFICATION");
});

test("every hunt is a drawn controlled hunt with its published quota; unlimited is not a number", () => {
  const codes = IDAHO_BUNDLE.huntCodes!;
  assert.equal(codes.length, 54);
  assert.ok(codes.every((code) => code.allocation.method === "DRAW" && code.allocation.drawCycleId === "draw:us-id-controlled-hunts-2026"));
  assert.equal(codes.find((code) => code.code === "4007")!.allocation.quota!.count, 40);
  assert.equal(codes.find((code) => code.code === "4027")!.allocation.quota!.count, null);
  assert.deepEqual(idahoCoverageReport().species.map((row) => row.speciesId), ["species:pronghorn"]);
});
