import assert from "node:assert/strict";
import test from "node:test";
import { generalConditions, isContextual, markableConditions, zoneWearsMarker, type ScopedCondition } from "./condition-scope.ts";

const condition = (id: string, scope?: "JURISDICTION" | "ZONE"): ScopedCondition => ({
  id,
  kind: "STATED_CONDITION",
  text: id,
  lang: "en-CA",
  owner: "NORTH_GROUND",
  ...(scope ? { scope } : {}),
}) as ScopedCondition;

/* The three universal and three specific conditions measured on one viewport,
   2026-09-30, ruffed grouse. The shares are in `condition-scope.ts`. */
const ONTARIO_LICENCE = condition("condition:ca-on-small-game-licence", "JURISDICTION");
const ALBERTA_LICENCE = condition("ab-game-bird-licence", "JURISDICTION");
const WMU_936_PERMIT = condition("ab-wmu-936-discharge-permit", "ZONE");
const MANITOBA_ORANGE = condition("ca-mb-upland-hunter-orange", "ZONE");

test("a jurisdiction-wide condition is said once; a zone condition earns a marker", () => {
  assert.equal(isContextual(ONTARIO_LICENCE), false);
  assert.equal(isContextual(WMU_936_PERMIT), true);
  assert.deepEqual(
    markableConditions([ONTARIO_LICENCE, WMU_936_PERMIT]).map((c) => c.id),
    ["ab-wmu-936-discharge-permit"],
  );
});

test("an undeclared scope keeps its marker, because the two failures are not symmetrical", () => {
  /*
   * The default matters more than the rule. An over-marked map costs a hunter
   * an ignored `!`; an under-marked one costs them a restriction they never saw
   * and that applied to them. So a condition whose record has not declared a
   * scope is treated as specific, and the map keeps saying so until someone
   * decides otherwise.
   */
  assert.equal(isContextual(condition("ca-mb-upland-no-single-projectile")), true);
  assert.equal(zoneWearsMarker({ hasCurrentLegalOpportunity: true, conditions: [condition("undeclared")] }), true);
});

test("the marker never appears without a legal opportunity to qualify", () => {
  /* On its own a `!` reads as a warning about a hunt that does not exist. */
  assert.equal(zoneWearsMarker({ hasCurrentLegalOpportunity: false, conditions: [WMU_936_PERMIT] }), false);
  assert.equal(zoneWearsMarker(undefined), false);
  assert.equal(zoneWearsMarker({ hasCurrentLegalOpportunity: true, conditions: [] }), false);
  /* And a zone whose only condition is said once does not wear one either —
     which is the whole point: Ontario's 150 zones lose their markers. */
  assert.equal(zoneWearsMarker({ hasCurrentLegalOpportunity: true, conditions: [ONTARIO_LICENCE] }), false);
});

test("zooming onto the zones that share a condition does not disarm it", () => {
  /*
   * THE FAILURE A COUNTED DENOMINATOR WOULD CAUSE, and the reason this module
   * counts nothing. Manitoba's hunter-orange condition is on 11 of 59 open
   * zones, so it is specific. Point the map at only those eleven and a viewport
   * share reads 11/11 — universal — and the marker vanishes exactly where the
   * hunter is looking. Scope is declared, so the same answer comes back from
   * one zone as from fifty-nine.
   */
  const one = [{ opportunity: { hasCurrentLegalOpportunity: true, conditions: [MANITOBA_ORANGE] } }];
  const many = Array.from({ length: 59 }, (_, i) => ({
    opportunity: { hasCurrentLegalOpportunity: true, conditions: i < 11 ? [MANITOBA_ORANGE] : [] },
  }));
  assert.deepEqual(generalConditions(one), [], "never general, however few zones are in view");
  assert.deepEqual(generalConditions(many), []);
  assert.equal(zoneWearsMarker(one[0].opportunity), true);
});

test("the said-once list is deduplicated and per-layer, not per-zone", () => {
  const states = [
    { opportunity: { hasCurrentLegalOpportunity: true, conditions: [ONTARIO_LICENCE] } },
    { opportunity: { hasCurrentLegalOpportunity: true, conditions: [ONTARIO_LICENCE] } },
    { opportunity: { hasCurrentLegalOpportunity: true, conditions: [ALBERTA_LICENCE, WMU_936_PERMIT] } },
  ];
  assert.deepEqual(
    generalConditions(states).map((c) => c.id),
    ["condition:ca-on-small-game-licence", "ab-game-bird-licence"],
    "one entry per condition, and the zone-scoped permit is not among them",
  );
});

test("an UNKNOWN zone contributes nothing to what is stated as settled", () => {
  /*
   * §8: never convert "I could not find a restriction" into a claim, in either
   * direction. A zone North Ground cannot determine has no established
   * conditions, so harvesting its list would put an unresolved record into the
   * legend as though it were settled.
   */
  assert.deepEqual(
    generalConditions([{ state: "UNKNOWN", opportunity: { hasCurrentLegalOpportunity: true, conditions: [ONTARIO_LICENCE] } }]),
    [],
  );
  assert.deepEqual(
    generalConditions([{ opportunity: { hasCurrentLegalOpportunity: true, coverage: "UNKNOWN", conditions: [ONTARIO_LICENCE] } }]),
    [],
  );
  /* A closed zone likewise: its conditions describe a hunt that is not on. */
  assert.deepEqual(
    generalConditions([{ opportunity: { hasCurrentLegalOpportunity: false, conditions: [ONTARIO_LICENCE] } }]),
    [],
  );
});

test("a claimed condition with nothing to inspect keeps its marker", () => {
  /*
   * `hasMaterialConditions` is derived from the list in production, so they
   * cannot normally disagree — but a fixture in `cartography.test.ts` sets the
   * flag without the list, and that is the shape of a real hazard: an answer
   * asserting a material condition this code cannot read. It has not been shown
   * to be general, so it keeps the `!`. Dropping it would hide a restriction a
   * hunter was told exists.
   */
  assert.equal(zoneWearsMarker({ hasCurrentLegalOpportunity: true, hasMaterialConditions: true }), true);
  assert.equal(zoneWearsMarker({ hasCurrentLegalOpportunity: true, hasMaterialConditions: true, conditions: [] }), true);
  /* But a listed, jurisdiction-wide condition is still said once — the flag
     does not override an inspection that succeeded. */
  assert.equal(
    zoneWearsMarker({ hasCurrentLegalOpportunity: true, hasMaterialConditions: true, conditions: [condition("x", "JURISDICTION")] }),
    false,
  );
  /* And the flag never conjures a marker without an opportunity. */
  assert.equal(zoneWearsMarker({ hasCurrentLegalOpportunity: false, hasMaterialConditions: true }), false);
});
