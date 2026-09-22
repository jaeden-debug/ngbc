const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** A focal-point request, or null. Percentages of the frame, 0–100, rounded to 0.1. */
export function parseFocalPointRequest(body: unknown): { assetId: string; x: number; y: number } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const { assetId, x, y } = body as Record<string, unknown>;
  if (typeof assetId !== "string" || !UUID.test(assetId)) return null;
  const valid = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
  if (!valid(x) || !valid(y)) return null;
  return { assetId, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

/** How far a photo overhangs its card in each axis; zero means that axis cannot move. */
export interface FocalDrag {
  fx: number;
  fy: number;
  spanX: number;
  spanY: number;
}

/**
 * The focal point after dragging a card's photo by (dx, dy) pixels.
 *
 * Dragging the photo right reveals more of its left side, so the focal point
 * moves left: the subject follows the pointer. An axis with no overhang cannot
 * move, and the result is always inside the frame.
 */
export function nextFocal(drag: FocalDrag, dx: number, dy: number): { x: number; y: number } {
  const clamp = (value: number) => Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;
  return {
    x: drag.spanX > 0 ? clamp(drag.fx - (dx / drag.spanX) * 100) : drag.fx,
    y: drag.spanY > 0 ? clamp(drag.fy - (dy / drag.spanY) * 100) : drag.fy,
  };
}
