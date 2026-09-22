import assert from "node:assert/strict";
import test from "node:test";
import { clearOverlayCache, lookupOverlays, restrictionsFor, type OverlayCatalogue } from "./overlays.ts";

/**
 * The run-time overlay lookup, for both protocols an authority may serve.
 *
 * Every service is faked. These hold the lookup to three promises: it asks the
 * right service the right question, a feature it cannot identify is still a
 * restriction, and a layer that cannot be asked makes the answer unavailable
 * rather than empty.
 */

const WFS_CATALOGUE: OverlayCatalogue = {
  jurisdictionId: "jurisdiction:ca-qc",
  layers: [{
    key: "chasse-interdite",
    url: "https://example.qc.ca/geoserver/SmartFaunePub/ows",
    protocol: "WFS",
    typeName: "SmartFaunePub:Chasse_Interdite",
    sourceId: "source:ca-qc-chasse-interdite-service",
    features: [{
      objectId: 80,
      name: "Parc national de Plaisance",
      statedAs: "« Territoires où toute activité de chasse est interdite. » (Parc national).",
      tokens: ["all"],
      unclassified: [],
      specialIds: [],
    }],
  }],
};

const ARCGIS_CATALOGUE: OverlayCatalogue = {
  jurisdictionId: "jurisdiction:ca-mb",
  layers: [{
    key: "closed",
    url: "https://example.ca/arcgis/rest/services/Lands_Closed_to_Hunting/FeatureServer/0",
    sourceId: "source:ca-mb-lands-closed-to-hunting-service",
    features: [{ objectId: 7, name: "Closed land", statedAs: "Closed to hunting.", tokens: ["all"], unclassified: [], specialIds: [] }],
  }],
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("a WFS layer is asked about the point in EWKT, for ids only, never for outlines", async () => {
  clearOverlayCache();
  const asked: URL[] = [];
  const fetcher = (async (input: string | URL) => {
    asked.push(new URL(String(input)));
    return json({ type: "FeatureCollection", features: [{ id: "Chasse_Interdite.80", properties: { NOM: "Plaisance" } }] });
  }) as typeof fetch;

  const lookup = await lookupOverlays(WFS_CATALOGUE, 45.6015, -75.126, fetcher);

  assert.equal(asked.length, 1);
  const query = asked[0].searchParams;
  assert.equal(query.get("request"), "GetFeature");
  assert.equal(query.get("typeNames"), "SmartFaunePub:Chasse_Interdite");
  // Without SRID=4326 GeoServer reads the numbers in its native projection and matches nothing.
  assert.equal(query.get("CQL_FILTER"), "INTERSECTS(the_geom,SRID=4326;POINT(-75.126 45.6015))");
  // The geometry column is never requested: a park's outline would not fit the time budget.
  assert.notEqual(query.get("propertyName"), "the_geom");
  assert.equal(lookup.available, true);
  assert.deepEqual(lookup.hits.map((hit) => [hit.objectId, hit.feature?.name]), [[80, "Parc national de Plaisance"]]);
  assert.deepEqual(restrictionsFor(lookup, ["all"]), [{
    name: "Parc national de Plaisance",
    statedAs: "« Territoires où toute activité de chasse est interdite. » (Parc national).",
    sourceId: "source:ca-qc-chasse-interdite-service",
  }]);
});

test("a WFS feature the catalogue does not hold, or whose id cannot be read, is still a restriction", async () => {
  clearOverlayCache();
  const fetcher = (async () => json({
    type: "FeatureCollection",
    features: [{ id: "Chasse_Interdite.131" }, { id: "unreadable" }],
  })) as typeof fetch;

  const lookup = await lookupOverlays(WFS_CATALOGUE, 46, -72, fetcher);
  const restrictions = restrictionsFor(lookup, ["all"]);

  assert.equal(lookup.available, true);
  assert.deepEqual(lookup.hits.map((hit) => [hit.objectId, hit.feature]), [[131, null], [-1, null]]);
  assert.equal(restrictions.length, 2);
  for (const restriction of restrictions) assert.match(restriction.statedAs, /does not include/);
});

test("a WFS layer that fails or answers garbage makes the lookup unavailable, not empty", async () => {
  for (const fetcher of [
    (async () => json({ error: "down" }, 503)) as typeof fetch,
    (async () => json({ exceptions: ["bad filter"] })) as typeof fetch,
    (async () => { throw new Error("offline"); }) as typeof fetch,
  ]) {
    clearOverlayCache();
    const lookup = await lookupOverlays(WFS_CATALOGUE, 46, -72, fetcher);
    assert.equal(lookup.available, false);
    assert.equal(lookup.specialIds, null);
    assert.deepEqual(lookup.hits, []);
  }
});

test("an ArcGIS layer is still asked for OBJECTIDs, exactly as before", async () => {
  clearOverlayCache();
  const asked: URL[] = [];
  const fetcher = (async (input: string | URL) => {
    asked.push(new URL(String(input)));
    return json({ features: [{ attributes: { OBJECTID: 7 } }] });
  }) as typeof fetch;

  const lookup = await lookupOverlays(ARCGIS_CATALOGUE, 49.9, -97.1, fetcher);

  assert.equal(asked[0].pathname.endsWith("/FeatureServer/0/query"), true);
  assert.equal(asked[0].searchParams.get("geometryType"), "esriGeometryPoint");
  assert.equal(asked[0].searchParams.get("returnGeometry"), "false");
  assert.deepEqual(lookup.hits.map((hit) => hit.feature?.name), ["Closed land"]);
});

/* ── Stored copies ───────────────────────────────────────────────────────── */

const STORED_CATALOGUE: OverlayCatalogue = {
  ...ARCGIS_CATALOGUE,
  layers: [{ ...ARCGIS_CATALOGUE.layers[0], storedLayerId: "special_layer:ca-mb-closed", contentHash: "sha256:reviewed" }],
};

type Row = { layer_id: string; catalogue_hash: string | null; servable: boolean; source_record_id: string | null };

function storedClient(rows: Row[] | Error) {
  const calls: unknown[] = [];
  const client = () => ({
    rpc: (name: string, args: unknown) => {
      calls.push({ name, args });
      return { abortSignal: async () => rows instanceof Error ? { data: null, error: rows } : { data: rows, error: null } };
    },
  });
  return { client: client as never, calls };
}

const liveFetcher = (ids: number[], asked: string[]) => (async (input: string | URL) => {
  asked.push(String(input));
  return json({ features: ids.map((id) => ({ attributes: { OBJECTID: id } })) });
}) as typeof fetch;

test("a current stored copy loaded against this catalogue answers without asking the authority", async () => {
  clearOverlayCache();
  const asked: string[] = [];
  const { client, calls } = storedClient([
    { layer_id: "special_layer:ca-mb-closed", catalogue_hash: "sha256:reviewed", servable: true, source_record_id: "7" },
    { layer_id: "special_layer:ca-mb-closed", catalogue_hash: "sha256:reviewed", servable: true, source_record_id: null },
  ]);
  const lookup = await lookupOverlays(STORED_CATALOGUE, 49.5, -97.1, liveFetcher([], asked), client);
  assert.equal(calls.length, 1);
  assert.equal(asked.length, 0);
  assert.deepEqual(lookup.hits.map((hit) => [hit.objectId, hit.feature?.name]), [[7, "Closed land"]]);
});

test("a stored copy that is not current, or was loaded against another catalogue, is never read", async () => {
  for (const marker of [
    { layer_id: "special_layer:ca-mb-closed", catalogue_hash: "sha256:reviewed", servable: false, source_record_id: null },
    { layer_id: "special_layer:ca-mb-closed", catalogue_hash: "sha256:older", servable: true, source_record_id: null },
  ]) {
    clearOverlayCache();
    const asked: string[] = [];
    // The store claims nothing is here; the authority says feature 7 is.
    const { client } = storedClient([marker]);
    const lookup = await lookupOverlays(STORED_CATALOGUE, 49.5, -97.1, liveFetcher([7], asked), client);
    assert.equal(asked.length, 1, JSON.stringify(marker));
    assert.deepEqual(lookup.hits.map((hit) => hit.objectId), [7]);
  }
});

test("a failed store query asks the authority, and a failed authority still makes the answer unavailable", async () => {
  clearOverlayCache();
  const asked: string[] = [];
  const { client } = storedClient(new Error("database down"));
  const lookup = await lookupOverlays(STORED_CATALOGUE, 49.5, -97.1, liveFetcher([7], asked), client);
  assert.equal(asked.length, 1);
  assert.deepEqual(lookup.hits.map((hit) => hit.objectId), [7]);

  clearOverlayCache();
  const down = (async () => { throw new Error("authority down"); }) as typeof fetch;
  const unavailable = await lookupOverlays(STORED_CATALOGUE, 49.5, -97.1, down, storedClient(new Error("database down")).client);
  assert.equal(unavailable.available, false);
});
