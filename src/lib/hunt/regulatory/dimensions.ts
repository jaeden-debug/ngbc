import type { RegulatoryAnimalClassDimension } from "../../content-contract/index.ts";

/**
 * The facts a regulation may need beyond where, when and which species.
 *
 * Small game in Ontario is answerable from location, date and species alone.
 * Major game is not: the deer season tables state different dates for rifle,
 * muzzle-loader and bow, and different dates again for residents and
 * non-residents, with "None" — a genuine closure — in many non-resident cells.
 * A single answer for "deer, WMU 57, November 10" would have to be wrong for
 * someone.
 *
 * So the engine asks. It asks only what the applicable rule actually turns on,
 * one fact at a time, and it says why. A grouse hunter is never asked any of it.
 *
 * Two boundaries this contract exists to hold:
 *
 *  - A missing USER fact is not missing NORTH GROUND knowledge. The first is
 *    NEEDS_INPUT and names the question; the second is UNKNOWN. Collapsing them
 *    would turn "tell me your method" into "we don't know the law here".
 *
 *  - What a person tells us is context, not proof. Selecting "I am a resident"
 *    lets the engine follow the resident rule; it does not make anyone a
 *    resident, and no result may imply North Ground verified it.
 */

/** Dimensions the engine can ask about. Animal-class dimensions come from the
 *  shared wildlife model rather than being re-declared here. */
export type HuntDimensionId =
  | "RESIDENCY"
  | "HUNT_METHOD"
  | "SEASON_TYPE"
  | "TAG_TYPE"
  | `ANIMAL_CLASS:${RegulatoryAnimalClassDimension}`;

export interface DimensionOption {
  /** Canonical value. Validated against this list; never a free string. */
  value: string;
  label: string;
  /** Shown when the option carries a meaning the label alone does not convey. */
  detail?: string;
}

export interface RequiredDimension {
  id: HuntDimensionId;
  /** Asked of the person, in their terms. */
  question: string;
  /** Why the regulation makes this necessary — never generic filler. */
  reason: string;
  options: DimensionOption[];
  /** Whether more than one value may apply at once. */
  multiple: boolean;
  /**
   * Whether "not sure" is a legitimate answer. It is not, for a fact the person
   * must establish before acting — an animal's regulatory class is decided by
   * looking at the animal, and guessing at it is the failure mode that matters.
   */
  allowsUnsure: boolean;
  /** Where the distinction comes from, so the question is traceable. */
  sourceId: string;
  sourceSection?: string;
}

/** What the person has told us. Values are always canonical, never labels. */
export interface HuntDimensionAnswers {
  RESIDENCY?: string;
  HUNT_METHOD?: string;
  SEASON_TYPE?: string;
  TAG_TYPE?: string;
  animalClasses?: Array<{ dimension: RegulatoryAnimalClassDimension; value: string }>;
}

export const UNSURE = "UNSURE";

/* ── Validation ──────────────────────────────────────────────────────────── */

/**
 * Accept an answer only if the dimension offers it.
 *
 * Answers arrive from a browser, so they are untrusted. Nothing here is
 * interpolated into a query or a rule lookup before passing this check.
 */
export function isAnswerValid(dimension: RequiredDimension, value: string | undefined): boolean {
  if (value === undefined) return false;
  if (value === UNSURE) return dimension.allowsUnsure;
  return dimension.options.some((option) => option.value === value);
}

export function answerFor(
  answers: HuntDimensionAnswers,
  id: HuntDimensionId,
): string | undefined {
  if (id === "RESIDENCY") return answers.RESIDENCY;
  if (id === "HUNT_METHOD") return answers.HUNT_METHOD;
  if (id === "SEASON_TYPE") return answers.SEASON_TYPE;
  if (id === "TAG_TYPE") return answers.TAG_TYPE;
  const animalDimension = id.slice("ANIMAL_CLASS:".length) as RegulatoryAnimalClassDimension;
  return answers.animalClasses?.find((entry) => entry.dimension === animalDimension)?.value;
}

/**
 * The first dimension still missing a usable answer.
 *
 * Returned one at a time, in the order the regulation needs them, so the
 * interface asks a single question rather than presenting a form. An answer of
 * "not sure" counts as answered only where the dimension permits it; elsewhere
 * it leaves the dimension outstanding, which is the honest outcome for a fact
 * the person has to establish by looking.
 */
export function nextMissingDimension(
  required: RequiredDimension[],
  answers: HuntDimensionAnswers,
): RequiredDimension | null {
  for (const dimension of required) {
    const value = answerFor(answers, dimension.id);
    if (!isAnswerValid(dimension, value)) return dimension;
  }
  return null;
}

/* ── Ontario vocabulary ──────────────────────────────────────────────────── */

/**
 * Ontario's four hunting implements.
 *
 * Deliberately NOT the three season tables the province prints. Those tables are
 * headed by implement groups ("Rifles, shotguns, muzzle-loading guns and bows"),
 * but per-unit footnotes subtract from their own heading: footnote 1 on the deer
 * page bars rifles in the units carrying it, leaving shotgun hunters with a
 * season a rifle hunter does not have. Offering "rifle or shotgun" as one answer
 * would tell a rifle hunter in WMU 71 that the gun season is open to them.
 *
 * So the person names the implement, and a rule applies when it permits that
 * implement. One implement can qualify for several published seasons at once — a
 * bow is legal in the gun, muzzle-loader and archery seasons — and that is a
 * union of open dates, not a conflict.
 */
export const ONTARIO_METHODS = {
  RIFLE: "RIFLE",
  SHOTGUN: "SHOTGUN",
  MUZZLELOADER: "MUZZLELOADER",
  BOW: "BOW",
} as const;

export const ONTARIO_RESIDENCY = {
  RESIDENT: "RESIDENT",
  NON_RESIDENT: "NON_RESIDENT",
} as const;

export function ontarioMethodDimension(sourceId: string, sourceSection: string): RequiredDimension {
  return {
    id: "HUNT_METHOD",
    question: "What will you be hunting with?",
    reason:
      "Ontario publishes separate season dates by implement, and in some units rifles are " +
      "excluded from a season that shotguns are permitted in, so the open dates depend on " +
      "which one you carry.",
    options: [
      { value: ONTARIO_METHODS.RIFLE, label: "Rifle" },
      { value: ONTARIO_METHODS.SHOTGUN, label: "Shotgun" },
      { value: ONTARIO_METHODS.MUZZLELOADER, label: "Muzzle-loading gun" },
      { value: ONTARIO_METHODS.BOW, label: "Bow" },
    ],
    multiple: false,
    // A person knows what they are carrying.
    allowsUnsure: false,
    sourceId,
    sourceSection,
  };
}

export function ontarioResidencyDimension(sourceId: string, sourceSection: string): RequiredDimension {
  return {
    id: "RESIDENCY",
    question: "Are you an Ontario resident?",
    reason:
      "Resident and non-resident seasons differ in this unit, and some units have no " +
      "non-resident season at all.",
    options: [
      { value: ONTARIO_RESIDENCY.RESIDENT, label: "Ontario resident" },
      { value: ONTARIO_RESIDENCY.NON_RESIDENT, label: "Non-resident" },
    ],
    multiple: false,
    allowsUnsure: false,
    sourceId,
    sourceSection,
  };
}

/**
 * Moose tags.
 *
 * Ontario heads its moose season tables "seasons when gun tags are valid" and
 * "season when bow tags are valid". The gate is the tag, not the implement: a
 * person carrying a bow without a bow tag has no season, so this is asked
 * whenever the published tables for a unit differ by tag.
 *
 * Options are supplied by the caller from the values the bundle actually
 * carries, so a tag type appearing or disappearing in a future summary changes
 * the question without changing this file.
 */
const ONTARIO_TAG_LABELS: Record<string, { label: string; detail?: string }> = {
  GUN: { label: "Gun tag", detail: "Valid for the rifle, shotgun, muzzle-loader and bow season" },
  BOW_MUZZLELOADER: { label: "Bows and muzzle-loading guns tag" },
  BOW: { label: "Bow tag" },
};

export function ontarioTagDimension(
  values: string[],
  sourceId: string,
  sourceSection: string,
): RequiredDimension {
  return {
    id: "TAG_TYPE",
    question: "Which moose tag do you hold?",
    reason:
      "Ontario's moose seasons are stated per tag type, not per weapon. The tag you were " +
      "allocated in the draw decides which season is open to you.",
    options: values.map((value) => ({
      value,
      label: ONTARIO_TAG_LABELS[value]?.label ?? value,
      ...(ONTARIO_TAG_LABELS[value]?.detail ? { detail: ONTARIO_TAG_LABELS[value]!.detail } : {}),
    })),
    multiple: false,
    // Holding no tag is not "unsure" — it means no moose season is open, which
    // the caller states rather than guessing around.
    allowsUnsure: false,
    sourceId,
    sourceSection,
  };
}
