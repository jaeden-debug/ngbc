import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "./route.ts";

/**
 * WHAT THE ZONE ENDPOINT DOES TODAY, captured before it is refactored.
 *
 * This route is 126 lines and nothing executed it. `zone-response.test.ts`
 * reads it as TEXT to assert a string is absent; no test had ever called
 * `POST`. So the six-way composition it performs — jurisdiction-scoped,
 * unsupported US state, unresolved, not-serving, no-geography, resolved — was
 * carried entirely by a route with no behavioural coverage.
 *
 * These are CHARACTERIZATION tests: they assert what the endpoint does now,
 * right or wrong, so that extracting the composition into the domain can be
 * shown to change nothing. A refactor whose only evidence is "the suite still
 * passes" proves nothing when the suite never ran the thing.
 *
 * Only the branches that need no network are here. The resolver-backed ones are
 * covered against the extracted domain function, where the dependency can be
 * injected instead of stubbed globally.
 */

const ORIGIN = "https://www.northgroundbushcraft.com";

function request(body: unknown, init: { origin?: string; contentType?: string | null; raw?: string } = {}) {
  const headers = new Headers();
  if (init.contentType !== null) headers.set("content-type", init.contentType ?? "application/json");
  if (init.origin) headers.set("origin", init.origin);
  return new Request(`${ORIGIN}/api/hunt/zone`, {
    method: "POST",
    headers,
    body: init.raw ?? JSON.stringify(body),
  });
}

test("a cross-origin request is refused before anything is parsed", async () => {
  const response = await POST(request({ latitude: 45, longitude: -75 }, { origin: "https://example.com" }));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).status, "ERROR");
});

test("a non-JSON content type is refused", async () => {
  const response = await POST(request({ latitude: 45, longitude: -75 }, { contentType: "text/plain" }));
  assert.equal(response.status, 415);
});

test("a body that is not JSON is refused as unreadable rather than guessed at", async () => {
  const response = await POST(request(undefined, { raw: "{not json" }));
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /valid JSON/);
});

test("an oversized body is refused without being parsed", async () => {
  const response = await POST(request(undefined, { raw: JSON.stringify({ latitude: 45, longitude: -75, pad: "x".repeat(600) }) }));
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /could not be read/);
});

test("a missing or non-numeric coordinate is refused", async () => {
  for (const body of [{}, { latitude: 45 }, { latitude: "45", longitude: -75 }, { latitude: Number.NaN, longitude: -75 }]) {
    const response = await POST(request(body));
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.match((await response.json()).message, /numeric latitude and longitude/);
  }
});

test("a number that is not a coordinate is refused as a coordinate, not as uncovered ground", async () => {
  /*
   * The distinction this route already makes and must keep: latitude 999 is not
   * a place North Ground has no boundaries for, it is not a place. Answering
   * UNSUPPORTED there would be a statement about coverage where none applies.
   */
  const response = await POST(request({ latitude: 999, longitude: -75 }));
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.message, /between -90 and 90/);
  assert.notEqual(body.status, "UNSUPPORTED");
});

test("includeGeometry must be a boolean when present", async () => {
  const response = await POST(request({ latitude: 45, longitude: -75, includeGeometry: "yes" }));
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /includeGeometry/);
});

test("ground North Ground draws no boundaries for says so as coverage, not as a hunting statement", async () => {
  /* Mid-Atlantic: outside every served layer's bounds, and no US state. */
  const response = await POST(request({ latitude: 30, longitude: -40 }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "UNSUPPORTED");
  assert.match(body.message, /gap in our coverage, not a statement about hunting/);
});
