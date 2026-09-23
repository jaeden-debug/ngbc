import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CanonicalId } from "../../content-contract/index.ts";
import type { ZoneResolution } from "../types.ts";
import { evaluateOntarioMajorGame, majorGameCoverageReport } from "./major-game.ts";
import { ONTARIO_METHODS, ONTARIO_RESIDENCY, UNSURE } from "./dimensions.ts";

/**
 * Ontario deer, exercised against the generated bundle rather than hand-written
 * rules. Each case below is a real row in the 2026 summary; if a rebuild changes
 * what the province published, these fail rather than drifting quietly.
 *
 * The cases that matter most are the ones a simpler engine gets confidently
 * wrong: a rifle hunter in a footnote unit, a bow hunter who qualifies for three
 * separate seasons, and a non-resident in a unit whose cell reads "None".
 */

const DEER = "species:white-tailed-deer";

function zone(unit: string): ZoneResolution {
  return {
    status: "RESOLVED",
    zoneId: `management_zone:ca-on-wmu-${unit.toLowerCase()}` as CanonicalId<"management_zone">,
    officialName: unit,
    sourceId: "source:ca-on-wmu-layer" as CanonicalId<"source">,
    message: `Wildlife management unit ${unit}.`,
  };
}

const RESIDENT = { RESIDENCY: ONTARIO_RESIDENCY.RESIDENT };

describe("Ontario major game — asking only what the rules turn on", () => {
  it("asks for residency before anything else, because a unit may have no non-resident season", () => {
    const evaluation = evaluateOntarioMajorGame({ speciesId: DEER, date: "2026-11-10" }, zone("60"), {});
    assert.equal(evaluation.completeness, "NEEDS_INPUT");
    assert.equal(evaluation.required?.id, "RESIDENCY");
    assert.equal(evaluation.result, undefined, "an unanswered question must not carry a regulatory status");
    assert.match(evaluation.required!.reason, /non-resident/i);
  });

  it("asks for the implement once residency is known", () => {
    const evaluation = evaluateOntarioMajorGame({ speciesId: DEER, date: "2026-11-10" }, zone("60"), RESIDENT);
    assert.equal(evaluation.completeness, "NEEDS_INPUT");
    assert.equal(evaluation.required?.id, "HUNT_METHOD");
    assert.deepEqual(
      evaluation.required!.options.map((option) => option.value),
      ["RIFLE", "SHOTGUN", "MUZZLELOADER", "BOW"],
      "rifle and shotgun must be separable — some units permit one and not the other",
    );
  });

  it("names the source section each question comes from", () => {
    const evaluation = evaluateOntarioMajorGame({ speciesId: DEER, date: "2026-11-10" }, zone("60"), {});
    assert.equal(evaluation.required!.sourceId, "source:ca-on-deer-2026");
    assert.ok(evaluation.required!.sourceSection);
  });

  it("rejects an answer the dimension does not offer and keeps asking", () => {
    const evaluation = evaluateOntarioMajorGame(
      { speciesId: DEER, date: "2026-11-10" },
      zone("60"),
      { RESIDENCY: "ONTARIO_ISH" },
    );
    assert.equal(evaluation.completeness, "NEEDS_INPUT");
    assert.equal(evaluation.required?.id, "RESIDENCY");
  });

  it("does not accept 'not sure' for a fact the person holds in their hands", () => {
    const evaluation = evaluateOntarioMajorGame(
      { speciesId: DEER, date: "2026-11-10" },
      zone("60"),
      { RESIDENCY: ONTARIO_RESIDENCY.RESIDENT, HUNT_METHOD: UNSURE },
    );
    assert.equal(evaluation.completeness, "NEEDS_INPUT");
    assert.equal(evaluation.required?.id, "HUNT_METHOD");
  });

  it("asks nothing where the published rules do not disagree", () => {
    // WMU 1C publishes one implement grouping, so the implement changes nothing.
    const evaluation = evaluateOntarioMajorGame(
      { speciesId: DEER, date: "2026-10-05" },
      zone("1C"),
      RESIDENT,
    );
    assert.equal(evaluation.completeness, "RESOLVED");
    assert.deepEqual(evaluation.dimensions.map((dimension) => dimension.id), ["RESIDENCY"]);
  });
});

describe("Ontario major game — the footnote that contradicts its own heading", () => {
  const answered = (method: string) => ({ ...RESIDENT, HUNT_METHOD: method });

  it("gives a shotgun hunter the November season in WMU 71", () => {
    const { result } = evaluateOntarioMajorGame(
      { speciesId: DEER, date: "2026-11-10" },
      zone("71"),
      answered(ONTARIO_METHODS.SHOTGUN),
    );
    assert.equal(result!.status, "CONDITIONAL");
    assert.deepEqual(result!.season, { opens: "2026-11-02", closes: "2026-11-15", datesInclusive: true });
  });

  it("does NOT give a rifle hunter that same season in WMU 71", () => {
    // Footnote 1 removes rifles from a table headed "Rifles, shotguns,
    // muzzle-loading guns and bows". Reading the heading alone opens a season
    // that does not exist for this person.
    const { result } = evaluateOntarioMajorGame(
      { speciesId: DEER, date: "2026-11-10" },
      zone("71"),
      answered(ONTARIO_METHODS.RIFLE),
    );
    assert.equal(result!.status, "CLOSED");
    assert.equal(result!.season, undefined);
  });

  it("still gives a rifle hunter that season in a neighbouring unit without the footnote", () => {
    const { result } = evaluateOntarioMajorGame(
      { speciesId: DEER, date: "2026-11-10" },
      zone("60"),
      answered(ONTARIO_METHODS.RIFLE),
    );
    assert.equal(result!.status, "CONDITIONAL");
  });
});

describe("Ontario major game — one implement, several published seasons", () => {
  const bow = { ...RESIDENT, HUNT_METHOD: ONTARIO_METHODS.BOW };

  it("treats the archery, muzzle-loader and gun seasons as a union for a bow hunter", () => {
    for (const date of ["2026-10-15", "2026-11-10", "2026-12-03"]) {
      const { result } = evaluateOntarioMajorGame({ speciesId: DEER, date }, zone("60"), bow);
      assert.equal(result!.status, "CONDITIONAL", `${date} should be open to a bow in WMU 60`);
    }
  });

  it("does not call overlapping seasons a conflict", () => {
    const { result } = evaluateOntarioMajorGame({ speciesId: DEER, date: "2026-11-10" }, zone("60"), bow);
    assert.notEqual(result!.status, "CONFLICT");
    assert.match(result!.summary, /Seasons open to this combination here/);
  });

  it("closes a gap the union genuinely leaves open to no one", () => {
    // WMU 60's archery season ends 15 December; 20 December is covered by the
    // 2026 summary and by no season in it.
    const { result } = evaluateOntarioMajorGame({ speciesId: DEER, date: "2026-12-20" }, zone("60"), bow);
    assert.equal(result!.status, "CLOSED");
  });

  it("keeps units distinct where the same season ends on different dates", () => {
    // WMU 71's archery season runs to 31 December, WMU 60's to 15 December.
    const later = evaluateOntarioMajorGame({ speciesId: DEER, date: "2026-12-20" }, zone("71"), bow);
    assert.equal(later.result!.status, "CONDITIONAL");
  });

  it("excludes an implement from a season it is not named in", () => {
    // December 3 falls in the muzzle-loader season, which rifles are not part of
    // in any unit.
    const { result } = evaluateOntarioMajorGame(
      { speciesId: DEER, date: "2026-12-03" },
      zone("60"),
      { ...RESIDENT, HUNT_METHOD: ONTARIO_METHODS.RIFLE },
    );
    assert.equal(result!.status, "CLOSED");

    const muzzleloader = evaluateOntarioMajorGame(
      { speciesId: DEER, date: "2026-12-03" },
      zone("60"),
      { ...RESIDENT, HUNT_METHOD: ONTARIO_METHODS.MUZZLELOADER },
    );
    assert.equal(muzzleloader.result!.status, "CONDITIONAL");
  });
});

describe("Ontario major game — “None” is a closure, absence is not", () => {
  it("reports CLOSED where the province prints None for non-residents", () => {
    const { result } = evaluateOntarioMajorGame(
      { speciesId: DEER, date: "2026-10-05" },
      zone("1C"),
      { RESIDENCY: ONTARIO_RESIDENCY.NON_RESIDENT },
    );
    assert.equal(result!.status, "CLOSED");
    assert.match(result!.summary, /None/);
  });

  it("reports CONDITIONAL for a resident on the same date in the same unit", () => {
    const { result } = evaluateOntarioMajorGame(
      { speciesId: DEER, date: "2026-10-05" },
      zone("1C"),
      RESIDENT,
    );
    assert.equal(result!.status, "CONDITIONAL");
  });

  it("reports UNKNOWN — never CLOSED — for a unit no deer row names", () => {
    for (const unit of ["51", "1A", "95"]) {
      const { result, completeness } = evaluateOntarioMajorGame(
        { speciesId: DEER, date: "2026-11-10" },
        zone(unit),
        RESIDENT,
      );
      assert.equal(completeness, "RESOLVED");
      assert.equal(result!.status, "UNKNOWN", `WMU ${unit} is named by no row and must not be inferred closed`);
      assert.match(result!.summary, /not evidence that the season is closed/);
    }
  });

  it("asks no questions for a unit it has no rules for", () => {
    const evaluation = evaluateOntarioMajorGame({ speciesId: DEER, date: "2026-11-10" }, zone("51"), {});
    assert.equal(evaluation.completeness, "RESOLVED");
    assert.deepEqual(evaluation.dimensions, []);
  });
});

describe("Ontario major game — dates outside what the source certifies", () => {
  const rifle = { ...RESIDENT, HUNT_METHOD: ONTARIO_METHODS.RIFLE };

  it("reports CLOSED for a date the 2026 summary covers but no season reaches", () => {
    const { result } = evaluateOntarioMajorGame({ speciesId: DEER, date: "2026-07-04" }, zone("60"), rifle);
    assert.equal(result!.status, "CLOSED");
  });

  it("reports NEEDS_VERIFICATION for a date beyond the certified period", () => {
    const { result } = evaluateOntarioMajorGame({ speciesId: DEER, date: "2028-11-10" }, zone("60"), rifle);
    assert.equal(result!.status, "NEEDS_VERIFICATION");
  });
});

describe("Ontario major game — what the result carries", () => {
  const answered = { ...RESIDENT, HUNT_METHOD: ONTARIO_METHODS.RIFLE };

  it("never claims a licence, tag or residency has been verified", () => {
    const { result } = evaluateOntarioMajorGame({ speciesId: DEER, date: "2026-11-10" }, zone("60"), answered);
    assert.match(result!.summary, /has not verified what you hold/);
    assert.ok(result!.requirements.some((line) => /cannot verify what you hold/i.test(line)));
  });

  it("surfaces the antlerless draw and controlled hunts as unresolved, not as permissions", () => {
    const { result } = evaluateOntarioMajorGame({ speciesId: DEER, date: "2026-11-10" }, zone("60"), answered);
    assert.ok(result!.requirements.some((line) => /antlerless deer draw/i.test(line)));
    assert.ok(result!.requirements.some((line) => /controlled deer hunts/i.test(line)));
  });

  it("cites the source it read and the date it was retrieved", () => {
    const { result } = evaluateOntarioMajorGame({ speciesId: DEER, date: "2026-11-10" }, zone("60"), answered);
    assert.deepEqual(result!.sourceIds, ["source:ca-on-deer-2026"]);
    assert.match(result!.verifiedAt, /^\d{4}-\d{2}-\d{2}/);
  });

  it("carries the boundary caveat where the source excludes part of a unit", () => {
    // WMU 54's archery season excludes the part inside Algonquin Provincial Park,
    // a boundary North Ground does not hold.
    const { result } = evaluateOntarioMajorGame(
      { speciesId: DEER, date: "2026-10-15" },
      zone("54"),
      { ...RESIDENT, HUNT_METHOD: ONTARIO_METHODS.BOW },
    );
    assert.equal(result!.status, "CONDITIONAL");
    assert.ok(
      result!.limitations.some((line) => /algonquin/i.test(line.text) && /cannot tell you which side/i.test(line.text)),
      "an uninterpretable geographic exclusion must be stated, not dropped",
    );
  });

  it("carries a caveat from a season it names but is not currently in", () => {
    // On 10 November this bow hunter is in the gun season, which has no
    // exclusion — but the summary also names the archery season, which does.
    const { result } = evaluateOntarioMajorGame(
      { speciesId: DEER, date: "2026-11-10" },
      zone("54"),
      { ...RESIDENT, HUNT_METHOD: ONTARIO_METHODS.BOW },
    );
    assert.ok(result!.limitations.some((line) => /algonquin/i.test(line.text)));
  });

  it("does not attach that caveat to a hunter the excluded season does not apply to", () => {
    // A rifle is not permitted in the archery season, so its exclusion is not
    // this person's business and must not clutter their result.
    const { result } = evaluateOntarioMajorGame(
      { speciesId: DEER, date: "2026-11-10" },
      zone("54"),
      { ...RESIDENT, HUNT_METHOD: ONTARIO_METHODS.RIFLE },
    );
    assert.ok(!result!.limitations.some((line) => /algonquin/i.test(line.text)));
  });

  it("refuses to state a status when the unit itself is uncertain", () => {
    const unresolved: ZoneResolution = {
      status: "PROVIDER_ERROR",
      sourceId: "source:ca-on-wmu-layer" as CanonicalId<"source">,
      message: "The wildlife management unit lookup failed.",
    };
    const { result, completeness } = evaluateOntarioMajorGame(
      { speciesId: DEER, date: "2026-11-10" },
      unresolved,
      answered,
    );
    assert.equal(completeness, "RESOLVED");
    assert.equal(result!.status, "NEEDS_VERIFICATION");
    assert.deepEqual(result!.sourceIds, [], "no source may be cited for an answer no source produced");
  });
});

describe("Ontario major game — coverage is reported, not claimed", () => {
  it("counts the units the bundle reaches and the units it does not", () => {
    const report = majorGameCoverageReport();
    const deer = report.species.find((entry) => entry.speciesId === DEER)!;
    assert.equal(deer.unitsReached + deer.unitsNotReached, report.officialUnits);
    assert.ok(deer.unitsNotReached > 0, "the gap must be visible rather than rounded away");
    assert.ok(deer.rulesStatingNone > 0, "explicit closures are counted separately from absence");
  });
});
