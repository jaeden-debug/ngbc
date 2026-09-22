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
