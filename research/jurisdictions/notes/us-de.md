# us-de — Delaware (DNREC Division of Fish and Wildlife) — researched 2026-10-07

## Sources fetched (HTTP 200 unless stated, 2026-10-07)
- DNREC hunting landing: https://dnrec.delaware.gov/fish-wildlife/hunting/ (links to the guide on eregulations.com, a vendor domain; treated as DNREC's published guide, flagged as third-party hosted).
- Controlling regulation: 7 Del. Admin. Code 3900 Wildlife (25-page official PDF) https://regulations.delaware.gov/api/AdminCode/title7/3900/71d62363-8a70-47e6-b7c8-417230c9a2cc — s.24.0 "Wildlife Management Zone Boundaries", last cite 29 DE Reg. 621 (01/01/26).
- Guide 2026-27 pages (vendor-hosted): https://www.eregulations.com/delaware/hunting/deer-seasons (updated June 25, 2026), .../migratory-bird-seasons-bag-limits (Aug 4, 2026), .../turkey-hunting, .../deer-hunting, .../general-hunting-information.
- WMZ PDF map (1 page, created 2026-06-22): https://www.eregulations.com/assets/docs/resources/DE/DE-Wildlife-Management-Zones-2026.pdf; Teal zone map PDF .../DE-Special-Teal-Zone-Map.pdf (map labels only; teal text caption quoted below).
- CWD addendum: https://documents.dnrec.delaware.gov/fw/Hunting/2026-CWD-Hunting-Guide-Insert.pdf (updated Sept 17, 2026).
- GIS: https://enterprise.firstmap.delaware.gov/arcgis/rest/services/Society/DE_Wildlife/FeatureServer (layers 6, 7), MapServer/6, FeatureServer/info/iteminfo?f=pjson.

## Scope
Seasons are largely "Statewide" (deer archery/crossbow Sept 1-Jan 31, muzzleloader Oct 9-18 & Jan 25-31, general firearm Nov 13-22 & Jan 16-24, special antlerless, youth). Zone-based exceptions: "Handgun and Straight-walled Pistol-caliber Rifle Season closed in Wildlife Management Zones 1A and 1B"; 2026/27 CWD Management Zone "made up of Wildlife Management Zones 11, 14 and 16" (no bait, mandatory check-in); waterfowl Special September Teal Zone; wildlife-area safety zones (GIS layer 5, not read). "Local ordinances may be more restrictive than state laws."

## Quoted definitions
Full text of all 18 zones (1A, 1B, 2-17), teal zone, CMZ and the statewide-season wording is in the row key `unit_definitions_quoted`. Governing text: "For the purposes of hunting and reporting harvests (if required), the following descriptions shall delineate the boundaries of Delaware's Wildlife Management Zones:" then e.g. "Zone 16 - Land bordered north by Route 24, south by Maryland State Line, east by Route 113, and west by Route 13." and "Zone 1A - Land north of the line created beginning at the Delaware Memorial Bridge and following Interstate 295 to its intersection with Interstate 95 to the Delaware/Maryland border." [7 DE Admin Code 3900-24.0]. Teal: "Limited to the designated teal zone south of the C&D Canal to north of Route 9 in Lewes, and east of Routes 13, 113/113A, and 1." (guide). The word "teal" does not occur in 3900 text fetched. Source typos: Zone 11 "Lane bordered", Zone 14 "south by Route 24 ... and south by Route 24" (duplicate direction; GIS DESCRIPTION repeats it).
definition_form = BOTH (textual in code + map PDF + GIS).

## GIS (real features)
FeatureServer/6 "Wildlife Management Zones": returnCountOnly 18; fields OBJECTID, ZONE, DESCRIPTION, Shape__Area, Shape__Length; ZONE 1A,1B,2..17; DESCRIPTION strings identical in words to s.24.0. Layer 7 "Teal Season Hunting Zone": 1 feature. Matches legal scope. Anonymous HTTP 200 ~0.11s. Service is agency-hosted FirstMap enterprise ArcGIS Server 11.3 (no personal-account provenance issue; item owner not exposed).

## Licence (verbatim; full licenseInfo in row)
copyrightText (service and layer 6 and MapServer/6): "Delaware Department of Natural Resources and Environmental Control, Division of Fish and Wildlife". accessInformation same. licenseInfo = warranty disclaimer for "FirstMap Data" only; it names "downloading, modifying, sharing, distributing" only in the liability sentence; no reuse grant or prohibition. Positive control: Idaho MapServer copyrightText "CC-BY Idaho Fish and Game".

## Rights (s44)
Live read OK (public, no term against). Derived facts OK with attribution. Archive/redistribute geometry: terms unstated, no grant -> live adapter only.

## Next step
Implement statewide JURISDICTION_WIDE seasons; resolve WMZ by live FirstMap layer 6 (cross-check count 18 and s.24.0); CMZ = zones 11,14,16 derived; teal zone layer 7. Confirm FirstMap terms and the annual season order. Review small game/furbearer/turkey sections for zone exceptions.
