import type { CanonicalId } from "../content-contract/index.ts";
import type { ZoneResolution } from "./types.ts";
import { designationOfRaw, isLocationLayer, servingLayersAt, ZONE_LAYERS, zoneIdFor, type ZoneLayer } from "./zone-layers.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultSupabaseServerClient, SupabaseServerConfigurationError } from "../supabase/server.ts";

export const ONTARIO_WMU_ENDPOINT = "https://ws.lioservices.lrc.gov.on.ca/arcgis2/rest/services/LIO_OPEN_DATA/LIO_Open05/MapServer/5/query";

/**
 * How far inside a registry zone a point must lie before a live service in
 * another country is not waited for. Measured cross-authority overlaps on the
 * Ontario–Québec line are tens of metres; 1 km leaves a wide margin.
 */
export const CROSS_AUTHORITY_TOLERANCE_METRES = 1_000;

/** How long the PostGIS registry gets before the official-GIS fallback runs. */
export const SUPABASE_ZONE_TIMEOUT_MS = 2_500;

type Position = [number, number];
type PolygonGeometry = { type: "Polygon"; coordinates: Position[][] } | { type: "MultiPolygon"; coordinates: Position[][][] };

interface SupabaseZoneRow {
  canonical_id: string;
  official_name: string;
  location_accuracy: string | null;
  source_canonical_id: string;
  boundary_distance_meters: number;
  near_boundary: boolean;
  display_geometry: PolygonGeometry;
}

interface WmuFeatureCollection {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: { OFFICIAL_NAME?: string; LOCATION_ACCURACY?: string; VERIFICATION_STATUS_FLG?: string };
    geometry: PolygonGeometry;
  }>;
}

function ringsOf(geometry: PolygonGeometry): Position[][] {
  return geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
}

function distanceToSegmentMeters(point: Position, start: Position, end: Position): number {
  const latitudeRadians = point[1] * Math.PI / 180;
  const metresPerLon = 111_320 * Math.cos(latitudeRadians);
  const metresPerLat = 110_540;
  const ax = (start[0] - point[0]) * metresPerLon;
  const ay = (start[1] - point[1]) * metresPerLat;
  const bx = (end[0] - point[0]) * metresPerLon;
  const by = (end[1] - point[1]) * metresPerLat;
  const dx = bx - ax;
  const dy = by - ay;
  const denominator = dx * dx + dy * dy;
  const ratio = denominator === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / denominator));
  return Math.hypot(ax + ratio * dx, ay + ratio * dy);
}

function boundaryDistance(point: Position, rings: Position[][]): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (const ring of rings) {
    for (let index = 1; index < ring.length; index += 1) {
      minimum = Math.min(minimum, distanceToSegmentMeters(point, ring[index - 1], ring[index]));
    }
  }
  return minimum;
}

function displayRings(rings: Position[][], maximumPoints = 320): number[][][] {
  return rings.map((ring) => {
    const stride = Math.max(1, Math.ceil(ring.length / maximumPoints));
    const sampled = ring.filter((_, index) => index % stride === 0).map(([longitude, latitude]) => [longitude, latitude]);
    const last = ring.at(-1);
    if (last && sampled.at(-1)?.[0] !== last[0]) sampled.push([last[0], last[1]]);
    return sampled;
  });
}

/**
 * The jurisdiction a canonical zone id belongs to.
 *
 * Every adapter mints ids as `management_zone:<country>-<subdivision>-…`
 * (ca-on-wmu-57, ca-qc-zone-10o, ca-mb-gha-38), and the ingestion tests hold
 * each adapter to it. Reading the jurisdiction from the zone is what keeps a
 * Québec zone found inside Ontario's bounding box from being called a WMU.
 */
export function jurisdictionOfZoneId(zoneId: string | undefined): CanonicalId<"jurisdiction"> | undefined {
  const match = /^management_zone:([a-z]{2}-[a-z]{2})-/.exec(zoneId ?? "");
  return match ? (`jurisdiction:${match[1]}` as CanonicalId<"jurisdiction">) : undefined;
}

export async function resolveOntarioWmuFromOfficialGis(
  latitude: number,
  longitude: number,
  fetcher: typeof fetch = fetch,
): Promise<ZoneResolution> {
  const parameters = new URLSearchParams({
    where: "1=1",
    geometry: `${longitude},${latitude}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "OFFICIAL_NAME,LOCATION_ACCURACY,VERIFICATION_STATUS_FLG",
    returnGeometry: "true",
    outSR: "4326",
    f: "geojson",
  });

  try {
    const response = await fetcher(`${ONTARIO_WMU_ENDPOINT}?${parameters}`, {
      headers: { accept: "application/geo+json, application/json" },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Ontario WMU service returned ${response.status}`);
    const payload = await response.json() as WmuFeatureCollection;
    if (payload.type !== "FeatureCollection" || payload.features.length !== 1) {
      return {
        status: "UNKNOWN",
        sourceId: "source:ca-on-wmu-service",
        message: payload.features.length > 1
          ? "The official service returned overlapping WMUs; human verification is required."
          : "The official service did not return a WMU for this point.",
      };
    }

    const feature = payload.features[0];
    const officialName = feature.properties.OFFICIAL_NAME?.trim();
    if (!officialName || !feature.geometry || !["Polygon", "MultiPolygon"].includes(feature.geometry.type)) {
      return { status: "UNKNOWN", sourceId: "source:ca-on-wmu-service", message: "The official WMU response was incomplete." };
    }
    const rings = ringsOf(feature.geometry);
    const distance = Math.round(boundaryDistance([longitude, latitude], rings));
    return {
      status: "RESOLVED",
      zoneId: `management_zone:ca-on-wmu-${officialName.toLowerCase()}`,
      jurisdictionId: "jurisdiction:ca-on",
      officialName: `Wildlife Management Unit ${officialName}`,
      locationAccuracy: feature.properties.LOCATION_ACCURACY,
      verificationFlag: feature.properties.VERIFICATION_STATUS_FLG,
      boundaryDistanceMeters: distance,
      nearBoundary: distance <= 150,
      displayRings: displayRings(rings),
      sourceId: "source:ca-on-wmu-service",
      message: distance <= 150
        ? "This point is within approximately 150 metres of the mapped WMU boundary. Confirm the legal boundary with Ontario before relying on the result."
        : "The point intersects one official Ontario WMU feature. Map and consumer GPS accuracy still limit legal reliance.",
    };
  } catch {
    return {
      status: "PROVIDER_ERROR",
      sourceId: "source:ca-on-wmu-service",
      message: "The official Ontario WMU service is temporarily unavailable; North Ground will not infer a zone.",
    };
  }
}

export async function resolveOntarioWmuFromSupabase(
  latitude: number,
  longitude: number,
  supabaseClient: () => SupabaseClient = defaultSupabaseServerClient,
): Promise<ZoneResolution> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return {
      status: "UNKNOWN",
      sourceId: "source:ca-on-wmu-service",
      message: "The coordinate is invalid; North Ground will not infer a zone.",
    };
  }

  try {
    /* Bounded. PostGIS answers in ~170 ms (p90 ~215 ms); an unreachable project
       answered only after Cloudflare's ~20 s 522, and every evaluation waited
       for it before the official-GIS fallback could run. An abort is a provider
       error, so the fallback runs within the budget. */
    const { data, error } = await supabaseClient()
      .rpc("resolve_management_zone", { p_latitude: latitude, p_longitude: longitude })
      .abortSignal(AbortSignal.timeout(SUPABASE_ZONE_TIMEOUT_MS));
    if (error) throw error;
    const rows = data as SupabaseZoneRow[] | null;
    if (!rows || rows.length !== 1) {
      return {
        status: "UNKNOWN",
        sourceId: "source:ca-on-wmu-service",
        message: rows && rows.length > 1
          ? "The verified database returned overlapping regulatory zones; human verification is required."
          : "The verified database does not contain a management zone for this point.",
      };
    }
    const row = rows[0];
    const distance = Math.round(row.boundary_distance_meters);
    return {
      status: "RESOLVED",
      zoneId: row.canonical_id as ZoneResolution["zoneId"],
      jurisdictionId: jurisdictionOfZoneId(row.canonical_id),
      officialName: row.official_name,
      locationAccuracy: row.location_accuracy ?? undefined,
      verificationFlag: "Verified",
      boundaryDistanceMeters: distance,
      nearBoundary: row.near_boundary,
      displayRings: displayRings(ringsOf(row.display_geometry)),
      sourceId: row.source_canonical_id as ZoneResolution["sourceId"],
      message: row.near_boundary
        ? "This point is within approximately 150 metres of the mapped management-zone boundary. Confirm the legal boundary with the responsible authority before relying on the result."
        : "The point intersects one verified management-zone feature in North Ground's PostGIS registry. Map and consumer GPS accuracy still limit legal reliance.",
    };
  } catch (error) {
    if (!(error instanceof SupabaseServerConfigurationError)) console.error("[hunt-zone] Supabase spatial lookup failed");
    return {
      status: "PROVIDER_ERROR",
      sourceId: "source:ca-on-wmu-service",
      message: "The verified spatial registry is temporarily unavailable; North Ground will not infer a zone.",
    };
  }
}

export async function resolveOntarioWmu(
  latitude: number,
  longitude: number,
  fetcher: typeof fetch = fetch,
): Promise<ZoneResolution> {
  const provider = process.env.SPATIAL_PROVIDER?.trim() || "official-gis";
  if (provider === "supabase") {
    const result = await resolveOntarioWmuFromSupabase(latitude, longitude);
    if (result.status !== "PROVIDER_ERROR" || process.env.SPATIAL_FALLBACK_PROVIDER !== "official-gis") return result;
  }
  return resolveOntarioWmuFromOfficialGis(latitude, longitude, fetcher);
}

/**
 * Place a point in one particular layer — a species-scoped geography such as
 * Montana's upland game bird districts — asked of the layer's own authority.
 */
export async function resolveInLayer(
  layer: ZoneLayer,
  latitude: number,
  longitude: number,
  fetcher: typeof fetch = fetch,
): Promise<ZoneResolution> {
  return resolveLayerFromOfficialGis(layer, latitude, longitude, fetcher);
}

/* ── Every served jurisdiction ─────────────────────────────────────────── */

interface ArcgisPointCollection {
  type?: string;
  features?: Array<{ properties?: Record<string, unknown>; geometry?: PolygonGeometry | null }>;
}

/**
 * One layer's own service, asked about a point.
 *
 * The same care as Ontario's: exactly one named feature or no answer, the
 * boundary distance measured from the authority's geometry, and a provider
 * failure reported as such rather than as "no zone". A feature with no
 * designation — Manitoba's Riding Mountain National Park polygon — is not a
 * zone, and a point in it resolves to none.
 */
export async function resolveLayerFromOfficialGis(
  layer: ZoneLayer,
  latitude: number,
  longitude: number,
  fetcher: typeof fetch = fetch,
): Promise<ZoneResolution> {
  if (layer.resolution !== "LIVE_SERVICE") return askLayerService(layer, latitude, longitude, fetcher, 8_000);
  return liveLookup(layer, latitude, longitude, fetcher);
}

/* ── Live services: bounded, cached, de-duplicated ───────────────────────
   A layer North Ground holds no copy of is asked of its authority on every
   lookup, so the lookup is kept cheap: an abort at the same budget PostGIS
   gets, one request in flight per layer and point however many callers ask
   (a Hunt, its species re-placement and a zone card ask the same question),
   and a short-lived answer cache. Only a determinate answer is cached; a
   provider failure is asked again next time, never remembered as "no zone".
   The cache is keyed by fetcher so injected test services never share one.
   Its keys are exact hunt coordinates: it lives in this process's memory only
   and is never logged, persisted or sent to analytics (CLAUDE.md §49). */

export const LIVE_ZONE_TIMEOUT_MS = 2_500;
const LIVE_CACHE_TTL_MS = 60 * 60 * 1000;
const LIVE_CACHE_MAX = 5_000;

interface LiveCache {
  answers: Map<string, { at: number; result: ZoneResolution }>;
  inFlight: Map<string, Promise<ZoneResolution>>;
}
const liveCaches = new WeakMap<typeof fetch, LiveCache>();

function liveCacheFor(fetcher: typeof fetch): LiveCache {
  let cache = liveCaches.get(fetcher);
  if (!cache) {
    cache = { answers: new Map(), inFlight: new Map() };
    liveCaches.set(fetcher, cache);
  }
  return cache;
}

async function liveLookup(layer: ZoneLayer, latitude: number, longitude: number, fetcher: typeof fetch): Promise<ZoneResolution> {
  // Exact coordinates (to ~0.1 m): a cache must never move a point across a boundary.
  const key = `${layer.id}|${latitude.toFixed(6)}|${longitude.toFixed(6)}`;
  const cache = liveCacheFor(fetcher);
  const cached = cache.answers.get(key);
  if (cached && Date.now() - cached.at < LIVE_CACHE_TTL_MS) return cached.result;
  const pending = cache.inFlight.get(key);
  if (pending) return pending;
  const request = askLayerService(layer, latitude, longitude, fetcher, LIVE_ZONE_TIMEOUT_MS).then((result) => {
    if (result.status !== "PROVIDER_ERROR") {
      if (cache.answers.size >= LIVE_CACHE_MAX) cache.answers.delete(cache.answers.keys().next().value!);
      cache.answers.set(key, { at: Date.now(), result });
    }
    return result;
  }).finally(() => cache.inFlight.delete(key));
  cache.inFlight.set(key, request);
  return request;
}

async function askLayerService(
  layer: ZoneLayer,
  latitude: number,
  longitude: number,
  fetcher: typeof fetch,
  timeoutMs: number,
): Promise<ZoneResolution> {
  const sourceId = layer.sourceId;
  // An impossible coordinate is answered here, never sent to an authority.
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return { status: "UNKNOWN", sourceId, message: "The coordinate is invalid; North Ground will not infer a zone." };
  }
  if (!layer.endpoint || !layer.nameField) {
    return { status: "UNKNOWN", sourceId, message: `North Ground has no reviewed point service for ${layer.jurisdictionName}.` };
  }
  const parameters = new URLSearchParams({
    geometry: `${longitude},${latitude}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: layer.nameField,
    returnGeometry: "true",
    outSR: "4326",
    f: "geojson",
  });
  try {
    const response = await fetcher(`${layer.endpoint}?${parameters}`, {
      headers: { accept: "application/geo+json, application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`${layer.jurisdictionName} zone service returned ${response.status}`);
    const payload = await response.json() as ArcgisPointCollection;
    if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) throw new Error("Unexpected response");
    const named = payload.features.filter((feature) => designationOfRaw(layer, feature.properties?.[layer.nameField!]) !== null);
    if (named.length !== 1) {
      return {
        status: "UNKNOWN",
        sourceId,
        jurisdictionId: layer.jurisdictionId,
        message: named.length > 1
          ? `The official ${layer.jurisdictionName} service returned overlapping ${layer.officialTerm} features; human verification is required.`
          : `The official ${layer.jurisdictionName} service places this point in no ${layer.officialTerm}.`,
      };
    }
    const feature = named[0];
    /* Unit codes are compared upper-case ("10a" is 10A). A designation made
       of words — Montana's "East of the Continental Divide" — is the
       authority's own name for the area and is kept as it writes it. */
    const raw = designationOfRaw(layer, feature.properties![layer.nameField])!;
    const designation = /\s/.test(raw) ? raw : raw.toUpperCase();
    if (!feature.geometry || !["Polygon", "MultiPolygon"].includes(feature.geometry.type)) {
      return { status: "UNKNOWN", sourceId, jurisdictionId: layer.jurisdictionId, message: `The official ${layer.officialTerm} response was incomplete.` };
    }
    const rings = ringsOf(feature.geometry);
    const distance = Math.round(boundaryDistance([longitude, latitude], rings));
    return {
      status: "RESOLVED",
      zoneId: zoneIdFor(layer, designation),
      jurisdictionId: layer.jurisdictionId,
      officialName: `${layer.officialNamePrefix}${designation}`,
      boundaryDistanceMeters: distance,
      nearBoundary: distance <= 150,
      displayRings: displayRings(rings),
      sourceId,
      message: distance <= 150
        ? `This point is within approximately 150 metres of the mapped ${layer.officialTerm} boundary. Confirm the legal boundary with ${layer.authority} before relying on the result.`
        : `The point intersects one official ${layer.jurisdictionName} ${layer.officialTerm} feature. Map and consumer GPS accuracy still limit legal reliance.`,
    };
  } catch {
    return {
      status: "PROVIDER_ERROR",
      sourceId,
      jurisdictionId: layer.jurisdictionId,
      message: `The official ${layer.jurisdictionName} ${layer.officialTerm} service is temporarily unavailable; North Ground will not infer a zone.`,
    };
  }
}

/* A disk of the near-boundary radius around a point, as a polygon that covers
   the whole circle: 24 vertices on a circle 1/cos(π/24) larger, so its edges
   never pass inside 150 m. Metres per degree are taken at the point. */
function nearBoundaryDisk(latitude: number, longitude: number, metres = 150): string {
  const radius = metres / Math.cos(Math.PI / 24);
  const perLatitude = 111_132;
  const perLongitude = 111_320 * Math.cos((latitude * Math.PI) / 180);
  const ring = Array.from({ length: 24 }, (_, index) => {
    const angle = (2 * Math.PI * index) / 24;
    return `${(longitude + (radius * Math.cos(angle)) / perLongitude).toFixed(7)} ${(latitude + (radius * Math.sin(angle)) / perLatitude).toFixed(7)}`;
  });
  return `POLYGON((${[...ring, ring[0]].join(", ")}))`;
}

/**
 * A layer whose authority serves WFS, asked about a point.
 *
 * The same answer as an ArcGIS layer's, from two questions that return no
 * geometry (Québec's zone 21 alone is 838,537 vertices): which zone contains
 * the point, and whether one of that zone's records contains the whole 150 m
 * disk around it. If none does, the point is treated as near the boundary: it
 * may be near an edge between two records of the same zone, which only
 * over-warns. The distance itself is not measured here, and is not reported.
 */
export async function resolveLayerFromWfs(
  layer: ZoneLayer,
  latitude: number,
  longitude: number,
  fetcher: typeof fetch = fetch,
): Promise<ZoneResolution> {
  const sourceId = layer.sourceId;
  const wfs = layer.wfs;
  if (!wfs) return { status: "UNKNOWN", sourceId, message: `North Ground has no reviewed point service for ${layer.jurisdictionName}.` };
  const ask = async (filter: string) => {
    const parameters = new URLSearchParams({
      service: "WFS", version: "2.0.0", request: "GetFeature", typeNames: wfs.typeName,
      outputFormat: "application/json", propertyName: wfs.nameField, CQL_FILTER: filter,
    });
    const response = await fetcher(`${wfs.url}?${parameters}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`${layer.jurisdictionName} zone service returned ${response.status}`);
    const payload = await response.json() as { features?: Array<{ properties?: Record<string, unknown> }> };
    if (!Array.isArray(payload.features)) throw new Error("Unexpected response");
    return [...new Set(payload.features
      .map((feature) => designationOfRaw(layer, feature.properties?.[wfs.nameField]))
      .filter((designation): designation is string => designation !== null))];
  };
  try {
    // SRID=4326 is required: without it GeoServer reads the numbers in its native projection.
    const point = `SRID=4326;POINT(${longitude} ${latitude})`;
    const designations = await ask(`INTERSECTS(the_geom,${point})`);
    if (designations.length !== 1) {
      return {
        status: "UNKNOWN",
        sourceId,
        jurisdictionId: layer.jurisdictionId,
        message: designations.length > 1
          ? `The official ${layer.jurisdictionName} service returned overlapping ${layer.officialTerm} features; human verification is required.`
          : `The official ${layer.jurisdictionName} service places this point in no ${layer.officialTerm}.`,
      };
    }
    const designation = designations[0].toUpperCase();
    // Only a designation the service itself published is put back into a filter, and only in its own alphabet.
    if (!/^[A-Z0-9]+$/.test(designation)) throw new Error("Unexpected designation");
    const inside = await ask(`CONTAINS(the_geom,SRID=4326;${nearBoundaryDisk(latitude, longitude)}) AND ${wfs.nameField}='${designation}'`);
    const nearBoundary = inside.length === 0;
    return {
      status: "RESOLVED",
      zoneId: zoneIdFor(layer, designation),
      jurisdictionId: layer.jurisdictionId,
      officialName: `${layer.officialNamePrefix}${designation}`,
      nearBoundary,
      sourceId,
      message: nearBoundary
        ? `This point is within about 150 metres of the mapped ${layer.officialTerm} boundary. Confirm the legal boundary with ${layer.authority} before relying on the result.`
        : `The point intersects one official ${layer.jurisdictionName} ${layer.officialTerm} feature, more than 150 metres inside it. Map and consumer GPS accuracy still limit legal reliance.`,
    };
  } catch {
    return {
      status: "PROVIDER_ERROR",
      sourceId,
      jurisdictionId: layer.jurisdictionId,
      message: `The official ${layer.jurisdictionName} ${layer.officialTerm} service is temporarily unavailable; North Ground will not infer a zone.`,
    };
  }
}

/**
 * Every served layer whose extent contains the point, each asked through its
 * own authority. Extents overlap, so more than one may be asked; exactly one
 * resolved zone is an answer, two are a conflict for a person to resolve.
 */
export async function resolveZoneFromOfficialGis(
  latitude: number,
  longitude: number,
  fetcher: typeof fetch = fetch,
  only?: (layer: ZoneLayer) => boolean,
): Promise<ZoneResolution> {
  /* Location-only questions are asked of each jurisdiction's location layer.
     A state's species-scoped geographies (Montana's upland districts) overlap
     its general one by design and are asked only for their species. */
  const layers = servingLayersAt(latitude, longitude)
    .filter((layer) => (layer.endpoint || layer.wfs) && isLocationLayer(layer) && (only?.(layer) ?? true));
  if (!layers.length) {
    return { status: "UNKNOWN", sourceId: "source:ca-on-wmu-service", message: "North Ground does not hold official hunting-zone boundaries for this point." };
  }
  const results = await Promise.all(layers.map((layer) =>
    layer.id === "layer:ca-on-wmu"
      ? resolveOntarioWmuFromOfficialGis(latitude, longitude, fetcher)
      : layer.endpoint
        ? resolveLayerFromOfficialGis(layer, latitude, longitude, fetcher)
        : resolveLayerFromWfs(layer, latitude, longitude, fetcher)));
  const resolved = results.filter((result) => result.status === "RESOLVED");
  if (resolved.length === 1) return resolved[0];
  if (resolved.length > 1) {
    return {
      status: "UNKNOWN",
      sourceId: resolved[0].sourceId,
      message: "Two jurisdictions' official services both claim this point; human verification is required.",
    };
  }
  const failed = results.find((result) => result.status === "PROVIDER_ERROR");
  if (failed) return failed;
  return results.length === 1 ? results[0] : { ...results[0], jurisdictionId: undefined };
}

/**
 * Resolve a point to its official management zone, in whichever jurisdiction's
 * registry contains it.
 *
 * PostGIS holds every served jurisdiction, so it answers wherever it can. Its
 * fallback asks each served layer's own authority. A zone's jurisdiction comes
 * from the zone itself; an unresolved point is given a jurisdiction only as a
 * hint, and only when exactly one registered layer's extent contains it and that
 * layer is served — so a point in Riding Mountain National Park, which no Game
 * Hunting Area covers, is answered in Manitoba's terms, while a point in western
 * Québec, which Ontario's extent also reaches, is attributed to neither.
 */
export async function resolveZone(
  latitude: number,
  longitude: number,
  fetcher: typeof fetch = fetch,
  supabaseClient: () => SupabaseClient = defaultSupabaseServerClient,
): Promise<ZoneResolution> {
  const provider = process.env.SPATIAL_PROVIDER?.trim() || "official-gis";
  /* Layers North Ground holds no copy of are always asked of their authority.
     Where the point is only inside such layers — anywhere in a U.S. state —
     the registry is not asked at all; where extents meet (the 49th parallel),
     both are asked and a zone from each is a conflict, never a choice. */
  const here = servingLayersAt(latitude, longitude);
  const live = here.filter((layer) => layer.resolution === "LIVE_SERVICE" && isLocationLayer(layer));
  const registryHere = here.some((layer) => layer.resolution !== "LIVE_SERVICE");
  const liveResult = live.length
    ? resolveZoneFromOfficialGis(latitude, longitude, fetcher, (layer) => layer.resolution === "LIVE_SERVICE")
    : null;
  let result: ZoneResolution | null = null;
  if (live.length && !registryHere) return await liveResult!;
  // Asked in parallel with the registry; never left unobserved if not awaited.
  liveResult?.catch(() => undefined);
  if (provider === "supabase") {
    result = await resolveOntarioWmuFromSupabase(latitude, longitude, supabaseClient);
    if (result.status === "PROVIDER_ERROR" && process.env.SPATIAL_FALLBACK_PROVIDER === "official-gis") result = null;
  }
  result ??= await resolveZoneFromOfficialGis(latitude, longitude, fetcher, (layer) => layer.resolution !== "LIVE_SERVICE");
  /* A registry zone well inside its own boundary cannot be in another
     country's unit: both authorities' polygons end at the border, so an
     overlap can only lie within their digitising tolerance of it. Such a
     point never waits on a live service. */
  const clearOfBorder = result.status === "RESOLVED" && (result.boundaryDistanceMeters ?? 0) > CROSS_AUTHORITY_TOLERANCE_METRES;
  if (liveResult && !clearOfBorder) {
    const fromLive = await liveResult;
    if (fromLive.status === "RESOLVED" && result.status === "RESOLVED") {
      return {
        status: "UNKNOWN",
        sourceId: result.sourceId,
        message: "Two jurisdictions' official services both claim this point; human verification is required.",
      };
    }
    if (fromLive.status === "RESOLVED") return fromLive;
    /* The registry did not place it and the live service could not be asked:
       the honest answer is that the zone could not be established. */
    if (result.status !== "RESOLVED" && fromLive.status === "PROVIDER_ERROR") return fromLive;
  }
  if (result.status !== "RESOLVED" && !result.jurisdictionId) {
    /* Registered layers count whether or not they are served: Québec's layer is
       not yet served, but its extent is still evidence the point may be in
       Québec, and Ontario's box alone must not claim it. */
    const containing = ZONE_LAYERS.filter((layer) =>
      latitude >= layer.bounds.minLatitude && latitude <= layer.bounds.maxLatitude &&
      longitude >= layer.bounds.minLongitude && longitude <= layer.bounds.maxLongitude);
    if (containing.length === 1 && containing[0].serving) return { ...result, jurisdictionId: containing[0].jurisdictionId };
  }
  return result;
}
