import assert from "node:assert/strict";
import test from "node:test";
import { fetchLayerGeometry, clearZoneGeometryCache } from "../zone-geometry.ts";
import { layerById } from "../zone-layers.ts";
import { nearestNeighbour } from "./boundary.ts";
import { labelPlacement, poleOfInaccessibility } from "./label-point.ts";
import { placeLabels, type LabelCandidate } from "./labels.ts";

function inside(point: number[], ring: number[][]): boolean {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    if ((ring[i][1] > point[1]) !== (ring[j][1] > point[1]) &&
      point[0] < ((ring[j][0] - ring[i][0]) * (point[1] - ring[i][1])) / (ring[j][1] - ring[i][1]) + ring[i][0]) result = !result;
  }
  return result;
}

/* A C-shaped unit, open to the east: its bounding-box centre is outside it. */
const C_SHAPE = [[[0, 0], [10, 0], [10, 2], [2, 2], [2, 8], [10, 8], [10, 10], [0, 10], [0, 0]]];

test("a label point is inside the zone even where the bounding-box centre is not", () => {
  assert.equal(inside([5, 5], C_SHAPE[0]), false, "the naive centre falls in the notch");
  const point = poleOfInaccessibility(C_SHAPE);
  assert.equal(inside(point, C_SHAPE[0]), true);
});

test("a multipart zone gets one label, on its largest part", () => {
  const island = [[[20, 20], [20.5, 20], [20.5, 20.5], [20, 20.5], [20, 20]]];
  const mainland = [[[0, 0], [8, 0], [8, 6], [0, 6], [0, 0]]];
  const placement = labelPlacement({ type: "MultiPolygon", coordinates: [island, mainland, island] })!;
  assert.equal(placement.parts, 3);
  assert.equal(inside(placement.point, mainland[0]), true);
  assert.deepEqual(placement.span, [8, 6]);
});

test("records an authority publishes in parts become one zone with one label", async () => {
  clearZoneGeometryCache();
  const layer = layerById("layer:ca-ab-wmu")!;
  const part = (x: number) => ({ type: "Polygon", coordinates: [[[x, 49], [x + 0.2, 49], [x + 0.2, 49.2], [x, 49.2], [x, 49]]] });
  const fetcher = (async () => new Response(JSON.stringify({
    type: "FeatureCollection",
    features: [
      { properties: { WMUNIT_CODE: "00718" }, geometry: part(-111.8) },
      { properties: { WMUNIT_CODE: "00102" }, geometry: part(-111.0) },
      { properties: { WMUNIT_CODE: "00718" }, geometry: part(-111.4) },
      { properties: { WMUNIT_CODE: "00718" }, geometry: part(-111.6) },
      { properties: { WMUNIT_CODE: " " }, geometry: part(-112.4) },
    ],
  }), { status: 200 })) as typeof fetch;
  const result = await fetchLayerGeometry(layer, { west: -113, south: 48.9, east: -110, north: 49.5 }, 7, fetcher);
  assert.deepEqual(result.features.map((feature) => feature.name).sort(), ["102", "718"]);
  const wmu718 = result.features.find((feature) => feature.name === "718")!;
  assert.equal(wmu718.parts, 3);
  assert.equal(wmu718.rings.length, 3);
  // The label is the layer's own term and the authority's designation, read in the layer's encoding.
  assert.equal(wmu718.label, "WMU 718");
  assert.ok(wmu718.labelPoint && wmu718.labelSpan);
});

test("Manitoba's labels keep Manitoba's term", async () => {
  clearZoneGeometryCache();
  const layer = layerById("layer:ca-mb-gha")!;
  const fetcher = (async () => new Response(JSON.stringify({
    type: "FeatureCollection",
    features: [{ properties: { GHA: "23A" }, geometry: { type: "Polygon", coordinates: [[[-97, 50], [-96, 50], [-96, 51], [-97, 51], [-97, 50]]] } }],
  }), { status: 200 })) as typeof fetch;
  const result = await fetchLayerGeometry(layer, { west: -98, south: 49.5, east: -95, north: 51.5 }, 7, fetcher);
  assert.equal(result.features[0].label, "GHA 23A");
});

const candidate = (overrides: Partial<LabelCandidate>): LabelCandidate => ({
  key: "k", text: "WMU 57", short: "57", x: 100, y: 100, spanWidth: 200, spanHeight: 100, priority: 1, ...overrides,
});

test("labels fall back to the bare designation, then to nothing, as zones shrink", () => {
  const view = { width: 400, height: 400 };
  assert.equal(placeLabels([candidate({})], view)[0].text, "WMU 57");
  assert.equal(placeLabels([candidate({ spanWidth: 34 })], view)[0].text, "57");
  assert.equal(placeLabels([candidate({ spanWidth: 12, spanHeight: 12 })], view).length, 0);
});

test("overlapping labels are decluttered, and the selected zone always wins", () => {
  const view = { width: 400, height: 400 };
  const placed = placeLabels([
    candidate({ key: "a", text: "WMU 11A", short: "11A", spanWidth: 500, spanHeight: 300 }),
    candidate({ key: "b", text: "WMU 11B", short: "11B", x: 110, spanWidth: 20, spanHeight: 8, force: true }),
  ], view);
  assert.deepEqual(placed.map((label) => label.key), ["b"]);
});

test("labels outside the view are not drawn", () => {
  assert.equal(placeLabels([candidate({ x: 395 })], { width: 400, height: 400 }).length, 0);
});

test("placement is deterministic", () => {
  const set = Array.from({ length: 60 }, (_, index) => candidate({
    key: `z${index}`, text: `WMU ${index}`, short: String(index),
    x: (index * 37) % 380 + 10, y: (index * 53) % 380 + 10, spanWidth: 80, spanHeight: 40,
  }));
  assert.deepEqual(placeLabels(set, { width: 400, height: 400 }), placeLabels([...set].reverse(), { width: 400, height: 400 }));
});

test("a near-boundary point names the neighbouring zone, and only a close one", () => {
  const wmu57 = { layerId: "layer:ca-on-wmu", name: "57", label: "WMU 57", rings: [[[-78, 45], [-77.5, 45], [-77.5, 45.5], [-78, 45.5], [-78, 45]]] };
  const wmu61 = { layerId: "layer:ca-on-wmu", name: "61", label: "WMU 61", rings: [[[-77.5, 45], [-77, 45], [-77, 45.5], [-77.5, 45.5], [-77.5, 45]]] };
  const far = { layerId: "layer:ca-on-wmu", name: "49", label: "WMU 49", rings: [[[-80, 46], [-79.5, 46], [-79.5, 46.5], [-80, 46.5], [-80, 46]]] };
  const point = { latitude: 45.25, longitude: -77.5012 };
  const found = nearestNeighbour(point, { layerId: "layer:ca-on-wmu", name: "57" }, [wmu57, wmu61, far], 2_500);
  assert.equal(found?.zone.label, "WMU 61");
  assert.ok(found!.distanceMetres < 200);
  assert.equal(nearestNeighbour({ latitude: 45.25, longitude: -77.75 }, { layerId: "layer:ca-on-wmu", name: "57" }, [wmu57, wmu61, far], 2_500), null);
});
