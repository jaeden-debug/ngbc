# us-ri — Rhode Island (RI DEM Fish & Wildlife) — researched 2026-10-07

## Sources
- Controlling: Hunting and Trapping Regulations (250-RICR-60-00-9), "ACTIVE RULE", Effective 07/28/2026, RI Department of State Code of Regulations: https://rules.sos.ri.gov/regulations/part/250-60-00-9 — HTTP 200, fetched 2026-10-07. (Also https://rulesstaging.sos.ri.gov/regulations/Part/250-60-00-9 — 200.) Confirmed Rhode Island, Title 250 DEM, Chapter 60 Fish and Wildlife.
- Blocked: https://dem.ri.gov/natural-resources-bureau/fish-wildlife/hunting-and-trapping, https://dem.ri.gov/media/36216/download, .../36221/download -> HTTP 403 (Cloudflare "Just a moment" challenge). Not bypassed; the SOS host serves the same regulation.
- TIGERweb: https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/22 (200).

## Scope and quoted definitions (full set in the row)
s.9.7(B): "Deer Management Zones are defined to recognize and achieve harvest and management strategies for deer in Rhode Island as follows: 1. Zone 1 shall consist of the following towns: a. Barrington; Bristol; Central Falls; Charlestown; Cranston; Cumberland; East Greenwich; East Providence; Jamestown; Johnston; Lincoln; Middletown; Narragansett; Newport; North Kingstown; North Providence; North Smithfield; Pawtucket; Providence; Smithfield; South Kingstown; Warren; Warwick; West Warwick; Westerly; and Woonsocket. 2. Zone 2 shall consist of the following towns: a. Burrillville; Coventry; Exeter; Foster; Glocester; Hopkinton; Little Compton; Portsmouth (excluding Prudence and Patience Islands); Richmond; Scituate; Tiverton; and West Greenwich. 3. Zone 3 shall consist of: a. Patience and Prudence Islands 4. Zone 4 shall consist of: a. New Shoreham (Block Island)".
Zone-dependent rules: seasons (s.9.7(C)-(E)), antlerless bag limits (s.9.7.1: Zone 1 three, Zone 2 two, Zone 3 two, Zone 4 unlimited), Zone 3 archery only (s.9.7.6). Turkey: "Statewide Spring Turkey Season" (s.9.13(A)(3)), no zones. Waterfowl and WMA/cooperative-area rules are named-site rules (s.9.9, s.9.11), not zone polygons.
definition_form = TEXTUAL (municipal list, no map-only dependency found).

Pattern: MUNICIPAL_COMPOSITION (HIGH). Strategy: ADMINISTRATIVE_COMPOSITION from Census towns for Zones 1/2/4; Zone 3 and the Portsmouth exclusion need island geometry.

## Verification against base geography
TIGERweb County Subdivisions (Census 2020), STATE='44': 40 features, 39 named towns. All 26 + 12 = 38 towns in Zones 1 and 2 exist; New Shoreham exists; no named town missing; nothing else unaccounted for. (Cranston etc. spelled identically.)

## Surprising / open
- Zone 3 (Patience and Prudence Islands) is an island carve-out. Zone 2 excludes the islands from Portsmouth only; Zone 1 lists "Warwick" without an exclusion. Whether Patience Island lies in Warwick or Portsmouth is NOT_ESTABLISHED here; do not assume.
- No RI authority polygon service for deer zones found (a DEM "Management / Hunting Area Atlas" web app exists at ridemgis.maps.arcgis.com id f46de937dd034db685fea910b6d774fd; its layers were not read). Licence fields NOT_APPLICABLE_NO_DATASET; no control run because no term claim is made.
- Web search snippets cited the rule as 250-RICR-90-00; the fetched document's number is 250-RICR-60-00-9.

## Next step
Compose zones from TIGERweb towns; source island geometry (named islands) separately and keep Zone 3 UNRESOLVED until geometry is verified; read the DEM atlas web app's service layers to see whether DEM publishes zone or WMA polygons and check their terms.
