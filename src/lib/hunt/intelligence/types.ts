import type { CanonicalId } from "../../content-contract/index.ts";
import type { EvidenceGrade, EvidenceStrength, MetricRole } from "./methodology.ts";
import type { HeatRenderKind } from "./rendering.ts";

/** Opportunity evidence is descriptive. It can never produce a legal status. */
export type IntelligenceMetric =
  | "HARVEST_TOTAL"
  | "HARVEST_PER_HUNTER"
  | "HUNTER_SUCCESS_RATE"
  | "HUNTER_COUNT"
  | "HUNTER_DAYS"
  | "HARVEST_PER_EFFORT"
  | "POPULATION_ESTIMATE"
  | "POPULATION_DENSITY"
  | "SURVEY_OBSERVATION"
  | "RANGE_PRESENCE"
  | "HABITAT_SUITABILITY"
  | "PUBLIC_LAND_AVAILABILITY"
  | "ACCESS_OPPORTUNITY";

/**
 * `SAMPLE_PLOT` is a surveyed plot, and it is NOT `POLYGON`.
 *
 * A management polygon tiles the ground: every point is in one, so unshaded
 * ground means no evidence for that area. A sample plot does the opposite — the
 * Eastern Waterfowl Survey's 332 plots cover 8,300 km² of five provinces, and
 * everything between them was never looked at. Drawn as `POLYGON` the two are
 * indistinguishable, and the ground between the plots reads as surveyed and
 * empty. It was neither.
 */
export type EvidenceGeometryType =
  | "MANAGEMENT_ZONE" | "POLYGON" | "SAMPLE_PLOT" | "GRID_CELL" | "POINT" | "RANGE";
export type EvidenceConfidence = "HIGH" | "MODERATE" | "LOW" | "UNKNOWN";
export type EvidenceCoverage = "ROBUST_DATA" | "PARTIAL_DATA" | "LIMITED_DATA" | "RANGE_ONLY" | "NO_HEAT_MAP_DATA";
export type OpportunityClass = "VERY_HIGH" | "HIGH" | "MODERATE" | "LOW" | "LIMITED_DATA";
export type DatasetCoverage =
  | "VERIFIED"
  | "PARTIAL"
  | "LIMITED"
  | "IN_DEVELOPMENT"
  | "UNAVAILABLE"
  | "LICENCE_PENDING"
  | "LICENCE_BLOCKED"
  | "STALE"
  | "NEEDS_VERIFICATION";
export type LegalStanding =
  | "LEGAL_TEXT_CONTROLS"
  | "OFFICIAL_GIS_INDICATIVE"
  | "OFFICIAL_GIS_AUTHORITATIVE"
  | "OFFICIAL_STATISTICAL_DATA"
  | "DERIVED_NORTH_GROUND_DATA"
  | "THIRD_PARTY_ENVIRONMENTAL_DATA";

export interface IntelligenceSource {
  id: CanonicalId<"source">;
  jurisdictionId: CanonicalId<"jurisdiction">;
  authority: string;
  title: string;
  url: string;
  datasetIdentifier?: string;
  licence: string;
  licenceUrl?: string;
  commercialReuse: "ALLOWED" | "PROHIBITED" | "UNCLEAR";
  redistribution: "ALLOWED" | "PROHIBITED" | "UNCLEAR" | "RUNTIME_ONLY";
  attributionRequired: boolean;
  legalStanding: LegalStanding;
  retrievedAt: string;
  verifiedAt: string;
  sourceHash?: `sha256:${string}`;
  notes?: string;
}

export interface EvidenceRecord {
  id: `evidence:${string}`;
  speciesId: CanonicalId<"species">;
  jurisdictionId: CanonicalId<"jurisdiction">;
  geographyId: string;
  geographyType: EvidenceGeometryType;
  sourceId: CanonicalId<"source">;
  metric: IntelligenceMetric;
  rawValue: number | string | boolean;
  normalizedValue?: number;
  unit: string;
  sampleSize?: number;
  methodology?: string;
  effectivePeriod?: { from: string; through: string };
  observationPeriod: { from: string; through: string };
  retrievedAt: string;
  verifiedAt: string;
  confidence: EvidenceConfidence;
  spatialPrecision: string;
  notes?: string;
  version: string;
  superseded: boolean;
}

export type LandOwnership =
  | "PROVINCIAL_CROWN"
  | "FEDERAL_CROWN"
  | "TERRITORIAL_PUBLIC"
  | "US_FEDERAL_PUBLIC"
  | "US_STATE_PUBLIC"
  | "PRIVATE"
  | "MUNICIPAL"
  | "INDIGENOUS"
  | "UNKNOWN";

export type AccessStatus = "CONFIRMED_PUBLIC" | "RESTRICTED" | "SEASONAL" | "PERMISSION_REQUIRED" | "UNKNOWN";
export type HuntingRestriction = "PROHIBITED" | "SPECIES_SPECIFIC" | "METHOD_RESTRICTED" | "SEASONAL" | "UNKNOWN" | "NONE_IDENTIFIED";

export interface LandRecord {
  id: `land:${string}`;
  jurisdictionId: CanonicalId<"jurisdiction">;
  sourceId: CanonicalId<"source">;
  name?: string;
  ownership: LandOwnership;
  access: AccessStatus;
  huntingRestriction: HuntingRestriction;
  effectivePeriod?: { from: string; through?: string };
  notes?: string;
}

export interface LayerCoverageRecord {
  id: string;
  jurisdictionId: CanonicalId<"jurisdiction">;
  layer: string;
  status: DatasetCoverage;
  sourceIds: CanonicalId<"source">[];
  production: boolean;
  limitation: string;
  verifiedAt: string;
}

export interface OpportunityComponent {
  metric: IntelligenceMetric;
  label: string;
  normalizedValue?: number;
  confidence: EvidenceConfidence;
  sourceIds: CanonicalId<"source">[];
  /** What this metric is allowed to do to the shade. See `methodology.ts`. */
  role: MetricRole;
  /**
   * Whether this component moved the intensity at all.
   *
   * False for every hunter count and hunter day. It is a field rather than an
   * inference so that a reader of a response body — or a test — can see that
   * effort was carried and not scored, instead of having to know the rule.
   */
  contributesToIntensity: boolean;
  /** The renormalized weight actually applied here. Absent when it contributed nothing. */
  appliedWeight?: number;
  /** What the metric means, in the words a hunter is shown. */
  meaning: string;
  explanation: string;
}

export interface OpportunityResult {
  speciesId: CanonicalId<"species">;
  geographyId: string;
  classification: OpportunityClass;
  /**
   * The continuous rank the map paints, 0 to 1, or null where the evidence
   * will not support a rank.
   *
   * Null and zero are different answers and must stay different: zero is the
   * bottom of a dataset that WAS ranked, null is a refusal to rank. Drawing
   * null at the cold end of the ramp would state the first while meaning the
   * second.
   */
  intensity: number | null;
  coverage: EvidenceCoverage;
  /** How well-evidenced the shade is — never how hot it is. */
  strength: EvidenceStrength;
  /** The engineering grade of the evidence behind it (A-E). */
  grade: EvidenceGrade;
  /** The finest way this evidence may be drawn. */
  renderKind: HeatRenderKind;
  methodologyVersion: string;
  components: OpportunityComponent[];
  explanation: string[];
  /** Explicit separation: opportunity never carries or modifies a legal result. */
  legalStatus: null;
}
