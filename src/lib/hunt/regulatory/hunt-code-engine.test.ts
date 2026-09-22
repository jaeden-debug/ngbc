import assert from "node:assert/strict";
import test from "node:test";
import { evaluateConditional, type ConditionalBundle, type ConditionalRule, type ConditionalVocabulary } from "./conditional-engine.ts";
import type { HuntDimensionAnswers } from "./dimensions.ts";
import type { HuntCode } from "./hunt-codes.ts";
import type { DrawCycle } from "./allocation.ts";
import type { Amendment } from "./precedence.ts";

/**
 * Hunt codes, draws and amendments through the shared engine, on a synthetic
 * jurisdiction. Nothing here is any state's law: the bundle is shaped so each
 * promise the U.S. model makes fails here if it is broken — a draw-only season
 * is never CLOSED to a person who has not said what they hold, a hunt code is
 * asked only where it changes the answer, a closure order closes rather than
 * erases, and two instruments that disagree give CONFLICT, not the newer one.
 */

const ELK = "species:elk";
const SOURCE = "source:test-brochure";

function rule(overrides: Partial<ConditionalRule> & Pick<ConditionalRule, "id">): ConditionalRule {
  return {
    speciesId: ELK,
    regulatoryGroupId: "group:unit-54",
    appliesWhen: {},
    seasonLabel: "Season",
    seasonPhrase: "Oct. 10 – Oct. 14",
    windows: [{ opensIso: "2026-10-10", closesIso: "2026-10-14" }],
    declaredNoSeason: false,
    conditionIds: [],
    caveats: [],
    notes: [],
    disputes: [],
    sourceId: SOURCE,
    sourceSection: "p. 48",
    sourceVersion: "2026 brochure",
    reviewStatus: "VERIFIED",
    authority: { level: "PUBLISHED_SUMMARY", instrument: "2026 Big Game Brochure" },
    ...overrides,
  };
}

const DRAW: DrawCycle = {
  id: "draw:test-primary-2026",
  name: "2026 primary draw",
  applicationOpens: "2026-03-01",
  applicationCloses: "2026-04-07",
  resultsBy: "2026-05-29",
  leftoverSaleOpens: "2026-08-04",
  statedAs: "Primary draw calendar",
  sourceId: SOURCE,
  sourceSection: "p. 2",
};

function huntCode(code: string, method: "DRAW" | "OVER_THE_COUNTER", overrides: Partial<HuntCode> = {}): HuntCode {
  return {
    id: `hunt_code:xx-yy-${code.toLowerCase()}`,
    code,
    jurisdictionId: "jurisdiction:xx-yy",
    authorityTerm: "hunt code",
    speciesId: ELK,
    geography: { regulatoryGroupId: "group:unit-54", statedAs: "54" },
    allocation: method === "DRAW"
      ? { method, authorityTerm: "limited licence", quota: { count: 150, statedAs: "150 licences", sourceSection: "p. 48" }, drawCycleId: DRAW.id }
      : { method, authorityTerm: "over-the-counter licence" },
    requiresAuthorizations: [`authorization:xx-yy-elk-licence`],
    sourceId: SOURCE,
    sourceSection: "p. 48",
    ...overrides,
  };
}

const LIMITED_FIRST = huntCode("E-E-054-O1-R", "DRAW");
const LIMITED_LATE = huntCode("E-F-054-L1-R", "DRAW");
const OTC_SECOND = huntCode("E-M-000-U2-R", "OVER_THE_COUNTER");

function bundle(rules: ConditionalRule[], extra: Partial<ConditionalBundle> = {}): ConditionalBundle {
  return {
    bundleId: "test-us-2026",
    jurisdictionId: "jurisdiction:xx-yy",
    sourceVersion: "2026 brochure",
    retrievedAt: "2026-09-01",
    certifiedPeriod: { from: "2026-04-01", to: "2027-03-31" },
    absence: { meaning: "UNKNOWN", excludedCombination: "CLOSED" },
    sources: [{ id: SOURCE, conditions: [] }],
    groups: [
      { id: "group:unit-54", officialSpec: "54", zoneIds: ["management_zone:xx-yy-gmu-54"] },
      { id: "group:unit-55", officialSpec: "55", zoneIds: ["management_zone:xx-yy-gmu-55"] },
    ],
    rules,
    huntCodes: [LIMITED_FIRST, LIMITED_LATE, OTC_SECOND],
    drawCycles: [DRAW],
    ...extra,
  };
}

const VOCABULARY: ConditionalVocabulary = {
  jurisdictionName: "Testland",
  unitTerm: "Game Management Unit",
  dimensions: [
    {
      id: "LICENCE_TYPE", question: "Which kind of elk licence will you hunt with?", reason: "Some seasons need a drawn licence.",
      multiple: false, allowsUnsure: false, sourceId: SOURCE,
      options: [{ value: "LIMITED", label: "A limited licence from the draw" }, { value: "OTC", label: "An over-the-counter licence" }],
    },
    {
      id: "HUNT_CODE", question: "Which hunt code is on your licence?", reason: "Each drawn licence is valid for one hunt.",
      multiple: false, allowsUnsure: false, sourceId: SOURCE, valuesFrom: "PLACE",
      options: [LIMITED_FIRST, LIMITED_LATE, OTC_SECOND].map((entry) => ({ value: entry.code, label: entry.code })),
      implies: { [LIMITED_FIRST.code]: { LICENCE_TYPE: "LIMITED" }, [LIMITED_LATE.code]: { LICENCE_TYPE: "LIMITED" }, [OTC_SECOND.code]: { LICENCE_TYPE: "OTC" } },
    },
  ],
  legalTime: { status: "NOT_AVAILABLE", text: "Not certified." },
  standingLimitations: [],
  standingSourceIds: [],
};

const RULES = [
  rule({ id: "r:first-limited", huntCodeId: LIMITED_FIRST.id, appliesWhen: { LICENCE_TYPE: "LIMITED", HUNT_CODE: LIMITED_FIRST.code }, seasonLabel: "First rifle season (E-E-054-O1-R)" }),
  rule({
    id: "r:late-limited", huntCodeId: LIMITED_LATE.id, appliesWhen: { LICENCE_TYPE: "LIMITED", HUNT_CODE: LIMITED_LATE.code },
    seasonLabel: "Late cow season (E-F-054-L1-R)", seasonPhrase: "Dec. 1 – Dec. 15", windows: [{ opensIso: "2026-12-01", closesIso: "2026-12-15" }],
  }),
  rule({
    id: "r:second-otc", huntCodeId: OTC_SECOND.id, appliesWhen: { LICENCE_TYPE: "OTC", HUNT_CODE: OTC_SECOND.code },
    seasonLabel: "Second rifle season (E-M-000-U2-R)", seasonPhrase: "Oct. 17 – Oct. 25", windows: [{ opensIso: "2026-10-17", closesIso: "2026-10-25" }],
  }),
];

function evaluate(b: ConditionalBundle, date: string, answers: HuntDimensionAnswers = {}, unit = "54") {
  return evaluateConditional(b, VOCABULARY, {
    speciesId: ELK, speciesName: "elk", date, answers,
    place: { zoneId: `management_zone:xx-yy-gmu-${unit}`, zoneName: `Game Management Unit ${unit}`, latitude: 39.6, longitude: -106.4, overlays: new Set() },
  });
}

const status = (evaluation: ReturnType<typeof evaluate>) =>
  evaluation.completeness === "NEEDS_INPUT" ? `ASK ${evaluation.required?.id}` : evaluation.result?.status;

test("a season open only to drawn licences asks what the hunter holds; it is never CLOSED for not saying", () => {
  assert.equal(status(evaluate(bundle(RULES), "2026-10-12")), "ASK LICENCE_TYPE");
});

test("with a drawn licence the answer is conditional on it, and says DRAW REQUIRED without claiming possession", () => {
  const result = evaluate(bundle(RULES), "2026-10-12", { LICENCE_TYPE: "LIMITED", HUNT_CODE: LIMITED_FIRST.code }).result!;
  assert.equal(result.status, "CONDITIONAL");
  assert.equal(result.authorization?.requirement, "DRAW_REQUIRED");
  assert.equal(result.authorization?.entitlementVerified, false);
  assert.deepEqual(result.authorization?.huntCodes.map((entry) => entry.code), [LIMITED_FIRST.code]);
  assert.equal(result.authorization?.huntCodes[0].allocation.quota?.count, 150);
  assert.match(result.summary, /open under hunt code E-E-054-O1-R, assuming you hold the licence or tag each requires/);
  assert.doesNotMatch(result.summary, /you can hunt/i);
  // Where the draw stood on the hunt date, from the published calendar only.
  assert.equal(result.authorization?.draws[0].phase, "LEFTOVER_SALE");
  assert.ok(result.sourceIds.includes(SOURCE));
});

test("an over-the-counter licence on a day only drawn hunts run is closed for that licence, and the drawn hunt is named", () => {
  const result = evaluate(bundle(RULES), "2026-10-12", { LICENCE_TYPE: "OTC" }).result!;
  assert.equal(result.status, "CLOSED");
  assert.match(result.summary, /Second rifle season \(E-M-000-U2-R\)/);
});

test("the hunt code is asked only among the hunts at this place, and only when they differ", () => {
  // Two drawn hunts reach unit 54 with different dates: which one matters in December.
  const asked = evaluate(bundle(RULES), "2026-12-05", { LICENCE_TYPE: "LIMITED" });
  assert.equal(status(asked), "ASK HUNT_CODE");
  assert.deepEqual(asked.required?.options.map((option) => option.value).sort(), [LIMITED_FIRST.code, LIMITED_LATE.code].sort());
  // In unit 55 no hunt reaches, so nothing is asked and the answer is the source's silence.
  assert.equal(status(evaluate(bundle(RULES), "2026-10-12", {}, "55")), "UNKNOWN");
});

test("an answer naming a hunt that does not reach this place is not applied", () => {
  const evaluation = evaluate(bundle(RULES), "2026-10-20", { LICENCE_TYPE: "LIMITED", HUNT_CODE: "E-M-999-O1-R" });
  assert.notEqual(evaluation.result?.status, "CONDITIONAL");
});

test("an emergency closure order closes the hunt for its interval and is cited, and does not erase the season", () => {
  const closure: Amendment = {
    id: "amendment:fire-closure", amends: ["r:first-limited"], effect: { kind: "CLOSE" },
    effective: { from: "2026-10-11", to: "2026-10-12" },
    authority: { level: "STATE_ORDER", instrument: "Emergency closure order 26-04" },
    statedAs: "Unit 54 closed to all hunting because of wildfire, Oct. 11–12.", sourceId: "source:test-closures", sourceSection: "Order 26-04",
  };
  const answers = { LICENCE_TYPE: "LIMITED", HUNT_CODE: LIMITED_FIRST.code };
  const during = evaluate(bundle(RULES, { amendments: [closure] }), "2026-10-12", answers).result!;
  assert.equal(during.status, "CLOSED");
  assert.ok(during.limitations.some((line) => line.includes("closed to all hunting because of wildfire")));
  assert.ok(during.sourceIds.includes("source:test-closures" as never));
  assert.equal(evaluate(bundle(RULES, { amendments: [closure] }), "2026-10-13", answers).result?.status, "CONDITIONAL");
});

test("two corrections of equal standing that disagree about the same date give CONFLICT, not the newer page", () => {
  const correction = (id: string, closes: string): Amendment => ({
    id, amends: ["r:first-limited"], effect: { kind: "REPLACE_WINDOWS", windows: [{ opensIso: "2026-10-10", closesIso: closes }] },
    effective: { from: "2026-09-01" }, authority: { level: "PUBLISHED_SUMMARY", instrument: `Correction ${id}` },
    statedAs: `Dates corrected to close ${closes}`, sourceId: "source:test-corrections", sourceSection: id,
  });
  const b = bundle(RULES, { amendments: [correction("c-1", "2026-10-14"), correction("c-2", "2026-10-16")] });
  const answers = { LICENCE_TYPE: "LIMITED", HUNT_CODE: LIMITED_FIRST.code };
  // Both readings put Oct. 12 in season: the answer stands despite the disagreement.
  assert.equal(evaluate(b, "2026-10-12", answers).result?.status, "CONDITIONAL");
  // Oct. 15 is open under one correction and not the other.
  assert.equal(evaluate(b, "2026-10-15", answers).result?.status, "CONFLICT");
});

test("a correction that states which earlier correction it replaces is applied, deterministically", () => {
  const first: Amendment = {
    id: "c-1", amends: ["r:first-limited"], effect: { kind: "REPLACE_WINDOWS", windows: [{ opensIso: "2026-10-10", closesIso: "2026-10-14" }] },
    effective: { from: "2026-09-01" }, authority: { level: "PUBLISHED_SUMMARY", instrument: "Correction 1" },
    statedAs: "First correction", sourceId: "source:test-corrections", sourceSection: "c-1",
  };
  const second: Amendment = { ...first, id: "c-2", supersedes: ["c-1"], effect: { kind: "REPLACE_WINDOWS", windows: [{ opensIso: "2026-10-10", closesIso: "2026-10-16" }] }, statedAs: "Second correction", sourceSection: "c-2" };
  const answers = { LICENCE_TYPE: "LIMITED", HUNT_CODE: LIMITED_FIRST.code };
  assert.equal(evaluate(bundle(RULES, { amendments: [second, first] }), "2026-10-15", answers).result?.status, "CONDITIONAL");
});
