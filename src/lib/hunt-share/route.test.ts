import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideShareRoute } from "./route.ts";
import { InMemoryHuntBriefStore, type HuntBriefStore } from "./store.ts";

const VALID = "abcdefghijklmnopqrstuv"; // 22 characters, the shortest valid ID

function storeWith(...ids: string[]): HuntBriefStore {
  const store = new InMemoryHuntBriefStore();
  for (const id of ids) store.values.set(id, { shareId: id });
  return store;
}

describe("deciding a Hunt Brief URL before the page renders", () => {
  it("renders a brief that exists", async () => {
    assert.equal(await decideShareRoute(VALID, () => storeWith(VALID)), "render");
  });

  it("answers not found for a well-formed ID that names no brief", async () => {
    // The realistic broken link: copied correctly, but the brief is gone.
    assert.equal(await decideShareRoute(VALID, () => storeWith()), "not_found");
  });

  it("answers not found for a malformed ID without asking storage", async () => {
    let asked = false;
    const spy: HuntBriefStore = {
      ...storeWith(),
      async exists() { asked = true; return true; },
    };
    assert.equal(await decideShareRoute("too-short", () => spy), "not_found");
    assert.equal(await decideShareRoute("has spaces in it!!!!!!!!", () => spy), "not_found");
    assert.equal(asked, false, "a malformed ID cannot name a brief, so storage is not consulted");
  });

  it("never turns a storage outage into a 404", async () => {
    // "This brief does not exist" is false while storage is down. The page
    // says "temporarily unavailable" instead, which invites a retry.
    const failing: HuntBriefStore = {
      ...storeWith(),
      async exists() { throw new Error("connection reset"); },
    };
    assert.equal(await decideShareRoute(VALID, () => failing), "render");
  });

  it("never turns missing configuration into a 404 either", async () => {
    const unconfigured = () => { throw new Error("Hunt Brief persistence is not configured"); };
    assert.equal(await decideShareRoute(VALID, unconfigured), "render");
  });

  it("does not build the store at all for a malformed ID", async () => {
    let built = false;
    await decideShareRoute("nope", () => { built = true; return storeWith(); });
    assert.equal(built, false);
  });
});

describe("a slow store never holds the reader at a blank page", () => {
  // Measured on 2026-09-21: storage failing with Cloudflare 522 after 19–25
  // seconds per call. Unbounded, the proxy waited that long before any
  // response began, and then the page waited it again.
  const hangs = (): HuntBriefStore => ({
    ...storeWith(),
    exists: () => new Promise<boolean>(() => {}), // never settles
  });

  it("answers render within the bound when storage never responds", async () => {
    const started = Date.now();
    const decision = await decideShareRoute(VALID, hangs, { timeoutMs: 50 });
    const elapsed = Date.now() - started;
    assert.equal(decision, "render", "a slow answer is not evidence the brief is gone");
    assert.ok(elapsed < 1000, `returned after ${elapsed} ms; it must not wait on storage`);
  });

  it("returns on time even from a store that ignores the signal", async () => {
    // The race, not the signal, is what guarantees the deadline.
    const started = Date.now();
    await decideShareRoute(VALID, hangs, { timeoutMs: 50 });
    assert.ok(Date.now() - started < 1000);
  });

  it("cancels the request itself for a store that honours the signal", async () => {
    let seen: AbortSignal | undefined;
    const honours: HuntBriefStore = {
      ...storeWith(),
      exists: (_id, options) => {
        seen = options?.signal;
        return new Promise<boolean>((_, reject) => {
          options?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        });
      },
    };
    assert.equal(await decideShareRoute(VALID, () => honours, { timeoutMs: 50 }), "render");
    assert.ok(seen, "the store must be handed a signal");
    assert.equal(seen?.aborted, true, "and the lookup behind it must actually be cancelled");
  });

  it("still answers not found from a store that replies inside the bound", async () => {
    const quick: HuntBriefStore = {
      ...storeWith(),
      exists: () => new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5)),
    };
    assert.equal(await decideShareRoute(VALID, () => quick, { timeoutMs: 200 }), "not_found");
  });

  it("uses a production bound far above a healthy lookup and far below an outage", async () => {
    const { EXISTENCE_CHECK_TIMEOUT_MS } = await import("./route.ts");
    assert.ok(EXISTENCE_CHECK_TIMEOUT_MS >= 1000, "a healthy indexed read must never be cut off");
    assert.ok(EXISTENCE_CHECK_TIMEOUT_MS <= 3000, "an outage must not hold the reader at a blank screen");
  });
});
