import assert from "node:assert/strict";
import test from "node:test";
import { generalConditions, isMaterial, markableConditions, statedConditionIsMaterial, zoneWearsMarker, type ScopedCondition } from "./condition-scope.ts";
import type { ConditionScope, RegulatoryConditionKind } from "../regulatory/condition.ts";

const condition = (id: string, category?: RegulatoryConditionKind, scope?: ConditionScope): ScopedCondition => ({
  id,
  kind: "STATED_CONDITION",
  text: id,
  lang: "en-CA",
  owner: "NORTH_GROUND",
  ...(category ? { category } : {}),
  ...(scope ? { scope } : {}),
  material: statedConditionIsMaterial(category, scope),
});

/* The conditions that drove 2,682 of 2,993 green zones to wear a `!` on
   2026-09-30, and the specific ones among them. `condition-scope.ts` has the
   measurement. */
const ONTARIO_LICENCE = condition("condition:ca-on-small-game-licence", "LICENCE", "JURISDICTION");
const ALBERTA_LICENCE = condition("ab-game-bird-licence", "LICENCE", "JURISDICTION");
const MANITOBA_PROJECTILE = condition("ca-mb-upland-no-single-projectile", "METHOD", "JURISDICTION");
const BC_BAG_LIMIT = condition("condition:bf9cd28c", "HARVEST_LIMIT");
const WMU_936_PERMIT = condition("ab-wmu-936-discharge-permit", "ADDITIONAL_PERMIT", "ZONE");
const MANITOBA_ORANGE = condition("ca-mb-upland-hunter-orange", "HUNTER_ORANGE", "ZONE");
const ONTARIO_MOOSE_TAG = condition("moose-tag", "TAG_OR_DRAW", "JURISDICTION");

test("the ordinary licence, a species-wide method rule and a bag limit earn no marker", () => {
  for (const c of [ONTARIO_LICENCE, ALBERTA_LICENCE, MANITOBA_PROJECTILE, BC_BAG_LIMIT]) {
    assert.equal(isMaterial(c), false, c.id);
    assert.equal(zoneWearsMarker({ hasCurrentLegalOpportunity: true, conditions: [c] }), false, c.id);
  }
});

test("a draw tag marks every zone it applies in, because the hunt is not open to the ordinary licence", () => {
  assert.equal(isMaterial(ONTARIO_MOOSE_TAG), true);
  assert.equal(zoneWearsMarker({ hasCurrentLegalOpportunity: true, conditions: [ONTARIO_LICENCE, ONTARIO_MOOSE_TAG] }), true);
});

test("a standing rule declared for some zones marks those zones", () => {
  assert.equal(isMaterial(WMU_936_PERMIT), true);
  assert.equal(isMaterial(MANITOBA_ORANGE), true);
  assert.deepEqual(
    markableConditions([ONTARIO_LICENCE, WMU_936_PERMIT, BC_BAG_LIMIT]).map((c) => c.id),
    ["ab-wmu-936-discharge-permit"],
  );
});

test("an unclassified condition keeps its marker, because the two failures are not symmetrical", () => {
  /*
   * An over-marked map costs a hunter an ignored `!`; an under-marked one costs
   * them a restriction they never saw and that applied to them. So a condition
   * nobody classified is treated as material — and `condition-kinds.test.ts`
   * refuses to let one ship.
   */
  assert.equal(statedConditionIsMaterial(undefined, undefined), true);
  assert.equal(zoneWearsMarker({ hasCurrentLegalOpportunity: true, conditions: [condition("unclassified")] }), true);
});

test("the flag decided once travels with the condition and is not re-decided", () => {
  const asked = { ...condition("dimension"), kind: "ASKED_DIMENSION" as const, material: false };
  assert.equal(isMaterial(asked), false, "an asked dimension every answer opens");
  const legacy = { ...condition("legacy"), kind: "ASKED_DIMENSION" as const } as ScopedCondition;
  delete (legacy as { material?: boolean }).material;
  assert.equal(isMaterial(legacy), true, "an asked dimension from an older payload keeps its marker");
});

test("the marker never appears without a legal opportunity to qualify", () => {
  assert.equal(zoneWearsMarker({ hasCurrentLegalOpportunity: false, conditions: [WMU_936_PERMIT] }), false);
  assert.equal(zoneWearsMarker(undefined), false);
  assert.equal(zoneWearsMarker({ hasCurrentLegalOpportunity: true, conditions: [] }), false);
});

test("zooming onto the zones that share a condition does not disarm it", () => {
  /*
   * THE FAILURE A COUNTED DENOMINATOR WOULD CAUSE, and the reason this module
   * counts nothing. Manitoba's hunter-orange condition is on 11 of 59 open
   * zones. Point the map at only those eleven and a viewport share reads 11/11
   * — universal — and the marker would vanish exactly where the hunter looks.
   * Scope is declared, so one zone answers as fifty-nine do.
   */
  const one = [{ opportunity: { hasCurrentLegalOpportunity: true, conditions: [MANITOBA_ORANGE] } }];
  const many = Array.from({ length: 59 }, (_, i) => ({
    opportunity: { hasCurrentLegalOpportunity: true, conditions: i < 11 ? [MANITOBA_ORANGE] : [] },
  }));
  assert.deepEqual(generalConditions(one), [], "never general, however few zones are in view");
  assert.deepEqual(generalConditions(many), []);
  assert.equal(zoneWearsMarker(one[0].opportunity), true);
});

test("the said-once list holds standing jurisdiction-wide requirements, deduplicated", () => {
  const states = [
    { opportunity: { hasCurrentLegalOpportunity: true, conditions: [ONTARIO_LICENCE] } },
    { opportunity: { hasCurrentLegalOpportunity: true, conditions: [ONTARIO_LICENCE] } },
    { opportunity: { hasCurrentLegalOpportunity: true, conditions: [ALBERTA_LICENCE, WMU_936_PERMIT, BC_BAG_LIMIT, ONTARIO_MOOSE_TAG] } },
  ];
  assert.deepEqual(
    generalConditions(states).map((c) => c.id),
    ["condition:ca-on-small-game-licence", "ab-game-bird-licence"],
    "one entry per condition; the zone permit and the tag are markers, and a bag limit differs by unit",
  );
});

test("an UNKNOWN or closed zone contributes nothing to what is stated as settled", () => {
  assert.deepEqual(
    generalConditions([{ state: "UNKNOWN", opportunity: { hasCurrentLegalOpportunity: true, conditions: [ONTARIO_LICENCE] } }]),
    [],
  );
  assert.deepEqual(
    generalConditions([{ opportunity: { hasCurrentLegalOpportunity: true, coverage: "UNKNOWN", conditions: [ONTARIO_LICENCE] } }]),
    [],
  );
  assert.deepEqual(
    generalConditions([{ opportunity: { hasCurrentLegalOpportunity: false, conditions: [ONTARIO_LICENCE] } }]),
    [],
  );
});

test("a claimed condition with nothing to inspect keeps its marker", () => {
  assert.equal(zoneWearsMarker({ hasCurrentLegalOpportunity: true, hasMaterialConditions: true }), true);
  assert.equal(zoneWearsMarker({ hasCurrentLegalOpportunity: true, hasMaterialConditions: true, conditions: [] }), true);
  /* A listed condition that inspects as standing is not marked — the flag does
     not override an inspection that succeeded. */
  assert.equal(zoneWearsMarker({ hasCurrentLegalOpportunity: true, hasMaterialConditions: true, conditions: [ONTARIO_LICENCE] }), false);
  assert.equal(zoneWearsMarker({ hasCurrentLegalOpportunity: false, hasMaterialConditions: true }), false);
});
