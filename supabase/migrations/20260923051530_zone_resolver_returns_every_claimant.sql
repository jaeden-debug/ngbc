-- A conflict report that drops a party to the conflict is not a conflict report.
--
-- `resolve_management_zone` ended with `limit 2`, which was enough while a
-- point could sit in at most one jurisdiction's geography plus a neighbour's.
-- It is not enough now. At 52.38076152, -62.50878603 in Labrador the point is
-- inside THREE published geographies — Newfoundland's black bear area 200,
-- Newfoundland's moose area 050, and Québec's zone 19N — and ordering by
-- canonical_id meant the two Newfoundland rows came back while Québec, the
-- other claimant, was dropped before the application ever saw it.
--
-- That is not a Newfoundland stacking problem. Québec and Newfoundland both
-- publish hunting geography over Labrador: Québec's zone 19N covers 99.8% of
-- NL moose area 050, 87.0% of 049, 84.0% of 086 and 53.2% of 060. Both are the
-- authorities' own geometry, each parity-certified against its own source.
-- Neither ingest is defective; serving Newfoundland revealed a conflict that
-- was always in the data and had been resolved silently in Québec's favour
-- because Québec's was the only claim North Ground held.
--
-- This ordering matters: the caller filters species-scoped layers out of the
-- candidates, and that filter is only safe once the candidates are complete.
-- Narrowing an already-truncated set would have left one Newfoundland row and
-- resolved a disputed point silently to one claimant.
--
-- Eight rather than unbounded: the limit exists so one point cannot pull an
-- unbounded amount of geometry, and every row carries a level-0 drawing. Eight
-- is far above any real claim count — three is the worst observed — while
-- still bounding the work. If a point ever returns eight, that is itself a
-- signal worth failing on rather than a number to raise.

create or replace function public.resolve_management_zone(p_latitude double precision, p_longitude double precision)
returns table(canonical_id text, official_name text, location_accuracy text, source_canonical_id text, boundary_distance_meters integer, near_boundary boolean, display_geometry jsonb)
language plpgsql
stable
security definer
set search_path to ''
set plan_cache_mode to 'force_custom_plan'
as $function$
declare
  point extensions.geometry;
  unindexed text;
begin
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    return;
  end if;
  point := extensions.ST_SetSRID(extensions.ST_MakePoint(p_longitude, p_latitude), 4326);

  select z.canonical_id into unindexed
  from public.management_zones z
  where z.geometry operator(extensions.&&) point
    and z.coverage_status = 'VERIFIED'
    and not exists (select 1 from public.management_zone_parts p where p.management_zone_id = z.id)
  limit 1;
  if unindexed is not null then
    raise exception 'VERIFIED zone % has no point-lookup parts; refusing to answer from an incomplete index', unindexed
      using errcode = 'check_violation';
  end if;

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
  limit 8;
end;
$function$;
