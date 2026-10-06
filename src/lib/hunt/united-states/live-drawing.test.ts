import assert from "node:assert/strict";
import test from "node:test";
import { clearZoneGeometryCache, fetchLayerGeometry, liveTiles, liveTileSize, toleranceForZoom } from "../zone-geometry.ts";
import { layerById } from "../zone-layers.ts";

/**
 * Drawing a layer North Ground holds no copy of: the view is cut into fixed
 * tiles every viewer shares, a tile in flight is fetched once, and the count
 * check still guards every tile. Every service here is a stub.
 */

const COLORADO = layerById("layer:us-co-gmu")!;
const ALBERTA = layerById("layer:ca-ab-wmu")!;

type Unit = { id: number; name: string; ring: number[][] };

const square = (west: number, south: number, size: number) =>
  [[west, south], [west + size, south], [west + size, south + size], [west, south + size], [west, south]];

/**
 * An ArcGIS-shaped service over a handful of units, logging every request in
 * order. `events` records when each request was SENT and when it was ANSWERED,
 * so concurrency is asserted as an ordering of events, never as elapsed
 * milliseconds — a wall-clock threshold fails under load while the behaviour
 * is correct (§59: deterministic fixtures).
 */
function authority(units: Unit[], nameField: string, options: { countOverride?: number } = {}) {
  const log: Array<{ kind: "count" | "features"; envelope: string }> = [];
  const events: Array<{ kind: "count" | "features"; event: "sent" | "answered" }> = [];
  const fetcher = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const [west, south, east, north] = url.searchParams.get("geometry")!.split(",").map(Number);
    const hits = units.filter((unit) => unit.ring.some(([x, y]) => x >= west && x <= east && y >= south && y <= north));
    const countOnly = url.searchParams.get("returnCountOnly") === "true";
    const kind = countOnly ? "count" : "features";
    log.push({ kind, envelope: url.searchParams.get("geometry")! });
    events.push({ kind, event: "sent" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    events.push({ kind, event: "answered" });
    if (countOnly) return Response.json({ count: options.countOverride ?? hits.length });
    return Response.json({
      type: "FeatureCollection",
      features: hits.map((unit) => ({ id: unit.id, properties: { [nameField]: unit.name }, geometry: { type: "Polygon", coordinates: [unit.ring] } })),
    });
  }) as typeof fetch;
  return { fetcher, log, events };
}

const UNITS: Unit[] = [
  { id: 1, name: "12", ring: square(-106.9, 39.1, 0.3) },
  { id: 2, name: "23", ring: square(-106.1, 39.6, 0.3) },
  // Straddles a tile edge at zoom 9 (quarter-degree tiles would put -106.0 on an edge).
  { id: 3, name: "35", ring: square(-106.2, 39.4, 0.4) },
];

test("tiles are fixed to a grid chosen from the zoom, so nearby views ask for the same tiles", () => {
  const tolerance = toleranceForZoom(9);
  assert.equal(liveTileSize(tolerance), 1.024);
  const a = liveTiles({ west: -106.9, south: 39.1, east: -105.8, north: 39.9 }, COLORADO, tolerance);
  const b = liveTiles({ west: -106.8, south: 39.2, east: -105.9, north: 39.8 }, COLORADO, tolerance);
  assert.deepEqual(a, b, "a small pan reuses the same tiles");
  assert.ok(a.every((tile) => tile.west >= COLORADO.bounds.minLongitude && tile.north <= COLORADO.bounds.maxLatitude), "tiles stay inside the layer");
  // Whole-state and street zooms stay within bounds on tile size.
  assert.equal(liveTileSize(toleranceForZoom(3)), 8);
  assert.equal(liveTileSize(toleranceForZoom(16)), 0.25);
});

test("every zone appears once however many tiles it touches, and the drawing matches the service", async () => {
  clearZoneGeometryCache();
  const { fetcher } = authority(UNITS, COLORADO.nameField!);
  const result = await fetchLayerGeometry(COLORADO, { west: -107.5, south: 38.5, east: -105.0, north: 40.5 }, 9, fetcher);
  assert.equal(result.status, "OK");
  assert.deepEqual(result.features.map((feature) => feature.name).sort(), ["12", "23", "35"]);
});

test("a second viewer over the same tiles is answered from memory, and concurrent viewers share one request per tile", async () => {
  clearZoneGeometryCache();
  const { fetcher, log } = authority(UNITS, COLORADO.nameField!);
  const view = { west: -106.9, south: 39.1, east: -105.8, north: 39.9 };
  await Promise.all([1, 2, 3].map(() => fetchLayerGeometry(COLORADO, view, 9, fetcher)));
  const tiles = liveTiles(view, COLORADO, toleranceForZoom(9)).length;
  assert.equal(log.length, tiles * 2, "one count and one feature request per tile, for three concurrent viewers");
  await fetchLayerGeometry(COLORADO, { west: -106.8, south: 39.2, east: -105.9, north: 39.8 }, 9, fetcher);
  assert.equal(log.length, tiles * 2, "a panned view within the same tiles asks nothing");
});

test("a live tile asks for its count and features together, and still refuses a short answer", async () => {
  clearZoneGeometryCache();
  const { fetcher, events } = authority(UNITS, COLORADO.nameField!);
  await fetchLayerGeometry(COLORADO, { west: -106.9, south: 39.1, east: -106.6, north: 39.4 }, 9, fetcher);
  const firstAnswer = events.findIndex((entry) => entry.event === "answered");
  const sent = (kind: "count" | "features") => events.findIndex((entry) => entry.kind === kind && entry.event === "sent");
  assert.ok(sent("count") >= 0 && sent("features") >= 0 && firstAnswer >= 0, "both requests were made and answered");
  assert.ok(sent("count") < firstAnswer && sent("features") < firstAnswer, "both requests were sent before either answered");

  clearZoneGeometryCache();
  const short = authority(UNITS, COLORADO.nameField!, { countOverride: 7 });
  const result = await fetchLayerGeometry(COLORADO, { west: -106.9, south: 39.1, east: -106.6, north: 39.4 }, 9, short.fetcher);
  assert.equal(result.status, "PROVIDER_ERROR", "fewer features than counted is never drawn as the whole layer");
});

test("a Canadian layer keeps its established order: count first, then features", async () => {
  clearZoneGeometryCache();
  const { fetcher, log, events } = authority([{ id: 1, name: "00102", ring: square(-110.8, 49.1, 0.3) }], ALBERTA.nameField!);
  await fetchLayerGeometry(ALBERTA, { west: -111, south: 49, east: -110.4, north: 49.5 }, 9, fetcher);
  assert.deepEqual(log.map((entry) => entry.kind), ["count", "features"]);
  assert.deepEqual(events.map((entry) => `${entry.kind}:${entry.event}`),
    ["count:sent", "count:answered", "features:sent", "features:answered"], "the feature request waited for the count");
});
