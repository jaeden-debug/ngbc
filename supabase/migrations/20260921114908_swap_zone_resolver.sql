-- The served resolver takes the body proven beside it as resolve_management_zone_v2.
--
-- Proven on 2026-09-21, immediately before this swap, at every sample point
-- zone_sample_points yields for Ontario (453), Manitoba (186) and Alberta (567),
-- plus five controls: 1,211 points, 0 differences in zone, official name, source,
-- location accuracy, boundary distance, near-boundary flag or display geometry.
-- Those zones have no derivatives, so they are found and measured exactly as
-- before. Zones with derivatives (Québec's 59) are found through their
-- subdivided parts and measured by zone_boundary_distance_meters; without this
-- body, serving them would simplify and measure zone 21's 838,537 vertices on
-- every request.
--
-- This does NOT change how Ontario, Manitoba or Alberta boundary distance is
-- measured (great-circle arcs on long edges). That defect is a separate change.
--
-- Same name, signature, result and grants, so no caller changes. The candidate
-- is dropped once its body is served, so the two cannot drift apart.
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
      extensions.ST_Distance(extensions.ST_Boundary(zone.geometry)::extensions.geography, point.geometry::extensions.geography)
    ) as meters
  ) distance
  where zone.coverage_status = 'VERIFIED'
  order by zone.canonical_id
  limit 2;
$$;

revoke all on function public.resolve_management_zone(double precision, double precision) from public, anon, authenticated;
grant execute on function public.resolve_management_zone(double precision, double precision) to service_role;

drop function public.resolve_management_zone_v2(double precision, double precision);
