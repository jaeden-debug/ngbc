import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import plotsJson from "../../../../content/intelligence/ews25-plots.json" with { type: "json" };
import surfaceRegistryJson from "../../../../content/intelligence/surface-registry.json" with { type: "json" };
import modelRegistryJson from "../../../../content/intelligence/model-registry.json" with { type: "json" };
import recordsRegistryJson from "../../../../content/intelligence/records-registry.json" with { type: "json" };
import { permitsHuntingOpportunity } from "../../content/species-eligibility.ts";
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
  /**
   * Squares where openly licensed occurrence records place the species. A
   * record says an animal was there; an empty square says nobody shared one.
   */
  | "OBSERVATION_GRID"
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

/**
 * How much of a surface is a NEGATIVE finding, so a thin bird reads as thin.
 *
 * Spruce grouse has 20,324 of its 22,873 supported cells surveyed-and-none-
 * found. Drawn without this, it is a nearly-blank map indistinguishable from no
 * data — and the truth is the opposite: the survey looked almost everywhere and
 * almost nowhere held one. `unmappedGround` says what ground with NO cell
 * means; this says what the cells themselves are made of.
 */
export interface SurfaceSampling {
  /** Cells the evidence supports at all. */
  supportedCells: number;
  /** Of those, the ones surveyed with none of the species found. */
  surveyedAndNoneFound: number;
  /** Routes the survey ran, and the ones that detected this species. */
  sitesSurveyed: number;
  sitesDetected: number;
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
  /** Absent for a surface that is not a sample of anything, such as a plot set. */
  sampling?: SurfaceSampling;
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

/**
 * Every sentence North Ground will say about ground it has not shaded.
 *
 * A CLOSED SET, not a free string, and the reason is what shipped: `emptyMeans`
 * was typed `string`, one branch of the endpoint did not set it, and the legend
 * drew AN EMPTY PARAGRAPH under "Where to look for the animal" — for moose, the
 * most-hunted species in the product. §41B's own words are that a blank map
 * reads as "there are no animals here"; a blank explanation beneath it is the
 * same statement made twice.
 *
 * Because these are literal types, `""` is not assignable to `EmptyMeaning`.
 * The compiler now refuses what the validator would only have caught at
 * runtime, and only if someone had thought to write it.
 */
export const EMPTY_MEANINGS = {
  /** A sampled surface: blank ground was never looked at. */
  NOT_SURVEYED:
    "Ground with no shade was not surveyed. It is not a finding that the species is absent.",
  /**
   * A surface IS drawn here, and parts of the view carry no value.
   *
   * Distinct from NOT_SURVEYED: on an interpolated field the blank ground is
   * ground the survey did not reach closely enough to support a value, which is
   * a statement about the survey's reach rather than about a plot nobody flew.
   * Both are "we did not look"; only one of them is about plots.
   */
  UNSUPPORTED_GROUND:
    "Shading stops where the survey behind it stops supporting a value. Unshaded ground inside this view was not covered closely enough to say anything, and that is not a finding that the species is absent.",
  /** A surface exists; this viewport is outside it. */
  NONE_IN_VIEW:
    "This species' surface does not reach this ground: the surveys behind it did not cover it. That is not a finding that the species is absent.",
  /** Evidence is held and none of it may be drawn as a surface. */
  AREA_EVIDENCE_ONLY:
    "North Ground holds zone-level evidence for this species, but none of it may be drawn as a surface: a figure for a whole management area is not a surface, and says nothing about where inside it the animals are. Unshaded ground is a gap in what North Ground holds, not a finding about the animals.",
  /** Nothing at all is held. */
  NOTHING_HELD:
    "No certified evidence is held for this species. That is a gap in what North Ground holds, not a finding about the animals.",
  /** Certified and not loadable here — an operational failure, said as one. */
  UNAVAILABLE:
    "This species' certified surface could not be loaded. Nothing is drawn, and nothing is implied about the animals.",
} as const;

export type EmptyMeaning = (typeof EMPTY_MEANINGS)[keyof typeof EMPTY_MEANINGS];

export interface SpeciesSurfaceResponse {
  speciesId: string;
  /** Strongest first: measured abundance before anything modelled (§41B). */
  surfaces: SpeciesSurface[];
  /** Surfaces that exist and were not sent, with the reason. */
  refusals: SurfaceRefusalNotice[];
  /** Said in words, because a blank map reads to a hunter as "no animals here". */
  emptyMeans: EmptyMeaning;
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
  OBSERVATION_GRID: {
    continuity: "DISCRETE",
    unmappedGround: "NOT_SURVEYED",
    maySetCellValues: false,
    meaning: "Squares where shared records place the species. A record says an animal was seen there, not how many live there; a square with no record is ground nobody shared a record from, not empty ground.",
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
/**
 * The certified surfaces, and the only ones that serve.
 *
 * NOT A DIRECTORY LISTING. The endpoint must not trust whatever happens to sit
 * on disk: a surface is servable because the builder certified it and recorded
 * it here with the hash of the bytes it certified. A file added by hand is not
 * a surface, and a certified file edited afterwards stops matching its hash and
 * stops serving rather than serving something nobody certified.
 *
 * And it is a REGISTRY rather than a list of species: adding a species means
 * running the builder, never editing this file or the endpoint. The repository
 * has twice shipped evidence that no code path could reach, and both times the
 * reachable set was written somewhere a human had to remember to update.
 */
export interface SurfaceRegistryEntry {
  speciesId: string;
  surfaceKind: SurfaceGeometryKind;
  artifactId: string;
  artifactPath: string;
  artifactHash: string;
  sourceDatasetId: string;
  metric: string;
  unit: string;
  effectiveResolutionMetres: number;
  effectiveResolutionStatedAs: string;
  season: string;
  matchesHuntingSeason: boolean;
  tier: EvidenceTier;
  grade: EvidenceGrade;
  methodologyId: string;
  methodologyVersion: string;
  interpolationPermitted: boolean;
  coverage: string;
  unmappedGround: UnmappedGround;
  sitesSurveyed: number;
  sitesDetected: number;
  supportedCells: number;
  surveyedAndNoneFound: number;
  /** Whether the species stays where it breeds; decides what a June survey says about autumn. */
  seasonalMovement?: SeasonalMovement;
  seasonalMovementSource?: string;
  /** How the value became a colour (`surface-raster.ts`). */
  colourScale?: string;
  /**
   * What kind of evidence stands behind the surface. A structured survey, a
   * set of shared occurrence records and a North Ground model are three
   * different claims, and §41B forbids any one silently becoming another.
   * Absent on the survey registry's entries, which are all STRUCTURED_SURVEY.
   */
  evidenceClass?: "STRUCTURED_SURVEY" | "OCCURRENCE_RECORDS" | "NORTH_GROUND_MODEL";
}

/**
 * Whether a species stays where the survey found it.
 *
 * DECLARED per species by the builder from published species accounts; absent
 * is read as MIGRATORY, the reading that claims least.
 */
export type SeasonalMovement = "RESIDENT" | "SHORT_DISTANCE" | "MIGRATORY";

/**
 * What a June breeding survey can say about the hunting season, by how the
 * species moves. The migratory sentence is the one every surface carried
 * before 2.0.0; for a bird that does not migrate it understated the evidence.
 */
export const SEASON_WARNING: Record<SeasonalMovement, string> = {
  RESIDENT:
    "Counted in June. This bird does not migrate, so where the survey finds it breeding is where it lives in the autumn too; how many there are changes with the year's brood, which this survey does not measure.",
  SHORT_DISTANCE:
    "Counted in June. This bird moves seasonally over short distances, so its autumn range broadly follows where it breeds, but where it concentrates can shift.",
  MIGRATORY:
    "Counted in June, on the breeding grounds. Where these birds are in the autumn is a different question, and this survey does not answer it.",
};

export interface SurfaceRegistry {
  schemaVersion: number;
  surfaces: SurfaceRegistryEntry[];
  declined: Array<{ speciesId: string; reason: string; detail: string }>;
  unmatched: Array<{ speciesId: string; reason: string; detail: string }>;
}

/* Three producers, three files, one registry. Each builder writes only its own
   file, so a survey rebuild cannot erase a model or a records grid. */
const surveyRegistry = surfaceRegistryJson as unknown as SurfaceRegistry;
const committed: SurfaceRegistry = {
  ...surveyRegistry,
  surfaces: [
    ...surveyRegistry.surfaces,
    ...(modelRegistryJson as unknown as { surfaces: SurfaceRegistryEntry[] }).surfaces,
    ...(recordsRegistryJson as unknown as { surfaces: SurfaceRegistryEntry[] }).surfaces,
  ],
};

/* The registry refuses too, not only the builder. A registry edited by hand, or
   written by a builder that stopped honouring eligibility, still cannot serve a
   surface for a species whose eligibility does not grant one. */
export function servableSurfaceEntries<T extends { speciesId: string }>(
  entries: readonly T[],
  permits: (speciesId: string) => boolean = permitsHuntingOpportunity,
): T[] {
  return entries.filter((entry) => permits(entry.speciesId));
}

const registry: SurfaceRegistry = { ...committed, surfaces: servableSurfaceEntries(committed.surfaces) };

export function surfaceRegistry(): SurfaceRegistry {
  return registry;
}

/**
 * Whether a species has a certified surface ANYWHERE, from the registry and
 * the servable plot datasets — never from parsing the 18 MB of artifacts, so a
 * page render can ask it for every species.
 *
 * It decides whether the species layer can be REACHED. Twice the repository has
 * shipped evidence no code path could get to; a species whose only evidence is
 * a surface was one of them, because the Find game list asked about rules and
 * zone evidence and never about this.
 */
export function hasCertifiedSurface(speciesId: string): boolean {
  if (!permitsHuntingOpportunity(speciesId)) return false;
  if (registry.surfaces.some((entry) => entry.speciesId === speciesId)) return true;
  return servableDatasets().some((dataset) => dataset.speciesId === speciesId && dataset.renderKind === "SAMPLE_PLOT");
}

interface RasterArtifact {
  id: string;
  speciesId: string;
  metric: string;
  unit: string;
  /** 1.x only: the value painted as full intensity. */
  ceiling?: number;
  /** 2.0.0: the detected field's values at the ranks the legend names, in `unit`. */
  detectedValueQuantiles?: { p10: number; p50: number; p90: number; max: number } | null;
  seasonalMovement?: SeasonalMovement;
  sitesSurveyed: number;
  sitesDetected: number;
  source: { authority: string; title: string; url: string; licence: string; attribution?: string; retrievedAt: string; verifiedAt: string };
  limitations: string[];
  observationPeriod: { from: string; through: string };
  methodology: { id: string; version: string; bandwidthKm?: number; truncationKm?: number; minimumSites?: number; maximumSiteDistanceKm?: number; transform?: string; ceilingQuantile?: number; rankDomain?: string; yearCombination?: string; kernel?: string };
  grid: { latStep: number; lonStep: number; south: number; west: number; rows: number; cols: number };
  /* `intensity` is per mille on a ramp surface, and a record count on an
     OBSERVATION_GRID — the kind in the registry says which. */
  cells: { row: number[]; col: number[]; intensity: number[]; sites?: number[] };
  /* A model or a records grid states these itself; a survey field's are
     derived from its methodology below. */
  scaleStatedAs?: string;
  methodologyStatedAs?: string;
  model?: { id: string; version: string; inputs: Array<{ id: string; hash: string }>; literature: string[] };
  season?: SeasonalBasis;
}

const ROOT = process.cwd();
type Held = { artifact: RasterArtifact; entry: SurfaceRegistryEntry };
let rasters: Map<string, Held[]> | null = null;

/** Integrity failures, kept so a caller can be told rather than shown silence. */
const rejected = new Map<string, string>();

function load(): Map<string, Held[]> {
  if (rasters) return rasters;
  rasters = new Map();
  for (const entry of registry.surfaces) {
    let raw: string;
    try {
      raw = readFileSync(join(ROOT, entry.artifactPath), "utf8");
    } catch {
      /* Certified but not deployed. A build without the artifacts is a
         deployment fact, not a finding about the species, and it is recorded
         rather than silently treated as absence. */
      rejected.set(entry.speciesId, `${entry.artifactPath} is certified but not present in this deployment.`);
      continue;
    }
    const hash = `sha256:${createHash("sha256").update(raw).digest("hex")}`;
    if (hash !== entry.artifactHash) {
      rejected.set(entry.speciesId, `${entry.artifactPath} does not match the bytes that were certified.`);
      continue;
    }
    rasters.set(entry.speciesId, [...(rasters.get(entry.speciesId) ?? []), { artifact: JSON.parse(raw) as RasterArtifact, entry }]);
  }
  return rasters;
}

function rastersFor(speciesId: string): Held[] {
  return load().get(speciesId) ?? [];
}

/** Why a certified surface is not being served here, if it is not. */
export function surfaceUnavailableReason(speciesId: string): string | null {
  load();
  return rejected.get(speciesId) ?? null;
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

/**
 * What a colour on this surface means, from the artifact's own methodology, so
 * the words cannot describe a scale the cells were not painted on.
 */
function scaleStatement(artifact: RasterArtifact): string {
  if (artifact.scaleStatedAs) return artifact.scaleStatedAs;
  if (artifact.methodology.transform === "RANK_AMONG_DETECTED") {
    const q = artifact.detectedValueQuantiles;
    const values = q
      ? ` On the survey's own scale the middle of that ground averages ${q.p50} and the top tenth more than ${q.p90} ${artifact.unit}.`
      : "";
    return `Colour is rank among the ground where the survey found this species: red is the top tenth, blue the bottom. Faint grey is ground surveyed where it was not found.${values} Not a count of animals.`;
  }
  return `Relative abundance against the ${Math.round((artifact.methodology.ceilingQuantile ?? 1) * 100)}th percentile of this species' own surveyed field. Not a count of animals.`;
}

function continuousSurface(artifact: RasterArtifact, entry: SurfaceRegistryEntry, box: [number, number, number, number] | undefined, maxCells: number): SpeciesSurface | "TOO_LARGE" | null {
  const cells = packed(artifact, box, maxCells);
  if (cells === "TOO_LARGE") return "TOO_LARGE";
  if (!cells) return null;
  const behaviour = KIND_BEHAVIOUR[entry.surfaceKind];
  const measured = entry.evidenceClass !== "NORTH_GROUND_MODEL";
  const method = artifact.methodology;
  return {
    id: artifact.id,
    speciesId: artifact.speciesId,
    /* The authority measured detections on routes; the FIELD between them is
       North Ground's interpolation of those measurements, which is why the
       methodology travels with it and why `model` is set. */
    geometryKind: entry.surfaceKind,
    continuity: behaviour.continuity,
    unmappedGround: entry.unmappedGround,
    /* THE BANDWIDTH, not the grid step. A 0.2° grid drawn from a 40 km kernel
       is still 40 km knowledge however densely it was sampled. */
    effectiveResolution: { metres: entry.effectiveResolutionMetres, statedAs: entry.effectiveResolutionStatedAs },
    evidence: { tier: entry.tier, grade: entry.grade, measured },
    season: artifact.season ?? {
      observedSeason: entry.season,
      matchesHuntingSeason: entry.matchesHuntingSeason,
      warning: SEASON_WARNING[artifact.seasonalMovement ?? entry.seasonalMovement ?? "MIGRATORY"],
    },
    scale: {
      statedAs: scaleStatement(artifact),
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
      model: artifact.model ?? {
        id: method.id,
        version: method.version,
        inputs: [],
        literature: [],
      },
      methodology: artifact.methodologyStatedAs
        ?? `${method.kernel} kernel, ${method.bandwidthKm} km bandwidth truncated at ${method.truncationKm} km; a cell is supported by ${method.minimumSites} routes within the truncation and one within ${method.maximumSiteDistanceKm} km. ${method.yearCombination}`,
      limitations: artifact.limitations,
    },
    sampling: {
      supportedCells: entry.supportedCells,
      surveyedAndNoneFound: entry.surveyedAndNoneFound,
      sitesSurveyed: entry.sitesSurveyed,
      sitesDetected: entry.sitesDetected,
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
  /* The API refuses as well: a species whose eligibility grants no hunting
     opportunity is answered with nothing, and nothing says a surface exists. */
  if (!permitsHuntingOpportunity(speciesId)) return { speciesId, surfaces, refusals, emptyMeans: EMPTY_MEANINGS.NOTHING_HELD };
  for (const held of rastersFor(speciesId)) {
    const surface = continuousSurface(held.artifact, held.entry, box, maxCells);
    /* A refusal is returned rather than dropped. An oversized box that came
       back as an empty list would read exactly like "no evidence is held",
       which is the failure this whole file exists to prevent — and which it
       committed for a day by filtering the rasters out entirely. */
    if (surface === "TOO_LARGE") {
      refusals.push({
        surfaceId: held.artifact.id,
        reason: "BOX_TOO_LARGE",
        message: `This species has a surface, and the box asked for more than ${maxCells} cells of it. Ask for a smaller area; this is not an absence of evidence.`,
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
    /*
     * The sentence describes WHAT WAS RETURNED, never the species. Deriving it
     * from "all surfaces are plots, else nothing is held" told a ruffed-grouse
     * caller holding a drawn field that no evidence was held — false, while
     * looking careful.
     */
    emptyMeans: !surfaces.length
      ? EMPTY_MEANINGS.NOTHING_HELD
      : surfaces.every((surface) => surface.unmappedGround === "NOT_SURVEYED")
        ? EMPTY_MEANINGS.NOT_SURVEYED
        : EMPTY_MEANINGS.UNSUPPORTED_GROUND,
  };
}
