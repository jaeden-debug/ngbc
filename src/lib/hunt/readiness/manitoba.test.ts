import assert from "node:assert/strict";
import test from "node:test";
import { evaluateManitoba, MANITOBA_BUNDLE, MANITOBA_VOCABULARY } from "../regulatory/manitoba.ts";
import type { HuntDimensionAnswers } from "../regulatory/dimensions.ts";
import { resolveReadiness } from "./index.ts";
import { resolveManitobaReadiness } from "./manitoba.ts";
import type { ZoneResolution } from "../types.ts";

/**
 * Manitoba's checklist, driven through the real engine so the orange answer is
 * read from the same conditions the regulatory answer carries. Every figure was
 * read from the 2026 Manitoba Hunting Guide p. 7 and M.R. 351/87 s. 10.
 */

const MOOSE = "species:moose";
const BEAR = "species:american-black-bear";

function at(gha: string, latitude: number, longitude: number) {
  return { zoneId: `management_zone:ca-mb-gha-${gha.toLowerCase()}`, zoneName: `Game Hunting Area ${gha}`, latitude, longitude, overlays: new Set<string>() };
}
const GHA9 = at("9", 56.0, -98.5);
const GHA9A = at("9A", 54.9, -97.4);
const GHA21A = at("21A", 51.1, -96.7);

function readiness(speciesId: string, date: string, place: ReturnType<typeof at>, answers: HuntDimensionAnswers) {
  const regulation = evaluateManitoba({ speciesId, speciesName: speciesId.slice(8), date, place, answers }).result!;
  assert.equal(regulation.status, "CONDITIONAL", `${speciesId} ${date}`);
  const zone = { status: "RESOLVED", zoneId: place.zoneId, jurisdictionId: "jurisdiction:ca-mb" } as unknown as ZoneResolution;
  return resolveReadiness({ speciesId, date, answers: answers as never }, zone, regulation)!;
}

test("a resident general moose hunt lists hunter education, the licence at $61.75, and orange required", () => {
  const result = readiness(MOOSE, "2026-10-01", GHA9, { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_GENERAL_MOOSE", HUNT_METHOD: "RIFLE" });
  assert.equal(result.jurisdictionName, "Manitoba");
  assert.equal(result.coverage, "PARTIAL");
  assert.deepEqual(result.authorizations.map((item) => item.id), [
    "authorization:ca-mb-hunter-education",
    "authorization:ca-mb-mb-resident-general-moose",
  ]);
  const licence = result.authorizations[1];
  assert.equal(licence.price.kind, "VERIFIED");
  assert.ok(licence.price.kind === "VERIFIED" && licence.price.prices.some((price) => price.amount === 61.75));
  assert.equal(result.orange?.status, "REQUIRED");
  assert.ok(result.methods?.allowed.some((method) => method.method === "RIFLE"));
});

test("archery moose: a bow is allowed, a crossbow only by permit, and orange is not required", () => {
  const result = readiness(MOOSE, "2026-09-05", GHA9A, { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_ARCHERY_MOOSE", HUNT_METHOD: "BOW" });
  assert.equal(result.orange?.status, "NOT_REQUIRED");
  assert.deepEqual(result.methods?.allowed.map((method) => [method.method, method.status]), [["BOW", "ALLOWED"], ["CROSSBOW", "CONDITIONAL"]]);
});

test("spring bear needs no orange; fall bear does", () => {
  const answers = { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_GENERAL_BLACK_BEAR", HUNT_METHOD: "RIFLE" };
  const spring = MANITOBA_BUNDLE.rules.some((rule) => rule.speciesId === BEAR && (rule as { season?: { opens?: string } }).season?.opens?.slice(5, 7) === "05");
  if (spring) assert.equal(readiness(BEAR, "2026-05-20", GHA21A, answers).orange?.status, "NOT_REQUIRED");
  assert.equal(readiness(BEAR, "2026-09-01", GHA21A, answers).orange?.status, "REQUIRED");
});

test("a licence the engine has not asked about yet shows hunter education and says the licence is unresolved", () => {
  const result = resolveManitobaReadiness({ speciesId: MOOSE, date: "2026-10-01", zoneId: GHA9.zoneId, answers: {} });
  assert.deepEqual(result.authorizations.map((item) => item.id), ["authorization:ca-mb-hunter-education"]);
  assert.ok(result.limitations.some((line) => /not resolved which licence/.test(line)));
  assert.equal(result.orange, undefined);
});

test("every licence the engine can ask about has a checklist entry", () => {
  const licences = new Set<string>(
    (MANITOBA_VOCABULARY.dimensions.find((dimension) => dimension.id === "LICENCE_TYPE")?.options ?? []).map((option) => option.value),
  );
  for (const rule of MANITOBA_BUNDLE.rules) {
    const value = (rule as { appliesWhen?: Record<string, unknown> }).appliesWhen?.LICENCE_TYPE;
    for (const entry of Array.isArray(value) ? value : value ? [value] : []) licences.add(String(entry));
  }
  assert.ok(licences.size > 20, `found ${licences.size}`);
  for (const licence of licences) {
    const result = resolveManitobaReadiness({ speciesId: MOOSE, date: "2026-10-01", zoneId: GHA9.zoneId, answers: { LICENCE_TYPE: licence } });
    assert.equal(result.authorizations.length, 2, licence);
  }
});

test("draw licences carry the draw, and a draw moose licence never shows a guessed fee", () => {
  const result = resolveManitobaReadiness({ speciesId: MOOSE, date: "2026-10-01", zoneId: GHA9.zoneId, answers: { LICENCE_TYPE: "MB_RESIDENT_DRAW_GENERAL_MOOSE" } });
  const licence = result.authorizations[1];
  assert.equal(licence.draw?.required, true);
  assert.equal(licence.price.kind, "CHECK_OFFICIAL");
});
