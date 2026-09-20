-- Representative points for spatial parity certification.
--
-- `ST_PointOnSurface` is used rather than a centroid because a centroid can fall
-- outside a concave or multi-part unit, which would make a parity failure look
-- like a data error when it was only a badly chosen sample point.
--
-- `edge_*` walks a short distance inward from the closest boundary point, giving
-- the near-boundary fixtures the certification needs without hand-picking
-- coordinates that would silently stop covering new units as the registry grows.

create or replace function public.zone_sample_points()
returns table (
  official_identifier text,
  canonical_id text,
  inside_latitude double precision,
  inside_longitude double precision,
  edge_latitude double precision,
  edge_longitude double precision,
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
    extensions.ST_Y(extensions.ST_PointOnSurface(z.geometry)) as inside_latitude,
    extensions.ST_X(extensions.ST_PointOnSurface(z.geometry)) as inside_longitude,
    extensions.ST_Y(edge.point) as edge_latitude,
    extensions.ST_X(edge.point) as edge_longitude,
    extensions.ST_Area(z.geometry::extensions.geography) / 1000000.0 as area_km2,
    extensions.ST_NPoints(z.geometry) as vertices
  from public.management_zones z
  cross join lateral (
    select extensions.ST_LineInterpolatePoint(
             extensions.ST_MakeLine(
               extensions.ST_PointOnSurface(z.geometry),
               extensions.ST_ClosestPoint(extensions.ST_Boundary(z.geometry),
                                          extensions.ST_PointOnSurface(z.geometry))
             ), 0.995) as point
  ) edge
  order by z.official_identifier;
$$;

revoke all on function public.zone_sample_points() from public, anon, authenticated;
grant execute on function public.zone_sample_points() to service_role;
