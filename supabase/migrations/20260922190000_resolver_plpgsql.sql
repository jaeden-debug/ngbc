-- The zone resolver, same signature and same answers, in PL/pgSQL.
--
-- As a SECURITY DEFINER set-returning SQL function it could not be inlined, so
-- every call planned its query afresh: about 224 ms of planning for a WMU 26
-- point whose execution takes about 10 ms warm. PL/pgSQL prepares the query once
-- per connection and reuses the plan.
--
-- The full-geometry branch of the point lookup is removed. Every published zone
-- now has point-lookup parts (ON 151, MB 62, AB 189, QC 59, BC 225, built
-- 2026-09-22), and `scripts/build-zone-derivatives.mjs --missing-only` is part
-- of publishing a zone. A zone published without parts is therefore not found at
-- all: the answer is "no zone", which Hunt reports as UNKNOWN, and the
-- authority-first audit fails on it. It is never answered with a wrong zone.
--
-- The boundary distance keeps its full-geometry fallback for a zone without
-- boundary parts; COALESCE evaluates it only then.

create or replace function public.resolve_management_zone(p_latitude double precision, p_longitude double precision)
returns table(
  canonical_id text, official_name text, location_accuracy text, source_canonical_id text,
  boundary_distance_meters integer, near_boundary boolean, display_geometry jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  point extensions.geometry;
begin
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    return;
  end if;
  point := extensions.ST_SetSRID(extensions.ST_MakePoint(p_longitude, p_latitude), 4326);

  return query
  with hits as (
    select distinct p.management_zone_id as id
    from public.management_zone_parts p
    where p.geometry operator(extensions.&&) point
      and extensions.ST_Intersects(p.geometry, point)
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
  cross join lateral (
    select coalesce(
      public.zone_boundary_distance_meters(zone.id, point),
      extensions.ST_Distance(
        extensions.ST_Segmentize(extensions.ST_Boundary(zone.geometry), 0.01)::extensions.geography,
        point::extensions.geography
      )
    ) as meters
  ) distance
  where zone.coverage_status = 'VERIFIED'
  order by zone.canonical_id
  limit 2;
end;
$$;

revoke all on function public.resolve_management_zone(double precision, double precision) from public, anon, authenticated;
grant execute on function public.resolve_management_zone(double precision, double precision) to service_role;
