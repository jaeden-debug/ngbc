# Data dictionary

All dates are ISO `YYYY-MM-DD`; timestamps are UTC. Empty cells mean unknown/not yet recorded, never "none."

## Shared identifiers

Canonical IDs follow `<entity_type>:<lowercase-key>`. Country codes are ISO 3166-1 alpha-2 uppercase. Canadian subdivision keys use postal abbreviations; U.S. state keys use USPS abbreviations.

## `jurisdictions.csv`

`jurisdiction_id,country_code,subdivision_code,name_en,name_fr,jurisdiction_type,parent_jurisdiction_id,primary_authority_id,official_management_term,coverage_status,notes`

Coverage: `IN_DEVELOPMENT`, `PARTIAL`, `VERIFIED`, `UNAVAILABLE`. Inventory presence alone is not implementation coverage.

## `authorities.csv`

`authority_id,jurisdiction_id,official_name,authority_level,role,official_url,verification_status,retrieved_at,notes`

Roles are pipe-separated and may include `WILDLIFE_REGULATOR`, `MIGRATORY_BIRDS`, `LICENSING`, `GIS_PUBLISHER`, `CO_MANAGEMENT`, and `FEDERAL_LANDS`.

## `regulatory-sources.csv`

`source_id,jurisdiction_id,authority_id,source_title,source_type,format,url,effective_period,retrieved_at,verification_status,topics,notes`

`source_type` uses the hierarchy in `methodology.md`. Topics are pipe-separated discovery labels, not parsed rules.

## `gis-sources.csv`

`gis_source_id,jurisdiction_id,authority_id,zone_system,official_term,source_url,service_url,format,layer_id,coordinate_system,update_frequency,effective_version,licence_terms_url,retrieved_at,verification_status,notes`

An empty `service_url` means only a portal/map was confirmed. `format=PORTAL` must not be treated as a downloadable boundary.

## `species-master.csv`

`species_id,common_name_en,common_name_fr,scientific_name,genus,species,family,order,major_group,taxonomy_source_id,native_status_na,range_summary,verification_status,notes`

French names are included only where recognized official usage was found; blank is safer than invention. `native_status_na` may be `NATIVE`, `INTRODUCED`, `MIXED`, or `NEEDS_REVIEW`.

## `species-aliases.csv`

`alias_id,alias,language,region,species_id,alias_type,ambiguity,candidate_species_ids,source_id,verification_status,notes`

`ambiguity` is `EXACT`, `CONTEXTUAL`, or `AMBIGUOUS`. Ambiguous aliases have no `species_id` and list candidates.

## `species-jurisdiction-evidence.csv`

`evidence_id,species_id,country_code,jurisdiction_id,relationship_status,regulatory_classification,authority_id,official_species_name,official_group_name,source_id,effective_period,retrieved_at,evidence_note,verification_status,notes`

Relationship status: `DOCUMENTED_HUNTING`, `PARTIAL_OR_SPECIAL`, `PERMIT_OR_QUOTA`, `UNCLEAR`, `PROTECTED_OR_CLOSED`, `NOT_FOUND`, `NEEDS_REVIEW`.

## `research-queue.csv`

`queue_id,priority,entity_type,entity_id,jurisdiction_id,task,demand_basis,status,blocked_by,notes`

Demand basis: `MEASURED`, `OBSERVED`, `INFERRED`, `NEEDS_RESEARCH`.
