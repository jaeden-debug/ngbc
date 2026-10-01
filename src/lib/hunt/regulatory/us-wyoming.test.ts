import assert from "node:assert/strict";
import test from "node:test";
import type { HuntDimensionAnswers } from "./dimensions.ts";
import { evaluateWyoming, WYOMING_BUNDLE, wyomingCoverageReport } from "./us-wyoming.ts";
import { regulatoryEntryFor } from "./registry.ts";

/**
 * Wyoming's 2026 elk seasons, asked of the ENGINE, with every expectation
 * written from Chapter 7 (Wyoming Game and Fish Commission, dated April 22,
 * 2026) before the test was run — not read back from the bundle:
 *
 *   Section 2, p. 7-1
 *     Area 7 Type 1   archery Sep. 1 – Sep. 30, regular Oct. 15 – Nov. 20, any elk;
 *                     Nov. 21 – Dec. 31, antlerless elk (quota 1500)
 *     Area 3 Gen      Dec. 1 – Jan. 31, antlerless elk
 *     Area 6 Gen      Oct. 1 – Oct. 31, "Any elk valid off national forest"
 *   p. 7-2
 *     Area 9 Gen      Oct. 15 – Oct. 31, any elk
 *     Area 11 Type 9  Sep. 1 – Sep. 30, "Any elk, archery only"
 *   p. 7-3
 *     Area 21 Gen     Oct. 11 – Oct. 12, "Any elk; youth only"; Oct. 15 – Oct. 31, any elk
 *   p. 7-8
 *     Area 36 Gen     Oct. 10 – Nov. 5, "Antlered elk valid on national forest; any elk off
 *                     national forest"
 *   p. 7-12           Area 72: Closed
 *   p. 7-14
 *     Area 84 Type 6  Sep. 26 – Nov. 30, "Cow or calf; except that portion of Area 84 east and
 *                     south of Shoal Creek to the Hoback River shall be closed after Nov. 20"
 *   Section 6         Southern Region: 9, 10, 12, 13, 15, 21, 105-107, 110, 130
 *   Section 3(e)      Type 9 licenses are valid for "archery only"
 */

const CASPER = { latitude: 42.85, longitude: -106.32 };

const area = (designation: string, scope: "POINT" | "ZONE" = "POINT") => ({
  zoneId: `management_zone:us-wy-elk-area-${designation}`,
  zoneName: `Elk Area ${designation}`,
  ...CASPER,
  scope,
  overlays: new Set<string>(),
});

function evaluate(designation: string, date: string, answers: HuntDimensionAnswers = {}, scope: "POINT" | "ZONE" = "POINT") {
  return evaluateWyoming({ speciesId: "species:elk", speciesName: "elk", date, answers, place: area(designation, scope) });
}

const status = (evaluation: ReturnType<typeof evaluate>) =>
  evaluation.completeness === "NEEDS_INPUT" ? `ASK ${evaluation.required?.id}` : evaluation.result?.status;

const RIFLE = { HUNT_METHOD: "FIREARM" };
const BOW = { HUNT_METHOD: "BOW" };

test("the bundle is reached by the registry and covers elk", () => {
  /* Not served until Wyoming's layer licence is resolved (layers.ts), so the
     entry exists but the registry does not yet answer with it. */
  assert.equal(regulatoryEntryFor("jurisdiction:us-wy"), undefined);
  assert.deepEqual(wyomingCoverageReport().species.map((row) => row.speciesId), ["species:elk"]);
});

test("in Area 7 the first question is which license, offering only licenses valid there", () => {
  const asked = evaluate("7", "2026-10-20");
  assert.equal(status(asked), "ASK HUNT_CODE");
  const offered = asked.required!.options.map((option) => option.value);
  for (const code of ["Area 7 Type 1", "Area 7 Type 2", "Area 7 Type 6", "Area 7 Type 8"]) assert.ok(offered.includes(code), code);
  assert.ok(!offered.includes("General (resident)"), "Area 7 has no general season");
  assert.ok(!offered.includes("Area 1 Type 1"), "another area's license is not offered here");
});

test("Area 7 Type 1: in season Oct. 15, not the day before, and antlerless only after Nov. 20", () => {
  const code = { HUNT_CODE: "Area 7 Type 1" };
  assert.equal(status(evaluate("7", "2026-10-14", { ...code, ...RIFLE })), "CLOSED", "the day before the regular opening");
  assert.equal(status(evaluate("7", "2026-10-14", { ...code, ...BOW })), "CLOSED", "the archery season ended Sep. 30");
  const open = evaluate("7", "2026-10-15", { ...code, ...RIFLE });
  assert.equal(status(open), "CONDITIONAL");
  assert.deepEqual(open.opportunities?.filter((row) => row.windows.some((window) => window.opens === "2026-10-15")).map((row) => row.animalClass), [{ state: "STATED", value: "ANTLERED or ANTLERLESS" }]);
  assert.ok(open.result!.authorization, "the answer names the license it depends on");
  assert.equal(open.result!.authorization!.entitlementVerified, false);
  assert.equal(status(evaluate("7", "2026-11-20", { ...code, ...RIFLE })), "CONDITIONAL");
  const late = evaluate("7", "2026-12-01", { ...code, ...RIFLE });
  assert.equal(status(late), "CONDITIONAL");
  assert.deepEqual(late.opportunities?.filter((row) => row.windows.some((window) => window.opens <= "2026-12-01" && window.closes >= "2026-12-01")).map((row) => row.animalClass), [{ state: "STATED", value: "ANTLERLESS" }]);
  assert.equal(status(evaluate("7", "2027-01-01", { ...code, ...RIFLE })), "CLOSED", "Type 1 closes Dec. 31");
});

test("a rifle is not legal in a special archery season; a bow is", () => {
  const code = { HUNT_CODE: "Area 7 Type 1" };
  assert.equal(status(evaluate("7", "2026-09-15", { ...code, ...RIFLE })), "CLOSED");
  assert.equal(status(evaluate("7", "2026-09-15", { ...code, ...BOW })), "CONDITIONAL");
  assert.equal(status(evaluate("7", "2026-09-15", { ...code, HUNT_METHOD: "CROSSBOW" })), "CONDITIONAL", "Chapter 32 s. 3(a): archery equipment includes crossbows");
  const archery = evaluate("7", "2026-09-15", { ...code, ...BOW }).result!;
  assert.ok(archery.requirements.some((line) => /archery license/.test(line)), "the archery license is named");
  assert.ok(!archery.requirements.some((line) => /fluorescent orange/.test(line)), "archers in a special archery season are exempt from orange");
  const regular = evaluate("7", "2026-10-20", { ...code, ...RIFLE }).result!;
  assert.ok(regular.requirements.some((line) => /fluorescent orange/.test(line)), "orange in a regular season");
});

test("a Type 9 license is archery only, all season", () => {
  const code = { HUNT_CODE: "Area 11 Type 9" };
  assert.equal(status(evaluate("11", "2026-09-10", { ...code, ...RIFLE })), "CLOSED");
  assert.equal(status(evaluate("11", "2026-09-10", { ...code, ...BOW })), "CONDITIONAL");
  assert.equal(status(evaluate("11", "2026-10-01", { ...code, ...BOW })), "CLOSED", "Type 9 closes Sep. 30");
});

test("a license for another area does not authorise hunting here", () => {
  const result = evaluate("1", "2026-10-20", { HUNT_CODE: "Area 7 Type 1", ...RIFLE }).result!;
  assert.equal(result.status, "CLOSED");
  assert.match(result.summary, /does not cover Elk Area 1/);
});

test("a closed area is closed, and a federal-permit area is not answered", () => {
  assert.equal(status(evaluate("72", "2026-10-20")), "CLOSED");
  assert.equal(status(evaluate("75", "2026-11-20")), "UNKNOWN");
  assert.equal(status(evaluate("77", "2026-11-20")), "UNKNOWN");
});

test("a nonresident region general license is valid only in its own region", () => {
  assert.equal(status(evaluate("9", "2026-10-20", { HUNT_CODE: "Nonresident Southern Region general", ...RIFLE })), "CONDITIONAL");
  assert.equal(status(evaluate("9", "2026-10-20", { HUNT_CODE: "General (resident)", ...RIFLE })), "CONDITIONAL");
  assert.equal(status(evaluate("9", "2026-10-20", { HUNT_CODE: "Nonresident Eastern Region general", ...RIFLE })), "CLOSED");
  assert.equal(status(evaluate("9", "2026-10-14", { HUNT_CODE: "General (resident)", ...RIFLE })), "CLOSED", "the day before Oct. 15");
});

test("Area 21's youth-only general days are closed to an adult and open to a youth", () => {
  const general = { HUNT_CODE: "General (resident)", ...RIFLE };
  assert.equal(status(evaluate("21", "2026-10-11", general)), "ASK HUNTER_AGE");
  assert.equal(status(evaluate("21", "2026-10-11", { ...general, HUNTER_AGE: "YOUTH" })), "CONDITIONAL");
  assert.equal(status(evaluate("21", "2026-10-11", { ...general, HUNTER_AGE: "NOT_YOUTH" })), "CLOSED");
  assert.equal(status(evaluate("21", "2026-10-20", { ...general, HUNTER_AGE: "NOT_YOUTH" })), "CONDITIONAL");
});

test("a season valid only off national forest needs a closer look, quoting the definition", () => {
  const result = evaluate("6", "2026-10-15", { HUNT_CODE: "General (resident)", ...RIFLE }).result!;
  assert.equal(result.status, "NEEDS_VERIFICATION");
  assert.ok(JSON.stringify(result).includes("national forest"));
});

test("Area 36's general season is open everywhere for an antlered elk, so the land is not asked about", () => {
  /* "Antlered elk valid on national forest; any elk off national forest":
     an antlered elk is legal on both sides, so not knowing the land must not
     withhold the answer. */
  const result = evaluate("36", "2026-10-20", { HUNT_CODE: "General (resident)", ...RIFLE }).result!;
  assert.equal(result.status, "CONDITIONAL");
});

test("Area 84 Type 6 is open to Nov. 20 everywhere, and after it outside the closed portion only", () => {
  const code = { HUNT_CODE: "Area 84 Type 6", ...RIFLE };
  assert.equal(status(evaluate("84", "2026-11-20", code)), "CONDITIONAL");
  const after = evaluate("84", "2026-11-21", code).result!;
  assert.equal(after.status, "NEEDS_VERIFICATION");
  assert.ok(JSON.stringify(after).includes("Shoal Creek"), "the regulation's own words for the closed portion are shown");
});

test("a season that crosses the new year runs to Jan. 31, and the certified period ends there", () => {
  const general = { HUNT_CODE: "General (resident)", ...RIFLE };
  assert.equal(status(evaluate("3", "2027-01-31", general)), "CONDITIONAL");
  assert.equal(status(evaluate("3", "2027-02-01", general)), "NEEDS_VERIFICATION");
  assert.equal(status(evaluate("3", "2026-07-31", general)), "NEEDS_VERIFICATION");
});

test("legal hours are computed at a point from Chapter 2, and refused for a whole area", () => {
  const point = evaluate("9", "2026-10-20", { HUNT_CODE: "General (resident)", ...RIFLE }).result!;
  assert.equal(point.legalTime?.status, "RESOLVED");
  const zone = evaluate("9", "2026-10-20", { HUNT_CODE: "General (resident)", ...RIFLE }, "ZONE").result!;
  assert.equal(zone.legalTime?.status, "NOT_CERTIFIED");
});

test("every legal class a rule names is defined in the bundle", () => {
  const defined = new Set((WYOMING_BUNDLE as unknown as { legalAnimalClasses: Array<{ id: string }> }).legalAnimalClasses.map((entry) => entry.id));
  for (const rule of WYOMING_BUNDLE.rules as Array<{ id: string; declaredNoSeason: boolean; legalAnimalClassIds?: string[] }>) {
    if (rule.declaredNoSeason) continue;
    assert.ok(rule.legalAnimalClassIds?.length, `${rule.id} names no class`);
    for (const id of rule.legalAnimalClassIds!) assert.ok(defined.has(id), `${rule.id}: ${id}`);
  }
});
