import { SPECIES_TAKE_ELIGIBILITY, takeEligibilityOf } from "../../content/species-eligibility.ts";
import { catalogueSpecies } from "../intelligence/species-catalogue.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
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
  /* Ross's goose is published now, so the snow-and-Ross's group is exactly its
     two named species; the eider groups stay wider because Steller's and
     spectacled eiders share them and are not quarry. */
  const snowRoss = FEDERAL_GROUPS.find((group) => group.id === "federal_group:snow-ross")!;
  assert.deepEqual([...snowRoss.members], ["species:snow-goose", "species:rosss-goose"]);
  assert.equal(snowRoss.coversUnlistedSpecies, false);
  const eiders = FEDERAL_GROUPS.find((group) => group.id === "federal_group:eiders-scoters")!;
  assert.equal(eiders.coversUnlistedSpecies, true);
});

test("no federal group makes a species quarry by inheritance", () => {
  /* The hard invariant: eligibility is evaluated before group expansion. A
     "Swans" or "Eiders" group must never make a NON_QUARRY, LIMITED_TAKE or
     UNKNOWN species answerable as ordinary quarry. */
  for (const group of FEDERAL_GROUPS) {
    for (const id of group.members) {
      assert.ok(SPECIES_TAKE_ELIGIBILITY.has(id), `${group.id}: ${id} is not a published species`);
      assert.ok(["HUNTABLE", "NUISANCE_OR_INVASIVE_TAKE"].includes(takeEligibilityOf(id)), `${group.id}: ${id} is ${takeEligibilityOf(id)}`);
    }
  }
  const eiderMembers = FEDERAL_GROUPS.filter((group) => /Eiders/.test(group.statedAs)).flatMap((group) => group.members);
  assert.ok(!eiderMembers.includes("species:stellers-eider" as never) && !eiderMembers.includes("species:spectacled-eider" as never));
});

test("every published native duck and goose offered as quarry is in the all-ducks or all-geese group", () => {
  /* The completeness half: Schedule 3's "all Ducks" and "all Geese" are the
     whole family, so a catalogue duck missing from them is an answer the
     federal layer silently cannot give. Muscovy is excluded: in Canada it is
     domestic or feral, and North Ground has not established that the
     Convention reaches it. */
  const NOT_MEMBERS = new Set(["species:muscovy-duck"]);
  const all = new Set(FEDERAL_GROUPS.filter((group) => ["federal_group:all-ducks", "federal_group:all-geese"].includes(group.id)).flatMap((group) => group.members));
  const missing = catalogueSpecies()
    .filter(({ speciesId, takeEligibility }) => ["HUNTABLE", "NUISANCE_OR_INVASIVE_TAKE"].includes(takeEligibility) && !NOT_MEMBERS.has(speciesId))
    .filter(({ speciesId }) => groupsOf(speciesId).some((group) => ["species_group:ducks", "species_group:geese"].includes(group)))
    .filter(({ speciesId }) => nativeOf(speciesId))
    .map(({ speciesId }) => speciesId)
    .filter((id) => !all.has(id as never));
  assert.deepEqual(missing, []);
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

function profiles(): Map<string, { groups: string[]; native: boolean }> {
  const out = new Map<string, { groups: string[]; native: boolean }>();
  const master = new Map(readFileSync("research/hunting/species-master.csv", "utf8").trim().split("\n").slice(1)
    .map((line) => { const cells = line.split(","); return [cells[0], cells.includes("INTRODUCED")] as const; }));
  for (const file of readdirSync("content/published").filter((name) => name.startsWith("species-wave") || name === "en-CA.json")) {
    for (const resource of JSON.parse(readFileSync(`content/published/${file}`, "utf8")).resources ?? []) {
      if (resource.type !== "species") continue;
      out.set(resource.speciesProfile.speciesId, { groups: resource.speciesProfile.speciesGroupIds, native: !master.get(resource.speciesProfile.speciesId) });
    }
  }
  return out;
}
const PROFILES = profiles();
const groupsOf = (id: string) => PROFILES.get(id)?.groups ?? [];
const nativeOf = (id: string) => PROFILES.get(id)?.native ?? false;
