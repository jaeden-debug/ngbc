/**
 * A condition on a hunt: something a hunter must satisfy for the season the
 * answer reports to be open to them.
 *
 * THIS EXISTS BECAUSE "IN SEASON, WITH CONDITIONS" WAS SAYING NOTHING.
 * The status was reaching a hunter with the conditions flattened into
 * `string[]` — text and citation already glued together — and rendered three
 * screens down, behind a "Details" control, under a heading a scanning reader
 * never got to. So the product's single most common answer named a category of
 * fact and then declined to say which facts were in it.
 *
 * Worse, it was often EMPTY. Québec, British Columbia, Ontario small game and
 * the federal migratory bundle enumerate no conditions at all, so a hunter was
 * told conditions applied and no condition existed to show them. That is a
 * claim stricter than the source, which §8 treats as false in exactly the way
 * an over-loose one is — and it is the quieter direction, because nobody
 * reports a warning that was too cautious.
 *
 * Two things follow, and they are the whole design:
 *
 *   A condition keeps its own provenance. Not "text (section)" in one string,
 *   because a renderer cannot then group several conditions under one source
 *   affordance, cannot link the right instrument, and cannot be tested for
 *   having one. §16 wants the source close to the fact without a URL after
 *   every bullet; that needs the two as separate fields.
 *
 *   A condition knows whose words it is. The same rule `limitation.ts` reasons
 *   about at length: `owner: "AUTHORITY"` is an attribution, and attributing
 *   North Ground's own caution to a ministry is the symmetric failure to
 *   asserting a prohibition nobody legislated. The vocabulary is deliberately
 *   the same one, imported rather than redeclared, so the two cannot drift.
 *
 * WHAT THIS IS NOT. It is not a limitation. A limitation QUALIFIES an answer —
 * what it does not resolve, what the authority cautions about its own data. A
 * condition is PART of the answer: satisfy it and the season is open to you.
 * They are rendered in different places for that reason and must not be merged.
 *
 * KIND IS DELIBERATELY ALMOST ABSENT. It would be easy to sort the existing
 * lines into licence/method/class buckets by matching their prose, and that is
 * precisely what `limitation.ts` forbids: the kind is known to the AUTHOR of a
 * line and inferring it from wording puts the safety-relevant half of a fact in
 * a regular expression. So `kind` is set only where the engine itself composed
 * the line and therefore knows what it composed. Everything read from a bundle
 * arrives unclassified until whoever owns that jurisdiction classifies it.
 */

import type { CanonicalId } from "../../content-contract/index.ts";
import type { LimitationLang } from "../limitation.ts";

/**
 * Set only by the producer that built the line, never inferred from its text.
 *
 * One member today, because one kind of condition is composed by North Ground
 * rather than read from a source: the harvest limit the engine assembles from a
 * rule's own `limits`. The set grows as producers learn what they are emitting,
 * not as a renderer learns to guess.
 */
export type RegulatoryConditionKind = "HARVEST_LIMIT";

export interface RegulatoryCondition {
  /** Stable, so a consumer can key a row and a test can name one line. */
  id: string;
  /** What must be satisfied. */
  text: string;
  /**
   * The language the text is in. An authority's words stay in the language it
   * published them in and are rendered quoted and tagged rather than
   * translated (§47).
   */
  lang: LimitationLang;
  /**
   * Whose words these are. North Ground's render plainly; an authority's
   * render quoted and attributed, and are never paraphrased.
   */
  owner: "NORTH_GROUND" | "AUTHORITY";
  /**
   * The pinpoint, as the author of the line recorded it — "M.R. 165/91 s. 9(3)",
   * "p. 21, Licences". Kept apart from `text` so several conditions sharing one
   * instrument can share one source affordance instead of each dragging a URL.
   */
  sourceSection: string;
  sourceId: CanonicalId<"source">;
  /** See `RegulatoryConditionKind` — present only where the producer knows. */
  kind?: RegulatoryConditionKind;
}

/**
 * The flattened form, for consumers that still take one string per line.
 *
 * Derived here rather than authored beside the structured list, so the sentence
 * and the fields cannot disagree — the same reason `legalTimeSummary` is
 * derived from its window. This is what `RegulatoryResult.requirements` holds,
 * and it is why that field can stay exactly as it was for the zone card, the
 * Hunt Brief and the long-form detail while the sheet reads the structure.
 */
export function conditionLine(condition: RegulatoryCondition): string {
  const text = condition.owner === "AUTHORITY" ? `« ${condition.text} »` : condition.text;
  return `${text} (${condition.sourceSection})`;
}

/** A short stable id from the text, so an unnamed line still keys and tests. */
export function conditionId(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `condition:${hash.toString(16).padStart(8, "0")}`;
}

/**
 * Whether an answer can actually show what its conditions are.
 *
 * The predicate the sheet's status word turns on, and the invariant the
 * validator enforces. It is a question about DATA, not about law — "can this
 * answer enumerate a condition?" — which is why it lives here and is answered
 * once, rather than each surface deciding for itself whether to say "with
 * conditions".
 */
export function hasEnumerableConditions(conditions: readonly RegulatoryCondition[] | undefined): boolean {
  return Boolean(conditions?.length);
}

/**
 * The conditions grouped by the source that supports them.
 *
 * §16's shape: several bullets under one `Official source ↗` rather than a URL
 * after each. Order is preserved — the producer put the most decisive first and
 * grouping must not reorder the reasons an answer gave.
 */
export function conditionsBySource(
  conditions: readonly RegulatoryCondition[],
): Array<{ sourceId: CanonicalId<"source">; conditions: RegulatoryCondition[] }> {
  const groups = new Map<string, { sourceId: CanonicalId<"source">; conditions: RegulatoryCondition[] }>();
  for (const condition of conditions) {
    const group = groups.get(condition.sourceId)
      ?? { sourceId: condition.sourceId, conditions: [] };
    group.conditions.push(condition);
    groups.set(condition.sourceId, group);
  }
  return [...groups.values()];
}
