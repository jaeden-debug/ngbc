import { createOverlayHandler } from "../../../../lib/hunt/exploration/handlers";
import { createRateLimiter } from "../../../../lib/newsletter/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Special regulatory geography from the authority's own service, drawn only on request. */
export const GET = createOverlayHandler({ limiter: createRateLimiter({ limit: 120, windowMs: 60_000 }) });
