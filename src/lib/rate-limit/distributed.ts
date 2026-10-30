import { createHmac } from "node:crypto";
import { createRateLimiter, type RateLimiter, type RateLimitResult } from "../newsletter/rate-limit.ts";

/**
 * A rate limiter that holds across every server instance, without adding a
 * round trip to the request it limits.
 *
 * WHY NOT THE PROCESS-LOCAL LIMITER ALONE. A counter in one instance's memory
 * gives a caller one budget per instance; serverless scaling multiplies it by
 * however many instances the caller's traffic happens to reach. The endpoints it
 * protects spend real money (paid geocoding and weather) or real compute (the
 * regulatory engine), so the budget has to be one budget.
 *
 * WHY NOT A SYNCHRONOUS DURABLE CHECK. Every Hunt request would wait on the
 * store before answering, and speed is a landing gate. So the request is
 * answered on the local decision, and the durable count is consumed AFTER the
 * response (`defer`). When the store says the caller is over its shared budget,
 * this instance remembers that until the store's window ends and refuses from
 * then on. The cost of that trade is bounded and stated: a caller over budget
 * can be served the requests already in flight on each instance it reaches
 * before the first durable answer returns — never an unbounded number, and
 * never more than the local limit on any one instance.
 *
 * FAILURE DIRECTION. These are public, read-only answers, so an unreachable
 * store degrades to the local limiter rather than refusing Hunt: the local
 * limit still applies, and the failure is reported. This is deliberately the
 * opposite of administrator sign-in (`signin-limit.ts`), which fails closed
 * because it guards a credential, not a public answer.
 */

export type ConsumeRateLimit = (key: string) => Promise<RateLimitResult>;

export type RateLimitEvent =
  | { type: "DENIED"; namespace: string; retryAfterSeconds: number }
  | { type: "STORE_UNAVAILABLE"; namespace: string; reason: string }
  | { type: "NOT_CONFIGURED"; namespace: string; reason: string };

export interface DistributedRateLimiterOptions {
  namespace: string;
  limit: number;
  windowMs: number;
  /**
   * Returns the durable store, or null when it is not configured (the limiter
   * is then local only). Called once, on the first request rather than at
   * construction, so building the app without production secrets is silent.
   */
  resolveConsume: () => ConsumeRateLimit | null;
  /** Runs work after the response has been sent. */
  defer: (task: () => Promise<void>) => void;
  report?: (event: RateLimitEvent) => void;
  now?: () => number;
  maxEntries?: number;
}

export function createDistributedRateLimiter({
  namespace,
  limit,
  windowMs,
  resolveConsume,
  defer,
  report = () => {},
  now = Date.now,
  maxEntries = 5_000,
}: DistributedRateLimiterOptions): RateLimiter {
  const local = createRateLimiter({ limit, windowMs, maxEntries, now });
  /** Callers the shared store has said are over budget, until its window ends. */
  const blockedUntil = new Map<string, number>();
  let consume: ConsumeRateLimit | null | undefined;

  function block(key: string, until: number) {
    if (blockedUntil.size >= maxEntries) {
      const currentTime = now();
      for (const [blockedKey, expiry] of blockedUntil) {
        if (expiry <= currentTime) blockedUntil.delete(blockedKey);
      }
      while (blockedUntil.size >= maxEntries) {
        const oldest = blockedUntil.keys().next().value;
        if (typeof oldest !== "string") break;
        blockedUntil.delete(oldest);
      }
    }
    blockedUntil.set(key, until);
  }

  return {
    check(key) {
      const currentTime = now();
      const until = blockedUntil.get(key);
      if (until !== undefined) {
        /* An already-refused caller is not counted again: during an attack the
           store is written once per instance per window, not once per request. */
        if (until > currentTime) {
          return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((until - currentTime) / 1_000)) };
        }
        blockedUntil.delete(key);
      }

      const decision = local.check(key);
      if (consume === undefined) consume = resolveConsume();
      if (!decision.allowed || !consume) return decision;
      const store = consume;

      defer(async () => {
        try {
          const shared = await store(key);
          if (!shared.allowed) {
            block(key, now() + shared.retryAfterSeconds * 1_000);
            report({ type: "DENIED", namespace, retryAfterSeconds: shared.retryAfterSeconds });
          }
        } catch (error) {
          report({ type: "STORE_UNAVAILABLE", namespace, reason: error instanceof Error ? error.message : "unknown" });
        }
      });
      return decision;
    },
  };
}

/**
 * The identity a durable limiter stores: an HMAC of the namespace and the
 * caller's key, never the address itself (CLAUDE.md §49). The namespace is
 * inside the HMAC rather than a prefix because the store accepts exactly 32
 * URL-safe characters, so each namespace is a separate budget that no other
 * can exhaust.
 */
export function rateLimitIdentity(secret: string, namespace: string, key: string): string {
  return createHmac("sha256", secret).update(`${namespace}|${key}`).digest("base64url").slice(0, 32);
}

interface RpcClient {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): { abortSignal(signal: AbortSignal): PromiseLike<{ data: unknown; error: unknown }> };
}

/**
 * Consumes one request from the shared Supabase limiter
 * (`consume_hunt_share_rate_limit`), the same store Hunt Briefs and
 * administrator sign-in already use, under this namespace's own budget.
 * Throws when the store does not answer in the expected shape.
 */
export function createSupabaseRateLimitConsumer({
  client,
  secret,
  namespace,
  limit,
  windowSeconds,
  timeoutMs = 2_000,
}: {
  client: RpcClient;
  secret: string;
  namespace: string;
  limit: number;
  windowSeconds: number;
  timeoutMs?: number;
}): ConsumeRateLimit {
  if (!secret) throw new Error("A rate-limit secret is required");
  return async (key) => {
    const { data, error } = await client
      .rpc("consume_hunt_share_rate_limit", {
        p_identity_hash: rateLimitIdentity(secret, namespace, key),
        p_limit: limit,
        p_window_seconds: windowSeconds,
      })
      .abortSignal(AbortSignal.timeout(timeoutMs));
    const result = (Array.isArray(data) ? data[0] : data) as
      | { allowed?: unknown; retry_after_seconds?: unknown }
      | null
      | undefined;
    if (error || !result || typeof result.allowed !== "boolean" || typeof result.retry_after_seconds !== "number") {
      throw new Error("The shared rate limiter did not answer");
    }
    return { allowed: result.allowed, retryAfterSeconds: result.retry_after_seconds };
  };
}
