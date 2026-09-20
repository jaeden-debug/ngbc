# Relationship Contract

North Ground uses typed relational edges. A graph database is not required; a relational table or normalized file export is sufficient.

## Edge shape

```ts
interface Relationship {
  id: string;
  fromId: CanonicalId;
  toId: CanonicalId;
  type: RelationshipType;
  direction: "directed" | "symmetric";
  origin: "manual" | "derived";
  weight?: number; // 0..100, editorial ordering only
  locale?: Bcp47Locale;
  validFrom?: IsoDate;
  validThrough?: IsoDate;
  sourceIds?: CanonicalId<"source">[];
  derivation?: { rule: string; inputs: string[]; generatedAt: IsoTimestamp };
  status: "active" | "deprecated";
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}
```

Edges are unique on `(fromId, type, toId, locale, validity interval)` unless parallel edges have materially different sourced meanings. `weight` never represents scientific certainty or legal authority.

## Registered relationship types

| Type | From → to | Reciprocal traversal |
| --- | --- | --- |
| `member_of` | species → species group; zone → jurisdiction | `has_member` derived view |
| `occurs_in` | species → jurisdiction/zone | no huntability implication |
| `has_hunting_context_in` | species → jurisdiction | documented context only, not open season |
| `covered_by` | entity/resource → guide/reference | `covers` derived view |
| `has_guide` | species/activity/tool → guide | `guide_for` derived view |
| `has_field_test` | species/product/condition → field test | `tests` derived view |
| `relevant_to` | tool/resource → entity/resource | symmetric only when declared |
| `uses_skill` | guide/activity/hunt type → skill | `used_by` derived view |
| `applies_in_condition` | guide/system/template → condition | condition relevance |
| `uses_clothing_system` | activity/hunt type/guide → clothing system | recommendation context required |
| `uses_pack_template` | activity/hunt type/guide → pack template | recommendation context required |
| `includes_equipment` | pack template/clothing system → equipment item/category | structured component |
| `recommends_category` | guide/species/hunt type → equipment category | not a product endorsement |
| `evaluates_product` | field test → product | evidence link required |
| `has_regulatory_resource` | jurisdiction/zone/species → official source/reference | source-backed |
| `similar_to` | species → species | symmetric, identification context |
| `canonical_parent` | resource/entity → resource/entity | at most one active parent per locale |
| `supersedes` | resource/block/source → previous record | directed, acyclic |
| `translated_version_of` | localized resource → locale-neutral resource identity when separate records exist | symmetric view allowed |

New relationship types require declared endpoint types, direction, semantics, source requirements, and whether reciprocal traversal is safe.

## Manual and derived edges

- Manual edges are editorial decisions and remain until explicitly changed.
- Derived edges identify their rule and input revisions and are reproducible.
- Rebuilding derived edges MUST NOT delete or overwrite manual edges.
- A derived relationship cannot upgrade a claim to `verified` or establish legality.
- Materialized reciprocal edges are optional; APIs may derive them at read time.

## Validity and locale

Validity intervals are required when the relationship changes over time. Date-specific callers only receive edges active on that date. Locale is absent for locale-neutral relationships and present when editorial relevance or the linked resource exists only in a locale.

## Required examples

- species → guides: `has_guide`
- species → field tests: `has_field_test`
- species → jurisdictions: `occurs_in` or `has_hunting_context_in`, never an ambiguous generic edge
- species → equipment: `recommends_category` with applicability/context
- guide → skills: `uses_skill`
- guide → conditions: `applies_in_condition`
- condition → clothing system: inverse traversal of `applies_in_condition` or a deliberate `relevant_to`
- hunt type → packing template: `uses_pack_template`
- jurisdiction → regulatory resources: `has_regulatory_resource`
- field test → products: `evaluates_product`
- tool → relevant guides: `has_guide`

## Integrity rules

Validation rejects or warns on:

- missing endpoints;
- endpoint types not allowed for the relationship;
- duplicate active edges;
- invalid intervals;
- cycles in `canonical_parent`, `supersedes`, or replacement chains;
- more than one canonical parent for a locale;
- official/regulatory edges without source provenance;
- `evaluates_product` without a field-test origin;
- relationships to retired entities without an explicit historical purpose.

Deletion is normally soft. Removing an entity requires resolving inbound edges; no dangling references are allowed in a published bundle.

## Query behavior

Relationship queries specify direction, types, locale, date, limit, and whether derived edges are accepted. Defaults return active manual and derived edges but label their origin. Traversal depth defaults to one. Public page assembly MUST NOT recursively walk arbitrary relationships; the internal-linking policy selects a small semantically justified subset.
