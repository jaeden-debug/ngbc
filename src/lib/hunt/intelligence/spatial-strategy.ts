import strategyJson from "../../../../content/intelligence/spatial-strategy.json" with { type: "json" };
import verificationJson from "../../../../content/intelligence/surface-verification.json" with { type: "json" };
import { servableDatasets } from "./bundles.ts";
import { catalogueSpecies } from "./species-catalogue.ts";
import { surfaceRegistry } from "./surface.ts";

/**
 * What North Ground can say about WHERE a species is, for every species it
 * publishes — and how far each answer has got toward a hunter's screen.
 *
 * WHY THIS EXISTS. "Only ruffed grouse has a heat map" was an owner's reading
 * of the live map, and nothing in the repository could have told them
 * otherwise, because nothing recorded per species what was held, what was
 * drawn, and what was merely planned. A coverage claim made in prose — "every
 * BBS surface is served" — is exactly the claim that turns out true for the
 * artifacts and false for the hunter.
 *
 * TWO HALVES, KEPT APART.
 *
 *   HELD is DERIVED here from the certified registries: the surface registry
 *   (rasters), the servable evidence bundles (survey plots and zone evidence).
 *   Nothing typed can make a species look covered.
 *
 *   PLANNED is DECLARED in `content/intelligence/spatial-strategy.json`: the
 *   species' evidence family and what is being built toward, with its status.
 *   A plan never counts as coverage.
 *
 * THE FIVE STRATEGIES (owner, 2026-09-30):
 *
 *   A  measured abundance or density at a resolution finer than a zone
 *   B  measured distribution or relative abundance (the survey field, plots)
 *   C  a species habitat or opportunity model
 *   D  coarser supporting evidence — a figure per management unit, shown in
 *      the unit's card and never painted, because it cannot say where inside
 *      the unit the animals are (§41B)
 *   E  nothing defensible yet — said, never silent
 *
 * The strategy reported for a species is the strongest one it HOLDS; the
 * declared plan is reported beside it, never instead of it.
 */

export type SpatialStrategy =
  | "A_MEASURED_DENSITY"
  | "B_MEASURED_DISTRIBUTION"
  | "C_HABITAT_MODEL"
  | "D_COARSE_SUPPORTING"
  | "E_NO_DEFENSIBLE_SURFACE";

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

export interface PlannedEvidence {
  strategy: SpatialStrategy;
  status: "IN_RESEARCH" | "PLANNED" | "BLOCKED";
  plan: string;
}

export interface SpeciesSpatialStrategy {
  speciesId: string;
  family: string | null;
  /** The strongest strategy HELD. */
  strategy: SpatialStrategy;
  /** How far the species' surface has got. Zone evidence is not a surface. */
  stage: CoverageStage;
  /** The continuous survey field, when one is certified. */
  raster: { artifactId: string; methodologyVersion: string; artifactHash: string; colourScale: string | null; seasonalMovement: string | null } | null;
  /** Jurisdictions with surveyed plots drawn at their own extent. */
  plotJurisdictions: string[];
  /** Jurisdictions with zone evidence shown in the zone card, never painted. */
  zoneEvidenceJurisdictions: string[];
  /** Why the survey declined the species, where it did. */
  declined: string | null;
  next: PlannedEvidence[];
  /** One plain paragraph for a hunter, or null where the drawn surface speaks for itself. */
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

export function spatialStrategyFor(speciesId: string): SpeciesSpatialStrategy {
  const registry = surfaceRegistry();
  const entry = registry.surfaces.find((surface) => surface.speciesId === speciesId) ?? null;
  const datasets = servableDatasets().filter((dataset) => dataset.speciesId === speciesId);
  const plotJurisdictions = datasets.filter((d) => d.renderKind === "SAMPLE_PLOT").map((d) => d.jurisdictionId).sort();
  const zoneEvidenceJurisdictions = datasets.filter((d) => d.renderKind === "ZONE_AREA").map((d) => d.jurisdictionId).sort();
  const declinedEntry = registry.declined.find((row) => row.speciesId === speciesId)
    ?? registry.unmatched.find((row) => row.speciesId === speciesId)
    ?? null;
  const declared = DECLARED[speciesId];
  const eligibility = catalogueSpecies().find((species) => species.speciesId === speciesId)?.takeEligibility ?? null;

  const strategy: SpatialStrategy = entry || plotJurisdictions.length
    ? "B_MEASURED_DISTRIBUTION"
    : zoneEvidenceJurisdictions.length ? "D_COARSE_SUPPORTING" : "E_NO_DEFENSIBLE_SURFACE";

  let stage: CoverageStage = declared ? "STRATEGY_DEFINED" : "NO_STRATEGY";
  if (entry) {
    /* In the registry means generated, hash-certified and served by the same
       endpoint; the two top rungs are only what a browser saw for THESE bytes. */
    stage = "SERVED";
    if (VERIFIED.rendered?.[entry.artifactHash]) stage = "RENDERED";
    if (VERIFIED.productionVerified?.[entry.artifactHash]) stage = "PRODUCTION_VERIFIED";
  } else if (plotJurisdictions.length) {
    stage = "SERVED";
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
  const statement = entry || plotJurisdictions.length
    ? null
    : eligibility === "PROTECTED"
      /* §16: library presence never implies legal opportunity, and a map of
         where to look for a protected animal is a hunting aid. */
      ? "This species must never be hunted, so North Ground draws no map of where to find it. Unshaded ground is a gap in what North Ground holds, not a finding about the animals."
      : eligibility === "UNVERIFIED"
        ? "No authority North Ground has read establishes current take of this species, so no map of where to find it is drawn until one does. Unshaded ground is a gap in what North Ground holds, not a finding about the animals."
    : zoneEvidenceJurisdictions.length
      ? `North Ground holds, by management unit, ${held}; each unit's card shows them. A figure for a whole unit is not a surface: it cannot say where inside the unit the animals are, so nothing is painted. Unshaded ground is a gap in what North Ground holds, not a finding about the animals.`
      : `North Ground holds no survey that maps where this species is${declinedEntry ? ` (${declinedEntry.detail.replace(/\.$/, "")})` : ""}. Unshaded ground is a gap in what North Ground holds, not a finding about the animals.`;

  return {
    speciesId,
    family: declared?.family ?? null,
    strategy,
    stage,
    raster: entry
      ? {
          artifactId: entry.artifactId,
          methodologyVersion: entry.methodologyVersion,
          artifactHash: entry.artifactHash,
          colourScale: entry.colourScale ?? null,
          seasonalMovement: entry.seasonalMovement ?? null,
        }
      : null,
    plotJurisdictions,
    zoneEvidenceJurisdictions,
    declined: declinedEntry?.detail ?? null,
    next: declared?.next ?? [],
    statement,
  };
}
