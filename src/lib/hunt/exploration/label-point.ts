/**
 * Where a zone's name is written on the map.
 *
 * A bounding-box centre is the wrong answer for most hunting zones: it falls in
 * the notch of a C-shaped unit, in the lake a unit wraps around, or in the sea
 * between a zone's islands. The label goes at the pole of inaccessibility of the
 * zone's LARGEST part — the interior point farthest from any edge — so it is
 * always inside the zone, and a zone published as 8,091 island polygons (Québec
 * 19SE) is named once, on its mainland, not 8,091 times.
 *
 * This is a drawing aid. It never decides which zone a point is in.
 */

type Position = [number, number] | number[];
type Ring = Position[];
type Polygon = Ring[];

export type PolygonGeometry =
  | { type: "Polygon"; coordinates: Polygon }
  | { type: "MultiPolygon"; coordinates: Polygon[] };

export interface LabelPlacement {
  /** [longitude, latitude], inside the largest part. */
  point: [number, number];
  /** Width and height, in degrees, of the largest part's bounding box. */
  span: [number, number];
  /** Number of polygon parts the zone is published as. */
  parts: number;
}

/** Planar area of a ring in square degrees (shoelace). Only comparisons use it. */
export function ringArea(ring: Ring): number {
  let sum = 0;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    sum += (ring[previous][0] - ring[index][0]) * (ring[previous][1] + ring[index][1]);
  }
  return Math.abs(sum / 2);
}

function polygonArea(polygon: Polygon): number {
  if (!polygon.length) return 0;
  return polygon.slice(1).reduce((area, hole) => area - ringArea(hole), ringArea(polygon[0]));
}

function segmentDistanceSquared(px: number, py: number, a: Position, b: Position): number {
  let x = a[0];
  let y = a[1];
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((px - x) * dx + (py - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = b[0]; y = b[1]; }
    else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = px - x;
  dy = py - y;
  return dx * dx + dy * dy;
}

/** Signed distance from a point to the polygon outline: positive inside, negative outside. */
function signedDistance(x: number, y: number, polygon: Polygon): number {
  let inside = false;
  let minimum = Infinity;
  for (const ring of polygon) {
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
      const a = ring[index];
      const b = ring[previous];
      if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
      minimum = Math.min(minimum, segmentDistanceSquared(x, y, a, b));
    }
  }
  return (inside ? 1 : -1) * Math.sqrt(minimum);
}

interface Cell { x: number; y: number; half: number; distance: number; max: number }

function cell(x: number, y: number, half: number, polygon: Polygon): Cell {
  const distance = signedDistance(x, y, polygon);
  return { x, y, half, distance, max: distance + half * Math.SQRT2 };
}

/**
 * Pole of inaccessibility (the "polylabel" algorithm), to `precision` degrees.
 * Deterministic: the same polygon always yields the same point.
 */
export function poleOfInaccessibility(polygon: Polygon, precision?: number): [number, number] {
  const outer = polygon[0];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of outer) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const width = maxX - minX;
  const height = maxY - minY;
  const size = Math.min(width, height);
  if (size === 0) return [minX, minY];
  const tolerance = precision ?? Math.max(size / 200, 1e-6);

  let half = size / 2;
  const queue: Cell[] = [];
  for (let x = minX; x < maxX; x += size) {
    for (let y = minY; y < maxY; y += size) queue.push(cell(x + half, y + half, half, polygon));
  }

  // Start from the area centroid, which is often already a good answer.
  let best = cell(minX + width / 2, minY + height / 2, 0, polygon);
  const centroid = areaCentroid(outer);
  if (centroid) {
    const candidate = cell(centroid[0], centroid[1], 0, polygon);
    if (candidate.distance > best.distance) best = candidate;
  }

  let guard = 0;
  while (queue.length && guard < 20_000) {
    guard += 1;
    // Highest potential first; the queue stays small enough for a linear scan.
    let top = 0;
    for (let index = 1; index < queue.length; index += 1) if (queue[index].max > queue[top].max) top = index;
    const current = queue.splice(top, 1)[0];
    if (current.distance > best.distance) best = current;
    if (current.max - best.distance <= tolerance) continue;
    half = current.half / 2;
    queue.push(
      cell(current.x - half, current.y - half, half, polygon),
      cell(current.x + half, current.y - half, half, polygon),
      cell(current.x - half, current.y + half, half, polygon),
      cell(current.x + half, current.y + half, half, polygon),
    );
  }
  return [best.x, best.y];
}

function areaCentroid(ring: Ring): [number, number] | null {
  let area = 0, x = 0, y = 0;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const a = ring[index];
    const b = ring[previous];
    const factor = a[0] * b[1] - b[0] * a[1];
    x += (a[0] + b[0]) * factor;
    y += (a[1] + b[1]) * factor;
    area += factor * 3;
  }
  return area === 0 ? null : [x / area, y / area];
}

/**
 * The label placement for a zone: one point, inside its largest part.
 * Returns null for a geometry with no drawable polygon.
 */
export function labelPlacement(geometry: PolygonGeometry): LabelPlacement | null {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let largest: Polygon | null = null;
  let largestArea = 0;
  for (const polygon of polygons) {
    if (!polygon.length || polygon[0].length < 4) continue;
    const area = polygonArea(polygon);
    if (area > largestArea) { largest = polygon; largestArea = area; }
  }
  if (!largest) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of largest[0]) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const [x, y] = poleOfInaccessibility(largest);
  return {
    point: [Number(x.toFixed(5)), Number(y.toFixed(5))],
    span: [Number((maxX - minX).toFixed(5)), Number((maxY - minY).toFixed(5))],
    parts: polygons.length,
  };
}
