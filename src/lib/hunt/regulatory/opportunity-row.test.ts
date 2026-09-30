import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  availableChoices, COMPARATOR_SYMBOL, criterionText, groupOpportunities, matchingOpportunities,
  opportunityIdentity, sameOpportunity, satisfiesCriterion,
  type PhysicalCriterion, type ResolvedOpportunity,
} from "./opportunity-row.ts";

const words = (text: string, lang: "en-CA" | "fr-CA" = "fr-CA") =>
  ({ owner: "AUTHORITY", text, sourceId: "source:test", citation: "test", lang } as const);

/* Québec's two complementary white-tailed deer classes, verbatim from
   `ca-qc-2026.json`. They meet exactly at 7 cm. */
const ANTLERED_7CM: PhysicalCriterion = {
  dimension: "ANTLER_LENGTH",
  comparator: "AT_LEAST",
  figure: { value: 7, unit: "cm" },
  words: words("Cerf de Virginie avec bois (7 cm ou plus)"),
};
const ANTLERLESS_UNDER_7CM: PhysicalCriterion = {
  dimension: "ANTLER_LENGTH",
  comparator: "LESS_THAN",
  figure: { value: 7, unit: "cm" },
  words: words("Cerf de Virginie femelle ou mâle avec bois de moins de 7 cm"),
};

const row = (over: Partial<ResolvedOpportunity> = {}): ResolvedOpportunity => ({
  ruleId: "regulatory_rule:test",
  speciesId: "species:white-tailed-deer",
  animalClass: "ANTLERED",
  criterion: null,
  implements: ["RIFLE"],
  windows: [{ opens: "2026-10-01", closes: "2026-10-14", datesInclusive: true }],
  conditionIds: [],
  ...over,
});

test("the boundary belongs to one class, and the two never present the same", () => {
  /*
   * THE CASE THE MODEL EXISTS FOR. An antler of exactly 7.0 cm is ANTLERED in
   * Québec and is not ANTLERLESS. Render both thresholds as "7 cm" and a hunter
   * standing over that animal is told the opposite of the law in one of the two
   * directions — and it is the direction where they take an animal they may not.
   */
  assert.equal(satisfiesCriterion(ANTLERED_7CM, 7), true, "exactly 7 cm IS antlered");
  assert.equal(satisfiesCriterion(ANTLERLESS_UNDER_7CM, 7), false, "and is NOT antlerless");
  assert.equal(satisfiesCriterion(ANTLERED_7CM, 6.9), false);
  assert.equal(satisfiesCriterion(ANTLERLESS_UNDER_7CM, 6.9), true);

  assert.notEqual(
    criterionText(ANTLERED_7CM),
    criterionText(ANTLERLESS_UNDER_7CM),
    "two thresholds that decide opposite answers must never read identically",
  );
  assert.equal(criterionText(ANTLERED_7CM), "≥ 7 cm");
  assert.equal(criterionText(ANTLERLESS_UNDER_7CM), "< 7 cm");
});

test("every comparator has its own symbol, so none can stand in for another", () => {
  const symbols = Object.values(COMPARATOR_SYMBOL);
  assert.equal(new Set(symbols).size, symbols.length, `two comparators share a symbol: ${symbols.join(" ")}`);
  /* `>` and `≥` are the pair that decides the boundary, so they are checked by
     name rather than only by the uniqueness count above. */
  assert.notEqual(COMPARATOR_SYMBOL.AT_LEAST, COMPARATOR_SYMBOL.GREATER_THAN);
});

test("an authority's own second figure is shown; a conversion of ours is not", () => {
  /*
   * A regulation stating "10.2 cm (4 in)" published both, and both are its own.
   * North Ground converting 7 cm into inches would be OUR number wearing the
   * authority's citation, so there is no code path that produces one.
   */
  const both: PhysicalCriterion = {
    ...ANTLERED_7CM,
    comparator: "GREATER_THAN",
    figure: { value: 10.2, unit: "cm" },
    alsoPublishedAs: [{ value: 4, unit: "in" }],
  };
  assert.equal(criterionText(both), "> 10.2 cm (4 in)");
  assert.equal(criterionText(ANTLERED_7CM), "≥ 7 cm", "with no second figure, none is invented");
});

test("Québec's 7 cm is the only physical criterion the certified bundles hold", () => {
  /*
   * MEASURED, because the brief specified this model from an example that is not
   * in the data: "Alberta's as > 10.2 cm / > 4 in". Alberta's rules carry no
   * animal-class field at all, and the only "10.2" in the corpus is Manitoba's
   * SECTION NUMBER, `s. 10.2(1)`.
   *
   * This test is what stops the model being populated from an imagined
   * jurisdiction. It fails the day another authority's threshold lands, which
   * is the moment to extract it rather than assume it.
   */
  const quebec = JSON.parse(readFileSync(new URL("../../../../content/regulatory/ca-qc-2026.json", import.meta.url), "utf8")) as {
    rules?: Array<{ classLabel?: string | null }>;
  };
  const thresholds = new Set(
    (quebec.rules ?? []).map((rule) => rule.classLabel).filter((label): label is string => Boolean(label) && /\d\s*cm/.test(label!)),
  );
  assert.deepEqual([...thresholds].sort(), [
    "Cerf de Virginie avec bois (7 cm ou plus)",
    "Cerf de Virginie femelle ou mâle avec bois de moins de 7 cm",
  ], "Québec's two complementary classes, verbatim");

  const alberta = JSON.parse(readFileSync(new URL("../../../../content/regulatory/ca-ab-2026.json", import.meta.url), "utf8")) as {
    rules?: Array<Record<string, unknown>>;
  };
  assert.equal(
    (alberta.rules ?? []).filter((rule) => rule.animalClasses || rule.classLabel).length,
    0,
    "if Alberta gains classes, this model must be populated from its own figures rather than assumed",
  );
});

test("dates may differ within a group; anything legal never merges", () => {
  /*
   * "Grouping truly identical opportunities and never merging legally distinct
   * ones because their dates overlap." So the identity is built from the legal
   * facts and the dates are deliberately absent from it.
   */
  const october = row({ windows: [{ opens: "2026-10-01", closes: "2026-10-14", datesInclusive: true }] });
  const november = row({ windows: [{ opens: "2026-11-01", closes: "2026-11-20", datesInclusive: true }] });
  assert.equal(sameOpportunity(october, november), true, "same legal facts, different dates: one opportunity");

  /* Each of these changes what is legal, so each must split the group — even
     though the dates are identical and overlapping. */
  for (const [what, changed] of [
    ["animal class", row({ animalClass: "ANTLERLESS" })],
    ["implement", row({ implements: ["BOW"] })],
    ["criterion", row({ criterion: ANTLERED_7CM })],
    ["conditions", row({ conditionIds: ["condition:draw"] })],
    ["species", row({ speciesId: "species:mule-deer" })],
  ] as const) {
    assert.equal(sameOpportunity(october, changed), false, `${what} differs: these are two opportunities`);
  }

  const groups = groupOpportunities([october, november, row({ animalClass: "ANTLERLESS" })]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].rows.length, 2, "the two date ranges of one opportunity group");
  assert.equal(groups[0].windows.length, 2, "and both windows survive into the timeline");
});

test("two comparators on the same dimension are two opportunities", () => {
  /* The Québec pair again, at the grouping level: identical species, dates and
     implements, and the only difference is the threshold that decides which
     animal may be taken. Merging them would present one season. */
  const antlered = row({ animalClass: "ANTLERED", criterion: ANTLERED_7CM });
  const antlerless = row({ animalClass: "ANTLERLESS", criterion: ANTLERLESS_UNDER_7CM });
  assert.equal(sameOpportunity(antlered, antlerless), false);
  assert.equal(groupOpportunities([antlered, antlerless]).length, 2);
});

test("implement sets cannot collide into one identity", () => {
  /* A separator that can occur inside a token would make ["BOW","GUN"] and
     ["BOWGUN"] the same key, silently merging two opportunities. */
  assert.notEqual(
    opportunityIdentity(row({ implements: ["BOW", "GUN"] })),
    opportunityIdentity(row({ implements: ["BOWGUN"] })),
  );
  /* And the same set in two orders is ONE opportunity, not two. */
  assert.equal(
    opportunityIdentity(row({ implements: ["BOW", "RIFLE"] })),
    opportunityIdentity(row({ implements: ["RIFLE", "BOW"] })),
  );
});

test("an unstated class is one state, and never folds into a stated one", () => {
  assert.equal(sameOpportunity(row({ animalClass: null }), row({ animalClass: null })), true);
  assert.equal(sameOpportunity(row({ animalClass: null }), row({ animalClass: "ANTLERED" })), false);
});

test("a filter offers only what the rows in context actually support", () => {
  /*
   * A control offering a choice no opportunity has answers "nothing here" for a
   * reason the hunter cannot see — and it is how a filter written against
   * Québec's vocabulary comes to offer Québec's classes in Ontario.
   */
  const rows = [row({ animalClass: "ANTLERED", implements: ["RIFLE"] }), row({ animalClass: "ANTLERLESS", implements: ["BOW", "RIFLE"] })];
  assert.deepEqual(availableChoices(rows), { animalClasses: ["ANTLERED", "ANTLERLESS"], implements: ["BOW", "RIFLE"] });
  assert.deepEqual(availableChoices([]), { animalClasses: [], implements: [] }, "no rows offers no choices, never a default list");
  assert.deepEqual(
    availableChoices([row({ animalClass: null, implements: [] })]),
    { animalClasses: [], implements: [] },
    "an unstated fact is not a choice",
  );
});

test("filtering never hides an opportunity whose authority stated no such fact", () => {
  /*
   * THE DANGEROUS DIRECTION. A rule with no stated animal class is not a rule
   * about some OTHER class — it applies whatever the animal is. Dropping it
   * under a class filter would hide a real opportunity behind a control, and
   * the hunter would read North Ground's "no results" as the law's.
   */
  const unstated = row({ animalClass: null, implements: [] });
  const antlered = row({ animalClass: "ANTLERED", implements: ["RIFLE"] });
  const antlerless = row({ animalClass: "ANTLERLESS", implements: ["BOW"] });

  const byClass = matchingOpportunities([unstated, antlered, antlerless], { animalClass: "ANTLERED" });
  assert.equal(byClass.length, 2, "the antlered row and the one that states no class");
  assert.ok(byClass.includes(unstated));
  assert.ok(!byClass.includes(antlerless));

  const byImplement = matchingOpportunities([unstated, antlered, antlerless], { implement: "BOW" });
  assert.deepEqual(byImplement, [unstated, antlerless]);

  /* No filter is not an empty filter. */
  assert.equal(matchingOpportunities([unstated, antlered, antlerless], {}).length, 3);
  assert.equal(matchingOpportunities([unstated, antlered, antlerless], { animalClass: null }).length, 3);
});

test("the row contract carries no status, because status is the engine's answer", () => {
  /*
   * A row says what opportunity exists; whether it is open to this hunter on
   * this date is the regulatory engine's output. A `status` here would be a
   * second place to decide legality, which §41B forbids — and the first thing a
   * surface would read instead of asking the engine.
   */
  const keys = Object.keys(row());
  for (const forbidden of ["status", "legal", "open", "green"]) {
    assert.ok(!keys.some((key) => key.toLowerCase().includes(forbidden)), `a row must not carry "${forbidden}"`);
  }
});
