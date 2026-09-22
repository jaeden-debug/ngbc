-- Two corrections to 20260922190000.
--
-- 1. The invariant's trigger function named `new.id` and `old.management_zone_id`
--    in one CASE expression. PL/pgSQL resolves every field the expression names,
--    so on each table it was attached to it failed on the field that table does
--    not have. At commit that refused every write to management_zones and every
--    derivative delete, the legitimate ones included. It is split into one
--    function per kind of table, each naming only its own fields.
--
-- 2. The resolver's reused generic plan is slow wherever a very large zone
--    covers the point: measured warm on Québec zone 21, 170-310 ms generic
--    against 8-10 ms custom, while WMU 26 is 9 ms either way. Its query is small,
--    so planning it for the actual point on each call costs a millisecond or two
--    and keeps every point on the good plan.

create or replace function public.management_zone_verified_requires_derivatives()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.coverage_status = 'VERIFIED' and not public.management_zone_has_derivatives(new.id) then
    raise exception 'VERIFIED zone % has no point-lookup parts, boundary parts or level-0 drawing; build its derivatives before promoting it', new.canonical_id
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

create or replace function public.management_zone_derivative_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  zone public.management_zones;
begin
  select * into zone from public.management_zones where id = old.management_zone_id;
  -- A zone deleted in the same transaction takes its derivatives with it.
  if zone.id is null or zone.coverage_status <> 'VERIFIED' then return null; end if;
  if not public.management_zone_has_derivatives(zone.id) then
    raise exception 'VERIFIED zone % would be left without point-lookup parts, boundary parts or a level-0 drawing', zone.canonical_id
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

drop trigger if exists management_zone_parts_keep_verified on public.management_zone_parts;
create constraint trigger management_zone_parts_keep_verified
  after delete on public.management_zone_parts
  deferrable initially deferred
  for each row execute function public.management_zone_derivative_removed();

drop trigger if exists management_zone_boundary_parts_keep_verified on public.management_zone_boundary_parts;
create constraint trigger management_zone_boundary_parts_keep_verified
  after delete on public.management_zone_boundary_parts
  deferrable initially deferred
  for each row execute function public.management_zone_derivative_removed();

drop trigger if exists management_zone_display_keep_verified on public.management_zone_display;
create constraint trigger management_zone_display_keep_verified
  after delete on public.management_zone_display
  deferrable initially deferred
  for each row execute function public.management_zone_derivative_removed();

revoke all on function public.management_zone_derivative_removed() from public, anon, authenticated;

alter function public.resolve_management_zone(double precision, double precision)
  set plan_cache_mode = force_custom_plan;
