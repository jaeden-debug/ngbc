import assert from "node:assert/strict";
import test from "node:test";
import {
  boxContains, levelForZoom, requestBoxFor, ZoneGeometryStore, zoneKeyOf,
  type BBox, type SourceZoneFeature,
} from "./geometry-store.ts";

const square = (west: number, south: number, size: number): number[][][] => [[
  [west, south], [west + size, south], [west + size, south + size], [west, south + size], [west, south],
]];

function feature(layerId: string, name: string, rings: number[][][], extra: Partial<SourceZoneFeature> = {}): SourceZoneFeature {
  return { layerId, name, label: `Z ${name}`, compactLabel: name, accessibleLabel: `Zone ${name}`, coverage: "VERIFIED", rings, ...extra };
}

const ONTARIO = "layer:ca-on-wmu";
const QUEBEC = "layer:ca-qc-zone-chasse";
const store = () => new ZoneGeometryStore({ isClippedLayer: (layerId) => layerId === QUEBEC });
const EXTENT: BBox = { west: -120, south: 41.5, east: -57, north: 62.7 };

test("zoom chooses a level, and every zoom has one", () => {
  assert.deepEqual([3, 4, 7, 7.9, 8, 9, 10, 11, 12, 18].map(levelForZoom), [0, 0, 0, 0, 1, 1, 2, 2, 3, 3]);
  assert.equal(levelForZoom(Number.NaN), 0);
});

test("request boxes are the view plus a margin, snapped outward to the level's grid", () => {
  const view = { west: -78.1, south: 45.02, east: -77.7, north: 45.31 };
  const box = requestBoxFor(view, 2, EXTENT)!;
  assert.ok(boxContains(box, view), "the request covers the view");
  for (const edge of [box.west, box.south, box.east, box.north]) {
    assert.ok(Math.abs(edge / 0.5 - Math.round(edge / 0.5)) < 1e-9, `${edge} is on the 0.5° grid`);
  }
  // A small pan inside the margin asks for the same box, so the drawing held is reused.
  const panned = { west: -78.05, south: 45.05, east: -77.65, north: 45.34 };
  assert.deepEqual(requestBoxFor(panned, 2, EXTENT), box);
});

test("the overview asks for the whole served extent, and nothing is asked outside it", () => {
  assert.deepEqual(requestBoxFor({ west: -80, south: 45, east: -79, north: 46 }, 0, EXTENT), EXTENT);
  assert.equal(requestBoxFor({ west: 10, south: 45, east: 11, north: 46 }, 2, EXTENT), null);
  const edge = requestBoxFor({ west: -121, south: 50, east: -119.5, north: 51 }, 2, EXTENT)!;
  assert.equal(edge.west, EXTENT.west, "clamped to the served extent");
});

test("a zone keeps its overview drawing while detail loads, fails or goes out of date", () => {
  const geometry = store();
  geometry.apply(0, EXTENT, geometry.nextSeq(), [feature(ONTARIO, "57", square(-78.4, 44.8, 0.8))]);
  const view = { west: -78.2, south: 45, east: -77.9, north: 45.2 };
  // Zoomed in, nothing finer has arrived: the overview is still drawn.
  assert.equal(geometry.pieceFor(zoneKeyOf({ layerId: ONTARIO, name: "57" }), view, 3)?.level, 0);
  // Detail arrives and replaces it for this zone.
  geometry.apply(3, requestBoxFor(view, 3, EXTENT)!, geometry.nextSeq(), [feature(ONTARIO, "57", square(-78.41, 44.79, 0.82))]);
  assert.equal(geometry.pieceFor("layer:ca-on-wmu|57", view, 3)?.level, 3);
  // Zooming back out draws the overview again, without a request.
  assert.equal(geometry.pieceFor("layer:ca-on-wmu|57", EXTENT, 0)?.level, 0);
});

test("an older response arriving late cannot replace a newer drawing", () => {
  const geometry = store();
  const older = geometry.nextSeq();
  const newer = geometry.nextSeq();
  const box = { west: -79, south: 44, east: -77, north: 46 };
  geometry.apply(1, box, newer, [feature(ONTARIO, "57", square(-78.4, 44.8, 0.8))]);
  const changed = geometry.apply(1, box, older, [feature(ONTARIO, "57", square(-70, 40, 1))]);
  assert.deepEqual(changed, []);
  assert.equal(geometry.get("layer:ca-on-wmu|57")?.pieces[1]?.seq, newer);
});

test("a clipped drawing is used only while the view is inside the box it was clipped to", () => {
  const geometry = store();
  geometry.apply(0, EXTENT, geometry.nextSeq(), [feature(QUEBEC, "28", square(-73.1, 47.9, 1.2))]);
  const requestBox = { west: -72.75, south: 48.25, east: -72.25, north: 48.75 };
  geometry.apply(3, requestBox, geometry.nextSeq(), [feature(QUEBEC, "28", square(-72.75, 48.25, 0.5))]);
  const inside = { west: -72.6, south: 48.4, east: -72.4, north: 48.6 };
  const across = { west: -72.9, south: 48.4, east: -72.6, north: 48.6 };
  assert.equal(geometry.pieceFor("layer:ca-qc-zone-chasse|28", inside, 3)?.level, 3);
  // Past the clip edge the clipped drawing would draw that edge as a boundary: the whole overview is shown instead.
  assert.equal(geometry.pieceFor("layer:ca-qc-zone-chasse|28", across, 3)?.level, 0);
  // Overview drawings are whole even from a clipping source.
  assert.equal(geometry.get("layer:ca-qc-zone-chasse|28")?.pieces[0]?.whole, true);
});

test("designations repeat across jurisdictions and never collide", () => {
  const geometry = store();
  geometry.apply(0, EXTENT, geometry.nextSeq(), [
    feature(ONTARIO, "22", square(-85, 49, 1)),
    feature("layer:ca-mb-gha", "22", square(-100, 50, 1)),
  ]);
  assert.equal(geometry.size, 2);
});

test("a zone with no overview still draws its whole detail at any zoom", () => {
  // An authority that failed the overview but answered a detail request.
  const geometry = store();
  const box = { west: -114.5, south: 50.5, east: -112.5, north: 52.5 };
  geometry.apply(1, box, geometry.nextSeq(), [feature("layer:ca-ab-wmu", "212", square(-114.2, 51, 0.3))]);
  assert.equal(geometry.pieceFor("layer:ca-ab-wmu|212", EXTENT, 0)?.level, 1);
});

test("what is in view comes from each zone's whole extent", () => {
  const geometry = store();
  geometry.apply(0, EXTENT, geometry.nextSeq(), [
    feature(ONTARIO, "57", square(-78.4, 44.8, 0.8)),
    feature(ONTARIO, "1A", square(-94, 55, 1)),
  ]);
  const names = geometry.inView({ west: -79, south: 44, east: -77, north: 46 }).map((zone) => zone.name);
  assert.deepEqual(names, ["57"]);
});

test("drawn() gives every zone exactly one drawing, and bumps a version on change", () => {
  const geometry = store();
  const before = geometry.version;
  geometry.apply(0, EXTENT, geometry.nextSeq(), [
    feature(ONTARIO, "57", square(-78.4, 44.8, 0.8)),
    feature(QUEBEC, "10O", square(-76, 46, 1)),
  ]);
  assert.ok(geometry.version > before);
  const drawn = geometry.drawn(EXTENT, 0);
  assert.deepEqual(drawn.map((zone) => zone.key).sort(), ["layer:ca-on-wmu|57", "layer:ca-qc-zone-chasse|10O"]);
  assert.ok(drawn.every((zone) => zone.piece.rings.length > 0));
});
