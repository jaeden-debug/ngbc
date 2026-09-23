import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { resolveLayerFromWfs, resolveZoneFromOfficialGis } from "./zone.ts";
import { ZONE_LAYERS } from "./zone-layers.ts";

/**
 * Québec's official-GIS fallback, with the ministry's GeoServer faked.
 *
 * When PostGIS cannot answer, Hunt asks each served layer's own authority.
 * Québec's serves WFS, not ArcGIS, so it is asked two questions that return no
 * geometry: which zone contains the point, and whether a record of that zone
 * contains the whole 150 m disk around it. These hold the questions, the
 * answers and the failures; the live service was checked against PostGIS's
 * exact distances when this was written (Maniwaki 24.9 km: not near; points
 * 49–127 m from a boundary: near).
 */

const QUEBEC = ZONE_LAYERS.find((layer) => layer.jurisdictionId === "jurisdiction:ca-qc")!;
const wasServing = QUEBEC.serving;
before(() => { QUEBEC.serving = true; });
after(() => { QUEBEC.serving = wasServing; });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** A fake GeoServer: `at` answers the point question, `contains` the disk question. */
function ministry({ at, contains, fail }: { at: string[]; contains?: boolean; fail?: "point" | "disk" }) {
  const asked: string[] = [];
  const fetcher = (async (input: string | URL) => {
    const url = new URL(String(input));
    if (url.hostname !== "servicesvecto3.mern.gouv.qc.ca") return json({ type: "FeatureCollection", features: [] });
    const filter = url.searchParams.get("CQL_FILTER") ?? "";
    asked.push(filter);
    assert.equal(url.searchParams.get("typeNames"), "SmartFaunePub:Zone_chasse_da3_sefaq");
    assert.equal(url.searchParams.get("propertyName"), "Zone");
    if (filter.startsWith("INTERSECTS")) {
      if (fail === "point") return json({ error: "down" }, 503);
      return json({ type: "FeatureCollection", features: at.map((zone) => ({ properties: { Zone: zone } })) });
    }
    if (fail === "disk") throw new Error("offline");
    return json({ type: "FeatureCollection", features: contains ? [{ properties: { Zone: at[0] } }] : [] });
  }) as typeof fetch;
  return { fetcher, asked };
}

test("a point well inside a zone resolves in Québec's terms, not near a boundary", async () => {
  const { fetcher, asked } = ministry({ at: ["10O"], contains: true });
  const zone = await resolveLayerFromWfs(QUEBEC, 46.3769, -75.9722, fetcher);
  assert.equal(zone.status, "RESOLVED");
  assert.equal(zone.zoneId, "management_zone:ca-qc-zone-10o");
  assert.equal(zone.jurisdictionId, "jurisdiction:ca-qc");
  assert.equal(zone.officialName, "Zone de chasse 10O");
  assert.equal(zone.nearBoundary, false);
  // Not measured by this path, so not reported.
  assert.equal(zone.boundaryDistanceMeters, undefined);
  assert.equal(asked[0], "INTERSECTS(the_geom,SRID=4326;POINT(-75.9722 46.3769))");
  assert.match(asked[1], /^CONTAINS\(the_geom,SRID=4326;POLYGON\(\(.+\)\)\) AND Zone='10O'$/);
});

test("the disk asked about covers the whole 150 m circle around the point", async () => {
  const { fetcher, asked } = ministry({ at: ["10O"], contains: true });
  await resolveLayerFromWfs(QUEBEC, 46.3769, -75.9722, fetcher);
  const ring = /POLYGON\(\(([^)]+)\)\)/.exec(asked[1])![1].split(", ").map((pair) => pair.split(" ").map(Number));
  assert.equal(ring.length, 25);
  assert.deepEqual(ring[0], ring.at(-1));
  const perLongitude = 111_320 * Math.cos((46.3769 * Math.PI) / 180);
  for (let index = 1; index < ring.length; index += 1) {
    // Each edge's midpoint, the polygon's nearest approach to the point, is at least 150 m away.
    const [x1, y1] = ring[index - 1];
    const [x2, y2] = ring[index];
    const dx = (((x1 + x2) / 2) + 75.9722) * perLongitude;
    const dy = (((y1 + y2) / 2) - 46.3769) * 111_132;
    assert.ok(Math.hypot(dx, dy) >= 149.9, `edge ${index} passes ${Math.hypot(dx, dy).toFixed(1)} m from the point`);
  }
});

test("when no record of the zone contains the disk, the point is near the boundary", async () => {
  const { fetcher } = ministry({ at: ["19SE"], contains: false });
  const zone = await resolveLayerFromWfs(QUEBEC, 50.5, -59.48, fetcher);
  assert.equal(zone.status, "RESOLVED");
  assert.equal(zone.nearBoundary, true);
  assert.match(zone.message, /within about 150 metres/);
});

test("overlapping zones and no zone are both unknown, never a guess", async () => {
  const overlap = await resolveLayerFromWfs(QUEBEC, 46, -72, ministry({ at: ["06N", "06S"] }).fetcher);
  assert.equal(overlap.status, "UNKNOWN");
  // Which zones, not just that there were two: an overlap that names nothing
  // cannot be investigated and cannot be shown to anyone.
  assert.deepEqual(overlap.conflictingZoneIds, ["management_zone:ca-qc-zone-06n", "management_zone:ca-qc-zone-06s"]);
  assert.match(overlap.message, /06N, 06S/);
  assert.equal(overlap.zoneId, undefined);
  const none = await resolveLayerFromWfs(QUEBEC, 45.4215, -75.6972, ministry({ at: [] }).fetcher);
  assert.equal(none.status, "UNKNOWN");
  assert.match(none.message, /places this point in no Zone de chasse/);
});

test("a failed question is a provider error, not 'no zone' and not 'not near'", async () => {
  for (const fail of ["point", "disk"] as const) {
    const zone = await resolveLayerFromWfs(QUEBEC, 46.3769, -75.9722, ministry({ at: ["10O"], contains: true, fail }).fetcher);
    assert.equal(zone.status, "PROVIDER_ERROR");
    assert.equal(zone.jurisdictionId, "jurisdiction:ca-qc");
  }
});

test("a designation outside the service's own alphabet is never put back into a filter", async () => {
  const zone = await resolveLayerFromWfs(QUEBEC, 46, -72, ministry({ at: ["10O' OR '1'='1"] }).fetcher);
  assert.equal(zone.status, "PROVIDER_ERROR");
});

test("in western Québec, Ontario's box and Québec's are both asked, and Québec's zone is the answer", async () => {
  const { fetcher } = ministry({ at: ["10O"], contains: true });
  const zone = await resolveZoneFromOfficialGis(46.3769, -75.9722, fetcher);
  assert.equal(zone.status, "RESOLVED");
  assert.equal(zone.zoneId, "management_zone:ca-qc-zone-10o");
});
