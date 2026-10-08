# ca-federal — Canada federal migratory game birds — researched 2026-10-07

**Pattern:** OTHER = federal districts/zones COMPOSED BY REFERENCE to provincial geography (plus a few self-contained textual definitions). Secondary: NAMED_MANAGEMENT_UNITS (by reference), COUNTY_COMPOSITION (Nova Scotia), TEXTUAL_CARVE_OUT (latitude/longitude lines, highways), OVERLAY_CLOSURE (closed areas inside open zones), SPECIAL_AREAS (migratory bird sanctuaries). **Strategy:** NON_POLYGON_RESOLVER / DERIVED_FROM_DEFINITION. Federal zone = f(provincial zone/WMU/county id, plus lat/lon lines) — the resolver must first resolve the provincial unit, then map unit -> federal district by the regulation's own list. The ECCC polygons exist for QC and Atlantic Canada but are "for information purposes only".

## Controlling instrument (fetched 2026-10-07)
- **Migratory Birds Regulations, 2022 (SOR/2022-105)**, `https://laws-lois.justice.gc.ca/eng/regulations/SOR-2022-105/FullText.html` HTTP 200, 495 KB. "Regulations are current to 2026-09-21 and last amended on 2026-06-12." Registered 2022-05-20. **Schedule 3 "Open Seasons, Limits and Special Measures"**, Parts 1-13 (one per province/territory), defines the districts/zones and tables of open seasons by "Area".
- The older Migratory Birds Regulations (C.R.C., c. 1035) page `https://laws-lois.justice.gc.ca/eng/regulations/C.R.C.,_c._1035/` (HTTP 200) says "[Repealed, SOR/2022-105, s. 91]" — **the repo must not cite C.R.C. c.1035**.
- Migratory Bird Sanctuary Regulations C.R.C. c.1036, `.../C.R.C.,_c._1036/FullText.html` HTTP 200, current to 2026-09-21, last amended 2025-03-12: s.3(1) "The areas set out in the schedule are hereby prescribed as migratory bird sanctuaries." and s.3(2) no hunting in a sanctuary. Schedule areas not read in detail (textual).
- CWS provincial summaries (e.g. New Brunswick, HTTP 200): restate zones in plain words and add "To obtain the geospatial data of the hunting zone boundaries, consult ..." the open-data dataset.

## How federal geography composes with provincial (the central question)
Verbatim from Schedule 3 (all in the row):
- **Ontario**: "Central District means the portion of Ontario included in Provincial Wildlife Management Units 42 to 44, 46 to 50, and 53 to 59." and clause 2: references are "to a 'wildlife management unit' ... as referred to in Schedule 1 to Part 6 of Area Descriptions, Ontario Regulation 663/98".
- **Québec**: "District C means the portion of Quebec included in Provincial Hunting Zones 12 to 14 and 16." Districts D/E also cut Provincial Hunting Zones at "longitude 70°00′W" and "the latitude at the Saint-Siméon wharf to Route 381" — i.e. a federal district can split a provincial zone. clause 2: "the Provincial Hunting Zones are the areas described in Quebec's Regulation respecting fishing and hunting areas ... R.S.Q., c. C-61.1".
- **Nova Scotia**: "Zone No. 1 means the counties of Antigonish, Pictou, Colchester, Cumberland, Hants, Kings and Annapolis."
- **New Brunswick**: self-contained textual ("the portion of Saint John County lying south of No. 1 Highway and west of Saint John Harbour ...").
- **Alberta**: Zone No. 1/2 = lists of Provincial Wildlife Management Units (by Schedule 9 of Alta. Reg. 143/1997); **British Columbia**: District No. n = "Provincial Management Units 1-1 to 1-15" (B.C. Reg. 64/96); **Saskatchewan**: District No. 1 (North) = "Provincial Wildlife Management Zones 43 and 47 to 76", No. 2 (South) = the rest incl. "the Saskatoon and Regina-Moose Jaw ... Zones" (W-13.1 Reg 45, RRS); **Manitoba**: Game Bird Hunting Zones 1-3 by latitude/longitude and township lines, Zone 4 = "Provincial Game Hunting Areas 22, 23, 24, 25A ..." (M.R. 220/86); **Yukon**: Southern/Central/Northern Yukon by latitude 62° and 66°N; **Newfoundland and Labrador**: self-contained textual zones (coastal 100 m strips, capes, lines of latitude); **PEI, NT, NU**: "Throughout" (no sub-zones, tables use whole-territory areas — NT and NU tables not read).
So: Alberta, BC, Saskatchewan, Ontario, Québec, Manitoba, NS zones are *functions of the provincial layer* and so inherit its licence/availability; NB, NL, YT and Manitoba Zones 1-3 are pure text (lat/lon, highways, townships).

## GIS
- Environment and Climate Change Canada open-data datasets: "Boundaries of migratory bird hunting districts in Atlantic Canada" (id 83b76283-6444-4455-8f22-67c6ab7524c1, modified 2025-11-10) and "Boundaries of migratory bird hunting district in Quebec" (id bca66b72-06d1-473d-b944-f1f54caabb32, modified 2025-06-17), both licence "Open Government Licence - Canada" (from open.canada.ca CKAN package_show, HTTP 200). Notes verbatim: "These boundaries are presented for information purposes only and have no legal value." Resources: data-donnees.az.ec.gc.ca Data Mart pages (HTTP 200, 2.2 KB shells — direct file links not visible; FGDB mentioned for Québec; the Québec resource URL contains "Draft"). I did NOT download or inspect features. No ECCC polygon dataset located for ON, MB, SK, AB, BC, YT, NT, NU (searches "migratory game bird hunting zones", "...districts", "...Regulations hunting zone" returned only those two ECCC items).
- Provincial polygons exist elsewhere (the other lanes): ON WMU, QC zones, AB WMU, BC MU, SK WMZ, MB GHA.

## Licence
Dataset licence: Open Government Licence - Canada (the licence of both ECCC datasets; licence page `https://open.canada.ca/en/open-government-licence-canada` HTTP 200). Regulation text: federal Justice Laws consolidations. ArcGIS slots not applicable (not ArcGIS). Not examined: the Justice Laws site terms.

## Findings
1. Federal geography is mostly *text over provincial ids*; polygons are not the legal source even where ECCC publishes them.
2. Some federal districts cut across provincial zones (Québec D/E at 70°00′W; Ontario Hudson-James Bay/Northern at 51° latitude, 83°45′ longitude) — a pure id-join is insufficient there; needs lat/lon predicate.
3. Schedule 3 also lists closed areas inside open zones (NB "The Wolves"; QC Cap Tourmente etc.), written in metes and bounds — overlay closures, derived-only.
4. Migratory Bird Sanctuaries are a separate regulation/schedule.
5. Repo's gis-sources row for ca-eccc-atlantic-mgb points to a generic open.canada.ca/data/dataset/ URL — the real dataset ids are above.

## Next step
Implement federal district resolver as unit-id mapping tables transcribed from Schedule 3 with explicit lat/lon predicates; certify against ECCC polygons where available (QC, Atlantic); require provincial layers for AB/BC/SK/ON/MB; model sanctuary overlay from C.R.C. c.1036 schedule (not yet read).
