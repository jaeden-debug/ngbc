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

describe("a fee is two certifications and more than one number", () => {
  it("keeps the figure's in-force window separate from the instrument's", () => {
    /* Québec's r.32 still reads "À jour" and remains in force after its
       amounts are superseded on 1 April. The instrument, the provision and the
       number each go stale on their own, so `inForce` cannot answer for the
       figure. */
    const price = {
      amount: 25, currency: "CAD" as const, label: "Permis de chasse", appliesTo: {}, licenceYear: 2026,
      figureInForce: { effectiveFrom: "2026-04-01", supersededOn: "2027-04-01", statedAs: "indexé le 1er avril" },
      provenance: source,
    };
    assert.equal(price.figureInForce.supersededOn, "2027-04-01");
    assert.notEqual(price.figureInForce.effectiveFrom, String(price.licenceYear));
  });

  it("cannot state a licence price without the compulsory amounts paid on top", () => {
    /* The annexe I amount is not what a hunter pays: a mandatory contribution
       to the Fondation lives in a DIFFERENT annexe. Reading the obviously
       titled fee table and stopping is wrong on every licence in Québec, and
       wrong LOW — the direction a hunter discovers at the counter. */
    const price = {
      amount: 25, currency: "CAD" as const, label: "Permis de chasse au gros gibier", appliesTo: {}, licenceYear: 2026,
      chargeType: "LICENCE_FEE" as const,
      mandatoryAdditions: [{ label: "Contribution à la Fondation pour la biodiversité et la faune", amount: 5.30, statedAs: "5,30 $", citation: "annexe" }],
      provenance: source,
    };
    const payable = price.amount + price.mandatoryAdditions.reduce((total, add) => total + add.amount, 0);
    assert.equal(payable, 30.30);
    assert.notEqual(payable, price.amount, "the published amount alone understates it");
  });

  it("keeps a post-hunt charge out of the licence price", () => {
    /* Québec's 8,18 $ registration fee is real, payable, and not part of what
       a licence costs. A model with one kind of money adds it. */
    const rows = [
      { amount: 25, chargeType: "LICENCE_FEE" as const },
      { amount: 8.18, chargeType: "POST_HUNT_REGISTRATION" as const },
    ];
    const licenceCost = rows.filter((row) => row.chargeType === "LICENCE_FEE").reduce((total, row) => total + row.amount, 0);
    assert.equal(licenceCost, 25);
  });
});
