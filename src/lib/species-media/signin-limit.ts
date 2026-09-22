import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getClientAddress } from "../newsletter/rate-limit.ts";

/**
 * How often one caller may try to sign in as the administrator.
 *
 * Sign-in is the only PRE-authentication write on the admin surface, so its
 * limiter must be durable rather than per-instance: a process-local counter
 * gives an attacker one budget per serverless instance. This consumes the same
 * database limiter Hunt Briefs use, under its own key namespace.
 *
 * The stored identity is an HMAC of the caller's address, never the address
 * itself (CLAUDE.md §49), and the limiter FAILS CLOSED: if the store cannot be
 * reached, sign-in is refused rather than allowed unmetered.
 *
 * The namespace is inside the HMAC rather than a prefix, because the store
 * accepts exactly 32 URL-safe characters; one caller therefore has separate
 * budgets here and for Hunt Brief sharing, and neither can exhaust the other.
 */
const NAMESPACE = "species-media-signin";
export const SIGN_IN_LIMIT = 5;
export const SIGN_IN_WINDOW_SECONDS = 15 * 60;

export interface SignInLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function signInIdentity(request: Request, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${NAMESPACE}|${getClientAddress(request)}`)
    .digest("base64url")
    .slice(0, 32);
}

/**
 * Consumes one attempt. Throws when the store cannot answer, so the caller can
 * refuse: an unreachable limiter is not permission.
 */
export async function consumeSignInAttempt(
  request: Request,
  client: SupabaseClient,
  secret: string,
  limit = SIGN_IN_LIMIT,
  windowSeconds = SIGN_IN_WINDOW_SECONDS,
): Promise<SignInLimitResult> {
  if (!secret) throw new Error("A sign-in rate-limit secret is required");
  const { data, error } = await client.rpc("consume_hunt_share_rate_limit", {
    p_identity_hash: signInIdentity(request, secret),
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  const result = Array.isArray(data) ? data[0] : data;
  if (error || !result || typeof result.allowed !== "boolean" || typeof result.retry_after_seconds !== "number") {
    throw new Error("The sign-in rate limiter is unavailable");
  }
  return { allowed: result.allowed, retryAfterSeconds: result.retry_after_seconds };
}
