import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import plotsJson from "../../../../content/intelligence/ews25-plots.json" with { type: "json" };
import type { SeasonalBasis } from "./bundles.ts";
import { servableDatasets, surfaceEvidenceFor } from "./bundles.ts";
import type { EvidenceTier } from "./evidence-ladder.ts";
import type { EvidenceGrade } from "./methodology.ts";

/**
 * THE SEAM between the evidence side and the renderer.
 *
 * A renderer asks for a species and a box and receives surfaces it can draw
 * without knowing anything about waterfowl surveys, harvest returns, aerial
 * strata or habitat models. Everything it must not do is carried IN THE DATA
 * rather than assumed: how finely it may draw, whether it may smooth between
 * features, and what unshaded ground means.
 *
 * WHY EVERY KIND EXISTS AT ONCE. §41B is explicit that sources must not be
 * forced into one fake geometry. A sampled plot, an observation point, an
 * aerial stratum and a density raster are four different statements about the
 * ground, and flattening them to "polygon with a number" loses precisely the
 * part a hunter would be misled by. So the kind is declared, and each kind
 * carries its own honest defaults.
 */

/** What the evidence physically IS, before anything is drawn. */
export type SurfaceGeometryKind =
  /** Discrete surveyed squares. Ground between them was never looked at. */
  | "SAMPLE_PLOT"
  /** Located detections. A point is where an animal was seen, not where they live. */
  | "OBSERVATION_POINT"
  /** An arbitrary polygon the authority surveyed — a block, a sector, a unit it drew. */
  | "SURVEY_POLYGON"
  /** A regular tiling the publisher defined, with the publisher's own cell size. */
  | "SURVEY_GRID"
  /** A survey stratum. Usually very large, and usually coarser than a hunting zone. */
  | "AERIAL_STRATUM"
  /** Cells whose value the authority published as animals per unit area. */
  | "DENSITY_RASTER"
  /** Cells the authority modelled rather than measured. */
  | "MODELLED_RASTER"
  /** An authority's own habitat or land-cover classification. Land, not animals. */
  | "HABITAT_LAYER"
  /** North Ground's own versioned, per-species model. Always labelled as ours. */
  | "NORTH_GROUND_MODEL"
  /** One figure for a whole management area. Carried as support; never a surface. */
  | "MANAGEMENT_AREA";

/** Whether the renderer may put colour between two features. */
export type SurfaceContinuity = "DISCRETE" | "CONTINUOUS";

/**
 * What ground with no feature means. The distinction §41B turns on, and the
 * one a legend has to carry in words: "nothing here" and "nobody looked" are
 * different answers and only one of them is about animals.
 */
export type UnmappedGround = "NOT_SURVEYED" | "NO_EVIDENCE_HELD";

/**
 * How finely this surface may be drawn, DECLARED rather than inferred from how
 * it happens to render.
 *
 * §41B, owner: smooth rendering is not fine evidence. A 25 km² plot drawn with
 * a soft edge is still a 25 km² plot, and must never become a claim of 100 m
 * knowledge. `metres` is the side of the smallest area the value is true of;
 * null where the publisher states none, which is itself a limitation and is
 * said in `statedAs`.
 */
export interface EffectiveResolution {
  metres: number | null;
  /** The authority's own words for its resolution. */
  statedAs: string;
}

export interface SurfaceScale {
  /** What a score of 1 means, in the words shown to a reader. */
  statedAs: string;
  /** The measured quantity behind the score, where there is one. */
  unit: string | null;
  /** Whether scores may be compared between surfaces. Ranks may not. */
  comparable: boolean;
}

export interface SurfaceProvenance {
  authority: string;
  title: string;
  url: string;
  licence: string;
  attribution?: string;
  retrievedAt: string;
  verifiedAt: string;
  /** Present only for a North Ground surface: nothing else may carry a model id. */
  model?: { id: string; version: string; inputs: Array<{ id: string; hash: string }>; literature: string[] };
  methodology: string;
  limitations: string[];
}

export interface SurfaceFeature {
  id: string;
  /** 0 to 1 within this surface, or null where the evidence will not rank. */
  score: number | null;
  /** What the authority actually published, kept beside the rank. */
  rawValue: number | null;
  /** The calendar year the value describes. */
  observedYear: number | null;
  /** GeoJSON, in the kind's own geometry. */
  geometry: { type: "Polygon"; coordinates: number[][][] } | { type: "Point"; coordinates: number[] };
}

/**
 * A continuous surface's values, packed.
 *
 * Sent instead of one GeoJSON feature per cell: 25,736 cells of coordinates
 * that are all derivable from an origin and a step is about 3 MB of transport
 * saying nothing. It also makes the two zeros unrepresentable rather than
 * merely documented — `null` is ground nobody surveyed and `0` is ground that
 * was surveyed and held none of the species, and there is no way to spell the
 * first as the second.
 */
export interface PackedCells {
  origin: [number, number];
  stepDegrees: [number, number];
  columns: number;
  rows: number;
  /** Row-major, `columns` per row. null = unsurveyed, 0 = surveyed and none found. */
  values: Array<number | null>;
}

export interface SpeciesSurface {
  id: string;
  speciesId: string;
  geometryKind: SurfaceGeometryKind;
  continuity: SurfaceContinuity;
  unmappedGround: UnmappedGround;
  effectiveResolution: EffectiveResolution;
  /** The evidence ladder tier and the A–E grade, so a renderer can rank surfaces. */
  evidence: { tier: EvidenceTier; grade: EvidenceGrade; measured: boolean };
  /** When the authority looked, and whether that is the season being asked about. */
  season: SeasonalBasis | null;
  scale: SurfaceScale;
  provenance: SurfaceProvenance;
  /** DISCRETE surfaces carry features; CONTINUOUS ones carry packed cells. */
  features: SurfaceFeature[];
  cells?: PackedCells;
}

/** A surface that exists and was not returned, and why. Never silence. */
export interface SurfaceRefusalNotice {
  surfaceId: string;
  reason: "BOX_TOO_LARGE";
  message: string;
}

export interface SpeciesSurfaceResponse {
  speciesId: string;
  /** Strongest first: measured abundance before anything modelled (§41B). */
  surfaces: SpeciesSurface[];
  /** Surfaces that exist and were not sent, with the reason. */
  refusals: SurfaceRefusalNotice[];
  /** Said in words, because a blank map reads to a hunter as "no animals here". */
  emptyMeans: string;
}

/**
 * What each kind is allowed to do, in one table rather than in each consumer.
 *
 * A renderer reading `continuity` does not need to know which survey produced a
 * surface, and cannot accidentally smooth a plot layer by forgetting that
 * plots are plots.
 */
export const KIND_BEHAVIOUR: Record<SurfaceGeometryKind, {
  continuity: SurfaceContinuity;
  unmappedGround: UnmappedGround;
  /** Whether this kind may set the value of a cell in a continental raster. */
  maySetCellValues: boolean;
  meaning: string;
}> = {
  SAMPLE_PLOT: {
    continuity: "DISCRETE",
    unmappedGround: "NOT_SURVEYED",
    maySetCellValues: false,
    meaning: "Individual plots the authority surveyed. Each is shaded evenly; the ground between them was never looked at and is not empty.",
  },
  OBSERVATION_POINT: {
    continuity: "DISCRETE",
    unmappedGround: "NOT_SURVEYED",
    maySetCellValues: true,
    meaning: "Where animals were recorded. A point says an animal was there, not that the surrounding ground holds more or fewer.",
  },
  SURVEY_POLYGON: {
    continuity: "DISCRETE",
    unmappedGround: "NOT_SURVEYED",
    maySetCellValues: false,
    meaning: "An area the authority surveyed and reported as a whole. Nothing inside it is hotter than anything else in it.",
  },
  SURVEY_GRID: {
    continuity: "CONTINUOUS",
    unmappedGround: "NOT_SURVEYED",
    maySetCellValues: true,
    meaning: "A regular tiling the publisher defined, at the publisher's own cell size.",
  },
  AERIAL_STRATUM: {
    continuity: "DISCRETE",
    unmappedGround: "NO_EVIDENCE_HELD",
    maySetCellValues: false,
    meaning: "A survey stratum, usually far larger than a hunting zone. One figure for the whole of it.",
  },
  DENSITY_RASTER: {
    continuity: "CONTINUOUS",
    unmappedGround: "NO_EVIDENCE_HELD",
    maySetCellValues: true,
    meaning: "Cells whose value the authority published as animals per unit area.",
  },
  MODELLED_RASTER: {
    continuity: "CONTINUOUS",
    unmappedGround: "NO_EVIDENCE_HELD",
    maySetCellValues: true,
    meaning: "Cells the authority modelled rather than measured.",
  },
  HABITAT_LAYER: {
    continuity: "CONTINUOUS",
    unmappedGround: "NO_EVIDENCE_HELD",
    maySetCellValues: true,
    meaning: "Land the authority classified. Suitable land is not an animal.",
  },
  NORTH_GROUND_MODEL: {
    continuity: "CONTINUOUS",
    unmappedGround: "NO_EVIDENCE_HELD",
    maySetCellValues: true,
    meaning: "North Ground's own per-species model of where conditions suit the animal. Never a count, and never presented before measured evidence.",
  },
  MANAGEMENT_AREA: {
    continuity: "DISCRETE",
    unmappedGround: "NO_EVIDENCE_HELD",
    maySetCellValues: false,
    meaning: "One figure for a whole management area, which says nothing about where inside it the animals are.",
  },
};

/**
 * §41B's coarse-evidence prohibition is enforced by `surfaceSitesFrom` in
 * `surface-raster.ts`, which REFUSES management zones, polygons and ranges by
 * name at the only place sites can be built.
 *
 * It replaced a predicate of mine that a caller had to remember to call. Hunt
 * overhaul's argument was decisive and is worth keeping written down: a guard
 * someone must remember is not a guard. What survives here is the declarative
 * half — `KIND_BEHAVIOUR[kind].maySetCellValues` — which says of a BUILT
 * surface whether its kind could ever have fed cells, for a reader deciding
 * what they are looking at rather than for a builder deciding what to make.
 */
export { surfaceSitesFrom } from "./surface-raster.ts";

/** Measured beats modelled, then finer beats coarser, then more recent. */
function strength(surface: SpeciesSurface): number {
  return (surface.evidence.measured ? 1000 : 0) - (surface.effectiveResolution.metres ?? 1_000_000) / 1000;
}

const PLOT_RINGS = new Map(
  (plotsJson as unknown as { plots: Array<{ plotId: string; ring: number[][] }> }).plots
    .map((plot) => [`sample_plot:${plot.plotId.toLowerCase()}`, plot.ring]),
);

/** Whether a ring intersects a box, by its own extent. Cheap and sufficient for 332 plots. */
function withinBox(ring: number[][], box: [number, number, number, number]): boolean {
  const [west, south, east, north] = box;
  const lons = ring.map(([lon]) => lon);
  const lats = ring.map(([, lat]) => lat);
  return Math.min(...lons) <= east && Math.max(...lons) >= west && Math.min(...lats) <= north && Math.max(...lats) >= south;
}

/**
 * The committed raster artifacts, read from disk rather than imported.
 *
 * WHY NOT AN IMPORT. There are 25 of them and they are 18 MB; a static import
 * puts all of it in the server bundle whether or not anyone asks for a species.
 * They are read once, lazily, and kept.
 *
 * WHY THIS EXISTS AT ALL, written down because it was missing for a day: the
 * artifacts were committed and NOTHING OPENED THEM. `speciesSurfaces` filtered
 * to `SAMPLE_PLOT` and every one of the 25 species answered 404 with a
 * well-written sentence saying no evidence was held — while 25,736 cells of it
 * sat in the tree. Built and served are different claims and only one of them
 * reaches a hunter. `surface.reachability.test.ts` now asserts the second.
 */
const SURFACE_DIR = join(process.cwd(), "content", "intelligence", "surfaces");

interface RasterArtifact {
  id: string;
  speciesId: string;
  metric: string;
  unit: string;
  ceiling: number;
  sitesSurveyed: number;
  sitesDetected: number;
  source: { authority: string; title: string; url: string; licence: string; attribution?: string; retrievedAt: string; verifiedAt: string };
  limitations: string[];
  observationPeriod: { from: string; through: string };
  methodology: { id: string; version: string; bandwidthKm: number; truncationKm: number; minimumSites: number; maximumSiteDistanceKm: number; transform: string; ceilingQuantile: number; yearCombination: string; kernel: string };
  grid: { latStep: number; lonStep: number; south: number; west: number; rows: number; cols: number };
  cells: { row: number[]; col: number[]; intensity: number[]; sites: number[] };
}

let rasters: Map<string, RasterArtifact> | null = null;

function rasterFor(speciesId: string): RasterArtifact | null {
  if (!rasters) {
    rasters = new Map();
    let files: string[] = [];
    try {
      files = readdirSync(SURFACE_DIR);
    } catch {
      /* No artifacts on disk is a deployment without them, not an error to
         throw at a request: the species simply has no surface, and the caller
         is told that in words. */
      files = [];
    }
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const artifact = JSON.parse(readFileSync(join(SURFACE_DIR, file), "utf8")) as RasterArtifact;
      rasters.set(artifact.speciesId, artifact);
    }
  }
  return rasters.get(speciesId) ?? null;
}

/**
 * The most cells one request may ask for. Bounds are part of the question
 * (§41B), and a ceiling is part of the bounds.
 *
 * 120,000 covers the whole continental grid (258 × 396 = 102,168), because a
 * continental view IS the layer the owner asked for and refusing it would be
 * refusing the product. A viewport request is a few hundred.
 *
 * Which means today's rasters can never reach it — so the ceiling is a
 * parameter, and the tests drive the refusal with a small one. A guard that
 * cannot fire is not a guard, and a guard nobody can make fire has not been
 * tested; the alternative was to leave a branch in here that no case reaches
 * and call it protection.
 */
export const MAX_SURFACE_CELLS = 120_000;

/**
 * A raster as the contract's packed cells, clipped to the box.
 *
 * `null` is a cell nobody surveyed and `0` is a cell surveyed with none of the
 * species found — 11,733 of ruffed grouse's 22,873 supported cells are the
 * second, and half of what this surface knows is that negative.
 */
function packed(artifact: RasterArtifact, box: [number, number, number, number] | undefined, maxCells: number): PackedCells | "TOO_LARGE" | null {
  const { grid } = artifact;
  const rowOf = (lat: number) => Math.floor((lat - grid.south) / grid.latStep);
  const colOf = (lon: number) => Math.floor((lon - grid.west) / grid.lonStep);
  const r0 = box ? Math.max(0, rowOf(box[1])) : 0;
  const r1 = box ? Math.min(grid.rows - 1, rowOf(box[3]) + 1) : grid.rows - 1;
  const c0 = box ? Math.max(0, colOf(box[0])) : 0;
  const c1 = box ? Math.min(grid.cols - 1, colOf(box[2]) + 1) : grid.cols - 1;
  if (r1 < r0 || c1 < c0) return null;
  const rows = r1 - r0 + 1;
  const columns = c1 - c0 + 1;
  if (rows * columns > maxCells) return "TOO_LARGE";
  const values: Array<number | null> = new Array(rows * columns).fill(null);
  const { row, col, intensity } = artifact.cells;
  let present = 0;
  for (let i = 0; i < row.length; i += 1) {
    const r = row[i];
    const c = col[i];
    if (r < r0 || r > r1 || c < c0 || c > c1) continue;
    values[(r - r0) * columns + (c - c0)] = intensity[i];
    present += 1;
  }
  if (!present) return null;
  return {
    origin: [grid.west + c0 * grid.lonStep, grid.south + r0 * grid.latStep],
    stepDegrees: [grid.lonStep, grid.latStep],
    columns,
    rows,
    values,
  };
}

function continuousSurface(artifact: RasterArtifact, box: [number, number, number, number] | undefined, maxCells: number): SpeciesSurface | "TOO_LARGE" | null {
  const cells = packed(artifact, box, maxCells);
  if (cells === "TOO_LARGE") return "TOO_LARGE";
  if (!cells) return null;
  const behaviour = KIND_BEHAVIOUR.MODELLED_RASTER;
  return {
    id: artifact.id,
    speciesId: artifact.speciesId,
    /* The authority measured detections on routes; the FIELD between them is
       North Ground's interpolation of those measurements, which is why the
       methodology travels with it and why `model` is set. */
    geometryKind: "MODELLED_RASTER",
    continuity: behaviour.continuity,
    unmappedGround: behaviour.unmappedGround,
    /* THE BANDWIDTH, not the grid step. A 0.2° grid drawn from a 40 km kernel
       is still 40 km knowledge however densely it was sampled. */
    effectiveResolution: {
      metres: artifact.methodology.bandwidthKm * 1000,
      statedAs: `${artifact.methodology.bandwidthKm} km Gaussian bandwidth over ${artifact.sitesSurveyed} survey routes; the grid is sampled more finely than that and does not make it finer`,
    },
    evidence: { tier: "T1_OFFICIAL_MEASURED", grade: "B", measured: true },
    season: {
      observedSeason: "June, during the breeding season",
      matchesHuntingSeason: false,
      warning: "Counted in June, on the breeding grounds. Where these birds are in the autumn is a different question, and this survey does not answer it.",
    },
    scale: {
      statedAs: `Relative abundance against the ${Math.round(artifact.methodology.ceilingQuantile * 100)}th percentile of this species' own surveyed field. Not a count of animals.`,
      unit: artifact.unit,
      comparable: false,
    },
    provenance: {
      authority: artifact.source.authority,
      title: artifact.source.title,
      url: artifact.source.url,
      licence: artifact.source.licence,
      ...(artifact.source.attribution ? { attribution: artifact.source.attribution } : {}),
      retrievedAt: artifact.source.retrievedAt,
      verifiedAt: artifact.source.verifiedAt,
      model: {
        id: artifact.methodology.id,
        version: artifact.methodology.version,
        inputs: [],
        literature: [],
      },
      methodology: `${artifact.methodology.kernel} kernel, ${artifact.methodology.bandwidthKm} km bandwidth truncated at ${artifact.methodology.truncationKm} km; a cell is supported by ${artifact.methodology.minimumSites} routes within the truncation and one within ${artifact.methodology.maximumSiteDistanceKm} km. ${artifact.methodology.yearCombination}`,
      limitations: artifact.limitations,
    },
    features: [],
    cells,
  };
}

/**
 * Every surface North Ground can draw for a species, strongest first.
 *
 * Only plot evidence produces a surface today; harvest evidence is deliberately
 * absent rather than flattened into one, because a management-area figure is
 * not a surface and §41B says so. When Alberta's densities land they will
 * appear as MANAGEMENT_AREA support, not as cells.
 */
export function speciesSurfaces(speciesId: string, box?: [number, number, number, number], maxCells: number = MAX_SURFACE_CELLS): SpeciesSurfaceResponse {
  const surfaces: SpeciesSurface[] = [];
  const refusals: SurfaceRefusalNotice[] = [];
  const artifact = rasterFor(speciesId);
  if (artifact) {
    const surface = continuousSurface(artifact, box, maxCells);
    /* A refusal is returned rather than dropped. An oversized box that came
       back as an empty list would read exactly like "no evidence is held",
       which is the failure this whole file exists to prevent — and which it
       committed for a day by filtering the rasters out entirely. */
    if (surface === "TOO_LARGE") {
      refusals.push({
        surfaceId: artifact.id,
        reason: "BOX_TOO_LARGE",
        message: `This species has a continuous surface, and the box asked for more than ${maxCells} cells of it. Ask for a smaller area; this is not an absence of evidence.`,
      });
    } else if (surface) {
      surfaces.push(surface);
    }
  }
  for (const dataset of servableDatasets()) {
    if (dataset.speciesId !== speciesId || dataset.renderKind !== "SAMPLE_PLOT") continue;
    const evidence = surfaceEvidenceFor(speciesId, dataset.jurisdictionId);
    if (!evidence) continue;
    const behaviour = KIND_BEHAVIOUR.SAMPLE_PLOT;
    const features: SurfaceFeature[] = [];
    for (const record of evidence.records) {
      const ring = PLOT_RINGS.get(record.geographyId);
      if (!ring) continue;
      if (box && !withinBox(ring, box)) continue;
      features.push({
        id: record.geographyId,
        score: record.normalizedValue ?? null,
        rawValue: typeof record.rawValue === "number" ? record.rawValue : null,
        observedYear: Number(record.observationPeriod.from.slice(0, 4)) || null,
        geometry: { type: "Polygon", coordinates: [ring] },
      });
    }
    if (!features.length) continue;
    surfaces.push({
      id: `surface:${dataset.jurisdictionId.replace("jurisdiction:", "")}-${speciesId.replace("species:", "")}-ews25`,
      speciesId,
      geometryKind: "SAMPLE_PLOT",
      continuity: behaviour.continuity,
      unmappedGround: behaviour.unmappedGround,
      effectiveResolution: { metres: 5000, statedAs: evidence.records[0]?.spatialPrecision ?? "not stated" },
      evidence: { tier: "T1_OFFICIAL_MEASURED", grade: dataset.grade, measured: true },
      season: evidence.bundle.seasonalBasis ?? null,
      scale: {
        statedAs: "The plot's rank against the other plots of this survey in this jurisdiction. Not a count of animals.",
        unit: evidence.records[0]?.unit ?? null,
        comparable: false,
      },
      provenance: {
        authority: evidence.bundle.source.authority,
        title: evidence.bundle.source.title,
        url: evidence.bundle.source.url,
        licence: evidence.bundle.source.licence,
        ...(evidence.bundle.source.attribution ? { attribution: evidence.bundle.source.attribution } : {}),
        retrievedAt: evidence.bundle.source.retrievedAt,
        verifiedAt: evidence.bundle.source.verifiedAt,
        methodology: evidence.records[0]?.methodology ?? "not stated",
        limitations: evidence.bundle.limitations,
      },
      features,
    });
  }
  surfaces.sort((a, b) => strength(b) - strength(a));
  return {
    speciesId,
    surfaces,
    refusals,
    emptyMeans: surfaces.length && surfaces.every((surface) => surface.unmappedGround === "NOT_SURVEYED")
      ? "Ground with no shade was not surveyed. It is not a finding that the species is absent."
      : "No certified evidence is held for this species here. That is a gap in what North Ground holds, not a finding about the animals.",
  };
}
