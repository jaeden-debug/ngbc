import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

/**
 * THE SEASONS WHOSE DATES ARE COMPUTED, CHECKED BY PROPERTY RATHER THAN BY
 * RECOMPUTING THEM.
 *
 * `stated-season-dates.test.ts` cross-checks the 1,513 periods the authority
 * states as calendar dates and deliberately classifies out the 188 it states
 * RELATIVELY — "the Saturday closest to September 17", "the third Monday in
 * November", "a period of eight consecutive weeks beginning on the first Monday
 * in October". This is the other half.
 *
 * It does NOT re-run the weekday arithmetic. `relative-date.ts` owns that and a
 * test that calls it to check its own output verifies nothing. Instead each
 * resulting ISO date is asked whether it has the PROPERTIES its own wording
 * requires, computed from the date itself:
 *
 *   names a weekday        → the date must fall on that weekday
 *   ordinal + weekday + month → that weekday, that month, that week of the month
 *   "closest to <date>"    → within three days of the anchor
 *   "N consecutive weeks"  → the period spans exactly 7N days
 *
 * A one-day slip in any weekday rule, a month off by one, an ordinal counted from
 * the wrong end, or a period a week short all fail these; and none of them can be
 * satisfied by the code that produced the date being wrong in the same way.
 *
 * TWO THINGS THE PROBE GOT WRONG FIRST, BOTH WORTH KEEPING ON THE RECORD.
 *
 * 1. THE SEPARATOR " to " IS ALSO INSIDE "closest to" AND "prior to". Splitting
 *    naively at the first one handed the closing clause of "the Saturday closest
 *    to October 8 to November 15" the text "October 8 to November 15". The
 *    closest-to check then scored ZERO while looking implemented — a check that
 *    silently examines nothing is the failure this directory keeps finding, and it
 *    reads identically to a check that passes.
 *
 * 2. IT REPORTED NEW BRUNSWICK'S EIGHT-WEEK ARCHERY SEASON AS A WEEK SHORT, AND
 *    THE RECORD ALREADY EXPLAINED WHY. 2026-10-05..2026-11-22 is seven weeks
 *    under a phrase naming eight, and the rule's own note says it: the regulation
 *    grants eight weeks to 29 November, and s. 3.11(1) reserves the eighth to
 *    muzzle-loading firearms in zones set by a ministerial determination North
 *    Ground has not located, so the archery season is certified only to week
 *    seven. That is §8's worked example exactly — encode what is resolvable,
 *    leave what is not — and my checker read a deliberate conservative truncation
 *    as a defect. The fourth time in this work that unread context looked like
 *    bad data.
 *
 * So the span rule is not an allowlist. A period NARROWER than its stated wording
 * must carry a note saying why — which is the invariant that false positive was
 * pointing at, and it is a stronger rule than the one I set out to write: it
 * fails for an undocumented truncation anywhere in the corpus, and no entry of
 * mine has to be maintained for the documented ones.
 */

const DIR = "content/regulatory";
const DAYS: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};
const ORDINALS: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

const RELATIVE =
  /\b(first|second|third|fourth|fifth|last|closest|next following|immediately prior|preceding|prior to|following|before|after|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday|consecutive weeks|full week)\b/i;
const CODED = /^([A-Z])(\d{1,2})\s*[-–]\s*([A-Z])(\d{1,2})/;
const WEEKS = /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+consecutive weeks\b/i;
/* "the fourth to the seventh of the eight consecutive weeks" is a SUB-period of a
   longer one, so its span is not 7N and it is not the whole-period form. The
   marker is "OF THE n consecutive weeks", not the ordinal: my first version looked
   for the ordinal alone and so excluded "a period of two consecutive weeks
   beginning on the FOURTH MONDAY in October", which is a whole period whose
   opening is an ordinal weekday. It silently dropped a window the check was for. */
const SUB_PERIOD = /\bof the\s+(?:one|two|three|four|five|six|seven|eight|nine|ten)\s+consecutive weeks\b/i;

const utc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const weekdayOf = (iso: string) => new Date(utc(iso)).getUTCDay();
const dayOfMonth = (iso: string) => Number(iso.slice(8, 10));
const monthOf = (iso: string) => Number(iso.slice(5, 7));
const lastDayOfMonth = (iso: string) => new Date(Date.UTC(Number(iso.slice(0, 4)), monthOf(iso), 0)).getUTCDate();

/** The opening and closing clause, split at the real separator. */
function clausesOf(phrase: string): [string, string] | null {
  const masked = phrase.replace(/closest to/gi, "closest~to").replace(/prior to/gi, "prior~to").replace(/next to/gi, "next~to");
  /* The LAST separator: an opening clause may legitimately contain one ("the
     fourth to the seventh of the eight consecutive weeks"), and the split that
     matters is the one before the closing clause. */
  const match = /^(.*)\s+(?:to|until|through)\s+(.*)$/i.exec(masked);
  if (!match) return null;
  const unmask = (s: string) => s.replace(/~to/g, " to");
  return [unmask(match[1]), unmask(match[2])];
}

const weekdaysIn = (clause: string) => [
  ...new Set([...clause.toLowerCase().matchAll(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g)].map((m) => DAYS[m[1]])),
];

interface Window { opensIso?: string; closesIso?: string; opens?: string; closes?: string; statedAs?: string }
interface Rule { id: string; windows?: Window[]; seasonPhrase?: string; notes?: Array<{ text?: string }> }

interface Group { rule: string; phrase: string; opens: string; closes: string; notes: string }

function relativeGroups(): Array<{ file: string } & Group> {
  const groups: Array<{ file: string } & Group> = [];
  for (const file of readdirSync(DIR).filter((f) => f.endsWith(".json"))) {
    let parsed: { rules?: Rule[] };
    try { parsed = JSON.parse(readFileSync(`${DIR}/${file}`, "utf8")) as { rules?: Rule[] }; } catch { continue; }
    for (const rule of parsed.rules ?? []) {
      const windows = (rule.windows ?? [])
        /* Québec keys its windows `opens`/`closes`; everything else uses the Iso
           pair. Reading only one shape silently skips 196 windows. */
        .map((w) => ({ opens: w.opensIso ?? w.opens, closes: w.closesIso ?? w.closes, phrase: w.statedAs ?? rule.seasonPhrase ?? "" }))
        .filter((w): w is { opens: string; closes: string; phrase: string } => typeof w.opens === "string" && typeof w.closes === "string");
      const byPhrase = new Map<string, typeof windows>();
      for (const w of windows) {
        const seen = byPhrase.get(w.phrase);
        if (seen) seen.push(w); else byPhrase.set(w.phrase, [w]);
      }
      for (const [phrase, group] of byPhrase) {
        if (CODED.test(phrase.trim()) || !RELATIVE.test(phrase)) continue;
        const sorted = [...group].sort((a, b) => a.opens.localeCompare(b.opens));
        groups.push({
          file, rule: rule.id, phrase,
          opens: sorted[0].opens,
          closes: sorted[sorted.length - 1].closes,
          notes: (rule.notes ?? []).map((n) => n.text ?? "").join(" "),
        });
      }
    }
  }
  return groups;
}

test("the whole relative population is found, and found in both window shapes", () => {
  const groups = relativeGroups();
  /* Declared, because a checker that classified everything out would pass. */
  assert.equal(groups.length, 188);
  const files = new Set(groups.map((g) => g.file));
  assert.deepEqual([...files].sort(), ["ca-nb-2026.json", "ca-ns-2026.json", "ca-on-major-game-2026.json", "ca-sk-2026.json", "us-ia-2026.json"]);
});

test("a date computed from a weekday rule falls on that weekday, in that week, near that anchor", () => {
  const wrong: string[] = [];
  const checked = { weekday: 0, ordinal: 0, closest: 0, unclassified: 0 };

  for (const group of relativeGroups()) {
    const clauses = clausesOf(group.phrase);
    if (!clauses) { checked.unclassified += 1; continue; }
    for (const [index, label] of [[0, "opens"], [1, "closes"]] as const) {
      const clause = clauses[index];
      const iso = index === 0 ? group.opens : group.closes;
      /* A clause naming an ordinal week OF a longer period — "the seventh of the
         eight consecutive weeks beginning on the first Monday in October" — borrows
         that period's weekday and month, which are the PERIOD's start and not this
         endpoint's. Reading them as the endpoint's own requirement reported New
         Brunswick's week-seven close as a Monday in October; it is the Sunday that
         ends week seven. Sub-periods are checked by span instead, below. */
      if (SUB_PERIOD.test(clause)) { checked.unclassified += 1; continue; }
      const weekdays = weekdaysIn(clause);
      /* A clause naming two weekdays ("the Sunday immediately prior to the first
         Monday in November") describes one date by reference to another; which
         weekday the date itself must be is not decidable from the clause alone, so
         it is counted rather than guessed. */
      if (weekdays.length !== 1) { checked.unclassified += 1; continue; }

      checked.weekday += 1;
      if (weekdayOf(iso) !== weekdays[0]) {
        wrong.push(`${group.file} ${group.rule}: ${label} ${iso} is a ${DAY_NAMES[weekdayOf(iso)]}, “${clause}” requires ${DAY_NAMES[weekdays[0]]}`);
      }

      const ordinal = /\b(first|second|third|fourth|fifth|last)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+in\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.exec(clause);
      if (ordinal) {
        checked.ordinal += 1;
        const month = MONTHS[ordinal[3].toLowerCase()];
        const day = dayOfMonth(iso);
        if (monthOf(iso) !== month) {
          wrong.push(`${group.file} ${group.rule}: ${label} ${iso} is not in ${ordinal[3]} — “${clause}”`);
        } else if (ordinal[1].toLowerCase() === "last") {
          if (day + 7 <= lastDayOfMonth(iso)) {
            wrong.push(`${group.file} ${group.rule}: ${label} ${iso} is not the LAST ${DAY_NAMES[weekdays[0]]} in ${ordinal[3]} — “${clause}”`);
          }
        } else {
          const nth = ORDINALS[ordinal[1].toLowerCase()];
          if (day < (nth - 1) * 7 + 1 || day > nth * 7) {
            wrong.push(`${group.file} ${group.rule}: ${label} ${iso} (day ${day}) is not in the ${ordinal[1]} week — “${clause}”`);
          }
        }
      }

      const closest = /closest to\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/i.exec(clause);
      if (closest) {
        checked.closest += 1;
        const anchor = Date.UTC(Number(iso.slice(0, 4)), MONTHS[closest[1].toLowerCase()] - 1, Number(closest[2]));
        const days = Math.abs((utc(iso) - anchor) / 86_400_000);
        if (days > 3) {
          wrong.push(`${group.file} ${group.rule}: ${label} ${iso} is ${days} days from ${closest[1]} ${closest[2]} — “${clause}”`);
        }
      }
    }
  }

  /* The counts are asserted so a splitter change cannot quietly empty a check —
     which is exactly what happened to `closest` on the first attempt. */
  assert.deepEqual(checked, { weekday: 141, ordinal: 45, closest: 30, unclassified: 229 });
  assert.deepEqual(wrong, [], `relative dates that do not have the properties their wording requires:\n  ${wrong.join("\n  ")}`);
});

const ORDINAL_RANGE = new RegExp(
  `\\b(${Object.keys(ORDINALS).join("|")}|sixth|seventh|eighth)\\s+(?:to the|and(?: the)?)\\s+(${Object.keys(ORDINALS).join("|")}|sixth|seventh|eighth)\\s+of the\\s+(?:one|two|three|four|five|six|seven|eight|nine|ten)\\s+consecutive weeks`,
  "i",
);
const WEEK_INDEX: Record<string, number> = { ...ORDINALS, sixth: 6, seventh: 7, eighth: 8 };

test("a sub-period of a longer season spans exactly the weeks it names", () => {
  /*
   * "the fourth to the seventh of the eight consecutive weeks" is four weeks, and
   * "the fourth and fifth of the five consecutive weeks" is two. The span is the
   * independent fact — it needs none of the weekday arithmetic that produced the
   * dates — and an ordinal counted from the wrong end or a week dropped fails it.
   */
  const wrong: string[] = [];
  let checked = 0;
  for (const group of relativeGroups()) {
    const range = ORDINAL_RANGE.exec(group.phrase);
    if (!range) continue;
    checked += 1;
    const expected = (WEEK_INDEX[range[2].toLowerCase()] - WEEK_INDEX[range[1].toLowerCase()] + 1) * 7;
    const span = (utc(group.closes) - utc(group.opens)) / 86_400_000 + 1;
    if (span !== expected) {
      wrong.push(`${group.file} ${group.rule}: ${group.opens}..${group.closes} spans ${span} days, not the ${expected} its ${range[1]}-to-${range[2]} wording states`);
    }
  }
  assert.equal(checked, 2, "New Brunswick states both of its sub-periods this way");
  assert.deepEqual(wrong, [], wrong.join("\n"));
});

test("a period narrower than its stated wording says why", () => {
  const unexplained: string[] = [];
  let whole = 0;
  let explained = 0;

  for (const group of relativeGroups()) {
    const weeks = WEEKS.exec(group.phrase);
    if (!weeks || SUB_PERIOD.test(group.phrase)) continue;
    const span = (utc(group.closes) - utc(group.opens)) / 86_400_000 + 1;
    const stated = WORD_NUMBERS[weeks[1].toLowerCase()] * 7;
    if (span === stated) { whole += 1; continue; }
    if (span > stated) {
      unexplained.push(`${group.file} ${group.rule}: ${span} days is LONGER than the ${stated} its wording states`);
      continue;
    }
    /* Narrower than stated is legitimate and §8 requires it where part of the
       period is unresolvable — but it has to be said, not inferred by whoever
       next compares the dates with the words. */
    if (/\b(reserve|reserves|certified|not located|unresolved|determination)\b/i.test(group.notes)) { explained += 1; continue; }
    unexplained.push(`${group.file} ${group.rule}: ${span} days against a stated ${stated}, with no note explaining the truncation`);
  }

  assert.deepEqual({ whole, explained }, { whole: 2, explained: 1 },
    "two whole periods span exactly their stated weeks; one is deliberately narrower and says so");
  assert.deepEqual(unexplained, [], unexplained.join("\n"));
});
