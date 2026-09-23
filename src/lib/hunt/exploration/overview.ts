import { ZONE_LAYERS } from "../zone-layers.ts";
import { boxKey, lodSpec, requestBoxFor, type BBox } from "./geometry-store.ts";

/**
 * Three different things that were one constant, and the difference matters.
 *
 * `SERVED_EXTENT` is a COVERAGE claim: the union of the bounds of every layer
 * North Ground serves. It decides whether a point is somewhere we can answer
 * about. It must be neither widened nor narrowed for any other purpose —
 * narrowing it to buy performance would shrink a regulatory claim.
 *
 * `OPENING_CAMERA` is where the map OPENS. It is declared here, not derived
 * from coverage, because deriving it meant every ingest moved every hunter's
 * opening view: serving Yukon and Newfoundland widened the union, so the map
 * zoomed out and the first request grew with it. Moving the camera is the
 * owner's decision, never a side effect of an ingest.
 *
 * A REQUEST BOX is the viewport, clamped to coverage. It is what the map asks
 * for, and it is never the union of bounds.
 */
const SERVED = ZONE_LAYERS.filter((layer) => layer.serving);

export const SERVED_EXTENT: BBox = {
  west: Math.min(...SERVED.map((layer) => layer.bounds.minLongitude)),
  south: Math.min(...SERVED.map((layer) => layer.bounds.minLatitude)),
  east: Math.max(...SERVED.map((layer) => layer.bounds.maxLongitude)),
  north: Math.max(...SERVED.map((layer) => layer.bounds.maxLatitude)),
};

/**
 * Where Hunt opens, on every screen. Declared, and changed only deliberately.
 */
export const OPENING_CAMERA = { latitude: 52.5, longitude: -90, zoom: 4 } as const;

/** The reference screen the opening view and the poster are drawn for. */
const REFERENCE_SCREEN = { width: 1440, height: 900 };
const TILE = 256;

/** The box a camera shows on a screen of that size, in degrees. */
export function cameraBox(
  camera: { latitude: number; longitude: number; zoom: number } = OPENING_CAMERA,
  screen: { width: number; height: number } = REFERENCE_SCREEN,
): BBox {
  const scale = TILE * 2 ** camera.zoom;
  const degreesPerPx = 360 / scale;
  const halfWidth = (screen.width / 2) * degreesPerPx;
  // Latitude compresses with the projection; a Mercator step is enough here.
  const worldY = (1 - Math.log(Math.tan((camera.latitude * Math.PI) / 180) + 1 / Math.cos((camera.latitude * Math.PI) / 180)) / Math.PI) / 2;
  const northY = worldY - screen.height / 2 / scale;
  const southY = worldY + screen.height / 2 / scale;
  const toLatitude = (y: number) => (180 / Math.PI) * Math.atan(Math.sinh(Math.PI * (1 - 2 * y)));
  return {
    west: camera.longitude - halfWidth,
    east: camera.longitude + halfWidth,
    north: Math.min(85, toLatitude(Math.max(0, northY))),
    south: Math.max(-85, toLatitude(Math.min(1, southY))),
  };
}

/** A request box: what is visible, never wider than what is covered. */
export function requestBox(view: BBox): BBox {
  return {
    west: Math.max(view.west, SERVED_EXTENT.west),
    east: Math.min(view.east, SERVED_EXTENT.east),
    south: Math.max(view.south, SERVED_EXTENT.south),
    north: Math.min(view.north, SERVED_EXTENT.north),
  };
}

/**
 * The opening view: the declared camera, as the map asks for it — snapped to
 * the level-0 grid and clamped to coverage. Asking for the raw view instead
 * left every zone on its edge clipped, which the map then had to ask about a
 * second time.
 */
export const OPENING_BOX: BBox = requestBoxFor(requestBox(cameraBox()), 0, SERVED_EXTENT) ?? requestBox(cameraBox());

/**
 * The opening view on THIS device.
 *
 * A phone at the opening camera sees about a third of the width a laptop does,
 * and asking for the rest is asking for country it cannot draw. The reference
 * box above is what the page preloads and the poster is drawn for, because a
 * server cannot know the screen; this is what the map actually asks for.
 */
export function openingBoxFor(screen: { width: number; height: number }): BBox {
  const view = requestBox(cameraBox(OPENING_CAMERA, screen));
  return requestBoxFor(view, 0, SERVED_EXTENT) ?? view;
}

export const OVERVIEW_URL = `/api/hunt/zones?bounds=${boxKey(OPENING_BOX)}&zoom=${lodSpec(0).requestZoom}`;

/**
 * The same request for a chosen species. A jurisdiction that writes its
 * seasons in species geographies (Newfoundland) answers with that species'
 * areas; everywhere else answers exactly as before.
 */
export function overviewUrl(speciesId?: string | null, box: BBox = OPENING_BOX): string {
  const url = `/api/hunt/zones?bounds=${boxKey(box)}&zoom=${lodSpec(0).requestZoom}`;
  return speciesId ? `${url}&species=${encodeURIComponent(speciesId)}` : url;
}

/** The zoom the first request is asked for; the poster draws exactly this answer. */
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

/** "Alberta, Manitoba, Ontario and Québec" from a set of names. */
export function readAsList(names: Iterable<string>): string {
  const sorted = [...new Set(names)].sort((a, b) => a.localeCompare(b, "en-CA"));
  return sorted.length <= 1 ? sorted.join("") : `${sorted.slice(0, -1).join(", ")} and ${sorted.at(-1)}`;
}

/** Whose geography a set of drawn features is, by the layer each came from. */
export function jurisdictionsDrawn(features: readonly { layerId: string }[]): string[] {
  const byId = new Map(SERVED.map((layer) => [layer.id, layer.jurisdictionName]));
  const names = new Set<string>();
  for (const feature of features) {
    const name = byId.get(feature.layerId);
    if (name) names.add(name);
  }
  return [...names];
}
