import { createSubscribeHandler } from "@/src/lib/newsletter/handler";
import { subscribeWithResend } from "@/src/lib/newsletter/resend";
import { SITE_URL } from "@/src/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createSubscribeHandler({
  canonicalOrigin: SITE_URL.origin,
  subscribe: subscribeWithResend,
});
