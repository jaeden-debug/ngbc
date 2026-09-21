-- Level 4 drops only islands and holes smaller than one tolerance-square
-- (about 0.6 ha at 0.0008 degrees). Keeping all 9,311 of zone 21's holes at that
-- tolerance did not finish in a minute. A drawing only; membership never uses it.
create or replace function public.build_zone_display(p_management_zone_id uuid, p_level smallint, p_tolerance double precision)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  drawn extensions.geometry;
  min_area double precision := case when p_level < 4 then (p_tolerance * p_tolerance) * 4 else p_tolerance * p_tolerance end;
begin
  with polygons as (
    select part.path[1] as polygon_index, part.geom
    from public.management_zones z
    cross join lateral extensions.ST_Dump(z.geometry) part
    where z.id = p_management_zone_id
  ),
  rings as (
    select polygons.polygon_index, ring.path[1] as ring_index, ring.geom as ring
    from polygons
    cross join lateral extensions.ST_DumpRings(polygons.geom) ring
  ),
  kept as (
    select polygon_index,
           max(case when ring_index = 0 then extensions.ST_ExteriorRing(ring) end) as shell,
           array_agg(extensions.ST_ExteriorRing(ring) order by ring_index)
             filter (where ring_index > 0 and extensions.ST_Area(ring) >= min_area) as holes
    from rings
    group by polygon_index
    having max(case when ring_index = 0 then extensions.ST_Area(ring) end) >= min_area
  )
  select extensions.ST_Multi(extensions.ST_CollectionExtract(extensions.ST_Collect(
           extensions.ST_SimplifyPreserveTopology(
             case when holes is null then extensions.ST_MakePolygon(shell)
                  else extensions.ST_MakePolygon(shell, holes) end,
             p_tolerance)), 3))
  into drawn
  from kept;

  if drawn is null or extensions.ST_IsEmpty(drawn) then
    select extensions.ST_Multi(extensions.ST_SimplifyPreserveTopology(z.geometry, p_tolerance))
    into drawn from public.management_zones z where z.id = p_management_zone_id;
  end if;

  insert into public.management_zone_display (management_zone_id, level, tolerance, vertices, geometry)
  values (p_management_zone_id, p_level, p_tolerance, extensions.ST_NPoints(drawn), drawn)
  on conflict (management_zone_id, level) do update set
    tolerance = excluded.tolerance, vertices = excluded.vertices, geometry = excluded.geometry;
  return extensions.ST_NPoints(drawn);
end;
$$;

revoke all on function public.build_zone_display(uuid, smallint, double precision) from public, anon, authenticated;
