-- Exact boundary distance for zones measured through their boundary parts.
--
-- The first resolve_management_zone_v2 measured the 32 boundary pieces nearest
-- the point in DEGREES. Nearest in degrees is not nearest on the ground: at
-- Québec's latitudes a degree of longitude spans half to three-quarters of a
-- degree of latitude, so in a dense archipelago the piece that is truly nearest
-- can rank below 32, and a point beside a boundary could be told it is further
-- away. That would suppress the near-boundary warning this distance exists for.
--
-- zone_boundary_distance_meters measures pieces in order of their distance in
-- degrees and stops only when no remaining piece can be nearer: a piece d degrees
-- away is at least d × (the fewest metres a degree can span between here and the
-- current best) metres away on the ellipsoid. A meridian degree is never shorter
-- than 110,574 m, and a parallel degree never shorter than 111,319 m × cos(lat)
-- at the highest latitude a nearer piece could reach. So the result is the
-- distance to the whole boundary, not an estimate of it, and it usually costs a
-- handful of pieces.
--
-- It also measures what zone membership tests. Membership treats each boundary
-- edge as a straight line in longitude and latitude; the geography type treats
-- the same two vertices as a great-circle arc, which bows poleward of the line.
-- Québec's longest edges (about 1° of longitude, in the Gulf) bow by up to about
-- 130 m, near the 150 m warning threshold. Each piece is therefore divided into
-- edges of at most 0.01° before it is measured, where the bow is about 1 cm.
--
-- Zones without boundary parts get null here, and the resolver measures them
-- exactly as it always has.
create or replace function public.zone_boundary_distance_meters(p_management_zone_id uuid, p_point extensions.geometry)
returns double precision
language plpgsql
stable
set search_path = ''
as $$
declare
  best double precision;
  piece record;
  reach double precision;
  metres_per_degree double precision;
begin
  -- Without this, the ordered scan below would walk every piece in the table
  -- looking for one that does not exist.
  if not exists (select 1 from public.management_zone_boundary_parts b where b.management_zone_id = p_management_zone_id) then
    return null;
  end if;

  for piece in
    select b.geometry, extensions.ST_Distance(b.geometry, p_point) as degrees
      from public.management_zone_boundary_parts b
     where b.management_zone_id = p_management_zone_id
     order by b.geometry operator(extensions.<->) p_point
  loop
    if best is not null then
      reach := least(89.9, abs(extensions.ST_Y(p_point)) + (best + 1.0) / 110574.0);
      metres_per_degree := least(110574.0, 111319.0 * cos(radians(reach)));
      -- One metre of margin absorbs the centimetre the divided edges can still
      -- bow and any rounding in the ellipsoidal measure.
      exit when piece.degrees * metres_per_degree > best + 1.0;
    end if;
    best := least(coalesce(best, 'infinity'::double precision), extensions.ST_Distance(
      extensions.ST_Segmentize(piece.geometry, 0.01)::extensions.geography,
      p_point::extensions.geography));
  end loop;
  return best;
end;
$$;

revoke all on function public.zone_boundary_distance_meters(uuid, extensions.geometry) from public, anon, authenticated;
grant execute on function public.zone_boundary_distance_meters(uuid, extensions.geometry) to service_role;

-- The resolver beside the live one, now measuring through the function above.
-- A zone without derivatives is found and measured exactly as the live resolver
-- does it; that path is what the identity proof before the swap compares.
create or replace function public.resolve_management_zone_v2(p_latitude double precision, p_longitude double precision)
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

revoke all on function public.resolve_management_zone_v2(double precision, double precision) from public, anon, authenticated;
grant execute on function public.resolve_management_zone_v2(double precision, double precision) to service_role;
