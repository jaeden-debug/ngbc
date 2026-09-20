import { createLocationHandler } from "../../../../lib/hunt/location-handler";
import { createRateLimiter } from "../../../../lib/newsletter/rate-limit";
import { SITE_URL } from "../../../../lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Autocomplete is inherently chattier than evaluation, but the client debounces and
// reuses one session per search, so this ceiling bounds abuse without limiting a
// person who is simply typing a place name.
const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

export const POST = createLocationHandler({
  limiter,
  canonicalOrigin: SITE_URL.origin,
});
