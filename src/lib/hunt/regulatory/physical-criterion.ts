/**
 * THE MEASURABLE TEST THAT DECIDES WHETHER THE ANIMAL IS LEGAL.
 *
 * Built from three authorities read side by side, because designing it from
 * one would have been wrong in a way nobody would have noticed:
 *
 *   Québec   « Cerf de Virginie avec bois (7 cm ou plus) »        at least
 *   Ontario  "at least 1 antler of at least 7.5 centimetres long"  at least
 *   Alberta  "having an antler exceeding 10.2 cm (4 in.) in length" EXCEEDING
 *
 * **The operator differs, and it is not the number.** Alberta's test is
 * exclusive where the other two are inclusive, so a model carrying only a
 * threshold makes a 10.2 cm antler legal in Alberta when the guide says it is
 * not. That is a wrong answer at the moment of the shot, produced by a schema
 * that looked complete.
 *
 * Four more differences the three provisions forced:
 *
 * - **Alberta publishes two units for one criterion** — 10.2 cm AND 4 in.
 *   Both are the authority's own, so both are carried. Converting one into the
 *   other would put a number in front of a hunter that no guide contains.
 * - **The criterion is not owned by the species.** Alberta's single definition
 *   governs deer, moose and elk; Ontario's and Québec's are deer-specific. So
 *   it attaches to a named class that a species rule references.
 * - **It is an ANY-of test over the antlers**, not a sum and not a maximum:
 *   Ontario says "at least 1 antler".
 * - **Antlerless is the negation**, in Ontario and Alberta alike — "not
 *   antlered" — so it is derived rather than separately defined. And Ontario's
 *   own hedge is why §16 keeps sex out of it: antlerless "GENERALLY include
 *   adult female deer and fawns of both sexes". A buck that has dropped its
 *   antlers is antlerless there. Anything encoding antlerless as female is
 *   wrong before it ships.
 *
 * Point counts, spreads, beam lengths and fork configurations are admitted by
 * the model and are NOT populated: none of the three authorities read uses
 * them. Several western U.S. states do, and they will arrive with their own
 * wording.
 */

export type CriterionMeasure =
  | "ANTLER_LENGTH"
  | "ANTLER_POINT_COUNT"
  | "ANTLER_SPREAD"
  | "MAIN_BEAM_LENGTH"
  | "FORK_CONFIGURATION"
  | "HORN_LENGTH"
  | "HORN_CURL";

/** Inclusive and exclusive are different laws. Never defaulted. */
export type Comparator = "AT_LEAST" | "EXCEEDING" | "AT_MOST" | "FEWER_THAN";

/**
 * How the test reads across a paired structure.
 *
 * ANY_SIDE is Ontario's "at least 1 antler". A criterion whose aggregation the
 * authority does not state is UNSTATED rather than assumed — guessing between
 * "one antler" and "both antlers" changes which animals are legal.
 */
export type CriterionAggregation = "ANY_SIDE" | "EACH_SIDE" | "COMBINED" | "UNSTATED";

/** One figure exactly as the authority published it. */
export interface PublishedValue {
  value: number;
  /** The authority's own unit. Never normalised; both are kept where both are published. */
  unit: "cm" | "in" | "points" | "tines";
}

export interface PhysicalCriterion {
  measure: CriterionMeasure;
  comparator: Comparator;
  /**
   * Every figure the authority publishes for this one test. Alberta prints
   * 10.2 cm and 4 in.; they are one criterion with two published values, not
   * two criteria, and not one value plus a conversion of ours.
   */
  published: readonly PublishedValue[];
  aggregation: CriterionAggregation;
  /** The authority's own wording, in the language it published. */
  statedAs: string;
  /** The language of `statedAs`, so it is never re-guessed at render (§41A). */
  statedLanguage: "en" | "fr";
  sourceId: string;
  sourceSection?: string;
}

/**
 * WHY A CLASS CARRIES NO MEASURABLE TEST — which is never one reason.
 *
 * Québec's « norme RTLB » and Québec's « dindon porteur d'une barbe » both
 * serialize as a class with no `criterion`. They are opposites:
 *
 *   BEARDED  no test exists. A beard is present or it is not, and the
 *            authority measures nothing. Complete.
 *   RTLB     a test exists and we could not resolve it. The ministry says an
 *            RTLB is « basée le plus fréquemment sur le nombre de pointes »,
 *            which is a statement about RTLBs in general and not this one.
 *            A gap, on the fact a hunter needs at the moment of the shot.
 *
 * With `criterion` optional and nothing else said, those are the same bytes,
 * and a reader reporting the second as the first is §8's failure exactly:
 * absence of a discovered restriction read as absence of a restriction. So
 * the status is stated on every class and is never inferred from the shape.
 */
export type CriterionStatus =
  /** The authority states a measurable test and we hold it structured. */
  | "STATED"
  /** The authority defines membership without measuring anything. Not a gap. */
  | "NOT_MEASURED"
  /** This class is the negation of another and inherits that class's test. */
  | "BY_NEGATION"
  /** The authority names the class; its test is unresolved. A gap, with a blocker. */
  | "UNRESOLVED";

/**
 * A named legal class, and the criterion that decides membership.
 *
 * `appliesToSpecies` carries Alberta's four-species scope. `negates` carries
 * antlerless: it is defined as not satisfying the antlered test, so the two
 * classes cannot drift apart and no second threshold can be invented for it.
 */
export interface LegalAnimalClass {
  id: string;
  /** The authority's own term: "antlered", « avec bois », "antlerless". */
  statedAs: string;
  statedLanguage: "en" | "fr";
  appliesToSpecies: readonly string[];
  criterionStatus: CriterionStatus;
  criterion?: PhysicalCriterion;
  /** The class this one is the negation of, where the authority defines it that way. */
  negates?: string;
  /** Required when UNRESOLVED: what specifically was not established, and where. */
  criterionBlocker?: string;
  sourceId: string;
}

/**
 * Whether a class says what its status claims.
 *
 * Run by every emitter's build, because the four states are only worth having
 * if they cannot be written inconsistently — a class marked STATED with no
 * criterion reports coverage that does not exist, and one marked UNRESOLVED
 * with no blocker cannot be acted on by whoever picks up the gap.
 */
export function classDefect(entry: LegalAnimalClass): string | null {
  switch (entry.criterionStatus) {
    case "STATED":
      return entry.criterion ? null : `${entry.id}: STATED without a criterion`;
    case "BY_NEGATION":
      if (entry.criterion) return `${entry.id}: BY_NEGATION carries its own criterion`;
      return entry.negates ? null : `${entry.id}: BY_NEGATION without the class it negates`;
    case "UNRESOLVED":
      if (entry.criterion) return `${entry.id}: UNRESOLVED carries a criterion`;
      return entry.criterionBlocker ? null : `${entry.id}: UNRESOLVED without a named blocker`;
    case "NOT_MEASURED":
      return entry.criterion ? `${entry.id}: NOT_MEASURED carries a criterion` : null;
  }
}

/**
 * The classes a bundle holds for one species.
 *
 * ONE read path, because the fact arrived in two shapes within a week —
 * Québec keyed a map by species at the bundle root, Ontario hung an array off
 * each species record — and the dimension matrix already documents what that
 * costs for implements: a hunter asking what is open to a crossbow cannot be
 * answered while one fact lives in three places. The canonical shape is a flat
 * array at the bundle root, because `appliesToSpecies` already carries the
 * link and Alberta's single definition governs deer, moose and elk: keying by
 * species would store that one definition three times.
 */
export function classesFor(
  bundle: { legalAnimalClasses?: readonly LegalAnimalClass[] } | null | undefined,
  speciesId: string,
): readonly LegalAnimalClass[] {
  const all = bundle?.legalAnimalClasses;
  if (!Array.isArray(all)) return [];
  return all.filter((entry) => entry.appliesToSpecies.includes(speciesId));
}

/** Whether a measured figure satisfies the criterion, in the published unit. */
export function satisfies(criterion: PhysicalCriterion, measured: PublishedValue): boolean | "UNCOMPARABLE" {
  const threshold = criterion.published.find((entry) => entry.unit === measured.unit);
  /* A measurement in a unit the authority did not publish is not converted.
     The conversion would be ours, and the legal test is the authority's. */
  if (!threshold) return "UNCOMPARABLE";
  switch (criterion.comparator) {
    case "AT_LEAST": return measured.value >= threshold.value;
    case "EXCEEDING": return measured.value > threshold.value;
    case "AT_MOST": return measured.value <= threshold.value;
    case "FEWER_THAN": return measured.value < threshold.value;
  }
}

/** A compact label for the class line, in the authority's own figures. */
export function criterionSummary(criterion: PhysicalCriterion): string {
  const sign = criterion.comparator === "AT_LEAST" ? "≥" : criterion.comparator === "EXCEEDING" ? ">"
    : criterion.comparator === "AT_MOST" ? "≤" : "<";
  return criterion.published.map((entry) => `${sign} ${entry.value} ${entry.unit}`).join(" / ");
}
