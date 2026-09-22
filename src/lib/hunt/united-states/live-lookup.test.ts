import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LIVE_ZONE_TIMEOUT_MS, resolveLayerFromOfficialGis, resolveZone } from "../zone.ts";
import { layerById } from "../zone-layers.ts";

/**
 * A live state service is asked cheaply and never slows a Canadian answer.
 * Every service here is a stub; nothing reaches the network.
 */

const IDAHO = layerById("layer:us-id-gmu")!;
const MONTANA = layerById("layer:us-mt-deer-elk-hd")!;

function stateService(options: { designation?: string; fail?: boolean } = {}) {
  const calls: string[] = [];
  const fetcher = (async (input: string | URL | Request) => {
    calls.push(String(input));
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (options.fail) return new Response("unavailable", { status: 503 });
    const ring = [[-116.1, 46.1], [-115.9, 46.1], [-115.9, 46.3], [-116.1, 46.3], [-116.1, 46.1]];
    return Response.json({
      type: "FeatureCollection",
      features: [{ properties: { NAME: options.designation ?? "10A", DISTRICT: options.designation ?? "310" }, geometry: { type: "Polygon", coordinates: [ring] } }],
    });
  }) as typeof fetch;
  return { fetcher, calls };
}

/** A service that never answers, but honours its abort signal as fetch does. */
function hangingService() {
  let asked = 0;
  const fetcher = ((_input: string | URL | Request, init?: RequestInit) => {
    asked += 1;
    return new Promise<Response>((_resolve, reject) => {
      // An open request keeps the process alive, as a real socket would.
      const socket = setTimeout(() => undefined, 60_000);
      init?.signal?.addEventListener("abort", () => { clearTimeout(socket); reject(init.signal!.reason); });
    });
  }) as typeof fetch;
  return { fetcher, asked: () => asked };
}

test("concurrent lookups of one point share one request, and a repeat is answered from the cache", async () => {
  const { fetcher, calls } = stateService();
  const answers = await Promise.all([1, 2, 3].map(() => resolveLayerFromOfficialGis(IDAHO, 46.2, -116.0, fetcher)));
  assert.equal(calls.length, 1, "three callers, one request");
  assert.ok(answers.every((answer) => answer.zoneId === "management_zone:us-id-gmu-10a"));
  await resolveLayerFromOfficialGis(IDAHO, 46.2, -116.0, fetcher);
  assert.equal(calls.length, 1, "the repeat is cached");
  // A different point, or a different layer at the same point, is its own question.
  await resolveLayerFromOfficialGis(IDAHO, 46.2000011, -116.0, fetcher);
  await resolveLayerFromOfficialGis(MONTANA, 46.2, -116.0, fetcher);
  assert.equal(calls.length, 3);
});

test("a provider failure is not remembered: the next lookup asks again", async () => {
  const { fetcher, calls } = stateService({ fail: true });
  assert.equal((await resolveLayerFromOfficialGis(IDAHO, 46.2, -116.0, fetcher)).status, "PROVIDER_ERROR");
  assert.equal((await resolveLayerFromOfficialGis(IDAHO, 46.2, -116.0, fetcher)).status, "PROVIDER_ERROR");
  assert.equal(calls.length, 2);
});

test(`a live service that does not answer is abandoned at ${LIVE_ZONE_TIMEOUT_MS} ms as a provider error, never as "no zone"`, async () => {
  const { fetcher } = hangingService();
  const started = performance.now();
  const result = await resolveLayerFromOfficialGis(IDAHO, 46.2, -116.0, fetcher);
  const elapsed = performance.now() - started;
  assert.equal(result.status, "PROVIDER_ERROR");
  assert.ok(elapsed >= LIVE_ZONE_TIMEOUT_MS - 50 && elapsed < LIVE_ZONE_TIMEOUT_MS + 1_000, `${Math.round(elapsed)} ms`);
});

/* At the 49th parallel Alberta's extent and Montana's overlap. */
const BORDER = { latitude: 49.005, longitude: -112.0 };

function registry(boundaryDistanceMeters: number) {
  return (() => ({
    rpc: () => ({
      abortSignal: async () => ({
        data: [{
          canonical_id: "management_zone:ca-ab-wmu-102", official_name: "Wildlife Management Unit 102", location_accuracy: null,
          source_canonical_id: "source:ca-ab-wmu-service", boundary_distance_meters: boundaryDistanceMeters,
          near_boundary: boundaryDistanceMeters <= 150, display_geometry: { type: "Polygon", coordinates: [] },
        }],
        error: null,
      }),
    }),
  })) as unknown as () => SupabaseClient;
}

async function withMontanaServed<T>(run: () => Promise<T>): Promise<T> {
  const served = MONTANA.serving;
  const provider = process.env.SPATIAL_PROVIDER;
  MONTANA.serving = true;
  process.env.SPATIAL_PROVIDER = "supabase";
  try {
    return await run();
  } finally {
    MONTANA.serving = served;
    if (provider === undefined) delete process.env.SPATIAL_PROVIDER; else process.env.SPATIAL_PROVIDER = provider;
  }
}

test("a Canadian point well inside its zone never waits on a U.S. live service, even where the extents overlap", async () => {
  await withMontanaServed(async () => {
    const { fetcher } = hangingService();
    const started = performance.now();
    const result = await resolveZone(BORDER.latitude, BORDER.longitude, fetcher, registry(4_000));
    const elapsed = performance.now() - started;
    assert.equal(result.zoneId, "management_zone:ca-ab-wmu-102");
    assert.ok(elapsed < 250, `answered in ${Math.round(elapsed)} ms while Montana's service hung`);
  });
});

test("near the border both authorities are heard, and two zones are a conflict, never a choice", async () => {
  await withMontanaServed(async () => {
    const { fetcher } = stateService({ designation: "400" });
    const result = await resolveZone(BORDER.latitude, BORDER.longitude, fetcher, registry(40));
    assert.equal(result.status, "UNKNOWN");
    assert.match(result.message, /both claim this point/);
  });
});

test("a U.S. point outside every Canadian extent never asks the Canadian registry", async () => {
  await withMontanaServed(async () => {
    let registryAsked = false;
    const client = (() => { registryAsked = true; throw new Error("the registry must not be asked"); }) as unknown as () => SupabaseClient;
    const result = await resolveZone(46.6, -110.9, stateService({ designation: "400" }).fetcher, client);
    assert.equal(result.zoneId, "management_zone:us-mt-hd-400");
    assert.equal(registryAsked, false);
  });
});
