import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clearZoneGeometryCache, clampToLayer, fetchLayerGeometry, layersForBounds, queryTiles, storedLevelForTolerance } from "../zone-geometry.ts";
import { layerById } from "../zone-layers.ts";
import { summarizeZone } from "./zone-summary.ts";

const square = (west: number, south: number, size = 0.4) => ({
  type: "Polygon",
  coordinates: [[[west, south], [west + size, south], [west + size, south + size], [west, south + size], [west, south]]],
});

test("Ontario's wide views are asked in tiles no wider than its service answers completely", async () => {
  clearZoneGeometryCache();
  const ontario = layerById("layer:ca-on-wmu")!;
  const asked: number[][] = [];
  const fetcher = (async (url: string | URL | Request) => {
    const requested = new URL(String(url));
    const box = requested.searchParams.get("geometry")!.split(",").map(Number);
    // Every tile returns the unit it overlaps, and WMU 13 straddles two tiles, so both return it.
    const features = [
      { id: 13, properties: { OFFICIAL_NAME: "13" }, geometry: square(-86.2, 49.1) },
      { id: Math.round(box[0] * -10), properties: { OFFICIAL_NAME: `T${Math.round(-box[0])}` }, geometry: square(box[0] + 0.5, 50) },
    ];
    if (requested.searchParams.get("returnCountOnly") === "true") {
      return new Response(JSON.stringify({ count: features.length }), { status: 200 });
    }
    asked.push(box);
    return new Response(JSON.stringify({ type: "FeatureCollection", features }), { status: 200 });
  }) as typeof fetch;
  const result = await fetchLayerGeometry(ontario, { west: -96, south: 49, east: -74, north: 57 }, 4, fetcher);
  assert.ok(asked.length >= 5, `a 21.5°-wide view was asked as ${asked.length} queries`);
  assert.ok(asked.every(([west, , east]) => east - west <= 5 + 1e-9), "every tile is at most 5° wide");
  // Clamped to Ontario's extent: nothing west of -95.5 is asked of Ontario.
  assert.equal(Math.min(...asked.map(([west]) => west)), -95.5);
  const thirteen = result.features.filter((feature) => feature.name === "13");
  assert.equal(thirteen.length, 1, "a unit returned by two tiles is one feature");
  assert.equal(thirteen[0].parts, 1, "and not drawn twice");
  assert.equal(result.features.length, asked.length + 1, "the union of every tile");
});

test("a failed tile fails the layer rather than drawing part of the province as all of it", async () => {
  clearZoneGeometryCache();
  let calls = 0;
  const fetcher = (async () => {
    calls += 1;
    return calls === 2 ? new Response("down", { status: 503 }) : new Response(JSON.stringify({ type: "FeatureCollection", features: [] }), { status: 200 });
  }) as typeof fetch;
  const result = await fetchLayerGeometry(layerById("layer:ca-on-wmu")!, { west: -95, south: 45, east: -80, north: 50 }, 5, fetcher);
  assert.equal(result.status, "PROVIDER_ERROR");
  assert.deepEqual(result.features, []);
});

test("tiling and clamping are pure and exact", () => {
  assert.deepEqual(queryTiles({ west: 0, south: 0, east: 4, north: 1 }, 5), [{ west: 0, south: 0, east: 4, north: 1 }]);
  const tiles = queryTiles({ west: -96, south: 49, east: -74, north: 57 }, 5);
  assert.equal(tiles.length, 5);
  assert.equal(tiles[0].west, -96);
  assert.equal(tiles.at(-1)!.east, -74);
  for (let index = 1; index < tiles.length; index += 1) assert.equal(tiles[index].west, tiles[index - 1].east);
  assert.equal(clampToLayer({ west: -140, south: 60.5, east: -130, north: 70 }, layerById("layer:ca-on-wmu")!), null);
  assert.deepEqual(storedLevelForTolerance(0.12), 1);
  assert.deepEqual(storedLevelForTolerance(0.03), 2);
  assert.deepEqual(storedLevelForTolerance(0.008), 3);
  assert.deepEqual(storedLevelForTolerance(0.0008), 4);
});

function storedClient(rows: unknown[] | Error, calls: unknown[] = []) {
  return () => ({
    rpc(name: string, args: unknown) {
      calls.push({ name, args });
      const response = rows instanceof Error ? { data: null, error: rows } : { data: rows, error: null };
      return { abortSignal: () => Promise.resolve(response) };
    },
  }) as unknown as Pick<SupabaseClient, "rpc">;
}

test("Québec is never drawn while its layer is not served", () => {
  const quebec = layerById("layer:ca-qc-zone-chasse")!;
  const was = quebec.serving;
  quebec.serving = false;
  try {
    assert.equal(layersForBounds({ west: -75, south: 45, east: -70, north: 48 }).some((layer) => layer.id === quebec.id), false);
  } finally {
    quebec.serving = was;
  }
});

test("switched on, Québec draws from North Ground's stored drawings, named in the ministry's terms", async () => {
  const quebec = layerById("layer:ca-qc-zone-chasse")!;
  const was = quebec.serving;
  quebec.serving = true;
  try {
    clearZoneGeometryCache();
    assert.ok(layersForBounds({ west: -75, south: 45, east: -70, north: 48 }).includes(quebec));
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client = storedClient([
      { official_identifier: "10E", canonical_id: "management_zone:ca-qc-zone-10e", geometry: square(-75, 45.5) },
      { official_identifier: "19SE", canonical_id: "management_zone:ca-qc-zone-19se", geometry: { type: "MultiPolygon", coordinates: [square(-64, 50).coordinates, square(-63, 50, 0.1).coordinates] } },
      // A drawing whose designation would mint a different id than the rules use is not drawn.
      { official_identifier: "10O", canonical_id: "management_zone:ca-qc-zone-something-else", geometry: square(-76, 45.5) },
      // A zone clipped away entirely.
      { official_identifier: "21", canonical_id: "management_zone:ca-qc-zone-21", geometry: { type: "GeometryCollection" } },
    ], calls);
    const fetcher = (async () => { throw new Error("the ministry's WFS is not a map source"); }) as typeof fetch;
    const result = await fetchLayerGeometry(quebec, { west: -80, south: 44, east: -60, north: 52 }, 6, fetcher, client);
    assert.equal(result.status, "OK");
    assert.deepEqual(result.features.map((feature) => feature.label).sort(), ["Zone 10 East", "Zone 19 Southeast"]);
    assert.equal(result.features.find((feature) => feature.name === "19SE")!.parts, 2);
    assert.equal(calls[0].name, "zone_display_in_view");
    assert.equal(calls[0].args.p_jurisdiction_canonical_id, "jurisdiction:ca-qc");
    assert.equal(calls[0].args.p_level, 1);

    // No authority service to fall back to: an outage is an outage, not a guess.
    clearZoneGeometryCache();
    const down = await fetchLayerGeometry(quebec, { west: -80, south: 44, east: -60, north: 52 }, 6, fetcher, storedClient(new Error("timeout")));
    assert.equal(down.status, "PROVIDER_ERROR");

    // Its zone cards come from Québec's own certified rules, under the ministry's own term.
    const card = await summarizeZone({ layerId: quebec.id, designation: "10E" }, "2026-10-01");
    assert.equal(card.zone.officialName, "Zone de chasse 10E");
    assert.equal(card.zone.jurisdictionName, "Québec");
    assert.ok(card.counts.certifiedHere > 0);
    assert.ok(card.species.some((entry) => entry.name === "Arctic hare"), "names come from the species library");
  } finally {
    quebec.serving = was;
    clearZoneGeometryCache();
  }
});
