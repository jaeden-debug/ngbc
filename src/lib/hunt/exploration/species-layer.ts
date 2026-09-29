import type { EvidenceStrength } from "../intelligence/methodology.ts";
import type { HeatRenderKind } from "../intelligence/rendering.ts";
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
 * One zone's heat, as the map holds it.
 *
 * Deliberately NOT just a class. The class is a word for a band; `intensity` is
 * the continuous rank the ramp is painted from, `strength` is how well that
 * rank is evidenced — a separate question from how hot it is — and `renderKind`
 * is how finely this evidence may be drawn at all.
 */
export interface ZoneHeat {
  classification: OpportunityClass;
  intensity: number | null;
  strength: EvidenceStrength;
  renderKind: HeatRenderKind;
}

/**
 * The heat ramp: a continuous line through North Ground's own palette.
 *
 * It replaces four fixed amber tints. Four buckets could not make a heat map —
 * a hunter scanning a province saw four flat tones and read them as categories,
 * which is what they were. The map now paints the CONTINUOUS rank the engine
 * computes, and the four words survive only as names for the bands it falls in.
 *
 * The line runs cold to hot: a cold indigo-slate, through a muted plum, into
 * the bark and ochre of §38's earth neutrals, ending in campfire amber and
 * ember. Two constraints shaped it and neither is negotiable:
 *
 *   NO GREEN, ANYWHERE ON IT. Green on this map means a legal hunt exists.
 *   A cool end reaching for teal would put the legality colour at the bottom of
 *   an abundance ramp, and "cold" would read as "closed".
 *
 *   NO SEMANTIC TOKEN. `--ng-conflict` is the palette's warmest red and already
 *   means "sources disagree"; the ember end stops short of it.
 *
 * Literal hex because a Google `PolygonOptions` cannot take a CSS variable —
 * the same reason `SELECTED_STROKE` mirrors `--ng-cream` in `cartography.ts`.
 */
export const HEAT_RAMP: ReadonlyArray<{ at: number; color: string; opacity: number }> = [
  { at: 0.0, color: "#47526b", opacity: 0.13 },
  { at: 0.2, color: "#6b6070", opacity: 0.18 },
  { at: 0.4, color: "#96704f", opacity: 0.24 },
  { at: 0.6, color: "#c08a40", opacity: 0.31 },
  { at: 0.8, color: "#d4702c", opacity: 0.39 },
  { at: 1.0, color: "#a8331f", opacity: 0.46 },
];

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number];
}

function hex(channel: number): string {
  return Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, "0");
}

/**
 * The paint for a continuous intensity, interpolated between the ramp's stops.
 *
 * Clamped rather than thrown on, because an out-of-range value reaching here is
 * a bug upstream and a blank province is a worse way to learn about it than an
 * end-stop shade. The engine's own range check is the place that refuses.
 */
export function rampAt(intensity: number): { color: string; opacity: number } {
  const value = Math.min(1, Math.max(0, intensity));
  const upper = HEAT_RAMP.findIndex((stop) => value <= stop.at);
  if (upper <= 0) return { color: HEAT_RAMP[0].color, opacity: HEAT_RAMP[0].opacity };
  const from = HEAT_RAMP[upper - 1];
  const to = HEAT_RAMP[upper];
  const t = (value - from.at) / (to.at - from.at);
  const a = channels(from.color);
  const b = channels(to.color);
  return {
    color: `#${a.map((channel, index) => hex(channel + (b[index] - channel) * t)).join("")}`,
    opacity: Number((from.opacity + (to.opacity - from.opacity) * t).toFixed(4)),
  };
}

/** The middle of each named band, so the legend's swatches sit on the same line the map paints. */
const BAND_MIDPOINTS: Record<Exclude<OpportunityClass, "LIMITED_DATA">, number> = {
  LOW: 0.2, MODERATE: 0.5, HIGH: 0.7, VERY_HIGH: 0.9,
};

/** The legend's swatch for a band — derived from the ramp, never a second table. */
export const HEAT_FILL: Record<Exclude<OpportunityClass, "LIMITED_DATA">, { color: string; opacity: number }> = {
  VERY_HIGH: rampAt(BAND_MIDPOINTS.VERY_HIGH),
  HIGH: rampAt(BAND_MIDPOINTS.HIGH),
  MODERATE: rampAt(BAND_MIDPOINTS.MODERATE),
  LOW: rampAt(BAND_MIDPOINTS.LOW),
};

/** Each class in words and a glyph, so the ramp is never read by colour alone. */
export const HEAT_WORDING: Record<OpportunityClass, { label: string; glyph: string }> = {
  VERY_HIGH: { label: "Very high", glyph: "\u25b0\u25b0\u25b0\u25b0" },
  HIGH: { label: "High", glyph: "\u25b0\u25b0\u25b0\u25b1" },
  MODERATE: { label: "Moderate", glyph: "\u25b0\u25b0\u25b1\u25b1" },
  LOW: { label: "Low", glyph: "\u25b0\u25b1\u25b1\u25b1" },
  LIMITED_DATA: { label: "Not enough evidence to rank", glyph: "\u25b1\u25b1\u25b1\u25b1" },
};

/** How strongly a zone's shade is evidenced, in words. Never a colour. */
export const STRENGTH_WORDING: Record<EvidenceStrength, string> = {
  STRONG: "well evidenced",
  MODERATE: "moderately evidenced",
  WEAK: "thinly evidenced",
  INSUFFICIENT: "not evidenced enough to rank",
};

/**
 * What one zone's heat is painted with, or null for nothing.
 *
 * Three separate reasons to paint nothing, and they are not the same statement:
 *
 *   NO ENTRY — no certified evidence is held for this zone at all. Absent
 *   evidence is not evidence of absence.
 *   NULL INTENSITY / LIMITED_DATA — evidence is held and refuses to rank.
 *   Drawing it at the cold end would assert the rank the evidence declined.
 *   RANGE_EXTENT — the evidence says the species occurs here and nothing about
 *   more or less, so it carries no ramp at all (§41B).
 *
 * All three are rendered identically — unshaded — and the legend carries the
 * difference in words, because a map cannot say three things with one absence.
 */
export function heatPaintFor(heat: ZoneHeat | undefined): { color: string; opacity: number } | null {
  if (!heat || heat.classification === "LIMITED_DATA" || heat.intensity === null) return null;
  if (heat.renderKind !== "ZONE_AREA" && heat.renderKind !== "CONTINUOUS_SURFACE") return null;
  return rampAt(heat.intensity);
}

/**
 * The previous signature, kept for callers that hold only a class.
 *
 * Deliberately paints the BAND MIDPOINT rather than inventing a value: a class
 * is a band, and the honest paint for a band is its middle.
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
    "Shaded along a continuous scale from the authority's own published measurements for this species. The shade is a zone's RANK AGAINST THE OTHER ZONES of the same jurisdiction's dataset — not a count of animals, and never a density unless the authority itself published a density. An unshaded zone is one North Ground holds no certified evidence for, or one whose evidence will not support a rank; it is not a zone with no animals.",
  /* The defect this version exists to correct, said on the face of the key
     rather than only in the methodology panel. A hunter who believes the shade
     follows hunters will misread every crowded unit on the map. */
  heatEffort:
    "How many people hunted somewhere is shown as context and never moves the shade. Hunting pressure follows roads, towns and tradition as much as it follows animals.",
  heatResolution:
    "Each authority publishes one figure per whole management area, so an area is shaded evenly. Nowhere inside an area is hotter than anywhere else in it — where the animals are within an area is not something this evidence can say.",
  heatStrength:
    "How strongly a shade is evidenced is a different question from how hot it is. A zone can rank near the top of its dataset on a single thin measurement.",
  howCalculated: "How is this calculated?",
  howCalculatedDetail:
    "The datasets, authorities, years, measurements and weights behind this species' shading.",
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
