import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { evaluateHunt } from "../hunt/evaluate.ts";
import { clearOverlayCache } from "../hunt/overlays.ts";
import type { HuntDimensionAnswers } from "../hunt/regulatory/dimensions.ts";
import type { HuntInput, ZoneResolution } from "../hunt/types.ts";
import { ZONE_LAYERS } from "../hunt/zone-layers.ts";
import { huntEvaluationToShareInput } from "./from-hunt-evaluation.ts";
import { createShareableHuntBrief, parseStoredHuntBrief } from "./model.ts";

/**
 * Québec answers, evaluated on the real engine and bundle, shared as Hunt Briefs.
 *
 * Québec's pages print long French headings and several seasons per answer, and
 * the first audit found most Québec answers could not be shared at all (a
 * source authority over the brief's limit, summaries over it). These hold every
 * representative answer to a valid brief that names the zone in Québec's own
 * terms, keeps what the answer covers, and carries nothing that locates anyone.
 */

const QUEBEC_LAYER = ZONE_LAYERS.find((layer) => layer.jurisdictionId === "jurisdiction:ca-qc")!;
const wasServing = QUEBEC_LAYER.serving;
before(() => { QUEBEC_LAYER.serving = true; });
after(() => { QUEBEC_LAYER.serving = wasServing; });

const LATITUDE = 45.601_537;
const LONGITUDE = -75.126_011;

function zone(designation: string): ZoneResolution {
  return {
    status: "RESOLVED",
    zoneId: `management_zone:ca-qc-zone-${designation.toLowerCase()}` as ZoneResolution["zoneId"],
    jurisdictionId: "jurisdiction:ca-qc",
    officialName: `Zone de chasse ${designation}`,
    boundaryDistanceMeters: 5_000,
    nearBoundary: false,
    sourceId: "source:ca-qc-zone-chasse-service",
    message: "The point intersects one verified management-zone feature.",
  };
}

async function share(designation: string, speciesId: string, date: string, answers: HuntDimensionAnswers, closedTerritories: number[] = []) {
  clearOverlayCache();
  const evaluation = await evaluateHunt(
    { latitude: LATITUDE, longitude: LONGITUDE, date: date as HuntInput["date"], speciesId: speciesId as HuntInput["speciesId"], answers },
    {
      resolveZone: async () => zone(designation),
      weather: async (_latitude, _longitude, day) => ({ status: "UNAVAILABLE", summary: "No forecast", date: day, sourceId: "source:open-meteo" }),
      fetch: (async () => new Response(JSON.stringify({
        type: "FeatureCollection",
        features: closedTerritories.map((id) => ({ id: `Chasse_Interdite.${id}` })),
      }), { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch,
      now: () => new Date("2026-09-21T12:00:00Z"),
    },
  );
  const brief = createShareableHuntBrief(
    huntEvaluationToShareInput(evaluation, { jurisdiction: { id: "jurisdiction:ca-qc", displayName: "Québec" } }),
    { shareId: "hb_quebecBriefTest00001", createdAt: "2026-09-21T12:00:00Z" },
  );
  return { evaluation, brief };
}

const ANSWERS: Array<[string, string, string, string, HuntDimensionAnswers, number[]?]> = [
  ["moose with a bow in 10E", "10E", "species:moose", "2026-09-27", { HUNT_METHOD: "BOW" }],
  ["moose with a bow inside Parc national de Plaisance", "10E", "species:moose", "2026-09-27", { HUNT_METHOD: "BOW" }, [80]],
  ["moose in zone 17, closed to sport hunting", "17", "species:moose", "2026-10-01", {}],
  ["moose where an unresolved row may apply", "19SE", "species:moose", "2026-09-08", { HUNT_METHOD: "BOW" }],
  ["deer on the relève weekend", "10E", "species:white-tailed-deer", "2026-10-31", { SEASON_TYPE: "RELEVE", HUNT_METHOD: "RIFLE" }],
  ["spring turkey", "06S", "species:wild-turkey", "2026-05-01", {}],
  ["snowshoe hare with snares in zone 21", "21", "species:snowshoe-hare", "2026-11-01", { HUNT_METHOD: "SNARE" }],
];

for (const [label, designation, speciesId, date, answers, closed] of ANSWERS) {
  test(`${label}: a valid brief in Québec's terms, locating no one`, async () => {
    const { evaluation, brief } = await share(designation, speciesId, date, answers, closed);
    assert.equal(brief.regulatory.status, evaluation.regulation.status);
    assert.deepEqual(brief.managementZone, { id: `management_zone:ca-qc-zone-${designation.toLowerCase()}`, displayName: `Zone de chasse ${designation}` });
    // The brief covers what the answer covers: sport hunting, never rights-based harvesting.
    if (evaluation.regulation.status !== "UNKNOWN") {
      assert.ok(brief.warnings.some((line) => /does not describe harvesting under treaty or Aboriginal rights/.test(line)), "scope kept");
    }
    const serialized = JSON.stringify(brief);
    assert.doesNotMatch(serialized, /45\.60|75\.12/);
    // Stored and read back unchanged.
    const stored = parseStoredHuntBrief(JSON.parse(serialized));
    assert.equal(stored.status, "found");
    assert.deepEqual(stored.status === "found" ? stored.brief : null, brief);
  });
}

test("a closed territory the ministry names stays in the brief of a hunt inside it", async () => {
  const { brief } = await share("10E", "species:moose", "2026-09-27", { HUNT_METHOD: "BOW" }, [80]);
  assert.equal(brief.regulatory.status, "NEEDS_VERIFICATION");
  assert.ok(brief.warnings.some((line) => line.startsWith("Parc national de Plaisance:")));
  assert.ok(brief.officialSources.some((source) => source.id === "source:ca-qc-chasse-interdite-service"));
});

test("the implement a hunter named is carried as their assumption, in the question's words", async () => {
  const { brief } = await share("10E", "species:moose", "2026-09-27", { HUNT_METHOD: "BOW" });
  assert.ok(brief.assumptions.some(({ answer }) => /bow/i.test(answer)));
});
