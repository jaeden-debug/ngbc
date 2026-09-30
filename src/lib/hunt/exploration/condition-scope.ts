/**
 * Which conditions earn a `!` on the map, and which are said once instead.
 *
 * THE PROBLEM, MEASURED. Ruffed grouse on 2026-09-30 draws 433 open zones and
 * **390 of them wear a `!`**. A marker on 90% of the map tells a hunter nothing
 * about where to look, and — worse — it makes the zones with a genuinely
 * specific condition indistinguishable from the rest. §41A already classifies
 * this: a **general limitation** is true everywhere and is "said once,
 * collapsed, and never diluted"; a **contextual limitation** is "true only
 * under a condition the system can actually test" and is "shown only when that
 * condition holds". A warning that fires everywhere is a warning nobody reads,
 * and then it is missing when it is specific.
 *
 * The measured distribution, per jurisdiction layer, of the same viewport:
 *
 *   Alberta   177/177 game-bird licence · 6/177 WMU 936 discharge permit
 *   Ontario   150/150 small game licence
 *   Manitoba   59/59  no single projectile · 11/59 hunter orange
 *   Québec     3/47 and 1/47, and nothing universal at all
 *
 * Three of those are general and three are contextual, and applying the
 * distinction takes the `!` from 390 zones to 21.
 *
 * WHY THIS DOES NOT COUNT ZONES, THOUGH COUNTING IS WHAT REVEALED IT.
 * Universality is a property of the RULES, not of where the map happens to be
 * pointed. Inferring it from the zones in view breaks in the dangerous
 * direction: Manitoba's hunter-orange condition is on 19% of its zones, so it
 * is contextual and must keep its `!` — but zoom into the eleven zones that
 * have it and it becomes 100% of what is visible, is reclassified as general,
 * and **the specific warning disappears exactly when the hunter looks straight
 * at it**. A viewport denominator cannot distinguish "true everywhere" from
 * "you are looking at the part where it is true".
 *
 * So scope is DECLARED by the regulatory record, never inferred here. Until a
 * condition declares one it stays contextual and keeps its marker: the failure
 * of an over-marked map is a hunter ignoring a `!`, and the failure of an
 * under-marked one is a hunter never seeing a restriction that applied to them.
 * Those are not symmetrical, and the default belongs on the safe side.
 */

import type { OpportunityCondition } from "./opportunity.ts";

/**
 * How widely a condition applies, as the regulatory record declares it.
 *
 * `JURISDICTION` — true for every zone this species may be hunted in, in this
 * jurisdiction, on this date. A licence requirement is the usual case.
 * `ZONE` — true only of the zones it is attached to.
 * Absent — not declared, and therefore not assumed. Treated as `ZONE`.
 */
export type ConditionScope = "JURISDICTION" | "ZONE";

export interface ScopedCondition extends OpportunityCondition {
  scope?: ConditionScope;
}

/**
 * Whether this condition is one the map marks, or one the legend states once.
 *
 * The rule is the whole of it: a condition earns a marker unless its record
 * says it is true everywhere. Nothing is counted, so nothing changes when the
 * hunter pans.
 */
export function isContextual(condition: ScopedCondition): boolean {
  return condition.scope !== "JURISDICTION";
}

/** The conditions that justify a `!` on a zone. */
export function markableConditions(conditions: readonly ScopedCondition[]): ScopedCondition[] {
  return conditions.filter(isContextual);
}

/**
 * The conditions to state once for the layer, deduplicated, with the zones they
 * came from discarded — because they are true of all of them.
 *
 * UNKNOWN ZONES ARE NOT A SOURCE. A zone whose status North Ground cannot
 * determine has no established conditions; harvesting its list would let an
 * unresolved record put a sentence in the legend as though it were settled.
 */
export function generalConditions(
  states: readonly { state?: string; opportunity?: { hasCurrentLegalOpportunity?: boolean; coverage?: string; conditions?: readonly ScopedCondition[] } }[],
): ScopedCondition[] {
  const seen = new Map<string, ScopedCondition>();
  for (const zone of states) {
    if (zone.state === "UNKNOWN" || zone.opportunity?.coverage === "UNKNOWN") continue;
    if (!zone.opportunity?.hasCurrentLegalOpportunity) continue;
    for (const condition of zone.opportunity.conditions ?? []) {
      if (isContextual(condition)) continue;
      if (!seen.has(condition.id)) seen.set(condition.id, condition);
    }
  }
  return [...seen.values()];
}

/**
 * Whether a zone wears the condition indicator.
 *
 * Only ever true alongside a current legal opportunity: the `!` means "there is
 * a legal opportunity here now, AND you need to know something material before
 * assuming it applies to you". On its own it would read as a warning about a
 * hunt that does not exist.
 */
export function zoneWearsMarker(opportunity: {
  hasCurrentLegalOpportunity?: boolean;
  hasMaterialConditions?: boolean;
  conditions?: readonly ScopedCondition[];
} | undefined): boolean {
  if (!opportunity?.hasCurrentLegalOpportunity) return false;
  if (markableConditions(opportunity.conditions ?? []).length > 0) return true;
  /*
   * CLAIMED BUT NOT LISTED KEEPS THE MARKER.
   *
   * `hasMaterialConditions` is derived from the list in production, so the two
   * cannot normally disagree — but where they do, the answer is asserting a
   * material condition this code cannot inspect. It has NOT been shown to be
   * general, and the asymmetry decides the rest: dropping the marker here would
   * hide a restriction that a hunter was told exists. Keeping it costs an
   * ignored `!`.
   */
  return opportunity.hasMaterialConditions === true && !(opportunity.conditions ?? []).length;
}
