import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { consumeSignInAttempt, signInIdentity, SIGN_IN_LIMIT, SIGN_IN_WINDOW_SECONDS } from "./signin-limit.ts";

/**
 * Sign-in is the only pre-authentication write on the admin surface, so its
 * limiter is the durable one rather than a per-instance counter, and an
 * unreachable limiter refuses rather than allows.
 */

const request = (address = "203.0.113.7") =>
  new Request("https://www.northgroundbushcraft.com/api/admin/species-media/session", {
    method: "POST", headers: { "x-forwarded-for": address },
  });

function store(answer: unknown, calls: Array<Record<string, unknown>> = []) {
  return {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, ...args });
      return answer instanceof Error ? { data: null, error: answer } : { data: answer, error: null };
    },
  } as unknown as SupabaseClient;
}

test("an attempt is consumed from the shared limiter, under its own key namespace", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const result = await consumeSignInAttempt(request(), store([{ allowed: true, retry_after_seconds: 0 }], calls), "secret");
  assert.deepEqual(result, { allowed: true, retryAfterSeconds: 0 });
  assert.equal(calls[0].name, "consume_hunt_share_rate_limit");
  assert.equal(calls[0].p_limit, SIGN_IN_LIMIT);
  assert.equal(calls[0].p_window_seconds, SIGN_IN_WINDOW_SECONDS);
  // Exactly 32 URL-safe characters, as the store requires.
  assert.match(String(calls[0].p_identity_hash), /^[A-Za-z0-9_-]{32}$/);
});

test("the caller's address is never stored, only an HMAC of it", () => {
  const identity = signInIdentity(request("198.51.100.42"), "secret");
  assert.ok(!identity.includes("198.51.100.42"));
  assert.equal(identity, signInIdentity(request("198.51.100.42"), "secret"), "stable for one caller");
  assert.notEqual(identity, signInIdentity(request("198.51.100.43"), "secret"), "different callers differ");
  assert.notEqual(identity, signInIdentity(request("198.51.100.42"), "other"), "and it depends on the secret");
  // A separate budget from Hunt Brief sharing for the same caller and secret.
  const share = createHmac("sha256", "secret").update("198.51.100.42").digest("base64url").slice(0, 32);
  assert.notEqual(identity, share, "sign-in and sharing never share a budget");
});

test("a refused attempt carries how long to wait", async () => {
  const result = await consumeSignInAttempt(request(), store([{ allowed: false, retry_after_seconds: 540 }]), "secret");
  assert.deepEqual(result, { allowed: false, retryAfterSeconds: 540 });
});

test("an unreachable or nonsense limiter throws, so the route can refuse", async () => {
  for (const answer of [new Error("unreachable"), null, [{ allowed: "yes" }], [{}]]) {
    await assert.rejects(consumeSignInAttempt(request(), store(answer), "secret"), /unavailable/);
  }
  // A missing secret is a configuration failure, never an unmetered sign-in.
  await assert.rejects(consumeSignInAttempt(request(), store([{ allowed: true, retry_after_seconds: 0 }]), ""), /secret is required/);
});
