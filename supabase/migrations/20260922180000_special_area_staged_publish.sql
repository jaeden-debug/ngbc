-- Publish a regulatory special-area layer through a staged run.
--
-- Manitoba's Wildlife Management Areas layer is 129 full-resolution polygons,
-- 3.3 MB of GeoJSON. Sent to publish_special_area_layer in one request it
-- exceeds the 8-second statement timeout every REST statement runs under.
-- Simplifying the polygons would fit, and would also move a legal restriction
-- boundary, which ingestion must never do. Instead, as zone ingestion does
-- (20260921032536_chunked_zone_staging), records travel in small batches into
-- a stage, and one fast statement swaps a complete, checked run into place.
--
-- A run is refused when its staged count differs from the expected count, when
-- a staged record is outside the reviewed catalogue's ids, or when it is older
-- than the run the layer currently serves. Publishing clears only its own run.
-- Abandoned runs are removed by discard_abandoned_special_area_runs.
--
-- The single-request publish_special_area_layer is dropped so every layer
-- takes this one path.

create table if not exists public.regulatory_special_area_runs (
  id uuid primary key default gen_random_uuid(),
  layer_id text not null check (layer_id ~ '^special_layer:[a-z0-9-]+$'),
  -- Everything the published layer row needs, as the ingestion script sent it.
  layer jsonb not null check (jsonb_typeof(layer) = 'object'),
  -- The reviewed catalogue's record ids; nothing else may be staged.
  reviewed_ids text[] not null check (cardinality(reviewed_ids) > 0),
  expected_count integer not null check (expected_count > 0),
  status text not null check (status in ('STAGED', 'PUBLISHED', 'REJECTED')),
  created_at timestamptz not null default now()
);

-- Unlogged, as zone chunks are: staged rows live for minutes and are deleted on
-- publish; a crash mid-run simply means staging the layer again.
create unlogged table if not exists public.regulatory_special_area_stage (
  run_id uuid not null references public.regulatory_special_area_runs(id) on delete cascade,
  layer_id text not null,
  source_record_id text not null,
  name text not null,
  restriction_text text not null,
  legal_standing jsonb not null,
  attributes jsonb not null default '{}'::jsonb,
  geometry extensions.geometry(MultiPolygon, 4326) not null,
  created_at timestamptz not null default now(),
  primary key (run_id, layer_id, source_record_id)
);

alter table public.regulatory_special_area_layers
  add column if not exists published_run_id uuid references public.regulatory_special_area_runs(id) on delete set null;

alter table public.regulatory_special_area_runs enable row level security;
alter table public.regulatory_special_area_stage enable row level security;
revoke all on public.regulatory_special_area_runs, public.regulatory_special_area_stage from public, anon, authenticated;
grant select on public.regulatory_special_area_runs, public.regulatory_special_area_stage to service_role;

comment on table public.regulatory_special_area_stage is
  'Records of one special-area run, held only until publish_special_area_run swaps them in. Never read by Hunt.';

-- Open a run for one layer.
create or replace function public.begin_special_area_run(p_layer jsonb, p_reviewed_ids text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_id uuid;
begin
  if (p_layer->>'featureCount')::integer <> cardinality(p_reviewed_ids) then
    raise exception 'Layer % expects % records but the catalogue reviews %',
      p_layer->>'layerId', p_layer->>'featureCount', cardinality(p_reviewed_ids);
  end if;
  insert into public.regulatory_special_area_runs (layer_id, layer, reviewed_ids, expected_count, status)
  values (p_layer->>'layerId', p_layer, p_reviewed_ids, (p_layer->>'featureCount')::integer, 'STAGED')
  returning id into run_id;
  return run_id;
end;
$$;

-- Stage a batch of records. Geometry is built and validated here, batch by
-- batch, so no single statement carries the whole layer.
create or replace function public.stage_special_area_records(p_run_id uuid, p_features jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  run public.regulatory_special_area_runs;
  staged integer;
begin
  select * into run from public.regulatory_special_area_runs where id = p_run_id;
  if run.id is null then raise exception 'Unknown special-area run'; end if;
  if run.status <> 'STAGED' then raise exception 'Run % is %, not STAGED', p_run_id, run.status; end if;
  if exists (
    select 1 from jsonb_array_elements(p_features) f
    where not (f->>'sourceRecordId' = any (run.reviewed_ids))
  ) then
    raise exception 'Run % was sent a record outside the reviewed catalogue', p_run_id;
  end if;

  insert into public.regulatory_special_area_stage (
    run_id, layer_id, source_record_id, name, restriction_text, legal_standing, attributes, geometry
  )
  select p_run_id, run.layer_id, f->>'sourceRecordId', f->>'name', f->>'restrictionText',
    f->'legalStanding', coalesce(f->'attributes', '{}'::jsonb),
    extensions.ST_Multi(extensions.ST_CollectionExtract(extensions.ST_MakeValid(
      extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON(f->>'geometry'), 4326)), 3))
  from jsonb_array_elements(p_features) f;
  get diagnostics staged = row_count;
  return staged;
end;
$$;

-- Swap a complete run into place: the layer row and its records together, or nothing.
create or replace function public.publish_special_area_run(p_run_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  run public.regulatory_special_area_runs;
  current_run_created timestamptz;
  staged integer;
  loaded integer;
begin
  select * into run from public.regulatory_special_area_runs where id = p_run_id for update;
  if run.id is null then raise exception 'Unknown special-area run'; end if;
  if run.status <> 'STAGED' then raise exception 'Run % is %, not STAGED', p_run_id, run.status; end if;

  select r.created_at into current_run_created
  from public.regulatory_special_area_layers l
  join public.regulatory_special_area_runs r on r.id = l.published_run_id
  where l.layer_id = run.layer_id;
  if current_run_created is not null and run.created_at < current_run_created then
    raise exception 'Run % is older than the run layer % already serves', p_run_id, run.layer_id;
  end if;

  select count(*) into staged from public.regulatory_special_area_stage where run_id = p_run_id;
  if staged <> run.expected_count then
    raise exception 'Run % staged % of % records; refusing to publish', p_run_id, staged, run.expected_count;
  end if;
  if exists (
    select 1 from unnest(run.reviewed_ids) id
    where not exists (select 1 from public.regulatory_special_area_stage s where s.run_id = p_run_id and s.source_record_id = id)
  ) then
    raise exception 'Run % is missing a reviewed record; refusing to publish', p_run_id;
  end if;

  insert into public.regulatory_special_area_layers (
    layer_id, jurisdiction_id, source_canonical_id, service_url, licence, catalogue_hash, source_hash,
    feature_count, data_last_edit_date, retrieved_at, checked_at, status, status_reason, published_run_id
  ) values (
    run.layer_id, run.layer->>'jurisdictionId', run.layer->>'sourceId', run.layer->>'serviceUrl', run.layer->>'licence',
    run.layer->>'catalogueHash', run.layer->>'sourceHash', run.expected_count,
    (run.layer->>'dataLastEditDate')::timestamptz, (run.layer->>'retrievedAt')::timestamptz, now(), 'CURRENT', null, run.id
  )
  on conflict (layer_id) do update set
    jurisdiction_id = excluded.jurisdiction_id, source_canonical_id = excluded.source_canonical_id,
    service_url = excluded.service_url, licence = excluded.licence, catalogue_hash = excluded.catalogue_hash,
    source_hash = excluded.source_hash, feature_count = excluded.feature_count,
    data_last_edit_date = excluded.data_last_edit_date, retrieved_at = excluded.retrieved_at,
    checked_at = excluded.checked_at, status = 'CURRENT', status_reason = null, published_run_id = excluded.published_run_id;

  delete from public.regulatory_special_areas where layer_id = run.layer_id;
  insert into public.regulatory_special_areas (
    layer_id, jurisdiction_id, source_record_id, name, restriction_text, legal_standing, attributes, geometry
  )
  select s.layer_id, run.layer->>'jurisdictionId', s.source_record_id, s.name, s.restriction_text,
    s.legal_standing, s.attributes, s.geometry
  from public.regulatory_special_area_stage s
  where s.run_id = p_run_id;
  get diagnostics loaded = row_count;

  delete from public.regulatory_special_area_stage where run_id = p_run_id;
  update public.regulatory_special_area_runs set status = 'PUBLISHED' where id = p_run_id;
  return loaded;
end;
$$;

-- Remove runs that were staged and never published, so the stage never grows silently.
create or replace function public.discard_abandoned_special_area_runs(p_older_than interval default interval '24 hours')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from public.regulatory_special_area_runs
  where status = 'STAGED' and created_at < now() - p_older_than;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

drop function if exists public.publish_special_area_layer(jsonb, jsonb);

revoke all on function public.begin_special_area_run(jsonb, text[]) from public, anon, authenticated;
revoke all on function public.stage_special_area_records(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.publish_special_area_run(uuid) from public, anon, authenticated;
revoke all on function public.discard_abandoned_special_area_runs(interval) from public, anon, authenticated;
grant execute on function public.begin_special_area_run(jsonb, text[]) to service_role;
grant execute on function public.stage_special_area_records(uuid, jsonb) to service_role;
grant execute on function public.publish_special_area_run(uuid) to service_role;
grant execute on function public.discard_abandoned_special_area_runs(interval) to service_role;
