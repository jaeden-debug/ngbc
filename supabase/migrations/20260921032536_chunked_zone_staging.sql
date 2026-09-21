-- Stage a zone too large for one request, without altering it.
--
-- Québec's hunting-zone layer carries two designations no single REST request can
-- carry: zone 21 (the St Lawrence estuary and Gulf) is ONE polygon of 838,537
-- vertices with 9,311 holes, and 19SE is 8,091 island polygons. Sent as GeoJSON
-- they are 22.5 MB and 17.9 MB; the gateway returns 502 before the body arrives,
-- and every REST statement runs under an 8-second timeout.
--
-- Simplifying them would fit, and would also move the ministry's boundary, which is
-- the one thing ingestion must never do. Instead the adapter's geometry travels as
-- EWKB — the same IEEE doubles as the GeoJSON, a lossless change of container —
-- in base64 chunks small enough for any request, and is decoded here in one fast
-- statement. Assembly refuses unless the decoded geometry has exactly the vertex
-- and polygon counts the adapter computed, so a dropped or reordered chunk can
-- never stage a different boundary.
--
-- Additive: small features keep the existing JSON path unchanged.

-- Unlogged: chunks live for seconds and are deleted on assembly, so writing them
-- to the WAL would double the I/O of a large upload for data nothing needs to
-- survive a crash. A crash mid-upload simply means re-staging the feature.
create unlogged table if not exists public.zone_ingest_feature_chunks (
  run_id uuid not null references public.zone_ingest_runs(id) on delete cascade,
  source_feature_id text not null,
  chunk_index integer not null check (chunk_index >= 0),
  payload text not null check (payload ~ '^[A-Za-z0-9+/=]+$'),
  created_at timestamptz not null default now(),
  primary key (run_id, source_feature_id, chunk_index)
);

alter table public.zone_ingest_feature_chunks enable row level security;
revoke all on public.zone_ingest_feature_chunks from anon, authenticated;
grant select, insert, delete on public.zone_ingest_feature_chunks to service_role;

comment on table public.zone_ingest_feature_chunks is
  'Base64 EWKB pieces of one staged zone, held only until assemble_zone_ingest_feature decodes them. Never read by Hunt.';

create or replace function public.assemble_zone_ingest_feature(
  p_run_id uuid,
  p_source_feature_id text,
  p_official_identifier text,
  p_canonical_id text,
  p_official_name text,
  p_attributes jsonb,
  p_chunk_count integer,
  p_expected_points integer,
  p_expected_polygons integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  run public.zone_ingest_runs;
  present integer;
  assembled extensions.geometry;
  points integer;
  polygons integer;
begin
  select * into run from public.zone_ingest_runs where id = p_run_id;
  if run.id is null then raise exception 'Unknown ingest run'; end if;
  if run.status <> 'STAGED' then raise exception 'Run % is %, not STAGED', p_run_id, run.status; end if;

  -- Every chunk from 0 to n-1, and nothing else.
  select count(*) into present
  from public.zone_ingest_feature_chunks
  where run_id = p_run_id and source_feature_id = p_source_feature_id
    and chunk_index between 0 and p_chunk_count - 1;
  if present <> p_chunk_count or exists (
    select 1 from public.zone_ingest_feature_chunks
    where run_id = p_run_id and source_feature_id = p_source_feature_id and chunk_index >= p_chunk_count
  ) then
    raise exception 'Feature % has % of % chunks; refusing to assemble', p_source_feature_id, present, p_chunk_count;
  end if;

  select extensions.ST_GeomFromEWKB(decode(string_agg(payload, '' order by chunk_index), 'base64'))
  into assembled
  from public.zone_ingest_feature_chunks
  where run_id = p_run_id and source_feature_id = p_source_feature_id;

  if extensions.ST_SRID(assembled) <> 4326 or extensions.GeometryType(assembled) <> 'MULTIPOLYGON' then
    raise exception 'Feature % decoded as % in SRID %, not a MultiPolygon in 4326',
      p_source_feature_id, extensions.GeometryType(assembled), extensions.ST_SRID(assembled);
  end if;

  points := extensions.ST_NPoints(assembled);
  polygons := extensions.ST_NumGeometries(assembled);
  if points <> p_expected_points or polygons <> p_expected_polygons then
    raise exception 'Feature % decoded to % vertices in % polygons; the adapter sent % in %',
      p_source_feature_id, points, polygons, p_expected_points, p_expected_polygons;
  end if;

  insert into public.zone_ingest_features (
    run_id, source_feature_id, official_identifier, canonical_id, official_name, attributes, geometry
  ) values (
    p_run_id, p_source_feature_id, p_official_identifier, p_canonical_id, p_official_name,
    coalesce(p_attributes, '{}'::jsonb), assembled
  );

  delete from public.zone_ingest_feature_chunks
  where run_id = p_run_id and source_feature_id = p_source_feature_id;

  return jsonb_build_object('points', points, 'polygons', polygons);
end;
$$;

revoke all on function public.assemble_zone_ingest_feature(uuid, text, text, text, text, jsonb, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.assemble_zone_ingest_feature(uuid, text, text, text, text, jsonb, integer, integer, integer)
  to service_role;
