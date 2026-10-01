import assert from "node:assert/strict";
import test from "node:test";
import bundle from "../../../../content/regulatory/ca-on-major-game-2026.json" with { type: "json" };
import { classesFor, satisfies } from "./physical-criterion.ts";

/**
 * ONTARIO'S ANTLER BOUNDARY, TESTED BECAUSE NOTHING WAS TESTING IT.
 *
 * Found by mutation rather than by reading: changing 7.5 cm to 8.5 cm in the
 * builder, rebuilding the bundle and running the whole suite passed, all 2,159
 * tests. Québec's 7 cm and 10 cm are both pinned by `quebec-animal-class.test.ts`
 * — which I wrote in the same session as I encoded Ontario's, and did not mirror.
 * A legal threshold a hunter measures an antler against, with nothing holding it
 * in place, could have drifted on any edit or any rebuild from a changed page and
 * nothing would have said so.
 *
 * WHAT MAKES ONTARIO'S DIFFERENT FROM QUÉBEC'S is the half worth testing hardest.
 * Ontario writes "at least 1 ANTLER of at least 7.5 centimetres long", which
 * states the aggregation — ANY_SIDE. Québec writes « dont les bois mesurent 7 cm
 * ou plus » and states neither one antler nor both, so it is UNSTATED. Same
 * measure, same comparator, different thresholds, different aggregations: four
 * facts, and only one of them is the number.
 */

const deer = classesFor(bundle as never, "species:white-tailed-deer");
const antlered = deer.find((entry) => entry.id.endsWith("deer-antlered"))!;

test("the boundary is at exactly 7.5 cm, and 7.5 is antlered", () => {
  const criterion = antlered.criterion!;
  assert.deepEqual(criterion.published, [{ value: 7.5, unit: "cm" }],
    "the threshold itself — this is the assertion whose absence let a mutation pass");
  assert.equal(satisfies(criterion, { value: 7.4, unit: "cm" }), false);
  assert.equal(satisfies(criterion, { value: 7.5, unit: "cm" }), true, "“at least 7.5” includes 7.5");
  assert.equal(satisfies(criterion, { value: 7.6, unit: "cm" }), true);
  assert.equal(criterion.comparator, "AT_LEAST",
    "inclusive; Alberta's “exceeding 10.2 cm” is a different law and must not inherit this one");
});

test("Ontario states its aggregation and Québec does not, and the words are why", () => {
  /* "at least 1 antler" is an explicit ANY_SIDE test: one antler reaching the
     threshold makes the animal antlered, whatever the other does. Québec's
     « dont les bois mesurent » says neither, and guessing between one and both
     changes which animals are legal — so Québec's stays UNSTATED and this one
     must not be quietly levelled to match it. */
  assert.equal(antlered.criterion!.aggregation, "ANY_SIDE");
  assert.match(antlered.criterion!.statedAs, /at least 1 antler of at least 7\.5 centimetres long/);
  assert.equal(antlered.criterion!.statedLanguage, "en");
  assert.equal(antlered.criterion!.sourceSection, "Deer hunting requirements");
});

test("antlerless is the negation, and is not a statement about sex", () => {
  /*
   * Ontario's own hedge is why §16 keeps sex out of it: antlerless "GENERALLY
   * include adult female deer and fawns of both sexes". A buck that has dropped
   * its antlers is antlerless here, so anything encoding antlerless as female is
   * wrong against the authority's own wording.
   */
  const antlerless = deer.find((entry) => entry.id.endsWith("deer-antlerless"))!;
  assert.equal(antlerless.criterionStatus, "BY_NEGATION");
  assert.equal(antlerless.negates, antlered.id);
  assert.equal(antlerless.criterion, undefined, "a second threshold could drift from the first");
  assert.ok(!JSON.stringify(antlerless).toLowerCase().includes("female"),
    "antlerless is not a statement about sex");
  /* And the two classes meet exactly at the boundary: 7.5 is antlered, so it is
     not antlerless. */
  assert.equal(satisfies(antlered.criterion!, { value: 7.5, unit: "cm" }), true);
});

test("the rules reach this class by id, not by the word", () => {
  /* The word is a filter; it is not an identity. Québec's « avec bois (norme
     RTLB) » also flattens to ANTLERED and is a different legal test, which is
     the defect `legalAnimalClassIds` exists to prevent. */
  const rules = (bundle as unknown as { rules: Array<{ speciesId: string; legalAnimalClassIds?: string[] }> }).rules;
  const deerRules = rules.filter((rule) => rule.speciesId === "species:white-tailed-deer");
  assert.ok(deerRules.length > 50, `only ${deerRules.length} Ontario deer rules`);
  const linked = deerRules.filter((rule) => (rule.legalAnimalClassIds ?? []).includes(antlered.id));
  assert.ok(linked.length > 50, `only ${linked.length} deer rules name the antlered class by id`);
});
