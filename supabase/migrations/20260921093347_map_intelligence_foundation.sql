-- Canonical Hunt map-intelligence storage.
--
-- This is deliberately separate from regulatory_rules. Opportunity evidence,
-- ownership, access and environmental conditions cannot create or modify a
-- legal answer. The browser never reads these tables directly: server-side
-- bounded endpoints select reviewed records with the service role.

create table public.map_intelligence_sources (
  id uuid primary key default gen_random_uuid(),
  canonical_id text not null unique check (canonical_id ~ '^source:[a-z0-9][a-z0-9.-]{0,118}$'),
  jurisdiction_id uuid not null references public.regulatory_jurisdictions(id),
  authority text not null,
  title text not null,
  source_url text not null check (source_url ~ '^https://'),
  dataset_identifier text,
  licence text not null,
  licence_url text check (licence_url is null or licence_url ~ '^https://'),
  commercial_reuse text not null check (commercial_reuse in ('ALLOWED', 'PROHIBITED', 'UNCLEAR')),
  redistribution text not null check (redistribution in ('ALLOWED', 'PROHIBITED', 'UNCLEAR', 'RUNTIME_ONLY')),
  attribution_required boolean not null default true,
  legal_standing text not null check (legal_standing in (
    'LEGAL_TEXT_CONTROLS', 'OFFICIAL_GIS_INDICATIVE', 'OFFICIAL_GIS_AUTHORITATIVE', 'OFFICIAL_STATISTICAL_DATA',
    'DERIVED_NORTH_GROUND_DATA', 'THIRD_PARTY_ENVIRONMENTAL_DATA'
  )),
  retrieved_at date not null,
  verified_at date not null,
  source_hash text check (source_hash is null or source_hash ~ '^sha256:[0-9a-f]{64}$'),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.map_intelligence_datasets (
  id uuid primary key default gen_random_uuid(),
  canonical_id text not null unique check (canonical_id ~ '^dataset:[a-z0-9][a-z0-9.-]{0,117}$'),
  source_id uuid not null references public.map_intelligence_sources(id),
  layer_key text not null,
  version text not null,
  spatial_resolution text not null,
  effective_from date,
  effective_through date,
  observation_from date,
  observation_through date,
  coverage_status text not null check (coverage_status in (
    'VERIFIED', 'PARTIAL', 'LIMITED', 'IN_DEVELOPMENT', 'UNAVAILABLE',
    'LICENCE_PENDING', 'LICENCE_BLOCKED', 'STALE', 'NEEDS_VERIFICATION'
  )),
  ingestion_status text not null check (ingestion_status in ('DISCOVERED', 'STAGED', 'REVIEWED', 'PUBLISHED', 'REJECTED', 'SUPERSEDED')),
  limitations text[] not null default '{}',
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  check (effective_through is null or effective_from is null or effective_through >= effective_from),
  check (observation_through is null or observation_from is null or observation_through >= observation_from)
);

create table public.species_evidence (
  id uuid primary key default gen_random_uuid(),
  canonical_id text not null unique check (canonical_id ~ '^evidence:[a-z0-9][a-z0-9.-]{0,116}$'),
  dataset_id uuid not null references public.map_intelligence_datasets(id),
  species_canonical_id text not null check (species_canonical_id ~ '^species:[a-z0-9][a-z0-9.-]{0,117}$'),
  jurisdiction_id uuid not null references public.regulatory_jurisdictions(id),
  management_zone_id uuid references public.management_zones(id),
  geography_ref text not null,
  geography_type text not null check (geography_type in ('MANAGEMENT_ZONE', 'POLYGON', 'GRID_CELL', 'POINT', 'RANGE')),
  metric_type text not null check (metric_type in (
    'HARVEST_TOTAL', 'HARVEST_PER_HUNTER', 'HUNTER_SUCCESS_RATE', 'HUNTER_COUNT',
    'HUNTER_DAYS', 'HARVEST_PER_EFFORT', 'POPULATION_ESTIMATE', 'POPULATION_DENSITY',
    'SURVEY_OBSERVATION', 'RANGE_PRESENCE', 'HABITAT_SUITABILITY',
    'PUBLIC_LAND_AVAILABILITY', 'ACCESS_OPPORTUNITY'
  )),
  raw_value jsonb not null,
  normalized_value double precision check (normalized_value between 0 and 1),
  unit text not null,
  sample_size integer check (sample_size is null or sample_size >= 0),
  methodology text,
  confidence text not null check (confidence in ('HIGH', 'MODERATE', 'LOW', 'UNKNOWN')),
  spatial_precision text not null,
  notes text,
  observation_from date not null,
  observation_through date not null,
  geometry extensions.geometry(Geometry, 4326),
  version text not null,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  check (observation_through >= observation_from),
  check (geometry is null or (not extensions.ST_IsEmpty(geometry) and extensions.ST_IsValid(geometry)))
);
create index species_evidence_lookup_idx on public.species_evidence
  (species_canonical_id, jurisdiction_id, geography_ref, observation_through desc)
  where superseded_at is null;
create index species_evidence_geometry_gix on public.species_evidence using gist (geometry)
  where geometry is not null and superseded_at is null;

create table public.land_features (
  id uuid primary key default gen_random_uuid(),
  canonical_id text not null unique check (canonical_id ~ '^land:[a-z0-9][a-z0-9.-]{0,119}$'),
  dataset_id uuid not null references public.map_intelligence_datasets(id),
  jurisdiction_id uuid not null references public.regulatory_jurisdictions(id),
  official_identifier text,
  official_name text,
  ownership_class text not null check (ownership_class in (
    'PROVINCIAL_CROWN', 'FEDERAL_CROWN', 'TERRITORIAL_PUBLIC', 'US_FEDERAL_PUBLIC',
    'US_STATE_PUBLIC', 'PRIVATE', 'MUNICIPAL', 'INDIGENOUS', 'UNKNOWN'
  )),
  access_status text not null check (access_status in ('CONFIRMED_PUBLIC', 'RESTRICTED', 'SEASONAL', 'PERMISSION_REQUIRED', 'UNKNOWN')),
  hunting_restriction text not null check (hunting_restriction in ('PROHIBITED', 'SPECIES_SPECIFIC', 'METHOD_RESTRICTED', 'SEASONAL', 'UNKNOWN', 'NONE_IDENTIFIED')),
  effective_from date,
  effective_through date,
  source_geometry extensions.geometry(MultiPolygon, 4326) not null,
  notes text,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  check (not extensions.ST_IsEmpty(source_geometry) and extensions.ST_IsValid(source_geometry)),
  check (effective_through is null or effective_from is null or effective_through >= effective_from)
);
create index land_features_geometry_gix on public.land_features using gist (source_geometry)
  where superseded_at is null;
create index land_features_lookup_idx on public.land_features (jurisdiction_id, ownership_class)
  where superseded_at is null;

create table public.access_features (
  id uuid primary key default gen_random_uuid(),
  canonical_id text not null unique,
  dataset_id uuid not null references public.map_intelligence_datasets(id),
  jurisdiction_id uuid not null references public.regulatory_jurisdictions(id),
  feature_type text not null check (feature_type in ('ROAD', 'TRAIL', 'TRAILHEAD', 'PARKING', 'BOAT_LAUNCH', 'PORTAGE', 'GATE', 'ACCESS_POINT')),
  official_name text,
  access_status text not null check (access_status in ('CONFIRMED_PUBLIC', 'RESTRICTED', 'SEASONAL', 'PERMISSION_REQUIRED', 'UNKNOWN')),
  effective_from date,
  effective_through date,
  geometry extensions.geometry(Geometry, 4326) not null,
  notes text,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  check (not extensions.ST_IsEmpty(geometry) and extensions.ST_IsValid(geometry))
);
create index access_features_geometry_gix on public.access_features using gist (geometry)
  where superseded_at is null;

create table public.intelligence_layer_coverage (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_id uuid not null references public.regulatory_jurisdictions(id),
  layer_key text not null,
  status text not null check (status in (
    'VERIFIED', 'PARTIAL', 'LIMITED', 'IN_DEVELOPMENT', 'UNAVAILABLE',
    'LICENCE_PENDING', 'LICENCE_BLOCKED', 'STALE', 'NEEDS_VERIFICATION'
  )),
  production boolean not null default false,
  limitation text not null,
  verified_at date not null,
  unique (jurisdiction_id, layer_key)
);

create table public.opportunity_methodologies (
  version text primary key,
  name text not null,
  formula jsonb not null,
  thresholds jsonb not null,
  published_at timestamptz not null default now(),
  superseded_at timestamptz
);

create table public.opportunity_scores (
  id uuid primary key default gen_random_uuid(),
  species_canonical_id text not null check (species_canonical_id ~ '^species:[a-z0-9][a-z0-9.-]{0,117}$'),
  jurisdiction_id uuid not null references public.regulatory_jurisdictions(id),
  geography_ref text not null,
  methodology_version text not null references public.opportunity_methodologies(version),
  classification text not null check (classification in ('VERY_HIGH', 'HIGH', 'MODERATE', 'LOW', 'LIMITED_DATA')),
  coverage text not null check (coverage in ('ROBUST_DATA', 'PARTIAL_DATA', 'LIMITED_DATA', 'RANGE_ONLY', 'NO_HEAT_MAP_DATA')),
  score double precision check (score between 0 and 1),
  components jsonb not null,
  calculated_at timestamptz not null default now(),
  superseded_at timestamptz,
  unique (species_canonical_id, geography_ref, methodology_version)
);

insert into public.opportunity_methodologies (version, name, formula, thresholds)
values (
  'opportunity-v1',
  'Equal-weight evidence percentile classification',
  '{"normalization":"tie-aware percentile within one species, jurisdiction and observation period","combination":"arithmetic mean of available normalized components","missing":"omitted, never zero"}'::jsonb,
  '[{"minimum":0.8,"class":"VERY_HIGH"},{"minimum":0.6,"class":"HIGH"},{"minimum":0.4,"class":"MODERATE"},{"minimum":0,"class":"LOW"}]'::jsonb
)
on conflict (version) do nothing;

alter table public.map_intelligence_sources enable row level security;
alter table public.map_intelligence_datasets enable row level security;
alter table public.species_evidence enable row level security;
alter table public.land_features enable row level security;
alter table public.access_features enable row level security;
alter table public.intelligence_layer_coverage enable row level security;
alter table public.opportunity_methodologies enable row level security;
alter table public.opportunity_scores enable row level security;

revoke all on public.map_intelligence_sources, public.map_intelligence_datasets, public.species_evidence,
  public.land_features, public.access_features, public.intelligence_layer_coverage,
  public.opportunity_methodologies, public.opportunity_scores from anon, authenticated;
grant select, insert, update, delete on public.map_intelligence_sources, public.map_intelligence_datasets,
  public.species_evidence, public.land_features, public.access_features, public.intelligence_layer_coverage,
  public.opportunity_methodologies, public.opportunity_scores to service_role;

comment on table public.species_evidence is
  'Source-backed species opportunity evidence. It cannot establish legal hunting status.';
comment on table public.land_features is
  'Ownership, access and hunting restriction are separate fields; public ownership never implies access or permission to hunt.';
comment on table public.opportunity_scores is
  'Explainable derived classifications pinned to an immutable methodology version; never a regulatory result.';
