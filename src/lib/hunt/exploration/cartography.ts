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

import { MAX_HEAT_OPACITY } from "./species-layer.ts";

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
/**
 * The loudest any UNCHOSEN zone may be drawn: the top of the heat ramp, which
 * is the loudest thing that can legitimately fill a polygon.
 *
 * DERIVED, not tuned. It was 0.32, which was also the old ramp's maximum — and
 * the moment the ramp changed the two parted company and a hot neighbour could
 * out-fill the chosen zone. A constant that is right by coincidence is a
 * constant that will be wrong silently.
 */
export const MAX_STATE_FILL = MAX_HEAT_OPACITY;

/** What the chosen zone is allowed to reach, so it always clears the above. */
const SELECTED_FILL_CEILING = MAX_STATE_FILL + 0.12;

/**
 * The one green an open season wears: `--ng-open`, the palette's own regulatory
 * green, so the ring on the map and the "In season" chip in the sheet are the
 * same colour rather than two greens a hunter has to reconcile. Literal hex
 * because Google's polygon options cannot take a CSS variable.
 */
/*
 * LEGALITY IS THE OUTLINE (§41A, amended 2026-09-29). The ramp may now pass
 * through green, so this ring can no longer rely on being the only green thing
 * on the map — it has to win on LUMINANCE and WEIGHT as well as hue.
 *
 * It keeps `--ng-open`, the product's one "a season is open" green, rather than
 * taking a brighter map-only variant. Measured against the ramp as the map
 * actually composites it — a 0.16-0.56 alpha fill over the dark basemap, under
 * an opaque ring — it clears every point of the spectrum including the green
 * band. A separate map green would have split one meaning across two colours to
 * solve a problem the arithmetic says does not exist.
 */
export const SEASON_OPEN_STROKE = "#7cc08a";

/**
 * The dark line drawn UNDER the green one, so the green never has to win
 * against whatever happens to be beneath it.
 *
 * WHY IT EXISTS. Once the species surface became a full weather-radar ramp
 * (§41A, 2026-09-29), the map acquired ground that is brighter than the
 * legality green: the ramp's yellow at intensity 0.7, composited over satellite
 * imagery, measures BRIGHTER than `--ng-open`. A green line on yellow ground is
 * then a line a hunter can lose — and losing it means missing that a legal
 * opportunity exists. Raising the green would break its pairing with the "In
 * season" chip in the sheet, which is the same colour on purpose.
 *
 * So the line is CASED, the way a map cases a road: a heavier near-black stroke
 * beneath a lighter one. The green then contrasts against its own casing rather
 * than against the map, and that contrast is a constant — it cannot be changed
 * by a species, an intensity, a basemap or a zoom. This is the "sufficient
 * contrast/glow" §41A asks for, done cartographically rather than by hoping the
 * background stays dark.
 */
export const SEASON_OPEN_CASING = "#0b140e";
/**
 * How much wider the casing is than the line it carries — per band, because a
 * fixed figure buries the map at continental scale.
 *
 * MEASURED, not guessed. At national zoom a Manitoba GHA is about ten screen
 * pixels across; a 2.2px green line with a 2.4px casing is 4.6px of chrome on
 * a 10px shape, and 433 of them together read as a solid green mesh with the
 * animal surface somewhere underneath it. §41A's three scales already say what
 * each zoom is FOR — national is "where am I in the country", local is "where
 * exactly" — so the legality line follows the same rule the boundaries do: a
 * hint at national scale, emphatic where a hunter is choosing where to walk.
 */
const CASING_EXTRA_WEIGHT: Record<ZoomBand, number> = { national: 0.9, regional: 1.5, local: 2 };
/* Heavier than an ordinary boundary at every band, and still lighter than the
   chosen zone's bone outline, which has to stay the loudest line on the map. */
/* Thicker than the ramp can imitate, and still under the chosen zone's own
   stroke at every band once SEASON_HOVER is applied — the bone outline stays
   the loudest thing on the map (§41A). */
/* Local stays at 2.75 and not a tenth more: hovered it becomes 3.16, and the
   chosen zone's own stroke is 3.2. `cartography.test.ts` measures that gap, and
   raising this to 2.9 while lightening the wide zooms was caught there rather
   than on a screen. */
const SEASON_STROKE_WEIGHT: Record<ZoomBand, number> = { national: 1.3, regional: 2.4, local: 2.75 };
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
  /**
   * The species surface is drawn underneath, so this polygon is tracing paper.
   *
   * §41A: "hunting-zone interiors should normally be transparent ... think of
   * the zone layer almost like transparent tracing paper laid over a weather
   * radar". A tinted interior would both veil the surface and re-impose one
   * colour per hunting unit over a field that deliberately has none — the
   * choropleth coming back as a tint.
   *
   * The CHOSEN zone keeps a fill regardless: §41A also requires it to be the
   * loudest thing on the map, and it is the one place a per-zone wash states
   * something true — this is the zone you are asking about.
   */
  transparentInterior?: boolean;
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
  /* Heat no longer scales by band, so the loudest an unchosen zone can reach
     no longer scales either. Leaving the band factor here would compute the
     chosen zone's floor from a number heat can now exceed, and a hot neighbour
     would out-shout it — which is the failure this derivation exists to stop. */
  const loudest = Math.max(BAND_FILL[band], MAX_STATE_FILL);
  return clamp(loudest * HOVER_FILL * scale, 0, MAX_STATE_FILL);
}

export function zoneStyle(input: ZoneStyleInput): ZoneStyle {
  const scale = EMPHASIS_SCALE[input.emphasis];
  /* Over the surface, an unchosen zone contributes a boundary and nothing else. */
  const tracingPaper = Boolean(input.transparentInterior) && !input.selected;
  const tone = jurisdictionTone(input.jurisdictionId);
  const certified = input.coverage === "VERIFIED";
  /* Heat and green are independent. A zone can be hot and shut, open and cold,
     both, or neither, and the map has to be able to draw all four. */
  /*
   * HEAT IS NOT SCALED BY THE ZOOM BAND, and that is the same rule the dim
   * exemption below already states: a jurisdiction's tone is decoration, heat
   * is the layer's CONTENT.
   *
   * §41A's "fills nearly gone at local" was written about TONE, so the terrain
   * and roads carry the ground. Applying it to heat made the layer weakest at
   * local zoom — which is exactly where a hunter is deciding where to walk —
   * and against a dark basemap that reads as terrain rather than as a signal.
   * The owner's report was "why do I still not have an actual heat map".
   */
  const heatFill = input.heat ? input.heat.opacity : null;

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
      /* Over the surface the chosen zone still leads, but with a wash rather
         than a tint: it has the only bone outline on the map to carry it, and a
         0.2+ fill over a raster would hide the very evidence the hunter chose
         that zone to read. */
      fillOpacity: input.transparentInterior
        ? clamp(0.1 * scale, 0.06, 0.14)
        : clamp(Math.max(0.17 * scale, ceiling + 0.04, (input.heat?.opacity ?? 0) + 0.06), 0.1, SELECTED_FILL_CEILING),
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
      /* With heat, the hunt's zone shows its evidence like any other: a 0.22 cap
         would have made the hunt's own zone read COLDER than its neighbours,
         which misstates the evidence at the one zone the hunter cares most
         about. Without heat it stays quiet, as before. */
      fillOpacity: tracingPaper ? 0 : heatFill !== null
        ? clamp(heatFill * scale, 0.02, MAX_STATE_FILL)
        : clamp(0.07 * scale, 0.02, 0.22),
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
      fillOpacity: tracingPaper ? 0 : clamp(baseFill * dim * hover * scale, 0, MAX_STATE_FILL),
      zIndex: input.hovered ? 6 : 4,
    };
  }

  return {
    strokeColor: input.heat?.color ?? tone,
    strokeOpacity: clamp(BAND_STROKE_OPACITY[input.band] * dimStroke * (input.hovered ? 1.5 : 1) * (certified ? 1 : 0.75), 0.14, 1),
    strokeWeight: BAND_STROKE_WEIGHT[input.band] * (input.hovered ? 1.6 : 1),
    fillColor: input.heat?.color ?? tone,
    fillOpacity: tracingPaper ? 0 : clamp(baseFill * dim * hover * scale, 0, MAX_STATE_FILL),
    zIndex: input.hovered ? 5 : certified ? 3 : 2,
  };
}

/**
 * The casing for a zone whose season is open, or null when it needs none.
 *
 * Returned as its own style rather than folded into `zoneStyle` because it is
 * its own drawn object: one more polygon, on the same path, under the green
 * one. Only zones with a current legal opportunity get it, so the cost is
 * bounded by how many of those are on screen rather than by how many zones are.
 *
 * It carries NO fill. A second filled polygon would double every heat value it
 * sat under and quietly make the open zones hotter than the shut ones — the
 * exact blending of legality into evidence that §41B forbids.
 */
export function seasonCasingStyle(input: Pick<ZoneStyleInput, "seasonOpen" | "selected" | "band" | "hovered">): ZoneStyle | null {
  /* The chosen zone wears the bone outline instead; §41A allows only one
     loudest line on the map and it is that one. */
  if (!input.seasonOpen || input.selected) return null;
  return {
    strokeColor: SEASON_OPEN_CASING,
    strokeOpacity: 0.9,
    strokeWeight: SEASON_STROKE_WEIGHT[input.band] * (input.hovered ? SEASON_HOVER : 1) + CASING_EXTRA_WEIGHT[input.band],
    fillColor: SEASON_OPEN_CASING,
    fillOpacity: 0,
    /* Immediately below the green line it carries, and above the ordinary
       boundaries so a neighbour's stroke cannot be mistaken for it. */
    zIndex: (input.hovered ? 6 : 4) - 1,
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
