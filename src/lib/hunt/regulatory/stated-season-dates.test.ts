import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

/**
 * SEASON DATES, CROSS-CHECKED AGAINST THE AUTHORITY'S OWN STATED PERIOD.
 *
 * A season's opening and closing day is the most-relied-upon figure this product
 * holds, and like the limits before it (`stated-limits.test.ts`) it is held twice:
 * as the ISO dates the engine evaluates, and as the authority's own wording a
 * hunter reads — "Sept. 1 – Jan. 1", « Du 3 au 16 octobre 2026 », "October 1 -
 * end of February annually", Alberta's coded "S1 - N3". Requiring the two to agree
 * pins 1,513 of the corpus's 1,701 stated periods across fourteen jurisdictions,
 * and keeps working as jurisdictions arrive.
 *
 * WHAT IT CATCHES, STATED PRECISELY, BECAUSE THE OVERCLAIM IS EASY. In most
 * bundles the stated wording and the ISO dates have ONE origin: Wyoming builds
 * `statedAs` from the same printed pair it converts ("Sep. 26 – Nov. 30" and the
 * ISO dates both come from that cell), and British Columbia and Québec take their
 * wording from the quoted provision the dates were read out of. So this is not a
 * pin against someone hand-editing a date — a source change moves both
 * consistently, and the printed-source hash is what guards that.
 *
 * What it does catch is the CONVERSION between the two, which is a real and
 * separate class: an off-by-one in a day, a month read wrong, a cross-year season
 * placed in the wrong year, a parser that drops the second half of a range. Proved
 * rather than assumed — adding one day inside Wyoming's printed-day conversion was
 * caught on 804 periods, and it also produced "2026-09-31", a date that does not
 * exist, which nothing else in the build refused.
 *
 * FOUR THINGS THIS TOOK, AND EACH OF THEM IS THE TEST'S REAL CONTENT.
 *
 * 1. THE FIRST VERSION REPORTED 189 WRONG DATES AND EVERY ONE WAS CORRECT. They
 *    were relative periods — "the Saturday closest to September 17", "the Friday
 *    next following", "the 1st Friday in October after October 10" — where the
 *    date in the phrase is an ANCHOR and not the date. Had I "fixed" the data to
 *    match my reading I would have broken 189 correct seasons. A checker that
 *    treats its own unread grammar as a defect in the data is the most dangerous
 *    thing in this directory, so relative phrases are CLASSIFIED OUT by declared
 *    vocabulary and counted, never silently skipped.
 *
 * 2. A LENIENT FALLBACK MADE THE CHECK NEARLY VACUOUS. Allowing any window that
 *    merely sits INSIDE the stated period absorbed a deliberate one-day shift of
 *    every opening date in the corpus: 1,500 groups quietly reclassified as
 *    "segment" and only 70 failures remained. Containment is therefore not a
 *    fallback. The two rules that genuinely need it are named by id.
 *
 * 3. THE WINDOWS OF ONE STATED PERIOD ARE GROUPED BY THAT PERIOD. Alberta splits
 *    "S1 - N3 (Sundays excluded)" into nine Sunday-free windows, so a per-window
 *    comparison fails on the seven in the middle; British Columbia gives one rule
 *    a spring and an autumn period with their own wordings, so a per-rule
 *    comparison fails on one of them. Grouping by the phrase itself is what
 *    satisfies both: the first opening and the last closing of each group must be
 *    the period's own ends.
 *
 * 4. QUÉBEC KEEPS ITS DATES UNDER DIFFERENT KEYS. Its windows carry `opens` and
 *    `closes` where every other bundle carries `opensIso` and `closesIso`, and its
 *    wording lives on the rule as `seasonPhrase` rather than on the window. A
 *    survey reading only the common field reported "Québec: 0 windows with stated
 *    wording" — 196 windows, silently invisible. Both shapes are read here, and
 *    the declared table below would fail if Québec's 184 periods stopped being
 *    counted.
 */

const DIR = "content/regulatory";

/* The grammar of a RELATIVE period. These phrases name a weekday or an ordinal
   occurrence, so the calendar date is computed rather than stated and the literal
   month and day in the sentence is an anchor. Checking those properly means
   re-deriving the weekday arithmetic, which `relative-date.ts` already owns and
   tests; what matters here is that they are excluded deliberately and counted. */
const RELATIVE =
  /\b(first|second|third|fourth|fifth|last|closest|next following|immediately prior|preceding|prior to|following|before|after|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday|consecutive weeks|full week)\b/i;

/* Alberta publishes its periods as a month initial and a day: "S1 - N3". The
   initial is ambiguous on its own — J is January, June and July — so the day must
   match exactly and the month must be one of those the initial can name. That is
   a weaker check than a spelled month and it is still a real one. */
const CODED = /^([A-Z])(\d{1,2})\s*[-–]\s*([A-Z])(\d{1,2})/;

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, janvier: 1,
  february: 2, feb: 2, "février": 2, fevrier: 2,
  march: 3, mar: 3, mars: 3,
  april: 4, apr: 4, avril: 4,
  may: 5, mai: 5,
  june: 6, jun: 6, juin: 6,
  july: 7, jul: 7, juillet: 7,
  august: 8, aug: 8, "août": 8, aout: 8,
  september: 9, sep: 9, sept: 9, septembre: 9,
  october: 10, oct: 10, octobre: 10,
  november: 11, nov: 11, novembre: 11,
  december: 12, dec: 12, "décembre": 12, decembre: 12,
};
const NAME = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");
/* English and French ordinals both appear: "Dec. 31st", « le 1er novembre ». */
const ORDINAL = "(?:st|nd|rd|th|er|re)?";
const MONTH_DAY = new RegExp(`\\b(${NAME})\\.?\\s+(\\d{1,2})${ORDINAL}\\b|\\b(\\d{1,2})${ORDINAL}\\s+(${NAME})\\b`, "gi");
/* A bare day that borrows the month from the other side of the range: « Du 3 au
   16 octobre », "October 1 to 4". */
const DAY_BORROWS_LATER_MONTH = new RegExp(`\\b(\\d{1,2})${ORDINAL}\\s+(?:to|au|–|-|through)\\s+(\\d{1,2})${ORDINAL}\\s+(${NAME})\\b`, "i");
const DAY_BORROWS_EARLIER_MONTH = new RegExp(`\\b(${NAME})\\.?\\s+(\\d{1,2})${ORDINAL}\\s+(?:to|au|–|-|through)\\s+(\\d{1,2})${ORDINAL}\\b(?!\\s*(?:${NAME}))`, "i");

const lastDayOfMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const monthsBeginningWith = (letter: string) =>
  Object.entries(MONTHS).filter(([name]) => name[0].toLowerCase() === letter.toLowerCase()).map(([, value]) => value);
const monthDay = (iso: string): [number, number] => {
  const [, month, day] = iso.split("-").map(Number);
  return [month, day];
};

/** Month/day pairs in the order the sentence states them. */
function statedPairs(phrase: string, closeYear: number, closeMonth: number, closeDay: number): Array<[number, number]> {
  const located: Array<[number, [number, number]]> = [];
  for (const match of phrase.matchAll(MONTH_DAY)) {
    located.push([match.index ?? 0, match[1]
      ? [MONTHS[match[1].toLowerCase()], Number(match[2])]
      : [MONTHS[match[4].toLowerCase()], Number(match[3])]]);
  }
  /* Position matters, not discovery order: a borrowed day is written BEFORE the
     pair it belongs with, so appending it put the close ahead of the open and an
     exact match then looked like a containment. */
  const later = DAY_BORROWS_LATER_MONTH.exec(phrase);
  if (later) located.push([later.index, [MONTHS[later[3].toLowerCase()], Number(later[1])]]);
  const earlier = DAY_BORROWS_EARLIER_MONTH.exec(phrase);
  if (earlier) located.push([earlier.index + earlier[0].length, [MONTHS[earlier[1].toLowerCase()], Number(earlier[3])]]);
  /* Colorado closes seasons at "end of February", which is a date the calendar
     supplies. */
  const endOf = /end of (\w+)/i.exec(phrase);
  if (endOf && MONTHS[endOf[1].toLowerCase()] !== undefined) {
    const month = MONTHS[endOf[1].toLowerCase()];
    located.push([endOf.index, [month, closeMonth === month ? lastDayOfMonth(closeYear, month) : closeDay]]);
  }
  located.sort((a, b) => a[0] - b[0]);
  const seen = new Set<string>();
  const pairs: Array<[number, number]> = [];
  for (const [, pair] of located) {
    const key = pair.join("/");
    if (!seen.has(key)) { seen.add(key); pairs.push(pair); }
  }
  return pairs;
}

/* The only two groups whose windows are SEGMENTS of their stated period rather
   than its whole span: Wyoming splits Area 84 Type 6's "Sep. 26 – Nov. 30" at
   20/21 November across two rules, so neither rule holds both ends. Named by id
   because a general containment allowance absorbs real drift (see 2 above). */
const SEGMENTS_OF_A_LONGER_PERIOD = new Set([
  "regulatory_rule:us-wy-elk-2026-area-84-type-6-row-1-regular-2",
  "regulatory_rule:us-wy-elk-2026-area-84-type-6-row-1-regular-3",
]);

/* Every bundle's stated periods, by what KIND of period they are. The population
   is declared so that a jurisdiction cannot join, or have its wording change
   class, without a reviewer seeing it — and so "relative" can never quietly grow
   into the place where "literal" used to be checked. */
const PERIOD_CLASSES: Record<string, { literal: number; relative: number; coded: number }> = {
  "ca-ab-2026.json": { literal: 0, relative: 0, coded: 56 },
  "ca-bc-2026.json": { literal: 99, relative: 0, coded: 0 },
  "ca-mb-2026.json": { literal: 98, relative: 0, coded: 0 },
  "ca-nb-2026.json": { literal: 0, relative: 17, coded: 0 },
  "ca-nl-2026.json": { literal: 14, relative: 0, coded: 0 },
  "ca-ns-2026.json": { literal: 4, relative: 6, coded: 0 },
  "ca-on-major-game-2026.json": { literal: 16, relative: 146, coded: 0 },
  "ca-qc-2026.json": { literal: 184, relative: 0, coded: 0 },
  "ca-sk-2026.json": { literal: 144, relative: 5, coded: 0 },
  "us-co-small-game-2026.json": { literal: 79, relative: 0, coded: 0 },
  "us-ia-2026.json": { literal: 0, relative: 14, coded: 0 },
  "us-id-pronghorn-2026.json": { literal: 54, relative: 0, coded: 0 },
  "us-mt-upland-2026.json": { literal: 17, relative: 0, coded: 0 },
  "us-wy-elk-2026.json": { literal: 804, relative: 0, coded: 0 },
};

interface Window { opensIso?: string; closesIso?: string; opens?: string; closes?: string; statedAs?: string }
interface Rule { id: string; windows?: Window[]; seasonPhrase?: string }

/** Windows grouped by the stated period they belong to, per rule. */
function periodGroups(file: string): Array<{ rule: string; phrase: string; opens: string; closes: string; count: number }> {
  const parsed = JSON.parse(readFileSync(`${DIR}/${file}`, "utf8")) as { rules?: Rule[] };
  const groups: Array<{ rule: string; phrase: string; opens: string; closes: string; count: number }> = [];
  for (const rule of parsed.rules ?? []) {
    const windows = (rule.windows ?? [])
      /* Québec's keys are `opens`/`closes`; everything else uses the Iso pair. */
      .map((window) => ({
        opens: window.opensIso ?? window.opens,
        closes: window.closesIso ?? window.closes,
        phrase: window.statedAs ?? rule.seasonPhrase ?? "",
      }))
      .filter((w): w is { opens: string; closes: string; phrase: string } =>
        typeof w.opens === "string" && typeof w.closes === "string");
    const byPhrase = new Map<string, typeof windows>();
    for (const window of windows) {
      const existing = byPhrase.get(window.phrase);
      if (existing) existing.push(window); else byPhrase.set(window.phrase, [window]);
    }
    for (const [phrase, group] of byPhrase) {
      const sorted = [...group].sort((a, b) => a.opens.localeCompare(b.opens));
      groups.push({
        rule: rule.id, phrase,
        opens: sorted[0].opens,
        closes: sorted[sorted.length - 1].closes,
        count: group.length,
      });
    }
  }
  return groups;
}

const classOf = (phrase: string) =>
  CODED.test(phrase.trim()) ? "coded" : RELATIVE.test(phrase) ? "relative" : "literal";

test("every bundle states its seasons in the kinds of period it stated before", () => {
  const actual: Record<string, { literal: number; relative: number; coded: number }> = {};
  for (const file of readdirSync(DIR).filter((f) => f.endsWith(".json"))) {
    let groups: ReturnType<typeof periodGroups>;
    try { groups = periodGroups(file); } catch { continue; }
    if (!groups.length) continue;
    const counts = { literal: 0, relative: 0, coded: 0 };
    for (const group of groups) counts[classOf(group.phrase)] += 1;
    actual[file] = counts;
  }
  assert.deepEqual(actual, PERIOD_CLASSES);
});

test("every stated calendar period opens and closes on the day the authority states", () => {
  /* Grouped by SHAPE, with a count. A per-rule list truncated to twenty-five
     reports Wyoming's 804 rules and hides every other jurisdiction — the same
     defect as stopping at the first failure, which `stated-limits.test.ts` hit
     first. */
  const wrong = new Map<string, number>();
  const modes = { ordered: 0, membership: 0, coded: 0, relative: 0, segment: 0 };

  const note = (shape: string) => wrong.set(shape, (wrong.get(shape) ?? 0) + 1);

  for (const file of Object.keys(PERIOD_CLASSES)) {
    for (const group of periodGroups(file)) {
      const { phrase, opens, closes, rule } = group;
      const [openMonth, openDay] = monthDay(opens);
      const [closeMonth, closeDay] = monthDay(closes);
      const closeYear = Number(closes.slice(0, 4));

      const coded = CODED.exec(phrase.trim());
      if (coded) {
        modes.coded += 1;
        if (Number(coded[2]) !== openDay || !monthsBeginningWith(coded[1]).includes(openMonth)) {
          note(`${file}: opens ${opens} where “${phrase}” is stated`);
        }
        if (Number(coded[4]) !== closeDay || !monthsBeginningWith(coded[3]).includes(closeMonth)) {
          note(`${file}: closes ${closes} where “${phrase}” is stated`);
        }
        continue;
      }
      if (RELATIVE.test(phrase)) { modes.relative += 1; continue; }

      const pairs = statedPairs(phrase, closeYear, closeMonth, closeDay);
      if (pairs.length === 2) {
        const [[statedOpenMonth, statedOpenDay], [statedCloseMonth, statedCloseDay]] = pairs;
        const opensRight = statedOpenMonth === openMonth && statedOpenDay === openDay;
        const closesRight = statedCloseMonth === closeMonth && statedCloseDay === closeDay;
        if (SEGMENTS_OF_A_LONGER_PERIOD.has(rule)) {
          modes.segment += 1;
          const order = (month: number, day: number) => month * 100 + day;
          const low = order(statedOpenMonth, statedOpenDay);
          const high = order(statedCloseMonth, statedCloseDay);
          const inside = (month: number, day: number) => {
            const value = order(month, day);
            return low <= high ? value >= low && value <= high : value >= low || value <= high;
          };
          if (!inside(openMonth, openDay) || !inside(closeMonth, closeDay)) {
            note(`${file}: ${opens}..${closes} is outside its stated “${phrase}” (${rule})`);
          }
          continue;
        }
        modes.ordered += 1;
        if (!opensRight) note(`${file}: opens ${opens} where “${phrase}” is stated`);
        if (!closesRight) note(`${file}: closes ${closes} where “${phrase}” is stated`);
        continue;
      }
      /* More than two dates in one period's wording — membership rather than
         position, which is the weaker of the two comparisons, so its size is
         reported. */
      modes.membership += 1;
      const has = (month: number, day: number) => pairs.some(([m, d]) => m === month && d === day);
      if (!has(openMonth, openDay)) note(`${file}: opens ${opens} is not a date in “${phrase}”`);
      if (!has(closeMonth, closeDay)) note(`${file}: closes ${closes} is not a date in “${phrase}”`);
    }
  }

  /* The modes are asserted, not printed. The strong comparison is `ordered`, and
     it must not shrink into the weaker ones — which is exactly what a lenient
     containment rule did to it once already. */
  assert.deepEqual(modes, { ordered: 1499, membership: 12, coded: 56, relative: 188, segment: 2 });
  const reported = [...wrong].sort().map(([shape, count]) => `${shape}  [${count} periods]`);
  assert.deepEqual(reported, [],
    `seasons whose dates the authority's own wording does not state:\n  ${reported.join("\n  ")}`);
});
