import assert from "node:assert/strict";
import test from "node:test";

import {
  ALBERTA_ELK_ISLAND_RECORD,
  ALBERTA_MULTIPART_UNITS,
  createAlbertaWmuSource,
  normalizeAlbertaWmuCode,
} from "./alberta-wmu.ts";

/**
 * A synthetic source with the live service's exact shape: 199 records, of which
 * 186 are single-record units, three units span 6 + 3 + 3 records, and one blank
 * record is Elk Island National Park.
 */
type Row = { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } | null };

const square = (x: number) => [[[x, 50], [x + 0.1, 50], [x + 0.1, 50.1], [x, 50.1], [x, 50]]];

function sourceRows(): Row[] {
  const rows: Row[] = [];
  let objectId = 0;
  const add = (code: string, name: string, area = 10) => {
    objectId += 1;
    rows.push({
      properties: {
        OBJECTID: objectId, GlobalID: `{${objectId}}`, WMUNIT_CODE: code, WMUNIT_NAME: name,
        Shape__Area: area, Shape__Length: 5,
      },
      geometry: { type: "Polygon", coordinates: square(objectId) },
    });
  };
  for (let unit = 100; rows.length < 186; unit += 1) {
    if (String(unit) in ALBERTA_MULTIPART_UNITS) continue;
    add(String(unit).padStart(5, "0"), `Unit ${unit}`);
  }
  for (const [unit, parts] of Object.entries(ALBERTA_MULTIPART_UNITS)) {
    for (let part = 0; part < parts; part += 1) add(unit.padStart(5, "0"), `Multipart ${unit}`, part + 1);
  }
  rows.push({
    properties: {
      OBJECTID: 72, GlobalID: ALBERTA_ELK_ISLAND_RECORD.globalId, WMUNIT_CODE: " ", WMUNIT_NAME: " ",
      Shape__Area: 193_150_607.26, Shape__Length: 67_811.49,
    },
    geometry: { type: "Polygon", coordinates: square(500) },
  });
  return rows;
}

function fetcherFor(features: unknown[]) {
  return (async () => ({
    ok: true,
    status: 200,
    json: async () => ({ type: "FeatureCollection", features }),
  })) as unknown as typeof fetch;
}

test("normalises Alberta's padded service codes to official three-digit WMU identifiers", () => {
  assert.equal(normalizeAlbertaWmuCode("00102"), "102");
  assert.equal(normalizeAlbertaWmuCode("00936"), "936");
  assert.equal(normalizeAlbertaWmuCode(" "), null);
  assert.equal(normalizeAlbertaWmuCode("102"), null);
  assert.equal(normalizeAlbertaWmuCode("01000"), null);
});

test("199 source records normalise to 189 named WMUs, not 199", async () => {
  const rows = sourceRows();
  assert.equal(rows.length, 199);
  const { features, quarantined } = await createAlbertaWmuSource(fetcherFor(rows)).fetchFeatures();
  assert.equal(features.length, 189);
  assert.equal(new Set(features.map(({ officialIdentifier }) => officialIdentifier)).size, 189);
  assert.deepEqual(quarantined?.map(({ sourceFeatureId }) => sourceFeatureId), [`GlobalID:${ALBERTA_ELK_ISLAND_RECORD.globalId}`]);
  assert.match(quarantined?.[0]?.reason ?? "", /Elk Island National Park/);
  // Enough for a reviewer to find it on a map without re-querying the authority.
  assert.deepEqual(quarantined?.[0]?.bbox, [500, 50, 500.1, 50.1]);
  assert.equal(quarantined?.[0]?.vertices, 5);
  assert.equal(quarantined?.[0]?.attributes.OBJECTID, 72);
});

test("multipart records become one canonical unit each, with every component kept", async () => {
  const { features } = await createAlbertaWmuSource(fetcherFor(sourceRows())).fetchFeatures();
  for (const [unit, parts] of Object.entries(ALBERTA_MULTIPART_UNITS)) {
    const feature = features.find(({ officialIdentifier }) => officialIdentifier === unit);
    assert.ok(feature, unit);
    assert.equal(feature.geometry.type, "MultiPolygon");
    assert.equal((feature.geometry.coordinates as unknown[]).length, parts);
    assert.equal(feature.attributes.componentCount, parts);
    assert.equal((feature.attributes.componentGlobalIds as string[]).length, parts);
    assert.equal(feature.attributes.sourceAreaSquareMetres, (parts * (parts + 1)) / 2);
  }
});

test("canonical identity and provenance carry the authority's own terms and legal standing", async () => {
  const source = createAlbertaWmuSource(fetcherFor(sourceRows()));
  assert.equal(source.canonicalZoneId("102"), "management_zone:ca-ab-wmu-102");
  assert.equal(source.officialName("102"), "Wildlife Management Unit 102");
  assert.equal(source.jurisdictionCanonicalId, "jurisdiction:ca-ab");
  const { features } = await source.fetchFeatures();
  for (const feature of features) {
    assert.match(source.canonicalZoneId(feature.officialIdentifier), /^management_zone:[a-z0-9][a-z0-9-]*$/);
    assert.equal(feature.attributes.legalStanding, "OFFICIAL_BUT_INDICATIVE");
    assert.match(String(feature.attributes.locationAccuracy), /AR 143\/97/);
  }
});

test("refuses source-count drift instead of silently publishing partial geometry", async () => {
  const source = createAlbertaWmuSource(fetcherFor(sourceRows().slice(1)));
  await assert.rejects(source.fetchFeatures(), /returned 198 records; expected 199/);
});

test("refuses a blank record it has not identified", async () => {
  const rows = sourceRows();
  const elk = rows.at(-1)!;
  elk.properties = { ...elk.properties, GlobalID: "{SOMETHING-NEW}" };
  await assert.rejects(createAlbertaWmuSource(fetcherFor(rows)).fetchFeatures(), /unrecognised blank record/);
});

test("refuses the known blank record once its area moves", async () => {
  const rows = sourceRows();
  const elk = rows.at(-1)!;
  elk.properties = { ...elk.properties, Shape__Area: 250_000_000 };
  await assert.rejects(createAlbertaWmuSource(fetcherFor(rows)).fetchFeatures(), /unrecognised blank record/);
});

test("refuses a change to which units are multipart", async () => {
  const rows = sourceRows();
  // One component of 728 is reassigned to 794: counts hold, structure does not.
  const index = rows.findIndex(({ properties }) => properties.WMUNIT_CODE === "00728");
  rows[index] = { ...rows[index], properties: { ...rows[index].properties, WMUNIT_CODE: "00794", WMUNIT_NAME: "Multipart 794" } };
  await assert.rejects(createAlbertaWmuSource(fetcherFor(rows)).fetchFeatures(), /normalised to 188|multipart structure changed/);
});

test("refuses conflicting names for one WMU", async () => {
  const rows = sourceRows();
  const index = rows.findIndex(({ properties }) => properties.WMUNIT_CODE === "00718");
  rows[index] = { ...rows[index], properties: { ...rows[index].properties, WMUNIT_NAME: "Different name" } };
  await assert.rejects(createAlbertaWmuSource(fetcherFor(rows)).fetchFeatures(), /conflicting names/);
});

test("refuses a named record whose code is unreadable", async () => {
  const rows = sourceRows();
  rows[0] = { ...rows[0], properties: { ...rows[0].properties, WMUNIT_CODE: "ABC" } };
  await assert.rejects(createAlbertaWmuSource(fetcherFor(rows)).fetchFeatures(), /unreadable code/);
});

test("refuses an authority error and a failed response", async () => {
  const errored = (async () => ({ ok: true, status: 200, json: async () => ({ error: { message: "boom" } }) })) as unknown as typeof fetch;
  await assert.rejects(createAlbertaWmuSource(errored).fetchFeatures(), /service error: boom/);
  const failed = (async () => ({ ok: false, status: 503, json: async () => ({}) })) as unknown as typeof fetch;
  await assert.rejects(createAlbertaWmuSource(failed).fetchFeatures(), /returned 503/);
});
