import { createHuntBriefRequestHandler } from "../../../../lib/hunt-share/request.ts";
import { SITE_URL } from "../../../../lib/site.ts";

export const runtime = "nodejs";

export const POST = createHuntBriefRequestHandler({
  canonicalOrigin: SITE_URL.origin,
});
