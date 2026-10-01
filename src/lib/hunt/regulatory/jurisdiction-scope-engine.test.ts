import assert from "node:assert/strict";
import test from "node:test";
import { evaluateConditional, type ConditionalBundle, type ConditionalRule, type ConditionalVocabulary } from "./conditional-engine.ts";
import { appliesInWorld, placeWorlds, type PlaceContext } from "./geography.ts";
import { legalTimeNotCertified } from "./legal-time.ts";

/**
 * THE ENGINE, ASKED ABOUT A POINT PLACED ONLY IN ITS JURISDICTION.
 *
 * §41A ("Resolving inside a jurisdiction is not drawing its boundary") lets a
 * jurisdiction boundary place a point for a rule whose own scope is the whole
 * jurisdiction, and for nothing narrower. These cases ask the ENGINE — never
 * the fixture — what a hunter would be told, in both directions:
 *
 *  - a statewide rule answers inside the state and not one step outside it;
 *  - a unit rule never answers at a point that has no unit;
 *  - an exception the engine cannot test is "needs a closer look", never the
 *    statewide answer;
 *  - a point that DOES have a unit gets the statewide rule and the unit rule
 *    together, which is how a state with unit geometry composes later.
 *
 * The fixture is synthetic on purpose: the wiring is the subject, and the real
 * pilot bundle has its own tests (`iowa.test.ts`).
 */

const STATE = "jurisdiction:us-xx";
const OTHER = "jurisdiction:us-yy";

function rule(overrides: Partial<ConditionalRule> & Pick<ConditionalRule, "id" | "speciesId">): ConditionalRule {
  return {
    regulatoryGroupId: "group:statewide",
    geography: { statedAs: "Entire state open.", include: { ghas: [], gbhz: [], special: [], jurisdiction: STATE }, exclude: { ghas: [], special: [] } },
    appliesWhen: {},
    seasonLabel: "Regular season",
    seasonPhrase: "1 October to 31 January",
    windows: [{ opensIso: "2026-10-01", closesIso: "2027-01-31" }],
    declaredNoSeason: false,
    limits: { daily: 3, possession: 6, statedAs: "3 daily, 6 in possession", section: "s. 1" },
    conditionIds: [],
    caveats: [],
    notes: [],
    disputes: [],
    sourceId: "source:test",
    sourceSection: "s. 1",
    sourceVersion: "test",
    reviewStatus: "VERIFIED",
    ...overrides,
  };
}

const bundle: ConditionalBundle = {
  bundleId: "test-statewide",
  jurisdictionId: STATE,
  sourceVersion: "test",
  retrievedAt: "2026-09-30",
  certifiedPeriod: { from: "2026-06-18", to: "2027-06-17" },
  absence: { meaning: "UNKNOWN" },
  sources: [{ id: "source:test" }],
  units: [{ identifier: "5", zoneId: "management_zone:us-xx-unit-5" }],
  groups: [
    { id: "group:statewide", officialSpec: "Entire state", zoneIds: [] },
    { id: "group:unit-5", officialSpec: "Unit 5", zoneIds: ["management_zone:us-xx-unit-5"] },
  ],
  specialGeographies: [
    {
      id: "special:refuge",
      name: "The Test Refuge",
      statedAs: "except within the Test Refuge",
      resolution: "UNRESOLVED",
      reason: "The refuge is described in words only.",
      withinJurisdiction: STATE,
      envelope: [-94, 42, -93, 43],
    },
    {
      id: "special:park",
      name: "The Test Park",
      statedAs: "except within the Test Park",
      resolution: "OVERLAY",
      withinJurisdiction: STATE,
    },
  ],
  rules: [
    rule({ id: "pheasant", speciesId: "species:statewide-bird" }),
    rule({
      id: "grouse-unit-5",
      speciesId: "species:unit-bird",
      regulatoryGroupId: "group:unit-5",
      geography: { statedAs: "Unit 5 only", include: { ghas: ["5"], gbhz: [], special: [] }, exclude: { ghas: [], special: [] } },
    }),
    rule({
      id: "rabbit-except-refuge",
      speciesId: "species:excepted",
      geography: { statedAs: "Entire state except the Test Refuge", include: { ghas: [], gbhz: [], special: [], jurisdiction: STATE }, exclude: { ghas: [], special: ["special:refuge"] } },
    }),
    rule({
      id: "squirrel-except-park",
      speciesId: "species:excepted-park",
      geography: { statedAs: "Entire state except the Test Park", include: { ghas: [], gbhz: [], special: [], jurisdiction: STATE }, exclude: { ghas: [], special: ["special:park"] } },
    }),
    rule({
      id: "deer-statewide",
      speciesId: "species:composed",
      seasonLabel: "Statewide archery",
      windows: [{ opensIso: "2026-10-01", closesIso: "2026-10-31" }],
    }),
    rule({
      id: "deer-unit-5",
      speciesId: "species:composed",
      regulatoryGroupId: "group:unit-5",
      seasonLabel: "Unit 5 late season",
      windows: [{ opensIso: "2026-12-01", closesIso: "2026-12-31" }],
      geography: { statedAs: "Unit 5 only", include: { ghas: ["5"], gbhz: [], special: [] }, exclude: { ghas: [], special: [] } },
    }),
  ],
};

const vocabulary: ConditionalVocabulary = {
  jurisdictionName: "Testland",
  unitTerm: "Unit",
  dimensions: [],
  legalTime: legalTimeNotCertified("not under test", "North Ground"),
  standingLimitations: [],
  standingSourceIds: [],
};

/* A point placed in the state by its boundary: no zone, a jurisdiction. */
const inState = (overrides: Partial<PlaceContext & { zoneName: string }> = {}): PlaceContext & { zoneName: string } => ({
  jurisdictionId: STATE,
  zoneName: "Testland",
  latitude: 41.5,
  longitude: -95.5,
  overlays: new Set<string>(),
  ...overrides,
});

function ask(speciesId: string, date: string, place: PlaceContext & { zoneName: string } = inState()) {
  const evaluation = evaluateConditional(bundle, vocabulary, { speciesId, speciesName: speciesId.replace("species:", ""), date, place, answers: {} });
  assert.equal(evaluation.completeness, "RESOLVED");
  assert.ok(evaluation.result);
  return evaluation.result;
}

test("a statewide rule answers at a point placed only in its state, inside its window", () => {
  const result = ask("species:statewide-bird", "2026-11-15");
  assert.equal(result.status, "CONDITIONAL");
  assert.equal(result.season?.opens, "2026-10-01");
  assert.equal(result.season?.closes, "2027-01-31");
});

test("the day before it opens, the same point is not open", () => {
  assert.notEqual(ask("species:statewide-bird", "2026-09-30").status, "CONDITIONAL");
  /* Opening day itself, so the boundary is tested from both sides. */
  assert.equal(ask("species:statewide-bird", "2026-10-01").status, "CONDITIONAL");
});

test("a point in another state never receives this state's statewide answer", () => {
  const result = ask("species:statewide-bird", "2026-11-15", inState({ jurisdictionId: OTHER, zoneName: "Otherland" }));
  assert.notEqual(result.status, "CONDITIONAL");
  /* And a point with no jurisdiction at all is not "anywhere in every state". */
  assert.notEqual(ask("species:statewide-bird", "2026-11-15", inState({ jurisdictionId: undefined })).status, "CONDITIONAL");
});

test("a rule scoped narrower than the state never answers at a point that has no unit", () => {
  const result = ask("species:unit-bird", "2026-11-15");
  assert.equal(result.status, "UNKNOWN", "a unit rule must wait for the authority's own geometry");
  /* Positive control: the same rule DOES answer where the authority's unit placed the point. */
  const inUnit = ask("species:unit-bird", "2026-11-15", inState({ zoneId: "management_zone:us-xx-unit-5", zoneName: "Unit 5" }));
  assert.equal(inUnit.status, "CONDITIONAL");
});

test("a statewide rule with an exception the engine cannot test is a closer look, never the statewide answer", () => {
  /* Inside the exception's proven envelope: the refuge may contain the point. */
  const near = ask("species:excepted", "2026-11-15", inState({ latitude: 42.5, longitude: -93.5 }));
  assert.equal(near.status, "NEEDS_VERIFICATION");
  assert.ok(near.limitations.some((line) => line.text.includes("The Test Refuge may include this point")));
  /* Outside the envelope the refuge certainly does not contain the point, so the statewide answer stands. */
  assert.equal(ask("species:excepted", "2026-11-15", inState({ latitude: 41.5, longitude: -95.5 })).status, "CONDITIONAL");
});

test("an exception with a published boundary is tested at the point, and an unread one stays open", () => {
  assert.equal(ask("species:excepted-park", "2026-11-15", inState({ overlays: new Set(["special:park"]) })).status, "UNKNOWN",
    "inside the park no statewide rule reaches the point, and silence is not a closure here");
  assert.equal(ask("species:excepted-park", "2026-11-15", inState({ overlays: new Set() })).status, "CONDITIONAL");
  assert.equal(ask("species:excepted-park", "2026-11-15", inState({ overlays: null })).status, "NEEDS_VERIFICATION",
    "a layer that could not be read is not a layer with nothing in it");
});

test("where a unit exists too, statewide and unit rules compose at one point", () => {
  const unitPoint = inState({ zoneId: "management_zone:us-xx-unit-5", zoneName: "Unit 5" });
  assert.equal(ask("species:composed", "2026-10-15", unitPoint).status, "CONDITIONAL", "the statewide season reaches a unit point");
  assert.equal(ask("species:composed", "2026-12-15", unitPoint).status, "CONDITIONAL", "and so does the unit's own");
  /* A point with no unit gets only the statewide half. */
  assert.equal(ask("species:composed", "2026-10-15").status, "CONDITIONAL");
  assert.notEqual(ask("species:composed", "2026-12-15").status, "CONDITIONAL");
});

test("the geography primitive itself: no zone means no group membership and no unit match", () => {
  const groups = new Map(bundle.groups.map((group) => [group.id, group]));
  const place = inState();
  const { worlds } = placeWorlds(bundle, place, bundle.rules);
  assert.equal(worlds.length >= 1, true);
  const world = worlds[0];
  assert.equal(world.area, null, "a point with no zone has no area — never a stand-in");
  const ungeographic = { ...bundle.rules[0], geography: undefined };
  assert.equal(appliesInWorld(ungeographic, groups, place, world), false, "a group rule needs a zone to be a member of");
  assert.equal(appliesInWorld(bundle.rules[0], groups, place, world), true);
});
