/**
 * An authority's own numbered gear class — Québec's « engin de type 11 » — as
 * an IDENTITY rather than as a list of equipment.
 *
 * Some jurisdictions do not regulate by what a hunter carries. Québec
 * regulates by a numbered class that bundles equipment WITH regulatory
 * meaning, and then references the number throughout: r.12 art. 17, art. 34.1,
 * annexe III. A normalised implement list is lossy exactly where the law is
 * decisive.
 *
 * THE PROOF THAT IDENTITY CANNOT BE A FUNCTION OF THE IMPLEMENTS, from
 * r.12 s.31:
 *
 *   Type 11 is (a) arcs + (b) arbalètes.
 *   Type 12 is THE SAME TWO PARAGRAPHS WORD FOR WORD, plus (c) shotgun slugs
 *   and (d) muzzleloaders.
 *
 * So two classes share their entire bow-and-crossbow definition and are not
 * interchangeable. `["BOW","CROSSBOW"]` cannot tell them apart, and no widening
 * of a method list ever will.
 *
 * AND THE REASON THIS IS A SAFETY CONCERN RATHER THAN A CORRECTNESS ONE.
 * r.1 s.17.3(1) exempts big game hunted « au moyen d'un engin de type 6 ou
 * 11 » from hunter orange — and NOT type 12. Type 6 is bow-only and requires
 * steel-headed arrows; type 11 admits crossbows and requires no steel head. A
 * hunter drawing a bow may be hunting under type 11 or under type 12, and the
 * orange exemption reaches only one of them.
 *
 * An engine holding "bow, crossbow" cannot tell which. Its failure direction is
 * telling a hunter they need NO ORANGE when the law says they do, which is the
 * one requirement whose absence gets somebody shot. So where a rule is scoped
 * by gear class and the class is unknown, the answer is UNKNOWN — never the
 * exemption, and never a fallback to the implement list.
 *
 * Jurisdiction-neutral by construction: the model is a numbered class, the
 * authority's own term travels in `officialTerm`, and nothing here says
 * "engin" outside a Québec example.
 */

import type { CanonicalId } from "../../content-contract/index.ts";

/** `gear_class:ca-qc-11`. The code is the authority's, never ours. */
export type GearClassId = `gear_class:${string}`;

export interface GearClass {
  id: GearClassId;
  jurisdictionId: CanonicalId<"jurisdiction"> | string;
  /** The authority's own number or code — "11", "6", "12". This IS the identity. */
  code: string;
  /** The authority's term for the concept: « engin de type ». Never translated. */
  officialTerm: { text: string; lang: "en-CA" | "fr-CA"; owner: "AUTHORITY" };
  /** The definition, verbatim. */
  statedAs: { text: string; lang: "en-CA" | "fr-CA"; owner: "AUTHORITY" };
  citation: string;
  /**
   * The implements the definition happens to list.
   *
   * DERIVED, and for display and filtering only. It is never the identity, it
   * is never used to match a rule, and a gear class is never reconstructed
   * from it — types 11 and 12 would collide on the first attempt.
   */
  includesImplements?: string[];
  /** Conditions the class itself imposes — type 6's steel-headed arrows. */
  conditions?: Array<{ statedAs: string; citation: string }>;
}

/**
 * Whether a rule scoped to these gear classes applies to a hunt known to be
 * under `hunting`.
 *
 * Returns UNKNOWN when the hunt's class is not known, and that is the whole
 * point: there is no implement-based fallback, because the fallback is what
 * produces a wrong orange exemption. A caller that receives UNKNOWN must not
 * apply the rule and must not apply its negation either.
 */
export function gearClassApplies(
  ruleClasses: readonly string[] | undefined,
  hunting: { gearClassCode?: string } | undefined,
): "APPLIES" | "DOES_NOT_APPLY" | "UNKNOWN" {
  if (!ruleClasses?.length) return "APPLIES";
  const code = hunting?.gearClassCode;
  if (!code) return "UNKNOWN";
  return ruleClasses.includes(code) ? "APPLIES" : "DOES_NOT_APPLY";
}

/**
 * Two gear classes are the same only when their codes are.
 *
 * Kept as a function rather than left to `===` on an implement array, because
 * the tempting comparison is the wrong one and types 11 and 12 are the proof.
 */
export function sameGearClass(a: GearClass, b: GearClass): boolean {
  return a.jurisdictionId === b.jurisdictionId && a.code === b.code;
}
