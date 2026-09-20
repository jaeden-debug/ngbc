# Integration handoff

## What exists

The dataset establishes canonical-style IDs for every Canadian and U.S. first-order jurisdiction, their principal wildlife authorities, official hunting hubs, initial GIS discovery, a 127-species North American registry, aliases, source-linked Canadian and U.S. species relationships, jurisdiction-specific regulatory-group mappings, identification-risk pairs, range-source leads, seasonal research modules, and editorial readiness decisions.

## What is authoritative

Rows whose source type is `PRIMARY_REGULATORY` or `PRIMARY_DATA` point to government/official sources. That classifies the publisher, not the completeness of extraction. Only evidence with `verification_status=VERIFIED` should be eligible for a production certification workflow; this first pass intentionally contains no `VERIFIED` evidence.

## Content-contract mapping

- IDs already follow the shared `<entity_type>:<key>` convention.
- `species-master.csv` maps to `SpeciesProfile` identity/taxonomy fields.
- `species-aliases.csv` maps to locale/region-aware `EntityAlias` records.
- `regulatory-sources.csv` maps to `SourceRecord`, but `PRIMARY_REGULATORY`/`PRIMARY_DATA` must be adapted to content-contract `type=official` while retaining the richer research classification.
- Evidence rows should remain in the regulatory domain. They must not become editorial claims that answer OPEN/CLOSED.
- `regulatory-group-mappings.csv` is a translation rail, not a shared legal taxonomy. `PARTIAL` and `UNRESOLVED` membership must fail closed.
- Range, behavior, and identification records may enrich editorial resources only through their cited scope and limitations.

## What Hunt can safely ingest now

- Stable proposed jurisdiction and species identifiers after collision review against the finalized contract.
- Authority/source directory records as discovery metadata.
- Official terminology strings.
- Records marked `SOURCE_FOUND` as review-queue inputs, not live legal outcomes.
- The 11 `WRITE_NOW` content opportunities for stable identity/context work; the recommendation excludes regulatory claims.

## What Hunt must not infer

- `DOCUMENTED_HUNTING` does not mean open now or throughout a jurisdiction.
- A hunting hub does not supply a current season until a versioned guide/table is extracted and reviewed.
- Portal/map discovery is not a certified polygon dataset.
- `NOT_FOUND` would not mean closed (none are used as prohibition evidence here).
- Provincial/state rules do not displace federal, local, protected-area, treaty, tribal, or subsistence layers.
- A regulation summary may explicitly state that legislation controls.
- A modeled range does not establish current local presence, access, or a legal season.
- A normalized regulatory group never inherits species membership from another jurisdiction.

## Required production gate

For a rule or spatial layer: capture immutable/versioned source, effective dates, content hash, precise claim/table location, official geometry/schema, licence terms, reviewer identity, review timestamp, and conflicts. Then test representative boundary/date/species queries. Legal advice disclaimers do not cure unsupported data.

## Editorial priorities supported by this inventory

Identity research can begin for white-tailed deer, mule deer, moose, elk/wapiti, American black bear, wild turkey, ruffed grouse, spruce grouse, American woodcock, collared peccary, and snowshoe hare. Caribou, grizzly/brown bear, protected-species confusion pages, scaup/goldeneye/ptarmigan/sage-grouse comparisons, and introduced-game jurisdiction pages require more research. Production articles still need claim-level scientific sourcing and must keep regulation results separate.

## Integration order

1. Collision-check research IDs against the finalized shared content bundle.
2. Import species identity and aliases without legal state.
3. Import sources and evidence as review objects with verification status preserved.
4. Keep regulatory-group mappings jurisdiction-scoped and fail closed on unresolved membership.
5. Treat the content matrix as a planning queue, not published-resource state.
6. Admit rules or geometry only through the production gate above.
