import type { OpportunityClass } from "../intelligence/types.ts";
import type { LimitationLang } from "../limitation.ts";
import type { OpportunityCondition } from "./opportunity.ts";
import type { ZoneSpeciesAnswer } from "./states.ts";

/**
 * The species layer's presentation: one definition, read by the Google map, the
 * boundary view, the zone list and the legend.
 *
 * §41A (decided 2026-09-29) made the layer two channels over one geography:
 * a semi-translucent heat fill, and a binary green highlight where a season is
 * open. This file owns both, and the words that carry their meaning, so no
 * component can invent a sixth tint or a seventh state.
 */

/**
 * The heat ramp, inside §38's own campfire-amber family rather than beside it.
 *
 * Two of the four steps ARE palette tokens — LOW is `--ng-bark-light` and HIGH
 * is `--ng-amber` — and the other two are interpolations along the same line:
 * one step cooler into the bark, one step hotter into the ember. Nothing here
 * is a new colour direction, and nothing reuses a regulatory semantic token
 * (`--ng-conflict` is the warmest red in the palette and is already spoken for
 * by "sources disagree").
 *
 * Literal hex because a Google `PolygonOptions` cannot take a CSS variable —
 * the same reason `SELECTED_STROKE` mirrors `--ng-cream` in `cartography.ts`.
 * These are the values `--ng-heat-*` in `globals.css` carry for the legend.
 */
export const HEAT_FILL: Record<Exclude<OpportunityClass, "LIMITED_DATA">, { color: string; opacity: number }> = {
  VERY_HIGH: { color: "#c4542c", opacity: 0.32 },
  HIGH: { color: "#d98b3a", opacity: 0.25 },
  MODERATE: { color: "#b58248", opacity: 0.18 },
  LOW: { color: "#8a7657", opacity: 0.11 },
};

/** Each class in words and a glyph, so the ramp is never read by colour alone. */
export const HEAT_WORDING: Record<OpportunityClass, { label: string; glyph: string }> = {
  VERY_HIGH: { label: "Very high", glyph: "▰▰▰▰" },
  HIGH: { label: "High", glyph: "▰▰▰▱" },
  MODERATE: { label: "Moderate", glyph: "▰▰▱▱" },
  LOW: { label: "Low", glyph: "▰▱▱▱" },
  LIMITED_DATA: { label: "Not enough evidence to rank", glyph: "▱▱▱▱" },
};

/**
 * The fill for a class, or null for none.
 *
 * LIMITED_DATA takes no fill: evidence is held but will not support a rank, and
 * drawing it at the bottom of the ramp would state a rank the evidence refuses.
 * A zone absent from the heat map takes no fill for the stronger reason — no
 * evidence is held at all, and absent evidence is not evidence of absence.
 */
export function heatFillFor(classification: OpportunityClass | undefined): { color: string; opacity: number } | null {
  if (!classification || classification === "LIMITED_DATA") return null;
  return HEAT_FILL[classification];
}

/**
 * Whether a zone wears the green highlight.
 *
 * §41A, amended 2026-09-29: green means AT LEAST ONE CURRENT LEGAL HUNTING
 * OPPORTUNITY EXISTS for this species, zone and date — not a season open to
 * every licence. A hunt that turns on the hunter is still a hunt.
 *
 * This reads one structured field the engine established (see
 * `opportunity.ts`), and deliberately takes the whole answer rather than a
 * word: the previous version took an `ExplorationState`, which is a LABEL, and
 * the only way to widen green with that argument would have been to add
 * CHECK_REQUIREMENTS to a list of label names — deciding legality from the
 * thing a copy editor changes.
 *
 * NOT-GREEN IS NOT CLOSED. Nothing may render the negative of this function as
 * a closure; `SPECIES_LAYER_LEGEND` carries that sentence in words, and
 * `ZoneOpportunity.coverage` carries it in data.
 */
export function zoneIsGreen(answer: ZoneSpeciesAnswer | undefined): boolean {
  return answer?.opportunity.hasCurrentLegalOpportunity === true;
}

/**
 * Whether the zone wears the one condition indicator.
 *
 * Only ever true alongside green: the `!` means "there is a legal opportunity
 * here now, AND you need to know something material before assuming it applies
 * to you". On its own it would read as a warning about a hunt that does not
 * exist.
 */
export function zoneHasConditions(answer: ZoneSpeciesAnswer | undefined): boolean {
  return zoneIsGreen(answer) && answer!.opportunity.hasMaterialConditions;
}

/** The one glyph a conditional opportunity wears. There is no second one. */
export const CONDITION_GLYPH = "!";

/** How many conditions the compact popover names before counting the rest. */
export const CONDITIONS_SHOWN = 3;

/**
 * The conditions to name on the map, and how many are left over.
 *
 * ONE LANGUAGE — THE INTERFACE'S. A condition can be an authority's own French,
 * and the map has no room for the original, the translation, the control that
 * swaps them and the attribution that makes either honest. A line the reader
 * cannot read is not shown; it is COUNTED into the remainder, so the popover
 * never understates how much the zone's answer holds, and the sheet — which
 * carries the original beside its translation with its provenance — is one tap
 * away. Untranslated it would be a wall of French on a map; translated without
 * its original it would be the authority's words rewritten (§41A).
 *
 * The language is the record's own metadata, never re-detected from the text.
 */
export function conditionDigest(
  answer: ZoneSpeciesAnswer | undefined,
  /*
   * REQUIRED, not defaulted. This filters which conditions a reader can
   * actually read, so a default would quietly decide that for every caller —
   * and the one call site was taking it. A defaulted `lang` has mislabelled
   * authority text in this codebase once already; the cost of requiring it is
   * one word at the call site.
   */
  lang: LimitationLang,
): { shown: OpportunityCondition[]; further: number } {
  const all = answer?.opportunity.conditions ?? [];
  const readable = all.filter((condition) => condition.lang === lang);
  return { shown: readable.slice(0, CONDITIONS_SHOWN), further: all.length - Math.min(readable.length, CONDITIONS_SHOWN) };
}

/**
 * The indicator's accessible name.
 *
 * Says what it MEANS rather than what it is: a screen-reader user hearing
 * "exclamation" learns nothing, and §48 treats that as the defect it is.
 */
export function conditionMarkerLabel(zoneLabel: string): string {
  return `${zoneLabel}: current hunting opportunity has conditions. Show them.`;
}

/**
 * The legend, in words. §48 forbids meaning carried by colour alone, and this
 * layer is the one place a hunter could read "not green" as "closed" — which
 * would be a false closure, the exact failure this product exists to avoid.
 */
export const SPECIES_LAYER_LEGEND = {
  heatTitle: "Heat: where the evidence suggests looking",
  heatDetail:
    "Shaded from the authority's own published harvest and effort figures for this species. The shade is a zone's RANK AGAINST THE OTHER ZONES of the same jurisdiction's dataset — not a count of animals and not a density. An unshaded zone is one North Ground holds no certified evidence for; it is not a zone with no animals.",
  seasonTitle: "Green outline: a legal hunt exists here now",
  seasonDetail:
    "Outlined where the certified rules give at least one current legal hunting opportunity for this species on the chosen date \u2014 including one that turns on the hunter. It is not a licence check, and it never states that you personally may hunt: the zone's card carries the full answer.",
  conditionTitle: "! \u2014 that hunt has conditions",
  conditionDetail:
    "A green zone carrying ! is one where the opportunity turns on something material: a tag, a licence class, residency, the weapon, the animal's class, the land. The indicator names the most important of them; the zone's card carries every one with its source.",
  notGreen:
    "A zone WITHOUT a green outline is not thereby closed. Zones North Ground has not certified, zones whose sources disagree, and zones whose answer North Ground could not finish deciding are simply not highlighted. Tap any zone for its full answer.",
  independent: "Heat never implies a season is open, and green never implies animals are present. They are two layers over one map.",
  /*
    A species North Ground holds no opportunity evidence for anywhere. The
    layer's green half still works; the heat half simply is not drawn, and the
    legend has to SAY that rather than show an empty ramp, or a hunter would
    read "nothing is hot here" from a map that was never asked the question.
  */
  noHeatTitle: "No heat for this species",
  noHeatDetail:
    "North Ground holds no certified opportunity evidence for this species anywhere yet, so nothing is shaded. That is a gap in what has been gathered, not a finding about where the animals are. The green outlines below are unaffected.",
} as const;
