-- Register Québec and the reviewed Government of Québec hunting-zone layer.
--
-- Registration is a reviewed act, recorded here rather than typed into a
-- dashboard. The source passed endpoint, schema, coordinate-system, count,
-- licence and legal-standing review on 2026-09-20 (America/Toronto):
--
--   endpoint   servicesvecto3.mern.gouv.qc.ca/geoserver/SmartFaunePub/ows
--              typeName SmartFaunePub:Zone_chasse_da3_sefaq — the GeoServer behind the
--              government's Forêt ouverte map, located from that map's published
--              layer context; the zones are not in the open-data portal
--   schema     Zone (designation), No_zone (number), Partie_zon (part name), Latitude,
--              Longitude, Shape_Area, the_geom
--   CRS        EPSG:32198 native; EPSG:4326 requested from the authority, so the
--              ministry performs the reprojection
--   count      9,503 features = 59 designations over the 28 numbered zones quebec.ca
--              publishes (1 to 24 and 26 to 29; there is no hunting zone 25);
--              9,509 polygons; 2,424,980 vertices
--   licence    service capabilities declare AccessConstraints NONE and Fees NONE
--   standing   the service's own disclaimer — "cette compilation cartographique n'a
--              aucune portée légale, seuls les documents déposés ont force de loi" —
--              is the standard statement that a map is not the regulation, the same
--              standing as Ontario's layer. Usable to locate a point.
--
-- The designation (the part) is the regulatory unit, not the number: Québec publishes
-- different seasons for 19N, 19SE, 19SO and 19SNO.
--
-- The jurisdiction is NEEDS_VERIFICATION: registering a boundary source says nothing
-- about whether any Québec rule is certified.

insert into public.regulatory_jurisdictions (
  canonical_id, country_code, subdivision_code, official_name, authority, coverage_status
) values (
  'jurisdiction:ca-qc', 'CA', 'QC', 'Québec', 'Gouvernement du Québec', 'NEEDS_VERIFICATION'
)
on conflict (canonical_id) do nothing;

insert into public.regulatory_sources (
  canonical_id, jurisdiction_id, authority, title, source_url, document_identifier,
  retrieved_at, verified_at, source_version, review_status, notes
)
select
  'source:ca-qc-zone-chasse-service',
  j.id,
  'Gouvernement du Québec',
  'Zones de chasse (SmartFaunePub:Zone_chasse_da3_sefaq)',
  'https://servicesvecto3.mern.gouv.qc.ca/geoserver/SmartFaunePub/ows',
  'SmartFaunePub:Zone_chasse_da3_sefaq',
  '2026-09-20T22:00:00-04:00',
  '2026-09-20T22:00:00-04:00',
  'Service read 2026-09-20: 9,503 features, 59 designations',
  'VERIFIED',
  'Official hunting-zone geometry of the Gouvernement du Québec, served by the GeoServer behind Forêt ouverte. '
    || 'The service disclaims legal effect for the map itself ("seuls les documents déposés ont force de loi"); '
    || 'the published regulation prevails. Partie_zon is served as CP850 bytes read as Latin-1 and is repaired '
    || 'through the code page. Designations that name a territory rather than a direction (08NZ, 09OZ, 10EZ — '
    || 'the chronic wasting disease enhanced surveillance zone; 08NMR — Montagne de Rigaud; 27ESB, 27OSB — '
    || 'Seigneurie de Beaupré) are distinct regulatory ground and are never merged into their parent part.'
from public.regulatory_jurisdictions j
where j.canonical_id = 'jurisdiction:ca-qc'
on conflict (canonical_id) do nothing;
