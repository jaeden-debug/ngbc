import type { OverlayCatalogue, OverlayLookup } from "./overlays.ts";

/**
 * The published special areas that lie inside each zone.
 *
 * A point answer asks the authority which refuge, closed land or conservation
 * area contains the point. A whole-zone answer needs the same fact for the
 * zone: which of those areas overlap it. `scripts/build-overlay-zone-index.mjs`
 * asks the authority's own layers with each zone's full polygon (intersecting,
 * minus merely touching the edge) and commits the result, so this is a lookup,
 * not a guess, and never a network call at answer time.
 */

export interface OverlayZoneIndex {
  retrievedAt: string;
  contentHash: string;
  zones: Record<string, Array<{ layer: string; objectId: number }>>;
}

/**
 * The areas inside a zone, in the same shape as a point lookup, so the same
 * `restrictionsFor` decides which of them reach a species. Null when the zone
 * is not in the index — which means "not checked", never "nothing there".
 */
export function overlaysInZone(catalogue: OverlayCatalogue, index: OverlayZoneIndex, designation: string): OverlayLookup | null {
  const entries = index.zones[designation.trim().toUpperCase()] ?? index.zones[designation.trim()];
  if (!entries) return null;
  return {
    available: true,
    // Which special geographies contain a POINT is not a zone fact; the engine treats them as open worlds.
    specialIds: null,
    hits: entries.map(({ layer, objectId }) => {
      const source = catalogue.layers.find((candidate) => candidate.key === layer);
      return {
        layer,
        sourceId: source?.sourceId ?? "",
        objectId,
        feature: source?.features.find((feature) => feature.objectId === objectId) ?? null,
      };
    }),
  };
}
