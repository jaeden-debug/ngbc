import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { certificationContradictions, certifies, withinZoneRestrictions } from "./evidence.ts";
import ontarioBundle from "../../../../content/regulatory/readiness/ca-on-2026.json" with { type: "json" };

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

  it("certifies Ontario small-game ammunition from the regulation the bundle is silent on", () => {
    /* The point of this one is the PAIR of assertions. Asserting only that
       Ontario certifies would pass if someone later typed an ammunition entry
       into the bundle, which is the thing this change was not about. The
       bundle's silence is asserted first, so the certification can only have
       come from O. Reg. 665/98.

       It also crosses the species-classification chain deliberately: a grouse
       reaches s.77 as a GAME BIRD and a hare reaches it as a GAME MAMMAL OTHER
       THAN BIG GAME, by different limbs of s.27. A reader that handled only
       the bird limb would pass half of this and look correct. */
    const methods = ontarioBundle.speciesMethods as Record<string, { ammunition: string[] }>;
    for (const speciesId of ["species:ruffed-grouse", "species:snowshoe-hare"]) {
      assert.deepEqual(methods[speciesId].ammunition, [], `${speciesId}: the bundle must still be silent`);
      const verdict = certifies("jurisdiction:ca-on", speciesId, "AMMUNITION");
      assert.equal(verdict.certified, true, `${speciesId}: should certify from the regulation`);
    }
  });

  it("separates a restriction awaiting acquisition from one nobody can obtain", () => {
    /* Ontario's four within-zone restrictions are all NOT_YET_PLACED: three
       need an area list read out of O. Reg. 663/98, one needs a published
       dataset acquired. None is NOT_PLACEABLE. The distinction exists because
       the two call for opposite actions — keep looking, or stop — and they
       read identically when both are reported as "cannot be placed". */
    const ontario = withinZoneRestrictions("jurisdiction:ca-on", "species:ruffed-grouse");
    assert.ok(ontario.known >= 4, "Ontario's restrictions should be recorded");
    assert.equal(ontario.placeable, 0, "none of them resolves from a point yet");
    assert.equal(ontario.notYetPlaced, ontario.known, "all of Ontario's are queue items");
    assert.equal(ontario.notPlaceable, 0, "none has been shown unobtainable");
  });

  it("does not let a recorded restriction certify the fact it is evidence for", () => {
    /* Recording four restrictions must not look like progress on answering
       them. This is the shape that flattered Québec to 74% once. */
    assert.equal(certifies("jurisdiction:ca-on", "species:ruffed-grouse", "PLACE_CONDITION").certified, true);
    assert.equal(withinZoneRestrictions("jurisdiction:ca-on", "species:ruffed-grouse").placeable, 0);
  });

  it("does not reach a species a row does not name", () => {
    assert.equal(certifies("jurisdiction:ca-bc", "species:white-tailed-deer", "LIMIT").certified, false);
  });
});
