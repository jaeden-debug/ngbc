import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import type { WithinZoneRestriction } from "./within-zone-restriction.ts";

const bundle = JSON.parse(readFileSync("content/regulatory/ca-bc-closed-areas.json", "utf8")) as {
  counts: Record<string, unknown>;
  restrictions: WithinZoneRestriction[];
};
const enumeration = JSON.parse(
  readFileSync("docs/research/bc-within-zone/ca-bc-closed-areas-enumeration.json", "utf8"),
) as {
  areas: Array<{
    status: string;
    schedule: string;
    entryNumber: string;
    closesSeason: boolean;
    prohibitsShooting: boolean;
    restrictsAmmunition: boolean;
    managementUnits: string[];
    unitDetermination: string;
    periodStatedAs: { text: string } | null;
  }>;
};

const live = enumeration.areas.filter((area) => area.status === "LIVE");
/*
 * Matched on the END of the citation, not with `includes`. The first draft used
 * `includes("item 1")`, which also matches "item 10" through "item 19" — so
 * entries inherited each other's rows and both the scope and the repeal
 * assertions failed against correct data. A substring is not an identifier.
 */
const at = (schedule: string, item: string) =>
  bundle.restrictions.filter((r) => r.citation.endsWith(`, Schedule ${schedule}, item ${item}`));

test("every fact in the regulation becomes its own restriction, and none is invented", () => {
  /*
   * Derived from the authority's own flags rather than asserted as a number:
   * a hard-coded total could only confirm the transcription, and the count is
   * exactly what three earlier relays got wrong.
   */
  const expected = live.reduce(
    (total, area) => total + Number(area.closesSeason) + Number(area.prohibitsShooting) + Number(area.restrictsAmmunition),
    0,
  );
  assert.equal(bundle.restrictions.length, expected);
  assert.equal(live.length, 254, "the enumeration is the corrected one");
});

test("a no-shooting area is never recorded as a closed season, nor the reverse", () => {
  /*
   * THE TEST THIS FILE EXISTS FOR, and it is wrong in both directions at once
   * if it fails. 122 areas prohibit shooting with the season left open:
   * recording those as closed shuts a season that is running. 32 close the
   * season and are not no-shooting areas: recording those as no-shooting sends
   * a hunter to hunt where there is no season. A bow hunter is addressed by
   * one and not the other.
   */
  for (const area of live) {
    const rows = at(area.schedule, area.entryNumber);
    const kinds = new Set(rows.map((row) => row.kind));
    assert.equal(kinds.has("NO_OPEN_SEASON"), area.closesSeason, `Schedule ${area.schedule} #${area.entryNumber} season fact`);
    assert.equal(kinds.has("NO_DISCHARGE"), area.prohibitsShooting, `Schedule ${area.schedule} #${area.entryNumber} shooting fact`);
    assert.equal(kinds.has("AMMUNITION"), area.restrictsAmmunition, `Schedule ${area.schedule} #${area.entryNumber} ammunition fact`);
  }
});

test("an unresolved unit is a gap, and an unnamed unit is a fact, and they read differently", () => {
  /*
   * `namesNoManagementUnit` was derived from FAILURE TO FIND a unit, so every
   * extraction fault could only push entries into it — which is why three
   * successive corrections to that figure all ran the same direction. "I could
   * not find one" is not "there is none" (§8), so the two are not written the
   * same way.
   *
   * Schedule 3 #19 is the worked case: "Management Units 1-1 to 1-15 and 2-1
   * to 2-19" names thirty-four units, and a reader that stored two would be
   * confidently wrong rather than visibly unsure.
   */
  for (const area of live) {
    for (const row of at(area.schedule, area.entryNumber)) {
      if (area.managementUnits.length) {
        assert.equal(row.scope.kind, "CANDIDATE_AREAS", "a named unit contains the area, it is not the area");
        continue;
      }
      assert.equal(row.scope.kind, "UNLISTED");
      const statedAs = row.scope.kind === "UNLISTED" ? row.scope.statedAs : "";
      if (area.unitDetermination === "NOT_DETERMINED") {
        assert.match(statedAs, /could not resolve/i);
        assert.match(statedAs, /not a statement that the regulation names none/i);
      } else {
        assert.match(statedAs, /names no management unit/i);
        assert.doesNotMatch(statedAs, /could not resolve/i);
      }
    }
  }
});

test("a period is never empty, and silence is stated rather than implied", () => {
  for (const row of bundle.restrictions) {
    assert.ok(row.periods.length > 0, `${row.id} carries at least one period`);
    for (const period of row.periods) assert.ok(period.statedAs.length > 0);
  }
  const stated = new Set(
    live.filter((area) => area.periodStatedAs).map((area) => `${area.schedule}/${area.entryNumber}`),
  );
  for (const area of live) {
    const rows = at(area.schedule, area.entryNumber);
    const always = rows.every((row) => row.periods.every((period) => period.kind === "ALWAYS"));
    assert.equal(always, !stated.has(`${area.schedule}/${area.entryNumber}`), `Schedule ${area.schedule} #${area.entryNumber}`);
  }
});

test("the two shapes a date range cannot hold are kept as themselves", () => {
  /* Pitt: a range AND four weekdays within a second range — two periods on one
     area, not one range with a note. */
  const pitt = at("4", "3");
  assert.ok(pitt.length > 0);
  for (const row of pitt) {
    assert.deepEqual(row.periods.map((period) => period.kind), ["DATE_RANGE", "WEEKDAYS"]);
    const weekdays = row.periods.find((period) => period.kind === "WEEKDAYS");
    assert.ok(weekdays && weekdays.kind === "WEEKDAYS");
    assert.deepEqual(weekdays.weekdays, ["MON", "TUE", "THU", "FRI"]);
  }

  /* Cowichan Bay: the end is a RULE. Storing a computed date would put North
     Ground's arithmetic where the regulation's words belong. */
  const cowichan = at("6", "7");
  assert.ok(cowichan.length > 0);
  for (const row of cowichan) {
    const [period] = row.periods;
    assert.equal(period.kind, "FLOATING");
    assert.ok(period.kind === "FLOATING");
    assert.equal(period.toStatedAs, "the Saturday following Labour Day");
    assert.equal(period.to, undefined, "the floating end is never pre-resolved into a date");
  }
});

test("precedence travels with the record, not only with the commit message", () => {
  /*
   * s. 1.1 makes this regulation prevail over any other under the Act to the
   * extent of the conflict. A restriction that overrides the bundle's own
   * source is not an ordinary overlay, and a consumer must be able to see that
   * from the row.
   */
  for (const row of bundle.restrictions) {
    assert.ok(row.prevailsOverConflicting, `${row.id} records its precedence`);
    assert.match(row.prevailsOverConflicting.citation, /s\. 1\.1/);
    assert.match(row.prevailsOverConflicting.statedAs, /prevails to the extent of the conflict/);
    assert.equal(row.sourceId, "source:ca-bc-closed-areas-regulation");
  }
});

test("repealed entries are not areas", () => {
  /* 94 of the 348 entries are numbered placeholders reading "Repealed." A
     parse that counted them as areas is what produced three withdrawn
     figures; none of them may reach the bundle. */
  const repealed = enumeration.areas.filter((area) => area.status === "REPEALED");
  assert.equal(repealed.length, enumeration.areas.length - live.length);
  for (const area of repealed) assert.equal(at(area.schedule, area.entryNumber).length, 0);
});

/* ── The resolver: what 76/84 does to an answer ──────────────────────────── */

test("a no-shooting area never closes a season, which is the majority of the rows", async () => {
  /*
   * THE CONSTRAINT THIS RESOLVER EXISTS FOR. 193 of the 325 rows are
   * NO_DISCHARGE: they forbid shooting and say nothing about the season.
   * Rendering them as a closed season tells a hunter a running season is shut,
   * and tells a bow hunter that a rule about discharging a firearm is theirs.
   *
   * Asserted over EVERY unit that has only discharge rows, not a sample.
   */
  const { closedAreaEffectAt, seasonIsOverriddenBy, BC_CLOSED_AREAS } = await import("./bc-closed-areas.ts");

  const unitsWithDischargeOnly = new Set<string>();
  for (const row of BC_CLOSED_AREAS) {
    if (row.kind !== "NO_DISCHARGE" || row.scope.kind !== "CANDIDATE_AREAS") continue;
    for (const unit of row.scope.candidateAreas) unitsWithDischargeOnly.add(unit);
  }
  for (const row of BC_CLOSED_AREAS) {
    if (row.kind === "NO_OPEN_SEASON" && row.scope.kind === "CANDIDATE_AREAS") {
      for (const unit of row.scope.candidateAreas) unitsWithDischargeOnly.delete(unit);
    }
  }
  assert.ok(unitsWithDischargeOnly.size > 0, "there are units reached only by no-shooting areas");

  for (const unit of unitsWithDischargeOnly) {
    const effect = closedAreaEffectAt({ area: unit, scope: "POINT" });
    assert.equal(seasonIsOverriddenBy(effect), undefined, `${unit}: a no-shooting area must not close the season`);
    assert.notEqual(effect.discharge.state, "NONE", `${unit}: the discharge fact must still be stated`);
  }
});

test("no row in this regulation can close a season today, and the reason is geometry", async () => {
  /*
   * THE CEILING, ASSERTED SO IT CANNOT BE CROSSED BY ACCIDENT.
   *
   * All 325 rows are UNLISTED (134) or CANDIDATE_AREAS (191). Neither yields
   * APPLIES, because North Ground holds no boundary for any of these areas and
   * a unit that CONTAINS a closed area is not the closed area. So 76/84 can
   * say a closed area may reach you and what it says; it cannot say a season
   * is shut.
   *
   * This is the honest ceiling rather than a defect — asserting a closure from
   * "your unit contains one of these" would shut a season across a whole
   * management unit on the strength of a name. If a row ever gains real
   * geometry this test fails, which is correct: that is a deliberate change in
   * what North Ground claims, and it should not happen quietly.
   */
  const { closedAreaEffectAt, seasonIsOverriddenBy, BC_CLOSED_AREAS } = await import("./bc-closed-areas.ts");

  assert.ok(
    BC_CLOSED_AREAS.every((row) => row.scope.kind === "UNLISTED" || row.scope.kind === "CANDIDATE_AREAS"),
    "every row is unplaceable or merely contained; none carries its own boundary",
  );

  const units = new Set<string>();
  for (const row of BC_CLOSED_AREAS) {
    if (row.scope.kind === "CANDIDATE_AREAS") for (const unit of row.scope.candidateAreas) units.add(unit);
  }
  for (const unit of units) {
    const effect = closedAreaEffectAt({ area: unit, scope: "POINT" });
    assert.equal(seasonIsOverriddenBy(effect), undefined, `${unit}: a contained area may not assert a closure`);
    assert.notEqual(effect.season.state, "APPLIES");
  }
});

test("the precedence surface carries s. 1.1 when it is reached", async () => {
  /*
   * Unreachable from today's data (above), so exercised directly: the day an
   * area arrives with geometry, precedence must already be modelled rather
   * than assembled under pressure — which is when it gets built as ordering.
   */
  const { closedAreaEffectAt, seasonIsOverriddenBy, BC_CLOSED_AREAS } = await import("./bc-closed-areas.ts");
  const template = BC_CLOSED_AREAS.find((row) => row.kind === "NO_OPEN_SEASON");
  assert.ok(template);

  const placed = { ...template, scope: { kind: "AREAS", areas: ["1-1"] } } as typeof template;
  const { restrictionAt } = await import("./within-zone-restriction.ts");
  assert.equal(restrictionAt(placed, { area: "1-1", scope: "POINT" }).state, "APPLIES");

  /* And the same fact through the resolver's own shape. */
  const effect = closedAreaEffectAt({ area: "1-1", scope: "POINT" });
  assert.equal(seasonIsOverriddenBy(effect), undefined, "still nothing today");
  assert.match(template.prevailsOverConflicting!.citation, /s\. 1\.1/);
  assert.match(template.prevailsOverConflicting!.statedAs, /prevails to the extent of the conflict/);
});

test("an area that cannot be placed is MAY_APPLY, never NONE", async () => {
  /*
   * 134 rows name no unit North Ground can match. Resolving those to "no
   * restriction" is the silent-drop this whole model replaced, and it is the
   * §8 failure: could not place is not does not apply.
   */
  const { closedAreaEffectAt } = await import("./bc-closed-areas.ts");
  const effect = closedAreaEffectAt({ area: "no-such-unit-anywhere", scope: "POINT" });

  for (const fact of [effect.season, effect.discharge] as const) {
    assert.equal(fact.state, "MAY_APPLY");
    if (fact.state !== "MAY_APPLY") continue;
    assert.ok(fact.rows.length > 0);
    assert.ok(fact.because.every((line) => line.length > 0), "every unknown says why");
  }
});

test("every row is asked, and a verdict is kept for each", async () => {
  /* Including DOES_NOT_APPLY: "consulted and it does not reach here" is a
     different answer from never having looked. */
  const { closedAreaEffectAt, BC_CLOSED_AREAS } = await import("./bc-closed-areas.ts");
  const effect = closedAreaEffectAt({ area: "1-1", scope: "POINT" });
  assert.equal(effect.verdicts.length, BC_CLOSED_AREAS.length);
  for (const verdict of effect.verdicts) {
    assert.ok(["APPLIES", "DOES_NOT_APPLY", "UNKNOWN"].includes(verdict.state));
  }
});

test("the unit key the evaluator uses is the key the regulation lists", async () => {
  /*
   * THE SILENT NO-OP, GUARDED. 76/84 lists units as the authority writes them
   * — "4-25", "3-19". The zone's PROSE name is "Management Unit 4-25". Keyed
   * on the prose name nothing would ever match: every row would resolve to
   * UNKNOWN, and the regulation would be consulted and found irrelevant
   * everywhere, while looking like working code.
   *
   * So this asserts the two vocabularies actually intersect, against the
   * certified unit list rather than a literal.
   */
  const { BC_CLOSED_AREAS } = await import("./bc-closed-areas.ts");
  const certified = new Set(
    (JSON.parse(readFileSync("content/regulatory/ca-bc-certified-units.json", "utf8")) as { certifiedUnits: string[] })
      .certifiedUnits,
  );

  const listed = new Set<string>();
  for (const row of BC_CLOSED_AREAS) {
    if (row.scope.kind === "CANDIDATE_AREAS") for (const unit of row.scope.candidateAreas) listed.add(unit);
  }
  assert.ok(listed.size > 0);

  const matched = [...listed].filter((unit) => certified.has(unit));
  assert.ok(
    matched.length > listed.size / 2,
    `only ${matched.length} of ${listed.size} closed-area units match a certified Management Unit; the key is wrong`,
  );
});

test("a real BC zone id reaches the rows that name its unit", async () => {
  const { withinZoneFactsAt, BC_CLOSED_AREAS } = await import("./bc-closed-areas.ts");
  const row = BC_CLOSED_AREAS.find((r) => r.scope.kind === "CANDIDATE_AREAS");
  assert.ok(row && row.scope.kind === "CANDIDATE_AREAS");
  const unit = row.scope.candidateAreas[0];

  const facts = withinZoneFactsAt({ area: unit, scope: "POINT" });
  const named = [facts.season, facts.discharge, facts.ammunition].flatMap((fact) => fact.areas.map((a) => a.name));
  assert.ok(named.includes(row.name), `${unit} must reach ${row.name}`);

  /* And the engine's own assertion travels with it. */
  assert.equal(facts.closesSeasonHere, false, "nothing can be placed today, so nothing closes a season");
  for (const fact of [facts.season, facts.discharge]) {
    for (const area of fact.areas) {
      assert.ok(area.citation.length > 0 && area.statedAs.length > 0, "each area carries its pinpoint and the authority's words");
      assert.ok(["CONTAINED_BY_UNIT", "UNPLACEABLE"].includes(area.placement));
    }
  }
});
