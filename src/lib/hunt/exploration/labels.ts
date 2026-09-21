/**
 * Which zone labels to draw, and where, for one map frame.
 *
 * Ontario alone has 151 units, several dense clusters of small ones, and a view
 * can hold three jurisdictions. Writing every name would be a wall of text, so
 * placement is greedy and deterministic:
 *
 *  1. The selected zone is placed first and always, because it is the answer.
 *  2. Then by priority, then by how much room the zone has on screen.
 *  3. A label is drawn only if it fits inside its zone's largest part at this
 *     zoom (the full "WMU 57", else the bare "57"), stays inside the view, and
 *     overlaps no label already placed.
 *
 * Positions are screen pixels; the caller projects. Nothing here is a
 * membership test — a label is a drawing of a name, never a claim about a point.
 */

export interface LabelCandidate {
  key: string;
  /** Full official label ("GHA 26", "WMU 57"). */
  text: string;
  /** Bare designation ("26"), used where the full label does not fit. */
  short: string;
  /** Screen position of the label point. */
  x: number;
  y: number;
  /** Screen size of the zone's largest part. */
  spanWidth: number;
  spanHeight: number;
  /** Higher is placed first. `force` placements ignore the fit test. */
  priority: number;
  force?: boolean;
}

export interface PlacedLabel {
  key: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LabelMetrics {
  /** Average advance of one character at the label font size, px. */
  charWidth: number;
  height: number;
  paddingX: number;
  /** Minimum gap kept between labels, px. */
  gap: number;
  /** Labels are kept this far inside the view's edges. */
  margin: number;
}

export const DEFAULT_LABEL_METRICS: LabelMetrics = { charWidth: 6.9, height: 20, paddingX: 7, gap: 4, margin: 6 };

function widthOf(text: string, metrics: LabelMetrics): number {
  return Math.ceil(text.length * metrics.charWidth + metrics.paddingX * 2);
}

function overlaps(a: PlacedLabel, b: PlacedLabel, gap: number): boolean {
  return (
    Math.abs(a.x - b.x) * 2 < a.width + b.width + gap * 2 &&
    Math.abs(a.y - b.y) * 2 < a.height + b.height + gap * 2
  );
}

export function placeLabels(
  candidates: readonly LabelCandidate[],
  view: { width: number; height: number },
  metrics: LabelMetrics = DEFAULT_LABEL_METRICS,
): PlacedLabel[] {
  const ordered = [...candidates].sort((a, b) =>
    Number(Boolean(b.force)) - Number(Boolean(a.force)) ||
    b.priority - a.priority ||
    b.spanWidth * b.spanHeight - a.spanWidth * a.spanHeight ||
    a.key.localeCompare(b.key));

  const placed: PlacedLabel[] = [];
  // A coarse grid keeps the collision test local, so a dense view stays cheap.
  const CELL = 96;
  const grid = new Map<string, PlacedLabel[]>();
  const cellsOf = (label: PlacedLabel) => {
    const keys: string[] = [];
    const x0 = Math.floor((label.x - label.width / 2) / CELL);
    const x1 = Math.floor((label.x + label.width / 2) / CELL);
    const y0 = Math.floor((label.y - label.height / 2) / CELL);
    const y1 = Math.floor((label.y + label.height / 2) / CELL);
    for (let gx = x0; gx <= x1; gx += 1) for (let gy = y0; gy <= y1; gy += 1) keys.push(`${gx},${gy}`);
    return keys;
  };

  for (const candidate of ordered) {
    const options = candidate.text === candidate.short ? [candidate.text] : [candidate.text, candidate.short];
    for (const text of options) {
      const label: PlacedLabel = {
        key: candidate.key,
        text,
        x: Math.round(candidate.x),
        y: Math.round(candidate.y),
        width: widthOf(text, metrics),
        height: metrics.height,
      };
      const fits = candidate.force ||
        (label.width <= candidate.spanWidth * 0.92 && label.height <= candidate.spanHeight * 0.9);
      if (!fits) continue;
      const inside =
        label.x - label.width / 2 >= metrics.margin && label.x + label.width / 2 <= view.width - metrics.margin &&
        label.y - label.height / 2 >= metrics.margin && label.y + label.height / 2 <= view.height - metrics.margin;
      if (!inside) continue;
      const cells = cellsOf(label);
      const clash = cells.some((cell) => grid.get(cell)?.some((other) => overlaps(label, other, metrics.gap)));
      if (clash) continue;
      placed.push(label);
      for (const cell of cells) grid.set(cell, [...(grid.get(cell) ?? []), label]);
      break;
    }
  }
  return placed;
}
