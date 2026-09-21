-- Register the sources Manitoba's 2026-27 rule bundle (ca-mb-2026) rests on.
--
-- Registration is a reviewed act, recorded here rather than typed into a
-- dashboard. Each row is the source exactly as scripts/build-manitoba-
-- regulations.mjs fetched, hashed and parsed it; the hashes are the bundle's own
-- and `npm run check:regulatory-sources` refuses to pass when any of them moves.
--
-- Source hierarchy, which the notes column records per row:
--   law        M.R. 165/91 (controlling for seasons, limits and equipment),
--              M.R. 220/86 (areas and zones), M.R. 351/87 (legal hours, general
--              rules), M.R. 171/2001 (wildlife lands)
--   summary    the 2026 Manitoba Hunting Guide, cross-check only
--   programme  the CWD page, for the mandatory sampling requirement
--   GIS        the CWD surveillance zone, closed-lands and wildlife-lands layers,
--              indicative and read live at a point
--
-- VERIFIED here means reviewed and hashed. It does not make a summary or a map
-- controlling; the notes say which each one is.

insert into public.regulatory_sources (
  canonical_id, jurisdiction_id, authority, title, source_url, document_identifier,
  retrieved_at, verified_at, effective_from, source_version, content_hash, review_status, notes
)
select
  source.canonical_id, j.id, source.authority, source.title, source.source_url, source.document_identifier,
  source.retrieved_at::timestamptz, '2026-09-21T03:40:00Z'::timestamptz, source.effective_from::date,
  source.source_version, source.content_hash, 'VERIFIED', source.notes
from public.regulatory_jurisdictions j
cross join (values
  ('source:ca-mb-hunting-seasons-regulation', 'Government of Manitoba (Manitoba Laws)', 'Hunting Seasons and Bag Limits Regulation, M.R. 165/91', 'https://web2.gov.mb.ca/laws/regs/current/165-91.php', 'M.R. 165/91', '2026-09-20T00:00:00Z', '2026-06-16', 'in effect since 2026-06-16; last amendment M.R. 46/2026', 'sha256:460daec391fac2aa439a38f864bc74c3ae944ad14d878f3ef0de306fa632bfa9', 'Controlling law, read from the official consolidation on Manitoba Laws.'),
  ('source:ca-mb-hunting-areas-regulation', 'Government of Manitoba (Manitoba Laws)', 'Hunting Areas and Zones Regulation, M.R. 220/86', 'https://web2.gov.mb.ca/laws/regs/current/220-86.php', 'M.R. 220/86', '2026-09-20T00:00:00Z', '2016-03-11', 'in effect since 2016-03-11; last amendment M.R. 61/2016', 'sha256:5d6fc6c063ba5788041df91b4b59160733de1d7ff5bc00b68c79dd0eaf52bfb7', 'Controlling law, read from the official consolidation on Manitoba Laws.'),
  ('source:ca-mb-general-hunting-regulation', 'Government of Manitoba (Manitoba Laws)', 'General Hunting Regulation, M.R. 351/87', 'https://web2.gov.mb.ca/laws/regs/current/351-87.php', 'M.R. 351/87', '2026-09-20T00:00:00Z', '2025-12-12', 'in effect since 2025-12-12; last amendment M.R. 115/2025', 'sha256:f770d3cbf2f29f7aa124218d5a230c1213bcd2e100ea17e9ec70141482ffe8d7', 'Controlling law, read from the official consolidation on Manitoba Laws.'),
  ('source:ca-mb-designation-of-wildlife-lands-regulation', 'Government of Manitoba (Manitoba Laws)', 'Designation of Wildlife Lands Regulation, M.R. 171/2001', 'https://web2.gov.mb.ca/laws/regs/current/171-2001.php', 'M.R. 171/2001', '2026-09-20T00:00:00Z', '2023-01-20', 'in effect since 2023-01-20; last amendment M.R. 7/2023', 'sha256:98382e4b6db90363b3efa8fc2efd8ce1eb90b8a6893a8d1f59e8df58ffed14a2', 'Controlling law, read from the official consolidation on Manitoba Laws.'),
  ('source:ca-mb-hunting-guide-2026', 'Government of Manitoba', 'Manitoba Hunting Guide 2026', 'https://www.gov.mb.ca/nrnd/fish-wildlife/pubs/fish_wildlife/huntingguide.pdf', 'Manitoba Hunting Guide 2026 (PDF)', '2026-09-20T00:00:00Z', null, '2026 (licence year 1 April 2026 to 31 March 2027)', 'sha256:74a15553c9a4f4be0a79b17f7e7a451ca8330c9041c26711b7fc3df824a1f36e', 'Official summary, not law. Used only to cross-check the regulation; where they differ the regulation controls and the difference is recorded as a dispute or note.'),
  ('source:ca-mb-cwd-program', 'Manitoba Natural Resources and Indigenous Futures', 'Chronic Wasting Disease in Manitoba', 'https://www.gov.mb.ca/nrnd/fish-wildlife/wildlife/cwd.html', 'gov.mb.ca/nrnd/fish-wildlife/wildlife/cwd.html', '2026-09-20T00:00:00Z', null, 'web page', 'sha256:41a6e12f38ed7c53080e064d93a73d5a15e5d2f07db4d2c355eeb12b29e5c2ea', 'Official explanatory page, not law. Used for a programme requirement the regulations do not state.'),
  ('source:ca-mb-cwd-surveillance-zone-service', 'Government of Manitoba', 'CWD Mandatory Surveillance Zone feature layer', 'https://services.arcgis.com/mMUesHYPkXjaFGfS/arcgis/rest/services/mandatory_(2)/FeatureServer/0', 'mandatory_(2)/FeatureServer/0', '2026-09-20T00:00:00Z', null, 'data-2024-12-23', 'sha256:8a911bcb40aaf0b60f0da32c635e904cc170e16bb498393ee3169999bda80399', 'Official but indicative geometry, read live at a point. It places a point; it does not certify a closure.'),
  ('source:ca-mb-lands-closed-to-hunting-service', 'Government of Manitoba', 'Lands Closed to Hunting in Manitoba feature layer', 'https://services.arcgis.com/mMUesHYPkXjaFGfS/arcgis/rest/services/Lands_Closed_to_Hunting/FeatureServer/0', 'Lands_Closed_to_Hunting/FeatureServer/0', '2026-09-20T00:00:00Z', null, 'feature layer', 'sha256:44ee5982aec1055e6241565cb4cb5a38e79a6380d3160fb3302d2aa6dcc272b2', 'Official but indicative geometry, read live at a point. It places a point; it does not certify a closure.'),
  ('source:ca-mb-wildlife-lands-service', 'Government of Manitoba', 'Manitoba Wildlife Lands Boundaries feature layer', 'https://services.arcgis.com/mMUesHYPkXjaFGfS/arcgis/rest/services/Manitoba_Wildlife_Lands/FeatureServer/0', 'Manitoba_Wildlife_Lands/FeatureServer (layers 0-2)', '2026-09-20T00:00:00Z', null, 'feature layer', 'sha256:0617039f6a9c999cb7a7799918a49c3d54898732b624c1f92916891ef406c470', 'Official but indicative geometry, read live at a point. It places a point; it does not certify a closure.')
) as source (canonical_id, authority, title, source_url, document_identifier, retrieved_at, effective_from, source_version, content_hash, notes)
where j.canonical_id = 'jurisdiction:ca-mb'
on conflict (canonical_id) do nothing;
