import type { ZoneResolution } from "./types.ts";

export const ONTARIO_WMU_ENDPOINT = "https://ws.lioservices.lrc.gov.on.ca/arcgis2/rest/services/LIO_OPEN_DATA/LIO_Open05/MapServer/5/query";

type Position = [number, number];
type PolygonGeometry = { type: "Polygon"; coordinates: Position[][] } | { type: "MultiPolygon"; coordinates: Position[][][] };

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

export async function resolveOntarioWmu(
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
