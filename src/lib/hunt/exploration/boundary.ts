/**
 * Which neighbouring zone a near-boundary point sits beside.
 *
 * The resolver already measures the point's distance to its own zone's full
 * boundary and flags it; that flag is the warning. This names the zone on the
 * other side of the line from the drawn map geometry, so the warning can say
 * "near the boundary of WMU 57 and WMU 58" instead of only "near a boundary".
 *
 * The drawn geometry is generalised for display, so this is an identification
 * aid with a tolerance, never a determination of which side a point is on.
 */

export interface DrawnZone {
  layerId: string;
  name: string;
  label: string;
  rings: number[][][];
}

const METRES_PER_DEGREE_LATITUDE = 110_540;

function distanceToSegmentMetres(
  latitude: number, longitude: number, start: number[], end: number[],
): number {
  const metresPerLongitude = 111_320 * Math.cos((latitude * Math.PI) / 180);
  const ax = (start[0] - longitude) * metresPerLongitude;
  const ay = (start[1] - latitude) * METRES_PER_DEGREE_LATITUDE;
  const bx = (end[0] - longitude) * metresPerLongitude;
  const by = (end[1] - latitude) * METRES_PER_DEGREE_LATITUDE;
  const dx = bx - ax;
  const dy = by - ay;
  const denominator = dx * dx + dy * dy;
  const t = denominator === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / denominator));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

export function distanceToZoneMetres(point: { latitude: number; longitude: number }, zone: Pick<DrawnZone, "rings">): number {
  let minimum = Infinity;
  for (const ring of zone.rings) {
    for (let index = 1; index < ring.length; index += 1) {
      minimum = Math.min(minimum, distanceToSegmentMetres(point.latitude, point.longitude, ring[index - 1], ring[index]));
    }
  }
  return minimum;
}

/**
 * The nearest drawn zone other than the one the point resolved to, within
 * `withinMetres` of the point. Null when none is that close — including when
 * the neighbouring zone is simply not drawn, which is never read as "none".
 */
export function nearestNeighbour(
  point: { latitude: number; longitude: number },
  current: { layerId: string; name: string },
  zones: readonly DrawnZone[],
  withinMetres: number,
): { zone: DrawnZone; distanceMetres: number } | null {
  let best: { zone: DrawnZone; distanceMetres: number } | null = null;
  for (const zone of zones) {
    if (zone.layerId === current.layerId && zone.name.toUpperCase() === current.name.toUpperCase()) continue;
    const distance = distanceToZoneMetres(point, zone);
    if (distance <= withinMetres && (!best || distance < best.distanceMetres)) best = { zone, distanceMetres: distance };
  }
  return best;
}
