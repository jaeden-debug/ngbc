# us-md — Maryland DNR — researched 2026-10-07

Controlling source: COMAR 08.03.03 (https://regs.maryland.gov/us/md/exec/comar/08.03.03.01 ... .08, all HTTP 200 on 2026-10-07; .09-.12 404). Seasons shown for 2026-2027 and 2027-2028. Host regs.maryland.gov = Maryland Division of State Documents "Library of Maryland Regulations" (the dsd.maryland.gov chapter pages link there).

## Quoted definitions (full text in row `unit_definitions_quoted`)
- Region A: "Deer management region A includes Allegany (Zones 1 and 2), Garrett (Zones 1 and 2), and Washington (Zone 2) counties" [08.03.03.06A(2)(a)]. Region B: Anne Arundel ... Frederick (Zones 1 and 2) ... Washington (Zone 1) ... and Baltimore City [A(2)(b)].
- Zones: e.g. "Allegany County Zone 1 is that portion of Allegany County from the Washington-Allegany county line west to Town Creek"; "Frederick County Zone 1 is all portions of Frederick County except for those in Zone 2" (base minus subunit); Frederick Zone 2 is a long road-by-road line along the Monocacy River, Route 15, I-70 etc. [A(3)(a)-(h)].
- Other species: quail Western/Eastern Zone by Chesapeake Bay and Susquehanna River [.04C]; bear "In Allegany, Frederick, Garrett, and Washington Counties" [.03A]; fall turkey "Allegany, Garrett, and Washington Counties only" [.03E]; many species "In all counties"; migratory birds conform to Interior regulations [.02].

## GIS
No deer-region GIS found. dnr.geodata.md.gov HuntingAtlasRO MapServer (public hunting land/safety zones) returned a server error body on 2026-10-07; MD iMAP county layer exists (copyrightText 'MD iMAP, DoIT, MDP, MDOT, MDOT SHA'). Not needed: TIGERweb counties (24 features incl. Baltimore city) cover all named counties.

## Recommendation
ADMINISTRATIVE_COMPOSITION for region A/B (county names), DERIVED_FROM_DEFINITION for the 8 sub-zones (route/creek/river text; needs road and hydro base geography with licence review), JURISDICTION_WIDE for "In all counties" seasons. HIGH confidence in scope; geometric derivation of Frederick Zone 2 is the hard part.
