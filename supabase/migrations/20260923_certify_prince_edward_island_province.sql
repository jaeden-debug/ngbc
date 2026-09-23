-- Certify Prince Edward Island's one area, which no promotion path can reach.
--
-- The row entered the registry outside publish_zone_run — it had to exist
-- before its derivatives could be built — so it arrived as NEEDS_VERIFICATION.
-- That function's INSERT hardcodes 'VERIFIED' and its ON CONFLICT branch
-- deliberately does not touch coverage_status, because republishing geometry
-- must never silently certify it. The consequence is that a row which did not
-- come in through the front door is permanently stuck, and since
-- zone_display_in_view only returns VERIFIED zones, the map drew nothing for
-- the province while the coverage report called it certified.
--
-- The evidence for this one certification is fixtures/hunt/
-- ca-pe-zone-certification.json, recorded 2026-09-23 against Statistics
-- Canada's 2021 cartographic provincial boundary (PRUID 11): status VERIFIED,
-- 1/1 inventory, 0 missing, 0 invented, 0 geometry disagreements, 5/5 testable
-- parity points.
--
-- Scoped to that single canonical id on purpose. This is not a repair of the
-- promotion design; the missing capability is a promotion path that takes
-- certification EVIDENCE as its input instead of inferring status from which
-- function inserted the row. That is stated in docs/PROJECT-STATE.md and is
-- deliberately not built here.

update public.management_zones
set coverage_status = 'VERIFIED'
where canonical_id = 'management_zone:ca-pe-prince-edward-island'
  and coverage_status <> 'VERIFIED';
