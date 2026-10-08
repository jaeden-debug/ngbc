# us-or Oregon (researched 2026-10-07)

Pattern NAMED_MANAGEMENT_UNITS (+ SPECIES_SPECIFIC_GEOGRAPHY: Eastern Oregon deer hunt areas replace WMUs for deer from 2026). Confidence HIGH on pattern, MEDIUM overall. definition_form BOTH.

## Fetched
- https://myodfw.com/sites/default/files/2025-11/26_BG_regs.pdf (33.6 MB, content verified: 2026 Oregon Big Game Hunting Regulations; text via pypdf).
- https://myodfw.com/articles/eastern-oregon-deer-hunts HTTP 200 (dateModified 2026-05-01).
- ArcGIS org uUvqNMGPm7axC2dD (ODFW): WMU service layer 19 (69 polygons, 0.065 s) and MD_HuntAreas layer 21 (43 polygons).
- OAR (secure.sos.state.or.us): returned only a session page; rule text not retrieved. ODFW's GIS licenseInfo says legal boundary descriptions are in the SOS Administrative Rules Archive.

## Quoted definitions
- "For the purpose of managing Oregon's wildlife, the state has been divided into separate wildlife management units. Unit numbers are identifiable in smaller subunits by the last 2 digits of the number assigned to the rule description." [2026 Big Game Regs p.75]
- Alsea #18, Applegate #28, deer hunt area SE02: full text in the row (`unit_definitions_quoted`), e.g. "Applegate #28: 57% public lands. Beginning at Grants Pass; east and southeast on I-5 to Oregon-California state line; west on state line to US Hwy 199; northeast on US Hwy 199 to Grants Pass, point of beginning."
- "Starting in 2026, Eastern Oregon deer hunts will be structured based on Deer Hunt Areas, not WMUs, to reflect mule deer biology and allow for more accurate monitoring and management."
- "Entire Wildlife Management Unit unless indicated with an asterisk(*). See pages 97-101 for controlled hunt boundary descriptions."

## Findings
- Booklet lists 66 WMUs; service has 69 (adds Warm Spring Indian Reservation #0, Crater Lake NP #1; Evans Creek #29 is in both). 43/43 coded deer hunt areas (AD01..TC02) appear both as prose descriptions and as MD_HuntAreas polygons.
- Licence: WMU item licenseInfo "Boundaries may not be altered without permission of the Oregon Department of Fish and Wildlife. For official legal boundary descriptions see the Oregon Secretary of State Adminsitrative Rules Archive"; layer copyrightText "Oregon Department of Fish and Wildlife"; MD_HuntAreas slots empty. Positive control: same slots non-empty on this and other batch datasets.
- Not examined: controlled-hunt sub-area descriptions (pp.97-101), 100/600-series boundary services, birds/waterfowl/upland/turkey scope, OAR text.

## Next step
Live adapters for both services; parity-check polygons against the prose; resolve controlled-hunt sub-areas; obtain OAR numbers; bird rules separately.
