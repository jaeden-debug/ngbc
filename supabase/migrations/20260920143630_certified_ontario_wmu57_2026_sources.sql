-- The certified Ontario WMU 57 slice, part 1 of 2: the jurisdiction and its sources.
--
-- Recorded in the migration ledger as 20260920143630 certified_ontario_wmu57_2026_sources.
-- Live, this version also created a transient staging table that received the WMU 57
-- geometry in ordered chunks, which were loaded outside the ledger; the next version
-- dropped it. That staging had no lasting effect, so it is not reproduced: the zone and
-- its geometry are inserted directly by part 2 (20260920143824).
insert into public.regulatory_jurisdictions (
  canonical_id, country_code, subdivision_code, official_name, authority, coverage_status
) values (
  'jurisdiction:ca-on', 'CA', 'ON', 'Ontario', 'Ontario Ministry of Natural Resources', 'PARTIAL'
) on conflict (canonical_id) do nothing;

insert into public.regulatory_sources (
  canonical_id, jurisdiction_id, authority, title, source_url, document_identifier,
  section_reference, retrieved_at, verified_at, effective_from, effective_to, source_version, review_status, notes
)
select values_to_insert.* from (
  values
    (
      'source:ca-on-wmu-service',
      (select id from public.regulatory_jurisdictions where canonical_id = 'jurisdiction:ca-on'),
      'Ontario Ministry of Natural Resources', 'Wildlife Management Unit feature layer',
      'https://ws.lioservices.lrc.gov.on.ca/arcgis2/rest/services/LIO_OPEN_DATA/LIO_Open05/MapServer/5',
      'LIO Open Data MapServer/5', null, '2026-09-20T12:00:00Z'::timestamptz,
      '2026-09-20T12:00:00Z'::timestamptz, null::date, null::date, 'retrieved-2026-09-20', 'VERIFIED',
      'Official geometry; provider metadata reported Within 10 metres and Verified.'
    ),
    (
      'source:ca-on-small-game-2026',
      (select id from public.regulatory_jurisdictions where canonical_id = 'jurisdiction:ca-on'),
      'Ontario Ministry of Natural Resources', 'Small game and furbearing mammals — 2026 Ontario Hunting Regulations Summary',
      'https://www.ontario.ca/document/ontario-hunting-regulations-summary/small-game-and-furbearing-mammals',
      '2026 Ontario Hunting Regulations Summary', 'Small game and furbearing mammals',
      '2026-09-20T12:00:00Z'::timestamptz, '2026-09-20T12:00:00Z'::timestamptz,
      '2026-01-01'::date, '2026-12-31'::date, '2026', 'PUBLISHED', null
    ),
    (
      'source:ca-on-summary-use-2026',
      (select id from public.regulatory_jurisdictions where canonical_id = 'jurisdiction:ca-on'),
      'Ontario Ministry of Natural Resources', 'How to use the 2026 Ontario Hunting Regulations Summary',
      'https://www.ontario.ca/document/ontario-hunting-regulations-summary/how-use-this-summary',
      '2026 Ontario Hunting Regulations Summary', 'How to use this summary',
      '2026-09-20T12:00:00Z'::timestamptz, '2026-09-20T12:00:00Z'::timestamptz,
      '2026-01-01'::date, '2026-12-31'::date, '2026', 'PUBLISHED', null
    )
) as values_to_insert(
  canonical_id, jurisdiction_id, authority, title, source_url, document_identifier,
  section_reference, retrieved_at, verified_at, effective_from, effective_to, source_version, review_status, notes
)
on conflict (canonical_id) do nothing;
