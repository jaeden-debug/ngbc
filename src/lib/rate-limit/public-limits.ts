import { after } from "next/server";
import { events } from "../monitoring/events.ts";
import type { RateLimiter } from "../newsletter/rate-limit.ts";
import { defaultSupabaseServerClient } from "../supabase/server.ts";
import {
  createDistributedRateLimiter,
  createSupabaseRateLimitConsumer,
  type ConsumeRateLimit,
  type RateLimitEvent,
} from "./distributed.ts";

/**
 * Every public, unauthenticated endpoint's budget, in one place. Each key is
 * also the namespace its shared count is stored under.
 *
 * The figures are the ones each route held as a process-local limiter before
 * they became shared; making them shared changed what they mean (one budget per
 * caller instead of one per caller per instance), not how large they are.
 * Autocomplete and map panning are chattier than evaluation, so they are higher.
 * The newsletter's email budget is keyed on the normalised address, which the
 * store only ever sees as an HMAC.
 *
 * Administrator routes are not here: they sit behind an authenticated session,
 * and their pre-authentication step (sign-in) has its own fail-closed limiter.
 */
export const PUBLIC_RATE_LIMITS = {
  "hunt-evaluate": { limit: 30, windowMs: 60_000 },
  "hunt-location": { limit: 60, windowMs: 60_000 },
  "hunt-zone": { limit: 60, windowMs: 60_000 },
  "hunt-zone-status": { limit: 60, windowMs: 60_000 },
  "hunt-zones": { limit: 120, windowMs: 60_000 },
  "hunt-overlays": { limit: 120, windowMs: 60_000 },
  "hunt-zone-summary": { limit: 120, windowMs: 60_000 },
  "newsletter-ip": { limit: 8, windowMs: 10 * 60_000 },
  "newsletter-email": { limit: 4, windowMs: 10 * 60_000 },
} as const;

export type PublicRateLimitName = keyof typeof PUBLIC_RATE_LIMITS;

function report(event: RateLimitEvent) {
  if (event.type === "DENIED") {
    events.log(`rate_limit.denied.${event.namespace}`, "info", { retry_after_seconds: event.retryAfterSeconds });
  } else if (event.type === "STORE_UNAVAILABLE") {
    events.log(`rate_limit.store_unavailable.${event.namespace}`, "error", { reason: event.reason });
  } else {
    events.log(`rate_limit.not_configured.${event.namespace}`, "warn", { reason: event.reason });
  }
}

/** Work after the response; outside a request (a script, a test) it simply runs. */
function defer(task: () => Promise<void>) {
  try {
    after(task);
  } catch {
    void task();
  }
}

function consumerFor(namespace: PublicRateLimitName): ConsumeRateLimit | null {
  const { limit, windowMs } = PUBLIC_RATE_LIMITS[namespace];
  const secret = process.env.HUNT_SHARE_RATE_LIMIT_SECRET?.trim() ?? "";
  let consume: ConsumeRateLimit | null = null;
  let reason = "";
  if (!secret) {
    reason = "HUNT_SHARE_RATE_LIMIT_SECRET is not set";
  } else {
    try {
      consume = createSupabaseRateLimitConsumer({
        client: defaultSupabaseServerClient(),
        secret,
        namespace,
        limit,
        windowSeconds: Math.ceil(windowMs / 1_000),
      });
    } catch (error) {
      reason = error instanceof Error ? error.message : "Supabase is not configured";
    }
  }
  /* Local development usually has neither; production has both. Saying so
     once per instance is what stops a misconfigured deploy from quietly
     running on per-instance budgets again. */
  if (!consume) report({ type: "NOT_CONFIGURED", namespace, reason });
  return consume;
}

export function sharedRateLimiter(namespace: PublicRateLimitName): RateLimiter {
  const { limit, windowMs } = PUBLIC_RATE_LIMITS[namespace];
  return createDistributedRateLimiter({
    namespace,
    limit,
    windowMs,
    resolveConsume: () => consumerFor(namespace),
    defer,
    report,
  });
}
