import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { certificationContradictions, certifies } from "./evidence.ts";

/**
 * The reader's own failure modes, each written from an over-claim it actually
 * produced rather than from a principle.
 */

describe("the evidence reader", () => {
  it("does not take a carve-out from a prohibition as a positive list", () => {
    /* British Columbia's only ALLOWED method rows are dog-pursuit carve-outs:
       "a person does not commit an offence where the person causes a dog to
       pursue small game". They name no implements, and counting them said BC
       had a positive allowed-methods list when its own lane had reported it
       has none. Category plus state is not aboutness. */
    const verdict = certifies("jurisdiction:ca-bc", "species:ruffed-grouse", "METHOD");
    assert.equal(verdict.certified, false);
    assert.match(verdict.reason, /carve-outs from prohibitions and name no implements/);
  });

  it("certifies methods where the authority names what it permits", () => {
    /* And the reason to measure rather than pattern-match: Québec's ALLOWED
       row carries scope.methods, so it IS a positive list where BC's is not.
       Reading Québec as BC would have discarded a real certification. */
    const verdict = certifies("jurisdiction:ca-qc", "species:ruffed-grouse", "METHOD");
    assert.equal(verdict.certified, true);
    // And it states the dependency rather than implying a clean answer.
    assert.match(verdict.reason, /needs the class populated/);
  });

  it("surfaces a measured absence instead of reading it as nobody looking", () => {
    const verdict = certifies("jurisdiction:ca-bc", "species:ruffed-grouse", "VISIBILITY");
    assert.equal(verdict.certified, false);
    assert.match(verdict.reason, /Searched and not found across \d+ instruments with a matching control/);
    // It names what would close it, so the next lane has a queue item.
    assert.ok(verdict.reason.length > 80);
  });

  it("treats a lane's stated non-certification as a contradiction, not a difference", () => {
    /* The guard for the worst shape of over-claim: the correction already
       existed and was silently overridden. Nothing is declared today, so this
       holds the contract rather than a current disagreement. */
    for (const jurisdiction of ["jurisdiction:ca-bc", "jurisdiction:ca-qc"]) {
      assert.deepEqual(certificationContradictions(jurisdiction, "species:ruffed-grouse"), []);
    }
  });

  it("does not reach a species a row does not name", () => {
    assert.equal(certifies("jurisdiction:ca-bc", "species:white-tailed-deer", "LIMIT").certified, false);
  });
});
