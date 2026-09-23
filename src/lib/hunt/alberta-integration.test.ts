import { legalTimeSummary } from "../hunt/regulatory/legal-time.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { evaluateHunt } from "./evaluate.ts";
import type { HuntInput, ZoneResolution } from "./types.ts";
import { resolveZoneFromOfficialGis } from "./zone.ts";
import { designationOfRaw, layerForJurisdiction, layerForResolution } from "./zone-layers.ts";

/**
 * Alberta through Hunt's real evaluation path, with every authority faked.
 *
 * The rules are the committed Alberta bundle; `regulatory/alberta.test.ts`
 * covers the law. These tests prove the wiring: routing by the zone's own
 * jurisdiction, Alberta's terms and sources in the answer, and the official
 * fallback reading Alberta's padded codes as the WMUs they are.
 */

const ALBERTA_SERVICE = "fishwild_wildlife_mgmt_unit_public";

function albertaZone(wmu: string): ZoneResolution {
  return {
    status: "RESOLVED",
    zoneId: `management_zone:ca-ab-wmu-${wmu}` as ZoneResolution["zoneId"],
    jurisdictionId: "jurisdiction:ca-ab",
    officialName: `Wildlife Management Unit ${wmu}`,
    boundaryDistanceMeters: 5_000,
    nearBoundary: false,
    sourceId: "source:ca-ab-wmu-service",
    message: "The point intersects one verified management-zone feature.",
  };
}

const noWeather = async (_latitude: number, _longitude: number, date: string) =>
  ({ status: "UNAVAILABLE" as const, summary: "No forecast", date: date as HuntInput["date"], sourceId: "source:open-meteo" as const });

async function hunt(input: HuntInput, zone: ZoneResolution) {
  return await evaluateHunt(input, {
    resolveZone: async () => zone,
    weather: noWeather,
    now: () => new Date("2026-09-20T12:00:00Z"),
  });
}

/* WMU 102 Pakowi, centroid as Alberta's service reports it. */
const PAKOWI = { latitude: 49.1702, longitude: -110.7056 };

test("an Alberta zone is answered by Alberta's rules, in Alberta's terms, with Alberta's source", async () => {
  // 4 November 2026: the prairie general season opens. Antlerless is ■ there.
  const input: HuntInput = { ...PAKOWI, date: "2026-11-04", speciesId: "species:white-tailed-deer" };
  const asked = await hunt(input, albertaZone("102"));
  assert.equal(asked.completeness, "NEEDS_INPUT");
  assert.equal(asked.required?.id, "ANIMAL_CLASS:ANTLER_CLASS");
  assert.match(asked.regulation.summary, /applicable Alberta rules/);

  const answered = await hunt(
    { ...input, answers: { HUNT_METHOD: "RIFLE", LICENCE_TYPE: "SPECIAL", animalClasses: [{ dimension: "ANTLER_CLASS", value: "ANTLERLESS" }] } },
    albertaZone("102"),
  );
  assert.equal(answered.regulation.status, "CONDITIONAL");
  assert.match(legalTimeSummary(answered.regulation.legalTime), /one-half hour after sunset/);
  const guide = answered.sources.find((source) => source.id === "source:ca-ab-hunting-guide-2026");
  assert.ok(guide, "the 2026 guide is listed among the sources");
  assert.match(guide.contentHash ?? "", /^sha256:/);
});

test("Alberta grouse asks nothing and is never answered with another province's wording", async () => {
  const result = await hunt({ ...PAKOWI, date: "2026-10-05", speciesId: "species:ruffed-grouse" }, albertaZone("102"));
  assert.equal(result.completeness, "RESOLVED");
  assert.equal(result.regulation.status, "CONDITIONAL");
  assert.doesNotMatch(result.regulation.summary, /Ontario|Manitoba/);
});

test("an Alberta zone is presented in Alberta's layer, once that layer is served", () => {
  const presented = layerForResolution({ status: "RESOLVED", jurisdictionId: "jurisdiction:ca-ab" });
  assert.equal(presented.kind, "SERVING");
  const layer = layerForJurisdiction("jurisdiction:ca-ab")!;
  assert.equal(layer.officialTerm, "Wildlife Management Unit");
  assert.ok(layer.certifiedDesignations?.has("102"));
  assert.ok(!layer.certifiedDesignations?.has("718"));
});

test("Alberta's padded codes are read as WMUs, and its blank Elk Island record as no zone", () => {
  const layer = layerForJurisdiction("jurisdiction:ca-ab")!;
  assert.equal(designationOfRaw(layer, "00102"), "102");
  assert.equal(designationOfRaw(layer, "00936"), "936");
  assert.equal(designationOfRaw(layer, " "), null);
  // Every other layer keeps publishing its designation as is.
  assert.equal(designationOfRaw(layerForJurisdiction("jurisdiction:ca-on")!, " 69A-1 "), "69A-1");
  assert.equal(designationOfRaw(layerForJurisdiction("jurisdiction:ca-mb")!, "23A"), "23A");
});

function albertaServiceReturning(features: Array<{ code: string }>): typeof fetch {
  return (async (input: string | URL) => {
    const url = String(input);
    if (!url.includes(ALBERTA_SERVICE)) throw new Error(`unexpected request ${url}`);
    const square = [[[-110.8, 49.1], [-110.6, 49.1], [-110.6, 49.3], [-110.8, 49.3], [-110.8, 49.1]]];
    return new Response(JSON.stringify({
      type: "FeatureCollection",
      features: features.map(({ code }) => ({ type: "Feature", properties: { WMUNIT_CODE: code }, geometry: { type: "Polygon", coordinates: square } })),
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

test("the official fallback resolves Alberta's own service to the registry's zone id", async () => {
  const resolved = await resolveZoneFromOfficialGis(PAKOWI.latitude, PAKOWI.longitude, albertaServiceReturning([{ code: "00102" }]));
  assert.equal(resolved.status, "RESOLVED");
  assert.equal(resolved.zoneId, "management_zone:ca-ab-wmu-102");
  assert.equal(resolved.officialName, "Wildlife Management Unit 102");
  assert.equal(resolved.jurisdictionId, "jurisdiction:ca-ab");
});

test("inside Elk Island National Park the official fallback names no WMU", async () => {
  // Elk Island's interior point; Alberta answers with its blank record.
  const resolved = await resolveZoneFromOfficialGis(53.6134, -112.8653, albertaServiceReturning([{ code: " " }]));
  assert.notEqual(resolved.status, "RESOLVED");
  assert.equal(resolved.zoneId, undefined);
});
