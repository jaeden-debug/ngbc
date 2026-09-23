import assert from "node:assert/strict";
import test from "node:test";
import { quebecZoneCanonicalId } from "./ingestion/quebec-zone.ts";
import { clearOverlayCache } from "./overlays.ts";
import { REGULATORY_REGISTRY } from "./regulatory/registry.ts";
import { QUEBEC_OVERLAY_DESCRIPTION, QUEBEC_OVERLAYS, quebecSourceRecords } from "./regulatory/quebec.ts";
import type { HuntInput, ZoneResolution } from "./types.ts";

/**
 * Québec's registry entry with the ministry's closed-territories service faked.
 *
 * The places are real: the ministry's own services put 45.6015, -75.1260 in
 * zone 10E and inside Parc national de Plaisance (Chasse_Interdite.80). The
 * rules are the committed bundle. These prove the wiring — the territory
 * reaching the answer, an outage reaching the answer, a whole-zone question
 * never asking about a point — not the law, which `regulatory/quebec.test.ts`
 * covers.
 */

const QUEBEC = REGULATORY_REGISTRY.find((entry) => entry.jurisdictionId === "jurisdiction:ca-qc")!;
const PLAISANCE = { latitude: 45.6015, longitude: -75.126 };

function zone(designation: string): ZoneResolution {
  return {
    status: "RESOLVED",
    zoneId: quebecZoneCanonicalId(designation) as ZoneResolution["zoneId"],
    jurisdictionId: "jurisdiction:ca-qc",
    officialName: `Zone de chasse ${designation}`,
    boundaryDistanceMeters: 4_000,
    nearBoundary: false,
    sourceId: "source:ca-qc-zone-chasse-service",
    message: "The point intersects one verified management-zone feature.",
  };
}

/** The ministry's layer answers with these feature ids, or fails. */
function ministry(ids: number[] | "outage"): typeof fetch {
  return (async (input: string | URL) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("typeNames"), "SmartFaunePub:Chasse_Interdite");
    if (ids === "outage") throw new Error("GeoServer unreachable");
    return new Response(JSON.stringify({
      type: "FeatureCollection",
      features: ids.map((id) => ({ id: `Chasse_Interdite.${id}`, properties: { NOM: "" } })),
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

// Moose with a bow in 10 est on 27 September 2026: the season runs 26 September to 12 October.
const MOOSE_BOW: HuntInput = {
  ...PLAISANCE,
  date: "2026-09-27" as HuntInput["date"],
  speciesId: "species:moose" as HuntInput["speciesId"],
  answers: { HUNT_METHOD: "BOW" },
};

async function evaluate(input: HuntInput, fetcher: typeof fetch, scope: "POINT" | "ZONE" = "POINT") {
  clearOverlayCache();
  return await QUEBEC.evaluate(input, zone("10E"), { verifiedAt: "2026-09-21", fetcher, scope });
}

test("outside every closed territory, the zone's season is the answer", async () => {
  const outcome = await evaluate(MOOSE_BOW, ministry([]));
  assert.equal(outcome.completeness, "RESOLVED");
  assert.equal(outcome.regulation.status, "CONDITIONAL");
});

test("inside Parc national de Plaisance the zone's season is never stated as the answer", async () => {
  const outcome = await evaluate(MOOSE_BOW, ministry([80]));
  assert.equal(outcome.regulation.status, "NEEDS_VERIFICATION");
  assert.match(outcome.regulation.summary, /inside Parc national de Plaisance/);
  assert.ok(outcome.regulation.limitations.map((entry) => entry.text).includes(
    "Parc national de Plaisance: “« Territoires où toute activité de chasse est interdite. » (Parc national).”"));
  assert.ok(outcome.regulation.sourceIds.includes("source:ca-qc-chasse-interdite-service" as never));
  // The ministry closes the park to all hunting: no season, date, listing, bag
  // limit or legal hours is stated for a point inside it, in any field.
  assert.equal(outcome.regulation.season, undefined);
  assert.equal(outcome.regulation.limits, undefined);
  assert.deepEqual(outcome.regulation.requirements, []);
  /* No legal hours are stated for a point the ministry closes to all hunting.
     NOT_CERTIFIED is the only status that can carry that, and it must not be
     read as the timezone problem: the reason names the closure. */
  assert.equal(outcome.regulation.legalTime.status, "NOT_CERTIFIED");
  assert.doesNotMatch(outcome.regulation.summary, /\d{4}|septembre|octobre|Seasons open/);
  assert.match(outcome.regulation.summary, /all hunting is prohibited/);
});

test("inside the park on a date the zone is closed, CLOSED stays CLOSED and lists no season", async () => {
  const outcome = await evaluate({ ...MOOSE_BOW, date: "2026-09-01" as HuntInput["date"] }, ministry([80]));
  assert.equal(outcome.regulation.status, "CLOSED");
  assert.match(outcome.regulation.summary, /inside Parc national de Plaisance/);
  assert.doesNotMatch(outcome.regulation.summary, /\d{4}|septembre|octobre|Seasons open/);
  assert.ok(outcome.regulation.limitations.some((line) => /toute activité de chasse est interdite/.test(line.text)));
});

test("a territory the catalogue does not hold still stops the season being stated", async () => {
  const outcome = await evaluate(MOOSE_BOW, ministry([999]));
  assert.equal(outcome.regulation.status, "NEEDS_VERIFICATION");
  assert.ok(outcome.regulation.limitations.some((line) => /does not include/.test(line.text)));
});

test("when the ministry's layer cannot be reached, the answer says so in Québec's terms", async () => {
  const outcome = await evaluate(MOOSE_BOW, ministry("outage"));
  assert.ok(outcome.regulation.limitations.map((entry) => entry.text).includes(
    "North Ground could not reach Québec's layer of territories closed to all hunting for this point, so it has not checked whether one of them restricts this hunt here."));
  // Never Manitoba's layers, in any wording.
  assert.ok(!outcome.regulation.limitations.some((line) => /refuge|wildlife-management-area/.test(line.text)));
});

test("a whole-zone question asks nothing about a point, and says the territories are checked only at one", async () => {
  const noCalls = (async () => { throw new Error("a zone answer must not query a point"); }) as typeof fetch;
  const outcome = await evaluate(MOOSE_BOW, noCalls, "ZONE");
  assert.notEqual(outcome.regulation.status, "NEEDS_VERIFICATION");
  assert.equal(QUEBEC.pointOnlyChecks, QUEBEC_OVERLAY_DESCRIPTION);
});

test("the ministry's two GIS layers are described from what North Ground committed", () => {
  const records = quebecSourceRecords(["source:ca-qc-zone-chasse-service", "source:ca-qc-chasse-interdite-service"]);
  assert.deepEqual(records.map((record) => record.id), ["source:ca-qc-zone-chasse-service", "source:ca-qc-chasse-interdite-service"]);
  const closed = records[1];
  assert.equal(closed.contentHash, QUEBEC_OVERLAYS.contentHash);
  // A calendar day anchored at noon UTC, so it is the same day in every Canadian time zone.
  assert.equal(closed.retrievedAt, `${QUEBEC_OVERLAYS.retrievedAt}T12:00:00Z`);
  assert.match(closed.url, /request=GetCapabilities/);
});

test("zone 19 Nord is one of the closed territories, and no season page names it", () => {
  const feature = QUEBEC_OVERLAYS.layers[0].features.find((candidate) => candidate.name === "Zone de chasse 19 Nord");
  assert.ok(feature);
  assert.deepEqual(feature.tokens, ["all"]);
});
