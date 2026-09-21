import { MANITOBA_OVERLAYS } from "../regulatory/manitoba.ts";
import type { OverlayCatalogue } from "../overlays.ts";
import { layerForJurisdiction } from "../zone-layers.ts";
import { toleranceForZoom, type BoundingBox } from "../zone-geometry.ts";
import { labelPlacement, type PolygonGeometry } from "./label-point.ts";

/**
 * Special regulatory geography the map may draw on request.
 *
 * Only layers North Ground already reads for its own answers appear here:
 * the authority's refuge, conservation-area, wildlife-management-area and
 * closed-lands services that the Manitoba engine checks at a point. They come
 * with their standing stated plainly: the authority's map of areas it publishes
 * restrictions for, with the written regulation in control, and not certified
 * by North Ground as closures. A jurisdiction without such a layer offers none,
 * and nothing decorative is ever added to fill the control.
 */

export interface OverlayLayerDescriptor {
  id: string;
  jurisdictionId: string;
  jurisdictionName: string;
  name: string;
  authority: string;
  sourceId: string;
  /** What the drawing is and is not, in one sentence. */
  standing: string;
  extent: BoundingBox;
}

export interface OverlayFeature {
  layerId: string;
  objectId: number;
  name: string;
  type?: string;
  /** The authority's restriction text, verbatim; empty where it publishes none. */
  statedAs: string;
  regulation?: string;
  rings: number[][][];
  labelPoint?: [number, number];
  labelSpan?: [number, number];
}

interface CatalogueLayer {
  descriptor: OverlayLayerDescriptor;
  url: string;
  catalogue: OverlayCatalogue["layers"][number];
}

/* The catalogue names its layers by key; these are the authority's own categories. */
const LAYER_NAMES: Record<string, string> = {
  closed: "Lands closed to hunting",
  refuges: "Wildlife refuges",
  scas: "Special conservation areas",
  wmas: "Wildlife management areas",
};

const STANDING =
  "The authority's own map of areas it publishes hunting restrictions for. The written regulation controls, and North Ground " +
  "reads these at an exact point without certifying them as closures.";

function fromCatalogue(catalogue: OverlayCatalogue): CatalogueLayer[] {
  const layer = layerForJurisdiction(catalogue.jurisdictionId);
  if (!layer?.serving) return [];
  const extent = {
    west: layer.bounds.minLongitude,
    south: layer.bounds.minLatitude,
    east: layer.bounds.maxLongitude,
    north: layer.bounds.maxLatitude,
  };
  return catalogue.layers
    // Only ArcGIS layers can be drawn through this path; any other protocol is left out, not guessed at.
    .filter((entry) => ((entry as { protocol?: string }).protocol ?? "ARCGIS") === "ARCGIS")
    .map((entry) => ({
      url: entry.url,
      catalogue: entry,
      descriptor: {
        id: `overlay:${catalogue.jurisdictionId.replace("jurisdiction:", "")}-${entry.key}`,
        jurisdictionId: catalogue.jurisdictionId,
        jurisdictionName: layer.jurisdictionName,
        name: LAYER_NAMES[entry.key] ?? entry.key,
        authority: layer.authority,
        sourceId: entry.sourceId,
        standing: STANDING,
        extent,
      },
    }));
}

const LAYERS: CatalogueLayer[] = [...fromCatalogue(MANITOBA_OVERLAYS)];

export function overlayLayersFor(box: BoundingBox): OverlayLayerDescriptor[] {
  return LAYERS
    .filter(({ descriptor: { extent } }) =>
      box.west <= extent.east && box.east >= extent.west && box.south <= extent.north && box.north >= extent.south)
    .map(({ descriptor }) => descriptor);
}

export function overlayLayerById(id: string): OverlayLayerDescriptor | undefined {
  return LAYERS.find(({ descriptor }) => descriptor.id === id)?.descriptor;
}

/* ── Geometry ──────────────────────────────────────────────────────────── */

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 200;
const cache = new Map<string, { expiresAt: number; value: OverlayFeature[] }>();

export function clearOverlayGeometryCache(): void {
  cache.clear();
}

export async function fetchOverlayGeometry(
  id: string,
  box: BoundingBox,
  zoom: number,
  fetcher: typeof fetch = fetch,
): Promise<{ status: "OK" | "EMPTY" | "PROVIDER_ERROR" | "UNKNOWN_LAYER"; features: OverlayFeature[]; message?: string }> {
  const layer = LAYERS.find(({ descriptor }) => descriptor.id === id);
  if (!layer) return { status: "UNKNOWN_LAYER", features: [] };

  const tolerance = toleranceForZoom(zoom);
  const snap = (value: number) => (Math.round(value / tolerance) * tolerance).toFixed(4);
  const key = `${id}|${snap(box.west)},${snap(box.south)},${snap(box.east)},${snap(box.north)}|${tolerance}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return { status: cached.value.length ? "OK" : "EMPTY", features: cached.value };

  const parameters = new URLSearchParams({
    where: "1=1",
    geometry: `${box.west},${box.south},${box.east},${box.north}`,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "OBJECTID",
    returnGeometry: "true",
    maxAllowableOffset: String(tolerance),
    outSR: "4326",
    resultRecordCount: "400",
    f: "geojson",
  });

  try {
    const response = await fetcher(`${layer.url}/query?${parameters}`, {
      headers: { accept: "application/geo+json, application/json" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`overlay service returned ${response.status}`);
    const payload = await response.json() as {
      type?: string;
      features?: Array<{ id?: number; properties?: Record<string, unknown>; geometry: PolygonGeometry | null }>;
    };
    if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) throw new Error("Unexpected response");

    const byId = new Map(layer.catalogue.features.map((feature) => [feature.objectId, feature]));
    const features: OverlayFeature[] = [];
    for (const feature of payload.features) {
      const objectId = Number(feature.properties?.OBJECTID ?? feature.id);
      const geometry = feature.geometry;
      if (!Number.isFinite(objectId) || !geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) continue;
      const known = byId.get(objectId);
      const rings = (geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat())
        .filter((ring) => ring.length >= 4) as number[][][];
      if (!rings.length) continue;
      const placement = labelPlacement(geometry);
      features.push({
        layerId: id,
        objectId,
        // A feature the catalogue does not hold is drawn and named as unread, never dropped.
        name: known?.name ?? "An area North Ground has not read",
        ...(known?.type ? { type: known.type } : {}),
        statedAs: known ? known.statedAs : "The authority has published this area since North Ground last read the layer. Check the authority's own record.",
        ...(known?.regulation ? { regulation: known.regulation } : {}),
        rings,
        ...(placement ? { labelPoint: placement.point, labelSpan: placement.span } : {}),
      });
    }
    if (cache.size >= CACHE_MAX) {
      const oldest = cache.keys().next();
      if (!oldest.done) cache.delete(oldest.value);
    }
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: features });
    return { status: features.length ? "OK" : "EMPTY", features };
  } catch {
    return {
      status: "PROVIDER_ERROR",
      features: [],
      message: `${layer.descriptor.authority}'s ${layer.descriptor.name.toLowerCase()} service did not answer. Nothing is drawn in its place.`,
    };
  }
}
