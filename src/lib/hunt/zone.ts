import type { CanonicalId } from "../content-contract/index.ts";
import type { ZoneResolution } from "./types.ts";
import { unitedStatesStateAt } from "./united-states/state-boundary.ts";
import { countryOfJurisdiction, designationOfRaw, isJurisdictionGeography, isLocationLayer, layerOfZoneId, officialNameOf, servingLayersAt, ZONE_LAYERS, zoneIdFor, type ZoneLayer } from "./zone-layers.ts";
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

/**
 * How long a PostGIS lookup may run before the authority's service is ALSO
 * asked. PostGIS answered in 170 ms median / 215 ms p90 when the switch was
 * certified (2026-09-20) and 91 / 160 ms resolver-direct (2026-09-22); a
 * Server-Timing sample on 2026-09-22 showed warm lookups of 125–400 ms and a
 * loaded database running to the 2.5 s bound, after which the fallback was
 * paid on top. 600 ms is roughly three times the certified p90: a healthy
 * lookup almost never starts a second request, and a slow one overlaps the
 * fallback instead of stacking it. Both sources are parity-certified, so the
 * answer does not change — only when it arrives.
 */
export const ZONE_HEDGE_DELAY_MS = 600;

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

export async function resolveZoneFromRegistry(
  latitude: number,
  longitude: number,
  supabaseClient: () => SupabaseClient = defaultSupabaseServerClient,
  /** Cancels the lookup when another source's answer has already been used. */
  signal?: AbortSignal,
): Promise<ZoneResolution> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    // An invalid coordinate is in no jurisdiction, so it cites no authority.
    return {
      status: "UNKNOWN",
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
      .abortSignal(signal
        ? AbortSignal.any([AbortSignal.timeout(SUPABASE_ZONE_TIMEOUT_MS), signal])
        : AbortSignal.timeout(SUPABASE_ZONE_TIMEOUT_MS));
    if (error) throw error;
    const all = data as SupabaseZoneRow[] | null;
    /*
     * "Which zone is this?" is asked of each jurisdiction's LOCATION layer. A
     * species-scoped geography is not a second truth about the same question:
     * Newfoundland publishes separate moose, caribou and black bear areas over
     * the same ground, so a point in Labrador sits in several of its layers by
     * design. The official-GIS path has filtered these since Montana; the
     * registry path never did, so serving Newfoundland turned normal stacking
     * into "overlapping regulatory zones". Where a species is known, the
     * caller places the point again in that species' own geography.
     */
    const rows = all?.filter((row) => {
      const layer = layerOfZoneId(row.canonical_id);
      return !layer || isLocationLayer(layer);
    }) ?? null;
    if (!rows || rows.length !== 1) {
      /* No authority to cite: this path answers for every jurisdiction, and
         naming one anyway cited Ontario at a point in Labrador. A conflict
         cites the authorities actually in conflict. */
      return {
        status: "UNKNOWN",
        ...(rows && rows.length > 1
          ? { message: `The verified database returned overlapping regulatory zones (${rows.map((row) => row.official_name).join("; ")}); human verification is required.` }
          : { message: "The verified database does not contain a management zone for this point." }),
      };
    }
    const row = rows[0];
    const distance = Math.round(row.boundary_distance_meters);
    /*
     * A jurisdiction-level geography has no units, so it yields no unit. The
     * stored row exists to hold the province's shape; Prince Edward Island's
     * hunting rules name no zone, and handing a hunter
     * "management_zone:ca-pe-prince-edward-island" would invent one out of a
     * storage key. The answer is the province, and the zone id is omitted.
     */
    const jurisdictionGeography = isJurisdictionGeography(layerOfZoneId(row.canonical_id) ?? {});
    return {
      status: "RESOLVED",
      ...(jurisdictionGeography ? {} : { zoneId: row.canonical_id as ZoneResolution["zoneId"] }),
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
    if (!(error instanceof SupabaseServerConfigurationError) && !signal?.aborted) console.error("[hunt-zone] Supabase spatial lookup failed");
    // The registry serves every jurisdiction; its outage belongs to no one authority.
    return {
      status: "PROVIDER_ERROR",
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
    const result = await resolveZoneFromRegistry(latitude, longitude);
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

/**
 * One authority's own service returned several of its own features for one
 * point.
 *
 * This stays UNKNOWN — North Ground does not pick a unit for a hunter — but it
 * says WHICH units, and it keeps them as zone ids so the answer can be
 * investigated, shown, and told apart from a defect. Michigan draws a county
 * unit, a multicounty unit and a CWD core over the same ground on purpose; a
 * message reading "overlapping features" with the features discarded cannot
 * distinguish that published hierarchy from a broken layer, and cannot tell a
 * hunter standing in Lansing anything at all.
 *
 * Naming them is not the same as ranking them. Until an authority's own words
 * say which of its units governs which decision, there is no precedence to
 * apply, and inventing one would be exactly the kind of plausible guess that
 * a correct UNKNOWN exists to prevent.
 */
function overlapping(layer: ZoneLayer, designations: string[]): ZoneResolution {
  const unique = [...new Set(designations.map((designation) => designation.toUpperCase()))].sort();
  return {
    status: "UNKNOWN",
    sourceId: layer.sourceId,
    jurisdictionId: layer.jurisdictionId,
    ...(isJurisdictionGeography(layer) ? {} : { conflictingZoneIds: unique.map((designation) => zoneIdFor(layer, designation)) }),
    message: `The official ${layer.jurisdictionName} service places this point in ${unique.length} ${layer.officialTerm} features at once (${unique.join(", ")}); North Ground will not choose between them.`,
  };
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
      if (named.length > 1) return overlapping(layer, named.map((feature) => designationOfRaw(layer, feature.properties![layer.nameField!])!));
      return {
        status: "UNKNOWN",
        sourceId,
        jurisdictionId: layer.jurisdictionId,
        message: `The official ${layer.jurisdictionName} service places this point in no ${layer.officialTerm}.`,
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
      /* No unit exists to name where the geography IS the jurisdiction. */
      ...(isJurisdictionGeography(layer) ? {} : { zoneId: zoneIdFor(layer, designation) }),
      jurisdictionId: layer.jurisdictionId,
      officialName: officialNameOf(layer, designation),
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
    // Québec's GeoServer calls its geometry `the_geom`; others name theirs (British Columbia: `GEOMETRY`).
    const geometry = wfs.geometryField ?? "the_geom";
    const designations = await ask(`INTERSECTS(${geometry},${point})`);
    if (designations.length !== 1) {
      if (designations.length > 1) return overlapping(layer, designations);
      return {
        status: "UNKNOWN",
        sourceId,
        jurisdictionId: layer.jurisdictionId,
        message: `The official ${layer.jurisdictionName} service places this point in no ${layer.officialTerm}.`,
      };
    }
    const designation = designations[0].toUpperCase();
    // Only a designation the service itself published is put back into a filter, and only in its own
    // alphabet: letters and digits, with a hyphen only between them as British Columbia writes
    // ("7-15"). No quote, parenthesis, semicolon or leading/trailing/doubled hyphen can pass.
    if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(designation)) throw new Error("Unexpected designation");
    const inside = await ask(`CONTAINS(${geometry},SRID=4326;${nearBoundaryDisk(latitude, longitude)}) AND ${wfs.nameField}='${designation}'`);
    const nearBoundary = inside.length === 0;
    return {
      status: "RESOLVED",
      /* No unit exists to name where the geography IS the jurisdiction. */
      ...(isJurisdictionGeography(layer) ? {} : { zoneId: zoneIdFor(layer, designation) }),
      jurisdictionId: layer.jurisdictionId,
      officialName: officialNameOf(layer, designation),
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
    // No served layer covers this point, so there is no authority to cite.
    return { status: "UNKNOWN", message: "North Ground does not hold official hunting-zone boundaries for this point." };
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
      conflictingZoneIds: resolved.map((result) => result.zoneId!).filter(Boolean),
      message: "Two jurisdictions' official services both claim this point; human verification is required.",
    };
  }
  const failed = results.find((result) => result.status === "PROVIDER_ERROR");
  if (failed) return failed;
  /* One authority saying "no zone of mine here" names its jurisdiction only
     when no other registered layer's extent reaches the point. Alberta's box
     runs west to 120° W, so Cranbrook, B.C. is in it; Alberta's service finding
     nothing there does not make Cranbrook Albertan. */
  return results.length === 1 && soleJurisdictionAt(latitude, longitude) === results[0].jurisdictionId
    ? results[0]
    : { ...results[0], jurisdictionId: undefined };
}

/**
 * Which jurisdiction an unplaced point belongs to, when the answer itself did
 * not say. One jurisdiction's extents alone are evidence; several are not, and
 * a U.S. point is then asked of the Census Bureau, because a state is a fact
 * about the ground rather than about a hunting layer's rectangle.
 */
async function attributeJurisdiction(
  result: ZoneResolution,
  latitude: number,
  longitude: number,
  fetcher: typeof fetch,
): Promise<ZoneResolution> {
  const here = registeredLayersAt(latitude, longitude);
  const sole = soleJurisdictionAt(latitude, longitude);
  if (sole && here.some((layer) => layer.serving)) return { ...result, jurisdictionId: sole };
  if (here.some((layer) => countryOfJurisdiction(layer.jurisdictionId) === "US")) {
    const place = await unitedStatesStateAt(latitude, longitude, fetcher);
    if (place) return { ...result, jurisdictionId: place.jurisdictionId as ZoneResolution["jurisdictionId"] };
  }
  return result;
}

/**
 * The one jurisdiction every extent here belongs to, or undefined where two
 * jurisdictions' extents reach the point. A jurisdiction may register several
 * layers over the same ground — Montana's deer-and-elk districts and its
 * upland districts — and a point inside both is still unambiguously in it,
 * so the count that matters is of jurisdictions, not layers.
 */
export function soleJurisdictionAt(latitude: number, longitude: number): ZoneResolution["jurisdictionId"] {
  const jurisdictions = new Set(registeredLayersAt(latitude, longitude).map((layer) => layer.jurisdictionId));
  return jurisdictions.size === 1 ? ([...jurisdictions][0] as ZoneResolution["jurisdictionId"]) : undefined;
}

/** Every registered layer whose extent contains the point, served or not. */
function registeredLayersAt(latitude: number, longitude: number) {
  return ZONE_LAYERS.filter((layer) =>
    latitude >= layer.bounds.minLatitude && latitude <= layer.bounds.maxLatitude &&
    longitude >= layer.bounds.minLongitude && longitude <= layer.bounds.maxLongitude);
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
  /** Optional per-phase durations in milliseconds, for a Server-Timing header. Never carries a coordinate. */
  timings?: Record<string, number>,
): Promise<ZoneResolution> {
  const provider = process.env.SPATIAL_PROVIDER?.trim() || "official-gis";
  const started = performance.now();
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
  if (live.length && !registryHere) {
    const fromLive = await liveResult!;
    if (timings) timings.live = performance.now() - started;
    return fromLive.status === "RESOLVED" || fromLive.jurisdictionId
      ? fromLive
      : attributeJurisdiction(fromLive, latitude, longitude, fetcher);
  }
  // Asked in parallel with the registry; never left unobserved if not awaited.
  liveResult?.catch(() => undefined);
  const registryLayers = (layer: ZoneLayer) => layer.resolution !== "LIVE_SERVICE";
  let result: ZoneResolution;
  if (provider === "supabase" && process.env.SPATIAL_FALLBACK_PROVIDER === "official-gis") {
    // The registry's own race: PostGIS, then its authorities as well if PostGIS is slow.
    result = await resolveHedged(latitude, longitude, fetcher, supabaseClient, registryLayers, timings);
  } else if (provider === "supabase") {
    result = await resolveZoneFromRegistry(latitude, longitude, supabaseClient);
    if (timings) timings.db = performance.now() - started;
  } else {
    const gisStarted = performance.now();
    result = await resolveZoneFromOfficialGis(latitude, longitude, fetcher, registryLayers);
    if (timings) timings.gis = performance.now() - gisStarted;
  }
  /* A registry zone well inside its own boundary cannot be in another
     country's unit: both authorities' polygons end at the border, so an
     overlap can only lie within their digitising tolerance of it. Such a
     point never waits on a live service. */
  const clearOfBorder = result.status === "RESOLVED" && (result.boundaryDistanceMeters ?? 0) > CROSS_AUTHORITY_TOLERANCE_METRES;
  if (liveResult && !clearOfBorder) {
    const liveStarted = performance.now();
    const fromLive = await liveResult;
    if (timings) timings.live = performance.now() - liveStarted;
    const conflict = zoneConflict(result, fromLive, "ACROSS_JURISDICTIONS");
    if (conflict) return conflict;
    /* Two live services already disagreed with each other. That is a conflict,
       not an absence, so the registry's own answer does not settle it: a point
       claimed by several authorities needs a person, whichever of them
       answered last. */
    if (fromLive.conflictingZoneIds?.length) return fromLive;
    if (fromLive.status === "RESOLVED") return fromLive;
    /* The registry did not place it and the live service could not be asked:
       the honest answer is that the zone could not be established. */
    if (result.status !== "RESOLVED" && fromLive.status === "PROVIDER_ERROR") return fromLive;
  }
  if (result.status !== "RESOLVED" && !result.jurisdictionId) {
    /* Registered layers count whether or not they are served: Québec's layer is
       not yet served, but its extent is still evidence the point may be in
       Québec, and Ontario's box alone must not claim it. */
    return attributeJurisdiction(result, latitude, longitude, fetcher);
  }
  return result;
}

/* ── Hedged resolution ─────────────────────────────────────────────────── */

type Settled = { source: "db" | "gis"; result: ZoneResolution };

/** The same fetch path as the fallback, cancellable once another answer is used. */
function cancellable(fetcher: typeof fetch, signal: AbortSignal): typeof fetch {
  return ((input: Parameters<typeof fetch>[0], init?: RequestInit) =>
    fetcher(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, signal]) : signal })) as typeof fetch;
}

function sameAnswer(left: ZoneResolution, right: ZoneResolution): boolean {
  return left.status === right.status && left.zoneId === right.zoneId;
}

/**
 * The one rule for two usable answers about one point: a conflict for a person
 * to resolve, or null when there is none. Never a silent choice.
 *
 * SAME_GEOGRAPHY — North Ground's registry and the same authority's own service
 * (the hedge). They describe one geography, so any difference, including "no
 * zone" against a zone, is a conflict.
 *
 * ACROSS_JURISDICTIONS — a registry answer and another country's live service
 * at the border. Each covers only its own territory, so one placing the point
 * and the other not is agreement; two zones claiming it is the conflict.
 */
export function zoneConflict(
  first: ZoneResolution,
  second: ZoneResolution,
  scope: "SAME_GEOGRAPHY" | "ACROSS_JURISDICTIONS",
): ZoneResolution | null {
  if (scope === "ACROSS_JURISDICTIONS") {
    if (first.status !== "RESOLVED" || second.status !== "RESOLVED") return null;
    return {
      status: "UNKNOWN",
      sourceId: first.sourceId,
      message: "Two jurisdictions' official services both claim this point; human verification is required.",
    };
  }
  if (sameAnswer(first, second)) return null;
  console.warn("[hunt-zone] registry and authority disagree", { jurisdictions: [first.jurisdictionId, second.jurisdictionId] });
  return {
    status: "UNKNOWN",
    sourceId: first.sourceId,
    message:
      "North Ground's registry and the authority's own service place this point differently " +
      `(${[first, second].map((result) => result.officialName ?? "no zone").join(" and ")}); ` +
      "human verification is required.",
  };
}

/**
 * PostGIS first; the authority's service as well once PostGIS has taken
 * `ZONE_HEDGE_DELAY_MS`, or at once if PostGIS fails. The first usable answer
 * is used and the other request is aborted. Two answers that are both in hand
 * and disagree are never picked between: the point needs a person, exactly as
 * when two zones claim it. A loser that still arrives with a different answer
 * is counted in the log by layer, never by coordinate or zone.
 */
async function resolveHedged(
  latitude: number,
  longitude: number,
  fetcher: typeof fetch,
  supabaseClient: () => SupabaseClient,
  only: (layer: ZoneLayer) => boolean,
  timings?: Record<string, number>,
): Promise<ZoneResolution> {
  const started = performance.now();
  const dbAbort = new AbortController();
  const gisAbort = new AbortController();
  const settled: Settled[] = [];

  const db: Promise<Settled> = resolveZoneFromRegistry(latitude, longitude, supabaseClient, dbAbort.signal)
    .then((result) => {
      if (timings) timings.db = performance.now() - started;
      const entry = { source: "db" as const, result };
      settled.push(entry);
      return entry;
    });
  let gis: Promise<Settled> | null = null;
  let gisStarted = 0;
  const startGis = () => {
    if (gis) return gis;
    gisStarted = performance.now();
    gis = resolveZoneFromOfficialGis(latitude, longitude, cancellable(fetcher, gisAbort.signal), only).then((result) => {
      if (timings) timings.gis = performance.now() - gisStarted;
      const entry = { source: "gis" as const, result };
      settled.push(entry);
      return entry;
    });
    return gis;
  };

  let hedgeTimer: ReturnType<typeof setTimeout> | undefined;
  const hedge = new Promise<"hedge">((resolve) => { hedgeTimer = setTimeout(() => resolve("hedge"), ZONE_HEDGE_DELAY_MS); });
  const early = await Promise.race([db, hedge]);
  clearTimeout(hedgeTimer);

  // PostGIS answered within the delay: the common case, one request.
  if (early !== "hedge" && early.result.status !== "PROVIDER_ERROR") return early.result;
  if (timings && early === "hedge") timings.hedge = ZONE_HEDGE_DELAY_MS;

  const pending: Promise<Settled>[] = [startGis()];
  if (early === "hedge") pending.push(db);
  /* A zone is decisive at once. "No zone" is decisive only once the other leg
     has finished or spent its own budget: near an edge one source can miss a
     point the other places (2026-09-22 review: Alberta's service said "no
     zone" at ~600 ms, the registry placed WMU 102 at ~700 ms). */
  let winner: Settled | null = null;
  let noZone: Settled | null = null;
  while (pending.length) {
    const next = await Promise.race(pending);
    pending.splice(pending.indexOf(next.source === "db" ? db : gis!), 1);
    if (next.result.status === "PROVIDER_ERROR") continue;
    if (next.result.status !== "RESOLVED") {
      if (noZone) return zoneConflict(noZone.result, next.result, "SAME_GEOGRAPHY") ?? noZone.result;
      noZone = next;
      continue;
    }
    // A zone after a "no zone" is two answers that disagree: surfaced, never picked.
    if (noZone) return zoneConflict(next.result, noZone.result, "SAME_GEOGRAPHY") ?? next.result;
    winner = next;
    break;
  }
  if (!winner) {
    if (noZone) return noZone.result;
    // Both failed: the fallback's own answer, as before.
    return settled.find((entry) => entry.source === "gis")?.result ?? settled[0].result;
  }

  const other = settled.find((entry) => entry !== winner && entry.result.status !== "PROVIDER_ERROR");
  if (other) {
    const conflict = zoneConflict(winner.result, other.result, "SAME_GEOGRAPHY");
    if (conflict) return conflict;
  }

  // Use the winner and cancel the other request, so it never keeps a backend busy.
  (winner.source === "db" ? gisAbort : dbAbort).abort();
  const loser = winner.source === "db" ? gis : db;
  void loser?.then((late) => {
    if (late.result.status !== "PROVIDER_ERROR" && !sameAnswer(late.result, winner.result)) {
      console.warn("[hunt-zone] registry and authority disagree after response", {
        jurisdictions: [winner.result.jurisdictionId, late.result.jurisdictionId],
      });
    }
  });
  return winner.result;
}
