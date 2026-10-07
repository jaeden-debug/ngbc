import { legalTimeSummary } from "./legal-time.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { HuntDimensionAnswers } from "./dimensions.ts";
import { designationOfZoneId, evaluateQuebec, QUEBEC_BUNDLE, QUEBEC_SPECIES, quebecCoverageReport, quebecEngineBundle } from "./quebec.ts";
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
  assert.deepEqual(bow.result?.season, {
    opens: "2026-09-26", closes: "2026-10-12", datesInclusive: true,
    /* The ministry's own name for the segment, carried whole so the status
       paragraph that used to be the only place it lived can be deleted.
       Quoted, not translated; tagged, not paraphrased. */
    label: { text: "Périodes de chasse à l’arbalète et à l’arc", lang: "fr-CA", owner: "AUTHORITY" },
  });
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
  assert.deepEqual(result.result?.season, {
    opens: "2026-09-19", closes: "2027-01-15", datesInclusive: true,
    label: { text: "Armes à feu et à air comprimé, arbalète et arc", lang: "fr-CA", owner: "AUTHORITY" },
  });
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
  /*
   * The window now resolves, and it resolves to noon.
   *
   * This test used to assert NOT_CERTIFIED and match the ministry's French
   * sentence, because Québec's clock was thought unavailable — the province
   * spans IANA zones. It is available: the Legal Time Act states the reckoning
   * itself and divides the province at the 63rd meridian, and this point
   * (47, -72) is west of it. `quebec-statutory-time.ts` carries the reasoning.
   *
   * THE CITATION ALSO IMPROVED, which is the part worth noticing. The old
   * reason quoted `ca-qc-dindon-sauvage-2026-2027` — the ministry's SUMMARY
   * page. The window now cites Règlement sur la chasse, r. 12, art. 14,
   * septième alinéa:
   * the instrument that actually enacts the narrowing. This project has found
   * four cases of a ministry summary misstating its own regulation, so moving a
   * citation from the summary to the regulation is the direction that matters.
   */
  assert.equal(result.result?.legalTime.status, "RESOLVED");
  assert.equal(
    result.result?.legalTime.status === "RESOLVED" ? result.result.legalTime.window.closesAt : null,
    "12:00",
  );
  assert.match(result.result ? legalTimeSummary(result.result.legalTime) : "", /art\. 14, septième alinéa/);
  assert.match((result.result?.limitations ?? []).map((entry) => entry.text).join("\n"), /« Dindon sauvage porteur d'une barbe »/);
});

test("coverage is computed from the bundle, per species", () => {
  const report = quebecCoverageReport();
  assert.equal(report.officialUnits, 59);
  assert.ok(report.species.some((entry) => entry.speciesId === MOOSE && entry.rules > 0));
});

test("a Québec rule carries its animal class into the engine, not only into a note", () => {
  /*
   * THE FLATTENING THIS CLOSES, at its source. `engineRule` turned the
   * structured `animalClasses` into a prose note through `classNote` and passed
   * nothing else — so the one jurisdiction whose bundles state a legal animal
   * class was the one whose opportunity rows could not name it.
   *
   * The note stays; it is how a reader is told « avec bois (7 cm ou plus) ».
   * The FACT now travels beside it, which is what a filter and a card can use.
   *
   * ASSERTED OVER THE ENGINE BUNDLE, not the raw JSON. A first version of this
   * test read `QUEBEC_BUNDLE`, which is `bundleJson as unknown as QuebecBundle`
   * — the INPUT to `engineRule`, which carries the classes whatever the
   * transform does with them. It passed with the transform removed, and proved
   * nothing at all.
   */
  const engine = quebecEngineBundle("bigGame");
  const deer = engine.rules.filter((rule) => rule.speciesId === "species:white-tailed-deer");
  assert.ok(deer.length > 0, "positive control: the engine bundle holds Québec's deer rules");

  const withClass = deer.filter((rule) => rule.animalClasses?.length);
  assert.ok(
    withClass.length > 0,
    "every Québec deer class was dropped on the way into the engine; a row cannot name an antlered season",
  );
  for (const rule of withClass) {
    for (const token of rule.animalClasses ?? []) {
      assert.match(token, /^(ANTLERED|ANTLERLESS)$/, `unexpected class token ${token}`);
    }
  }
});

test("the ministry's words travel bare and are quoted once, by whoever writes them out", async () => {
  /* Production, 2026-10-07: Sources read « « Des modifications pourraient… » »
     because the producer quoted the statement and AuthorityText quoted it
     again. Authorship decides the marks, at the point the words are written. */
  const { limitationText } = await import("../limitation.ts");
  const deer = ask(DEER, "10O", "2026-11-10");
  const statements = (deer.result?.limitations ?? []).filter((entry) => entry.owner === "AUTHORITY" && entry.lang === "fr-CA");
  assert.ok(statements.length > 0, "the deer page's own statements are carried");
  for (const entry of statements) {
    assert.doesNotMatch(entry.text, /^«|»$/, `stored bare: ${entry.text.slice(0, 60)}`);
    assert.match(limitationText(entry), /^« [^«].*[^»] »$/, "written out once quoted");
  }
  /* The turkey hours are the ministry's sentence too, in the Hunt Brief's summary. */
  const turkey = ask(TURKEY, "10O", "2026-05-10").result?.legalTime;
  if (turkey?.status === "NOT_CERTIFIED" && turkey.reasonOwner === "AUTHORITY") {
    assert.doesNotMatch(turkey.reason, /^«/);
    assert.match(legalTimeSummary(turkey), /^« [^«]/);
  }
});
