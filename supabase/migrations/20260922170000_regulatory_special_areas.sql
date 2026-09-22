-- Regulatory special areas: stored copies of an authority's own restricted-area
-- layers (refuges, closed lands, wildlife management areas, territories where
-- hunting is prohibited), so a Hunt answer reads one indexed query instead of a
-- cold round trip to every authority layer.
--
-- This is the regulatory lane. The rules engine reads these areas, and each
-- carries the authority's verbatim restriction text and its legal standing. It
-- is deliberately separate from map-intelligence `land_features` (pending
-- migration 20260921093347), where a restriction is a descriptive map field.
-- Legal restriction text the engine reads belongs here, not there.
--
-- A layer is stored only where the authority's licence permits redistribution
-- (Manitoba: OpenMB Information and Data Use Licence). A stored layer is served
-- only while its status is CURRENT and its catalogue hash equals the reviewed
-- catalogue the application ships. A changed source makes the layer
-- NEEDS_REVIEW, and the application then asks the authority's live service for
-- that layer. A stale copy is never answered as certified.

create table if not exists public.regulatory_special_area_layers (
  layer_id text primary key check (layer_id ~ '^special_layer:[a-z0-9-]+$'),
  jurisdiction_id text not null check (jurisdiction_id ~ '^jurisdiction:[a-z0-9-]+$'),
  source_canonical_id text not null,
  service_url text not null,
  licence text not null,
  -- The committed catalogue's content hash this copy was loaded against.
  catalogue_hash text not null,
  -- Hash of the stored records (ids, text, geometry) as loaded.
  source_hash text not null,
  feature_count integer not null check (feature_count > 0),
  data_last_edit_date timestamptz,
  retrieved_at timestamptz not null,
  checked_at timestamptz not null,
  status text not null check (status in ('CURRENT', 'NEEDS_REVIEW', 'STALE')),
  status_reason text
);

create table if not exists public.regulatory_special_areas (
  layer_id text not null references public.regulatory_special_area_layers(layer_id) on delete cascade,
  jurisdiction_id text not null,
  -- The authority's own record id (ArcGIS OBJECTID, WFS feature id suffix).
  source_record_id text not null,
  name text not null,
  restriction_text text not null,
  legal_standing jsonb not null,
  attributes jsonb not null default '{}'::jsonb,
  geometry extensions.geometry(MultiPolygon, 4326) not null,
  primary key (layer_id, source_record_id)
);
create index if not exists regulatory_special_areas_geometry_gix
  on public.regulatory_special_areas using gist (geometry);

alter table public.regulatory_special_area_layers enable row level security;
alter table public.regulatory_special_areas enable row level security;
revoke all on public.regulatory_special_area_layers, public.regulatory_special_areas from public, anon, authenticated;
grant select on public.regulatory_special_area_layers, public.regulatory_special_areas to service_role;

-- Which stored areas contain a point, for the requested layers. Every requested
-- layer is answered: a layer that is not stored, or not CURRENT, comes back as
-- one row with servable = false and no record, so the caller asks the live
-- service for it. It is never silently read as "no restriction".
create or replace function public.special_areas_at_point(
  p_latitude double precision,
  p_longitude double precision,
  p_layer_ids text[]
)
returns table(layer_id text, catalogue_hash text, servable boolean, source_record_id text)
language sql
stable
security definer
set search_path = ''
as $$
  with requested as (
    select distinct unnest(p_layer_ids) as layer_id
  ),
  point as (
    select extensions.ST_SetSRID(extensions.ST_MakePoint(p_longitude, p_latitude), 4326) as geometry
    where p_latitude between -90 and 90 and p_longitude between -180 and 180
  ),
  layers as (
    select r.layer_id, l.catalogue_hash, coalesce(l.status = 'CURRENT', false) as servable
    from requested r
    left join public.regulatory_special_area_layers l on l.layer_id = r.layer_id
  )
  select layers.layer_id, layers.catalogue_hash, true, a.source_record_id
  from layers
  join public.regulatory_special_areas a on a.layer_id = layers.layer_id
  join point on a.geometry operator(extensions.&&) point.geometry
    and extensions.ST_Intersects(a.geometry, point.geometry)
  where layers.servable
  union all
  select layers.layer_id, layers.catalogue_hash, layers.servable, null
  from layers;
$$;

-- Replace one layer atomically: its records and its status row together, or
-- nothing. Loaded only by the ingestion script after it has checked the
-- records against the committed catalogue.
create or replace function public.publish_special_area_layer(p_layer jsonb, p_features jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  loaded integer;
begin
  insert into public.regulatory_special_area_layers (
    layer_id, jurisdiction_id, source_canonical_id, service_url, licence, catalogue_hash, source_hash,
    feature_count, data_last_edit_date, retrieved_at, checked_at, status, status_reason
  ) values (
    p_layer->>'layerId', p_layer->>'jurisdictionId', p_layer->>'sourceId', p_layer->>'serviceUrl', p_layer->>'licence',
    p_layer->>'catalogueHash', p_layer->>'sourceHash', (p_layer->>'featureCount')::integer,
    (p_layer->>'dataLastEditDate')::timestamptz, (p_layer->>'retrievedAt')::timestamptz, now(), 'CURRENT', null
  )
  on conflict (layer_id) do update set
    jurisdiction_id = excluded.jurisdiction_id, source_canonical_id = excluded.source_canonical_id,
    service_url = excluded.service_url, licence = excluded.licence, catalogue_hash = excluded.catalogue_hash,
    source_hash = excluded.source_hash, feature_count = excluded.feature_count,
    data_last_edit_date = excluded.data_last_edit_date, retrieved_at = excluded.retrieved_at,
    checked_at = excluded.checked_at, status = 'CURRENT', status_reason = null;

  delete from public.regulatory_special_areas where layer_id = p_layer->>'layerId';
  insert into public.regulatory_special_areas (
    layer_id, jurisdiction_id, source_record_id, name, restriction_text, legal_standing, attributes, geometry
  )
  select p_layer->>'layerId', p_layer->>'jurisdictionId', f->>'sourceRecordId', f->>'name', f->>'restrictionText',
    f->'legalStanding', coalesce(f->'attributes', '{}'::jsonb),
    extensions.ST_Multi(extensions.ST_CollectionExtract(extensions.ST_MakeValid(
      extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON(f->>'geometry'), 4326)), 3))
  from jsonb_array_elements(p_features) f;
  get diagnostics loaded = row_count;

  if loaded <> (p_layer->>'featureCount')::integer then
    raise exception 'special area layer %: loaded % records, expected %', p_layer->>'layerId', loaded, p_layer->>'featureCount';
  end if;
  return loaded;
end;
$$;

-- The change watch: a layer whose source moved stops being served.
create or replace function public.mark_special_area_layer(p_layer_id text, p_status text, p_reason text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.regulatory_special_area_layers
  set status = p_status, status_reason = p_reason, checked_at = now()
  where layer_id = p_layer_id;
$$;

revoke all on function public.special_areas_at_point(double precision, double precision, text[]) from public, anon, authenticated;
revoke all on function public.publish_special_area_layer(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.mark_special_area_layer(text, text, text) from public, anon, authenticated;
grant execute on function public.special_areas_at_point(double precision, double precision, text[]) to service_role;
grant execute on function public.publish_special_area_layer(jsonb, jsonb) to service_role;
grant execute on function public.mark_special_area_layer(text, text, text) to service_role;
