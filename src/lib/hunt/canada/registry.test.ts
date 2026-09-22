import assert from "node:assert/strict";
import { test } from "node:test";
import { CANADA_JURISDICTIONS, jurisdictionByCode, jurisdictionById } from "./registry.ts";
import { canadaCoverageReport, regulatoryJurisdictionsForSpecies } from "./report.ts";
import { hasSpeciesCoverageIn, speciesAsksQuestionIn } from "../coverage.ts";

/**
 * The registry's job is to make a false coverage claim hard to make.
 *
 * These tests are the constraints that job implies: a jurisdiction cannot be
 * VERIFIED without being certified against its own authority, cannot report
 * rules it does not hold, and cannot quietly stop declaring what is missing.
 */

test("all thirteen provinces and territories plus the federal layer are tracked", () => {
  const codes = CANADA_JURISDICTIONS.map((entry) => entry.code).sort();
  assert.deepEqual(codes, [
    "CA-AB", "CA-BC", "CA-FEDERAL", "CA-MB", "CA-NB", "CA-NL", "CA-NS",
    "CA-NT", "CA-NU", "CA-ON", "CA-PE", "CA-QC", "CA-SK", "CA-YT",
  ]);
  assert.equal(CANADA_JURISDICTIONS.filter((entry) => entry.kind === "province").length, 10);
  assert.equal(CANADA_JURISDICTIONS.filter((entry) => entry.kind === "territory").length, 3);
  assert.equal(CANADA_JURISDICTIONS.filter((entry) => entry.kind === "federal").length, 1);
});

test("spatial VERIFIED requires parity certification against the authority", () => {
  // Ingesting geometry is not the same as agreeing with the authority about
  // which point falls in which unit. Only the second earns VERIFIED.
  for (const jurisdiction of CANADA_JURISDICTIONS) {
    if (jurisdiction.spatial.status !== "VERIFIED") continue;
    assert.ok(
      jurisdiction.spatial.parityCertified,
      `${jurisdiction.code} claims VERIFIED geometry without parity certification`,
    );
  }
});

test("every jurisdiction names an official source", () => {
  // A jurisdiction with no named authority cannot be worked on, and its gaps
  // cannot be closed by anyone who picks this up later.
  for (const jurisdiction of CANADA_JURISDICTIONS) {
    assert.match(jurisdiction.spatial.officialSourceUrl, /^https:\/\//, `${jurisdiction.code} spatial source`);
    assert.ok(jurisdiction.spatial.officialTerm.length > 0, `${jurisdiction.code} official term`);
    assert.ok(jurisdiction.regulatory.sourceLeads.length > 0, `${jurisdiction.code} regulatory source leads`);
  }
});

test("a jurisdiction with no certified bundle declares what is missing", () => {
  // The alternative is a jurisdiction that is silently empty, which reads as
  // covered to anyone scanning the registry.
  for (const jurisdiction of CANADA_JURISDICTIONS) {
    if (jurisdiction.regulatory.bundleIds.length > 0) continue;
    assert.ok(
      jurisdiction.knownGaps.length > 0,
      `${jurisdiction.code} holds no certified rules and declares no gaps`,
    );
  }
});

test("the report counts only what the certified bundles actually contain", () => {
  const report = canadaCoverageReport();

  // Ontario, Québec, Manitoba and Alberta hold rules Hunt can answer today. If this ever fails
  // because another jurisdiction gained rules, update it deliberately — the
  // test exists so coverage cannot grow without someone noticing.
  const withRules = report.jurisdictions.filter((entry) => entry.regulatory.rules > 0);
  assert.deepEqual(withRules.map((entry) => entry.code), ["CA-ON", "CA-QC", "CA-MB", "CA-AB"]);

  const ontario = withRules[0];
  assert.equal(ontario.species.length, 8, "four small-game plus four major-game species");
  assert.equal(ontario.spatial.officialUnits, 151);
  assert.ok(ontario.regulatory.rules > 100, "Ontario holds the certified rule set");

  const quebec = withRules[1];
  assert.deepEqual(quebec.species.map((row) => row.speciesId), [
    "species:american-black-bear", "species:moose", "species:white-tailed-deer", "species:wild-turkey",
    "species:arctic-hare", "species:eastern-cottontail", "species:ruffed-grouse", "species:sharp-tailed-grouse",
    "species:snowshoe-hare", "species:spruce-grouse",
  ]);
  assert.equal(quebec.spatial.officialUnits, 59);
  assert.equal(quebec.spatial.parityCertified, true);
  assert.equal(quebec.regulatory.status, "PARTIAL", "every other Québec species answers UNKNOWN");

  const manitoba = withRules[2];
  assert.deepEqual(manitoba.species.map((row) => row.speciesId), [
    "species:ruffed-grouse", "species:sharp-tailed-grouse", "species:spruce-grouse", "species:white-tailed-deer",
  ]);
  assert.equal(manitoba.spatial.officialUnits, 62);
  assert.equal(manitoba.spatial.parityCertified, true);

  // British Columbia is the case the two flags separate: its geography is certified and
  // counted, and it still holds no rule Hunt will answer.
  const britishColumbia = report.jurisdictions.find((entry) => entry.code === "CA-BC")!;
  assert.equal(britishColumbia.spatial.parityCertified, true);
  assert.equal(britishColumbia.spatial.officialUnits, 225, "certified geography is counted without certified rules");
  assert.equal(britishColumbia.regulatory.rules, 0, "the British Columbia bundle does not answer");
  assert.equal(britishColumbia.species.length, 0);

  // Every other jurisdiction reports zero rather than being absent from the report.
  for (const jurisdiction of report.jurisdictions) {
    if (withRules.includes(jurisdiction)) continue;
    assert.equal(jurisdiction.regulatory.rules, 0, `${jurisdiction.code} should report zero rules`);
    assert.equal(jurisdiction.regulatory.speciesCertified, 0, `${jurisdiction.code} should report zero species`);
    // A unit count is a fact about geography, so it exists exactly where geometry is certified.
    if (!jurisdiction.spatial.parityCertified) {
      assert.equal(jurisdiction.spatial.officialUnits, null, `${jurisdiction.code} has no certified geometry to count`);
    }
  }

  // Saskatchewan is the live-service case: no stored copy and no bundle, so its count comes
  // from the adapter the live certification asserts against the ministry's own service.
  const saskatchewan = report.jurisdictions.find((entry) => entry.code === "CA-SK")!;
  assert.equal(saskatchewan.spatial.parityCertified, true);
  assert.equal(saskatchewan.spatial.officialUnits, 83);
  assert.equal(saskatchewan.regulatory.rules, 0);

  // The headline counts certified geography, not the subset whose rules answer.
  assert.equal(
    report.totals.officialUnitsIngested,
    769,
    "151 + 59 + 62 + 189 Ontario/Québec/Manitoba/Alberta, plus 225 British Columbian and 83 Saskatchewan",
  );
});

test("no national milestone is claimed before its evidence exists", () => {
  const { milestones } = canadaCoverageReport();
  assert.equal(milestones.spatialComplete.met, false, "twelve jurisdictions have no certified geometry");
  assert.equal(milestones.coreGameComplete.met, false, "twelve jurisdictions have no certified rules");
  assert.equal(milestones.migratoryComplete.met, false, "no federal migratory-bird rules exist");
  // The only milestone currently met, and the one that makes the rest honest.
  assert.equal(milestones.coverageAudited.met, true);
});

test("every species row splits covered, declared-closed and unknown", () => {
  // Merging "the authority said no season" with "no row names this unit" is the
  // error that turns a gap in our knowledge into a statement about the law.
  const report = canadaCoverageReport();
  for (const jurisdiction of report.jurisdictions) {
    for (const species of jurisdiction.species) {
      assert.ok(species.unitsCovered >= 0 && species.unitsUnknown >= 0, species.speciesId);
      assert.equal(typeof species.unitsDeclaredClosed, "number", species.speciesId);
      assert.ok(species.rules > 0, `${species.speciesId} is reported as certified with no rules`);
    }
  }
});

test("species coverage is jurisdiction-aware and derived from certified bundles", () => {
  assert.deepEqual(
    regulatoryJurisdictionsForSpecies("species:white-tailed-deer").map(({ id }) => id),
    ["jurisdiction:ca-on", "jurisdiction:ca-qc", "jurisdiction:ca-mb", "jurisdiction:ca-ab"],
  );
  assert.deepEqual(regulatoryJurisdictionsForSpecies("species:gray-wolf"), []);
});

test("the selector gates a species by the resolved jurisdiction, not by a global flag", () => {
  const option = (speciesId: string) => ({
    regulatoryJurisdictions: regulatoryJurisdictionsForSpecies(speciesId).map(({ id, nameEn, requiresInput }) => ({
      id, name: nameEn, asksQuestion: requiresInput,
    })),
  });
  const deer = option("species:white-tailed-deer");
  // Certified in one jurisdiction says nothing about another.
  assert.equal(hasSpeciesCoverageIn(deer, "jurisdiction:ca-on"), true);
  assert.equal(hasSpeciesCoverageIn(deer, "jurisdiction:ca-mb"), true);
  assert.equal(hasSpeciesCoverageIn(deer, "jurisdiction:ca-qc"), true);
  assert.equal(hasSpeciesCoverageIn(deer, "jurisdiction:ca-nb"), false);
  assert.equal(hasSpeciesCoverageIn(option("species:moose"), "jurisdiction:ca-mb"), false);
  assert.equal(speciesAsksQuestionIn(option("species:ruffed-grouse"), "jurisdiction:ca-mb"), false);
  // Before a place is chosen the species is discoverable because rules exist somewhere.
  assert.equal(hasSpeciesCoverageIn(deer), true);
  assert.equal(speciesAsksQuestionIn(deer, "jurisdiction:ca-on"), true);
  assert.equal(speciesAsksQuestionIn(option("species:ruffed-grouse"), "jurisdiction:ca-on"), false);
  // A knowledge-only profile is never evaluable and never promises a question.
  const wolf = option("species:gray-wolf");
  assert.equal(hasSpeciesCoverageIn(wolf), false);
  assert.equal(speciesAsksQuestionIn(wolf), false);
});

test("species coverage is computed from bundles, so every covered species is in the report", () => {
  const report = canadaCoverageReport();
  const reported = new Set(report.jurisdictions.flatMap(({ species }) => species.map(({ speciesId }) => speciesId)));
  for (const speciesId of reported) {
    assert.ok(regulatoryJurisdictionsForSpecies(speciesId, report).length > 0, speciesId);
  }
  assert.equal(reported.size, report.totals.speciesCertified);
});

test("lookups resolve by code and by canonical id", () => {
  assert.equal(jurisdictionByCode("ca-qc")?.nameFr, "Québec");
  assert.equal(jurisdictionById("jurisdiction:ca-on")?.nameEn, "Ontario");
  assert.equal(jurisdictionByCode("CA-XX"), undefined);
});

test("a jurisdiction the owner sets out of scope is reported, never hidden and never counted as complete", async () => {
  const { canadaCoverageReport } = await import("./report.ts");
  const report = canadaCoverageReport();
  assert.deepEqual(report.outOfScope.map((entry) => entry.id).sort(), ["jurisdiction:ca-nt", "jurisdiction:ca-nu"]);
  for (const entry of report.outOfScope) {
    assert.equal(entry.decidedOn, "2026-09-22");
    assert.match(entry.reason, /Owner decision/);
  }
  // Still present in the report with everything known about them, and still declaring their gaps.
  for (const id of ["jurisdiction:ca-nt", "jurisdiction:ca-nu"]) {
    const row = report.jurisdictions.find((entry) => entry.id === id)!;
    assert.ok(row, `${id} stays in the report`);
    assert.ok(row.knownGaps.length > 0, `${id} keeps declaring its gaps`);
    assert.equal(row.spatial.status, "UNAVAILABLE");
  }
  // The milestones are computed over what is in scope, and say so.
  for (const milestone of [report.milestones.spatialComplete, report.milestones.coreGameComplete]) {
    assert.match(milestone.detail, /in-scope/);
    assert.match(milestone.detail, /out of scope by owner decision/);
    assert.doesNotMatch(milestone.detail, /complete/i);
  }
});
