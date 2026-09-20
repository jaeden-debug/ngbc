# Media Standard

Accuracy, provenance, and accessibility take priority over decoration.

## Allowed media

- original North Ground media;
- external media with a verified licence and required attribution;
- Unsplash media when its current licence and intended use are compatible;
- maps, diagrams, and branded graphics with recorded creator/source information.

Do not ingest large external asset libraries speculatively. Add media for a known resource and use case.

## Species identity rule

Never use an inaccurate or merely similar species image. A ruffed grouse resource cannot use an unidentified “grouse” photo as if it depicts ruffed grouse.

Species-targeted media has an identity state:

- `verified`: confirmed by a qualified reviewer or authoritative source metadata;
- `probable`: plausible but not sufficient for species representation;
- `unverified`: not assessed;
- `rejected`: identified as wrong/misleading.

Only `verified` media may carry a `depictsSpeciesIds` claim or serve as a species hero/identification image. If exact identity cannot be verified, use a habitat/context image labeled as context, a branded graphic, a map/diagram, or no hero image.

## Media record

```ts
interface MediaRecord {
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
  identityVerification: "verified" | "probable" | "unverified" | "rejected";
  identityVerifiedBy?: string;
  identityVerifiedAt?: IsoTimestamp;
  sourceIds?: CanonicalId<"source">[];
  capturedAt?: IsoTimestamp;
  locationDisclosure: "none" | "coarse" | "precise_private" | "precise_public";
  status: "active" | "restricted" | "retired";
}
```

Decorative media uses empty alt text in HTML but still has internal description/provenance. Informative alt text states the information or subject, not “image of.” Captions provide context or attribution that is useful beyond the alt text.

## Field evidence

Original evidence links to the field-test record, capture date, conditions, equipment/method where material, and any edit that could affect interpretation. Crops, exposure/color adjustments, composites, and illustrative recreations must not misrepresent evidence. Generated imagery cannot be first-party field evidence or species identification evidence and must be labeled when its realistic appearance could mislead.

## Privacy and safety

- Strip or protect exact coordinates for sensitive species, private land, camps, and hunting locations unless publication is deliberate and safe.
- Obtain releases/consent where recognizable people require them.
- Do not expose licence plates, personal documents, or private property markers unintentionally.
- Preserve an internal original when edits are part of evidence, with access controlled appropriately.

## Delivery

- Produce responsive dimensions and modern formats while retaining a suitable archival source.
- Declare dimensions/aspect ratio to prevent layout shift.
- Do not autoplay audio; video respects reduced-motion and data constraints.
- Captions/transcripts are required for spoken informational video/audio.
- Maps and charts need textual equivalents for material facts.
- Derived assets retain the parent media ID, licence, and attribution.

## Validation

Published media must resolve, declare provenance/licence, satisfy attribution, and include accessibility text where informative. Species media with anything other than verified identity is rejected for species hero/identification use. Expired/revoked/restricted licences remove the asset from public delivery without deleting its audit record.
