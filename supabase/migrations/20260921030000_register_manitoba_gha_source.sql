-- Register Manitoba and the reviewed Government of Manitoba Game Hunting Area layer.
--
-- Registration is a reviewed act, recorded here rather than typed into a
-- dashboard. The source passed endpoint, schema, coordinate-system, count,
-- licence and legal-standing review on 2026-09-20 (America/Winnipeg):
--
--   endpoint   services.arcgis.com/mMUesHYPkXjaFGfS/.../Manitoba_Game_Hunting_Areas/FeatureServer/0
--              (item c30d7158891940dbb64f4b0d6cfb1516, owner Manitoba_Government). The
--              government describes it as "an accurate representation of the game
--              hunting boundaries in Manitoba". A second copy, CWD_GHA/FeatureServer/1,
--              is embedded in the chronic wasting disease map; its 63 records carry the
--              same identifiers and areas within 0.03 km2 but no identical geometry and
--              fewer vertices in 32 areas, so it is a derivative and is not used.
--   schema     OBJECTID, GHA, Shape__Area, Shape__Length
--   CRS        EPSG:3857 native; EPSG:4326 requested from the authority
--   count      63 polygon records = 62 named Game Hunting Areas + 1 record with no GHA
--              value. The 62 designations are exactly the 62 areas M.R. 220/86 s. 1
--              defines (there is no Area 37). The blank record covers Riding Mountain
--              National Park, which the regulation draws GHAs 23 and 23A around; it is
--              quarantined, not ingested.
--   version    layer data last edited 2024-05-30 (editingInfo.dataLastEditDate)
--   licence    Manitoba Open Data Licence (OpenMB Information and Data Use Licence):
--              commercial use and derivatives allowed, attribution required
--   standing   Game Hunting Areas are defined in the Hunting Areas and Zones
--              Regulation, M.R. 220/86, and the layer itself directs readers to that
--              regulation for boundary descriptions. Usable to locate a point; the
--              written descriptions prevail.
--
-- The jurisdiction is NEEDS_VERIFICATION: registering a boundary source says
-- nothing about whether any Manitoba rule is certified.

insert into public.regulatory_jurisdictions (
  canonical_id, country_code, subdivision_code, official_name, authority, coverage_status
) values (
  'jurisdiction:ca-mb', 'CA', 'MB', 'Manitoba', 'Manitoba Natural Resources and Indigenous Futures', 'NEEDS_VERIFICATION'
)
on conflict (canonical_id) do nothing;

insert into public.regulatory_sources (
  canonical_id, jurisdiction_id, authority, title, source_url, document_identifier,
  retrieved_at, verified_at, source_version, review_status, notes
)
select
  'source:ca-mb-gha-service',
  j.id,
  'Government of Manitoba',
  'Manitoba Game Hunting Areas feature layer',
  'https://services.arcgis.com/mMUesHYPkXjaFGfS/arcgis/rest/services/Manitoba_Game_Hunting_Areas/FeatureServer/0',
  'Manitoba_Game_Hunting_Areas/FeatureServer/0 (ArcGIS item c30d7158891940dbb64f4b0d6cfb1516)',
  '2026-09-21T03:00:00Z',
  '2026-09-21T03:00:00Z',
  'data-2024-05-30',
  'VERIFIED',
  'Official but indicative geometry: Game Hunting Areas are defined in the Hunting Areas and Zones Regulation, '
    || 'M.R. 220/86, which the layer names as the authority for boundary descriptions and which prevails. '
    || 'Manitoba Open Data Licence. 63 source records normalise to the 62 areas the regulation defines; the blank '
    || 'record (OBJECTID 22) is Riding Mountain National Park and is quarantined, not ingested.'
from public.regulatory_jurisdictions j
where j.canonical_id = 'jurisdiction:ca-mb'
on conflict (canonical_id) do nothing;
