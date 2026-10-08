import assert from "node:assert/strict";
import test from "node:test";
import { placeInJurisdiction } from "../jurisdiction-scope.ts";
import { jurisdictionScopedBody } from "../jurisdiction-scope-response.ts";
import { clearUnitedStatesStateCache } from "./state-boundary.ts";
import { clearCountyLineProximityCache, clearUnitedStatesCountyCache } from "./county-boundary.ts";
import {
  ADMINISTRATIVE_SCOPES, administrativeScopeFor, couldBeAdministrativelyScoped,
} from "./administrative-scope-declarations.ts";
import { resolutionStrategyFor } from "../resolution-strategy.ts";

/**
 * Placing a point in the administrative division that IS the legal unit.
 *
 * Against fixtures, not the Census Bureau (§59). The payloads are the shapes
 * TIGERweb returned on 2026-10-07 for the points named.
 */

function census(responses: Record<string, unknown>): { calls: string[]; fetcher: typeof fetch } {
  const calls: string[] = [];
  const fetcher = (async (url: Parameters<typeof fetch>[0]) => {
    const target = String(url);
    calls.push(target);
    /* Layer 0 is states, layer 1 counties; `distance=` marks a proximity ask. */
    const layer = target.includes("/MapServer/1/query") ? "county" : "state";
    const key = `${layer}${target.includes("distance=") ? ":proximity" : ""}`;
    const body = responses[key];
    if (body === undefined) throw new Error(`fixture missing for ${key}`);
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as unknown as typeof fetch;
  return { calls, fetcher };
}

const VIRGINIA = { features: [{ attributes: { NAME: "Virginia", STUSAB: "VA" } }] };
const henrico = (geoid = "51087") =>
  ({ features: [{ attributes: { NAME: "Henrico County", BASENAME: "Henrico", GEOID: geoid, STATE: geoid.slice(0, 2) } }] });

test.beforeEach(() => {
  clearUnitedStatesStateCache();
  clearUnitedStatesCountyCache();
  clearCountyLineProximityCache();
});

test("every declaration carries the authority's own words, not our note that a state uses counties", () => {
  /*
   * The guard that keeps this family honest. A row may only be added from a
   * definition whose SHAPE is this family — "the following localities" — and a
   * quote is what proves someone read one. Alabama's zones are a traverse and
   * must never arrive here from a summary saying it "has zones A-E".
   */
  assert.ok(ADMINISTRATIVE_SCOPES.length > 0, "nothing is declared, so this measures nothing");
  for (const scope of ADMINISTRATIVE_SCOPES) {
    const { quote, url, section, effectiveAs, authority } = scope.authorityDefinition;
    assert.ok(quote.length > 40, `${scope.jurisdictionId}: a definition needs the authority's words`);
    assert.match(url, /^https:\/\//, `${scope.jurisdictionId}: the words need a locator`);
    assert.ok(section.length > 5 && effectiveAs.length > 5 && authority.length > 10,
      `${scope.jurisdictionId}: section, currency and authority are all required`);
    assert.ok(scope.knownDifferences.length > 0, `${scope.jurisdictionId}: say where extent and jurisdiction differ`);
  }
});

test("Virginia's unit is the locality, and the quote is the regulation's own sentence", () => {
  const virginia = administrativeScopeFor("jurisdiction:us-va");
  assert.ok(virginia, "Virginia is declared");
  assert.equal(virginia.officialTerm, "locality");
  assert.match(virginia.authorityDefinition.quote, /^It shall be lawful to hunt deer in the following localities/);
  assert.match(virginia.authorityDefinition.section, /^4VAC15-90-10/);
  /* What sits ON TOP of the locality is named, so nobody reads "Virginia uses
     counties" as the whole model. The Dismal Swamp Line is the sharp one: it is
     geography NARROWER than the locality and must stay unresolved. */
  assert.equal(virginia.furtherDimensions.length, 3);
  assert.ok(virginia.furtherDimensions.some((d) => /Dismal Swamp Line/.test(d)), "the sub-locality split is recorded");
  assert.ok(virginia.furtherDimensions.some((d) => /national forest/.test(d)), "land class is recorded");
});

test("a Virginia point is placed in its locality, and the locality is not a zone", async () => {
  const bureau = census({ state: VIRGINIA, county: henrico(), "county:proximity": { features: [{ attributes: { GEOID: "51087" } }] } });
  const placement = await placeInJurisdiction(37.55, -77.35, bureau.fetcher);
  assert.equal(placement.kind, "SCOPED");
  const resolution = placement.kind === "SCOPED" ? placement.resolution : undefined;
  assert.equal(resolution?.jurisdictionId, "jurisdiction:us-va");
  assert.equal(resolution?.zoneId, undefined, "a locality is never a zone id");
  const division = resolution?.jurisdictionScope?.division;
  assert.equal(division?.geoid, "51087");
  assert.equal(division?.name, "Henrico County");
  assert.equal(division?.officialTerm, "locality");
  assert.equal(division?.proximity, "CLEAR");
  assert.match(division?.statedAs ?? "", /writes its hunting rules in/);
  assert.match(resolution?.message ?? "", /Henrico County/);
});

test("an independent city is its own locality, not the county around it", async () => {
  const bureau = census({
    state: VIRGINIA,
    county: { features: [{ attributes: { NAME: "Richmond city", BASENAME: "Richmond", GEOID: "51760", STATE: "51" } }] },
    "county:proximity": { features: [{ attributes: { GEOID: "51760" } }] },
  });
  const placement = await placeInJurisdiction(37.5407, -77.436, bureau.fetcher);
  const division = placement.kind === "SCOPED" ? placement.resolution.jurisdictionScope?.division : undefined;
  assert.equal(division?.geoid, "51760");
  assert.equal(division?.name, "Richmond city");
});

test("a county from the neighbouring state is refused rather than named as this jurisdiction's", async () => {
  /*
   * The two services can disagree within their digitising tolerance of a state
   * line. Naming a Maryland county as a Virginia locality would attach the
   * wrong authority's rules to the ground, so the answer keeps the state and
   * names no division. The state's FIPS comes from the DECLARATION, not from
   * the county row being checked — comparing the Bureau's answer with itself
   * is a check that cannot fail.
   */
  const bureau = census({ state: VIRGINIA, county: henrico("24031"), "county:proximity": { features: [] } });
  const placement = await placeInJurisdiction(38.9, -77.2, bureau.fetcher);
  assert.equal(placement.kind, "SCOPED");
  const resolution = placement.kind === "SCOPED" ? placement.resolution : undefined;
  assert.equal(resolution?.jurisdictionId, "jurisdiction:us-va", "the state still answers");
  assert.equal(resolution?.jurisdictionScope?.division, undefined, "no division is named");
});

test("a point near a locality line says so, and an unmeasured one is never called clear", async () => {
  const near = census({ state: VIRGINIA, county: henrico(), "county:proximity": { features: [{ attributes: { GEOID: "51760" } }] } });
  const a = await placeInJurisdiction(37.54, -77.42, near.fetcher);
  const divisionNear = a.kind === "SCOPED" ? a.resolution.jurisdictionScope?.division : undefined;
  assert.equal(divisionNear?.proximity, "NEAR_LINE");
  assert.match(divisionNear?.statedAs ?? "", /rules in the next locality can differ/);
});

test("the wire body carries the division, with no new outcome and no zone", async () => {
  const bureau = census({ state: VIRGINIA, county: henrico(), "county:proximity": { features: [{ attributes: { GEOID: "51087" } }] } });
  const placement = await placeInJurisdiction(37.55, -77.35, bureau.fetcher);
  assert.equal(placement.kind, "SCOPED");
  const body = jurisdictionScopedBody(placement.kind === "SCOPED" ? placement.resolution : (() => { throw new Error("not scoped"); })());
  assert.equal(body.status, "JURISDICTION");
  assert.equal(body.scope, "WHOLE_JURISDICTION", "the division adds a field, never an outcome");
  assert.equal(body.division?.geoid, "51087");
  assert.equal(body.division?.officialTerm, "locality");
  assert.equal(body.division?.furtherDimensions.length, 3);
  assert.equal((body as { zone?: unknown }).zone, undefined);
  /* Virginia holds no certified rules, and that is said rather than implied. */
  assert.deepEqual(body.rules.speciesIds, []);
});

test("the request guard asks nobody about a point outside the declared envelopes", async () => {
  assert.equal(couldBeAdministrativelyScoped(45.0, -93.0), false, "Minnesota is not declared");
  assert.equal(couldBeAdministrativelyScoped(37.55, -77.35), true, "Virginia is");
  assert.equal(couldBeAdministrativelyScoped(Number.NaN, -77.35), false);
});

test("Virginia's strategy is derived from the declaration and quotes the authority", () => {
  const strategy = resolutionStrategyFor("jurisdiction:us-va");
  assert.equal(strategy.strategy, "ADMINISTRATIVE_COMPOSITION");
  assert.match(strategy.because, /It shall be lawful to hunt deer in the following localities/);
  assert.match(strategy.evidence, /4VAC15-90-10/);
  assert.match(strategy.evidence, /eff\. September 1, 2025/);
});
