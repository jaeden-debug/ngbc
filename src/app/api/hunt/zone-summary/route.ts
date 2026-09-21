import { createZoneSummaryHandler } from "../../../../lib/hunt/exploration/handlers";
import { createRateLimiter } from "../../../../lib/newsletter/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What the certified rules say about a whole zone on a date, for the map's zone
 * card. The same engine as a full Hunt, asked about the zone rather than a point.
 */
export const GET = createZoneSummaryHandler({ limiter: createRateLimiter({ limit: 120, windowMs: 60_000 }) });
