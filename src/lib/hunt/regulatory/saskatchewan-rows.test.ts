import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SASKATCHEWAN_ZONES } from "./saskatchewan-geography.ts";
import { SECTION_ENVELOPES, implementsPermittedIn } from "./saskatchewan-methods.ts";

/**
 * The Saskatchewan season rows, held against the derivations that will consume them.
 *
 * `content/regulatory/sources/ca-sk-open-seasons-rows.json` is the normalised season
 * rows of W-13.12 Reg 3 — derived regulatory facts, which §44 permits North Ground
 * to store with attribution, rather than a copy of the instrument's prose. It cost
 * nine extraction passes and nine adversarial verification passes to produce, so it
 * is committed as a build input rather than regenerated, and this file is what stops
 * it rotting silently against the two modules that correct it.
 */

interface Row {
  section: string;
  seasonName: string | null;
  zones: string[];
  unresolvedGeography: string[];
  licenceClasses: string[];
  opensStatedAs: string;
  closesStatedAs: string;
  speciesStatedAs: string;
  methods: string[];
}

interface Artefact {
  artefact: string;
  source: Record<string, string>;
  counts: Record<string, number>;
  whatMustNotBeTrustedHere: string[];
  sectionToSeasonName: Record<string, string>;
  groups: Array<{ group: string; rows: Row[]; verification: string }>;
}

function artefact(): Artefact {
  const path = join(process.cwd(), "content", "regulatory", "sources", "ca-sk-open-seasons-rows.json");
  return JSON.parse(readFileSync(path, "utf8")) as Artefact;
}

const rows = (a: Artefact): Row[] => a.groups.flatMap((group) => group.rows);

test("the artefact's own counts are the counts in it", () => {
  /* The positive control. Every other assertion here reads the rows, so a file
     that lost its rows would pass them all by having nothing to fail on. */
  const a = artefact();
  const all = rows(a);
  assert.equal(all.length, a.counts.rows);
  assert.equal(all.length, 197);
  assert.equal(all.filter((row) => row.zones.length > 0).length, a.counts.rowsWithResolvableZones);
  /* 138 rows state zones themselves; the 12 upland bird rows are filled from the
     Game Bird District derivation, which is why it is 150 rather than 138. */
  assert.equal(a.counts.rowsWithResolvableZones, 150);
  assert.equal(all.filter((row) => row.zones.length === 0).length, a.counts.rowsWhoseGeographyIsOnlyParks);
  assert.equal(a.counts.rowsWithNoSeasonName, 13);
  assert.equal(a.counts.rowsWhoseGeographyIsOnlyParks, 47);
  assert.equal(a.groups.length, 9);
});

test("it carries its provenance and the unofficial-consolidation notice", () => {
  /* §44: derived facts are storable WITH attribution. A row set without its
     instrument, its chapter and its consolidation point is not attributable. */
  const { source } = artefact();
  assert.equal(source.chapter, "W-13.12 Reg 3");
  assert.match(source.instrument, /Open Seasons Game Regulations, 2009/);
  assert.match(source.url, /^https:\/\/publications\.saskatchewan\.ca\//);
  assert.match(source.consolidatedThrough, /SR 50\/2026/);
  assert.match(source.unofficialConsolidationNotice, /This consolidation is not official/,
    "the King's Printer's own caveat travels with the facts");
  assert.ok(source.retrievedAt);
});

test("it warns, in the file, that its methods field must not be trusted", () => {
  /* The methods were read off section HEADINGS, which are not provisions, and the
     regulation's envelopes nest — a bow is lawful in the muzzleloader season. A
     future builder reaching for `methods` would report a false CLOSED, so the file
     says so rather than relying on anyone having read a commit message. */
  const { whatMustNotBeTrustedHere } = artefact();
  assert.ok(whatMustNotBeTrustedHere.length >= 3);
  const methodsWarning = whatMustNotBeTrustedHere.find((line) => line.includes("`methods`"));
  assert.ok(methodsWarning, "the methods field must carry its warning");
  assert.match(methodsWarning, /saskatchewan-methods\.ts/, "and must name where to get the right answer");
  assert.match(methodsWarning, /nest/);
});

test("every season row names a season the envelope table knows", () => {
  /* This is the join the builder makes, so it is asserted here rather than
     discovered at build time. The 25 rows with no season name are the upland bird
     LIMITS sections (52 to 58), which grant no season. */
  const a = artefact();
  const withName = rows(a).filter((row) => row.seasonName);
  const withoutName = rows(a).filter((row) => !row.seasonName);
  /* Thirteen rows name no season, and all thirteen are in ss. 52 to 58 — the
     upland bird LIMITS sections, which impose bag and possession limits rather
     than granting a season. */
  assert.equal(withoutName.length, 13);
  for (const row of withoutName) {
    const section = Number(row.section.split("(")[0]);
    assert.ok(section >= 52 && section <= 58,
      `${row.section} has no season name but is not a limits section`);
  }
  /*
   * THE SIX UPLAND BIRD SEASONS HAVE NO METHOD ENVELOPE, AND THAT IS THE
   * REGULATION'S SHAPE RATHER THAN A GAP.
   *
   * Every big-game section opens with a subsection naming the permitted means;
   * ss. 46 to 51 open with "The open seasons for X are the open seasons established
   * pursuant to this section" and name none. So a bird rule carries NO permitted
   * implements — unconstrained — and `saskatchewan-methods.ts` deliberately has no
   * entry for them. Asserting that absence here is what stops someone "fixing" it
   * by inventing a set.
   */
  const noEnvelope = new Set(
    (a as unknown as { seasonsWithNoMethodEnvelope: { sections: string[] } }).seasonsWithNoMethodEnvelope.sections);
  assert.deepEqual([...noEnvelope].sort(), ["46", "47", "48", "49", "50", "51"]);
  for (const row of withName) {
    const section = row.section.split("(")[0];
    if (noEnvelope.has(section)) {
      assert.ok(!SECTION_ENVELOPES[row.seasonName!],
        `${row.section} is an upland bird season and must carry no method envelope`);
      continue;
    }
    assert.ok(SECTION_ENVELOPES[row.seasonName!],
      `${row.section} names the "${row.seasonName}" season, which the envelope table does not know`);
    assert.ok(implementsPermittedIn(row.seasonName!).length > 0);
  }
  /* And s. 35 is in there — the season a missing "than" in the regulation hid. */
  assert.equal(a.sectionToSeasonName["35"], "mule deer shotgun special");
});

test("every zone a row names is a zone the province publishes", () => {
  /* A designation not in the ministry's own list can never be resolved, so a rule
     carrying one is encoded coverage that answers nothing (§8). */
  const known = new Set(SASKATCHEWAN_ZONES);
  for (const row of rows(artefact())) {
    for (const zone of row.zones) {
      assert.ok(known.has(zone), `${row.section} names ${zone}, which the province does not publish`);
    }
    assert.equal(new Set(row.zones).size, row.zones.length, `${row.section} repeats a zone`);
  }
});

test("a row states a month and a day and never a year", () => {
  /* The regulation's dates are month and day with no year, because its seasons
     stand and recur until amended. A year appearing here would mean someone had
     already derived one, and the derivation belongs to the builder with the
     certified period beside it. */
  const MONTH = "(?:January|February|March|April|May|June|July|August|September|October|November|December)";
  /* Fourteen rows carry the regulation's own cross-year qualifiers — "December 30
     in the current year", "January 14 in the following year", "November 1 in each
     year", "August 15 in one year". Those are kept verbatim rather than normalised,
     because which year a bound falls in IS the fact. */
  const bound = new RegExp(`^${MONTH} \\d{1,2}(?: in (?:the current|the following|each|one) year)?$`);
  const year = /\b(?:19|20)\d\d\b/;
  let crossYearPhrasings = 0;
  for (const row of rows(artefact())) {
    if (!row.seasonName) continue;
    for (const [field, value] of [["opens", row.opensStatedAs], ["closes", row.closesStatedAs]] as const) {
      assert.match(value, bound, `${row.section} ${field} "${value}"`);
      /* The invariant that actually matters: no row has already had a year
         derived into it. The derivation belongs to the builder, with the
         certified period beside it. */
      assert.doesNotMatch(value, year, `${row.section} ${field} carries a derived year`);
      if (value.includes("year")) crossYearPhrasings += 1;
    }
  }
  assert.equal(crossYearPhrasings, 12, "the cross-year bounds are counted, so one lost would show");
});

test("every row that resolves no zone says what its geography is instead", () => {
  /* The one state that cannot be acted on and cannot be audited is empty zones AND
     empty unresolved geography: indistinguishable from "no geography was found".
     Each of the 59 park-only rows names the parks it is in, so a future park layer
     makes them live rather than leaving them to be re-read. */
  for (const row of rows(artefact())) {
    if (row.zones.length > 0 || !row.seasonName) continue;
    assert.ok(row.unresolvedGeography.length > 0,
      `${row.section} resolves no zone and names no geography either`);
  }
});

test("every group records whether it was adversarially verified, and what was found", () => {
  for (const group of artefact().groups) {
    assert.ok(["CLEAN", "DEFECTS_FOUND", "NONE"].includes(group.verification),
      `${group.group} must record its verification outcome`);
    assert.notEqual(group.verification, "NONE", `${group.group} was never verified`);
  }
});

test("the bird rows reach their districts' zones, and never the Prince Albert one", () => {
  /* The bird rows arrived with no geography at all and are filled from the
     regulation's own Game Bird Management Unit definitions. What that fill must
     never do is reach the Prince Albert zone: the regulation names it in no unit,
     so it is in no district, and a bird season claimed there would be a season the
     instrument does not grant. */
  const a = artefact();
  const birds = a.groups.find((group) => group.group === "upland-birds");
  assert.ok(birds);
  const seasons = birds.rows.filter((row) => row.seasonName);
  assert.equal(seasons.length, 12);
  for (const row of seasons) {
    assert.ok(row.zones.length > 0, `${row.section} must reach zones`);
    assert.ok(!row.zones.includes("PWMZ"),
      `${row.section} reaches the Prince Albert zone, which is in no Game Bird Management Unit`);
    assert.ok(row.unresolvedGeography.length > 0,
      `${row.section} must name the parks and wildlife areas its units also include`);
    const districts = (row as unknown as { districtsStatedAs?: string[] }).districtsStatedAs ?? [];
    assert.ok(districts.length > 0, `${row.section} must record which districts it was filled from`);
    const expected = districts.includes("NORTH") && districts.includes("SOUTH") ? 82
      : districts.includes("NORTH") ? 31 : 51;
    assert.equal(row.zones.length, expected,
      `${row.section} states ${districts.join("+")} and must reach ${expected} zones`);
  }
  const fill = (a as unknown as { howBirdGeographyWasFilled: { zonesInNoDistrict: string[] } }).howBirdGeographyWasFilled;
  assert.deepEqual(fill.zonesInNoDistrict, ["PWMZ"]);
});

