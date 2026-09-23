import { legalTimeSummary } from "./legal-time.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { HuntDimensionAnswers } from "./dimensions.ts";
import { designationOfZoneId, evaluateQuebec, QUEBEC_BUNDLE, QUEBEC_SPECIES, quebecCoverageReport } from "./quebec.ts";
import { quebecZoneCanonicalId } from "../ingestion/quebec-zone.ts";

/*
 * These run the certified bundle — content/regulatory/ca-qc-2026.json, built
 * from the ministry's own pages — through the shared engine. Every expectation
 * below is checked against the published table it names.
 */

function ask(speciesId: string, designation: string, date: string, answers: HuntDimensionAnswers = {}) {
  return evaluateQuebec({
    speciesId,
    speciesName: speciesId.slice("species:".length),
    date,
    place: { zoneId: quebecZoneCanonicalId(designation), zoneName: `Zone de chasse ${designation}`, latitude: 47, longitude: -72, overlays: null },
    answers,
  });
}

const MOOSE = "species:moose";
const DEER = "species:white-tailed-deer";
const GROUSE = "species:ruffed-grouse";
const HARE = "species:snowshoe-hare";
const TURKEY = "species:wild-turkey";

test("the bundle covers the species its pages name, and every designation resolves back", () => {
  assert.deepEqual(QUEBEC_SPECIES, [
    "species:american-black-bear", "species:arctic-hare", "species:eastern-cottontail", "species:moose",
    "species:ruffed-grouse", "species:sharp-tailed-grouse", "species:snowshoe-hare", "species:spruce-grouse",
    "species:white-tailed-deer", "species:wild-turkey",
  ]);
  for (const { designation } of QUEBEC_BUNDLE.designations.entries) {
    assert.equal(designationOfZoneId(quebecZoneCanonicalId(designation)), designation);
  }
});

test("moose in 10 est asks for the implement only because it decides the answer", () => {
  // Arbalète et arc, 10 est: du 26 septembre au 12 octobre 2026. No firearm season in 10 est.
  const unanswered = ask(MOOSE, "10E", "2026-10-01");
  assert.equal(unanswered.completeness, "NEEDS_INPUT");
  assert.equal(unanswered.required?.id, "HUNT_METHOD");

  const bow = ask(MOOSE, "10E", "2026-10-01", { HUNT_METHOD: "BOW" });
  assert.equal(bow.result?.status, "CONDITIONAL");
  assert.deepEqual(bow.result?.season, { opens: "2026-09-26", closes: "2026-10-12", datesInclusive: true });
  // The class is stated, never asked: antlered moose only, antlerless by drawn permit.
  const said = [...(bow.result?.requirements ?? []), ...(bow.result?.limitations ?? []).map((entry) => entry.text)].join("\n");
  assert.match(said, /« Orignal avec bois »/);
  assert.match(said, /drawn antlerless moose permit \(tirage au sort\)/);

  // A rifle in a zone whose tables name only bow and crossbow seasons: closed.
  assert.equal(ask(MOOSE, "10E", "2026-10-01", { HUNT_METHOD: "RIFLE" }).result?.status, "CLOSED");
});

test("a date no moose season covers is closed without asking anything", () => {
  const december = ask(MOOSE, "10E", "2026-12-01");
  assert.equal(december.completeness, "RESOLVED");
  assert.equal(december.result?.status, "CLOSED");
});

test("zone 17 moose is closed to sport hunting because the ministry says so", () => {
  const result = ask(MOOSE, "17", "2026-10-01");
  assert.equal(result.result?.status, "CLOSED");
  const said = [result.result?.summary, ...(result.result?.requirements ?? []), ...(result.result?.limitations ?? []).map((entry) => entry.text)].join("\n");
  assert.match(said, /La chasse sportive est interdite/);
  // Rights-based harvesting is named as a separate context, never evaluated.
  assert.match(said, /treaty or Aboriginal rights, which is a separate legal context North Ground does not evaluate/);
});

test("a zone no moose table names is unknown, not closed", () => {
  // Zone 20 (Anticosti) appears in no moose row.
  assert.equal(ask(MOOSE, "20", "2026-10-01").result?.status, "UNKNOWN");
});

test("a date outside the certified 2026-2027 pages is not answered", () => {
  assert.equal(ask(MOOSE, "10E", "2028-10-01").result?.status, "NEEDS_VERIFICATION");
});

test("zone 13 moose keeps a different animal class in each published year", () => {
  // Armes à feu, 13: « 2026 Orignal avec bois / 2027 Orignal ».
  const in2026 = ask(MOOSE, "13", "2026-10-15", { HUNT_METHOD: "RIFLE" });
  const in2027 = ask(MOOSE, "13", "2027-10-15", { HUNT_METHOD: "RIFLE" });
  assert.equal(in2026.result?.status, "CONDITIONAL");
  assert.equal(in2027.result?.status, "CONDITIONAL");
  const said2026 = [...(in2026.result?.requirements ?? []), ...(in2026.result?.limitations ?? []).map((entry) => entry.text)].join("\n");
  const said2027 = [...(in2027.result?.requirements ?? []), ...(in2027.result?.limitations ?? []).map((entry) => entry.text)].join("\n");
  assert.match(said2026, /« Orignal avec bois » \(Moose with antlers 10 cm or longer\), as the ministry states it for 2026/);
  assert.match(said2027, /« Orignal » \(Moose with antlers 10 cm or longer or Antlerless moose/);
});

test("an unresolved row makes its dates unverifiable where it may apply, never closed", () => {
  /* « Partie est et partie ouest de 19 sud (sauf la partie nord-ouest), 29 », bow
     and crossbow, 5 to 13 September 2026. Zone 29 is named outright; the 19 sud
     fragment stays unresolved, so 19SE on 8 September cannot be called closed. */
  assert.equal(ask(MOOSE, "29", "2026-09-08", { HUNT_METHOD: "BOW" }).result?.status, "CONDITIONAL");
  const southeast = ask(MOOSE, "19SE", "2026-09-08", { HUNT_METHOD: "BOW" });
  assert.equal(southeast.result?.status, "NEEDS_VERIFICATION");
  assert.match((southeast.result?.limitations ?? []).map((entry) => entry.text).join("\n"), /Partie est et partie ouest de 19 sud/);
  // Its own resolved firearms row still answers once its dates arrive.
  assert.equal(ask(MOOSE, "19SE", "2026-09-25", { HUNT_METHOD: "RIFLE" }).result?.status, "CONDITIONAL");
});

test("the deer relève weekend asks whether you take part, and only on its dates", () => {
  // Relève, 6 nord: 31 octobre au 1er novembre 2026; no regular deer season then.
  const unanswered = ask(DEER, "06N", "2026-10-31");
  assert.equal(unanswered.completeness, "NEEDS_INPUT");
  assert.equal(unanswered.required?.id, "SEASON_TYPE");
  assert.equal(ask(DEER, "06N", "2026-10-31", { SEASON_TYPE: "REGULAR" }).result?.status, "CLOSED");
  const participant = ask(DEER, "06N", "2026-10-31", { SEASON_TYPE: "RELEVE", HUNT_METHOD: "RIFLE" });
  assert.equal(participant.result?.status, "CONDITIONAL");
  // A regular deer date never raises the relève question.
  assert.notEqual(ask(DEER, "06N", "2026-11-10").required?.id, "SEASON_TYPE");
});

test("deer in the CWD enhanced surveillance zone is unknown, and says where it is", () => {
  // No deer row names 08NZ; « 8 nord » is 08N alone.
  const result = ask(DEER, "08NZ", "2026-11-10", { HUNT_METHOD: "RIFLE" });
  assert.equal(result.result?.status, "UNKNOWN");
  assert.match((result.result?.limitations ?? []).map((entry) => entry.text).join("\n"), /zone de surveillance rehaussée/);
});

test("ruffed grouse asks nothing where every implement is allowed", () => {
  const result = ask(GROUSE, "10E", "2026-10-01");
  assert.equal(result.completeness, "RESOLVED");
  assert.equal(result.result?.status, "CONDITIONAL");
  assert.deepEqual(result.result?.season, { opens: "2026-09-19", closes: "2027-01-15", datesInclusive: true });
});

test("ruffed grouse in zone 17 asks the implement, because the crossbow is prohibited there", () => {
  assert.equal(ask(GROUSE, "17", "2026-10-01").required?.id, "HUNT_METHOD");
  assert.equal(ask(GROUSE, "17", "2026-10-01", { HUNT_METHOD: "CROSSBOW" }).result?.status, "CLOSED");
  assert.equal(ask(GROUSE, "17", "2026-10-01", { HUNT_METHOD: "RIFLE" }).result?.status, "CONDITIONAL");
});

test("snowshoe hare snares are their own implement", () => {
  // Collet, 10 est: du 19 septembre 2026 au 31 mars 2027, like the firearm season.
  assert.equal(ask(HARE, "10E", "2026-12-01", { HUNT_METHOD: "SNARE" }).result?.status, "CONDITIONAL");
});

test("turkey carries its own legal hours and never asks about a rifle", () => {
  // 3: porteur d'une barbe, du 24 avril au 18 mai 2026.
  const result = ask(TURKEY, "03E", "2026-05-01");
  assert.equal(result.completeness, "RESOLVED");
  assert.equal(result.result?.status, "CONDITIONAL");
  /* Québec spans zones, so the ministry's own hours are carried as the reason
     rather than resolved into a window. The words survive; the clock does not. */
  assert.equal(result.result?.legalTime.status, "NOT_CERTIFIED");
  assert.match(result.result ? legalTimeSummary(result.result.legalTime) : "", /demi-heure avant le lever du soleil jusqu.à midi/);
  assert.match((result.result?.limitations ?? []).map((entry) => entry.text).join("\n"), /« Dindon sauvage porteur d'une barbe »/);
});

test("coverage is computed from the bundle, per species", () => {
  const report = quebecCoverageReport();
  assert.equal(report.officialUnits, 59);
  assert.ok(report.species.some((entry) => entry.speciesId === MOOSE && entry.rules > 0));
});
