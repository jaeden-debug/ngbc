import assert from "node:assert/strict";
import test from "node:test";
import type { PlaceSuggestion } from "./location.ts";
import {
  describeCoordinate,
  resolveGooglePlace,
  resolvePlace,
  suggestGooglePlaces,
  suggestNominatimPlaces,
  suggestPlaces,
} from "./location.ts";
import { createLocationHandler } from "./location-handler.ts";
import { createRateLimiter } from "../newsletter/rate-limit.ts";

/**
 * Location providers are stubbed rather than called. These assert the mapping, the
 * failure behaviour and the request shape — including the Google session token,
 * which is what keeps autocomplete billed per search rather than per keystroke.
 */

const CANONICAL_ORIGIN = "https://www.northgroundbushcraft.com";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function recordingFetcher(body: unknown, status = 200) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return Promise.resolve(jsonResponse(body, status));
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

/* ── Google Places ───────────────────────────────────────────────────────── */

const googleAutocompleteBody = {
  suggestions: [
    {
      placePrediction: {
        placeId: "ChIJPembroke",
        text: { text: "Pembroke, ON, Canada" },
        structuredFormat: { mainText: { text: "Pembroke" }, secondaryText: { text: "ON, Canada" } },
      },
    },
    {
      placePrediction: {
        placeId: "ChIJAlgonquin",
        text: { text: "Algonquin Provincial Park, ON, Canada" },
        structuredFormat: { mainText: { text: "Algonquin Provincial Park" }, secondaryText: { text: "ON, Canada" } },
      },
    },
  ],
};

test("Google suggestions map to primary and secondary place text", async () => {
  const { fetcher } = recordingFetcher(googleAutocompleteBody);
  const result = await suggestGooglePlaces("pembro", { fetcher, googleApiKey: "test-key" });

  assert.equal(result.status, "OK");
  const suggestions: PlaceSuggestion[] = result.suggestions;

  // Google predictions carry no coordinate; resolving is a separate, billed step.
  assert.ok(suggestions.every((suggestion) => suggestion.latitude === undefined));
  assert.deepEqual(suggestions, [
    { id: "ChIJPembroke", primary: "Pembroke", secondary: "ON, Canada" },
    { id: "ChIJAlgonquin", primary: "Algonquin Provincial Park", secondary: "ON, Canada" },
  ]);
});

test("Google autocomplete sends the session token and never puts the key in the URL", async () => {
  const { fetcher, calls } = recordingFetcher(googleAutocompleteBody);
  await suggestGooglePlaces("pembro", { fetcher, googleApiKey: "secret-key", sessionToken: "session-token-1234" });

  assert.equal(calls.length, 1);
  assert.ok(!calls[0].url.includes("secret-key"), "server key must not appear in a URL");
  const headers = new Headers(calls[0].init?.headers);
  assert.equal(headers.get("X-Goog-Api-Key"), "secret-key");
  assert.equal(JSON.parse(String(calls[0].init?.body)).sessionToken, "session-token-1234");
});

test("Google place resolution returns a label and coordinate, closing the session", async () => {
  const { fetcher, calls } = recordingFetcher({
    displayName: { text: "Pembroke" },
    shortFormattedAddress: "Pembroke, ON",
    formattedAddress: "Pembroke, ON K8A 1J4, Canada",
    location: { latitude: 45.8267, longitude: -77.1119 },
  });

  const result = await resolveGooglePlace("ChIJPembroke", {
    fetcher, googleApiKey: "test-key", sessionToken: "session-token-1234",
  });

  assert.equal(result.status, "OK");
  assert.deepEqual(result.status === "OK" ? result.place : null, {
    label: "Pembroke, ON", latitude: 45.8267, longitude: -77.1119, provider: "google",
  });
  assert.ok(calls[0].url.includes("sessionToken=session-token-1234"), "the session token must close the autocomplete session");
});

test("Google place resolution refuses a place with no usable coordinate", async () => {
  const { fetcher } = recordingFetcher({ displayName: { text: "Nowhere" } });
  const result = await resolveGooglePlace("ChIJNowhere", { fetcher, googleApiKey: "test-key" });
  assert.equal(result.status, "NOT_FOUND");
});

test("Google providers report an explicit unconfigured state rather than failing silently", async () => {
  const suggestion = await suggestGooglePlaces("pembroke", { googleApiKey: "" });
  assert.equal(suggestion.status, "NOT_CONFIGURED");
  assert.deepEqual(suggestion.suggestions, []);

  const resolution = await resolveGooglePlace("ChIJPembroke", { googleApiKey: "" });
  assert.equal(resolution.status, "NOT_CONFIGURED");
});

test("a Google HTTP failure is reported as a provider error, not as no results", async () => {
  const { fetcher } = recordingFetcher({ error: { message: "quota" } }, 429);
  const result = await suggestGooglePlaces("pembroke", { fetcher, googleApiKey: "test-key" });
  assert.equal(result.status, "PROVIDER_ERROR");
});

/* ── Nominatim ───────────────────────────────────────────────────────────── */

test("Nominatim suggestions carry their coordinate inline", async () => {
  const { fetcher } = recordingFetcher([
    {
      place_id: 123,
      lat: "45.8267",
      lon: "-77.1119",
      name: "Pembroke",
      display_name: "Pembroke, Renfrew County, Ontario, Canada",
      address: { city: "Pembroke", state: "Ontario" },
    },
  ]);

  const result = await suggestNominatimPlaces("pembroke", { fetcher });
  assert.equal(result.status, "OK");
  assert.equal(result.suggestions[0].primary, "Pembroke");
  assert.equal(result.suggestions[0].latitude, 45.8267);
  assert.equal(result.suggestions[0].longitude, -77.1119);
});

test("Nominatim discards a suggestion with an unusable coordinate", async () => {
  const { fetcher } = recordingFetcher([{ place_id: 1, lat: "not-a-number", lon: "-77.1", display_name: "Broken" }]);
  const result = await suggestNominatimPlaces("broken", { fetcher });
  assert.equal(result.status, "EMPTY");
});

/* ── Provider selection and fallback ─────────────────────────────────────── */

test("a Google outage falls back to Nominatim without changing the answer shape", async () => {
  let call = 0;
  const fetcher = ((input: RequestInfo | URL) => {
    call += 1;
    if (String(input).includes("googleapis")) return Promise.resolve(jsonResponse({ error: "down" }, 500));
    return Promise.resolve(jsonResponse([
      { place_id: 9, lat: "45.23", lon: "-77.94", name: "Bancroft", display_name: "Bancroft, Ontario, Canada" },
    ]));
  }) as unknown as typeof fetch;

  const result = await suggestPlaces("bancroft", { fetcher, provider: "google", googleApiKey: "test-key" });
  assert.equal(call, 2, "the fallback provider must actually be consulted");
  assert.equal(result.status, "OK");
  assert.equal(result.provider, "nominatim");
  assert.equal(result.suggestions[0].primary, "Bancroft");
});

test("an empty Google result is not treated as an outage", async () => {
  let nominatimCalled = false;
  const fetcher = ((input: RequestInfo | URL) => {
    if (String(input).includes("googleapis")) return Promise.resolve(jsonResponse({ suggestions: [] }));
    nominatimCalled = true;
    return Promise.resolve(jsonResponse([]));
  }) as unknown as typeof fetch;

  const result = await suggestPlaces("zzzzzz", { fetcher, provider: "google", googleApiKey: "test-key" });
  assert.equal(result.status, "EMPTY");
  assert.equal(nominatimCalled, false, "no results is a real answer and must not trigger a fallback request");
});

test("a query shorter than two characters never reaches a provider", async () => {
  let called = false;
  const fetcher = (() => { called = true; return Promise.resolve(jsonResponse([])); }) as unknown as typeof fetch;
  const result = await suggestPlaces("p", { fetcher, provider: "nominatim" });
  assert.equal(result.status, "EMPTY");
  assert.equal(called, false);
});

test("a Nominatim suggestion is not sent back for a second resolve round-trip", async () => {
  const result = await resolvePlace("nominatim:123", { provider: "nominatim" });
  assert.equal(result.status, "NOT_FOUND");
});

test("reverse geocoding turns a device coordinate into a place label", async () => {
  const { fetcher } = recordingFetcher({ display_name: "Bancroft, Hastings County, Ontario, Canada" });
  const result = await describeCoordinate(45.23, -77.94, { fetcher, provider: "nominatim" });
  assert.equal(result.status, "OK");
  assert.equal(result.status === "OK" ? result.place.label : "", "Bancroft, Hastings County, Ontario, Canada");
});

test("a coordinate with no nearby named place is NOT_FOUND rather than an error", async () => {
  const { fetcher } = recordingFetcher({ error: "Unable to geocode" });
  const result = await describeCoordinate(52.5, -88.1, { fetcher, provider: "nominatim" });
  assert.equal(result.status, "NOT_FOUND");
});

/* ── HTTP handler ────────────────────────────────────────────────────────── */

function handler(overrides: Partial<Parameters<typeof createLocationHandler>[0]> = {}) {
  return createLocationHandler({
    limiter: createRateLimiter({ limit: 50, windowMs: 60_000 }),
    canonicalOrigin: CANONICAL_ORIGIN,
    suggest: async () => ({ status: "OK", suggestions: [{ id: "p1", primary: "Pembroke", secondary: "ON" }], provider: "google" }),
    resolve: async () => ({ status: "OK", place: { label: "Pembroke, ON", latitude: 45.8267, longitude: -77.1119, provider: "google" } }),
    describe: async () => ({ status: "OK", place: { label: "Bancroft, ON", latitude: 45.23, longitude: -77.94, provider: "google" } }),
    ...overrides,
  });
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  const payload = JSON.stringify(body);
  return new Request("https://www.northgroundbushcraft.com/api/hunt/location", {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": String(payload.length), ...headers },
    body: payload,
  });
}

test("location endpoint returns suggestions and is never cached", async () => {
  const response = await handler()(post({ action: "suggest", query: "pembro" }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const payload = await response.json() as { status: string; suggestions: unknown[] };
  assert.equal(payload.status, "OK");
  assert.equal(payload.suggestions.length, 1);
});

test("location endpoint resolves a place and describes a coordinate", async () => {
  const resolved = await handler()(post({ action: "resolve", placeId: "p1", sessionToken: "session-token-1234" }));
  assert.equal((await resolved.json() as { place: { latitude: number } }).place.latitude, 45.8267);

  const described = await handler()(post({ action: "describe", latitude: 45.23, longitude: -77.94 }));
  assert.equal((await described.json() as { place: { label: string } }).place.label, "Bancroft, ON");
});

test("location endpoint rejects a cross-origin request", async () => {
  const response = await handler()(post({ action: "suggest", query: "pembro" }, { origin: "https://evil.example" }));
  assert.equal(response.status, 403);
});

test("location endpoint rejects a non-JSON content type and an oversized body", async () => {
  const wrongType = await handler()(
    new Request("https://www.northgroundbushcraft.com/api/hunt/location", {
      method: "POST", headers: { "content-type": "text/plain" }, body: "hello",
    }),
  );
  assert.equal(wrongType.status, 415);

  const oversized = await handler()(post({ action: "suggest", query: "x".repeat(4_000) }));
  assert.equal(oversized.status, 413);
});

test("location endpoint rejects malformed actions, queries and session tokens", async () => {
  for (const body of [
    { action: "unknown", query: "pembroke" },
    { action: "suggest" },
    { action: "suggest", query: "   " },
    { action: "resolve" },
    { action: "describe", latitude: 999, longitude: -77.94 },
    { action: "describe", latitude: 45.23, longitude: "west" },
    { action: "suggest", query: "pembroke", sessionToken: "not a valid token!" },
  ]) {
    const response = await handler()(post(body));
    assert.equal(response.status, 400, `expected 400 for ${JSON.stringify(body)}`);
  }
});

test("location endpoint rate limits and reports a retry window", async () => {
  const limited = createLocationHandler({
    limiter: createRateLimiter({ limit: 1, windowMs: 60_000 }),
    canonicalOrigin: CANONICAL_ORIGIN,
    suggest: async () => ({ status: "EMPTY", suggestions: [], provider: "nominatim" }),
  });
  assert.equal((await limited(post({ action: "suggest", query: "one" }))).status, 200);
  const second = await limited(post({ action: "suggest", query: "two" }));
  assert.equal(second.status, 429);
  assert.ok(Number(second.headers.get("retry-after")) > 0);
});

test("an unavailable place provider degrades to an explicit state, not an HTTP failure", async () => {
  const degraded = handler({
    suggest: async () => ({ status: "PROVIDER_ERROR", suggestions: [], provider: "google", message: "Google place search is temporarily unavailable." }),
  });
  const response = await degraded(post({ action: "suggest", query: "pembro" }));

  // The Hunt page must stay usable — a device location still works — so this is a
  // 200 carrying an explicit state rather than a 5xx that breaks the composer.
  assert.equal(response.status, 200);
  const payload = await response.json() as { status: string; suggestions: unknown[]; message: string };
  assert.equal(payload.status, "PROVIDER_ERROR");
  assert.deepEqual(payload.suggestions, []);
  assert.match(payload.message, /temporarily unavailable/i);
});
