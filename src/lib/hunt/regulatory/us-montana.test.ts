import assert from "node:assert/strict";
import test from "node:test";
import type { CanonicalId } from "../../content-contract/index.ts";
import { clearOverlayCache, lookupOverlays, restrictionsFor, type RestrictionRecord } from "../overlays.ts";
import { quoting } from "../provenance.ts";
import type { HuntDimensionAnswers } from "./dimensions.ts";
import { evaluateMontana, MONTANA_BUNDLE, MONTANA_OVERLAYS, montanaCoverageReport, montanaRestrictionTokensFor } from "./us-montana.ts";
import { REGULATORY_REGISTRY } from "./registry.ts";
import type { ZoneResolution } from "../types.ts";

/**
 * Montana's 2026 upland game bird rules, with every expectation written from
 * the regulations before the test was run:
 *
 *   p. 9  Mountain grouse (blue, ruffed, Franklin's): Sep. 01 – Jan. 01 for
 *         everyone; 3 in aggregate daily.
 *         Partridge: Sep. 01 – Jan. 01; nonresidents on public or access-program
 *         land Sep. 11 – Jan. 01; a described portion of Carbon County to Jan. 10.
 *         Sharp-tailed grouse: Sep. 01 – Jan. 01 (nonresident public Sep. 11);
 *         "Closed West of the Continental Divide."
 *   p. 10 Pheasant: youth only Sep. 19 – 20; Oct. 10 – Jan. 1 for residents and
 *         nonresidents on private land; Oct. 20 for nonresidents on public land;
 *         Oct 17 for nonresident 3-day licences on private land.
 *   p. 4  Indian reservations closed to state-licensed upland hunting unless
 *         provided for by a cooperative agreement.
 */

const EAST = "management_zone:us-mt-upland-east-of-the-continental-divide";
const WEST = "management_zone:us-mt-upland-west-of-the-continental-divide";

function evaluate(speciesId: string, date: string, answers: HuntDimensionAnswers = {}, options: { zone?: string; overlays?: string[]; restrictions?: RestrictionRecord[] } = {}) {
  const zoneId = options.zone ?? EAST;
  return evaluateMontana({
    speciesId, speciesName: speciesId.slice(8).replace(/-/g, " "), date, answers,
    place: { zoneId, zoneName: zoneId === EAST ? "East of the Continental Divide" : "West of the Continental Divide", latitude: 46.6, longitude: -110.9, overlays: new Set(options.overlays ?? []) },
    restrictions: options.restrictions,
  });
}

const status = (evaluation: ReturnType<typeof evaluate>) =>
  evaluation.completeness === "NEEDS_INPUT" ? `ASK ${evaluation.required?.id}` : evaluation.result?.status;

/* A gun, so these read the firearm and archery seasons; falconry has its own tests below. */
const GUN: HuntDimensionAnswers = { HUNT_METHOD: "SHOTGUN" };

test("mountain grouse by gun asks nothing more and runs Sep. 1 to Jan. 1 across the new year, inclusive", () => {
  assert.equal(status(evaluate("species:ruffed-grouse", "2026-08-31", GUN)), "CLOSED");
  assert.equal(status(evaluate("species:ruffed-grouse", "2026-09-01", GUN)), "CONDITIONAL");
  assert.equal(status(evaluate("species:ruffed-grouse", "2027-01-01", GUN)), "CONDITIONAL");
  assert.equal(status(evaluate("species:ruffed-grouse", "2027-01-02", GUN)), "CLOSED");
  assert.equal(status(evaluate("species:spruce-grouse", "2026-10-10", GUN, { zone: WEST })), "CONDITIONAL");
  const limits = evaluate("species:ruffed-grouse", "2026-10-10", GUN).result!;
  assert.deepEqual(limits.limits, { daily: 3, possession: 12 });
  assert.ok(limits.requirements.some((line) => /3 in aggregate daily/.test(line)));
});

test("sharp-tailed grouse is closed west of the Continental Divide without asking anything", () => {
  assert.equal(status(evaluate("species:sharp-tailed-grouse", "2026-09-05", {}, { zone: WEST })), "CLOSED");
  // Falconry too: "all areas open ... by firearms" (p. 9), and none is open west.
  assert.equal(status(evaluate("species:sharp-tailed-grouse", "2027-02-01", { HUNT_METHOD: "FALCONRY" }, { zone: WEST })), "CLOSED");
});

test("east of the Divide, the nonresident public-land delay is asked only while it matters", () => {
  assert.equal(status(evaluate("species:sharp-tailed-grouse", "2026-09-05", GUN)), "ASK RESIDENCY");
  assert.equal(status(evaluate("species:sharp-tailed-grouse", "2026-09-05", { ...GUN, RESIDENCY: "RESIDENT" })), "CONDITIONAL");
  assert.equal(status(evaluate("species:sharp-tailed-grouse", "2026-09-05", { ...GUN, RESIDENCY: "NON_RESIDENT" })), "ASK LAND_TYPE");
  assert.equal(status(evaluate("species:sharp-tailed-grouse", "2026-09-05", { ...GUN, RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PUBLIC_OR_ACCESS" })), "CLOSED");
  assert.equal(status(evaluate("species:sharp-tailed-grouse", "2026-09-05", { ...GUN, RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PRIVATE_NOT_ACCESS" })), "CONDITIONAL");
  assert.equal(status(evaluate("species:sharp-tailed-grouse", "2026-09-11", { ...GUN, RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PUBLIC_OR_ACCESS" })), "CONDITIONAL");
  // After the tenth day everyone is in season, so nothing more is asked.
  assert.equal(status(evaluate("species:sharp-tailed-grouse", "2026-10-10", GUN)), "CONDITIONAL");
});

test("partridge runs to Jan. 10 only inside the described portion of Carbon County", () => {
  const resident = { ...GUN, RESIDENCY: "RESIDENT" };
  assert.equal(status(evaluate("species:gray-partridge", "2027-01-05", resident)), "CLOSED");
  assert.equal(status(evaluate("species:gray-partridge", "2027-01-05", resident, { overlays: ["us-mt-carbon-county-partridge-portion"] })), "CONDITIONAL");
  assert.equal(status(evaluate("species:gray-partridge", "2027-01-11", resident, { overlays: ["us-mt-carbon-county-partridge-portion"] })), "CLOSED");
});

test("the youth pheasant weekend asks the hunter's age, and only that weekend", () => {
  assert.equal(status(evaluate("species:ring-necked-pheasant", "2026-09-19", GUN)), "ASK HUNTER_AGE");
  assert.equal(status(evaluate("species:ring-necked-pheasant", "2026-09-19", { ...GUN, HUNTER_AGE: "YOUTH_15_AND_UNDER" })), "CONDITIONAL");
  assert.equal(status(evaluate("species:ring-necked-pheasant", "2026-09-19", { ...GUN, HUNTER_AGE: "16_AND_OVER" })), "CLOSED");
  const youth = evaluate("species:ring-necked-pheasant", "2026-09-20", { ...GUN, HUNTER_AGE: "YOUTH_15_AND_UNDER" }).result!;
  assert.ok(youth.requirements.some((line) => /accompanied by a nonhunting adult/.test(line)));
});

test("pheasant opens Oct. 10, Oct. 17 or Oct. 20 depending on residency, land and license", () => {
  const ask = (answers: HuntDimensionAnswers) => status(evaluate("species:ring-necked-pheasant", "2026-10-12", { ...GUN, ...answers }));
  assert.equal(ask({ RESIDENCY: "RESIDENT" }), "CONDITIONAL");
  assert.equal(ask({ RESIDENCY: "NON_RESIDENT" }), "ASK LAND_TYPE");
  assert.equal(ask({ RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PUBLIC_OR_ACCESS" }), "CLOSED");
  assert.equal(ask({ RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PRIVATE_NOT_ACCESS" }), "ASK LICENCE_TYPE");
  assert.equal(ask({ RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PRIVATE_NOT_ACCESS", LICENCE_TYPE: "SEASON" }), "CONDITIONAL");
  assert.equal(ask({ RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PRIVATE_NOT_ACCESS", LICENCE_TYPE: "THREE_DAY" }), "CLOSED");
  assert.equal(status(evaluate("species:ring-necked-pheasant", "2026-10-17", { ...GUN, RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PRIVATE_NOT_ACCESS", LICENCE_TYPE: "THREE_DAY" })), "CONDITIONAL");
  // A 3-day license is a nonresident license: a resident cannot hold one.
  assert.notEqual(ask({ RESIDENCY: "RESIDENT", LICENCE_TYPE: "THREE_DAY" }), "CLOSED");
});

test("on a reservation the Commission closed to state licenses, the answer is CLOSED and says what it does not describe", () => {
  const result = evaluate("species:ruffed-grouse", "2026-10-10", {}, { overlays: ["us-mt-reservation-state-licence-closed"] }).result!;
  assert.equal(result.status, "CLOSED");
  assert.ok(result.limitations.some((line) => /with the use of state licenses/.test(line.text)));
  assert.ok(result.limitations.some((line) => /under the tribe's own authority/.test(line.text)));
});

test("on the Flathead or Crow reservation North Ground does not state a status", () => {
  const flathead = MONTANA_OVERLAYS.layers.find((layer) => layer.key === "reservations")!.features.find((feature) => feature.name === "Flathead Reservation")!;
  /* Narrowing the catalogue union is itself the assertion worth making: the
     cooperative-agreement sentence is the AUTHORITY's, so Flathead must be on
     the `statedAs` branch. If it ever moves to `northGroundSummary` this stops
     compiling rather than silently quoting our words as Montana's. */
  assert.ok(flathead.statedAs !== undefined, "Flathead's wording is the authority's, not North Ground's");
  const result = evaluate("species:ruffed-grouse", "2026-10-10", GUN, {
    restrictions: [{
      name: flathead.name,
      words: quoting(
        flathead.statedAs,
        "source:us-census-tigerweb-federal-reservations-2026" as CanonicalId<"source">,
        "TIGERweb federal reservations",
        "en-CA",
      ),
      sourceId: "source:us-census-tigerweb-federal-reservations-2026",
    }],
  }).result!;
  assert.equal(result.status, "NEEDS_VERIFICATION");
  assert.ok(result.limitations.some((line) => /cooperative management agreement/.test(line.text)));
});

test("Gates of the Mountains Game Preserve is closed to all hunting", () => {
  assert.equal(status(evaluate("species:ruffed-grouse", "2026-10-10", {}, { overlays: ["us-mt-closed-to-all-hunting"] })), "CLOSED");
});

test("a date outside the 2026 licence year is not answered with 2026 rules", () => {
  assert.equal(status(evaluate("species:ruffed-grouse", "2027-03-01")), "NEEDS_VERIFICATION");
});

test("a species the bundle does not encode is a coverage gap, never a closure", () => {
  assert.equal(status(evaluate("species:elk", "2026-10-10")), "UNKNOWN");
});

/*
 * The three species added 2026-10-01, expectations written from the booklet
 * before the build was run:
 *
 *   p. 9  "Mountain Grouse: Blue, ruffed, and Franklin's grouse" — the blue
 *         grouse of Montana is the dusky grouse — Sep. 01 – Jan. 01 for everyone.
 *         "Partridge: Hungarian and chukar partridge" — chukar has the gray
 *         partridge's seasons, including the Carbon County portion to Jan. 10.
 *         "Sage Grouse (Free Supplemental Sage Grouse Hunting Permit Required)":
 *         Sep. 01 – Sep. 30, nonresidents on public or access land Sep. 11;
 *         2 daily, possession two times; "Closed West of the Continental Divide."
 *   p. 2  The nonresident 3-day license "is not valid for sage grouse at any time".
 */

test("dusky grouse is Montana's blue grouse: the mountain grouse season, nothing asked", () => {
  assert.equal(status(evaluate("species:dusky-grouse", "2026-08-31", GUN, { zone: WEST })), "CLOSED");
  assert.equal(status(evaluate("species:dusky-grouse", "2026-09-01", GUN, { zone: WEST })), "CONDITIONAL");
  assert.equal(status(evaluate("species:dusky-grouse", "2027-01-01", GUN)), "CONDITIONAL");
  assert.equal(status(evaluate("species:dusky-grouse", "2027-01-02", GUN)), "CLOSED");
  assert.deepEqual(evaluate("species:dusky-grouse", "2026-10-10", GUN).result!.limits, { daily: 3, possession: 12 });
});

test("chukar follows the partridge season, with the Carbon County portion running to Jan. 10", () => {
  const resident = { ...GUN, RESIDENCY: "RESIDENT" };
  const nonresidentPublic = { ...GUN, RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PUBLIC_OR_ACCESS" };
  assert.equal(status(evaluate("species:chukar", "2026-08-31", resident)), "CLOSED");
  assert.equal(status(evaluate("species:chukar", "2026-09-01", resident)), "CONDITIONAL");
  assert.equal(status(evaluate("species:chukar", "2026-09-05", nonresidentPublic)), "CLOSED");
  assert.equal(status(evaluate("species:chukar", "2026-09-11", nonresidentPublic)), "CONDITIONAL");
  assert.equal(status(evaluate("species:chukar", "2027-01-05", resident)), "CLOSED");
  assert.equal(status(evaluate("species:chukar", "2027-01-05", resident, { overlays: ["us-mt-carbon-county-partridge-portion"] })), "CONDITIONAL");
  assert.equal(status(evaluate("species:chukar", "2027-01-11", resident, { overlays: ["us-mt-carbon-county-partridge-portion"] })), "CLOSED");
  assert.deepEqual(evaluate("species:chukar", "2026-10-10", GUN).result!.limits, { daily: 8, possession: 32 });
});

test("sage grouse: east of the Divide in September only, closed west, a free permit, never on a 3-day license", () => {
  const resident: HuntDimensionAnswers = { ...GUN, RESIDENCY: "RESIDENT" };
  assert.equal(status(evaluate("species:greater-sage-grouse", "2026-08-31", resident)), "CLOSED");
  assert.equal(status(evaluate("species:greater-sage-grouse", "2026-09-01", resident)), "CONDITIONAL");
  assert.equal(status(evaluate("species:greater-sage-grouse", "2026-09-30", resident)), "CONDITIONAL");
  assert.equal(status(evaluate("species:greater-sage-grouse", "2026-10-01", resident)), "CLOSED");
  assert.equal(status(evaluate("species:greater-sage-grouse", "2026-09-15", {}, { zone: WEST })), "CLOSED");
  const nonresidentPublic: HuntDimensionAnswers = { ...GUN, RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PUBLIC_OR_ACCESS" };
  assert.equal(status(evaluate("species:greater-sage-grouse", "2026-09-05", { ...nonresidentPublic, LICENCE_TYPE: "SEASON" })), "CLOSED");
  assert.equal(status(evaluate("species:greater-sage-grouse", "2026-09-15", { ...nonresidentPublic, LICENCE_TYPE: "SEASON" })), "CONDITIONAL");
  assert.equal(status(evaluate("species:greater-sage-grouse", "2026-09-15", { ...nonresidentPublic, LICENCE_TYPE: "THREE_DAY" })), "CLOSED");
  assert.equal(status(evaluate("species:greater-sage-grouse", "2026-09-15", { ...GUN, RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PRIVATE_NOT_ACCESS" })), "ASK LICENCE_TYPE");
  const open = evaluate("species:greater-sage-grouse", "2026-09-15", resident).result!;
  assert.deepEqual(open.limits, { daily: 2, possession: 4 });
  assert.ok(open.requirements.some((line) => /Supplemental Sage Grouse Hunting Permit/.test(line)));
  // The permit is a sage grouse condition, not every upland bird's.
  assert.ok(!evaluate("species:ruffed-grouse", "2026-09-15", GUN).result!.requirements.some((line) => /Sage Grouse/.test(line)));
  assert.equal(status(evaluate("species:greater-sage-grouse", "2026-09-15", resident, { overlays: ["us-mt-reservation-state-licence-closed"] })), "CLOSED");
});

test("each species' answer names its own lawful methods: mountain grouse admit crossbows and air rifles, the rest a shotgun or a bow", () => {
  const methods = (speciesId: string) => evaluate(speciesId, "2026-10-20", { RESIDENCY: "RESIDENT", HUNT_METHOD: "BOW" }).result!.requirements.filter((line) => /^Lawful methods/.test(line));
  for (const speciesId of ["species:ruffed-grouse", "species:spruce-grouse", "species:dusky-grouse"]) {
    const [line, ...rest] = methods(speciesId);
    assert.equal(rest.length, 0, speciesId);
    assert.match(line, /a crossbow; a firearm; or an air rifle/, speciesId);
  }
  for (const speciesId of ["species:gray-partridge", "species:chukar", "species:sharp-tailed-grouse", "species:ring-necked-pheasant"]) {
    const [line, ...rest] = methods(speciesId);
    assert.equal(rest.length, 0, speciesId);
    assert.match(line, /a shotgun no larger than 10 gauge, or a long, recurve or compound bow and arrow\. All other means/, speciesId);
    assert.doesNotMatch(line, /crossbow|air rifle/, speciesId);
  }
  // Sage grouse closed on Sep. 30, so a closed answer lists no methods.
  assert.deepEqual(methods("species:greater-sage-grouse"), []);
});

test("coverage is computed from the bundle: eight species, two districts, reservations never counted as open", () => {
  const report = montanaCoverageReport();
  assert.equal(report.officialUnits, 2);
  assert.deepEqual(report.species.map((row) => row.speciesId), [
    "species:chukar", "species:dusky-grouse", "species:gray-partridge", "species:greater-sage-grouse",
    "species:ring-necked-pheasant", "species:ruffed-grouse", "species:sharp-tailed-grouse", "species:spruce-grouse",
  ]);
  // 45 firearm/archery and closure rules, and 26 falconry rules (p. 9).
  assert.equal(MONTANA_BUNDLE.rules.length, 71);
  assert.ok(MONTANA_BUNDLE.rules.every((rule) => rule.sourceId === "source:us-mt-upland-regulations-2026"));
});

/*
 * Falconry, written from the booklet before the build was run:
 *
 *   p. 9  "Falconry: All areas open to hunting of upland game birds and/or
 *         migratory game birds by firearms shall be open to either-sex hunting
 *         of that species by falconry." Sep. 01 – Mar. 31; nonresidents on
 *         public or access-program land Sep. 11 – Mar. 31. "2 daily in aggregate
 *         and 6 in possession", not in addition to the general limits. A sage
 *         grouse permit for sage grouse.
 *   p. 2  The 3-day license is "not valid for sage grouse at any time or for
 *         ring-neck pheasants during the opening week of the season".
 *   p. 10 The 3-day license's pheasant season opens Oct. 17, a week after Oct. 10.
 *
 * So after the general seasons close, falconry is the open season: a date
 * between Jan. 2 and Feb. 28 is CONDITIONAL by falconry and CLOSED by gun —
 * never CLOSED for every hunter, which is what the bundle said before falconry
 * was encoded.
 */

const FALCON: HuntDimensionAnswers = { HUNT_METHOD: "FALCONRY" };

test("after the general seasons close, every species is open by falconry and closed by gun", () => {
  for (const speciesId of [
    "species:ruffed-grouse", "species:spruce-grouse", "species:dusky-grouse", "species:gray-partridge", "species:chukar",
    "species:sharp-tailed-grouse", "species:greater-sage-grouse", "species:ring-necked-pheasant",
  ]) {
    /* A question, not an answer: by gun it is closed, by falconry open. (Sage
       grouse asks the license first, because a 3-day license is never valid
       for it.) */
    assert.equal(status(evaluate(speciesId, "2027-02-15")), speciesId === "species:greater-sage-grouse" ? "ASK LICENCE_TYPE" : "ASK HUNT_METHOD", speciesId);
    const open = evaluate(speciesId, "2027-02-15", { ...FALCON, RESIDENCY: "RESIDENT" });
    assert.equal(status(open), "CONDITIONAL", speciesId);
    assert.deepEqual(open.result!.limits, { daily: 2, possession: 6 }, speciesId);
    assert.ok(open.result!.requirements.some((line) => /taken by falconry only, either sex/.test(line)), speciesId);
    assert.equal(status(evaluate(speciesId, "2027-02-15", { ...GUN, RESIDENCY: "RESIDENT" })), "CLOSED", speciesId);
  }
  // The last day the booklet is valid for, and still falconry season.
  assert.equal(status(evaluate("species:ring-necked-pheasant", "2027-02-28", FALCON)), "CONDITIONAL");
});

test("the method is asked among the species' own methods, never one its row prohibits", () => {
  const offered = (speciesId: string) => evaluate(speciesId, "2027-02-15").required!.options.map((option) => option.value);
  assert.deepEqual(offered("species:ring-necked-pheasant"), ["SHOTGUN", "BOW", "FALCONRY"]);
  assert.deepEqual(offered("species:ruffed-grouse"), ["SHOTGUN", "BOW", "CROSSBOW", "FIREARM", "AIR_GUN", "FALCONRY"]);
  // A crossbow answer for pheasant is not applied, so it cannot narrow into a closure.
  assert.equal(status(evaluate("species:ring-necked-pheasant", "2027-02-15", { HUNT_METHOD: "CROSSBOW" })), "ASK HUNT_METHOD");
});

test("falconry follows the species' own firearm geography and closures", () => {
  // Sharp-tailed and sage grouse are closed west of the Divide, so falconry is too.
  assert.equal(status(evaluate("species:greater-sage-grouse", "2026-11-15", FALCON, { zone: WEST })), "CLOSED");
  assert.equal(status(evaluate("species:ring-necked-pheasant", "2026-11-15", { ...FALCON, RESIDENCY: "RESIDENT" }, { zone: WEST })), "CONDITIONAL");
  assert.equal(status(evaluate("species:ring-necked-pheasant", "2027-01-20", FALCON, { overlays: ["us-mt-reservation-state-licence-closed"] })), "CLOSED");
  assert.equal(status(evaluate("species:ring-necked-pheasant", "2027-01-20", FALCON, { overlays: ["us-mt-closed-to-all-hunting"] })), "CLOSED");
});

test("falconry's nonresident start and the 3-day license's limits", () => {
  const publicLand = { ...FALCON, RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PUBLIC_OR_ACCESS" };
  assert.equal(status(evaluate("species:sharp-tailed-grouse", "2026-09-05", publicLand)), "CLOSED");
  assert.equal(status(evaluate("species:sharp-tailed-grouse", "2026-09-11", publicLand)), "CONDITIONAL");
  // Sage grouse: never on a 3-day license, falconry included, and always with the permit.
  assert.equal(status(evaluate("species:greater-sage-grouse", "2026-12-01", { ...publicLand, LICENCE_TYPE: "THREE_DAY" })), "CLOSED");
  const sage = evaluate("species:greater-sage-grouse", "2026-12-01", { ...publicLand, LICENCE_TYPE: "SEASON" });
  assert.equal(status(sage), "CONDITIONAL");
  assert.ok(sage.result!.requirements.some((line) => /Supplemental Sage Grouse Hunting Permit/.test(line)));
  // Pheasant on a 3-day license: not during the opening week, Oct. 10–16.
  const threeDay = { ...FALCON, RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PRIVATE_NOT_ACCESS", LICENCE_TYPE: "THREE_DAY" };
  assert.equal(status(evaluate("species:ring-necked-pheasant", "2026-10-09", threeDay)), "CONDITIONAL");
  assert.equal(status(evaluate("species:ring-necked-pheasant", "2026-10-10", threeDay)), "CLOSED");
  assert.equal(status(evaluate("species:ring-necked-pheasant", "2026-10-16", threeDay)), "CLOSED");
  assert.equal(status(evaluate("species:ring-necked-pheasant", "2026-10-17", threeDay)), "CONDITIONAL");
  assert.equal(status(evaluate("species:ring-necked-pheasant", "2026-10-12", { ...threeDay, LICENCE_TYPE: "SEASON" })), "CONDITIONAL");
});

test("days the booklet does not settle for falconry answer NEEDS_VERIFICATION, never CLOSED", () => {
  // March 2026: the booklet took effect March 1 and speaks to the season opening Sep. 1.
  const march = evaluate("species:ring-necked-pheasant", "2026-03-15", { ...FALCON, RESIDENCY: "RESIDENT" });
  assert.equal(status(march), "NEEDS_VERIFICATION");
  assert.ok(march.result!.limitations.some((line) => /does not say whether falconry was open in March 2026/.test(line.text)));
  assert.equal(march.result!.season, undefined);
  assert.equal(status(evaluate("species:ring-necked-pheasant", "2026-03-15", { ...GUN, RESIDENCY: "RESIDENT" })), "CLOSED");
  // Mountain grouse by a nonresident on public land, Sep. 1–10: the falconry row
  // says Sep. 11, the nonresident delay exempts mountain grouse.
  const nonresidentPublic = { ...FALCON, RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PUBLIC_OR_ACCESS" };
  assert.equal(status(evaluate("species:ruffed-grouse", "2026-09-05", nonresidentPublic)), "NEEDS_VERIFICATION");
  assert.equal(status(evaluate("species:ruffed-grouse", "2026-09-11", nonresidentPublic)), "CONDITIONAL");
  assert.equal(status(evaluate("species:ruffed-grouse", "2026-09-05", { ...FALCON, RESIDENCY: "RESIDENT" })), "CONDITIONAL");
  // March 2027 is past the booklet's validity, for every method.
  assert.equal(status(evaluate("species:ring-necked-pheasant", "2027-03-15", FALCON)), "NEEDS_VERIFICATION");
});

test("pheasant's legal class is structured: cock by gun or bow, either sex by falconry", () => {
  const classes = (answers: HuntDimensionAnswers) =>
    [...new Set(evaluate("species:ring-necked-pheasant", "2026-11-02", { RESIDENCY: "RESIDENT", ...answers }).opportunities!.map((row) => JSON.stringify(row.animalClass)))];
  assert.deepEqual(classes(GUN), [JSON.stringify({ state: "STATED", value: "COCK" })]);
  assert.deepEqual(classes(FALCON), [JSON.stringify({ state: "STATED", value: "EITHER_SEX" })]);
  // Unanswered, both opportunities are shown, each with its own class and method.
  const both = evaluate("species:ring-necked-pheasant", "2026-11-02", { RESIDENCY: "RESIDENT" });
  assert.equal(status(both), "ASK HUNT_METHOD");
  const rows = both.opportunities!.map((row) => JSON.stringify([row.animalClass, row.implements]));
  assert.ok(rows.some((row) => row.includes("COCK") && row.includes("SHOTGUN") && !row.includes("FALCONRY")));
  assert.ok(rows.some((row) => row.includes("EITHER_SEX") && row.includes("FALCONRY") && !row.includes("SHOTGUN")));
  // Every class a rule states resolves to a class the bundle defines.
  const defined = new Set((MONTANA_BUNDLE as unknown as { legalAnimalClasses: Array<{ id: string }> }).legalAnimalClasses.map((entry) => entry.id));
  for (const rule of MONTANA_BUNDLE.rules as unknown as Array<{ id: string; animalClasses?: string[]; legalAnimalClassIds?: string[] }>) {
    if (rule.animalClasses?.length) assert.ok(rule.legalAnimalClassIds?.length && rule.legalAnimalClassIds.every((id) => defined.has(id)), rule.id);
  }
});

test("Bad Rock Canyon WMA: a point inside it is given no season status, from FWP's own boundary", async () => {
  /* The real catalogue and the real restriction path, with FWP's services
     stood in for: the WMA boundary layer answers one OBJECTID, the rest none. */
  const wmaLayer = MONTANA_OVERLAYS.layers.find((layer) => layer.key === "wildlife-management-areas")!;
  const badRock = wmaLayer.features.find((feature) => feature.name === "Bad Rock Canyon WMA")!;
  const other = wmaLayer.features.find((feature) => feature.name !== "Bad Rock Canyon WMA")!;
  const answering = (objectId: number) => (async (url: string | URL | Request) => {
    const ids = String(url).startsWith(wmaLayer.url) ? [objectId] : [];
    return new Response(JSON.stringify({ features: ids.map((id) => ({ attributes: { OBJECTID: id } })) }));
  }) as typeof fetch;

  const at = async (objectId: number, longitude: number, date: string) => {
    clearOverlayCache();
    const lookup = await lookupOverlays(MONTANA_OVERLAYS, 48.38, longitude, answering(objectId), null);
    assert.equal(lookup.available, true);
    return restrictionsFor(lookup, montanaRestrictionTokensFor("species:ring-necked-pheasant", date));
  };
  const inside = await at(badRock.objectId, -114.11, "2026-11-02");
  assert.equal(inside.length, 1);
  assert.match(inside[0].words.text, /^Hunting by limited access permit only\./);
  const answer = evaluate("species:ring-necked-pheasant", "2026-11-02", { ...GUN, RESIDENCY: "RESIDENT" }, { zone: WEST, restrictions: inside });
  assert.equal(status(answer), "NEEDS_VERIFICATION");
  assert.equal(answer.result!.season, undefined);

  // Any other WMA has no rule of its own in the booklet's restricted-areas
  // section; its only restriction is the winter-range closure, not yet in force.
  assert.deepEqual(await at(other.objectId, -114.12, "2026-11-02"), []);
});

/*
 * p. 6: "WMAs with game winter range are closed to public entry, unless
 * otherwise posted, from the day following the end of the general deer-elk
 * season or Dec. 1, whichever is later, to noon on May 15 each year". Which
 * WMAs have winter range, and the day the deer-elk season ends, are not in the
 * booklet — so from Dec. 1 to May 15 a point inside any WMA has no stated
 * season, and before Dec. 1 the closure cannot be in force.
 *
 * Asked of the registry's own Montana entry, so the date reaches the token
 * through the same path a hunt does.
 */
test("inside a WMA, the winter-range entry closure withholds a season from Dec. 1 to May 15, and not before", async () => {
  const entry = REGULATORY_REGISTRY.find((candidate) => candidate.jurisdictionId === "jurisdiction:us-mt")!;
  const wmaLayer = MONTANA_OVERLAYS.layers.find((layer) => layer.key === "wildlife-management-areas")!;
  const freezout = wmaLayer.features.find((feature) => /^Freezout/.test(feature.name))!;
  assert.ok(freezout.tokens.includes("wma_winter_range_entry_closure"));
  const zone: ZoneResolution = {
    status: "RESOLVED", zoneId: EAST as ZoneResolution["zoneId"], jurisdictionId: "jurisdiction:us-mt" as ZoneResolution["jurisdictionId"],
    officialName: "East of the Continental Divide", sourceId: "source:us-mt-upland-district-service" as ZoneResolution["sourceId"], message: "",
  };
  const ask = async (date: string, answers: HuntDimensionAnswers, inWma = true) => {
    clearOverlayCache();
    const fetcher = (async (url: string | URL | Request) => {
      const ids = inWma && String(url).startsWith(wmaLayer.url) ? [freezout.objectId] : [];
      return new Response(JSON.stringify({ features: ids.map((id) => ({ attributes: { OBJECTID: id } })) }));
    }) as typeof fetch;
    const outcome = await entry.evaluate(
      { latitude: 47.66, longitude: -112.03, date: date as never, speciesId: "species:ring-necked-pheasant" as never, answers },
      zone, { verifiedAt: "2026-10-01", fetcher },
    );
    return outcome.regulation;
  };
  const resident = { ...GUN, RESIDENCY: "RESIDENT" };
  assert.equal((await ask("2026-11-30", resident)).status, "CONDITIONAL", "the closure cannot begin before Dec. 1");
  const december = await ask("2026-12-01", resident);
  assert.equal(december.status, "NEEDS_VERIFICATION");
  assert.equal(december.season, undefined);
  assert.ok(december.limitations.some((line) => /WMAs with game winter range are closed to public entry/.test(line.text)));
  assert.equal((await ask("2026-12-01", resident, false)).status, "CONDITIONAL", "outside a WMA the season stands");
  // Falconry runs into the closure, and so is withheld inside a WMA too.
  assert.equal((await ask("2027-01-20", { ...FALCON, RESIDENCY: "RESIDENT" })).status, "NEEDS_VERIFICATION");
  assert.equal((await ask("2027-01-20", { ...FALCON, RESIDENCY: "RESIDENT" }, false)).status, "CONDITIONAL");
  // A closure is never turned into a season: by gun it is CLOSED in January whether or not the WMA is open.
  assert.equal((await ask("2027-01-20", resident)).status, "CLOSED");
});
