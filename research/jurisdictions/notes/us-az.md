# us-az Arizona (researched 2026-10-07)

Pattern: NAMED_MANAGEMENT_UNITS (GMUs) + TEXTUAL_CARVE_OUT; statewide scope for some species. Confidence LOW overall.

## Fetched
- https://www.azleg.gov/ars/17/00101.htm 200. Def 19: "'Statewide' means all lands except those areas lying within the boundaries of state and federal refuges, parks and monuments, unless specifically provided differently by commission order."
- https://www.azleg.gov/ars/17/00231.htm 200. Commission shall "Establish hunting, trapping and fishing rules".
- ArcGIS REST (anonymous, 200, ~0.2 s): zpemberton FeatureServer (85 feats), rhuettne FeatureServer (80 feats).

## Blocked (not bypassed)
- www.azgfd.com / azgfd.gov (regulations, units): 403 Cloudflare "Just a moment..." challenge.
- apps.azsos.gov / azsos.gov Title 12 PDFs: 403 same.
- https://arcgis.azgfdportal.com/.../HabiMap/GMU/MapServer (official host): curl SSL "certificate has expired". Not retried insecurely.
- Consequently R12-4-108 and the annual regs were never read. Controlling source URL = NOT_ESTABLISHED.

## Findings
- Layer TERMS_COND/licenseInfo state: "See Arizona Game and Fish Commission rule R12-4-108 for legal descriptions of Game Management Unit Boundaries" and that data are reference only. So the legal definition is prose boundary descriptions (roads, rivers, forest lines), per DESCRIPTIO attribute ("Unit 8 -- Beginning at the junction of I-40 and U.S. Hwy 89 ...").
- Both readable GIS copies are owned by personal AGOL accounts (zpemberton no org; rhuettne), the zpemberton one last edited 2013. Disagree: 85 rows with duplicates (12A, 15B, 21), a blank and four "N/A" vs 80 rows. Provenance problem; not authority-hosted.
- data_azgeo (AZGeo state portal) item points to the official AZGFD host, whose cert is expired.
- Licence slots: only the zpemberton copy has non-empty text (attribution + reference-only disclaimer); no redistribution grant. Silence/disclaimer blocks storing geometry, not deriving facts.

## Next step
Obtain R12-4-108 text and the 2026 regs through an unchallenged official route (or ask AZGFD); then decide DERIVED_FROM_DEFINITION vs live official service once cert is fixed. Per-species scope (statewide vs GMU vs hunt number) unestablished.

## Quoted definitions (per moderator update)
- Statewide, A.R.S. 17-101 par. 19: "'Statewide' means all lands except those areas lying within the boundaries of state and federal refuges, parks and monuments, unless specifically provided differently by commission order."
- GMU: NOT_ESTABLISHED. R12-4-108 unreadable (Cloudflare). GIS DESCRIPTIO is truncated at the service's 254-char field limit (Unit 8 ends mid-word at "Volunt"), so it is not the record. definition_form NOT_ESTABLISHED (likely TEXTUAL).
