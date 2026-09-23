-- A zone's boundary pieces are FOUND in distance order, not sorted into it.
--
-- `zone_boundary_distance_meters` walks a zone's boundary parts nearest-first
-- and exits as soon as the next part cannot beat the best distance found. The
-- design is right; the ordering could not use an index. The query filters on
-- `management_zone_id` and orders by `geometry <-> point`, and no index covered
-- both, so PostgreSQL scanned every part of the zone by primary key and
-- top-N heapsorted them. All of the work happened before the early exit could
-- prevent any of it.
--
-- Measured at Maniwaki, Québec: the scan produced all 611 boundary parts of the
-- zone in 91.1 ms, of which the loop consumed 15.
--
-- Cost tracks PARTS PER ZONE, not geometry size or zone count, which is what
-- made Québec look mysterious: 59 very large zones averaging 656 boundary parts
-- each, against Ontario's 84 and Yukon's 16. Newfoundland is second at 211, and
-- a Labrador point was in fact the slowest in the country before this.
--
-- btree_gist lets one GiST index carry the scalar filter and the geometry
-- ordering together, so the scan becomes a true KNN index scan that yields
-- parts lazily in distance order. Same parts, same order, same answer: found
-- rather than sorted. Maniwaki's isolated query 91.9 ms -> 5.2 ms, 611 rows
-- scanned -> 15, buffers 275 -> 22.
--
-- Built with a brief exclusive lock rather than CONCURRENTLY: measured at
-- 4.6 s to build plus 1.3 s to analyze on 112,670 rows, and a short lock on a
-- small table is safer than the half-built index a failed concurrent build
-- leaves behind.

create extension if not exists btree_gist with schema extensions;

create index if not exists zone_boundary_parts_zone_geom_gix
  on public.management_zone_boundary_parts using gist (management_zone_id, geometry);

analyze public.management_zone_boundary_parts;
