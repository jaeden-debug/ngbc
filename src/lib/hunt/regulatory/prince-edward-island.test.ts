import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePrinceEdwardIsland, PRINCE_EDWARD_ISLAND_BUNDLE, PRINCE_EDWARD_ISLAND_SPECIES } from "./prince-edward-island.ts";
import { regulatoryEntryFor } from "./registry.ts";

/**
 * Prince Edward Island, evaluated from the committed bundle. Every expectation
 * was read from the Hunting and Trapping Seasons Regulations (EC592/16,
 * consolidated to September 3, 2022) and the Hunting Regulations (EC534/19),
 * not from the engine's output.
 */

/* Charlottetown: placed in the province, with no zone, as the province layer places it. */
const CHARLOTTETOWN = {
  jurisdictionId: "jurisdiction:ca-pe",
  zoneName: "Prince Edward Island",
  latitude: 46.2382,
  longitude: -63.1311,
  overlays: new Set<string>(),
};

function status(speciesId: string, date: string) {
  const evaluation = evaluatePrinceEdwardIsland({ speciesId, speciesName: speciesId.slice(8), date, place: CHARLOTTETOWN, answers: {} });
  return evaluation.result!;
}

test("the bundle answers Schedule I and II, every rule for the whole province", () => {
  assert.deepEqual([...PRINCE_EDWARD_ISLAND_SPECIES], [
    "species:american-crow", "species:american-red-squirrel", "species:coyote", "species:gray-partridge", "species:raccoon",
    "species:red-fox", "species:ring-necked-pheasant", "species:ruffed-grouse", "species:snowshoe-hare",
  ]);
  for (const rule of PRINCE_EDWARD_ISLAND_BUNDLE.rules) {
    assert.equal(rule.geography?.include.jurisdiction, "jurisdiction:ca-pe", rule.id);
    assert.deepEqual(rule.geography?.include.ghas, [], rule.id);
  }
});

test("ruffed grouse runs 26 September to 31 December, 3 daily and 6 in possession", () => {
  const open = status("species:ruffed-grouse", "2026-10-30");
  assert.equal(open.status, "CONDITIONAL");
  assert.deepEqual(open.season, { kind: "ABSOLUTE", opens: "2026-09-26", closes: "2026-12-31", datesInclusive: true });
  assert.ok(open.requirements.some((line) => /bullet/.test(line)));
  assert.equal(status("species:ruffed-grouse", "2026-09-25").status, "CLOSED");
});

test("raccoon, coyote and snowshoe hare run 1 October to 31 March, across the new year", () => {
  for (const speciesId of ["species:raccoon", "species:coyote", "species:snowshoe-hare"]) {
    const result = status(speciesId, "2027-02-15");
    assert.equal(result.status, "CONDITIONAL", speciesId);
    assert.deepEqual(result.season, { kind: "ABSOLUTE", opens: "2026-10-01", closes: "2027-03-31", datesInclusive: true });
  }
  assert.equal(status("species:raccoon", "2026-09-15").status, "CLOSED");
});

test("red fox runs 1 November to 31 January", () => {
  assert.equal(status("species:red-fox", "2026-10-30").status, "CLOSED");
  assert.equal(status("species:red-fox", "2026-11-01").status, "CONDITIONAL");
});

test("pheasant has no open season, and is closed because Schedule I says so", () => {
  assert.equal(status("species:ring-necked-pheasant", "2026-10-30").status, "CLOSED");
});

test("partridge is never answered open: Lots 1-10 and 43-47 are excluded and North Ground cannot place them", () => {
  const result = status("species:gray-partridge", "2026-10-30");
  assert.equal(result.status, "NEEDS_VERIFICATION");
  assert.ok(result.limitations.some((limitation) => /Lots 1 to 10 and Lots 43 to 47 may include this point/.test(limitation.text)));
});

test("red squirrel and crow have no closed season, and say the end date is not a closing date", () => {
  for (const speciesId of ["species:american-red-squirrel", "species:american-crow"]) {
    const result = status(speciesId, "2026-07-01");
    assert.equal(result.status, "CONDITIONAL", speciesId);
  }
  for (const rule of PRINCE_EDWARD_ISLAND_BUNDLE.rules.filter((entry) => entry.seasonPhrase === "No closed season")) {
    assert.ok((rule.notes as unknown as string[]).some((note) => /not a closing date/.test(note)), rule.id);
  }
});

test("a species the bundle does not certify is unknown, not closed", () => {
  const result = status("species:moose", "2026-10-30");
  assert.equal(result.status, "UNKNOWN");
});

test("the province's rules are served through its layer", () => {
  assert.equal(regulatoryEntryFor("jurisdiction:ca-pe")?.jurisdictionId, "jurisdiction:ca-pe");
});
