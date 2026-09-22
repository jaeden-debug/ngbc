import { poleOfInaccessibility, ringArea } from "../exploration/label-point.ts";

/**
 * Parity sample points computed from a layer held in memory.
 *
 * The same points `zone_sample_points` computes in PostGIS, for layers North
 * Ground does not store: an interior point per unit, a point just inside its
 * closest boundary (99.5% of the way out from the interior point) and one just
 * across it (0.5% past the boundary point). A unit published in several parts
 * gets an interior point in each sizeable part.
 *
 * Membership is decided here against the authority's full, unsimplified
 * geometry, which is what the parity certification compares its live answers
 * and North Ground's production resolver with.
 */

type Position = number[];
type Ring = Position[];
type Polygon = Ring[];
export type Geometry = { type: "Polygon"; coordinates: Polygon } | { type: "MultiPolygon"; coordinates: Polygon[] };

export function polygonsOf(geometry: Geometry): Polygon[] {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

/** Even-odd ray casting across a polygon's rings, so holes are outside. */
function inPolygon(point: [number, number], polygon: Polygon): boolean {
  const [x, y] = point;
  let inside = false;
  for (const ring of polygon) {
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
      const [xi, yi] = ring[index];
      const [xj, yj] = ring[previous];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

export function pointInGeometry(point: [number, number], geometry: Geometry): boolean {
  return polygonsOf(geometry).some((polygon) => inPolygon(point, polygon));
}

/** The point on the geometry's boundary closest to `point`, in planar degrees. */
export function closestBoundaryPoint(point: [number, number], geometry: Geometry): [number, number] {
  let best: [number, number] = point;
  let bestDistance = Number.POSITIVE_INFINITY;
  const [px, py] = point;
  for (const polygon of polygonsOf(geometry)) {
    for (const ring of polygon) {
      for (let index = 1; index < ring.length; index += 1) {
        const [ax, ay] = ring[index - 1];
        const [bx, by] = ring[index];
        const dx = bx - ax;
        const dy = by - ay;
        const length = dx * dx + dy * dy;
        const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length));
        const cx = ax + t * dx;
        const cy = ay + t * dy;
        const distance = (cx - px) ** 2 + (cy - py) ** 2;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = [cx, cy];
        }
      }
    }
  }
  return best;
}

export interface UnitSamples {
  identifier: string;
  inside: [number, number];
  edge: [number, number];
  across: [number, number];
  /** Interior points of each sizeable part, when the unit has more than one. */
  components: Array<{ rank: number; count: number; point: [number, number] }>;
}

/** Points certification asks about for one unit. Coordinates are [longitude, latitude]. */
export function unitSamples(identifier: string, geometry: Geometry, maxComponents = 8): UnitSamples {
  const polygons = polygonsOf(geometry)
    .filter((polygon) => polygon[0]?.length >= 4)
    .map((polygon) => ({ polygon, area: ringArea(polygon[0]) }))
    .sort((a, b) => b.area - a.area);
  if (!polygons.length) throw new Error(`Unit ${identifier} has no polygon to sample`);
  const inside = poleOfInaccessibility(polygons[0].polygon);
  const closest = closestBoundaryPoint(inside, geometry);
  const edge: [number, number] = [inside[0] + 0.995 * (closest[0] - inside[0]), inside[1] + 0.995 * (closest[1] - inside[1])];
  const across: [number, number] = [closest[0] + 0.005 * (closest[0] - inside[0]), closest[1] + 0.005 * (closest[1] - inside[1])];
  /* Parts too small to hold a point a phone could report (a zero-area sliver
     left by digitising) are not sampled; they carry no area to hunt in. */
  const sizeable = polygons.filter(({ area }) => area > 1e-9);
  const components = sizeable.length > 1
    ? sizeable.slice(0, maxComponents).map(({ polygon }, index) => ({
        rank: index + 1,
        count: sizeable.length,
        point: poleOfInaccessibility(polygon),
      }))
    : [];
  return { identifier, inside, edge, across, components };
}

/**
 * Pairs of points on either side of a unit's boundary at `count` places spread
 * along its outer ring: one a short step in toward the unit's interior point,
 * one the same step out. Used where a layer has few units and long shared
 * lines — Montana's two upland districts meet along the whole Continental
 * Divide — so one edge sample per unit would test one place on that line.
 */
export function boundarySamples(geometry: Geometry, inside: [number, number], count: number): Array<{ edge: [number, number]; across: [number, number] }> {
  const ring = polygonsOf(geometry)
    .map((polygon) => polygon[0])
    .sort((a, b) => ringArea(b) - ringArea(a))[0];
  if (!ring || count <= 0) return [];
  const out: Array<{ edge: [number, number]; across: [number, number] }> = [];
  for (let index = 0; index < count; index += 1) {
    const vertex = ring[Math.floor((index * (ring.length - 1)) / count)];
    const dx = inside[0] - vertex[0];
    const dy = inside[1] - vertex[1];
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;
    // About 300 m, whatever the unit's size: close to the line, clear of vertex noise.
    const step = 0.003 / length;
    out.push({
      edge: [vertex[0] + step * dx, vertex[1] + step * dy],
      across: [vertex[0] - step * dx, vertex[1] - step * dy],
    });
  }
  return out;
}
