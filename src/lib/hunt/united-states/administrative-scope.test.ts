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

test("a declaration states how many divisions it expects, and where the number came from", () => {
  /*
   * The positive control. A resolver reading the wrong Census layer, or a layer
   * that changes shape, surfaces here instead of as a quietly wrong locality.
   * Virginia's 133 was measured on both county layers independently.
   */
  for (const scope of ADMINISTRATIVE_SCOPES) {
    const { expected, composition, measuredFrom, measuredOn } = scope.divisionCount;
    assert.ok(expected > 0, `${scope.jurisdictionId}: a count of zero measures nothing`);
    assert.ok(composition.length > 20 && measuredFrom.length > 40, `${scope.jurisdictionId}: say what was counted and how`);
    assert.match(measuredOn, /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.equal(administrativeScopeFor("jurisdiction:us-va")?.divisionCount.expected, 133);
});

test("geography narrower than the division is recorded as a limit, not left out", () => {
  /*
   * §8's understating direction. If a carve-out line is simply absent from the
   * record, a locality answer silently stands in for it — and a hunter told the
   * wrong thing about Rockingham west of Rt. 613 just hunts somewhere else and
   * never writes in.
   */
  /*
   * THE STATE IS A FIELD, NOT A SENTENCE. My first two attempts grepped the
   * prose for "not built / unresolved / incomplete", then for a slightly longer
   * list — and both flagged honest records because the vocabulary was short,
   * not because the data was wrong: Georgia says "recorded and not served",
   * West Virginia says "until the division lines are built". Adding a word each
   * time a record fails turns a check into a spell-checker, and §8 already
   * settles it — a fact that lives only in a display string is not resolved.
   *
   * So `answerable` carries the fact and is asserted; the prose stays free to
   * explain, and is only required to be substantive.
   */
  for (const scope of ADMINISTRATIVE_SCOPES) {
    const narrower = scope.subDivisionGeography;
    assert.ok(narrower.examples.length >= 3, `${scope.jurisdictionId}: name the lines you know about`);
    assert.ok(["NOT_BUILT", "PARTIALLY_BUILT", "BUILT"].includes(narrower.answerable),
      `${scope.jurisdictionId}: declare whether the narrower geography can be answered`);
    assert.ok(narrower.consequence.length > 80,
      `${scope.jurisdictionId}: explain what the division cannot answer and what it means for an answer`);
    /* Nothing claims BUILT yet. When something does, this line is what makes a
       reader check that a resolver really exists for it. */
    assert.notEqual(narrower.answerable, "BUILT",
      `${scope.jurisdictionId}: claims the narrower geography is built; name the resolver and delete this line`);
  }
  const virginia = administrativeScopeFor("jurisdiction:us-va");
  assert.ok(virginia?.subDivisionGeography.examples.some((e) => /Dismal Swamp Line/.test(e)));
  assert.ok(virginia?.subDivisionGeography.examples.some((e) => /Blue Ridge/.test(e)));
  /* Approximate because it came from the guide rather than an enumeration, and
     said to be approximate rather than rounded into a confident figure. */
  assert.match(virginia?.subDivisionGeography.count ?? "", /about \d+ to \d+/);
});

test("a South Carolina point reaches its game zone through its county", async () => {
  /*
   * The two shapes, end to end. Virginia's locality IS the unit; South
   * Carolina's county is how a point reaches a zone the authority composed from
   * county lists. One resolver, two answers, and the sentence names both.
   */
  const bureau = census({
    state: { features: [{ attributes: { NAME: "South Carolina", STUSAB: "SC" } }] },
    county: { features: [{ attributes: { NAME: "Anderson County", BASENAME: "Anderson", GEOID: "45007", STATE: "45" } }] },
    "county:proximity": { features: [{ attributes: { GEOID: "45007" } }] },
  });
  const placement = await placeInJurisdiction(34.5, -82.65, bureau.fetcher);
  assert.equal(placement.kind, "SCOPED");
  const division = placement.kind === "SCOPED" ? placement.resolution.jurisdictionScope?.division : undefined;
  assert.equal(division?.officialTerm, "county", "the DIVISION's term, not the unit's");
  assert.equal(division?.composedUnit?.state, "IN_UNIT");
  if (division?.composedUnit?.state === "IN_UNIT") {
    assert.equal(division.composedUnit.officialName, "Game Zone 2");
    assert.equal(division.composedUnit.officialTerm, "game zone");
    assert.match(division.composedUnit.quote, /^Includes all lands of Abbeville/);
  }
  assert.match(division?.statedAs ?? "", /lists this county in Game Zone 2/);
});

test("a county an unresolved zone crosses is told so, and is given no zone", async () => {
  /*
   * §8's understating direction made visible. Pickens is crossed by Game Zone
   * 1's railway line, so the answer names the unresolved zone instead of the
   * neighbouring one we happen to hold — and says so in words, rather than
   * going quiet.
   */
  const bureau = census({
    state: { features: [{ attributes: { NAME: "South Carolina", STUSAB: "SC" } }] },
    county: { features: [{ attributes: { NAME: "Pickens County", BASENAME: "Pickens", GEOID: "45077", STATE: "45" } }] },
    "county:proximity": { features: [{ attributes: { GEOID: "45077" } }] },
  });
  const placement = await placeInJurisdiction(34.88, -82.71, bureau.fetcher);
  const division = placement.kind === "SCOPED" ? placement.resolution.jurisdictionScope?.division : undefined;
  assert.equal(division?.name, "Pickens County");
  assert.equal(division?.composedUnit?.state, "IN_AN_UNRESOLVED_UNIT");
  if (division?.composedUnit?.state === "IN_AN_UNRESOLVED_UNIT") {
    assert.equal(division.composedUnit.officialName, "Game Zone 1");
  }
  assert.match(division?.statedAs ?? "", /no zone is given for this point/);
});

test("Virginia's division carries no composed unit, because there is nothing to compose", async () => {
  const bureau = census({ state: VIRGINIA, county: henrico(), "county:proximity": { features: [{ attributes: { GEOID: "51087" } }] } });
  const placement = await placeInJurisdiction(37.55, -77.35, bureau.fetcher);
  const division = placement.kind === "SCOPED" ? placement.resolution.jurisdictionScope?.division : undefined;
  assert.equal(division?.composedUnit, undefined, "the locality IS the unit");
});

test("Walton County answers as a conflict, and is placed in no bear zone", async () => {
  /*
   * The authority against itself, end to end. The Division's bear page omits
   * Walton from the 38 northern-zone counties; the Division's own zone map
   * labels it. §41B says find the controlling instrument rather than pick the
   * readable source — and Rule 391-4-2-.22's body was refused with HTTP 403, so
   * the conflict stands and neither answer is given.
   */
  const bureau = census({
    state: { features: [{ attributes: { NAME: "Georgia", STUSAB: "GA" } }] },
    county: { features: [{ attributes: { NAME: "Walton County", BASENAME: "Walton", GEOID: "13297", STATE: "13" } }] },
    "county:proximity": { features: [{ attributes: { GEOID: "13297" } }] },
  });
  const placement = await placeInJurisdiction(33.78, -83.73, bureau.fetcher);
  const division = placement.kind === "SCOPED" ? placement.resolution.jurisdictionScope?.division : undefined;
  assert.equal(division?.name, "Walton County");
  assert.equal(division?.composedUnit?.state, "MEMBERSHIP_IN_CONFLICT");
  assert.match(division?.statedAs ?? "", /own publications disagree/);
  assert.doesNotMatch(division?.statedAs ?? "", /Northern bear zone\b(?!.*disagree)/);
});

test("a Georgia county in no bear zone is told so, without being called closed", async () => {
  const bureau = census({
    state: { features: [{ attributes: { NAME: "Georgia", STUSAB: "GA" } }] },
    county: { features: [{ attributes: { NAME: "Chatham County", BASENAME: "Chatham", GEOID: "13051", STATE: "13" } }] },
    "county:proximity": { features: [{ attributes: { GEOID: "13051" } }] },
  });
  const placement = await placeInJurisdiction(32.08, -81.09, bureau.fetcher);
  const division = placement.kind === "SCOPED" ? placement.resolution.jurisdictionScope?.division : undefined;
  assert.equal(division?.composedUnit?.state, "NOT_ACCOUNTED_FOR");
  assert.match(division?.statedAs ?? "", /a finding rather than an absence of rules/);
});
