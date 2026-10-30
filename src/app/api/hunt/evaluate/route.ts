import { evaluateHunt } from "../../../../lib/hunt/evaluate";
import { createHuntHandler } from "../../../../lib/hunt/handler";
import { sharedRateLimiter } from "../../../../lib/rate-limit/public-limits";
import { SITE_URL } from "../../../../lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = sharedRateLimiter("hunt-evaluate");

export const POST = createHuntHandler({
  evaluate: evaluateHunt,
  limiter,
  canonicalOrigin: SITE_URL.origin,
});
