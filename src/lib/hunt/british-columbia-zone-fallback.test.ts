import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveLayerFromWfs, resolveZone } from "./zone.ts";
import { ZONE_LAYERS, layerForResolution } from "./zone-layers.ts";

/**
 * British Columbia through the shared WFS point fallback, with the province's
 * GeoServer faked. Its geometry property is `GEOMETRY`, not Québec's
 * `the_geom`, and its designations carry a hyphen ("7-15"), which must reach the
 * canonical id intact and must not be refused by the filter's alphabet check.
 */

const BC = ZONE_LAYERS.find((layer) => layer.jurisdictionId === "jurisdiction:ca-bc")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function province({ at, contains }: { at: string[]; contains: boolean }) {
  const asked: string[] = [];
  const fetcher = (async (input: string | URL) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "openmaps.gov.bc.ca");
    assert.equal(url.searchParams.get("typeNames"), "pub:WHSE_WILDLIFE_MANAGEMENT.WAA_WILDLIFE_MGMT_UNITS_SVW");
    assert.equal(url.searchParams.get("propertyName"), "WILDLIFE_MGMT_UNIT_ID");
    const filter = url.searchParams.get("CQL_FILTER") ?? "";
    asked.push(filter);
    const rows = filter.startsWith("INTERSECTS") ? at : contains ? at.slice(0, 1) : [];
    return json({ type: "FeatureCollection", features: rows.map((unit) => ({ properties: { WILDLIFE_MGMT_UNIT_ID: unit } })) });
  }) as typeof fetch;
  return { fetcher, asked };
}

test("the layer serves its certified boundaries, and its certified rules", () => {
  assert.ok(BC);
  assert.equal(BC.serving, true);
  assert.equal(BC.rulesServing, true);
  assert.equal(BC.officialTerm, "Management Unit");
  assert.equal(layerForResolution({ status: "RESOLVED", jurisdictionId: "jurisdiction:ca-bc" }).kind, "SERVING");
});

test("a hyphenated Management Unit resolves through the shared fallback with its own geometry field", async () => {
  const { fetcher, asked } = province({ at: ["7-15"], contains: true });
  const zone = await resolveLayerFromWfs(BC, 53.917, -122.749, fetcher);
  assert.equal(zone.status, "RESOLVED");
  assert.equal(zone.zoneId, "management_zone:ca-bc-mu-7-15");
  assert.equal(zone.officialName, "Management Unit 7-15");
  assert.equal(zone.jurisdictionId, "jurisdiction:ca-bc");
  assert.equal(zone.nearBoundary, false);
  assert.equal(asked[0], "INTERSECTS(GEOMETRY,SRID=4326;POINT(-122.749 53.917))");
  assert.match(asked[1], /^CONTAINS\(GEOMETRY,SRID=4326;POLYGON\(\(.+\)\)\) AND WILDLIFE_MGMT_UNIT_ID='7-15'$/);
});

test("a designation the regulation reads differently is normalised before it becomes an id", async () => {
  // B.C. Reg. 64/96 s. 3: "4-01" is read as "4-1".
  const { fetcher, asked } = province({ at: ["4-01"], contains: false });
  const zone = await resolveLayerFromWfs(BC, 49.5, -115.8, fetcher);
  assert.equal(zone.zoneId, "management_zone:ca-bc-mu-4-1");
  assert.equal(zone.nearBoundary, true);
  assert.match(asked[1], /WILDLIFE_MGMT_UNIT_ID='4-1'$/);
});

test("anything that is not a unit designation places the point in no unit rather than inventing one", async () => {
  const { fetcher } = province({ at: ["NOT A UNIT"], contains: false });
  const zone = await resolveLayerFromWfs(BC, 50, -120, fetcher);
  assert.equal(zone.status, "UNKNOWN");
  assert.equal(zone.zoneId, undefined);
});

test("a CQL-injection-shaped designation is never put back into a filter", async () => {
  // Bypass the layer's normaliser to prove the filter alphabet itself holds.
  const raw = { ...BC, designationOf: (value: unknown) => (typeof value === "string" ? value : null) };
  for (const hostile of ["7-15' OR '1'='1", "7-15);DROP", "7-15(", "-7-15", "7-15-", "7--15", "7 15"]) {
    const { fetcher, asked } = province({ at: [hostile], contains: true });
    const zone = await resolveLayerFromWfs(raw, 53.917, -122.749, fetcher);
    assert.equal(zone.status, "PROVIDER_ERROR", hostile);
    assert.equal(asked.length, 1, `${hostile} reached a second filter`);
  }
});

test("Cranbrook is not attributed to Alberta because Alberta's box reaches it", async () => {
  // Alberta's extent runs west to 120° W; British Columbia's registered layer covers Cranbrook too.
  const saved = process.env.SPATIAL_PROVIDER;
  process.env.SPATIAL_PROVIDER = "official-gis";
  try {
    const empty = (async () => new Response(JSON.stringify({ type: "FeatureCollection", features: [] }), {
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
    const result = await resolveZone(49.5097, -115.7688, empty);
    assert.equal(result.status, "UNKNOWN");
    assert.equal(result.jurisdictionId, undefined);
  } finally {
    if (saved === undefined) delete process.env.SPATIAL_PROVIDER; else process.env.SPATIAL_PROVIDER = saved;
  }
});
