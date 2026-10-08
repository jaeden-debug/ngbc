import assert from "node:assert/strict";
import test from "node:test";
import { resolveZoneAnswer, zoneAnswerBody } from "../zone-answer.ts";
import { clearUnitedStatesStateCache } from "./state-boundary.ts";
import { clearCountyLineProximityCache, clearUnitedStatesCountyCache } from "./county-boundary.ts";
import { ADMINISTRATIVE_SCOPES } from "./administrative-scope-declarations.ts";

/**
 * THE LADDER, NOT THE RUNG. A division that resolves inside
 * `placeInJurisdiction` and never reaches the wire is not an answer: §41B
 * counts a step only if every step before it was reached, and the last time a
 * jurisdiction was certified one rung short, eleven tests passed while Nova
 * Scotia answered CLOSED everywhere in production.
 *
 * So these drive the whole path a request takes — `resolveZoneAnswer`, which
 * decides the outcome, then `zoneAnswerBody`, which is what the endpoint
 * serialises — rather than the placement function the other tests cover.
 */

type Fixture = { state: [string, string]; county: [string, string, string] };

function census(fixture: Fixture): typeof fetch {
  return (async (url: Parameters<typeof fetch>[0]) => {
    const target = String(url);
    const isCounty = target.includes("/MapServer/1/query");
    const proximity = target.includes("distance=");
    if (isCounty && proximity) {
      return json({ features: [{ attributes: { GEOID: fixture.county[2] } }] });
    }
    if (isCounty) {
      const [name, baseName, geoid] = fixture.county;
      return json({ features: [{ attributes: { NAME: name, BASENAME: baseName, GEOID: geoid, STATE: geoid.slice(0, 2) } }] });
    }
    if (proximity) return json({ features: [{ attributes: { STUSAB: fixture.state[1] } }] });
    return json({ features: [{ attributes: { NAME: fixture.state[0], STUSAB: fixture.state[1] } }] });
  }) as unknown as typeof fetch;
}

function json(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

const POINTS: Array<{ code: string; lat: number; lon: number; fixture: Fixture; expectDivision: string }> = [
  { code: "VA", lat: 37.55, lon: -77.35, expectDivision: "Henrico County",
    fixture: { state: ["Virginia", "VA"], county: ["Henrico County", "Henrico", "51087"] } },
  { code: "SC", lat: 34.5, lon: -82.65, expectDivision: "Anderson County",
    fixture: { state: ["South Carolina", "SC"], county: ["Anderson County", "Anderson", "45007"] } },
  { code: "WV", lat: 38.35, lon: -81.63, expectDivision: "Kanawha County",
    fixture: { state: ["West Virginia", "WV"], county: ["Kanawha County", "Kanawha", "54039"] } },
  { code: "GA", lat: 32.84, lon: -83.63, expectDivision: "Bibb County",
    fixture: { state: ["Georgia", "GA"], county: ["Bibb County", "Bibb", "13021"] } },
  { code: "MO", lat: 38.95, lon: -92.33, expectDivision: "Boone County",
    fixture: { state: ["Missouri", "MO"], county: ["Boone County", "Boone", "29019"] } },
  { code: "KY", lat: 38.04, lon: -84.5, expectDivision: "Fayette County",
    fixture: { state: ["Kentucky", "KY"], county: ["Fayette County", "Fayette", "21067"] } },
];

test.beforeEach(() => {
  clearUnitedStatesStateCache();
  clearUnitedStatesCountyCache();
  clearCountyLineProximityCache();
});

test("every declared jurisdiction has a point in this file, so none is declared without being driven", () => {
  /* The positive control. A jurisdiction added to the declarations and not to
     POINTS would be declared and untested, which is the gap this file closes. */
  const declared = ADMINISTRATIVE_SCOPES.filter((s) => s.serving).map((s) => s.code).sort();
  assert.deepEqual(POINTS.map((p) => p.code).sort(), declared);
});

for (const point of POINTS) {
  test(`${point.code}: the division reaches the wire, through the endpoint's own path`, async () => {
    const { answer } = await resolveZoneAnswer(point.lat, point.lon, census(point.fixture));
    assert.equal(answer.kind, "JURISDICTION_SCOPED", `${point.code} did not reach the scoped outcome`);

    const body = zoneAnswerBody(answer, { includeGeometry: false });
    assert.equal(body.outcome, "JURISDICTION_SCOPED");
    /* The field an API consumer actually reads. */
    const division = (body as { division?: { name?: string; officialTerm?: string; statedAs?: string } }).division;
    assert.ok(division, `${point.code}: the body carries no division`);
    assert.equal(division.name, point.expectDivision);
    assert.ok((division.officialTerm ?? "").length > 2, `${point.code}: the division needs the authority's own term`);
    assert.ok((division.statedAs ?? "").length > 60, `${point.code}: the division must say what it is and is not`);
    /* And never a zone: §41A's limit, checked on the serialised body. */
    assert.equal((body as { zone?: unknown }).zone, undefined, `${point.code}: a division is not a zone`);
  });
}

test("a state with no declaration is not given a division by accident", async () => {
  /* Minnesota is not declared, so a point there must reach the unsupported
     answer rather than acquiring a county from the same Census call. */
  const { answer } = await resolveZoneAnswer(44.98, -93.27, census({
    state: ["Minnesota", "MN"], county: ["Hennepin County", "Hennepin", "27053"],
  }));
  assert.notEqual(answer.kind, "JURISDICTION_SCOPED");
  const body = zoneAnswerBody(answer, { includeGeometry: false });
  assert.equal((body as { division?: unknown }).division, undefined);
});
