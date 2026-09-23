import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { placeWorlds, type GeographyData } from "./geography.ts";
import { periodCovers, restrictionAt, restrictionCovers, restrictionSummary, type WithinZoneRestriction } from "./within-zone-restriction.ts";

const base = {
  citation: "B.C. Reg. 76/84 s.12", sourceId: "source:example",
  periods: [{ kind: "ALWAYS" as const, statedAs: "the regulation states no period" }],
};

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

  it("keeps 'no hunting' apart from 'no shooting', because a bow hunter is reached by one and not the other", () => {
    /* Alberta's road corridor wildlife sanctuaries: "It is unlawful to hunt
       within 365 metres of the centre-line". No season is closed, and an
       archer IS addressed — so neither neighbour fits. Filed as NO_DISCHARGE
       it would tell a bow hunter the rule is not theirs. */
    const corridor: WithinZoneRestriction = {
      ...base, id: "r:corridor", name: "the road corridor wildlife sanctuary", kind: "NO_HUNTING",
      statedAs: "It is unlawful to hunt within 365 metres (400 yards) of the centre-line of the road in a designated road corridor wildlife sanctuary",
      scope: { kind: "UNLISTED", statedAs: "Described by highway segment, naming no wildlife management unit." },
      citation: "2026 Alberta Guide to Hunting Regulations, road corridor wildlife sanctuaries",
    };
    assert.match(restrictionSummary(corridor), /No hunting of any kind/);
    assert.doesNotMatch(restrictionSummary(corridor), /does not reach a hunter using a bow/);
    // And it is unplaceable by unit, so it must be loud rather than dropped.
    assert.equal(restrictionAt(corridor, { area: "100", scope: "POINT" }).state, "UNKNOWN");
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


describe("when a restriction is in force", () => {
  it("never resolves a floating boundary into a date of our own", () => {
    /* Cowichan Bay 7 runs "March 11 to the Saturday following Labour Day". The
       end is a RULE that resolves per year against a calendar. Storing a
       computed date for it would put North Ground's arithmetic where the
       regulation's words belong — and a hunter told the wrong Saturday has our
       arithmetic, while one told the rule has the authority's. */
    const cowichan: WithinZoneRestriction = {
      ...base, id: "r:cowichan", name: "Cowichan Bay 7", kind: "NO_OPEN_SEASON", statedAs: "x",
      scope: { kind: "UNLISTED", statedAs: "described in words" },
      periods: [{ kind: "FLOATING", from: { month: 3, day: 11 }, toStatedAs: "the Saturday following Labour Day",
                  statedAs: "during the period March 11 to the Saturday following Labour Day" }],
    };
    assert.equal(restrictionCovers(cowichan, "2026-06-15"), "UNKNOWN", "inside the unresolved window, we do not claim");
    // And the answer keeps the authority's own wording available to say instead.
    assert.match(cowichan.periods[0].statedAs, /Saturday following Labour Day/);
  });

  it("holds two periods of different shapes on one area", () => {
    /* Pitt Wildlife Management Area is restricted for one period AND on
       Mondays, Tuesdays, Thursdays and Fridays during another. Not a range,
       and not one range with a note. */
    const pitt: WithinZoneRestriction = {
      ...base, id: "r:pitt", name: "Pitt Wildlife Management Area", kind: "NO_HUNTING", statedAs: "x",
      scope: { kind: "UNLISTED", statedAs: "described in words" },
      periods: [
        { kind: "DATE_RANGE", from: { month: 10, day: 1 }, to: { month: 10, day: 31 }, statedAs: "October 1 to October 31" },
        { kind: "WEEKDAYS", weekdays: ["MON", "TUE", "THU", "FRI"], within: { from: { month: 11, day: 1 }, to: { month: 12, day: 31 } },
          statedAs: "on Mondays, Tuesdays, Thursdays and Fridays" },
      ],
    };
    assert.equal(pitt.periods.length, 2);
    assert.equal(restrictionCovers(pitt, "2026-10-15"), "YES", "inside the plain range");
    assert.equal(restrictionCovers(pitt, "2026-11-02"), "YES", "a Monday inside the weekday window");
    assert.equal(restrictionCovers(pitt, "2026-11-01"), "NO", "a Sunday inside the weekday window");
    assert.equal(restrictionCovers(pitt, "2026-09-15"), "NO", "outside both");
  });

  it("reads a window that wraps the new year as one window", () => {
    const winter = { kind: "DATE_RANGE" as const, from: { month: 12, day: 1 }, to: { month: 2, day: 28 }, statedAs: "December 1 to February 28" };
    assert.equal(periodCovers(winter, "2026-12-15"), "YES");
    assert.equal(periodCovers(winter, "2027-01-15"), "YES");
    assert.equal(periodCovers(winter, "2026-06-15"), "NO");
  });

  it("lets an unresolved period beat a NO but not a YES", () => {
    /* One period certainly applying settles it; an unresolved one can never be
       read as absence. */
    const mixed: WithinZoneRestriction = {
      ...base, id: "r:mixed", name: "Mixed", kind: "NO_OPEN_SEASON", statedAs: "x",
      scope: { kind: "AREAS", areas: ["1-1"] },
      periods: [
        { kind: "DATE_RANGE", from: { month: 1, day: 1 }, to: { month: 1, day: 31 }, statedAs: "January" },
        { kind: "AS_STATED", statedAs: "a shape this model has not met" },
      ],
    };
    assert.equal(restrictionCovers(mixed, "2026-01-15"), "YES", "a certain YES wins");
    assert.equal(restrictionCovers(mixed, "2026-07-15"), "UNKNOWN", "an unresolved period is not absence");
  });

  it("states ALWAYS rather than leaving the list empty", () => {
    /* An empty list and "the authority states no period" would look identical,
       and the first is a gap while the second is a fact. */
    assert.equal(base.periods.length, 1);
    assert.equal(base.periods[0].kind, "ALWAYS");
    assert.ok(base.periods[0].statedAs.length > 0);
  });
});
