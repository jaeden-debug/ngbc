import assert from "node:assert/strict";
import test from "node:test";
import {
  boundsIntersect, clearZoneGeometryCache, fetchLayerGeometry, fetchZoneGeometry,
  layersForBounds, parseBounds, toleranceForZoom, type BoundingBox,
} from "./zone-geometry.ts";
import { COVERAGE_ROADMAP, layerForPoint, ZONE_LAYERS, zoneCoverage, zoneDisplayLabel } from "./zone-layers.ts";
import { resolveOntarioWmuFromOfficialGis } from "./zone.ts";

const ONTARIO = ZONE_LAYERS[0];

/** A square kilometre-ish ring centred on a point, as the service would return it. */
function square(lng: number, lat: number, size: number): number[][] {
  return [
    [lng - size, lat - size], [lng + size, lat - size],
    [lng + size, lat + size], [lng - size, lat + size],
    [lng - size, lat - size],
  ];
}

function collection(features: Array<{ name: string; ring: number[][] }>) {
  return {
    type: "FeatureCollection",
    features: features.map(({ name, ring }) => ({
      properties: { OFFICIAL_NAME: name },
      geometry: { type: "Polygon", coordinates: [ring] },
    })),
  };
}

function stubFetch(payload: unknown, ok = true) {
  const calls: string[] = [];
  const fetcher = (async (url: string) => {
    calls.push(String(url));
    const requested = new URL(String(url));
    if (ok && requested.searchParams.get("returnCountOnly") === "true") {
      const count = typeof payload === "object" && payload !== null && "features" in payload && Array.isArray(payload.features)
        ? payload.features.length : 0;
      return { ok: true, status: 200, json: async () => ({ count }) } as unknown as Response;
    }
    return { ok, status: ok ? 200 : 503, json: async () => payload } as unknown as Response;
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

test.beforeEach(() => clearZoneGeometryCache());

/* ── Viewport and jurisdiction selection ─────────────────────────────────── */

test("a viewport over supported geography selects the layer that covers it", () => {
  // West of Québec's extent (-79.9°), so Ontario alone.
  const overOntario: BoundingBox = { west: -84, south: 44, east: -80.5, north: 47 };
  assert.equal(boundsIntersect(overOntario, ONTARIO), true);
  assert.deepEqual(layersForBounds(overOntario).map((layer) => layer.id), ["layer:ca-on-wmu"]);
  // Across the Ottawa River the view takes in western Québec too, and both are drawn.
  const acrossTheOttawa: BoundingBox = { west: -80, south: 44, east: -76, north: 47 };
  assert.deepEqual(layersForBounds(acrossTheOttawa).map((layer) => layer.id).sort(), ["layer:ca-on-wmu", "layer:ca-qc-zone-chasse"]);
});

test("a viewport outside supported geography requests nothing", async () => {
  // Montana. Real hunting geography, no reviewed North Ground layer — so the map
  // must say so rather than drawing something. The box stops short of the 49th
  // parallel: Alberta's served WMUs reach 48.997°N along the surveyed border, so
  // a view touching the border rightly asks Alberta.
  const overMontana: BoundingBox = { west: -114, south: 45, east: -108, north: 48.5 };
  assert.deepEqual(layersForBounds(overMontana), []);

  const { fetcher, calls } = stubFetch(collection([]));
  const result = await fetchZoneGeometry(overMontana, 6, fetcher);
  assert.equal(result.status, "EMPTY");
  assert.equal(calls.length, 0, "no authority is queried for an area North Ground does not cover");
  assert.match(result.message!, /does not yet publish/);
});

test("Canadian and United States jurisdictions stay distinguishable", () => {
  assert.ok(ZONE_LAYERS.every((layer) => layer.country === "CA"));
  assert.equal(layerForPoint(45.23, -77.94)?.jurisdictionName, "Ontario");
  assert.equal(layerForPoint(46.87, -110.36), undefined, "Montana resolves to no drawn layer");
  // A registered layer is not a drawn one: only layers Hunt serves are counted.
  assert.equal(COVERAGE_ROADMAP.drawnJurisdictions, ZONE_LAYERS.filter((layer) => layer.serving).length);
  assert.ok(COVERAGE_ROADMAP.unitedStatesInDevelopment > 0);
});

test("the authority's own terminology is never rewritten", () => {
  assert.equal(ONTARIO.officialTerm, "Wildlife Management Unit");
  assert.equal(ONTARIO.officialTermShort, "WMU");
});

test("Québec cardinal designations are readable without changing their official identifier", () => {
  const quebec = ZONE_LAYERS.find((layer) => layer.jurisdictionId === "jurisdiction:ca-qc")!;
  assert.equal(zoneDisplayLabel(quebec, "10O"), "Zone 10 West");
  assert.equal(zoneDisplayLabel(quebec, "19SE"), "Zone 19 Southeast");
  // The ministry names the part « Nord ZSR »: the direction reads, the acronym stays.
  assert.equal(zoneDisplayLabel(quebec, "08NZ"), "Zone 8 North ZSR");
});

/* ── Coverage honesty ────────────────────────────────────────────────────── */

test("drawing a boundary does not claim its rules are certified", () => {
  assert.equal(zoneCoverage(ONTARIO, "57"), "VERIFIED");
  assert.equal(zoneCoverage(ONTARIO, "63A"), "VERIFIED");
  // WMU 51 is named by no small-game season row, so its boundary is known while
  // its rules are not. That is the distinction this test exists to protect, and
  // it is now the genuine case rather than an artefact of narrow coverage.
  assert.equal(zoneCoverage(ONTARIO, "51"), "IN_DEVELOPMENT");
  // Layer-level coverage stays weaker than any single certified zone.
  assert.equal(ONTARIO.coverage, "PARTIAL");
});

test("features carry per-zone coverage, not the layer's", async () => {
  const { fetcher } = stubFetch(collection([
    { name: "57", ring: square(-77.9, 45.2, 0.2) },
    { name: "51", ring: square(-78.3, 45.8, 0.2) },
  ]));
  const result = await fetchLayerGeometry(ONTARIO, { west: -79, south: 44, east: -76, north: 46 }, 8, fetcher);
  assert.equal(result.status, "OK");
  assert.deepEqual(
    result.features.map((feature) => [feature.label, feature.coverage]),
    [["WMU 57", "VERIFIED"], ["WMU 51", "IN_DEVELOPMENT"]],
  );
});

/* ── Level of detail ─────────────────────────────────────────────────────── */

test("simplification tolerance tightens as the viewer zooms in", () => {
  const tolerances = [3, 5, 7, 9, 11, 14].map(toleranceForZoom);
  for (let index = 1; index < tolerances.length; index += 1) {
    assert.ok(tolerances[index] < tolerances[index - 1], `zoom step ${index} must refine detail`);
  }
  assert.ok(toleranceForZoom(3) >= 0.1, "continental views are heavily generalised");
  assert.ok(toleranceForZoom(14) <= 0.001, "close views are near full resolution");
});

test("the requested tolerance and viewport are sent to the authority", async () => {
  const { fetcher, calls } = stubFetch(collection([{ name: "57", ring: square(-77.9, 45.2, 0.2) }]));
  await fetchLayerGeometry(ONTARIO, { west: -79, south: 44, east: -76, north: 46 }, 9, fetcher);
  const requested = new URL(calls.find((call) => new URL(call).searchParams.get("returnGeometry") === "true")!);
  assert.equal(requested.searchParams.get("maxAllowableOffset"), String(toleranceForZoom(9)));
  assert.equal(requested.searchParams.get("geometry"), "-79,44,-76,46");
  assert.equal(requested.searchParams.get("geometryType"), "esriGeometryEnvelope");
  assert.equal(requested.searchParams.get("outSR"), "4326");
  assert.ok(Number(requested.searchParams.get("resultRecordCount")) <= 400);
});

test("a repeated viewport is served from cache instead of re-querying the authority", async () => {
  const { fetcher, calls } = stubFetch(collection([{ name: "57", ring: square(-77.9, 45.2, 0.2) }]));
  const box: BoundingBox = { west: -79, south: 44, east: -76, north: 46 };
  await fetchLayerGeometry(ONTARIO, box, 8, fetcher);
  await fetchLayerGeometry(ONTARIO, box, 8, fetcher);
  assert.equal(calls.length, 2);
});

/* ── Failure is explicit ─────────────────────────────────────────────────── */

test("a provider outage is reported, never filled in", async () => {
  const { fetcher } = stubFetch({}, false);
  const result = await fetchLayerGeometry(ONTARIO, { west: -79, south: 44, east: -76, north: 46 }, 7, fetcher);
  assert.equal(result.status, "PROVIDER_ERROR");
  assert.deepEqual(result.features, []);
  assert.match(result.message!, /will not draw an approximate boundary/);
});

test("a short authority response fails closed instead of drawing a partial layer", async () => {
  const payload = collection([{ name: "57", ring: square(-77.9, 45.2, 0.2) }]);
  const fetcher = (async (url: string) => {
    const requested = new URL(String(url));
    return {
      ok: true,
      status: 200,
      json: async () => requested.searchParams.get("returnCountOnly") === "true" ? { count: 2 } : payload,
    } as unknown as Response;
  }) as typeof fetch;
  const result = await fetchLayerGeometry(ONTARIO, { west: -79, south: 44, east: -76, north: 46 }, 7, fetcher);
  assert.equal(result.status, "PROVIDER_ERROR");
  assert.deepEqual(result.features, []);
});

test("an outage is not cached, so the map recovers on the next pan", async () => {
  const box: BoundingBox = { west: -79, south: 44, east: -76, north: 46 };
  const failing = stubFetch({}, false);
  await fetchLayerGeometry(ONTARIO, box, 8, failing.fetcher);
  const recovering = stubFetch(collection([{ name: "57", ring: square(-77.9, 45.2, 0.2) }]));
  const result = await fetchLayerGeometry(ONTARIO, box, 8, recovering.fetcher);
  assert.equal(result.status, "OK");
  assert.equal(recovering.calls.length, 2);
});

test("unusable features are dropped rather than drawn as degenerate shapes", async () => {
  const payload = {
    type: "FeatureCollection",
    features: [
      { properties: { OFFICIAL_NAME: "57" }, geometry: { type: "Polygon", coordinates: [square(-77.9, 45.2, 0.2)] } },
      { properties: { OFFICIAL_NAME: "" }, geometry: { type: "Polygon", coordinates: [square(-77, 45, 0.2)] } },
      { properties: { OFFICIAL_NAME: "59" }, geometry: null },
      { properties: { OFFICIAL_NAME: "60" }, geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 1]]] } },
    ],
  };
  const { fetcher } = stubFetch(payload);
  const result = await fetchLayerGeometry(ONTARIO, { west: -79, south: 44, east: -76, north: 46 }, 8, fetcher);
  assert.deepEqual(result.features.map((feature) => feature.name), ["57"]);
});

/* ── Request validation ──────────────────────────────────────────────────── */

test("bounds parsing refuses coordinates that are not a viewport", () => {
  assert.deepEqual(parseBounds("-79,44,-76,46"), { west: -79, south: 44, east: -76, north: 46 });
  assert.equal(parseBounds("-76,44,-79,46"), null, "west must precede east");
  assert.equal(parseBounds("-79,46,-76,44"), null, "south must precede north");
  assert.equal(parseBounds("-79,44,-76"), null);
  assert.equal(parseBounds("-79,44,-76,not-a-number"), null);
  assert.equal(parseBounds("-200,44,-76,46"), null);
  assert.equal(parseBounds("-79,-91,-76,46"), null);
  assert.equal(parseBounds(null), null);
});

/* ── Point resolution stays separate from drawing ────────────────────────── */

test("an invalid coordinate never resolves to a zone", async () => {
  const { fetcher } = stubFetch({ type: "FeatureCollection", features: [] });
  for (const [latitude, longitude] of [[Number.NaN, -77.9], [91, -77.9], [45.2, 181]]) {
    const resolution = await resolveOntarioWmuFromOfficialGis(latitude, longitude, fetcher);
    assert.notEqual(resolution.status, "RESOLVED");
  }
});

test("overlapping official zones require human verification rather than a pick", async () => {
  const { fetcher } = stubFetch({
    type: "FeatureCollection",
    features: [
      { properties: { OFFICIAL_NAME: "57" }, geometry: { type: "Polygon", coordinates: [square(-77.94, 45.23, 0.3)] } },
      { properties: { OFFICIAL_NAME: "58" }, geometry: { type: "Polygon", coordinates: [square(-77.94, 45.23, 0.4)] } },
    ],
  });
  const resolution = await resolveOntarioWmuFromOfficialGis(45.23, -77.94, fetcher);
  assert.equal(resolution.status, "UNKNOWN");
  assert.match(resolution.message, /overlapping/i);
});

test("a point near the mapped edge carries a boundary warning", async () => {
  // The ring spans 0.2 degrees; the point sits ~40 m inside its western edge.
  const ring = square(-77.94, 45.23, 0.2);
  const { fetcher } = stubFetch({
    type: "FeatureCollection",
    features: [{ properties: { OFFICIAL_NAME: "57" }, geometry: { type: "Polygon", coordinates: [ring] } }],
  });
  const resolution = await resolveOntarioWmuFromOfficialGis(45.23, -77.94 - 0.2 + 0.0005, fetcher);
  assert.equal(resolution.status, "RESOLVED");
  assert.equal(resolution.nearBoundary, true);
  assert.ok(resolution.boundaryDistanceMeters! < 150);
});

test("a point well inside a zone carries no boundary warning", async () => {
  const { fetcher } = stubFetch({
    type: "FeatureCollection",
    features: [{ properties: { OFFICIAL_NAME: "57" }, geometry: { type: "Polygon", coordinates: [square(-77.94, 45.23, 0.5)] } }],
  });
  const resolution = await resolveOntarioWmuFromOfficialGis(45.23, -77.94, fetcher);
  assert.equal(resolution.status, "RESOLVED");
  assert.equal(resolution.nearBoundary, false);
  assert.equal(resolution.officialName, "Wildlife Management Unit 57");
});

test("a point outside every official zone is unknown, not the nearest zone", async () => {
  const { fetcher } = stubFetch({ type: "FeatureCollection", features: [] });
  const resolution = await resolveOntarioWmuFromOfficialGis(48.9, -89.2, fetcher);
  assert.equal(resolution.status, "UNKNOWN");
  assert.equal(resolution.zoneId, undefined);
});

/* ── A view that spans jurisdictions ─────────────────────────────────────── */

const MANITOBA = ZONE_LAYERS.find((layer) => layer.id === "layer:ca-mb-gha")!;
/* Kenora to Winnipeg: both provinces' extents, and both authorities, in one view. */
const ACROSS_THE_BORDER: BoundingBox = { west: -97.5, south: 49.2, east: -93.5, north: 50.8 };

/** Answers each authority from its own table, as the two real services would. */
function byAuthority(answers: { ontario?: unknown; manitoba?: unknown }, failing: Array<"ontario" | "manitoba"> = []) {
  const calls: string[] = [];
  const fetcher = (async (url: string) => {
    calls.push(String(url));
    const who = String(url).includes("Manitoba_Game_Hunting_Areas") ? "manitoba" : "ontario";
    const ok = !failing.includes(who);
    const answer = answers[who] ?? { type: "FeatureCollection", features: [] };
    const requested = new URL(String(url));
    return {
      ok,
      status: ok ? 200 : 503,
      json: async () => requested.searchParams.get("returnCountOnly") === "true"
        ? { count: typeof answer === "object" && answer !== null && "features" in answer && Array.isArray(answer.features) ? answer.features.length : 0 }
        : answer,
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

function ghaCollection(features: Array<{ gha: string | null; ring: number[][] }>) {
  return {
    type: "FeatureCollection",
    features: features.map(({ gha, ring }) => ({ properties: { GHA: gha }, geometry: { type: "Polygon", coordinates: [ring] } })),
  };
}

test("a view across a provincial border draws both authorities' zones, each in its own terms", async () => {
  assert.deepEqual(layersForBounds(ACROSS_THE_BORDER).map((layer) => layer.id).sort(), ["layer:ca-mb-gha", "layer:ca-on-wmu"]);
  const { fetcher, calls } = byAuthority({
    ontario: collection([{ name: "5", ring: square(-94.5, 49.8, 0.3) }]),
    manitoba: ghaCollection([{ gha: "26", ring: square(-95.8, 50.0, 0.3) }, { gha: "35A", ring: square(-96.6, 49.5, 0.3) }]),
  });
  const result = await fetchZoneGeometry(ACROSS_THE_BORDER, 7, fetcher);
  assert.equal(calls.length, 4, "each authority is count-checked and then asked for geometry");
  assert.equal(result.status, "OK");
  assert.equal(result.layerId, undefined, "no single authority's terms name a two-jurisdiction view");
  assert.deepEqual(
    result.features.map((feature) => [feature.layerId, feature.label]).sort(),
    [["layer:ca-mb-gha", "GHA 26"], ["layer:ca-mb-gha", "GHA 35A"], ["layer:ca-on-wmu", "WMU 5"]],
  );
});

test("the same designation in two jurisdictions stays two zones", async () => {
  // Ontario WMU 26 and Manitoba GHA 26 are unrelated places.
  const { fetcher } = byAuthority({
    ontario: collection([{ name: "26", ring: square(-94.5, 49.8, 0.3) }]),
    manitoba: ghaCollection([{ gha: "26", ring: square(-95.8, 50.0, 0.3) }]),
  });
  const result = await fetchZoneGeometry(ACROSS_THE_BORDER, 7, fetcher);
  const keys = result.features.map((feature) => `${feature.layerId}|${feature.name}`);
  assert.equal(new Set(keys).size, 2);
});

test("Manitoba's undesignated park polygon is never drawn as a zone", async () => {
  const { fetcher } = byAuthority({
    manitoba: ghaCollection([{ gha: null, ring: square(-100.2, 50.8, 0.3) }, { gha: "23", ring: square(-100.9, 50.6, 0.2) }]),
  });
  const result = await fetchLayerGeometry(MANITOBA, { west: -101.5, south: 50.2, east: -99.5, north: 51.2 }, 8, fetcher);
  assert.deepEqual(result.features.map((feature) => feature.label), ["GHA 23"]);
});

test("one authority failing is reported and never hides the other's boundaries", async () => {
  const { fetcher } = byAuthority(
    { ontario: collection([{ name: "5", ring: square(-94.5, 49.8, 0.3) }]) },
    ["manitoba"],
  );
  const result = await fetchZoneGeometry(ACROSS_THE_BORDER, 7, fetcher);
  assert.equal(result.status, "PARTIAL");
  assert.deepEqual(result.features.map((feature) => feature.label), ["WMU 5"]);
  assert.match(result.message!, /Government of Manitoba zone service is temporarily unavailable/);
  assert.deepEqual(
    result.layers?.map(({ layerId, status }) => [layerId, status]).sort(),
    [["layer:ca-mb-gha", "PROVIDER_ERROR"], ["layer:ca-on-wmu", "OK"]],
  );
});

test("every authority failing is an outage, not an empty map", async () => {
  const { fetcher } = byAuthority({}, ["ontario", "manitoba"]);
  const result = await fetchZoneGeometry(ACROSS_THE_BORDER, 7, fetcher);
  assert.equal(result.status, "PROVIDER_ERROR");
  assert.deepEqual(result.features, []);
});

test("a view over one province keeps that province's identity", async () => {
  const overWinnipeg: BoundingBox = { west: -98.5, south: 49.4, east: -96.5, north: 50.4 };
  assert.deepEqual(layersForBounds(overWinnipeg).map((layer) => layer.id), ["layer:ca-mb-gha"]);
  const { fetcher } = byAuthority({ manitoba: ghaCollection([{ gha: "38", ring: square(-97.1, 49.9, 0.2) }]) });
  const result = await fetchZoneGeometry(overWinnipeg, 9, fetcher);
  assert.equal(result.layerId, "layer:ca-mb-gha");
  assert.equal(result.features[0].coverage, zoneCoverage(MANITOBA, "38"));
});
