import { createHmac } from "node:crypto";
import { getClientAddress } from "../newsletter/rate-limit.ts";
import { HuntBriefValidationError, type HuntShareProjectionInput } from "./model.ts";
import { persistHuntBrief } from "./service.ts";
import {
  defaultShareCreationLimiter,
  HuntBriefStoreConfigurationError,
  type ShareCreationLimiter,
} from "./store.ts";
import { huntBriefUrl } from "./urls.ts";

const MAX_BODY_BYTES = 32 * 1_024;

interface CreateShareDependencies {
  canonicalOrigin: string;
  persist?: typeof persistHuntBrief;
  limiter?: ShareCreationLimiter;
  rateLimitSecret?: string;
}

function json(body: Record<string, unknown>, status: number, headers?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

function originAllowed(request: Request, canonicalOrigin: string): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin || origin === canonicalOrigin;
}

function rateLimitIdentity(request: Request, secret: string): string {
  return createHmac("sha256", secret)
    .update(getClientAddress(request))
    .digest("base64url")
    .slice(0, 32);
}

export function createHuntBriefRequestHandler({
  canonicalOrigin,
  persist = persistHuntBrief,
  limiter,
  rateLimitSecret = process.env.HUNT_SHARE_RATE_LIMIT_SECRET?.trim() ?? "",
}: CreateShareDependencies) {
  return async function handleCreateHuntBrief(request: Request): Promise<Response> {
    if (!originAllowed(request, canonicalOrigin)) {
      return json({ ok: false, code: "ORIGIN_NOT_ALLOWED" }, 403);
    }

    if (request.headers.get("content-type")?.split(";", 1)[0]?.trim() !== "application/json") {
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

    let input: HuntShareProjectionInput | unknown;
    try {
      input = JSON.parse(rawBody);
    } catch {
      return json({ ok: false, code: "INVALID_JSON" }, 400);
    }

    try {
      if (!rateLimitSecret) throw new HuntBriefStoreConfigurationError();
      const activeLimiter = limiter ?? defaultShareCreationLimiter();
      const limit = await activeLimiter.check(rateLimitIdentity(request, rateLimitSecret));
      if (!limit.allowed) {
        return json(
          { ok: false, code: "RATE_LIMITED", retryAfterSeconds: limit.retryAfterSeconds },
          429,
          { "Retry-After": String(limit.retryAfterSeconds) },
        );
      }

      const brief = await persist(input);
      return json(
        {
          ok: true,
          shareId: brief.shareId,
          url: huntBriefUrl(brief.shareId),
        },
        201,
      );
    } catch (error) {
      if (error instanceof HuntBriefValidationError) {
        return json({ ok: false, code: "INVALID_HUNT_RESULT" }, 400);
      }
      if (error instanceof HuntBriefStoreConfigurationError) {
        console.error("[hunt-share] creation unavailable: persistence configuration missing");
        return json({ ok: false, code: "SERVICE_UNAVAILABLE" }, 503);
      }
      console.error("[hunt-share] brief creation failed");
      return json({ ok: false, code: "SERVICE_UNAVAILABLE" }, 503);
    }
  };
}
