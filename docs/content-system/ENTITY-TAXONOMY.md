# Canonical Entity Taxonomy

## Identity model

A canonical entity ID has the form:

```text
<entity_type>:<key>
```

- `entity_type` is one of the registered types below.
- `key` is lowercase ASCII, begins and ends with an alphanumeric character, and contains only `a-z`, `0-9`, `-`, and `.`.
- Maximum length is 120 characters for the complete ID.
- IDs are immutable, opaque identity handles. A key may be readable, but consumers MUST NOT derive a title, URL, jurisdiction, or business rule from it.
- Locale, publication state, and mutable classification are never encoded as identity.

Valid examples:

```text
species:ruffed-grouse
jurisdiction:ca-qc
management_zone:ca-qc-zone-10
activity:hunting
hunt_type:upland
condition:cold-active
skill:navigation
content_block:ruffed-grouse.cold-active.clothing.01
```

Invalid examples include `Species:Ruffed_Grouse`, a URL, a translated name, and an auto-incremented database key exposed as the canonical ID.

An internal database MAY use UUIDs or numeric keys, but every externally addressable record MUST have one unique canonical ID. A canonical ID MUST NOT be reused after deletion or merge.

## Registered entity classes

| Type | Meaning | Key guidance |
| --- | --- | --- |
| `species` | Taxonomic species or explicitly modeled taxon | stable English-neutral taxon key; scientific-name change does not force an ID change |
| `species_group` | Editorial/taxonomic grouping | group concept, not a legal category unless explicitly related |
| `country` | Sovereign country | ISO 3166-1 alpha-2 lowercase when available |
| `jurisdiction` | Primary rule-making subdivision/authority | country plus official subdivision code where available |
| `management_zone` | Named/numbered management unit in a specific system | authority-scoped key; never a bare zone number |
| `special_territory` | Overlapping reserve, controlled area, municipality, federal district, etc. | authority-scoped key |
| `activity` | Broad outdoor activity | stable concept such as `hunting`, `camping` |
| `hunt_type` | Hunting mode/category that changes field context | generic concept; not a local legal method |
| `method` | Field or legally referenced method | neutral concept with official labels stored separately |
| `condition` | Decision-relevant composite condition | named reusable condition |
| `weather_condition` | Observed/forecast weather phenomenon | provider-neutral term |
| `temperature_band` | Editorial temperature band | thresholds live as explicit data, not in key parsing |
| `clothing_system` | Reusable clothing configuration | purpose/context key |
| `equipment_category` | Category-level equipment concept | singular stable concept |
| `equipment_item` | Reusable item concept, not necessarily a commercial SKU | category-scoped where collision is possible |
| `pack_template` | Contextual reusable packing template | duration/activity context |
| `skill` | Teachable field skill | stable concept |
| `safety_topic` | Hazard or safety decision area | stable concept |
| `regulation_topic` | Editorial index into a rule topic | never contains the rule outcome itself |
| `guide` | Canonical editorial resource | stable subject key |
| `field_test` | A documented first-party test record | immutable test key, normally date plus subject discriminator |
| `tool` | North Ground interactive tool | stable product key |
| `product` | Commercial product/model entity | manufacturer/model identity, not affiliate URL |
| `source` | Source/provenance record | stable authority/document key or generated UUID-style key |
| `content_block` | Atomic application-retrievable editorial unit | owner/context/type plus stable discriminator |

New types require: a precise definition, owning team, collision strategy, expected relationships, lifecycle behavior, and a contract minor/major version review.

## Slugs and URLs

A slug is a presentation locator, not identity. Slugs use lowercase ASCII words separated by hyphens. A resource may have localized slugs and historical aliases. Uniqueness is enforced on `(locale, route family, slug)` and on the resulting canonical URL.

The canonical record stores:

- `canonicalId`
- localized `name`/`title`
- `canonicalUrl` per locale when published
- current `slug` per locale
- previous slug aliases with creation and optional expiry metadata

Changing a title does not change an ID. Changing a slug creates a permanent redirect from every previously published canonical URL. Query strings and fragments are never part of canonical identity.

## Aliases and canonical resolution

Aliases support lookup, not identity replacement. Each alias has:

- normalized alias text or historical ID
- locale when linguistic
- alias type: `common_name`, `scientific_name`, `official_name`, `abbreviation`, `misspelling`, `historical_name`, or `legacy_id`
- target canonical ID
- optional jurisdiction scope
- review state and source when the alias could affect identification or safety

Resolution order is deterministic:

1. exact canonical ID;
2. exact legacy ID alias;
3. normalized alias within supplied type, locale, and jurisdiction;
4. return an explicit ambiguous result if multiple targets remain.

Resolvers MUST NOT silently choose among ambiguous species or zones.

## Localization

- Identity is locale-neutral.
- Human names, descriptions, slugs, official terms, and blocks are locale-bearing values.
- Locale uses BCP 47 (`en-CA`, `fr-CA`). Consumers may negotiate a locale only for editorial output.
- An official French legal term is stored as an official localized value, not generated at request time.
- Missing translations MAY fall back for non-regulatory editorial content when the response declares `resolvedLocale` and `fallbackUsed: true`.
- Regulatory terminology MUST NOT be machine-fallback-translated as if official.

## Rename, merge, split, and deprecation

Rename:

- retain canonical ID;
- update localized display values;
- preserve former names as aliases;
- redirect prior URLs.

Merge:

- select one surviving ID;
- mark other IDs `merged` with `replacedBy`;
- preserve resolvability indefinitely;
- migrate relationships and report conflicts rather than silently deduplicating semantically different edges.

Split:

- deprecate the old broad entity only when its meaning is no longer valid;
- mint new IDs for each distinct concept;
- do not automatically redirect ambiguous old IDs; return `multiple_successors` with choices.

Deprecation:

- states are `active`, `deprecated`, `merged`, and `retired`;
- deprecated entities remain resolvable and describe the replacement or reason;
- retired IDs are never reused;
- published resources pointing at deprecated IDs create validation warnings until deliberately migrated.

## Entity resolution response

```ts
type EntityResolution =
  | { status: "resolved"; id: CanonicalId; via: "id" | "alias"; alias?: string }
  | { status: "ambiguous"; candidates: CanonicalId[] }
  | { status: "multiple_successors"; deprecatedId: CanonicalId; candidates: CanonicalId[] }
  | { status: "not_found" };
```

No resolution result implies legal applicability, geographic presence, or huntability.
