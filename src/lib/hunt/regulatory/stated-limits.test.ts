import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

/**
 * BAG, DAILY AND POSSESSION LIMITS, CROSS-CHECKED AGAINST THE AUTHORITY'S OWN
 * WORDS.
 *
 * Found by mutation. Changing Idaho's pronghorn bag from 1 to 2 in its builder,
 * Wyoming's elk bag from 1 to 2, and British Columbia's bow grouse limit from
 * 5(15) to 8(24), then rebuilding and running every test step independently:
 * 2,193 tests, zero failures. 937 limits moved and nothing noticed. The test
 * files that read those three bundles — us-wyoming, us-idaho,
 * british-columbia-served, engine-answers-somewhere — all ran, so the zero was a
 * true negative rather than a suite that never looked.
 *
 * A limit is what a hunter is allowed to take. A bag that drifts from 1 to 2
 * tells them a second animal is lawful, which §62 puts with the most serious
 * failures this product can have.
 *
 * WHY THIS IS A CROSS-CHECK AND NOT A LIST OF 1,500 ASSERTIONS. Every limit is
 * held twice: as structured numbers the engine computes with, and as the
 * authority's own stated phrase that a hunter reads. Those are two
 * independently-derived representations of one fact, so requiring them to agree
 * pins both — and it keeps working as jurisdictions are added, which a fixture
 * of today's numbers would not.
 *
 * WHERE THE CROSS-CHECK IS VACUOUS IT SAYS SO. Alberta and British Columbia
 * GENERATE `statedAs` from the same numbers ("5 daily, 15 in possession"), so the
 * two cannot disagree and agreement proves nothing. Those two are pinned by an
 * explicit table instead, and the table exists to record that their figures rest
 * on the printed-source guard alone. Naming the vacuous cases is the point: a
 * cross-check that silently passes where it cannot fail is the shape of every
 * false pin in this directory.
 */

const DIR = "content/regulatory";

interface Limits {
  daily?: number; possession?: number; bag?: number;
  statedAs?: string; combined?: boolean;
}
interface Rule { id: string; limits?: Limits }

function bundlesWithLimits(): Array<{ file: string; rules: Rule[] }> {
  const out: Array<{ file: string; rules: Rule[] }> = [];
  for (const file of readdirSync(DIR).filter((f) => f.endsWith(".json"))) {
    let parsed: { rules?: Rule[] };
    try { parsed = JSON.parse(readFileSync(`${DIR}/${file}`, "utf8")) as { rules?: Rule[] }; }
    catch { continue; }
    const rules = (parsed.rules ?? []).filter((rule) => rule.limits);
    if (rules.length) out.push({ file, rules });
  }
  return out;
}

/* The authority writes limits in words as often as in numerals — Manitoba's "one
   white-tailed deer", Ontario's "limit of five", Colorado's "Ten (10)" — so both
   are read. Nothing above forty appears in the corpus; an unreadable word is a
   failure to extend this list, not a licence to skip the check. */
const WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, fifteen: 15, sixteen: 16, twenty: 20, thirty: 30, forty: 40,
};

function numbersIn(phrase: string): Set<number> {
  const found = new Set<number>();
  for (const match of phrase.matchAll(/\d+/g)) found.add(Number(match[0]));
  for (const [word, value] of Object.entries(WORDS)) {
    if (new RegExp(`\\b${word}\\b`, "i").test(phrase)) found.add(value);
  }
  return found;
}

/* Montana and Nova Scotia state the possession limit as a MULTIPLE of the daily
   bag rather than as a number — "possession limit four times the daily bag limit",
   "possession twice the daily bag after the first day" — so the arithmetic is the
   fact and is checked as arithmetic.
 *
 * NOVA SCOTIA IS WHY BOTH FORMS ARE READ. The first run of this test flagged its
 * ruffed grouse possession of 10 against "5 birds per day; possession twice the
 * daily bag": the figure is right and only my reading was short. A cross-check
 * that treats its own unread vocabulary as a defect in the data is how a correct
 * record gets "fixed" into a wrong one. */
function statedMultiplier(phrase: string): number | null {
  if (/possession twice the daily bag/i.test(phrase)) return 2;
  const match = /possession limit (\w+) times the daily bag limit/i.exec(phrase);
  if (!match) return null;
  const word = WORDS[match[1].toLowerCase()];
  if (word !== undefined) return word;
  const digits = Number(match[1]);
  return Number.isFinite(digits) ? digits : null;
}

/* Bundles whose `statedAs` is GENERATED from the structured numbers, so the
   cross-check cannot fail there. Each is pinned by its table below instead. */
const DERIVED_STATED_AS = new Set(["ca-ab-2026.json", "ca-bc-2026.json"]);

/* HOW MANY RULES EACH BUNDLE CARRIES A LIMIT ON. The positive control: a zero and
   a bundle the test never opened produce the same output, so the population is
   declared rather than counted at run time. A jurisdiction losing its limits, or
   gaining rules that carry none, is then a failure instead of a smaller number
   nobody reads. */
const LIMIT_COUNTS: Record<string, number> = {
  "ca-ab-2026.json": 7,
  "ca-bc-2026.json": 79,
  "ca-mb-2026.json": 85,
  "ca-nb-2026.json": 15,
  "ca-nl-2026.json": 13,
  "ca-ns-2026.json": 11,
  "ca-on-small-game-2026.json": 11,
  "ca-sk-2026.json": 149,
  "us-co-small-game-2026.json": 79,
  /* Iowa arrived while this test was being written, and the declared population is
     why that was a failure rather than a silently larger number: its fourteen
     limits were read and cross-check against the authority's own wording before
     the row was added. A jurisdiction cannot join the corpus unexamined. */
  "us-ia-2026.json": 14,
  "us-id-pronghorn-2026.json": 54,
  /* 27 firearm and archery rules over eight upland species and 26 falconry
     rules, each falconry limit the pool's own "2 daily in aggregate and 6 in
     possession" (sage grouse's general limit is carried beside it, not in it). */
  "us-mt-upland-2026.json": 53,
  "us-wy-elk-2026.json": 804,
};

test("every bundle that carries limits carries the number of them it carried before", () => {
  const actual = Object.fromEntries(bundlesWithLimits().map((b) => [b.file, b.rules.length]));
  assert.deepEqual(actual, LIMIT_COUNTS);
});

test("every structured limit is readable in the authority's own stated phrase", () => {
  const bundles = bundlesWithLimits().filter((b) => !DERIVED_STATED_AS.has(b.file));
  assert.equal(bundles.length, Object.keys(LIMIT_COUNTS).length - DERIVED_STATED_AS.size);

  const wrong = new Map<string, number>();
  let checked = 0;
  for (const { file, rules } of bundles) {
    for (const rule of rules) {
      const limits = rule.limits as Limits;
      const phrase = limits.statedAs;
      if (!phrase) {
        const shape = `${file}: a limit with no stated wording`;
        wrong.set(shape, (wrong.get(shape) ?? 0) + 1);
        continue;
      }
      const stated = numbersIn(phrase);
      const multiplier = statedMultiplier(phrase);
      for (const field of ["daily", "possession", "bag"] as const) {
        const value = limits[field];
        if (typeof value !== "number") continue;
        checked += 1;
        /* Montana's possession is the daily bag times a stated multiplier, which
           is why the multiplier is honoured only for `possession`: applying it to
           a daily or season bag would invent a rule the authority never stated. */
        if (field === "possession" && multiplier !== null && typeof limits.daily === "number"
            && value === limits.daily * multiplier) continue;
        if (!stated.has(value)) {
          /* Grouped by SHAPE, not listed per rule. Wyoming carries one limit on
             804 rules; a per-rule list truncated to twenty reports Wyoming alone
             and hides every other jurisdiction, which is the same defect as
             stopping at the first failure. One line per (field, value, wording)
             with a count says what moved and how widely. */
          const shape = `${file}: ${field} ${value} is not in “${phrase}”`;
          wrong.set(shape, (wrong.get(shape) ?? 0) + 1);
        }
      }
    }
  }
  /* 1,309 numbers as of this commit. The floor is not a tuning constant: it is
     what stops the loop silently narrowing to nothing while still passing. */
  assert.ok(checked > 1250, `only ${checked} numbers cross-checked — the corpus has more`);
  const reported = [...wrong].sort().map(([shape, count]) => `${shape}  [${count} rules]`);
  assert.deepEqual(reported, [],
    `structured limits the authority's wording does not support:\n  ${reported.join("\n  ")}`);
});

test("a phrase stating no number carries no structured number", () => {
  /*
   * "No season", "Shares the stamp limits in s. 5" — the authority has not stated
   * a quantity, so neither may North Ground. The failure this prevents is the
   * quiet appearance of a bag limit on a rule whose source never gave one, which
   * reads to a hunter as permission to take that many.
   */
  const claimed: string[] = [];
  for (const { file, rules } of bundlesWithLimits()) {
    for (const rule of rules) {
      const limits = rule.limits as Limits;
      const phrase = limits.statedAs ?? "";
      if (/^(no season|no antlered deer season)$/i.test(phrase.trim())
          && (limits.daily ?? limits.possession ?? limits.bag) !== undefined) {
        claimed.push(`${file} ${rule.id}: “${phrase}” yet carries a number`);
      }
    }
  }
  assert.deepEqual(claimed, [], claimed.join("\n"));
});

/* ── The two bundles whose stated wording cannot disagree with their numbers ──
 *
 * Reviewable on purpose: a legitimate regulatory change shows as a diff a person
 * reads, which is what §45 asks for. A hash would also catch drift and would tell
 * a reviewer nothing about what moved.
 */
const DERIVED_TABLES: Record<string, Record<string, number>> = {
  "ca-ab-2026.json": {
    "5/15/-  5 daily, 15 in possession": 7,
  },
  "ca-bc-2026.json": {
    "-/-/10  10 (season bag limit)": 1,
    "-/-/2  2 (season bag limit)": 18,
    "10/-/-  10 per day": 7,
    "10/30/-  10 per day, 30 in possession": 16,
    "10/30/-  10 per day, 30 in possession (all ptarmigan together)": 6,
    "3/6/-  3 per day, 6 in possession": 1,
    "5/10/-  5 per day, 10 in possession": 2,
    "5/15/-  5 per day, 15 in possession": 16,
    "5/15/-  5 per day, 15 in possession (all ptarmigan together)": 12,
  },
};

for (const [file, expected] of Object.entries(DERIVED_TABLES)) {
  test(`${file} states the limits it stated before`, () => {
    const parsed = JSON.parse(readFileSync(`${DIR}/${file}`, "utf8")) as { rules?: Rule[] };
    const actual: Record<string, number> = {};
    for (const rule of parsed.rules ?? []) {
      const limits = rule.limits;
      if (!limits) continue;
      const key = `${limits.daily ?? "-"}/${limits.possession ?? "-"}/${limits.bag ?? "-"}  ${limits.statedAs}`;
      actual[key] = (actual[key] ?? 0) + 1;
    }
    assert.deepEqual(actual, expected);
  });
}
