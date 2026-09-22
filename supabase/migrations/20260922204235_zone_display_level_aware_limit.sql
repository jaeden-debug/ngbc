-- The stored-drawing limit is sized per level, not by a flat row count.
--
-- `zone_display_in_view` capped every request at 400 rows. That cap is a
-- safety limit on how much geometry one request can pull, but it counted ROWS
-- while the real risk is BYTES, and the two diverge by level. Measured for
-- Yukon's 443 subzones: level 1 is 102 kB for all of them, level 4 is 3,454 kB.
-- So 400 rows is far too tight where zones are generalised and no tighter than
-- it needs to be where they are detailed.
--
-- It also broke a legitimate case rather than an abusive one. Yukon publishes
-- 443 Game Management Subzones, and the national overview necessarily contains
-- all of them, so every overview request hit the cap and the caller refused the
-- whole layer — correctly, since drawing 400 of 443 would be a silent lie, but
-- the result was that Yukon could not be drawn at all.
--
-- The ceiling is now 1000 at the overview levels, where a full jurisdiction is
-- small, and stays 400 at the detailed levels, where a viewport holds few zones
-- and each is large. The caller still refuses a result that reaches the limit
-- it asked for, so nothing is ever drawn partially.
--
-- This is a PROXY, not the real invariant. The bound that matters is bytes, and
-- a row count only stands in for it while zones-per-level sizes hold roughly
-- steady. The eventual fix is a byte-aware bound; until then, a jurisdiction
-- approaching 1000 zones at level 1 will hit this same wall, and raising the
-- number again is not the answer.

create or replace function public.zone_display_in_view(
  p_jurisdiction_canonical_id text,
  p_west double precision, p_south double precision,
  p_east double precision, p_north double precision,
  p_level smallint, p_limit integer default 400)
returns table(official_identifier text, official_name text, canonical_id text, geometry jsonb)
language sql
stable
security definer
set search_path to ''
as $function$
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
  limit greatest(1, least(p_limit, case when p_level <= 1 then 1000 else 400 end));
$function$;
