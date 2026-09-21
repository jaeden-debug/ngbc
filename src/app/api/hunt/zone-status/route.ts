import { createZoneStatusHandler } from "../../../../lib/hunt/exploration/handlers";
import { createRateLimiter } from "../../../../lib/newsletter/rate-limit";
import { SITE_URL } from "../../../../lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One species across the zones in view, for the map's species filter. */
export const POST = createZoneStatusHandler({
  limiter: createRateLimiter({ limit: 60, windowMs: 60_000 }),
  canonicalOrigin: SITE_URL.origin,
});
