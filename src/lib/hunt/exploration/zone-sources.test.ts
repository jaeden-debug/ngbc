import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clampToLayer, clearZoneGeometryCache, drawingPrecision, fetchLayerGeometry, fetchZoneGeometry, layersForBounds, queryTiles, storedLevelForTolerance } from "../zone-geometry.ts";
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
    /* Counts are derived from the rows, not sent: a count cannot then disagree
       with the list beside it. */
    assert.ok(card.species.some((entry) => entry.state !== "UNKNOWN" && entry.state !== "NOT_CERTIFIED"));
    /* Identity, not name — naming moved to the presentation layer, and that
       every id resolves through it is asserted in zone-summary.test.ts. */
    assert.ok(card.species.some((entry) => entry.speciesId === "species:arctic-hare"));
  } finally {
    quebec.serving = was;
    clearZoneGeometryCache();
  }
});

test("a saturated stored result refuses the layer rather than drawing part of it", async () => {
  /*
   * The limit is asked for per level, so the refusal has to compare against the
   * limit the caller actually requested, never a constant. Yukon is why: its
   * 443 subzones saturated a flat 400-row cap and the whole layer vanished.
   * A level-1 answer of exactly 1000 rows may be truncated, and a partly drawn
   * jurisdiction is a silent lie about where its boundaries are.
   */
  const quebec = layerById("layer:ca-qc-zone-chasse")!;
  const was = quebec.serving;
  quebec.serving = true;
  try {
    const fetcher = (async () => { throw new Error("the ministry's WFS is not a map source"); }) as typeof fetch;
    const rowsAt = (count: number) => Array.from({ length: count }, (_unused, index) => ({
      official_identifier: String(index + 1),
      canonical_id: `management_zone:ca-qc-zone-${index + 1}`,
      geometry: square(-75 + (index % 100) * 0.01, 45.5),
    }));

    // Level 1 (overview zoom 6): saturating the overview ceiling refuses the layer.
    clearZoneGeometryCache();
    const saturated = await fetchLayerGeometry(
      quebec, { west: -80, south: 44, east: -60, north: 52 }, 6, fetcher, storedClient(rowsAt(1_000)),
    );
    assert.equal(saturated.status, "PROVIDER_ERROR", "1000 rows at level 1 may be truncated");

    // One short of it is a complete answer, and is drawn.
    clearZoneGeometryCache();
    const complete = await fetchLayerGeometry(
      quebec, { west: -80, south: 44, east: -60, north: 52 }, 6, fetcher, storedClient(rowsAt(999)),
    );
    assert.equal(complete.status, "OK");
    assert.equal(complete.features.length, 999);

    // 400 rows no longer saturates the overview level, which is the whole point of the change.
    clearZoneGeometryCache();
    const fourHundred = await fetchLayerGeometry(
      quebec, { west: -80, south: 44, east: -60, north: 52 }, 6, fetcher, storedClient(rowsAt(400)),
    );
    assert.equal(fourHundred.status, "OK", "Yukon's 443 must fit at the overview level");
  } finally {
    quebec.serving = was;
    clearZoneGeometryCache();
  }
});

test("a drawn zone carries only the precision its zoom can show", async () => {
  /*
   * Sub-pixel at every zoom the overview is drawn at: 0.001° is 56-79 m
   * against 611-1730 m per pixel. It is a rendering precision on a drawing —
   * zone resolution and boundary distance come from the resolver at full
   * precision and are not touched here.
   */
  assert.equal(drawingPrecision(6), 3, "the overview's own request zoom");
  assert.equal(drawingPrecision(7), 3);
  assert.equal(drawingPrecision(9), 4, "level 1");
  assert.equal(drawingPrecision(11), 6, "detailed levels keep full precision");
  assert.equal(drawingPrecision(12), 6);

  const quebec = layerById("layer:ca-qc-zone-chasse")!;
  const was = quebec.serving;
  quebec.serving = true;
  try {
    const fetcher = (async () => { throw new Error("the ministry's WFS is not a map source"); }) as typeof fetch;
    const precise = { type: "Polygon", coordinates: [[[-75.123456789, 45.987654321], [-75.1, 45.9], [-75.2, 46.0], [-75.123456789, 45.987654321]]] };

    clearZoneGeometryCache();
    const overview = await fetchLayerGeometry(quebec, { west: -80, south: 44, east: -60, north: 52 }, 6, fetcher,
      storedClient([{ official_identifier: "10E", canonical_id: "management_zone:ca-qc-zone-10e", geometry: precise }]));
    assert.equal(overview.status, "OK");
    const overviewResult = await fetchZoneGeometry({ west: -80, south: 44, east: -60, north: 52 }, 6, fetcher);
    for (const feature of overviewResult.features) {
      for (const ring of feature.rings) {
        for (const [longitude, latitude] of ring) {
          assert.equal(longitude, Math.round(longitude * 1_000) / 1_000, "longitude is rounded to three decimals");
          assert.equal(latitude, Math.round(latitude * 1_000) / 1_000, "latitude is rounded to three decimals");
        }
      }
    }
    assert.ok(overviewResult.features.length > 0, "the overview drew something to check");
  } finally {
    quebec.serving = was;
    clearZoneGeometryCache();
  }
});

test("a ring too small to survive rounding keeps its own precision, and still draws", async () => {
  /*
   * Rounding snaps to a 56-79 m grid. A zone part smaller than that would
   * collapse to a single point and draw as nothing while still being counted
   * among the features — the same class of lie as drawing 400 of 443 zones.
   * Small island parts on the Québec and British Columbian coasts are the real
   * case. Measured: a 120 m square keeps four distinct points; a 40 m square
   * collapses to one.
   */
  const quebec = layerById("layer:ca-qc-zone-chasse")!;
  const was = quebec.serving;
  quebec.serving = true;
  const squareOf = (metres: number, west = -79.5, south = 45): number[][] => {
    const side = metres / 111_320;
    return [[west, south], [west + side, south], [west + side, south + side], [west, south + side], [west, south]];
  };
  try {
    const fetcher = (async () => { throw new Error("the ministry's WFS is not a map source"); }) as typeof fetch;
    clearZoneGeometryCache();
    const island = await fetchLayerGeometry(quebec, { west: -80, south: 44, east: -60, north: 52 }, 6, fetcher,
      storedClient([
        { official_identifier: "10E", canonical_id: "management_zone:ca-qc-zone-10e",
          geometry: { type: "MultiPolygon", coordinates: [[squareOf(120_000)], [squareOf(120, -79.9, 45.9)], [squareOf(40, -79.8, 45.8)]] } },
      ]));
    assert.equal(island.status, "OK");
    const result = await fetchZoneGeometry({ west: -80, south: 44, east: -60, north: 52 }, 6, fetcher);
    const rings = result.features.flatMap((feature) => feature.rings);

    // Every ring still draws: none collapsed to fewer than three distinct points.
    for (const ring of rings) {
      const distinct = new Set(ring.map((point) => point.join(","))).size;
      assert.ok(distinct >= 3, `a ring collapsed to ${distinct} distinct points and would draw as nothing`);
    }

    // The large and 120 m rings took the rounding; the 40 m one kept its own precision.
    const decimalsOf = (ring: number[][]) => Math.max(...ring.flat().map((value) => {
      const text = String(value); const dot = text.indexOf(".");
      return dot < 0 ? 0 : text.length - dot - 1;
    }));
    assert.ok(rings.some((ring) => decimalsOf(ring) <= 3), "most rings are rounded");
    assert.ok(rings.some((ring) => decimalsOf(ring) > 3), "the ring that would have collapsed kept its precision");
  } finally {
    quebec.serving = was;
    clearZoneGeometryCache();
  }
});
