import type { CanonicalId } from "../content-contract/index.ts";
import type { ZoneResolution } from "./types.ts";
import { defaultSupabaseServerClient, SupabaseServerConfigurationError } from "../supabase/server.ts";

export const ONTARIO_WMU_ENDPOINT = "https://ws.lioservices.lrc.gov.on.ca/arcgis2/rest/services/LIO_OPEN_DATA/LIO_Open05/MapServer/5/query";

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
): Promise<ZoneResolution> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return {
      status: "UNKNOWN",
      sourceId: "source:ca-on-wmu-service",
      message: "The coordinate is invalid; North Ground will not infer a zone.",
    };
  }

  try {
    const { data, error } = await defaultSupabaseServerClient().rpc("resolve_management_zone", {
      p_latitude: latitude,
      p_longitude: longitude,
    });
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
 * Resolve a point to its official management zone, in whichever jurisdiction's
 * registry contains it. The historical name above is kept for its callers; the
 * behaviour was never Ontario-only once PostGIS became the provider.
 */
export const resolveZone = resolveOntarioWmu;
