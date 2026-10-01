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
  /* A point with no unit gets only the statewide half — and the unit's season
     is never listed among the seasons "here", because it never matched. */
  const statewideOnly = ask("species:composed", "2026-10-15");
  assert.equal(statewideOnly.status, "CONDITIONAL");
  assert.doesNotMatch(statewideOnly.summary, /Unit 5 late season/);
  /* On a day only the unit's season is open, the point may lie in Unit 5: a
     statewide CLOSED there would be an absent placement drawn as a closure.
     (This used to assert only "not CONDITIONAL", which CLOSED satisfied.) */
  const unitDay = ask("species:composed", "2026-12-15");
  assert.equal(unitDay.status, "NEEDS_VERIFICATION");
  assert.equal(unitDay.season, undefined, "no season is stated for a point the unit rule never matched");
  assert.ok(unitDay.limitations.some((line) => line.text.includes("Unit 5 late season") && line.text.includes("not in a unit")));
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

/* ── Adversarial: every kind of exception a statewide rule can make ────────
 *
 * Found by an independent verifier: at a point placed only by the
 * jurisdiction boundary, the engine FAILED OPEN on every exclusion that was
 * not specially tagged. `exclude.ghas` was tested only `if (area)`, and every
 * special geography without `withinJurisdiction` was skipped by
 * `if (!area) continue` — so "statewide except Unit 5" answered "statewide"
 * at a point that may be in Unit 5. Each case below asks the ENGINE at a
 * point with no zone, and then proves the same exclusion still fires where a
 * unit DOES place the point, so no case can pass because the exclusion is
 * simply never read.
 */

const UNIT_5 = "management_zone:us-xx-unit-5";
const UNIT_6 = "management_zone:us-xx-unit-6";
const statewide = (statedAs: string, exclude: { ghas?: string[]; special?: string[] }) => ({
  statedAs,
  include: { ghas: [], gbhz: [], special: [], jurisdiction: STATE },
  exclude: { ghas: exclude.ghas ?? [], special: exclude.special ?? [] },
});

const adversarial: ConditionalBundle = {
  ...bundle,
  bundleId: "test-statewide-adversarial",
  units: [{ identifier: "5", zoneId: UNIT_5 }, { identifier: "6", zoneId: UNIT_6 }],
  sources: [{
    id: "source:test",
    conditions: [{
      id: "condition:test-unit-5-discharge-permit",
      text: "A discharge permit is required in Unit 5.",
      sourceId: "source:test",
      sourceSection: "s. 9",
      zoneIds: [UNIT_5],
    }],
  }],
  specialGeographies: [
    { id: "special:wma-set", name: "The Test WMA", statedAs: "except the Test WMA", resolution: "AREA_SET", areas: ["5"] },
    {
      id: "special:park-overlay", name: "The Test State Park", statedAs: "except the Test State Park",
      resolution: "OVERLAY", candidateAreas: ["5"], envelope: [-94, 42, -93, 43],
    },
    { id: "special:words-only", name: "The Test Closed Area", statedAs: "except the Test Closed Area", resolution: "UNRESOLVED", reason: "Described in words only." },
    {
      id: "special:partial", name: "The Test Refuge", statedAs: "except the Test Refuge",
      resolution: "UNRESOLVED", candidateAreas: ["5"], reason: "Its boundary is described in words.",
    },
  ],
  rules: [
    rule({ id: "except-unit", speciesId: "species:except-unit", geography: statewide("Entire state except Unit 5", { ghas: ["5"] }) }),
    rule({ id: "except-area-set", speciesId: "species:except-area-set", geography: statewide("Entire state except the Test WMA", { special: ["special:wma-set"] }) }),
    rule({ id: "except-overlay", speciesId: "species:except-overlay", geography: statewide("Entire state except the Test State Park", { special: ["special:park-overlay"] }) }),
    rule({ id: "except-words", speciesId: "species:except-words", geography: statewide("Entire state except the Test Closed Area", { special: ["special:words-only"] }) }),
    rule({ id: "except-partial", speciesId: "species:except-partial", geography: statewide("Entire state except the Test Refuge", { special: ["special:partial"] }) }),
    rule({
      id: "disputed-in-unit-5", speciesId: "species:disputed",
      disputes: [{ zoneId: UNIT_5, words: { text: "A correction notice gives Unit 5 a different closing date.", owner: "NORTH_GROUND" } as never }],
    }),
    rule({ id: "permit-in-unit-5", speciesId: "species:zone-condition", conditionIds: ["condition:test-unit-5-discharge-permit"] }),
    /* A unit-only species, by group membership alone. */
    rule({ id: "group-only", speciesId: "species:group-only", regulatoryGroupId: "group:unit-5", geography: undefined }),
  ],
};
/* The same law, where an unlisted place is CLOSED. */
const closedWorld: ConditionalBundle = { ...adversarial, bundleId: "test-closed-world", absence: { meaning: "CLOSED" } };

function askIn(target: ConditionalBundle, speciesId: string, place: PlaceContext & { zoneName: string } = inState()) {
  const evaluation = evaluateConditional(target, vocabulary, { speciesId, speciesName: speciesId.replace("species:", ""), date: "2026-11-15", place, answers: {} });
  assert.equal(evaluation.completeness, "RESOLVED");
  assert.ok(evaluation.result);
  return evaluation.result;
}
const inUnit = (zoneId: string) => inState({ zoneId, zoneName: zoneId === UNIT_5 ? "Unit 5" : "Unit 6" });
/* Inside the overlay's proven envelope, so nothing is ruled out by distance. */
const insideEnvelope = { latitude: 42.5, longitude: -93.5 };

test("a statewide rule excepting a UNIT is a closer look at a point with no unit, and the exception still fires in the unit", () => {
  const result = askIn(adversarial, "species:except-unit", inState(insideEnvelope));
  assert.equal(result.status, "NEEDS_VERIFICATION", "the point may be in Unit 5, which the rule excepts");
  assert.equal(result.season, undefined);
  assert.ok(result.limitations.some((line) => line.text.includes("excepts unit 5") && line.text.includes("not in a unit")));
  /* Positive controls: the unit test is real in both directions. */
  assert.notEqual(askIn(adversarial, "species:except-unit", inUnit(UNIT_5)).status, "CONDITIONAL", "inside Unit 5 the rule does not reach");
  assert.equal(askIn(adversarial, "species:except-unit", inUnit(UNIT_6)).status, "CONDITIONAL", "in Unit 6 it does");
});

test("a statewide rule excepting an area found THROUGH UNITS is a closer look at a point with no unit", () => {
  const result = askIn(adversarial, "species:except-area-set", inState(insideEnvelope));
  assert.equal(result.status, "NEEDS_VERIFICATION");
  assert.ok(result.limitations.some((line) => line.text.includes("The Test WMA is excepted")));
  assert.notEqual(askIn(adversarial, "species:except-area-set", inUnit(UNIT_5)).status, "CONDITIONAL");
  assert.equal(askIn(adversarial, "species:except-area-set", inUnit(UNIT_6)).status, "CONDITIONAL");
});

test("a statewide rule excepting a PUBLISHED OVERLAY is tested at the point itself, with no unit", () => {
  /* Outside the overlay's proven envelope it certainly does not contain the point. */
  assert.equal(askIn(adversarial, "species:except-overlay", inState()).status, "CONDITIONAL");
  /* Inside it, the overlay read at the point decides. */
  assert.equal(askIn(adversarial, "species:except-overlay", inState({ ...insideEnvelope, overlays: new Set() })).status, "CONDITIONAL");
  assert.notEqual(
    askIn(adversarial, "species:except-overlay", inState({ ...insideEnvelope, overlays: new Set(["special:park-overlay"]) })).status,
    "CONDITIONAL",
    "inside the park the statewide rule does not reach",
  );
  /* And an overlay that could not be read is not an overlay with nothing in it. */
  assert.equal(askIn(adversarial, "species:except-overlay", inState({ ...insideEnvelope, overlays: null })).status, "NEEDS_VERIFICATION");
});

test("a statewide rule excepting an area with no testable boundary is a closer look at a point with no unit", () => {
  for (const speciesId of ["species:except-words", "species:except-partial"]) {
    const result = askIn(adversarial, speciesId, inState(insideEnvelope));
    assert.equal(result.status, "NEEDS_VERIFICATION", speciesId);
    assert.equal(result.season, undefined, speciesId);
  }
  /* The partial one is ruled out where a unit proves the point is elsewhere. */
  assert.equal(askIn(adversarial, "species:except-partial", inUnit(UNIT_6)).status, "CONDITIONAL");
});

test("a dispute a statewide rule carries for one zone is a closer look at a point with no zone, not a conflict and not the statewide answer", () => {
  const result = askIn(adversarial, "species:disputed", inState(insideEnvelope));
  assert.equal(result.status, "NEEDS_VERIFICATION", "whether the disagreement reaches the point is the unknown");
  assert.ok(result.limitations.some((line) => line.text.includes("correction notice") && line.text.includes("not in a zone")));
  /* Positive controls: in the disputed zone the sources conflict; elsewhere they do not. */
  assert.equal(askIn(adversarial, "species:disputed", inUnit(UNIT_5)).status, "CONFLICT");
  assert.equal(askIn(adversarial, "species:disputed", inUnit(UNIT_6)).status, "CONDITIONAL");
});

test("a requirement scoped to named units is never silently dropped at a point with no unit", () => {
  const result = askIn(adversarial, "species:zone-condition", inState(insideEnvelope));
  assert.equal(result.status, "NEEDS_VERIFICATION");
  assert.ok(result.limitations.some((line) => line.text.includes("discharge permit") && line.text.includes("not in a unit")));
  /* Positive controls: the requirement binds in Unit 5 and not in Unit 6. */
  const unit5 = askIn(adversarial, "species:zone-condition", inUnit(UNIT_5));
  assert.equal(unit5.status, "CONDITIONAL");
  assert.ok(unit5.requirements.some((line) => line.includes("discharge permit")));
  const unit6 = askIn(adversarial, "species:zone-condition", inUnit(UNIT_6));
  assert.equal(unit6.status, "CONDITIONAL");
  assert.ok(!unit6.requirements.some((line) => line.includes("discharge permit")));
});

test("a group rule never matches a point with no zone, and its silence there is never a closure", () => {
  /* Where an unlisted place is CLOSED, a point with no zone has not been shown to be unlisted. */
  const result = askIn(closedWorld, "species:group-only", inState(insideEnvelope));
  assert.equal(result.status, "UNKNOWN");
  assert.equal(result.season, undefined);
  /* Positive controls: the same closed-world bundle does close an unlisted unit, and opens the listed one. */
  assert.equal(askIn(closedWorld, "species:group-only", inUnit(UNIT_6)).status, "CLOSED");
  assert.equal(askIn(closedWorld, "species:group-only", inUnit(UNIT_5)).status, "CONDITIONAL");
});

test("the geography primitive: an excepted unit is a world of its own, and never an area", () => {
  const groups = new Map(adversarial.groups.map((group) => [group.id, group]));
  const place = inState();
  const exceptUnit = adversarial.rules.find((candidate) => candidate.id === "except-unit")!;
  const { worlds } = placeWorlds(adversarial, place, [exceptUnit]);
  assert.deepEqual(worlds.map((world) => world.unplacedUnit ?? "none").sort(), ["5", "none"]);
  assert.ok(worlds.every((world) => world.area === null), "no world invents an area for a point with no zone");
  assert.deepEqual(worlds.map((world) => appliesInWorld(exceptUnit, groups, place, world)).sort(), [false, true]);
  /* A unit rule matches in none of those worlds, including the one in which the point lies in Unit 5. */
  const unitRule = bundle.rules.find((candidate) => candidate.id === "grouse-unit-5")!;
  assert.ok(worlds.every((world) => !appliesInWorld(unitRule, groups, place, world)));
});
