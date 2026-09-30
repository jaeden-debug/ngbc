import assert from "node:assert/strict";
import { test } from "node:test";
import { criterionSummary, satisfies, type LegalAnimalClass, type PhysicalCriterion } from "./physical-criterion.ts";

/* The three provisions the model was built from, as read from the guides. */

const QUEBEC: PhysicalCriterion = {
  measure: "ANTLER_LENGTH", comparator: "AT_LEAST",
  published: [{ value: 7, unit: "cm" }], aggregation: "ANY_SIDE",
  statedAs: "Cerf de Virginie avec bois (7 cm ou plus)", statedLanguage: "fr",
  sourceId: "source:ca-qc-hunting-guide",
};

const ONTARIO: PhysicalCriterion = {
  measure: "ANTLER_LENGTH", comparator: "AT_LEAST",
  published: [{ value: 7.5, unit: "cm" }], aggregation: "ANY_SIDE",
  statedAs: "at least 1 antler of at least 7.5 centimetres long", statedLanguage: "en",
  sourceId: "source:ca-on-hunting-regulations",
};

const ALBERTA: PhysicalCriterion = {
  measure: "ANTLER_LENGTH", comparator: "EXCEEDING",
  published: [{ value: 10.2, unit: "cm" }, { value: 4, unit: "in" }], aggregation: "ANY_SIDE",
  statedAs: "having an antler exceeding 10.2 cm (4 in.) in length", statedLanguage: "en",
  sourceId: "source:ca-ab-hunting-guide",
};

test("the comparator is the law, not the number", () => {
  /*
   * The defect this model exists to prevent. Alberta's test is EXCEEDING where
   * Ontario's and Québec's are AT LEAST, so an antler measuring exactly the
   * threshold is legal in two jurisdictions and not in the third. A schema
   * carrying only a value would have made that animal legal in Alberta — a
   * wrong answer at the moment of the shot, from a field that looked complete.
   */
  assert.equal(satisfies(ALBERTA, { value: 10.2, unit: "cm" }), false, "Alberta: exactly 10.2 cm does not exceed 10.2 cm");
  assert.equal(satisfies(ALBERTA, { value: 10.3, unit: "cm" }), true);
  assert.equal(satisfies(QUEBEC, { value: 7, unit: "cm" }), true, "Québec: exactly 7 cm is 7 cm or more");
  assert.equal(satisfies(ONTARIO, { value: 7.5, unit: "cm" }), true);
  assert.equal(satisfies(ONTARIO, { value: 7.4, unit: "cm" }), false);
});

test("both published units are the authority's, and neither is converted", () => {
  /* Alberta prints 10.2 cm and 4 in. Both are carried; a measurement in a unit
     the authority did not publish is UNCOMPARABLE rather than converted, because
     the conversion would be ours and the legal test is theirs. */
  assert.equal(satisfies(ALBERTA, { value: 4, unit: "in" }), false, "4 in does not exceed 4 in");
  assert.equal(satisfies(ALBERTA, { value: 4.1, unit: "in" }), true);
  assert.equal(satisfies(ONTARIO, { value: 3, unit: "in" }), "UNCOMPARABLE", "Ontario publishes no inch figure");
  assert.equal(criterionSummary(ALBERTA), "> 10.2 cm / > 4 in");
  assert.equal(criterionSummary(QUEBEC), "≥ 7 cm");
});

test("the criterion belongs to a class, and a class may span species", () => {
  /* Alberta's one definition governs deer, moose and elk; Ontario's is deer
     only. Attaching the criterion to the species rule would have duplicated
     Alberta's test four times and let the copies drift. */
  const albertaAntlered: LegalAnimalClass = {
    id: "class:ca-ab-antlered", statedAs: "antlered", statedLanguage: "en",
    appliesToSpecies: ["species:white-tailed-deer", "species:mule-deer", "species:moose", "species:elk"],
    criterionStatus: "STATED", criterion: ALBERTA, sourceId: "source:ca-ab-hunting-guide",
  };
  assert.equal(albertaAntlered.appliesToSpecies.length, 4);
  assert.ok(albertaAntlered.appliesToSpecies.includes("species:moose"));
});

test("antlerless is the negation, and is never sex", () => {
  /*
   * Ontario and Alberta both define antlerless as NOT antlered, so it is
   * derived rather than given its own threshold that could drift.
   *
   * And Ontario's own hedge is why §16 keeps sex out of it: antlerless
   * "GENERALLY include adult female deer and fawns of both sexes". A buck that
   * has dropped its antlers is antlerless in Ontario. Encoding antlerless as
   * female would be wrong against the authority's own wording.
   */
  const antlerless: LegalAnimalClass = {
    id: "class:ca-on-antlerless", statedAs: "antlerless", statedLanguage: "en",
    appliesToSpecies: ["species:white-tailed-deer"],
    criterionStatus: "BY_NEGATION",
    negates: "class:ca-on-antlered", sourceId: "source:ca-on-hunting-regulations",
  };
  assert.equal(antlerless.negates, "class:ca-on-antlered");
  assert.equal(antlerless.criterion, undefined, "a negation carries no threshold of its own");
  assert.ok(!JSON.stringify(antlerless).toLowerCase().includes("female"), "antlerless is not a statement about sex");
});

test("the authority's own wording survives, in its own language", () => {
  assert.equal(QUEBEC.statedLanguage, "fr");
  assert.ok(QUEBEC.statedAs.includes("7 cm ou plus"));
  assert.equal(ALBERTA.statedLanguage, "en");
  assert.ok(ALBERTA.statedAs.includes("(4 in.)"), "the parenthetical unit is the authority's, not a gloss");
});
