-- Certification rails found two defects that must be fixed together:
--
-- 1. An authority can publish a polygon with a zero-area self-intersection.  A
--    raw invalid polygon cannot be promoted, but rejecting a topologically
--    lossless ST_MakeValid repair leaves the registry permanently stale.  This
--    RPC permits only repairs whose symmetric difference is at most one square
--    metre and records the authority defect on the staged feature.
-- 2. PostGIS geography interprets a sparse longitude/latitude edge as a
--    great-circle arc.  The authority's GeoJSON edge is the straight segment in
--    its published coordinate space. Segmentizing before casting to geography
--    keeps the distance measurement on that published edge.

create or replace function public.normalize_zone_ingest_geometries(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  run public.zone_ingest_runs;
  feature record;
  repaired extensions.geometry;
  difference_m2 double precision;
  normalized jsonb := '[]'::jsonb;
begin
  select * into run from public.zone_ingest_runs where id = p_run_id;
  if run.id is null then raise exception 'Unknown ingest run'; end if;
  if run.status <> 'STAGED' then
    raise exception 'Run % is %, not STAGED', p_run_id, run.status;
  end if;

  for feature in
    select source_feature_id, geometry, extensions.ST_IsValidReason(geometry) as reason
    from public.zone_ingest_features
    where run_id = p_run_id and not extensions.ST_IsValid(geometry)
    order by source_feature_id
  loop
    repaired := extensions.ST_Multi(
      extensions.ST_CollectionExtract(extensions.ST_MakeValid(feature.geometry), 3)
    );

    if repaired is null or extensions.ST_IsEmpty(repaired) or not extensions.ST_IsValid(repaired) then
      raise exception 'Feature % cannot be normalized to valid polygonal geometry', feature.source_feature_id;
    end if;

    difference_m2 := extensions.ST_Area(
      extensions.ST_SymDifference(feature.geometry, repaired)::extensions.geography
    );
    if difference_m2 > 1.0 then
      raise exception 'Feature % normalization would move %.3f square metres; refusing',
        feature.source_feature_id, difference_m2;
    end if;

    update public.zone_ingest_features
    set geometry = repaired,
        attributes = coalesce(attributes, '{}'::jsonb) || jsonb_build_object(
          'geometryNormalization', jsonb_build_object(
            'method', 'ST_MakeValid',
            'authorityValidityError', feature.reason,
            'symmetricDifferenceSquareMetres', round(difference_m2::numeric, 6)
          )
        )
    where run_id = p_run_id and source_feature_id = feature.source_feature_id;

    normalized := normalized || jsonb_build_array(jsonb_build_object(
      'sourceFeatureId', feature.source_feature_id,
      'authorityValidityError', feature.reason,
      'symmetricDifferenceSquareMetres', round(difference_m2::numeric, 6),
      'points', extensions.ST_NPoints(repaired),
      'polygons', extensions.ST_NumGeometries(repaired)
    ));
  end loop;

  return jsonb_build_object('normalized', normalized, 'count', jsonb_array_length(normalized));
end;
$$;

revoke all on function public.normalize_zone_ingest_geometries(uuid) from public, anon, authenticated;
grant execute on function public.normalize_zone_ingest_geometries(uuid) to service_role;

create or replace function public.resolve_management_zone(p_latitude double precision, p_longitude double precision)
returns table(
  canonical_id text, official_name text, location_accuracy text, source_canonical_id text,
  boundary_distance_meters integer, near_boundary boolean, display_geometry jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with point as (
    select extensions.ST_SetSRID(extensions.ST_MakePoint(p_longitude, p_latitude), 4326) as geometry
    where p_latitude between -90 and 90 and p_longitude between -180 and 180
  ),
  hits as (
    select p.management_zone_id as id
    from point
    join public.management_zone_parts p
      on p.geometry operator(extensions.&&) point.geometry
     and extensions.ST_Intersects(p.geometry, point.geometry)
    union
    select z.id
    from point
    join public.management_zones z
      on z.geometry operator(extensions.&&) point.geometry
     and extensions.ST_Intersects(z.geometry, point.geometry)
    where not exists (select 1 from public.management_zone_parts p where p.management_zone_id = z.id)
  )
  select
    zone.canonical_id,
    zone.official_name,
    zone.location_accuracy,
    source.canonical_id,
    round(distance.meters)::integer,
    distance.meters <= 150,
    coalesce(
      (select extensions.ST_AsGeoJSON(d.geometry)::jsonb
         from public.management_zone_display d
        where d.management_zone_id = zone.id and d.level = 0),
      extensions.ST_AsGeoJSON(extensions.ST_SimplifyPreserveTopology(zone.geometry, 0.00015))::jsonb
    )
  from hits
  join public.management_zones zone on zone.id = hits.id
  join public.regulatory_sources source on source.id = zone.source_id
  cross join point
  cross join lateral (
    select coalesce(
      public.zone_boundary_distance_meters(zone.id, point.geometry),
      extensions.ST_Distance(
        extensions.ST_Segmentize(extensions.ST_Boundary(zone.geometry), 0.01)::extensions.geography,
        point.geometry::extensions.geography
      )
    ) as meters
  ) distance
  where zone.coverage_status = 'VERIFIED'
  order by zone.canonical_id
  limit 2;
$$;

revoke all on function public.resolve_management_zone(double precision, double precision) from public, anon, authenticated;
grant execute on function public.resolve_management_zone(double precision, double precision) to service_role;
