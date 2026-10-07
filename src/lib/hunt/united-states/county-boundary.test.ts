import assert from "node:assert/strict";
import test from "node:test";
import {
  clearCountyLineProximityCache, clearUnitedStatesCountyCache, COUNTY_LINE_MARGIN_METRES,
  unitedStatesCountyAt, unitedStatesCountyLineProximity, unitedStatesCountySource,
  US_COUNTY_BOUNDARY_ENDPOINT,
} from "./county-boundary.ts";

/**
 * The county resolver, against fixtures rather than the Census Bureau (§59).
 *
 * Every payload below is the shape TIGERweb actually returned on 2026-10-07 for
 * the point named, including the two failures that cost real time: the counties
 * layer has no STUSAB field, so asking for one returns HTTP 400 that reads like
 * an empty county, and an ArcGIS error can arrive with HTTP 200 and no features
 * at all, which is indistinguishable from a point outside the country unless
 * `error` is checked.
 */

type Stub = { calls: string[]; fetcher: typeof fetch };

function stub(responses: Array<{ status?: number; body: unknown }>): Stub {
  const calls: string[] = [];
  let index = 0;
  const fetcher = (async (url: Parameters<typeof fetch>[0]) => {
    calls.push(String(url));
    const next = responses[Math.min(index++, responses.length - 1)];
    return {
      ok: (next.status ?? 200) < 400,
      status: next.status ?? 200,
      json: async () => next.body,
    } as Response;
  }) as unknown as typeof fetch;
  return { calls, fetcher };
}

const feature = (name: string, baseName: string, geoid: string, state: string) =>
  ({ features: [{ attributes: { NAME: name, BASENAME: baseName, GEOID: geoid, STATE: state } }] });

test.beforeEach(() => { clearUnitedStatesCountyCache(); clearCountyLineProximityCache(); });

test("a county equivalent answers as itself, and an independent city is not its neighbouring county", async () => {
  /* Virginia's legal unit is a LOCALITY — a county OR an independent city —
     so these two must never collapse into one answer. */
  const richmond = stub([{ body: feature("Richmond city", "Richmond", "51760", "51") }]);
  assert.deepEqual(await unitedStatesCountyAt(37.5407, -77.4360, richmond.fetcher), {
    geoid: "51760", name: "Richmond city", baseName: "Richmond", stateFips: "51",
  });

  clearUnitedStatesCountyCache();
  const henrico = stub([{ body: feature("Henrico County", "Henrico", "51087", "51") }]);
  const resolved = await unitedStatesCountyAt(37.55, -77.35, henrico.fetcher);
  assert.equal(resolved?.geoid, "51087");
  assert.equal(resolved?.baseName, "Henrico");
});

test("parishes and boroughs are counties here, because that is what their authority legislates in", async () => {
  const parish = stub([{ body: feature("Orleans Parish", "Orleans", "22071", "22") }]);
  assert.equal((await unitedStatesCountyAt(29.9511, -90.0715, parish.fetcher))?.name, "Orleans Parish");
  clearUnitedStatesCountyCache();
  const borough = stub([{ body: feature("Anchorage Municipality", "Anchorage", "02020", "02") }]);
  assert.equal((await unitedStatesCountyAt(61.2181, -149.9003, borough.fetcher))?.geoid, "02020");
});

test("the request names the point and asks for no field the layer does not have", async () => {
  const asked = stub([{ body: feature("Jefferson County", "Jefferson", "01073", "01") }]);
  await unitedStatesCountyAt(33.5186, -86.8104, asked.fetcher);
  const [url] = asked.calls;
  assert.ok(url.startsWith(US_COUNTY_BOUNDARY_ENDPOINT), "the Bureau's own endpoint");
  assert.match(url, /geometry=-86\.8104%2C33\.5186/, "longitude then latitude, as ArcGIS wants");
  assert.match(url, /returnGeometry=false/, "no geometry is downloaded or stored");
  assert.doesNotMatch(url, /STUSAB/, "the counties layer has no STUSAB; asking returns HTTP 400");
  assert.doesNotMatch(url, /where=/, "nothing is filtered server-side");
});

test("outside the United States is a real answer, and it is remembered", async () => {
  const outside = stub([{ body: { features: [] } }]);
  assert.equal(await unitedStatesCountyAt(48.8566, 2.3522, outside.fetcher), undefined);
  assert.equal(await unitedStatesCountyAt(48.8566, 2.3522, outside.fetcher), undefined);
  assert.equal(outside.calls.length, 1, "a determinate 'no county' is cached");
});

test("a failure is NOT remembered, so a transient outage never becomes a standing absence", async () => {
  /* The distinction this test exists for: an empty result and a broken request
     produce the same `undefined`, and only one of them is an answer. */
  const broken = stub([{ status: 400, body: { error: { code: 400, message: "Failed to execute query." } } }]);
  assert.equal(await unitedStatesCountyAt(33.5186, -86.8104, broken.fetcher), undefined);
  assert.equal(await unitedStatesCountyAt(33.5186, -86.8104, broken.fetcher), undefined);
  assert.equal(broken.calls.length, 2, "a failure is asked again");
});

test("an ArcGIS error arriving with HTTP 200 is a failure, not an empty county", async () => {
  const soft = stub([{ status: 200, body: { error: { code: 400, message: "Failed to execute query." } } }]);
  assert.equal(await unitedStatesCountyAt(33.5186, -86.8104, soft.fetcher), undefined);
  assert.equal(await unitedStatesCountyAt(33.5186, -86.8104, soft.fetcher), undefined);
  assert.equal(soft.calls.length, 2, "an error body is never cached as 'no county'");

  /* THE CASE THAT ACTUALLY NEEDS THE `error` CHECK, and the reason it is
     tested separately: an error body carrying an EMPTY features array is
     byte-for-byte a point outside the United States as far as the features
     array is concerned. With only the array examined, deleting the `error`
     check left every test green while a provider error silently became a
     cached, permanent "this point is in no county". */
  clearUnitedStatesCountyCache();
  const errorWithEmptyFeatures = stub([
    { status: 200, body: { error: { code: 500, message: "Unable to complete operation." }, features: [] } },
  ]);
  assert.equal(await unitedStatesCountyAt(33.5186, -86.8104, errorWithEmptyFeatures.fetcher), undefined);
  assert.equal(await unitedStatesCountyAt(33.5186, -86.8104, errorWithEmptyFeatures.fetcher), undefined);
  assert.equal(errorWithEmptyFeatures.calls.length, 2,
    "an error alongside an empty features array is a failure, never 'no county'");
});

test("two counties at one point is a question for a person, and a malformed row is refused", async () => {
  const both = stub([{ body: { features: [
    { attributes: { NAME: "A County", BASENAME: "A", GEOID: "01001", STATE: "01" } },
    { attributes: { NAME: "B County", BASENAME: "B", GEOID: "01003", STATE: "01" } },
  ] } }]);
  assert.equal(await unitedStatesCountyAt(33, -86, both.fetcher), undefined);

  clearUnitedStatesCountyCache();
  /* A five-digit code must begin with its own state's two digits. A mismatch
     means the service changed shape, which is a failure rather than a county. */
  const mismatched = stub([{ body: feature("Jefferson County", "Jefferson", "01073", "13") }]);
  assert.equal(await unitedStatesCountyAt(33, -86, mismatched.fetcher), undefined);

  clearUnitedStatesCountyCache();
  const shortGeoid = stub([{ body: feature("Jefferson County", "Jefferson", "1073", "01") }]);
  assert.equal(await unitedStatesCountyAt(33, -86, shortGeoid.fetcher), undefined);
});

test("concurrent questions about one point ask the Bureau once", async () => {
  const shared = stub([{ body: feature("Madison County", "Madison", "01089", "01") }]);
  const [a, b] = await Promise.all([
    unitedStatesCountyAt(34.7304, -86.5861, shared.fetcher),
    unitedStatesCountyAt(34.7304, -86.5861, shared.fetcher),
  ]);
  assert.equal(a?.geoid, "01089");
  assert.equal(b?.geoid, "01089");
  assert.equal(shared.calls.length, 1);
});

test("an impossible coordinate is refused without asking anyone", async () => {
  const unused = stub([{ body: feature("X County", "X", "01001", "01") }]);
  for (const [latitude, longitude] of [[91, 0], [0, 181], [Number.NaN, 0]] as const) {
    assert.equal(await unitedStatesCountyAt(latitude, longitude, unused.fetcher), undefined);
  }
  assert.equal(unused.calls.length, 0);
});

test("proximity brackets the county line rather than inventing a distance", async () => {
  const clear = stub([{ body: { features: [{ attributes: { GEOID: "51760" } }] } }]);
  assert.equal(await unitedStatesCountyLineProximity(37.5407, -77.4360, "51760", clear.fetcher), "CLEAR");
  /* PINNED AS A LITERAL, DELIBERATELY. Asserting against
     COUNTY_LINE_MARGIN_METRES would compare the request with the same constant
     it was built from, which is a check that cannot fail — changing the margin
     to 400 left this test green. The margin is a declared product decision, so
     the number is written out and changing it must come here. */
  assert.match(clear.calls[0], /distance=500/);
  assert.equal(COUNTY_LINE_MARGIN_METRES, 500, "the declared margin is 500 m");
  assert.match(clear.calls[0], /spatialRel=esriSpatialRelWithin/);

  clearCountyLineProximityCache();
  /* The circle reaches into a neighbour, so the county does not contain it. */
  const near = stub([{ body: { features: [{ attributes: { GEOID: "51087" } }] } }]);
  assert.equal(await unitedStatesCountyLineProximity(37.5, -77.4, "51760", near.fetcher), "NEAR_LINE");

  clearCountyLineProximityCache();
  const empty = stub([{ body: { features: [] } }]);
  assert.equal(await unitedStatesCountyLineProximity(37.5, -77.4, "51760", empty.fetcher), "NEAR_LINE");
});

test("an unasked proximity is NOT_MEASURED and is never read as clear", async () => {
  const down = stub([{ status: 503, body: {} }]);
  assert.equal(await unitedStatesCountyLineProximity(37.5407, -77.4360, "51760", down.fetcher), "NOT_MEASURED");
  clearCountyLineProximityCache();
  const errored = stub([{ status: 200, body: { error: { code: 400 } } }]);
  assert.equal(await unitedStatesCountyLineProximity(37.5407, -77.4360, "51760", errored.fetcher), "NOT_MEASURED");
  const unused = stub([{ body: { features: [] } }]);
  assert.equal(await unitedStatesCountyLineProximity(37.5407, -77.4360, "517", unused.fetcher), "NOT_MEASURED");
  assert.equal(unused.calls.length, 0, "a malformed code asks nobody");
});

test("the source names the Bureau and the layer it answered from", () => {
  const source = unitedStatesCountySource("2026-10-07");
  assert.equal(source.authority, "U.S. Census Bureau");
  assert.match(source.title, /Counties/);
  assert.match(source.url, /State_County\/MapServer\/1$/);
  assert.equal(source.retrievedAt, "2026-10-07");
  assert.equal(source.type, "official");
});
