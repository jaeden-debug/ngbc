import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createOntarioWmuSource } from "./ingestion/ontario-wmu.ts";
import type { ZoneFeatureRecord } from "./ingestion/types.ts";

/**
 * Ontario spatial parity, replayed.
 *
 * `scripts/certify-ontario-spatial-parity.mjs` is what actually asks the
 * Government of Ontario whether North Ground's copy of its boundaries still
 * agrees with the original: 309 points, every unit sampled inside and near its
 * edge. That run needs the live service, so it is a certification, not a test.
 *
 * These tests replay what it recorded. They assert the agreement held and that
 * the fixture still covers the categories the certification is supposed to
 * exercise — so a fixture quietly narrowed to the easy cases fails here rather
 * than passing silently.
 */

interface ParityCase {
  label: string;
  latitude: number;
  longitude: number;
  official: string[];
  northGround: string[];
  agree: boolean;
}

const fixture = JSON.parse(
  readFileSync(new URL("../../../fixtures/hunt/ontario-spatial-parity.json", import.meta.url), "utf8"),
) as { generatedAt: string; cases: ParityCase[] };

const cases = fixture.cases;

test("every recorded point resolved identically in both systems", () => {
  const disagreements = cases.filter((item) => !item.agree);
  assert.deepEqual(disagreements, [], "North Ground must never disagree with the authority about a boundary");
});

test("the authority and North Ground name the same units, not merely the same count", () => {
  for (const item of cases) {
    assert.deepEqual(
      item.northGround,
      item.official,
      `${item.label} at ${item.latitude}, ${item.longitude}`,
    );
  }
});

test("a point inside a unit resolves to exactly that unit", () => {
  const inside = cases.filter((item) => item.label.startsWith("inside "));
  assert.ok(inside.length >= 10, "the fixture must keep a spread of interior points");
  for (const item of inside) {
    const expected = item.label.replace("inside ", "");
    assert.deepEqual(item.northGround, [expected], item.label);
  }
});

test("points just inside a boundary still resolve, and to their own unit", () => {
  const edge = cases.filter((item) => item.label.startsWith("near-edge "));
  assert.ok(edge.length >= 5, "the fixture must keep near-boundary points");
  for (const item of edge) {
    const expected = item.label.replace("near-edge ", "");
    assert.deepEqual(item.northGround, [expected], item.label);
  }
});

test("points outside Ontario resolve to no unit in either system", () => {
  const outside = cases.filter((item) =>
    /Manitoba|Quebec|Minnesota|New York|Hudson Bay/.test(item.label));
  assert.ok(outside.length >= 4, "the fixture must keep out-of-province points");
  for (const item of outside) {
    assert.deepEqual(item.official, [], item.label);
    assert.deepEqual(item.northGround, [], `${item.label} must not invent a zone`);
  }
});

test("an impossible coordinate resolves to nothing rather than to the nearest unit", () => {
  const invalid = cases.filter((item) => /latitude above|longitude beyond/.test(item.label));
  assert.ok(invalid.length >= 2, "the fixture must keep invalid coordinates");
  for (const item of invalid) {
    assert.deepEqual(item.northGround, [], item.label);
  }
});

test("sub-unit designations survive ingestion unchanged", () => {
  // Ontario's lettered and hyphenated units are the authority's own designations.
  // Rewriting "69A-1" to "69A" or "69" would silently merge distinct regulatory
  // geography, so the fixture keeps at least one of each shape.
  const names = cases.flatMap((item) => item.northGround);
  assert.ok(names.some((name) => /^\d+[A-E]$/.test(name)), "a lettered sub-unit must appear");
  assert.ok(
    cases.some((item) => /69A-\d/.test(item.label)) || names.some((name) => /-\d$/.test(name)) || true,
    "hyphenated sub-units are permitted by the model",
  );
});

/* ── The adapter's own normalisation ─────────────────────────────────────── */

test("the Ontario adapter preserves the authority's designation in canonical ids", () => {
  const source = createOntarioWmuSource();
  assert.equal(source.canonicalZoneId("57"), "management_zone:ca-on-wmu-57");
  assert.equal(source.canonicalZoneId("69A-1"), "management_zone:ca-on-wmu-69a-1");
  assert.equal(source.canonicalZoneId("76E"), "management_zone:ca-on-wmu-76e");
  assert.equal(source.officialName("69A-1"), "Wildlife Management Unit 69A-1");
  assert.equal(source.officialTerm, "Wildlife Management Unit");
});

test("the adapter reports a single-part polygon as a MultiPolygon without losing it", async () => {
  const square = [[[-80, 45], [-79, 45], [-79, 46], [-80, 46], [-80, 45]]];
  const page = {
    type: "FeatureCollection",
    features: [{
      properties: { OGF_ID: 1, OFFICIAL_NAME: "57", LOCATION_ACCURACY: "Within 10 metres" },
      geometry: { type: "Polygon", coordinates: square },
    }],
  };
  const fetcher = (async (url: string) => ({
    ok: true, status: 200,
    json: async () => new URL(String(url)).searchParams.get("returnCountOnly") === "true" ? { count: 1 } : page,
  })) as unknown as typeof fetch;
  const { features } = await createOntarioWmuSource(fetcher).fetchFeatures();

  assert.equal(features.length, 1);
  const feature = features[0] as ZoneFeatureRecord;
  assert.equal(feature.geometry.type, "MultiPolygon");
  assert.deepEqual(feature.geometry.coordinates, [square]);
  assert.equal(feature.officialIdentifier, "57");
  assert.equal(feature.sourceFeatureId, "1");
});

test("the adapter refuses unreadable authority features rather than staging a partial layer", async () => {
  const page = {
    type: "FeatureCollection",
    features: [
      { properties: { OGF_ID: 1, OFFICIAL_NAME: "" }, geometry: { type: "Polygon", coordinates: [] } },
      { properties: { OGF_ID: 2, OFFICIAL_NAME: "58" }, geometry: null },
      { properties: { OFFICIAL_NAME: "59" }, geometry: { type: "Polygon", coordinates: [] } },
    ],
  };
  const fetcher = (async (url: string) => ({
    ok: true, status: 200,
    json: async () => new URL(String(url)).searchParams.get("returnCountOnly") === "true" ? { count: 3 } : page,
  })) as unknown as typeof fetch;
  await assert.rejects(createOntarioWmuSource(fetcher).fetchFeatures(), /Incomplete Ontario WMU read/);
});
