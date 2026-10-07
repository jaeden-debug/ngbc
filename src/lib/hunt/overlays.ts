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
import type { CanonicalId } from "../content-contract/index.ts";
import type { LimitationLang } from "./limitation.ts";
import { authored, quoting, type AuthorityQuotation, type ProvenancedText } from "./provenance.ts";

interface CatalogueFeatureBase {
  objectId: number;
  name: string;
  type?: string;
  regulation?: string;
  tokens: string[];
  unclassified: string[];
  specialIds: string[];
}

/** Catalogue wording declares its author before it can enter a renderer. */
export type CatalogueFeature = CatalogueFeatureBase & (
  | { statedAs: string; northGroundSummary?: never }
  | { statedAs?: never; northGroundSummary: string }
);

export interface OverlayCatalogue {
  jurisdictionId: string;
  /** The language in which this authority publishes the catalogue wording. */
  lang: LimitationLang;
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
  /** Carried from the catalogue; never guessed by the quotation constructor. */
  lang: LimitationLang;
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
      lang: catalogue.lang,
    };
  } catch {
    // Not cached: a transient outage must not pin "unavailable" for hours.
    return { available: false, specialIds: null, hits: [], lang: catalogue.lang };
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
): RestrictionRecord[] {
  const out: RestrictionRecord[] = [];
  for (const hit of lookup.hits) {
    const feature = hit.feature;
    if (!feature) {
      out.push({
        name: `a ${hit.layer} feature (id ${hit.objectId})`,
        words: authored("The authority's layer holds a restriction here that North Ground's catalogue does not include; the layer has changed since it was reviewed."),
        sourceId: hit.sourceId,
      });
      continue;
    }
    const reaches = feature.unclassified.length > 0 || feature.tokens.some((token) => affectedBy.includes(token));
    if (reaches && feature.statedAs) {
      out.push({
        name: feature.name + (feature.type ? ` ${feature.type}` : ""),
        words: quoting(
          feature.statedAs,
          hit.sourceId as CanonicalId<"source">,
          feature.regulation ?? `${hit.layer} layer, feature ${feature.objectId}`,
          lookup.lang,
        ),
        sourceId: hit.sourceId,
      });
    } else if (reaches && feature.northGroundSummary) {
      out.push({
        name: feature.name + (feature.type ? ` ${feature.type}` : ""),
        words: authored(feature.northGroundSummary),
        sourceId: hit.sourceId,
      });
    }
  }
  return out;
}

export interface RestrictionRecord {
  name: string;
  /** Authority wording or North Ground wording; never an unclassified string. */
  words: ProvenancedText;
  /** The authority layer that establishes the feature is present. */
  sourceId: string;
}

/**
 * WHAT A PUBLISHED AREA DOES TO A HUNT INSIDE IT.
 *
 * CLAUDE.md §41A, decided 2026-10-01 on Saskatchewan's ss. 7 and 7.1: an area
 * carries its hunting effect as its own field, decided by the AUTHORITY'S OWN
 * WORDS and never inferred from what the area is called, what type it is, or
 * its conservation status. "National Wildlife Area" predicts nothing about
 * hunting, which is exactly what Saskatchewan demonstrates — it DEEMS eight
 * protected and national wildlife areas OPEN inside an open zone.
 *
 * WHY THIS EXISTS AT ALL. The declared vocabulary was never implemented:
 * `DEEMED_OPEN`, `OPEN_ONLY_IF_LISTED` and `huntingEffect` had zero occurrences
 * anywhere in `src/`, `content/` or `research/`. Five ad-hoc representations
 * accumulated in its place, and the only one reaching an answer —
 * `exceptInside: string[]` — carries NAMES ONLY and can do exactly one thing:
 * degrade a zone to NEEDS_VERIFICATION. A deemed-open area arriving through it
 * would read as "the answer depends on where you hunt" for ground the authority
 * expressly opened, which is §8's understating direction and the one nobody
 * reports, because a hunter told to look elsewhere simply goes elsewhere.
 */
export type AreaHuntingEffect = "DEEMED_OPEN" | "EXCLUDED" | "OPEN_ONLY_IF_LISTED" | "UNRESOLVED";

/**
 * An area and what it does, as the authority says.
 *
 * DEEMED_OPEN structurally REQUIRES an `AuthorityQuotation` — North Ground
 * cannot deem ground open on its own say-so, and §41A's requirement to name the
 * provision that opens it is satisfied by that quotation's mandatory
 * `citation`, so no second field restates it.
 *
 * UNRESOLVED is the default for everything North Ground has not established,
 * which is what keeps the migration honest: an area gains a stronger effect
 * only when an authority's words give it one.
 */
export type AreaEffect =
  | (RestrictionRecord & { effect: "DEEMED_OPEN"; words: AuthorityQuotation })
  | (RestrictionRecord & { effect: "EXCLUDED" | "UNRESOLVED" })
  /**
   * A class closed except for named members. Membership of the list IS the
   * fact, so this is three-valued: an unlisted area is closed, and an absent
   * list is UNKNOWN — never "all closed" and never "all open".
   */
  | (RestrictionRecord & { effect: "OPEN_ONLY_IF_LISTED"; listed: true | false | "LIST_NOT_HELD" });

/** Whether an area stops a season running inside it, on the authority's words. */
export function areaWithholdsSeason(area: AreaEffect): boolean {
  if (area.effect === "DEEMED_OPEN") return false;
  if (area.effect === "OPEN_ONLY_IF_LISTED") return area.listed !== true;
  return true;
}
