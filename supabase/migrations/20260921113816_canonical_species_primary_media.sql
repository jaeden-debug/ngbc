-- One canonical primary image per biological species.
--
-- The published content bundle remains the species registry. These rows attach
-- runtime media to its canonical `species:*` ids; they do not create another
-- species identity or jurisdiction-specific copy.

create table public.species_media_assets (
  id uuid primary key,
  species_id text not null check (species_id ~ '^species:[a-z0-9]+(?:-[a-z0-9]+)*$'),
  role text not null default 'PRIMARY' check (role = 'PRIMARY'),
  source_type text not null check (source_type in ('north_ground', 'north_ground_generated')),
  creator text not null check (length(btrim(creator)) between 1 and 160),
  licence text not null check (length(btrim(licence)) between 1 and 240),
  alt_text text not null check (length(btrim(alt_text)) between 1 and 300),
  caption text check (caption is null or length(caption) <= 500),
  master_storage_path text not null unique check (master_storage_path ~ '^species/[a-z0-9-]+/[0-9a-f-]{36}/master\.webp$'),
  master_mime_type text not null check (master_mime_type = 'image/webp'),
  master_width integer not null check (master_width between 1 and 6000),
  master_height integer not null check (master_height between 1 and 6000),
  master_bytes integer not null check (master_bytes between 1 and 15728640),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  identity_verification text not null default 'verified' check (identity_verification = 'verified'),
  identity_verified_by text not null check (length(btrim(identity_verified_by)) between 1 and 160),
  identity_verified_at timestamptz not null default now(),
  location_disclosure text not null default 'none' check (location_disclosure = 'none'),
  uploaded_by uuid not null,
  status text not null default 'active' check (status in ('active', 'retired')),
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  check ((status = 'active' and retired_at is null) or status = 'retired')
);

create table public.species_media_renditions (
  asset_id uuid not null references public.species_media_assets(id) on delete cascade,
  variant text not null check (variant in ('avatar', 'card', 'profile')),
  storage_path text not null unique,
  mime_type text not null check (mime_type = 'image/webp'),
  width integer not null check (width between 1 and 2500),
  height integer not null check (height between 1 and 2500),
  bytes integer not null check (bytes > 0),
  primary key (asset_id, variant)
);

create table public.species_primary_media (
  species_id text primary key check (species_id ~ '^species:[a-z0-9]+(?:-[a-z0-9]+)*$'),
  asset_id uuid not null unique references public.species_media_assets(id) on delete restrict,
  updated_by uuid not null,
  updated_at timestamptz not null default now()
);

create index species_media_assets_species_status_idx
  on public.species_media_assets (species_id, status);

alter table public.species_media_assets enable row level security;
alter table public.species_media_renditions enable row level security;
alter table public.species_primary_media enable row level security;

-- The browser never talks to these tables. Public pages and the temporary admin
-- uploader go through North Ground's server, which validates the Supabase user
-- and explicit administrator allowlist before using the service role.
revoke all on public.species_media_assets from anon, authenticated;
revoke all on public.species_media_renditions from anon, authenticated;
revoke all on public.species_primary_media from anon, authenticated;
grant select, insert, update on public.species_media_assets to service_role;
grant select, insert on public.species_media_renditions to service_role;
grant select, insert, update on public.species_primary_media to service_role;

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

  if (select count(*) from public.species_media_renditions where asset_id = p_asset_id) <> 3 then
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

revoke all on function public.publish_species_primary_media(
  uuid, text, text, text, text, text, text, text, integer, integer, integer,
  text, text, uuid, jsonb, uuid
) from public, anon, authenticated;
grant execute on function public.publish_species_primary_media(
  uuid, text, text, text, text, text, text, text, integer, integer, integer,
  text, text, uuid, jsonb, uuid
) to service_role;

comment on table public.species_primary_media is
  'The single canonical PRIMARY media relationship for a biological species.';
comment on table public.species_media_assets is
  'Sanitized species-image masters. Raw uploads are never retained.';
comment on table public.species_media_renditions is
  'Optimized derivatives of one canonical species media asset.';
