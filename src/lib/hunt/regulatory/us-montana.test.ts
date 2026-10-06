import assert from "node:assert/strict";
import test from "node:test";
import type { CanonicalId } from "../../content-contract/index.ts";
import { clearOverlayCache, lookupOverlays, restrictionsFor, type RestrictionRecord } from "../overlays.ts";
import { quoting } from "../provenance.ts";
import type { HuntDimensionAnswers } from "./dimensions.ts";
import { evaluateMontana, MONTANA_BUNDLE, MONTANA_OVERLAYS, montanaCoverageReport, montanaRestrictionTokensFor } from "./us-montana.ts";
import { REGULATORY_REGISTRY } from "./registry.ts";
import type { ZoneResolution } from "../types.ts";
import { generalConditions } from "../exploration/condition-scope.ts";
import { opportunityOf } from "../exploration/opportunity.ts";

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
    /* The pool, except where the species' own general limit is lower: sage
       grouse possession is 4 (see the next test). */
    assert.deepEqual(open.result!.limits, { daily: 2, possession: speciesId === "species:greater-sage-grouse" ? 4 : 6 }, speciesId);
    assert.ok(open.result!.requirements.some((line) => /taken by falconry only, either sex/.test(line)), speciesId);
    assert.equal(status(evaluate(speciesId, "2027-02-15", { ...GUN, RESIDENCY: "RESIDENT" })), "CLOSED", speciesId);
  }
  // The last day the booklet is valid for, and still falconry season.
  assert.equal(status(evaluate("species:ring-necked-pheasant", "2027-02-28", FALCON)), "CONDITIONAL");
});

/*
 * Falconry's limits are "not in addition to general limits" (p. 9), so a bird
 * taken by falconry is held to its species' general limit as well as to the
 * falconry pool of "2 daily in aggregate and 6 in possession". Written from the
 * booklet before the build was changed:
 *
 *   sage grouse     2 daily, possession two times the daily bag   → 2 / 4
 *   sharp-tailed    4 daily, possession four times                 → pool binds, 2 / 6
 *   mountain grouse 3 in aggregate daily, possession four times    → pool binds, 2 / 6
 *   partridge       8 in aggregate daily, possession four times    → pool binds, 2 / 6
 *   pheasant        3 cocks daily, possession three times          → pool binds, 2 / 6
 *
 * The bundle used to give sage grouse by falconry a possession limit of 6 — the
 * pool alone — which is looser than the booklet allows.
 */
test("sage grouse taken by falconry is held to 4 in possession, not the falconry pool's 6", () => {
  for (const [date, answers] of [
    // After the general season, falconry the only open method.
    ["2026-11-15", { ...FALCON, RESIDENCY: "RESIDENT" }],
    // During it, and for a nonresident on the season license.
    ["2026-09-20", { ...FALCON, RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PUBLIC_OR_ACCESS", LICENCE_TYPE: "SEASON" }],
  ] as const) {
    const sage = evaluate("species:greater-sage-grouse", date, answers);
    assert.equal(status(sage), "CONDITIONAL", date);
    const result = sage.result!;
    assert.deepEqual(result.limits, { daily: 2, possession: 4 }, date);
    // Both limits in force are structured, each with its own scope.
    const rows = (result.harvestLimits ?? []).map((limit) => `${limit.kind} ${limit.count} ${limit.appliesAcross.scope}`).sort();
    assert.deepEqual(rows, ["DAILY 2 AGGREGATE", "DAILY 2 THIS_SPECIES", "POSSESSION 4 THIS_SPECIES", "POSSESSION 6 AGGREGATE"], date);
    // No row lets this species exceed 4 in possession on its own.
    assert.ok(!(result.harvestLimits ?? []).some((limit) => limit.kind === "POSSESSION" && limit.appliesAcross.scope === "THIS_SPECIES" && (limit.count ?? 0) > 4), date);
    // And the hunter is told both.
    assert.ok(result.requirements.some((line) => /2 daily in aggregate and 6 in possession/.test(line)), date);
    assert.ok(result.requirements.some((line) => /general limit, which falconry's does not add to: 2 daily; possession limit two times the daily bag limit/.test(line)), date);
  }
});

test("no species taken by falconry may be possessed beyond its own general limit or the pool", () => {
  const species = [
    "species:ruffed-grouse", "species:spruce-grouse", "species:dusky-grouse", "species:gray-partridge", "species:chukar",
    "species:sharp-tailed-grouse", "species:greater-sage-grouse", "species:ring-necked-pheasant",
  ];
  const expected: Record<string, { daily: number; possession: number }> = {
    "species:greater-sage-grouse": { daily: 2, possession: 4 },
  };
  for (const speciesId of species) {
    /* A date both seasons share, so the engine answers each method here. */
    const gun = evaluate(speciesId, speciesId === "species:ring-necked-pheasant" ? "2026-10-20" : "2026-09-20", { ...GUN, RESIDENCY: "RESIDENT" }).result!;
    const falcon = evaluate(speciesId, speciesId === "species:ring-necked-pheasant" ? "2026-10-20" : "2026-09-20", { ...FALCON, RESIDENCY: "RESIDENT" }).result!;
    assert.equal(gun.status, "CONDITIONAL", speciesId);
    assert.equal(falcon.status, "CONDITIONAL", speciesId);
    assert.deepEqual(falcon.limits, expected[speciesId] ?? { daily: 2, possession: 6 }, speciesId);
    // Never above the general limit the engine gives the same species by gun.
    assert.ok(falcon.limits!.daily <= gun.limits!.daily && falcon.limits!.possession <= gun.limits!.possession, speciesId);
  }
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

/*
 * MUTATION PASS, 2026-10-06. Each legally decisive value was changed in the
 * builder (or in the recorded booklet text), the bundle rebuilt so builder and
 * artifact agreed, and `npm test` run. The tests below are for the changes
 * nothing noticed. Each asks the ENGINE at a real date and set of answers, and
 * anchors on the rule that answered by its id — never on bundle text, where a
 * second copy of a figure (a note, a `statedAs`) can hold the booklet's number
 * while the operative one drifts.
 */
const RULE = (slug: string) => `regulatory_rule:us-mt-upland-2026-${slug}`;
/* The rules in force on the date: the engine's opportunity rows (every rule
   applicable to the place and answers) narrowed to those whose own window holds
   the day — which is where the answer's limits are read from. */
const answeredBy = (evaluation: ReturnType<typeof evaluate>, date: string) =>
  [...new Set((evaluation.opportunities ?? [])
    .filter((row) => row.windows.some((window) => window.opens <= date && date <= window.closes))
    .map((row) => row.ruleId))].sort();

/*
 * The general limits, from pp. 9–10, written before the tests were run:
 *
 *   mountain grouse  "3 in aggregate daily", possession four times     → 3 / 12
 *   partridge        "8 in aggregate daily", possession four times     → 8 / 32,
 *                    printed on the statewide row AND on the Carbon County row
 *   sharp-tailed     "4 daily", possession four times                  → 4 / 16
 *   sage grouse      "2 daily", possession two times                   → 2 / 4
 *   pheasant         "3 cock pheasants daily", possession three times  → 3 / 9,
 *                    printed on the youth, season-license and 3-day rows
 *
 * Changing sharp-tailed grouse's printed "4 daily" to 3 in the booklet text, or
 * one pheasant row's "3 cock pheasants" to 2, rebuilt into a bundle whose limit
 * and wording agreed with each other and with nothing else: the stated-limit
 * cross-check cannot see a figure that moved in both places at once. Only the
 * booklet's number, asked of the engine, does.
 */
test("each general limit is the booklet's, from the rule that answered, with possession the stated multiple of the daily bag", () => {
  const CARBON = ["us-mt-carbon-county-partridge-portion"];
  const RES: HuntDimensionAnswers = { ...GUN, RESIDENCY: "RESIDENT" };
  const cases: Array<{ species: string; date: string; answers: HuntDimensionAnswers; overlays?: string[]; rule: string; daily: number; possession: number; times: number }> = [
    { species: "species:ruffed-grouse", date: "2026-10-10", answers: GUN, rule: "ruffed-grouse-statewide", daily: 3, possession: 12, times: 4 },
    { species: "species:spruce-grouse", date: "2026-10-10", answers: GUN, rule: "spruce-grouse-statewide", daily: 3, possession: 12, times: 4 },
    { species: "species:dusky-grouse", date: "2026-10-10", answers: GUN, rule: "dusky-grouse-statewide", daily: 3, possession: 12, times: 4 },
    { species: "species:gray-partridge", date: "2026-10-10", answers: RES, rule: "gray-partridge-statewide-resident", daily: 8, possession: 32, times: 4 },
    { species: "species:gray-partridge", date: "2026-10-10", answers: RES, overlays: CARBON, rule: "gray-partridge-carbon-county-resident", daily: 8, possession: 32, times: 4 },
    { species: "species:gray-partridge", date: "2027-01-05", answers: RES, overlays: CARBON, rule: "gray-partridge-carbon-county-resident", daily: 8, possession: 32, times: 4 },
    { species: "species:chukar", date: "2026-10-10", answers: RES, rule: "chukar-statewide-resident", daily: 8, possession: 32, times: 4 },
    { species: "species:chukar", date: "2027-01-05", answers: RES, overlays: CARBON, rule: "chukar-carbon-county-resident", daily: 8, possession: 32, times: 4 },
    { species: "species:sharp-tailed-grouse", date: "2026-10-10", answers: RES, rule: "sharp-tailed-grouse-east-resident", daily: 4, possession: 16, times: 4 },
    { species: "species:greater-sage-grouse", date: "2026-09-15", answers: RES, rule: "greater-sage-grouse-east-resident", daily: 2, possession: 4, times: 2 },
    { species: "species:ring-necked-pheasant", date: "2026-09-19", answers: { ...GUN, HUNTER_AGE: "YOUTH_15_AND_UNDER" }, rule: "ring-necked-pheasant-youth", daily: 3, possession: 9, times: 3 },
    { species: "species:ring-necked-pheasant", date: "2026-10-20", answers: RES, rule: "ring-necked-pheasant-resident", daily: 3, possession: 9, times: 3 },
    {
      species: "species:ring-necked-pheasant", date: "2026-10-20",
      answers: { ...GUN, RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PUBLIC_OR_ACCESS", LICENCE_TYPE: "SEASON" },
      rule: "ring-necked-pheasant-nonresident-season-public", daily: 3, possession: 9, times: 3,
    },
    {
      species: "species:ring-necked-pheasant", date: "2026-10-20",
      answers: { ...GUN, RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PRIVATE_NOT_ACCESS", LICENCE_TYPE: "THREE_DAY" },
      rule: "ring-necked-pheasant-nonresident-3-day-private", daily: 3, possession: 9, times: 3,
    },
  ];
  for (const { species, date, answers, overlays, rule, daily, possession, times } of cases) {
    const label = `${rule} on ${date}`;
    const answer = evaluate(species, date, answers, { overlays });
    assert.equal(status(answer), "CONDITIONAL", label);
    assert.deepEqual(answeredBy(answer, date), [RULE(rule)], label);
    assert.deepEqual(answer.result!.limits, { daily, possession }, label);
    // The relation, stated separately: transposing daily and possession, or
    // changing one multiplier, fails here even if a figure above were edited too.
    assert.equal(answer.result!.limits!.possession, times * answer.result!.limits!.daily, label);
  }
});

/*
 * Falconry's season against the general seasons (p. 9), written before the
 * tests were run: "Sep. 01 - Mar. 31" for residents and for nonresidents on
 * private land, "Sep. 11 - Mar. 31" for nonresidents on public or
 * access-program land — the same first days as the general seasons it sits
 * beside. Moving falconry's opening to Sep. 2, or the nonresident public-land
 * opening to Sep. 10, passed the whole suite: no test asked about either day.
 */
test("falconry opens the day the general seasons open, Sep. 1, and for nonresidents on public land Sep. 11, not a day either side", () => {
  const FALCON_RES: HuntDimensionAnswers = { ...FALCON, RESIDENCY: "RESIDENT" };
  for (const [species, slug] of [
    ["species:ruffed-grouse", "ruffed-grouse"], ["species:gray-partridge", "gray-partridge"], ["species:chukar", "chukar"],
    ["species:sharp-tailed-grouse", "sharp-tailed-grouse"], ["species:greater-sage-grouse", "greater-sage-grouse"],
    ["species:ring-necked-pheasant", "ring-necked-pheasant"],
  ] as const) {
    // The day before: neither falconry nor the general season.
    assert.equal(status(evaluate(species, "2026-08-31", FALCON_RES)), "CLOSED", `${slug} falconry Aug. 31`);
    // Sep. 1: falconry is open from its own rule, on the general season's first day.
    const opening = evaluate(species, "2026-09-01", FALCON_RES);
    assert.equal(status(opening), "CONDITIONAL", `${slug} falconry Sep. 1`);
    assert.deepEqual(answeredBy(opening, "2026-09-01"), [RULE(`${slug}-falconry-resident`)], `${slug} falconry Sep. 1`);
  }
  // Every general season that opens Sep. 1 opens with it: the falconry window
  // never starts after the firearm one beside it.
  for (const species of ["species:ruffed-grouse", "species:gray-partridge", "species:sharp-tailed-grouse", "species:greater-sage-grouse"]) {
    assert.equal(status(evaluate(species, "2026-09-01", { ...GUN, RESIDENCY: "RESIDENT" })), "CONDITIONAL", species);
  }

  // Nonresidents on public or access-program land: Sep. 10 closed, Sep. 11 open,
  // by falconry as by gun (mountain grouse aside, whose Sep. 1–10 is unsettled).
  const publicLand = { RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PUBLIC_OR_ACCESS" } as const;
  for (const [species, slug, extra] of [
    ["species:gray-partridge", "gray-partridge", {}],
    ["species:chukar", "chukar", {}],
    ["species:sharp-tailed-grouse", "sharp-tailed-grouse", {}],
    ["species:greater-sage-grouse", "greater-sage-grouse", { LICENCE_TYPE: "SEASON" }],
    ["species:ring-necked-pheasant", "ring-necked-pheasant-falconry-nonresident-season-public", { LICENCE_TYPE: "SEASON" }],
  ] as const) {
    const ruleSlug = slug.includes("falconry") ? slug : `${slug}-falconry-nonresident-public`;
    assert.equal(status(evaluate(species, "2026-09-10", { ...FALCON, ...publicLand, ...extra })), "CLOSED", `${ruleSlug} Sep. 10`);
    const first = evaluate(species, "2026-09-11", { ...FALCON, ...publicLand, ...extra });
    assert.equal(status(first), "CONDITIONAL", `${ruleSlug} Sep. 11`);
    assert.deepEqual(answeredBy(first, "2026-09-11"), [RULE(ruleSlug)], `${ruleSlug} Sep. 11`);
  }
  for (const species of ["species:gray-partridge", "species:sharp-tailed-grouse"]) {
    assert.equal(status(evaluate(species, "2026-09-10", { ...GUN, ...publicLand })), "CLOSED", species);
    assert.equal(status(evaluate(species, "2026-09-11", { ...GUN, ...publicLand })), "CONDITIONAL", species);
  }
});

/*
 * The free Supplemental Sage Grouse Hunting Permit (p. 3) is required of every
 * sage grouse hunter, on top of the Upland Game Bird License. Declared
 * ADDITIONAL_PERMIT and Montana-wide, it is said once in the map's legend
 * beside every open sage grouse zone. Reclassifying it INFORMATION — a kind the
 * legend never states — took it off the legend and passed the whole suite.
 *
 * Asked through the registry's own Montana entry and the map's own opportunity
 * walk, so the declared kind reaches the legend by the path a hunter's map does.
 */
test("the sage grouse permit reaches the answer as an additional permit, and the map's legend states it", async () => {
  const entry = REGULATORY_REGISTRY.find((candidate) => candidate.jurisdictionId === "jurisdiction:us-mt")!;
  const zone: ZoneResolution = {
    status: "RESOLVED", zoneId: EAST as ZoneResolution["zoneId"], jurisdictionId: "jurisdiction:us-mt" as ZoneResolution["jurisdictionId"],
    officialName: "East of the Continental Divide", sourceId: "source:us-mt-upland-district-service" as ZoneResolution["sourceId"], message: "",
  };
  const nothingHere = (async () => new Response(JSON.stringify({ features: [] }))) as typeof fetch;
  const ask = (answers: HuntDimensionAnswers) => {
    clearOverlayCache();
    return entry.evaluate(
      { latitude: 46.6, longitude: -107.5, date: "2026-09-15" as never, speciesId: "species:greater-sage-grouse" as never, answers },
      zone, { verifiedAt: "2026-10-06", fetcher: nothingHere },
    );
  };
  const answered = await ask({ ...GUN, RESIDENCY: "RESIDENT" });
  assert.equal(answered.regulation.status, "CONDITIONAL");
  const permit = (answered.regulation.conditions ?? []).find((condition) => condition.id === "mt-sage-grouse-permit");
  assert.ok(permit, "the permit is one of the answer's structured conditions");
  assert.equal(permit.kind, "ADDITIONAL_PERMIT");
  assert.equal(permit.scope, "JURISDICTION");

  const opportunity = await opportunityOf(await ask({}), ask);
  assert.equal(opportunity.hasCurrentLegalOpportunity, true);
  const legend = generalConditions([{ state: "CONDITIONAL", opportunity }]);
  assert.ok(legend.some((condition) => condition.id === "mt-sage-grouse-permit"), "said once in the map's legend");
});
