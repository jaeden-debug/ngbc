import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { harvestLimitsFrom, limitKinds, limitSummary } from "./harvest-limit.ts";

/**
 * The three prohibitions, each tested as a thing the old shape made easy.
 */

describe("harvest limits", () => {
  it("never manufactures a possession limit from a daily one", () => {
    const rows = harvestLimitsFrom({ daily: 5, statedAs: "5 per day" });
    assert.deepEqual(limitKinds(rows), ["DAILY"]);
    assert.ok(!rows.some((row) => row.kind === "POSSESSION"));
  });

  it("never manufactures a daily limit from a season one", () => {
    /* British Columbia gives black bear a season bag of 2 and states no daily
       figure. The old pair could not express this at all — both fields were
       required — so the figure sat in the bundle and never reached a hunter. */
    const rows = harvestLimitsFrom({ bag: 2, statedAs: "2 (season bag limit)", section: "Schedule 3, Part 1" });
    assert.deepEqual(limitKinds(rows), ["SEASON"]);
    assert.equal(rows[0].count, 2);
    assert.equal(rows[0].statedAs, "2 (season bag limit)");
    assert.ok(!rows.some((row) => row.kind === "DAILY"));
  });

  it("keeps an aggregate an aggregate", () => {
    /* A pool read as per-species is wrong by its member count — Québec's five
       birds are shared across four species. */
    const rows = harvestLimitsFrom({ daily: 5, possession: 15, combined: true, combinedWithNames: ["spruce grouse"], statedAs: "Combined daily limit of five" });
    for (const row of rows) assert.equal(row.appliesAcross.scope, "AGGREGATE");
    assert.deepEqual(rows[0].appliesAcross.speciesNames, ["spruce grouse"]);
  });

  it("states each kind by name rather than by position", () => {
    /* "5 / 15" presumes daily-then-possession and silently mislabels a season
       limit as a daily one, which is the whole reason kind is a dimension. */
    assert.match(limitSummary(harvestLimitsFrom({ bag: 2, statedAs: "2" })[0]), /^season: 2/);
    assert.match(limitSummary(harvestLimitsFrom({ daily: 5, statedAs: "5" })[0]), /^daily: 5/);
  });

  it("carries an authority's own period word rather than rounding it", () => {
    /* Québec caps zone 20 deer at 4 "par séjour" — not daily, season or
       licence year. AS_STATED keeps the word; SEASON would have hidden that
       *séjour* is itself undefined in the regulation. */
    const limit = { kind: "AS_STATED" as const, periodStatedAs: "par séjour", count: 4, statedAs: "4 par séjour", appliesAcross: { scope: "THIS_SPECIES" as const } };
    assert.match(limitSummary(limit), /par séjour: 4/);
  });

  it("says when a figure is shared between hunters", () => {
    /* One moose per TWO hunters. Read as per-hunter it is twice too
       permissive, on big game, and nothing in the row looks wrong. */
    const limit = { kind: "LICENCE_YEAR" as never, count: 1, statedAs: "1 orignal, par 2 chasseurs, par année", appliesAcross: { scope: "THIS_SPECIES" as const }, allocatedTo: { scope: "SHARED_BY_GROUP" as const, hunters: 2 } };
    assert.match(limitSummary(limit), /per 2 hunters/);
  });

  it("holds a rule with no number, rather than dropping it", () => {
    const limit = { kind: "POSSESSION" as const, count: null, statedAs: "3 times the daily bag limit for game birds", appliesAcross: { scope: "THIS_SPECIES" as const } };
    assert.match(limitSummary(limit), /3 times the daily bag limit/);
  });
});
