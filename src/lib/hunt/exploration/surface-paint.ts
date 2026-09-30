/**
 * How the species surface is painted: the ramp, the sampling, and the two
 * rules that keep it honest.
 *
 * WHAT CHANGED, AND WHY IT IS A DIFFERENT FILE. Until now "heat" was a fill on
 * a hunting polygon, so the ramp lived with the zone styling in
 * `cartography.ts`. §41A (2026-09-29) makes the animal surface a raster under
 * the zones — its own geometry, its own resolution, owing nothing to a
 * regulatory boundary — so its paint is its own concern. A zone fill can no
 * longer carry heat, and nothing in this file knows what a zone is.
 *
 * THE TWO RULES.
 *
 * 1. **Transparent is not zero, and zero is not blue.** A cell at intensity 0
 *    was SURVEYED and the species was not found. Ground with no cell was never
 *    surveyed. The first is a finding and is drawn in its own faint neutral
 *    (`SURVEYED_NONE`); the second earns nothing at all. `sampleSurface`
 *    returns `null` for the second and can never be persuaded to return 0
 *    instead, because the caller has no way to supply a cell that is not
 *    there. Until 2026-09-30 zero took the ramp's faintest blue, so half a
 *    continent where grouse were never found read as "a few grouse" — blue is
 *    for LOW, and none found is not low.
 *
 * 2. **Reconstruction is not invention.** The field under a continuous surface
 *    is a smooth kernel-weighted function; the stored cells are samples of it.
 *    Interpolating between them reconstructs the function that was already
 *    there, and the function genuinely has no structure below its bandwidth. So
 *    bilinear sampling is legitimate and zooming in shows the same field more
 *    smoothly — never more finely. The effective resolution travels with the
 *    surface and is stated in the legend, so a reader is never left to infer it
 *    from how crisp the picture looks.
 */

/** A stop on the ramp: where it sits, its colour, and how opaque it is there. */
export interface RampStop {
  at: number;
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

/**
 * Transparent → blue → cyan → green → yellow → orange → red, the owner's own
 * sequence (§41A), read as a weather radar is read. Transparent is ground with
 * no evidence at all; the ramp starts at the faintest blue: red is the strongest
 * supported concentration, and nothing about the ramp says anything about
 * whether hunting is legal there.
 *
 * THE STOPS ARE THE OWNER'S BANDS OF RANK (2026-09-30). The surfaces paint a
 * rank among the ground where the species was found (`rankIntensities`), so a
 * stop's position is a share of that ground: the bottom tenth is faint blue,
 * to 0.3 blue into cyan, to 0.5 cyan into green, to 0.7 green into yellow, to
 * 0.9 yellow into orange, and the top tenth orange into red. Under the old
 * ratio scale the ramp's first 42% was spent on blue and cyan and so was most
 * of the ground; now blue means the bottom three tenths of where the survey
 * finds the species, which is what "low but supported" means.
 *
 * Alpha climbs with intensity so that the strong places assert themselves and
 * the weak ones stay out of the way of the map underneath. The top stop is
 * deliberately short of opaque: §41A requires the basemap — water, terrain,
 * roads — to remain readable through the surface, and an opaque core would make
 * the hottest ground the least useful ground on the map.
 */
export const SURFACE_RAMP: readonly RampStop[] = [
  { at: 0.0, red: 30, green: 68, blue: 168, alpha: 0.16 },
  { at: 0.1, red: 28, green: 118, blue: 214, alpha: 0.3 },
  { at: 0.3, red: 30, green: 182, blue: 200, alpha: 0.44 },
  /* The ramp's green. Deeper and more saturated than `--ng-open`, which is the
     legality outline, so that the two are far apart in luminance once the fill
     is composited over the map. `surfaceGreenIsBeatenByTheOutline` is the test
     that holds it, and it runs at every hundredth of the ramp rather than at
     the stops — the failure would be between them. */
  { at: 0.5, red: 46, green: 176, blue: 84, alpha: 0.54 },
  { at: 0.7, red: 222, green: 208, blue: 42, alpha: 0.62 },
  { at: 0.9, red: 240, green: 138, blue: 30, alpha: 0.68 },
  { at: 1.0, red: 220, green: 32, blue: 32, alpha: 0.74 },
];

/**
 * SURVEYED, NONE FOUND — its own state, not the bottom of the ramp.
 *
 * A faint neutral, so it reads as "looked here" without reading as "a few":
 * for ruffed grouse this is 11,733 of 22,873 cells, half of what the surface
 * knows, and painting it blue put a low-abundance wash over the prairies and
 * the south where the survey is certain the bird is absent. Neutral bone at
 * low alpha keeps it distinguishable from never-surveyed ground (transparent)
 * and from the faintest detection (the ramp's first blue).
 */
export const SURVEYED_NONE: Rgba = { red: 205, green: 199, blue: 184, alpha: 0.12 };

export interface Rgba { red: number; green: number; blue: number; alpha: number }

/**
 * The paint for a sampled value: `SURVEYED_NONE` for exactly zero, the ramp
 * for anything the survey found. The one entry point a renderer uses, so no
 * painter can put zero back on the ramp.
 */
export function paintFor(value: number): Rgba {
  return value > 0 ? rampAt(value) : SURVEYED_NONE;
}

/** The ramp at one intensity, interpolated between its stops. */
export function rampAt(intensity: number): Rgba {
  const t = Math.min(1, Math.max(0, intensity));
  let lower = SURFACE_RAMP[0];
  let upper = SURFACE_RAMP[SURFACE_RAMP.length - 1];
  for (let i = 0; i < SURFACE_RAMP.length - 1; i += 1) {
    if (t >= SURFACE_RAMP[i].at && t <= SURFACE_RAMP[i + 1].at) {
      lower = SURFACE_RAMP[i];
      upper = SURFACE_RAMP[i + 1];
      break;
    }
  }
  const span = upper.at - lower.at;
  const k = span <= 0 ? 0 : (t - lower.at) / span;
  return {
    red: Math.round(lower.red + (upper.red - lower.red) * k),
    green: Math.round(lower.green + (upper.green - lower.green) * k),
    blue: Math.round(lower.blue + (upper.blue - lower.blue) * k),
    alpha: lower.alpha + (upper.alpha - lower.alpha) * k,
  };
}

/** Relative luminance, per WCAG, of a straight colour. */
export function luminance({ red, green, blue }: { red: number; green: number; blue: number }): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

/** A translucent colour composited over an opaque one. */
export function composite(over: Rgba, under: { red: number; green: number; blue: number }) {
  return {
    red: Math.round(under.red + (over.red - under.red) * over.alpha),
    green: Math.round(under.green + (over.green - under.green) * over.alpha),
    blue: Math.round(under.blue + (over.blue - under.blue) * over.alpha),
  };
}

/* ------------------------------------------------------------- the surface */

export interface SurfaceGridRef {
  latStep: number;
  lonStep: number;
  south: number;
  west: number;
  rows: number;
  cols: number;
}

/**
 * A surface ready to paint.
 *
 * `continuity` is DATA, never a renderer decision. A sample-plot survey is
 * drawn only where it was flown; a route-based field is drawn as a field. If
 * the renderer chose, it would eventually smooth the plots, which is the one
 * thing the plot survey's own publisher says may not be done.
 */
/** One surveyed plot: its own published outline, and what was counted on it. */
export interface SurfacePlot {
  id: string;
  /** 0..1 against the publisher's own field. */
  score: number;
  /** Rings of [longitude, latitude], outer first. */
  rings: number[][][];
}

export interface RenderableSurface {
  id: string;
  speciesId: string;
  /**
   * DATA, never a renderer decision. A sample-plot survey is drawn only where it
   * was flown; a route-based field is drawn as a field. If the renderer chose,
   * it would eventually smooth the plots — the one thing the plot survey's own
   * publisher says may not be done.
   */
  continuity: "CONTINUOUS" | "DISCRETE";
  /** The finest the surface may be described as, in metres. */
  effectiveResolutionMetres: number;
  /**
   * A continuous field, sampled on a regular grid. Present for CONTINUOUS only.
   */
  grid?: SurfaceGridRef;
  /** Cell index (`row * cols + col`) to intensity, 0..1. Absent index = unsurveyed. */
  cells?: ReadonlyMap<number, number>;
  /**
   * The plots that were actually surveyed. Present for DISCRETE only.
   *
   * Drawn at their own published extent with hard edges, because that is
   * exactly what the authority measured: the plot, and nothing between plots.
   */
  plots?: readonly SurfacePlot[];
  /**
   * How a plot is painted. RAMP: its score on the heat ramp. RECORDED: a
   * square where shared records place the species, painted with a hatch no
   * ramp colour can be mistaken for — a record says an animal was there, and
   * nothing about how many, so it must never read as a heat value.
   */
  style?: "RAMP" | "RECORDED";
  /**
   * How strongly a CONTINUOUS field is drawn, 0..1 (default 1). A North Ground
   * model is drawn at MODELLED_OPACITY so it never reads as louder than, or the
   * same as, what an authority measured (§41B: a model is the fallback, never
   * presented before measured evidence). Only alpha changes: the colour a value
   * earns is the ramp's, so the legend's scale still reads it.
   */
  opacity?: number;
}

export const MODELLED_OPACITY = 0.65;

/** The recorded-presence paint: a bone hatch over a faint bone wash. Off the ramp by construction. */
export const RECORDED_PRESENCE = {
  wash: { red: 236, green: 226, blue: 205, alpha: 0.16 },
  hatch: { red: 245, green: 238, blue: 222, alpha: 0.72 },
  /** Pixels between hatch lines. */
  spacing: 6,
} as const;

/**
 * The intensity at a point, or null where nothing was surveyed.
 *
 * NULL IS THE IMPORTANT RETURN. Returning 0 for unsurveyed ground would draw
 * wilderness nobody has visited as though it had been searched and found empty
 * — the exact inversion of what the surface knows. So the nearest cell must
 * exist for anything to be drawn at all, and the interpolation below only ever
 * softens a value that a real cell already supported.
 *
 * Between cells the value is bilinear over the neighbours that EXIST AND ARE
 * IN THE SAME STATE as the nearest cell, with the weights renormalized over
 * them. At the edge of the surveyed area that makes the surface lean on the
 * cells it has instead of fading toward a zero nobody measured.
 *
 * THE STATE RULE (2026-09-30). "Surveyed, none found" (0) and "found" (> 0)
 * are different findings, not two ends of one number. Blending them invented
 * values no survey produced: halfway between a detected cell at rank 0.8 and a
 * none-found cell read 0.4, painted blue, so every detected patch wore a blue
 * fringe and ground whose nearest cell was none-found was painted as "a few".
 * For ruffed grouse half of all supported cells are none-found, so the fringe
 * was a large share of the blue a hunter saw. Found ground now blends only with
 * found ground (its value stays between the detected values around it), and
 * none-found ground stays exactly 0. Only opacity softens the boundary between
 * them (`support`), never the value.
 */
export function sampleSurface(surface: RenderableSurface, latitude: number, longitude: number): number | null {
  return sampleSurfaceWithSupport(surface, latitude, longitude)?.value ?? null;
}

/**
 * The intensity at a point, and how much of the surrounding sample is backed
 * by surveyed cells (0..1), or null where nothing was surveyed.
 *
 * `support` is the share of the bilinear weight that fell on cells which
 * exist. It is 1 wherever every neighbour was surveyed and falls toward the
 * edge of the surveyed area. The renderer uses it ONLY to fade opacity inside
 * ground that is already drawn, so the edge of the evidence reads as the soft
 * edge of a radar return rather than a staircase of cells — and it can never
 * paint beyond it, because the nearest-cell rule above still decides whether a
 * point is drawn at all. The VALUE is untouched by it.
 */
export function sampleSurfaceWithSupport(
  surface: RenderableSurface, latitude: number, longitude: number,
): { value: number; support: number } | null {
  const { grid, cells } = surface;
  if (!grid || !cells) return null;
  const y = (latitude - grid.south) / grid.latStep;
  const x = (longitude - grid.west) / grid.lonStep;
  const row = Math.round(y);
  const col = Math.round(x);
  if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) return null;
  /* The nearest cell decides whether this ground is described at all, and in
     which state: found, or surveyed and none found. */
  const nearest = cells.get(row * grid.cols + col);
  if (nearest === undefined) return null;

  if (surface.continuity === "DISCRETE") return { value: nearest, support: 1 };
  const found = nearest > 0;

  const r0 = Math.floor(y);
  const c0 = Math.floor(x);
  const fy = y - r0;
  const fx = x - c0;
  let weighted = 0;
  let weight = 0;
  /* A neighbour outside this window is not in THIS reply, which says nothing
     about whether it was surveyed; it counts toward support so the edge of a
     request box never fades into a seam, and never toward the value. */
  let beyond = 0;
  for (const [dr, dc, w] of [
    [0, 0, (1 - fy) * (1 - fx)],
    [0, 1, (1 - fy) * fx],
    [1, 0, fy * (1 - fx)],
    [1, 1, fy * fx],
  ] as const) {
    if (w <= 0) continue;
    const rr = r0 + dr;
    const cc = c0 + dc;
    if (rr < 0 || rr >= grid.rows || cc < 0 || cc >= grid.cols) {
      beyond += w;
      continue;
    }
    const value = cells.get(rr * grid.cols + cc);
    if (value === undefined) continue;
    /* The other state is neither blended into the value nor counted as
       support, so the edge between found and none-found fades in opacity
       from both sides instead of inventing an intermediate value. */
    if ((value > 0) !== found) continue;
    weighted += value * w;
    weight += w;
  }
  if (weight <= 0) return { value: nearest, support: 1 };
  return { value: weighted / weight, support: Math.min(1, weight + beyond) };
}

/**
 * How opaque the edge of the evidence is drawn, from its support: full inside,
 * fading to nothing at the boundary of the surveyed area. Smoothstep over the
 * outer half of an edge cell, which is where support falls from 1 to ½.
 */
export function edgeFade(support: number): number {
  const t = Math.min(1, Math.max(0, (support - 0.5) / 0.5));
  return t * t * (3 - 2 * t);
}

/**
 * The screen resolution, in metres per pixel, past which drawing the surface
 * any more finely adds nothing.
 *
 * Used to size the offscreen buffer: there is no point sampling a 40 km field
 * at one sample per screen pixel when the map is zoomed to a street. The buffer
 * is capped so that one sample covers at most a quarter of the effective
 * resolution — fine enough that the picture is smooth, coarse enough that the
 * work does not grow without bound as a hunter zooms in.
 */
export function bufferStepPx(effectiveResolutionMetres: number, metresPerPixel: number): number {
  if (metresPerPixel <= 0) return 4;
  const quarterResolutionPx = effectiveResolutionMetres / 4 / metresPerPixel;
  return Math.min(24, Math.max(2, Math.round(quarterResolutionPx)));
}
