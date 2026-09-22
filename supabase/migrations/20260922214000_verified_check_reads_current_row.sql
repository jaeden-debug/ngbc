-- The VERIFIED-has-derivatives check reads the row as it stands at commit.
--
-- A deferred constraint trigger fires at commit, but with the row image its
-- statement recorded. The check read `new.coverage_status`, so a transaction
-- that publishes zones (publish_zone_run inserts VERIFIED) and demotes them to
-- NEEDS_VERIFICATION before committing was still judged on the VERIFIED image
-- and refused. That is the documented way to publish a jurisdiction whose
-- geometry is not yet certified, and Newfoundland's first ingest hit it.
--
-- The check now re-reads the zone by id, exactly as the derivative-removal
-- check already does. The guarantee is unchanged, and strictly better stated:
-- at commit, no zone whose coverage_status is VERIFIED lacks its point-lookup
-- parts, boundary parts or level-0 drawing. A zone deleted in the same
-- transaction passes, because there is no such zone at commit.

create or replace function public.management_zone_verified_requires_derivatives()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  zone public.management_zones;
begin
  select * into zone from public.management_zones where id = new.id;
  if zone.id is null or zone.coverage_status <> 'VERIFIED' then return null; end if;
  if not public.management_zone_has_derivatives(zone.id) then
    raise exception 'VERIFIED zone % has no point-lookup parts, boundary parts or level-0 drawing; build its derivatives before promoting it', zone.canonical_id
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

revoke all on function public.management_zone_verified_requires_derivatives() from public, anon, authenticated;
