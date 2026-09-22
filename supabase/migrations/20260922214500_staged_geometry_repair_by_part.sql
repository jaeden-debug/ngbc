-- Repair an oversized invalid authority geometry one polygon at a time.
--
-- `normalize_zone_ingest_geometry` repairs a staged feature in one statement.
-- That is fine for ordinary features and impossible for large ones:
-- Newfoundland's black bear area 200 is 197,116 vertices in 4,221 polygons,
-- and ST_MakeValid over the whole feature exceeds the 8-second statement
-- timeout every REST statement runs under. Simplifying it would fit, and would
-- also move a boundary, which ingestion must never do.
--
-- So the repair is staged, as zone chunks and special areas are: each call
-- repairs a small batch of polygons into a parts table, and one assembly
-- statement rebuilds the feature. The guard is unchanged and still applies to
-- the WHOLE geometry: if the assembled result moves more than one square metre
-- of symmetric difference from what the authority published, nothing is
-- written. What was repaired is recorded on the feature, as the single-
-- statement path records it, so the provenance is auditable.

create unlogged table if not exists public.zone_ingest_geometry_repair_parts (
  run_id uuid not null references public.zone_ingest_runs(id) on delete cascade,
  source_feature_id text not null,
  part_index integer not null check (part_index >= 1),
  geometry extensions.geometry(MultiPolygon, 4326) not null,
  created_at timestamptz not null default now(),
  primary key (run_id, source_feature_id, part_index)
);

alter table public.zone_ingest_geometry_repair_parts enable row level security;
revoke all on public.zone_ingest_geometry_repair_parts from public, anon, authenticated;
grant select on public.zone_ingest_geometry_repair_parts to service_role;

comment on table public.zone_ingest_geometry_repair_parts is
  'Repaired polygons of one staged feature, held only until assemble_zone_ingest_geometry_repair rebuilds it. Never read by Hunt.';

/**
 * Repair polygons [p_from, p_from + p_count) of a staged feature.
 * Returns how many polygons the feature has and how many are now repaired, so
 * the caller can walk it. Repairing a polygon twice is harmless.
 */
create or replace function public.repair_zone_ingest_geometry_parts(
  p_run_id uuid,
  p_source_feature_id text,
  p_from integer,
  p_count integer default 200
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  run public.zone_ingest_runs;
  feature public.zone_ingest_features;
  polygons integer;
  repaired integer;
begin
  select * into run from public.zone_ingest_runs where id = p_run_id;
  if run.id is null then raise exception 'Unknown ingest run'; end if;
  if run.status <> 'STAGED' then raise exception 'Run % is %, not STAGED', p_run_id, run.status; end if;
  select * into feature from public.zone_ingest_features
   where run_id = p_run_id and source_feature_id = p_source_feature_id;
  if feature.run_id is null then raise exception 'Unknown staged feature %', p_source_feature_id; end if;
  if p_from < 1 or p_count < 1 then raise exception 'A batch starts at polygon 1 or later'; end if;

  polygons := extensions.ST_NumGeometries(feature.geometry);

  insert into public.zone_ingest_geometry_repair_parts (run_id, source_feature_id, part_index, geometry)
  select p_run_id, p_source_feature_id, i,
    extensions.ST_Multi(extensions.ST_CollectionExtract(
      extensions.ST_MakeValid(extensions.ST_GeometryN(feature.geometry, i)), 3))
  from generate_series(p_from, least(p_from + p_count - 1, polygons)) i
  on conflict (run_id, source_feature_id, part_index) do update set geometry = excluded.geometry;

  select count(*) into repaired from public.zone_ingest_geometry_repair_parts
   where run_id = p_run_id and source_feature_id = p_source_feature_id;

  return jsonb_build_object('polygons', polygons, 'repaired', repaired,
    'next', case when repaired >= polygons then null else repaired + 1 end);
end;
$$;

/**
 * Rebuild the feature from its repaired polygons, under the same ≤1 m² guard
 * the single-statement repair applies, and record what was repaired.
 */
create or replace function public.assemble_zone_ingest_geometry_repair(p_run_id uuid, p_source_feature_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  run public.zone_ingest_runs;
  feature public.zone_ingest_features;
  polygons integer;
  parts integer;
  repaired extensions.geometry;
  validity_error text;
  difference_m2 double precision;
begin
  select * into run from public.zone_ingest_runs where id = p_run_id;
  if run.id is null then raise exception 'Unknown ingest run'; end if;
  if run.status <> 'STAGED' then raise exception 'Run % is %, not STAGED', p_run_id, run.status; end if;
  select * into feature from public.zone_ingest_features
   where run_id = p_run_id and source_feature_id = p_source_feature_id;
  if feature.run_id is null then raise exception 'Unknown staged feature %', p_source_feature_id; end if;

  polygons := extensions.ST_NumGeometries(feature.geometry);
  select count(*) into parts from public.zone_ingest_geometry_repair_parts
   where run_id = p_run_id and source_feature_id = p_source_feature_id;
  if parts <> polygons then
    raise exception 'Feature % has % of % polygons repaired; refusing to assemble', p_source_feature_id, parts, polygons;
  end if;

  validity_error := extensions.ST_IsValidReason(feature.geometry);

  /* Collecting is linear; unioning thousands of polygons is not. Each polygon
     was repaired on its own, so collecting them is normally already valid, and
     the union is kept only for the case where the authority's polygons overlap
     each other. */
  select extensions.ST_Multi(extensions.ST_CollectionExtract(extensions.ST_Collect(geometry), 3))
    into repaired
  from public.zone_ingest_geometry_repair_parts
  where run_id = p_run_id and source_feature_id = p_source_feature_id;

  if repaired is not null and not extensions.ST_IsValid(repaired) then
    repaired := extensions.ST_Multi(extensions.ST_CollectionExtract(extensions.ST_UnaryUnion(repaired), 3));
  end if;

  if repaired is null or extensions.ST_IsEmpty(repaired) or not extensions.ST_IsValid(repaired) then
    raise exception 'Feature % cannot be repaired to valid polygonal geometry', p_source_feature_id;
  end if;

  difference_m2 := extensions.ST_Area(extensions.ST_SymDifference(feature.geometry, repaired)::extensions.geography);
  if difference_m2 > 1.0 then
    raise exception 'Feature % repair would move %.3f square metres; refusing', p_source_feature_id, difference_m2;
  end if;

  update public.zone_ingest_features
  set geometry = repaired,
      attributes = coalesce(attributes, '{}'::jsonb) || jsonb_build_object(
        'geometryNormalization', jsonb_build_object(
          'method', 'ST_MakeValid by polygon, assembled',
          'authorityValidityError', validity_error,
          'symmetricDifferenceSquareMetres', round(difference_m2::numeric, 6),
          'polygonsBefore', polygons,
          'polygonsAfter', extensions.ST_NumGeometries(repaired),
          'verticesBefore', extensions.ST_NPoints(feature.geometry),
          'verticesAfter', extensions.ST_NPoints(repaired)
        )
      )
  where run_id = p_run_id and source_feature_id = p_source_feature_id;

  delete from public.zone_ingest_geometry_repair_parts
   where run_id = p_run_id and source_feature_id = p_source_feature_id;

  return jsonb_build_object(
    'normalized', true,
    'sourceFeatureId', p_source_feature_id,
    'authorityValidityError', validity_error,
    'symmetricDifferenceSquareMetres', round(difference_m2::numeric, 6),
    'polygonsBefore', polygons,
    'polygonsAfter', extensions.ST_NumGeometries(repaired),
    'points', extensions.ST_NPoints(repaired)
  );
end;
$$;

revoke all on function public.repair_zone_ingest_geometry_parts(uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.assemble_zone_ingest_geometry_repair(uuid, text) from public, anon, authenticated;
grant execute on function public.repair_zone_ingest_geometry_parts(uuid, text, integer, integer) to service_role;
grant execute on function public.assemble_zone_ingest_geometry_repair(uuid, text) to service_role;
