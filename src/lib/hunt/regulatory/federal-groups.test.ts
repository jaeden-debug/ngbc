import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { FEDERAL_GROUPS, federalGroupFor, groupsForSpecies, isRepealedRow } from "./federal-groups.ts";

/**
 * The Migratory Birds Regulations regulate GROUPS. Getting a species into the
 * wrong one, or letting a group's combined limit read as a per-species limit,
 * produces an answer that looks ordinary and tells a hunter they may take six
 * mallards when six is the shared limit across seventeen duck species.
 */

const BUNDLE = JSON.parse(readFileSync("content/regulatory/ca-federal-2026.json", "utf8")) as {
  rules: Array<{ groupId: string; groupStatedAs: string; daily?: { statedAs: string }; declaredNoSeason: boolean }>;
  notEncoded: Array<{ reason: string }>;
};

test("every group carries the regulation's own words", () => {
  for (const group of FEDERAL_GROUPS) {
    assert.ok(group.statedAs.trim().length > 0, group.id);
    assert.equal(group.statedAs, group.statedAs.trim());
  }
});

test("a group is matched on exact words, never on a partial match", () => {
  assert.equal(federalGroupFor("all Ducks, combined")?.id, "federal_group:all-ducks");
  assert.equal(federalGroupFor("(a) all Ducks, combined")?.id, "federal_group:all-ducks");
  /* Case variants the regulation itself uses are aliases, not fuzzy matches. */
  assert.equal(federalGroupFor("All Geese, combined")?.id, "federal_group:all-geese");
  assert.equal(federalGroupFor("Sandhill Crane")?.id, "federal_group:sandhill-cranes");
  /* Anything else is unknown rather than nearest-match. */
  assert.equal(federalGroupFor("Ducks"), undefined);
  assert.equal(federalGroupFor("all Ducks"), undefined);
  assert.equal(federalGroupFor("Geese, combined"), undefined);
});

test("the duck groups that differ by exclusion are NOT merged", () => {
  /*
   * These three read almost identically and carry different limits. A
   * normaliser that lowercased and stripped punctuation would collapse them.
   */
  const ids = new Set([
    federalGroupFor("Ducks (other than Harlequin Ducks), combined")?.id,
    federalGroupFor("Ducks (other than Harlequin Ducks, Common and Red-breasted Mergansers, Long-tailed Ducks, Eiders and Scoters), combined")?.id,
    federalGroupFor("Ducks (other than Harlequin Ducks, Common and Red-breasted Mergansers, Eiders and Scoters), combined")?.id,
  ]);
  assert.equal(ids.size, 3);
  assert.ok(!ids.has(undefined));
});

test("a repealed row is never a rule", () => {
  assert.equal(isRepealedRow("[Repealed, SOR/2024-129, s. 6]"), true);
  assert.equal(isRepealedRow("all Ducks, combined"), false);
});

test("a species in a combined group knows the limit is shared", () => {
  const forMallard = groupsForSpecies("species:mallard");
  assert.ok(forMallard.length > 0, "mallard falls in duck groups");
  for (const group of forMallard) {
    /* Every group mallard is in is a COMBINED group, so no answer derived from
       one may present its number as a mallard-only limit. */
    assert.match(group.statedAs, /combined/);
    assert.ok(group.members.length > 1, `${group.id} must be shared with other species`);
  }
});

test("a group wider than the library says so, because the limit binds more birds", () => {
  const snowRoss = FEDERAL_GROUPS.find((group) => group.id === "federal_group:snow-ross")!;
  assert.deepEqual([...snowRoss.members], ["species:snow-goose"]);
  assert.equal(snowRoss.coversUnlistedSpecies, true, "Ross's Goose shares this limit and is not published");
});

test("a single-species group is not marked as covering more", () => {
  for (const id of ["federal_group:snipe", "federal_group:woodcock", "federal_group:canada-geese"]) {
    const group = FEDERAL_GROUPS.find((entry) => entry.id === id)!;
    assert.equal(group.members.length, 1, id);
    assert.equal(group.coversUnlistedSpecies, false, id);
  }
});

/* ── The built bundle ────────────────────────────────────────────────────── */

test("every encoded rule names its group's own words", () => {
  for (const rule of BUNDLE.rules) {
    const group = FEDERAL_GROUPS.find((entry) => entry.id === rule.groupId);
    assert.ok(group, rule.groupId);
    assert.equal(rule.groupStatedAs, group!.statedAs);
  }
});

test("a declared closure is recorded as such, not as an absence", () => {
  const closures = BUNDLE.rules.filter((rule) => rule.declaredNoSeason);
  assert.ok(closures.length > 0, "Harlequin Duck is closed in wave 1's jurisdictions");
  for (const closure of closures) assert.equal(closure.daily, undefined);
});

test("what the build could not read exactly is refused with a reason, not encoded", () => {
  assert.ok(BUNDLE.notEncoded.length > 0);
  for (const entry of BUNDLE.notEncoded) assert.ok(entry.reason.trim().length > 0);
  /* The refusals that matter most: a limit that varies by who is hunting. */
  assert.ok(BUNDLE.notEncoded.some((entry) => /residency/.test(entry.reason)));
});
