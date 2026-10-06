import assert from "node:assert/strict";
import test from "node:test";
import type { HuntDimensionAnswers } from "./dimensions.ts";
import { evaluateWyoming, WYOMING_BUNDLE, WYOMING_VOCABULARY, wyomingCoverageReport } from "./us-wyoming.ts";
import { evaluateConditional, type ConditionalBundle } from "./conditional-engine.ts";
import { classesFor, satisfies } from "./physical-criterion.ts";
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

test("a class narrower than antlered is never printed as antlered", () => {
  /* Area 113 Type 3 (p. 7-20): "Spike or antlerless elk", Nov. 5 – Dec. 31.
     Area 22 Type 2 (p. 7-4): "Antlered elk five (5) points or less on either
     antler", Oct. 15 – Oct. 31. A row reading "Antlered" for either would tell
     a hunter a six-point bull is legal. */
  const spike = evaluate("113", "2026-11-10", { HUNT_CODE: "Area 113 Type 3", ...RIFLE });
  assert.equal(status(spike), "CONDITIONAL");
  assert.deepEqual(spike.opportunities?.filter((row) => row.windows.some((window) => window.opens === "2026-11-05")).map((row) => row.animalClass),
    [{ state: "STATED", value: "SPIKE or ANTLERLESS" }]);
  const points = evaluate("22", "2026-10-20", { HUNT_CODE: "Area 22 Type 2", ...RIFLE });
  assert.equal(status(points), "CONDITIONAL");
  assert.deepEqual(points.opportunities?.filter((row) => row.windows.some((window) => window.opens === "2026-10-15")).map((row) => row.animalClass),
    [{ state: "STATED", value: "ANTLERED_FIVE_POINTS_OR_LESS" }]);
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

/* ── Pins found by mutation (2026-10-01) ─────────────────────────────────────
 *
 * Each value below was changed IN THE BUILDER (scripts/build-us-wy-elk.mjs),
 * the bundle rebuilt, and `npm test` run. Every test in this block exists
 * because the suite stayed green under one of those mutations. Expectations
 * are written from Chapter 7 (dated April 22, 2026) and the 2026 elk brochure,
 * and each is read from the ENGINE's answer, anchored to the rule it names by
 * id — never by searching bundle text, where a second copy of a figure (a
 * statedAs, a label) can pass while the operative value drifts.
 */

type BundleRule = { id: string; legalAnimalClassIds?: string[]; conditionIds: string[] };
const RULES = WYOMING_BUNDLE.rules as unknown as BundleRule[];
const RULE = (suffix: string) => `regulatory_rule:us-wy-elk-2026-${suffix}`;

function ruleById(id: string): BundleRule {
  const rule = RULES.find((entry) => entry.id === id);
  assert.ok(rule, `${id} is in the bundle`);
  return rule!;
}

function opportunity(evaluation: ReturnType<typeof evaluate>, ruleId: string) {
  const row = evaluation.opportunities?.find((entry) => entry.ruleId === ruleId);
  assert.ok(row, `${ruleId} is an opportunity in this answer`);
  return row!;
}

const classOf = (evaluation: ReturnType<typeof evaluate>, ruleId: string) => {
  const row = opportunity(evaluation, ruleId);
  return row.animalClass.state === "STATED" ? row.animalClass.value : row.animalClass.state;
};

test("each limitation's animal class reaches the answer as its own class, never a broader or a different one", () => {
  /* Section 2: Area 1 Type 4 Oct. 25 – Nov. 30 "Antlerless elk"; Area 118
     Type 1 Oct. 22 – Nov. 12 "Antlered elk"; Area 7 Type 6 Oct. 15 – Dec. 31
     "Cow or calf"; Area 67 General Oct. 11 – Oct. 31 "Antlered elk, spikes
     excluded"; Area 84 General Sep. 26 – Oct. 31 "Any elk, spikes excluded";
     Area 124 Type 2 Oct. 25 – Nov. 30 "Antlered elk four (4) points or less
     on either antler". Antlered and antlerless transposed, cow-or-calf read
     as antlerless, or a spike exclusion or point maximum dropped, each tells a
     hunter an animal is legal that is not. */
  const cases: Array<[string, string, string, string, string]> = [
    ["1", "2026-11-01", "Area 1 Type 4", RULE("area-1-type-4-row-1-regular"), "ANTLERLESS"],
    ["118", "2026-11-01", "Area 118 Type 1", RULE("area-118-type-1-row-1-regular"), "ANTLERED"],
    ["7", "2026-11-01", "Area 7 Type 6", RULE("area-7-type-6-row-1-regular"), "COW_OR_CALF"],
    ["67", "2026-10-20", "General (resident)", RULE("general-resident-row-29-regular"), "ANTLERED_SPIKES_EXCLUDED"],
    ["84", "2026-10-01", "General (resident)", RULE("general-resident-row-49-regular"), "ANTLERED_SPIKES_EXCLUDED or ANTLERLESS"],
    ["124", "2026-11-01", "Area 124 Type 2", RULE("area-124-type-2-row-2-regular"), "ANTLERED_FOUR_POINTS_OR_LESS"],
  ];
  for (const [designation, date, code, ruleId, expected] of cases) {
    const evaluation = evaluate(designation, date, { HUNT_CODE: code, ...RIFLE });
    assert.equal(status(evaluation), "CONDITIONAL", `${code} in Area ${designation} on ${date}`);
    assert.equal(classOf(evaluation, ruleId), expected, ruleId);
  }
  /* Cow or calf is its own class, not antlerless: a yearling bull with no
     visible antler is antlerless (Chapter 2 s. 2(d)) and is not a cow or calf. */
  assert.deepEqual(ruleById(RULE("area-7-type-6-row-1-regular")).legalAnimalClassIds, ["legal_animal_class:us-wy-elk-cow-or-calf"]);
  assert.deepEqual(ruleById(RULE("area-1-type-4-row-1-regular")).legalAnimalClassIds, ["legal_animal_class:us-wy-elk-antlerless"]);
});

test("a point maximum is the legal test: five points pass Area 22 Type 2 and fail Area 124 Type 2", () => {
  /* "Antlered elk five (5) points or less on either antler" (Area 22 Type 2)
     and "... four (4) points or less ..." (Area 124 Type 2), a point being any
     protrusion of one inch or more (Chapter 2 s. 2(oo)). The class each rule
     names is looked up by the id the rule carries, and its criterion asked. */
  const classes = classesFor(WYOMING_BUNDLE as unknown as Parameters<typeof classesFor>[0], "species:elk");
  const criterionOf = (ruleId: string) => {
    const [classId] = ruleById(ruleId).legalAnimalClassIds!;
    const entry = classes.find((candidate) => candidate.id === classId);
    assert.ok(entry?.criterion, `${classId} carries a criterion`);
    return entry!.criterion!;
  };
  const points = (value: number) => ({ value, unit: "points" as const });
  const five = criterionOf(RULE("area-22-type-2-row-1-regular"));
  const four = criterionOf(RULE("area-124-type-2-row-2-regular"));
  assert.equal(five.comparator, "AT_MOST");
  assert.equal(four.comparator, "AT_MOST");
  assert.equal(satisfies(five, points(5)), true, "a five-point bull is legal under five or less");
  assert.equal(satisfies(five, points(6)), false, "a six-point bull is not");
  assert.equal(satisfies(four, points(4)), true, "a four-point bull is legal under four or less");
  assert.equal(satisfies(four, points(5)), false, "a five-point bull is not");
});

test("a regular season admits every legal weapon; a special archery season only bow and crossbow", () => {
  /* Chapter 2 s. 11: archery equipment and firearms may be used in regular
     seasons. Chapter 7 s. 3(b) and Chapter 32 s. 3(a): a special archery
     season is archery equipment, which includes crossbows. */
  const code = { HUNT_CODE: "Area 7 Type 1" };
  for (const method of ["FIREARM", "MUZZLELOADER", "SHOTGUN", "BOW", "CROSSBOW"]) {
    assert.equal(status(evaluate("7", "2026-10-20", { ...code, HUNT_METHOD: method })), "CONDITIONAL", `${method}, regular season`);
  }
  for (const method of ["FIREARM", "MUZZLELOADER", "SHOTGUN"]) {
    assert.equal(status(evaluate("7", "2026-09-15", { ...code, HUNT_METHOD: method })), "CLOSED", `${method}, special archery season`);
  }
  const implementsOf = (date: string, ruleId: string) => {
    const row = opportunity(evaluate("7", date, { ...code, ...BOW }), ruleId);
    return row.implements.state === "STATED" ? [...row.implements.value].sort() : row.implements.state;
  };
  assert.deepEqual(implementsOf("2026-10-20", RULE("area-7-type-1-row-1-regular")), ["BOW", "CROSSBOW", "FIREARM", "MUZZLELOADER", "SHOTGUN"]);
  assert.deepEqual(implementsOf("2026-09-15", RULE("area-7-type-1-row-1-archery")), ["BOW", "CROSSBOW"]);
});

test("orange is a regular-season rule: required of an archer then, not in a special archery or Type 9 season", () => {
  /* Brochure p. 9: orange or pink "during an open regular season"; "Archers
     and crossbow hunters hunting during a special archery season or limited
     quota archery only Type 9 season are exempt from this requirement." */
  const orange = (line: string) => /fluorescent orange/.test(line);
  const type9 = evaluate("11", "2026-09-10", { HUNT_CODE: "Area 11 Type 9", ...BOW });
  assert.equal(status(type9), "CONDITIONAL");
  assert.ok(!type9.result!.requirements.some(orange), "Type 9 is exempt");
  assert.ok(!opportunity(type9, RULE("area-11-type-9-row-1-regular")).conditionIds.includes("wy-hunter-orange"));
  assert.ok(evaluate("7", "2026-10-20", { HUNT_CODE: "Area 7 Type 1", ...BOW }).result!.requirements.some(orange),
    "an archer in a regular season is not exempt");
});

test("Area 94 Type 7's closed portion is excluded in both its seasons; Type 6 has none", () => {
  /* Section 2, Area 94 Type 7, Sep. 1 – Sep. 30 and Nov. 1 – Dec. 15: "Cow or
     calf; except that portion of Area 94 between Middle Piney Road ... west to
     Forest Road 10046 shall be closed". Type 6 (Oct. 1 – Nov. 30, "Cow or
     calf") has no such exception. */
  const regular = evaluate("94", "2026-11-10", { HUNT_CODE: "Area 94 Type 7", ...RIFLE }).result!;
  assert.equal(regular.status, "NEEDS_VERIFICATION");
  assert.ok(JSON.stringify(regular).includes("Middle Piney Road"));
  assert.equal(status(evaluate("94", "2026-09-15", { HUNT_CODE: "Area 94 Type 7", ...BOW })), "NEEDS_VERIFICATION");
  assert.equal(status(evaluate("94", "2026-11-10", { HUNT_CODE: "Area 94 Type 6", ...RIFLE })), "CONDITIONAL");
});

test("off national forest is the complement of on it, tested with the land known", () => {
  /* North Ground holds no land-administration boundary, so the bundle keeps
     these parts UNRESOLVED and the engine answers NEEDS_VERIFICATION on both
     sides — which cannot tell "off" from "on". Here the part is made testable
     (OVERLAY) and the point placed on each side of it, so the ENGINE says
     which side Chapter 7 opened. Area 6 General: "Any elk valid off national
     forest", Oct. 1 – Oct. 31. Area 36 General: "Antlered elk valid on
     national forest; any elk off national forest", Oct. 10 – Nov. 5. */
  const known = (specialId: string) => {
    const bundle = structuredClone(WYOMING_BUNDLE) as unknown as ConditionalBundle;
    const entry = bundle.specialGeographies?.find((candidate) => candidate.id === specialId);
    assert.ok(entry, `${specialId} is a special geography`);
    entry!.resolution = "OVERLAY";
    return bundle;
  };
  const at = (bundle: ConditionalBundle, designation: string, date: string, onForest: boolean) =>
    evaluateConditional(bundle, WYOMING_VOCABULARY, {
      speciesId: "species:elk", speciesName: "elk", date,
      answers: { HUNT_CODE: "General (resident)", ...RIFLE },
      place: { ...area(designation), overlays: new Set(onForest ? [`us-wy-elk-area-${designation}-on-national-forest`] : []) },
    });
  const six = known("us-wy-elk-area-6-on-national-forest");
  assert.equal(at(six, "6", "2026-10-15", false).result?.status, "CONDITIONAL", "Area 6, off national forest");
  assert.equal(at(six, "6", "2026-10-15", true).result?.status, "CLOSED", "Area 6, on national forest");
  const thirtySix = known("us-wy-elk-area-36-on-national-forest");
  const tokens = (evaluation: ReturnType<typeof evaluateConditional>) => [...new Set((evaluation.opportunities ?? [])
    .flatMap((row) => row.animalClass.state === "STATED" ? row.animalClass.value.split(" or ") : []))].sort();
  const on = at(thirtySix, "36", "2026-10-20", true);
  const off = at(thirtySix, "36", "2026-10-20", false);
  assert.equal(on.result?.status, "CONDITIONAL");
  assert.equal(off.result?.status, "CONDITIONAL");
  assert.deepEqual(tokens(on), ["ANTLERED"], "on national forest: antlered only");
  assert.deepEqual(tokens(off), ["ANTLERED", "ANTLERLESS"], "off national forest: any elk");
});

test("each license carries its own quota: limited quota per Section 2, region general per Section 6(b)", () => {
  /* Section 2: Area 7 Type 1 quota 1500, Area 7 Type 2 quota 500. Section
     6(b): Eastern 1000, Southern 1050, Western 2775. A resident general
     license has no quota. */
  const allocationOf = (designation: string, date: string, code: string) => {
    const result = evaluate(designation, date, { HUNT_CODE: code, ...RIFLE }).result!;
    assert.equal(result.status, "CONDITIONAL", `${code} in Area ${designation}`);
    const huntCode = result.authorization?.huntCodes.find((entry) => entry.code === code);
    assert.ok(huntCode, `${code} is the authorization named`);
    return huntCode!.allocation;
  };
  assert.equal(allocationOf("7", "2026-10-20", "Area 7 Type 1").quota?.count, 1500);
  assert.equal(allocationOf("7", "2026-11-25", "Area 7 Type 2").quota?.count, 500);
  assert.equal(allocationOf("3", "2026-10-01", "Nonresident Eastern Region general").quota?.count, 1000);
  assert.equal(allocationOf("9", "2026-10-20", "Nonresident Southern Region general").quota?.count, 1050);
  assert.equal(allocationOf("84", "2026-10-01", "Nonresident Western Region general").quota?.count, 2775);
  const resident = allocationOf("9", "2026-10-20", "General (resident)");
  assert.equal(resident.method, "GENERAL");
  assert.equal(resident.quota, undefined);
});

test("the bag is one elk per license, a season limit", () => {
  /* Chapter 2 s. 3: "one (1) elk per license". */
  const limits = evaluate("7", "2026-10-20", { HUNT_CODE: "Area 7 Type 1", ...RIFLE }).result!.harvestLimits!;
  assert.deepEqual(limits.map((limit) => [limit.kind, limit.count]), [["SEASON", 1]]);
});

test("the Elk Special Management Permit is named in Areas 70 and 98 and not in Area 9", () => {
  /* Section 7(a): "Elk Hunt Areas 70, 71, 75, 77, 78, 80-98". */
  const permit = (line: string) => /Special Management Permit/.test(line);
  const general = { HUNT_CODE: "General (resident)", ...RIFLE };
  for (const [designation, date] of [["70", "2026-10-20"], ["98", "2026-10-10"]]) {
    const result = evaluate(designation, date, general).result!;
    assert.equal(result.status, "CONDITIONAL", `Area ${designation}`);
    assert.ok(result.requirements.some(permit), `Area ${designation} requires the permit`);
  }
  assert.ok(!evaluate("9", "2026-10-20", general).result!.requirements.some(permit), "Area 9 does not");
});

test("a youth may take antlerless on an antlered-only license, and the line follows the class", () => {
  /* Section 5: a youth whose full price license is valid for an antlered elk
     may take an antlerless elk instead. Area 118 Type 1 is antlered only;
     Area 1 Type 4 is antlerless already. */
  const youth = (line: string) => /youth hunter whose full price license/.test(line);
  assert.ok(evaluate("118", "2026-11-01", { HUNT_CODE: "Area 118 Type 1", ...RIFLE }).result!.requirements.some(youth));
  assert.ok(!evaluate("1", "2026-11-01", { HUNT_CODE: "Area 1 Type 4", ...RIFLE }).result!.requirements.some(youth));
});

test("\"also valid in Area 128\" carries Area 23 Type 1 into Area 128 for those rows only", () => {
  /* Section 2, Area 23 Type 1: Oct. 1 – Oct. 21 "Any elk"; Nov. 1 – Nov. 21
     and Dec. 1 – Dec. 15 "Any elk; also valid in Area 128". */
  const code = { HUNT_CODE: "Area 23 Type 1", ...RIFLE };
  const november = evaluate("128", "2026-11-10", code);
  assert.equal(status(november), "CONDITIONAL");
  opportunity(november, RULE("area-23-type-1-row-2-regular"));
  assert.equal(status(evaluate("128", "2026-12-10", code)), "CONDITIONAL");
  assert.equal(status(evaluate("128", "2026-10-10", code)), "CLOSED", "the October row is Area 23 only");
  assert.ok(evaluate("128", "2026-11-10").required!.options.some((option) => option.value === "Area 23 Type 1"), "offered in Area 128");
});
