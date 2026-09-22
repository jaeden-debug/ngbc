import assert from "node:assert/strict";
import test from "node:test";
import type { HuntDimensionAnswers } from "./dimensions.ts";
import { evaluateMontana, MONTANA_BUNDLE, MONTANA_OVERLAYS, montanaCoverageReport } from "./us-montana.ts";

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

function evaluate(speciesId: string, date: string, answers: HuntDimensionAnswers = {}, options: { zone?: string; overlays?: string[]; restrictions?: Array<{ name: string; statedAs: string; sourceId: string }> } = {}) {
  const zoneId = options.zone ?? EAST;
  return evaluateMontana({
    speciesId, speciesName: speciesId.slice(8).replace(/-/g, " "), date, answers,
    place: { zoneId, zoneName: zoneId === EAST ? "East of the Continental Divide" : "West of the Continental Divide", latitude: 46.6, longitude: -110.9, overlays: new Set(options.overlays ?? []) },
    restrictions: options.restrictions,
  });
}

const status = (evaluation: ReturnType<typeof evaluate>) =>
  evaluation.completeness === "NEEDS_INPUT" ? `ASK ${evaluation.required?.id}` : evaluation.result?.status;

test("mountain grouse asks nothing and runs Sep. 1 to Jan. 1 across the new year, inclusive", () => {
  assert.equal(status(evaluate("species:ruffed-grouse", "2026-08-31")), "CLOSED");
  assert.equal(status(evaluate("species:ruffed-grouse", "2026-09-01")), "CONDITIONAL");
  assert.equal(status(evaluate("species:ruffed-grouse", "2027-01-01")), "CONDITIONAL");
  assert.equal(status(evaluate("species:ruffed-grouse", "2027-01-02")), "CLOSED");
  assert.equal(status(evaluate("species:spruce-grouse", "2026-10-10", {}, { zone: WEST })), "CONDITIONAL");
  const limits = evaluate("species:ruffed-grouse", "2026-10-10").result!;
  assert.deepEqual(limits.limits, { daily: 3, possession: 12 });
  assert.ok(limits.requirements.some((line) => /3 in aggregate daily/.test(line)));
});

test("sharp-tailed grouse is closed west of the Continental Divide without asking anything", () => {
  assert.equal(status(evaluate("species:sharp-tailed-grouse", "2026-09-05", {}, { zone: WEST })), "CLOSED");
});

test("east of the Divide, the nonresident public-land delay is asked only while it matters", () => {
  assert.equal(status(evaluate("species:sharp-tailed-grouse", "2026-09-05")), "ASK RESIDENCY");
  assert.equal(status(evaluate("species:sharp-tailed-grouse", "2026-09-05", { RESIDENCY: "RESIDENT" })), "CONDITIONAL");
  assert.equal(status(evaluate("species:sharp-tailed-grouse", "2026-09-05", { RESIDENCY: "NON_RESIDENT" })), "ASK LAND_TYPE");
  assert.equal(status(evaluate("species:sharp-tailed-grouse", "2026-09-05", { RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PUBLIC_OR_ACCESS" })), "CLOSED");
  assert.equal(status(evaluate("species:sharp-tailed-grouse", "2026-09-05", { RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PRIVATE_NOT_ACCESS" })), "CONDITIONAL");
  assert.equal(status(evaluate("species:sharp-tailed-grouse", "2026-09-11", { RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PUBLIC_OR_ACCESS" })), "CONDITIONAL");
  // After the tenth day everyone is in season, so nothing is asked.
  assert.equal(status(evaluate("species:sharp-tailed-grouse", "2026-10-10")), "CONDITIONAL");
});

test("partridge runs to Jan. 10 only inside the described portion of Carbon County", () => {
  assert.equal(status(evaluate("species:gray-partridge", "2027-01-05", { RESIDENCY: "RESIDENT" })), "CLOSED");
  assert.equal(status(evaluate("species:gray-partridge", "2027-01-05", { RESIDENCY: "RESIDENT" }, { overlays: ["us-mt-carbon-county-partridge-portion"] })), "CONDITIONAL");
  assert.equal(status(evaluate("species:gray-partridge", "2027-01-11", { RESIDENCY: "RESIDENT" }, { overlays: ["us-mt-carbon-county-partridge-portion"] })), "CLOSED");
});

test("the youth pheasant weekend asks the hunter's age, and only that weekend", () => {
  assert.equal(status(evaluate("species:ring-necked-pheasant", "2026-09-19")), "ASK HUNTER_AGE");
  assert.equal(status(evaluate("species:ring-necked-pheasant", "2026-09-19", { HUNTER_AGE: "YOUTH_15_AND_UNDER" })), "CONDITIONAL");
  assert.equal(status(evaluate("species:ring-necked-pheasant", "2026-09-19", { HUNTER_AGE: "16_AND_OVER" })), "CLOSED");
  const youth = evaluate("species:ring-necked-pheasant", "2026-09-20", { HUNTER_AGE: "YOUTH_15_AND_UNDER" }).result!;
  assert.ok(youth.requirements.some((line) => /accompanied by a nonhunting adult/.test(line)));
});

test("pheasant opens Oct. 10, Oct. 17 or Oct. 20 depending on residency, land and license", () => {
  const ask = (answers: HuntDimensionAnswers) => status(evaluate("species:ring-necked-pheasant", "2026-10-12", answers));
  assert.equal(ask({ RESIDENCY: "RESIDENT" }), "CONDITIONAL");
  assert.equal(ask({ RESIDENCY: "NON_RESIDENT" }), "ASK LAND_TYPE");
  assert.equal(ask({ RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PUBLIC_OR_ACCESS" }), "CLOSED");
  assert.equal(ask({ RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PRIVATE_NOT_ACCESS" }), "ASK LICENCE_TYPE");
  assert.equal(ask({ RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PRIVATE_NOT_ACCESS", LICENCE_TYPE: "SEASON" }), "CONDITIONAL");
  assert.equal(ask({ RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PRIVATE_NOT_ACCESS", LICENCE_TYPE: "THREE_DAY" }), "CLOSED");
  assert.equal(status(evaluate("species:ring-necked-pheasant", "2026-10-17", { RESIDENCY: "NON_RESIDENT", LAND_TYPE: "PRIVATE_NOT_ACCESS", LICENCE_TYPE: "THREE_DAY" })), "CONDITIONAL");
  // A 3-day license is a nonresident license: a resident cannot hold one.
  assert.notEqual(ask({ RESIDENCY: "RESIDENT", LICENCE_TYPE: "THREE_DAY" }), "CLOSED");
});

test("on a reservation the Commission closed to state licenses, the answer is CLOSED and says what it does not describe", () => {
  const result = evaluate("species:ruffed-grouse", "2026-10-10", {}, { overlays: ["us-mt-reservation-state-licence-closed"] }).result!;
  assert.equal(result.status, "CLOSED");
  assert.ok(result.limitations.some((line) => /with the use of state licenses/.test(line)));
  assert.ok(result.limitations.some((line) => /under the tribe's own authority/.test(line)));
});

test("on the Flathead or Crow reservation North Ground does not state a status", () => {
  const flathead = MONTANA_OVERLAYS.layers.find((layer) => layer.key === "reservations")!.features.find((feature) => feature.name === "Flathead Reservation")!;
  const result = evaluate("species:ruffed-grouse", "2026-10-10", {}, {
    restrictions: [{ name: flathead.name, statedAs: flathead.statedAs, sourceId: "source:us-census-tigerweb-federal-reservations-2026" }],
  }).result!;
  assert.equal(result.status, "NEEDS_VERIFICATION");
  assert.ok(result.limitations.some((line) => /cooperative management agreement/.test(line)));
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

test("coverage is computed from the bundle: five species, two districts, reservations never counted as open", () => {
  const report = montanaCoverageReport();
  assert.equal(report.officialUnits, 2);
  assert.deepEqual(report.species.map((row) => row.speciesId), [
    "species:gray-partridge", "species:ring-necked-pheasant", "species:ruffed-grouse", "species:sharp-tailed-grouse", "species:spruce-grouse",
  ]);
  assert.equal(MONTANA_BUNDLE.rules.length, 28);
  assert.ok(MONTANA_BUNDLE.rules.every((rule) => rule.sourceId === "source:us-mt-upland-regulations-2026"));
});
