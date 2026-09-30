import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { opportunityRowsFrom } from "./opportunity-adapter.ts";
import { stated, UNRESOLVED, type ResolvedOpportunity } from "./opportunity-row.ts";
import { opportunityTimeline, readingOrder } from "./opportunity-timeline.ts";
import type { RuleShape } from "./dimension-matrix.ts";

const DEER = "species:white-tailed-deer";

const row = (over: Partial<ResolvedOpportunity> = {}): ResolvedOpportunity => ({
  ruleId: "regulatory_rule:test",
  speciesId: DEER,
  animalClass: stated("ANTLERED"),
  criterion: null,
  implements: stated(["RIFLE"]),
  windows: [{ opens: "2026-10-01", closes: "2026-10-14", datesInclusive: true }],
  conditionIds: [],
  ...over,
});

const window = (opens: string, closes: string, datesInclusive = true) => ({ opens, closes, datesInclusive });

test("identical opportunities become one entry carrying both date ranges", () => {
  const october = row({ windows: [window("2026-10-01", "2026-10-14")] });
  const november = row({ windows: [window("2026-11-01", "2026-11-20")] });
  /* Fed in REVERSE order, so the sort is doing work rather than the input
     happening to be tidy. */
  const timeline = opportunityTimeline([november, october], "2026-10-05");
  assert.equal(timeline.length, 1, "same legal facts, two date ranges: one entry");
  assert.deepEqual(timeline[0].windows.map((w) => w.opens), ["2026-10-01", "2026-11-01"], "sorted, both kept");

  /* Same opening day, different closing days: sorted on the close. */
  const shorter = row({ windows: [window("2026-10-01", "2026-10-07")] });
  const longer = row({ windows: [window("2026-10-01", "2026-10-31")] });
  assert.deepEqual(
    opportunityTimeline([longer, shorter], "2026-10-05")[0].windows.map((w) => w.closes),
    ["2026-10-07", "2026-10-31"],
  );
});

test("legally distinct opportunities never merge, however their dates overlap", () => {
  /*
   * The failure this is named for: two seasons running on exactly the same days
   * that permit different animals or different methods are two opportunities,
   * and presenting them as one would tell a hunter a rifle is legal in a season
   * that is archery-only.
   */
  const days = [window("2026-10-01", "2026-10-31")];
  const antleredRifle = row({ animalClass: stated("ANTLERED"), implements: stated(["RIFLE"]), windows: days });
  const antlerlessBow = row({ animalClass: stated("ANTLERLESS"), implements: stated(["BOW"]), windows: days });
  const timeline = opportunityTimeline([antleredRifle, antlerlessBow], "2026-10-05");
  assert.equal(timeline.length, 2, "identical dates, different law: two entries");
  for (const entry of timeline) assert.equal(entry.state, "OPEN_ON_DATE");
});

test("a window is open on both its edges, and not the day after", () => {
  const entry = opportunityTimeline([row({ windows: [window("2026-10-01", "2026-10-14")] })], "2026-10-01")[0];
  assert.equal(entry.state, "OPEN_ON_DATE", "the opening day is inside an inclusive window");
  assert.equal(opportunityTimeline([row()], "2026-10-14")[0].state, "OPEN_ON_DATE", "and so is the closing day");
  assert.equal(opportunityTimeline([row()], "2026-10-15")[0].state, "NO_FURTHER_PUBLISHED_WINDOW");
  assert.equal(opportunityTimeline([row()], "2026-09-30")[0].state, "OPENS_LATER");

  /* An exclusive window excludes its closing day, and is a DIFFERENT window
     from an inclusive one with the same two dates. */
  const exclusive = row({ windows: [window("2026-10-01", "2026-10-14", false)] });
  assert.equal(opportunityTimeline([exclusive], "2026-10-14")[0].state, "NO_FURTHER_PUBLISHED_WINDOW");
});

test("a past season is not called closed, because we may only lack next year's dates", () => {
  /*
   * "Closed" and "over" are claims about the law. This is a statement about the
   * records North Ground holds, and the difference matters most late in a
   * season when next year's dates are not published — exactly when a hunter
   * would act on being told the season is over.
   */
  const entry = opportunityTimeline([row()], "2027-01-01")[0];
  assert.equal(entry.state, "NO_FURTHER_PUBLISHED_WINDOW");
  assert.equal(entry.nextOpens, null);
  assert.equal(entry.openWindow, null);
  /* Nothing in the entry says closed, shut, over or ended. */
  assert.ok(!/closed|shut|\bover\b|ended|finished/i.test(JSON.stringify(entry)));
});

test("the next opening is the next one, not the one the hunter is already in", () => {
  const entry = opportunityTimeline([row({ windows: [window("2026-10-01", "2026-10-14"), window("2026-11-01", "2026-11-20")] })], "2026-10-05")[0];
  assert.equal(entry.state, "OPEN_ON_DATE");
  assert.equal(entry.nextOpens, "2026-11-01", "strictly after the date");
  assert.equal(entry.openWindow?.opens, "2026-10-01");

  /* On the opening day itself, that window is the one you are in — the next is
     still the one after it. */
  const onOpeningDay = opportunityTimeline([row({ windows: [window("2026-10-01", "2026-10-14")] })], "2026-10-01")[0];
  assert.equal(onOpeningDay.nextOpens, null);
});

test("duplicate published windows are shown once, and adjacent ones are not combined", () => {
  const duplicated = row({ windows: [window("2026-10-01", "2026-10-14"), window("2026-10-01", "2026-10-14")] });
  assert.equal(opportunityTimeline([duplicated], "2026-10-05")[0].windows.length, 1, "not repeating");

  /* Two windows the authority published separately stay two, even touching:
     combining them would print a range the ministry never wrote. */
  const adjacent = row({ windows: [window("2026-10-01", "2026-10-14"), window("2026-10-15", "2026-10-31")] });
  assert.equal(opportunityTimeline([adjacent], "2026-10-05")[0].windows.length, 2, "not combining");

  /*
   * AND THE SAME TWO DATES ARE NOT THE SAME WINDOW. One window includes its
   * closing day and the other does not, so they end on different days despite
   * reading alike. De-duplicating them together would silently drop whichever
   * arrived second — and if it were the inclusive one, a hunter loses a legal
   * day.
   */
  const bothForms = row({ windows: [window("2026-10-01", "2026-10-14", true), window("2026-10-01", "2026-10-14", false)] });
  assert.equal(opportunityTimeline([bothForms], "2026-10-05")[0].windows.length, 2, "inclusivity is part of a window's identity");
});

test("reading order puts what is open first, then the soonest to open", () => {
  const openNow = row({ animalClass: stated("ANTLERED"), windows: [window("2026-10-01", "2026-10-31")] });
  const soon = row({ animalClass: stated("ANTLERLESS"), windows: [window("2026-11-01", "2026-11-10")] });
  const later = row({ animalClass: stated("BEARDED"), windows: [window("2026-12-01", "2026-12-10")] });
  const past = row({ animalClass: UNRESOLVED, windows: [window("2026-08-01", "2026-08-10")] });

  const ordered = readingOrder(opportunityTimeline([later, past, soon, openNow], "2026-10-05"));
  assert.deepEqual(ordered.map((entry) => entry.state), [
    "OPEN_ON_DATE", "OPENS_LATER", "OPENS_LATER", "NO_FURTHER_PUBLISHED_WINDOW",
  ]);
  assert.deepEqual(
    ordered.filter((entry) => entry.state === "OPENS_LATER").map((entry) => entry.nextOpens),
    ["2026-11-01", "2026-12-01"],
    "soonest first within the band",
  );
});

test("a real jurisdiction's timeline groups without merging anything legally distinct", () => {
  /*
   * Over Québec's certified deer rules rather than fixtures. The assertion that
   * matters is the invariant, not a count: every entry must hold exactly one
   * combination of legal facts, so two rows in one entry can never disagree
   * about class or implement.
   */
  const bundle = JSON.parse(readFileSync(new URL("../../../../content/regulatory/ca-qc-2026.json", import.meta.url), "utf8")) as {
    rules?: RuleShape[];
  };
  const rows = opportunityRowsFrom({ speciesId: DEER, rules: (bundle.rules ?? []).filter((rule) => rule.speciesId === DEER) });
  assert.ok(rows.length > 10, `positive control: Québec's deer rows (${rows.length})`);

  const timeline = opportunityTimeline(rows, "2026-10-05");
  assert.ok(timeline.length > 1, "positive control: more than one distinct opportunity");
  assert.ok(timeline.length <= rows.length, "grouping cannot invent entries");

  for (const entry of timeline) {
    const classes = new Set(entry.rows.map((r) => JSON.stringify(r.animalClass)));
    const methods = new Set(entry.rows.map((r) => JSON.stringify(r.implements)));
    assert.equal(classes.size, 1, `entry ${entry.identity} mixes animal classes`);
    assert.equal(methods.size, 1, `entry ${entry.identity} mixes implements`);
    assert.ok(entry.windows.length > 0, "an entry with no window is not an opportunity");
  }
});
