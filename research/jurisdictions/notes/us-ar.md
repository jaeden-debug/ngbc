# us-ar — Arkansas (AGFC) — 2026-10-07

## Headline finding
AGFC's published deer, bear and (county-level) turkey zones are maps in the sources I could read. **definition_form = MAP_ONLY_NO_TEXTUAL_DEFINITION** for deer and bear zones. The legal text (AGFC Code of Regulations, https://www.agfc.com/resources/code-of-regulations/, HTTP 200) is a JavaScript library that rendered empty in a headless browser, so any textual zone definitions in the Code are NOT established either way. Pattern for deer is therefore not shown to be county composition; the AGFC polygons cross county lines heavily (56 of 75 counties intersect more than one deer zone; sliver effects not excluded).

## Sources fetched (all 2026-10-07)
- https://www.agfc.com/regulations/guidebooks/ 200; Hunting Guidebook 2026-27 PDF via Drive (anonymous uc?export=download) 200, 15,535,680 bytes, 'HUNTING GUIDEBOOK 2026-27 Arkansas', includes 2027 turkey regs. Deer map pp.10-11, bear map p.28, turkey map p.29 (maps; extracted text shows only labels). Statement p.12: "Each Wildlife Management Area and National Wildlife Refuge is an individual zone."; p.11: "Private land deer zones and chronic wasting disease maps are available at www.agfc.com/deerzones."
- https://www.agfc.com/hunting/deer/deer-seasons-and-limits-by-zone/ 200 (20 zones: 1,2,3,4,4A,5,5A,6,7,8,9,10,11,12,13,14,15,16,16A,17; PNG map 'New-Deer-Zones-Map_300ppi' uploaded 2026/07)
- https://www.agfc.com/hunting/turkey/turkey-dates-rules-regulations/ 200: "Zones follow county lines with the exception of the inside of the Mississippi river levee in Crittenden, Lee, Mississippi, Phillips and St. Francis county." Zones 1, 1A, 2, 2A, 3 with dates.
- https://www.agfc.com/hunting/more-game/bear/ 200; .../deer/chronic-wasting-disease/ 200; .../deer/deer-specific-hunting-regulations/ 200; .../regulations/general-hunting-regulations/ 200; Code page 200 (empty UI); esper host placeholder; wp-json Cloudflare challenge (not bypassed). 404: /en/hunting/big-game/deer/deer-zones/.

## Quoted definitions
TURKEY ZONES (1, 1A, 2, 2A, 3): "Zones follow county lines with the exception of the inside of the Mississippi river levee in Crittenden, Lee, Mississippi, Phillips and St. Francis county. See the current Hunting Guidebook for WMA Zone info." [AGFC web page "Turkey Dates, Rules & Regulations", https://www.agfc.com/hunting/turkey/turkey-dates-rules-regulations/, heading "2027 Private Land Turkey Zones", fetched 2026-10-07; the county membership of each zone is NOT given in text, only on the guidebook Turkey Zone Map p.29]

DEER ZONES (1, 2, 3, 4, 4A, 5, 5A, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 16A, 17): NO TEXTUAL DEFINITION FOUND. AGFC publishes the private-land deer zones only as a map ("2026-27 Deer Zone Map", Hunting Guidebook 2026-27 pp.10-11, labelled with counties, rivers, U.S./state highways and interstates; and a PNG on https://www.agfc.com/hunting/deer/deer-seasons-and-limits-by-zone/). The guidebook states: "Private land deer zones and chronic wasting disease maps are available at www.agfc.com/deerzones." and "Each Wildlife Management Area and National Wildlife Refuge is an individual zone." [Hunting Guidebook 2026-27 pp.10-12]. The legal text (AGFC Code of Regulations, https://www.agfc.com/resources/code-of-regulations/) is a JavaScript policy-library application that did not render in a headless browser, so any legal description of the zones in the Code could not be read.

BEAR ZONES (1, 2, 3, 4, 5, 5A): NO TEXTUAL DEFINITION FOUND; guidebook "Bear Zone Map" p.28 only; web page https://www.agfc.com/hunting/more-game/bear/ gives no zone geography.

CWD MANAGEMENT ZONE: no geographic text read; per-deer-zone notes list counties where CWD regulations apply, e.g. Zone 3: "In Baxter, Boone, Independence, Marion, Sharp and Randolph counties, CWD regulations apply." [https://www.agfc.com/hunting/deer/deer-seasons-and-limits-by-zone/, Deer Zone 3 Zone Notes, 2026-27]

## GIS (AGFC ArcGIS org 5bMc8SlGDYGINZr5 = 'The Arkansas Game and Fish Commission')
- deerZones (item 027befbd69bf433c9199e5a0959001d1, owner Sam.Pike@agfc.ar.gov_AGFC, modified 2025-08-11): 20 features, zone names match 2026-27 list. Description: "This feature layer is intended for educational purposes only and is not for use beyond AGFC's Generation Conservation Summit. Data in this feature layer is accurate as of 2025-08-11." licenseInfo: "...features depicted herein do not represent legal or survey boundaries and are intended for reference purposes only."
- bearZones: 8 features (Zone 1,2,3,4,5,5A,6,7). cwdManagementZones: 1 feature (2025-26, Conway added). AGFC_Deer_Zones: 20 features dated 2020-21 (stale). AGFC_Deer_Management_Units: 6 physiographic DMUs. No turkey-zone layer.
- copyrightText empty on all; positive controls in row. Anonymous, 0.24-0.27 s.

## Rights
Facts: fine with attribution. Live read: possible but the layer carries a use limit and legal-boundary disclaimer. Storing/republishing: not granted.

## Next steps for implementation lane
1. Have a human open the Code of Regulations in a normal browser and capture the deer/bear/turkey zone legal descriptions (or ask AGFC); until then deer/bear geography should be NOT_ESTABLISHED / UNKNOWN, not guessed from county lists.
2. Ask AGFC whether deerZones/bearZones may be used in production and for the 2026-27 edition.
3. Turkey: read zone-county membership from guidebook p.29 and encode as county composition; levee carve-out unresolved.
