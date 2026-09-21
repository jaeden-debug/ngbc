import { NextResponse } from "next/server";
import { authenticateSpeciesMediaAdmin, SPECIES_MEDIA_ADMIN_COOKIE, speciesMediaAdminCookieOptions } from "../../../../../lib/species-media/admin-auth";
import { canonicalOrigin, sameOrigin } from "../../../../../lib/species-media/request";
import { createRateLimiter, getClientAddress } from "../../../../../lib/newsletter/rate-limit";

export const runtime = "nodejs";
const limiter = createRateLimiter({ limit: 5, windowMs: 15 * 60 * 1_000 });

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  if (!sameOrigin(request, canonicalOrigin())) return json({ ok: false, code: "ORIGIN_NOT_ALLOWED" }, 403);
  if (request.headers.get("content-type")?.split(";", 1)[0] !== "application/json") {
    return json({ ok: false, code: "UNSUPPORTED_MEDIA_TYPE" }, 415);
  }
  const limit = limiter.check(getClientAddress(request));
  if (!limit.allowed) {
    const response = json({ ok: false, code: "RATE_LIMITED" }, 429);
    response.headers.set("Retry-After", String(limit.retryAfterSeconds));
    return response;
  }

  let body: { email?: unknown; password?: unknown };
  try { body = await request.json() as typeof body; } catch { return json({ ok: false, code: "INVALID_REQUEST" }, 400); }
  if (typeof body.email !== "string" || body.email.length > 320
    || typeof body.password !== "string" || body.password.length < 8 || body.password.length > 256) {
    return json({ ok: false, code: "INVALID_CREDENTIALS" }, 401);
  }

  try {
    const authenticated = await authenticateSpeciesMediaAdmin(body.email.trim(), body.password);
    if (!authenticated) return json({ ok: false, code: "INVALID_CREDENTIALS" }, 401);
    const response = json({ ok: true }, 200);
    response.cookies.set(SPECIES_MEDIA_ADMIN_COOKIE, authenticated.token, speciesMediaAdminCookieOptions);
    return response;
  } catch {
    console.error("[species-media] administrator sign-in unavailable");
    return json({ ok: false, code: "SERVICE_UNAVAILABLE" }, 503);
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request, canonicalOrigin())) return json({ ok: false, code: "ORIGIN_NOT_ALLOWED" }, 403);
  const response = json({ ok: true }, 200);
  response.cookies.set(SPECIES_MEDIA_ADMIN_COOKIE, "", { ...speciesMediaAdminCookieOptions, maxAge: 0 });
  return response;
}
