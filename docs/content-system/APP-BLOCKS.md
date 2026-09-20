# App Blocks and Context Matching

App Blocks are atomic North Ground editorial units that tools can retrieve without scraping a webpage or duplicating prose in UI code. They are not regulatory outcomes, weather observations, or opaque AI recommendations.

## Block record

```ts
interface ContentBlock {
  id: CanonicalId<"content_block">;
  ownerId: CanonicalId;
  type: BlockType;
  locale: Bcp47Locale;
  status: "draft" | "in_review" | "published" | "stale" | "archived";
  content: {
    plainText: string;
    richText?: PortableRichText;
  };
  applicability: Applicability;
  exclusions?: Applicability;
  priority: number; // integer 0..100; editorial tie-breaker, not confidence
  sourceIds?: CanonicalId<"source">[];
  claimIds?: string[];
  verificationStatus: VerificationStatus;
  lastReviewed: IsoDate;
  validFrom?: IsoDate;
  validThrough?: IsoDate;
  supersedes?: CanonicalId<"content_block">[];
  updatedAt: IsoTimestamp;
}
```

`plainText` is always required so native clients, accessibility surfaces, and logs do not need to render markup. Rich text uses a small allowlist (paragraph, emphasis, strong, list, link to canonical entity/resource); embedded script, arbitrary HTML, and presentation classes are forbidden.

## Block types

| Type | Intended decision | Special requirements |
| --- | --- | --- |
| `quick_answer` | Directly answer the owner's primary intent | Standalone and materially complete |
| `app_tip_short` | One compact UI instruction or implication | Must remain accurate without surrounding page prose |
| `app_tip_medium` | A short explanatory app passage | Adds context beyond the short tip without becoming a full guide |
| `habitat_tip` | Where/how to interpret habitat | Species/subject context where relevant |
| `weather_tip` | What a weather condition changes | Not a live forecast; condition applicability required |
| `clothing_tip` | How to adjust a clothing system | Activity and condition/duration applicability |
| `packing_tip` | What to carry or change | Activity/duration applicability |
| `identification_warning` | Prevent species/look-alike error | Source required when factual; no legality inference |
| `field_care_tip` | Handle harvest/equipment safely and effectively | Species/activity applicability as relevant |
| `navigation_tip` | Prevent or resolve navigation error | Safety review where high consequence |
| `legal_note` | Explain where official rules must be checked | Official source/topic link; cannot state unsourced legality |
| `safety_note` | Communicate hazard and action | Source required for thresholds/medical claims |
| `seasonal_behavior` | Explain season-dependent behavior | Species plus seasonal/condition applicability |
| `north_ground_field_note` | First-party observation | North Ground field-test source and limitations required |

Additional types require a distinct application use case; styling differences are not new types.

## Context request

```ts
interface ContextRequest {
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
```

The caller supplies resolved canonical IDs. Alias and coordinate resolution happen before content matching. Unknown units, invalid ranges, ambiguous IDs, or multiple incompatible dates are validation errors rather than coerced guesses.

## Deterministic matching

### 1. Eligibility filters

A block is eligible only when all of these are true:

1. status is `published`;
2. requested block type/owner constraints match;
3. locale matches, or the caller explicitly allows an editorial locale fallback;
4. request date is inside both block validity and applicability validity windows;
5. every applicability dimension present on the block matches the request;
6. no exclusion matches;
7. the block is not stale for a safety/legal surface under the configured review policy.

Missing request data never satisfies a constrained block. For example, a block constrained to a jurisdiction is ineligible if the request has no resolved jurisdiction.

Set dimensions use intersection unless marked `requireAll`. Numeric ranges use their declared inclusive/exclusive boundaries. Terrain tags use normalized controlled terms; no substring matching.

### 2. Specificity tuple

Eligible blocks are ranked lexicographically, not by an opaque learned score. The tuple is:

```text
(
  owner match,
  species match,
  geographic specificity,
  activity + hunt-type match,
  method match,
  condition/weather match,
  temperature match,
  activity-level match,
  duration match,
  terrain match,
  editorial priority,
  last-reviewed date,
  canonical block ID
)
```

Each match flag is 1/0. Geographic specificity ranks zone > jurisdiction > country > unconstrained. The final canonical ID makes ordering stable. A service response returns the tuple or a human-readable `matchReasons` list for auditability.

### 3. Editorial fallback ladder

The service evaluates tiers in order and may fill unrepresented block types from broader tiers:

1. species + activity/hunt type + matching conditions;
2. species + activity/hunt type;
3. species + matching conditions;
4. species + general activity;
5. hunt type + matching conditions;
6. activity + matching conditions;
7. matching conditions;
8. general activity guidance.

The service does not relax a block's declared constraints. It searches for different, deliberately broader blocks. A specific block suppresses a broader block only when they share the same type and `supersedes`/owner lineage or the configured result limit requires selection. Distinct safety warnings are not deduplicated merely because their type matches.

### 4. Legal boundary

There is no regulatory fallback ladder. If the regulatory system has no applicable verified rule, it returns its own `UNKNOWN`, `CONFLICT`, or `NEEDS_VERIFICATION` state. Editorial matching may return a general `legal_note` that instructs the user to check an authority, but it MUST NOT transform missing rule data into permission, prohibition, a season date, or a bag limit.

## Context response

```ts
interface BlockResult {
  contractVersion: "1.0";
  resolvedLocale: string;
  fallbackUsed: boolean;
  context: NormalizedContext;
  blocks: Array<{
    block: ContentBlock;
    matchTier: number;
    matchReasons: string[];
    specificity: number[];
  }>;
  warnings: Array<{
    code: "LOCALE_FALLBACK" | "STALE_BLOCK_EXCLUDED" | "NO_MATCH" |
          "UNKNOWN_ENTITY" | "INCOMPLETE_CONTEXT";
    message: string;
  }>;
  revision: string;
}
```

No-match is a valid empty result with a warning, not permission to generate advice. Generative summarization, if added later, may only summarize returned blocks, must retain their source links, and is not part of deterministic selection.

## Example trace

Input: ruffed grouse, hunting, upland, -18 °C, snow, moderate/high activity, one day.

1. Resolve all names to canonical IDs before querying.
2. Filter out blocks whose jurisdiction, species, activity, validity, or range constraints do not match.
3. Rank an exact species/upland/cold/snow block above a species/upland block.
4. Fill an absent navigation tip from a general hunting + snow block if deliberately authored.
5. Return no legal answer from this service. Compose regulatory results separately.

## Caching

Cache keys use normalized sorted IDs, normalized numeric values/buckets explicitly requested by the producer, locale, date, block types, contract major version, and content revision. Do not cache on raw aliases or coordinate strings. Safety/legal blocks SHOULD have shorter cache TTLs and revision-based invalidation.
