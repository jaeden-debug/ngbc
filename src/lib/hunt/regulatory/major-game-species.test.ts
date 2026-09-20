import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CanonicalId } from "../../content-contract/index.ts";
import type { ZoneResolution } from "../types.ts";
import { evaluateOntarioMajorGame, ONTARIO_MAJOR_GAME_SPECIES, majorGameCoverageReport } from "./major-game.ts";
import { ONTARIO_METHODS, ONTARIO_RESIDENCY } from "./dimensions.ts";

/**
 * Turkey, black bear and moose.
 *
 * Each is shaped differently by the province and each breaks a different naive
 * assumption: turkey has no residency split and no rifle season at all, bear
 * publishes no implements in its headings and lets a footnote set them, and
 * moose is gated by the tag drawn rather than by the weapon carried.
 */

const TURKEY = "species:wild-turkey";
const BEAR = "species:american-black-bear";
const MOOSE = "species:moose";

function zone(unit: string): ZoneResolution {
  return {
    status: "RESOLVED",
    zoneId: `management_zone:ca-on-wmu-${unit.toLowerCase()}` as CanonicalId<"management_zone">,
    officialName: unit,
    sourceId: "source:ca-on-wmu-layer" as CanonicalId<"source">,
    message: `Wildlife management unit ${unit}.`,
  };
}

describe("Wild turkey", () => {
  it("never asks for residency, because the province publishes one column for both", () => {
    const evaluation = evaluateOntarioMajorGame({ speciesId: TURKEY, date: "2026-04-30" }, zone("60"), {});
    assert.equal(evaluation.required?.id, "HUNT_METHOD");
    assert.ok(!evaluation.dimensions.some((dimension) => dimension.id === "RESIDENCY"));
  });

  it("opens the spring season to a shotgun", () => {
    const { result } = evaluateOntarioMajorGame(
      { speciesId: TURKEY, date: "2026-04-30" }, zone("60"),
      { HUNT_METHOD: ONTARIO_METHODS.SHOTGUN },
    );
    assert.equal(result!.status, "CONDITIONAL");
    assert.deepEqual(result!.season, { opens: "2026-04-25", closes: "2026-05-31", datesInclusive: true });
  });

  it("closes it to a rifle, because no turkey season permits one anywhere", () => {
    const { result } = evaluateOntarioMajorGame(
      { speciesId: TURKEY, date: "2026-04-30" }, zone("60"),
      { HUNT_METHOD: ONTARIO_METHODS.RIFLE },
    );
    assert.equal(result!.status, "CLOSED");
  });

  it("separates the two fall seasons, which end on different dates", () => {
    const late = { speciesId: TURKEY, date: "2026-10-30" };
    const bow = evaluateOntarioMajorGame(late, zone("60"), { HUNT_METHOD: ONTARIO_METHODS.BOW });
    const shotgun = evaluateOntarioMajorGame(late, zone("60"), { HUNT_METHOD: ONTARIO_METHODS.SHOTGUN });
    assert.equal(bow.result!.status, "CONDITIONAL", "the archery season runs to 31 October");
    assert.equal(shotgun.result!.status, "CLOSED", "the shotgun season ended on 25 October");
  });

  it("carries the bearded-bird restriction in spring and not in fall", () => {
    const spring = evaluateOntarioMajorGame(
      { speciesId: TURKEY, date: "2026-04-30" }, zone("60"), { HUNT_METHOD: ONTARIO_METHODS.SHOTGUN });
    const fall = evaluateOntarioMajorGame(
      { speciesId: TURKEY, date: "2026-10-20" }, zone("60"), { HUNT_METHOD: ONTARIO_METHODS.SHOTGUN });
    const bearded = (requirements: string[]) => requirements.some((line) => /bearded turkeys/i.test(line));
    assert.ok(bearded(spring.result!.requirements), "spring is restricted to bearded birds");
    assert.ok(!bearded(fall.result!.requirements), "the fall season is not");
  });

  it("reports UNKNOWN in a unit with no turkey row", () => {
    const { result } = evaluateOntarioMajorGame({ speciesId: TURKEY, date: "2026-04-30" }, zone("1A"), {});
    assert.equal(result!.status, "UNKNOWN");
  });
});

describe("Black bear", () => {
  it("applies a footnote that sets the implements a heading never named", () => {
    // WMU 7A: "Only bows and muzzle-loading guns are permitted", under tables
    // whose headings say nothing about implements at all.
    const { result } = evaluateOntarioMajorGame(
      { speciesId: BEAR, date: "2026-05-10" }, zone("7A"),
      { HUNT_METHOD: ONTARIO_METHODS.RIFLE },
    );
    assert.equal(result!.status, "CLOSED");
  });

  it("states that restriction even when it asks no question about it", () => {
    // Every rule for 7A permits the same narrowed set, so there is nothing to
    // ask — but a rifle hunter reading CONDITIONAL without this line would be
    // reading a wrong answer.
    const evaluation = evaluateOntarioMajorGame({ speciesId: BEAR, date: "2026-05-10" }, zone("7A"), {});
    assert.equal(evaluation.completeness, "RESOLVED");
    assert.equal(evaluation.result!.status, "CONDITIONAL");
    assert.ok(
      evaluation.result!.requirements.some((line) => /only muzzle-loading guns and bows are permitted/i.test(line)),
    );
  });

  it("does not add that line where every implement is permitted", () => {
    const { result } = evaluateOntarioMajorGame({ speciesId: BEAR, date: "2026-05-10" }, zone("30"), {});
    assert.ok(!result!.requirements.some((line) => /only .* are permitted/i.test(line)));
  });

  it("treats spring and fall as separate seasons rather than a contradiction", () => {
    const spring = evaluateOntarioMajorGame({ speciesId: BEAR, date: "2026-05-10" }, zone("30"), {});
    const fall = evaluateOntarioMajorGame({ speciesId: BEAR, date: "2026-09-15" }, zone("30"), {});
    const between = evaluateOntarioMajorGame({ speciesId: BEAR, date: "2026-07-01" }, zone("30"), {});
    assert.equal(spring.result!.status, "CONDITIONAL");
    assert.equal(fall.result!.status, "CONDITIONAL");
    assert.equal(between.result!.status, "CLOSED", "July falls between the two seasons");
  });

  it("carries the township restriction it cannot evaluate", () => {
    const { result } = evaluateOntarioMajorGame({ speciesId: BEAR, date: "2026-05-05" }, zone("82A"), {});
    assert.equal(result!.status, "CONDITIONAL");
    assert.ok(
      result!.limitations.some((line) => /geographic townships/i.test(line) && /which side of it you are on/i.test(line)),
    );
  });

  it("keeps a short season distinct from the long one in the same table", () => {
    const { result } = evaluateOntarioMajorGame({ speciesId: BEAR, date: "2026-05-05" }, zone("82A"), {});
    assert.deepEqual(result!.season, { opens: "2026-05-01", closes: "2026-05-07", datesInclusive: true });
  });

  it("warns that a cub and a female with a cub are never legal", () => {
    const { result } = evaluateOntarioMajorGame({ speciesId: BEAR, date: "2026-05-10" }, zone("30"), {});
    assert.ok(result!.requirements.some((line) => /bear cub/i.test(line)));
  });
});

describe("Moose", () => {
  const resident = { RESIDENCY: ONTARIO_RESIDENCY.RESIDENT };

  it("asks which tag was drawn, because the tables are stated per tag", () => {
    const evaluation = evaluateOntarioMajorGame({ speciesId: MOOSE, date: "2026-10-22" }, zone("46"), resident);
    assert.equal(evaluation.required?.id, "TAG_TYPE");
    assert.deepEqual(evaluation.required!.options.map((option) => option.value).sort(), ["BOW", "GUN"]);
    assert.match(evaluation.required!.reason, /tag/i);
  });

  it("stops asking once the answers already leave one table standing", () => {
    // Residency and tag resolve WMU 46 to a single rule, so the implement
    // question the unnarrowed candidates disagreed about is never put.
    const evaluation = evaluateOntarioMajorGame(
      { speciesId: MOOSE, date: "2026-10-22" }, zone("46"),
      { ...resident, TAG_TYPE: "GUN" },
    );
    assert.equal(evaluation.completeness, "RESOLVED");
    assert.equal(evaluation.result!.status, "CONDITIONAL");
    assert.deepEqual(evaluation.result!.season, { opens: "2026-10-19", closes: "2026-10-25", datesInclusive: true });
  });

  it("gives a different season for a different tag in the same unit on a different date", () => {
    const { result } = evaluateOntarioMajorGame(
      { speciesId: MOOSE, date: "2026-10-05" }, zone("46"),
      { ...resident, TAG_TYPE: "BOW" },
    );
    assert.deepEqual(result!.season, { opens: "2026-10-03", closes: "2026-10-09", datesInclusive: true });
  });

  it("reports CLOSED where the non-resident cell reads None", () => {
    const { result } = evaluateOntarioMajorGame(
      { speciesId: MOOSE, date: "2026-10-22" }, zone("46"),
      { RESIDENCY: ONTARIO_RESIDENCY.NON_RESIDENT, TAG_TYPE: "GUN" },
    );
    assert.equal(result!.status, "CLOSED");
  });

  it("asks no tag question where the unit appears in only one table", () => {
    const evaluation = evaluateOntarioMajorGame({ speciesId: MOOSE, date: "2026-10-20" }, zone("7A"), resident);
    assert.equal(evaluation.completeness, "RESOLVED");
    assert.deepEqual(evaluation.result!.season, { opens: "2026-10-17", closes: "2026-12-15", datesInclusive: true });
  });

  it("never implies a tag has been obtained or validated", () => {
    const { result } = evaluateOntarioMajorGame(
      { speciesId: MOOSE, date: "2026-10-01" }, zone("1A"), resident);
    assert.equal(result!.status, "CONDITIONAL");
    assert.ok(result!.requirements.some((line) => /validated moose tag/i.test(line) && /draw/i.test(line)));
    assert.ok(result!.requirements.some((line) => /North Ground does not evaluate draw applications/i.test(line)));
  });

  it("says the controlled-hunter-number seasons exist and are not included", () => {
    const { result } = evaluateOntarioMajorGame(
      { speciesId: MOOSE, date: "2026-10-01" }, zone("1A"), resident);
    assert.ok(result!.requirements.some((line) => /controlled hunter numbers/i.test(line)));
  });
});

describe("Untrusted answers", () => {
  it("does not let an unrecognised answer narrow the rules into a closure", () => {
    // Filtering on an arbitrary string empties the candidate set, and an empty
    // set reads as "no season is open to you". A tampered request must leave
    // the question outstanding instead.
    for (const answers of [
      { RESIDENCY: "RESIDENT'; drop--" },
      { RESIDENCY: ONTARIO_RESIDENCY.RESIDENT, TAG_TYPE: "__proto__" },
      { RESIDENCY: ONTARIO_RESIDENCY.RESIDENT, TAG_TYPE: "GUN", HUNT_METHOD: "TREBUCHET" },
    ]) {
      const evaluation = evaluateOntarioMajorGame({ speciesId: MOOSE, date: "2026-10-22" }, zone("46"), answers);
      assert.notEqual(evaluation.result?.status, "CLOSED", `${JSON.stringify(answers)} must not produce a closure`);
    }
  });

  it("accepts only the values a dimension offers", () => {
    const evaluation = evaluateOntarioMajorGame(
      { speciesId: MOOSE, date: "2026-10-22" }, zone("46"),
      { RESIDENCY: ONTARIO_RESIDENCY.RESIDENT, TAG_TYPE: "BOW_MUZZLELOADER" },
    );
    // WMU 46 has no bows-and-muzzle-loaders table, so that tag is not offered
    // here and the question stays open rather than silently matching nothing.
    assert.equal(evaluation.completeness, "NEEDS_INPUT");
    assert.equal(evaluation.required?.id, "TAG_TYPE");
  });
});

describe("Coverage across all four species", () => {
  it("carries every species the wave set out to support", () => {
    assert.deepEqual([...ONTARIO_MAJOR_GAME_SPECIES].sort(), [
      "species:american-black-bear", "species:moose", "species:white-tailed-deer", "species:wild-turkey",
    ]);
  });

  it("reports each species' reach honestly, including what it does not cover", () => {
    const report = majorGameCoverageReport();
    assert.equal(report.species.length, 4);
    for (const species of report.species) {
      assert.equal(species.unitsReached + species.unitsNotReached, report.officialUnits);
      assert.ok(species.unitsReached > 0, `${species.speciesId} reaches no unit`);
      assert.ok(species.unitsNotReached > 0, `${species.speciesId} claims province-wide coverage`);
    }
  });
});
