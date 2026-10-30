import { createOverlayHandler } from "../../../../lib/hunt/exploration/handlers";
import { sharedRateLimiter } from "../../../../lib/rate-limit/public-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Special regulatory geography from the authority's own service, drawn only on request. */
export const GET = createOverlayHandler({ limiter: sharedRateLimiter("hunt-overlays") });
