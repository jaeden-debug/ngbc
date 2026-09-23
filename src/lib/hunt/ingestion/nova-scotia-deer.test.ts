import assert from "node:assert/strict";
import { test } from "node:test";
import { createNovaScotiaDeerSource, normaliseNovaScotiaDeerZone, NOVA_SCOTIA_DEER_CONFIG } from "./nova-scotia-deer.ts";
import { createSocrataZoneSource } from "./socrata-zone-source.ts";

/**
 * Nova Scotia publishes one row per POLYGON PART, not one per zone: twelve
 * deer management zones arrive as 234 rows. Reading a row as a zone would
 * invent 234 zones out of twelve.
 */

const square = (west: number, south: number, size = 0.1) => ({
  type: "Polygon" as const,
  coordinates: [[[west, south], [west + size, south], [west + size, south + size], [west, south + size], [west, south]]],
});

function authority(rows: Array<{ deer_zone: unknown; geometry?: unknown }>) {
  return (async (input: string | URL) => {
    const url = new URL(String(input));
    if (url.searchParams.has("$where")) {
      return new Response(JSON.stringify([{ deer_zone: "101.0" }]), { headers: { "content-type": "application/json" } });
    }
    const offset = Number(url.searchParams.get("$offset") ?? 0);
    const features = offset > 0 ? [] : rows.map((row) => ({
      properties: { deer_zone: row.deer_zone, area: 1, hectares: 2 },
      geometry: row.geometry === undefined ? square(-65, 44) : row.geometry,
    }));
    return new Response(JSON.stringify({ type: "FeatureCollection", features }), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

test("a numeric column is normalised to the zone the regulation names", () => {
  // The column is numeric, so the portal renders "101.0"; the regulation's zone is 101.
  assert.equal(normaliseNovaScotiaDeerZone("101.0"), "101");
  assert.equal(normaliseNovaScotiaDeerZone(112), "112");
  assert.equal(normaliseNovaScotiaDeerZone("112"), "112");
  // Nothing outside the twelve zones the province defines becomes a zone.
  assert.equal(normaliseNovaScotiaDeerZone("100.0"), null);
  assert.equal(normaliseNovaScotiaDeerZone("113"), null);
  assert.equal(normaliseNovaScotiaDeerZone("101.5"), null);
  assert.equal(normaliseNovaScotiaDeerZone(""), null);
  assert.equal(normaliseNovaScotiaDeerZone(null), null);
});

test("rows are parts, not zones: they group into the twelve the province publishes", async () => {
  const rows = Object.entries(NOVA_SCOTIA_DEER_CONFIG.multipartUnits)
    .flatMap(([zone, parts]) => Array.from({ length: parts }, (_unused, index) => ({
      deer_zone: `${zone}.0`,
      geometry: square(-65 + index * 0.2, 44 + Number(zone) * 0.01),
    })));
  assert.equal(rows.length, 234, "the authority serves 234 rows");

  const source = createNovaScotiaDeerSource(authority(rows));
  const read = await source.fetchFeatures();
  assert.equal(read.features.length, 12, "twelve zones, not 234");
  assert.deepEqual(read.features.map((feature) => feature.officialIdentifier).sort((a, b) => Number(a) - Number(b)),
    ["101", "102", "103", "104", "105", "106", "107", "108", "109", "110", "111", "112"]);
  // Zone 106 is published as 59 parts and must arrive as one MultiPolygon of 59.
  const busiest = read.features.find((feature) => feature.officialIdentifier === "106")!;
  assert.equal(busiest.geometry.type, "MultiPolygon");
  assert.equal((busiest.geometry.coordinates as unknown[]).length, 59);
  assert.equal(source.canonicalZoneId("101"), "management_zone:ca-ns-dmz-101", "not ...-101-0");
});

test("a zone quietly gaining a part fails the ingest rather than being published", async () => {
  /*
   * Parts per zone is the authority's geography, not a detail. A zone that
   * gains or loses one has been redrawn, and that is a thing a person looks at.
   */
  const rows = Object.entries(NOVA_SCOTIA_DEER_CONFIG.multipartUnits)
    .flatMap(([zone, parts]) => Array.from({ length: zone === "104" ? parts + 1 : parts }, (_unused, index) => ({
      deer_zone: `${zone}.0`,
      geometry: square(-65 + index * 0.2, 44 + Number(zone) * 0.01),
    })));
  const source = createNovaScotiaDeerSource(authority(rows));
  await assert.rejects(() => source.fetchFeatures(), /served 235 rows; 234 were reviewed/);
});

test("a row naming no zone is quarantined, never dropped and never invented into one", async () => {
  const config = { ...NOVA_SCOTIA_DEER_CONFIG, expectedRecords: 3, expectedUnits: 1, multipartUnits: { "101": 2 } };
  const source = createSocrataZoneSource(config, authority([
    { deer_zone: "101.0" }, { deer_zone: "101.0" }, { deer_zone: null },
  ]));
  const read = await source.fetchFeatures();
  assert.equal(read.features.length, 1);
  assert.equal(read.quarantined?.length, 1, "the row is recorded, not silently discarded");
  assert.match(read.quarantined![0].reason, /names no zone/);
});
