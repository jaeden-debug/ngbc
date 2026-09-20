# Integration handoff

## What exists

The dataset establishes canonical-style IDs for every Canadian and U.S. first-order jurisdiction, their principal wildlife authorities, official hunting hubs, a Canadian regulatory-source foundation, initial GIS discovery, a high-priority North American species registry, aliases, and source-linked Canadian species relationships.

## What is authoritative

Rows whose source type is `PRIMARY_REGULATORY` or `PRIMARY_DATA` point to government/official sources. That classifies the publisher, not the completeness of extraction. Only evidence with `verification_status=VERIFIED` should be eligible for a production certification workflow; this first pass intentionally contains no `VERIFIED` evidence.

## Content-contract mapping

- IDs already follow the shared `<entity_type>:<key>` convention.
- `species-master.csv` maps to `SpeciesProfile` identity/taxonomy fields.
- `species-aliases.csv` maps to locale/region-aware `EntityAlias` records.
- `regulatory-sources.csv` maps to `SourceRecord`, but `PRIMARY_REGULATORY`/`PRIMARY_DATA` must be adapted to content-contract `type=official` while retaining the richer research classification.
- Evidence rows should remain in the regulatory domain. They must not become editorial claims that answer OPEN/CLOSED.

## What Hunt can safely ingest now

- Stable proposed jurisdiction and species identifiers after collision review against the finalized contract.
- Authority/source directory records as discovery metadata.
- Official terminology strings.
- Records marked `SOURCE_FOUND` as review-queue inputs, not live legal outcomes.

## What Hunt must not infer

- `DOCUMENTED_HUNTING` does not mean open now or throughout a jurisdiction.
- A hunting hub does not supply a current season until a versioned guide/table is extracted and reviewed.
- Portal/map discovery is not a certified polygon dataset.
- `NOT_FOUND` would not mean closed (none are used as prohibition evidence here).
- Provincial/state rules do not displace federal, local, protected-area, treaty, tribal, or subsistence layers.
- A regulation summary may explicitly state that legislation controls.

## Required production gate

For a rule or spatial layer: capture immutable/versioned source, effective dates, content hash, precise claim/table location, official geometry/schema, licence terms, reviewer identity, review timestamp, and conflicts. Then test representative boundary/date/species queries. Legal advice disclaimers do not cure unsupported data.

## Editorial priorities supported by this inventory

Identity research can begin for white-tailed deer, mule deer, moose, elk/wapiti, caribou, American black bear, wild turkey, ruffed grouse, spruce grouse, sharp-tailed grouse, ptarmigan species, ring-necked pheasant, snowshoe hare, core duck species, and core goose species. Production articles still need claim-level scientific sourcing and must keep regulation results separate.
