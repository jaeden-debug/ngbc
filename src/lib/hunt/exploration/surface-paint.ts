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
 * 1. **Transparent is not zero.** A cell at intensity 0 was SURVEYED and the
 *    species was not found. Ground with no cell was never surveyed. The first
 *    is a finding and earns the faintest blue the ramp can show; the second
 *    earns nothing at all. `sampleSurface` returns `null` for the second and
 *    can never be persuaded to return 0 instead, because the caller has no way
 *    to supply a cell that is not there.
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
 * sequence (§41A), read as a weather radar is read: red is the strongest
 * supported concentration, and nothing about the ramp says anything about
 * whether hunting is legal there.
 *
 * Alpha climbs with intensity so that the strong places assert themselves and
 * the weak ones stay out of the way of the map underneath. The top stop is
 * deliberately short of opaque: §41A requires the basemap — water, terrain,
 * roads — to remain readable through the surface, and an opaque core would make
 * the hottest ground the least useful ground on the map.
 */
export const SURFACE_RAMP: readonly RampStop[] = [
  { at: 0.0, red: 24, green: 54, blue: 138, alpha: 0.0 },
  { at: 0.08, red: 30, green: 68, blue: 168, alpha: 0.2 },
  { at: 0.26, red: 28, green: 118, blue: 214, alpha: 0.4 },
  { at: 0.42, red: 30, green: 182, blue: 200, alpha: 0.5 },
  /* The ramp's green. Deeper and more saturated than `--ng-open`, which is the
     legality outline, so that the two are far apart in luminance once the fill
     is composited over the map. `surfaceGreenIsBeatenByTheOutline` is the test
     that holds it, and it runs at every hundredth of the ramp rather than at
     the stops — the failure would be between them. */
  { at: 0.56, red: 46, green: 176, blue: 84, alpha: 0.56 },
  { at: 0.7, red: 222, green: 208, blue: 42, alpha: 0.62 },
  { at: 0.85, red: 240, green: 138, blue: 30, alpha: 0.68 },
  { at: 1.0, red: 220, green: 32, blue: 32, alpha: 0.74 },
];

export interface Rgba { red: number; green: number; blue: number; alpha: number }

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
}

/**
 * The intensity at a point, or null where nothing was surveyed.
 *
 * NULL IS THE IMPORTANT RETURN. Returning 0 for unsurveyed ground would draw
 * wilderness nobody has visited as though it had been searched and found empty
 * — the exact inversion of what the surface knows. So the nearest cell must
 * exist for anything to be drawn at all, and the interpolation below only ever
 * softens a value that a real cell already supported.
 *
 * Between cells the value is bilinear over the neighbours that EXIST, with the
 * weights renormalized over them. At the edge of the surveyed area that makes
 * the surface lean on the cells it has instead of fading toward a zero nobody
 * measured.
 */
export function sampleSurface(surface: RenderableSurface, latitude: number, longitude: number): number | null {
  const { grid, cells } = surface;
  if (!grid || !cells) return null;
  const y = (latitude - grid.south) / grid.latStep;
  const x = (longitude - grid.west) / grid.lonStep;
  const row = Math.round(y);
  const col = Math.round(x);
  if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) return null;
  /* The nearest cell decides whether this ground is described at all. */
  if (!cells.has(row * grid.cols + col)) return null;

  if (surface.continuity === "DISCRETE") return cells.get(row * grid.cols + col) ?? null;

  const r0 = Math.floor(y);
  const c0 = Math.floor(x);
  const fy = y - r0;
  const fx = x - c0;
  let weighted = 0;
  let weight = 0;
  for (const [dr, dc, w] of [
    [0, 0, (1 - fy) * (1 - fx)],
    [0, 1, (1 - fy) * fx],
    [1, 0, fy * (1 - fx)],
    [1, 1, fy * fx],
  ] as const) {
    if (w <= 0) continue;
    const rr = r0 + dr;
    const cc = c0 + dc;
    if (rr < 0 || rr >= grid.rows || cc < 0 || cc >= grid.cols) continue;
    const value = cells.get(rr * grid.cols + cc);
    if (value === undefined) continue;
    weighted += value * w;
    weight += w;
  }
  if (weight <= 0) return cells.get(row * grid.cols + col) ?? null;
  return weighted / weight;
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
