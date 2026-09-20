import type { RateLimiter } from "../newsletter/rate-limit.ts";
import { getClientAddress } from "../newsletter/rate-limit.ts";
import type { HuntEvaluation, HuntInput } from "./types.ts";

const MAX_BODY_BYTES = 2_048;

interface HuntHandlerDependencies {
  evaluate: (input: HuntInput) => Promise<HuntEvaluation>;
  limiter: RateLimiter;
  canonicalOrigin: string;
}

function json(data: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store", ...extraHeaders },
  });
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
}

function validInput(body: unknown): body is HuntInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const input = body as Partial<HuntInput>;
  return (
    typeof input.latitude === "number" && Number.isFinite(input.latitude) && input.latitude >= 41 && input.latitude <= 57 &&
    typeof input.longitude === "number" && Number.isFinite(input.longitude) && input.longitude >= -96 && input.longitude <= -74 &&
    validDate(input.date) && input.speciesId === "species:ruffed-grouse"
  );
}

export function createHuntHandler({ evaluate, limiter, canonicalOrigin }: HuntHandlerDependencies) {
  return async function handleHunt(request: Request): Promise<Response> {
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
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return json({ error: "Request is too large." }, 413);

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json({ error: "Request body must be valid JSON." }, 400);
    }
    if (!validInput(body)) {
      return json({ error: "Provide an Ontario latitude/longitude, an ISO date, and the supported ruffed grouse species ID." }, 400);
    }

    const rate = limiter.check(getClientAddress(request));
    if (!rate.allowed) {
      return json(
        { error: "Too many Hunt evaluations. Try again shortly." },
        429,
        { "retry-after": String(rate.retryAfterSeconds) },
      );
    }

    return json(await evaluate(body));
  };
}
