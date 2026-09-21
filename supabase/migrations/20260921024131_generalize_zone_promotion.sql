-- Generalise staged zone promotion beyond Ontario.
--
-- Adapters already own official terminology and canonical identity. The original
-- promotion function discarded both and rebuilt an Ontario id/name in SQL,
-- making every later jurisdiction look like an Ontario WMU. Carry the adapter's
-- reviewed values through staging instead. Existing staged Ontario rows are
-- backfilled losslessly before the columns become required.
--
-- The backfill is the old SQL expression, byte for byte, and it is scoped to
-- Ontario runs. A row staged for any other jurisdiction before this migration
-- would otherwise be relabelled as an Ontario WMU; instead the migration stops
-- and says so. `fixtures/hunt/ontario-registry-identity.json` records the 151
-- published Ontario ids, and the ingestion tests assert the Ontario adapter
-- still produces every one of them.

alter table public.zone_ingest_features
  add column if not exists canonical_id text,
  add column if not exists official_name text;

update public.zone_ingest_features f
set canonical_id = 'management_zone:ca-on-wmu-' ||
      lower(regexp_replace(f.official_identifier, '[^A-Za-z0-9-]+', '-', 'g')),
    official_name = 'Wildlife Management Unit ' || f.official_identifier
from public.zone_ingest_runs r
join public.regulatory_jurisdictions j on j.id = r.jurisdiction_id
where f.run_id = r.id
  and j.canonical_id = 'jurisdiction:ca-on'
  and (f.canonical_id is null or f.official_name is null);

do $$
declare
  unlabelled integer;
begin
  select count(*) into unlabelled
  from public.zone_ingest_features
  where canonical_id is null or official_name is null;
  if unlabelled > 0 then
    raise exception
      '% staged zone rows belong to a jurisdiction whose identity SQL cannot reconstruct; re-stage them through their adapter',
      unlabelled;
  end if;
end $$;

alter table public.zone_ingest_features
  alter column canonical_id set not null,
  alter column official_name set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'zone_ingest_feature_canonical_id'
  ) then
    alter table public.zone_ingest_features
      add constraint zone_ingest_feature_canonical_id
      check (canonical_id ~ '^management_zone:[a-z0-9][a-z0-9-]*$');
  end if;
end $$;

create unique index if not exists zone_ingest_features_run_canonical_idx
  on public.zone_ingest_features (run_id, canonical_id);

create or replace function public.publish_zone_run(
  p_run_id uuid,
  p_zone_type text,
  p_source_canonical_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  run public.zone_ingest_runs;
  source_row public.regulatory_sources;
  invalid_count integer;
  collision_count integer;
  inserted integer := 0;
  updated integer := 0;
begin
  select * into run from public.zone_ingest_runs where id = p_run_id;
  if run.id is null then raise exception 'Unknown ingest run'; end if;

  select * into source_row from public.regulatory_sources where canonical_id = p_source_canonical_id;
  if source_row.id is null then raise exception 'Unknown source %', p_source_canonical_id; end if;
  if source_row.jurisdiction_id <> run.jurisdiction_id then
    raise exception 'Source jurisdiction does not match ingest run';
  end if;
  if source_row.review_status not in ('VERIFIED', 'PUBLISHED') or source_row.verified_at is null then
    raise exception 'Source % is not verified', p_source_canonical_id;
  end if;

  select count(*) into invalid_count
  from public.zone_ingest_features
  where run_id = p_run_id
    and (not extensions.ST_IsValid(geometry) or extensions.ST_IsEmpty(geometry));
  if invalid_count > 0 then
    raise exception 'Run contains % invalid or empty geometries; refusing to publish', invalid_count;
  end if;

  -- One jurisdiction's adapter can never overwrite another's zone. The upsert
  -- below keys on canonical_id alone, so without this a colliding id would move a
  -- published boundary across a provincial line.
  select count(*) into collision_count
  from public.zone_ingest_features f
  join public.management_zones z on z.canonical_id = f.canonical_id
  where f.run_id = p_run_id and z.jurisdiction_id <> run.jurisdiction_id;
  if collision_count > 0 then
    raise exception 'Run carries % canonical ids already owned by another jurisdiction; refusing to publish', collision_count;
  end if;

  with promoted as (
    insert into public.management_zones (
      canonical_id, jurisdiction_id, zone_type, official_identifier, official_name, source_id,
      source_retrieved_at, source_verified_at, source_version, coverage_status, location_accuracy, geometry
    )
    select
      f.canonical_id,
      run.jurisdiction_id,
      p_zone_type,
      f.official_identifier,
      f.official_name,
      source_row.id,
      run.retrieved_at,
      run.retrieved_at,
      run.source_version,
      'VERIFIED',
      f.attributes ->> 'locationAccuracy',
      extensions.ST_Multi(f.geometry)
    from public.zone_ingest_features f
    where f.run_id = p_run_id
    on conflict (canonical_id) do update set
      geometry = excluded.geometry,
      source_id = excluded.source_id,
      source_retrieved_at = excluded.source_retrieved_at,
      source_verified_at = excluded.source_verified_at,
      source_version = excluded.source_version,
      location_accuracy = excluded.location_accuracy,
      official_identifier = excluded.official_identifier,
      official_name = excluded.official_name
    returning (xmax = 0) as was_insert
  )
  select count(*) filter (where was_insert), count(*) filter (where not was_insert)
  into inserted, updated from promoted;

  update public.zone_ingest_runs set status = 'PUBLISHED' where id = p_run_id;

  return jsonb_build_object(
    'inserted', inserted,
    'updated', updated,
    'totalZones', (
      select count(*) from public.management_zones where jurisdiction_id = run.jurisdiction_id
    )
  );
end;
$$;

revoke all on function public.publish_zone_run(uuid, text, text) from public, anon, authenticated;
grant execute on function public.publish_zone_run(uuid, text, text) to service_role;

-- Certification samples must be jurisdiction-scoped once several layers live in
-- the same registry. A default preserves the old operational call while every
-- certification script is migrated to pass its jurisdiction explicitly.
--
-- `across_*` is the mirror of `edge_*`: the same short step, taken outward past
-- the closest boundary point. `edge_*` must resolve to the unit and `across_*`
-- to its neighbour (or to nothing at a provincial edge), so both sides of every
-- boundary are exercised. The segment from an interior point to its closest
-- boundary point cannot leave the polygon, which is what makes `edge_*` inside
-- by construction.
drop function if exists public.zone_sample_points();

create function public.zone_sample_points(p_jurisdiction_canonical_id text default null)
returns table (
  official_identifier text,
  canonical_id text,
  inside_latitude double precision,
  inside_longitude double precision,
  edge_latitude double precision,
  edge_longitude double precision,
  across_latitude double precision,
  across_longitude double precision,
  area_km2 double precision,
  vertices integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    z.official_identifier,
    z.canonical_id,
    extensions.ST_Y(sample.inside) as inside_latitude,
    extensions.ST_X(sample.inside) as inside_longitude,
    extensions.ST_Y(extensions.ST_LineInterpolatePoint(extensions.ST_MakeLine(sample.inside, sample.closest), 0.995)) as edge_latitude,
    extensions.ST_X(extensions.ST_LineInterpolatePoint(extensions.ST_MakeLine(sample.inside, sample.closest), 0.995)) as edge_longitude,
    extensions.ST_Y(sample.closest) + 0.005 * (extensions.ST_Y(sample.closest) - extensions.ST_Y(sample.inside)) as across_latitude,
    extensions.ST_X(sample.closest) + 0.005 * (extensions.ST_X(sample.closest) - extensions.ST_X(sample.inside)) as across_longitude,
    extensions.ST_Area(z.geometry::extensions.geography) / 1000000.0 as area_km2,
    extensions.ST_NPoints(z.geometry) as vertices
  from public.management_zones z
  join public.regulatory_jurisdictions j on j.id = z.jurisdiction_id
  cross join lateral (
    select extensions.ST_PointOnSurface(z.geometry) as inside,
           extensions.ST_ClosestPoint(extensions.ST_Boundary(z.geometry), extensions.ST_PointOnSurface(z.geometry)) as closest
  ) sample
  where p_jurisdiction_canonical_id is null or j.canonical_id = p_jurisdiction_canonical_id
  order by z.official_identifier;
$$;

revoke all on function public.zone_sample_points(text) from public, anon, authenticated;
grant execute on function public.zone_sample_points(text) to service_role;

-- A multipart unit is only certified if every sizeable part of it is. One
-- interior point per unit can land in the largest part and never test the
-- others, which is exactly where a grouping mistake would hide. Capped per unit
-- because some authorities publish thousands of island polygons for one area.
create or replace function public.zone_component_sample_points(
  p_jurisdiction_canonical_id text,
  p_max_components integer default 8
)
returns table (
  official_identifier text,
  component_rank integer,
  component_count integer,
  latitude double precision,
  longitude double precision,
  component_km2 double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  with parts as (
    select
      z.official_identifier,
      extensions.ST_NumGeometries(z.geometry) as component_count,
      dump.geom as part,
      row_number() over (
        partition by z.id order by extensions.ST_Area(dump.geom::extensions.geography) desc
      )::integer as component_rank
    from public.management_zones z
    join public.regulatory_jurisdictions j on j.id = z.jurisdiction_id
    cross join lateral extensions.ST_Dump(z.geometry) dump
    where j.canonical_id = p_jurisdiction_canonical_id
      and extensions.ST_NumGeometries(z.geometry) > 1
  )
  select
    official_identifier,
    component_rank,
    component_count,
    extensions.ST_Y(extensions.ST_PointOnSurface(part)),
    extensions.ST_X(extensions.ST_PointOnSurface(part)),
    extensions.ST_Area(part::extensions.geography) / 1000000.0
  from parts
  where component_rank <= greatest(1, p_max_components)
  order by official_identifier, component_rank;
$$;

revoke all on function public.zone_component_sample_points(text, integer) from public, anon, authenticated;
grant execute on function public.zone_component_sample_points(text, integer) to service_role;

comment on column public.zone_ingest_features.canonical_id is
  'Canonical identity supplied by the reviewed jurisdiction adapter; promotion must never reconstruct an Ontario-shaped id.';
comment on column public.zone_ingest_features.official_name is
  'Display name in the authority''s own terminology, supplied by the jurisdiction adapter.';
