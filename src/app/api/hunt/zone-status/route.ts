import { createZoneStatusHandler } from "../../../../lib/hunt/exploration/handlers";
import { sharedRateLimiter } from "../../../../lib/rate-limit/public-limits";
import { SITE_URL } from "../../../../lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One species across the zones in view, for the map's species filter. */
export const POST = createZoneStatusHandler({
  limiter: sharedRateLimiter("hunt-zone-status"),
  canonicalOrigin: SITE_URL.origin,
});
