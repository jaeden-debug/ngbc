import { labelPlacement } from "./exploration/label-point.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultSupabaseServerClient } from "../supabase/server.ts";
import { presentZone } from "./zone-presentation.ts";
import { designationOfRaw, layerById, ZONE_LAYERS, zoneCoverage, zoneDisplayLabel, zoneIdFor, type ZoneCoverageStatus, type ZoneLayer } from "./zone-layers.ts";

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
  /** Full display label using the authority's own terminology ("WMU 57", "Zone 10 West"). */
  label: string;
  /** Shortest map label ("57", "10W"); presentation only, never a key. */
  compactLabel: string;
  /** Spelled-out label for assistive technology ("Wildlife Management Unit 57, Ontario"). */
  accessibleLabel: string;
  coverage: ZoneCoverageStatus;
  /** Rings as [[[lng, lat], …], …], already generalised for the requested zoom. */
  rings: number[][][];
  /**
   * Where the designation is written: inside the zone's largest part, so a
   * multipart zone is labelled once. A drawing aid, never a membership test.
   */
  labelPoint?: [number, number];
  /** Degrees spanned by the largest part, so a label is shown only where it fits. */
  labelSpan?: [number, number];
  /** How many polygon parts the authority publishes this zone as. */
  parts?: number;
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

/**
 * Served layers whose extent overlaps the viewport and that have a drawing
 * source. A layer that is registered but not served (Québec until its parity is
 * certified) is never drawn, whatever source it has. A layer scoped to
 * particular species is drawn only when asked for, so a state with several
 * simultaneous geographies does not stack them all on one map.
 */
export function layersForBounds(box: BoundingBox, options: { speciesId?: string } = {}): ZoneLayer[] {
  return ZONE_LAYERS.filter((layer) =>
    layer.serving && (Boolean(layer.endpoint) || layer.mapGeometry === "stored") && boundsIntersect(box, layer) &&
    (!layer.speciesScope || layer.drawnByDefault || (options.speciesId !== undefined && layer.speciesScope.includes(options.speciesId))));
}

type Position = [number, number];
type PolygonGeometry =
  | { type: "Polygon"; coordinates: Position[][] }
  | { type: "MultiPolygon"; coordinates: Position[][][] };

interface FeatureCollection {
  type: string;
  features: Array<{ id?: number | string; properties: Record<string, unknown>; geometry: PolygonGeometry | null }>;
}

/** One record as the source returned it: an id to de-duplicate by, a designation, its polygons. */
interface SourceRecord {
  id: string;
  name: string;
  polygons: Position[][][];
}

/* ── Cache ───────────────────────────────────────────────────────────────── */

interface CacheEntry { expiresAt: number; value: SourceRecord[] }

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 240;
const cache = new Map<string, CacheEntry>();

/**
 * Viewports are snapped to a grid before they become a cache key, so panning a few
 * metres reuses the previous answer instead of re-querying the source.
 */
function cacheKey(source: string, layerId: string, box: BoundingBox, tolerance: number): string {
  const snap = (value: number) => (Math.round(value / tolerance) * tolerance).toFixed(4);
  return `${source}|${layerId}|${snap(box.west)},${snap(box.south)},${snap(box.east)},${snap(box.north)}|${tolerance}`;
}

function remember(key: string, value: SourceRecord[]): SourceRecord[] {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}

export function clearZoneGeometryCache(): void {
  cache.clear();
}

function polygonsOf(geometry: PolygonGeometry): Position[][][] {
  return (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates)
    .map((polygon) => polygon.filter((ring) => ring.length >= 4))
    .filter((polygon) => polygon.length > 0);
}

/** The part of the viewport a layer can answer for. Nothing outside its extent is asked. */
export function clampToLayer(box: BoundingBox, layer: Pick<ZoneLayer, "bounds">): BoundingBox | null {
  const clamped = {
    west: Math.max(box.west, layer.bounds.minLongitude),
    south: Math.max(box.south, layer.bounds.minLatitude),
    east: Math.min(box.east, layer.bounds.maxLongitude),
    north: Math.min(box.north, layer.bounds.maxLatitude),
  };
  return clamped.west < clamped.east && clamped.south < clamped.north ? clamped : null;
}

/**
 * The query boxes for one view. Ontario's service silently drops units from a
 * wide envelope query — the loss grows with the longitude span (a 22°-wide view
 * lost WMUs 9B, 10, 12B, 13 and 14; a 65°-wide one kept only 1A–1D), while a
 * 5°-wide query returns every unit. A layer that declares `maxQueryLongitudeSpan`
 * is therefore asked in longitude tiles no wider than that, and the answers are
 * joined.
 */
export function queryTiles(box: BoundingBox, maxSpan: number | undefined): BoundingBox[] {
  const span = box.east - box.west;
  if (!maxSpan || span <= maxSpan) return [box];
  const count = Math.ceil(span / maxSpan);
  const width = span / count;
  return Array.from({ length: count }, (_, index) => ({
    ...box,
    west: box.west + index * width,
    east: index === count - 1 ? box.east : box.west + (index + 1) * width,
  }));
}

/* ── Sources ─────────────────────────────────────────────────────────────── */

/** One envelope query against the authority's own ArcGIS service. */
async function authorityRecords(layer: ZoneLayer, box: BoundingBox, tolerance: number, fetcher: typeof fetch): Promise<SourceRecord[]> {
  const key = cacheKey("authority", layer.id, box, tolerance);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const parameters = new URLSearchParams({
    where: "1=1",
    geometry: `${box.west},${box.south},${box.east},${box.north}`,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: layer.nameField!,
    returnGeometry: "true",
    maxAllowableOffset: String(tolerance),
    outSR: "4326",
    resultRecordCount: "400",
    f: "geojson",
  });
  const countParameters = new URLSearchParams(parameters);
  countParameters.delete("outFields");
  countParameters.delete("maxAllowableOffset");
  countParameters.delete("outSR");
  countParameters.delete("resultRecordCount");
  countParameters.set("returnGeometry", "false");
  countParameters.set("returnCountOnly", "true");
  countParameters.set("f", "json");
  const countResponse = await fetcher(`${layer.endpoint}?${countParameters}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!countResponse.ok) throw new Error(`${layer.jurisdictionName} zone count service returned ${countResponse.status}`);
  const countPayload = await countResponse.json() as { count?: number };
  if (!Number.isInteger(countPayload.count) || countPayload.count! < 0 || countPayload.count! > 400) {
    throw new Error(`${layer.jurisdictionName} zone service returned an unsafe viewport count`);
  }
  const response = await fetcher(`${layer.endpoint}?${parameters}`, {
    headers: { accept: "application/geo+json, application/json" },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`${layer.jurisdictionName} zone service returned ${response.status}`);
  const payload = await response.json() as FeatureCollection;
  if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) throw new Error("Unexpected zone service response");
  let features = payload.features;
  if (features.length > countPayload.count!) {
    throw new Error(`${layer.jurisdictionName} zone service returned ${features.length} of ${countPayload.count} viewport records`);
  }
  if (features.length < countPayload.count!) {
    /* Alberta's service drops WMU 214 from the envelope -114,51,-113,52 at
       every tolerance while counting it, and returns it when asked by id. A
       short envelope answer is therefore re-asked record by record — and still
       refused unless every counted record arrives exactly once. */
    features = await featuresByObjectId(layer, countParameters, parameters, countPayload.count!, fetcher);
  }

  const records: SourceRecord[] = [];
  for (const feature of features) {
    /* The authority's designation, read in the layer's own encoding (Alberta
       stores WMU 102 as "00102"); null is a feature that is not a zone, such
       as Riding Mountain's undesignated polygon or Elk Island's blank record. */
    const name = designationOfRaw(layer, feature.properties?.[layer.nameField!]);
    const geometry = feature.geometry;
    if (!name || !geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) continue;
    const polygons = polygonsOf(geometry);
    if (!polygons.length) continue;
    /* The record id de-duplicates a record two tiles both returned. Without
       one, the geometry itself identifies it. */
    const id = feature.id !== undefined ? String(feature.id) : `${name}|${JSON.stringify(polygons[0][0].slice(0, 3))}`;
    records.push({ id, name, polygons });
  }
  return remember(key, records);
}

const OBJECT_ID_BATCH = 20;

/**
 * Every record an envelope counts, asked for by object id. Fails closed: the id
 * list must match the count, and every id must come back exactly once.
 */
async function featuresByObjectId(
  layer: ZoneLayer,
  countParameters: URLSearchParams,
  featureParameters: URLSearchParams,
  count: number,
  fetcher: typeof fetch,
): Promise<FeatureCollection["features"]> {
  const idParameters = new URLSearchParams(countParameters);
  idParameters.delete("returnCountOnly");
  idParameters.set("returnIdsOnly", "true");
  const idResponse = await fetcher(`${layer.endpoint}?${idParameters}`, {
    headers: { accept: "application/json" }, signal: AbortSignal.timeout(10_000), cache: "no-store",
  });
  if (!idResponse.ok) throw new Error(`${layer.jurisdictionName} zone id service returned ${idResponse.status}`);
  const idPayload = await idResponse.json() as { objectIdFieldName?: string; objectIds?: unknown };
  const idField = idPayload.objectIdFieldName;
  const ids = Array.isArray(idPayload.objectIds) ? idPayload.objectIds : [];
  if (!idField || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(idField) || ids.length !== count ||
      !ids.every((id) => Number.isInteger(id)) || new Set(ids).size !== ids.length) {
    throw new Error(`${layer.jurisdictionName} zone service returned ${ids.length} ids for ${count} viewport records`);
  }

  const received = new Map<number, FeatureCollection["features"][number]>();
  for (let start = 0; start < ids.length; start += OBJECT_ID_BATCH) {
    const batch = ids.slice(start, start + OBJECT_ID_BATCH) as number[];
    const parameters = new URLSearchParams(featureParameters);
    for (const key of ["geometry", "geometryType", "inSR", "spatialRel", "resultRecordCount"]) parameters.delete(key);
    parameters.set("objectIds", batch.join(","));
    parameters.set("outFields", `${layer.nameField!},${idField}`);
    const response = await fetcher(`${layer.endpoint}?${parameters}`, {
      headers: { accept: "application/geo+json, application/json" }, signal: AbortSignal.timeout(10_000), cache: "no-store",
    });
    if (!response.ok) throw new Error(`${layer.jurisdictionName} zone service returned ${response.status}`);
    const payload = await response.json() as FeatureCollection;
    if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) throw new Error("Unexpected zone service response");
    for (const feature of payload.features) {
      const id = feature.properties?.[idField];
      if (typeof id !== "number" || !batch.includes(id) || received.has(id)) {
        throw new Error(`${layer.jurisdictionName} zone service returned an unrequested or repeated record`);
      }
      received.set(id, feature);
    }
  }
  if (received.size !== count) {
    throw new Error(`${layer.jurisdictionName} zone service returned ${received.size} of ${count} viewport records by id`);
  }
  return ids.map((id) => received.get(id as number)!);
}

/**
 * North Ground's stored drawings (`zone_display_in_view`): generalised copies of
 * the parity-certified zones, built once per published geometry. A DRAWING,
 * never a boundary determination. The function returns only VERIFIED zones, so
 * an uncertified jurisdiction draws nothing through it.
 */
const STORED_TIMEOUT_MS = 2_500;

export function storedLevelForTolerance(tolerance: number): number {
  // Levels are built at 0.05, 0.015, 0.004 and 0.0008 degrees.
  if (tolerance >= 0.05) return 1;
  if (tolerance >= 0.015) return 2;
  if (tolerance >= 0.004) return 3;
  return 4;
}

type StoredClient = () => Pick<SupabaseClient, "rpc">;

async function storedRecords(layer: ZoneLayer, box: BoundingBox, tolerance: number, client: StoredClient): Promise<SourceRecord[]> {
  const key = cacheKey("stored", layer.id, box, tolerance);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const { data, error } = await client()
    .rpc("zone_display_in_view", {
      p_jurisdiction_canonical_id: layer.jurisdictionId,
      p_west: box.west, p_south: box.south, p_east: box.east, p_north: box.north,
      p_level: storedLevelForTolerance(tolerance),
      p_limit: 400,
    })
    .abortSignal(AbortSignal.timeout(STORED_TIMEOUT_MS));
  if (error) throw error;
  const rows = (data ?? []) as Array<{ official_identifier: string; canonical_id: string; geometry: PolygonGeometry | { type: string } | null }>;
  if (rows.length >= 400) throw new Error(`${layer.jurisdictionName} stored zone query reached its safety limit`);
  const records: SourceRecord[] = [];
  for (const row of rows) {
    const geometry = row.geometry;
    // A zone clipped away entirely comes back as an empty collection: nothing to draw.
    if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) continue;
    /* The designation must mint the same canonical id the rules use, or the
       map would name a zone the engine does not know. */
    if (zoneIdFor(layer, row.official_identifier) !== row.canonical_id) continue;
    const polygons = polygonsOf(geometry as PolygonGeometry);
    if (polygons.length) records.push({ id: row.canonical_id, name: row.official_identifier, polygons });
  }
  return remember(key, records);
}

/* ── Fetch ───────────────────────────────────────────────────────────────── */

export async function fetchLayerGeometry(
  layer: ZoneLayer,
  box: BoundingBox,
  zoom: number,
  fetcher: typeof fetch = fetch,
  storedClient: StoredClient = defaultSupabaseServerClient,
): Promise<ZoneGeometryResult> {
  const tolerance = toleranceForZoom(zoom);
  const authority = Boolean(layer.endpoint && layer.nameField);
  if (!authority && layer.mapGeometry !== "stored") {
    return { status: "EMPTY", layerId: layer.id, features: [], message: "This layer has no reviewed geometry service." };
  }
  const view = clampToLayer(box, layer);
  if (!view) return { status: "EMPTY", layerId: layer.id, features: [], tolerance, message: "No official zones intersect this view." };

  let records: SourceRecord[];
  try {
    if (layer.mapGeometry === "stored") {
      try {
        records = await storedRecords(layer, view, tolerance, storedClient);
      } catch (error) {
        // The authority's own service, where there is one, is the fallback; a guess never is.
        if (!authority) throw error;
        records = await authorityTiles(layer, view, tolerance, fetcher);
      }
    } else {
      records = await authorityTiles(layer, view, tolerance, fetcher);
    }
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

  /* One zone, one feature. An authority may publish a unit as several
     records — Alberta serves WMU 718 as six — and a record may arrive from
     two tiles. Records are de-duplicated by id, then grouped by designation. */
  const seen = new Set<string>();
  const polygonsByName = new Map<string, Position[][][]>();
  for (const record of records) {
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    polygonsByName.set(record.name, [...(polygonsByName.get(record.name) ?? []), ...record.polygons]);
  }

  const features: ZoneFeature[] = [];
  for (const [name, polygons] of polygonsByName) {
    const placement = labelPlacement({ type: "MultiPolygon", coordinates: polygons });
    const presented = presentZone({ designation: name, layerId: layer.id, jurisdictionId: layer.jurisdictionId });
    features.push({
      layerId: layer.id,
      name,
      label: zoneDisplayLabel(layer, name),
      compactLabel: presented.compactLabel,
      accessibleLabel: presented.accessibleLabel,
      coverage: zoneCoverage(layer, name),
      rings: polygons.flat(),
      ...(placement ? { labelPoint: placement.point, labelSpan: placement.span, parts: placement.parts } : {}),
    });
  }
  return features.length
    ? { status: "OK", layerId: layer.id, features, tolerance }
    : { status: "EMPTY", layerId: layer.id, features: [], tolerance, message: "No official zones intersect this view." };
}

async function authorityTiles(layer: ZoneLayer, view: BoundingBox, tolerance: number, fetcher: typeof fetch): Promise<SourceRecord[]> {
  const tiles = queryTiles(view, layer.maxQueryLongitudeSpan);
  // One failed tile fails the layer: half a province drawn as if it were all of it is not honest.
  return (await Promise.all(tiles.map((tile) => authorityRecords(layer, tile, tolerance, fetcher)))).flat();
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
