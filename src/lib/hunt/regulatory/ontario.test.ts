import assert from "node:assert/strict";
import test from "node:test";
import { isFederalMigratoryBird } from "./federal.ts";
import { REGULATORY_REGISTRY } from "./registry.ts";
import {
  evaluationShape,
  SUPPORTED_MAJOR_GAME_SPECIES_IDS,
  SUPPORTED_SMALL_GAME_SPECIES_IDS,
  SUPPORTED_SPECIES_IDS,
} from "../coverage.ts";
import { ONTARIO_MAJOR_GAME_SPECIES } from "./major-game.ts";
import type { ZoneResolution } from "../types.ts";
import {
  certifiedUnitsForSpecies, evaluateOntarioSmallGame, ontarioCoverageReport,
  ONTARIO_SMALL_GAME_SPECIES,
} from "./ontario.ts";

/**
 * Ontario small-game regulatory matrix.
 *
 * One representative unit is exercised from every official season grouping, with
 * the full date matrix around each window, so a change to the generated bundle
 * that moves a boundary date or a limit fails here rather than in production.
 */

function zoneOf(identifier: string): ZoneResolution {
  return {
    status: "RESOLVED",
    zoneId: `management_zone:ca-on-wmu-${identifier.toLowerCase()}` as ZoneResolution["zoneId"],
    officialName: `Wildlife Management Unit ${identifier}`,
    boundaryDistanceMeters: 5_000,
    nearBoundary: false,
    sourceId: "source:ca-on-wmu-service",
    message: "Fixture.",
  };
}

const evaluate = (unit: string, speciesId: string, date: string) =>
  evaluateOntarioSmallGame({ speciesId, date }, zoneOf(unit));

/* ── Ruffed grouse: every official grouping ──────────────────────────────── */

test("group 1-4, 16-18, 24-27 runs September 15 to March 31 with a combined limit", () => {
  const unit = "24";
  assert.equal(evaluate(unit, "species:ruffed-grouse", "2026-09-14").status, "NEEDS_VERIFICATION");
  assert.equal(evaluate(unit, "species:ruffed-grouse", "2026-09-15").status, "CONDITIONAL");
  assert.equal(evaluate(unit, "species:ruffed-grouse", "2026-12-31").status, "CONDITIONAL");
  assert.equal(evaluate(unit, "species:ruffed-grouse", "2027-01-01").status, "CONDITIONAL");
  assert.equal(evaluate(unit, "species:ruffed-grouse", "2027-03-31").status, "CONDITIONAL");
  assert.equal(evaluate(unit, "species:ruffed-grouse", "2027-04-01").status, "NEEDS_VERIFICATION");

  const open = evaluate(unit, "species:ruffed-grouse", "2026-11-01");
  assert.deepEqual(open.season, { opens: "2026-09-15", closes: "2027-03-31", datesInclusive: true });
  assert.deepEqual(open.limits, { daily: 5, possession: 15, combinedWith: "spruce grouse" });
});

test("group 5-15, 19-23, 28-50, 53-67, 69B runs September 15 to December 31", () => {
  const unit = "57";
  assert.equal(evaluate(unit, "species:ruffed-grouse", "2026-09-14").status, "CLOSED");
  assert.equal(evaluate(unit, "species:ruffed-grouse", "2026-09-15").status, "CONDITIONAL");
  assert.equal(evaluate(unit, "species:ruffed-grouse", "2026-11-01").status, "CONDITIONAL");
  assert.equal(evaluate(unit, "species:ruffed-grouse", "2026-12-31").status, "CONDITIONAL");
  assert.equal(evaluate(unit, "species:ruffed-grouse", "2027-01-01").status, "NEEDS_VERIFICATION");

  const open = evaluate(unit, "species:ruffed-grouse", "2026-10-15");
  assert.deepEqual(open.season, { opens: "2026-09-15", closes: "2026-12-31", datesInclusive: true });
  assert.deepEqual(open.limits, { daily: 5, possession: 15, combinedWith: "spruce grouse" });
});

test("group 68, 73-76, 82-84 runs September 25 to December 31 with no combined limit", () => {
  for (const unit of ["68A", "68B", "73", "76E", "84"]) {
    assert.equal(evaluate(unit, "species:ruffed-grouse", "2026-09-24").status, "CLOSED", unit);
    assert.equal(evaluate(unit, "species:ruffed-grouse", "2026-09-25").status, "CONDITIONAL", unit);
    assert.equal(evaluate(unit, "species:ruffed-grouse", "2026-12-31").status, "CONDITIONAL", unit);
    assert.equal(evaluate(unit, "species:ruffed-grouse", "2027-01-01").status, "NEEDS_VERIFICATION", unit);
  }
  const open = evaluate("68A", "species:ruffed-grouse", "2026-10-15");
  assert.deepEqual(open.limits, { daily: 5, possession: 15 });
  assert.equal(open.limits?.combinedWith, undefined, "this grouping has no spruce grouse season to combine with");
});

test("group 69A, 70-72, 77-81, 85-95 carries the smaller two-bird limit", () => {
  for (const unit of ["69A-1", "69A-3", "70", "80", "95"]) {
    assert.equal(evaluate(unit, "species:ruffed-grouse", "2026-09-25").status, "CONDITIONAL", unit);
    assert.deepEqual(evaluate(unit, "species:ruffed-grouse", "2026-10-15").limits, { daily: 2, possession: 6 }, unit);
  }
});

/* ── The bare-number reading, exercised ──────────────────────────────────── */

test("a bare number in the published table reaches every lettered sub-unit", () => {
  // The summary writes "68"; the official layer has 68A and 68B and no bare 68.
  // If the expansion were wrong these two would be UNKNOWN rather than certified.
  for (const unit of ["68A", "68B"]) {
    assert.equal(evaluate(unit, "species:ruffed-grouse", "2026-10-15").status, "CONDITIONAL", unit);
  }
  // "69A" covers its three numbered parts.
  for (const unit of ["69A-1", "69A-2", "69A-3"]) {
    assert.equal(evaluate(unit, "species:ruffed-grouse", "2026-10-15").status, "CONDITIONAL", unit);
  }
  // 69B is named separately and belongs to a different grouping with a combined limit.
  assert.deepEqual(
    evaluate("69B", "species:ruffed-grouse", "2026-10-15").limits,
    { daily: 5, possession: 15, combinedWith: "spruce grouse" },
  );
});

test("ruffed grouse is certified for every official unit except the one no row names", () => {
  const certified = certifiedUnitsForSpecies("species:ruffed-grouse");
  assert.equal(certified.length, 150);
  assert.equal(certified.includes("51"), false);
});

/* ── WMU 51: absence is not closure ──────────────────────────────────────── */

test("a unit no season row names is UNKNOWN, never CLOSED", () => {
  const result = evaluate("51", "species:ruffed-grouse", "2026-10-15");
  assert.equal(result.status, "UNKNOWN");
  assert.match(result.summary, /not evidence that the season is closed/);
  assert.equal(result.season, undefined, "an uncertified unit must not carry season dates");
  assert.equal(result.limits, undefined, "an uncertified unit must not carry limits");
});

/* ── Spruce grouse: certified where stated, closed where excluded ────────── */

test("spruce grouse is certified only where the source gives it a season", () => {
  assert.equal(evaluate("57", "species:spruce-grouse", "2026-10-15").status, "CONDITIONAL");
  assert.deepEqual(
    evaluate("57", "species:spruce-grouse", "2026-10-15").limits,
    { daily: 5, possession: 15, combinedWith: "ruffed grouse" },
  );
  assert.equal(certifiedUnitsForSpecies("species:spruce-grouse").length, 85);
});

test("spruce grouse is CLOSED where the source explicitly states no season", () => {
  // "Ruffed grouse seasons (no season for spruce grouse in these units)" is an
  // official statement, so CLOSED here is asserting what the source says.
  for (const unit of ["68A", "73", "95"]) {
    const result = evaluate(unit, "species:spruce-grouse", "2026-10-15");
    assert.equal(result.status, "CLOSED", unit);
    assert.match(result.summary, /no season for spruce grouse/i);
  }
});

/* ── Sharp-tailed grouse: genuinely narrower ─────────────────────────────── */

test("sharp-tailed grouse covers fewer units and is UNKNOWN elsewhere", () => {
  const certified = certifiedUnitsForSpecies("species:sharp-tailed-grouse");
  assert.equal(certified.length, 85);
  assert.equal(evaluate("24", "species:sharp-tailed-grouse", "2026-10-15").status, "CONDITIONAL");
  assert.deepEqual(evaluate("57", "species:sharp-tailed-grouse", "2026-10-15").limits, { daily: 2, possession: 6 });

  // No sharp-tailed grouse row names the far-northern units. That is UNKNOWN,
  // not a certified closure, and the two must not be conflated.
  const northern = evaluate("95", "species:sharp-tailed-grouse", "2026-10-15");
  assert.equal(northern.status, "UNKNOWN");
});

/* ── Snowshoe hare, including the last day of February ───────────────────── */

test("snowshoe hare runs to the last day of February in the northern grouping", () => {
  assert.equal(evaluate("95", "species:snowshoe-hare", "2026-09-24").status, "NEEDS_VERIFICATION");
  assert.equal(evaluate("95", "species:snowshoe-hare", "2026-09-25").status, "CONDITIONAL");
  assert.equal(evaluate("95", "species:snowshoe-hare", "2027-02-28").status, "CONDITIONAL");
  assert.equal(evaluate("95", "species:snowshoe-hare", "2027-03-01").status, "NEEDS_VERIFICATION");
  assert.deepEqual(evaluate("95", "species:snowshoe-hare", "2026-10-15").limits, { daily: 2, possession: 6 });

  const southern = evaluate("57", "species:snowshoe-hare", "2026-10-15");
  assert.equal(southern.status, "CONDITIONAL");
  assert.deepEqual(southern.season, { opens: "2026-09-15", closes: "2027-03-31", datesInclusive: true });
  assert.deepEqual(southern.limits, { daily: 5, possession: 15 });
});

/* ── Zone and species boundaries ─────────────────────────────────────────── */

test("an unresolved zone never produces a regulatory answer", () => {
  const unresolved: ZoneResolution = {
    status: "UNKNOWN", sourceId: "source:ca-on-wmu-service", message: "No feature",
  };
  const result = evaluateOntarioSmallGame({ speciesId: "species:ruffed-grouse", date: "2026-10-15" }, unresolved);
  assert.equal(result.status, "NEEDS_VERIFICATION");
  assert.equal(result.season, undefined);
});

test("a species with no Ontario small-game rule is UNKNOWN rather than an error", () => {
  const result = evaluate("57", "species:moose", "2026-10-15");
  assert.equal(result.status, "UNKNOWN");
  assert.match(result.summary, /No certified rule covers this species/);
});

/* ── Provenance gate ─────────────────────────────────────────────────────── */

test("every certified result can name the authority that produced it", () => {
  const combinations: Array<[string, string]> = [
    ["57", "species:ruffed-grouse"], ["24", "species:ruffed-grouse"], ["68A", "species:ruffed-grouse"],
    ["95", "species:ruffed-grouse"], ["57", "species:spruce-grouse"], ["24", "species:sharp-tailed-grouse"],
    ["95", "species:snowshoe-hare"],
  ];
  for (const [unit, speciesId] of combinations) {
    const result = evaluate(unit, speciesId, "2026-10-15");
    assert.ok(result.sourceIds.length >= 1, `${unit}/${speciesId} must cite a source`);
    assert.ok(result.sourceIds.includes("source:ca-on-small-game-2026"), `${unit}/${speciesId} must cite the small game summary`);
    assert.match(result.verifiedAt, /^\d{4}-\d{2}-\d{2}$/, `${unit}/${speciesId} must carry a verification date`);
  }
});

test("a result never claims a hunting zone is a place you may hunt", () => {
  const result = evaluate("57", "species:ruffed-grouse", "2026-10-15");
  assert.ok(
    result.limitations.some((item) => /land access|permission to hunt|not permission/i.test(item)),
    "the answer must keep zone membership and land access apart",
  );
});

/* ── Coverage bookkeeping ────────────────────────────────────────────────── */

test("the browser-facing species lists match the regulatory bundles exactly", () => {
  // coverage.ts lists these literally so ~225 KB of rules stays off the client.
  // This is what stops the two drifting apart.
  assert.deepEqual(
    [...SUPPORTED_SMALL_GAME_SPECIES_IDS].sort(),
    [...ONTARIO_SMALL_GAME_SPECIES].sort(),
  );
  assert.deepEqual(
    [...SUPPORTED_MAJOR_GAME_SPECIES_IDS].sort(),
    [...ONTARIO_MAJOR_GAME_SPECIES].sort(),
  );
  /*
   * The selector also accepts the migratory game birds, which are certified
   * FEDERALLY rather than by any province and so appear in no Ontario list.
   * Stated as a partition so neither half can quietly absorb the other: every
   * selectable species is either an Ontario-engine species or a federal
   * migratory bird, and never both.
   */
  const provincial = new Set<string>([...ONTARIO_SMALL_GAME_SPECIES, ...ONTARIO_MAJOR_GAME_SPECIES]);
  const migratory = SUPPORTED_SPECIES_IDS.filter((id) => isFederalMigratoryBird(id));
  for (const id of migratory) assert.ok(!provincial.has(id), `${id} is both provincial and federal`);
  assert.deepEqual(
    [...SUPPORTED_SPECIES_IDS].sort(),
    [...provincial, ...migratory].sort(),
    "every selectable species is provincially certified or a federal migratory bird",
  );
});

test("small game and major game never overlap", () => {
  // A species answered by both engines would get two different statuses for the
  // same hunt, and nothing decides which one a reader sees.
  const overlap = SUPPORTED_SMALL_GAME_SPECIES_IDS.filter((id) =>
    (SUPPORTED_MAJOR_GAME_SPECIES_IDS as readonly string[]).includes(id));
  assert.deepEqual(overlap, []);
});

test("every selectable species is routed to an engine", () => {
  // A species in the selector with no engine would reach evaluation and fall
  // through to small game, which would answer from the wrong bundle.
  for (const id of SUPPORTED_SPECIES_IDS) {
    const smallGame = (ONTARIO_SMALL_GAME_SPECIES as readonly string[]).includes(id);
    const majorGame = (ONTARIO_MAJOR_GAME_SPECIES as readonly string[]).includes(id);
    if (isFederalMigratoryBird(id)) {
      /*
       * A migratory game bird is answered by the federal path, and Ontario's
       * engine is never asked about it. That is the whole hazard this test
       * guards: asked anyway, the engine falls through to small game and
       * returns a grouse season for a mallard, which reads as a normal answer.
       * `evaluateRegulation` now asks an engine only about species its own
       * bundle certifies, so the fall-through cannot be reached.
       */
      assert.ok(!smallGame && !majorGame, `${id} is federal and must not be in an Ontario engine list`);
      continue;
    }
    assert.ok(smallGame !== majorGame, `${id} must be handled by exactly one engine`);
    assert.equal(evaluationShape(id), majorGame ? "CONDITIONAL" : "DIRECT");
  }
});

test("an engine is never asked about a species its own bundle does not certify", () => {
  /*
   * The guard that makes the above true, asserted directly rather than
   * inferred. Ontario's coverage must not name a species Ontario does not
   * certify, whatever the selector offers nationally.
   */
  const ontario = REGULATORY_REGISTRY.find((entry) => entry.jurisdictionId === "jurisdiction:ca-on")!;
  const certified = new Set(ontario.coverage().species.map((row) => row.speciesId));
  for (const id of SUPPORTED_SPECIES_IDS) {
    if (certified.has(id)) continue;
    assert.ok(isFederalMigratoryBird(id) || !certified.has(id), `${id} leaked into Ontario coverage`);
  }
  for (const id of certified) {
    assert.ok(!isFederalMigratoryBird(id), `${id} is federal and must not be in Ontario's coverage`);
  }
});

test("the coverage report counts units rather than claiming a province", () => {
  const report = ontarioCoverageReport();
  assert.equal(report.officialUnits, 151);
  assert.equal(report.sourceVersion, "2026");

  const byId = new Map(report.species.map((entry) => [entry.speciesId, entry]));
  assert.equal(byId.get("species:ruffed-grouse")?.certifiedUnits, 150);
  assert.equal(byId.get("species:ruffed-grouse")?.unknownUnits, 1);
  assert.equal(byId.get("species:spruce-grouse")?.certifiedUnits, 85);
  assert.equal(byId.get("species:sharp-tailed-grouse")?.certifiedUnits, 85);
  assert.equal(byId.get("species:snowshoe-hare")?.certifiedUnits, 150);

  for (const entry of report.species) {
    assert.equal(
      entry.certifiedUnits + entry.declaredNoSeasonUnits + entry.unknownUnits,
      report.officialUnits,
      `${entry.speciesId} must account for every official unit`,
    );
  }
});
