-- A full authority run can contain geometries too large to upsert inside the
-- REST statement timeout even when only one designation changed. Promote an
-- explicitly reviewed subset without weakening publish_zone_run's full-layer
-- gate. The run remains STAGED until the caller certifies the complete
-- inventory and marks it accordingly.
create or replace function public.publish_zone_run_features(
  p_run_id uuid,
  p_zone_type text,
  p_source_canonical_id text,
  p_official_identifiers text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  run public.zone_ingest_runs;
  source_row public.regulatory_sources;
  requested integer;
  selected_count integer;
  invalid_count integer;
  promoted integer;
begin
  select * into run from public.zone_ingest_runs where id = p_run_id;
  if run.id is null then raise exception 'Unknown ingest run'; end if;
  if run.status not in ('STAGED', 'COMPARED') then raise exception 'Run % is %, not publishable', p_run_id, run.status; end if;
  select * into source_row from public.regulatory_sources where canonical_id = p_source_canonical_id;
  if source_row.id is null or source_row.jurisdiction_id <> run.jurisdiction_id then
    raise exception 'Source does not match ingest run';
  end if;
  if source_row.review_status not in ('VERIFIED', 'PUBLISHED') or source_row.verified_at is null then
    raise exception 'Source % is not verified', p_source_canonical_id;
  end if;

  select count(distinct identifier), count(*)
  into requested, selected_count
  from unnest(coalesce(p_official_identifiers, array[]::text[])) identifier;
  if requested = 0 or requested <> selected_count then raise exception 'Identifiers must be nonempty and unique'; end if;

  select count(*), count(*) filter (where not extensions.ST_IsValid(geometry) or extensions.ST_IsEmpty(geometry))
  into selected_count, invalid_count
  from public.zone_ingest_features
  where run_id = p_run_id and official_identifier = any(p_official_identifiers);
  if selected_count <> requested then raise exception 'Requested % features but found %', requested, selected_count; end if;
  if invalid_count > 0 then raise exception 'Selected features contain % invalid geometries', invalid_count; end if;

  with promoted_rows as (
    insert into public.management_zones (
      canonical_id, jurisdiction_id, zone_type, official_identifier, official_name, source_id,
      source_retrieved_at, source_verified_at, source_version, coverage_status, location_accuracy, geometry
    )
    select f.canonical_id, run.jurisdiction_id, p_zone_type, f.official_identifier, f.official_name, source_row.id,
      run.retrieved_at, run.retrieved_at, run.source_version, 'VERIFIED', f.attributes ->> 'locationAccuracy', f.geometry
    from public.zone_ingest_features f
    where f.run_id = p_run_id and f.official_identifier = any(p_official_identifiers)
    on conflict (canonical_id) do update set
      geometry = excluded.geometry, source_id = excluded.source_id,
      source_retrieved_at = excluded.source_retrieved_at, source_verified_at = excluded.source_verified_at,
      source_version = excluded.source_version, location_accuracy = excluded.location_accuracy,
      official_identifier = excluded.official_identifier, official_name = excluded.official_name
    returning 1
  ) select count(*) into promoted from promoted_rows;

  return jsonb_build_object('promoted', promoted, 'identifiers', p_official_identifiers);
end;
$$;

revoke all on function public.publish_zone_run_features(uuid, text, text, text[]) from public, anon, authenticated;
grant execute on function public.publish_zone_run_features(uuid, text, text, text[]) to service_role;
