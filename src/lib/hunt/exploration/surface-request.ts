import type { RenderableSurface, SurfacePlot } from "./surface-paint.ts";

/**
 * The species surface's request and reply, as pure functions.
 *
 * `useSpeciesSurface` is a React hook and cannot be exercised by the node test
 * runner; everything it decides lives here instead, so the rules that keep the
 * layer honest are tested rather than trusted:
 *
 * - the request names GROUND, never a zone — there is no zone parameter in any
 *   function below, and nothing here imports a zone or regulatory module;
 * - a reply for a species no longer on screen is discarded, never merged;
 * - "not held", "too large to send" and "the request failed" are three
 *   different states, and none of them is drawn as an empty map without words.
 *
 * It never reads a date either. Animal evidence and hunting legality are
 * separate systems (§41B), so changing the hunt date moves the green outlines
 * and leaves the surface where it was.
 */

export interface GroundBox { west: number; south: number; east: number; north: number }

/** How far beyond the viewport the request reaches, as a fraction of each side. */
export const REQUEST_MARGIN = 0.3;
/** Snap outward so that small pans ask the same question the CDN already answered. */
export const SNAP_DEGREES = 0.5;

/**
 * The box to ask for: the viewport plus the margin the renderer draws beyond
 * it, snapped outward to whole half-degrees.
 *
 * The margin matches `SurfaceLayer`'s, so the ground the renderer paints past
 * the screen edge is ground the reply actually covers — without it, the first
 * pan revealed a strip the request had never asked about.
 */
export function surfaceRequestBox(view: GroundBox, margin = REQUEST_MARGIN): GroundBox {
  const latPad = (view.north - view.south) * margin;
  const lonPad = (view.east - view.west) * margin;
  const down = (value: number) => Math.floor(value / SNAP_DEGREES) * SNAP_DEGREES;
  const up = (value: number) => Math.ceil(value / SNAP_DEGREES) * SNAP_DEGREES;
  return {
    west: Math.max(-180, down(view.west - lonPad)),
    south: Math.max(-90, down(view.south - latPad)),
    east: Math.min(180, up(view.east + lonPad)),
    north: Math.min(90, up(view.north + latPad)),
  };
}

/** Whether `inner` lies wholly inside `outer`. */
export function boxContains(outer: GroundBox, inner: GroundBox): boolean {
  return outer.west <= inner.west && outer.south <= inner.south && outer.east >= inner.east && outer.north >= inner.north;
}

export function boxParam(box: GroundBox): string {
  return `${box.west},${box.south},${box.east},${box.north}`;
}

export function surfaceUrl(speciesId: string, box: GroundBox): string {
  return `/api/hunt/species-surface?speciesId=${encodeURIComponent(speciesId)}&bbox=${boxParam(box)}`;
}

/* ------------------------------------------------------------------ reply */

interface PackedCells {
  origin: [number, number];
  stepDegrees: [number, number];
  columns: number;
  rows: number;
  /** 0..1000, or null for ground nobody surveyed. */
  values: (number | null)[];
}

interface ReplyFeature {
  id: string;
  score: number | null;
  geometry?: { type: string; coordinates: unknown };
}

export interface ReplySurface {
  id: string;
  speciesId: string;
  geometryKind: string;
  continuity: "CONTINUOUS" | "DISCRETE";
  unmappedGround: "NOT_SURVEYED" | "NO_EVIDENCE_HELD";
  effectiveResolution: { metres: number | null; statedAs: string };
  evidence?: { tier: string; grade: string; measured: boolean };
  season?: { observedSeason: string; matchesHuntingSeason: boolean; warning?: string } | null;
  scale?: { statedAs: string; unit: string | null; comparable: boolean };
  provenance?: Record<string, unknown>;
  features?: ReplyFeature[];
  cells?: PackedCells;
}

export interface SurfaceReply {
  speciesId?: string;
  surfaces?: ReplySurface[];
  refusals?: Array<{ surfaceId?: string; reason?: string; message?: string }>;
  emptyMeans?: string;
  status?: string;
  message?: string;
}

export interface SurfaceLegendLayer {
  id: string;
  geometryKind: string;
  continuity: "CONTINUOUS" | "DISCRETE";
  unmappedGround: "NOT_SURVEYED" | "NO_EVIDENCE_HELD";
  resolutionStatedAs: string;
  scaleStatedAs: string;
  unit: string;
  seasonWarning: string | null;
  authority: string;
  title: string;
  url: string;
  licence: string;
  attribution: string;
  limitations: string[];
  measured: boolean;
}

export interface SurfaceLegendState {
  /** Each drawn surface's own account of itself, in its own words. */
  layers: SurfaceLegendLayer[];
  /** What ground with nothing on it means, from the reply rather than from us. */
  emptyMeans: string;
  /** Why a request was refused, when one was. Never silently an empty map. */
  refusals: string[];
}

/**
 * The four outcomes a hunter can be shown, kept apart:
 *
 * - `DRAWN`: evidence came back and is on the map.
 * - `NOT_HELD`: North Ground holds no surface for this species — a gap in what
 *   North Ground holds, NOT a finding that the animal is absent.
 * - `NONE_IN_VIEW`: a surface exists but none of it covers this ground.
 * - `UNAVAILABLE`: the request failed. Nothing is drawn, and nothing is claimed.
 */
export type SurfaceOutcome = "IDLE" | "LOADING" | "DRAWN" | "NOT_HELD" | "NONE_IN_VIEW" | "UNAVAILABLE";

export interface SpeciesSurfaceState {
  /** The species this state describes. Nothing here belongs to any other. */
  speciesId: string | null;
  outcome: SurfaceOutcome;
  surfaces: readonly RenderableSurface[];
  legend: SurfaceLegendState | null;
  /** The server's own sentence for NOT_HELD / UNAVAILABLE / refusals. */
  message: string | null;
}

export const IDLE_SURFACE: SpeciesSurfaceState = { speciesId: null, outcome: "IDLE", surfaces: [], legend: null, message: null };

/** GeoJSON Polygon or MultiPolygon to rings of [lon, lat]. Anything else is skipped. */
function ringsOf(geometry: ReplyFeature["geometry"]): number[][][] | null {
  if (!geometry) return null;
  if (geometry.type === "Polygon") return geometry.coordinates as number[][][];
  if (geometry.type === "MultiPolygon") return (geometry.coordinates as number[][][][]).flat();
  return null;
}

/**
 * One reply surface as something the renderer can paint.
 *
 * `continuity` and `effectiveResolution` are carried through unchanged: the
 * renderer smooths only what the reply says is a field, and never at a finer
 * resolution than the reply declares.
 */
export function toRenderable(surface: ReplySurface): RenderableSurface | null {
  const common = {
    id: surface.id,
    speciesId: surface.speciesId,
    continuity: surface.continuity,
    /* A surface with no stated resolution is treated as coarse, never fine. */
    effectiveResolutionMetres: surface.effectiveResolution.metres ?? 100_000,
  };
  if (surface.continuity === "CONTINUOUS" && surface.cells) {
    const { origin, stepDegrees, columns, rows, values } = surface.cells;
    /* Dense window to a sparse map. `null` NEVER becomes a key: an absent entry
       is what makes unsurveyed ground undrawable downstream, and a 0 entry is
       what makes surveyed-and-none-found drawable. For ruffed grouse the second
       is 11,733 of 22,873 cells — half of what the surface knows is a negative
       finding, and flattening it into the first would throw that away. */
    const cells = new Map<number, number>();
    for (let i = 0; i < values.length; i += 1) {
      const value = values[i];
      if (value === null || value === undefined || !Number.isFinite(value)) continue;
      cells.set(i, value / 1000);
    }
    if (!cells.size) return null;
    return {
      ...common,
      grid: { lonStep: stepDegrees[0], latStep: stepDegrees[1], west: origin[0], south: origin[1], cols: columns, rows },
      cells,
    };
  }
  if (surface.continuity !== "DISCRETE") return null;
  const plots: SurfacePlot[] = [];
  for (const feature of surface.features ?? []) {
    /* A plot the evidence will not rank is not drawn at the bottom of the
       ramp: a null score is not a surveyed zero. */
    if (typeof feature.score !== "number") continue;
    const rings = ringsOf(feature.geometry);
    if (rings) plots.push({ id: feature.id, score: feature.score, rings });
  }
  return plots.length ? { ...common, plots } : null;
}

function legendLayer(surface: ReplySurface): SurfaceLegendLayer {
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  return {
    id: surface.id,
    geometryKind: surface.geometryKind,
    continuity: surface.continuity,
    unmappedGround: surface.unmappedGround,
    resolutionStatedAs: surface.effectiveResolution.statedAs,
    scaleStatedAs: surface.scale?.statedAs ?? "",
    unit: surface.scale?.unit ?? "",
    seasonWarning: surface.season && surface.season.matchesHuntingSeason === false ? surface.season.warning ?? null : null,
    authority: text(surface.provenance?.authority),
    title: text(surface.provenance?.title),
    url: text(surface.provenance?.url),
    licence: text(surface.provenance?.licence),
    attribution: text(surface.provenance?.attribution),
    limitations: Array.isArray(surface.provenance?.limitations) ? (surface.provenance.limitations as string[]) : [],
    measured: surface.evidence?.measured === true,
  };
}

/**
 * A reply as the state to show, or null when the reply belongs to a species
 * that is no longer the one on screen.
 *
 * THE NULL IS THE LEAK GUARD. A reply for moose that lands after the hunter
 * switched to ruffed grouse must not be drawn under grouse's name — the stale
 * hotspot would be the part of the map the hunter is not looking at, the worst
 * place for a wrong answer to survive.
 */
export function surfaceStateFromReply(
  wantedSpeciesId: string | null,
  requestedSpeciesId: string,
  httpStatus: number,
  payload: SurfaceReply | null,
): SpeciesSurfaceState | null {
  if (!wantedSpeciesId || wantedSpeciesId !== requestedSpeciesId) return null;
  if (payload?.speciesId && payload.speciesId !== requestedSpeciesId) return null;
  const refusals = (payload?.refusals ?? []).map((r) => r.message ?? r.reason ?? "").filter(Boolean);

  if (httpStatus === 404 && payload?.status === "NO_SURFACE") {
    return {
      speciesId: requestedSpeciesId,
      outcome: "NOT_HELD",
      surfaces: [],
      legend: { layers: [], emptyMeans: payload.message ?? "", refusals },
      message: payload.message ?? null,
    };
  }
  if (httpStatus === 413) {
    return {
      speciesId: requestedSpeciesId,
      outcome: "NONE_IN_VIEW",
      surfaces: [],
      legend: { layers: [], emptyMeans: "", refusals },
      message: refusals[0] ?? null,
    };
  }
  if (httpStatus < 200 || httpStatus >= 300 || !payload) {
    return {
      speciesId: requestedSpeciesId,
      outcome: "UNAVAILABLE",
      surfaces: [],
      legend: null,
      message: "The species layer could not be loaded. Nothing is drawn, and nothing is implied about the animals.",
    };
  }
  const replySurfaces = (payload.surfaces ?? []).filter((surface) => surface.speciesId === requestedSpeciesId);
  const renderable = replySurfaces.map(toRenderable).filter((s): s is RenderableSurface => s !== null);
  return {
    speciesId: requestedSpeciesId,
    outcome: renderable.length ? "DRAWN" : "NONE_IN_VIEW",
    surfaces: renderable,
    legend: { layers: replySurfaces.map(legendLayer), emptyMeans: payload.emptyMeans ?? "", refusals },
    message: renderable.length ? null : payload.emptyMeans ?? null,
  };
}
