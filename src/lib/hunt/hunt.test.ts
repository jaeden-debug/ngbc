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
