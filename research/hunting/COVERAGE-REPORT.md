# Hunting research coverage report

Generated from the CSV inventory on 2026-09-20. Counts describe research records, not production support or legal completeness.

## Inventory counts

| Dataset | Count |
| --- | ---: |
| Jurisdictions | 66 |
| Canada jurisdictions (federal + 13 provinces/territories) | 14 |
| U.S. jurisdictions (federal + 50 states + D.C.) | 52 |
| Authorities | 68 |
| Regulatory/scientific sources | 76 |
| GIS source/discovery records | 27 |
| Species entities | 57 |
| Alias records | 27 |
| Species–jurisdiction evidence rows | 68 |
| Species represented in evidence | 26 |
| Jurisdictions represented in evidence | 14 |

## Canada

All 14 requested first-order Canadian records have principal authorities, official terminology, and at least one official regulatory source. Evidence spans all 14 Canadian jurisdiction records (federal plus every province/territory).

Evidence status is intentionally conservative: 41 `SOURCE_FOUND`, 20 `NEEDS_REVIEW`, and 7 `STALE`; none is `VERIFIED`. Relationship classification includes 38 `DOCUMENTED_HUNTING`, 18 `PERMIT_OR_QUOTA`, and 12 `PARTIAL_OR_SPECIAL` records. These counts do not establish open seasons.

Canadian GIS coverage is discovery-level: official maps/portals are inventoried broadly, but only four rows have source relevance confirmed and most lack a certified service URL/schema. British Columbia and New Brunswick need current replacement publications for stale records.

## United States

U.S. federal, all 50 states, and D.C. are inventoried. Every state has a principal agency and official hunting hub/source record. Several current sources were directly confirmed, including the federal migratory-bird framework, the 2026–27 federal refuge rule, Connecticut, Iowa, Oregon, and Utah.

This is authority/source discovery, not regulatory coverage. State species evidence and current versioned guide capture remain the highest-priority gap. D.C. is `UNAVAILABLE` only as a product coverage state: ordinary recreational hunting relevance was not established and must be reviewed; this is not a conclusion that no rule or permit context exists.

## Species

The registry prioritizes North American big game, upland/game birds, waterfowl, small game, and selected predators. Duck, goose, grouse, and ptarmigan groups retain species-level identities. Regional aliases such as `partridge` and historic `blue grouse` return ambiguity rather than a silent match.

Taxonomic records point to ITIS as the common authority, but TSN-level verification and taxonomic synonym capture remain open. French common names are present only where confidently recognized and still need source-level bilingual review.

## Major gaps

1. Claim-level human review and immutable current-source capture for Canada.
2. Machine-readable Canadian GIS service URLs, schemas, effective versions, and licences.
3. Current versioned guide capture and species evidence for all U.S. states.
4. U.S. state management-unit GIS inventory.
5. Indigenous/treaty/Aboriginal/tribal/subsistence specialist inventory.
6. Federal/state/provincial/local/protected-area overlap modeling.
7. Taxonomic IDs/synonyms and official bilingual-name evidence.

## International planning

Ten future candidates are assessed in `global-expansion-candidates.md`. No international jurisdiction is claimed as supported.
