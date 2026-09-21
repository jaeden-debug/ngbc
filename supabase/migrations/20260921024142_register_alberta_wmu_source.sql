-- Register Alberta and the reviewed Government of Alberta WMU layer.
--
-- Registration is a reviewed act, recorded here rather than typed into a
-- dashboard. The source passed endpoint, schema, coordinate-system, count,
-- licence and legal-standing review on 2026-09-21 (UTC):
--
--   endpoint   geospatial.alberta.ca .../fishwild_wildlife_mgmt_unit_public/FeatureServer/0
--   schema     WMUNIT_CODE, WMUNIT_NAME, GlobalID, OBJECTID, Shape__Area, Shape__Length
--   CRS        EPSG:3400 native; EPSG:4326 requested from the authority
--   count      199 polygon records = 189 named WMUs + 9 extra parts of WMUs 718, 728
--              and 794 + 1 blank record identified as Elk Island National Park
--   licence    Open Government Licence - Alberta (commercial use and derivatives
--              allowed, attribution required)
--   standing   Alberta: "small-scale approximations of the actual units legally
--              described in the Wildlife Regulation (AR 143/97)". Usable to locate
--              a point; the written descriptions prevail.
--
-- The jurisdiction is NEEDS_VERIFICATION: registering a boundary source says
-- nothing about whether any Alberta rule is certified.

insert into public.regulatory_jurisdictions (
  canonical_id, country_code, subdivision_code, official_name, authority, coverage_status
) values (
  'jurisdiction:ca-ab', 'CA', 'AB', 'Alberta', 'Government of Alberta', 'NEEDS_VERIFICATION'
)
on conflict (canonical_id) do nothing;

insert into public.regulatory_sources (
  canonical_id, jurisdiction_id, authority, title, source_url, document_identifier,
  retrieved_at, verified_at, source_version, review_status, notes
)
select
  'source:ca-ab-wmu-service',
  j.id,
  'Government of Alberta',
  'Wildlife Management Units feature layer',
  'https://geospatial.alberta.ca/mimas/rest/services/boundaries/fishwild_wildlife_mgmt_unit_public/FeatureServer/0',
  'fishwild_wildlife_mgmt_unit_public/FeatureServer/0',
  '2026-09-21T02:30:00Z',
  '2026-09-21T02:30:00Z',
  'Alberta open-data metadata modified 2026-03-04',
  'VERIFIED',
  'Official but indicative geometry: Alberta states WMU boundaries are small-scale approximations of the units '
    || 'legally described in the Wildlife Regulation (AR 143/97), which prevails. Open Government Licence - Alberta. '
    || '199 source records normalise to 189 WMUs; the blank record (GlobalID {82103B05-7CAF-4648-A550-5D70B8C51BFC}) '
    || 'is Elk Island National Park of Canada and is quarantined, not ingested.'
from public.regulatory_jurisdictions j
where j.canonical_id = 'jurisdiction:ca-ab'
on conflict (canonical_id) do nothing;
