# us-pa — Pennsylvania Game Commission — researched 2026-10-07

## Sources fetched (all 2026-10-07)
- https://www.pacodeandbulletin.gov/Display/pacode?file=/secure/pacode/data/058/chapter139/s139.17.html — 200. 58 Pa. Code s.139.17 "Wildlife management units"; site "reflects the Pennsylvania Code changes effective through 56 Pa.B. 5370 (August 8, 2026)". Last amended June 9, 2023, 53 Pa.B. 3100.
- .../chapter141/s141.1.html — 200. s.141.1 "Special regulations areas" (amended May 29, 2026, eff. May 30, 2026, 56 Pa.B. 3127).
- .../chapter131/s131.2.html — 200. Definitions (antlered deer by WMU).
- PGC digest 2026-27 PDF (38 MB, 64 pp) 200; https://www.pa.gov/agencies/pgc/huntingandtrapping/wildlife-management-units 200.
- PGC GIS: https://services1.arcgis.com/k8yxvICm95iIFicb/arcgis/rest/services/PGC_Boundaries/FeatureServer/301 (200).

## Findings
- Legal text: "The divisional line between two or more wildlife management units shall be the center of the highway, natural water course or other natural boundary. (b) The outline map of Pennsylvania sets forth wildlife management units." (s.139.17(a)-(b)). The Code points to a MAP and quotes text only for WMU 2C and 2E (verbatim in row `unit_definitions_quoted`).
- The PGC GIS layer 301 carries a `wmu_description` turn-by-turn text for each of the 22 active WMUs (quoted in full in the row), e.g. WMU 1A: "From the Ohio/PA state line, US Rt. 6 east to US Rt. 322 at Conneaut Lake. | US Rt. 322 east to PA Rt. 8 at Franklin. ..." This is authoritative-agency text but is NOT the Code text; status as controlling instrument unestablished.
- Special Regulations Areas are county compositions: Southwest = Allegheny County; Southeast = Bucks, Montgomery, Chester, Delaware, Philadelphia + parks (s.141.1(b)).
- Antlered deer differs by WMU (1A, 1B, 2A, 2B, 2D vs others), matching GIS `wmu_antler_restriction` 'Three Up'.
- Surprise: layer holds 36 records including 14 Inactive historical versions (e.g. 5C has four records); consumers must filter wmu_status='Active'. WMU 3D record note admits a 2008-09 digest error produced overlapping descriptions with 4C/5C (note text truncated by the service at "were det").
- Licence: item licenseInfo requires citing PGC and describing modifications, with warranty disclaimers; no redistribution prohibition and no explicit grant. copyrightText '' (positive control Idaho 'CC-BY Idaho Fish and Game').
- Root FeatureServer metadata call took 6.4 s; layer queries 0.15 s.

## Recommendation
AUTHORITY_GEOMETRY for the 22 active WMUs (org-owned PGC layer), verified against wmu_description and the s.139.17(b) 2C/2E text; ADMINISTRATIVE_COMPOSITION for Special Regulations Areas via TIGERweb counties. Elk/waterfowl geography still to research.
