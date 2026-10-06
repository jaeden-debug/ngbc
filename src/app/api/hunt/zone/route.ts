import { isCoordinate } from "../../../../lib/hunt/coverage";
import { resolveZoneAnswer, zoneAnswerBody } from "../../../../lib/hunt/zone-answer";
import { createRateLimiter, getClientAddress } from "../../../../lib/newsletter/rate-limit";
import { SITE_URL } from "../../../../lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resolve a point to its official management zone — location only.
 *
 * A person who has searched a place, and not yet chosen a species or a date, has
 * asked a real and answerable question: which hunting zone is this? This endpoint
 * answers exactly that and nothing more. It deliberately returns no season, limit
 * or legality: those need a date and a species, and implying otherwise from a zone
 * alone is the failure mode this product exists to remove.
 *
 * WHAT THIS FILE NO LONGER DOES. It used to compose the answer itself, choosing
 * between six outcomes across seven branches with three of them written inline.
 * That decision is `resolveZoneAnswer` in the domain now, and the body for each
 * outcome is `zoneAnswerBody`, so a second interface serializes the same answer
 * instead of deciding it again. What is left here is HTTP: origin, content type,
 * body size, parsing, the coordinate check, rate limiting and Server-Timing.
 */

const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });
/* The first request an instance serves is marked "cold" in Server-Timing, so a
   slow tail can be told apart from a slow lookup. */
let servedBefore = false;

/** Durations only; nothing that locates a hunter. */
function serverTiming(timings: Record<string, number>, cold: boolean): string {
  const phases = Object.entries(timings).map(([name, ms]) => `${name};dur=${ms.toFixed(1)}`);
  return [...phases, cold ? "cold" : "warm"].join(", ");
}
const MAX_BODY_BYTES = 512;

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(data, { status, headers: { "cache-control": "no-store", ...headers } });
}

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url).origin;
  if (origin && origin !== requestOrigin && origin !== SITE_URL.origin) {
    return json({ status: "ERROR", message: "Origin is not allowed." }, 403);
  }
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim() !== "application/json") {
    return json({ status: "ERROR", message: "Content type must be application/json." }, 415);
  }

  const raw = await request.text().catch(() => null);
  if (raw === null || new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return json({ status: "ERROR", message: "Request body could not be read." }, 400);
  }

  let body: { latitude?: unknown; longitude?: unknown; includeGeometry?: unknown };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return json({ status: "ERROR", message: "Request body must be valid JSON." }, 400);
  }

  const latitude = body.latitude;
  const longitude = body.longitude;
  /* The zone's display geometry (up to ~78 KB for WMU 26) is sent only when
     asked for. Only the current map's highlight uses it; the rebuilt Hunt
     highlights from its own geometry store and must not ask. */
  if (body.includeGeometry !== undefined && typeof body.includeGeometry !== "boolean") {
    return json({ status: "ERROR", message: "includeGeometry must be true or false." }, 400);
  }
  const includeGeometry = body.includeGeometry === true;
  if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return json({ status: "ERROR", message: "Provide a numeric latitude and longitude." }, 400);
  }
  /* A number is not yet a coordinate. Without this, latitude 999 fell through
     to the coverage test and came back UNSUPPORTED — "North Ground does not
     publish boundaries for this area" — about somewhere that is not an area. */
  if (!isCoordinate(latitude, longitude)) {
    return json({
      status: "ERROR",
      message: "Latitude must be between -90 and 90, and longitude between -180 and 180.",
    }, 400);
  }

  const rate = limiter.check(getClientAddress(request));
  if (!rate.allowed) {
    return json({ status: "ERROR", message: "Too many zone lookups. Try again shortly." }, 429, {
      "retry-after": String(rate.retryAfterSeconds),
    });
  }

  const cold = !servedBefore;
  servedBefore = true;
  const { answer, timings } = await resolveZoneAnswer(latitude, longitude, fetch);
  /* Server-Timing is reported only where the resolver actually ran, exactly as
     before: the pre-bounds outcomes have no phases to report. */
  const headers: Record<string, string> = Object.keys(timings).length
    ? { "server-timing": serverTiming(timings, cold) }
    : {};
  return json(zoneAnswerBody(answer, { includeGeometry }), 200, headers);
}
