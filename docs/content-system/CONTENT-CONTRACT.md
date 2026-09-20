# Content Contract

## Separation of concerns

The normalized contract represents North Ground entities, editorial resources, first-party evidence references, media, provenance, and relationships. It does not make regulatory decisions or replace environmental provider data.

| Layer | Contract responsibility |
| --- | --- |
| Authoritative/regulatory | Reference source and topic IDs only; legality remains in the rules system |
| Environmental | Store applicability criteria or observations; live forecasts remain provider-owned |
| North Ground knowledge | Resources and atomic blocks |
| North Ground evidence | Field-test entities, observations, limitations, and linked media/sources |

## Common records

All normalized records include a canonical `id`, lifecycle `status`, and revision metadata. Records that can be displayed include localized values. All references use canonical IDs rather than URLs or titles.

### Resource

A resource is a publishable, human-readable knowledge surface. Required fields vary by discriminated `type`; irrelevant fields MUST be omitted rather than filled with empty strings.

Common fields:

```ts
interface ResourceBase {
  id: CanonicalId;
  type: "species" | "guide" | "field_test" | "tool" | "condition" |
        "jurisdiction" | "gear" | "reference";
  status: "draft" | "in_review" | "published" | "stale" | "archived";
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
```

`quickAnswer`, `appTipShort`, and `appTipMedium` are convenient resource projections for page rendering and search metadata. When the same value is exposed as an App Block, the block is the reusable canonical value and the resource projection MUST be derived from it or validated as identical; editors must not maintain divergent copies.

Applicability uses explicit normalized units:

```ts
interface Applicability {
  countryIds?: CanonicalId<"country">[];
  jurisdictionIds?: CanonicalId<"jurisdiction">[];
  zoneIds?: CanonicalId<"management_zone">[];
  speciesIds?: CanonicalId<"species">[];
  activityIds?: CanonicalId<"activity">[];
  huntTypeIds?: CanonicalId<"hunt_type">[];
  methodIds?: CanonicalId<"method">[];
  conditionIds?: CanonicalId<"condition">[];
  weatherConditionIds?: CanonicalId<"weather_condition">[];
  temperatureC?: { min?: number; max?: number; minInclusive?: boolean; maxInclusive?: boolean };
  activityLevels?: ("low" | "moderate" | "high")[];
  durationMinutes?: { min?: number; max?: number };
  terrainTags?: string[];
  validFrom?: IsoDate;
  validThrough?: IsoDate;
}
```

Ranges MUST declare boundary semantics. Fahrenheit may be accepted at an adapter boundary but normalized storage/API output uses Celsius. Durations normalize to minutes.

## Discriminated requirements

| Resource type | Additional required content when published |
| --- | --- |
| `species` | species profile, taxonomy, identification, conservation context, sources, last reviewed |
| `guide` | quick answer, body/sections, at least one subject entity, useful next action |
| `field_test` | protocol/context, observations, result, limitations, evidence media/source link |
| `tool` | purpose, inputs/outputs, limitations, canonical tool URL |
| `condition` | definition, decision implications, safety caveats where relevant |
| `jurisdiction` | official name, authority/source references, coverage disclaimer |
| `gear` | category context; testing status and commercial disclosure where applicable |
| `reference` | subject entities, direct answer or definition, sources where claims require them |

The publication gate in `CONTENT-QUALITY.md` is normative and may impose additional requirements.

## Species registry contract

A species entity is a biological identity record, not a hunting authorization. It supports:

```ts
interface SpeciesProfile {
  speciesId: CanonicalId<"species">;
  commonNames: LocalizedText[];
  scientificName: string;
  scientificNameAuthority?: string;
  aliases?: EntityAlias[];
  taxonomy: {
    kingdom?: string; phylum?: string; class?: string; order?: string;
    family?: string; genus: string; species: string; taxonRank?: string;
    taxonomySourceId: CanonicalId<"source">;
  };
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
  documentedHuntingJurisdictionIds?: CanonicalId<"jurisdiction">[];
  relationshipIds?: string[];
  mediaIds?: string[];
  sourceIds: CanonicalId<"source">[];
  verificationStatus: VerificationStatus;
  lastReviewed: IsoDate;
}
```

`jurisdictionIds` means documented occurrence/relevance, not huntability. `documentedHuntingJurisdictionIds` means hunting context exists and is sourced, not that a season is open. There is intentionally no universal `huntable` boolean. Huntability is a regulatory result requiring jurisdiction, spatial layers, date/time, species, method, hunter attributes, and authoritative rule provenance.

## Sources and claims

```ts
interface SourceRecord {
  id: CanonicalId<"source">;
  authority?: string;
  title: string;
  url: string;
  publisher: string;
  retrievedAt: IsoTimestamp;
  publishedAt?: IsoTimestamp;
  effectiveFrom?: IsoDate;
  effectiveThrough?: IsoDate;
  type: "official" | "scientific" | "north_ground_evidence" |
        "reputable_secondary" | "manufacturer";
  jurisdictionIds?: CanonicalId<"jurisdiction">[];
  verificationStatus: VerificationStatus;
  contentHash?: string;
  supersededBy?: CanonicalId<"source">;
}

interface Claim {
  id: string;
  ownerId: CanonicalId;
  text?: string;
  sourceIds: CanonicalId<"source">[];
  support: "direct" | "derived" | "context";
  verificationStatus: VerificationStatus;
  reviewedAt?: IsoTimestamp;
  reviewerId?: string;
}
```

Regulatory claims require an `official` source and effective-period metadata when the authority provides it. Scientific claims SHOULD cite primary research or a recognized scientific authority. Manufacturer sources may establish specifications but not independent performance. North Ground evidence must resolve to a field-test record. A bibliography without claim mapping does not satisfy high-impact claim provenance when claim-level mapping is practical.

Verification states are `unverified`, `needs_review`, `verified`, `conflict`, `stale`, and `superseded`. `verified` describes provenance review, not a guarantee or legal determination.

## Search and AEO metadata

Search metadata is populated after legitimate query/intent research; metrics are never fabricated.

```ts
interface SearchMetadata {
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
```

The H1 and quick answer MUST render in visible server-renderable HTML on indexable pages. JSON-LD is supplementary and must reflect visible content using supported schema.org vocabulary. Content cannot exist solely for crawlers.

## URL principles

Candidate route families, subject to search research and the site router, are:

- species: `/species/{slug}`
- jurisdictions: `/jurisdictions/{slug}`
- guides: `/guides/{slug}` or a researched topical hierarchy
- field tests: `/field-tests/{slug}`
- tools: `/tools/{slug}`
- conditions: `/conditions/{slug}`
- gear: `/gear/{slug}`

These are conventions, not identity. The final route registry owns canonical paths. Existing repository convention currently has only `/` and uses no trailing slash; new canonical URLs SHOULD therefore omit trailing slashes unless the deployment convention changes globally.

Rules:

- one canonical URL per resource and locale;
- HTTP to HTTPS and host normalization at the platform edge;
- permanent redirect on rename/move, with no redirect chains;
- aliases are `noindex` redirects, not duplicate pages;
- filtered/query-state pages default to `noindex,follow` or canonicalize to the durable parent;
- pagination is crawlable only when it has stable value and self-canonicalizes;
- locale routing must be chosen globally before localized pages ship;
- 404 for unknown IDs/slugs; 410 only for intentionally removed resources with no successor.

Hunt URLs remain owned by the Hunt implementation and are not prescribed here.

## Content service/API boundary

The initial service can be an in-process repository. Do not add an HTTP API until another runtime requires it. The stable interface is:

```ts
interface ContentRepository {
  resolveEntity(input: EntityLookup): Promise<EntityResolution>;
  getEntity(id: CanonicalId, options?: LocaleOptions): Promise<Entity | null>;
  getResource(id: CanonicalId, options?: LocaleOptions): Promise<Resource | null>;
  getBlocksForResource(id: CanonicalId, options?: BlockQuery): Promise<BlockResult>;
  getContextualBlocks(request: ContextRequest): Promise<BlockResult>;
  getRelatedResources(id: CanonicalId, options?: RelationshipQuery): Promise<ResourceSummary[]>;
  getCanonicalUrl(id: CanonicalId, locale: string): Promise<CanonicalUrlResult | null>;
  getSources(ids: CanonicalId<"source">[]): Promise<SourceRecord[]>;
}
```

If exposed over HTTP, use versioned representations such as `/api/content/v1/entities/{encodedId}` and `/api/content/v1/context-blocks`. Responses include `contractVersion`, `resolvedLocale`, `data`, `warnings`, and `revision`. Expected statuses are 200, 400 for invalid context, 404 for unknown ID, 409 for ambiguous alias, and 422 for a valid but unsupported context. Authentication, caching, rate limits, and public/private exposure are deployment concerns.

The contextual response MUST include why each block matched and which filters were applied. It MUST NOT include a regulatory OPEN/CLOSED result unless composed separately from the regulatory service and clearly labeled.
