import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRateLimiter } from "../../../../../lib/newsletter/rate-limit";
import { SPECIES_MEDIA_ADMIN_COOKIE, verifyAdminSessionToken } from "../../../../../lib/species-media/admin-auth";
import { parseFocalPointRequest } from "../../../../../lib/species-media/focal";
import { canonicalOrigin, sameOrigin } from "../../../../../lib/species-media/request";
import { SupabaseSpeciesMediaStore } from "../../../../../lib/species-media/store";
import { defaultSupabaseServerClient } from "../../../../../lib/supabase/server";

export const runtime = "nodejs";
// Positioning is a drag-and-release gesture; generous, but bounded.
const limiter = createRateLimiter({ limit: 300, windowMs: 60 * 60 * 1_000 });

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Where the subject of the current primary photo sits in its frame. Administrator only. */
export async function POST(request: Request) {
  if (!sameOrigin(request, canonicalOrigin())) return json({ ok: false, code: "ORIGIN_NOT_ALLOWED" }, 403);
  let admin;
  try {
    admin = verifyAdminSessionToken((await cookies()).get(SPECIES_MEDIA_ADMIN_COOKIE)?.value);
  } catch {
    return json({ ok: false, code: "SERVICE_UNAVAILABLE" }, 503);
  }
  if (!admin) return json({ ok: false, code: "UNAUTHORIZED" }, 401);
  const rate = limiter.check(admin.userId);
  if (!rate.allowed) return json({ ok: false, code: "RATE_LIMITED", retryAfterSeconds: rate.retryAfterSeconds }, 429);

  const parsed = parseFocalPointRequest(await request.json().catch(() => null));
  if (!parsed) return json({ ok: false, code: "INVALID_REQUEST" }, 400);
  try {
    const updated = await new SupabaseSpeciesMediaStore(defaultSupabaseServerClient())
      .setFocalPoint(parsed.assetId, { x: parsed.x, y: parsed.y }, admin.userId);
    return updated ? json({ ok: true }, 200) : json({ ok: false, code: "NOT_CURRENT" }, 409);
  } catch {
    console.error("[species-media] focal point update failed");
    return json({ ok: false, code: "TEMPORARILY_UNAVAILABLE" }, 503);
  }
}
