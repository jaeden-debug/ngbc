import assert from "node:assert/strict";
import { test } from "node:test";
import { CANADA_JURISDICTIONS, jurisdictionByCode, jurisdictionById } from "./registry.ts";
import { canadaCoverageReport } from "./report.ts";

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

  // Ontario is the only jurisdiction with rules today. If this ever fails
  // because another jurisdiction gained rules, update it deliberately — the
  // test exists so coverage cannot grow without someone noticing.
  const withRules = report.jurisdictions.filter((entry) => entry.regulatory.rules > 0);
  assert.deepEqual(withRules.map((entry) => entry.code), ["CA-ON"]);

  const ontario = withRules[0];
  assert.equal(ontario.species.length, 8, "four small-game plus four major-game species");
  assert.equal(ontario.spatial.officialUnits, 151);
  assert.ok(ontario.regulatory.rules > 100, "Ontario holds the certified rule set");

  // Every other jurisdiction reports zero rather than being absent from the report.
  for (const jurisdiction of report.jurisdictions) {
    if (jurisdiction.code === "CA-ON") continue;
    assert.equal(jurisdiction.regulatory.rules, 0, `${jurisdiction.code} should report zero rules`);
    assert.equal(jurisdiction.regulatory.speciesCertified, 0, `${jurisdiction.code} should report zero species`);
    assert.equal(jurisdiction.spatial.officialUnits, null, `${jurisdiction.code} has no ingested unit count`);
  }
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

test("lookups resolve by code and by canonical id", () => {
  assert.equal(jurisdictionByCode("ca-qc")?.nameFr, "Québec");
  assert.equal(jurisdictionById("jurisdiction:ca-on")?.nameEn, "Ontario");
  assert.equal(jurisdictionByCode("CA-XX"), undefined);
});
