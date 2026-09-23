import assert from "node:assert/strict";
import { test } from "node:test";
import { BRITISH_COLUMBIA_BUNDLE, evaluateBritishColumbia } from "./british-columbia.ts";
import type { HuntDimensionAnswers } from "./dimensions.ts";

/**
 * British Columbia's first wave against B.C. Reg. 190/84, consolidated to
 * September 15, 2026. Every expectation below was written from the schedule's
 * own words (quoted in each case) before the engine was run.
 */

function evaluate(unit: string, speciesId: string, date: string, answers: HuntDimensionAnswers = {}) {
  return evaluateBritishColumbia({
    speciesId,
    speciesName: speciesId.slice("species:".length).replace(/-/g, " "),
    date,
    answers,
    place: {
      zoneId: `management_zone:ca-bc-mu-${unit}`,
      zoneName: `Management Unit ${unit}`,
      latitude: 50,
      longitude: -120,
      overlays: new Set(),
    },
  });
}

const status = (unit: string, speciesId: string, date: string, answers: HuntDimensionAnswers = {}) => {
  const outcome = evaluate(unit, speciesId, date, answers);
  return outcome.completeness === "NEEDS_INPUT" ? `ASK ${outcome.required?.id}` : outcome.result?.status;
};

test("the bundle is built from the regulation, for 225 units, over one certified year", () => {
  assert.equal(BRITISH_COLUMBIA_BUNDLE.officialUnitCount, 225);
  assert.deepEqual(BRITISH_COLUMBIA_BUNDLE.certifiedPeriod.from, "2026-07-01");
  assert.deepEqual(BRITISH_COLUMBIA_BUNDLE.certifiedPeriod.to, "2027-06-30");
  assert.match(BRITISH_COLUMBIA_BUNDLE.sourceVersion, /B\.C\. Reg\. 190\/84, consolidated to September 15, 2026/);
  assert.equal(BRITISH_COLUMBIA_BUNDLE.absence.meaning, "UNKNOWN");
});

test("Kamloops (M.U. 3-20): ruffed grouse Sept. 10 to Nov. 30 (Schedule 3 item 28), nothing asked", () => {
  assert.equal(status("3-20", "species:ruffed-grouse", "2026-10-15"), "CONDITIONAL");
  assert.equal(status("3-20", "species:ruffed-grouse", "2026-12-15"), "CLOSED");
});

test("Thompson youth grouse, Sept. 1 to Sept. 9, is for persons under 18 only (Schedule 3 s. 9 (d))", () => {
  assert.equal(status("3-20", "species:spruce-grouse", "2026-09-05"), "ASK HUNTER_AGE");
  assert.equal(status("3-20", "species:spruce-grouse", "2026-09-05", { HUNTER_AGE: "UNDER_18" }), "CONDITIONAL");
  assert.equal(status("3-20", "species:spruce-grouse", "2026-09-05", { HUNTER_AGE: "ADULT" }), "CLOSED");
});

test("Thompson spring black bear: the regulation says to June 20, the synopsis June 30; only June 21–30 is a conflict", () => {
  // Schedule 3 item 14: "3-12 to 3-20, 3-26 to 3-44 | Apr. 1 to June 20 Sept. 1 to Nov. 30".
  assert.equal(status("3-20", "species:american-black-bear", "2027-05-15"), "CONDITIONAL");
  assert.equal(status("3-20", "species:american-black-bear", "2027-06-25"), "CONFLICT");
  // Between the spring and fall seasons, inside the certified year.
  assert.equal(status("3-20", "species:american-black-bear", "2026-07-05"), "CLOSED");
  // Item 16: M.U. 3-46 "Apr. 1 to June 30" — no dispute there.
  assert.equal(status("3-46", "species:american-black-bear", "2027-06-25"), "CONDITIONAL");
});

test("Kootenay black bear: a bow only season Sept. 1 to Sept. 9 (Schedule 4 s. 15 (2)), a crossbow counts as a bow", () => {
  assert.equal(status("4-3", "species:american-black-bear", "2026-09-05"), "ASK HUNT_METHOD");
  assert.equal(status("4-3", "species:american-black-bear", "2026-09-05", { HUNT_METHOD: "BOW" }), "CONDITIONAL");
  assert.equal(status("4-3", "species:american-black-bear", "2026-09-05", { HUNT_METHOD: "CROSSBOW" }), "CONDITIONAL");
  assert.equal(status("4-3", "species:american-black-bear", "2026-09-05", { HUNT_METHOD: "RIFLE" }), "CLOSED");
  // Item 17: Sept. 10 to Nov. 30 for every method.
  assert.equal(status("4-3", "species:american-black-bear", "2026-09-15"), "CONDITIONAL");
});

test("Kootenay black bear in August is open on private property only (Schedule 4 s. 21): the point cannot be settled", () => {
  const outcome = evaluate("4-3", "species:american-black-bear", "2026-08-15");
  assert.equal(outcome.result?.status, "NEEDS_VERIFICATION");
  assert.ok(outcome.result?.limitations.some((line) => /private property/i.test(line.text)) || /private property/i.test(outcome.result?.summary ?? ""));
});

test("closures inside a unit with no boundary North Ground holds are never answered as open", () => {
  // Schedule 3 s. 8: no sharp-tailed grouse season in 3-30 south of the Scottie Creek FSR.
  assert.equal(status("3-30", "species:sharp-tailed-grouse", "2026-10-01"), "NEEDS_VERIFICATION");
  assert.equal(status("3-31", "species:sharp-tailed-grouse", "2026-10-01"), "CONDITIONAL");
  // Schedule 1 s. 12: Denman Island (1-6) is closed to upland game birds; s. 5 closes Sandy Island park.
  assert.equal(status("1-6", "species:ruffed-grouse", "2026-10-01"), "NEEDS_VERIFICATION");
  // Schedule 6 s. 18: mapped portions of 6-3 and 6-11 closed to black bear.
  assert.equal(status("6-11", "species:american-black-bear", "2026-09-01"), "NEEDS_VERIFICATION");
  assert.equal(status("6-9", "species:american-black-bear", "2026-09-01"), "CONDITIONAL");
});

test("Okanagan youth grouse: Part 2 and the synopsis state it, Part 1 lists no row — a conflict, never a guess", () => {
  // Schedule 8 s. 15 (d) restricts a Sept. 1 to Sept. 9 grouse season to persons under 18.
  assert.equal(status("8-9", "species:ruffed-grouse", "2026-09-05", { HUNTER_AGE: "UNDER_18" }), "CONFLICT");
  assert.equal(status("8-9", "species:ruffed-grouse", "2026-09-05", { HUNTER_AGE: "ADULT" }), "CLOSED");
  // Item 21: Sept. 10 to Nov. 30; s. 11: bow only Dec. 1 to Dec. 10.
  assert.equal(status("8-9", "species:ruffed-grouse", "2026-10-01"), "CONDITIONAL");
  assert.equal(status("8-9", "species:ruffed-grouse", "2026-12-05", { HUNT_METHOD: "BOW" }), "CONDITIONAL");
  assert.equal(status("8-9", "species:ruffed-grouse", "2026-12-05", { HUNT_METHOD: "SHOTGUN" }), "CLOSED");
});

test("northern British Columbia: Atlin ptarmigan to Feb. 28 and snowshoe hare through winter (Schedule 6 items 28, 30)", () => {
  // Item 30: "6-7, 6-14, 6-16 to 6-29 | Aug. 15 to Feb. 28".
  assert.equal(status("6-25", "species:willow-ptarmigan", "2027-02-15"), "CONDITIONAL");
  assert.equal(status("6-25", "species:rock-ptarmigan", "2027-03-05"), "CLOSED");
  // Item 28: "6-1 to 6-30 | Apr. 1 to Apr. 30 Aug. 1 to Mar. 31".
  assert.equal(status("6-25", "species:snowshoe-hare", "2027-01-10"), "CONDITIONAL");
});

test("a unit no row names for the species is UNKNOWN, not closed; a date outside the certified year is not an answer", () => {
  // Region 8 has no ptarmigan row at all.
  assert.equal(status("8-9", "species:willow-ptarmigan", "2026-10-01"), "UNKNOWN");
  // July 2027 is after the certified year ends.
  assert.notEqual(status("3-20", "species:american-black-bear", "2027-07-15"), "CONDITIONAL");
});

test("Omineca-Peace grouse: Sept. 1 to Nov. 15 (Schedule 7 items 51–54); the unexplained \"**\" is recorded, not invented", () => {
  const outcome = evaluate("7-15", "species:spruce-grouse", "2026-10-01");
  assert.equal(outcome.result?.status, "CONDITIONAL");
  assert.ok(outcome.result?.limitations.some((line) => /contains no clause naming spruce or ruffed grouse/.test(line.text)));
  assert.equal(status("7-15", "species:spruce-grouse", "2026-11-20"), "CLOSED");
});

test("every answer carries British Columbia's legal hours and its standing limits, never another province's", () => {
  const outcome = evaluate("3-20", "species:ruffed-grouse", "2026-10-15");
  assert.match(outcome.result!.legalTime.text, /one hour after sunset/);
  const text = JSON.stringify(outcome.result);
  assert.match(text, /Limited entry hunting/);
  assert.match(text, /Aboriginal or treaty rights/);
  assert.doesNotMatch(text, /Ontario|Manitoba|Alberta|Québec/);
});
