import { legalTimeNotCertified } from "./legal-time.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { evaluateConditional, type ConditionalBundle, type ConditionalRule, type ConditionalVocabulary } from "./conditional-engine.ts";
import type { HuntDimensionAnswers } from "./dimensions.ts";

/**
 * The engine's contract, on a synthetic jurisdiction.
 *
 * Nothing here is any province's law. The bundle is shaped to exercise each
 * distinction the engine promises to hold, so a change that breaks one fails
 * here regardless of which real bundle would have noticed.
 */

const DEER = "species:white-tailed-deer";

function rule(overrides: Partial<ConditionalRule> & Pick<ConditionalRule, "id">): ConditionalRule {
  return {
    speciesId: DEER,
    regulatoryGroupId: "group:unit-1",
    appliesWhen: {},
    seasonLabel: "Season",
    seasonPhrase: "Sept. 1 – Nov. 30",
    windows: [{ opensIso: "2026-09-01", closesIso: "2026-11-30" }],
    declaredNoSeason: false,
    conditionIds: [],
    caveats: [],
    notes: [],
    disputes: [],
    sourceId: "source:test-regulation",
    sourceSection: "Table 1",
    sourceVersion: "2026",
    reviewStatus: "VERIFIED",
    ...overrides,
  };
}

function bundle(rules: ConditionalRule[], absence: ConditionalBundle["absence"] = { meaning: "UNKNOWN" }): ConditionalBundle {
  return {
    bundleId: "test-2026",
    jurisdictionId: "jurisdiction:xx-yy",
    sourceVersion: "2026",
    retrievedAt: "2026-09-01",
    certifiedPeriod: { from: "2026-04-01", to: "2027-03-31" },
    absence,
    sources: [{ id: "source:test-regulation", conditions: [] }],
    groups: [
      { id: "group:unit-1", officialSpec: "1", zoneIds: ["management_zone:xx-yy-unit-1"] },
      { id: "group:unit-2", officialSpec: "2", zoneIds: ["management_zone:xx-yy-unit-2"] },
    ],
    rules,
  };
}

const VOCABULARY: ConditionalVocabulary = {
  jurisdictionName: "Testland",
  unitTerm: "Unit",
  dimensions: [
    {
      id: "RESIDENCY", question: "Residency?", reason: "It differs.", multiple: false, allowsUnsure: false, sourceId: "source:test-regulation",
      options: [{ value: "RESIDENT", label: "Resident" }, { value: "VISITOR", label: "Visitor" }],
    },
    {
      id: "LICENCE_TYPE", question: "Licence?", reason: "It differs.", multiple: false, allowsUnsure: false, sourceId: "source:test-regulation",
      options: [{ value: "RESIDENT_TAG", label: "Resident tag" }, { value: "VISITOR_TAG", label: "Visitor tag" }],
      implies: { RESIDENT_TAG: { RESIDENCY: "RESIDENT" }, VISITOR_TAG: { RESIDENCY: "VISITOR" } },
    },
    {
      id: "HUNT_METHOD", question: "Method?", reason: "It differs.", multiple: false, allowsUnsure: false, sourceId: "source:test-regulation",
      options: [{ value: "FIREARM", label: "Firearm" }, { value: "BOW", label: "Bow" }],
    },
    {
      id: "ANIMAL_CLASS:ANTLER_CLASS", question: "Antlered or antlerless?", reason: "It differs.", multiple: false, allowsUnsure: false, sourceId: "source:test-regulation",
      options: [{ value: "ANTLERED", label: "Antlered" }, { value: "ANTLERLESS", label: "Antlerless" }],
    },
  ],
  legalTime: legalTimeNotCertified("Not certified.", "test authority"),
  standingLimitations: [],
  standingSourceIds: [],
};

function evaluate(b: ConditionalBundle, date: string, answers: HuntDimensionAnswers = {}, unit = "unit-1") {
  return evaluateConditional(b, VOCABULARY, {
    speciesId: DEER, speciesName: "white-tailed deer", date, answers,
    place: { zoneId: `management_zone:xx-yy-${unit}`, zoneName: `Unit ${unit}`, latitude: 50, longitude: -100, overlays: new Set() },
  });
}

const status = (evaluation: ReturnType<typeof evaluate>) =>
  evaluation.completeness === "NEEDS_INPUT" ? `ASK ${evaluation.required?.id}` : evaluation.result?.status;

test("an unnamed place and an excluded combination can mean different things, and each says which", () => {
  const archeryOnly = [rule({ id: "r:bow", appliesWhen: { permittedImplements: ["BOW"] } })];
  const b = bundle(archeryOnly, { meaning: "UNKNOWN", excludedCombination: "CLOSED" });
  // The unit is named, but only for bows: a firearm is closed there.
  assert.equal(status(evaluate(b, "2026-10-01", { HUNT_METHOD: "FIREARM" })), "CLOSED");
  assert.equal(status(evaluate(b, "2026-10-01", { HUNT_METHOD: "BOW" })), "CONDITIONAL");
  // A unit no rule names is not something this source speaks to.
  assert.equal(status(evaluate(b, "2026-10-01", {}, "unit-2")), "UNKNOWN");
});

test("without an excluded-combination meaning, the place's meaning is used for both", () => {
  const b = bundle([rule({ id: "r:bow", appliesWhen: { permittedImplements: ["BOW"] } })], { meaning: "UNKNOWN" });
  assert.equal(status(evaluate(b, "2026-10-01", { HUNT_METHOD: "FIREARM" })), "UNKNOWN");
});

test("a rule without a fact's key applies to every value of it", () => {
  const b = bundle([
    rule({ id: "r:both-classes" }),
    rule({ id: "r:antlerless-late", appliesWhen: { "ANIMAL_CLASS:ANTLER_CLASS": "ANTLERLESS" }, windows: [{ opensIso: "2026-12-01", closesIso: "2026-12-15" }], seasonPhrase: "Dec. 1 – Dec. 15" }),
  ], { meaning: "UNKNOWN", excludedCombination: "CLOSED" });
  // In October both classes are open: nothing to ask.
  assert.equal(status(evaluate(b, "2026-10-01")), "CONDITIONAL");
  // In December only antlerless is: the class decides it, so it is asked.
  assert.equal(status(evaluate(b, "2026-12-05")), "ASK ANIMAL_CLASS:ANTLER_CLASS");
  assert.equal(status(evaluate(b, "2026-12-05", { animalClasses: [{ dimension: "ANTLER_CLASS", value: "ANTLERLESS" }] })), "CONDITIONAL");
  assert.equal(status(evaluate(b, "2026-12-05", { animalClasses: [{ dimension: "ANTLER_CLASS", value: "ANTLERED" }] })), "CLOSED");
});

test("a fact is asked only when some value of it changes the answer that day", () => {
  const b = bundle([
    rule({ id: "r:resident", appliesWhen: { RESIDENCY: "RESIDENT", LICENCE_TYPE: "RESIDENT_TAG" } }),
    rule({ id: "r:visitor", appliesWhen: { RESIDENCY: "VISITOR", LICENCE_TYPE: "VISITOR_TAG" }, windows: [{ opensIso: "2026-10-15", closesIso: "2026-11-30" }], seasonPhrase: "Oct. 15 – Nov. 30" }),
  ], { meaning: "CLOSED" });
  // 1 November: both open, closing the same day — no question.
  assert.equal(status(evaluate(b, "2026-11-01")), "CONDITIONAL");
  // 1 October: only residents — residency is asked first, though a licence implies it.
  assert.equal(status(evaluate(b, "2026-10-01")), "ASK RESIDENCY");
  // Once residency is given, the licence it implies is not asked for again.
  assert.equal(status(evaluate(b, "2026-10-01", { RESIDENCY: "VISITOR" })), "CLOSED");
});

test("an answer that contradicts another is not applied", () => {
  const b = bundle([
    rule({ id: "r:resident", appliesWhen: { RESIDENCY: "RESIDENT", LICENCE_TYPE: "RESIDENT_TAG" } }),
    rule({ id: "r:visitor", appliesWhen: { RESIDENCY: "VISITOR", LICENCE_TYPE: "VISITOR_TAG" }, windows: [{ opensIso: "2026-10-15", closesIso: "2026-11-30" }] }),
  ], { meaning: "CLOSED" });
  const evaluation = evaluate(b, "2026-10-01", { RESIDENCY: "VISITOR", LICENCE_TYPE: "RESIDENT_TAG" });
  assert.equal(evaluation.result?.status, "CLOSED");
  assert.deepEqual(evaluation.dimensions.map((dimension) => dimension.id), ["RESIDENCY"]);
});

test("a disputed reading that decides the answer is a conflict, and one that does not is disclosed", () => {
  const disputed = rule({ id: "r:disputed", disputes: [{ zoneId: "management_zone:xx-yy-unit-1", statedAs: "The range may not reach unit 1." }] });
  assert.equal(status(evaluate(bundle([disputed], { meaning: "CLOSED" }), "2026-10-01")), "CONFLICT");
  // Outside its window the disputed rule changes nothing.
  assert.equal(status(evaluate(bundle([disputed], { meaning: "CLOSED" }), "2026-12-15")), "CLOSED");
});

test("outside the certified period the engine answers nothing about the season", () => {
  const b = bundle([rule({ id: "r:any" })], { meaning: "CLOSED" });
  assert.equal(status(evaluate(b, "2027-04-01")), "NEEDS_VERIFICATION");
  assert.equal(status(evaluate(b, "2026-03-31")), "NEEDS_VERIFICATION");
});

test("a rule that has not cleared review never answers", () => {
  const b = bundle([rule({ id: "r:draft", reviewStatus: "DRAFT" })], { meaning: "CLOSED" });
  assert.equal(status(evaluate(b, "2026-10-01")), "UNKNOWN");
});
