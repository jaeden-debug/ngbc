import type { CanonicalId, EntityType } from "./ids";

export const CONTENT_CONTRACT_VERSION = "1.0" as const;

export type IsoDate = `${number}-${number}-${number}`;
export type IsoTimestamp = string;
export type Bcp47Locale = string;

export type VerificationStatus =
  | "unverified"
  | "needs_review"
  | "verified"
  | "conflict"
  | "stale"
  | "superseded";

export type EntityStatus = "active" | "deprecated" | "merged" | "retired";
export type ResourceStatus = "draft" | "in_review" | "published" | "stale" | "archived";

export interface LocalizedText {
  locale: Bcp47Locale;
  value: string;
  official?: boolean;
}

export interface EntityAlias {
  value: string;
  locale?: Bcp47Locale;
  type:
    | "common_name"
    | "scientific_name"
    | "official_name"
    | "abbreviation"
    | "misspelling"
    | "historical_name"
    | "legacy_id";
  jurisdictionIds?: CanonicalId<"jurisdiction">[];
  verificationStatus: VerificationStatus;
  sourceIds?: CanonicalId<"source">[];
}

export interface Entity<T extends EntityType = EntityType> {
  id: CanonicalId<T>;
  type: T;
  status: EntityStatus;
  names: LocalizedText[];
  slugs?: Array<{ locale: Bcp47Locale; value: string }>;
  aliases?: EntityAlias[];
  replacedBy?: CanonicalId[];
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface NumericRange {
  min?: number;
  max?: number;
  minInclusive?: boolean;
  maxInclusive?: boolean;
}

export interface Applicability {
  countryIds?: CanonicalId<"country">[];
  jurisdictionIds?: CanonicalId<"jurisdiction">[];
  zoneIds?: CanonicalId<"management_zone">[];
  speciesIds?: CanonicalId<"species">[];
  activityIds?: CanonicalId<"activity">[];
  huntTypeIds?: CanonicalId<"hunt_type">[];
  methodIds?: CanonicalId<"method">[];
  conditionIds?: CanonicalId<"condition">[];
  weatherConditionIds?: CanonicalId<"weather_condition">[];
  temperatureC?: NumericRange;
  activityLevels?: Array<"low" | "moderate" | "high">;
  durationMinutes?: NumericRange;
  terrainTags?: string[];
  validFrom?: IsoDate;
  validThrough?: IsoDate;
}

export interface KeyFact {
  id: string;
  label: string;
  value: string;
  sourceIds?: CanonicalId<"source">[];
}

export interface Breadcrumb {
  label: string;
  canonicalId?: CanonicalId;
  url: string;
}

export interface SearchMetadata {
  primaryQuery?: string;
  secondaryQueries?: string[];
  intent?: string;
  canonicalUrl: string;
  title: string;
  metaDescription: string;
  h1: string;
  quickAnswer: string;
  keyFacts?: KeyFact[];
  entityIds: CanonicalId[];
  breadcrumbs: Breadcrumb[];
  lastReviewed?: IsoDate;
  sourceIds?: CanonicalId<"source">[];
  indexing: "index" | "noindex";
}

export type ResourceType =
  | "species"
  | "guide"
  | "field_test"
  | "tool"
  | "condition"
  | "jurisdiction"
  | "gear"
  | "reference";

export interface ResourceBase<T extends ResourceType = ResourceType> {
  id: CanonicalId;
  type: T;
  status: ResourceStatus;
  locale: Bcp47Locale;
  slug: string;
  canonicalUrl?: string;
  title: string;
  description: string;
  primaryQuery?: string;
  secondaryQueries?: string[];
  searchIntent?: "informational" | "decision" | "navigational" | "transactional";
  entityIds: CanonicalId[];
  jurisdictionIds?: CanonicalId<"jurisdiction">[];
  speciesIds?: CanonicalId<"species">[];
  huntTypeIds?: CanonicalId<"hunt_type">[];
  methodIds?: CanonicalId<"method">[];
  conditionIds?: CanonicalId<"condition">[];
  applicability?: Applicability;
  quickAnswer?: string;
  appTipShort?: string;
  appTipMedium?: string;
  keyFacts?: KeyFact[];
  safetyNotes?: CanonicalId<"content_block">[];
  sourceIds?: CanonicalId<"source">[];
  northGroundSourceIds?: CanonicalId<"source">[];
  relatedResourceIds?: CanonicalId[];
  relatedSpeciesIds?: CanonicalId<"species">[];
  relatedGuideIds?: CanonicalId<"guide">[];
  relatedGearIds?: CanonicalId[];
  relatedFieldTestIds?: CanonicalId<"field_test">[];
  verificationStatus: VerificationStatus;
  fieldTested: boolean;
  authorIds?: string[];
  reviewerIds?: string[];
  lastReviewed?: IsoDate;
  publishedAt?: IsoTimestamp;
  updatedAt: IsoTimestamp;
  seo?: SearchMetadata;
}

export interface SourcedSection {
  heading?: string;
  text: string;
  sourceIds: CanonicalId<"source">[];
}

export type BiologicalSex = "MALE" | "FEMALE" | "UNKNOWN";
export type BiologicalAgeClass = "ADULT" | "JUVENILE" | "CALF" | "FAWN" | "OTHER" | "UNKNOWN";
export type RegulatoryAnimalClassDimension =
  | "ANTLER_CLASS"
  | "BIRD_CHARACTERISTIC"
  | "JURISDICTION_DEFINED";

export type AnimalCharacteristicIntent =
  | {
      kind: "BIOLOGICAL";
      dimension: "SEX";
      value: BiologicalSex;
    }
  | {
      kind: "BIOLOGICAL";
      dimension: "AGE_CLASS";
      value: BiologicalAgeClass;
    }
  | {
      kind: "REGULATORY_CLASS";
      dimension: RegulatoryAnimalClassDimension;
      value: string;
    };

/**
 * Search/display vocabulary for one biological species. A term may express a
 * biological characteristic or a regulatory-class intent, but never creates a
 * second species identity and never decides whether the class legally applies.
 */
export interface SpeciesTerminology {
  value: string;
  locale?: Bcp47Locale;
  kind: "hunter_term" | "sex_term" | "age_term" | "regulatory_class_term";
  intent: AnimalCharacteristicIntent;
  sourceIds?: CanonicalId<"source">[];
}

export interface SpeciesSexAgeInfo {
  terminology: SpeciesTerminology[];
  sexDifferences?: SourcedSection[];
  ageDifferences?: SourcedSection[];
}

export interface SpeciesActivityContext {
  activityId: CanonicalId<"activity">;
  note: string;
  sourceIds: CanonicalId<"source">[];
}

export interface SpeciesProfile {
  speciesId: CanonicalId<"species">;
  commonNames: LocalizedText[];
  scientificName: string;
  scientificNameAuthority?: string;
  aliases?: EntityAlias[];
  taxonomy: {
    kingdom?: string;
    phylum?: string;
    class?: string;
    order?: string;
    family?: string;
    genus: string;
    species: string;
    taxonRank?: string;
    taxonomySourceId: CanonicalId<"source">;
  };
  taxonomicStatus?: "accepted" | "contested" | "authority_dependent";
  taxonomicNotes?: SourcedSection[];
  speciesGroupIds: CanonicalId<"species_group">[];
  rangeSummary?: LocalizedText[];
  jurisdictionIds?: CanonicalId<"jurisdiction">[];
  conservationContext?: SourcedSection[];
  identification: SourcedSection[];
  similarSpeciesIds?: CanonicalId<"species">[];
  habitat?: SourcedSection[];
  diet?: SourcedSection[];
  behavior?: SourcedSection[];
  seasonalBehavior?: SourcedSection[];
  activityPatterns?: SourcedSection[];
  signsAndTracks?: SourcedSection[];
  huntingContext?: SourcedSection[];
  activityContexts?: SpeciesActivityContext[];
  sexAgeInfo?: SpeciesSexAgeInfo;
  documentedHuntingJurisdictionIds?: CanonicalId<"jurisdiction">[];
  relationshipIds?: string[];
  mediaIds?: string[];
  sourceIds: CanonicalId<"source">[];
  verificationStatus: VerificationStatus;
  lastReviewed: IsoDate;
}

export interface SpeciesResource extends ResourceBase<"species"> {
  speciesProfile: SpeciesProfile;
  body?: unknown;
}

export interface GuideResource extends ResourceBase<"guide"> {
  body?: unknown;
}

export interface FieldTestResource extends ResourceBase<"field_test"> {
  body?: unknown;
  testContext?: {
    locationDisclosure: "none" | "coarse" | "precise_private" | "precise_public";
    startedAt: IsoTimestamp;
    durationMinutes: number;
    temperatureC?: NumericRange;
    terrainTags?: string[];
    limitations: string[];
  };
}

export interface ToolResource extends ResourceBase<"tool"> {
  inputSummary?: string[];
  outputSummary?: string[];
  limitations?: string[];
}

export interface ConditionResource extends ResourceBase<"condition"> {
  body?: unknown;
}

export interface JurisdictionResource extends ResourceBase<"jurisdiction"> {
  coverageDisclaimer?: string;
}

export interface GearResource extends ResourceBase<"gear"> {
  commercialDisclosure?: string;
  body?: unknown;
}

export interface ReferenceResource extends ResourceBase<"reference"> {
  body?: unknown;
}

export type Resource =
  | SpeciesResource
  | GuideResource
  | FieldTestResource
  | ToolResource
  | ConditionResource
  | JurisdictionResource
  | GearResource
  | ReferenceResource;

export type SourceType =
  | "official"
  | "scientific"
  | "north_ground_evidence"
  | "reputable_secondary"
  | "manufacturer";

export interface SourceRecord {
  id: CanonicalId<"source">;
  authority?: string;
  title: string;
  url: string;
  publisher: string;
  retrievedAt: IsoTimestamp;
  publishedAt?: IsoTimestamp;
  effectiveFrom?: IsoDate;
  effectiveThrough?: IsoDate;
  type: SourceType;
  jurisdictionIds?: CanonicalId<"jurisdiction">[];
  verificationStatus: VerificationStatus;
  contentHash?: string;
  supersededBy?: CanonicalId<"source">;
  /** The licence the authority publishes this source under, in its own name. */
  licence?: string;
  /** The attribution statement that licence requires, verbatim. */
  attribution?: string;
}

export interface Claim {
  id: string;
  ownerId: CanonicalId;
  text?: string;
  sourceIds: CanonicalId<"source">[];
  support: "direct" | "derived" | "context";
  verificationStatus: VerificationStatus;
  reviewedAt?: IsoTimestamp;
  reviewerId?: string;
}

export type BlockType =
  | "quick_answer"
  | "app_tip_short"
  | "app_tip_medium"
  | "habitat_tip"
  | "weather_tip"
  | "clothing_tip"
  | "packing_tip"
  | "identification_warning"
  | "field_care_tip"
  | "navigation_tip"
  | "legal_note"
  | "safety_note"
  | "seasonal_behavior"
  | "north_ground_field_note";

export interface ContentBlock {
  id: CanonicalId<"content_block">;
  ownerId: CanonicalId;
  type: BlockType;
  locale: Bcp47Locale;
  status: ResourceStatus;
  content: { plainText: string; richText?: unknown };
  applicability: Applicability;
  exclusions?: Applicability;
  priority: number;
  sourceIds?: CanonicalId<"source">[];
  claimIds?: string[];
  verificationStatus: VerificationStatus;
  lastReviewed: IsoDate;
  validFrom?: IsoDate;
  validThrough?: IsoDate;
  supersedes?: CanonicalId<"content_block">[];
  updatedAt: IsoTimestamp;
}

export type RelationshipType =
  | "member_of"
  | "occurs_in"
  | "has_hunting_context_in"
  | "covered_by"
  | "has_guide"
  | "has_field_test"
  | "relevant_to"
  | "uses_skill"
  | "applies_in_condition"
  | "uses_clothing_system"
  | "uses_pack_template"
  | "includes_equipment"
  | "recommends_category"
  | "evaluates_product"
  | "has_regulatory_resource"
  | "similar_to"
  | "canonical_parent"
  | "supersedes"
  | "translated_version_of";

export interface Relationship {
  id: string;
  fromId: CanonicalId;
  toId: CanonicalId;
  type: RelationshipType;
  direction: "directed" | "symmetric";
  origin: "manual" | "derived";
  weight?: number;
  locale?: Bcp47Locale;
  validFrom?: IsoDate;
  validThrough?: IsoDate;
  sourceIds?: CanonicalId<"source">[];
  derivation?: { rule: string; inputs: string[]; generatedAt: IsoTimestamp };
  status: "active" | "deprecated";
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface MediaRecord {
  id: string;
  kind: "image" | "video" | "audio" | "diagram" | "map";
  sourceType: "north_ground" | "licensed_external" | "unsplash" | "official";
  sourceUrl?: string;
  creator: string;
  licence: string;
  licenceUrl?: string;
  attribution?: string;
  assetUrl: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  altText?: string;
  caption?: string;
  locale?: Bcp47Locale;
  depictsEntityIds?: CanonicalId[];
  depictsSpeciesIds?: CanonicalId<"species">[];
  speciesMediaRole?:
    | "general"
    | "adult_male"
    | "adult_female"
    | "juvenile"
    | "winter_form"
    | "breeding_plumage"
    | "nonbreeding_plumage"
    | "lookalike_comparison";
  depictsSex?: BiologicalSex;
  depictsAgeClass?: BiologicalAgeClass;
  seasonalForm?: string;
  identityVerification: "verified" | "probable" | "unverified" | "rejected";
  identityVerifiedBy?: string;
  identityVerifiedAt?: IsoTimestamp;
  sourceIds?: CanonicalId<"source">[];
  capturedAt?: IsoTimestamp;
  locationDisclosure: "none" | "coarse" | "precise_private" | "precise_public";
  status: "active" | "restricted" | "retired";
}

export interface ContextRequest {
  locale: Bcp47Locale;
  countryId?: CanonicalId<"country">;
  jurisdictionIds?: CanonicalId<"jurisdiction">[];
  zoneIds?: CanonicalId<"management_zone">[];
  speciesIds?: CanonicalId<"species">[];
  date?: IsoDate;
  activityId: CanonicalId<"activity">;
  huntTypeId?: CanonicalId<"hunt_type">;
  methodIds?: CanonicalId<"method">[];
  temperatureC?: number;
  windKph?: number;
  precipitation?: "none" | "rain" | "freezing_rain" | "snow" | "mixed";
  snowDepthCm?: number;
  activityLevel?: "low" | "moderate" | "high";
  durationMinutes?: number;
  terrainTags?: string[];
  blockTypes?: BlockType[];
  ownerIds?: CanonicalId[];
  limit?: number;
}

export interface BlockResult {
  contractVersion: typeof CONTENT_CONTRACT_VERSION;
  resolvedLocale: string;
  fallbackUsed: boolean;
  context: ContextRequest;
  blocks: Array<{
    block: ContentBlock;
    matchTier: number;
    matchReasons: string[];
    specificity: number[];
  }>;
  warnings: Array<{
    code:
      | "LOCALE_FALLBACK"
      | "STALE_BLOCK_EXCLUDED"
      | "NO_MATCH"
      | "UNKNOWN_ENTITY"
      | "INCOMPLETE_CONTEXT";
    message: string;
  }>;
  revision: string;
}

export interface ContentBundle {
  contractVersion: typeof CONTENT_CONTRACT_VERSION;
  generatedAt: IsoTimestamp;
  entities: Entity[];
  resources: Resource[];
  blocks: ContentBlock[];
  relationships: Relationship[];
  sources: SourceRecord[];
  claims: Claim[];
  media: MediaRecord[];
}
