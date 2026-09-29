/**
 * How the map draws official geography: one set of rules, in one place.
 *
 * The map had one look at every scale — an overlay of equal polygons on a
 * basemap, where the chosen zone barely differed from its neighbours and
 * Ontario looked exactly like Manitoba. These rules give it three:
 *
 * - **National** — where you are in the country. Jurisdictions read as quiet
 *   tonal blocks and their internal lines almost disappear.
 * - **Regional** — which zone is which. Boundaries take over from fills.
 * - **Local** — where exactly. The lines are crisp, the fills nearly gone, and
 *   the terrain, water and roads underneath carry the ground truth.
 *
 * One thing is always the loudest: the zone you chose. Everything else — a
 * neighbour, a jurisdiction's tone, a species state — is quieter than it by
 * construction, not by hand-tuned luck, and the tests hold that.
 *
 * Colour never carries meaning alone (§40): a species state is a word and a
 * glyph on the label as well as a tint here, and the jurisdiction tones are
 * a family of quiet greens and earths, not a legend.
 *
 * THE SPECIES LAYER (§41A, decided 2026-09-29) adds two channels over the same
 * geometry, and they are deliberately different channels because they are
 * different facts:
 *
 * - **Heat is the FILL** — an ember ramp, semi-translucent, from the certified
 *   opportunity evidence. A zone with no evidence takes NO heat at all and
 *   falls back to the quiet jurisdiction tone, because absent evidence is not
 *   a low value.
 * - **An open season is the STROKE** — one green, binary. Highlighted or not.
 *   Conditional, unknown and not-certified draw nothing, so a hunter can see
 *   heat and openness at once instead of decoding five tints.
 *
 * Heat never implies legality and green never implies animals. A zone that is
 * not green is NOT closed, which is why the legend and the zone card carry
 * both meanings in words.
 */

export type ZoomBand = "national" | "regional" | "local";
export type Emphasis = "light" | "standard" | "strong";

/** Which of the three the map is currently working at. */
export function zoomBand(zoom: number): ZoomBand {
  if (zoom < 6.5) return "national";
  if (zoom < 9.5) return "regional";
  return "local";
}

/**
 * A quiet tone per jurisdiction, so a national view shows where one ends and
 * the next begins without colouring the country in. They sit within the brand's
 * greens and earths and differ in hue, not in loudness.
 */
const JURISDICTION_TONE: Record<string, string> = {
  "jurisdiction:ca-on": "#b8d3a8",
  "jurisdiction:ca-qc": "#a9c8bd",
  "jurisdiction:ca-mb": "#d2c79c",
  "jurisdiction:ca-ab": "#cbb79c",
  "jurisdiction:ca-sk": "#c3cba4",
  "jurisdiction:ca-bc": "#a8c2cc",
  "jurisdiction:ca-nl": "#bcc0d0",
  "jurisdiction:ca-yt": "#cdbfc6",
  "jurisdiction:ca-nt": "#b5c6c0",
  "jurisdiction:ca-nu": "#c8cdd2",
  "jurisdiction:ca-nb": "#c0cfae",
  "jurisdiction:ca-ns": "#b1c9b4",
  "jurisdiction:ca-pe": "#d3c4b0",
};
const NEUTRAL_TONE = "#8d9c87";
/** The bone of the brand: reserved for the chosen zone and nothing else. */
export const SELECTED_STROKE = "#f0ead8";

export function jurisdictionTone(jurisdictionId: string | undefined): string {
  return (jurisdictionId && JURISDICTION_TONE[jurisdictionId]) || NEUTRAL_TONE;
}

const EMPHASIS_SCALE: Record<Emphasis, number> = { light: 0.68, standard: 1, strong: 1.42 };
const HOVER_FILL = 1.55;
/* Heat tints a zone, but the chosen zone still has to lead, so the tints are
   held below it: the ceiling below is what any unchosen zone can reach, and
   the chosen one is computed to clear it. */
export const MAX_STATE_FILL = 0.32;
const STATE_BAND_SCALE: Record<ZoomBand, number> = { national: 0.9, regional: 0.8, local: 0.7 };

/**
 * The one green an open season wears: `--ng-open`, the palette's own regulatory
 * green, so the ring on the map and the "In season" chip in the sheet are the
 * same colour rather than two greens a hunter has to reconcile. Literal hex
 * because Google's polygon options cannot take a CSS variable.
 */
export const SEASON_OPEN_STROKE = "#7cc08a";
/* Heavier than an ordinary boundary at every band, and still lighter than the
   chosen zone's bone outline, which has to stay the loudest line on the map. */
const SEASON_STROKE_WEIGHT: Record<ZoomBand, number> = { national: 1.9, regional: 2.3, local: 2.5 };
const SEASON_HOVER = 1.15;

/** Fills first: the national view reads as areas, the local view as lines. */
const BAND_FILL: Record<ZoomBand, number> = { national: 0.07, regional: 0.045, local: 0.028 };
const BAND_STROKE_WEIGHT: Record<ZoomBand, number> = { national: 0.7, regional: 1.1, local: 1.4 };
const BAND_STROKE_OPACITY: Record<ZoomBand, number> = { national: 0.3, regional: 0.5, local: 0.62 };

export interface ZoneStyleInput {
  coverage: string;
  jurisdictionId?: string;
  selected: boolean;
  /** The zone the hunt location resolved to, when it is not the selected one. */
  hunt: boolean;
  hovered: boolean;
  /** Something is selected and this is not it. */
  dimmed: boolean;
  /**
   * The heat fill for this zone, when the species layer holds evidence for it.
   * ABSENT means no evidence is held — never a cold value.
   */
  heat?: { color: string; opacity: number };
  /**
   * Binary: a season is open here for the chosen species on the hunt date.
   * False covers conditional, unknown, not-certified AND closed alike, so it
   * is never read as "closed" on its own; the legend and card say so in words.
   */
  seasonOpen: boolean;
  band: ZoomBand;
  emphasis: Emphasis;
}

export interface ZoneStyle {
  strokeColor: string;
  strokeOpacity: number;
  strokeWeight: number;
  fillColor: string;
  fillOpacity: number;
  zIndex: number;
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** The strongest fill any zone that is not the chosen one can reach here. */
function unchosenFillCeiling(band: ZoomBand, emphasis: Emphasis): number {
  const scale = EMPHASIS_SCALE[emphasis];
  const loudest = Math.max(BAND_FILL[band], MAX_STATE_FILL * STATE_BAND_SCALE[band]);
  return clamp(loudest * HOVER_FILL * scale, 0, MAX_STATE_FILL);
}

export function zoneStyle(input: ZoneStyleInput): ZoneStyle {
  const scale = EMPHASIS_SCALE[input.emphasis];
  const tone = jurisdictionTone(input.jurisdictionId);
  const certified = input.coverage === "VERIFIED";
  /* Heat and green are independent. A zone can be hot and shut, open and cold,
     both, or neither, and the map has to be able to draw all four. */
  const heatFill = input.heat ? input.heat.opacity * STATE_BAND_SCALE[input.band] : null;

  if (input.selected) {
    // The focal plane: the only bone outline on the map, and always the strongest
    // fill — computed to clear whatever the loudest unchosen zone can reach here.
    // The bone wins over the season green even where a season is open: the sheet
    // beside it already says "In season" in words, and two outlines cannot both
    // be the loudest thing on the map.
    const ceiling = unchosenFillCeiling(input.band, input.emphasis);
    return {
      strokeColor: SELECTED_STROKE,
      strokeOpacity: 1,
      strokeWeight: input.band === "national" ? 2.6 : 3.2,
      fillColor: input.heat?.color ?? tone,
      fillOpacity: clamp(Math.max(0.17 * scale, ceiling + 0.04, (input.heat?.opacity ?? 0) + 0.06), 0.1, 0.44),
      zIndex: 8,
    };
  }

  if (input.hunt) {
    // Where the hunt is, while you read somewhere else: present, not competing.
    return {
      strokeColor: SELECTED_STROKE,
      strokeOpacity: 0.72,
      strokeWeight: 1.8,
      fillColor: input.heat?.color ?? tone,
      fillOpacity: clamp((heatFill ?? 0.07) * scale, 0.02, 0.22),
      zIndex: 7,
    };
  }

  /* Everything else. Dimming a neighbour takes fill, never its boundary: the
     point is a focal plane, not a blacked-out map.
     HEAT IS EXEMPT. The focal-plane rule was written when a fill was decoration
     — a jurisdiction's tone. Heat is the layer's CONTENT, and dimming it meant
     that choosing one zone erased the evidence for every other zone on screen,
     which is the whole thing the hunter switched the layer on to see. The
     chosen zone still leads: its fill is computed to clear the undimmed
     ceiling, which already allows for the top of the ramp. */
  const dim = input.dimmed && !input.heat ? 0.42 : 1;
  const dimStroke = input.dimmed ? 0.72 : 1;
  const hover = input.hovered ? HOVER_FILL : 1;
  /* No evidence is not a cold value: the zone keeps the map's own quiet tone
     rather than taking the bottom of the ramp. */
  const baseFill = heatFill ?? BAND_FILL[input.band] * (certified ? 1 : 0.6);

  if (input.seasonOpen) {
    /* The green ring, at a weight that survives the national band, sitting above
       its neighbours so an open zone is never buried by one that is merely hot. */
    return {
      strokeColor: SEASON_OPEN_STROKE,
      strokeOpacity: clamp(0.95 * dimStroke, 0.5, 1),
      strokeWeight: SEASON_STROKE_WEIGHT[input.band] * (input.hovered ? SEASON_HOVER : 1),
      fillColor: input.heat?.color ?? tone,
      fillOpacity: clamp(baseFill * dim * hover * scale, 0, MAX_STATE_FILL),
      zIndex: input.hovered ? 6 : 4,
    };
  }

  return {
    strokeColor: input.heat?.color ?? tone,
    strokeOpacity: clamp(BAND_STROKE_OPACITY[input.band] * dimStroke * (input.hovered ? 1.5 : 1) * (certified ? 1 : 0.75), 0.14, 1),
    strokeWeight: BAND_STROKE_WEIGHT[input.band] * (input.hovered ? 1.6 : 1),
    fillColor: input.heat?.color ?? tone,
    fillOpacity: clamp(baseFill * dim * hover * scale, 0, MAX_STATE_FILL),
    zIndex: input.hovered ? 5 : certified ? 3 : 2,
  };
}

/**
 * How much of a zone has to be on screen before it earns a label.
 *
 * At national scale most zones are too small to name, and naming them all is
 * how a map becomes a wall of numbers that fights the basemap's own labels.
 * The chosen zone is exempt: it is named wherever it is.
 */
export function labelMinimumSpanPx(band: ZoomBand): number {
  return band === "national" ? 54 : band === "regional" ? 34 : 24;
}
