import type { RateLimiter } from "../newsletter/rate-limit.ts";
import { getClientAddress } from "../newsletter/rate-limit.ts";
import { isSupportedSpecies, isWithinSupportedBounds } from "./coverage.ts";
import type { HuntEvaluation, HuntInput } from "./types.ts";

const MAX_BODY_BYTES = 2_048;

/** Dimension keys the engine understands. Anything else is refused outright. */
const ANSWER_KEYS = new Set(["RESIDENCY", "HUNT_METHOD", "SEASON_TYPE", "TAG_TYPE", "animalClasses"]);
const MAX_ANSWER_LENGTH = 64;
const MAX_ANIMAL_CLASSES = 8;

/**
 * Shape-check self-reported answers before they reach the engine.
 *
 * This is a structural gate only. Whether a value is *meaningful* is decided by
 * the dimension that offered it, inside the engine — an unrecognised value
 * leaves its question outstanding rather than narrowing the rule set, because
 * filtering on an arbitrary string empties the candidates and an empty candidate
 * set would read as a confident CLOSED. Both layers are required: this one stops
 * unbounded or malformed input, and that one stops a plausible-looking lie from
 * becoming a legal answer.
 */
function validAnswers(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const answers = value as Record<string, unknown>;
  for (const [key, entry] of Object.entries(answers)) {
    if (!ANSWER_KEYS.has(key)) return false;
    if (key === "animalClasses") {
      if (!Array.isArray(entry) || entry.length > MAX_ANIMAL_CLASSES) return false;
      const everyEntryWellFormed = entry.every((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return false;
        const { dimension, value: answer } = item as Record<string, unknown>;
        return (
          typeof dimension === "string" && dimension.length <= MAX_ANSWER_LENGTH &&
          typeof answer === "string" && answer.length <= MAX_ANSWER_LENGTH
        );
      });
      if (!everyEntryWellFormed) return false;
      continue;
    }
    if (typeof entry !== "string" || entry.length > MAX_ANSWER_LENGTH) return false;
  }
  return true;
}

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
    typeof input.latitude === "number" &&
    typeof input.longitude === "number" &&
    // Declared once in coverage.ts and shared with the browser composer, so the
    // interface and this endpoint cannot disagree about what is in scope.
    isWithinSupportedBounds(input.latitude, input.longitude) &&
    validDate(input.date) && isSupportedSpecies(input.speciesId) &&
    validAnswers((body as { answers?: unknown }).answers)
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
      return json({ error: "Provide an Ontario latitude/longitude, an ISO date, a supported species ID, and — where the species requires them — well-formed answers." }, 400);
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
