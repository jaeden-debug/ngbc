import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { certificationContradictions, certifies, rowsFor, withinZoneRestrictions } from "./evidence.ts";
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

  it("holds Ontario's limits as a tag scheme, and does not let a figure escape its condition", () => {
    /* Ontario publishes no big game bag number. A tag authorizes one animal,
       and a hunter's limit is their tag count — so the risky failure here is
       not under-claiming, it is a figure appearing without the condition that
       makes it true.

       Three specific traps, each pinned:

       1. Bear's season limit of two is written for a RESIDENT. A non-resident
          must not inherit it, so the row is CONDITIONAL and carries the
          residency discriminator a consumer needs to avoid showing it.
       2. Turkey's spring and fall limits DIFFER. One number is wrong for both.
       3. Moose has no individual number at all — a tagless hunter may hunt on
          a party member's tag. The absence is deliberate and is asserted, so
          that nobody later "completes" the row with a 1 and makes it look
          finished while being wrong in both directions at once. */
    for (const speciesId of ["species:white-tailed-deer", "species:moose", "species:american-black-bear", "species:wild-turkey"]) {
      assert.equal(certifies("jurisdiction:ca-on", speciesId, "LIMIT").certified, true, speciesId);
    }

    type LimitRow = { state?: string; limits?: Record<string, unknown>; limitAppliesTo?: { residency?: string }; limitModel?: { kind?: string } };
    const rowsOf = (speciesId: string) => rowsFor("jurisdiction:ca-on", speciesId, "LIMIT") as LimitRow[];

    const bear = rowsOf("species:american-black-bear").find((row) => row.limits?.season === 2)!;
    assert.equal(bear.state, "CONDITIONAL", "a resident-only figure is never an unconditional limit");
    assert.equal(bear.limitAppliesTo?.residency, "RESIDENT", "the figure must carry who it applies to");

    const turkey = rowsOf("species:wild-turkey").find((row) => row.limits?.season)!;
    assert.deepEqual(turkey.limits!.season, { spring: 2, fall: 1 }, "spring and fall differ and both are held");

    const moose = rowsOf("species:moose");
    assert.ok(moose.some((row) => row.limitModel?.kind === "PARTY"), "moose is party-scoped");
    assert.ok(
      moose.every((row) => row.limits === undefined),
      "moose must carry NO individual count — the tag belongs to the party, not the person",
    );
  });

  it("closes Idaho's orange absence with a positive statement, without letting the upland rule reach big game", () => {
    /* The measured-absence package said what would close it — "a positive
       statement from IDFG" — and this is that statement. What makes it safe to
       certify is that Idaho's orange requirement has a legal home, IDAPA
       13.01.09, which governs game birds and upland game animals. Pronghorn is
       big game under 13.01.08, so the rule does not reach it by its own terms.

       The failure to guard against is the REQUIRED row leaking. A jurisdiction
       that requires orange SOMEWHERE and not for your species is the exact
       shape that produces "orange required" on a pronghorn answer, and it
       would look like caution rather than like an error. */
    const verdict = certifies("jurisdiction:us-id", "species:pronghorn", "VISIBILITY");
    assert.equal(verdict.certified, true);

    type Row = { state?: string; statedAs?: { text: string }; divergence?: { direction?: string } };
    const reaching = rowsFor("jurisdiction:us-id", "species:pronghorn", "VISIBILITY") as Row[];
    assert.deepEqual(reaching.map((row) => row.state), ["NOT_APPLICABLE"],
      "only the big-game answer may reach pronghorn — the upland requirement must not");

    /* And the divergence stays recorded: IDFG's own page narrows its own rule
       to "pheasants" where IDAPA says "locations" and names no species. The
       summary is NARROWER than the law, so following it can put a hunter in
       breach — the one direction of summary error that is not merely untidy. */
    const all = (rowsFor("jurisdiction:us-id", "species:wild-turkey", "VISIBILITY") as Row[])
      .concat(reaching);
    const upland = [...new Set(all)].find((row) => row.state === "REQUIRED");
    if (upland) {
      assert.match(upland.statedAs!.text, /locations where an Upland Game Bird permit is required/);
      assert.doesNotMatch(upland.statedAs!.text, /pheasant/i, "the rule names no species; only IDFG's summary does");
    }
  });

  it("does not reach a species a row does not name", () => {
    assert.equal(certifies("jurisdiction:ca-bc", "species:white-tailed-deer", "LIMIT").certified, false);
  });
});
