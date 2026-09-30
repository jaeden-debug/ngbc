import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { SPECIES_TAKE_ELIGIBILITY, takeEligibilityOf } from "./species-eligibility.ts";
import { allTakeEvidenceJurisdictionIds, jurisdictionDisplayName, speciesWithTakeListings, takeListingsFor } from "./species-take-evidence.ts";

/**
 * Completeness gates for the jurisdiction-first audit. The matrix is generated,
 * so these check what the generator produced against the catalogue — and each
 * one fails on the specific animal or jurisdiction, never on a count.
 */

function matrixRows(): Array<Record<string, string>> {
  const [head, ...lines] = readFileSync("research/hunting/species-take-matrix.csv", "utf8").trim().split("\n");
  const keys = head.split(",");
  return lines.map((line) => {
    const values: string[] = [];
    let cell = "", quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"' && quoted) { cell += '"'; i += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { values.push(cell); cell = ""; }
      else cell += char;
    }
    values.push(cell);
    return Object.fromEntries(keys.map((key, index) => [key, values[index] ?? ""]));
  });
}

test("every animal an audited authority lists for take resolves to a published species or a recorded exclusion", () => {
  /* Gate A. A row with a take status is an animal someone may legally take
     somewhere; it must be a catalogue species or a documented exclusion. A
     CLOSED row for an animal outside the catalogue is not a coverage gap. */
  const rows = matrixRows();
  assert.ok(rows.length > 3000, "the matrix should hold the whole audit; an empty one would pass vacuously");
  const takeStatuses = new Set(["OPEN_SEASON", "YEAR_ROUND", "PERMIT_OR_DRAW", "UNPROTECTED"]);
  const unmapped = [...new Set(rows.filter((row) => row.resolution === "UNMAPPED" && takeStatuses.has(row.status)).map((row) => `${row.member} (${row.jurisdiction})`))];
  assert.deepEqual(unmapped, [], `authority-listed animals with no canonical species or exclusion:\n${unmapped.join("\n")}`);
});

test("every listing names a jurisdiction the registries can name", () => {
  const unnamed = allTakeEvidenceJurisdictionIds().filter((id) => !jurisdictionDisplayName(id));
  assert.deepEqual(unnamed, []);
});

test("every listed species is a published species", () => {
  const missing = speciesWithTakeListings().filter((id) => !SPECIES_TAKE_ELIGIBILITY.has(id));
  assert.deepEqual(missing, []);
});

function findings(): Array<Record<string, string>> {
  const [head, ...lines] = readFileSync("research/hunting/take-eligibility-conflicts.csv", "utf8").trim().split("\n");
  const keys = head.split(",");
  return lines.map((line) => {
    const values: string[] = [];
    let cell = "", quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"' && quoted) { cell += '"'; i += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { values.push(cell); cell = ""; }
      else cell += char;
    }
    values.push(cell);
    return Object.fromEntries(keys.map((key, index) => [key, values[index] ?? ""]));
  });
}

const TAKE_STATUSES = new Set(["OPEN_SEASON", "YEAR_ROUND", "PERMIT_OR_DRAW", "UNPROTECTED"]);

test("no silent contradiction: a non-quarry or unknown species with take evidence has a recorded finding", () => {
  /* The validator the owner asked for. An authority row giving take of a
     species classed NON_QUARRY or UNKNOWN means the class or the evidence is
     wrong, and a human decides which — in take-eligibility-conflicts.csv. */
  const recorded = new Set(findings().map((row) => `${row.species_id}|${row.jurisdiction_id}`));
  const unrecorded = [...new Set(matrixRows()
    .filter((row) => row.speciesId && TAKE_STATUSES.has(row.status) && row.status !== "UNPROTECTED" && row.confidence !== "LOW")
    .filter((row) => ["NON_QUARRY", "UNKNOWN"].includes(takeEligibilityOf(row.speciesId)))
    .map((row) => `${row.speciesId}|jurisdiction:${row.jurisdiction}`))]
    .filter((key) => !recorded.has(key));
  assert.deepEqual(unrecorded, []);
  const established = findings().filter((row) => row.finding === "ESTABLISHED" && ["NON_QUARRY", "UNKNOWN"].includes(takeEligibilityOf(row.species_id)));
  assert.deepEqual(established.map(({ species_id }) => species_id), [], "an ESTABLISHED finding contradicts a non-quarry class");
});

test("every recorded finding is about a row the audit still holds", () => {
  const present = new Set(matrixRows().map((row) => `${row.speciesId}|jurisdiction:${row.jurisdiction}`));
  const stale = findings().filter((row) => !present.has(`${row.species_id}|${row.jurisdiction_id}`)).map((row) => `${row.species_id}|${row.jurisdiction_id}`);
  assert.deepEqual(stale, []);
});

test("a LIMITED_TAKE species is listed somewhere, and only where evidence names it", () => {
  const limited = speciesWithTakeListings().concat([...SPECIES_TAKE_ELIGIBILITY.keys()])
    .filter((id, index, all) => all.indexOf(id) === index && takeEligibilityOf(id) === "LIMITED_TAKE");
  assert.ok(limited.includes("species:trumpeter-swan"));
  const unlisted = limited.filter((id) => takeListingsFor(id).length === 0);
  assert.deepEqual(unlisted, [], "LIMITED_TAKE needs at least one species-specific listing");
});

test("unprotected status alone never admits a species to the quarry universe", () => {
  /* Owner inclusion rule: a named season, game class, licence, bag limit or
     draw admits a species; "unprotected" or "may be killed" alone does not.
     A species offered in Hunt whose only listings are UNPROTECTED is refused. */
  const onlyUnprotected = speciesWithTakeListings()
    .filter((id) => takeEligibilityOf(id) !== "NON_QUARRY" && takeEligibilityOf(id) !== "UNKNOWN")
    .filter((id) => takeListingsFor(id).every(({ statuses }) => statuses.every((status) => status === "UNPROTECTED")));
  assert.deepEqual(onlyUnprotected, []);
});

test("a known listing reads the way the page will show it (positive control)", () => {
  const moose = takeListingsFor("species:moose");
  assert.ok(moose.some(({ jurisdictionId, takeModes }) => jurisdictionId === "jurisdiction:ca-on" && takeModes.includes("HUNTING")));
  assert.ok(moose.every(({ sourceIds }) => sourceIds.length > 0), "every listing carries the source that was read");
});
