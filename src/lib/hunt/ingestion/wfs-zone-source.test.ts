import assert from "node:assert/strict";
import { test } from "node:test";
import { BRITISH_COLUMBIA_MU_CONFIG, normaliseBritishColumbiaMu } from "./british-columbia-mu.ts";
import { createWfsZoneSource, wfsCanonicalZoneId, type WfsZoneSourceConfig } from "./wfs-zone-source.ts";

type Row = { OBJECTID: number; UNIT: string | null; polygon?: boolean };

const square = (x: number) => [[[x, 50], [x + 1, 50], [x + 1, 51], [x, 51], [x, 50]]];

/** A GeoServer-shaped WFS over fixed rows, recording every request it was asked. */
function fakeWfs(rows: Row[], options: { hits?: number; repeatFirst?: boolean; xmlHits?: boolean } = {}) {
  const requests: URL[] = [];
  const fetcher = (async (input: string | URL) => {
    const url = new URL(String(input));
    requests.push(url);
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    if (url.searchParams.get("resultType") === "hits" && options.xmlHits) {
      return new Response(`<?xml version="1.0" encoding="UTF-8"?><wfs:FeatureCollection numberMatched="${options.hits ?? rows.length}" numberReturned="0"/>`, { status: 200, headers: { "content-type": "application/xml" } });
    }
    if (url.searchParams.get("resultType") === "hits") return json({ type: "FeatureCollection", numberMatched: options.hits ?? rows.length, features: [] });
    if (url.searchParams.get("CQL_FILTER")) return json({ type: "FeatureCollection", features: [{ properties: { UNIT: "7-15" } }, { properties: { UNIT: "7-15" } }] });
    const start = Number(url.searchParams.get("startIndex"));
    const size = Number(url.searchParams.get("count"));
    const page = rows.slice(start, start + size);
    if (options.repeatFirst && start > 0) page[0] = rows[0];
    return json({
      type: "FeatureCollection",
      features: page.map((row) => ({
        id: `t.${row.OBJECTID}`,
        properties: { OBJECTID: row.OBJECTID, UNIT: row.UNIT },
        geometry: row.polygon === false ? null : { type: "Polygon", coordinates: square(row.OBJECTID) },
      })),
    });
  }) as unknown as typeof fetch;
  return { fetcher, requests };
}

const config = (overrides: Partial<WfsZoneSourceConfig> = {}): WfsZoneSourceConfig => ({
  layerId: "layer:test",
  jurisdictionCanonicalId: "jurisdiction:ca-bc",
  officialTerm: "Management Unit",
  officialTermShort: "MU",
  zoneType: "WMU",
  authority: "Test authority",
  sourceCanonicalId: "source:test",
  serviceUrl: "https://example.test/ows",
  typeName: "pub:TEST",
  geometryField: "GEOMETRY",
  sortField: "OBJECTID",
  idField: "UNIT",
  normalise: normaliseBritishColumbiaMu,
  zoneIdPrefix: "management_zone:ca-bc-mu-",
  officialNamePrefix: "Management Unit",
  expectedRecords: 3,
  expectedUnits: 3,
  multipartUnits: {},
  quarantine: [],
  sourceVersion: "test",
  legalStanding: { kind: "DERIVED_FROM_LEGAL_DESCRIPTION", statedAs: "test" },
  pageSize: 2,
  ...overrides,
});

const THREE: Row[] = [{ OBJECTID: 1, UNIT: "1-1" }, { OBJECTID: 2, UNIT: "7-15" }, { OBJECTID: 3, UNIT: "7-1" }];

test("a complete read stages every unit once, in the authority's own designations", async () => {
  const { fetcher, requests } = fakeWfs(THREE);
  const { features, quarantined, sourceVersion } = await createWfsZoneSource(config(), fetcher).fetchFeatures();
  assert.deepEqual(features.map((feature) => feature.officialIdentifier), ["1-1", "7-1", "7-15"]);
  assert.equal(quarantined?.length, 0);
  assert.equal(sourceVersion, "test");
  // Paged in the authority's stable order, projected by the authority.
  const pages = requests.filter((url) => url.searchParams.has("startIndex"));
  assert.deepEqual(pages.map((url) => url.searchParams.get("startIndex")), ["0", "2"]);
  assert.ok(pages.every((url) => url.searchParams.get("sortBy") === "OBJECTID" && url.searchParams.get("srsName") === "EPSG:4326"));
  assert.deepEqual(features[0].attributes.legalStanding, { kind: "DERIVED_FROM_LEGAL_DESCRIPTION", statedAs: "test" });
});

test("GeoServer's XML hit count is read like a JSON one", async () => {
  const { features } = await createWfsZoneSource(config(), fakeWfs(THREE, { xmlHits: true }).fetcher).fetchFeatures();
  assert.equal(features.length, 3);
  await assert.rejects(createWfsZoneSource(config(), fakeWfs(THREE, { xmlHits: true, hits: 5 }).fetcher).fetchFeatures(), /publishes 5 records/);
});

test("a changed record count is a boundary event, not something to stage", async () => {
  const { fetcher } = fakeWfs(THREE, { hits: 4 });
  await assert.rejects(createWfsZoneSource(config(), fetcher).fetchFeatures(), /publishes 4 records, reviewed as 3/);
});

test("a record with no designation is refused unless a reviewed rule quarantines it", async () => {
  const rows: Row[] = [...THREE.slice(0, 2), { OBJECTID: 3, UNIT: null }];
  await assert.rejects(createWfsZoneSource(config(), fakeWfs(rows).fetcher).fetchFeatures(), /has no UNIT and no reviewed reason/);

  const reviewed = config({ expectedUnits: 2, quarantine: [{ reason: "A national park, not a unit.", match: { field: "OBJECTID", value: 3 } }] });
  const { features, quarantined } = await createWfsZoneSource(reviewed, fakeWfs(rows).fetcher).fetchFeatures();
  assert.equal(features.length, 2);
  assert.deepEqual(quarantined?.map((record) => [record.sourceFeatureId, record.reason]), [["3", "A national park, not a unit."]]);
});

test("a reviewed quarantine record that disappears is reported, not assumed", async () => {
  const reviewed = config({ quarantine: [{ reason: "gone", match: { field: "OBJECTID", value: 99 } }] });
  await assert.rejects(createWfsZoneSource(reviewed, fakeWfs(THREE).fetcher).fetchFeatures(), /no longer published: OBJECTID=99/);
});

test("unstable paging that repeats a record is refused rather than trusted", async () => {
  await assert.rejects(createWfsZoneSource(config(), fakeWfs(THREE, { repeatFirst: true }).fetcher).fetchFeatures(), /arrived twice/);
});

test("a unit published in more records than reviewed is refused", async () => {
  const rows: Row[] = [{ OBJECTID: 1, UNIT: "1-1" }, { OBJECTID: 2, UNIT: "1-1" }, { OBJECTID: 3, UNIT: "7-1" }];
  await assert.rejects(createWfsZoneSource(config({ expectedUnits: 2 }), fakeWfs(rows).fetcher).fetchFeatures(), /1-1 arrives in 2 records, reviewed as 1/);
  const reviewed = config({ expectedUnits: 2, multipartUnits: { "1-1": 2 } });
  const { features } = await createWfsZoneSource(reviewed, fakeWfs(rows).fetcher).fetchFeatures();
  assert.equal((features[0].geometry.coordinates as unknown[]).length, 2, "both parts kept in one unit");
});

test("two designations that would mint one canonical id refuse the read", async () => {
  const rows: Row[] = [{ OBJECTID: 1, UNIT: "A B" }, { OBJECTID: 2, UNIT: "A-B" }, { OBJECTID: 3, UNIT: "C" }];
  const source = createWfsZoneSource(config({ normalise: (raw) => (typeof raw === "string" ? raw : null) }), fakeWfs(rows).fetcher);
  await assert.rejects(source.fetchFeatures(), /would both be management_zone:ca-bc-mu-a-b/);
});

test("the authority is asked about a point in EPSG:4326, longitude first", async () => {
  const { fetcher, requests } = fakeWfs(THREE);
  assert.deepEqual(await createWfsZoneSource(config(), fetcher).officialIdentifiersAt!(53.917, -122.749), ["7-15"]);
  assert.equal(requests[0].searchParams.get("CQL_FILTER"), "INTERSECTS(GEOMETRY,SRID=4326;POINT(-122.749 53.917))");
  assert.deepEqual(await createWfsZoneSource(config(), fetcher).officialIdentifiersAt!(91, 0), []);
});

test("British Columbia designations keep their hyphen and read as the regulation reads them", () => {
  assert.equal(normaliseBritishColumbiaMu("7-15"), "7-15");
  assert.equal(normaliseBritishColumbiaMu(" 3-12 "), "3-12");
  // B.C. Reg. 64/96 s. 3: "-01" is read as "-1".
  assert.equal(normaliseBritishColumbiaMu("4-01"), "4-1");
  for (const raw of ["9-1", "7-0", "7-", "715", "", null, 7]) assert.equal(normaliseBritishColumbiaMu(raw), null, String(raw));
  assert.equal(wfsCanonicalZoneId(BRITISH_COLUMBIA_MU_CONFIG.zoneIdPrefix, "7-15"), "management_zone:ca-bc-mu-7-15");
  // "7-15" and "71-5" cannot collide: the hyphen is kept, not normalised away.
  assert.notEqual(wfsCanonicalZoneId("p-", "7-15"), wfsCanonicalZoneId("p-", "71-5"));
});

test("British Columbia is reviewed as 225 records, 225 units and nothing quarantined", () => {
  assert.equal(BRITISH_COLUMBIA_MU_CONFIG.expectedRecords, 225);
  assert.equal(BRITISH_COLUMBIA_MU_CONFIG.expectedUnits, 225);
  assert.deepEqual(BRITISH_COLUMBIA_MU_CONFIG.multipartUnits, {});
  assert.deepEqual(BRITISH_COLUMBIA_MU_CONFIG.quarantine, []);
  assert.match(BRITISH_COLUMBIA_MU_CONFIG.legalStanding.statedAs, /B\.C\. Reg\. 64\/96/);
});
