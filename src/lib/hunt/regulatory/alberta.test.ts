import assert from "node:assert/strict";
import test from "node:test";
import type { HuntDimensionAnswers } from "./dimensions.ts";
import { ALBERTA_BUNDLE, ALBERTA_SPECIES, albertaCoverageReport, evaluateAlberta } from "./alberta.ts";

/**
 * Alberta, evaluated from the committed bundle.
 *
 * Every expectation was read from the 2026 Alberta Guide to Hunting Regulations
 * (pp. 30–31, 47–57, 63), not from the engine's output. Places are real: each
 * coordinate is the unit's centroid as Alberta's own service reports it, checked
 * to fall inside that unit.
 */

const RUFFED = "species:ruffed-grouse";
const DEER = "species:white-tailed-deer";

function at(wmu: string, latitude: number, longitude: number) {
  return {
    zoneId: `management_zone:ca-ab-wmu-${wmu}`,
    zoneName: `Wildlife Management Unit ${wmu}`,
    latitude,
    longitude,
    overlays: new Set<string>(),
  };
}

const PLACES = {
  wmu102: at("102", 49.1702, -110.7056), // Pakowi — Sunday big-game hunting prohibited
  wmu162: at("162", 51.3086, -111.1004), // Berry — same prairie table, Sundays open
  wmu212: at("212", 51.0156, -114.0246), // Calgary — archery only
  wmu404: at("404", 50.3519, -114.6665), // Highwood
  wmu406: at("406", 50.7466, -114.762), // Elbow — general deer season by special licence
  wmu718: at("718", 49.1106, -111.7961), // Writing-On-Stone Provincial Park — named by no row
  wmu728: at("728", 52.7446, -111.0069), // West Wainwright (CFB Wainwright)
  wmu936: at("936", 53.494, -112.8197), // Cooking Lake–Blackfoot
};

type Place = (typeof PLACES)[keyof typeof PLACES];

function evaluate(speciesId: string, date: string, place: Place, answers: HuntDimensionAnswers = {}) {
  return evaluateAlberta({ speciesId, speciesName: speciesId.slice(8).replace(/-/g, " "), date, place, answers });
}

function status(evaluation: ReturnType<typeof evaluate>) {
  return evaluation.completeness === "NEEDS_INPUT" ? `ASK ${evaluation.required?.id}` : evaluation.result?.status;
}

const antlered = (extra: HuntDimensionAnswers = {}): HuntDimensionAnswers =>
  ({ ...extra, animalClasses: [{ dimension: "ANTLER_CLASS", value: "ANTLERED" }] });
const antlerless = (extra: HuntDimensionAnswers = {}): HuntDimensionAnswers =>
  ({ ...extra, animalClasses: [{ dimension: "ANTLER_CLASS", value: "ANTLERLESS" }] });

/* ── The bundle ─────────────────────────────────────────────────────────── */

test("the bundle is Alberta's 2026–27 licence year, and absence means unknown", () => {
  assert.equal(ALBERTA_BUNDLE.jurisdictionId, "jurisdiction:ca-ab");
  assert.deepEqual(ALBERTA_BUNDLE.certifiedPeriod, { from: "2026-04-01", to: "2027-03-31" });
  assert.equal(ALBERTA_BUNDLE.absence.meaning, "UNKNOWN");
  assert.deepEqual(ALBERTA_SPECIES, [RUFFED, "species:sharp-tailed-grouse", "species:spruce-grouse", DEER].sort());
});

/* ── Grouse: where and when, nothing asked ──────────────────────────────── */

test("ruffed grouse in WMU 102 is open 1 September to 15 January and asks nothing", () => {
  assert.equal(status(evaluate(RUFFED, "2026-10-10", PLACES.wmu102)), "CONDITIONAL");
  assert.equal(status(evaluate(RUFFED, "2027-01-15", PLACES.wmu102)), "CONDITIONAL");
  assert.equal(status(evaluate(RUFFED, "2026-08-31", PLACES.wmu102)), "CLOSED");
  assert.equal(status(evaluate(RUFFED, "2027-01-16", PLACES.wmu102)), "CLOSED");
});

test("the mountain units open a week later, and CFB Wainwright has three days", () => {
  assert.equal(status(evaluate(RUFFED, "2026-09-05", PLACES.wmu404)), "CLOSED");
  assert.equal(status(evaluate(RUFFED, "2026-09-08", PLACES.wmu404)), "CONDITIONAL");
  assert.equal(status(evaluate(RUFFED, "2026-09-06", PLACES.wmu728)), "CONDITIONAL");
  assert.equal(status(evaluate(RUFFED, "2026-09-10", PLACES.wmu728)), "CLOSED");
  const wainwright = evaluate(RUFFED, "2026-09-06", PLACES.wmu728).result!;
  assert.ok(wainwright.requirements.some((line) => /safety briefing/.test(line)));
});

test("a unit no row names is UNKNOWN, never CLOSED", () => {
  const result = evaluate(RUFFED, "2026-10-10", PLACES.wmu718).result!;
  assert.equal(result.status, "UNKNOWN");
});

test("a date beyond the licence year the guide covers is not answered as closed", () => {
  assert.equal(status(evaluate(RUFFED, "2027-05-01", PLACES.wmu102)), "NEEDS_VERIFICATION");
});

/* ── White-tailed deer: implement, antler class and special licence ─────── */

test("WMU 102 in September: only the implement changes the answer, so only it is asked", () => {
  // 16 September 2026 is a Wednesday inside the archery-only season (S1 - N3).
  const first = evaluate(DEER, "2026-09-16", PLACES.wmu102);
  assert.equal(status(first), "ASK HUNT_METHOD");
  assert.equal(status(evaluate(DEER, "2026-09-16", PLACES.wmu102, { HUNT_METHOD: "BOW" })), "CONDITIONAL");
  assert.equal(status(evaluate(DEER, "2026-09-16", PLACES.wmu102, { HUNT_METHOD: "RIFLE" })), "CLOSED");
  // A crossbow is a general-season implement, not an archery-only one.
  assert.equal(status(evaluate(DEER, "2026-09-16", PLACES.wmu102, { HUNT_METHOD: "CROSSBOW" })), "CLOSED");
});

test("Sunday is closed to big game in WMU 102 but not in WMU 162, from the same printed dates", () => {
  // 20 September 2026 is a Sunday.
  const bow = { HUNT_METHOD: "BOW" };
  assert.equal(status(evaluate(DEER, "2026-09-20", PLACES.wmu102, bow)), "CLOSED");
  assert.equal(status(evaluate(DEER, "2026-09-19", PLACES.wmu102, bow)), "CONDITIONAL");
  assert.equal(status(evaluate(DEER, "2026-09-20", PLACES.wmu162, bow)), "CONDITIONAL");
});

test("WMU 102 in November: antlered is open on a general licence, antlerless needs a special licence", () => {
  // 4 November 2026 is a Wednesday, the first day of the prairie general season.
  assert.equal(status(evaluate(DEER, "2026-11-04", PLACES.wmu102, { HUNT_METHOD: "RIFLE" })), "ASK ANIMAL_CLASS:ANTLER_CLASS");
  assert.equal(status(evaluate(DEER, "2026-11-04", PLACES.wmu102, antlered({ HUNT_METHOD: "RIFLE" }))), "CONDITIONAL");
  assert.equal(
    status(evaluate(DEER, "2026-11-04", PLACES.wmu102, antlerless({ HUNT_METHOD: "RIFLE" }))),
    "ASK LICENCE_TYPE",
  );
  assert.equal(status(evaluate(DEER, "2026-11-04", PLACES.wmu102, antlerless({ HUNT_METHOD: "RIFLE", LICENCE_TYPE: "GENERAL" }))), "CLOSED");
  const special = evaluate(DEER, "2026-11-04", PLACES.wmu102, antlerless({ HUNT_METHOD: "RIFLE", LICENCE_TYPE: "SPECIAL" })).result!;
  assert.equal(special.status, "CONDITIONAL");
  // The answer is an assumption, and says so.
  assert.ok(special.requirements.some((line) => /special licence/i.test(line) && /not verified/i.test(line)));
});

test("the prairie general season is the printed Wednesday-to-Saturday blocks only", () => {
  const rifle = antlered({ HUNT_METHOD: "RIFLE" });
  assert.equal(status(evaluate(DEER, "2026-11-07", PLACES.wmu102, rifle)), "CONDITIONAL"); // Saturday
  assert.equal(status(evaluate(DEER, "2026-11-09", PLACES.wmu102, rifle)), "CLOSED"); // Monday
});

test("WMU 406: the general season is special-licence only, the archery season is not", () => {
  // 1 October 2026: general ■ S24 - N30 applies; archery-only S9 - S23 has closed.
  assert.equal(status(evaluate(DEER, "2026-10-01", PLACES.wmu406, { HUNT_METHOD: "RIFLE" })), "ASK LICENCE_TYPE");
  assert.equal(status(evaluate(DEER, "2026-10-01", PLACES.wmu406, { HUNT_METHOD: "RIFLE", LICENCE_TYPE: "GENERAL" })), "CLOSED");
  assert.equal(status(evaluate(DEER, "2026-10-01", PLACES.wmu406, { HUNT_METHOD: "RIFLE", LICENCE_TYPE: "SPECIAL" })), "CONDITIONAL");
  // 10 September: the archery-only season is open to a general licence, so the licence is not asked.
  assert.equal(status(evaluate(DEER, "2026-09-10", PLACES.wmu406, { HUNT_METHOD: "BOW" })), "CONDITIONAL");
});

test("WMU 212 is archery-only, and WMU 936 carries its discharge permit", () => {
  assert.equal(status(evaluate(DEER, "2026-10-15", PLACES.wmu212, { HUNT_METHOD: "RIFLE" })), "CLOSED");
  assert.equal(status(evaluate(DEER, "2026-10-15", PLACES.wmu212, { HUNT_METHOD: "BOW" })), "CONDITIONAL");
  // 936: archery-only O17 - O31; 20 October 2026 is a Tuesday.
  const result = evaluate(DEER, "2026-10-20", PLACES.wmu936, { HUNT_METHOD: "BOW" }).result!;
  assert.equal(result.status, "CONDITIONAL");
  assert.ok(result.requirements.some((line) => /firearms discharge permit/.test(line)));
});

test("an answer the vocabulary does not offer leaves the question open", () => {
  assert.equal(status(evaluate(DEER, "2026-09-16", PLACES.wmu102, { HUNT_METHOD: "BAZOOKA" })), "ASK HUNT_METHOD");
  assert.equal(
    status(evaluate(DEER, "2026-11-04", PLACES.wmu102, antlerless({ HUNT_METHOD: "RIFLE", LICENCE_TYPE: "DEFINITELY" }))),
    "ASK LICENCE_TYPE",
  );
});

test("every answer carries Alberta's standing and legal-time wording", () => {
  const result = evaluate(RUFFED, "2026-10-10", PLACES.wmu102).result!;
  assert.equal(result.legalTime.status, "RULE_ONLY");
  assert.match(result.legalTime.text, /one-half hour after sunset/);
  assert.ok(result.limitations.some((line) => /neither a legal document/.test(line)));
  assert.ok(result.limitations.some((line) => /Aboriginal or Métis harvesting rights/.test(line)));
});

/* ── Coverage ───────────────────────────────────────────────────────────── */

test("coverage is counted from the bundle: reached, and the unknown remainder", () => {
  const report = albertaCoverageReport();
  assert.equal(report.officialUnits, 189);
  const bySpecies = Object.fromEntries(report.species.map((row) => [row.speciesId, row]));
  assert.equal(bySpecies[RUFFED].unitsReached, 179);
  assert.equal(bySpecies[RUFFED].unitsUnknown, 10);
  assert.equal(bySpecies[RUFFED].requiresInput, false);
  assert.equal(bySpecies[DEER].unitsReached, 177);
  assert.equal(bySpecies[DEER].requiresInput, true);
  assert.equal(report.disputes, 0);
});
