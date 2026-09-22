/**
 * The phone sheet's resting heights and how a drag settles between them.
 *
 *   peek  the one line that says where you are and what is next
 *   half  the answer, with the map still in view above it
 *   full  everything, for reading
 *
 * Heights are measured from the bottom of the layout viewport. The map above
 * the sheet is sized to what the sheet leaves, so the sheet never sits over the
 * map's attribution or controls.
 */

export type SheetSnap = "peek" | "half" | "full";

export const SHEET_SNAPS: readonly SheetSnap[] = ["peek", "half", "full"];

export interface SheetMetrics {
  /** Layout viewport height, px. */
  viewportHeight: number;
  /** Bottom edge of the floating header, including the top safe area, px. */
  headerBottom: number;
  /** env(safe-area-inset-bottom), px. */
  safeBottom: number;
}

export interface SheetHeights {
  peek: number;
  half: number;
  full: number;
}

/** The peek row: grabber, one line of context and one row of controls. */
export const PEEK_CONTENT_HEIGHT = 148;
/** Below this much separation, "half" is not a meaningfully different state. */
const MIN_STEP = 96;

export function sheetHeights({ viewportHeight, headerBottom, safeBottom }: SheetMetrics): SheetHeights {
  const full = Math.max(PEEK_CONTENT_HEIGHT + safeBottom, Math.round(viewportHeight - headerBottom - 8));
  const peek = Math.min(full, PEEK_CONTENT_HEIGHT + safeBottom);
  const wantedHalf = Math.round(viewportHeight * 0.5);
  const half = Math.max(peek + MIN_STEP, Math.min(wantedHalf, full - MIN_STEP));
  // A short landscape phone has no room for three states: half becomes full.
  return half >= full - MIN_STEP / 2 || half <= peek ? { peek, half: full, full } : { peek, half, full };
}

export function heightOf(snap: SheetSnap, heights: SheetHeights): number {
  return heights[snap];
}

/** Snaps ordered by height, distinct heights only, so a merged half is not a stop of its own. */
function stops(heights: SheetHeights): Array<{ snap: SheetSnap; height: number }> {
  const ordered = SHEET_SNAPS.map((snap) => ({ snap, height: heights[snap] }));
  return ordered.filter((stop, index) => index === 0 || stop.height > ordered[index - 1].height);
}

/**
 * Where a released drag comes to rest. A flick (|velocity| above the
 * threshold, in px/ms, positive = growing) moves one stop in its direction from
 * where the finger let go; a slow release settles on the nearest stop.
 */
export function resolveSnap(heights: SheetHeights, height: number, velocity: number, flick = 0.45): SheetSnap {
  const list = stops(heights);
  if (Math.abs(velocity) >= flick) {
    if (velocity > 0) return (list.find((stop) => stop.height > height + 1) ?? list[list.length - 1]).snap;
    return ([...list].reverse().find((stop) => stop.height < height - 1) ?? list[0]).snap;
  }
  let best = list[0];
  for (const stop of list) if (Math.abs(stop.height - height) < Math.abs(best.height - height)) best = stop;
  return best.snap;
}

/** A drag never leaves the sheet shorter than peek or taller than full; beyond them it resists. */
export function dragHeight(heights: SheetHeights, start: number, delta: number): number {
  const raw = start + delta;
  if (raw < heights.peek) return heights.peek - (heights.peek - raw) * 0.25;
  if (raw > heights.full) return heights.full + (raw - heights.full) * 0.25;
  return raw;
}

/** The next stop up or down, for the grabber button and the keyboard. */
export function stepSnap(heights: SheetHeights, current: SheetSnap, direction: 1 | -1): SheetSnap {
  const list = stops(heights);
  const index = Math.max(0, list.findIndex((stop) => stop.height >= heights[current]));
  return list[Math.min(list.length - 1, Math.max(0, index + direction))].snap;
}

/** How much of the viewport the map may use while the sheet rests at a snap. */
export function mapBottomFor(snap: SheetSnap, heights: SheetHeights): number {
  // Full is for reading; the map behind it stays at its half-sheet size, so
  // lowering the sheet again does not re-layout the map twice.
  return snap === "peek" ? heights.peek : heights.half;
}
