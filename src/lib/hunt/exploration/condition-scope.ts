/**
 * Which conditions earn a `!` on the map, and which are said once instead.
 *
 * THE PROBLEM, MEASURED. On 2026-09-30, across every certified species and
 * zone, **2,682 of 2,993 green zones (89.6%) wore a `!`**. A marker on nine
 * zones in ten tells a hunter nothing about where to look, and it makes the
 * zones with a genuinely specific condition indistinguishable from the rest.
 * What drove it was not specific at all: Ontario's small game licence (470
 * zone-species), Alberta's game bird licence (354), Manitoba's upland
 * projectile rule (177), and in British Columbia the bag limit — the only
 * condition BC states — put a `!` on every open zone it has.
 *
 * THE RULE. The `!` means "there is a legal opportunity here now, and a hunter
 * needs to know something material before assuming it applies to them"
 * (§41A). A condition is material when either:
 *
 *   - it GATES the opportunity — a tag or draw, a weapon-only season, a season
 *     open only to some hunters — so a hunter holding the ordinary licence
 *     cannot take it as it stands; or
 *   - it is a standing requirement DECLARED to apply only in some zones — a
 *     discharge permit for one unit, orange while a deer season runs in this
 *     area, a firearms ban in part of a zone — so it is specific to where the
 *     hunter is looking.
 *
 * A standing requirement true of every zone of the jurisdiction (the ordinary
 * licence, a species-wide ammunition rule) cannot tell one zone from another.
 * It is said once — in the legend and in every zone's card — which is §41A's
 * general limitation: "said once, collapsed, and never diluted". Harvest
 * limits, reporting duties and context are never map markers; the card
 * carries them.
 *
 * Both halves are DECLARED. The kind comes from `condition-kinds.json` or from
 * the producer that composed the line; the scope likewise, or from the bundle
 * row naming its own zones. An asked dimension is material when the engine's
 * own answer tree has a hunter for whom it is not open (`opportunity.ts`).
 * Nothing here reads prose and nothing counts zones.
 *
 * WHY THIS DOES NOT COUNT ZONES, THOUGH COUNTING IS WHAT REVEALED IT.
 * Universality is a property of the RULES, not of where the map is pointed.
 * Manitoba's hunter-orange condition is on 19% of its zones; zoom into the
 * eleven that have it and a viewport share reads 100%, reclassifies it as
 * general, and the specific warning disappears exactly where the hunter looks.
 *
 * UNCLASSIFIED KEEPS THE MARKER. A condition with no declared kind is treated
 * as material: an ignored `!` is a cheaper failure than a restriction a hunter
 * never saw. `condition-kinds.test.ts` refuses a bundle with one, so this is a
 * guard for a defect, not a state the product ships in.
 */

import type { ConditionScope, RegulatoryConditionKind } from "../regulatory/condition.ts";
import type { OpportunityCondition } from "./opportunity.ts";

export type { ConditionScope } from "../regulatory/condition.ts";

/** Kept as a name: every condition now carries its declared scope itself. */
export type ScopedCondition = OpportunityCondition;

/** Kinds that gate the opportunity itself, wherever they apply. */
export const GATING_KINDS: ReadonlySet<RegulatoryConditionKind> = new Set<RegulatoryConditionKind>([
  "TAG_OR_DRAW",
  "METHOD_SEASON",
  "ELIGIBLE_HUNTERS",
]);

/** Kinds that are never a map marker: the card carries them. */
export const NEVER_MARKED_KINDS: ReadonlySet<RegulatoryConditionKind> = new Set<RegulatoryConditionKind>([
  "HARVEST_LIMIT",
  "REPORTING",
  "INFORMATION",
]);

/** Whether a stated condition of this declared kind and scope earns a `!`. */
export function statedConditionIsMaterial(kind: RegulatoryConditionKind | undefined, scope: ConditionScope | undefined): boolean {
  if (!kind) return true;
  if (GATING_KINDS.has(kind)) return true;
  if (NEVER_MARKED_KINDS.has(kind)) return false;
  return scope === "ZONE";
}

/**
 * Whether this condition earns a marker.
 *
 * `material` is decided once, by `opportunityOf`, and travels with the
 * condition to the map, the popover and the card, so the three cannot
 * disagree. A condition without it (an older payload) is decided the same way
 * here, and an asked dimension without it keeps its marker.
 */
export function isMaterial(condition: ScopedCondition): boolean {
  if (typeof condition.material === "boolean") return condition.material;
  if (condition.kind === "ASKED_DIMENSION") return true;
  return statedConditionIsMaterial(condition.category, condition.scope);
}

/** The previous name, for callers that ask the question the old way round. */
export function isContextual(condition: ScopedCondition): boolean {
  return isMaterial(condition);
}

/** The conditions that justify a `!` on a zone, in the order the answer gave them. */
export function markableConditions(conditions: readonly ScopedCondition[]): ScopedCondition[] {
  return conditions.filter(isMaterial);
}

/**
 * The conditions to state once for the layer, deduplicated, with the zones they
 * came from discarded — because they are true of all of them.
 *
 * Only standing requirements declared JURISDICTION-wide. A harvest limit or a
 * note is left to the card: a bag limit differs from unit to unit, and context
 * is not a requirement.
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
      if (isMaterial(condition)) continue;
      if (condition.scope !== "JURISDICTION") continue;
      if (condition.category === "HARVEST_LIMIT" || condition.category === "INFORMATION") continue;
      if (!seen.has(condition.id)) seen.set(condition.id, condition);
    }
  }
  return [...seen.values()];
}

/**
 * Whether a zone wears the condition indicator.
 *
 * Only ever true alongside a current legal opportunity: on its own a `!` would
 * read as a warning about a hunt that does not exist.
 */
export function zoneWearsMarker(opportunity: {
  hasCurrentLegalOpportunity?: boolean;
  hasMaterialConditions?: boolean;
  conditions?: readonly ScopedCondition[];
} | undefined): boolean {
  if (!opportunity?.hasCurrentLegalOpportunity) return false;
  if (markableConditions(opportunity.conditions ?? []).length > 0) return true;
  /*
   * CLAIMED BUT NOT LISTED KEEPS THE MARKER. `hasMaterialConditions` is derived
   * from the list, so the two cannot normally disagree — but where they do, the
   * answer asserts a material condition this code cannot inspect, and dropping
   * the marker would hide a restriction a hunter was told exists.
   */
  return opportunity.hasMaterialConditions === true && !(opportunity.conditions ?? []).length;
}
