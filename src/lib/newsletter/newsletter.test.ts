import assert from "node:assert/strict";
import test from "node:test";

import { normalizeEmail } from "./email.ts";
import { createSubscribeHandler } from "./handler.ts";
import { createRateLimiter, type RateLimiter } from "./rate-limit.ts";
import {
  NewsletterConfigurationError,
  subscribeWithResend,
  type NewsletterSubscriptionResult,
} from "./resend.ts";

type MockStep = {
  method: string;
  path: string;
  status: number;
  body?: unknown;
  inspectBody?: (body: unknown) => void;
};

function createFetchMock(steps: MockStep[]): typeof fetch {
  return async (input, init) => {
    const step = steps.shift();
    assert.ok(step, `unexpected provider request: ${String(input)}`);
    assert.equal(init?.method, step.method);
    assert.equal(new URL(String(input)).pathname, step.path);

    if (step.inspectBody) {
      step.inspectBody(JSON.parse(String(init?.body)));
    }

    return new Response(step.body === undefined ? null : JSON.stringify(step.body), {
      status: step.status,
      headers: step.body === undefined ? undefined : { "Content-Type": "application/json" },
    });
  };
}

function environment() {
  return {
    RESEND_API_KEY: "re_test",
    RESEND_SEGMENT_ID: "segment-test",
  };
}

function allowAllLimiter(): RateLimiter {
  return { check: () => ({ allowed: true, retryAfterSeconds: 1 }) };
}

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://northgroundbushcraft.com/api/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://northgroundbushcraft.com",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

test("normalizes valid email and rejects unsafe or malformed input", () => {
  assert.equal(normalizeEmail("  FIELD.NOTES@Example.COM "), "field.notes@example.com");
  assert.equal(normalizeEmail("field..notes@example.com"), null);
  assert.equal(normalizeEmail("field-notes@localhost"), null);
  assert.equal(normalizeEmail("not an email"), null);
  assert.equal(normalizeEmail(null), null);
});

test("rate limiter resets deterministically", () => {
  let now = 1_000;
  const limiter = createRateLimiter({ limit: 2, windowMs: 10_000, now: () => now });

  assert.equal(limiter.check("one").allowed, true);
  assert.equal(limiter.check("one").allowed, true);
  assert.equal(limiter.check("one").allowed, false);
  now += 10_001;
  assert.equal(limiter.check("one").allowed, true);
});

test("creates a durable Resend contact in the configured segment", async () => {
  const steps: MockStep[] = [
    { method: "GET", path: "/contacts/field.notes%40example.com", status: 404, body: { name: "not_found" } },
    {
      method: "POST",
      path: "/contacts",
      status: 200,
      body: { object: "contact", id: "contact-1" },
      inspectBody(body) {
        assert.deepEqual(body, {
          email: "field.notes@example.com",
          unsubscribed: false,
          segments: [{ id: "segment-test" }],
        });
      },
    },
  ];

  const result = await subscribeWithResend("field.notes@example.com", {
    environment: environment(),
    fetchImplementation: createFetchMock(steps),
  });

  assert.deepEqual(result, { provider: "resend", contactId: "contact-1", created: true });
  assert.equal(steps.length, 0);
});

test("repeated subscription updates one contact and ensures segment membership", async () => {
  const steps: MockStep[] = [
    { method: "GET", path: "/contacts/field.notes%40example.com", status: 200, body: { id: "contact-1", unsubscribed: true } },
    {
      method: "PATCH",
      path: "/contacts/field.notes%40example.com",
      status: 200,
      body: { object: "contact", id: "contact-1" },
      inspectBody(body) {
        assert.deepEqual(body, { unsubscribed: false });
      },
    },
    { method: "POST", path: "/contacts/field.notes%40example.com/segments/segment-test", status: 200, body: { id: "segment-test" } },
  ];

  const result = await subscribeWithResend("field.notes@example.com", {
    environment: environment(),
    fetchImplementation: createFetchMock(steps),
  });

  assert.deepEqual(result, { provider: "resend", contactId: "contact-1", created: false });
  assert.equal(steps.length, 0);
});

test("concurrent create race converges on the existing provider contact", async () => {
  const steps: MockStep[] = [
    { method: "GET", path: "/contacts/field.notes%40example.com", status: 404, body: { name: "not_found" } },
    { method: "POST", path: "/contacts", status: 400, body: { name: "validation_error" } },
    { method: "GET", path: "/contacts/field.notes%40example.com", status: 200, body: { id: "contact-1" } },
    { method: "PATCH", path: "/contacts/field.notes%40example.com", status: 200, body: { id: "contact-1" } },
    { method: "POST", path: "/contacts/field.notes%40example.com/segments/segment-test", status: 200, body: { id: "segment-test" } },
  ];

  const result = await subscribeWithResend("field.notes@example.com", {
    environment: environment(),
    fetchImplementation: createFetchMock(steps),
  });

  assert.equal(result.created, false);
  assert.equal(steps.length, 0);
});

test("missing provider configuration fails closed", async () => {
  await assert.rejects(
    subscribeWithResend("field.notes@example.com", { environment: {} }),
    NewsletterConfigurationError,
  );
});

test("API handler persists normalized addresses before returning success", async () => {
  let persisted = "";
  const subscribe = async (email: string): Promise<NewsletterSubscriptionResult> => {
    persisted = email;
    return { provider: "resend", contactId: "contact-1", created: true };
  };
  const handler = createSubscribeHandler({
    canonicalOrigin: "https://northgroundbushcraft.com",
    subscribe,
    ipLimiter: allowAllLimiter(),
    emailLimiter: allowAllLimiter(),
  });

  const response = await handler(request({ email: " FIELD.NOTES@Example.COM " }));
  assert.equal(response.status, 200);
  assert.equal(persisted, "field.notes@example.com");
  assert.deepEqual(await response.json(), { ok: true, status: "subscribed" });
});

test("API handler rejects invalid input, cross-origin requests, and excess attempts", async () => {
  let calls = 0;
  const subscribe = async (): Promise<NewsletterSubscriptionResult> => {
    calls += 1;
    return { provider: "resend", contactId: "contact-1", created: true };
  };
  const blockedLimiter: RateLimiter = {
    check: () => ({ allowed: false, retryAfterSeconds: 600 }),
  };

  const normalHandler = createSubscribeHandler({
    canonicalOrigin: "https://northgroundbushcraft.com",
    subscribe,
    ipLimiter: allowAllLimiter(),
    emailLimiter: allowAllLimiter(),
  });
  assert.equal((await normalHandler(request({ email: "bad" }))).status, 400);
  assert.equal(
    (await normalHandler(request(
      { email: "valid@example.com" },
      { Origin: "https://attacker.example" },
    ))).status,
    403,
  );

  const limitedHandler = createSubscribeHandler({
    canonicalOrigin: "https://northgroundbushcraft.com",
    subscribe,
    ipLimiter: blockedLimiter,
    emailLimiter: allowAllLimiter(),
  });
  const limited = await limitedHandler(request({ email: "valid@example.com" }));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "600");
  assert.equal(calls, 0);
});

test("honeypot submissions never reach durable storage", async () => {
  let calls = 0;
  const handler = createSubscribeHandler({
    canonicalOrigin: "https://northgroundbushcraft.com",
    subscribe: async () => {
      calls += 1;
      return { provider: "resend", contactId: "contact-1", created: true };
    },
    ipLimiter: allowAllLimiter(),
    emailLimiter: allowAllLimiter(),
  });

  const response = await handler(request({ email: "bot@example.com", website: "spam" }));
  assert.equal(response.status, 200);
  assert.equal(calls, 0);
});
