# us-sc - South Carolina (SCDNR)

Researched 2026-10-07.

## Fetched (HTTP status)
- https://www.dnr.sc.gov/regs/pdf/Regs2627.pdf 200 (124 pp, South Carolina, valid Aug 14 2026 - Aug 14 2027)
- https://www.dnr.sc.gov/hunting/zones/index.html 200
- https://www.dnr.sc.gov/regulations.html 200 (linked the guide)
- https://www.scstatehouse.gov/code/t50c011.php 200 (also t50c001, t50c009, t50c013)
- https://services.arcgis.com/acgZYxoN5Oj8pDLa/arcgis/rest/services/South_Carolina_Game_Zones/FeatureServer 200
- https://www.dnr.sc.gov/admin/privacypolicy.html 200; /hunting/ and /gis/ 403; /admin/copyright.html 404
- TIGERweb State_County layer 13 STATE=45: 46 counties

## Finding
Game zones are defined in the authority's own words (not only a map): Zones 2-4 = county lists; Zone 1 = north of a railroad/highway line across parts of Oconee, Pickens, Greenville. A matching 4-polygon SCDNR layer exists and agrees at 11 test points.

## Quoted unit definitions
- GAME ZONE 1: "All properties north of the main line of the Norfolk Southern Railroad from the Georgia State line to South Carolina Hwy 183 in Westminster, then north of SC Hwy 183 to intersection of SC Hwy 183 and the Norfolk So. Railroad main line in Greenville and then north of the mainline of the Norfolk So. Railroad to the Spartanburg County line. Includes portions of Oconee, Pickens and Greenville counties." [SCDNR "Game Zones 1 - 4" web page https://www.dnr.sc.gov/hunting/zones/index.html, HTTP 200 fetched 2026-10-07] (same railroad text in guide, "Game Zone 1 WMAs Only", PDF p.96)
- GAME ZONE 2: "Includes all lands of Abbeville, Anderson, Cherokee, Chester, Edgefield, Fairfield, Greenwood, Lancaster, Laurens, McCormick, Newberry, Saluda, Spartanburg, Union and York counties and partial areas of Oconee, Pickens and Greenville counties." [SCDNR "Game Zones 1 - 4" web page https://www.dnr.sc.gov/hunting/zones/index.html, HTTP 200 fetched 2026-10-07]; guide WMA version: "those portions of the counties of Greenville, Oconee & Pickens south of the Game Zone 1 line" [guide "Game Zone 2 WMAs Only", PDF p.99]
- GAME ZONE 3: "Includes all lands of Aiken, Allendale, Bamberg, Barnwell, Beaufort, Berkeley, Calhoun, Charleston, Colleton, Dorchester, Hampton, Jasper, Lexington, Orangeburg and Richland counties." [SCDNR "Game Zones 1 - 4" web page https://www.dnr.sc.gov/hunting/zones/index.html, HTTP 200 fetched 2026-10-07]
- GAME ZONE 4: "Includes all lands of Chesterfield, Clarendon, Darlington, Dillon, Florence, Georgetown, Horry, Kershaw, Lee, Marion, Marlboro, Sumter and Williamsburg counties." [SCDNR "Game Zones 1 - 4" web page https://www.dnr.sc.gov/hunting/zones/index.html, HTTP 200 fetched 2026-10-07]
- GAME ZONES overall: "South Carolina is divided into four game zones, as defined by the map below. South Carolina hunting seasons, methods of harvest and limits are established by the SC General Assembly at the Game Zone level." [SCDNR "Game Zones 1 - 4" web page https://www.dnr.sc.gov/hunting/zones/index.html, HTTP 200 fetched 2026-10-07]; guide: "South Carolina is divided into four game zones, as defined on the maps on page 60." [2026-2027 South Carolina Hunting & Fishing Laws and Regulations Guide (valid Aug. 14, 2026 - Aug. 14, 2027), SCDNR, Game Zones & WMAs, PDF p.62]
- BEAR Game Zone 2 (species-specific): "(Private land only in Greenville, Oconee, and Pickens counties south of Game Zone 1 and all of Anderson and Spartanburg counties.)" [2026-2027 South Carolina Hunting & Fishing Laws and Regulations Guide (valid Aug. 14, 2026 - Aug. 14, 2027), SCDNR, Bear Seasons on Private Lands, PDF p.~72]
- BEAR Game Zone 4 (species-specific): "(Florence, Georgetown, Horry, Marion, and Williamsburg counties only)" [2026-2027 South Carolina Hunting & Fishing Laws and Regulations Guide (valid Aug. 14, 2026 - Aug. 14, 2027), SCDNR, Bear Seasons on Private Lands]
- BEAR Game Zone 1: "Still Hunt (No Dogs): Oct. 11-23" and "Dog Hunts: Oct. 17-30" (no separate geography beyond Game Zone 1) [2026-2027 South Carolina Hunting & Fishing Laws and Regulations Guide (valid Aug. 14, 2026 - Aug. 14, 2027), SCDNR, Bear Seasons on Private Lands]
- GAME ZONE 3 for bear: no season stated in the guide bear private-land text for Zone 3 (Zones 2 and 4 quotas); SC Code 50-11-430(A)(2),(B): "In all other game zones ... The department may establish a bear management program" - zone 3 bear status NOT_ESTABLISHED here [https://www.scstatehouse.gov/code/t50c011.php HTTP 200]
- REGIONAL OFFICE county groupings (not hunting units): Region 1 Clemson "Oconee, Pickens, Greenville, Spartanburg, Anderson, Laurens, Abbeville, Greenwood, Union, Cherokee, McCormick, Edgefield counties" etc. [2026-2027 South Carolina Hunting & Fishing Laws and Regulations Guide (valid Aug. 14, 2026 - Aug. 14, 2027), SCDNR, PDF p.~5] - noted only to distinguish from game zones
- STATUTE: S.C. Code 50-11-... seasons (e.g. antlered deer) are written "In Game Zone 1: October 1 through October 10 ..." with zones undefined in Title 50 ch.11; no game-zone boundary text found in chapters 1, 9, 11, 13 [scstatehouse.gov/code, HTTP 200 each]

## GIS and licence
Item 3990da02e15941fab700211ef10b8f69 owner DavisJH_scdnr in org acgZYxoN5Oj8pDLa (South Carolina Department of Natural Resources). FeatureServer root copyrightText "", layer copyrightText "". Item licenseInfo (verbatim, HTML as stored): <span style='color:rgb(63, 74, 34); font-family:&quot;Avenir Next W01&quot;, &quot;Avenir Next W00&quot;, &quot;Avenir Next&quot;, Avenir, &quot;Helvetica Neue&quot;, sans-serif; font-size:16px;'>The S.C. Department of Natural Resources makes no representation or warranty as to its accuracy, and in particular, its accuracy as to labeling, dimensions, boundaries, or placement or location of any map features thereon. The S.C. Department of Natural Resources makes NO Warranty of merchantability or Warranty for fitness of use for a particular purpose, express or implied, with respect to this map product. Any user of this map product accepts the same as IS, with ALL FAULTS, and assumes all responsibility for the use thereof, and further covenants and agrees to hold the S.C. Department of Natural Resources harmless from and against any damage, loss, or liability arising from any use of the map product.</span>

accessInformation: SCDNR

Positive control: the licenseInfo slot above is itself non-empty; Idaho control and TIGERweb string recorded in the row.

## Recommended next step
Use the SCDNR layer via live read for Zone resolution; cross-check zones 2-4 with TIGERweb; consider zone 1 line as derived-from-definition backup. Resolve Zone 3 bear status separately.
