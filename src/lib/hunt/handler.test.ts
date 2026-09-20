import assert from "node:assert/strict";
import test from "node:test";
import type { HuntEvaluation, HuntInput } from "./types.ts";
import { createHuntHandler } from "./handler.ts";

const validInput: HuntInput = {
  latitude: 45.23,
  longitude: -77.94,
  date: "2026-09-20",
  speciesId: "species:ruffed-grouse",
};

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://www.northgroundbushcraft.com/api/hunt/evaluate", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function handler(options: { allowed?: boolean; calls?: HuntInput[] } = {}) {
  return createHuntHandler({
    canonicalOrigin: "https://www.northgroundbushcraft.com",
    limiter: { check: () => ({ allowed: options.allowed ?? true, retryAfterSeconds: 42 }) },
    evaluate: async (input) => {
      options.calls?.push(input);
      return { input } as HuntEvaluation;
    },
  });
}

test("Hunt handler accepts a bounded same-origin evaluation", async () => {
  const calls: HuntInput[] = [];
  const response = await handler({ calls })(request(validInput, { origin: "https://www.northgroundbushcraft.com" }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(calls, [validInput]);
});

test("Hunt handler rejects cross-origin and non-JSON requests", async () => {
  const crossOrigin = await handler()(request(validInput, { origin: "https://example.com" }));
  assert.equal(crossOrigin.status, 403);

  const wrongType = await handler()(request(validInput, { "content-type": "text/plain" }));
  assert.equal(wrongType.status, 415);
});

test("Hunt handler validates body size, JSON shape, and supported scope", async () => {
  assert.equal((await handler()(request("{"))).status, 400);
  assert.equal((await handler()(request({ ...validInput, speciesId: "species:moose" }))).status, 400);
  assert.equal((await handler()(request("x".repeat(2_049)))).status, 413);
});

test("Hunt handler returns retry guidance when rate limited", async () => {
  const response = await handler({ allowed: false })(request(validInput));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "42");
});
