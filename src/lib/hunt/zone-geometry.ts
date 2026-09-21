import { designationOfRaw, layerById, ZONE_LAYERS, zoneCoverage, type ZoneCoverageStatus, type ZoneLayer } from "./zone-layers.ts";

/**
 * Server-side delivery of official hunting-zone geometry for the map.
 *
 * Three rules shape this file:
 *
 *  1. The browser never receives full-resolution continental polygons. The
 *     authority's own service generalises server-side (`maxAllowableOffset`) at a
 *     tolerance chosen from the requested zoom, and only the requested viewport is
 *     ever asked for.
 *  2. Generalised geometry is a DRAWING, not a boundary determination. Zone
 *     membership for a hunt is always resolved separately, against unsimplified
 *     geometry, by `zone.ts`.
 *  3. A provider failure returns an explicit failure. An empty map is honest; a
 *     guessed boundary is not.
 */

export interface ZoneFeature {
  /** The layer the feature came from. Designations repeat across jurisdictions. */
  layerId: string;
  /** Stable within a layer: the authority's own designation. */
  name: string;
  /** Display label using the authority's own terminology. */
  label: string;
  coverage: ZoneCoverageStatus;
  /** Rings as [[[lng, lat], …], …], already generalised for the requested zoom. */
  rings: number[][][];
}

export interface ZoneGeometryResult {
  /** PARTIAL: at least one authority answered and at least one did not. */
  status: "OK" | "EMPTY" | "PROVIDER_ERROR" | "PARTIAL";
  layerId?: string;
  /** Every layer asked for this view, with its own outcome. */
  layers?: Array<{ layerId: string; status: "OK" | "EMPTY" | "PROVIDER_ERROR"; message?: string }>;
  features: ZoneFeature[];
  /** Simplification tolerance actually requested, in degrees. */
  tolerance?: number;
  message?: string;
}

export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

/**
 * Simplification tolerance by zoom, in degrees of longitude.
 *
 * Roughly one tolerance step per two screen pixels at that zoom: enough to collapse
 * detail the viewer physically cannot see, never enough to move a boundary within
 * the detail they can. Measured against the Ontario layer: the whole province at
 * zoom 4 is ~35 KB across 151 units.
 */
const TOLERANCE_BY_ZOOM: ReadonlyArray<[maxZoom: number, tolerance: number]> = [
  [4, 0.12],
  [5, 0.08],
  [6, 0.05],
  [7, 0.03],
  [8, 0.015],
  [9, 0.008],
  [10, 0.004],
  [11, 0.002],
];

const FINEST_TOLERANCE = 0.0008;

export function toleranceForZoom(zoom: number): number {
  const clamped = Number.isFinite(zoom) ? Math.max(0, Math.min(20, Math.round(zoom))) : 5;
  for (const [maxZoom, tolerance] of TOLERANCE_BY_ZOOM) {
    if (clamped <= maxZoom) return tolerance;
  }
  return FINEST_TOLERANCE;
}

export function boundsIntersect(box: BoundingBox, layer: ZoneLayer): boolean {
  return (
    box.west <= layer.bounds.maxLongitude && box.east >= layer.bounds.minLongitude &&
    box.south <= layer.bounds.maxLatitude && box.north >= layer.bounds.minLatitude
  );
}

/** Layers whose extent overlaps the viewport. Others are never requested. */
export function layersForBounds(box: BoundingBox): ZoneLayer[] {
  return ZONE_LAYERS.filter((layer) => Boolean(layer.endpoint) && boundsIntersect(box, layer));
}

type Position = [number, number];
type PolygonGeometry =
  | { type: "Polygon"; coordinates: Position[][] }
  | { type: "MultiPolygon"; coordinates: Position[][][] };

interface FeatureCollection {
  type: string;
  features: Array<{ properties: Record<string, unknown>; geometry: PolygonGeometry | null }>;
}

function ringsOf(geometry: PolygonGeometry): Position[][] {
  return geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
}

/* ── Cache ───────────────────────────────────────────────────────────────── */

interface CacheEntry { expiresAt: number; value: ZoneGeometryResult }

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 120;
const cache = new Map<string, CacheEntry>();

/**
 * Viewports are snapped to a grid before they become a cache key, so panning a few
 * metres reuses the previous answer instead of re-querying the authority.
 */
function cacheKey(layerId: string, box: BoundingBox, tolerance: number): string {
  const snap = (value: number) => (Math.round(value / tolerance) * tolerance).toFixed(4);
  return `${layerId}|${snap(box.west)},${snap(box.south)},${snap(box.east)},${snap(box.north)}|${tolerance}`;
}

export function clearZoneGeometryCache(): void {
  cache.clear();
}

/* ── Fetch ───────────────────────────────────────────────────────────────── */

export async function fetchLayerGeometry(
  layer: ZoneLayer,
  box: BoundingBox,
  zoom: number,
  fetcher: typeof fetch = fetch,
): Promise<ZoneGeometryResult> {
  if (!layer.endpoint || !layer.nameField) {
    return { status: "EMPTY", layerId: layer.id, features: [], message: "This layer has no reviewed geometry service." };
  }

  const tolerance = toleranceForZoom(zoom);
  const key = cacheKey(layer.id, box, tolerance);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const parameters = new URLSearchParams({
    where: "1=1",
    geometry: `${box.west},${box.south},${box.east},${box.north}`,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: layer.nameField,
    returnGeometry: "true",
    maxAllowableOffset: String(tolerance),
    outSR: "4326",
    resultRecordCount: "400",
    f: "geojson",
  });

  let result: ZoneGeometryResult;
  try {
    const response = await fetcher(`${layer.endpoint}?${parameters}`, {
      headers: { accept: "application/geo+json, application/json" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`${layer.jurisdictionName} zone service returned ${response.status}`);

    const payload = await response.json() as FeatureCollection;
    if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) {
      throw new Error("Unexpected zone service response");
    }

    const features: ZoneFeature[] = [];
    for (const feature of payload.features) {
      /* The authority's designation, read in the layer's own encoding (Alberta
         stores WMU 102 as "00102"); null is a feature that is not a zone, such
         as Riding Mountain's undesignated polygon or Elk Island's blank record. */
      const name = designationOfRaw(layer, feature.properties?.[layer.nameField]);
      const geometry = feature.geometry;
      if (!name || !geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) continue;
      const rings = ringsOf(geometry).filter((ring) => ring.length >= 4);
      if (!rings.length) continue;
      features.push({
        layerId: layer.id,
        name,
        label: `${layer.officialTermShort} ${name}`,
        coverage: zoneCoverage(layer, name),
        rings,
      });
    }

    result = features.length
      ? { status: "OK", layerId: layer.id, features, tolerance }
      : { status: "EMPTY", layerId: layer.id, features: [], tolerance, message: "No official zones intersect this view." };
  } catch {
    // Deliberately not cached: a transient outage must not pin an empty map for hours.
    return {
      status: "PROVIDER_ERROR",
      layerId: layer.id,
      features: [],
      tolerance,
      message: `The ${layer.authority} zone service is temporarily unavailable. North Ground will not draw an approximate boundary.`,
    };
  }

  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: result });
  return result;
}

/**
 * Every served layer in view, each asked of its own authority, in parallel.
 *
 * Extents overlap and a view can span a provincial border, so each layer is
 * requested and drawn on its own terms. One authority failing never hides
 * another's boundaries, and never goes unreported: the result is PARTIAL and
 * names the service that did not answer.
 */
export async function fetchZoneGeometry(
  box: BoundingBox,
  zoom: number,
  fetcher: typeof fetch = fetch,
): Promise<ZoneGeometryResult> {
  const layers = layersForBounds(box);
  if (!layers.length) {
    return {
      status: "EMPTY",
      features: [],
      message: "North Ground does not yet publish official hunting-zone boundaries for this area.",
    };
  }
  const results = await Promise.all(layers.map((layer) => fetchLayerGeometry(layer, box, zoom, fetcher)));
  const outcomes = results.map((result, index) => ({
    layerId: layers[index].id,
    status: result.status as "OK" | "EMPTY" | "PROVIDER_ERROR",
    ...(result.message ? { message: result.message } : {}),
  }));
  const features = results.flatMap((result) => result.features);
  const failed = results.filter((result) => result.status === "PROVIDER_ERROR");
  const answered = results.filter((result) => result.status === "OK");
  const tolerance = toleranceForZoom(zoom);
  /* A single layer keeps its own identity, so the interface can name its terms. */
  const layerId = answered.length === 1 ? answered[0].layerId : layers.length === 1 ? layers[0].id : undefined;

  if (failed.length && answered.length) {
    return {
      status: "PARTIAL", layerId, layers: outcomes, features, tolerance,
      message: failed.map((result) => result.message).join(" "),
    };
  }
  if (failed.length) {
    return {
      status: "PROVIDER_ERROR", layerId, layers: outcomes, features: [], tolerance,
      message: failed.map((result) => result.message).join(" "),
    };
  }
  return answered.length
    ? { status: "OK", layerId, layers: outcomes, features, tolerance }
    : { status: "EMPTY", layerId, layers: outcomes, features: [], tolerance, message: "No official zones intersect this view." };
}

export function parseBounds(value: unknown): BoundingBox | null {
  if (typeof value !== "string") return null;
  const parts = value.split(",").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  const [west, south, east, north] = parts;
  if (west >= east || south >= north) return null;
  if (south < -90 || north > 90 || west < -180 || east > 180) return null;
  return { west, south, east, north };
}

export { layerById };
