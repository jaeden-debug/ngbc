import rangeHabitatRegistryJson from "../../../../content/intelligence/range-habitat-registry.json" with { type: "json" };
import strategyJson from "../../../../content/intelligence/spatial-strategy.json" with { type: "json" };
import verificationJson from "../../../../content/intelligence/surface-verification.json" with { type: "json" };
import { permitsHuntingOpportunity } from "../../content/species-eligibility.ts";
import { servableDatasets } from "./bundles.ts";
import { catalogueSpecies } from "./species-catalogue.ts";
import { confidenceOf, speciesSurfaces, surfaceRegistry, surfaceTierOf, SURFACE_TIERS, TIER_MEANING, type SurfaceConfidence, type SurfaceTier } from "./surface.ts";

/**
 * Where North Ground can say a species is, for every species it publishes —
 * and how far each answer has got toward a hunter's screen.
 *
 * THE DIRECTION (CLAUDE.md §41B, "Every Hunt-eligible species has a map",
 * 2026-09-30): every Hunt-eligible species resolves to the strongest surface
 * the evidence defensibly supports — measured density, modelled abundance,
 * systematic survey, habitat model, range + habitat, or known distribution.
 * NO_SURFACE is an audited exception with a genuine reason, never "there is no
 * density survey".
 *
 * TWO HALVES, KEPT APART.
 *
 *   HELD is DERIVED here from the certified registries and from what the
 *   endpoint actually serves. Nothing typed can make a species look covered.
 *
 *   PLANNED is DECLARED in `content/intelligence/spatial-strategy.json`: the
 *   species' evidence family and the promotions being worked toward. A plan
 *   never counts as coverage.
 *
 * A SPECIES CAN HOLD SEVERAL SURFACES. Ruffed grouse holds a survey field and,
 * beyond its reach, a habitat model. Each is a layer with its own tier and its
 * own stage, because a model reaching a hunter's screen says nothing about
 * whether the survey did.
 */

/** The strongest tier a species is served at, or none. */
export type SpatialTier = SurfaceTier | "NO_SURFACE";

/** How far a species' map layer has got, in the owner's ladder. */
export type CoverageStage =
  | "NO_STRATEGY"
  | "STRATEGY_DEFINED"
  | "MODEL_OR_DATA_AVAILABLE"
  | "GENERATED"
  | "CERTIFIED"
  | "SERVED"
  | "RENDERED"
  | "PRODUCTION_VERIFIED";

export const COVERAGE_STAGES: readonly CoverageStage[] = [
  "NO_STRATEGY", "STRATEGY_DEFINED", "MODEL_OR_DATA_AVAILABLE", "GENERATED", "CERTIFIED", "SERVED", "RENDERED", "PRODUCTION_VERIFIED",
];

/**
 * The only reasons an eligible species may stand without a surface (§41B).
 * Anything else — an unread source, a tooling gap, a foundation not yet
 * built — is work outstanding, and the coverage gate fails on it.
 */
export const GENUINE_BLOCKERS = new Set(["NOT_HUNT_ELIGIBLE", "NO_DEFENSIBLE_RANGE", "LICENCE_FORBIDS"]);

export interface PlannedEvidence {
  strategy: string;
  status: "IN_RESEARCH" | "PLANNED" | "BLOCKED";
  plan: string;
}

export interface SurfaceLayerStatus {
  artifactId: string;
  artifactHash: string;
  surfaceKind: string;
  tier: SurfaceTier;
  represents: string;
  confidence: SurfaceConfidence;
  methodologyVersion: string;
  /** Returned by the species-surface endpoint for this species. */
  served: boolean;
  stage: CoverageStage;
  /** The ground the served surface covers, as a box. */
  geography: { west: number; south: number; east: number; north: number } | null;
}

export interface SpeciesSpatialStrategy {
  speciesId: string;
  eligibility: string | null;
  family: string | null;
  /** The strongest tier held and served. */
  tier: SpatialTier;
  /** How far the species' strongest layer has got. Zone evidence is not a surface. */
  stage: CoverageStage;
  layers: SurfaceLayerStatus[];
  /** The survey field, when one is certified (its scale and seasonal reading). */
  raster: { artifactId: string; methodologyVersion: string; artifactHash: string; colourScale: string | null; seasonalMovement: string | null } | null;
  /** Jurisdictions with surveyed plots drawn at their own extent. */
  plotJurisdictions: string[];
  /** Jurisdictions with zone evidence shown in the zone card, never painted. */
  zoneEvidenceJurisdictions: string[];
  /** Why there is no surface, where there is none; `genuine` decides whether the gate accepts it. */
  blocker: { reason: string; detail: string; genuine: boolean } | null;
  next: PlannedEvidence[];
  /** One plain paragraph for a hunter where no surface is drawn; null where the surface speaks for itself. */
  statement: string | null;
}

interface DeclaredStrategy {
  family: string;
  next?: PlannedEvidence[];
}

interface VerificationRecord {
  /** Artifact hash → where and when it was seen painted. A rebuilt artifact is unverified. */
  rendered?: Record<string, { speciesId: string; at: string; base: string }>;
  productionVerified?: Record<string, { speciesId: string; at: string; base: string; commit: string }>;
}

const DECLARED = (strategyJson as { species: Record<string, DeclaredStrategy> }).species;
const VERIFIED = verificationJson as VerificationRecord;
const RANGE_DECLINED = (rangeHabitatRegistryJson as { declined: Array<{ speciesId: string; reason: string; detail: string }> }).declined;

const JURISDICTION_NAMES: Record<string, string> = {
  "jurisdiction:ca-on": "Ontario",
  "jurisdiction:ca-qc": "Québec",
  "jurisdiction:ca-bc": "British Columbia",
  "jurisdiction:ca-ab": "Alberta",
  "jurisdiction:ca-mb": "Manitoba",
  "jurisdiction:ca-nb": "New Brunswick",
  "jurisdiction:ca-ns": "Nova Scotia",
  "jurisdiction:ca-nl": "Newfoundland and Labrador",
};

function listOf(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** Every species North Ground publishes, as the catalogue reads it. */
export function spatialStrategies(): SpeciesSpatialStrategy[] {
  return catalogueSpecies().map(({ speciesId }) => spatialStrategyFor(speciesId));
}

const stageOf = (hash: string): CoverageStage => VERIFIED.productionVerified?.[hash]
  ? "PRODUCTION_VERIFIED"
  : VERIFIED.rendered?.[hash] ? "RENDERED" : "SERVED";

export function spatialStrategyFor(speciesId: string): SpeciesSpatialStrategy {
  const registry = surfaceRegistry();
  const entries = registry.surfaces.filter((surface) => surface.speciesId === speciesId);
  const surveyEntry = entries.find((surface) => (surface.evidenceClass ?? "STRUCTURED_SURVEY") === "STRUCTURED_SURVEY") ?? null;
  const datasets = servableDatasets().filter((dataset) => dataset.speciesId === speciesId);
  const plotJurisdictions = datasets.filter((d) => d.renderKind === "SAMPLE_PLOT").map((d) => d.jurisdictionId).sort();
  const zoneEvidenceJurisdictions = datasets.filter((d) => d.renderKind === "ZONE_AREA").map((d) => d.jurisdictionId).sort();
  const declared = DECLARED[speciesId];
  const eligibility = catalogueSpecies().find((species) => species.speciesId === speciesId)?.takeEligibility ?? null;

  /* SERVED is what the endpoint returns, not what the registry lists: a
     certified artifact missing from a deployment, or refused by eligibility,
     is not a map a hunter can receive. */
  const response = entries.length || plotJurisdictions.length ? speciesSurfaces(speciesId) : null;
  const servedById = new Map((response?.surfaces ?? []).map((surface) => [surface.id, surface]));
  const layers: SurfaceLayerStatus[] = entries.map((entry) => {
    const served = servedById.get(entry.artifactId);
    const cells = served?.cells;
    const geography = cells
      ? {
          west: cells.origin[0],
          south: cells.origin[1],
          east: Number((cells.origin[0] + cells.columns * cells.stepDegrees[0]).toFixed(4)),
          north: Number((cells.origin[1] + cells.rows * cells.stepDegrees[1]).toFixed(4)),
        }
      : null;
    const tier = surfaceTierOf(entry);
    return {
      artifactId: entry.artifactId,
      artifactHash: entry.artifactHash,
      surfaceKind: entry.surfaceKind,
      tier,
      represents: TIER_MEANING[tier].represents,
      confidence: confidenceOf(entry).level,
      methodologyVersion: entry.methodologyVersion,
      served: Boolean(served),
      stage: served ? stageOf(entry.artifactHash) : "CERTIFIED",
      geography,
    };
  });
  /* Survey plots are served from their bundles rather than an artifact. */
  const plotsServed = (response?.surfaces ?? []).some((surface) => surface.geometryKind === "SAMPLE_PLOT");
  const heldTiers: SurfaceTier[] = [...layers.filter((layer) => layer.served).map((layer) => layer.tier), ...(plotsServed ? ["SYSTEMATIC_SURVEY" as const] : [])];
  const tier: SpatialTier = SURFACE_TIERS.find((candidate) => heldTiers.includes(candidate)) ?? "NO_SURFACE";

  const servedStages: CoverageStage[] = [...layers.filter((layer) => layer.served).map((layer) => layer.stage), ...(plotsServed ? ["SERVED" as const] : [])];
  const stage: CoverageStage = servedStages.length
    ? servedStages.reduce((best, next) => (COVERAGE_STAGES.indexOf(next) > COVERAGE_STAGES.indexOf(best) ? next : best))
    : layers.length ? "CERTIFIED" : declared ? "STRATEGY_DEFINED" : "NO_STRATEGY";

  let blocker: SpeciesSpatialStrategy["blocker"] = null;
  if (tier === "NO_SURFACE") {
    if (!permitsHuntingOpportunity(speciesId)) {
      blocker = {
        reason: "NOT_HUNT_ELIGIBLE",
        detail: eligibility === "PROTECTED"
          ? "This species must never be hunted, so North Ground draws no map of where to find it."
          : "No authority North Ground has read establishes current take of this species, so no map of where to find it is drawn until one does.",
        genuine: true,
      };
    } else {
      const declined = RANGE_DECLINED.find((row) => row.speciesId === speciesId);
      blocker = declined
        ? { reason: declined.reason, detail: declined.detail, genuine: GENUINE_BLOCKERS.has(declined.reason) }
        : { reason: "NO_PROFILE", detail: "No surface profile is declared for this species.", genuine: false };
    }
  }

  /* A unit figure is named for what it measures: a harvest record is hunting,
     an aerial-survey density is animals. Both are one figure per unit. */
  const zoneDatasets = datasets.filter((d) => d.renderKind === "ZONE_AREA");
  const isDensity = (d: (typeof zoneDatasets)[number]) => d.metrics.some(({ metric }) => metric === "POPULATION_DENSITY");
  const named = (list: typeof zoneDatasets) => listOf(list.map((d) => JURISDICTION_NAMES[d.jurisdictionId] ?? d.jurisdictionId).sort());
  const harvestIn = zoneDatasets.filter((d) => !isDensity(d));
  const densityIn = zoneDatasets.filter(isDensity);
  const held = [
    harvestIn.length ? `harvest records in ${named(harvestIn)}` : null,
    densityIn.length ? `the province's aerial-survey density estimates in ${named(densityIn)}` : null,
  ].filter(Boolean).join(" and ");
  const statement = !blocker
    ? null
    : `${blocker.detail}${zoneEvidenceJurisdictions.length ? ` North Ground holds, by management unit, ${held}; each unit's card shows them. A figure for a whole unit is not a surface: it cannot say where inside the unit the animals are, so it is never painted.` : ""} Unshaded ground is a gap in what North Ground holds, not a finding about the animals.`;

  return {
    speciesId,
    eligibility,
    family: declared?.family ?? null,
    tier,
    stage,
    layers,
    raster: surveyEntry
      ? {
          artifactId: surveyEntry.artifactId,
          methodologyVersion: surveyEntry.methodologyVersion,
          artifactHash: surveyEntry.artifactHash,
          colourScale: surveyEntry.colourScale ?? null,
          seasonalMovement: surveyEntry.seasonalMovement ?? null,
        }
      : null,
    plotJurisdictions,
    zoneEvidenceJurisdictions,
    blocker,
    next: declared?.next ?? [],
    statement,
  };
}
