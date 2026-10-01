import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { evaluateHunt } from "../evaluate.ts";
import { resolveZone } from "../zone.ts";
import { isWithinSupportedBounds } from "../coverage.ts";
import { jurisdictionScopedBody } from "../jurisdiction-scope-response.ts";
import { clearStateLineProximityCache, clearUnitedStatesStateCache } from "../united-states/state-boundary.ts";
import { serializeHuntUrlState } from "../exploration/url-state.ts";
import { huntEvaluationToShareInput } from "../../hunt-share/from-hunt-evaluation.ts";
import { regulatoryJurisdictionsForSpecies } from "../north-america/report.ts";
import { isCertifiedSpecies, regulatoryEntryFor } from "./registry.ts";
import { IOWA_BUNDLE, IOWA_SPECIES } from "./iowa.ts";
import type { HuntEvaluation, HuntInput } from "../types.ts";

/**
 * IOWA, ASKED OF THE ENGINE THROUGH THE WHOLE CHAIN.
 *
 * Every case here goes the way a hunter's request goes: the real zone resolver
 * (which asks Ontario's WMU service, because Ontario's bounding box reaches over
 * most of Iowa), the jurisdiction placement, the registry, the conditional
 * engine and the evaluation's assembly. Only the network is stubbed, with the
 * answers the Census Bureau's TIGERweb service gave for these exact points on
 * 2026-10-01.
 *
 * The cases themselves are `fixtures/hunt/us-ia-certification-cases.json`,
 * written from 571 IAC chapter 96 before anything ran, and also runnable
 * against a live deployment with `scripts/certify-hunt-cases.mjs`.
 */

interface Case {
  id: string;
  latitude: number;
  longitude: number;
  speciesId: string;
  date: string;
  answers?: Record<string, string>;
  expect: {
    completeness?: string; status?: string; required?: string; nearBoundary?: boolean;
    daily?: number; possession?: number; mentions?: string[]; absent?: string[];
  };
}

const CASES = (JSON.parse(readFileSync(new URL("../../../../fixtures/hunt/us-ia-certification-cases.json", import.meta.url), "utf8")) as { cases: Case[] }).cases;

/*
 * The Census answers recorded live on 2026-10-01: which state contains the
 * point, and whether a 500 m circle around it lies wholly inside that state.
 */
const CENSUS: Record<string, { state: string | null; within500: string | null }> = {
  "41.586800|-93.625000": { state: "IA", within500: "IA" }, // Des Moines
  "42.030800|-93.631900": { state: "IA", within500: "IA" }, // Ames
  "41.517000|-90.580000": { state: "IA", within500: null }, // Davenport riverfront
  "41.513000|-90.580000": { state: "IL", within500: null }, // Rock Island, across the river
};
const NAMES: Record<string, string> = { IA: "Iowa", IL: "Illinois" };

function network(options: { proximityFails?: boolean } = {}) {
  const calls: string[] = [];
  const fetcher = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    calls.push(url.hostname);
    if (url.hostname === "tigerweb.geo.census.gov") {
      const [longitude, latitude] = url.searchParams.get("geometry")!.split(",").map(Number);
      const key = `${latitude.toFixed(6)}|${longitude.toFixed(6)}`;
      const recorded = CENSUS[key];
      if (!recorded) throw new Error(`no recorded Census answer for ${key}`);
      if (url.searchParams.get("spatialRel") === "esriSpatialRelWithin") {
        if (options.proximityFails) return new Response("unavailable", { status: 503 });
        return Response.json({ features: recorded.within500 ? [{ attributes: { STUSAB: recorded.within500 } }] : [] });
      }
      return Response.json({ features: recorded.state ? [{ attributes: { NAME: NAMES[recorded.state], STUSAB: recorded.state } }] : [] });
    }
    /* Every hunting layer whose rectangle reaches the point finds no unit there. */
    return Response.json({ type: "FeatureCollection", features: [] });
  }) as typeof fetch;
  return { fetcher, calls };
}

const NOW = new Date("2026-10-01T12:00:00Z");
const weather = async (_latitude: number, _longitude: number, date: string) =>
  ({ status: "UNAVAILABLE" as const, summary: "", date: date as HuntInput["date"], sourceId: "source:open-meteo" as const });

async function ask(item: Pick<Case, "latitude" | "longitude" | "speciesId" | "date" | "answers">, options: { proximityFails?: boolean } = {}) {
  clearUnitedStatesStateCache();
  clearStateLineProximityCache();
  const { fetcher } = network(options);
  return evaluateHunt(
    {
      latitude: item.latitude, longitude: item.longitude,
      date: item.date as HuntInput["date"], speciesId: item.speciesId as HuntInput["speciesId"],
      ...(item.answers ? { answers: item.answers as HuntInput["answers"] } : {}),
    },
    {
      resolveZone: (latitude, longitude) => resolveZone(latitude, longitude, fetcher),
      fetch: fetcher,
      weather,
      now: () => NOW,
    },
  );
}

const text = (evaluation: HuntEvaluation) =>
  JSON.stringify([evaluation.regulation.summary, evaluation.regulation.requirements, evaluation.regulation.limitations]);

for (const item of CASES) {
  test(`case ${item.id}`, async () => {
    const evaluation = await ask(item);
    const { expect } = item;
    const where = `${item.id}: ${evaluation.regulation.summary}`;
    if (expect.completeness) assert.equal(evaluation.completeness, expect.completeness, where);
    if (expect.required) assert.equal(evaluation.required?.id, expect.required, where);
    if (expect.status) assert.equal(evaluation.regulation.status, expect.status, where);
    if ("nearBoundary" in expect) assert.equal(evaluation.zone.nearBoundary ?? false, expect.nearBoundary, where);
    if ("daily" in expect) assert.equal(evaluation.regulation.limits?.daily, expect.daily, where);
    if ("possession" in expect) assert.equal(evaluation.regulation.limits?.possession, expect.possession, where);
    for (const phrase of expect.mentions ?? []) assert.ok(text(evaluation).includes(phrase), `${item.id} does not mention "${phrase}"`);
    for (const phrase of expect.absent ?? []) assert.ok(!text(evaluation).includes(phrase), `${item.id} mentions "${phrase}"`);
  });
}

test("the cases cover what the ruling requires, so the list cannot quietly thin out", () => {
  const ids = new Set(CASES.map((item) => item.id));
  for (const required of [
    "des-moines-pheasant-open", "des-moines-pheasant-day-before-opening", "across-the-river-in-illinois",
    "ruffed-grouse-not-answered", "davenport-riverfront-near-the-line",
  ]) assert.ok(ids.has(required), required);
});

test("a point in Iowa is placed in the state, with no zone, by the Census boundary — Ontario's rectangle does not claim it", async () => {
  clearUnitedStatesStateCache();
  clearStateLineProximityCache();
  const { fetcher, calls } = network();
  const resolution = await resolveZone(41.5868, -93.625, fetcher);
  assert.equal(resolution.status, "RESOLVED");
  assert.equal(resolution.jurisdictionId, "jurisdiction:us-ia");
  assert.equal(resolution.zoneId, undefined, "no zone id, ever");
  assert.equal(resolution.jurisdictionScope?.kind, "WHOLE_JURISDICTION");
  assert.equal(resolution.jurisdictionScope?.boundary.authority, "U.S. Census Bureau");
  assert.equal(resolution.jurisdictionScope?.proximity, "CLEAR");
  assert.equal(resolution.nearBoundary, false);
  assert.equal(resolution.sourceId, "source:us-census-tigerweb-states");
  assert.match(resolution.message, /cartographic boundary/);
  assert.match(resolution.message, /not Iowa's determination of where its hunting jurisdiction runs/);
  /* The Ontario service WAS asked — the rectangle reaches here — and its "no unit" did not decide the state. */
  assert.ok(calls.includes("tigerweb.geo.census.gov"));
  assert.ok(isWithinSupportedBounds(40.6, -91.5), "southern Iowa is in scope though no layer's rectangle reaches it");
});

test("a statewide answer states its legal hours as Iowa writes them, for the species", async () => {
  const pheasant = await ask({ latitude: 41.5868, longitude: -93.625, speciesId: "species:ring-necked-pheasant", date: "2026-11-15", answers: { HUNT_METHOD: "NOT_FALCONRY" } });
  assert.equal(pheasant.regulation.legalTime.status, "RESOLVED");
  if (pheasant.regulation.legalTime.status === "RESOLVED") {
    assert.deepEqual(pheasant.regulation.legalTime.window, { opensAt: "08:00", closesAt: "16:30" });
    assert.equal(pheasant.regulation.legalTime.timezone, "America/Chicago");
    assert.equal(pheasant.regulation.legalTime.section, "571 IAC 96.1(1)");
  }
  /* A falconer is never shown the gun season's clock: 96.9 states no hours. */
  const falconer = await ask({ latitude: 41.5868, longitude: -93.625, speciesId: "species:ring-necked-pheasant", date: "2027-02-15", answers: { HUNT_METHOD: "FALCONRY" } });
  assert.equal(falconer.regulation.legalTime.status, "NOT_CERTIFIED");
  /* "No restrictions" is quoted as Iowa's own rule, not presented as a window nobody found. */
  const squirrel = await ask({ latitude: 41.5868, longitude: -93.625, speciesId: "species:eastern-gray-squirrel", date: "2026-10-15", answers: { HUNT_METHOD: "NOT_FALCONRY" } });
  assert.equal(squirrel.regulation.status, "CONDITIONAL");
  assert.equal(squirrel.regulation.legalTime.status, "NOT_CERTIFIED");
  if (squirrel.regulation.legalTime.status === "NOT_CERTIFIED") assert.match(squirrel.regulation.legalTime.reason, /no restrictions on shooting hours/);
});

test("near the state line the boundary-uncertainty treatment fires, and a point the service could not measure is treated as near", async () => {
  const near = await ask({ latitude: 41.517, longitude: -90.58, speciesId: "species:ring-necked-pheasant", date: "2026-11-15", answers: { HUNT_METHOD: "NOT_FALCONRY" } });
  assert.equal(near.zone.jurisdictionScope?.proximity, "NEAR_LINE");
  assert.ok(near.regulation.limitations.some((line) => line.scope === "CONTEXTUAL" && line.condition === "NEAR_BOUNDARY"));
  /* Known differences are said rather than smoothed. */
  assert.ok(near.regulation.limitations.some((line) => /Mississippi River/.test(line.text)));
  assert.ok(near.regulation.limitations.some((line) => /Meskwaki Settlement/.test(line.text)));

  const unmeasured = await ask({ latitude: 41.5868, longitude: -93.625, speciesId: "species:ring-necked-pheasant", date: "2026-11-15", answers: { HUNT_METHOD: "NOT_FALCONRY" } }, { proximityFails: true });
  assert.equal(unmeasured.zone.jurisdictionScope?.proximity, "NOT_MEASURED");
  assert.equal(unmeasured.zone.nearBoundary, true, "unmeasured is never read as clear");
  assert.equal(unmeasured.regulation.status, "CONDITIONAL", "the answer stands; the warning is beside it");
});

test("no zone id appears in the resolution, the evaluation, the zone endpoint's body, the URL or the Hunt Brief", async () => {
  const evaluation = await ask({ latitude: 41.5868, longitude: -93.625, speciesId: "species:ring-necked-pheasant", date: "2026-11-15", answers: { HUNT_METHOD: "NOT_FALCONRY" } });
  assert.equal(evaluation.regulation.status, "CONDITIONAL", "positive control: the answer exists");
  assert.equal(evaluation.zone.zoneId, undefined);
  assert.doesNotMatch(JSON.stringify(evaluation), /management_zone:/);

  const body = jurisdictionScopedBody(evaluation.zone);
  assert.equal(body.status, "JURISDICTION");
  assert.equal("zone" in body, false);
  assert.doesNotMatch(JSON.stringify(body), /management_zone|designation|layerId/);
  assert.deepEqual([...body.rules.speciesIds].sort(), [...IOWA_SPECIES].sort());

  /* The URL the client writes for this hunt carries no zone. */
  const query = serializeHuntUrlState({ zoneId: null, speciesId: evaluation.input.speciesId, date: evaluation.input.date, explore: false });
  assert.doesNotMatch(query, /zone=/);

  /* And the Hunt Brief names no management zone. */
  const brief = huntEvaluationToShareInput(evaluation, { jurisdiction: { id: "jurisdiction:us-ia" as HuntEvaluation["zone"]["jurisdictionId"] & string, displayName: "Iowa" } });
  assert.equal(brief.managementZone, undefined);
  assert.doesNotMatch(JSON.stringify(brief), /management_zone:/);
});

test("Iowa's species are answerable in Iowa and nowhere this pilot did not certify", () => {
  assert.ok(regulatoryEntryFor("jurisdiction:us-ia"), "Iowa is served through its boundary");
  for (const speciesId of IOWA_SPECIES) {
    assert.equal(isCertifiedSpecies(speciesId), true, speciesId);
    assert.ok(regulatoryJurisdictionsForSpecies(speciesId).some((entry) => entry.id === "jurisdiction:us-ia"), speciesId);
  }
  /* Species certified ONLY by this pilot say Iowa and nothing else. */
  for (const speciesId of ["species:northern-bobwhite", "species:white-tailed-jackrabbit", "species:fox-squirrel", "species:eastern-gray-squirrel"]) {
    assert.deepEqual(regulatoryJurisdictionsForSpecies(speciesId).map((entry) => entry.id), ["jurisdiction:us-ia"], speciesId);
  }
  /* Ruffed grouse is certified elsewhere, and never by Iowa. */
  assert.ok(!regulatoryJurisdictionsForSpecies("species:ruffed-grouse").some((entry) => entry.id === "jurisdiction:us-ia"));
  assert.ok(!IOWA_BUNDLE.rules.some((rule) => rule.speciesId === "species:ruffed-grouse"));
});

test("every refusal is recorded with its reason, and the narrower-than-the-state one is ruffed grouse", () => {
  const refused = IOWA_BUNDLE.deliberatelyNotEncoded;
  assert.ok(refused.length >= 5);
  assert.ok(refused.some((entry) => /Ruffed grouse/.test(entry.what) && entry.reason === "NARROWER_THAN_THE_STATE"));
  assert.ok(refused.some((entry) => /Pigeon/.test(entry.what) && entry.reason === "SPECIES_NOT_IDENTIFIED"));
});

test("the derived windows are the standing rules' own dates", () => {
  const windowsOf = (id: string) => IOWA_BUNDLE.rules.find((rule) => rule.id === `regulatory_rule:us-ia-2026-${id}`)!.windows.map((window) => [window.opensIso, window.closesIso]);
  /* 2025: last Saturday in October is the 25th; 2026: the 31st. */
  assert.deepEqual(windowsOf("pheasant"), [["2025-10-25", "2026-01-10"], ["2026-10-31", "2027-01-10"]]);
  assert.deepEqual(windowsOf("pheasant-youth"), [["2025-10-18", "2025-10-19"], ["2026-10-24", "2026-10-25"]]);
  /* Labor Day 2025 is 1 September, 2026 is 7 September: the Saturdays before are 30 August and 5 September. */
  assert.deepEqual(windowsOf("cottontail"), [["2025-08-30", "2026-02-28"], ["2026-09-05", "2027-02-28"]]);
  assert.deepEqual(windowsOf("gray-partridge"), [["2025-10-11", "2026-01-31"], ["2026-10-10", "2027-01-31"]]);
});
