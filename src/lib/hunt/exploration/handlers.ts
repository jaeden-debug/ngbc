import type { CanonicalId } from "../../content-contract/index.ts";
import { isSupportedSpecies } from "../coverage.ts";
import { isValidIso } from "../date.ts";
import { getClientAddress, type RateLimiter } from "../../newsletter/rate-limit.ts";
import { parseBounds } from "../zone-geometry.ts";
import { fetchOverlayGeometry, overlayLayerById } from "./overlay-layers.ts";
import { isDesignation, servedLayer, summarizeZone, zoneStatesForSpecies, ZoneSummaryError, type ZoneRef } from "./zone-summary.ts";

/**
 * HTTP handlers for map exploration, kept out of the route files so they can be
 * tested without a server. None of them accepts or returns a coordinate: a zone
 * is named by its layer and designation, which is all the map needs and all it
 * should send.
 */

const NO_STORE = { "cache-control": "no-store" };

function json(data: unknown, status = 200, headers: HeadersInit = NO_STORE): Response {
  return Response.json(data, { status, headers });
}

function limited(limiter: RateLimiter, request: Request): Response | null {
  const rate = limiter.check(getClientAddress(request));
  return rate.allowed ? null : json({ status: "RATE_LIMITED", message: "Too many map requests. Try again shortly." }, 429, {
    ...NO_STORE,
    "retry-after": String(rate.retryAfterSeconds),
  });
}

/** GET ?layer=layer:ca-mb-gha&zone=26&date=2026-09-21 */
export function createZoneSummaryHandler({ limiter }: { limiter: RateLimiter }) {
  return async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const layerId = url.searchParams.get("layer") ?? "";
    const designation = url.searchParams.get("zone") ?? "";
    const date = url.searchParams.get("date") ?? "";
    if (!servedLayer(layerId) || !isDesignation(designation) || !isValidIso(date)) {
      return json({ status: "INVALID", message: "Provide a served layer, a zone designation and an ISO date." }, 400);
    }
    const blocked = limited(limiter, request);
    if (blocked) return blocked;
    try {
      const summary = await summarizeZone({ layerId, designation }, date);
      // Deterministic for a deployment: the bundles are committed files.
      return json({ status: "OK", summary }, 200, { "cache-control": "public, max-age=600, s-maxage=3600" });
    } catch (error) {
      if (error instanceof ZoneSummaryError) return json({ status: "INVALID", message: error.message }, 400);
      return json({ status: "ERROR", message: "This zone could not be summarised. Nothing is inferred in its place." }, 500);
    }
  };
}

const MAX_ZONES = 450;
const MAX_BODY_BYTES = 24_000;

/** POST { speciesId, date, zones: [{ layerId, designation }] } */
export function createZoneStatusHandler({ limiter, canonicalOrigin }: { limiter: RateLimiter; canonicalOrigin: string }) {
  return async function POST(request: Request): Promise<Response> {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin && origin !== canonicalOrigin) {
      return json({ status: "ERROR", message: "Origin is not allowed." }, 403);
    }
    if (request.headers.get("content-type")?.split(";", 1)[0]?.trim() !== "application/json") {
      return json({ status: "ERROR", message: "Content type must be application/json." }, 415);
    }
    const raw = await request.text().catch(() => null);
    if (raw === null || new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return json({ status: "ERROR", message: "Request body could not be read." }, 400);
    }
    let body: { speciesId?: unknown; date?: unknown; zones?: unknown };
    try {
      body = JSON.parse(raw) as typeof body;
    } catch {
      return json({ status: "ERROR", message: "Request body must be valid JSON." }, 400);
    }
    const { speciesId, date, zones } = body;
    if (!isSupportedSpecies(speciesId) || !isValidIso(date) || !Array.isArray(zones) || zones.length > MAX_ZONES) {
      return json({ status: "ERROR", message: "Provide a supported species, an ISO date and at most 450 zones." }, 400);
    }
    const refs: ZoneRef[] = [];
    for (const zone of zones) {
      const candidate = zone as { layerId?: unknown; designation?: unknown };
      if (typeof candidate?.layerId !== "string" || !servedLayer(candidate.layerId) || !isDesignation(candidate.designation)) {
        return json({ status: "ERROR", message: "Every zone needs a served layer and a designation." }, 400);
      }
      refs.push({ layerId: candidate.layerId, designation: candidate.designation });
    }
    const blocked = limited(limiter, request);
    if (blocked) return blocked;
    const states = await zoneStatesForSpecies(speciesId as CanonicalId<"species">, date, refs);
    return json({ status: "OK", speciesId, date, states });
  };
}

/** GET ?layer=overlay:ca-mb-refuges&bounds=w,s,e,n&zoom=8 */
export function createOverlayHandler({ limiter, fetcher = fetch }: { limiter: RateLimiter; fetcher?: typeof fetch }) {
  return async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const id = url.searchParams.get("layer") ?? "";
    const bounds = parseBounds(url.searchParams.get("bounds"));
    const zoom = Number(url.searchParams.get("zoom") ?? 6);
    const descriptor = overlayLayerById(id);
    if (!descriptor || !bounds || !Number.isFinite(zoom)) {
      return json({ status: "INVALID", message: "Provide a known overlay layer, bounds and a zoom." }, 400);
    }
    const blocked = limited(limiter, request);
    if (blocked) return blocked;
    const result = await fetchOverlayGeometry(id, bounds, zoom, fetcher);
    return json(
      { status: result.status, message: result.message, layer: descriptor, features: result.features },
      200,
      result.status === "PROVIDER_ERROR" ? NO_STORE : { "cache-control": "public, max-age=900, s-maxage=21600, stale-while-revalidate=86400" },
    );
  };
}
