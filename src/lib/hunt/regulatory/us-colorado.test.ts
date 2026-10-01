import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { HuntDimensionAnswers } from "./dimensions.ts";
import { COLORADO_BUNDLE, coloradoCoverageReport, evaluateColorado } from "./us-colorado.ts";

/**
 * Colorado's small game and furbearer rules, asked of the ENGINE at real
 * points. Every expectation was written from 2 CCR 406-3, Chapter W-3
 * (07/16/2026, effective September 1, 2026) before the test was run:
 *
 *   #306  cottontails, snowshoe hare, jackrabbits: October 1 – end of February;
 *         falconry and organized dog pursuit events September 1 – March 31.
 *   #307  Abert's squirrel: November 15 – January 15.
 *   #309  prairie dogs: public land June 15 – end of February; private land all year.
 *   #313  dusky grouse: "West of U.S. Interstate 25", September 1 – November 22, 2026.
 *   #314  ptarmigan: September 12 – October 4, 2026, except 19 listed units to November 22.
 *   #315  greater sage-grouse: listed units September 12 – 18, 2026; North Park 12 – 13;
 *         unit 18 east of Colo 125 and unit 28 north-east of Church Park Rd excepted.
 *   #317  mountain sharp-tailed grouse: "Closed statewide except" ten units, September 1 – 20, 2026.
 *   #319  pheasant: east of I-25 to January 31, 2027, west to January 3, 2027; three cocks.
 *   #320  quail: area 1 to January 31, 2027, areas 2 and 3 to January 3, 2027.
 *   #321  greater prairie-chicken: "Closed statewide except" named units, Morgan County
 *         and the area east of Colo 71 and south of Colo 14 and US 138; October 1 – January 31.
 *   #323–#326 furbearers; #303 the legal methods ("Any method of take not listed
 *         herein shall be prohibited"); #302 the hours.
 *
 * Points are CPW's own: each is a sample the GMU service placed inside the unit
 * named (fixtures/hunt/us-co-gmu-live-parity.json, "inside").
 */

const PARITY = JSON.parse(readFileSync(new URL("../../../../fixtures/hunt/us-co-gmu-live-parity.json", import.meta.url), "utf8")) as {
  results: Array<{ kind: string; latitude: number; longitude: number; official: string[]; agree: boolean }>;
};

function pointIn(unit: string): { latitude: number; longitude: number } {
  const sample = PARITY.results.find((result) => result.kind === "inside" && result.agree && result.official.length === 1 && result.official[0] === unit);
  if (!sample) throw new Error(`no CPW sample inside unit ${unit}`);
  return { latitude: sample.latitude, longitude: sample.longitude };
}

function evaluate(speciesId: string, date: string, unit: string, answers: HuntDimensionAnswers = {}, scope: "POINT" | "ZONE" = "POINT") {
  const { latitude, longitude } = pointIn(unit);
  return evaluateColorado({
    speciesId, speciesName: speciesId.slice(8).replace(/-/g, " "), date, answers,
    place: { zoneId: `management_zone:us-co-gmu-${unit}`, zoneName: `Game Management Unit ${unit}`, latitude, longitude, overlays: new Set(), scope },
  });
}

const status = (evaluation: ReturnType<typeof evaluate>) =>
  evaluation.completeness === "NEEDS_INPUT" ? `ASK ${evaluation.required?.id}` : evaluation.result?.status;

/* Units, each placed by W-0 #024 or by the derivation, and sampled by CPW. */
const WEST = "12"; // Rio Blanco and Moffat counties: west of I-25.
const EAST = "101"; // Washington and Yuma counties: east of I-25, east of Colo 71.

test("cottontail: October 1 to the end of February for every legal method, and only falconers and dog pursuit events outside it", () => {
  const cottontail = "species:mountain-cottontail";
  /* Open to everyone, but a falconer's or a dog pursuit event's season runs to March 31 and everyone else's to the end
     of February, so the closing date — which the answer states — turns on who is hunting. */
  assert.equal(status(evaluate(cottontail, "2026-10-01", WEST)), "ASK SEASON_TYPE");
  for (const method of ["RIFLE", "HANDGUN", "SHOTGUN", "BOW", "CROSSBOW", "AIR_GUN", "SLINGSHOT", "FALCONRY"]) {
    assert.equal(status(evaluate(cottontail, "2026-10-01", WEST, { SEASON_TYPE: "REGULAR", HUNT_METHOD: method })), "CONDITIONAL", `#303(B) allows ${method}`);
  }
  assert.equal(status(evaluate(cottontail, "2027-02-28", WEST, { SEASON_TYPE: "REGULAR", HUNT_METHOD: "RIFLE" })), "CONDITIONAL");
  /* The day before the regular season opens, the answer turns on who is hunting. */
  assert.equal(status(evaluate(cottontail, "2026-09-30", WEST)), "ASK SEASON_TYPE");
  assert.equal(status(evaluate(cottontail, "2026-09-30", WEST, { SEASON_TYPE: "REGULAR", HUNT_METHOD: "RIFLE" })), "CLOSED");
  assert.equal(status(evaluate(cottontail, "2026-09-30", WEST, { SEASON_TYPE: "REGULAR", HUNT_METHOD: "FALCONRY" })), "CONDITIONAL");
  assert.equal(status(evaluate(cottontail, "2026-09-30", WEST, { SEASON_TYPE: "DOG_PURSUIT_EVENT" })), "CONDITIONAL");
  assert.equal(status(evaluate(cottontail, "2027-03-01", WEST, { SEASON_TYPE: "REGULAR", HUNT_METHOD: "SHOTGUN" })), "CLOSED");
  assert.equal(status(evaluate(cottontail, "2027-03-31", WEST, { SEASON_TYPE: "REGULAR", HUNT_METHOD: "FALCONRY" })), "CONDITIONAL");
  assert.equal(status(evaluate(cottontail, "2027-04-01", WEST, { SEASON_TYPE: "REGULAR", HUNT_METHOD: "FALCONRY" })), "CLOSED");
  const open = evaluate(cottontail, "2026-11-01", EAST, { SEASON_TYPE: "REGULAR", HUNT_METHOD: "SHOTGUN" }).result!;
  assert.deepEqual(open.limits, { daily: 10, possession: 20 });
  assert.ok(open.requirements.some((line) => /small game licence/.test(line)));
});

test("Abert's squirrel runs November 15 to January 15 across the new year, inclusive", () => {
  assert.equal(status(evaluate("species:aberts-squirrel", "2026-11-14", "59")), "CLOSED");
  assert.equal(status(evaluate("species:aberts-squirrel", "2026-11-15", "59")), "CONDITIONAL");
  assert.equal(status(evaluate("species:aberts-squirrel", "2027-01-15", "59")), "CONDITIONAL");
  assert.equal(status(evaluate("species:aberts-squirrel", "2027-01-16", "59")), "CLOSED");
});

test("prairie dogs: the land question is asked only in the months public and private land differ", () => {
  const dog = "species:black-tailed-prairie-dog";
  /* Both open in October; they close on different days, which the answer states, so the land is asked. */
  assert.equal(status(evaluate(dog, "2026-10-01", EAST)), "ASK LAND_TYPE");
  assert.equal(status(evaluate(dog, "2026-10-01", EAST, { LAND_TYPE: "PUBLIC_LAND" })), "CONDITIONAL");
  assert.equal(status(evaluate(dog, "2026-10-01", EAST, { LAND_TYPE: "PRIVATE_LAND" })), "CONDITIONAL");
  assert.equal(status(evaluate(dog, "2027-03-01", EAST, { LAND_TYPE: "PUBLIC_LAND" })), "CLOSED", "the day after the end of February");
  assert.equal(status(evaluate(dog, "2027-04-10", EAST)), "ASK LAND_TYPE");
  assert.equal(status(evaluate(dog, "2027-04-10", EAST, { LAND_TYPE: "PUBLIC_LAND" })), "CLOSED");
  assert.equal(status(evaluate(dog, "2027-04-10", EAST, { LAND_TYPE: "PRIVATE_LAND" })), "CONDITIONAL");
  assert.equal(status(evaluate(dog, "2027-06-15", EAST, { LAND_TYPE: "PUBLIC_LAND" })), "CONDITIONAL");
});

test("dusky grouse is open west of I-25 and closed east of it, by C.R.S. 33-6-109(1) and #313", () => {
  const dusky = "species:dusky-grouse";
  /* The season opens on the day this edition takes effect, so the day before is governed by an edition not read here. */
  assert.equal(status(evaluate(dusky, "2026-08-31", WEST, { HUNT_METHOD: "RIFLE" })), "NEEDS_VERIFICATION");
  assert.equal(status(evaluate(dusky, "2026-09-01", WEST)), "ASK HUNT_METHOD", "a falconer's season closes later");
  for (const method of ["RIFLE", "HANDGUN", "SHOTGUN", "BOW", "CROSSBOW", "AIR_GUN", "SLINGSHOT"]) {
    assert.equal(status(evaluate(dusky, "2026-09-01", WEST, { HUNT_METHOD: method })), "CONDITIONAL", `#303(C) allows ${method} for dusky grouse`);
  }
  assert.equal(status(evaluate(dusky, "2026-11-22", WEST, { HUNT_METHOD: "RIFLE" })), "CONDITIONAL");
  assert.equal(status(evaluate(dusky, "2026-11-23", WEST, { HUNT_METHOD: "RIFLE" })), "CLOSED");
  assert.equal(status(evaluate(dusky, "2026-11-23", WEST, { HUNT_METHOD: "FALCONRY" })), "CONDITIONAL", "#313(A)(1)(b) extended falconry season");
  for (const unit of [EAST, "104", "140"]) {
    assert.equal(status(evaluate(dusky, "2026-10-01", unit)), "CLOSED", `unit ${unit} is east of I-25`);
  }
});

test("pheasant: shotgun, bow or hawk only; east of I-25 closes January 31, west January 3; the regular season is cocks", () => {
  const pheasant = "species:ring-necked-pheasant";
  assert.equal(status(evaluate(pheasant, "2026-12-01", EAST)), "ASK HUNT_METHOD", "a rifle is not a legal method for pheasant (#303(C))");
  assert.equal(status(evaluate(pheasant, "2026-12-01", EAST, { HUNT_METHOD: "RIFLE" })), "CLOSED");
  assert.equal(status(evaluate(pheasant, "2026-11-13", EAST, { HUNT_METHOD: "SHOTGUN" })), "CLOSED");
  assert.equal(status(evaluate(pheasant, "2026-11-14", EAST, { HUNT_METHOD: "SHOTGUN" })), "CONDITIONAL");
  assert.equal(status(evaluate(pheasant, "2027-01-15", EAST, { HUNT_METHOD: "SHOTGUN" })), "CONDITIONAL");
  assert.equal(status(evaluate(pheasant, "2027-01-15", WEST, { HUNT_METHOD: "SHOTGUN" })), "CLOSED");
  assert.equal(status(evaluate(pheasant, "2027-01-03", WEST, { HUNT_METHOD: "SHOTGUN" })), "CONDITIONAL");
  assert.equal(status(evaluate(pheasant, "2026-10-01", WEST, { HUNT_METHOD: "FALCONRY" })), "CONDITIONAL");
  const regular = evaluate(pheasant, "2026-12-01", EAST, { HUNT_METHOD: "SHOTGUN" });
  assert.deepEqual(regular.opportunities?.map((row) => row.animalClass), [{ state: "STATED", value: "COCK" }]);
  const falconry = evaluate(pheasant, "2026-12-01", EAST, { HUNT_METHOD: "FALCONRY" });
  assert.ok(falconry.opportunities?.some((row) => row.animalClass.state !== "STATED"), "the falconry season states no class: three birds");
});

test("mountain sharp-tailed grouse: closed statewide except the ten named units", () => {
  const sharp = "species:sharp-tailed-grouse";
  assert.equal(status(evaluate(sharp, "2026-09-05", "4", { HUNT_METHOD: "SHOTGUN" })), "CONDITIONAL");
  assert.equal(status(evaluate(sharp, "2026-09-21", "4", { HUNT_METHOD: "SHOTGUN" })), "CLOSED");
  assert.equal(status(evaluate(sharp, "2026-09-05", "2", { HUNT_METHOD: "SHOTGUN" })), "CLOSED", "unit 2 is not named");
  assert.equal(status(evaluate(sharp, "2026-09-05", EAST)), "CLOSED");
  const open = evaluate(sharp, "2026-09-05", "4", { HUNT_METHOD: "SHOTGUN" }).result!;
  assert.ok(open.requirements.some((line) => /ptarmigan permit/.test(line)), "#304(H) permit");
});

test("greater sage-grouse: a week in the named units, two days in North Park, and unit 18 depends on Colo 125", () => {
  const sage = "species:greater-sage-grouse";
  assert.equal(status(evaluate(sage, "2026-09-12", "2", { HUNT_METHOD: "SHOTGUN" })), "CONDITIONAL");
  assert.equal(status(evaluate(sage, "2026-09-18", "2", { HUNT_METHOD: "SHOTGUN" })), "CONDITIONAL");
  assert.equal(status(evaluate(sage, "2026-09-19", "2", { HUNT_METHOD: "SHOTGUN" })), "CLOSED");
  assert.equal(status(evaluate(sage, "2026-09-13", "6", { HUNT_METHOD: "SHOTGUN" })), "CONDITIONAL");
  assert.equal(status(evaluate(sage, "2026-09-14", "6", { HUNT_METHOD: "SHOTGUN" })), "CLOSED");
  assert.equal(status(evaluate(sage, "2026-09-14", "6", { HUNT_METHOD: "FALCONRY" })), "CONDITIONAL");
  assert.equal(status(evaluate(sage, "2026-09-12", "18", { HUNT_METHOD: "SHOTGUN" })), "NEEDS_VERIFICATION", "the excepted portion has no geometry");
  assert.equal(status(evaluate(sage, "2026-09-12", "45", { HUNT_METHOD: "SHOTGUN" })), "CLOSED");
  assert.deepEqual(evaluate(sage, "2026-09-13", "6", { HUNT_METHOD: "SHOTGUN" }).result!.limits, { daily: 2, possession: 2 });
});

test("white-tailed ptarmigan: October 4 statewide, November 22 in the nineteen listed units", () => {
  const ptarmigan = "species:white-tailed-ptarmigan";
  assert.equal(status(evaluate(ptarmigan, "2026-09-11", "45", { HUNT_METHOD: "RIFLE" })), "CLOSED");
  assert.equal(status(evaluate(ptarmigan, "2026-10-04", "4", { HUNT_METHOD: "RIFLE" })), "CONDITIONAL");
  assert.equal(status(evaluate(ptarmigan, "2026-10-10", "4", { HUNT_METHOD: "RIFLE" })), "CLOSED");
  assert.equal(status(evaluate(ptarmigan, "2026-10-10", "45", { HUNT_METHOD: "RIFLE" })), "CONDITIONAL");
  assert.equal(status(evaluate(ptarmigan, "2026-11-22", "75", { HUNT_METHOD: "RIFLE" })), "CONDITIONAL");
});

test("quail: area 1 to January 31, areas 2 and 3 to January 3, and a unit the line crosses is not guessed", () => {
  const quail = "species:scaled-quail";
  const shotgun = { HUNT_METHOD: "SHOTGUN" };
  assert.equal(status(evaluate(quail, "2027-01-20", "140", shotgun)), "CONDITIONAL", "east of I-25, south of the line");
  assert.equal(status(evaluate(quail, "2027-01-20", "85", shotgun)), "CONDITIONAL", "west of I-25, wholly in Huerfano and Las Animas counties");
  assert.equal(status(evaluate(quail, "2027-01-20", EAST, shotgun)), "CLOSED", "north of US 36");
  assert.equal(status(evaluate(quail, "2027-01-20", WEST, shotgun)), "CLOSED", "west of I-25, outside the five counties");
  assert.equal(status(evaluate(quail, "2027-01-20", "104", shotgun)), "NEEDS_VERIFICATION", "I-70 crosses unit 104");
  assert.equal(status(evaluate(quail, "2027-01-20", "59", shotgun)), "NEEDS_VERIFICATION", "unit 59 is partly in Teller County");
  /* Before January 3 every area is open, so the unplaced line does not matter. */
  assert.equal(status(evaluate(quail, "2026-12-01", "104", shotgun)), "CONDITIONAL");
  assert.equal(status(evaluate(quail, "2026-12-01", "104", shotgun, "ZONE")), "CONDITIONAL");
  assert.equal(status(evaluate(quail, "2027-02-01", "140", shotgun)), "CLOSED");
});

test("greater prairie-chicken: named units and east of Colo 71 open, Morgan County units unplaced, the rest closed", () => {
  const chicken = "species:greater-prairie-chicken";
  const shotgun = { HUNT_METHOD: "SHOTGUN" };
  assert.equal(status(evaluate(chicken, "2026-09-30", EAST, shotgun)), "CLOSED");
  assert.equal(status(evaluate(chicken, "2026-10-01", EAST, shotgun)), "CONDITIONAL");
  assert.equal(status(evaluate(chicken, "2026-10-01", "100", shotgun)), "CONDITIONAL");
  assert.equal(status(evaluate(chicken, "2026-10-01", "95", shotgun)), "NEEDS_VERIFICATION", "unit 95 is partly in Morgan County");
  assert.equal(status(evaluate(chicken, "2026-10-01", "87", shotgun)), "CLOSED", "north of Colo 14");
  assert.equal(status(evaluate(chicken, "2026-10-01", "104", shotgun)), "CLOSED", "west of Colo 71, no Morgan County");
  assert.equal(status(evaluate(chicken, "2026-10-01", WEST, shotgun)), "CLOSED");
});

test("furbearers: November 1 to the end of February, no slingshot and no hawk, two a day", () => {
  const fox = "species:red-fox";
  assert.equal(status(evaluate(fox, "2026-10-31", WEST, { HUNT_METHOD: "RIFLE" })), "CLOSED");
  assert.equal(status(evaluate(fox, "2026-11-01", WEST, { HUNT_METHOD: "RIFLE" })), "CONDITIONAL");
  assert.equal(status(evaluate(fox, "2026-11-01", WEST, { HUNT_METHOD: "SLINGSHOT" })), "CLOSED");
  assert.equal(status(evaluate(fox, "2026-11-01", WEST, { HUNT_METHOD: "FALCONRY" })), "CLOSED");
  assert.equal(status(evaluate("species:bobcat", "2026-11-15", WEST, { HUNT_METHOD: "RIFLE" })), "CLOSED", "#324 opens December 1");
  assert.equal(status(evaluate("species:bobcat", "2026-12-01", WEST, { HUNT_METHOD: "RIFLE" })), "CONDITIONAL");
  assert.equal(status(evaluate("species:beaver", "2027-03-31", EAST, { HUNT_METHOD: "RIFLE" })), "CONDITIONAL");
  assert.equal(status(evaluate("species:beaver", "2027-04-01", EAST, { HUNT_METHOD: "RIFLE" })), "CLOSED");
  assert.equal(status(evaluate("species:coyote", "2027-07-04", EAST, { HUNT_METHOD: "RIFLE" })), "CONDITIONAL");
  const fur = evaluate(fox, "2026-11-01", WEST, { HUNT_METHOD: "RIFLE" }).result!;
  assert.ok(fur.requirements.some((line) => /two \(2\) red fox daily; unlimited possession/.test(line)));
  /* "Unlimited possession" is not a number, so no possession row is manufactured for it. */
  assert.deepEqual(fur.harvestLimits?.map((limit) => [limit.kind, limit.count]), [["DAILY", 2]]);
});

test("legal hours: small game ends at sunset; furbearers half an hour after, and eight of them may also be hunted at night", () => {
  const small = evaluate("species:dusky-grouse", "2026-10-01", WEST, { HUNT_METHOD: "RIFLE" }).result!.legalTime;
  const fur = evaluate("species:red-fox", "2026-12-01", WEST, { HUNT_METHOD: "RIFLE" }).result!.legalTime;
  const marten = evaluate("species:american-marten", "2026-12-01", WEST, { HUNT_METHOD: "RIFLE" }).result!.legalTime;
  assert.equal(small.status, "RESOLVED");
  assert.equal(fur.status, "RESOLVED");
  assert.ok(small.status === "RESOLVED" && /to sunset\.$/.test(small.statedAs ?? ""));
  assert.ok(fur.status === "RESOLVED" && fur.exceptions?.some((exception) => exception.effect === "WIDENS"));
  assert.ok(marten.status === "RESOLVED" && !marten.exceptions, "pine marten is not one of #302(A)(2)'s night species");
  /* A whole unit has no single sunrise, so no window is claimed for it. */
  assert.equal(evaluate("species:dusky-grouse", "2026-10-01", WEST, { HUNT_METHOD: "RIFLE" }, "ZONE").result!.legalTime.status, "NOT_CERTIFIED");
});

test("west of I-25 the centerfire limit is attached; east of it, and outside Jackson County the refuge shot rule, are not", () => {
  const regular = { SEASON_TYPE: "REGULAR", HUNT_METHOD: "SHOTGUN" };
  const west = evaluate("species:mountain-cottontail", "2026-11-01", WEST, regular).result!;
  const east = evaluate("species:mountain-cottontail", "2026-11-01", EAST, regular).result!;
  const northPark = evaluate("species:mountain-cottontail", "2026-11-01", "161", regular).result!;
  assert.ok(west.requirements.some((line) => /\.23 calibre/.test(line)));
  assert.ok(!east.requirements.some((line) => /\.23 calibre/.test(line)));
  assert.ok(northPark.requirements.some((line) => /Arapaho National Wildlife Refuge/.test(line)));
  assert.ok(!west.requirements.some((line) => /Arapaho National Wildlife Refuge/.test(line)));
});

test("outside the certified year, and for a species Chapter W-3 does not set, the engine says so rather than CLOSED", () => {
  assert.equal(status(evaluate("species:coyote", "2027-09-01", EAST, { HUNT_METHOD: "RIFLE" })), "NEEDS_VERIFICATION");
  assert.equal(status(evaluate("species:elk", "2026-10-10", WEST)), "UNKNOWN");
  assert.equal(status(evaluate("species:wild-turkey", "2026-10-10", WEST)), "UNKNOWN");
});

test("every certification case written from the law gets that answer from the engine", () => {
  const { cases } = JSON.parse(readFileSync(new URL("../../../../fixtures/hunt/us-co-certification-cases.json", import.meta.url), "utf8")) as {
    cases: Array<{ id: string; latitude: number; longitude: number; speciesId: string; date: string; answers?: HuntDimensionAnswers; expect: { status: string; completeness: string; daily?: number; possession?: number } }>;
  };
  assert.ok(cases.length >= 15);
  for (const item of cases) {
    /* The unit is the one CPW's own service placed this point in. */
    const sample = PARITY.results.find((result) => result.kind === "inside" && result.latitude === item.latitude && result.longitude === item.longitude);
    assert.ok(sample, `${item.id}: not a CPW sample point`);
    const evaluation = evaluate(item.speciesId, item.date, sample!.official[0], item.answers ?? {});
    assert.equal(evaluation.completeness, item.expect.completeness, item.id);
    assert.equal(evaluation.result?.status, item.expect.status, item.id);
    if (item.expect.daily !== undefined) assert.equal(evaluation.result?.limits?.daily, item.expect.daily, item.id);
    if (item.expect.possession !== undefined) assert.equal(evaluation.result?.limits?.possession, item.expect.possession, item.id);
  }
});

test("coverage counts units by the rule's own geography, and closed is the statute's, not silence", () => {
  const report = coloradoCoverageReport();
  assert.equal(report.officialUnits, 186);
  const of = (speciesId: string) => report.species.find((entry) => entry.speciesId === speciesId)!;
  assert.equal(of("species:coyote").unitsReached, 186);
  assert.equal(of("species:dusky-grouse").unitsReached, 126);
  assert.equal(of("species:dusky-grouse").unitsClosedByAbsence, 60);
  assert.equal(of("species:sharp-tailed-grouse").unitsReached, 10);
  assert.equal(of("species:greater-prairie-chicken").unitsUnknown, 0);
  assert.equal(COLORADO_BUNDLE.absence.meaning, "CLOSED");
});
