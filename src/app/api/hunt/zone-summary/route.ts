import { createZoneSummaryHandler } from "../../../../lib/hunt/exploration/handlers";
import { sharedRateLimiter } from "../../../../lib/rate-limit/public-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What the certified rules say about a whole zone on a date, for the map's zone
 * card. The same engine as a full Hunt, asked about the zone rather than a point.
 */
export const GET = createZoneSummaryHandler({ limiter: sharedRateLimiter("hunt-zone-summary") });
