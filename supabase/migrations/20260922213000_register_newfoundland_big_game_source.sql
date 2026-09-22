-- Register Newfoundland and Labrador and the reviewed Wildlife Division
-- big-game management area service.
--
-- The province manages each big-game species in its own geography, so one
-- source serves three layers: moose, caribou and black bear areas. Reviewed
-- 2026-09-22 (UTC):
--
--   endpoint   services8.arcgis.com/aCyQID5qQcyrJMm2 WLD_BigGameManagementArea
--              FeatureServer, layers 0 (moose), 1 (caribou), 2 (black bear)
--   schema     moose mma/mmu/mma_name; caribou cma/cmu/cma_name; bear bma/name
--   CRS        EPSG:4326 requested from the authority
--   count      moose 112 records = 74 areas (12 areas served as several polygons);
--              caribou 34 = 19; black bear 7 = 7
--   excluded   the records the province itself does not manage as hunting areas:
--              Terra Nova, Gros Morne, Mealy Mountains and Torngat Mountains
--              National Parks, the Nunavut Territory sliver, the two "Not a
--              Labrador Moose Hunting Zone" records, area 000 "Not Applicable"
--              and the eleven polygons of area 099 "Not a Newfoundland Caribou
--              Hunting Zone". None is given an area number.
--   licence    Newfoundland and Labrador Open Government Licence
--   standing   The Wild Life Act and its regulations establish the areas and the
--              seasons and quotas set in them; the layer is the Wildlife
--              Division's digital product of them.
--
-- The jurisdiction is NEEDS_VERIFICATION: registering a boundary source says
-- nothing about whether any Newfoundland and Labrador rule is certified. Big
-- game here is largely licence-by-draw, which is a separate capability.

insert into public.regulatory_jurisdictions (
  canonical_id, country_code, subdivision_code, official_name, authority, coverage_status
) values (
  'jurisdiction:ca-nl', 'CA', 'NL', 'Newfoundland and Labrador',
  'Newfoundland and Labrador Department of Fisheries, Forestry and Agriculture', 'NEEDS_VERIFICATION'
)
on conflict (canonical_id) do nothing;

insert into public.regulatory_sources (
  canonical_id, jurisdiction_id, authority, title, source_url, document_identifier,
  retrieved_at, verified_at, source_version, review_status, notes
)
select
  'source:ca-nl-big-game-area-service',
  j.id,
  'Newfoundland and Labrador Department of Fisheries, Forestry and Agriculture',
  'Big Game Management Areas (moose, caribou, black bear)',
  'https://services8.arcgis.com/aCyQID5qQcyrJMm2/arcgis/rest/services/WLD_BigGameManagementArea/FeatureServer',
  'WLD_BigGameManagementArea',
  '2026-09-22T21:30:00Z',
  '2026-09-22T21:30:00Z',
  'WLD_BigGameManagementArea FeatureServer, read 2026-09-22',
  'VERIFIED',
  'Official but indicative geometry: the Wild Life Act and its regulations control. Newfoundland and Labrador Open '
    || 'Government Licence. Three species-scoped layers from one service: 74 moose areas (112 records), 19 caribou '
    || 'areas (34 records), 7 black bear areas. National parks, the Nunavut sliver and the province''s own "Not '
    || 'Applicable" and "Not a ... Hunting Zone" records are quarantined, never renumbered.'
from public.regulatory_jurisdictions j
where j.canonical_id = 'jurisdiction:ca-nl'
on conflict (canonical_id) do nothing;
