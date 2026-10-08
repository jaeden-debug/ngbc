# us-me — Maine (MDIFW) — researched 2026-10-07

Authority: Maine Department of Inland Fisheries and Wildlife (MDIFW).

## Sources actually fetched (all HTTP 200, 2026-10-07)
- 2025-26 Summary of Laws and Rules, Hunting (44 pp PDF, 13.7 MB): https://www.maine.gov/ifw/docs/25-MDIFW-5-HUNTING-LAWBOOK-2025-26.pdf — cover: "Information appearing in this book may not be valid after July 2026." Confirmed Maine content (seasons by WMD).
- WMD landing page: https://www.maine.gov/IFW/hunting-trapping/wildlife-management-districts/index.html
- WMD list with per-district PDFs: https://www.maine.gov/ifw/hunting-trapping/wildlife-management-districts/wmd-descriptions.html
- WMD 4 written boundary description (PDF): https://www.maine.gov/ifw/docs/wmd/wmd4_description.pdf
- GIS: https://services1.arcgis.com/RbMX0mRVOFNTdLzd/ArcGIS/rest/services/WMD/FeatureServer (and /0)
- AGOL item: https://www.arcgis.com/sharing/rest/content/items/23d48d9e32294c8d9bf86d52a877b2f2?f=json
- Not usable: https://gis.maine.gov/arcgis/rest/services/ifw/WMD_Harvest_new/MapServer -> {"error":{"code":499,"message":"Token Required"}} (access control; honoured, not used). www.maine.gov/ifw/hunting-trapping/hunting-regulations/index.html is a 404 (guessed path).

## Geographic scope
Maine is divided into 29 numbered Wildlife Management Districts; "For each WMD, the Department made a concerted effort to select clearly recognizable physical boundaries" (WMD page). Almost every season table is keyed by WMD number:
- Deer/bear/moose/turkey: by WMD lists (e.g. muzzleloader extension "12, 13, 15-18, 20-26, 29"; bull-only moose "1- 6, 10, 11, 18, 19, 27, 28"; fall turkey bag 5 in "15-17, 20-25", closed in "1, 2, 4, 5, 9"; spring turkey "7 and 9-29" vs "1-6 and 8"). 2025 either-sex deer "in WMDs 21-25 and 29".
- Sub-unit: "Antlerless-Only 4A (Adaptive Unit Hunt)" - WMD 4A is a subunit; no separate feature in the GIS layer.
- Upland/small game: "All" WMDs (statewide uniform). Crows: "1-6" vs "7-29".
- Migratory waterfowl uses a different geography: North Zone / South Zone / Coastal Zone, defined by lines ("South/Coastal Zone line (Route 1)", "North/South Zone Line Segments Stony Brook to Rte 9 ... Rte 110 to Maine-New Hampshire Border"), drawn over the WMD map (p.35 map). Textual road-line definitions in the lawbook; not a polygon layer in the WMD service.
- Special areas: Baxter State Park "Hunting and trapping are prohibited within the Park"; "Mount Desert Island (MDI) is located within the geographic boundary of WMD 26."; federal refuges/Acadia NP listed.
- Written boundary descriptions control over maps, per the GIS licenseInfo: "Where any discrepancy occur between a mapped feature and the written description, the written description takes precedence."

Pattern: NAMED_MANAGEMENT_UNITS primary; SPECIES_SPECIFIC_GEOGRAPHY (waterfowl zones, moose subsets, 4A) and SPECIAL_AREAS secondary; waterfowl zones TEXTUAL_CARVE_OUT/line-defined. Confidence HIGH for WMDs.

## GIS (real features read)
- FeatureServer/0 "Wildlife Management Districts", polygon, wkid 26919, anonymous HTTP 200 in ~0.1-0.2s. returnCountOnly = 40 features. IDENTIFIER values 0..29 (30 distinct). The 40 features include multipart/island splits: IDENTIFIER 25 appears 11 times (sizes 844, 9, 2, 0, 0, 0, 5, 1, 17, 7 sq mi) and 26 twice (1081, 34). IDENTIFIER 0 (242 sq mi) is not a WMD in the lawbook (29 districts, no WMD 0; wmd0 description PDF returns 404) - meaning NOT_ESTABLISHED (probably non-district residual/offshore). Fields: OBJECTID_1, IDENTIFIER, AREASQMI, MapPDF, DescriptionPDF, edit tracking. No name, no species, no zone-type fields.
- Matches legal scope for WMDs 1-29 (PARTIAL overall: WMD 0 mystery; 4A subunit absent; waterfowl zones absent).
- Owner: AGOL user Jason.Czapiga@maine.gov_maine, bio "Maine Department of Inland Fisheries and Wildlife; ... GIS Coordinator", orgId RbMX0mRVOFNTdLzd = portal "State of Maine" (urlKey maine). Agency staff account in State of Maine org; editors @maine.gov. Provenance acceptable (not a personal non-agency account). Item last modified 2021-05-18; data edit 2022.

## Licence (dataset level, verbatim)
- FeatureServer root copyrightText: "Maine Department of Inland Fisheries and Wildlife"
- Layer 0 copyrightText: "Maine Department of Inland Fisheries and Wildlife"
- Item accessInformation: "Maine Department of Inland Fisheries and Wildlife"
- Item licenseInfo (verbatim, HTML): "These boundaries are for reference purposes only. For precise boundary delineation, please refer to the written boundary description. Boundaries and imagery may not overlay precisely due to digitizing error, differences in projections, and the scale at which these boundaries were drawn. Where any discrepancies occur between a mapped feature and the written description, the written description takes precedence. These data are provided by the Maine Department of Inland Fisheries and Wildlife solely for individual use or the use of a company for the purpose stated in your request for the data. These data may not be distributed or sold to other users without the written permission of the Commissioner of the Department of Inland Fisheries and Wildlife. Boundary lines should not be used for legal purposes."
- This is a STATED restriction (not silence). Positive control: Idaho MapServer copyrightText "CC-BY Idaho Fish and Game" (fetched 2026-10-07).
- Public, anonymous, no token.

## Rights assessment (CLAUDE.md s44)
1. Live read of the public service: no term prohibits automated read-only querying; licence says individual/company use "for the purpose stated in your request" - a rights ambiguity for a public commercial product; do NOT treat as clean.
2. Derived facts (WMD numbers/seasons from the lawbook): permitted with attribution in our reading; lawbook states no reuse term (not examined further; maine.gov policy page fetched 200, no reuse term located in the snippet read - not exhaustive).
3. Archival/redistribution of geometry: PROHIBITED without Commissioner written permission ("may not be distributed or sold to other users"). Storing a mirror would be redistribution -> use live-service adapter only, or obtain written permission. Also "Boundary lines should not be used for legal purposes" => written descriptions are controlling.

## Quoted unit definitions (definition_form = BOTH: textual descriptions plus map)
All 29 WMD written boundary descriptions (fetched 2026-10-07, HTTP 200 each, https://www.maine.gov/ifw/docs/wmd/wmd<N>_description.pdf) are quoted in full in the row key `unit_definitions_quoted` (51 KB). They are road/river/shoreline textual carve-outs, e.g. WMD 26 [Penobscot Bay Area]: "District 26 shall be that portion of the state located within the following bounds: Beginning at the U.S. Route #1 bridge across the Passagassawakeag River in Belfast; then following U.S. Route #1 northerly to State Highway #141 in Belfast; ..." and, same document: "Islands that are served by an automobile causeway, including Verona, Deer Isle/Stonington, and Mount Desert Island are considered part of WMD 26. However, islands surrounding these are considered part of WMD 29. Islands located in the WMD-bordering towns of Franklin, Gouldsboro, Sorrento, Sullivan, and Winter Harbor are part of WMD 27." (explains the multipart IDENTIFIER rows).
Waterfowl (2025-26 lawbook, Migratory Game Birds): "Definition of Coastal Zone Line: Includes areas south of a line beginning at the Maine-New Brunswick border in Calais at the Route 1 bridge, South along Route 1 to the Maine-New Hampshire border in Kittery." and "Definition of North and South Zone Line: Maine-New Brunswick border in Baileyville, Maine west along Stony Brook to Route 9 in Baileyville. West along Route 9 to Route 15 in Bangor. West along Route 15 to I-95 in Bangor. Southwest along I-95 to Route 202 (Exit 109A) in Augusta. Southwest along Route 202 to Route 11 in Auburn. Southwest along Route 11 to Route 110 in Newfield. West along Route 110 to Maine-New Hampshire border."
WMD 4A: used as "WMD 4A"/"zone 4A" in the lawbook with no boundary definition located - NOT_ESTABLISHED.

## Next step
Implement WMD by live FeatureServer/0 query keyed on IDENTIFIER (dissolve parts); exclude/flag IDENTIFIER 0; treat 4A and waterfowl North/South/Coastal zones as separate text-derived (Route 1 / road-line definitions in lawbook pp.35) geometry or UNRESOLVED; ask MDIFW for written permission if storage is wanted. The "Token Required" harvest service must not be used.
