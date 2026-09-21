-- Register the sources Québec's 2026 rule bundle (ca-qc-2026) rests on, and the
-- ministry's layer of territories closed to all hunting that Hunt reads at a point.
--
-- Registration is a reviewed act, recorded here rather than typed into a
-- dashboard. Each page is registered exactly as scripts/build-quebec-regulations.mjs
-- fetched and hashed it, in French as the ministry publishes it; the layer as
-- scripts/build-quebec-overlays.mjs catalogued it. `npm run check:regulatory-sources`
-- refuses to pass when any of these hashes moves.
--
-- Each page's effective period is the period it speaks for (big game: the 2026
-- and 2027 seasons; small game: from 1 April 2026), never a claim about a
-- single rule: rules carry their own year. VERIFIED means reviewed and hashed; it
-- does not make a summary page or a map controlling, and the notes say so.
insert into public.regulatory_sources (
  canonical_id, jurisdiction_id, authority, title, source_url, document_identifier,
  retrieved_at, verified_at, effective_from, effective_to, source_version, content_hash, review_status, notes
)
select
  source.canonical_id, j.id, source.authority, source.title, source.source_url, source.document_identifier,
  source.retrieved_at::timestamptz, '2026-09-21T09:29:00Z'::timestamptz, source.effective_from::date, source.effective_to::date,
  source.source_version, source.content_hash, 'VERIFIED', source.notes
from public.regulatory_jurisdictions j
cross join (values
  ('source:ca-qc-orignal-2026-2027', 'Gouvernement du Québec — ministère de l''Environnement, de la Lutte contre les changements climatiques, de la Faune et des Parcs', 'Périodes de chasse à l’orignal 2026-2027', 'https://www.quebec.ca/tourisme-loisirs-sport/activites-sportives-et-de-plein-air/chasse-sportive/periodes-limites/orignal', 'quebec.ca/…/periodes-limites/orignal', '2026-09-20T12:00:00Z', '2026-01-01', '2027-12-31', 'page updated 2026-09-18', 'sha256:7a0aafc49748a64b5157b41a0442400505eeb061c4a1316b760d8fa0fe7e7bd3', 'The ministry''s own page of seasons, read in French as published. It states the seasons for the periods it names; the regulation it summarises controls.'),
  ('source:ca-qc-cerf-virginie-2026-2027', 'Gouvernement du Québec — ministère de l''Environnement, de la Lutte contre les changements climatiques, de la Faune et des Parcs', 'Périodes de chasse pour le cerf de Virginie 2026-2027', 'https://www.quebec.ca/tourisme-loisirs-sport/activites-sportives-et-de-plein-air/chasse-sportive/periodes-limites/cerf-virginie', 'quebec.ca/…/periodes-limites/cerf-virginie', '2026-09-20T12:00:00Z', '2026-01-01', '2027-12-31', 'page updated 2026-05-21', 'sha256:ab1c75ca39d5d964545027259207b67969e9835e2c4299c9ec23243493b8f139', 'The ministry''s own page of seasons, read in French as published. It states the seasons for the periods it names; the regulation it summarises controls.'),
  ('source:ca-qc-ours-noir-2026-2027', 'Gouvernement du Québec — ministère de l''Environnement, de la Lutte contre les changements climatiques, de la Faune et des Parcs', 'Périodes de chasse à l’ours noir 2026-2027', 'https://www.quebec.ca/tourisme-loisirs-sport/activites-sportives-et-de-plein-air/chasse-sportive/periodes-limites/ours-noir', 'quebec.ca/…/periodes-limites/ours-noir', '2026-09-20T12:00:00Z', '2026-01-01', '2027-12-31', 'page updated 2026-04-24', 'sha256:b1f45216818980917ac9649539a445241cfcb6a9b3e80271a685ee9d19e4d917', 'The ministry''s own page of seasons, read in French as published. It states the seasons for the periods it names; the regulation it summarises controls.'),
  ('source:ca-qc-dindon-sauvage-2026-2027', 'Gouvernement du Québec — ministère de l''Environnement, de la Lutte contre les changements climatiques, de la Faune et des Parcs', 'Périodes de chasse au dindon sauvage 2026-2027', 'https://www.quebec.ca/tourisme-loisirs-sport/activites-sportives-et-de-plein-air/chasse-sportive/periodes-limites/dindon-sauvage', 'quebec.ca/…/periodes-limites/dindon-sauvage', '2026-09-20T12:00:00Z', '2026-01-01', '2027-12-31', 'page updated 2026-01-16', 'sha256:544bc829f0ed67b3b31808ac6fb72cc4ef5d1429aa05a189e83f44c884a28696', 'The ministry''s own page of seasons, read in French as published. It states the seasons for the periods it names; the regulation it summarises controls.'),
  ('source:ca-qc-petit-gibier-2026-2028', 'Gouvernement du Québec — ministère de l''Environnement, de la Lutte contre les changements climatiques, de la Faune et des Parcs', 'Périodes de chasse au petit gibier 2026-2028', 'https://www.quebec.ca/tourisme-loisirs-sport/activites-sportives-et-de-plein-air/chasse-sportive/periodes-limites/petit-gibier', 'quebec.ca/…/periodes-limites/petit-gibier', '2026-09-20T12:00:00Z', '2026-04-01', '2028-04-30', 'page updated 2026-05-05', 'sha256:6a57c45d06a38fbf8bd63c603408508443336e5481f2561488d1751ae92c9399', 'The ministry''s own page of seasons, read in French as published. It states the seasons for the periods it names; the regulation it summarises controls.'),
  ('source:ca-qc-chasse-interdite-service', 'Ministère des Forêts, de la Faune et des Parcs', 'Territoires où toute activité de chasse est interdite (SmartFaunePub:Chasse_Interdite)', 'https://servicesvecto3.mern.gouv.qc.ca/geoserver/SmartFaunePub/ows?service=WFS&version=2.0.0&request=GetCapabilities', 'SmartFaunePub:Chasse_Interdite', '2026-09-21T12:00:00Z', null, null, '130 features', 'sha256:fbec4a5872db935915ceb4f896eb4badacb650b12be26e228f9e0cdeddf30dcc', 'Official GIS layer, read live at a point. It states its own meaning, « Territoires où toute activité de chasse est interdite »; North Ground quotes it and does not certify a closure.')
) as source (canonical_id, authority, title, source_url, document_identifier, retrieved_at, effective_from, effective_to, source_version, content_hash, notes)
where j.canonical_id = 'jurisdiction:ca-qc'
on conflict (canonical_id) do nothing;
