/**
 * A LEGAL HARVEST OPPORTUNITY, as one row a hunter can read.
 *
 * `RegulatoryResult` answers "what is the status here" and flattens everything
 * behind it into one season, one set of limits and one prose summary. That is
 * the right shape for a verdict and the wrong shape for the card: it is exactly
 * the flattening `dimension-matrix.ts` opens by refusing —
 *
 *   "antlered with a bow in October is not either-sex with a rifle in November
 *    — and flattening them into 'deer season: Oct 1 – Nov 20' destroys the
 *    answer."
 *
 * The opportunities are not missing. They exist inside `conditional-engine.ts`
 * as the `applicable` and in-season `ConditionalRule`s, and are collapsed on the
 * way out. This file is the contract that carries them out whole, so a surface
 * renders the engine's own rows rather than one jurisdiction's field names.
 *
 * WHY THAT MATTERS MORE THAN IT SOUNDS. Today 88 of 437 big-game rules resolve
 * date + legal animal + implement together, and every one of the 88 is Québec's
 * — Ontario, Manitoba, Alberta, Idaho, British Columbia and Nova Scotia are all
 * at zero. A card written against Québec's shape would work perfectly and then
 * break the day Ontario's classes land. A card written against this contract
 * gains Ontario's hundred rules without being touched.
 *
 * NOTHING HERE DECIDES LEGALITY. It reshapes what the engine already decided.
 * There is no second rules engine, and a surface that wants a status still asks
 * the engine for one — status is the engine's output, not a dimension of a row.
 */

import type { AuthorityQuotation } from "../provenance.ts";

/* ── The physical criterion, and the comparator that is the whole point ───── */

/**
 * A measurable threshold that decides which legal class an animal is in.
 *
 * WHY THE COMPARATOR IS A FIELD AND NOT A WORD IN A SENTENCE. Québec states two
 * complementary classes for white-tailed deer:
 *
 *   « Cerf de Virginie avec bois (7 cm ou plus) »               -> ANTLERED
 *   « Cerf de Virginie femelle ou mâle avec bois de moins de 7 cm » -> ANTLERLESS
 *
 * They meet exactly at 7 cm, and the boundary belongs to the FIRST: a buck
 * whose antler measures exactly 7.0 cm is antlered, and is not in the
 * antlerless class. Render both as "7 cm" and a hunter at the boundary is told
 * the opposite of the law in one of the two directions. `AT_LEAST` and
 * `GREATER_THAN` are therefore different values here and must never present
 * identically.
 *
 * MEASURED, because the example this was specified from is not in the data. The
 * brief cited Alberta's threshold as "> 10.2 cm / > 4 in". Alberta's certified
 * rules carry no animal-class field at all, and the only "10.2" in the corpus
 * is Manitoba's SECTION NUMBER, `s. 10.2(1)`. Québec's 7 cm is the only
 * physical criterion the certified bundles hold, so it is the only one this
 * model is populated from. The shape is built for more because more will come;
 * nothing is invented to fill it.
 */
export type CriterionComparator = "AT_LEAST" | "GREATER_THAN" | "LESS_THAN" | "AT_MOST";

/** What is being measured. Open, because authorities measure different things. */
export type CriterionDimension = "ANTLER_LENGTH" | "ANTLER_POINTS" | "BEARD_LENGTH" | "SPREAD";

export interface CriterionFigure {
  value: number;
  /** The authority's own unit, never converted into one we preferred. */
  unit: string;
}

export interface PhysicalCriterion {
  dimension: CriterionDimension;
  comparator: CriterionComparator;
  /** The authority's primary published figure. */
  figure: CriterionFigure;
  /**
   * Further figures the SAME authority published for the same threshold — a
   * regulation stating "10.2 cm (4 in)" publishes both, and both are its own.
   * A figure North Ground converted is never added here; a conversion is ours
   * and would be presented as ours if it were ever wanted.
   */
  alsoPublishedAs?: readonly CriterionFigure[];
  /** The authority's own words for the class this threshold defines. */
  words: AuthorityQuotation;
}

/** The comparator as a symbol. Four values, four symbols, never two the same. */
export const COMPARATOR_SYMBOL: Readonly<Record<CriterionComparator, string>> = {
  AT_LEAST: "≥",
  GREATER_THAN: ">",
  LESS_THAN: "<",
  AT_MOST: "≤",
};

/**
 * The criterion as one scannable string — "≥ 7 cm", "> 10.2 cm (4 in)".
 *
 * The authority's further figures follow in brackets because they are its own
 * publication of the same threshold; a conversion North Ground performed would
 * have to be labelled as ours and is deliberately not produced here.
 */
export function criterionText(criterion: PhysicalCriterion): string {
  const head = `${COMPARATOR_SYMBOL[criterion.comparator]} ${criterion.figure.value} ${criterion.figure.unit}`;
  const also = criterion.alsoPublishedAs?.map((figure) => `${figure.value} ${figure.unit}`) ?? [];
  return also.length ? `${head} (${also.join(", ")})` : head;
}

/**
 * Whether a measurement satisfies the threshold.
 *
 * Exists so the boundary is decided ONCE. A surface comparing the numbers
 * itself would have to re-derive that `AT_LEAST` includes its own value and
 * `GREATER_THAN` does not, and the two Québec classes meet exactly where that
 * distinction decides the answer.
 */
export function satisfiesCriterion(criterion: PhysicalCriterion, measurement: number): boolean {
  const { value } = criterion.figure;
  switch (criterion.comparator) {
    case "AT_LEAST": return measurement >= value;
    case "GREATER_THAN": return measurement > value;
    case "LESS_THAN": return measurement < value;
    case "AT_MOST": return measurement <= value;
  }
}

/* ── The row ──────────────────────────────────────────────────────────────── */

export interface OpportunityWindow {
  opens: string;
  closes: string;
  datesInclusive: boolean;
}

/**
 * One legal harvest opportunity: a class of animal, taken with stated
 * implements, between stated dates, under stated authorization and limits.
 *
 * Every field is either the engine's structured fact or explicitly absent.
 * A display string is never promoted into one of them — `classLabel` and
 * `implementLabel` are the authority's words and travel as `words`, quoted,
 * rather than being parsed into structure.
 */
export interface ResolvedOpportunity {
  /** The engine's own rule id, so a row traces to what produced it. */
  ruleId: string;
  speciesId: string;
  /**
   * The regulatory animal class, as the authority defines it — ANTLERED,
   * ANTLERLESS, BEARDED. NULL where the authority states no class, which is a
   * real answer and not a gap; §16 keeps this separate from biological sex and
   * age, which it is not.
   */
  animalClass: string | null;
  /** The measurable test that decides the class, where the authority states one. */
  criterion: PhysicalCriterion | null;
  /** Normalised implement tokens the engine matches on. Empty where unstated. */
  implements: readonly string[];
  /** The authority's own name for the implement group, quoted rather than parsed. */
  implementWords?: AuthorityQuotation;
  windows: readonly OpportunityWindow[];
  /** Ids of the conditions on this opportunity; the text is resolved by the caller. */
  conditionIds: readonly string[];
  sourceId?: string;
  /** The authority's own name for the season segment. */
  seasonWords?: AuthorityQuotation;
}

/* ── Grouping: identical rows merge, legally distinct ones never do ───────── */

/**
 * The identity of an opportunity for grouping, EXCLUDING its dates.
 *
 * The rule the brief names: "grouping truly identical opportunities and never
 * merging legally distinct ones because their dates overlap". Dates are what
 * may differ within a group; everything that changes what is legal is what
 * defines one. So the key is built from the legal facts and the dates are
 * deliberately not in it.
 *
 * `null` and absent are folded to the same token on purpose — an unstated class
 * is one state, not two — but a stated class NEVER folds into an unstated one,
 * which is why the token is distinguishable from any real value.
 */
export function opportunityIdentity(opportunity: ResolvedOpportunity): string {
  const criterion = opportunity.criterion
    ? `${opportunity.criterion.dimension}${opportunity.criterion.comparator}${opportunity.criterion.figure.value}${opportunity.criterion.figure.unit}`
    : "\u0000none";
  return [
    opportunity.speciesId,
    opportunity.animalClass ?? "\u0000unstated",
    criterion,
    /* Sorted, because the same set of implements written in two orders is one
       opportunity — and JOINED WITH A SEPARATOR THAT CANNOT OCCUR IN A TOKEN,
       so ["BOW","GUN"] and ["BOWGUN"] cannot collide into one key. */
    [...opportunity.implements].sort().join("\u0000"),
    [...opportunity.conditionIds].sort().join("\u0000"),
  ].join("\u0001");
}

/** Whether two rows are the same opportunity seen at different dates. */
export function sameOpportunity(a: ResolvedOpportunity, b: ResolvedOpportunity): boolean {
  return opportunityIdentity(a) === opportunityIdentity(b);
}

export interface OpportunityGroup {
  identity: string;
  /** Every row in the group; they differ only in their dates. */
  rows: readonly ResolvedOpportunity[];
  windows: readonly OpportunityWindow[];
}

/**
 * Group rows for the timeline, preserving order of first appearance.
 *
 * Insertion-ordered rather than sorted, so the engine's own ordering — which is
 * the authority's table order — survives into what the hunter reads.
 */
export function groupOpportunities(rows: readonly ResolvedOpportunity[]): OpportunityGroup[] {
  const groups = new Map<string, { rows: ResolvedOpportunity[]; windows: OpportunityWindow[] }>();
  for (const row of rows) {
    const identity = opportunityIdentity(row);
    const group = groups.get(identity) ?? { rows: [], windows: [] };
    group.rows.push(row);
    group.windows.push(...row.windows);
    groups.set(identity, group);
  }
  return [...groups].map(([identity, group]) => ({ identity, rows: group.rows, windows: group.windows }));
}

/* ── The choices a filter may offer ───────────────────────────────────────── */

/**
 * The classes and implements the rows in context ACTUALLY support.
 *
 * A filter offering a choice no opportunity has is a filter that answers
 * "nothing here" for a reason the hunter cannot see, and it is how a control
 * built against one jurisdiction's vocabulary comes to offer Québec's classes
 * in Ontario. Derived from the rows every time; never a declared list.
 */
export function availableChoices(rows: readonly ResolvedOpportunity[]): {
  animalClasses: string[];
  implements: string[];
} {
  const animalClasses = new Set<string>();
  const implementTokens = new Set<string>();
  for (const row of rows) {
    if (row.animalClass) animalClasses.add(row.animalClass);
    for (const token of row.implements) implementTokens.add(token);
  }
  return { animalClasses: [...animalClasses].sort(), implements: [...implementTokens].sort() };
}

/**
 * The rows a filter selection leaves.
 *
 * AN UNSTATED FACT IS NEVER FILTERED OUT. A rule whose authority states no
 * animal class is not thereby a rule about some OTHER class — it is a rule that
 * applies whatever the animal is, so a hunter filtering to ANTLERED must still
 * see it. Dropping it would hide a real opportunity behind a control, and
 * "no results" would be North Ground's own answer rather than the law's.
 */
export function matchingOpportunities(
  rows: readonly ResolvedOpportunity[],
  filter: { animalClass?: string | null; implement?: string | null },
): ResolvedOpportunity[] {
  return rows.filter((row) => {
    if (filter.animalClass && row.animalClass && row.animalClass !== filter.animalClass) return false;
    if (filter.implement && row.implements.length && !row.implements.includes(filter.implement)) return false;
    return true;
  });
}
