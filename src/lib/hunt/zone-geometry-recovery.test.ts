import assert from "node:assert/strict";
import test from "node:test";
import { clearZoneGeometryCache, fetchLayerGeometry } from "./zone-geometry.ts";
import { layerById } from "./zone-layers.ts";

/**
 * An envelope answer shorter than its own count is re-asked by object id.
 *
 * Modelled on Alberta's real service: for -114,51,-113,52 it counts 8 records
 * and lists 8 ids (OBJECTID 133 is WMU 214) but the envelope feature query
 * returns 7, at every tolerance, while `objectIds=133` returns WMU 214. The map
 * must draw all 8 — and must still refuse any answer that cannot account for
 * every counted record exactly once.
 */

const ALBERTA = layerById("layer:ca-ab-wmu")!;
const VIEW = { west: -114, south: 51, east: -113, north: 52 };

const RECORDS = [
  { oid: 110, code: "00220" }, { oid: 115, code: "00208" }, { oid: 126, code: "00216" }, { oid: 129, code: "00210" },
  { oid: 131, code: "00158" }, { oid: 133, code: "00214" }, { oid: 140, code: "00156" }, { oid: 144, code: "00212" },
];

function square(index: number) {
  const west = -114 + index * 0.1;
  return { type: "Polygon", coordinates: [[[west, 51.2], [west + 0.08, 51.2], [west + 0.08, 51.3], [west, 51.3], [west, 51.2]]] };
}

interface Behaviour {
  envelope?: number[]; // oids the envelope query returns
  ids?: number[]; // oids the id query lists
  byId?: (requested: number[]) => number[]; // oids an objectIds query returns
}

function authority(behaviour: Behaviour, calls: URL[] = []): typeof fetch {
  const all = RECORDS.map((record) => record.oid);
  const feature = (oid: number, withId: boolean) => {
    const index = RECORDS.findIndex((record) => record.oid === oid);
    return {
      type: "Feature",
      properties: { WMUNIT_CODE: RECORDS[index].code, ...(withId ? { OBJECTID: oid } : {}) },
      geometry: square(index),
    };
  };
  return (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    calls.push(url);
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (url.searchParams.get("returnCountOnly") === "true") return json({ count: all.length });
    if (url.searchParams.get("returnIdsOnly") === "true") return json({ objectIdFieldName: "OBJECTID", objectIds: behaviour.ids ?? all });
    const objectIds = url.searchParams.get("objectIds");
    if (objectIds) {
      const requested = objectIds.split(",").map(Number);
      assert.equal(url.searchParams.get("geometry"), null, "an id query is not also an envelope query");
      const returned = behaviour.byId ? behaviour.byId(requested) : requested;
      return json({ type: "FeatureCollection", features: returned.map((oid) => feature(oid, true)) });
    }
    const envelope = behaviour.envelope ?? all.filter((oid) => oid !== 133);
    return json({ type: "FeatureCollection", features: envelope.map((oid) => feature(oid, false)) });
  }) as typeof fetch;
}

test("a short envelope answer is recovered by id, and WMU 214 is drawn", async () => {
  clearZoneGeometryCache();
  const calls: URL[] = [];
  const result = await fetchLayerGeometry(ALBERTA, VIEW, 9, authority({}, calls));
  assert.equal(result.status, "OK");
  assert.deepEqual(result.features.map((feature) => feature.name).sort(), ["156", "158", "208", "210", "212", "214", "216", "220"]);
  assert.equal(result.features.find((feature) => feature.name === "214")!.label, "WMU 214");
  const byId = calls.filter((url) => url.searchParams.get("objectIds"));
  assert.ok(byId.length >= 1);
  assert.equal(byId[0].searchParams.get("outFields"), "WMUNIT_CODE,OBJECTID");
  assert.ok(byId.every((url) => url.searchParams.get("maxAllowableOffset")), "recovered records keep the view's generalisation");
});

test("a complete envelope answer is not re-asked", async () => {
  clearZoneGeometryCache();
  const calls: URL[] = [];
  const result = await fetchLayerGeometry(ALBERTA, VIEW, 9, authority({ envelope: RECORDS.map((record) => record.oid) }, calls));
  assert.equal(result.status, "OK");
  assert.equal(result.features.length, 8);
  assert.ok(!calls.some((url) => url.searchParams.get("returnIdsOnly") || url.searchParams.get("objectIds")));
});

const REFUSALS: Array<[string, Behaviour]> = [
  ["the id list is shorter than the count", { ids: [110, 115, 126, 129, 131, 140, 144] }],
  ["asked by id, a record still does not arrive", { byId: (requested) => requested.filter((oid) => oid !== 133) }],
  ["asked by id, a record arrives twice", { byId: (requested) => [...requested, requested[0]] }],
  ["asked by id, an unrequested record arrives", { byId: (requested) => requested.map((oid) => (oid === 133 ? 999 : oid)) }],
  ["the envelope returns more than it counted", { envelope: [...RECORDS.map((record) => record.oid), 110] }],
];

for (const [label, behaviour] of REFUSALS) {
  test(`fails closed when ${label}: never 7 drawn as if they were 8`, async () => {
    clearZoneGeometryCache();
    const result = await fetchLayerGeometry(ALBERTA, VIEW, 9, authority(behaviour));
    assert.equal(result.status, "PROVIDER_ERROR");
    assert.deepEqual(result.features, []);
  });
}
