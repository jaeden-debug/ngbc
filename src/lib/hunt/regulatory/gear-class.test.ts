import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gearClassApplies, sameGearClass, type GearClass } from "./gear-class.ts";

const quebec = (code: string, implementsList: string[]): GearClass => ({
  id: `gear_class:ca-qc-${code}`, jurisdictionId: "jurisdiction:ca-qc", code,
  officialTerm: { text: "engin de type", lang: "fr-CA", owner: "AUTHORITY" },
  statedAs: { text: `engin de type ${code}`, lang: "fr-CA", owner: "AUTHORITY" },
  citation: "r.12 s.31", includesImplements: implementsList,
});

describe("gear class is an identity, not a list of equipment", () => {
  it("keeps two classes apart when their implements are identical", () => {
    /* r.12 s.31: type 11 is arcs + arbalètes. Type 12 is THE SAME TWO
       PARAGRAPHS WORD FOR WORD plus slugs and muzzleloaders. Any comparison
       that goes through the implement list collides on the shared part. */
    const eleven = quebec("11", ["BOW", "CROSSBOW"]);
    const twelve = quebec("12", ["BOW", "CROSSBOW", "SHOTGUN_SLUG", "MUZZLELOADER"]);
    assert.equal(sameGearClass(eleven, twelve), false);
    // A hunter drawing a bow could be under either; the bow does not decide it.
    assert.ok(eleven.includesImplements!.every((implement) => twelve.includesImplements!.includes(implement)));
  });

  it("answers UNKNOWN rather than guessing the hunter-orange exemption", () => {
    /* r.1 s.17.3(1) exempts big game hunted "au moyen d'un engin de type 6 ou
       11" — and NOT type 12. An engine holding only "bow, crossbow" cannot
       tell which, and its failure direction is telling a hunter they need NO
       ORANGE when the law says they do. There is no implement fallback here,
       deliberately. */
    const exemption = ["6", "11"];
    assert.equal(gearClassApplies(exemption, { gearClassCode: "11" }), "APPLIES");
    assert.equal(gearClassApplies(exemption, { gearClassCode: "12" }), "DOES_NOT_APPLY");
    assert.equal(gearClassApplies(exemption, { gearClassCode: undefined }), "UNKNOWN");
    assert.equal(gearClassApplies(exemption, undefined), "UNKNOWN");
  });

  it("does not scope a rule that names no class", () => {
    assert.equal(gearClassApplies(undefined, undefined), "APPLIES");
    assert.equal(gearClassApplies([], { gearClassCode: "11" }), "APPLIES");
  });

  it("never lets one jurisdiction's number match another's", () => {
    const qc = quebec("11", ["BOW"]);
    const elsewhere: GearClass = { ...qc, jurisdictionId: "jurisdiction:ca-on", id: "gear_class:ca-on-11" };
    assert.equal(sameGearClass(qc, elsewhere), false, "a bare number is not an identity across authorities");
  });
});
