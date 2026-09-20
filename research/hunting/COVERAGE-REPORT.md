# Hunting research coverage report

Generated from the CSV inventory on 2026-09-20. Counts describe research records, not production support or legal completeness.

## Inventory counts

| Dataset | Count |
| --- | ---: |
| Jurisdictions | 66 |
| Canada jurisdictions (federal + 13 provinces/territories) | 14 |
| U.S. jurisdictions (federal + 50 states + D.C.) | 52 |
| Authorities | 68 |
| Regulatory/scientific sources | 88 |
| GIS source/discovery records | 27 |
| Species entities | 127 |
| Alias records | 48 |
| Species–jurisdiction evidence rows | 156 |
| Species represented in evidence | 36 |
| Jurisdictions represented in evidence | 65 |
| Jurisdiction regulatory-group mappings | 66 |
| Identification-risk records | 15 |
| Species range-source records | 25 |
| Seasonal behavior research modules | 24 |
| Jurisdiction source-completeness rows | 66 |
| Content opportunities assessed | 25 |

## Canada

All 14 requested first-order Canadian records have principal authorities, official terminology, and at least one official regulatory source. Evidence spans all 14 Canadian jurisdiction records (federal plus every province/territory).

Canadian evidence now contains 102 rows across all 14 jurisdiction records, including deeper small-game, grouse, ptarmigan, hare, and pheasant leads. Many of the new rows intentionally remain `NEEDS_REVIEW` until the exact annual table is captured. Across both countries the evidence status is 49 `SOURCE_FOUND`, 100 `NEEDS_REVIEW`, and 7 `STALE`; none is `VERIFIED`. Relationship classification is 113 `DOCUMENTED_HUNTING`, 28 `PERMIT_OR_QUOTA`, and 15 `PARTIAL_OR_SPECIAL`. These counts do not establish open seasons.

Canadian GIS coverage remains discovery-level. Per-jurisdiction classification records 16 official interactive-map-only jurisdictions and one official-PDF-map jurisdiction across North America; 48 jurisdictions still need GIS research and D.C. has no source found. No row is yet classified as a validated machine-readable official layer because service URL, schema, version, and licence checks remain incomplete.

## United States

U.S. federal, all 50 states, and D.C. are inventoried. Every state has a principal agency and official hunting hub/source record. Several current sources were directly confirmed, including the federal migratory-bird framework, the 2026–27 federal refuge rule, Connecticut, Iowa, Oregon, and Utah.

This is authority/source discovery, not regulatory coverage. The inventory now has one official-source evidence lead for every state plus four federal migratory-species rows (54 U.S. rows across 51 jurisdictions). Most state rows remain `NEEDS_REVIEW` because a hub is not a substitute for a versioned annual guide and claim location. D.C. is `UNAVAILABLE` only as a product coverage state: ordinary recreational hunting relevance was not established and must be reviewed; this is not a conclusion that no rule or permit context exists.

## Species

The registry covers 127 North American big-game, introduced-game, upland/game-bird, waterfowl, small-game, furbearer, predator, and protected identification-risk entities. Duck, sea-duck, goose, rail, grouse, quail, and ptarmigan groups retain species-level identities. Regional aliases such as `partridge`, `blue grouse`, `prairie chicken`, `sage grouse`, `bluebill`, and `goldeneye` return ambiguity rather than a silent match.

Taxonomic records point to ITIS as the common authority, but TSN-level verification and taxonomic synonym capture remain open. Twenty-five range-source records favor USGS GAP and Canadian federal sources while explicitly distinguishing modeled range from presence and hunting availability. Fifteen directional identification-risk rows surface high-consequence confusion pairs, including sandhill/whooping crane, harlequin/long-tailed duck, king/Virginia rail, scaup, goldeneye, ptarmigan, and sage-grouse pairs.

## Content readiness

The content matrix assesses 25 species/jurisdiction opportunities: 11 `WRITE_NOW` identity/context angles, 11 `RESEARCH_MORE`, and 3 `WAIT_FOR_HUNT_COVERAGE`. `WRITE_NOW` never authorizes unsourced regulatory prose. Highest-priority research-more items are protected-species confusion and population/status-sensitive pages; highest-priority write-now items are stable identity pages whose range limitations are already explicit.

## Major gaps

1. Claim-level human review and immutable current-source capture for 100 `NEEDS_REVIEW` evidence rows.
2. Current versioned guide/table capture for U.S. states and replacement of seven stale Canadian evidence rows.
3. Machine-readable official GIS service URLs, schemas, versions, and licences; 48 jurisdictions remain `NEEDS_RESEARCH`.
4. Exact regulatory-group membership extraction; most of the 66 jurisdiction mappings are partial or unresolved.
5. Indigenous/treaty/Aboriginal/tribal/subsistence specialist inventory.
6. Federal/state/provincial/local/protected-area overlap modeling.
7. Taxonomic IDs/synonyms, official bilingual-name evidence, and authoritative field-identification media.

## International planning

Ten future candidates are assessed in `global-expansion-candidates.md`. No international jurisdiction is claimed as supported.
