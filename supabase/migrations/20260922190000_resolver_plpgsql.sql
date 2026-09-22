-- The zone resolver in PL/pgSQL, and an invariant that makes its fast path safe.
--
-- 1. Invariant: a VERIFIED zone always has its derivatives.
--    The resolver finds a zone only through its point-lookup parts. A VERIFIED
--    zone without them would match nothing, and a point inside it would read as
--    "outside every zone". That is fail-open, so it is made impossible:
--
--    - Changing a zone's geometry deletes that zone's derivatives, which were
--      built from the old geometry. A stale part must never answer for a new
--      boundary.
--    - At commit, every inserted or updated VERIFIED zone must have point-lookup
--      parts, boundary parts and a level-0 drawing, and deleting any of those
--      from a VERIFIED zone is refused. The check is deferred, so
--      build_zone_derivatives (which deletes and re-inserts in one call) and an
--      atomic publish-then-demote both commit.
--
--    So a zone becomes VERIFIED only after its derivatives exist: publish as
--    NEEDS_VERIFICATION (or demote in the publishing transaction), build the
--    derivatives, certify, then promote. Re-publishing a VERIFIED zone with a
--    new boundary fails unless the same transaction demotes it.
--
-- 2. Resolver: same signature and same answers, in PL/pgSQL, whose prepared plan
--    is reused per connection. As a SECURITY DEFINER set-returning SQL function
--    it could not be inlined and re-planned on every call (about 224 ms of
--    planning for a WMU 26 point that executes in about 10 ms warm). The
--    full-geometry lookup branch is removed. As a safety net that the invariant
--    should make unreachable, a VERIFIED zone lacking parts under the point
--    raises, which Hunt reports as a provider error and answers from the
--    authority's own service. It is never read as "no zone".

/* ── 1. Invariant ─────────────────────────────────────────────────────────── */

create or replace function public.management_zone_drop_stale_derivatives()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if extensions.ST_AsEWKB(old.geometry) is distinct from extensions.ST_AsEWKB(new.geometry) then
    delete from public.management_zone_parts where management_zone_id = old.id;
    delete from public.management_zone_boundary_parts where management_zone_id = old.id;
    delete from public.management_zone_display where management_zone_id = old.id;
  end if;
  return new;
end;
$$;

drop trigger if exists management_zone_drop_stale_derivatives on public.management_zones;
create trigger management_zone_drop_stale_derivatives
  before update of geometry on public.management_zones
  for each row execute function public.management_zone_drop_stale_derivatives();

create or replace function public.management_zone_has_derivatives(p_management_zone_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.management_zone_parts where management_zone_id = p_management_zone_id)
     and exists (select 1 from public.management_zone_boundary_parts where management_zone_id = p_management_zone_id)
     and exists (select 1 from public.management_zone_display where management_zone_id = p_management_zone_id and level = 0);
$$;

create or replace function public.management_zone_verified_requires_derivatives()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  zone_id uuid;
  zone public.management_zones;
begin
  zone_id := case when tg_table_name = 'management_zones' then new.id else old.management_zone_id end;
  select * into zone from public.management_zones where id = zone_id;
  -- A zone deleted in the same transaction takes its derivatives with it.
  if zone.id is null or zone.coverage_status <> 'VERIFIED' then return null; end if;
  if not public.management_zone_has_derivatives(zone.id) then
    raise exception 'VERIFIED zone % has no point-lookup parts, boundary parts or level-0 drawing; build its derivatives before promoting it', zone.canonical_id
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

drop trigger if exists management_zone_verified_requires_derivatives on public.management_zones;
create constraint trigger management_zone_verified_requires_derivatives
  after insert or update on public.management_zones
  deferrable initially deferred
  for each row execute function public.management_zone_verified_requires_derivatives();

drop trigger if exists management_zone_parts_keep_verified on public.management_zone_parts;
create constraint trigger management_zone_parts_keep_verified
  after delete on public.management_zone_parts
  deferrable initially deferred
  for each row execute function public.management_zone_verified_requires_derivatives();

drop trigger if exists management_zone_boundary_parts_keep_verified on public.management_zone_boundary_parts;
create constraint trigger management_zone_boundary_parts_keep_verified
  after delete on public.management_zone_boundary_parts
  deferrable initially deferred
  for each row execute function public.management_zone_verified_requires_derivatives();

drop trigger if exists management_zone_display_keep_verified on public.management_zone_display;
create constraint trigger management_zone_display_keep_verified
  after delete on public.management_zone_display
  deferrable initially deferred
  for each row execute function public.management_zone_verified_requires_derivatives();

revoke all on function public.management_zone_drop_stale_derivatives() from public, anon, authenticated;
revoke all on function public.management_zone_has_derivatives(uuid) from public, anon, authenticated;
revoke all on function public.management_zone_verified_requires_derivatives() from public, anon, authenticated;

/* ── 2. Resolver ──────────────────────────────────────────────────────────── */

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
  unindexed text;
begin
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    return;
  end if;
  point := extensions.ST_SetSRID(extensions.ST_MakePoint(p_longitude, p_latitude), 4326);

  -- Safety net: a VERIFIED zone whose extent covers the point but that has no
  -- parts could not be found below. Bounding boxes only, so it costs an index probe.
  select z.canonical_id into unindexed
  from public.management_zones z
  where z.geometry operator(extensions.&&) point
    and z.coverage_status = 'VERIFIED'
    and not exists (select 1 from public.management_zone_parts p where p.management_zone_id = z.id)
  limit 1;
  if unindexed is not null then
    raise exception 'VERIFIED zone % has no point-lookup parts; refusing to answer from an incomplete index', unindexed
      using errcode = 'data_exception';
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
  limit 2;
end;
$$;

revoke all on function public.resolve_management_zone(double precision, double precision) from public, anon, authenticated;
grant execute on function public.resolve_management_zone(double precision, double precision) to service_role;
