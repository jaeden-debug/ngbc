create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

create table if not exists public.regulatory_jurisdictions (
  id uuid primary key default gen_random_uuid(),
  canonical_id text not null unique check (canonical_id ~ '^jurisdiction:[a-z0-9][a-z0-9-]*$'),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  subdivision_code text,
  official_name text not null check (length(btrim(official_name)) > 0),
  authority text not null check (length(btrim(authority)) > 0),
  coverage_status text not null check (coverage_status in ('VERIFIED', 'PARTIAL', 'NEEDS_VERIFICATION')),
  created_at timestamptz not null default now()
);

create table if not exists public.regulatory_sources (
  id uuid primary key default gen_random_uuid(),
  canonical_id text not null unique check (canonical_id ~ '^source:[a-z0-9][a-z0-9-]*$'),
  jurisdiction_id uuid not null references public.regulatory_jurisdictions(id),
  authority text not null check (length(btrim(authority)) > 0),
  title text not null check (length(btrim(title)) > 0),
  source_url text not null check (source_url ~ '^https://'),
  document_identifier text,
  section_reference text,
  retrieved_at timestamptz not null,
  verified_at timestamptz,
  effective_from date,
  effective_to date,
  source_version text,
  content_hash text check (content_hash is null or content_hash ~ '^sha256:[0-9a-f]{64}$'),
  review_status text not null check (review_status in ('DISCOVERED', 'INGESTED', 'DRAFT', 'NEEDS_REVIEW', 'VERIFIED', 'PUBLISHED', 'STALE', 'SUPERSEDED', 'CONFLICT')),
  notes text,
  created_at timestamptz not null default now(),
  constraint regulatory_source_verified_has_date check (review_status not in ('VERIFIED', 'PUBLISHED') or verified_at is not null),
  constraint regulatory_source_effective_range check (effective_to is null or effective_from is null or effective_to >= effective_from)
);

create table if not exists public.management_zones (
  id uuid primary key default gen_random_uuid(),
  canonical_id text not null unique check (canonical_id ~ '^management_zone:[a-z0-9][a-z0-9-]*$'),
  jurisdiction_id uuid not null references public.regulatory_jurisdictions(id),
  zone_type text not null check (zone_type in ('WMU', 'GMU', 'ZONE', 'DISTRICT', 'REGION', 'SPECIAL_TERRITORY', 'OTHER')),
  official_identifier text not null,
  official_name text not null,
  source_id uuid not null references public.regulatory_sources(id),
  source_retrieved_at timestamptz not null,
  source_verified_at timestamptz,
  effective_from date,
  effective_to date,
  source_version text,
  coverage_status text not null check (coverage_status in ('VERIFIED', 'PARTIAL', 'NEEDS_VERIFICATION', 'STALE')),
  location_accuracy text,
  geometry extensions.geometry(MultiPolygon, 4326) not null,
  created_at timestamptz not null default now(),
  constraint management_zone_verified_has_date check (coverage_status <> 'VERIFIED' or source_verified_at is not null),
  constraint management_zone_effective_range check (effective_to is null or effective_from is null or effective_to >= effective_from),
  unique (jurisdiction_id, zone_type, official_identifier, source_version)
);

create index if not exists management_zones_geometry_gix on public.management_zones using gist (geometry);
create index if not exists management_zones_jurisdiction_idx on public.management_zones (jurisdiction_id, zone_type, official_identifier);

create table if not exists public.regulatory_rules (
  id uuid primary key default gen_random_uuid(),
  canonical_id text not null unique check (canonical_id ~ '^regulatory_rule:[a-z0-9][a-z0-9-]*$'),
  jurisdiction_id uuid not null references public.regulatory_jurisdictions(id),
  management_zone_id uuid references public.management_zones(id),
  species_canonical_id text not null check (species_canonical_id ~ '^species:[a-z0-9][a-z0-9-]*$'),
  regulatory_status text not null check (regulatory_status in ('OPEN', 'CLOSED', 'CONDITIONAL', 'UNKNOWN', 'CONFLICT', 'NEEDS_VERIFICATION')),
  season_opens date,
  season_closes date,
  dates_inclusive boolean not null default true,
  limits jsonb not null default '{}'::jsonb check (jsonb_typeof(limits) = 'object'),
  requirements jsonb not null default '[]'::jsonb check (jsonb_typeof(requirements) = 'array'),
  limitations jsonb not null default '[]'::jsonb check (jsonb_typeof(limitations) = 'array'),
  legal_time_rule jsonb not null default '{}'::jsonb check (jsonb_typeof(legal_time_rule) = 'object'),
  source_id uuid not null references public.regulatory_sources(id),
  source_verified_at timestamptz not null,
  effective_from date not null,
  effective_to date,
  source_version text,
  review_status text not null check (review_status in ('DRAFT', 'NEEDS_REVIEW', 'VERIFIED', 'PUBLISHED', 'STALE', 'SUPERSEDED', 'CONFLICT')),
  created_at timestamptz not null default now(),
  constraint regulatory_rule_season_range check (season_closes is null or season_opens is null or season_closes >= season_opens),
  constraint regulatory_rule_effective_range check (effective_to is null or effective_to >= effective_from)
);

create index if not exists regulatory_rules_lookup_idx on public.regulatory_rules (management_zone_id, species_canonical_id, effective_from, effective_to);

create or replace function public.enforce_verified_regulatory_rule_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_status text;
  source_verified timestamptz;
begin
  select review_status, verified_at into source_status, source_verified
  from public.regulatory_sources where id = new.source_id;
  if new.review_status in ('VERIFIED', 'PUBLISHED')
     and (source_status not in ('VERIFIED', 'PUBLISHED') or source_verified is null) then
    raise exception 'A verified regulatory rule requires a verified source';
  end if;
  return new;
end;
$$;

drop trigger if exists regulatory_rules_require_verified_source on public.regulatory_rules;
create trigger regulatory_rules_require_verified_source
before insert or update on public.regulatory_rules
for each row execute function public.enforce_verified_regulatory_rule_source();

create table if not exists public.hunt_brief_snapshots (
  id uuid primary key default gen_random_uuid(),
  public_share_id text not null unique check (public_share_id ~ '^[A-Za-z0-9_-]{22,32}$'),
  schema_version integer not null check (schema_version > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null,
  regulatory_verified_at timestamptz,
  constraint hunt_brief_snapshot_identity check (snapshot ->> 'shareId' = public_share_id),
  constraint hunt_brief_snapshot_version check ((snapshot ->> 'version')::integer = schema_version)
);

create index if not exists hunt_brief_snapshots_created_at_idx on public.hunt_brief_snapshots (created_at desc);

create or replace function public.prevent_hunt_brief_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Hunt Brief snapshots are immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists hunt_brief_snapshots_immutable on public.hunt_brief_snapshots;
create trigger hunt_brief_snapshots_immutable
before update or delete on public.hunt_brief_snapshots
for each row execute function public.prevent_hunt_brief_mutation();

create table if not exists public.hunt_share_rate_limits (
  identity_hash text primary key check (identity_hash ~ '^[A-Za-z0-9_-]{32}$'),
  attempt_count integer not null check (attempt_count > 0),
  expires_at timestamptz not null
);

create index if not exists hunt_share_rate_limits_expiry_idx on public.hunt_share_rate_limits (expires_at);

create or replace function public.consume_hunt_share_rate_limit(
  p_identity_hash text,
  p_limit integer default 8,
  p_window_seconds integer default 600
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
  current_expiry timestamptz;
  -- Deliberately NOT named `current_time`: inside a PL/pgSQL SQL statement the SQL
  -- keyword CURRENT_TIME (a `timetz`) wins over a same-named variable, so
  -- `expires_at <= current_time` raised
  --   operator does not exist: timestamp with time zone <= time with time zone
  -- on every call, which failed every Hunt Brief share.
  evaluated_at timestamptz := clock_timestamp();
begin
  if p_identity_hash !~ '^[A-Za-z0-9_-]{32}$' or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate-limit input';
  end if;

  delete from public.hunt_share_rate_limits where expires_at <= evaluated_at;
  insert into public.hunt_share_rate_limits (identity_hash, attempt_count, expires_at)
  values (p_identity_hash, 1, evaluated_at + make_interval(secs => p_window_seconds))
  on conflict (identity_hash) do update
    set attempt_count = public.hunt_share_rate_limits.attempt_count + 1
  returning attempt_count, expires_at into current_count, current_expiry;

  return query select current_count <= p_limit,
    greatest(1, ceil(extract(epoch from (current_expiry - evaluated_at)))::integer);
end;
$$;

create or replace function public.resolve_management_zone(p_latitude double precision, p_longitude double precision)
returns table (
  canonical_id text,
  official_name text,
  location_accuracy text,
  source_canonical_id text,
  boundary_distance_meters integer,
  near_boundary boolean,
  display_geometry jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with point as (
    select extensions.ST_SetSRID(extensions.ST_MakePoint(p_longitude, p_latitude), 4326) as geometry
    where p_latitude between -90 and 90 and p_longitude between -180 and 180
  )
  select
    zone.canonical_id,
    zone.official_name,
    zone.location_accuracy,
    source.canonical_id,
    round(extensions.ST_Distance(
      extensions.ST_Boundary(zone.geometry)::extensions.geography,
      point.geometry::extensions.geography
    ))::integer as boundary_distance_meters,
    extensions.ST_DWithin(
      extensions.ST_Boundary(zone.geometry)::extensions.geography,
      point.geometry::extensions.geography,
      150
    ) as near_boundary,
    extensions.ST_AsGeoJSON(extensions.ST_SimplifyPreserveTopology(zone.geometry, 0.00015))::jsonb as display_geometry
  from point
  join public.management_zones zone
    on zone.geometry operator(extensions.&&) point.geometry
   and extensions.ST_Intersects(zone.geometry, point.geometry)
  join public.regulatory_sources source on source.id = zone.source_id
  where zone.coverage_status = 'VERIFIED'
  order by zone.canonical_id
  limit 2;
$$;

alter table public.regulatory_jurisdictions enable row level security;
alter table public.regulatory_sources enable row level security;
alter table public.management_zones enable row level security;
alter table public.regulatory_rules enable row level security;
alter table public.hunt_brief_snapshots enable row level security;
alter table public.hunt_share_rate_limits enable row level security;

revoke all on public.regulatory_jurisdictions, public.regulatory_sources, public.management_zones,
  public.regulatory_rules, public.hunt_brief_snapshots, public.hunt_share_rate_limits from anon, authenticated;
revoke all on function public.resolve_management_zone(double precision, double precision) from public, anon, authenticated;
revoke all on function public.consume_hunt_share_rate_limit(text, integer, integer) from public, anon, authenticated;
grant select on public.regulatory_jurisdictions, public.regulatory_sources, public.management_zones,
  public.regulatory_rules, public.hunt_brief_snapshots to service_role;
grant insert on public.hunt_brief_snapshots to service_role;
grant execute on function public.resolve_management_zone(double precision, double precision) to service_role;
grant execute on function public.consume_hunt_share_rate_limit(text, integer, integer) to service_role;

comment on column public.management_zones.geometry is 'EPSG:4326 longitude/latitude geometry. Construct points as (longitude, latitude), never latitude/longitude.';
comment on table public.hunt_brief_snapshots is 'Create-only, no-expiry Hunt Brief bearer-capability snapshots. Browser access is prohibited.';
comment on table public.hunt_share_rate_limits is 'Privacy-preserving HMAC identifiers only; expired rows are removed during rate-limit consumption.';

