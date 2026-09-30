-- Species images from an external photo provider, and credits for manual
-- images whose photograph came from one.
--
-- Precedence is MANUAL > PROVIDER > PLACEHOLDER. A provider image never
-- enters species_primary_media: that relationship stays the administrator's,
-- so an upload always outranks automation and a re-run of the provider
-- pipeline cannot reach it. The read model prefers species_primary_media and
-- falls back to the one active row here.
--
-- Provider images are not copied. Unsplash's API terms require the hotlinked
-- URLs it returns, a credit to the photographer and to Unsplash, and one
-- download event when a photo is chosen; the row records all three.

create table public.species_provider_media (
  id uuid primary key default gen_random_uuid(),
  species_id text not null check (species_id ~ '^species:[a-z0-9]+(?:-[a-z0-9]+)*$'),
  provider text not null check (provider in ('unsplash')),
  provider_asset_id text not null check (provider_asset_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  status text not null default 'active' check (status in ('active', 'retired')),
  verification_status text not null check (verification_status in ('VERIFIED', 'HIGH_CONFIDENCE')),
  verification_reason text not null check (length(btrim(verification_reason)) between 1 and 1000),
  search_query text not null check (length(btrim(search_query)) between 1 and 200),
  canonical_species_name text not null check (length(btrim(canonical_species_name)) between 1 and 160),
  scientific_name text not null check (length(btrim(scientific_name)) between 1 and 160),
  -- The provider's own URL, never a copy. Widen this check when a provider is added.
  image_url text not null check (
    provider = 'unsplash' and image_url ~ '^https://images\.unsplash\.com/[^\s"<>]+$'
  ),
  width integer not null check (width between 1 and 20000),
  height integer not null check (height between 1 and 20000),
  photographer_name text not null check (length(btrim(photographer_name)) between 1 and 160),
  photographer_profile_url text not null check (photographer_profile_url ~ '^https://unsplash\.com/@[A-Za-z0-9_.-]+$'),
  source_page_url text not null check (source_page_url ~ '^https://unsplash\.com/photos/[A-Za-z0-9_-]+$'),
  licence text not null default 'Unsplash License' check (length(btrim(licence)) between 1 and 240),
  alt_text text not null check (length(btrim(alt_text)) between 1 and 300),
  subject_sex text not null default 'UNKNOWN' check (subject_sex in ('MALE', 'FEMALE', 'UNKNOWN')),
  focal_x numeric(5, 2) not null default 50 check (focal_x between 0 and 100),
  focal_y numeric(5, 2) not null default 50 check (focal_y between 0 and 100),
  -- What the photographer and the provider said, as it was when it was verified.
  provider_description text check (provider_description is null or length(provider_description) <= 2000),
  provider_alt_description text check (provider_alt_description is null or length(provider_alt_description) <= 1000),
  download_tracked_at timestamptz not null,
  visual_check text not null check (length(btrim(visual_check)) between 1 and 160),
  selected_by text not null check (length(btrim(selected_by)) between 1 and 160),
  selected_at timestamptz not null default now(),
  retired_at timestamptz,
  retired_reason text check (retired_reason is null or length(retired_reason) <= 500),
  check ((status = 'active' and retired_at is null) or (status = 'retired' and retired_at is not null))
);

-- One active provider image per species.
create unique index species_provider_media_one_active_idx
  on public.species_provider_media (species_id) where status = 'active';

alter table public.species_provider_media enable row level security;
revoke all on public.species_provider_media from anon, authenticated;
grant select, insert, update on public.species_provider_media to service_role;

-- Credit for a manual image whose photograph came from a provider. Additive
-- and nullable: an image North Ground made itself has no provider credit.
alter table public.species_media_assets
  add column if not exists credit_provider text
    check (credit_provider is null or credit_provider in ('unsplash')),
  add column if not exists credit_provider_asset_id text
    check (credit_provider_asset_id is null or credit_provider_asset_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  add column if not exists credit_creator_url text
    check (credit_creator_url is null or credit_creator_url ~ '^https://unsplash\.com/@[A-Za-z0-9_.-]+$'),
  add column if not exists credit_source_url text
    check (credit_source_url is null or credit_source_url ~ '^https://unsplash\.com/photos/[A-Za-z0-9_-]+$'),
  add column if not exists credit_evidence text
    check (credit_evidence is null or length(credit_evidence) <= 1000);
