import type { RateLimiter } from "../newsletter/rate-limit.ts";
import { getClientAddress } from "../newsletter/rate-limit.ts";
import type { LocationRequestOptions, ResolveResult, SuggestResult } from "./location.ts";
import { describeCoordinate, resolvePlace, suggestPlaces } from "./location.ts";

const MAX_BODY_BYTES = 1_024;
const MAX_QUERY_LENGTH = 200;
const MAX_PLACE_ID_LENGTH = 512;
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export interface LocationHandlerDependencies {
  limiter: RateLimiter;
  canonicalOrigin: string;
  suggest?: typeof suggestPlaces;
  resolve?: typeof resolvePlace;
  describe?: typeof describeCoordinate;
}

type LocationRequestBody =
  | { action: "suggest"; query: string; sessionToken?: string }
  | { action: "resolve"; placeId: string; sessionToken?: string }
  | { action: "describe"; latitude: number; longitude: number };

function json(data: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  // Never cached: a response body derived from a user's location query is private
  // even though it contains no account identity.
  return Response.json(data, { status, headers: { "cache-control": "no-store", ...extraHeaders } });
}

function validBody(body: unknown): body is LocationRequestBody {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const value = body as Record<string, unknown>;

  if (value.sessionToken !== undefined) {
    if (typeof value.sessionToken !== "string" || !SESSION_TOKEN_PATTERN.test(value.sessionToken)) return false;
  }

  if (value.action === "suggest") {
    return typeof value.query === "string"
      && value.query.trim().length > 0
      && value.query.length <= MAX_QUERY_LENGTH;
  }
  if (value.action === "resolve") {
    return typeof value.placeId === "string"
      && value.placeId.length > 0
      && value.placeId.length <= MAX_PLACE_ID_LENGTH;
  }
  if (value.action === "describe") {
    return typeof value.latitude === "number" && Number.isFinite(value.latitude)
      && value.latitude >= -90 && value.latitude <= 90
      && typeof value.longitude === "number" && Number.isFinite(value.longitude)
      && value.longitude >= -180 && value.longitude <= 180;
  }
  return false;
}

/**
 * Location discovery endpoint.
 *
 * Server-side so the Google server key never reaches the browser, the provider can be
 * swapped without shipping new client code, and request volume stays controllable.
 * This endpoint resolves places only — it never evaluates regulation.
 */
export function createLocationHandler({
  limiter,
  canonicalOrigin,
  suggest = suggestPlaces,
  resolve = resolvePlace,
  describe = describeCoordinate,
}: LocationHandlerDependencies) {
  return async function handleLocation(request: Request): Promise<Response> {
    const origin = request.headers.get("origin");
    const requestOrigin = new URL(request.url).origin;
    if (origin && origin !== requestOrigin && origin !== canonicalOrigin) {
      return json({ error: "Origin is not allowed." }, 403);
    }

    const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim();
    if (contentType !== "application/json") return json({ error: "Content type must be application/json." }, 415);

    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return json({ error: "Request is too large." }, 413);
    }

    let rawBody: string;
    try {
      rawBody = await request.text();
    } catch {
      return json({ error: "Request body could not be read." }, 400);
    }
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return json({ error: "Request is too large." }, 413);
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json({ error: "Request body must be valid JSON." }, 400);
    }
    if (!validBody(body)) return json({ error: "Provide a supported location action." }, 400);

    const rate = limiter.check(getClientAddress(request));
    if (!rate.allowed) {
      return json({ error: "Too many location requests. Try again shortly." }, 429, {
        "retry-after": String(rate.retryAfterSeconds),
      });
    }

    const options: LocationRequestOptions = {
      sessionToken: "sessionToken" in body ? body.sessionToken : undefined,
    };

    if (body.action === "suggest") {
      const result: SuggestResult = await suggest(body.query, options);
      if (result.status === "NOT_CONFIGURED" || result.status === "PROVIDER_ERROR") {
        // 200 with an explicit state: place search being unavailable must not break
        // the Hunt page, which still accepts a device location.
        return json({ status: result.status, suggestions: [], message: result.message });
      }
      return json({ status: result.status, suggestions: result.suggestions, provider: result.provider });
    }

    if (body.action === "resolve") {
      const result: ResolveResult = await resolve(body.placeId, options);
      if (result.status !== "OK") return json({ status: result.status, message: result.message }, 200);
      return json({ status: "OK", place: result.place });
    }

    const result: ResolveResult = await describe(body.latitude, body.longitude, options);
    if (result.status !== "OK") return json({ status: result.status, message: result.message }, 200);
    return json({ status: "OK", place: result.place });
  };
}
