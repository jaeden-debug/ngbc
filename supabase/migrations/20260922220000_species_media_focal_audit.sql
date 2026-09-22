-- A photograph's position is an administrator's decision, so it is attributable
-- like every other one (CLAUDE.md §46). Uploads already record uploaded_by and
-- identity_verified_by; repositioning recorded nothing. Additive and nullable:
-- rows written before this migration simply have no recorded change.
alter table public.species_media_assets
  add column if not exists updated_by uuid,
  add column if not exists updated_at timestamptz;
