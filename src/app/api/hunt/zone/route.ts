import { isWithinSupportedBounds } from "../../../../lib/hunt/coverage";
import { resolveOntarioWmu } from "../../../../lib/hunt/zone";
import { layerForPoint, zoneCoverage } from "../../../../lib/hunt/zone-layers";
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
 */

const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });
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

  let body: { latitude?: unknown; longitude?: unknown };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return json({ status: "ERROR", message: "Request body must be valid JSON." }, 400);
  }

  const latitude = body.latitude;
  const longitude = body.longitude;
  if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return json({ status: "ERROR", message: "Provide a numeric latitude and longitude." }, 400);
  }

  const rate = limiter.check(getClientAddress(request));
  if (!rate.allowed) {
    return json({ status: "ERROR", message: "Too many zone lookups. Try again shortly." }, 429, {
      "retry-after": String(rate.retryAfterSeconds),
    });
  }

  const layer = layerForPoint(latitude, longitude);
  if (!layer || !isWithinSupportedBounds(latitude, longitude)) {
    return json({
      status: "UNSUPPORTED",
      message:
        "North Ground does not yet publish official hunting-zone boundaries for this area. " +
        "That is a gap in our coverage, not a statement about hunting there.",
    });
  }

  const resolution = await resolveOntarioWmu(latitude, longitude);
  if (resolution.status !== "RESOLVED") {
    return json({
      status: resolution.status,
      message: resolution.message,
      layer: { jurisdictionName: layer.jurisdictionName, officialTerm: layer.officialTerm, authority: layer.authority },
    });
  }

  const zoneName = resolution.officialName?.replace(/^Wildlife Management Unit\s+/i, "") ?? "";
  return json({
    status: "RESOLVED",
    zone: {
      id: resolution.zoneId,
      officialName: resolution.officialName,
      shortLabel: zoneName ? `${layer.officialTermShort} ${zoneName}` : resolution.officialName,
      coverage: zoneCoverage(layer, zoneName),
      boundaryDistanceMeters: resolution.boundaryDistanceMeters,
      nearBoundary: resolution.nearBoundary,
      displayRings: resolution.displayRings,
      message: resolution.message,
    },
    layer: {
      jurisdictionName: layer.jurisdictionName,
      officialTerm: layer.officialTerm,
      officialTermShort: layer.officialTermShort,
      authority: layer.authority,
      sourceId: layer.sourceId,
    },
  });
}
