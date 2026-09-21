import assert from "node:assert/strict";
import { test } from "node:test";
import { compareGhaDesignations, createManitobaGhaSource, MANITOBA_GHA_SERVICE } from "./manitoba-gha.ts";

/**
 * Deterministic fixtures standing in for the province's ArcGIS service. None of
 * these touch the network: a test that depends on a government endpoint fails
 * for reasons unrelated to the code under test.
 */

const SQUARE = [[-98, 50], [-97, 50], [-97, 51], [-98, 51], [-98, 50]];
const PARK = [[-101, 50.5], [-99.6, 50.5], [-99.6, 51], [-101, 51], [-101, 50.5]];

type Row = { OBJECTID: number; GHA: string | null; ring?: number[][]; type?: string };

function fakeService(rows: Row[], options: { count?: number; ids?: number[]; duplicate?: number; dataLastEditDate?: number } = {}) {
  const calls: string[] = [];
  const fetcher = (async (input: string | URL) => {
    const url = new URL(String(input));
    calls.push(url.search);
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (url.href.startsWith(`${MANITOBA_GHA_SERVICE}?`)) {
      return json({ editingInfo: { dataLastEditDate: options.dataLastEditDate ?? Date.UTC(2024, 4, 30, 16, 12) } });
    }
    const parameters = url.searchParams;
    if (parameters.get("returnCountOnly") === "true") return json({ count: options.count ?? rows.length });
    if (parameters.get("returnIdsOnly") === "true") return json({ objectIds: options.ids ?? rows.map((row) => row.OBJECTID) });
    const wanted = (parameters.get("objectIds") ?? "").split(",").map(Number);
    const features = rows
      .filter((row) => wanted.includes(row.OBJECTID))
      .map((row) => ({
        type: "Feature",
        id: row.OBJECTID,
        properties: { OBJECTID: row.OBJECTID, GHA: row.GHA },
        geometry: row.type === "none" ? null : { type: row.type ?? "Polygon", coordinates: [row.ring ?? SQUARE] },
      }));
    if (options.duplicate && wanted.includes(options.duplicate)) features.push(features[0]);
    return json({ type: "FeatureCollection", features });
  }) as typeof fetch;
  return { fetcher, calls };
}

test("stages named Game Hunting Areas in the authority's own order, with Manitoba identity", async () => {
  const { fetcher } = fakeService([
    { OBJECTID: 3, GHA: "13A" }, { OBJECTID: 1, GHA: "13" }, { OBJECTID: 2, GHA: "2A" }, { OBJECTID: 4, GHA: "7" },
  ]);
  const source = createManitobaGhaSource(fetcher);
  const { features, quarantined, sourceVersion } = await source.fetchFeatures();
  assert.ok(quarantined);

  assert.deepEqual(features.map((feature) => feature.officialIdentifier), ["2A", "7", "13", "13A"]);
  assert.deepEqual(quarantined, []);
  assert.equal(sourceVersion, "data-2024-05-30");
  // The province's term, never an Ontario one.
  assert.equal(source.officialTerm, "Game Hunting Area");
  assert.equal(source.officialName("13a"), "Game Hunting Area 13A");
  assert.equal(source.canonicalZoneId("13A"), "management_zone:ca-mb-gha-13a");
  assert.ok(features.every((feature) => feature.geometry.type === "MultiPolygon"));
});

test("an undesignated polygon is quarantined with its location, never staged or silently dropped", async () => {
  // The real layer's 63rd polygon has no GHA value and covers Riding Mountain
  // National Park. Staging it would invent a hunting area; dropping it without
  // a record would make 62 look like the whole layer.
  const { fetcher } = fakeService([
    { OBJECTID: 1, GHA: "23" },
    { OBJECTID: 21, GHA: " ", ring: PARK },
    { OBJECTID: 22, GHA: null, ring: PARK },
  ]);
  const { features, quarantined } = await createManitobaGhaSource(fetcher).fetchFeatures();
  assert.ok(quarantined, "the adapter always reports what it quarantined, even when nothing was");

  assert.deepEqual(features.map((feature) => feature.officialIdentifier), ["23"]);
  assert.deepEqual(quarantined.map((entry) => entry.sourceFeatureId), ["21", "22"]);
  assert.deepEqual(quarantined[0].bbox, [-101, 50.5, -99.6, 51]);
  assert.equal(quarantined[0].vertices, 5);
  assert.match(quarantined[0].reason, /no Game Hunting Area designation/);
});

test("a designation published twice refuses the whole read", async () => {
  const { fetcher } = fakeService([{ OBJECTID: 1, GHA: "18" }, { OBJECTID: 2, GHA: "18 " }]);
  await assert.rejects(createManitobaGhaSource(fetcher).fetchFeatures(), /GHA 18 is published twice/);
});

test("a read that does not account for every published feature is refused", async () => {
  // The service counts three but lists two ids: staging would lose an area.
  const listed = fakeService([{ OBJECTID: 1, GHA: "1" }, { OBJECTID: 2, GHA: "2" }], { count: 3 });
  await assert.rejects(createManitobaGhaSource(listed.fetcher).fetchFeatures(), /refusing a partial read/);

  const repeated = fakeService([{ OBJECTID: 1, GHA: "1" }, { OBJECTID: 2, GHA: "2" }], { duplicate: 1 });
  await assert.rejects(createManitobaGhaSource(repeated.fetcher).fetchFeatures(), /arrived twice/);
});

test("a feature with no polygon geometry refuses the read rather than being skipped", async () => {
  const { fetcher } = fakeService([{ OBJECTID: 1, GHA: "5", type: "none" }]);
  await assert.rejects(createManitobaGhaSource(fetcher).fetchFeatures(), /no polygon geometry/);
});

test("features are requested by explicit id, never by offset", async () => {
  const rows = Array.from({ length: 20 }, (_, index) => ({ OBJECTID: index + 1, GHA: String(index + 1) }));
  const { fetcher, calls } = fakeService(rows);
  await createManitobaGhaSource(fetcher).fetchFeatures();
  const pages = calls.filter((search) => search.includes("objectIds="));
  assert.equal(pages.length, 3);
  assert.ok(pages.every((search) => !search.includes("resultOffset")));
  assert.ok(pages.every((search) => search.includes("outSR=4326")));
});

test("the authority's answer at a point omits the undesignated park polygon, as staging does", async () => {
  const fetcher = (async (input: string | URL) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("geometryType"), "esriGeometryPoint");
    assert.equal(url.searchParams.get("inSR"), "4326");
    const [longitude] = (url.searchParams.get("geometry") ?? "").split(",").map(Number);
    const features = longitude < -99.6
      ? [{ properties: { GHA: " " } }] // inside Riding Mountain National Park
      : [{ properties: { GHA: "23a" } }];
    return new Response(JSON.stringify({ type: "FeatureCollection", features }), { status: 200 });
  }) as typeof fetch;
  const source = createManitobaGhaSource(fetcher);
  assert.deepEqual(await source.officialIdentifiersAt!(50.66, -99.97), []);
  assert.deepEqual(await source.officialIdentifiersAt!(50.3, -99.4), ["23A"]);
});

test("the authority's ordering keeps lettered areas after their number", () => {
  const ordered = ["35", "2A", "34C", "3", "34", "1", "2", "34A", "3A"].sort(compareGhaDesignations);
  assert.deepEqual(ordered, ["1", "2", "2A", "3", "3A", "34", "34A", "34C", "35"]);
});
