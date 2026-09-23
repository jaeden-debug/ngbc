import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { placeWorlds, type GeographyData } from "./geography.ts";
import { restrictionAt, restrictionSummary, type WithinZoneRestriction } from "./within-zone-restriction.ts";

const base = { citation: "B.C. Reg. 76/84 s.12", sourceId: "source:example" };

describe("a within-zone restriction", () => {
  it("applies jurisdiction-wide with no unit to list", () => {
    /* B.C. Reg. 76/84 s.12 forbids shooting from a highway and within 15 m of
       one, province-wide. The previous model skipped a special when the point
       resolved to no area, so this could not be expressed at all. */
    const highway: WithinZoneRestriction = {
      ...base, id: "r:highway", name: "Highway and within 15 m", kind: "NO_DISCHARGE",
      statedAs: "no person shall discharge a firearm from or across a highway",
      scope: { kind: "JURISDICTION_WIDE", statedAs: "province-wide" },
    };
    assert.equal(restrictionAt(highway, { scope: "POINT" }).state, "APPLIES");
    assert.equal(restrictionAt(highway, { area: "1-1", scope: "POINT" }).state, "APPLIES");
  });

  it("is LOUD when it names no unit, never silent", () => {
    /* The bug this model exists for: `!entry.candidateAreas?.includes(area)`
       is `!undefined` for an entry with no candidate areas, which is true — so
       it did not fail, it never fired. BC's Schedule 1 areas name no
       management unit, so every one of them would have been invisible. */
    const schedule1: WithinZoneRestriction = {
      ...base, id: "r:sched1", name: "Schedule 1 closed area", kind: "NO_OPEN_SEASON",
      statedAs: "there is no open season in the areas described in Schedule 1",
      scope: { kind: "UNLISTED", statedAs: "Schedule 1 describes the area in words, naming no management unit." },
    };
    for (const place of [{ scope: "POINT" as const }, { area: "1-1", scope: "POINT" as const }, { area: "1-1", scope: "ZONE" as const }]) {
      const verdict = restrictionAt(schedule1, place);
      assert.equal(verdict.state, "UNKNOWN", "an unplaceable restriction is unknown, never absent");
      assert.match((verdict as { because: string }).because, /names no management unit/);
    }
  });

  it("never returns nothing", () => {
    /* Every branch yields a verdict. A restriction that cannot be evaluated is
       UNKNOWN with a reason, because the failure being fixed produced silence
       rather than an error. */
    const cases: WithinZoneRestriction[] = [
      { ...base, id: "a", name: "A", kind: "NO_OPEN_SEASON", statedAs: "x", scope: { kind: "AREAS", areas: ["1-1"] } },
      { ...base, id: "b", name: "B", kind: "AMMUNITION", statedAs: "x", scope: { kind: "CANDIDATE_AREAS", candidateAreas: ["1-1"] } },
      { ...base, id: "c", name: "C", kind: "ACCESS", statedAs: "x", scope: { kind: "UNLISTED", statedAs: "y" } },
      { ...base, id: "d", name: "D", kind: "NO_DISCHARGE", statedAs: "x", scope: { kind: "JURISDICTION_WIDE", statedAs: "y" } },
    ];
    for (const restriction of cases) {
      for (const place of [{ scope: "POINT" as const }, { area: "1-1", scope: "POINT" as const }, { area: "9-9", scope: "ZONE" as const }]) {
        const verdict = restrictionAt(restriction, place);
        assert.ok(["APPLIES", "DOES_NOT_APPLY", "UNKNOWN"].includes(verdict.state), `${restriction.id} produced no verdict`);
      }
    }
  });

  it("does not let a no-shooting area read as a closed season", () => {
    /* ss.6 and 7.1 designate no-shooting areas and say NOTHING about the
       season; ss.2, 4, 8 and 8.1 say there is no open season. Collapsing them
       tells a hunter the season is shut when it is open, or sends them to hunt
       where there is no season. */
    const noShooting: WithinZoneRestriction = {
      ...base, id: "r:ns", name: "the no shooting area", kind: "NO_DISCHARGE", statedAs: "x",
      scope: { kind: "AREAS", areas: ["1-1"] },
    };
    const noSeason: WithinZoneRestriction = { ...noShooting, id: "r:nos", name: "the closed area", kind: "NO_OPEN_SEASON" };
    assert.match(restrictionSummary(noShooting), /No shooting/);
    assert.match(restrictionSummary(noShooting), /season itself is not closed/);
    assert.match(restrictionSummary(noSeason), /No open season/);
    assert.notEqual(restrictionSummary(noShooting), restrictionSummary(noSeason));
  });

  it("carries an instrument's own precedence where it states one", () => {
    /* B.C. Reg. 76/84 s.1.1, enacted 2026: "this regulation prevails to the
       extent of the conflict". A restriction that overrides the bundle's own
       source is not an ordinary overlay and the model should not lose that. */
    const prevailing: WithinZoneRestriction = {
      ...base, id: "r:p", name: "Closed area", kind: "NO_OPEN_SEASON", statedAs: "x",
      scope: { kind: "AREAS", areas: ["1-1"] },
      prevailsOverConflicting: { statedAs: "this regulation prevails to the extent of the conflict", citation: "B.C. Reg. 76/84 s.1.1" },
    };
    assert.ok(prevailing.prevailsOverConflicting);
    assert.equal(restrictionAt(prevailing, { area: "1-1", scope: "POINT" }).state, "APPLIES");
  });
});

describe("the live resolver no longer drops an unplaceable special", () => {
  it("raises an unknown for an entry with no candidate areas", () => {
    /* Asserted against the LIVE resolver, not the new model — the new model
       being right does not repair the path that is running today, and this is
       the path British Columbia's Closed Areas Schedule 1 would have fallen
       through. */
    const data: GeographyData = {
      units: [{ identifier: "1-1", zoneId: "management_zone:example-1-1" }],
      specialGeographies: [{
        id: "special:unplaceable",
        name: "Schedule 1 closed area",
        statedAs: "there is no open season in the areas described in Schedule 1",
        resolution: "UNRESOLVED",
        reason: "Its boundary is described in words.",
      }],
    };
    const rules = [{ geography: { include: { gbhz: [], special: ["special:unplaceable"] }, exclude: { gbhz: [], special: [] } } }];
    const worlds = placeWorlds(data, { zoneId: "management_zone:example-1-1", latitude: 50, longitude: -120, scope: "POINT", overlays: null }, rules as never);
    assert.ok(
      worlds.unknowns.some((entry) => /names no management unit/.test(entry.statedAs)),
      "an unplaceable special must surface as unknown rather than never firing",
    );
  });
});
