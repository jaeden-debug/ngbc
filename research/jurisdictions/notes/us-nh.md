# us-nh — New Hampshire (NH Fish and Game Department) — researched 2026-10-07

## Sources fetched
- Controlling rule text: NH Code of Administrative Rules, Chapter Fis 300 Wildlife Seasons and Rules (Statutory Authority RSA 208), Part Fis 301 Game Animals: https://www.gencourt.state.nh.us/rules/state_agencies/fis300.html — HTTP 200, 2026-10-07, 1.9 MB. Fis 301.02 source note: "#6250, eff 5-22-96; ... ss by #13211, eff 5-26-21". Bear Table 300.1 covers 2025 and 2026 dates. Also https://www.gencourt.state.nh.us/rsa/html/XVIII/208/208-mrg.htm (200, not analysed).
- Blocked (HTTP 403, Akamai "Access Denied", not bypassed): https://www.wildlife.nh.gov/, .../hunting-nh/hunting-regulations, .../where-hunt/new-hampshire-wildlife-management-units, .../inline-documents/sonh/wmu-map-g.pdf.
- GIS: https://services8.arcgis.com/hg1B9Egwk1I5p300/arcgis/rest/services/WMU/FeatureServer (layers 0-7), item https://www.arcgis.com/sharing/rest/content/items/e15cde961cd64ec5bdfd225907f29796?f=json, portal hg1B9Egwk1I5p300 = "NH Fish and Game Department".

## Scope
Fis 301.02(a): "the state shall be divided into wildlife management units, also referred to as WMUs, described as follows:" - 24 units, each defined by route/river/border text (all 24 verbatim in the row key `unit_definitions_quoted`). Letter-only references include numbered subunits: "WMU-J shall include WMU's J1 and J2"; "WMU H2 shall include H2-north and H2-south". Rules use subsets: archery in A closes December 8; fall shotgun turkey "In wildlife management units D2, H1, H2, I1, J2, K, L, and M"; second turkey "only in wildlife management units H1, H2, J2, K, L, or M"; second bear "only in wildlife management units C1, D2, E, or F"; closed locations Governor's Island (Gilford), Long Island (Moultonborough), "Any waters in lakes or ponds" (Fis 301.03(c)).
Example definition: "(1) Wildlife management unit - A1: From Stewartstown Beecher Falls Bridge in Stewartstown east to Rte. 3 then north on Rte. 3 to the Canadian border ..." [Fis 301.02(a)(1)]. definition_form = BOTH (text plus GIS).

## GIS (real features)
FeatureServer/0 NH_Wildlife_Management_Units: 24 polygons; WMU values A1,A2,B,C1,C2,D1,D2W,D2E,E1,E2,E3,F,G1,G2,H1,H2N,H2S,I1,I2,J1,J2,K,L,M = the same 24 units. Species layers: wmu_deer 20, wmu_moose 22, moose_regions 7, wmu_turkey 18, turkey_regions 6, wmu_bear 18, bear_regions 6 (aggregates, e.g. deer E=E1+E2+E3). Layer 0 description: "If a regulation refers to a letter with no numbers and the map displays the letter with numbers after it, the regulation is referring to all units with that letter." Geometry fidelity to the route text was not tested.
Provenance: item owner user kcallahan (bio: GIS Coordinator at NH Fish and Game), org "NH Fish and Game Department" - agency organisation, not a personal account.

## Licence (verbatim in row)
Root copyrightText "NH Fish and Game Department, Dec. 18, 2025."; layer 0 "NH Fish and Game Department, 2016."; layers 1-7 empty; accessInformation "NH Fish and Game Department, Dec. 18, 2025."; licenseInfo = accuracy disclaimer ("not ... suitable for legal, engineering, or surveying purposes"), no reuse grant or prohibition. Anonymous HTTP 200 (~0.18 s). Positive control: Idaho MapServer copyrightText "CC-BY Idaho Fish and Game". wildlife.nh.gov site terms NOT_ESTABLISHED (403).

## Rights (s44)
Live read of the service: ok (no prohibition). Facts from the rule with attribution: ok. Stored/redistributed geometry: terms unstated -> live adapter, no mirror.

## Next step
Use layer 0 live keyed by WMU; verify polygons against Fis 301.02 text by spot points; resolve species aggregates per rule section; check Governor's/Long Island geometry; confirm Fis 301.02 is current (source note last amended 2021) and read annual season sources.
