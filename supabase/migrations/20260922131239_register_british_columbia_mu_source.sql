-- Register British Columbia and the reviewed Government of British Columbia
-- Management Unit layer.
--
-- Registration is a reviewed act, recorded here. The source passed endpoint,
-- schema, coordinate-system, count, licence and legal-standing review on
-- 2026-09-22 (UTC):
--
--   endpoint   openmaps.gov.bc.ca WFS, pub:WHSE_WILDLIFE_MANAGEMENT.WAA_WILDLIFE_MGMT_UNITS_SVW
--   schema     WILDLIFE_MGMT_UNIT_ID, REGION_RESPONSIBLE_ID/_NAME, GAME_MANAGEMENT_ZONE_ID/_NAME,
--              FEATURE_CODE, FEATURE_AREA_SQM, FEATURE_LENGTH_M, OBJECTID, GEOMETRY
--   CRS        EPSG:3005 native; EPSG:4326 requested from the authority
--   count      225 records = 225 Management Units, one record each, none blank
--   inventory  B.C. Reg. 64/96 s. 1 ("divided into 225 management units"); the BC Data
--              Catalogue record (225 units in nine regions); the 2026-2028 Hunting and
--              Trapping Regulations Synopsis names exactly these 225 and no other unit
--   licence    Open Government Licence - British Columbia (commercial use and
--              adaptation allowed, attribution required)
--   standing   B.C. Reg. 64/96: units are "shown with their boundaries delineated in heavy
--              black dashed lines on the attached maps" (2026 regional maps enacted by
--              B.C. Reg. 89/2026, 2026-05-25). A river boundary follows the right-hand bank,
--              or the left-hand bank for the West Road (Blackwater), Liard and Peace rivers.
--              The enacted maps prevail; this layer is the province's digital product.
--
-- The jurisdiction is NEEDS_VERIFICATION: registering a boundary source says
-- nothing about whether any British Columbia rule is certified.

insert into public.regulatory_jurisdictions (
  canonical_id, country_code, subdivision_code, official_name, authority, coverage_status
) values (
  'jurisdiction:ca-bc', 'CA', 'BC', 'British Columbia', 'Government of British Columbia', 'NEEDS_VERIFICATION'
)
on conflict (canonical_id) do nothing;

insert into public.regulatory_sources (
  canonical_id, jurisdiction_id, authority, title, source_url, document_identifier,
  retrieved_at, verified_at, source_version, review_status, notes
)
select
  'source:ca-bc-mu-service',
  j.id,
  'Government of British Columbia',
  'Wildlife Management Units (WAA_WILDLIFE_MGMT_UNITS_SVW)',
  'https://openmaps.gov.bc.ca/geo/pub/WHSE_WILDLIFE_MANAGEMENT.WAA_WILDLIFE_MGMT_UNITS_SVW/ows',
  'pub:WHSE_WILDLIFE_MANAGEMENT.WAA_WILDLIFE_MGMT_UNITS_SVW',
  '2026-09-22T13:10:00Z',
  '2026-09-22T13:10:00Z',
  'BC Data Catalogue record modified 2026-03-10',
  'VERIFIED',
  'Official but indicative geometry: under B.C. Reg. 64/96 the enacted regional maps (B.C. Reg. 89/2026) and the '
    || 'river-bank rule of s. 2 control. Open Government Licence - British Columbia. 225 records, one per Management '
    || 'Unit. REGION_RESPONSIBLE_NAME labels all Region 7 units Omineca although the regulation divides Region 7 into '
    || '7a Omineca and 7b Peace; it is provenance only and is not the regulatory region.'
from public.regulatory_jurisdictions j
where j.canonical_id = 'jurisdiction:ca-bc'
on conflict (canonical_id) do nothing;
