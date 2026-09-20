import { normalizeEmail } from "./email.ts";
import {
  createRateLimiter,
  getClientAddress,
  type RateLimiter,
} from "./rate-limit.ts";
import {
  NewsletterConfigurationError,
  NewsletterProviderError,
  type NewsletterSubscriptionResult,
} from "./resend.ts";

const MAX_BODY_BYTES = 1_024;
const WINDOW_MS = 10 * 60 * 1_000;

const defaultIpLimiter = createRateLimiter({ limit: 8, windowMs: WINDOW_MS });
const defaultEmailLimiter = createRateLimiter({ limit: 4, windowMs: WINDOW_MS });

interface SubscribeDependencies {
  subscribe: (email: string) => Promise<NewsletterSubscriptionResult>;
  canonicalOrigin: string;
  ipLimiter?: RateLimiter;
  emailLimiter?: RateLimiter;
}

interface ApiBody {
  email?: unknown;
  website?: unknown;
}

function json(body: Record<string, unknown>, status: number, headers?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function requestOriginAllowed(request: Request, canonicalOrigin: string): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const requestOrigin = new URL(request.url).origin;
  return origin === requestOrigin || origin === canonicalOrigin;
}

export function createSubscribeHandler({
  subscribe,
  canonicalOrigin,
  ipLimiter = defaultIpLimiter,
  emailLimiter = defaultEmailLimiter,
}: SubscribeDependencies) {
  return async function handleSubscribe(request: Request): Promise<Response> {
    if (!requestOriginAllowed(request, canonicalOrigin)) {
      return json({ ok: false, code: "ORIGIN_NOT_ALLOWED" }, 403);
    }

    const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim();
    if (contentType !== "application/json") {
      return json({ ok: false, code: "UNSUPPORTED_MEDIA_TYPE" }, 415);
    }

    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return json({ ok: false, code: "PAYLOAD_TOO_LARGE" }, 413);
    }

    let rawBody: string;
    try {
      rawBody = await request.text();
    } catch {
      return json({ ok: false, code: "INVALID_REQUEST" }, 400);
    }

    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return json({ ok: false, code: "PAYLOAD_TOO_LARGE" }, 413);
    }

    let body: ApiBody;
    try {
      body = JSON.parse(rawBody) as ApiBody;
    } catch {
      return json({ ok: false, code: "INVALID_JSON" }, 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ ok: false, code: "INVALID_REQUEST" }, 400);
    }

    // A filled honeypot is treated as success without touching the provider so
    // simple bots cannot use response differences to tune their submissions.
    if (typeof body.website === "string" && body.website.trim()) {
      return json({ ok: true, status: "subscribed" }, 200);
    }

    const email = normalizeEmail(body.email);
    if (!email) {
      return json({ ok: false, code: "INVALID_EMAIL" }, 400);
    }

    const ipLimit = ipLimiter.check(`ip:${getClientAddress(request)}`);
    const emailLimit = emailLimiter.check(`email:${email}`);
    const retryAfterSeconds = Math.max(ipLimit.retryAfterSeconds, emailLimit.retryAfterSeconds);

    if (!ipLimit.allowed || !emailLimit.allowed) {
      return json(
        { ok: false, code: "RATE_LIMITED", retryAfterSeconds },
        429,
        { "Retry-After": String(retryAfterSeconds) },
      );
    }

    try {
      await subscribe(email);
      return json({ ok: true, status: "subscribed" }, 200);
    } catch (error) {
      if (error instanceof NewsletterConfigurationError) {
        console.error("[newsletter] subscription unavailable: provider configuration missing");
        return json({ ok: false, code: "SERVICE_UNAVAILABLE" }, 503);
      }

      if (error instanceof NewsletterProviderError) {
        console.error("[newsletter] provider request failed", {
          status: error.status,
          code: error.code,
          retryable: error.retryable,
        });

        if (error.status === 429) {
          return json({ ok: false, code: "RATE_LIMITED" }, 429, { "Retry-After": "60" });
        }
        return json({ ok: false, code: "PROVIDER_ERROR" }, error.retryable ? 503 : 502);
      }

      console.error("[newsletter] unexpected subscription failure");
      return json({ ok: false, code: "INTERNAL_ERROR" }, 500);
    }
  };
}
