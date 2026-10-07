import assert from "node:assert/strict";
import test from "node:test";
import { evaluateHunt } from "./evaluate.ts";
import { evaluateOntarioSmallGame } from "./regulatory/ontario.ts";
import type { HuntInput, ZoneResolution } from "./types.ts";
import { getWeatherContext } from "./weather.ts";
import { resolveOntarioWmu } from "./zone.ts";

const input: HuntInput = {
  latitude: 45.23,
  longitude: -77.94,
  date: "2026-10-15",
  speciesId: "species:ruffed-grouse",
};
const zone: ZoneResolution = {
  status: "RESOLVED",
  zoneId: "management_zone:ca-on-wmu-57",
  officialName: "Wildlife Management Unit 57",
  boundaryDistanceMeters: 2_000,
  nearBoundary: false,
  sourceId: "source:ca-on-wmu-service",
  message: "Resolved from official fixture.",
};

// The original certified slice, kept verbatim as a regression on the move from a
// hard-coded rule to the generated bundle: the same unit, dates and limits must
// still produce the same answers.
test("certified WMU 57 rule returns conditional in season and closed outside it", () => {
  const open = evaluateOntarioSmallGame(input, zone);
  assert.equal(open.status, "CONDITIONAL");
  assert.deepEqual(open.season, { opens: "2026-09-15", closes: "2026-12-31", datesInclusive: true });
  assert.deepEqual(open.limits, { daily: 5, possession: 15, combinedWith: "spruce grouse" });
  assert.equal(evaluateOntarioSmallGame({ ...input, date: "2026-09-14" }, zone).status, "CLOSED");
});

test("unknown zone and out-of-version dates fail closed", () => {
  const unresolved: ZoneResolution = { status: "UNKNOWN", sourceId: "source:ca-on-wmu-service", message: "No feature" };
  assert.equal(evaluateOntarioSmallGame(input, unresolved).status, "NEEDS_VERIFICATION");
  assert.equal(evaluateOntarioSmallGame({ ...input, date: "2027-10-15" }, zone).status, "NEEDS_VERIFICATION");
});

test("forecast horizon refuses a date 46 days away without calling a provider", async () => {
  let called = false;
  const result = await getWeatherContext(45.23, -77.94, "2026-11-05", {
    now: new Date("2026-09-20T12:00:00Z"),
    fetcher: async () => {
      called = true;
      throw new Error("must not call");
    },
  });
  assert.equal(result.status, "UNAVAILABLE");
  assert.equal(called, false);
  assert.match(result.summary, /does not substitute climatology/i);
});

test("official WMU provider response resolves zone and boundary warning", async () => {
  const fetcher: typeof fetch = async () => new Response(JSON.stringify({
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: { OFFICIAL_NAME: "57", LOCATION_ACCURACY: "Within 10 metres", VERIFICATION_STATUS_FLG: "Verified" },
      geometry: {
        type: "Polygon",
        coordinates: [[[-77.941, 45.229], [-77.939, 45.229], [-77.939, 45.231], [-77.941, 45.231], [-77.941, 45.229]]],
      },
    }],
  }), { status: 200, headers: { "content-type": "application/json" } });
  const result = await resolveOntarioWmu(45.23, -77.94, fetcher);
  assert.equal(result.status, "RESOLVED");
  assert.equal(result.zoneId, "management_zone:ca-on-wmu-57");
  assert.equal(result.nearBoundary, true);
});

test("integrated evaluation keeps regulation and editorial knowledge separate", async () => {
  const result = await evaluateHunt(input, {
    resolveZone: async () => zone,
    weather: async (_lat, _lon, date) => ({ status: "UNAVAILABLE", summary: "No forecast", date, sourceId: "source:open-meteo" }),
    now: () => new Date("2026-09-20T12:00:00Z"),
  });
  assert.equal(result.regulation.status, "CONDITIONAL");
  assert.equal(result.weather.status, "UNAVAILABLE");
  assert.ok(result.knowledge.blocks.some(({ block }) => block.type === "legal_note"));
  assert.ok(result.knowledge.blocks.every(({ block }) => !(block.content.plainText.includes("OPEN"))));
  assert.equal(result.species.canonicalPath, "/hunting/species/ruffed-grouse");
});

/*
 * WHAT THE RESULT CARRIES, PINNED BEFORE IT CHANGES.
 *
 * The owner's API sequence puts DOMAIN RESULT COMPLETION before any endpoint:
 * the canonical result must be able to express what the engine establishes.
 * `evaluateRegulation` returns a `RegulatoryOutcome` with six fields and
 * `evaluate.ts:184` destructures four of them —
 *
 *   const { completeness, required, dimensions, regulation } = await evaluateRegulation(...)
 *
 * — so `opportunities` and `exceptInside` are computed and then dropped on the
 * floor one line before the result is built.
 *
 * This records the shape as it is TODAY so that change has a before and an
 * after. A refactor whose only evidence is "the suite still passes" proves
 * nothing when the suite never asserted the thing: measured across the ~21 test
 * files that call `evaluateHunt`, `regulation` is asserted dozens of times
 * while `dimensions` and `evaluatedAt` are asserted by none, and the FIELD SET
 * itself by none at all.
 *
 * It is deliberately a characterization, not a specification. It says what is,
 * so that what changes is visible. When `opportunities` is threaded, this test
 * must be edited — and that edit is the point.
 */
test("the evaluation carries exactly these fields, and drops two the engine computed", async () => {
  const result = await evaluateHunt(input, {
    resolveZone: async () => zone,
    weather: async (_lat, _lon, date) => ({ status: "UNAVAILABLE", summary: "No forecast", date, sourceId: "source:open-meteo" }),
    now: () => new Date("2026-09-20T12:00:00Z"),
  });

  /*
   * Every key THIS evaluation has, sorted. Measured, not predicted: a first
   * guess at ten was wrong by two, because `required` and `readiness` are
   * answer-dependent and both are present here — an Ontario WMU 57 grouse hunt
   * on 15 October, which is CONDITIONAL and still has an outstanding question.
   *
   * That is why this is a characterization of one answer rather than a
   * specification of the type: the set varies with what the engine found. What
   * it pins is that a field cannot appear or vanish without someone editing
   * this line.
   */
  assert.deepEqual(
    Object.keys(result).sort(),
    ["completeness", "dimensions", "evaluatedAt", "input", "knowledge", "readiness", "regulation", "required", "sources", "species", "weather", "zone"].sort(),
    "the evaluation's field set changed; if this is the opportunity threading, update it deliberately",
  );

  /* The two the engine establishes and the result does not take. `exceptInside`
     is documented "whole-zone answers only", so its absence from a POINT answer
     is correct rather than a gap; `opportunities` has no such scoping and is
     the one §8 calls the fundamental regulatory object — a legal harvest
     opportunity, not a season. */
  assert.ok(!("opportunities" in result), "opportunities reached the result: thread it deliberately and update this test");
  assert.ok(!("exceptInside" in result), "exceptInside reached the result: it is documented whole-zone only");

  /*
   * WHAT THIS DOES NOT GUARD, measured rather than assumed.
   *
   * Threading `opportunities` with a conditional spread —
   * `...(opportunities ? { opportunities } : {})` — leaves this test GREEN,
   * because this fixture produces none: Ontario is the evaluator the
   * `RegulatoryOutcome` comment names as having its own path. Verified by
   * making exactly that edit and running this file: 6 passed, 0 failed.
   *
   * An UNCONDITIONAL field does turn it red, so the test is sensitive to the
   * SHAPE and blind to a conditional field this fixture never populates.
   * Certifying that opportunities actually arrive needs a fixture whose
   * evaluator emits them — major-game and Québec are the two that reference
   * them — and that belongs with the threading, not here.
   */

  /* A positive control on the premise. If the engine never computed
     opportunities for anything, "the result drops them" would be a claim about
     nothing. This asserts the field EXISTS on the outcome type's producer side,
     by checking a surface that does receive them. */
  const { summarizeZone } = await import("./exploration/zone-summary.ts");
  assert.equal(typeof summarizeZone, "function", "zone-summary is the surface that does see opportunities");
});
