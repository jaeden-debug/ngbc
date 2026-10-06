import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { HuntDimensionAnswers } from "./dimensions.ts";
import { COLORADO_BUNDLE, evaluateColorado } from "./us-colorado.ts";
import { sunriseSunset, wallClock } from "./solar.ts";

/**
 * Colorado's legally decisive values, each pinned by asking the ENGINE.
 *
 * Every expectation here was written from 2 CCR 406-3, Chapter W-3 (07/16/2026,
 * effective September 1, 2026) and Chapter W-0 (05/06/2026), and each was then
 * confirmed to fail when the value it guards was mutated IN THE BUILDER
 * (`scripts/build-us-co-small-game.mjs`) or in `colorado-legal-time.ts` and the
 * bundle rebuilt. They read the answer the engine gives at one of CPW's own
 * sample points, and anchor it to the rule that produced it BY ID — never by
 * searching the bundle's text, where a second copy of a figure (a statedAs, a
 * note) can survive while the operative value drifts.
 *
 * They pin RELATIONS as well as figures: daily against possession, the
 * implements one class of animal is given against another, the one I-25 line
 * that decides three different things, the units inside a list against every
 * unit outside it.
 */

const PARITY = JSON.parse(readFileSync(new URL("../../../../fixtures/hunt/us-co-gmu-live-parity.json", import.meta.url), "utf8")) as {
  results: Array<{ kind: string; latitude: number; longitude: number; official: string[]; agree: boolean }>;
};

function sampleIn(unit: string): { latitude: number; longitude: number } | undefined {
  const sample = PARITY.results.find((result) => result.kind === "inside" && result.agree && result.official.length === 1 && result.official[0] === unit);
  return sample && { latitude: sample.latitude, longitude: sample.longitude };
}

function pointIn(unit: string): { latitude: number; longitude: number } {
  const point = sampleIn(unit);
  if (!point) throw new Error(`no CPW sample inside unit ${unit}`);
  return point;
}

/** Every Colorado unit CPW's service placed a sample inside: the ground the relation pins below walk. */
const SAMPLED_UNITS = (COLORADO_BUNDLE.units ?? []).map((unit) => (unit as { identifier: string }).identifier).filter((unit) => sampleIn(unit));

function evaluate(speciesId: string, date: string, unit: string, answers: HuntDimensionAnswers = {}) {
  const { latitude, longitude } = pointIn(unit);
  return evaluateColorado({
    speciesId, speciesName: speciesId.slice(8).replace(/-/g, " "), date, answers,
    place: { zoneId: `management_zone:us-co-gmu-${unit}`, zoneName: `Game Management Unit ${unit}`, latitude, longitude, overlays: new Set(), scope: "POINT" },
  });
}

const RULE = (slug: string) => `regulatory_rule:us-co-small-game-2026-${slug}`;

/** The rules the engine answered from, by id — what the answer actually rests on. */
const rulesOf = (evaluation: ReturnType<typeof evaluate>) => (evaluation.opportunities ?? []).map((row) => row.ruleId).sort();

const status = (evaluation: ReturnType<typeof evaluate>) =>
  evaluation.completeness === "NEEDS_INPUT" ? `ASK ${evaluation.required?.id}` : evaluation.result?.status;

/** A condition's text, found by its id: the line the engine adds to the requirements when that condition reaches the hunt. */
const CONDITIONS = new Map(
  (COLORADO_BUNDLE.sources as unknown as Array<{ conditions?: Array<{ id: string; text: string }> }>)
    .flatMap((source) => source.conditions ?? [])
    .map((condition) => [condition.id, condition.text]),
);
function carries(evaluation: ReturnType<typeof evaluate>, conditionId: string): boolean {
  const text = CONDITIONS.get(conditionId);
  assert.ok(text, `no condition ${conditionId} in the bundle`);
  return (evaluation.result?.requirements ?? []).some((line) => line.startsWith(text!));
}

const METHODS = ["RIFLE", "HANDGUN", "SHOTGUN", "BOW", "CROSSBOW", "AIR_GUN", "SLINGSHOT", "FALCONRY"] as const;
type Method = (typeof METHODS)[number];

/* ── #303: the methods each class of animal is given ──────────────────────── */

/*
 * #303(B) game mammals: rifles, handguns, shotguns, bows, crossbows, air guns, slingshots, hawking.
 * #303(C) game birds: shotguns, bows, crossbows, hawking — and rifles, handguns, air guns and
 *         slingshots for dusky grouse and ptarmigan ONLY.
 * #303(E) furbearers: rifles, handguns, shotguns, bows, crossbows, air guns — no slingshot, no hawking.
 * "Any method of take not listed herein shall be prohibited."
 */
const GAME_MAMMAL: readonly Method[] = METHODS;
const GROUSE_AND_PTARMIGAN: readonly Method[] = METHODS;
const OTHER_GAME_BIRD: readonly Method[] = ["SHOTGUN", "BOW", "CROSSBOW", "FALCONRY"];
const FURBEARER: readonly Method[] = ["RIFLE", "HANDGUN", "SHOTGUN", "BOW", "CROSSBOW", "AIR_GUN"];

const METHOD_CASES: Array<{
  what: string; speciesId: string; unit: string; date: string; answers?: HuntDimensionAnswers;
  legal: readonly Method[]; rule: string; falconryRule?: string;
}> = [
  { what: "cottontail (#303(B))", speciesId: "species:mountain-cottontail", unit: "12", date: "2026-11-01", answers: { SEASON_TYPE: "REGULAR" }, legal: GAME_MAMMAL, rule: "mountain-cottontail-statewide", falconryRule: "mountain-cottontail-falconry" },
  { what: "Abert's squirrel (#303(B))", speciesId: "species:aberts-squirrel", unit: "59", date: "2026-12-01", legal: GAME_MAMMAL, rule: "aberts-squirrel-statewide" },
  { what: "marmot (#303(B))", speciesId: "species:yellow-bellied-marmot", unit: "12", date: "2026-09-15", legal: GAME_MAMMAL, rule: "yellow-bellied-marmot-statewide" },
  { what: "dusky grouse (#303(C))", speciesId: "species:dusky-grouse", unit: "12", date: "2026-10-01", legal: GROUSE_AND_PTARMIGAN, rule: "dusky-grouse-west-of-i25", falconryRule: "dusky-grouse-west-of-i25-falconry" },
  { what: "ptarmigan (#303(C))", speciesId: "species:white-tailed-ptarmigan", unit: "4", date: "2026-09-20", legal: GROUSE_AND_PTARMIGAN, rule: "white-tailed-ptarmigan-statewide-except", falconryRule: "white-tailed-ptarmigan-falconry" },
  { what: "greater sage-grouse (#303(C))", speciesId: "species:greater-sage-grouse", unit: "2", date: "2026-09-12", legal: OTHER_GAME_BIRD, rule: "greater-sage-grouse", falconryRule: "greater-sage-grouse-falconry" },
  { what: "sharp-tailed grouse (#303(C))", speciesId: "species:sharp-tailed-grouse", unit: "4", date: "2026-09-05", legal: OTHER_GAME_BIRD, rule: "sharp-tailed-grouse", falconryRule: "sharp-tailed-grouse-falconry" },
  { what: "chukar (#303(C))", speciesId: "species:chukar", unit: "12", date: "2026-10-01", legal: OTHER_GAME_BIRD, rule: "chukar-statewide", falconryRule: "chukar-falconry" },
  { what: "pheasant east of I-25 (#303(C))", speciesId: "species:ring-necked-pheasant", unit: "101", date: "2026-12-01", legal: OTHER_GAME_BIRD, rule: "ring-necked-pheasant-east-of-i25", falconryRule: "ring-necked-pheasant-falconry" },
  { what: "pheasant west of I-25 (#303(C))", speciesId: "species:ring-necked-pheasant", unit: "12", date: "2026-12-01", legal: OTHER_GAME_BIRD, rule: "ring-necked-pheasant-west-of-i25", falconryRule: "ring-necked-pheasant-falconry" },
  { what: "scaled quail (#303(C))", speciesId: "species:scaled-quail", unit: "140", date: "2026-12-01", legal: OTHER_GAME_BIRD, rule: "scaled-quail-area-1", falconryRule: "scaled-quail-falconry" },
  { what: "greater prairie-chicken (#303(C))", speciesId: "species:greater-prairie-chicken", unit: "101", date: "2026-10-10", legal: OTHER_GAME_BIRD, rule: "greater-prairie-chicken" },
  { what: "red fox (#303(E))", speciesId: "species:red-fox", unit: "12", date: "2026-12-01", legal: FURBEARER, rule: "red-fox-statewide" },
  { what: "coyote (#303(E))", speciesId: "species:coyote", unit: "101", date: "2027-07-04", legal: FURBEARER, rule: "coyote-statewide" },
  { what: "bobcat (#303(E))", speciesId: "species:bobcat", unit: "12", date: "2026-12-15", legal: FURBEARER, rule: "bobcat-statewide" },
  { what: "beaver (#303(E))", speciesId: "species:beaver", unit: "101", date: "2026-10-15", legal: FURBEARER, rule: "beaver-statewide" },
];

test("#303: every method is legal exactly where Chapter W-3 lists it, and answered from the rule that lists it", () => {
  for (const item of METHOD_CASES) {
    for (const method of METHODS) {
      const evaluation = evaluate(item.speciesId, item.date, item.unit, { ...item.answers, HUNT_METHOD: method });
      const where = `${item.what} with ${method}`;
      if (!item.legal.includes(method) && !(method === "FALCONRY" && item.falconryRule)) {
        assert.equal(status(evaluation), "CLOSED", `${where}: #303 does not list it`);
        assert.deepEqual(rulesOf(evaluation), [], where);
        continue;
      }
      assert.equal(status(evaluation), "CONDITIONAL", `${where}: #303 lists it`);
      const expected = [
        ...(item.legal.includes(method) ? [RULE(item.rule)] : []),
        ...(method === "FALCONRY" && item.falconryRule ? [RULE(item.falconryRule)] : []),
      ].sort();
      assert.deepEqual(rulesOf(evaluation), expected, where);
      for (const row of evaluation.opportunities ?? []) {
        assert.ok(row.implements.state === "STATED" && row.implements.value.includes(method), `${where}: ${row.ruleId} must list ${method}`);
      }
    }
  }
});

test("#303: the rifle and the slingshot divide the classes — grouse and ptarmigan and game mammals take them, other game birds and furbearers do not", () => {
  /* The relation, independent of any one species: transposing two classes' lists must fail here. */
  const legalFor = (speciesId: string, unit: string, date: string, method: Method, answers: HuntDimensionAnswers = {}) =>
    status(evaluate(speciesId, date, unit, { ...answers, HUNT_METHOD: method })) === "CONDITIONAL";
  for (const method of ["RIFLE", "SLINGSHOT"] as const) {
    assert.equal(legalFor("species:dusky-grouse", "12", "2026-10-01", method), true, `dusky grouse: ${method}`);
    assert.equal(legalFor("species:mountain-cottontail", "12", "2026-11-01", method, { SEASON_TYPE: "REGULAR" }), true, `cottontail: ${method}`);
    assert.equal(legalFor("species:ring-necked-pheasant", "12", "2026-12-01", method), false, `pheasant: ${method}`);
    assert.equal(legalFor("species:greater-sage-grouse", "2", "2026-09-12", method), false, `sage-grouse: ${method}`);
  }
  assert.equal(legalFor("species:coyote", "101", "2027-07-04", "RIFLE"), true);
  assert.equal(legalFor("species:coyote", "101", "2027-07-04", "SLINGSHOT"), false, "#303(E) gives a furbearer no slingshot");
});

/* ── Bag and possession limits (#306–#326 (B)) ───────────────────────────── */

const LIMIT_CASES: Array<{ speciesId: string; unit: string; date: string; answers: HuntDimensionAnswers; rule: string; daily: number; possession?: number; section: string }> = [
  { speciesId: "species:mountain-cottontail", unit: "12", date: "2026-11-01", answers: { SEASON_TYPE: "REGULAR", HUNT_METHOD: "SHOTGUN" }, rule: "mountain-cottontail-statewide", daily: 10, possession: 20, section: "#306(B)" },
  { speciesId: "species:desert-cottontail", unit: "101", date: "2026-11-01", answers: { SEASON_TYPE: "REGULAR", HUNT_METHOD: "SHOTGUN" }, rule: "desert-cottontail-statewide", daily: 10, possession: 20, section: "#306(B)" },
  { speciesId: "species:snowshoe-hare", unit: "12", date: "2026-11-01", answers: { SEASON_TYPE: "REGULAR", HUNT_METHOD: "SHOTGUN" }, rule: "snowshoe-hare-statewide", daily: 10, possession: 20, section: "#306(B)" },
  { speciesId: "species:white-tailed-jackrabbit", unit: "101", date: "2026-11-01", answers: { SEASON_TYPE: "REGULAR", HUNT_METHOD: "SHOTGUN" }, rule: "white-tailed-jackrabbit-statewide", daily: 10, possession: 20, section: "#306(B)" },
  { speciesId: "species:aberts-squirrel", unit: "59", date: "2026-12-01", answers: { HUNT_METHOD: "SHOTGUN" }, rule: "aberts-squirrel-statewide", daily: 2, possession: 4, section: "#307(B)" },
  { speciesId: "species:fox-squirrel", unit: "101", date: "2026-11-01", answers: { HUNT_METHOD: "SHOTGUN" }, rule: "fox-squirrel-statewide", daily: 5, possession: 10, section: "#308(B)" },
  { speciesId: "species:american-red-squirrel", unit: "12", date: "2026-11-01", answers: { HUNT_METHOD: "SHOTGUN" }, rule: "american-red-squirrel-statewide", daily: 5, possession: 10, section: "#308(B)" },
  { speciesId: "species:common-snapping-turtle", unit: "101", date: "2027-05-01", answers: {}, rule: "common-snapping-turtle-statewide", daily: 3, possession: 6, section: "#310(B)" },
  { speciesId: "species:yellow-bellied-marmot", unit: "12", date: "2026-09-15", answers: { HUNT_METHOD: "RIFLE" }, rule: "yellow-bellied-marmot-statewide", daily: 2, possession: 4, section: "#311(B)" },
  { speciesId: "species:prairie-rattlesnake", unit: "101", date: "2027-07-01", answers: {}, rule: "prairie-rattlesnake-statewide", daily: 3, possession: 6, section: "#312(B)" },
  { speciesId: "species:dusky-grouse", unit: "12", date: "2026-10-01", answers: { HUNT_METHOD: "SHOTGUN" }, rule: "dusky-grouse-west-of-i25", daily: 3, possession: 9, section: "#313(B)" },
  { speciesId: "species:white-tailed-ptarmigan", unit: "4", date: "2026-09-20", answers: { HUNT_METHOD: "SHOTGUN" }, rule: "white-tailed-ptarmigan-statewide-except", daily: 3, possession: 6, section: "#314(B)" },
  { speciesId: "species:greater-sage-grouse", unit: "2", date: "2026-09-12", answers: { HUNT_METHOD: "SHOTGUN" }, rule: "greater-sage-grouse", daily: 2, possession: 4, section: "#315(A)(2)" },
  { speciesId: "species:greater-sage-grouse", unit: "6", date: "2026-09-12", answers: { HUNT_METHOD: "SHOTGUN" }, rule: "greater-sage-grouse-north-park", daily: 2, possession: 2, section: "#315(B)(2)" },
  { speciesId: "species:sharp-tailed-grouse", unit: "4", date: "2026-09-05", answers: { HUNT_METHOD: "SHOTGUN" }, rule: "sharp-tailed-grouse", daily: 2, possession: 4, section: "#317(B)" },
  { speciesId: "species:chukar", unit: "12", date: "2026-10-01", answers: { HUNT_METHOD: "SHOTGUN" }, rule: "chukar-statewide", daily: 4, possession: 12, section: "#318(B)" },
  { speciesId: "species:ring-necked-pheasant", unit: "101", date: "2026-12-01", answers: { HUNT_METHOD: "SHOTGUN" }, rule: "ring-necked-pheasant-east-of-i25", daily: 3, possession: 9, section: "#319(B)" },
  { speciesId: "species:ring-necked-pheasant", unit: "12", date: "2026-12-01", answers: { HUNT_METHOD: "SHOTGUN" }, rule: "ring-necked-pheasant-west-of-i25", daily: 3, possession: 9, section: "#319(B)" },
  { speciesId: "species:northern-bobwhite", unit: "140", date: "2026-12-01", answers: { HUNT_METHOD: "SHOTGUN" }, rule: "northern-bobwhite-area-1", daily: 8, possession: 24, section: "#320(B)" },
  { speciesId: "species:greater-prairie-chicken", unit: "101", date: "2026-10-10", answers: { HUNT_METHOD: "SHOTGUN" }, rule: "greater-prairie-chicken", daily: 2, possession: 6, section: "#321(B)" },
  { speciesId: "species:red-fox", unit: "12", date: "2026-12-01", answers: { HUNT_METHOD: "RIFLE" }, rule: "red-fox-statewide", daily: 2, section: "#323(B)" },
  { speciesId: "species:american-marten", unit: "12", date: "2026-12-01", answers: { HUNT_METHOD: "RIFLE" }, rule: "american-marten-statewide", daily: 2, section: "#323(B)" },
  { speciesId: "species:bobcat", unit: "12", date: "2026-12-15", answers: { HUNT_METHOD: "RIFLE" }, rule: "bobcat-statewide", daily: 2, section: "#324(B)" },
  { speciesId: "species:coyote", unit: "101", date: "2027-07-04", answers: { HUNT_METHOD: "RIFLE" }, rule: "coyote-statewide", daily: 2, section: "#325(B)" },
  { speciesId: "species:beaver", unit: "101", date: "2026-10-15", answers: { HUNT_METHOD: "RIFLE" }, rule: "beaver-statewide", daily: 2, section: "#326(B)" },
];

test("bag and possession limits: each figure from the rule that states it, daily the smaller, possession the larger", () => {
  for (const item of LIMIT_CASES) {
    const evaluation = evaluate(item.speciesId, item.date, item.unit, item.answers);
    const where = `${item.speciesId} in unit ${item.unit} on ${item.date}`;
    assert.equal(status(evaluation), "CONDITIONAL", where);
    assert.deepEqual(rulesOf(evaluation), [RULE(item.rule)], where);
    const kinds = (evaluation.result!.harvestLimits ?? []).map((limit) => [limit.kind, limit.count, limit.section]);
    if (item.possession === undefined) {
      /* #323–#326: "Unlimited possession" — a daily bag and no possession figure, never a manufactured one. */
      assert.deepEqual(kinds, [["DAILY", item.daily, item.section]], where);
      assert.equal(evaluation.result!.limits?.possession, undefined, where);
      continue;
    }
    assert.deepEqual(kinds, [["DAILY", item.daily, item.section], ["POSSESSION", item.possession, item.section]], where);
    assert.deepEqual(evaluation.result!.limits, { daily: item.daily, possession: item.possession }, where);
    assert.ok(item.daily <= item.possession, `${where}: a day's bag cannot exceed what may be possessed`);
  }
});

test("#309: prairie dogs and the Wyoming ground squirrel carry no limit at all", () => {
  for (const [speciesId, answers] of [
    ["species:black-tailed-prairie-dog", { LAND_TYPE: "PRIVATE_LAND" }],
    ["species:wyoming-ground-squirrel", {}],
  ] as const) {
    const result = evaluate(speciesId, "2027-04-10", "101", answers).result!;
    assert.equal(result.status, "CONDITIONAL", speciesId);
    assert.equal(result.limits, undefined, `${speciesId}: "There shall be no bag or possession limit."`);
    assert.deepEqual((result.harvestLimits ?? []).filter((limit) => typeof limit.count === "number"), [], speciesId);
  }
});

/* ── Season dates: the first and last legal day of each rule, and the day either side ──── */

const DATE_CASES: Array<{ what: string; speciesId: string; unit: string; answers: HuntDimensionAnswers; rule: string; open: string[]; closed: string[] }> = [
  { what: "#309(A)(2)(a) prairie dogs on public land, June 15", speciesId: "species:black-tailed-prairie-dog", unit: "101", answers: { LAND_TYPE: "PUBLIC_LAND" }, rule: "black-tailed-prairie-dog-public-land", open: ["2027-02-28", "2027-06-15"], closed: ["2027-03-01", "2027-06-14"] },
  { what: "#309(A)(1) Wyoming ground squirrel, all year", speciesId: "species:wyoming-ground-squirrel", unit: "12", answers: {}, rule: "wyoming-ground-squirrel-statewide", open: ["2026-09-01", "2026-12-31", "2027-01-01", "2027-08-31"], closed: [] },
  { what: "#310 snapping turtle, April 1 – October 31", speciesId: "species:common-snapping-turtle", unit: "101", answers: {}, rule: "common-snapping-turtle-statewide", open: ["2026-10-31", "2027-04-01"], closed: ["2026-11-01", "2027-03-31"] },
  { what: "#311 marmot, August 10 – October 15", speciesId: "species:yellow-bellied-marmot", unit: "12", answers: { HUNT_METHOD: "RIFLE" }, rule: "yellow-bellied-marmot-statewide", open: ["2026-10-15", "2027-08-10"], closed: ["2026-10-16", "2027-08-09"] },
  { what: "#312 prairie rattlesnake, June 15 – August 15", speciesId: "species:prairie-rattlesnake", unit: "101", answers: {}, rule: "prairie-rattlesnake-statewide", open: ["2027-06-15", "2027-08-15"], closed: ["2027-06-14", "2027-08-16"] },
  { what: "#308(A)(1) fox squirrel, October 1 – end of February", speciesId: "species:fox-squirrel", unit: "101", answers: { HUNT_METHOD: "SHOTGUN" }, rule: "fox-squirrel-statewide", open: ["2026-10-01", "2027-02-28"], closed: ["2026-09-30", "2027-03-01"] },
  { what: "#313(A)(1)(b) dusky grouse falconry, to March 31", speciesId: "species:dusky-grouse", unit: "12", answers: { HUNT_METHOD: "FALCONRY" }, rule: "dusky-grouse-west-of-i25-falconry", open: ["2027-01-31", "2027-03-31"], closed: ["2027-04-01"] },
  { what: "#314(A)(2)(a) ptarmigan in the late units, to November 22", speciesId: "species:white-tailed-ptarmigan", unit: "45", answers: { HUNT_METHOD: "SHOTGUN" }, rule: "white-tailed-ptarmigan-late-units", open: ["2026-09-12", "2026-11-22"], closed: ["2026-09-11", "2026-11-23"] },
  { what: "#315(A)(1)(a) sage-grouse, September 12 – 18", speciesId: "species:greater-sage-grouse", unit: "2", answers: { HUNT_METHOD: "SHOTGUN" }, rule: "greater-sage-grouse", open: ["2026-09-12", "2026-09-18"], closed: ["2026-09-11", "2026-09-19"] },
  { what: "#315(B)(1)(a) sage-grouse in North Park, September 12 – 13", speciesId: "species:greater-sage-grouse", unit: "6", answers: { HUNT_METHOD: "SHOTGUN" }, rule: "greater-sage-grouse-north-park", open: ["2026-09-12", "2026-09-13"], closed: ["2026-09-11", "2026-09-14"] },
  { what: "#315(A)(1)(b) sage-grouse falconry, to January 31", speciesId: "species:greater-sage-grouse", unit: "2", answers: { HUNT_METHOD: "FALCONRY" }, rule: "greater-sage-grouse-falconry", open: ["2027-01-31"], closed: ["2027-02-01"] },
  { what: "#317(A)(1)(a) sharp-tailed grouse, September 1 – 20", speciesId: "species:sharp-tailed-grouse", unit: "4", answers: { HUNT_METHOD: "SHOTGUN" }, rule: "sharp-tailed-grouse", open: ["2026-09-01", "2026-09-20"], closed: ["2026-09-21"] },
  { what: "#317(A)(1)(b) sharp-tailed grouse falconry, to January 31", speciesId: "species:sharp-tailed-grouse", unit: "4", answers: { HUNT_METHOD: "FALCONRY" }, rule: "sharp-tailed-grouse-falconry", open: ["2027-01-31"], closed: ["2027-02-01"] },
  { what: "#318(A)(1) chukar, to November 30", speciesId: "species:chukar", unit: "12", answers: { HUNT_METHOD: "SHOTGUN" }, rule: "chukar-statewide", open: ["2026-09-01", "2026-11-30"], closed: ["2026-12-01"] },
  { what: "#318(A)(2) chukar falconry, to March 31", speciesId: "species:chukar", unit: "12", answers: { HUNT_METHOD: "FALCONRY" }, rule: "chukar-falconry", open: ["2027-03-31"], closed: ["2027-04-01"] },
  { what: "#319(A)(3) pheasant falconry, to March 31", speciesId: "species:ring-necked-pheasant", unit: "12", answers: { HUNT_METHOD: "FALCONRY" }, rule: "ring-necked-pheasant-falconry", open: ["2026-09-01", "2027-03-31"], closed: ["2027-04-01"] },
  { what: "#320(A)(1) quail area 1, to January 31", speciesId: "species:scaled-quail", unit: "140", answers: { HUNT_METHOD: "SHOTGUN" }, rule: "scaled-quail-area-1", open: ["2026-11-14", "2027-01-31"], closed: ["2026-11-13", "2027-02-01"] },
  { what: "#320(A)(2) quail area 2, to January 3", speciesId: "species:scaled-quail", unit: "101", answers: { HUNT_METHOD: "SHOTGUN" }, rule: "scaled-quail-area-2", open: ["2026-11-14", "2027-01-03"], closed: ["2026-11-13", "2027-01-04"] },
  { what: "#320(A)(3) quail area 3, to January 3", speciesId: "species:scaled-quail", unit: "12", answers: { HUNT_METHOD: "SHOTGUN" }, rule: "scaled-quail-area-3", open: ["2026-11-14", "2027-01-03"], closed: ["2026-11-13", "2027-01-04"] },
  { what: "#321(A)(1)(a) prairie-chicken, October 1 – January 31", speciesId: "species:greater-prairie-chicken", unit: "101", answers: { HUNT_METHOD: "SHOTGUN" }, rule: "greater-prairie-chicken", open: ["2026-10-01", "2027-01-31"], closed: ["2026-09-30", "2027-02-01"] },
  { what: "#323 furbearers, November 1 – end of February", speciesId: "species:american-mink", unit: "12", answers: { HUNT_METHOD: "RIFLE" }, rule: "american-mink-statewide", open: ["2026-11-01", "2027-02-28"], closed: ["2026-10-31", "2027-03-01"] },
  { what: "#324 bobcat, December 1 – end of February", speciesId: "species:bobcat", unit: "12", answers: { HUNT_METHOD: "RIFLE" }, rule: "bobcat-statewide", open: ["2026-12-01", "2027-02-28"], closed: ["2026-11-30", "2027-03-01"] },
  { what: "#326 beaver, October 1 – March 31", speciesId: "species:beaver", unit: "101", answers: { HUNT_METHOD: "RIFLE" }, rule: "beaver-statewide", open: ["2026-10-01", "2027-03-31"], closed: ["2026-09-30", "2027-04-01"] },
];

test("season dates: each rule's first and last legal day are open and the days either side are not", () => {
  for (const item of DATE_CASES) {
    for (const date of item.open) {
      const evaluation = evaluate(item.speciesId, date, item.unit, item.answers);
      assert.equal(status(evaluation), "CONDITIONAL", `${item.what}: ${date} is in season`);
      /* The rule named is the one whose own window holds the day — not merely a rule the answer lists. */
      const row = (evaluation.opportunities ?? []).find((opportunity) => opportunity.ruleId === RULE(item.rule));
      assert.ok(row, `${item.what}: ${date} is answered from ${item.rule}`);
      assert.ok(row!.windows.some((window) => window.opens <= date && date <= window.closes), `${item.what}: ${item.rule}'s own window holds ${date}`);
    }
    for (const date of item.closed) {
      const evaluation = evaluate(item.speciesId, date, item.unit, item.answers);
      assert.equal(status(evaluation), "CLOSED", `${item.what}: ${date} is out of season`);
    }
  }
});

/* ── Geography: the lists, against every unit outside them ──────────────────── */

test("the sample points reach enough of Colorado for the unit walks below to mean something", () => {
  assert.ok(SAMPLED_UNITS.length >= 170, `only ${SAMPLED_UNITS.length} of 186 units sampled`);
});

/** #317(A)(1): "Closed statewide except: Units 4, 5, 12, 13, 14, 23, 131, 211, 214, and 441." */
const SHARPTAIL = ["4", "5", "12", "13", "14", "23", "131", "211", "214", "441"];
/** #314(A)(2): the nineteen units whose ptarmigan season runs to November 22. */
const PTARMIGAN_LATE = ["44", "45", "53", "54", "66", "67", "68", "70", "71", "74", "75", "76", "77", "78", "79", "80", "81", "444", "751"];
/** #315(A)(1): sage-grouse except North Park; 18 and 28 each lose a portion North Ground cannot place. */
const SAGE_GROUSE = ["2", "3", "4", "5", "10", "11", "13", "27", "37", "181", "201", "211", "301", "441"];
const SAGE_GROUSE_WITH_PORTION = ["18", "28"];
/** #315(B)(1): North Park. */
const NORTH_PARK = ["6", "16", "17", "161", "171"];

test("#317: sharp-tailed grouse is open in exactly the ten named units", () => {
  for (const unit of SAMPLED_UNITS) {
    const evaluation = evaluate("species:sharp-tailed-grouse", "2026-09-05", unit, { HUNT_METHOD: "SHOTGUN" });
    if (SHARPTAIL.includes(unit)) {
      assert.equal(status(evaluation), "CONDITIONAL", `unit ${unit} is named`);
      assert.deepEqual(rulesOf(evaluation), [RULE("sharp-tailed-grouse")], `unit ${unit}`);
    } else {
      assert.equal(status(evaluation), "CLOSED", `unit ${unit} is not named`);
    }
  }
});

test("#314: ptarmigan stays open after October 4 in exactly the nineteen listed units", () => {
  for (const unit of SAMPLED_UNITS) {
    const evaluation = evaluate("species:white-tailed-ptarmigan", "2026-10-10", unit, { HUNT_METHOD: "SHOTGUN" });
    if (PTARMIGAN_LATE.includes(unit)) {
      assert.deepEqual(rulesOf(evaluation), [RULE("white-tailed-ptarmigan-late-units")], `unit ${unit} is listed`);
    } else {
      assert.equal(status(evaluation), "CLOSED", `unit ${unit} closed October 4`);
    }
  }
  /* And before October 4 every unit is open, under one of the two rules and never both. */
  for (const unit of SAMPLED_UNITS) {
    const evaluation = evaluate("species:white-tailed-ptarmigan", "2026-09-20", unit, { HUNT_METHOD: "SHOTGUN" });
    assert.deepEqual(rulesOf(evaluation), [RULE(PTARMIGAN_LATE.includes(unit) ? "white-tailed-ptarmigan-late-units" : "white-tailed-ptarmigan-statewide-except")], `unit ${unit}`);
  }
});

test("#315: sage-grouse runs in the named units, two days in North Park, and nowhere else", () => {
  for (const unit of SAMPLED_UNITS) {
    const evaluation = evaluate("species:greater-sage-grouse", "2026-09-12", unit, { HUNT_METHOD: "SHOTGUN" });
    if (SAGE_GROUSE.includes(unit)) assert.deepEqual(rulesOf(evaluation), [RULE("greater-sage-grouse")], `unit ${unit}`);
    else if (NORTH_PARK.includes(unit)) assert.deepEqual(rulesOf(evaluation), [RULE("greater-sage-grouse-north-park")], `unit ${unit}`);
    else if (SAGE_GROUSE_WITH_PORTION.includes(unit)) assert.notEqual(status(evaluation), "CLOSED", `unit ${unit} is named, less a portion`);
    else assert.equal(status(evaluation), "CLOSED", `unit ${unit} is not named`);
  }
});

test("#321: units 89 and 90 lie north of Colo 14 and US 138 and are closed to prairie-chicken; the named units are open", () => {
  for (const unit of ["87", "88", "89", "90"]) {
    assert.equal(status(evaluate("species:greater-prairie-chicken", "2026-10-10", unit, { HUNT_METHOD: "SHOTGUN" })), "CLOSED", `unit ${unit}`);
  }
  for (const unit of ["93", "97", "98", "100", "101", "102", "103", "109"]) {
    if (!sampleIn(unit)) continue;
    assert.deepEqual(rulesOf(evaluate("species:greater-prairie-chicken", "2026-10-10", unit, { HUNT_METHOD: "SHOTGUN" })), [RULE("greater-prairie-chicken")], `unit ${unit} is named`);
  }
});

test("I-25 is one line: where dusky grouse is open, pheasant closes January 3 and the centerfire limit binds — and nowhere else", () => {
  let west = 0;
  for (const unit of SAMPLED_UNITS) {
    const dusky = evaluate("species:dusky-grouse", "2026-10-01", unit, { HUNT_METHOD: "SHOTGUN" });
    const isWest = rulesOf(dusky).includes(RULE("dusky-grouse-west-of-i25"));
    if (isWest) west += 1;
    else assert.equal(status(dusky), "CLOSED", `unit ${unit}: east of I-25, dusky grouse is closed`);
    /* #319(A)(1)–(2): the same line decides which pheasant season a unit has. */
    const pheasant = evaluate("species:ring-necked-pheasant", "2027-01-15", unit, { HUNT_METHOD: "SHOTGUN" });
    assert.equal(status(pheasant), isWest ? "CLOSED" : "CONDITIONAL", `unit ${unit}: pheasant on January 15`);
    if (!isWest) assert.deepEqual(rulesOf(pheasant), [RULE("ring-necked-pheasant-east-of-i25")], `unit ${unit}`);
    /* W-0 #004(B): the centerfire limit binds west of I-25 — for game mammals, game birds and furbearers alike. */
    const cottontail = evaluate("species:mountain-cottontail", "2026-11-01", unit, { SEASON_TYPE: "REGULAR", HUNT_METHOD: "RIFLE" });
    const fox = evaluate("species:red-fox", "2026-12-01", unit, { HUNT_METHOD: "RIFLE" });
    assert.equal(carries(cottontail, "us-co-centerfire-west-of-i25"), isWest, `unit ${unit}: centerfire limit on cottontail`);
    assert.equal(carries(fox, "us-co-centerfire-west-of-i25"), isWest, `unit ${unit}: centerfire limit on a furbearer`);
    if (isWest) assert.ok(carries(dusky, "us-co-centerfire-west-of-i25"), `unit ${unit}: centerfire limit on a game bird`);
  }
  /* 126 units lie west of I-25 by the derivation; a count that moves means the line moved. */
  assert.ok(west >= 110 && west <= 126, `${west} sampled units west of I-25`);
});

test("W-0 #004(B) reaches coyote, bobcat and beaver west of I-25 as it does every furbearer", () => {
  for (const [speciesId, date] of [["species:coyote", "2027-07-04"], ["species:bobcat", "2026-12-15"], ["species:beaver", "2026-10-15"]] as const) {
    assert.ok(carries(evaluate(speciesId, date, "12", { HUNT_METHOD: "RIFLE" }), "us-co-centerfire-west-of-i25"), `${speciesId} west of I-25`);
    assert.ok(!carries(evaluate(speciesId, date, "101", { HUNT_METHOD: "RIFLE" }), "us-co-centerfire-west-of-i25"), `${speciesId} east of I-25`);
  }
});

/* ── #303: the minimums that ride on a method ────────────────────────────────── */

test("#303(B)(2), (C)(2), (E)(4): a game mammal's shotgun may fire a slug and a game bird's may not; the .25 air gun minimum is for coyote and bobcat only", () => {
  const cottontail = evaluate("species:mountain-cottontail", "2026-11-01", "101", { SEASON_TYPE: "REGULAR", HUNT_METHOD: "SHOTGUN" });
  const squirrel = evaluate("species:fox-squirrel", "2026-11-01", "101", { HUNT_METHOD: "SHOTGUN" });
  const pheasant = evaluate("species:ring-necked-pheasant", "2026-12-01", "101", { HUNT_METHOD: "SHOTGUN" });
  const dusky = evaluate("species:dusky-grouse", "2026-10-01", "12", { HUNT_METHOD: "SHOTGUN" });
  for (const [what, evaluation] of [["cottontail", cottontail], ["fox squirrel", squirrel]] as const) {
    assert.ok(carries(evaluation, "us-co-game-mammal-shotgun"), `${what}: #303(B)(2)`);
    assert.ok(!carries(evaluation, "us-co-game-bird-shotgun"), `${what}: the single-slug ban is #303(C)(2), for birds`);
  }
  for (const [what, evaluation] of [["pheasant", pheasant], ["dusky grouse", dusky]] as const) {
    assert.ok(carries(evaluation, "us-co-game-bird-shotgun"), `${what}: #303(C)(2)`);
    assert.ok(!carries(evaluation, "us-co-game-mammal-shotgun"), `${what}: not #303(B)(2)`);
  }
  for (const [speciesId, date, expected] of [
    ["species:coyote", "2027-07-04", true], ["species:bobcat", "2026-12-15", true],
    ["species:red-fox", "2026-12-01", false], ["species:raccoon", "2026-12-01", false],
  ] as const) {
    const evaluation = evaluate(speciesId, date, "101", { HUNT_METHOD: "AIR_GUN" });
    assert.equal(status(evaluation), "CONDITIONAL", `${speciesId}: an air gun is a #303(E)(4) method`);
    assert.equal(carries(evaluation, "us-co-air-gun-coyote-bobcat"), expected, `${speciesId}: "for coyote or bobcat the air gun must be a pre-charged pneumatic air gun .25 caliber or larger"`);
  }
});

/* ── #303(A)(4): non-toxic shot on the Arapaho refuge ───────────────────────── */

test("#303(A)(4): the Arapaho refuge's non-toxic shot rule reaches resident small game in every Jackson County unit, and nothing else", () => {
  const JACKSON = ["6", "16", "17", "161", "171"];
  const smallGame: Array<[string, string, HuntDimensionAnswers]> = [
    ["species:mountain-cottontail", "2026-11-01", { SEASON_TYPE: "REGULAR", HUNT_METHOD: "SHOTGUN" }],
    ["species:dusky-grouse", "2026-10-01", { HUNT_METHOD: "SHOTGUN" }],
    ["species:chukar", "2026-10-01", { HUNT_METHOD: "SHOTGUN" }],
    ["species:common-snapping-turtle", "2027-05-01", {}],
    ["species:prairie-rattlesnake", "2027-07-01", {}],
  ];
  /* Furbearers are #300(B), not the #300(D) small game the provision names. */
  const furbearers: Array<[string, string]> = [["species:red-fox", "2026-12-01"], ["species:coyote", "2027-07-04"], ["species:bobcat", "2026-12-15"], ["species:beaver", "2026-10-15"]];
  for (const unit of [...JACKSON, "12", "14", "101"]) {
    const inJackson = JACKSON.includes(unit);
    for (const [speciesId, date, answers] of smallGame) {
      if (speciesId === "species:dusky-grouse" && unit === "101") continue; // #313: west of I-25 only.
      const evaluation = evaluate(speciesId, date, unit, answers);
      assert.equal(status(evaluation), "CONDITIONAL", `${speciesId} in unit ${unit}`);
      assert.equal(carries(evaluation, "us-co-arapaho-nwr-nontoxic-shot"), inJackson, `${speciesId} in unit ${unit}`);
    }
    for (const [speciesId, date] of furbearers) {
      const evaluation = evaluate(speciesId, date, unit, { HUNT_METHOD: "SHOTGUN" });
      assert.equal(status(evaluation), "CONDITIONAL", `${speciesId} in unit ${unit}`);
      assert.equal(carries(evaluation, "us-co-arapaho-nwr-nontoxic-shot"), false, `${speciesId} is a furbearer, in unit ${unit}`);
    }
  }
});

/* ── #304(H) permit, and #319's animal class ────────────────────────────────── */

test("#304(H): the grouse and ptarmigan permit is required for sage-grouse, sharp-tailed grouse and ptarmigan, and for no other bird", () => {
  const permit = "us-co-grouse-ptarmigan-permit";
  const needs: Array<[string, string, string, Method]> = [
    ["species:white-tailed-ptarmigan", "4", "2026-09-20", "SHOTGUN"],
    ["species:white-tailed-ptarmigan", "45", "2026-11-01", "SHOTGUN"],
    ["species:white-tailed-ptarmigan", "4", "2027-02-01", "FALCONRY"],
    ["species:greater-sage-grouse", "2", "2026-09-12", "SHOTGUN"],
    ["species:greater-sage-grouse", "6", "2026-09-12", "SHOTGUN"],
    ["species:greater-sage-grouse", "2", "2026-12-01", "FALCONRY"],
    ["species:sharp-tailed-grouse", "4", "2026-09-05", "SHOTGUN"],
    ["species:sharp-tailed-grouse", "4", "2026-12-01", "FALCONRY"],
  ];
  for (const [speciesId, unit, date, method] of needs) {
    const evaluation = evaluate(speciesId, date, unit, { HUNT_METHOD: method });
    assert.equal(status(evaluation), "CONDITIONAL", `${speciesId} ${method} ${date}`);
    assert.ok(carries(evaluation, permit), `${speciesId} with ${method} on ${date} needs the #304(H) permit`);
  }
  const not: Array<[string, string, string]> = [
    ["species:dusky-grouse", "12", "2026-10-01"], ["species:chukar", "12", "2026-10-01"], ["species:ring-necked-pheasant", "101", "2026-12-01"],
    ["species:scaled-quail", "140", "2026-12-01"], ["species:greater-prairie-chicken", "101", "2026-10-10"],
  ];
  for (const [speciesId, unit, date] of not) {
    const evaluation = evaluate(speciesId, date, unit, { HUNT_METHOD: "SHOTGUN" });
    assert.equal(status(evaluation), "CONDITIONAL", speciesId);
    assert.ok(!carries(evaluation, permit), `${speciesId}: #304(H) does not name it`);
  }
});

test("#319: both regular pheasant seasons are cock seasons; the falconry season is not", () => {
  for (const [unit, rule] of [["101", "ring-necked-pheasant-east-of-i25"], ["12", "ring-necked-pheasant-west-of-i25"]] as const) {
    const evaluation = evaluate("species:ring-necked-pheasant", "2026-12-01", unit, { HUNT_METHOD: "SHOTGUN" });
    const row = (evaluation.opportunities ?? []).find((opportunity) => opportunity.ruleId === RULE(rule));
    assert.ok(row, `${rule} answers in unit ${unit}`);
    assert.deepEqual(row!.animalClass, { state: "STATED", value: "COCK" }, `${rule}: "Three (3) cocks"`);
    const cockLimit = evaluation.result!.harvestLimits?.find((limit) => limit.kind === "DAILY");
    assert.equal(cockLimit?.count, 3, rule);
  }
  const falconry = evaluate("species:ring-necked-pheasant", "2026-12-01", "12", { HUNT_METHOD: "FALCONRY" });
  const row = (falconry.opportunities ?? []).find((opportunity) => opportunity.ruleId === RULE("ring-necked-pheasant-falconry"));
  assert.ok(row && row.animalClass.state !== "STATED", "#319(C): three birds, no class");
});

/* ── #302(A): legal hours, anchored to the sun rather than to each other ────── */

/** #300(B): Colorado's seventeen furbearers. */
const FURBEARERS = [
  "species:american-mink", "species:american-marten", "species:american-badger", "species:gray-fox", "species:red-fox",
  "species:swift-fox", "species:raccoon", "species:ringtail", "species:striped-skunk", "species:western-spotted-skunk",
  "species:long-tailed-weasel", "species:american-ermine", "species:virginia-opossum", "species:muskrat",
  "species:bobcat", "species:coyote", "species:beaver",
];
/** #302(A)(2), "Additionally": the eight furbearers that may also be hunted at night under #303(E)(7)–(8). */
const NIGHT = new Set([
  "species:beaver", "species:bobcat", "species:coyote", "species:gray-fox", "species:raccoon", "species:red-fox",
  "species:striped-skunk", "species:swift-fox",
]);

const minutes = (clock: string) => {
  const [hours, mins] = clock.split(":").map(Number);
  return hours * 60 + mins;
};

test("#302(A): small game from half an hour before sunrise to sunset; every furbearer to half an hour after; night only for the eight", () => {
  const unit = "101";
  const date = "2026-12-15";
  const { latitude, longitude } = pointIn(unit);
  const sun = sunriseSunset(latitude, longitude, { year: 2026, month: 12, day: 15 });
  assert.ok("sunrise" in sun);
  const sunrise = minutes(wallClock(sun.sunrise, "America/Denver"));
  const sunset = minutes(wallClock(sun.sunset, "America/Denver"));

  const small = evaluate("species:mountain-cottontail", date, unit, { SEASON_TYPE: "REGULAR", HUNT_METHOD: "RIFLE" }).result!.legalTime;
  assert.ok(small.status === "RESOLVED");
  const margin = small.precision?.marginMinutes ?? 0;
  /* Within a minute: the sun's instant and the window's instant are truncated to the minute separately. */
  const near = (actual: number, expected: number, what: string) => assert.ok(Math.abs(actual - expected) <= 1, `${what}: ${actual} vs ${expected}`);
  near(minutes(small.window.opensAt), sunrise - 30 + margin, "small game opens half an hour before sunrise");
  near(minutes(small.window.closesAt), sunset - margin, "small game closes at sunset");

  for (const speciesId of FURBEARERS) {
    const hours = evaluate(speciesId, date, unit, { HUNT_METHOD: "RIFLE" }).result!.legalTime;
    assert.ok(hours.status === "RESOLVED", speciesId);
    near(minutes(hours.window.opensAt), sunrise - 30 + margin, `${speciesId} opens half an hour before sunrise`);
    near(minutes(hours.window.closesAt), sunset + 30 - margin, `${speciesId} closes half an hour after sunset (#302(A)(2))`);
    assert.equal(minutes(hours.window.closesAt) - minutes(small.window.closesAt), 30, `${speciesId}: half an hour after small game`);
    const night = (hours.exceptions ?? []).some((exception) => exception.id === "us-co-furbearer-night-hunting" && exception.effect === "WIDENS");
    assert.equal(night, NIGHT.has(speciesId), `${speciesId}: night hunting ${NIGHT.has(speciesId) ? "is" : "is not"} named in #302(A)(2)`);
  }
});
