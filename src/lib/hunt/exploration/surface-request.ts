import { MODELLED_OPACITY, UNSUITABLE_VALUE, type RenderableSurface, type SurfacePlot } from "./surface-paint.ts";

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
 * It reads the hunt date's MONTH, and nothing else about the date (§41B,
 * seasonal truth, 2026-09-30). A June breeding survey of a migrant says where
 * it breeds, not where it is hunted; the month selects which season's
 * EVIDENCE is drawn. It is not a legal input and nothing legal can reach the
 * surface through it: animal evidence and hunting legality stay separate
 * systems, so a day within the same month asks the same question, and for a
 * bird that stays all year every month does.
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
  /* A view across the antimeridian arrives with west > east. The surfaces are
     North American and the server wants a west-to-east box, so ask for the
     whole band of longitude rather than an inverted box it must refuse. */
  if (view.west > view.east) view = { ...view, west: -180, east: 180 };
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

/**
 * The ground the renderer will paint for a view: the view plus the renderer's
 * margin, unsnapped. A held reply is enough only while it covers ALL of this —
 * checking the bare view let a pan paint a margin the reply never reached.
 */
export function paintedGround(view: GroundBox, margin = REQUEST_MARGIN): GroundBox {
  if (view.west > view.east) return { west: -180, south: view.south, east: 180, north: view.north };
  const latPad = (view.north - view.south) * margin;
  const lonPad = (view.east - view.west) * margin;
  return {
    west: Math.max(-180, view.west - lonPad),
    south: Math.max(-90, view.south - latPad),
    east: Math.min(180, view.east + lonPad),
    north: Math.min(90, view.north + latPad),
  };
}

/** Whether `inner` lies wholly inside `outer`. */
export function boxContains(outer: GroundBox, inner: GroundBox): boolean {
  return outer.west <= inner.west && outer.south <= inner.south && outer.east >= inner.east && outer.north >= inner.north;
}

export function boxParam(box: GroundBox): string {
  return `${box.west},${box.south},${box.east},${box.north}`;
}

/**
 * The month of a hunt date, 1–12, read from the ISO text itself — a hunt date
 * is a calendar day and is never routed through a timestamp (§41A). A date
 * that is not a date falls back to the current month.
 */
export function evidenceMonth(date: string | null | undefined, now: Date = new Date()): number {
  const match = /^\d{4}-(\d{2})-\d{2}$/.exec(date ?? "");
  const month = match ? Number(match[1]) : NaN;
  return month >= 1 && month <= 12 ? month : now.getMonth() + 1;
}

export function surfaceUrl(speciesId: string, box: GroundBox, month: number): string {
  return `/api/hunt/species-surface?speciesId=${encodeURIComponent(speciesId)}&bbox=${boxParam(box)}&month=${month}`;
}

/* ------------------------------------------------------------------ reply */

interface PackedCells {
  origin: [number, number];
  stepDegrees: [number, number];
  columns: number;
  rows: number;
  /** 0..1000; null for no evidence or outside the range; -1 for inside the range, rated unsuitable. */
  values: (number | null)[];
  /** 1 at the artifact's own cells; k when a wide window was sent at k × k cells per value. */
  levelOfDetail?: number;
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
  /** The evidence tier, what the heat represents, and how much weight it bears (§41B). */
  tier?: string;
  represents?: string;
  confidence?: { level: string; rule: string };
  visualTransform?: { kind: string; statedAs: string };
  /** The months it speaks for, and whether the month asked is one of them. */
  evidenceWindow?: { id: string; months: number[]; statedAs: string };
  seasonMatch?: "IN_WINDOW" | "NEAREST" | "UNFILTERED";
  role?: "PRIMARY" | "COMPLEMENT_BEYOND";
  resolution?: { source: ResolutionWords; model: ResolutionWords; display: ResolutionWords };
  staleness?: { state: string; asOf: string; inputs: Array<{ input: string; kind: string; datedFrom: string; ageYears: number; state: string }> };
  cellStates?: { nullMeans: string; zeroMeans: string | null; negativeMeans: string | null };
}

interface ResolutionWords { metres: number | null; statedAs: string }

export interface SurfaceReply {
  speciesId?: string;
  surfaces?: ReplySurface[];
  refusals?: Array<{ surfaceId?: string; reason?: string; message?: string }>;
  season?: { month: number | null; matched: string; statedAs: string | null };
  setAside?: Array<{ surfaceId: string; reason: string; message: string }>;
  emptyMeans?: string;
  status?: string;
  message?: string;
  /** Where the species' map lies when this view misses it; `west` may lie below -180. */
  elsewhere?: GroundBox | null;
  /** Where the species' map lies for this month, on every 200 reply; `west` may lie below -180. */
  extent?: GroundBox | null;
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
  /** The evidence tier and what the heat represents, in the surface's own words. */
  tier: string;
  represents: string;
  confidence: { level: string; rule: string } | null;
  /** How a value became a colour; never a change to the value. */
  visualTransform: { kind: string; statedAs: string } | null;
  /** A North Ground model's id and version, when the surface is one. */
  modelVersion: string | null;
  /** 1 at the artifact's own cells; k when sent at k × k cells per value. */
  levelOfDetail: number;
  /** The season this layer speaks for, in words. */
  window: string | null;
  role: "PRIMARY" | "COMPLEMENT_BEYOND";
  /** Source, model and display resolution, each in its own words (§41B). */
  resolution: { source: string; model: string; display: string } | null;
  /** CURRENT, AGEING or STALE, and the input that decides it. */
  staleness: { state: string; oldest: string } | null;
}

export interface SurfaceLegendState {
  /** Each drawn surface's own account of itself, in its own words. */
  layers: SurfaceLegendLayer[];
  /** How the hunt month was matched; a NEAREST match is always said. */
  season?: { matched: string; statedAs: string | null } | null;
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
  /**
   * A newer request for this species failed while an older reply is still
   * drawn. The drawn evidence stays (it is right for its own ground) and the
   * failure is said, rather than blamed on survey coverage.
   */
  failure?: string | null;
  /**
   * NONE_IN_VIEW only: the ground the species' map does describe, so the
   * legend can say the map lies elsewhere and take the hunter there instead of
   * leaving an empty layer that reads as "no animals". `west` may lie below
   * -180 for a range that crosses the antimeridian.
   */
  elsewhere?: GroundBox | null;
  /**
   * The whole of the species' map for the month, from any 200 reply — so a
   * view that misses a map the reply nonetheless holds (the request reaches
   * past the screen) can still say where it is (`surfaceInView`).
   */
  extent?: GroundBox | null;
}

/** A box the server says the map lies in, if it is a real one. */
function groundBoxOf(value: GroundBox | null | undefined): GroundBox | null {
  if (!value) return null;
  const { west, south, east, north } = value;
  if (![west, south, east, north].every(Number.isFinite)) return null;
  if (south > north || west > east || south < -90 || north > 90 || west < -360 || east > 180) return null;
  return { west, south, east, north };
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
export function toRenderable(surface: ReplySurface, context: { alongsideMeasured?: boolean } = {}): RenderableSurface | null {
  const common = {
    id: surface.id,
    speciesId: surface.speciesId,
    continuity: surface.continuity,
    /* A surface with no stated resolution is treated as coarse, never fine. */
    effectiveResolutionMetres: surface.effectiveResolution.metres ?? 100_000,
    role: surface.role ?? "PRIMARY",
  };
  if (surface.continuity === "CONTINUOUS" && surface.cells) {
    const { origin, stepDegrees, columns, rows, values } = surface.cells;
    /* Dense window to a sparse map. `null` NEVER becomes a key: an absent entry
       is what makes unsurveyed ground undrawable downstream, and a 0 entry is
       what makes surveyed-and-none-found drawable. For ruffed grouse the second
       is 11,733 of 22,873 cells — half of what the surface knows is a negative
       finding, and flattening it into the first would throw that away. */
    const cells = new Map<number, number>();
    let drawable = 0;
    for (let i = 0; i < values.length; i += 1) {
      const value = values[i];
      if (value === null || value === undefined || !Number.isFinite(value)) continue;
      /* Inside the range and rated unsuitable: its own state, drawn as nothing
         and never blended into what is drawn beside it. */
      if (value < 0) {
        cells.set(i, UNSUITABLE_VALUE);
        continue;
      }
      cells.set(i, value / 1000);
      drawable += 1;
    }
    if (!drawable) return null;
    return {
      ...common,
      /* A model is drawn fainter only BESIDE measured evidence, so the two never
         read alike; a species whose best evidence is a model is drawn at full
         strength, and its key says what it is and how much weight it bears. */
      ...(context.alongsideMeasured && surface.evidence && !surface.evidence.measured ? { opacity: MODELLED_OPACITY } : {}),
      grid: { lonStep: stepDegrees[0], latStep: stepDegrees[1], west: origin[0], south: origin[1], cols: columns, rows },
      cells,
    };
  }
  if (surface.continuity !== "DISCRETE") return null;
  /* Recorded presence arrives as packed squares: every square holding records
     becomes a hard-edged plot at the grid's own extent — never smoothed, and
     nothing drawn between squares, because a record says nothing about the
     ground beside it. A square with no record is absent, not zero. */
  if (surface.geometryKind === "OBSERVATION_GRID" && surface.cells) {
    const { origin, stepDegrees, columns, values } = surface.cells;
    const squares: SurfacePlot[] = [];
    for (let i = 0; i < values.length; i += 1) {
      const records = values[i];
      if (typeof records !== "number" || !(records > 0)) continue;
      const west = origin[0] + (i % columns) * stepDegrees[0];
      const south = origin[1] + Math.floor(i / columns) * stepDegrees[1];
      const east = west + stepDegrees[0];
      const north = south + stepDegrees[1];
      squares.push({ id: `${surface.id}:${i}`, score: 1, rings: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] });
    }
    return squares.length ? { ...common, plots: squares, style: "RECORDED" } : null;
  }
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
    tier: surface.tier ?? "",
    represents: surface.represents ?? "",
    confidence: surface.confidence ?? null,
    visualTransform: surface.visualTransform ?? null,
    modelVersion: (() => {
      const model = surface.provenance?.model as { id?: string; version?: string } | undefined;
      return model?.id && model.version ? `${model.id} v${model.version}` : null;
    })(),
    levelOfDetail: surface.cells?.levelOfDetail ?? 1,
    window: surface.evidenceWindow?.statedAs ?? null,
    role: surface.role ?? "PRIMARY",
    resolution: surface.resolution
      ? { source: surface.resolution.source.statedAs, model: surface.resolution.model.statedAs, display: surface.resolution.display.statedAs }
      : null,
    staleness: surface.staleness
      ? {
        state: surface.staleness.state,
        oldest: (() => {
          const worst = [...surface.staleness.inputs].sort((a, b) => b.ageYears - a.ageYears)[0];
          return worst ? `${worst.input}, ${worst.ageYears} years (${worst.state.toLowerCase()})` : "";
        })(),
      }
      : null,
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
  /* The hunt month asked for, and the one on screen now. A reply for another
     season is discarded exactly as one for another species is. */
  months?: { wanted: number; requested: number },
): SpeciesSurfaceState | null {
  if (!wantedSpeciesId || wantedSpeciesId !== requestedSpeciesId) return null;
  if (months && months.wanted !== months.requested) return null;
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
  const alongsideMeasured = replySurfaces.some((surface) => surface.evidence?.measured === true);
  const renderable = replySurfaces.map((surface) => toRenderable(surface, { alongsideMeasured })).filter((s): s is RenderableSurface => s !== null);
  return {
    speciesId: requestedSpeciesId,
    outcome: renderable.length ? "DRAWN" : "NONE_IN_VIEW",
    surfaces: renderable,
    legend: { layers: replySurfaces.map(legendLayer), emptyMeans: payload.emptyMeans ?? "", refusals, season: payload.season ? { matched: payload.season.matched, statedAs: payload.season.statedAs } : null },
    message: renderable.length ? null : payload.emptyMeans ?? null,
    elsewhere: renderable.length ? null : groundBoxOf(payload.elsewhere),
    extent: groundBoxOf(payload.extent ?? payload.elsewhere),
  };
}

/**
 * The server's NONE_IN_VIEW sentence, for a view that misses a map the reply
 * holds. Kept equal to `EMPTY_MEANINGS.NONE_IN_VIEW` by a test, so the two
 * ways of arriving at "not on this ground" say the same thing.
 */
export const OFF_VIEW_MEANS =
  "This species' map does not reach this ground: the evidence behind it describes other places. That is not a finding that the species is absent here.";

/* Painted ground per surface, once: cell centres (or plot boxes) as
   [west, south, east, north] quadruples, in the surface's own frame. */
const paintedBoxes = new WeakMap<RenderableSurface, Float64Array>();

function paintedBoxesOf(surface: RenderableSurface): Float64Array {
  const cached = paintedBoxes.get(surface);
  if (cached) return cached;
  const boxes: number[] = [];
  const { grid, cells, plots } = surface;
  if (grid && cells) {
    const halfLon = grid.lonStep / 2;
    const halfLat = grid.latStep / 2;
    for (const [index, value] of cells) {
      /* Unsuitable ground inside the range is drawn as nothing; a measured
         zero keeps its own neutral and is drawn. */
      if (value === UNSUITABLE_VALUE) continue;
      const lon = grid.west + (index % grid.cols) * grid.lonStep;
      const lat = grid.south + Math.floor(index / grid.cols) * grid.latStep;
      boxes.push(lon - halfLon, lat - halfLat, lon + halfLon, lat + halfLat);
    }
  }
  for (const plot of plots ?? []) {
    let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
    for (const [lon, lat] of plot.rings[0] ?? []) {
      if (lon < west) west = lon;
      if (lon > east) east = lon;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
    if (west <= east) boxes.push(west, south, east, north);
  }
  const packed = Float64Array.from(boxes);
  paintedBoxes.set(surface, packed);
  return packed;
}

/**
 * Whether any ground the surfaces paint lies inside the visible view.
 *
 * The request reaches past the screen by REQUEST_MARGIN, so a reply can hold a
 * species' map while none of it is on screen — zebra dove asked over eastern
 * North America on a desktop is answered with Hawaiʻi, and the legend named a
 * drawn layer over a map with nothing painted on it. Whether the hunter can
 * see the map is decided from the view, never from the box the reply covered.
 * A view across 180° arrives with west > east; a range past 180° is stored
 * below -180; both are compared one turn either way.
 */
export function surfacePaintsWithin(surfaces: readonly RenderableSurface[], view: GroundBox): boolean {
  const parts = view.west > view.east
    ? [{ ...view, east: 180 }, { ...view, west: -180 }]
    : [view];
  for (const surface of surfaces) {
    const boxes = paintedBoxesOf(surface);
    for (let i = 0; i < boxes.length; i += 4) {
      const south = boxes[i + 1], north = boxes[i + 3];
      for (const part of parts) {
        if (north <= part.south || south >= part.north) continue;
        for (const shift of [0, 360, -360]) {
          if (boxes[i + 2] + shift > part.west && boxes[i] + shift < part.east) return true;
        }
      }
    }
  }
  return false;
}

/**
 * The part of a view to the right of a fraction of its width — the ground a
 * floating panel does not cover. Web Mercator is linear in longitude, so a
 * share of the map's pixel width is the same share of its longitude span. A
 * view across 180° (west > east) is measured round the line and written back
 * in -180..180.
 */
export function groundRightOf(view: GroundBox, fraction: number): GroundBox {
  const share = Math.min(Math.max(fraction, 0), 1);
  if (share === 0) return view;
  const span = view.west > view.east ? view.east + 360 - view.west : view.east - view.west;
  let west = view.west + span * share;
  if (west > 180) west -= 360;
  return { ...view, west };
}

/**
 * The surface state as the hunter can see it: a DRAWN reply whose map lies
 * wholly outside the visible view is shown as NONE_IN_VIEW, with the map's
 * extent, so the legend says "mapped elsewhere" and offers the way there
 * instead of naming a layer nobody can see. The surfaces themselves are kept
 * for the renderer, which paints them the moment a pan brings them in.
 */
export function surfaceInView(state: SpeciesSurfaceState, view: GroundBox | null): SpeciesSurfaceState {
  if (state.outcome !== "DRAWN" || !view || surfacePaintsWithin(state.surfaces, view)) return state;
  return {
    ...state,
    outcome: "NONE_IN_VIEW",
    message: OFF_VIEW_MEANS,
    legend: state.legend ? { ...state.legend, emptyMeans: OFF_VIEW_MEANS } : null,
    elsewhere: state.extent ?? null,
  };
}

/**
 * What the legend should say when nothing is drawn, or null when it has nothing
 * to say and a better-informed branch should answer instead.
 *
 * THE DEFECT THIS EXISTS TO STOP. A species with no surface anywhere comes back
 * 200 with an empty list, which classifies as NONE_IN_VIEW — "a surface exists,
 * but not on this ground". For the nine big-game species that is the wrong
 * story, and it also had no sentence attached: `message` null, `emptyMeans`
 * empty. The legend rendered an EMPTY PARAGRAPH under the heading "Where to
 * look for the animal", and because that branch ran first it hid the one honest
 * explanation the legend already carried — that North Ground holds zone-level
 * figures for these species, which cannot say where inside a zone the animals
 * are and are therefore not painted.
 *
 * North Ground holds 1,093 moose records, 1,264 American black bear and 962
 * white-tailed deer. §41B requires a layer that cannot paint to explain why,
 * because a blank map reads to a hunter as "there are no animals here".
 */
export function notDrawnExplanation(surface: Pick<SpeciesSurfaceState, "outcome" | "message" | "legend"> | null): string | null {
  if (!surface) return null;
  if (surface.outcome !== "NONE_IN_VIEW" && surface.outcome !== "UNAVAILABLE") return null;
  return surface.message || surface.legend?.emptyMeans || null;
}
