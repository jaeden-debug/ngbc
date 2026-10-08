# us-va — Virginia (Department of Wildlife Resources, VDWR; formerly DGIF)

Researched 2026-10-07. Advisory evidence only.

## Controlling authority and source (fetched)
- Authority: Virginia Department of Wildlife Resources (DWR).
- Source: "Virginia Hunting, Trapping, and Migratory Game Bird Seasons, July 2026 - June 2027" (PDF, 40 pp text-extracted). https://dwr.virginia.gov/wp-content/uploads/media/2026-2027-Virginia-Hunting-Trapping-and-Migratory-Game-Bird-Seasons-Guide.pdf  HTTP 200, fetched 2026-10-07, cover reads "Commonwealth of Virginia ... Department of Wildlife Resources". The guide itself says: "This Publication is Intended as a Guide Only. Full text of hunting and trapping regulations is available at dwr.virginia.gov." (Full Virginia Administrative Code text not fetched.)
- Landing page https://dwr.virginia.gov/hunting/regulations/ HTTP 200 (links the PDF above); https://dwr.virginia.gov/cwd/ HTTP 200 (DMA table); https://dwr.virginia.gov/about/web-policy/ HTTP 200.

## Geographic scope (from the guide)
Seasons are written as lists of counties and independent cities, with textual carve-outs and separate public-land tables. No numbered management units.
- Bear firearms/archery/muzzleloader seasons: "In the counties of Buchanan, Dickenson, Lee, Russell, Scott, Washington, and Wise." (early firearms); other counties listed in groups; "Closed In the counties of Accomack and Northampton."; "In the cities of Chesapeake, Suffolk, and Virginia Beach." (p.8).
- Textual carve-outs by road/river/railroad: "Rockingham (west of Rts. 613 and 731)"; "Campbell (East of Norfolk Southern Railroad)"; "Grayson (East of State Rt. 16)"; "Smyth (East of State Rt. 16 and north of I-81)"; "Suffolk (east of the Dismal Swamp line)" (bear hound and deer tables).
- Deer: separate "FIREARMS DEER HUNTING SEASONS ON PUBLIC LAND" table; "For public lands not included in this table (e.g., county lands that allow hunting), seasons follow those for private lands". Late archery: "In the counties (including the cities and towns within) of Alleghany, Bath, Bland, ... ; On all National Forest and DWR-owned lands west of the Blue Ridge; On the C.F. Phelps WMA; On National Forest lands in Amherst, Bedford, and Nelson counties."
- Earn-A-Buck: county-lists "West of the Blue Ridge" vs "East of the Blue Ridge", with city/town rule; Blue Ridge is a physical divide, not a polygon the guide defines.
- Migratory: I-95 divides (teal "East of I-95 / West of I-95"; resident Canada goose September "East of I-95 and south of the Prince William/Stafford County line"). Duck/goose seasons list "Atlantic Population Zone" and "Resident Population Zone" for Canada goose; the guide text does NOT define those zones in extractable text (probably a map) - NOT_ESTABLISHED.
- CWD: Disease Management Areas by locality (DWR CWD page: DMA 1 Clarke, Frederick, Shenandoah, Warren; DMA 2 Arlington, Culpeper, Fairfax, Fauquier, Loudoun, Madison, Orange, Page, Prince William, Rappahannock, Rockingham; DMA 3 Carroll, Floyd, Franklin, Montgomery, Patrick, Pulaski, Roanoke, Wythe; DMA 4 Bland, Smyth, Tazewell). Mandatory CWD testing day 2026-11-14 in Bland, Grayson, Patrick, Shenandoah, Smyth, Tazewell, Wythe.
- Statewide items exist (youth/apprentice bear weekend "Statewide"; elk rules by county).
- WMAs/ NF: WMA-specific restrictions (bear dogs prohibited on named WMAs).

Pattern: COUNTY_COMPOSITION (counties + independent cities) with TEXTUAL_CARVE_OUT (road/river/railroad subdivisions) and SPECIAL_AREAS (national forest, WMA, DMA overlay); species-specific lists. Confidence HIGH for the pattern.

## GIS (fetched, features read)
Authority-hosted ArcGIS Server https://services.dwr.virginia.gov/arcgis/rest/services (HTTP 200, 3.3 s root, anonymous, no token).
- CWD DMAs: .../CWD_WebApp/Disease_Management_Areas/FeatureServer/0 - 38 polygon features, fields NAME, DMA (1-4); NAME values by locality (Alexandria, Arlington, Carroll, Clarke...). Matches DMA-by-locality language. root copyrightText "", layer copyrightText "".
- Counties/independent cities: .../Public/VA_Counties_Jurisdictions/FeatureServer/0 - 242 features (not 133; includes duplicate/water-split parts - not investigated), layer copyrightText "Virginia Geographic Information Network (VGIN), and the Census and Localities and Towns submitting data to the project".
- WMA boundaries: .../HUB_Layers/DWR_WMA_Boundaries/FeatureServer/0 - 242 features (WMA tracts). Public huntable lands: .../HUB_Layers/DWR_Public_Huntable_Lands/FeatureServer/0 - 126 features with per-species numeric rating fields (BEAR, DEER...) - meaning of codes not established; layer copyrightText "There were several contributors including Department of Conservation and Recreation-Division of Natural Heritage."
- No published polygon layer found for the road/river/railroad subdivisions or for the goose "population zones". The DWR hosts many services (folders listed: CWD_WebApp, Public, HUB_Layers, Projects...) - not exhaustively enumerated.
- Provenance: the DWR AGOL org (qsZIVOgnyrsajEtb, "Virginia Department of Wildlife Resources", urlKey dgif-virginia) owns items under agency accounts (VDGIF, dwr.andrew.slack). Org-owned. The DMA item itself was not located in AGOL (search of org items), so item-level licenseInfo for DMAs is NOT_ESTABLISHED.

## Licence evidence
- DMA FeatureServer root and layer copyrightText: "" and "". Item licenseInfo/accessInformation: not found (item not located).
- Positive control (slots do return terms elsewhere): AGOL item fbd68ab97e8546eba7a8639a49a6f970 "DGIF Regional Boundaries" (VDGIF-owned, public) has licenseInfo "Data Release and Disclaimer Statement ... Data are available by permission of the Virginia Department of Game and Inland Fisheries. Use of data in publications, either digital or hardcopy, must be cited as follows: <dataset name>. <date acquired>. Virginia Department of Game and Inland Fisheries" and accessInformation "Virginia Department of Game and Inland Fisheries, 2013". NOTE: that is a different dataset (regions); it shows the agency does attach terms to some data; it must not be assumed to apply to the DMA layer.
- DWR web policy page: privacy-oriented; nothing on GIS reuse found.
- Verdict: for the DMA/county layers, terms are unstated at layer/root; one sibling agency dataset says "available by permission ... must be cited". Treat redistribution as unconfirmed.

## Base geography
Census TIGERweb State_County MapServer layer 13 "Counties": STATE='51' count 133 (95 counties + 38 independent cities), HTTP 200. Counties/cities named in the guide (e.g. Accomack, Suffolk, Chesapeake, Virginia Beach) are in Virginia's FIPS set (not individually verified). Carve-out sub-areas (Rts. 613/731, Norfolk Southern Railroad, Rt. 16, I-81, Dismal Swamp line) need road/rail geometry from other sources - not established.

## Recommended next step
County/independent-city composition for most seasons is feasible from TIGERweb; carve-outs (about 15-20 distinct textual lines) need a derived-from-definition step or remain unresolved with explicit UNKNOWN. DMAs can be composed from the locality lists on the CWD page. Read the full VAC text (4VAC15-90 etc.) to confirm carve-out wording; not done here.


## Quoted unit definitions (moderator update 1)
TIGERweb check: all county/city names in the lists below match TIGERweb layer 13 (STATE=51, 133 features). PDF text extraction drops "ff"/"fi" ligatures (Stafford->Staford, Suffolk->Sufolk, Chesterfield->Chesterfeld); verify against the PDF. Date-to-list pairing in multi-column tables is not reliable from extraction.

- BEAR early firearms localities: "In the counties of Buchanan, Dickenson, Lee, Russell, Scott, Washington, and Wise. Early" and "In all other counties." [Virginia Hunting, Trapping, and Migratory Game Bird Seasons, July 2026 - June 2027, DWR; Black bear seasons table, text-extracted; dates-to-list pairing in extraction is column-interleaved

- BEAR archery group 1 counties: "In the counties of Accomack, Amelia,, Arlington, Bland, Brunswick, Buchanan, Campbell, Caroline, Carroll, Charles City, Charlotte, Chesterfeld, Craig, Cumberland, Dickenson, Dinwiddie, Essex, Fairfax, Floyd, Fluvanna, Franklin, Giles, Gloucester, Goochland, Grayson, Greensville, Halifax, Hanover, Henrico, Henry, Isle of Wight, James City, King & Queen, King George, King William, Lancaster, Lee, Louisa, Lunenburg, Mathews, Mecklenburg, Middlesex, Montgomery, New Kent, Northampton, Northumberland, Nottoway, Orange, Patrick, Pittsylvania, Powhatan, Prince Edward, Prince George, Prince William, Pulaski, Richmond, Roanoke, Russell, Scott, Smyth, Southampton, Spotsylvania, Staford, Surry, Sussex, Tazewell, Washington, Westmoreland, Wise, Wythe, and York." [Virginia Hunting, Trapping, and Migratory Game Bird Seasons, July 2026 - June 2027, DWR; Black bear seasons table, Archery row (Oct. 3 - Nov. 13); "Staford/Sufolk/Chesterfeld" are ligature-loss artefacts of PDF text extraction (Stafford/Suffolk/Chesterfield)]

- BEAR archery group 1 cities: "In the cities of Chesapeake, Sufolk, and Virginia Beach." [Virginia Hunting, Trapping, and Migratory Game Bird Seasons, July 2026 - June 2027, DWR; Black bear seasons table, Archery row]

- BEAR archery group 2: "In the counties of Albemarle, Alleghany, Amherst, Appomattox, Augusta, Bath, Bedford, Botetourt, Buckingham, Clarke, Culpeper, Fauquier, Frederick, Greene, Highland, Loudoun, Madison, Nelson, Page, Rappahannock, Rockbridge, Rockingham, Shenandoah, and Warren." [Virginia Hunting, Trapping, and Migratory Game Bird Seasons, July 2026 - June 2027, DWR; Black bear seasons table, Archery row (Oct. 17 - Nov. 13 per extraction order; pairing not verified)]

- BEAR firearms group A: "In the counties of Arlington, Bland, Buchanan, Caroline, Charlotte, Chesterfeld, Craig, Dickenson, Fairfax, Fluvanna, Giles, Goochland, Halifax, Hanover, Henrico, Lee, Louisa, Mecklenburg, Montgomery, Orange, Powhatan, Prince Edward, Prince William, Pulaski, Roanoke, Russell, Scott, Smyth, Spotsylvania, Staford, Tazewell, Washington, Wise, and Wythe." [Virginia Hunting, Trapping, and Migratory Game Bird Seasons, July 2026 - June 2027, DWR; Black bear seasons table, Firearms row]

- BEAR firearms group B: "In the counties of Albemarle, Alleghany, Amherst, Appomattox, Augusta, Bath, Bedford, Botetourt, Buckingham, Clarke, Culpeper, Fauquier, Frederick, Greene, Highland, Loudoun, Madison, Nelson, Page, Rappahannock, Rockbridge, Rockingham, Shenandoah, and Warren." [Virginia Hunting, Trapping, and Migratory Game Bird Seasons, July 2026 - June 2027, DWR; Black bear seasons table, Firearms row]

- BEAR firearms group C: "In the counties of Amelia, Brunswick, Campbell, Carroll, Charles City, Cumberland, Dinwiddie, Essex, Floyd, Franklin, Gloucester, Grayson, Greensville, Henry, Isle of Wight, James City, King & Queen, King George, King William, Lancaster, Lunenburg, Mathews, Middlesex, New Kent, Northumberland, Nottoway, Patrick, Pittsylvania, Prince George, Richmond, Southampton, Surry, Sussex, Westmoreland, and York." [Virginia Hunting, Trapping, and Migratory Game Bird Seasons, July 2026 - June 2027, DWR; Black bear seasons table, Firearms row]

- BEAR firearms cities / closed: "In the cities of Chesapeake, Sufolk, and Virginia Beach." || "Closed In the counties of Accomack and Northampton." [Virginia Hunting, Trapping, and Migratory Game Bird Seasons, July 2026 - June 2027, DWR; Black bear seasons table]

- BEAR hound chase carve-outs: "Grayson (East of State Rt. 16), Lee, Montgomery, Pulaski, Roanoke (North of I-81), Russell, Scott, Smyth (East of State Rt. 16 and north of I-81), Tazewell, Washington (North of I-81), Wise, and Wythe and the Cities of Chesapeake (except on Cavalier WMA), Sufolk, and Virginia Beach." and "Campbell (East of Norfolk Southern Railroad)" and "Closed ... Grayson (West of State Rt. 16) ... Roanoke (South of I-81), Smyth (West of State Rt. 16 and south of I-81) ... Washington (South of I-81)" [Virginia Hunting, Trapping, and Migratory Game Bird Seasons, July 2026 - June 2027, DWR; Bear Hound Training/Chase Seasons table, printed p.10]

- BEAR dog prohibition carve-outs: "Campbell (west of Norfolk Southern Railroad), Carroll (east of the New River), Fairfax, Floyd, Franklin, Grayson (east of the New River), Henry, Loudoun, Montgomery (south of I-81), Patrick, Pittsylvania (west of Norfolk Southern Railroad), Pulaski (south of I-81), and Wythe (southeast of the New River or that part bounded by Rt. 21 on the west, I-81 on the north, the county line on the east, the New River on the southeast and Cripple Creek on the south), and in the city of Lynchburg." [Virginia Hunting, Trapping, and Migratory Game Bird Seasons, July 2026 - June 2027, DWR; Black bear notable restrictions, printed p.10; wording assembled from two interleaved columns]

- DEER early antlerless: "County-wide in the counties (including the cities and towns within) of Arlington, Fairfax, Loudoun, Prince William (except on DWR-owned lands), and on private lands only in Bedford, Carroll, Clarke, Culpeper, Fauquier, Floyd, Frederick, Greene, Hanover, Henrico, James City, Madison, Montgomery, Orange, Page, Pulaski, Rappahannock, Shenandoah, Warren, and York." [Virginia Hunting, Trapping, and Migratory Game Bird Seasons, July 2026 - June 2027, DWR; Firearms deer hunting seasons on private land table, printed p.16]

- DEER Buchanan: "In Buchanan County." (Nov. 14 - Dec. 12, antlered deer only) [Virginia Hunting, Trapping, and Migratory Game Bird Seasons, July 2026 - June 2027, DWR; private land table]

- DEER late archery (public/private localities): "In the counties (including the cities and towns within) of Alleghany, Bath, Bland, Buchanan, Dickenson, Highland, Lee, Rockingham (west of Rts 613 and 731), Russell, Scott, Tazewell, and Wise; On all National Forest and DWR-owned lands west of the Blue Ridge; On the C.F. Phelps WMA; On National Forest lands in Amherst, Bedford, and Nelson counties." [Virginia Hunting, Trapping, and Migratory Game Bird Seasons, July 2026 - June 2027, DWR; deer archery table]

- DEER public land: "For public lands not included in this table (e.g., county lands that allow hunting), seasons follow those for private lands (page 16)" [Virginia Hunting, Trapping, and Migratory Game Bird Seasons, July 2026 - June 2027, DWR; Firearms deer hunting seasons on public land table, printed p.17]

- DEER earn-a-buck: "EAB on private lands West of the Blue Ridge in the counties of:" ... "East of the Blue Ridge in the counties of: Accomack, Albemarle, Amherst (west of Rt. 29), Bedford, Chesterfield, Culpeper, Fauquier, Franklin, Greene, Hanover, Henrico, James City, Madison, Orange, Prince George, Rappahannock, Spotsylvania, Stafford, and York" [Virginia Hunting, Trapping, and Migratory Game Bird Seasons, July 2026 - June 2027, DWR; EAB box, printed p.14-15; extraction interleaves columns, so the West list is not cleanly recoverable; East list reconstructed with ligature restoration - verify against PDF]

- SQUIRREL spring: "Hunting in the following designated areas only: counties west of the Blue Ridge and in the counties of Albemarle, Bedford, Culpeper, Fauquier, Franklin, Greene, Henry, Loudoun, Madison, Orange, Patrick, Prince William, and Rappahannock." [Virginia Hunting, Trapping, and Migratory Game Bird Seasons, July 2026 - June 2027, DWR; small-game table, spring squirrel; "Blue Ridge" is not defined by the guide as a polygon]

- CANADA GOOSE September / teal: "East of I-95, Sep. 1 - 18" ... "Hunting will be permitted in all counties and portions of counties lying east of I-95 and south of the Prince William/Stafford County line in Chopawamsic Creek at Quantico Marine Corps Base." || teal "East of I-95: Sep. 19 - 27" / "West of I-95: Sep. 22 - 27" [Virginia Hunting, Trapping, and Migratory Game Bird Seasons, July 2026 - June 2027, DWR; Migratory game bird seasons, printed pp.32-33]

- CANADA GOOSE Atlantic Population Zone / Resident Population Zone: names appear as row labels with no textual boundary definition in the guide; definition_form for this unit family is MAP_ONLY_NO_TEXTUAL_DEFINITION (or defined elsewhere, e.g., VAC - not fetched) [Virginia Hunting, Trapping, and Migratory Game Bird Seasons, July 2026 - June 2027, DWR; Migratory table]

- DMA 1-4: "1 Clarke, Frederick, Shenandoah, Warren" || "2 Arlington, Culpeper, Fairfax, Fauquier, Loudoun, Madison, Orange, Page, Prince William, Rappahannock, Rockingham" || "3 Carroll, Floyd, Franklin, Montgomery, Patrick, Pulaski, Roanoke, Wythe" || "4 Bland, Smyth, Tazewell" [DWR CWD page https://dwr.virginia.gov/cwd/ HTTP 200 2026-10-07, table "DMA / Counties in DMA", 2025-2026 summary]

Licence research for VA is out of scope per update; the licence measurements above are retained as observed.
