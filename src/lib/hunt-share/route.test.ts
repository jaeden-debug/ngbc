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
