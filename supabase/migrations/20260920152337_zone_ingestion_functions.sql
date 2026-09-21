-- Compare and publish a staged zone-layer run.
--
-- The comparison is deliberately separate from the promotion. An authority
-- redrawing a boundary, renaming a unit or dropping one is a regulatory event; it
-- must be visible to a person before production geometry moves. `publish` is the
-- act of a reviewer who has read the comparison.
--
-- `management_zones.coverage_status` describes the GEOMETRY: that North Ground has
-- the authority's own boundary for this unit. It says nothing about whether any
-- rule inside it has been certified — that lives in regulatory_rules and is a
-- separate claim that must never be inferred from this one.

create or replace function public.compare_zone_run(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  run public.zone_ingest_runs;
  result jsonb;
begin
  select * into run from public.zone_ingest_runs where id = p_run_id;
  if run.id is null then raise exception 'Unknown ingest run'; end if;

  with incoming as (
    select f.official_identifier as identifier,
           f.geometry,
           extensions.ST_Area(f.geometry::extensions.geography) / 1000000.0 as km2,
           extensions.ST_IsValid(f.geometry) as valid,
           extensions.ST_IsValidReason(f.geometry) as reason
    from public.zone_ingest_features f
    where f.run_id = p_run_id
  ),
  published as (
    select z.official_identifier as identifier,
           extensions.ST_Area(z.geometry::extensions.geography) / 1000000.0 as km2
    from public.management_zones z
    where z.jurisdiction_id = run.jurisdiction_id
  ),
  moved as (
    select i.identifier, p.km2 as published_km2, i.km2 as incoming_km2,
           case when p.km2 = 0 then 1 else abs(i.km2 - p.km2) / p.km2 end as fraction
    from incoming i join published p on p.identifier = i.identifier
  )
  select jsonb_build_object(
    'incoming', (select count(*) from incoming),
    'published', (select count(*) from published),
    'added', coalesce((select jsonb_agg(identifier order by identifier)
                       from incoming where identifier not in (select identifier from published)), '[]'::jsonb),
    'removed', coalesce((select jsonb_agg(identifier order by identifier)
                         from published where identifier not in (select identifier from incoming)), '[]'::jsonb),
    'invalid', coalesce((select jsonb_agg(jsonb_build_object('identifier', identifier, 'reason', reason) order by identifier)
                         from incoming where not valid), '[]'::jsonb),
    'areaChanged', coalesce((select jsonb_agg(jsonb_build_object(
                               'identifier', identifier,
                               'publishedKm2', round(published_km2::numeric, 2),
                               'incomingKm2', round(incoming_km2::numeric, 2),
                               'percent', round((fraction * 100)::numeric, 3)) order by fraction desc)
                             from moved where fraction > 0.005), '[]'::jsonb),
    'unchanged', (select count(*) from moved where fraction <= 0.005)
  ) into result;

  update public.zone_ingest_runs set status = 'COMPARED' where id = p_run_id and status = 'STAGED';
  return result;
end;
$$;

create or replace function public.publish_zone_run(p_run_id uuid, p_zone_type text, p_source_canonical_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  run public.zone_ingest_runs;
  source_row public.regulatory_sources;
  invalid_count integer;
  inserted integer := 0;
  updated integer := 0;
begin
  select * into run from public.zone_ingest_runs where id = p_run_id;
  if run.id is null then raise exception 'Unknown ingest run'; end if;

  select * into source_row from public.regulatory_sources where canonical_id = p_source_canonical_id;
  if source_row.id is null then raise exception 'Unknown source %', p_source_canonical_id; end if;

  -- An invalid polygon is never promoted. A boundary North Ground cannot reason
  -- about is worse than no boundary at all.
  select count(*) into invalid_count
  from public.zone_ingest_features
  where run_id = p_run_id and not extensions.ST_IsValid(geometry);
  if invalid_count > 0 then
    raise exception 'Run contains % invalid geometries; refusing to publish', invalid_count;
  end if;

  with promoted as (
    insert into public.management_zones (
      canonical_id, jurisdiction_id, zone_type, official_identifier, official_name, source_id,
      source_retrieved_at, source_verified_at, source_version, coverage_status, location_accuracy, geometry
    )
    select
      'management_zone:ca-on-wmu-' || lower(regexp_replace(f.official_identifier, '[^A-Za-z0-9-]+', '-', 'g')),
      run.jurisdiction_id, p_zone_type, f.official_identifier,
      'Wildlife Management Unit ' || f.official_identifier,
      source_row.id, run.retrieved_at, run.retrieved_at, run.source_version,
      'VERIFIED', f.attributes ->> 'locationAccuracy',
      extensions.ST_Multi(f.geometry)
    from public.zone_ingest_features f
    where f.run_id = p_run_id
    on conflict (canonical_id) do update set
      geometry = excluded.geometry,
      source_retrieved_at = excluded.source_retrieved_at,
      source_verified_at = excluded.source_verified_at,
      source_version = excluded.source_version,
      location_accuracy = excluded.location_accuracy,
      official_name = excluded.official_name
    returning (xmax = 0) as was_insert
  )
  select count(*) filter (where was_insert), count(*) filter (where not was_insert)
  into inserted, updated from promoted;

  update public.zone_ingest_runs set status = 'PUBLISHED' where id = p_run_id;

  return jsonb_build_object('inserted', inserted, 'updated', updated,
    'totalZones', (select count(*) from public.management_zones where jurisdiction_id = run.jurisdiction_id));
end;
$$;

revoke all on function public.compare_zone_run(uuid) from public, anon, authenticated;
revoke all on function public.publish_zone_run(uuid, text, text) from public, anon, authenticated;
grant execute on function public.compare_zone_run(uuid) to service_role;
grant execute on function public.publish_zone_run(uuid, text, text) to service_role;

comment on column public.management_zones.coverage_status is
  'Geometry/identity verification only: North Ground holds the authority''s own boundary for this unit. It is NOT a claim that any rule inside it has been certified.';
