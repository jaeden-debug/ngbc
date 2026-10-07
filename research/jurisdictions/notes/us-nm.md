# us-nm New Mexico (researched 2026-10-07)

Pattern NAMED_MANAGEMENT_UNITS + NESTED_HIERARCHY. Pattern confidence HIGH, overall MEDIUM. definition_form BOTH (rule text and polygons).

## Fetched (all HTTP 200, 2026-10-07)
- https://www.srca.nm.gov/parts/title19/19.030.0004.html (19.30.4 NMAC, eff. 8/25/2020; the controlling unit definitions)
- https://www.srca.nm.gov/parts/title19/19.031.0003.html, 19.031.0005.html, 19.031.0006.html (big game, upland, migratory)
- https://wildlife.dgf.nm.gov/hunting/maps/big-game-unit-maps-pdfs/ (offers shapefile and KMZ "(October 2017)", stale)
- FeatureServer (org nmdgf, ~0.23 s anonymous): https://services2.arcgis.com/CjbW1bVhK4dB3WOa/arcgis/rest/services/NMDGF_Game_Management_Units_I_E__v2_WFL1/FeatureServer
- Probe trap: 19.031.0004 is sportfishing, not units.

## Quoted definitions
- GMU, 19.30.4.7(E) NMAC: "\"Game management unit\" or GMU as used herein, shall be a geographical subdivision of the state used to manage game species."
- GMU 14, 19.30.4.8 NMAC (8/25/2020): "Beginning at the junction of US 60 and I-25 at Bernardo and running north along I-25 to its intersection with I-40 at Albuquerque, then east along I-40 to its intersection with NM 41 at Moriarty, then south along NM 41 to its junction with US 60 at Willard, then west along US 60 to its junction with I-25."
- GMU 8, 19.30.4.8: "Beginning at the intersection of I-40 and I-25 at Albuquerque and running northeast along I-25 to its junction with NM 14, then south along NM 14 to Santa Fe CR 42, then southeast along the county road to its junction with NM 41 at Galisteo, then south along NM 41 to its intersection with I-40 at Moriarty, then west along I-40 to its intersection with I-25."
- GMU 1, 19.30.4.8(A): "The Ute Mountain Ute Tribe reservation and all contiguous portions of the Navajo Nation reservation north and west of and including section 31, T 17 N, R 13 W."
- GMU 2, 19.30.4.8(B): full text in the row.
- GMU 23 Burro mountain hunt area, 19.30.4.9(A): "That portion of GMU 23 comprised of the Big Burro mountains portion of the Gila national forest and shall include all private land lying within the national forest boundary."
- Statewide, 19.31.5.11(A): "The season for dusky grouse, pheasants, quail and tree squirrels shall be statewide and shall be open September 1 through February 28 annually."
- The remaining ~70 units use the same prose form; not individually re-quoted.

## Findings
- 77 entries in rule; service has 70 polygons, every service value is in the rule; parents 2, 5, 6, 16, 21, 51, 55 appear in the service only as lettered subunits. Geometry vs prose parity untested.
- Licence: root and layer copyrightText empty; accessInformation empty; licenseInfo is a courtesy/no-warranty disclaimer. Positive control: AZ zpemberton service returns non-empty strings in the same slots. No redistribution grant; live-service use, no stored copy.
- Item owner is an agency organisation account (dgf.nm.gov email, orgId CjbW1bVhK4dB3WOa): good provenance.

## Next step
Live adapter to the org service, parity-test against 19.30.4.8, add designated areas (19.30.4.9, "NMDOW Designated Areas" item unread), read annual rules for hunt-code geography.
