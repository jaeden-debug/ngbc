import { evaluateHunt } from "../../../../lib/hunt/evaluate";
import { createHuntHandler } from "../../../../lib/hunt/handler";
import { createRateLimiter } from "../../../../lib/newsletter/rate-limit";
import { SITE_URL } from "../../../../lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

export const POST = createHuntHandler({
  evaluate: evaluateHunt,
  limiter,
  canonicalOrigin: SITE_URL.origin,
});
