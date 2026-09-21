# Canada hunting source reconnaissance

Research snapshot: 2026-09-20

This is a research handoff for the 11 Canadian jurisdictions not owned by the active Ontario and Québec workstreams. It does not certify Hunt coverage, ingest geometry, encode a rule, or grant a licence. The complete source-by-source record, fields, URLs, update strategy, classifications, fixtures, and next actions are in [`research/hunting/canada-source-reconnaissance.json`](../research/hunting/canada-source-reconnaissance.json). Its contract is [`research/hunting/canada-source-reconnaissance.schema.json`](../research/hunting/canada-source-reconnaissance.schema.json).

## National readiness

| Jurisdiction | Management system | Official GIS | Legal standing | Reuse state | Regulation source state | Readiness |
|---|---|---|---|---|---|---|
| British Columbia | 225 Management Units in 9 regions; separate LEH/special overlays | WFS, 225 features | Official but indicative | OGL-BC | Current law, regulations, 2026–28 synopsis and 2026–27 LEH found | `READY_FOR_INGESTION` |
| Alberta | 199 Wildlife Management Units | FeatureServer, 199 features | Official but indicative | OGL-Alberta | Current law/regulation and annual guide/draw hub found | `READY_FOR_INGESTION` |
| Saskatchewan | 83 Wildlife Management Zones/special areas | MapServer, 83 features | Official but indicative | Conflicting: open licence allows commercial reuse, item says “Not for resale” | Current law/regulation path and 2026–27 guide/draw sources found | `LICENCE_BLOCKED` |
| Manitoba | 62 named Game Hunting Areas plus one blank service feature | FeatureServer, 63 features | Official but indicative | Open Manitoba licence | Current law, GHA regulation, seasons regulation and 2026 guide hub found | `READY_FOR_INGESTION` |
| New Brunswick | 27 Wildlife Management Zones; refuges/WMAs separate | FeatureServer, 27 features | Official but indicative | GeoNB ODL | Current law/regulations found; stable summary PDF still identifies 2024–25 | `SOURCE_FOUND_NEEDS_REVIEW` |
| Nova Scotia | 12 Deer Management Zones and 6 Moose Zone values; other species differ | MapServer: 234 deer and 273 moose polygon parts | Official but indicative | No licence attached to item | Current statute/regulations and summary hub found | `LICENCE_BLOCKED` |
| Prince Edward Island | No comprehensive numeric hunting-zone system identified | No comprehensive layer | Unresolved pending legal review | Not applicable until a dataset exists | Current Act and 2026–27 summary found | `SOURCE_FOUND_NEEDS_REVIEW` |
| Newfoundland and Labrador | Separate moose, caribou, black bear and small-game systems for the island and Labrador | Official reference maps only | Reference only | No source-specific open licence | Current law/regulation and 2026–27 guide/boundary pages found | `GIS_BLOCKED` |
| Yukon | 443 stated Game Management Subzones in 11 zones | MapServer, 445 service features | Official but indicative | OGL-Yukon | Current law/regulation, 2026–27 summary and permit source found | `READY_FOR_INGESTION` |
| Northwest Territories | 6 top-level zones plus species areas, outfitter areas and a mobile caribou zone | Static maps plus a dated mobile-zone coordinate download | Reference only for summary maps; authoritative mobile-zone coordinates | Source-specific reuse unresolved | Current law/regulation index and 2026–27 summary found | `GIS_BLOCKED` |
| Nunavut | Species/population/community rules across 3 co-management regions; no universal zone system | Official guide maps only | Reference only | Commercial redistribution restricted without permission | Current Act/regulation hub, 2026–27 guide, Nunavut Agreement and NWMB decisions found | `MULTIPLE_BLOCKERS` |

`READY_FOR_INGESTION` means source discovery is sufficient to begin a reviewed ingestion implementation. It does not mean the jurisdiction is supported or that every overlay has been found.

## Western Canada

### British Columbia

- Authority: Ministry of Water, Land and Resource Stewardship; BC Laws is the legal publication authority.
- GIS: `WAA_WILDLIFE_MGMT_UNITS_SVW` is available through the provincial OpenMaps WFS in native EPSG:3005 and can be requested in EPSG:4326. The verified feature count is 225. The layer exposes the management-unit identifier/name and game-management fields.
- Regulations: the Wildlife Act and Hunting Regulation are the primary law. The 2026–2028 Hunting and Trapping Synopsis and annual Limited Entry Hunting synopsis are official summaries, are complex PDFs, and may be corrected in place.
- Licence: OGL-BC permits commercial use and derivatives with attribution. The geometry remains indicative where enacted descriptions/maps control.
- Complexity: region, MU, LEH hunt/subzone, licence/draw authorization, residency, weapon, animal class, reporting/inspection, vehicle restrictions and special areas.
- Next: snapshot and hash the WFS; model LEH and special restrictions as separately versioned overlays before parsing rules.

### Alberta

- Authority: Alberta Forestry and Parks; Alberta King’s Printer publishes the law.
- GIS: the official `fishwild_wildlife_mgmt_unit_public` FeatureServer exposes 199 polygon features in EPSG:3400 with `WMUNIT_CODE` and `WMUNIT_NAME`.
- Regulations: Wildlife Act and Wildlife Regulation are primary; the annual regulations/draw portal is the operational summary layer.
- Licence: OGL-Alberta permits commercial reuse and derivatives with attribution. Alberta describes the small-scale boundaries as approximations; legal descriptions control.
- Complexity: general versus special licences, draws/priority, residency, partner/non-resident conditions, species, season, weapon, animal class and special areas.
- Next: ingest a versioned WMU snapshot and independently monitor the annual guide, draw booklet and law consolidation.

### Saskatchewan

- Authority: Ministry of Environment; Saskatchewan Publications is the legal source.
- GIS: the official Wildlife Management layer has 83 polygons in EPSG:2957 with `ZONE_NUM` and legislative/name fields. It represents Wildlife Management Zones and special areas but defers to the regulation.
- Regulations: the Act/regulations and the 2026–27 Hunters and Trappers Guide are separate layers; draw material and chronic-wasting-disease orders add conditions.
- Licence: blocked. The government’s Standard Unrestricted Use Data Licence v2.0 permits commercial adaptation and distribution, but the official ArcGIS item says “Not for resale.” Obtain written clarification for this item before production use.
- Complexity: forest/farmland distinctions, WMZ and special areas, draw species, residency, licence, method, animal class, compulsory sampling and changing disease-control areas.
- Next: resolve the licence conflict, then snapshot service metadata and geometry before implementing species-specific overlays.

### Manitoba

- Authority: Manitoba Natural Resources and Indigenous Futures; Manitoba Laws is the legal source.
- GIS: the official hosted `CWD_GHA` FeatureServer layer contains 63 polygon features in EPSG:3857, representing 62 named `GHA` values and one blank value that must be quarantined during ingestion.
- Regulations: the Wildlife Act, Hunting Seasons and Bag Limits Regulation, and Designation of Game Hunting Areas Regulation are primary. The annual guide is the operational summary.
- Licence: Manitoba’s open-information licence permits commercial use, adaptation and distribution with attribution.
- Complexity: GHA, draw/licence type, residency, species, season, method, animal class, conservation closures and disease surveillance.
- Next: confirm the blank feature and preserve a hashed snapshot because the useful GHA layer is embedded in a CWD service rather than a dedicated versioned product.

## Atlantic Canada

### New Brunswick

- Authority: Department of Natural Resources and Energy Development; New Brunswick Laws publishes current law.
- GIS: the official open-data `WMZ` FeatureServer provides 27 polygon features in EPSG:2953 with `WMZ`. Wildlife refuges and Wildlife Management Areas are different layers and must not be treated as WMZs.
- Regulations: the Fish and Wildlife Act, Hunting Regulation and Moose Hunting Regulation are primary. The stable Hunt & Trap PDF still identifies 2024–25 and must not be represented as a current 2026 summary; current draw pages and consolidated law are usable.
- Licence: the GeoNB Open Data Licence permits commercial use and derivatives with attribution.
- Complexity: WMZ, resident/non-resident status, draw/registration, licence, species, weapon, sex/age, refuge/park and Crown/private land.
- Next: confirm the current summary artifact or build only from current consolidated law and official current-year licensing/draw sources.

### Nova Scotia

- Authority: Department of Natural Resources and Renewables; Nova Scotia Justice publishes regulations.
- GIS: the Provincial Landscape Viewer resolves to the official `WLD_ProvLandScapeViewer_WM84` MapServer. Layer 1 has 273 polygon parts across six `Moose_Zone` values; layer 2 has 234 parts across 12 `Deer_Zone` values. These are distinct systems, not one universal layer.
- Regulations: Wildlife Act, species regulations and the official hunting-summary hub must be composed. Annual determinations and ministerial orders can change independently.
- Licence: blocked. The ArcGIS item has no `licenseInfo`; neither the general provincial open licence nor the legacy DNR digital-data licence can safely be assumed to apply.
- Complexity: species-specific geography, deer zone, Cape Breton moose zone, lottery/draw, residency, weapon, animal class, bear restrictions and time-limited orders.
- Next: obtain source-specific commercial/derivative permission and locate any separate bear or annual-order geometries before ingestion.

### Prince Edward Island

- Authority: Department of Environment, Energy and Climate Action.
- GIS: no comprehensive hunting-zone system or matching official vector layer was identified. Wildlife Management Areas are managed lands, not a substitute hunt-zone system.
- Regulations: the Wildlife Conservation Act and current 2026–27 Hunting Summary provide the baseline.
- Licence: no geometry licence question exists until a relevant dataset is identified; named closures still need source-specific review.
- Complexity: mostly province-wide rules plus named/island restrictions, licence and residency, species, method, land/access, youth and migratory-bird dependencies. Private-land permission is a material condition.
- Next: legal review should confirm the no-comprehensive-zone conclusion and enumerate named spatial restrictions; do not invent a numeric unit system.

### Newfoundland and Labrador

- Authority: Department of Fisheries, Forestry and Agriculture; the House of Assembly publishes law.
- GIS: current official boundary pages provide reference maps but no production-usable machine-readable layer was found. The province explicitly calls those maps reference material.
- Regulations: the Wild Life Act/regulations and current 2026–27 guide are separate sources. The guide exposes current boundary and quota information but is not the legal instrument.
- Licence: the general provincial open-data licence is permissive, but the hunting maps were not published as open-data products and carry no source-specific reuse grant.
- Complexity: Newfoundland and Labrador use separate moose, caribou, bear and small-game systems, including Moose Reduction Zones and annual quota/area changes. Labrador Inuit Lands add a distinct permission context.
- Next: request authoritative vectors and reuse terms from the department. Do not digitize the guide maps for production until legal standing and licence are resolved.

## Northern Canada

### Yukon

- Authority: Yukon Department of Environment; Yukon Laws publishes the Act and regulations.
- GIS: GeoYukon’s official `Game Management Areas - 250k` MapServer layer is EPSG:3578 and exposes `GAME_MGMT_AREA_ID`. The service returns 445 features while current official text states 443 Game Management Subzones in 11 zones; this likely reflects geometry parts or duplicate identifiers and must be reconciled.
- Regulations: primary law plus the current 2026–27 hunting summary and Permit Hunt Authorization source.
- Licence: OGL-Yukon permits commercial use and derivatives with attribution. The item says it is generalized from legal boundaries and must not be used for legal purposes.
- Complexity: GMS, permit hunts, residency, non-resident outfitter/guide requirements, species/sex/age, method, special restrictions and First Nation Settlement Land access.
- Next: group and compare unique identifiers against the 443-unit official list, then model Settlement Land and special restrictions as independent overlays.

### Northwest Territories

- Authority: Environment and Climate Change; NWT Justice and the regulation index provide primary law.
- GIS: no complete official vector system was found. The annual guide contains top-level zones and species-area maps. The mobile core Bathurst caribou management zone is a separate dated coordinate artifact that can change in-season and has a stronger legal role than convenience maps.
- Regulations: Wildlife Act, Wildlife Management Zones and Areas Regulations, regional/species regulations and the 2026–27 guide must be composed.
- Licence: the NWT open licence applies to designated spatial/open-data products, but the generic guide and mobile-zone download are not clearly designated. Confirm reuse per source.
- Complexity: six top-level zones, nested species areas, outfitter management areas, changing caribou zones, residency, licence, GHL/status, guide/outfitter, species, sex/age, method and co-management regions.
- Next: request complete vectors and explicit reuse terms. If the mobile zone is implemented, poll it frequently and store immutable effective-dated geometry history.

### Nunavut

- Authority: Government of Nunavut Department of Environment, Nunavut Wildlife Management Board, Regional Wildlife Organizations and Hunters and Trappers Organizations under the Nunavut Agreement.
- GIS: no machine-readable comprehensive hunting-area product was found. The annual guide provides species-specific reference maps, not a universal management-zone layer.
- Regulations: Wildlife Act/regulations, the current 2026–27 guide, Nunavut Agreement and current NWMB/Government decisions form an authority chain. A guide snapshot alone is not sufficient.
- Licence: Government of Nunavut website copyright prohibits multiple-copy commercial redistribution without permission; no separate open licence for hunting geometry was found.
- Complexity: total allowable harvest, allocation, assignment, species/population geography, community decisions, beneficiary/non-beneficiary distinctions, non-resident outfitter/guide conditions and changing NWMB/ministerial decisions.
- Next: extend the data model for TAH/allocation/assignment and authority precedence before rule work; obtain geometry and commercial reuse permission. Do not infer entitlement or force Nunavut into Ontario’s unit model.

## Cross-jurisdiction findings

### Federal dependencies

- Migratory birds require the federal Migratory Birds Regulations, current federal summaries and provincial/territorial composition.
- Parks Canada rules, Species at Risk Act restrictions, federal firearms law, CITES/export requirements and protected federal lands may apply independently.
- Land-claim and treaty frameworks are not recreational-rule flags. North Ground must state that a recreational answer does not determine Aboriginal, treaty, beneficiary or other rights-based harvesting entitlements.

### Licensing risks

- Saskatchewan has a direct conflict between its item note and its open licence.
- Nova Scotia exposes useful official layers without an attached item licence.
- Newfoundland and Labrador and the Northwest Territories have official artifacts that are not clearly designated under their otherwise permissive open-data licences.
- Nunavut’s published website terms prohibit commercial redistribution without written permission.

### GIS risks

- “Government-hosted” does not mean legally controlling. Most available vectors are explicitly indicative or generalized.
- Nova Scotia, Newfoundland and Labrador, the Northwest Territories and Nunavut require multiple species-specific geography types. One `zone_id` namespace is insufficient.
- Yukon’s 445 service features versus 443 stated GMS and Manitoba’s blank GHA feature need deterministic quarantine/reconciliation rules.
- Dynamic areas such as the Bathurst mobile zone require effective instants and historical snapshots, not annual overwrite.

### Regulatory-ingestion risks

- Guides are often summaries, while statute/regulation schedules and orders are controlling and change on a different cadence.
- Complex PDFs, in-place corrections, lotteries/draws, licence products, animal-class predicates and emergency/disease-control orders require source-specific parsers with fail-closed change review.
- Hunting and trapping classifications vary. Furbearers must remain explicitly classified per jurisdiction; a national species label must not silently merge trapping rules into Hunt.

## Recommended implementation order

1. Manitoba: usable official geometry and licence, compact system, and a useful blank-feature/data-quality test.
2. Alberta: clean official WMU service and licence; adds general/special licence and draw architecture.
3. British Columbia: usable official WFS and licence; high-value test of sub-unit LEH overlays and complex documents.
4. Yukon: usable official service and licence after the 445/443 reconciliation; introduces GMS hierarchy, permits, outfitter rules and Settlement Land overlays.
5. New Brunswick: usable GIS/licence after confirming a current summary source or relying on consolidated primary law.
6. Prince Edward Island: legal review of the no-zone model, useful for proving Hunt can support jurisdiction-wide and named-area predicates.
7. Saskatchewan: proceed after written licence resolution.
8. Nova Scotia: proceed after item-specific licence resolution and species-layer completeness review.
9. Newfoundland and Labrador: blocked on vectors and map reuse terms.
10. Northwest Territories: blocked on complete vectors and source-specific reuse; dynamic-zone history also needs architecture.
11. Nunavut: requires geometry/licence work and a deliberate authority/allocation model extension first.

This sequence refines the expected Prairies → BC → Atlantic → Territories wave: Manitoba precedes Alberta for a small, well-bounded first ingestion, and Yukon can move ahead of blocked Atlantic sources once its feature-count discrepancy is resolved.

## Validation and maintenance

Run:

```sh
node scripts/validate-canada-source-reconnaissance.mjs
node --test scripts/validate-canada-source-reconnaissance.test.mjs
python3 research/hunting/validate.py
```

The dedicated validator checks the schema contract, exact 11-jurisdiction set, duplicate jurisdiction/source/GIS IDs, authority URLs, GIS and legal-standing state, licence state, regulation-source state, readiness, blockers and fixture counts. It deliberately does not promote these research candidates into the production coverage registry.
