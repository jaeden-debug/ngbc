import { legalTimeSummary } from "../hunt/regulatory/legal-time.ts";
import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateHunt } from "./evaluate.ts";
import { clearOverlayCache } from "./overlays.ts";
import type { HuntInput, ZoneResolution } from "./types.ts";
import { resolveZone, resolveZoneFromOfficialGis, SUPABASE_ZONE_TIMEOUT_MS, ZONE_HEDGE_DELAY_MS } from "./zone.ts";
import { layerById } from "./zone-layers.ts";

/**
 * Manitoba through Hunt's real evaluation path, with every authority faked.
 *
 * The zone resolver, the overlay layers and the weather provider are
 * deterministic stand-ins; the rules are the committed Manitoba bundle. These
 * tests prove the wiring — routing by the zone's own jurisdiction, overlays
 * reaching the answer, outages reaching the answer — not the law, which
 * `regulatory/manitoba.test.ts` covers.
 */

const MB_SERVICE = "Manitoba_Game_Hunting_Areas";
const ON_SERVICE = "LIO_Open05";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

/** Overlay layers answer with the object ids given per layer key. */
function overlayFetch(hits: { closed?: number[]; refuges?: number[]; scas?: number[]; wmas?: number[] } = {}, fail = false): typeof fetch {
  return (async (input: string | URL) => {
    const url = String(input);
    if (fail) throw new Error("overlay outage");
    const layer = url.includes("Lands_Closed_to_Hunting") ? "closed"
      : url.includes("Manitoba_Wildlife_Lands/FeatureServer/0") ? "refuges"
      : url.includes("Manitoba_Wildlife_Lands/FeatureServer/1") ? "scas"
      : url.includes("Manitoba_Wildlife_Lands/FeatureServer/2") ? "wmas" : null;
    if (!layer) throw new Error(`unexpected request ${url}`);
    return jsonResponse({ features: (hits[layer as keyof typeof hits] ?? []).map((id) => ({ attributes: { OBJECTID: id } })) });
  }) as typeof fetch;
}

function manitobaZone(gha: string): ZoneResolution {
  return {
    status: "RESOLVED",
    zoneId: `management_zone:ca-mb-gha-${gha.toLowerCase()}` as ZoneResolution["zoneId"],
    jurisdictionId: "jurisdiction:ca-mb",
    officialName: `Game Hunting Area ${gha}`,
    boundaryDistanceMeters: 5_000,
    nearBoundary: false,
    sourceId: "source:ca-mb-gha-service",
    message: "The point intersects one verified management-zone feature.",
  };
}

const noWeather = async (_latitude: number, _longitude: number, date: string) =>
  ({ status: "UNAVAILABLE" as const, summary: "No forecast", date: date as HuntInput["date"], sourceId: "source:open-meteo" as const });

async function hunt(input: HuntInput, zone: ZoneResolution, fetcher: typeof fetch) {
  clearOverlayCache();
  return await evaluateHunt(input, {
    resolveZone: async () => zone,
    weather: noWeather,
    fetch: fetcher,
    now: () => new Date("2026-09-20T12:00:00Z"),
  });
}

test("a Manitoba zone is answered by Manitoba's rules, with Manitoba's sources", async () => {
  const input: HuntInput = { latitude: 50.3, longitude: -99.4, date: "2026-11-20", speciesId: "species:white-tailed-deer" };
  const asked = await hunt(input, manitobaZone("23A"), overlayFetch());
  assert.equal(asked.completeness, "NEEDS_INPUT");
  assert.equal(asked.required?.id, "RESIDENCY");
  assert.match(asked.regulation.summary, /applicable Manitoba rules/);

  const answered = await hunt(
    { ...input, answers: { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_GENERAL_WTD", HUNT_METHOD: "RIFLE" } },
    manitobaZone("23A"),
    overlayFetch(),
  );
  assert.equal(answered.regulation.status, "CONDITIONAL");
  // The regulation is described from the bundle, with its version and hash.
  const regulation = answered.sources.find((source) => source.id === "source:ca-mb-hunting-seasons-regulation");
  assert.ok(regulation, "the controlling regulation is listed among the sources");
  assert.match(regulation.contentHash ?? "", /^sha256:/);
  /*
   * Still cites its provision, and now also states the window. The citation is
   * the point: certifying a jurisdiction must not remove its provenance.
   */
  assert.match(legalTimeSummary(answered.regulation.legalTime), /M\.R\. 351\/87, s\. 3/);
  assert.equal(answered.regulation.legalTime.status, "RESOLVED");
});

test("grouse in Manitoba asks nothing and is not answered with Ontario's wording", async () => {
  const result = await hunt(
    { latitude: 50.2, longitude: -95.6, date: "2026-10-05", speciesId: "species:ruffed-grouse" },
    manitobaZone("26"),
    overlayFetch(),
  );
  assert.equal(result.completeness, "RESOLVED");
  assert.equal(result.regulation.status, "CONDITIONAL");
  assert.ok(!result.regulation.summary.includes("Ontario"));
  assert.ok(!result.regulation.summary.includes("wildlife management unit"));
});

test("a published refuge restriction at the point stops a CONDITIONAL grouse answer", async () => {
  // Refuges layer OBJECTID 32 is the Delta Game Bird Refuge.
  const result = await hunt(
    { latitude: 50.18, longitude: -98.3, date: "2026-10-05", speciesId: "species:ruffed-grouse" },
    manitobaZone("25B"),
    overlayFetch({ refuges: [32] }),
  );
  assert.equal(result.regulation.status, "NEEDS_VERIFICATION");
  assert.match(result.regulation.summary, /Delta Game Bird Refuge/);
  assert.ok(result.regulation.limitations[0].text.includes("No person shall hunt"));
});

test("a restriction that names only other species does not touch this one", async () => {
  // Lands-closed OBJECTID 3 is Deer Island: "No person shall hunt or kill a moose".
  const result = await hunt(
    { latitude: 51.0, longitude: -97.0, date: "2026-10-05", speciesId: "species:ruffed-grouse" },
    manitobaZone("25A"),
    overlayFetch({ closed: [3] }),
  );
  assert.equal(result.regulation.status, "CONDITIONAL");
});

test("when the overlay layers cannot be read, the answer says so and named places stay unresolved", async () => {
  const far = await hunt(
    { latitude: 50.2, longitude: -95.6, date: "2026-10-05", speciesId: "species:ruffed-grouse" },
    manitobaZone("26"),
    overlayFetch({}, true),
  );
  assert.equal(far.regulation.status, "CONDITIONAL");
  assert.ok(far.regulation.limitations.some((line) => /could not reach Manitoba's refuge/.test(line.text)));

  // Inside CFB Shilo's extent, an unread overlay means the carve-out cannot be applied.
  const nearShilo = await hunt(
    { latitude: 49.75, longitude: -99.5, date: "2026-10-05", speciesId: "species:ruffed-grouse" },
    manitobaZone("30"),
    overlayFetch({}, true),
  );
  assert.equal(nearShilo.regulation.status, "NEEDS_VERIFICATION");
});

test("inside CFB Shilo the grouse season does not apply", async () => {
  // Lands-closed OBJECTID 27 is Canadian Forces Base Shilo.
  const result = await hunt(
    { latitude: 49.75, longitude: -99.5, date: "2026-10-05", speciesId: "species:ruffed-grouse" },
    manitobaZone("30"),
    overlayFetch({ closed: [27] }),
  );
  assert.equal(result.regulation.status, "CLOSED");
});

test("a point in no Game Hunting Area is answered in Manitoba's terms, with the land's own restriction", async () => {
  const park: ZoneResolution = {
    status: "UNKNOWN",
    jurisdictionId: "jurisdiction:ca-mb",
    sourceId: "source:ca-mb-gha-service",
    message: "The official Manitoba service places this point in no Game Hunting Area.",
  };
  // Lands-closed OBJECTID 22 is Riding Mountain National Park.
  const result = await hunt(
    { latitude: 50.66, longitude: -99.97, date: "2026-10-05", speciesId: "species:white-tailed-deer" },
    park,
    overlayFetch({ closed: [22] }),
  );
  assert.equal(result.regulation.status, "NEEDS_VERIFICATION");
  assert.match(result.regulation.summary, /certified Game Hunting Area/);
  assert.ok(result.regulation.limitations.some((line) => line.text.startsWith("Riding Mountain National Park")));
});

/* ── Zone resolution across served layers ─────────────────────────────── */

function gisFetch(manitoba: Array<string | null>, ontario: string[] = []): typeof fetch {
  const square = (lon: number, lat: number) => [[[lon - 0.1, lat - 0.1], [lon + 0.1, lat - 0.1], [lon + 0.1, lat + 0.1], [lon - 0.1, lat + 0.1], [lon - 0.1, lat - 0.1]]];
  return (async (input: string | URL) => {
    const url = new URL(String(input));
    const [lon, lat] = (url.searchParams.get("geometry") ?? "0,0").split(",").map(Number);
    if (url.href.includes(MB_SERVICE)) {
      return jsonResponse({ type: "FeatureCollection", features: manitoba.map((gha) => ({ properties: { GHA: gha ?? " " }, geometry: { type: "Polygon", coordinates: square(lon, lat) } })) });
    }
    if (url.href.includes(ON_SERVICE)) {
      return jsonResponse({ type: "FeatureCollection", features: ontario.map((name) => ({ properties: { OFFICIAL_NAME: name }, geometry: { type: "Polygon", coordinates: square(lon, lat) } })) });
    }
    throw new Error(`unexpected ${url.href}`);
  }) as typeof fetch;
}

test("the official-GIS fallback asks Manitoba's own service for a Manitoba point", async () => {
  const result = await resolveZoneFromOfficialGis(50.3, -99.4, gisFetch(["23a"]));
  assert.equal(result.status, "RESOLVED");
  assert.equal(result.zoneId, "management_zone:ca-mb-gha-23a");
  assert.equal(result.jurisdictionId, "jurisdiction:ca-mb");
  assert.equal(result.officialName, "Game Hunting Area 23A");
  assert.match(result.message, /Manitoba Game Hunting Area/);
});

test("where extents overlap, the authority that actually holds the point answers", async () => {
  // Eastern Manitoba sits inside Ontario's extent too; Ontario's service has nothing there.
  const result = await resolveZoneFromOfficialGis(50.0, -95.3, gisFetch(["26"], []));
  assert.equal(result.jurisdictionId, "jurisdiction:ca-mb");
  assert.equal(result.zoneId, "management_zone:ca-mb-gha-26");
});

test("the undesignated park polygon is not a zone", async () => {
  const result = await resolveZoneFromOfficialGis(50.66, -99.97, gisFetch([null]));
  assert.equal(result.status, "UNKNOWN");
  assert.equal(result.jurisdictionId, "jurisdiction:ca-mb");
});

test("an unplaced point is attributed to a jurisdiction only where one registered extent contains it", async () => {
  const saved = process.env.SPATIAL_PROVIDER;
  process.env.SPATIAL_PROVIDER = "official-gis";
  try {
    // Riding Mountain: only Manitoba's extent, and no GHA — answered in Manitoba's terms.
    const park = await resolveZone(50.66, -99.97, gisFetch([null]));
    assert.equal(park.jurisdictionId, "jurisdiction:ca-mb");
    // Maniwaki, Québec: Ontario's extent reaches it, but so does Québec's registered
    // layer, and Ontario's service places it in no WMU. It is not Ontario's to answer.
    // (Held with Québec's layer unserved; served, Québec's own service places it.)
    const quebec = layerById("layer:ca-qc-zone-chasse")!;
    const was = quebec.serving;
    quebec.serving = false;
    try {
      const maniwaki = await resolveZone(46.3806, -75.9722, gisFetch([], []));
      assert.equal(maniwaki.status, "UNKNOWN");
      assert.equal(maniwaki.jurisdictionId, undefined);
    } finally {
      quebec.serving = was;
    }
  } finally {
    if (saved === undefined) delete process.env.SPATIAL_PROVIDER;
    else process.env.SPATIAL_PROVIDER = saved;
  }
});

test("an unreachable registry cannot hold an evaluation hostage: the fallback runs within the budget", async () => {
  const hanging = (() => ({
    rpc: () => ({
      abortSignal(signal: AbortSignal) {
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
        });
      },
    }),
  })) as unknown as () => SupabaseClient;
  const saved = { provider: process.env.SPATIAL_PROVIDER, fallback: process.env.SPATIAL_FALLBACK_PROVIDER };
  process.env.SPATIAL_PROVIDER = "supabase";
  process.env.SPATIAL_FALLBACK_PROVIDER = "official-gis";
  // AbortSignal.timeout's timer does not hold the event loop open. A server
  // always has a live socket that does; a test run has nothing, so hold it here.
  const keepAlive = setTimeout(() => {}, SUPABASE_ZONE_TIMEOUT_MS * 4);
  try {
    const started = Date.now();
    const result = await resolveZone(50.3, -99.4, gisFetch(["23A"]), hanging);
    const elapsed = Date.now() - started;
    assert.equal(result.status, "RESOLVED");
    assert.equal(result.zoneId, "management_zone:ca-mb-gha-23a");
    // The authority is asked once PostGIS has taken the hedge delay, not after its full timeout.
    assert.ok(elapsed >= ZONE_HEDGE_DELAY_MS - 50 && elapsed < SUPABASE_ZONE_TIMEOUT_MS, `took ${elapsed} ms`);
  } finally {
    clearTimeout(keepAlive);
    process.env.SPATIAL_PROVIDER = saved.provider;
    process.env.SPATIAL_FALLBACK_PROVIDER = saved.fallback;
    if (saved.provider === undefined) delete process.env.SPATIAL_PROVIDER;
    if (saved.fallback === undefined) delete process.env.SPATIAL_FALLBACK_PROVIDER;
  }
});
