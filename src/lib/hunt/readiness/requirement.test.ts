import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCertified, statementIsSound, type Provenance, type Statement } from "./types.ts";

/**
 * The requirement vocabulary, tested for the two properties it exists to hold:
 * a prohibition is never free, and a conditional never loses its condition.
 */

const source: Provenance = {
  sourceId: "source:example", url: "https://example.gov/regs",
  citation: "s. 1(1)", tier: "LAW", retrievedAt: "2026-09-24",
};

describe("a statement carries what makes it true", () => {
  it("refuses any legal statement with no source, and a prohibition most of all", () => {
    for (const state of ["REQUIRED", "ALLOWED", "PROHIBITED", "NOT_APPLICABLE"] as const) {
      assert.equal(statementIsSound({ state, value: "x", provenance: [] }), false, `${state} with no source`);
      assert.equal(statementIsSound({ state, value: "x", provenance: [source] }), true);
    }
    /* This is the property that was violated in production: `provenance: []`
       type-checks, and an empty array is exactly what let a sourceless
       prohibition reach a hunter. The type cannot catch it; this does. */
  });

  it("refuses a CONDITIONAL whose condition says nothing", () => {
    const base = { state: "CONDITIONAL" as const, value: "orange", provenance: [source] };
    assert.equal(statementIsSound({ ...base, condition: { when: {}, statedAs: "" } }), false);
    assert.equal(statementIsSound({ ...base, condition: { when: {}, statedAs: "   " } }), false, "whitespace is not a condition");
    assert.equal(statementIsSound({ ...base, condition: { when: {}, statedAs: "while hunting deer during a gun season" } }), true);
  });

  it("lets NOT_CERTIFIED carry no source, because there is nothing to cite — but it must say where to go", () => {
    assert.equal(statementIsSound({ state: "NOT_CERTIFIED", value: "x", verifyAt: "https://example.gov" }), true);
    assert.equal(statementIsSound({ state: "NOT_CERTIFIED", value: "x", verifyAt: "" }), false);
    assert.equal(isCertified({ state: "NOT_CERTIFIED", value: "x", verifyAt: "https://example.gov" }), false);
    assert.equal(isCertified({ state: "ALLOWED", value: "x", provenance: [source] }), true);
  });

  it("a CONDITIONAL without a condition does not type-check", () => {
    /* The compile-time half of the same rule, asserted here so that removing
       the union's discrimination fails a test rather than passing silently.
       Hunt overhaul refuses to RENDER a conditional with no condition; this
       makes one impossible to send in the first place. */
    // @ts-expect-error — CONDITIONAL requires `condition`
    const broken: Statement<string> = { state: "CONDITIONAL", value: "orange", provenance: [source] };
    assert.ok(broken);
  });

  it("has no notion of importance, because loudness is presentation", () => {
    /* Two lanes owning one judgement is how they come to disagree without
       anyone noticing. The engine supplies kind, state and condition; what
       sits beside the status is Hunt overhaul's call. */
    const statement: Statement<string> = { state: "REQUIRED", value: "licence", provenance: [source] };
    assert.deepEqual(Object.keys(statement).sort(), ["provenance", "state", "value"]);
  });
});
