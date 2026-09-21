import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { CanonicalId } from "../../../../lib/content-contract";
import { contentRepository } from "../../../../lib/content/repository";
import { createRateLimiter } from "../../../../lib/newsletter/rate-limit";
import { SPECIES_MEDIA_ADMIN_COOKIE, verifyAdminSessionToken } from "../../../../lib/species-media/admin-auth";
import { MAX_SPECIES_IMAGE_BYTES, SpeciesImageValidationError } from "../../../../lib/species-media/image";
import { canonicalOrigin, sameOrigin } from "../../../../lib/species-media/request";
import { SupabaseSpeciesMediaStore, SpeciesMediaPersistenceError } from "../../../../lib/species-media/store";
import { uploadSpeciesPrimary } from "../../../../lib/species-media/upload";
import { defaultSupabaseServerClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";
const limiter = createRateLimiter({ limit: 40, windowMs: 60 * 60 * 1_000 });

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

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

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_SPECIES_IMAGE_BYTES + 32_768) return json({ ok: false, code: "PAYLOAD_TOO_LARGE" }, 413);
  let form: FormData;
  try { form = await request.formData(); } catch { return json({ ok: false, code: "INVALID_REQUEST" }, 400); }

  const speciesId = form.get("speciesId");
  const file = form.get("image");
  const expected = form.get("expectedCurrentAssetId");
  const sourceType = form.get("sourceType") === "north_ground_generated" ? "north_ground_generated" : "north_ground";
  if (typeof speciesId !== "string" || !(file instanceof File)
    || (expected !== null && typeof expected !== "string")) {
    return json({ ok: false, code: "INVALID_REQUEST" }, 400);
  }
  const resource = await contentRepository.getSpecies(speciesId as CanonicalId<"species">);
  if (!resource) return json({ ok: false, code: "UNKNOWN_SPECIES" }, 404);
  if (!file.size || file.size > MAX_SPECIES_IMAGE_BYTES) return json({ ok: false, code: "PAYLOAD_TOO_LARGE" }, 413);

  try {
    const client = defaultSupabaseServerClient();
    const store = new SupabaseSpeciesMediaStore(client);
    const current = await store.getPrimary(resource.speciesProfile.speciesId);
    if (current && !expected) return json({ ok: false, code: "REPLACE_CONFIRMATION_REQUIRED", current }, 409);
    if ((current?.assetId ?? null) !== (expected || null)) return json({ ok: false, code: "PRIMARY_MEDIA_CHANGED", current }, 409);

    const creator = process.env.SPECIES_MEDIA_DEFAULT_CREATOR?.trim() || "North Ground";
    const licence = process.env.SPECIES_MEDIA_DEFAULT_LICENCE?.trim() || "All rights reserved";
    const altText = `${resource.title} — verified North Ground species photograph`;
    const media = await uploadSpeciesPrimary({
      speciesId: resource.speciesProfile.speciesId,
      source: Buffer.from(await file.arrayBuffer()),
      sourceType,
      creator,
      licence,
      altText,
      caption: null,
      admin,
      expectedCurrentAssetId: expected || null,
    }, client, store);
    return json({ ok: true, media }, 200);
  } catch (error) {
    if (error instanceof SpeciesImageValidationError) return json({ ok: false, code: error.code }, 400);
    if (error instanceof SpeciesMediaPersistenceError
      && ["PRIMARY_MEDIA_EXISTS", "PRIMARY_MEDIA_CHANGED"].includes(error.code)) {
      return json({ ok: false, code: error.code }, 409);
    }
    console.error("[species-media] upload failed", error instanceof SpeciesMediaPersistenceError ? error.code : "PROVIDER_ERROR");
    return json({ ok: false, code: "UPLOAD_FAILED" }, 503);
  }
}
