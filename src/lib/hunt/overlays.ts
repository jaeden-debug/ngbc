/**
 * Published restrictions on the land under a point.
 *
 * A season table says when a species may be hunted in an area. It does not say
 * whether the point is inside a refuge, a wildlife management area where
 * hunting is prohibited, a national park, or a base closed to all hunting — each
 * of which the authority publishes separately, with its own restriction text.
 *
 * The catalogue is built from those layers and classified at build time, so the
 * run-time lookup only asks the authority's service which features contain the
 * point and reads the catalogue. A feature the catalogue does not hold (the
 * layer has changed since the build) is reported as a restriction North Ground
 * has not read, never ignored.
 */

export interface CatalogueFeature {
  objectId: number;
  name: string;
  type?: string;
  statedAs: string;
  regulation?: string;
  tokens: string[];
  unclassified: string[];
  specialIds: string[];
}

export interface OverlayCatalogue {
  jurisdictionId: string;
  layers: Array<{ key: string; url: string; sourceId: string; features: CatalogueFeature[] }>;
}

export interface OverlayHit {
  layer: string;
  sourceId: string;
  objectId: number;
  /** Null when the service returned a feature the catalogue does not hold. */
  feature: CatalogueFeature | null;
}

export interface OverlayLookup {
  /** False when any layer could not be asked; the answer must then say so. */
  available: boolean;
  /** Special geographies containing the point, or null when not available. */
  specialIds: ReadonlySet<string> | null;
  hits: OverlayHit[];
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map<string, { expiresAt: number; value: OverlayLookup }>();

export function clearOverlayCache(): void {
  cache.clear();
}

async function objectIdsAt(url: string, latitude: number, longitude: number, fetcher: typeof fetch): Promise<number[]> {
  const parameters = new URLSearchParams({
    geometry: `${longitude},${latitude}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "OBJECTID",
    returnGeometry: "false",
    f: "json",
  });
  const response = await fetcher(`${url}/query?${parameters}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(5_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`overlay service returned ${response.status}`);
  const payload = await response.json() as { features?: Array<{ attributes?: { OBJECTID?: number } }>; error?: unknown };
  if (payload.error || !Array.isArray(payload.features)) throw new Error("overlay service error");
  return payload.features.map((feature) => Number(feature.attributes?.OBJECTID)).filter(Number.isInteger);
}

/**
 * Which catalogued features contain the point, asked of the authority's own
 * layers. A failed layer makes the whole lookup unavailable rather than
 * partially answered: "none found" from half the layers is not "none".
 */
export async function lookupOverlays(
  catalogue: OverlayCatalogue,
  latitude: number,
  longitude: number,
  fetcher: typeof fetch = fetch,
): Promise<OverlayLookup> {
  // Five decimal places is about a metre: two lookups that close are one place.
  const key = `${catalogue.jurisdictionId}|${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let value: OverlayLookup;
  try {
    const answers = await Promise.all(catalogue.layers.map(async (layer) => ({
      layer,
      ids: await objectIdsAt(layer.url, latitude, longitude, fetcher),
    })));
    const hits: OverlayHit[] = answers.flatMap(({ layer, ids }) => ids.map((objectId) => ({
      layer: layer.key,
      sourceId: layer.sourceId,
      objectId,
      feature: layer.features.find((feature) => feature.objectId === objectId) ?? null,
    })));
    value = {
      available: true,
      specialIds: new Set(hits.flatMap((hit) => hit.feature?.specialIds ?? [])),
      hits,
    };
  } catch {
    // Not cached: a transient outage must not pin "unavailable" for hours.
    return { available: false, specialIds: null, hits: [] };
  }

  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}

/**
 * The restrictions at this point that reach a species, given the tokens that
 * species is affected by. Anything unread — an unclassified sentence, or a
 * feature missing from the catalogue — reaches every species.
 */
export function restrictionsFor(
  lookup: OverlayLookup,
  affectedBy: readonly string[],
): Array<{ name: string; statedAs: string; sourceId: string }> {
  const out: Array<{ name: string; statedAs: string; sourceId: string }> = [];
  for (const hit of lookup.hits) {
    const feature = hit.feature;
    if (!feature) {
      out.push({
        name: `a ${hit.layer} feature (id ${hit.objectId})`,
        statedAs: "The authority's layer holds a restriction here that North Ground's catalogue does not include; the layer has changed since it was reviewed.",
        sourceId: hit.sourceId,
      });
      continue;
    }
    const reaches = feature.unclassified.length > 0 || feature.tokens.some((token) => affectedBy.includes(token));
    if (reaches && feature.statedAs) {
      out.push({ name: feature.name + (feature.type ? ` ${feature.type}` : ""), statedAs: feature.statedAs, sourceId: hit.sourceId });
    }
  }
  return out;
}
