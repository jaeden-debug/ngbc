-- The full-run normalizer remains useful for small layers. Québec contains
-- continent-scale geometries, so checking all 59 in one REST statement can
-- exceed the statement timeout. This targeted form validates one freshly
-- uploaded feature and applies the same lossless-only rule.
create or replace function public.normalize_zone_ingest_geometry(
  p_run_id uuid,
  p_source_feature_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  run public.zone_ingest_runs;
  feature public.zone_ingest_features;
  validity_error text;
  repaired extensions.geometry;
  difference_m2 double precision;
begin
  select * into run from public.zone_ingest_runs where id = p_run_id;
  if run.id is null then raise exception 'Unknown ingest run'; end if;
  if run.status <> 'STAGED' then raise exception 'Run % is %, not STAGED', p_run_id, run.status; end if;

  select * into feature
  from public.zone_ingest_features
  where run_id = p_run_id and source_feature_id = p_source_feature_id;
  if feature.run_id is null then raise exception 'Unknown staged feature %', p_source_feature_id; end if;
  if extensions.ST_IsValid(feature.geometry) then
    return jsonb_build_object('normalized', false, 'sourceFeatureId', p_source_feature_id);
  end if;

  validity_error := extensions.ST_IsValidReason(feature.geometry);
  repaired := extensions.ST_Multi(extensions.ST_CollectionExtract(extensions.ST_MakeValid(feature.geometry), 3));
  if repaired is null or extensions.ST_IsEmpty(repaired) or not extensions.ST_IsValid(repaired) then
    raise exception 'Feature % cannot be normalized to valid polygonal geometry', p_source_feature_id;
  end if;

  difference_m2 := extensions.ST_Area(
    extensions.ST_SymDifference(feature.geometry, repaired)::extensions.geography
  );
  if difference_m2 > 1.0 then
    raise exception 'Feature % normalization would move %.3f square metres; refusing',
      p_source_feature_id, difference_m2;
  end if;

  update public.zone_ingest_features
  set geometry = repaired,
      attributes = coalesce(attributes, '{}'::jsonb) || jsonb_build_object(
        'geometryNormalization', jsonb_build_object(
          'method', 'ST_MakeValid',
          'authorityValidityError', validity_error,
          'symmetricDifferenceSquareMetres', round(difference_m2::numeric, 6)
        )
      )
  where run_id = p_run_id and source_feature_id = p_source_feature_id;

  return jsonb_build_object(
    'normalized', true,
    'sourceFeatureId', p_source_feature_id,
    'authorityValidityError', validity_error,
    'symmetricDifferenceSquareMetres', round(difference_m2::numeric, 6),
    'points', extensions.ST_NPoints(repaired),
    'polygons', extensions.ST_NumGeometries(repaired)
  );
end;
$$;

revoke all on function public.normalize_zone_ingest_geometry(uuid, text) from public, anon, authenticated;
grant execute on function public.normalize_zone_ingest_geometry(uuid, text) to service_role;
