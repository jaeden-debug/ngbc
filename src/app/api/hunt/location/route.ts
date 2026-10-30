import { createLocationHandler } from "../../../../lib/hunt/location-handler";
import { sharedRateLimiter } from "../../../../lib/rate-limit/public-limits";
import { SITE_URL } from "../../../../lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Autocomplete is inherently chattier than evaluation, but the client debounces and
// reuses one session per search, so this ceiling bounds abuse without limiting a
// person who is simply typing a place name.
const limiter = sharedRateLimiter("hunt-location");

export const POST = createLocationHandler({
  limiter,
  canonicalOrigin: SITE_URL.origin,
});
