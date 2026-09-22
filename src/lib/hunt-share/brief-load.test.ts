import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getHuntBrief } from "./service.ts";
import { InMemoryHuntBriefStore, type HuntBriefStore } from "./store.ts";
import { huntBriefFixture } from "./test-fixture.ts";

/**
 * The brief page's own lookup is bounded, as the proxy's existence check is.
 * During the 2026-09-21 outage each storage call took ~20 s to fail, so the
 * page held a reader at a blank screen that long before "temporarily
 * unavailable". A timeout throws; the page maps a throw to "unavailable",
 * never to "missing".
 */
const brief = huntBriefFixture();

describe("the brief page's lookup is bounded", () => {
  it("fails within the bound when storage never answers, even ignoring the signal", async () => {
    const hangs = { get: () => new Promise(() => {}) } as unknown as HuntBriefStore;
    const started = Date.now();
    await assert.rejects(getHuntBrief(brief.shareId, hangs, { timeoutMs: 50 }), /timed out/);
    assert.ok(Date.now() - started < 1000);
  });

  it("cancels the request for a store that honours the signal", async () => {
    let seen: AbortSignal | undefined;
    const honours = {
      get: (_id: string, options?: { signal?: AbortSignal }) => {
        seen = options?.signal;
        return new Promise((_, reject) => options?.signal?.addEventListener("abort", () => reject(options.signal!.reason)));
      },
    } as unknown as HuntBriefStore;
    await assert.rejects(getHuntBrief(brief.shareId, honours, { timeoutMs: 50 }));
    assert.equal(seen?.aborted, true);
  });

  it("a timely answer is unchanged: found, missing and malformed", async () => {
    const store = new InMemoryHuntBriefStore();
    await store.create(brief);
    assert.equal((await getHuntBrief(brief.shareId, store)).status, "found");
    assert.equal((await getHuntBrief("hb_doesNotExist000000000", store)).status, "missing");
    assert.equal((await getHuntBrief("bad", store)).status, "invalid_id");
  });
});
