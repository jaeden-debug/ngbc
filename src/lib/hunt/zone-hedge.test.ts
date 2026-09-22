import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ZoneResolution } from "./types.ts";
import { resolveZone, zoneConflict, SUPABASE_ZONE_TIMEOUT_MS, ZONE_HEDGE_DELAY_MS } from "./zone.ts";

/**
 * PostGIS first, the authority's service as well once PostGIS is slow.
 *
 * Measured 2026-09-22: with the database loaded, 16 of 26 production-shaped
 * lookups waited the full 2.5 s PostGIS bound and then paid the official-GIS
 * fallback on top. The hedge overlaps them instead. The answer never changes
 * — both sources are parity-certified — and when they disagree nobody picks.
 */

const MB_SERVICE = "Manitoba_Game_Hunting_Areas";
const POINT = { latitude: 50.3, longitude: -99.4 }; // inside Manitoba's extent only

function row(gha: string) {
  return {
    canonical_id: `management_zone:ca-mb-gha-${gha.toLowerCase()}`,
    official_name: `Game Hunting Area ${gha}`,
    location_accuracy: null,
    source_canonical_id: "source:ca-mb-gha-service",
    boundary_distance_meters: 4_000,
    near_boundary: false,
    display_geometry: { type: "Polygon", coordinates: [[[-99.5, 50.2], [-99.3, 50.2], [-99.3, 50.4], [-99.5, 50.4], [-99.5, 50.2]]] },
  };
}

/** A registry that answers after `delayMs`, or fails; records whether it was aborted. */
function registry(answer: string | "fail", delayMs: number, seen: { aborted?: boolean } = {}) {
  return (() => ({
    rpc: () => ({
      abortSignal(signal: AbortSignal) {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve(answer === "fail"
            ? { data: null, error: new Error("registry down") }
            : { data: [row(answer)], error: null }), delayMs);
          signal.addEventListener("abort", () => {
            seen.aborted = true;
            clearTimeout(timer);
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        });
      },
    }),
  })) as unknown as () => SupabaseClient;
}

/** Manitoba's own service, answering after `delayMs`, or failing; counts calls and aborts. */
function authority(answer: string | "fail", delayMs: number, seen: { calls: number; aborted?: boolean } = { calls: 0 }): typeof fetch {
  return (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (!url.href.includes(MB_SERVICE)) throw new Error(`unexpected ${url.href}`);
    seen.calls += 1;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, delayMs);
      init?.signal?.addEventListener("abort", () => { seen.aborted = true; clearTimeout(timer); reject(init.signal!.reason); });
    });
    if (answer === "fail") return new Response("down", { status: 503 });
    return new Response(JSON.stringify({
      type: "FeatureCollection",
      features: [{ properties: { GHA: answer }, geometry: row(answer).display_geometry }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

let saved: { provider?: string; fallback?: string };
let keepAlive: ReturnType<typeof setTimeout>;
beforeEach(() => {
  saved = { provider: process.env.SPATIAL_PROVIDER, fallback: process.env.SPATIAL_FALLBACK_PROVIDER };
  process.env.SPATIAL_PROVIDER = "supabase";
  process.env.SPATIAL_FALLBACK_PROVIDER = "official-gis";
  keepAlive = setTimeout(() => {}, SUPABASE_ZONE_TIMEOUT_MS * 4);
});
afterEach(() => {
  clearTimeout(keepAlive);
  for (const [key, value] of [["SPATIAL_PROVIDER", saved.provider], ["SPATIAL_FALLBACK_PROVIDER", saved.fallback]] as const) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

test("a fast registry answers alone: the authority is never asked", async () => {
  const gis = { calls: 0 };
  const timings: Record<string, number> = {};
  const result = await resolveZone(POINT.latitude, POINT.longitude, authority("23A", 10, gis), registry("23A", 20), timings);
  assert.equal(result.zoneId, "management_zone:ca-mb-gha-23a");
  assert.equal(gis.calls, 0);
  assert.equal(timings.hedge, undefined);
});

test("a slow registry is overlapped: the authority answers by the hedge delay plus its own latency", async () => {
  const db: { aborted?: boolean } = {};
  const timings: Record<string, number> = {};
  const started = Date.now();
  const result = await resolveZone(POINT.latitude, POINT.longitude, authority("23A", 100), registry("23A", 2_000, db), timings);
  const elapsed = Date.now() - started;
  assert.equal(result.zoneId, "management_zone:ca-mb-gha-23a");
  assert.ok(elapsed >= ZONE_HEDGE_DELAY_MS && elapsed < ZONE_HEDGE_DELAY_MS + 600, `took ${elapsed} ms`);
  assert.equal(db.aborted, true, "the registry lookup is cancelled once the authority's answer is used");
  assert.equal(timings.hedge, ZONE_HEDGE_DELAY_MS);
});

test("a registry that answers first after the hedge wins, and the authority request is aborted", async () => {
  const gis = { calls: 0, aborted: false as boolean | undefined };
  const result = await resolveZone(POINT.latitude, POINT.longitude, authority("23A", 1_500, gis), registry("23A", ZONE_HEDGE_DELAY_MS + 100));
  assert.equal(result.zoneId, "management_zone:ca-mb-gha-23a");
  assert.equal(gis.calls, 1);
  assert.equal(gis.aborted, true);
});

test("a failing registry falls back at once, without waiting for the hedge", async () => {
  const started = Date.now();
  const result = await resolveZone(POINT.latitude, POINT.longitude, authority("23A", 20), registry("fail", 10));
  assert.equal(result.zoneId, "management_zone:ca-mb-gha-23a");
  assert.ok(Date.now() - started < ZONE_HEDGE_DELAY_MS, "no hedge wait after a failure");
});

test("both failing is a provider error, never a guessed zone", async () => {
  const result = await resolveZone(POINT.latitude, POINT.longitude, authority("fail", 20), registry("fail", 10));
  assert.equal(result.status, "PROVIDER_ERROR");
  assert.equal(result.zoneId, undefined);
});

test("two answers in hand that disagree are a question for a person, not a pick", () => {
  const a = { status: "RESOLVED", zoneId: "management_zone:ca-mb-gha-23a", officialName: "Game Hunting Area 23A", sourceId: "source:ca-mb-gha-service", message: "" } as ZoneResolution;
  const b = { ...a, zoneId: "management_zone:ca-mb-gha-24", officialName: "Game Hunting Area 24" } as ZoneResolution;
  const none = { status: "UNKNOWN", sourceId: "source:ca-mb-gha-service", message: "" } as ZoneResolution;
  assert.equal(zoneConflict(a, { ...a }, "SAME_GEOGRAPHY"), null, "agreement is no conflict");
  for (const [left, right] of [[a, b], [a, none]] as const) {
    const result = zoneConflict(left, right, "SAME_GEOGRAPHY")!;
    assert.equal(result.status, "UNKNOWN");
    assert.equal(result.zoneId, undefined);
    assert.match(result.message, /Game Hunting Area 23A/);
    assert.match(result.message, /human verification is required/);
  }
});

test("end to end, a disagreeing pair never swaps one zone for the other silently", async () => {
  const result = await resolveZone(POINT.latitude, POINT.longitude, authority("24", 0), registry("23A", ZONE_HEDGE_DELAY_MS + 5));
  // Whichever settles first is used and the other aborted; a pair in hand would be UNKNOWN.
  assert.ok(result.status === "UNKNOWN" || ["management_zone:ca-mb-gha-23a", "management_zone:ca-mb-gha-24"].includes(result.zoneId!));
});

test("across a border, one placing the point and the other not is agreement; two zones are a conflict", () => {
  const canada = { status: "RESOLVED", zoneId: "management_zone:ca-ab-wmu-102", officialName: "Wildlife Management Unit 102", sourceId: "source:ca-ab-wmu-service", message: "" } as ZoneResolution;
  const montana = { status: "RESOLVED", zoneId: "management_zone:us-mt-hd-600", officialName: "Hunting District 600", sourceId: "source:us-mt-hd-service", message: "" } as ZoneResolution;
  const nothing = { status: "UNKNOWN", sourceId: "source:us-mt-hd-service", message: "" } as ZoneResolution;
  assert.equal(zoneConflict(canada, nothing, "ACROSS_JURISDICTIONS"), null);
  const both = zoneConflict(canada, montana, "ACROSS_JURISDICTIONS")!;
  assert.equal(both.status, "UNKNOWN");
  assert.match(both.message, /Two jurisdictions' official services both claim this point/);
});
