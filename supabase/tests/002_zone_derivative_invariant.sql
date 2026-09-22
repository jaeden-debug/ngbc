-- A VERIFIED zone always has the derivatives the resolver finds it through
-- (migration 20260922190000). Runs inside a transaction that is rolled back.
begin;

select plan(7);

-- Force the deferred checks to run at each statement, so each attempt is judged alone.
set constraints all immediate;

-- The seeded WMU 57, demoted, with its derivatives removed.
update public.management_zones set coverage_status = 'NEEDS_VERIFICATION'
  where canonical_id = 'management_zone:ca-on-wmu-57';
delete from public.management_zone_parts using public.management_zones z
  where management_zone_id = z.id and z.canonical_id = 'management_zone:ca-on-wmu-57';
delete from public.management_zone_boundary_parts using public.management_zones z
  where management_zone_id = z.id and z.canonical_id = 'management_zone:ca-on-wmu-57';
delete from public.management_zone_display using public.management_zones z
  where management_zone_id = z.id and z.canonical_id = 'management_zone:ca-on-wmu-57';

select throws_ok(
  $$ update public.management_zones set coverage_status = 'VERIFIED' where canonical_id = 'management_zone:ca-on-wmu-57' $$,
  '23514', null,
  'promoting a zone without derivatives to VERIFIED is refused');

select lives_ok(
  $$ select public.build_zone_derivatives(id) from public.management_zones where canonical_id = 'management_zone:ca-on-wmu-57' $$,
  'derivatives build for an unverified zone');

select lives_ok(
  $$ update public.management_zones set coverage_status = 'VERIFIED' where canonical_id = 'management_zone:ca-on-wmu-57' $$,
  'with derivatives, promotion succeeds');

select throws_ok(
  $$ delete from public.management_zone_parts using public.management_zones z
       where management_zone_id = z.id and z.canonical_id = 'management_zone:ca-on-wmu-57' $$,
  '23514', null,
  'removing a VERIFIED zone''s point-lookup parts is refused');

-- A rebuild deletes and re-inserts; the check belongs at the end, as at commit.
set constraints all deferred;
select public.build_zone_derivatives(id) from public.management_zones where canonical_id = 'management_zone:ca-on-wmu-57';
select lives_ok($$ set constraints all immediate $$,
  'rebuilding a VERIFIED zone''s derivatives in one call is allowed');

select throws_ok(
  $$ update public.management_zones set geometry = extensions.ST_Multi(extensions.ST_Buffer(geometry, 0.001))
       where canonical_id = 'management_zone:ca-on-wmu-57' $$,
  '23514', null,
  'changing a VERIFIED zone''s boundary drops its stale derivatives and is refused until they are rebuilt');

select is((select count(*)::integer from public.resolve_management_zone(45.23, -77.94)), 1,
  'the resolver still finds the zone through its parts');

select * from finish();
rollback;
