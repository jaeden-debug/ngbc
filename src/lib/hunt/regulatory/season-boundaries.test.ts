import assert from "node:assert/strict";
import test from "node:test";
import { evaluateFederal, isFederalMigratoryBird } from "./federal.ts";
import { seasonCrossesYear } from "./season.ts";
import { huntBriefFixture } from "../../hunt-share/test-fixture.ts";
import { parseStoredHuntBrief } from "../../hunt-share/model.ts";
import type { IsoDate } from "../../content-contract/index.ts";
import type { SeasonDates } from "../types.ts";

/* The stored brief as this test manipulates it: enough shape to swap the season
   and read it back, written out rather than reached for with `any`. */
interface StoredBrief { regulatory: { season?: unknown } }
type Parsed = { status: string; brief?: { regulatory: { season?: SeasonDates & { datesInclusive: boolean } } } };
const clone = (brief: unknown): StoredBrief => JSON.parse(JSON.stringify(brief)) as StoredBrief;

/**
 * SEASON BOUNDARIES ARE TWO DIFFERENT FACTS AND THE TYPE SAYS WHICH.
 *
 * `RegulatoryResult.season` was `{opens: string; closes: string}` with no
 * declared format. Three producers wrote resolved ISO dates; the federal
 * migratory path wrote a bare `MM-DD`, because a federal season is published as
 * a recurring annual rule. 56 species — every federal migratory game bird —
 * took that path, and the Hunt Brief validator REJECTED all of them, because it
 * validates that field as an ISO date.
 *
 * The fix is not a looser validator and not an invented year. §41A: the source
 * model wins over our schema.
 */

const on = (date: string) => date as IsoDate;

test("a published federal season stays a recurring annual rule, with no invented year", () => {
  /* Schedule 3 Part 2: Snipe, October 1 to December 31 — a recurring rule. */
  const answer = evaluateFederal("species:wilsons-snipe", "jurisdiction:ca-pe", { latitude: 46.24 }, on("2026-11-05"));
  assert.equal(answer.season?.kind, "ANNUAL");
  assert.deepEqual(answer.season?.opens, { month: 10, day: 1 });
  assert.deepEqual(answer.season?.closes, { month: 12, day: 31 });

  /* The year of the question must not leak into the answer. Asking on a
     different date returns the same rule, because the rule does not move. */
  const laterYear = evaluateFederal("species:wilsons-snipe", "jurisdiction:ca-pe", { latitude: 46.24 }, on("2027-11-05"));
  assert.deepEqual(laterYear.season?.opens, answer.season?.opens, "a recurring rule is the same rule in any year");
});

test("a relative federal season keeps the year it was resolved to, and crosses into the next", () => {
  /*
   * The counterpart, and the half that was PURE LOSS: a relative window is
   * computed against the evaluation date — that is what "the Saturday after the
   * first Monday in October" means — so it HAS a real year, and the old code
   * sliced the year off a date it was already holding.
   *
   * British Columbia District No. 2 mallard, which ECCC's own published summary
   * states as October 10 to January 24 for 2026–27.
   */
  const open = evaluateFederal("species:mallard", "jurisdiction:ca-bc", { latitude: 49.2 }, on("2026-10-10"), "2-10");
  assert.equal(open.season?.kind, "ABSOLUTE", "a resolved window is not a recurring rule");
  assert.equal(open.season?.opens, "2026-10-10");
  assert.equal(open.season?.closes, "2027-01-24", "the close carries the FOLLOWING year, because this window crosses it");
  assert.equal(seasonCrossesYear(open.season as never), true);

  /* The same rule in a later year resolves to that year, which is the whole
     point of keeping it absolute rather than recurring. */
  const next = evaluateFederal("species:mallard", "jurisdiction:ca-bc", { latitude: 49.2 }, on("2027-10-11"), "2-10");
  assert.notEqual(next.season?.opens, open.season?.opens, "a resolved window moves with the year it is resolved in");
});

test("a cross-year recurring window is not inverted: September 19 to January 3", () => {
  /*
   * Mallard's federal season runs 19 September to 3 January. Compared as plain
   * strings, "01-03" < "09-19" says the season closes before it opens — which
   * is exactly what an untyped pair of strings invited, and why `crossesYear`
   * is DERIVED by one function rather than left to each reader.
   */
  assert.equal(seasonCrossesYear({ kind: "ANNUAL", opens: { month: 9, day: 19 }, closes: { month: 1, day: 3 } }), true);
  assert.equal(seasonCrossesYear({ kind: "ANNUAL", opens: { month: 10, day: 1 }, closes: { month: 12, day: 31 } }), false);
  /* Within one month, the day decides. */
  assert.equal(seasonCrossesYear({ kind: "ANNUAL", opens: { month: 9, day: 19 }, closes: { month: 9, day: 3 } }), true);
  assert.equal(seasonCrossesYear({ kind: "ANNUAL", opens: { month: 9, day: 3 }, closes: { month: 9, day: 19 } }), false);
  /* `lastDay` is the latest that month holds, so it never wraps; an opening on
     it, closing on an explicit earlier day, does. */
  assert.equal(seasonCrossesYear({ kind: "ANNUAL", opens: { month: 2, day: 1 }, closes: { month: 2, lastDay: true } }), false);
  assert.equal(seasonCrossesYear({ kind: "ANNUAL", opens: { month: 2, lastDay: true }, closes: { month: 2, day: 1 } }), true);
  /* An absolute window answers by its years, not by comparison of month-days. */
  assert.equal(seasonCrossesYear({ kind: "ABSOLUTE", opens: "2026-09-19", closes: "2027-01-03" }), true);
  assert.equal(seasonCrossesYear({ kind: "ABSOLUTE", opens: "2026-09-15", closes: "2026-12-31" }), false);
});

test("mallard and woodcock round-trip through the Brief that previously rejected them", () => {
  /*
   * THE REGRESSION THIS EXISTS FOR. The brief validator rejected a federal
   * season outright, so 56 species could not be shared. The fix is NOT that the
   * validator now accepts `MM-DD` — it is that the brief says which kind it
   * holds and validates each properly. A date that lost its year must still be
   * rejected.
   */
  for (const speciesId of ["species:mallard", "species:american-woodcock"]) {
    assert.ok(isFederalMigratoryBird(speciesId), `${speciesId} must be on the federal path for this test to mean anything`);
  }

  const base = clone(huntBriefFixture());
  assert.equal(parseStoredHuntBrief(base).status, "found", "the unmodified fixture must parse");

  /* Mallard's own shape: a recurring window that crosses the year. */
  const recurring = clone(base);
  recurring.regulatory.season = { kind: "ANNUAL", opens: { month: 9, day: 19 }, closes: { month: 1, day: 3 }, datesInclusive: true };
  const parsed = parseStoredHuntBrief(recurring) as Parsed;
  assert.equal(parsed.status, "found", "a recurring federal season must survive the brief");
  assert.deepEqual(parsed.brief?.regulatory.season?.opens, { month: 9, day: 19 }, "and arrive unchanged, with no year added");
  assert.deepEqual(parsed.brief?.regulatory.season?.closes, { month: 1, day: 3 });

  /* An ABSOLUTE season is still held to a real date: the loosening that would
     have "fixed" this the wrong way is still refused. */
  const lostItsYear = clone(base);
  lostItsYear.regulatory.season = { kind: "ABSOLUTE", opens: "09-15", closes: "12-16", datesInclusive: true };
  assert.equal(parseStoredHuntBrief(lostItsYear).status, "invalid", "an absolute boundary without a year is still invalid");

  /* And a recurring boundary that is not a real month is refused too. */
  const nonsense = clone(base);
  nonsense.regulatory.season = { kind: "ANNUAL", opens: { month: 13, day: 1 }, closes: { month: 1, day: 3 }, datesInclusive: true };
  assert.equal(parseStoredHuntBrief(nonsense).status, "invalid", "month 13 is not a month");
});

test("a brief written before the discriminator is read as absolute, which is the only thing it could be", () => {
  /*
   * Versions 1 to 4 carry no `kind`. Reading them as ABSOLUTE is sound rather
   * than assumed: the previous validator rejected anything failing an ISO
   * check, so a recurring boundary could never have been persisted.
   */
  const legacy = clone(huntBriefFixture());
  legacy.regulatory.season = { opens: "2026-09-15", closes: "2026-12-31", datesInclusive: true };
  const parsed = parseStoredHuntBrief(legacy) as Parsed;
  assert.equal(parsed.status, "found");
  assert.equal(parsed.brief?.regulatory.season?.kind, "ABSOLUTE");
  assert.equal(parsed.brief?.regulatory.season?.opens, "2026-09-15");
});
