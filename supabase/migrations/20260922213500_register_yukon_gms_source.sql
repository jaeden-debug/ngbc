-- Register Yukon and the reviewed GeoYukon Game Management Subzone layer.
--
-- Reviewed 2026-09-22 (UTC):
--
--   endpoint   mapservices.gov.yk.ca GeoYukon/GY_AdministrativeBoundaries MapServer layer 7
--   schema     GAME_MGMT_AREA_ID (integer: 417 is subzone 4-17), OBJECTID, GEOMETRY
--   CRS        EPSG:3578 native; EPSG:4326 requested from the authority
--   count      445 records; 443 subzones, matching the count Yukon states, plus two
--              features (102, 103) covering Ivvavik and Vuntut National Parks. The
--              2015 shapefile release holds exactly the 443, and the dataset states
--              subzones cover the Yukon except national parks; Kluane has no feature.
--              Both park features are quarantined pending Environment Yukon
--              (docs/correspondence/2026-09-22-yukon-gms-102-103-query.md).
--   licence    Open Government Licence - Yukon (commercial use and derivatives with attribution)
--   standing   Game Management Subzones are established by maps under the Wildlife Act;
--              the item states this layer is generalized from those legal boundaries.
--
-- The jurisdiction is NEEDS_VERIFICATION: no Yukon rule is certified. First
-- Nations harvesting under Final Agreements is a separate legal context and is
-- not modelled here.

insert into public.regulatory_jurisdictions (
  canonical_id, country_code, subdivision_code, official_name, authority, coverage_status
) values (
  'jurisdiction:ca-yt', 'CA', 'YT', 'Yukon', 'Government of Yukon, Department of Environment', 'NEEDS_VERIFICATION'
)
on conflict (canonical_id) do nothing;

insert into public.regulatory_sources (
  canonical_id, jurisdiction_id, authority, title, source_url, document_identifier,
  retrieved_at, verified_at, source_version, review_status, notes
)
select
  'source:ca-yt-gms-service',
  j.id,
  'Government of Yukon, Department of Environment',
  'Game Management Areas - 250k',
  'https://mapservices.gov.yk.ca/arcgis/rest/services/GeoYukon/GY_AdministrativeBoundaries/MapServer/7',
  'GY_AdministrativeBoundaries/MapServer/7',
  '2026-09-22T21:35:00Z',
  '2026-09-22T21:35:00Z',
  'GY_AdministrativeBoundaries/MapServer/7, read 2026-09-22',
  'VERIFIED',
  'Official but indicative geometry, generalized from the subzone maps established under the Wildlife Act, which '
    || 'control. Open Government Licence - Yukon. 443 subzones; features 102 and 103 cover Ivvavik and Vuntut '
    || 'National Parks and are quarantined pending Environment Yukon.'
from public.regulatory_jurisdictions j
where j.canonical_id = 'jurisdiction:ca-yt'
on conflict (canonical_id) do nothing;
