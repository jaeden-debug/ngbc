import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import test from "node:test";

import { isValidYmd } from "../date.ts";
import { resolveWindow } from "./season.ts";

/**
 * EVERY DATE NORTH GROUND HAS COMMITTED NAMES A DAY THAT EXISTS.
 *
 * Found as an aside while mutating Wyoming's printed-day conversion: shifting the
 * day by one produced `2026-09-31` and the build published it. September has
 * thirty days.
 *
 * THE CONSEQUENCE IS NOT A CRASH, IT IS A LONGER SEASON. Measured here rather
 * than assumed:
 *
 *   new Date("2026-09-31T00:00:00Z")  →  2026-10-01   (one day LATER)
 *   new Date("2026-02-30T00:00:00Z")  →  2026-03-02   (two days later)
 *   sorted as strings: 2026-09-30 < 2026-09-31 < 2026-10-01
 *
 * So an impossible closing date SORTS plausibly and PARSES a day late: a season
 * open one day longer than the authority granted, from a date that does not
 * exist. §41A already requires an impossible date refused rather than rolled
 * forward, and §8 calls a rule looser than its source a false claim just as much
 * as a stricter one. This is the looser direction, and it is the one that gets a
 * hunter charged.
 *
 * WHY THIS CHECK SITS ON THE ARTIFACTS RATHER THAN IN THE BUILDERS. `season.ts`
 * validates properly — `resolveWindow` refuses a window that does not describe
 * real calendar days — but that guard runs on month/day anchors resolved at
 * RUNTIME, and no builder calls it: nineteen scripts write `opensIso` and
 * `closesIso` strings themselves, across fifty-six `writeFileSync` sites with no
 * shared writer to put one guard in. A sweep over what is COMMITTED covers every
 * one of them at once, and covers a hand-edited artifact too, which a builder
 * guard would not. If a single publish path ever appears, the guard belongs there
 * as well — Manitoba's builder refusing to build is the strongest form of this
 * and the pattern to copy.
 */

/* The canonical validator is `isValidYmd`, used so this test cannot disagree with
   the engine about what a real day is — including the leap-century rule and the
   1900–2200 bound. The corpus spans 2000–2028, so that bound is slack, not a
   constraint being tested. */
function namesARealDay(iso: string): boolean {
  const [year, month, day] = iso.split("-").map(Number);
  return isValidYmd(year, month, day);
}

test("the day checker rejects days that do not exist and accepts days that do", () => {
  /*
   * ITS OWN POSITIVE CONTROL, in the test rather than in a separate mutation run.
   * A sweep that finds nothing and a sweep that cannot find anything produce the
   * same output, and the corpus is clean today — so without this, the next person
   * to read a green result learns nothing about whether it was looking.
   */
  for (const impossible of ["2026-09-31", "2026-02-30", "2026-11-31", "2026-04-31", "2026-13-01", "2026-00-10", "2026-01-00", "2100-02-29"]) {
    assert.equal(namesARealDay(impossible), false, `${impossible} is not a day`);
  }
  for (const real of ["2026-09-30", "2026-02-28", "2028-02-29", "2000-02-29", "2026-12-31", "2026-01-01"]) {
    assert.equal(namesARealDay(real), true, `${real} is a day`);
  }
});

/** Every `.json` under `content/`, recursively. */
function contentFiles(dir = "content", found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = `${dir}/${entry}`;
    if (statSync(path).isDirectory()) contentFiles(path, found);
    else if (entry.endsWith(".json")) found.push(path);
  }
  return found;
}

/* ISO-shaped strings are matched in the raw text rather than by walking parsed
   objects, because a date can sit in a value, a key, or inside a quoted sentence,
   and the point is that NONE of those may name a day that does not exist. */
const ISO_IN_JSON = /"(\d{4}-\d{2}-\d{2})"/g;

test("no committed content names a calendar day that does not exist", () => {
  const impossible = new Map<string, number>();
  let scanned = 0;
  let files = 0;

  for (const file of contentFiles()) {
    files += 1;
    for (const match of readFileSync(file, "utf8").matchAll(ISO_IN_JSON)) {
      scanned += 1;
      if (namesARealDay(match[1])) continue;
      /* Grouped by file and date rather than listed per occurrence: one bad
         conversion shows up on hundreds of rules, and a truncated per-occurrence
         list would report one file and hide the rest. */
      const shape = `${file}: ${match[1]}`;
      impossible.set(shape, (impossible.get(shape) ?? 0) + 1);
    }
  }

  /* The population is stated so the sweep cannot quietly narrow to nothing while
     still passing. 47,196 dates across 709 files when this was written; the floors
     are well below that, because they exist to catch a sweep that stopped
     looking, not to be edited whenever content grows. */
  assert.ok(files > 600, `only ${files} content files walked`);
  assert.ok(scanned > 40_000, `only ${scanned} dates scanned — the sweep stopped looking`);

  const reported = [...impossible].sort().map(([shape, count]) => `${shape}  [${count}x]`);
  assert.deepEqual(reported, [],
    `dates naming days that do not exist:\n  ${reported.join("\n  ")}`);
});

test("the runtime window guard still refuses a month's thirty-first day", () => {
  /*
   * The other half of the defect, pinned by behaviour rather than by grepping for
   * a call. `resolveWindow` is where a month/day anchor becomes an ISO date, and
   * it is the one place that already refuses an impossible one. Nothing today
   * routes bundle data through it, so this asserts the guard is intact for
   * whatever does — including a future builder that finally calls it.
   */
  assert.throws(
    () => resolveWindow({ opens: { month: 9, day: 1 }, closes: { month: 9, day: 31 } }, 2026),
    /does not describe real calendar days/,
  );
  assert.throws(
    () => resolveWindow({ opens: { month: 2, day: 30 }, closes: { month: 3, day: 1 } }, 2026),
    /does not describe real calendar days/,
  );
  /* 29 February exists in 2028 and does not in 2026, and a crossing window closes
     in the FOLLOWING year — so the guard has to be evaluated in the year the day
     actually falls in, not the year the season opened. */
  assert.deepEqual(resolveWindow({ opens: { month: 9, day: 1 }, closes: { month: 2, day: 29 } }, 2027),
    { opensIso: "2027-09-01", closesIso: "2028-02-29", crossesYear: true });
  assert.throws(
    () => resolveWindow({ opens: { month: 9, day: 1 }, closes: { month: 2, day: 29 } }, 2026),
    /does not describe real calendar days/,
  );
});
