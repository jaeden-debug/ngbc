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
