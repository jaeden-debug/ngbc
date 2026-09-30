/**
 * What an opportunity row SAYS on the card, and the four sentences it may never
 * say.
 *
 * THE RULE THIS FILE EXISTS FOR (owner, 2026-09-30): the interface must never
 * guess a missing dimension.
 *
 *   class UNRESOLVED          must not render "Either sex"
 *   implement UNRESOLVED      must not render "All methods"
 *   limit UNRESOLVED          must not render "No limit"
 *   authorization UNRESOLVED  must not render "No permit required"
 *
 * Each of those four is a sentence a hunter would act on, and each is a legal
 * claim North Ground has no evidence for. Unknown means unknown. After
 * `OpportunityDimension` the type cannot even offer a renderer the value it
 * would have guessed from — there is no string to reach for — but the phrases
 * are still asserted against, because the next renderer to want a friendly
 * default will write one rather than read one.
 *
 * NORMALIZED VALUE, INTERFACE LABEL, AUTHORITY TEXT: three things, kept apart.
 * `CROSSBOW` is the computational value the engine matches on; "Crossbow" is
 * what an English reader sees; « armes à feu, à l'arbalète et à l'arc » is the
 * ministry's own heading and belongs in details and provenance with its `lang`.
 * A generated translation is never presented as authority wording, and an
 * authority's heading never leaks into a chip.
 */

import type { OpportunityDimension, ResolvedOpportunity } from "./opportunity-row.ts";
import { criterionText } from "./opportunity-row.ts";

/**
 * Every implement token the certified corpus uses, in the interface language.
 *
 * A token with no label would render as `MUZZLELOADER` — a database value on a
 * hunter's screen — so `opportunity-presentation.test.ts` reads the corpus and
 * fails on any token missing here. The map is the reason a new jurisdiction
 * adds data rather than presentation code.
 */
export const IMPLEMENT_LABELS: Readonly<Record<string, string>> = {
  BOW: "Bow",
  CROSSBOW: "Crossbow",
  RIFLE: "Rifle",
  SHOTGUN: "Shotgun",
  MUZZLELOADER: "Muzzleloader",
  AIR_GUN: "Air gun",
  /* The authority's own umbrella where it does not enumerate — kept distinct
     from the specific tokens rather than expanded into them, because expanding
     would assert permissions the authority did not list. */
  FIREARM: "Firearm",
  SNARE: "Snare",
};

/** Every regulatory animal class the corpus uses. Source-defined, not biological (§16). */
export const ANIMAL_CLASS_LABELS: Readonly<Record<string, string>> = {
  ANTLERED: "Antlered",
  ANTLERLESS: "Antlerless",
  BEARDED: "Bearded",
  BEARDLESS: "Beardless",
};

/**
 * How a dimension appears on the card.
 *
 * `OMITTED` and `UNKNOWN` are different rows, not two spellings of blank. A
 * dimension the authority does not use for this species has no line at all —
 * an antler class on a grouse card would be noise. A dimension that could
 * decide legality and is unestablished gets a line SAYING SO, because its
 * silence is a gap the hunter should know about before relying on the answer.
 */
export type PresentedDimension =
  | { kind: "VALUE"; text: string }
  | { kind: "UNKNOWN"; text: string }
  | { kind: "OMITTED" };

/** The one sentence an unestablished dimension is allowed to be. */
const NOT_ESTABLISHED = "Not established";

function present(
  dimension: OpportunityDimension<unknown>,
  render: (value: never) => string,
): PresentedDimension {
  switch (dimension.state) {
    case "STATED": return { kind: "VALUE", text: render(dimension.value as never) };
    case "NOT_APPLICABLE": return { kind: "OMITTED" };
    case "UNRESOLVED": return { kind: "UNKNOWN", text: NOT_ESTABLISHED };
  }
}

/**
 * One animal-class token as a reader should see it.
 *
 * THE ONLY PLACE A CLASS TOKEN BECOMES WORDS, and it exists because there were
 * briefly two. A rule stating two classes is one season in which either may be
 * taken, and the adapter joins them with " or " — so the token is a COMPOUND,
 * not a key. A caller doing `ANIMAL_CLASS_LABELS[token] ?? token` gets a
 * correct answer for a single class and the raw `ANTLERED or ANTLERLESS` for a
 * compound, which is how the filter came to shout a token the card beside it
 * was rendering properly. Callers use this; nobody indexes the map directly.
 *
 * An unlabelled token keeps its own spelling rather than being dropped — a
 * class North Ground cannot label is still a class the authority stated, and
 * showing it raw is honest where hiding it would be a silent narrowing.
 */
export function animalClassLabel(token: string): string {
  return token.split(" or ").map((part) => ANIMAL_CLASS_LABELS[part] ?? part).join(" or ");
}

/** The legal animal class, in the interface language. */
export function presentAnimalClass(row: ResolvedOpportunity): PresentedDimension {
  return present(row.animalClass, animalClassLabel);
}

/** The permitted methods, as chips, in the interface language. */
export function presentImplements(row: ResolvedOpportunity): PresentedDimension & { chips?: string[] } {
  const presented = present(row.implements, (value: readonly string[]) =>
    value.map((token) => IMPLEMENT_LABELS[token] ?? token).join(", "));
  if (presented.kind !== "VALUE" || row.implements.state !== "STATED") return presented;
  return { ...presented, chips: row.implements.value.map((token) => IMPLEMENT_LABELS[token] ?? token) };
}

/** The measurable test that decides the class, where the authority states one. */
export function presentCriterion(row: ResolvedOpportunity): PresentedDimension {
  /* Absent is OMITTED rather than UNKNOWN: most classes have no threshold at
     all, so a "Not established" line on every one of them would be the warning
     that fires everywhere and is therefore read nowhere (§41A). Where a
     threshold exists and North Ground has not extracted it, that is a gap in
     the record rather than something this function can see. */
  return row.criterion ? { kind: "VALUE", text: criterionText(row.criterion) } : { kind: "OMITTED" };
}

/**
 * The four phrases the interface may never produce for a missing dimension.
 *
 * Kept as data so the gate reads the same list the rule does, rather than a
 * test author's recollection of it.
 */
export const FORBIDDEN_GUESSES: readonly string[] = [
  "Either sex",
  "All methods",
  "No limit",
  "No permit required",
];

export interface OpportunityCard {
  ruleId: string;
  animalClass: PresentedDimension;
  criterion: PresentedDimension;
  implements: PresentedDimension & { chips?: string[] };
  windows: ResolvedOpportunity["windows"];
  conditionIds: readonly string[];
  sourceId?: string;
}

/**
 * One row, ready to render.
 *
 * Deliberately not a React concern: the decision about what a card says is
 * regulatory presentation and is tested without a browser, so a component that
 * wants a friendlier default has to change a rule rather than a template.
 */
export function opportunityCard(row: ResolvedOpportunity): OpportunityCard {
  return {
    ruleId: row.ruleId,
    animalClass: presentAnimalClass(row),
    criterion: presentCriterion(row),
    implements: presentImplements(row),
    windows: row.windows,
    conditionIds: row.conditionIds,
    ...(row.sourceId ? { sourceId: row.sourceId } : {}),
  };
}
