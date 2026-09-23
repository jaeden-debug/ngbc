import assert from "node:assert/strict";
import { test } from "node:test";
import { readSource } from "./transient-retry.ts";

/**
 * A retry must only ever ask the same question again. These pin the boundary
 * between "the service is unwell" (ask again) and "the request is wrong"
 * (fail), because blurring it would turn a real error into a slow one.
 */

const OPTIONS = { label: "layer:test", authority: "Test Authority", attempts: 3 } as const;
const ok = () => new Response("{}", { status: 200 });
const body = async (response: Response) => response.json() as Promise<unknown>;

function counting(responses: Array<() => Response>): { fetch: typeof fetch; calls: () => number } {
  let call = 0;
  return {
    fetch: (async () => responses[Math.min(call++, responses.length - 1)]())  as unknown as typeof fetch,
    calls: () => call,
  };
}

test("a 500 is the service's fault and is asked again", async () => {
  const { fetch, calls } = counting([() => new Response("", { status: 500 }), ok]);
  await readSource(fetch, "https://example.invalid", {}, OPTIONS, body);
  assert.equal(calls(), 2);
});

test("a 429 is asked again", async () => {
  const { fetch, calls } = counting([() => new Response("", { status: 429 }), ok]);
  await readSource(fetch, "https://example.invalid", {}, OPTIONS, body);
  assert.equal(calls(), 2);
});

test("a 404 is the request's fault and is never asked again", async () => {
  const { fetch, calls } = counting([() => new Response("", { status: 404 })]);
  await assert.rejects(
    readSource(fetch, "https://example.invalid", {}, OPTIONS, body),
    /Test Authority returned 404/,
  );
  assert.equal(calls(), 1, "a wrong request repeated is still wrong");
});

test("a 400 is only retried where the service is known to return it transiently", async () => {
  const plain = counting([() => new Response("", { status: 400 })]);
  await assert.rejects(readSource(plain.fetch, "https://example.invalid", {}, OPTIONS, body), /returned 400/);
  assert.equal(plain.calls(), 1);

  /* British Columbia's GeoServer, which measurably does. */
  const declared = counting([() => new Response("", { status: 400 }), ok]);
  await readSource(declared.fetch, "https://example.invalid", {}, { ...OPTIONS, alsoTransient: [400] }, body);
  assert.equal(declared.calls(), 2);
});

test("a service that stays unwell fails, rather than being retried forever", async () => {
  const { fetch, calls } = counting([() => new Response("", { status: 503 })]);
  await assert.rejects(readSource(fetch, "https://example.invalid", {}, OPTIONS, body), /returned 503/);
  assert.equal(calls(), OPTIONS.attempts);
});

test("a malformed body is not a transient fault and is not asked again", async () => {
  const { fetch, calls } = counting([ok]);
  await assert.rejects(
    readSource(fetch, "https://example.invalid", {}, OPTIONS, async () => { throw new Error("the layer reported an error"); }),
    /the layer reported an error/,
  );
  assert.equal(calls(), 1);
});

test("a transport failure is asked again", async () => {
  let call = 0;
  const fetcher = (async () => {
    call += 1;
    if (call === 1) throw new TypeError("fetch failed");
    return ok();
  }) as unknown as typeof fetch;
  await readSource(fetcher, "https://example.invalid", {}, OPTIONS, body);
  assert.equal(call, 2);
});
