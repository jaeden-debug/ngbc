import assert from "node:assert/strict";
import test from "node:test";
import { clearUnitedStatesStateCache, unitedStatesStateAt, US_STATE_TIMEOUT_MS } from "./state-boundary.ts";

/** The Census service, stubbed; nothing here reaches the network. */
function census(features: Array<{ NAME: string; STUSAB: string }>, options: { status?: number } = {}) {
  const calls: string[] = [];
  const fetcher = (async (input: string | URL | Request) => {
    calls.push(String(input));
    if (options.status && options.status !== 200) return new Response("no", { status: options.status });
    return Response.json({ features: features.map((attributes) => ({ attributes })) });
  }) as typeof fetch;
  return { fetcher, calls };
}

test("a point the Bureau places in a state becomes that state's jurisdiction", async () => {
  clearUnitedStatesStateCache();
  const { fetcher, calls } = census([{ NAME: "Montana", STUSAB: "MT" }]);
  assert.deepEqual(await unitedStatesStateAt(47.6005, -114.1188, fetcher), {
    jurisdictionId: "jurisdiction:us-mt", name: "Montana", code: "MT",
  });
  // Asked once: the answer is cached, and a second caller shares one request.
  await Promise.all([unitedStatesStateAt(47.6005, -114.1188, fetcher), unitedStatesStateAt(47.6005, -114.1188, fetcher)]);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /returnGeometry=false/, "geometry is never downloaded");
});

test("outside the United States there is no state, and that answer is kept", async () => {
  clearUnitedStatesStateCache();
  const { fetcher, calls } = census([]);
  assert.equal(await unitedStatesStateAt(49.5097, -115.7688, fetcher), undefined, "Cranbrook, B.C.");
  await unitedStatesStateAt(49.5097, -115.7688, fetcher);
  assert.equal(calls.length, 1);
});

test("an outage, a malformed answer or two states are never a guess, and an outage is asked again", async () => {
  clearUnitedStatesStateCache();
  const failing = census([], { status: 503 });
  assert.equal(await unitedStatesStateAt(47.6, -114.1, failing.fetcher), undefined);
  assert.equal(await unitedStatesStateAt(47.6, -114.1, failing.fetcher), undefined);
  assert.equal(failing.calls.length, 2, "a failure is not remembered");

  clearUnitedStatesStateCache();
  const two = census([{ NAME: "Montana", STUSAB: "MT" }, { NAME: "Idaho", STUSAB: "ID" }]);
  assert.equal(await unitedStatesStateAt(47.6, -114.1, two.fetcher), undefined, "two states at one point is a question, not a pick");

  clearUnitedStatesStateCache();
  const malformed = census([{ NAME: "Montana", STUSAB: "MONTANA" } as never]);
  assert.equal(await unitedStatesStateAt(47.6, -114.1, malformed.fetcher), undefined);
});

test(`a service that does not answer is abandoned at ${US_STATE_TIMEOUT_MS} ms`, async () => {
  clearUnitedStatesStateCache();
  const fetcher = ((_input: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    const socket = setTimeout(() => undefined, 60_000);
    init?.signal?.addEventListener("abort", () => { clearTimeout(socket); reject(init.signal!.reason); });
  })) as typeof fetch;
  const started = performance.now();
  assert.equal(await unitedStatesStateAt(47.6, -114.1, fetcher), undefined);
  const elapsed = performance.now() - started;
  assert.ok(elapsed >= US_STATE_TIMEOUT_MS - 50 && elapsed < US_STATE_TIMEOUT_MS + 1_000, `${Math.round(elapsed)} ms`);
});

test("an impossible coordinate is never sent to the Bureau", async () => {
  clearUnitedStatesStateCache();
  const { fetcher, calls } = census([{ NAME: "Montana", STUSAB: "MT" }]);
  assert.equal(await unitedStatesStateAt(95, -114, fetcher), undefined);
  assert.equal(await unitedStatesStateAt(Number.NaN, -114, fetcher), undefined);
  assert.equal(calls.length, 0);
});
