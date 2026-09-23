import { ZONE_LAYERS } from "../zone-layers.ts";
import { boxKey, lodSpec, type BBox } from "./geometry-store.ts";

/**
 * The one request for every served zone's overview drawing.
 *
 * Shared by the page, which asks the browser to start it while the HTML is
 * still arriving, and the map's geometry store, which uses that same response —
 * so the geometry the map needs first is never queued behind hydration.
 */
const SERVED = ZONE_LAYERS.filter((layer) => layer.serving);

export const SERVED_EXTENT: BBox = {
  west: Math.min(...SERVED.map((layer) => layer.bounds.minLongitude)),
  south: Math.min(...SERVED.map((layer) => layer.bounds.minLatitude)),
  east: Math.max(...SERVED.map((layer) => layer.bounds.maxLongitude)),
  north: Math.max(...SERVED.map((layer) => layer.bounds.maxLatitude)),
};

export const OVERVIEW_URL = `/api/hunt/zones?bounds=${boxKey(SERVED_EXTENT)}&zoom=${lodSpec(0).requestZoom}`;

/**
 * The same request for a chosen species. A jurisdiction that writes its
 * seasons in species geographies (Newfoundland) answers with that species'
 * areas; everywhere else answers exactly as before.
 */
export function overviewUrl(speciesId?: string | null): string {
  return speciesId ? `${OVERVIEW_URL}&species=${encodeURIComponent(speciesId)}` : OVERVIEW_URL;
}

/** The zoom the overview is asked for; the poster draws exactly this answer. */
export const OVERVIEW_ZOOM = lodSpec(0).requestZoom;

/**
 * A version for everything the overview is drawn from: which layers are
 * served, from which source and how. Serving a new jurisdiction, or changing
 * where a layer's drawings come from, changes it — so nothing cached against
 * the old set (the poster) can be shown for the new one.
 */
export function servedGeometryVersion(): string {
  const identity = JSON.stringify(SERVED.map((layer) => [
    layer.id, layer.sourceId, layer.mapGeometry ?? "authority", layer.resolution ?? "REGISTRY", layer.zoneIdPrefix,
    layer.bounds, layer.certifiedDesignations?.size ?? 0,
    // A species-scoped layer is in the overview only when drawn by default.
    layer.speciesScope ? [...layer.speciesScope, layer.drawnByDefault === true] : null,
  ]));
  let hash = 0x811c9dc5;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** Readers' names for the served jurisdictions: "Alberta, Manitoba, Ontario and Québec". */
export function servedJurisdictionList(): string {
  const names = [...new Set(SERVED.map((layer) => layer.jurisdictionName))].sort((a, b) => a.localeCompare(b, "en-CA"));
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
