import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  createDistributedRateLimiter,
  createSupabaseRateLimitConsumer,
  rateLimitIdentity,
  type ConsumeRateLimit,
  type RateLimitEvent,
} from "./distributed.ts";

/** A test clock and a deferral queue that runs when told to, like `after()`. */
function harness() {
  let time = 1_000_000;
  const queue: Array<() => Promise<void>> = [];
  return {
    now: () => time,
    advance(ms: number) {
      time += ms;
    },
    defer(task: () => Promise<void>) {
      queue.push(task);
    },
    async flush() {
      while (queue.length) await queue.shift()!();
    },
  };
}

/**
 * The store as `consume_hunt_share_rate_limit` behaves: one fixed window per
 * identity, opened by the first request, counting every request inside it.
 */
function sharedStore(limit: number, windowMs: number, now: () => number) {
  const rows = new Map<string, { count: number; expiresAt: number }>();
  let calls = 0;
  const consume: ConsumeRateLimit = async (key) => {
    calls += 1;
    const current = now();
    let row = rows.get(key);
    if (!row || row.expiresAt <= current) {
      row = { count: 0, expiresAt: current + windowMs };
      rows.set(key, row);
    }
    row.count += 1;
    return { allowed: row.count <= limit, retryAfterSeconds: Math.max(1, Math.ceil((row.expiresAt - current) / 1_000)) };
  };
  return { consume, calls: () => calls };
}

test("two instances share one budget: a caller over the shared limit is refused by both", async () => {
  const h = harness();
  const store = sharedStore(4, 60_000, h.now);
  const instance = () =>
    createDistributedRateLimiter({
      namespace: "hunt-evaluate",
      limit: 4,
      windowMs: 60_000,
      resolveConsume: () => store.consume,
      defer: h.defer,
      now: h.now,
    });
  const a = instance();
  const b = instance();

  // Alternating between instances, each sees only half the traffic and would
  // allow it all on its own count: three each is within a local limit of four.
  for (let i = 0; i < 3; i += 1) {
    assert.equal(a.check("caller").allowed, true);
    await h.flush();
    assert.equal(b.check("caller").allowed, true);
    await h.flush();
  }

  // Six requests against a shared limit of four: both instances now know.
  const fromA = a.check("caller");
  const fromB = b.check("caller");
  assert.equal(fromA.allowed, false);
  assert.equal(fromB.allowed, false);
  assert.ok(fromA.retryAfterSeconds >= 1 && fromA.retryAfterSeconds <= 60);
  // Another caller is untouched.
  assert.equal(a.check("someone-else").allowed, true);
});

test("the lag is bounded: a request already answered before the store's verdict is the only one let through", async () => {
  const h = harness();
  const store = sharedStore(2, 60_000, h.now);
  const limiter = createDistributedRateLimiter({
    namespace: "n",
    limit: 10,
    windowMs: 60_000,
    resolveConsume: () => store.consume,
    defer: h.defer,
    now: h.now,
  });
  assert.equal(limiter.check("k").allowed, true);
  assert.equal(limiter.check("k").allowed, true);
  assert.equal(limiter.check("k").allowed, true); // third: in flight before the verdict
  await h.flush();
  assert.equal(limiter.check("k").allowed, false);
});

test("a refused caller is not written to the store again until its window ends", async () => {
  const h = harness();
  const store = sharedStore(1, 60_000, h.now);
  const limiter = createDistributedRateLimiter({
    namespace: "n",
    limit: 100,
    windowMs: 60_000,
    resolveConsume: () => store.consume,
    defer: h.defer,
    now: h.now,
  });
  limiter.check("k");
  limiter.check("k");
  await h.flush();
  assert.equal(store.calls(), 2);
  for (let i = 0; i < 50; i += 1) assert.equal(limiter.check("k").allowed, false);
  await h.flush();
  assert.equal(store.calls(), 2, "blocked requests cost the store nothing");

  h.advance(60_000);
  assert.equal(limiter.check("k").allowed, true, "the block ends with the store's window");
  await h.flush();
  assert.equal(store.calls(), 3);
});

test("the local limit still applies, with or without a store", async () => {
  const h = harness();
  for (const resolveConsume of [() => null, () => sharedStore(1_000, 60_000, h.now).consume]) {
    const limiter = createDistributedRateLimiter({
      namespace: "n",
      limit: 2,
      windowMs: 60_000,
      resolveConsume,
      defer: h.defer,
      now: h.now,
    });
    assert.equal(limiter.check("k").allowed, true);
    assert.equal(limiter.check("k").allowed, true);
    assert.equal(limiter.check("k").allowed, false);
    await h.flush();
  }
});

test("an unreachable store degrades to the local limit and says so", async () => {
  const h = harness();
  const events: RateLimitEvent[] = [];
  const limiter = createDistributedRateLimiter({
    namespace: "hunt-zones",
    limit: 5,
    windowMs: 60_000,
    resolveConsume: () => async () => {
      throw new Error("The shared rate limiter did not answer");
    },
    defer: h.defer,
    report: (event) => events.push(event),
    now: h.now,
  });
  assert.equal(limiter.check("k").allowed, true);
  await h.flush();
  assert.equal(limiter.check("k").allowed, true, "Hunt keeps answering");
  assert.deepEqual(events[0], {
    type: "STORE_UNAVAILABLE",
    namespace: "hunt-zones",
    reason: "The shared rate limiter did not answer",
  });
});

test("the store is resolved once, on the first request, not at construction", async () => {
  const h = harness();
  let resolved = 0;
  const limiter = createDistributedRateLimiter({
    namespace: "n",
    limit: 5,
    windowMs: 60_000,
    resolveConsume: () => {
      resolved += 1;
      return null;
    },
    defer: h.defer,
    now: h.now,
  });
  assert.equal(resolved, 0, "building the app must not touch production configuration");
  limiter.check("a");
  limiter.check("b");
  assert.equal(resolved, 1);
});

test("the stored identity is a 32-character HMAC per namespace, never the address", () => {
  const secret = "s".repeat(32);
  const one = rateLimitIdentity(secret, "hunt-evaluate", "203.0.113.7");
  const two = rateLimitIdentity(secret, "hunt-zones", "203.0.113.7");
  assert.match(one, /^[A-Za-z0-9_-]{32}$/, "the store's own check constraint");
  assert.notEqual(one, two, "each namespace is its own budget");
  assert.ok(!one.includes("203"));
  // Administrator sign-in moved onto this function; its identities must not change.
  const signInBefore = createHmac("sha256", secret)
    .update("species-media-signin|203.0.113.7")
    .digest("base64url")
    .slice(0, 32);
  assert.equal(rateLimitIdentity(secret, "species-media-signin", "203.0.113.7"), signInBefore);
});

function fakeClient(response: { data: unknown; error: unknown }) {
  const calls: Array<{ fn: string; args: Record<string, unknown>; signal?: AbortSignal }> = [];
  return {
    calls,
    client: {
      rpc(fn: string, args: Record<string, unknown>) {
        const call: { fn: string; args: Record<string, unknown>; signal?: AbortSignal } = { fn, args };
        calls.push(call);
        return {
          abortSignal(signal: AbortSignal) {
            call.signal = signal;
            return Promise.resolve(response);
          },
        };
      },
    },
  };
}

test("the Supabase consumer calls the shared store with this namespace's limit and a timeout", async () => {
  const { client, calls } = fakeClient({ data: [{ allowed: false, retry_after_seconds: 42 }], error: null });
  const consume = createSupabaseRateLimitConsumer({
    client,
    secret: "secret",
    namespace: "hunt-evaluate",
    limit: 30,
    windowSeconds: 60,
  });
  assert.deepEqual(await consume("203.0.113.7"), { allowed: false, retryAfterSeconds: 42 });
  assert.equal(calls[0].fn, "consume_hunt_share_rate_limit");
  assert.deepEqual(calls[0].args, {
    p_identity_hash: rateLimitIdentity("secret", "hunt-evaluate", "203.0.113.7"),
    p_limit: 30,
    p_window_seconds: 60,
  });
  assert.ok(calls[0].signal instanceof AbortSignal);
});

test("the Supabase consumer refuses to guess from an error or a malformed answer", async () => {
  for (const response of [
    { data: null, error: { message: "boom" } },
    { data: [], error: null },
    { data: [{ allowed: "yes", retry_after_seconds: 1 }], error: null },
  ]) {
    const { client } = fakeClient(response);
    const consume = createSupabaseRateLimitConsumer({ client, secret: "s", namespace: "n", limit: 1, windowSeconds: 1 });
    await assert.rejects(consume("k"));
  }
  assert.throws(() =>
    createSupabaseRateLimitConsumer({ client: fakeClient({ data: null, error: null }).client, secret: "", namespace: "n", limit: 1, windowSeconds: 1 }),
  );
});
