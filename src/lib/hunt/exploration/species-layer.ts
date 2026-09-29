import type { OpportunityClass } from "../intelligence/types.ts";
import type { ExplorationState } from "./states.ts";

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
 * Binary by owner decision: a season running across the zone is green, and
 * everything else — conditional, needs a closer look, unknown, not certified
 * AND closed — is simply unhighlighted. `SEASON_EXCEPT_AREAS` is green because
 * the season IS open across the zone; the card names the published areas it
 * does not reach.
 *
 * NOT-GREEN IS NOT CLOSED. Nothing may render the negative of this function as
 * a closure; `SPECIES_LAYER_LEGEND` carries that sentence in words.
 */
export function seasonIsOpen(state: ExplorationState | undefined): boolean {
  return state === "SEASON_AVAILABLE" || state === "SEASON_EXCEPT_AREAS";
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
  seasonTitle: "Green outline: a season is open",
  seasonDetail:
    "Outlined where the certified rules run a season for this species across the zone on the chosen date. It is not a licence check: tags, draws, methods and animal class are in the zone's card.",
  notGreen:
    "A zone WITHOUT a green outline is not thereby closed. Zones North Ground has not certified, and zones whose answer depends on who is hunting, are simply not highlighted. Tap any zone for its full answer.",
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
