-- Zone ingestion staging, and the regulatory-group model.
--
-- Two additions, both aimed at coverage expansion beyond a single hand-loaded zone.
--
-- 1. Official geometry is never written straight into production. A run is staged,
--    compared against what is already published, and only then promoted. An
--    authority redrawing a boundary is a regulatory event, not a silent overwrite.
--
-- 2. Official season tables address many zones at once ("5-15, 19-23, 28-50,
--    53-67, 69B"). Duplicating one identical rule across 68 zones loses the fact
--    that the authority stated it once, and makes a correction 68 edits instead of
--    one. A regulatory group carries the authority's own wording verbatim and the
--    zones it resolves to.

/* ── Ingestion staging ──────────────────────────────────────────────────── */

create table if not exists public.zone_ingest_runs (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_id uuid not null references public.regulatory_jurisdictions(id),
  layer_id text not null,
  source_url text not null check (source_url ~ '^https://'),
  source_version text,
  -- Hash of the normalised feature set, so an unchanged source is recognisable.
  content_hash text check (content_hash is null or content_hash ~ '^sha256:[0-9a-f]{64}$'),
  retrieved_at timestamptz not null,
  feature_count integer not null check (feature_count >= 0),
  status text not null check (status in ('STAGED', 'COMPARED', 'PUBLISHED', 'REJECTED')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.zone_ingest_features (
  run_id uuid not null references public.zone_ingest_runs(id) on delete cascade,
  source_feature_id text not null,
  official_identifier text not null check (length(btrim(official_identifier)) > 0),
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  geometry extensions.geometry(MultiPolygon, 4326) not null,
  primary key (run_id, source_feature_id)
);

create index if not exists zone_ingest_features_geometry_gix
  on public.zone_ingest_features using gist (geometry);
create index if not exists zone_ingest_features_identifier_idx
  on public.zone_ingest_features (run_id, official_identifier);

/* ── Regulatory groups ──────────────────────────────────────────────────── */

create table if not exists public.regulatory_groups (
  id uuid primary key default gen_random_uuid(),
  canonical_id text not null unique check (canonical_id ~ '^regulatory_group:[a-z0-9][a-z0-9-]*$'),
  jurisdiction_id uuid not null references public.regulatory_jurisdictions(id),
  label text not null check (length(btrim(label)) > 0),
  -- The authority's own wording, kept verbatim so a reviewer can compare the
  -- expansion against the published table without re-deriving it.
  official_spec text not null check (length(btrim(official_spec)) > 0),
  source_id uuid not null references public.regulatory_sources(id),
  source_version text,
  created_at timestamptz not null default now()
);

create table if not exists public.regulatory_group_members (
  group_id uuid not null references public.regulatory_groups(id) on delete cascade,
  management_zone_id uuid not null references public.management_zones(id),
  primary key (group_id, management_zone_id)
);

create index if not exists regulatory_group_members_zone_idx
  on public.regulatory_group_members (management_zone_id);

/* A rule addresses either one zone or one group, never both and never neither. */
alter table public.regulatory_rules
  add column if not exists regulatory_group_id uuid references public.regulatory_groups(id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'regulatory_rule_scope') then
    alter table public.regulatory_rules
      add constraint regulatory_rule_scope
      check (num_nonnulls(management_zone_id, regulatory_group_id) = 1);
  end if;
end $$;

create index if not exists regulatory_rules_group_idx
  on public.regulatory_rules (regulatory_group_id, species_canonical_id, effective_from, effective_to);

/* ── Security: these are operational tables, closed like the rest ───────── */

alter table public.zone_ingest_runs enable row level security;
alter table public.zone_ingest_features enable row level security;
alter table public.regulatory_groups enable row level security;
alter table public.regulatory_group_members enable row level security;

revoke all on public.zone_ingest_runs, public.zone_ingest_features,
  public.regulatory_groups, public.regulatory_group_members from anon, authenticated;

grant select, insert, update, delete on public.zone_ingest_runs, public.zone_ingest_features to service_role;
grant select, insert, delete on public.regulatory_groups, public.regulatory_group_members to service_role;

comment on table public.zone_ingest_runs is 'One fetch of an authority''s zone layer. Staged and compared before any promotion to management_zones.';
comment on column public.regulatory_groups.official_spec is 'The authority''s own zone wording, verbatim. The member list is a derived expansion of it and must stay reviewable against it.';
