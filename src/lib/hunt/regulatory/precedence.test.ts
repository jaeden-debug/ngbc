import assert from "node:assert/strict";
import test from "node:test";
import { rulesInForce, withoutInterval, type Amendment, type AmendableRule } from "./precedence.ts";

const brochureRule: AmendableRule & { label: string } = {
  id: "rule:elk-054-o1",
  label: "first rifle",
  windows: [{ opensIso: "2026-10-10", closesIso: "2026-10-14" }],
  authority: { level: "PUBLISHED_SUMMARY", instrument: "2026 Big Game Brochure" },
};
const regulationRule: AmendableRule = {
  id: "rule:elk-054-reg",
  windows: [{ opensIso: "2026-10-10", closesIso: "2026-10-14" }],
  authority: { level: "STATE_REGULATION", instrument: "Chapter W-2" },
};

function amendment(overrides: Partial<Amendment> & Pick<Amendment, "id" | "effect">): Amendment {
  return {
    amends: [brochureRule.id],
    effective: { from: "2026-09-01" },
    authority: { level: "PUBLISHED_SUMMARY", instrument: "Brochure correction notice" },
    statedAs: "Corrected dates",
    sourceId: "source:test-corrections",
    sourceSection: "Corrections, item 1",
    ...overrides,
  };
}

test("with no amendments the rules pass through unchanged, as Canada's bundles do", () => {
  const result = rulesInForce([brochureRule], [], "2026-10-12");
  assert.deepEqual(result.rules, [brochureRule]);
  assert.deepEqual(result.applied, []);
  assert.deepEqual(result.conflicts, []);
});

test("a correction applies only inside its effective interval, so the rule's history is not rewritten", () => {
  const correction = amendment({
    id: "amendment:1",
    effect: { kind: "REPLACE_WINDOWS", windows: [{ opensIso: "2026-10-11", closesIso: "2026-10-15" }] },
    effective: { from: "2026-09-15" },
  });
  const before = rulesInForce([brochureRule], [correction], "2026-09-10");
  assert.deepEqual(before.rules[0].windows, brochureRule.windows);
  const after = rulesInForce([brochureRule], [correction], "2026-10-12");
  assert.deepEqual(after.rules[0].windows, [{ opensIso: "2026-10-11", closesIso: "2026-10-15" }]);
  assert.equal(after.applied[0].amendmentId, "amendment:1");
  // The original object is untouched.
  assert.equal(brochureRule.windows[0].opensIso, "2026-10-10");
});

test("an emergency closure takes its days out of the season and keeps the rule, so the place reads closed by order", () => {
  const closure = amendment({
    id: "amendment:fire",
    effect: { kind: "CLOSE" },
    effective: { from: "2026-10-11", to: "2026-10-12" },
    authority: { level: "STATE_ORDER", instrument: "Emergency closure order 26-04" },
  });
  const during = rulesInForce([brochureRule], [closure], "2026-10-11");
  assert.equal(during.rules.length, 1);
  assert.deepEqual(during.rules[0].windows, [
    { opensIso: "2026-10-10", closesIso: "2026-10-10" },
    { opensIso: "2026-10-13", closesIso: "2026-10-14" },
  ]);
  assert.equal(during.applied[0].effect, "CLOSE");
  // Outside the order's interval the season reads as published.
  assert.deepEqual(rulesInForce([brochureRule], [closure], "2026-10-13").rules[0].windows, brochureRule.windows);
});

test("a closure with no end date closes the rest of the season", () => {
  assert.deepEqual(withoutInterval([{ opensIso: "2026-10-10", closesIso: "2026-10-14" }], "2026-10-12"), [
    { opensIso: "2026-10-10", closesIso: "2026-10-11" },
  ]);
  assert.deepEqual(withoutInterval([{ opensIso: "2026-12-20", closesIso: "2027-01-05" }], "2026-12-31", "2027-01-01"), [
    { opensIso: "2026-12-20", closesIso: "2026-12-30" },
    { opensIso: "2027-01-02", closesIso: "2027-01-05" },
  ]);
});

test("a supersession removes the superseded rule from its effective date", () => {
  const supersession = amendment({ id: "amendment:replaced", effect: { kind: "SUPERSEDE" }, effective: { from: "2026-10-12" } });
  assert.equal(rulesInForce([brochureRule], [supersession], "2026-10-11").rules.length, 1);
  assert.equal(rulesInForce([brochureRule], [supersession], "2026-10-12").rules.length, 0);
});

test("a lower authority cannot change a higher one; the disagreement becomes a conflict, not a silent edit", () => {
  const correction = amendment({
    id: "amendment:brochure-fix",
    amends: [regulationRule.id],
    effect: { kind: "REPLACE_WINDOWS", windows: [{ opensIso: "2026-10-01", closesIso: "2026-10-31" }] },
  });
  const result = rulesInForce([regulationRule], [correction], "2026-10-12");
  assert.equal(result.rules.length, 0);
  assert.equal(result.refused.length, 1);
  assert.equal(result.conflicts.length, 1);
  assert.deepEqual(result.conflicts[0].alternatives[0].windows, regulationRule.windows);
  assert.deepEqual(result.conflicts[0].alternatives[1].windows, [{ opensIso: "2026-10-01", closesIso: "2026-10-31" }]);
});

test("two amendments of equal rank in force together conflict unless one says it replaces the other", () => {
  const first = amendment({ id: "amendment:a", effect: { kind: "REPLACE_WINDOWS", windows: [{ opensIso: "2026-10-11", closesIso: "2026-10-15" }] } });
  const second = amendment({ id: "amendment:b", effect: { kind: "REPLACE_WINDOWS", windows: [{ opensIso: "2026-10-12", closesIso: "2026-10-16" }] } });
  const conflicted = rulesInForce([brochureRule], [second, first], "2026-10-12");
  assert.equal(conflicted.rules.length, 0);
  assert.deepEqual(conflicted.conflicts[0].amendmentIds, ["amendment:a", "amendment:b"]);

  const explicit = rulesInForce([brochureRule], [first, { ...second, supersedes: ["amendment:a"] }], "2026-10-12");
  assert.equal(explicit.conflicts.length, 0);
  assert.deepEqual(explicit.rules[0].windows, [{ opensIso: "2026-10-12", closesIso: "2026-10-16" }]);
});

test("a higher authority's amendment outranks a lower one in force on the same day", () => {
  const brochureFix = amendment({ id: "amendment:a", effect: { kind: "REPLACE_WINDOWS", windows: [{ opensIso: "2026-10-11", closesIso: "2026-10-15" }] } });
  const order = amendment({
    id: "amendment:b",
    effect: { kind: "REPLACE_WINDOWS", windows: [{ opensIso: "2026-10-10", closesIso: "2026-10-12" }] },
    authority: { level: "STATE_ORDER", instrument: "Commission order" },
  });
  const result = rulesInForce([brochureRule], [brochureFix, order], "2026-10-11");
  assert.equal(result.conflicts.length, 0);
  assert.deepEqual(result.rules[0].windows, [{ opensIso: "2026-10-10", closesIso: "2026-10-12" }]);
});

test("the result does not depend on the order amendments were supplied in", () => {
  const a = amendment({ id: "amendment:a", effect: { kind: "REPLACE_WINDOWS", windows: [{ opensIso: "2026-10-11", closesIso: "2026-10-15" }] } });
  const b = amendment({ id: "amendment:b", effect: { kind: "CLOSE" }, authority: { level: "STATE_ORDER", instrument: "Closure" } });
  assert.deepEqual(rulesInForce([brochureRule], [a, b], "2026-10-12"), rulesInForce([brochureRule], [b, a], "2026-10-12"));
});

test("an amendment naming a rule that does not exist stops the build rather than being ignored", () => {
  assert.throws(() => rulesInForce([brochureRule], [amendment({ id: "amendment:x", amends: ["rule:missing"], effect: { kind: "CLOSE" } })], "2026-10-12"), /unknown rule/);
});
