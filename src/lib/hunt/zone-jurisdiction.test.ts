import assert from "node:assert/strict";
import test from "node:test";
import { evaluateHunt } from "./evaluate.ts";
import type { HuntInput, ZoneResolution } from "./types.ts";
import { jurisdictionOfZoneId } from "./zone.ts";
import { designationFromOfficialName, layerForJurisdiction, layerForPoint, layerForResolution } from "./zone-layers.ts";

/*
 * Bounding boxes overlap. Ontario's layer extent reaches -74° and -95.5°, which
 * takes in Maniwaki and Gatineau in Québec and a sliver of eastern Manitoba. Once
 * those provinces' zones are in the registry, PostGIS can return one of them for
 * a point inside Ontario's box. These tests hold the line that the zone decides
 * the jurisdiction, never the box.
 */

// Maniwaki: inside Ontario's extent, and in Québec's zone 10O per the ministry's own service.
const MANIWAKI = { latitude: 46.3769, longitude: -75.9722 };

test("a zone id carries its jurisdiction", () => {
  assert.equal(jurisdictionOfZoneId("management_zone:ca-on-wmu-57"), "jurisdiction:ca-on");
  assert.equal(jurisdictionOfZoneId("management_zone:ca-qc-zone-10o"), "jurisdiction:ca-qc");
  assert.equal(jurisdictionOfZoneId("management_zone:ca-mb-gha-38"), "jurisdiction:ca-mb");
  assert.equal(jurisdictionOfZoneId("management_zone:wmu-57"), undefined);
  assert.equal(jurisdictionOfZoneId(undefined), undefined);
});

test("Maniwaki falls inside Ontario's extent, which is exactly why the extent cannot decide", () => {
  assert.equal(layerForPoint(MANIWAKI.latitude, MANIWAKI.longitude)?.jurisdictionId, "jurisdiction:ca-on");
});

test("a Québec zone is never presented as an Ontario WMU", () => {
  const presented = layerForResolution({ status: "RESOLVED", jurisdictionId: "jurisdiction:ca-qc" });
  // Québec's layer exists but is not served until parity is certified.
  assert.equal(presented.kind, "NOT_SERVING");
  assert.equal(presented.kind === "NOT_SERVING" && presented.layer.officialTerm, "Zone de chasse");
});

test("a zone from a jurisdiction with no registered layer is not presented at all", () => {
  assert.deepEqual(layerForResolution({ status: "RESOLVED", jurisdictionId: "jurisdiction:ca-mb" }), { kind: "UNREGISTERED" });
  assert.deepEqual(layerForResolution({ status: "RESOLVED" }), { kind: "UNREGISTERED" });
});

test("an Ontario zone is still presented in Ontario's terms", () => {
  const presented = layerForResolution({ status: "RESOLVED", jurisdictionId: "jurisdiction:ca-on" });
  assert.equal(presented.kind, "SERVING");
  const layer = layerForJurisdiction("jurisdiction:ca-on")!;
  assert.equal(designationFromOfficialName(layer, "Wildlife Management Unit 57"), "57");
  assert.equal(designationFromOfficialName(layerForJurisdiction("jurisdiction:ca-qc")!, "Zone de chasse 10O"), "10O");
});

test("a Québec zone is never evaluated against Ontario's rules", async () => {
  const input: HuntInput = { ...MANIWAKI, date: "2026-10-15", speciesId: "species:ruffed-grouse" };
  const quebecZone: ZoneResolution = {
    status: "RESOLVED",
    zoneId: "management_zone:ca-qc-zone-10o",
    jurisdictionId: "jurisdiction:ca-qc",
    officialName: "Zone de chasse 10O",
    boundaryDistanceMeters: 4_000,
    nearBoundary: false,
    sourceId: "source:ca-qc-zone-chasse-service",
    message: "Resolved from fixture.",
  };
  const result = await evaluateHunt(input, {
    resolveZone: async () => quebecZone,
    weather: async (_lat, _lon, date) => ({ status: "UNAVAILABLE", summary: "No forecast", date, sourceId: "source:open-meteo" }),
    now: () => new Date("2026-09-20T12:00:00Z"),
  });
  /* Ontario's engine would say "no season row names this unit". That is an
     Ontario statement, and it must not be made about Québec. */
  assert.equal(result.regulation.status, "UNKNOWN");
  assert.equal(result.completeness, "RESOLVED");
  assert.match(result.regulation.summary, /Zone de chasse 10O is outside the jurisdictions whose hunting rules North Ground has certified/);
  assert.ok(!result.regulation.summary.includes("Wildlife Management Unit"));
});
