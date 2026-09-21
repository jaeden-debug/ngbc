-- Zone derivatives: fast lookups and bounded drawings for very large zones.
--
-- The production resolver tests the point against each zone's full geometry,
-- measures the distance to its full boundary, and simplifies the full geometry
-- for display — on every request. That is fine for Ontario's units. It is not
-- fine for Québec's zone 21 (the St Lawrence estuary and Gulf: one polygon of
-- 838,537 vertices with 9,311 holes) or 19SE (8,091 islands), where each of
-- those three steps walks the whole ring set, and a parity certification makes
-- hundreds of such requests.
--
-- So each large zone gets three derivatives, computed once per published
-- geometry and never edited by hand:
--
--   parts           ST_Subdivide of the zone, ≤256 vertices each, GiST-indexed.
--                   Point-in-zone becomes an index probe plus a small polygon test.
--                   Subdivision cuts a polygon along internal lines only; the union
--                   of the parts is the zone, so membership is unchanged.
--   boundary parts  ST_Subdivide of the zone's boundary, GiST-indexed, so the
--                   distance to the boundary is measured against the few nearest
--                   pieces rather than all 838,537 vertices.
--   display         drawings at fixed tolerances (level 0 is the result outline).
--                   A DRAWING, never a boundary determination: membership is
--                   always decided against the authoritative geometry's parts.
--
-- Zones without derivatives keep the original behaviour exactly: the resolver
-- falls back to the full geometry, so Ontario's answers are unchanged until its
-- derivatives are built and re-certified.

create table if not exists public.management_zone_parts (
  management_zone_id uuid not null references public.management_zones(id) on delete cascade,
  part_index integer not null,
  geometry extensions.geometry(Polygon, 4326) not null,
  primary key (management_zone_id, part_index)
);
create index if not exists management_zone_parts_geometry_gix
  on public.management_zone_parts using gist (geometry);

create table if not exists public.management_zone_boundary_parts (
  management_zone_id uuid not null references public.management_zones(id) on delete cascade,
  part_index integer not null,
  geometry extensions.geometry(LineString, 4326) not null,
  primary key (management_zone_id, part_index)
);
create index if not exists management_zone_boundary_parts_geometry_gix
  on public.management_zone_boundary_parts using gist (geometry);

create table if not exists public.management_zone_display (
  management_zone_id uuid not null references public.management_zones(id) on delete cascade,
  level smallint not null check (level between 0 and 4),
  tolerance double precision not null check (tolerance > 0),
  vertices integer not null,
  geometry extensions.geometry(MultiPolygon, 4326) not null,
  primary key (management_zone_id, level)
);
create index if not exists management_zone_display_geometry_gix
  on public.management_zone_display using gist (geometry);

alter table public.management_zone_parts enable row level security;
alter table public.management_zone_boundary_parts enable row level security;
alter table public.management_zone_display enable row level security;
revoke all on public.management_zone_parts, public.management_zone_boundary_parts, public.management_zone_display
  from anon, authenticated;
grant select on public.management_zone_parts, public.management_zone_boundary_parts, public.management_zone_display
  to service_role;

comment on table public.management_zone_parts is
  'ST_Subdivide of a zone''s authoritative geometry, for index-backed point lookups. Its union is the zone.';
comment on table public.management_zone_display is
  'Generalised drawings of a zone. A drawing, never a boundary determination.';

/* ── Building derivatives, one zone at a time ──────────────────────────────── */

-- Display levels. Level 0 is the outline returned with a point answer; levels 1
-- to 4 serve the map at the tolerances zone-geometry.ts asks for by zoom.
--
-- Below a few tolerance-squares, an island or a hole cannot be seen at the scale
-- the drawing is for, so it is left out of that drawing. Zone 21 is one polygon
-- with 9,311 holes: without dropping small holes its outline can never fall below
-- 37,000 vertices however far it is simplified. Level 4, the finest map drawing,
-- keeps every island and hole (see 20260921035259_zone_display_level4_rule.sql).
--
-- In the kept set: the exterior ring (index 0) of every polygon large enough to
-- see, and the holes inside it that are large enough to see. When nothing is
-- large enough to see at this scale, the whole zone is drawn, simplified.
create or replace function public.build_zone_display(p_management_zone_id uuid, p_level smallint, p_tolerance double precision)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  drawn extensions.geometry;
  min_area double precision := case when p_level < 4 then (p_tolerance * p_tolerance) * 4 else 0 end;
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

-- Parts are dumped in a lateral join, so row_number() numbers every single piece
-- rather than every subdivided row (which could yield several pieces with one
-- index). The result outline takes the finest tolerance that keeps the drawing
-- small enough to return with every answer.
create or replace function public.build_zone_derivatives(p_management_zone_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  parts integer;
  boundary_parts integer;
  outline integer;
  outline_tolerance double precision;
begin
  delete from public.management_zone_parts where management_zone_id = p_management_zone_id;
  insert into public.management_zone_parts (management_zone_id, part_index, geometry)
  select p_management_zone_id, (row_number() over ())::integer, dumped.geom
  from public.management_zones z
  cross join lateral extensions.ST_Subdivide(z.geometry, 256) piece
  cross join lateral extensions.ST_Dump(piece) dumped
  where z.id = p_management_zone_id;
  get diagnostics parts = row_count;

  delete from public.management_zone_boundary_parts where management_zone_id = p_management_zone_id;
  insert into public.management_zone_boundary_parts (management_zone_id, part_index, geometry)
  select p_management_zone_id, (row_number() over ())::integer, dumped.geom
  from public.management_zones z
  cross join lateral extensions.ST_Subdivide(extensions.ST_Boundary(z.geometry), 256) piece
  cross join lateral extensions.ST_Dump(piece) dumped
  where z.id = p_management_zone_id;
  get diagnostics boundary_parts = row_count;

  foreach outline_tolerance in array array[0.00015, 0.0005, 0.001, 0.003, 0.01, 0.03] loop
    outline := public.build_zone_display(p_management_zone_id, 0::smallint, outline_tolerance);
    exit when outline <= 6000;
  end loop;

  perform public.build_zone_display(p_management_zone_id, 1::smallint, 0.05);
  perform public.build_zone_display(p_management_zone_id, 2::smallint, 0.015);
  perform public.build_zone_display(p_management_zone_id, 3::smallint, 0.004);
  perform public.build_zone_display(p_management_zone_id, 4::smallint, 0.0008);

  return jsonb_build_object('parts', parts, 'boundaryParts', boundary_parts, 'outlineVertices', outline,
    'outlineTolerance', outline_tolerance);
end;
$$;

revoke all on function public.build_zone_display(uuid, smallint, double precision) from public, anon, authenticated;
revoke all on function public.build_zone_derivatives(uuid) from public, anon, authenticated;
grant execute on function public.build_zone_derivatives(uuid) to service_role;

/* ── The resolver, using derivatives where they exist ─────────────────────── */

-- Created beside the live resolver, not over it. It has the same signature and
-- result; a zone with derivatives is found through its parts, a zone without
-- them exactly as before. The live function is replaced only after this one has
-- been shown to answer identically at every sampled point of every published
-- jurisdiction (see the swap_zone_resolver migration).
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
      (select min(extensions.ST_Distance(nearest.geometry::extensions.geography, point.geometry::extensions.geography))
         from (select b.geometry
                 from public.management_zone_boundary_parts b
                where b.management_zone_id = zone.id
                order by b.geometry operator(extensions.<->) point.geometry
                limit 32) nearest),
      extensions.ST_Distance(extensions.ST_Boundary(zone.geometry)::extensions.geography, point.geometry::extensions.geography)
    ) as meters
  ) distance
  where zone.coverage_status = 'VERIFIED'
  order by zone.canonical_id
  limit 2;
$$;

/* ── The map viewport, from stored drawings ───────────────────────────────── */

-- Each drawing is clipped to a margin around the view, so a province-sized zone
-- never ships whole at street zoom.
create or replace function public.zone_display_in_view(
  p_jurisdiction_canonical_id text,
  p_west double precision, p_south double precision, p_east double precision, p_north double precision,
  p_level smallint,
  p_limit integer default 400
)
returns table(official_identifier text, official_name text, canonical_id text, geometry jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  with frame as (
    select extensions.ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326) as box
    where p_west < p_east and p_south < p_north
      and p_west >= -180 and p_east <= 180 and p_south >= -90 and p_north <= 90
  )
  select z.official_identifier, z.official_name, z.canonical_id,
         extensions.ST_AsGeoJSON(extensions.ST_ClipByBox2D(
           d.geometry,
           extensions.ST_Expand(frame.box, greatest(p_east - p_west, p_north - p_south) * 0.1)
         ), 6)::jsonb
  from frame
  join public.management_zone_display d on d.level = p_level and d.geometry operator(extensions.&&) frame.box
  join public.management_zones z on z.id = d.management_zone_id
  join public.regulatory_jurisdictions j on j.id = z.jurisdiction_id
  where j.canonical_id = p_jurisdiction_canonical_id and z.coverage_status = 'VERIFIED'
  order by z.official_identifier
  limit greatest(1, least(p_limit, 400));
$$;

revoke all on function public.zone_display_in_view(text, double precision, double precision, double precision, double precision, smallint, integer)
  from public, anon, authenticated;
grant execute on function public.zone_display_in_view(text, double precision, double precision, double precision, double precision, smallint, integer)
  to service_role;

revoke all on function public.resolve_management_zone_v2(double precision, double precision) from public, anon, authenticated;
grant execute on function public.resolve_management_zone_v2(double precision, double precision) to service_role;

/* ── Certifying a layer before it is served ────────────────────────────────── */

-- The production resolver answers only for VERIFIED zones, which is what keeps
-- an uncertified layer invisible to Hunt. Certification needs the opposite: to
-- ask the layer that is NOT yet served which of its zones contains a point. This
-- answers for one jurisdiction whatever its zones' coverage status, through the
-- same parts the production resolver will use, so what is certified is what will
-- be served.
create or replace function public.resolve_zone_for_certification(
  p_latitude double precision,
  p_longitude double precision,
  p_jurisdiction_canonical_id text
)
returns table(canonical_id text)
language sql
stable
security definer
set search_path = ''
as $$
  with point as (
    select extensions.ST_SetSRID(extensions.ST_MakePoint(p_longitude, p_latitude), 4326) as geometry
    where p_latitude between -90 and 90 and p_longitude between -180 and 180
  ),
  jurisdiction_zones as (
    select z.id, z.canonical_id, z.geometry
    from public.management_zones z
    join public.regulatory_jurisdictions j on j.id = z.jurisdiction_id
    where j.canonical_id = p_jurisdiction_canonical_id
  )
  select zone.canonical_id
  from point
  join public.management_zone_parts p
    on p.geometry operator(extensions.&&) point.geometry
   and extensions.ST_Intersects(p.geometry, point.geometry)
  join jurisdiction_zones zone on zone.id = p.management_zone_id
  union
  select zone.canonical_id
  from point
  join jurisdiction_zones zone
    on zone.geometry operator(extensions.&&) point.geometry
   and extensions.ST_Intersects(zone.geometry, point.geometry)
  where not exists (select 1 from public.management_zone_parts p where p.management_zone_id = zone.id)
  order by 1;
$$;

revoke all on function public.resolve_zone_for_certification(double precision, double precision, text)
  from public, anon, authenticated;
grant execute on function public.resolve_zone_for_certification(double precision, double precision, text)
  to service_role;
