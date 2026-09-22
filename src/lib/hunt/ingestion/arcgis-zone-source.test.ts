import assert from "node:assert/strict";
import test from "node:test";
import { createArcgisZoneSource, type ArcgisZoneSourceConfig } from "./arcgis-zone-source.ts";

const square = (x: number, y: number) => ({
  type: "Polygon",
  coordinates: [[[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1], [x, y]]],
});

type Row = { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } | null };

function serviceWith(rows: Row[], pageSize = 1000) {
  const calls: URL[] = [];
  const fetcher = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    calls.push(url);
    const offset = Number(url.searchParams.get("resultOffset") ?? 0);
    const count = Number(url.searchParams.get("resultRecordCount") ?? pageSize);
    if (url.searchParams.get("geometryType") === "esriGeometryPoint") {
      return Response.json({ type: "FeatureCollection", features: rows.slice(0, 2).map(({ properties }) => ({ properties, geometry: null })) });
    }
    const slice = rows.slice(offset, offset + count);
    return Response.json({ type: "FeatureCollection", features: slice, properties: { exceededTransferLimit: offset + count < rows.length } });
  }) as typeof fetch;
  return { fetcher, calls };
}

const base: ArcgisZoneSourceConfig = {
  layerId: "layer:us-xx-gmu",
  jurisdictionCanonicalId: "jurisdiction:us-xx",
  jurisdictionKey: "us-xx",
  officialTerm: "Game Management Unit",
  officialTermShort: "GMU",
  zoneType: "GMU",
  authority: "Test Wildlife Agency",
  sourceCanonicalId: "source:us-xx-gmu-service",
  layerUrl: "https://gis.example.gov/arcgis/rest/services/GMU/FeatureServer/0",
  idField: "GMU",
  zoneIdPrefix: "management_zone:us-xx-gmu-",
  officialNamePrefix: "Game Management Unit ",
  expectedRecords: 4,
  expectedUnits: 2,
  multipartUnits: { "2A": 2 },
  quarantine: [{ reason: "A reservation, not a state unit", match: { field: "OBJECTID", value: 4 } }],
  sourceVersion: "test-2026",
  legalStanding: { kind: "DERIVED_FROM_LEGAL_DESCRIPTION", statedAs: "The written descriptions control." },
  pageSize: 3,
};

const rows: Row[] = [
  { properties: { OBJECTID: 1, GMU: " 1 " }, geometry: square(0, 0) },
  { properties: { OBJECTID: 2, GMU: "2A" }, geometry: square(1, 0) },
  { properties: { OBJECTID: 3, GMU: "2A" }, geometry: square(1, 1) },
  { properties: { OBJECTID: 4, GMU: null }, geometry: square(3, 3) },
];

test("a state is described, not coded: units are grouped, multipart units merged and the reviewed blank quarantined", async () => {
  const { fetcher, calls } = serviceWith(rows);
  const result = await createArcgisZoneSource(base, fetcher).fetchFeatures();
  assert.deepEqual(result.features.map((feature) => feature.officialIdentifier), ["1", "2A"]);
  const twoA = result.features.find((feature) => feature.officialIdentifier === "2A")!;
  assert.equal(twoA.geometry.type, "MultiPolygon");
  assert.equal((twoA.geometry.coordinates as unknown[]).length, 2);
  assert.equal(result.quarantined?.length, 1);
  assert.equal(result.quarantined?.[0].reason, "A reservation, not a state unit");
  assert.equal(result.sourceVersion, "test-2026");
  // Paged by the configured page size, projected by the authority.
  assert.equal(calls.length, 2);
  assert.equal(calls[0].searchParams.get("outSR"), "4326");
});

test("canonical ids are minted from the designation, lower-cased, in the layer's own prefix", () => {
  const source = createArcgisZoneSource(base, serviceWith(rows).fetcher);
  assert.equal(source.canonicalZoneId("2A"), "management_zone:us-xx-gmu-2a");
  assert.equal(source.officialName("2A"), "Game Management Unit 2A");
});

test("a change in record count, unit count or multipart structure is a boundary event and refuses", async () => {
  await assert.rejects(createArcgisZoneSource({ ...base, expectedRecords: 5 }, serviceWith(rows).fetcher).fetchFeatures(), /returned 4 records; 5 were reviewed/);
  await assert.rejects(createArcgisZoneSource({ ...base, multipartUnits: {} }, serviceWith(rows).fetcher).fetchFeatures(), /several records changed/);
  const extraUnit = [...rows.slice(0, 3), { properties: { OBJECTID: 4, GMU: "9" }, geometry: square(5, 5) }];
  await assert.rejects(createArcgisZoneSource(base, serviceWith(extraUnit).fetcher).fetchFeatures(), /now carries GMU "9"; review it/);
  const quarantineGone = rows.slice(0, 3);
  await assert.rejects(
    createArcgisZoneSource({ ...base, expectedRecords: 3 }, serviceWith(quarantineGone).fetcher).fetchFeatures(),
    /quarantine record\(s\) no longer present/,
  );
});

test("an unidentified record without a designation stops the ingest instead of being dropped or named", async () => {
  const withBlank = [...rows.slice(0, 3), { properties: { OBJECTID: 9, GMU: "" }, geometry: square(3, 3) }];
  await assert.rejects(
    createArcgisZoneSource({ ...base, quarantine: [] }, serviceWith(withBlank).fetcher).fetchFeatures(),
    /no readable GMU .* identify it before ingesting/,
  );
});

test("the official point answer leaves out quarantined records, exactly as the registry does", async () => {
  const pointRows = [{ properties: { OBJECTID: 4, GMU: null }, geometry: null }, { properties: { OBJECTID: 1, GMU: "1" }, geometry: null }];
  const fetcher = (async () => Response.json({ type: "FeatureCollection", features: pointRows })) as unknown as typeof fetch;
  assert.deepEqual(await createArcgisZoneSource(base, fetcher).officialIdentifiersAt!(0.5, 0.5), ["1"]);
});
