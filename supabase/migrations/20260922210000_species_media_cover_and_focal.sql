-- Species cards draw the photograph full-bleed and the administrator can set
-- where its subject sits. Additive only:
--  * an optional uncropped 'cover' rendition (the 'card' rendition is cropped to
--    3:2 at upload, so it cannot be repositioned vertically in a 4:5 card);
--  * a focal point per asset, as percentages of the frame (50/50 = centred);
--  * the publish function accepts the optional rendition, still requiring the
--    three it always required.
alter table public.species_media_renditions drop constraint species_media_renditions_variant_check;
alter table public.species_media_renditions add constraint species_media_renditions_variant_check
  check (variant in ('avatar', 'card', 'profile', 'cover'));

alter table public.species_media_assets
  add column if not exists focal_x real not null default 50 check (focal_x between 0 and 100),
  add column if not exists focal_y real not null default 50 check (focal_y between 0 and 100);

create or replace function public.publish_species_primary_media(
  p_asset_id uuid,
  p_species_id text,
  p_source_type text,
  p_creator text,
  p_licence text,
  p_alt_text text,
  p_caption text,
  p_master_storage_path text,
  p_master_width integer,
  p_master_height integer,
  p_master_bytes integer,
  p_source_sha256 text,
  p_identity_verified_by text,
  p_uploaded_by uuid,
  p_renditions jsonb,
  p_expected_current_asset_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_asset_id uuid;
begin
  -- Also serializes the first assignment, when no relationship row exists yet.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_species_id, 0));

  select asset_id into current_asset_id
  from public.species_primary_media
  where species_id = p_species_id
  for update;

  if current_asset_id is not null and p_expected_current_asset_id is null then
    raise exception using errcode = 'P0001', message = 'PRIMARY_MEDIA_EXISTS';
  end if;
  if current_asset_id is distinct from p_expected_current_asset_id then
    raise exception using errcode = 'P0001', message = 'PRIMARY_MEDIA_CHANGED';
  end if;

  insert into public.species_media_assets (
    id, species_id, source_type, creator, licence, alt_text, caption,
    master_storage_path, master_mime_type, master_width, master_height,
    master_bytes, source_sha256, identity_verified_by, uploaded_by
  ) values (
    p_asset_id, p_species_id, p_source_type, p_creator, p_licence, p_alt_text,
    nullif(btrim(p_caption), ''), p_master_storage_path, 'image/webp',
    p_master_width, p_master_height, p_master_bytes, p_source_sha256,
    p_identity_verified_by, p_uploaded_by
  );

  insert into public.species_media_renditions (
    asset_id, variant, storage_path, mime_type, width, height, bytes
  )
  select
    p_asset_id, rendition.variant, rendition.storage_path, 'image/webp',
    rendition.width, rendition.height, rendition.bytes
  from jsonb_to_recordset(p_renditions) as rendition(
    variant text, storage_path text, width integer, height integer, bytes integer
  );

  -- avatar, card and profile are required; the uncropped cover rendition is optional
  -- so a deployment that predates it can still publish.
  if (select count(*) from public.species_media_renditions
      where asset_id = p_asset_id and variant in ('avatar', 'card', 'profile')) <> 3 then
    raise exception using errcode = 'P0001', message = 'THREE_RENDITIONS_REQUIRED';
  end if;

  if current_asset_id is not null then
    update public.species_media_assets
    set status = 'retired', retired_at = now()
    where id = current_asset_id;
  end if;

  insert into public.species_primary_media (species_id, asset_id, updated_by)
  values (p_species_id, p_asset_id, p_uploaded_by)
  on conflict (species_id) do update
  set asset_id = excluded.asset_id,
      updated_by = excluded.updated_by,
      updated_at = now();

  return current_asset_id;
end;
$$;

