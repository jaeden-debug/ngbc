import assert from "node:assert/strict";
import { test } from "node:test";
import { createQuebecZoneSource, repairPartName } from "./quebec-zone.ts";

/**
 * Deterministic fixtures. These never touch the ministry's service: a unit test
 * that depends on a government endpoint fails for reasons that have nothing to
 * do with the code under test.
 */

function page(features: unknown[], numberMatched: number) {
  return new Response(JSON.stringify({ type: "FeatureCollection", numberMatched, features }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function feature(zone: string, partie: string, noZone: string, ring: number[][]) {
  return {
    type: "Feature",
    properties: { Zone: zone, Partie_zon: partie, No_zone: noZone },
    geometry: { type: "Polygon", coordinates: [ring] },
  };
}

const SQUARE = [[-74, 46], [-73, 46], [-73, 47], [-74, 47], [-74, 46]];
const OTHER = [[-72, 46], [-71, 46], [-71, 47], [-72, 47], [-72, 46]];

test("a designation's many island polygons become one zone, not many", () => {
  // Zone 19SE really is 8,091 separate polygons in the published layer and one
  // regulatory area. Staging it as thousands of zones would be wrong in the
  // registry and unusable in the interface.
  const rows = [
    feature("19SE", "Sud-Est", "19", SQUARE),
    feature("19SE", "Sud-Est", "19", OTHER),
    feature("19N", "Nord", "19", SQUARE),
  ];
  let calls = 0;
  const source = createQuebecZoneSource(async () => { calls += 1; return page(rows, rows.length); });

  return source.fetchFeatures().then(({ features }) => {
    assert.equal(calls, 1);
    assert.deepEqual(features.map((f) => f.officialIdentifier), ["19N", "19SE"]);
    const southEast = features.find((f) => f.officialIdentifier === "19SE");
    assert.equal(southEast?.geometry.type, "MultiPolygon");
    assert.equal((southEast?.geometry.coordinates as unknown[]).length, 2);
    assert.equal(southEast?.attributes.sourcePolygonCount, 2);
  });
});

test("the part is the identifier, because seasons are published per part", () => {
  // Québec publishes different moose seasons for 19N, 19SE, 19SO and 19SNO.
  // Keying on No_zone would merge four seasons into one wrong answer.
  const rows = [feature("05E", "Est", "05", SQUARE), feature("05O", "Ouest", "05", OTHER)];
  const source = createQuebecZoneSource(async () => page(rows, rows.length));

  return source.fetchFeatures().then(({ features }) => {
    assert.equal(features.length, 2);
    assert.deepEqual(features.map((f) => f.officialIdentifier), ["05E", "05O"]);
    assert.equal(features[0].attributes.zoneNumber, "05");
  });
});

test("paging follows numberMatched rather than stopping at the first full page", () => {
  const first = Array.from({ length: 500 }, (_, index) => feature(`Z${index}`, "", "1", SQUARE));
  const second = [feature("LAST", "", "2", OTHER)];
  const pages = [page(first, 501), page(second, 501)];
  let call = 0;
  const source = createQuebecZoneSource(async () => pages[call++]);

  return source.fetchFeatures().then(({ features }) => {
    assert.equal(call, 2);
    assert.ok(features.some((f) => f.officialIdentifier === "LAST"));
    assert.equal(features.length, 501);
  });
});

test("canonical ids and names keep the authority's own designation and language", () => {
  const source = createQuebecZoneSource(async () => page([], 0));
  assert.equal(source.canonicalZoneId("19SNO"), "management_zone:ca-qc-zone-19sno");
  assert.equal(source.canonicalZoneId(" 08NMR "), "management_zone:ca-qc-zone-08nmr");
  // French, because that is the authority's official terminology for these areas.
  assert.equal(source.officialName("05E"), "Zone de chasse 05E");
  assert.equal(source.officialTerm, "zone de chasse");
  assert.equal(source.jurisdictionCanonicalId, "jurisdiction:ca-qc");
});

test("the layer's CP850 mis-encoding is reversed, not guessed at", () => {
  /* Both of these are exactly what the service returns today, byte for byte:
     "Île" as CP850 0xD7 read as Latin-1, "Beaupré" as CP850 0x82 read the same
     way. A phrase-substitution repair got the second one wrong, leaving the
     stray byte behind the accent it added. */
  assert.equal(repairPartName("Ouest (\u00d7le)"), "Ouest (Île)");
  assert.equal(repairPartName("Est (\u00d7le)"), "Est (Île)");
  assert.equal(repairPartName("Est (Seigneurie de Beaupr\u0082)"), "Est (Seigneurie de Beaupré)");
  assert.equal(repairPartName("Ouest (Seigneurie de Beaupr\u0082)"), "Ouest (Seigneurie de Beaupré)");
});

test("a part name that arrived correctly is returned untouched", () => {
  /* The repair must not become a second defect once the ministry fixes the
     layer, so a name carrying none of the mis-encoding's bytes is left alone —
     accented or not. */
  for (const name of ["Nord ZSR", "Sud-Nord-Ouest", "Nord (Montagne de Rigaud)", "", "Est (Île)", "Forêt-Noire"]) {
    assert.equal(repairPartName(name), name);
  }
});

test("features without a designation or geometry are dropped rather than guessed at", () => {
  const rows = [
    { type: "Feature", properties: { Zone: "", Partie_zon: "", No_zone: "1" }, geometry: { type: "Polygon", coordinates: [SQUARE] } },
    { type: "Feature", properties: { Zone: "12", Partie_zon: "", No_zone: "12" }, geometry: null },
    feature("12", "", "12", SQUARE),
  ];
  const source = createQuebecZoneSource(async () => page(rows, rows.length));
  return source.fetchFeatures().then(({ features }) => {
    assert.deepEqual(features.map((f) => f.officialIdentifier), ["12"]);
  });
});
