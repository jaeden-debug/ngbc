/**
 * Web Mercator arithmetic for the boundary view and for camera framing, in
 * the same 256-pixel tile convention Google uses, so both maps frame alike.
 */

export interface Viewport {
  latitude: number;
  longitude: number;
  zoom: number;
}

export const TILE = 256;

export function projectX(longitude: number, scale: number): number {
  return ((longitude + 180) / 360) * scale;
}

export function projectY(latitude: number, scale: number): number {
  const clamped = Math.max(-85.05, Math.min(85.05, latitude));
  const radians = (clamped * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * scale;
}

export function unprojectLongitude(x: number, scale: number): number {
  return (x / scale) * 360 - 180;
}

export function unprojectLatitude(y: number, scale: number): number {
  const n = Math.PI * (1 - (2 * y) / scale);
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

/** Zoom at which `features` fit inside a drawing area of `size`, with padding. */
export function zoomToFit(
  bounds: { west: number; south: number; east: number; north: number },
  size: { width: number; height: number },
  padding = 44,
): number {
  const usableWidth = Math.max(80, size.width - padding * 2);
  const usableHeight = Math.max(80, size.height - padding * 2);
  for (let zoom = 12; zoom >= 3; zoom -= 0.25) {
    const scale = TILE * Math.pow(2, zoom);
    const width = projectX(bounds.east, scale) - projectX(bounds.west, scale);
    const height = projectY(bounds.south, scale) - projectY(bounds.north, scale);
    if (width <= usableWidth && height <= usableHeight) return zoom;
  }
  return 3;
}

/**
 * The viewport that shows `bounds` in the part of a `size` drawing area left
 * uncovered by `padding` (a card on the left, a sheet at the bottom).
 */
export function fitViewport(
  bounds: { west: number; south: number; east: number; north: number },
  size: { width: number; height: number },
  padding: { top: number; right: number; bottom: number; left: number },
): Viewport {
  const usable = {
    width: Math.max(120, size.width - padding.left - padding.right),
    height: Math.max(120, size.height - padding.top - padding.bottom),
  };
  const zoom = zoomToFit(bounds, usable, 24);
  const scale = TILE * Math.pow(2, zoom);
  const centreX = (projectX(bounds.west, scale) + projectX(bounds.east, scale)) / 2;
  const centreY = (projectY(bounds.north, scale) + projectY(bounds.south, scale)) / 2;
  // Move the view centre so the zone's centre sits in the middle of the uncovered area.
  const x = centreX - (padding.left - padding.right) / 2;
  const y = centreY - (padding.top - padding.bottom) / 2;
  return { longitude: unprojectLongitude(x, scale), latitude: unprojectLatitude(y, scale), zoom };
}

/** The geographic box a viewport shows in a drawing area of `size`. */
export function viewportBounds(viewport: Viewport, size: { width: number; height: number }) {
  const scale = TILE * Math.pow(2, viewport.zoom);
  const x = projectX(viewport.longitude, scale);
  const y = projectY(viewport.latitude, scale);
  return {
    west: Math.max(-180, unprojectLongitude(x - size.width / 2, scale)),
    east: Math.min(180, unprojectLongitude(x + size.width / 2, scale)),
    north: Math.min(85, unprojectLatitude(y - size.height / 2, scale)),
    south: Math.max(-85, unprojectLatitude(y + size.height / 2, scale)),
  };
}

