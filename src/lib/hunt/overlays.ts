/**
 * Published restrictions on the land under a point.
 *
 * A season table says when a species may be hunted in an area. It does not say
 * whether the point is inside a refuge, a wildlife management area where
 * hunting is prohibited, a national park, or a base closed to all hunting — each
 * of which the authority publishes separately, with its own restriction text.
 *
 * The catalogue is built from those layers and classified at build time, so the
 * run-time lookup only asks which features contain the point and reads the
 * catalogue. Where the authority's licence lets North Ground store a layer
 * (`storedLayerId`), that question is one indexed query against the stored
 * copy (`special_areas_at_point`), used only while the copy is CURRENT and was
 * loaded against this very catalogue; otherwise the authority's own service is
 * asked. A feature the catalogue does not hold (the
 * layer has changed since the build) is reported as a restriction North Ground
 * has not read, never ignored.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultSupabaseServerClient } from "../supabase/server.ts";

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
  layers: Array<{
    key: string;
    url: string;
    sourceId: string;
    /**
     * How the authority serves the layer. ArcGIS (the default) is asked for
     * OBJECTIDs; a WFS layer is asked for its features' own ids, whose numeric
     * suffix is the catalogue's `objectId` (Québec's Chasse_Interdite.81 → 81).
     */
    protocol?: "ARCGIS" | "WFS";
    /** The WFS type name, when `protocol` is WFS. */
    typeName?: string;
    /** The stored copy of this layer (`regulatory_special_area_layers`), where the licence permits one. */
    storedLayerId?: string;
    /** The catalogue's hash of its features; a stored copy loaded against any other is not used. */
    contentHash?: string;
    features: CatalogueFeature[];
  }>;
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

/**
 * Feature ids at a point from an OGC WFS layer.
 *
 * The point goes as EWKT with SRID=4326: without it GeoServer reads the numbers
 * in the layer's native projection and matches nothing, which would read as
 * "no restriction here" everywhere. Only a short name is asked for: the id comes
 * back with every feature, and a park's full outline would not fit the budget.
 */
async function wfsObjectIdsAt(
  url: string,
  typeName: string,
  latitude: number,
  longitude: number,
  fetcher: typeof fetch,
): Promise<number[]> {
  const parameters = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeNames: typeName,
    outputFormat: "application/json",
    propertyName: "NOM",
    CQL_FILTER: `INTERSECTS(the_geom,SRID=4326;POINT(${longitude} ${latitude}))`,
  });
  const response = await fetcher(`${url}?${parameters}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(5_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`overlay service returned ${response.status}`);
  const payload = await response.json() as { features?: Array<{ id?: string }> };
  if (!Array.isArray(payload.features)) throw new Error("overlay service error");
  return payload.features.map((feature) => {
    const match = /\.(\d+)$/.exec(String(feature.id ?? ""));
    // An id this cannot read is still a restriction: kept as -1, never dropped.
    return match ? Number(match[1]) : -1;
  });
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

/** The Supabase client for stored special areas; tests pass a stand-in or none. */
export type SpecialAreaClient = (() => Pick<SupabaseClient, "rpc">) | null;

const STORED_TIMEOUT_MS = 1_500;

/**
 * Record ids at the point for each stored layer that may be served, in one
 * query. A layer is absent from the result, and so asked live, when its copy
 * is not CURRENT, was loaded against a different catalogue, or the query fails.
 */
async function storedIdsAt(
  layers: OverlayCatalogue["layers"],
  latitude: number,
  longitude: number,
  client: SpecialAreaClient,
): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  const stored = layers.filter((layer) => layer.storedLayerId && layer.contentHash);
  if (!client || !stored.length) return out;
  try {
    const { data, error } = await client()
      .rpc("special_areas_at_point", { p_latitude: latitude, p_longitude: longitude, p_layer_ids: stored.map((layer) => layer.storedLayerId) })
      .abortSignal(AbortSignal.timeout(STORED_TIMEOUT_MS));
    if (error) throw error;
    const rows = (data ?? []) as Array<{ layer_id: string; catalogue_hash: string | null; servable: boolean; source_record_id: string | null }>;
    for (const layer of stored) {
      const own = rows.filter((row) => row.layer_id === layer.storedLayerId);
      const marker = own.find((row) => row.source_record_id === null);
      if (!marker?.servable || marker.catalogue_hash !== layer.contentHash) continue;
      out.set(layer.key, own.filter((row) => row.source_record_id !== null).map((row) => {
        const id = Number(row.source_record_id);
        // An id this cannot read is still a restriction: kept as -1, never dropped.
        return Number.isInteger(id) ? id : -1;
      }));
    }
  } catch {
    // The store is an accelerator, never the only way to know: every stored layer is asked live.
    out.clear();
  }
  return out;
}

/**
 * Which catalogued features contain the point, asked of the stored copy where
 * one may be served and of the authority's own layers otherwise. A failed layer makes the whole lookup unavailable rather than
 * partially answered: "none found" from half the layers is not "none".
 */
export async function lookupOverlays(
  catalogue: OverlayCatalogue,
  latitude: number,
  longitude: number,
  fetcher: typeof fetch = fetch,
  specialAreas: SpecialAreaClient = defaultSupabaseServerClient,
): Promise<OverlayLookup> {
  // Five decimal places is about a metre: two lookups that close are one place.
  const key = `${catalogue.jurisdictionId}|${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let value: OverlayLookup;
  try {
    const stored = await storedIdsAt(catalogue.layers, latitude, longitude, specialAreas);
    const answers = await Promise.all(catalogue.layers.map(async (layer) => ({
      layer,
      ids: stored.get(layer.key) ?? (layer.protocol === "WFS"
        ? await wfsObjectIdsAt(layer.url, layer.typeName ?? "", latitude, longitude, fetcher)
        : await objectIdsAt(layer.url, latitude, longitude, fetcher)),
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
