# us-nv Nevada (researched 2026-10-07)

Pattern NAMED_MANAGEMENT_UNITS + SPECIES_SPECIFIC_GEOGRAPHY (+ county splits, ranch buffers, closed areas). Pattern MEDIUM, overall MEDIUM. definition_form NOT_ESTABLISHED for boundaries (unit numbers appear in instrument; boundary text unread).

## Fetched
- https://www.ndow.org/wp-content/uploads/2026/08/CR-26-11-2026-2027-Big-Game-Quota-NBWC-Approved-May-2026.pdf HTTP 200 (489146 bytes, 33 pp, "COMMISSION REGULATION 26-11 ... Adopted May 9, 2026").
- https://www.ndow.org/get-outside/hunting/, /rules-regulations/, /plan-your-hunt/ HTTP 200.
- https://services.arcgis.com/RyxlXSfFi87rAosq/arcgis/rest/services/NDOW_Hunt_Units/FeatureServer (200, 0.25 s) and .../NDOWGameMgmtUnits/FeatureServer (200, 0.19 s). Org RyxlXSfFi87rAosq = "Nevada Department of Wildlife".
- 2025 small-game PDF URL returned HTML, not usable.
- leg.state.nv.us NAC-502/503 (4 URL variants): HTTP 403 Cloudflare "Attention Required!". Not bypassed. NAC text defining unit boundaries therefore not read.

## Quoted language (CR 26-11)
- "Unit Group 2026-2027 Season 2026 Approved Quota" rows e.g. "012 - 014 Aug 22 - Sept 7 54", "021, 022 Aug 22 - Sept 7 56" [Resident Antelope, Any Legal Weapon Hunt 2151].
- "That portion of Unit 144 in Eureka County." / "That portion of Unit 144 in White Pine County." [footnotes A, B].
- "Within 1 mile of Great Basin Ranch properties in Hunt Unit 115." [footnote C]. Elk footnotes: "Within 2 miles of Great Basin Ranch Properties".
- Letters before numbers (A065, B101) are footnote keys.
- Citations to "NAC 502.361" and "NAC 502.006" appear; boundaries are not in this instrument.

## GIS (NDOW, org-owned)
- NDOW_Hunt_Units: 129 polygons; 124 open three-digit units + 5 closed (Sheldon NWR, Death Valley NP, Nellis AFR/Test Site, Great Basin NP, Indian Springs AFAF); edited 2024-02-06. 121 of 124 unit numbers occur in CR 26-11 (not: 172, 252, 269).
- NDOWGameMgmtUnits: 129 polygons, fields MANAGEUNIT, SYMBOL, CLOSED, HUNTUNIT, Bear, Sheep, Deer, Elk, Lion, Antelope, Goat; e.g. HUNTUNIT 291: Bear "Lackey", Deer "Lackey", Antelope "Salisbury" (species-specific management area names; meaning unexplained).
- Licence: Hunt_Units licenseInfo: "This data is considered public information and is available for download without restrictions. No warranty is made by the Nevada Department of Wildlife as to the accuracy, reliability, or completeness of the data provided for individual use or aggregate use with other data." Layer copyrightText: "Nevada Department of Wildlife \nData and Technology Services\nGIS Analyst Alex Dierker\n2022". GameMgmtUnits item: only a no-warranty sentence. Positive control: same slots non-empty on these items.

## Next step
Get NAC unit text via an unchallenged route or NDOW; read hunt-unit/management-area definitions and small game/waterfowl scope; confirm with NDOW the storage permission before copying geometry; live adapter meanwhile.
