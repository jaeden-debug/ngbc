/**
 * Which drawing of each official zone the map shows, and when to ask for more.
 *
 * The map used to replace every zone with each viewport's response. Between a pan
 * and the next response the newly exposed ground was blank; a response that
 * failed (one authority's count disagreeing with its own features, a stored
 * drawing timing out) blanked a whole province; and a stored drawing, which the
 * database clips to the requested view, drew its clip edge as if it were a
 * boundary once the view moved past it.
 *
 * This store removes each of those at the source:
 *
 *   1. An OVERVIEW of every served zone is loaded once, whole, and never
 *      dropped. Every zone always has a drawing, so nothing on the map can go
 *      blank because a request is slow, failed or out of date.
 *   2. Finer drawings only UPGRADE a zone. They are kept per level and a newer
 *      one replaces an older one; an older response arriving late cannot
 *      overwrite a newer one.
 *   3. A drawing clipped to its request box is used only while the view is
 *      inside that box, so a clip edge is never on screen. A whole drawing is
 *      valid everywhere.
 *   4. Requests are snapped outward to a per-level grid with a margin, so small
 *      pans reuse the drawing already held and equal views ask equal URLs, which
 *      the edge cache can answer for everyone.
 *
 * Every drawing is generalised for display. None of it decides which zone a
 * point is in; that is resolved server-side against full-resolution geometry.
 */

export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export type LodLevel = 0 | 1 | 2 | 3;

export interface LodSpec {
  level: LodLevel;
  /** The zoom sent to the server, which chooses the simplification tolerance from it. */
  requestZoom: number;
  /** Lowest map zoom that wants this level. */
  minZoom: number;
  /** Grid, in degrees, that request boxes are snapped to. Null for the whole-extent overview. */
  grid: number | null;
}

/**
 * Levels, chosen so the drawn line stays within about three screen pixels of
 * the generalised authority line at every zoom that uses it:
 *
 *   L0  0.05°    zoom < 8   the overview, whole extent, loaded once
 *   L1  0.008°   zoom 8–9
 *   L2  0.002°   zoom 10–11
 *   L3  0.0008°  zoom ≥ 12  the finest the stored drawings and the server offer
 */
export const LOD_LEVELS: readonly LodSpec[] = [
  /* Level 0 is a viewport like the others now, on a coarse grid: panning the
     country fetches the cells it moves into rather than the whole union. */
  { level: 0, requestZoom: 6, minZoom: 0, grid: 4 },
  { level: 1, requestZoom: 9, minZoom: 8, grid: 2 },
  { level: 2, requestZoom: 11, minZoom: 10, grid: 0.5 },
  { level: 3, requestZoom: 12, minZoom: 12, grid: 0.125 },
];

export function levelForZoom(zoom: number): LodLevel {
  const z = Number.isFinite(zoom) ? zoom : 0;
  let chosen: LodLevel = 0;
  for (const spec of LOD_LEVELS) if (z >= spec.minZoom) chosen = spec.level;
  return chosen;
}

export function lodSpec(level: LodLevel): LodSpec {
  return LOD_LEVELS[level];
}

const WORLD: BBox = { west: -180, south: -85, east: 180, north: 85 };

function clampToBox(box: BBox, limit: BBox): BBox | null {
  const clamped = {
    west: Math.max(box.west, limit.west),
    south: Math.max(box.south, limit.south),
    east: Math.min(box.east, limit.east),
    north: Math.min(box.north, limit.north),
  };
  return clamped.west < clamped.east && clamped.south < clamped.north ? clamped : null;
}

/** Round to the grid's own precision, so snapped edges print identically. */
function snapped(value: number, grid: number): number {
  return Number(value.toFixed(Math.max(0, Math.ceil(-Math.log10(grid)) + 1)));
}

/**
 * The box to ask for a view at a level: the view plus a quarter of its larger
 * span on every side, snapped outward to the level's grid and kept inside the
 * extent anything is served for. Null when the view is outside that extent.
 */
export function requestBoxFor(view: BBox, level: LodLevel, extent: BBox = WORLD): BBox | null {
  const spec = lodSpec(level);
  const limit = clampToBox(extent, WORLD);
  if (!limit) return null;
  if (spec.grid === null) return limit;
  const grid = spec.grid;
  /* A margin so a small pan does not ask again, but never more than one cell:
     a quarter of a country-scale view is 18°, which snapping then rounds
     outward into a request several times the size of the screen. */
  const margin = Math.min(grid, 0.25 * Math.max(view.east - view.west, view.north - view.south));
  const box = {
    west: snapped(Math.floor((view.west - margin) / grid) * grid, grid),
    south: snapped(Math.floor((view.south - margin) / grid) * grid, grid),
    east: snapped(Math.ceil((view.east + margin) / grid) * grid, grid),
    north: snapped(Math.ceil((view.north + margin) / grid) * grid, grid),
  };
  return clampToBox(box, limit);
}

export function boxKey(box: BBox): string {
  return [box.west, box.south, box.east, box.north].map((value) => value.toFixed(4)).join(",");
}

export function boxContains(outer: BBox, inner: BBox): boolean {
  return inner.west >= outer.west && inner.east <= outer.east && inner.south >= outer.south && inner.north <= outer.north;
}

/**
 * Whether a box holds a drawing with room to spare.
 *
 * Touching the edge is the signature of a clip: a drawing whose bounds reach
 * the box it was asked for almost certainly continues past it. Containment
 * alone would call that whole and let the map draw a request box's edge as a
 * zone's boundary.
 */
export function boxHolds(outer: BBox, inner: BBox): boolean {
  const margin = Math.max(1e-6, Math.max(outer.east - outer.west, outer.north - outer.south) * 0.001);
  return inner.west > outer.west + margin && inner.east < outer.east - margin
    && inner.south > outer.south + margin && inner.north < outer.north - margin;
}

export function boxesIntersect(a: BBox, b: BBox): boolean {
  return a.west <= b.east && a.east >= b.west && a.south <= b.north && a.north >= b.south;
}

export function boxOfRings(rings: readonly (readonly (readonly number[])[])[]): BBox | null {
  let west = 180, east = -180, south = 90, north = -90;
  for (const ring of rings) {
    for (const [longitude, latitude] of ring) {
      if (longitude < west) west = longitude;
      if (longitude > east) east = longitude;
      if (latitude < south) south = latitude;
      if (latitude > north) north = latitude;
    }
  }
  return west <= east && south <= north ? { west, south, east, north } : null;
}

/* ── The store ─────────────────────────────────────────────────────────────── */

/** A feature as `/api/hunt/zones` delivers it. Only the fields the map reads. */
export interface SourceZoneFeature {
  layerId: string;
  name: string;
  label: string;
  compactLabel?: string;
  accessibleLabel?: string;
  coverage: string;
  rings: number[][][];
  labelPoint?: [number, number];
  labelSpan?: [number, number];
  parts?: number;
}

export interface ZonePiece {
  level: LodLevel;
  rings: number[][][];
  labelPoint?: [number, number];
  labelSpan?: [number, number];
  /** The box the drawing was requested for. A clipped drawing is only valid inside it. */
  requestBox: BBox;
  /** False when the source clips drawings to the request box. */
  whole: boolean;
  /** Order in which the request was made; a later request always wins. */
  seq: number;
}

export interface StoredZone {
  key: string;
  layerId: string;
  /** The authority's designation. */
  name: string;
  /** Presentation, from the most recent delivery. Never a key. */
  label: string;
  compactLabel: string;
  accessibleLabel: string;
  coverage: string;
  parts?: number;
  /** The zone's extent from its whole drawing, for "in view" tests. */
  extent: BBox | null;
  pieces: Partial<Record<LodLevel, ZonePiece>>;
}

/** The drawing to show for one zone, with the zone's identity beside it. */
export interface DrawnZone {
  key: string;
  layerId: string;
  name: string;
  label: string;
  compactLabel: string;
  accessibleLabel: string;
  coverage: string;
  parts?: number;
  piece: ZonePiece;
}

export function zoneKeyOf(ref: { layerId: string; name?: string; designation?: string }): string {
  return `${ref.layerId}|${(ref.designation ?? ref.name ?? "").toUpperCase()}`;
}

export class ZoneGeometryStore {
  private readonly zones = new Map<string, StoredZone>();
  private readonly isClippedLayer: (layerId: string) => boolean;
  private seqCounter = 0;
  /** Bumped whenever a drawing changes, so a renderer can tell cheaply. */
  version = 0;

  constructor(options: { isClippedLayer: (layerId: string) => boolean }) {
    this.isClippedLayer = options.isClippedLayer;
  }

  /** A sequence number for a request about to be made. */
  /**
   * Forget every drawing. Used when the official geography itself changes —
   * a species whose seasons are written in another geography — so one
   * species' areas can never be left on screen under another's answer.
   */
  reset(): void {
    this.zones.clear();
    this.version += 1;
  }

  nextSeq(): number {
    this.seqCounter += 1;
    return this.seqCounter;
  }

  get size(): number {
    return this.zones.size;
  }

  get(key: string): StoredZone | undefined {
    return this.zones.get(key);
  }

  all(): IterableIterator<StoredZone> {
    return this.zones.values();
  }

  /**
   * Add the features one response delivered. Returns the keys whose drawing at
   * that level changed. A response older than the drawing already held for a
   * zone at that level changes nothing for that zone.
   */
  apply(level: LodLevel, requestBox: BBox, seq: number, features: readonly SourceZoneFeature[]): string[] {
    const changed: string[] = [];
    for (const feature of features) {
      if (!Array.isArray(feature.rings) || feature.rings.length === 0) continue;
      const key = zoneKeyOf(feature);
      /*
       * Whole means "this drawing is the whole zone", and it has to be
       * EVIDENCE, not an assumption. It used to be true for every level-0
       * piece because level 0 asked for the entire served extent; now that a
       * request is a viewport, a level-0 drawing can be clipped like any
       * other. Believing it anyway would let the map treat the edge of a
       * request box as a zone's boundary — asserting a boundary no authority
       * gave it (CLAUDE.md §41A) while looking perfectly normal on screen.
       *
       * So: a drawing is whole when it lies inside the box that was asked
       * for, or when its source does not clip at all.
       */
      const bounds = boxOfRings(feature.rings);
      const whole = !this.isClippedLayer(feature.layerId) || (bounds !== null && boxHolds(requestBox, bounds));
      const piece: ZonePiece = {
        level, rings: feature.rings, requestBox, whole, seq,
        ...(feature.labelPoint ? { labelPoint: feature.labelPoint } : {}),
        ...(feature.labelSpan ? { labelSpan: feature.labelSpan } : {}),
      };
      const existing = this.zones.get(key);
      if (!existing) {
        this.zones.set(key, {
          key,
          layerId: feature.layerId,
          name: feature.name,
          label: feature.label,
          compactLabel: feature.compactLabel ?? "",
          accessibleLabel: feature.accessibleLabel ?? feature.label,
          coverage: feature.coverage,
          ...(feature.parts ? { parts: feature.parts } : {}),
          extent: whole ? boxOfRings(feature.rings) : null,
          pieces: { [level]: piece },
        });
        changed.push(key);
        continue;
      }
      const held = existing.pieces[level];
      if (held && held.seq > seq) continue;
      existing.pieces[level] = piece;
      existing.label = feature.label;
      existing.compactLabel = feature.compactLabel ?? existing.compactLabel;
      existing.accessibleLabel = feature.accessibleLabel ?? existing.accessibleLabel;
      existing.coverage = feature.coverage;
      if (feature.parts) existing.parts = feature.parts;
      if (whole && (!existing.extent || level === 0)) existing.extent = boxOfRings(feature.rings);
      changed.push(key);
    }
    if (changed.length) this.version += 1;
    return changed;
  }

  /**
   * The drawing to show for a zone in this view. The finest valid drawing at or
   * below the wanted level; failing that, the coarsest valid finer one; else
   * none. A clipped drawing is valid only while the view sits inside the box it
   * was clipped to.
   */
  pieceFor(key: string, view: BBox, wanted: LodLevel): ZonePiece | null {
    const zone = this.zones.get(key);
    if (!zone) return null;
    const valid = (piece: ZonePiece | undefined): piece is ZonePiece =>
      Boolean(piece) && (piece!.whole || boxContains(piece!.requestBox, view));
    for (let level = wanted; level >= 0; level -= 1) {
      const piece = zone.pieces[level as LodLevel];
      if (valid(piece)) return piece;
    }
    for (let level = wanted + 1; level <= 3; level += 1) {
      const piece = zone.pieces[level as LodLevel];
      if (valid(piece)) return piece;
    }
    return null;
  }

  /** Every zone with a drawing valid for this view, each with the drawing to show. */
  drawn(view: BBox, wanted: LodLevel): DrawnZone[] {
    const result: DrawnZone[] = [];
    for (const zone of this.zones.values()) {
      const piece = this.pieceFor(zone.key, view, wanted);
      if (!piece) continue;
      result.push({
        key: zone.key, layerId: zone.layerId, name: zone.name, label: zone.label,
        compactLabel: zone.compactLabel, accessibleLabel: zone.accessibleLabel, coverage: zone.coverage,
        ...(zone.parts ? { parts: zone.parts } : {}),
        piece,
      });
    }
    return result;
  }

  /**
   * Whether a view at this level still lacks a drawing some zone in it could
   * have: a zone in view drawn coarser than wanted, because nothing finer has
   * arrived or what arrived was clipped to somewhere else.
   */
  needsDetail(view: BBox, wanted: LodLevel): boolean {
    for (const zone of this.inView(view)) {
      const piece = this.pieceFor(zone.key, view, wanted);
      if (!piece || piece.level < wanted) return true;
    }
    return false;
  }

  /**
   * Whether this view has ground no answer has covered yet.
   *
   * Since a request is a viewport, panning leaves the boxes already asked
   * for. Empty ground that was never asked about must not be mistaken for
   * ground with no zones in it, so the map asks before it draws nothing.
   */
  hasUnaskedGround(view: BBox, asked: readonly BBox[]): boolean {
    // A hair of tolerance: the map's own box is never exactly the one asked for.
    const slack = Math.max(0.02, Math.max(view.east - view.west, view.north - view.south) * 0.02);
    const inner = { west: view.west + slack, east: view.east - slack, south: view.south + slack, north: view.north - slack };
    return !asked.some((box) => boxContains(box, inner));
  }

  /** Zones whose extent intersects the box: the textual list of what is in view. */
  inView(view: BBox): StoredZone[] {
    const result: StoredZone[] = [];
    for (const zone of this.zones.values()) {
      const extent = zone.extent ?? Object.values(zone.pieces).map((piece) => boxOfRings(piece!.rings)).find(Boolean) ?? null;
      if (extent && boxesIntersect(extent, view)) result.push(zone);
    }
    return result;
  }
}
