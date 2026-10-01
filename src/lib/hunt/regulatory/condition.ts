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
 * What kind of condition a line is. DECLARED, never inferred from its text.
 *
 * Two routes, both declarations: a producer that composes the line itself sets
 * it (the harvest limit the engine assembles, Ontario's implement notes), and a
 * line read from a bundle takes it from `content/regulatory/condition-kinds.json`,
 * where a person who read the rule classified it by its stable id. A renderer
 * never guesses, which is the whole reason for the table: sorting "licence"
 * from "tag" by matching prose puts the safety-relevant half of a fact in a
 * regular expression (`limitation.ts`).
 *
 * The first group GATES the opportunity: a hunter holding the ordinary licence
 * for the species cannot take it as it stands. The rest are standing
 * requirements of hunting the species at all, or duties after the fact.
 *
 *   TAG_OR_DRAW        a tag, special licence or controlled-hunt allocation
 *                      that not every licensed hunter holds
 *   METHOD_SEASON      the season that applies is restricted to some weapons
 *   ELIGIBLE_HUNTERS   the season is open only to a class of hunter
 *                      (youth, relève, subsistence)
 *
 *   LICENCE            the ordinary licence, certificate or card for the species
 *   ADDITIONAL_PERMIT  a permit or validation beyond the ordinary licence
 *   METHOD             which weapons and ammunition are legal for the species
 *   ANIMAL_CLASS       which animals may be taken (sex, antlers, age)
 *   NON_RESIDENT       how a non-resident must hunt (outfitter, guide, host)
 *   LAND_PERMISSION    a landowner's or manager's permission
 *   CONCURRENT_SEASON  another season running here restricts this one
 *   DAY_RESTRICTION    hunting is unlawful on some days here
 *   TIME_OF_DAY        hunting is unlawful between stated hours of the
 *                      day, where no legal-hours module computes them yet
 *   AREA_RESTRICTION   part of the zone is regulated differently
 *   HUNTER_ORANGE      what must be worn
 *   OBLIGATION         another duty while hunting (a briefing)
 *   HARVEST_LIMIT      daily, possession or season limits
 *   REPORTING          a report, sample or submission after harvest
 *   INFORMATION        context, not a condition on this hunt
 */
export type RegulatoryConditionKind =
  | "TAG_OR_DRAW"
  | "METHOD_SEASON"
  | "ELIGIBLE_HUNTERS"
  | "LICENCE"
  | "ADDITIONAL_PERMIT"
  | "METHOD"
  | "ANIMAL_CLASS"
  | "NON_RESIDENT"
  | "LAND_PERMISSION"
  | "CONCURRENT_SEASON"
  | "DAY_RESTRICTION"
  | "TIME_OF_DAY"
  | "AREA_RESTRICTION"
  | "HUNTER_ORANGE"
  | "OBLIGATION"
  | "HARVEST_LIMIT"
  | "REPORTING"
  | "INFORMATION";

export const REGULATORY_CONDITION_KINDS: readonly RegulatoryConditionKind[] = [
  "TAG_OR_DRAW", "METHOD_SEASON", "ELIGIBLE_HUNTERS", "LICENCE", "ADDITIONAL_PERMIT", "METHOD",
  "ANIMAL_CLASS", "NON_RESIDENT", "LAND_PERMISSION", "CONCURRENT_SEASON", "DAY_RESTRICTION",
  "TIME_OF_DAY", "AREA_RESTRICTION", "HUNTER_ORANGE", "OBLIGATION", "HARVEST_LIMIT", "REPORTING",
  "INFORMATION",
];

/**
 * How widely a condition applies, as declared.
 *
 * `JURISDICTION` — wherever this species is hunted under this record: the same
 * line in every zone. `ZONE` — only in the zones or areas it names.
 */
export type ConditionScope = "JURISDICTION" | "ZONE";

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
  /**
   * See `RegulatoryConditionKind`. Optional in the type because a bundle can
   * gain a condition before anyone classifies it — and `condition-kinds.test.ts`
   * refuses that bundle, so none reaches a hunter unclassified. A consumer
   * meeting one anyway must treat it as material (`condition-scope.ts`).
   */
  kind?: RegulatoryConditionKind;
  /** See `ConditionScope`. Declared with the kind. */
  scope?: ConditionScope;
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
