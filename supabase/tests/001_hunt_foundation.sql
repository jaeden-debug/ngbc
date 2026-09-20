begin;

select plan(18);

select has_extension('postgis', 'PostGIS is enabled');
select has_table('public', 'management_zones', 'management zones table exists');
select has_index('public', 'management_zones', 'management_zones_geometry_gix', 'management zones have a GiST index');
select is((select extensions.ST_Intersects(
  extensions.ST_SetSRID(extensions.ST_MakePoint(-77.94, 45.23), 4326),
  extensions.ST_SetSRID(extensions.ST_MakePoint(-77.94, 45.23), 4326)
)), true, 'PostGIS spatial functions execute with EPSG:4326 longitude/latitude ordering');

select is((select count(*)::integer from public.resolve_management_zone(45.23, -77.94)), 1, 'known WMU 57 coordinate resolves exactly one zone');
select is((select canonical_id from public.resolve_management_zone(45.23, -77.94)), 'management_zone:ca-on-wmu-57', 'known coordinate resolves WMU 57');
select is((select source_canonical_id from public.resolve_management_zone(45.23, -77.94)), 'source:ca-on-wmu-service', 'zone resolution preserves official source');
select is((select count(*)::integer from public.resolve_management_zone(43.65, -79.38)), 0, 'coordinate outside seeded zone resolves no zone');
select is((select count(*)::integer from public.resolve_management_zone(999, -77.94)), 0, 'invalid latitude resolves no zone');
select ok((select boundary_distance_meters > 150 from public.resolve_management_zone(45.23, -77.94)), 'known interior point is not near boundary');
select is((select near_boundary from public.resolve_management_zone(45.23, -77.94)), false, 'near-boundary flag is false for known interior point');
select is((select count(*)::integer from public.regulatory_rules), 1, 'only the certified regulatory rule is seeded');
select is((select count(*)::integer from public.management_zones), 1, 'no unrelated management zone is seeded');

select lives_ok($$ explain select * from public.management_zones
  where geometry operator(extensions.&&) extensions.ST_SetSRID(extensions.ST_MakePoint(-77.94, 45.23), 4326) $$,
  'spatial lookup has an explainable indexed query path');

select throws_ok($$ update public.hunt_brief_snapshots set schema_version = 2 $$, 'Hunt Brief snapshots are immutable', 'snapshots reject update');
select throws_ok($$ delete from public.hunt_brief_snapshots $$, 'Hunt Brief snapshots are immutable', 'snapshots reject delete');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'hunt_brief_snapshots'), 0, 'Hunt Brief table has no public policy');
select is((select relrowsecurity from pg_class where oid = 'public.hunt_brief_snapshots'::regclass), true, 'Hunt Brief table has RLS enabled');

select * from finish();
rollback;
