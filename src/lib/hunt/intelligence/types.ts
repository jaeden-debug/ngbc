import type { CanonicalId } from "../../content-contract/index.ts";

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

export type EvidenceGeometryType = "MANAGEMENT_ZONE" | "POLYGON" | "GRID_CELL" | "POINT" | "RANGE";
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
  explanation: string;
}

export interface OpportunityResult {
  speciesId: CanonicalId<"species">;
  geographyId: string;
  classification: OpportunityClass;
  coverage: EvidenceCoverage;
  methodologyVersion: string;
  components: OpportunityComponent[];
  explanation: string[];
  /** Explicit separation: opportunity never carries or modifies a legal result. */
  legalStatus: null;
}
