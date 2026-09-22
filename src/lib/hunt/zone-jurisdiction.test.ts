import assert from "node:assert/strict";
import test from "node:test";
import { evaluateHunt } from "./evaluate.ts";
import type { HuntInput, ZoneResolution } from "./types.ts";
import { jurisdictionOfZoneId } from "./zone.ts";
import { ZONE_LAYERS, designationFromOfficialName, layerForJurisdiction, layerForPoint, layerForResolution } from "./zone-layers.ts";

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
  // Served since parity was certified, in the ministry's own term.
  assert.equal(presented.kind, "SERVING");
  assert.equal(presented.kind === "SERVING" && presented.layer.jurisdictionId, "jurisdiction:ca-qc");
  assert.equal(presented.kind === "SERVING" && presented.layer.officialTerm, "Zone de chasse");
});

test("a registered layer that is not served is never presented", () => {
  const quebec = layerForJurisdiction("jurisdiction:ca-qc")!;
  const was = quebec.serving;
  quebec.serving = false;
  try {
    assert.equal(layerForResolution({ status: "RESOLVED", jurisdictionId: "jurisdiction:ca-qc" }).kind, "NOT_SERVING");
  } finally {
    quebec.serving = was;
  }
});

test("a zone from a jurisdiction with no registered layer is not presented at all", () => {
  assert.deepEqual(layerForResolution({ status: "RESOLVED", jurisdictionId: "jurisdiction:ca-nb" }), { kind: "UNREGISTERED" });
  assert.deepEqual(layerForResolution({ status: "RESOLVED" }), { kind: "UNREGISTERED" });
});

test("a registered but unserved layer is named, never presented as a served zone", () => {
  /*
   * Named by state rather than by province: jurisdictions move from registered
   * to served as each is certified, and the invariant is about the state, not
   * about whoever happens to be waiting today.
   */
  const unserved = ZONE_LAYERS.filter((layer) => layer.serving !== true);
  assert.ok(unserved.length > 0, "the queue still holds registered, uncertified layers");
  for (const layer of unserved) {
    const presented = layerForResolution({ status: "RESOLVED", jurisdictionId: layer.jurisdictionId });
    assert.equal(presented.kind, "NOT_SERVING", `${layer.jurisdictionName} is not served and must not be presented`);
  }
});

test("Saskatchewan is presented from its live service, with no rule of its own", () => {
  const presented = layerForResolution({ status: "RESOLVED", jurisdictionId: "jurisdiction:ca-sk" });
  assert.equal(presented.kind, "SERVING");
  const layer = layerForJurisdiction("jurisdiction:ca-sk")!;
  assert.equal(layer.resolution, "LIVE_SERVICE", "no stored copy is kept of Saskatchewan's geometry");
  assert.notEqual(layer.rulesServing, true);
  assert.equal(layer.officialTerm, "Wildlife Management Zone");
  assert.equal(designationFromOfficialName(layer, "Wildlife Management Zone 55"), "55");
});

test("a Manitoba zone is presented in Manitoba's terms once its layer is served", () => {
  const presented = layerForResolution({ status: "RESOLVED", jurisdictionId: "jurisdiction:ca-mb" });
  assert.equal(presented.kind, "SERVING");
  const layer = layerForJurisdiction("jurisdiction:ca-mb")!;
  assert.equal(layer.officialTerm, "Game Hunting Area");
  assert.equal(designationFromOfficialName(layer, "Game Hunting Area 23A"), "23A");
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
  // The ministry's closed-territories layer is asked at the point; here it holds none.
  const noClosedTerritory = (async () => new Response(JSON.stringify({ type: "FeatureCollection", features: [] }), { status: 200 })) as unknown as typeof fetch;
  const evaluate = () => evaluateHunt(input, {
    resolveZone: async () => quebecZone,
    weather: async (_lat, _lon, date) => ({ status: "UNAVAILABLE", summary: "No forecast", date, sourceId: "source:open-meteo" }),
    fetch: noClosedTerritory,
    now: () => new Date("2026-09-20T12:00:00Z"),
  });

  // Served: Québec's own small-game page answers — « 10 » grouse, 19 Sep 2026 to 15 Jan 2027.
  const served = await evaluate();
  assert.equal(served.regulation.status, "CONDITIONAL");
  assert.ok(served.regulation.sourceIds.includes("source:ca-qc-petit-gibier-2026-2028" as never));
  assert.ok(!served.regulation.sourceIds.some((id) => id.startsWith("source:ca-on")));
  assert.ok(!served.regulation.summary.includes("Wildlife Management Unit"));

  /* Unserved, Ontario's engine would say "no season row names this unit". That
     is an Ontario statement, and it must not be made about Québec. */
  const quebec = layerForJurisdiction("jurisdiction:ca-qc")!;
  const was = quebec.serving;
  quebec.serving = false;
  try {
    const unserved = await evaluate();
    assert.equal(unserved.regulation.status, "UNKNOWN");
    assert.equal(unserved.completeness, "RESOLVED");
    assert.match(unserved.regulation.summary, /Zone de chasse 10O is outside the jurisdictions whose hunting rules North Ground has certified/);
    assert.ok(!unserved.regulation.summary.includes("Wildlife Management Unit"));
  } finally {
    quebec.serving = was;
  }
});
