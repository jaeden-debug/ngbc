import assert from "node:assert/strict";
import test from "node:test";
import { SOLAR_UNCERTAINTY_MINUTES, legalTimeFor, type LegalTimeRule } from "./legal-time.ts";
import { sunriseSunset } from "./solar.ts";
import { pointTimeZone } from "../time-zone.ts";
import type { IsoDate } from "../../content-contract/index.ts";
import { readdirSync, readFileSync } from "node:fs";
import { SASKATCHEWAN_HOURS } from "./saskatchewan.ts";
import { federalLegalTimeRule } from "./federal.ts";

/**
 * THE ENCODED OFFSET MUST AGREE WITH THE AUTHORITY'S OWN SENTENCE.
 *
 * WHY THIS EXISTS. `beforeSunriseMinutes` is negated inside `legalTimeFor`, so a
 * POSITIVE value opens the window before sunrise. Its doc comment said the
 * opposite — "Negative starts before sunrise" — and two jurisdictions were written
 * from that comment. New Brunswick and Saskatchewan both passed `-30`, so both
 * windows opened half an hour AFTER sunrise instead of half an hour before: an
 * hour of lawful light denied to every hunter, every day, in two jurisdictions
 * that were serving.
 *
 * WHY NOTHING CAUGHT IT. The type cannot express the convention — both signs are
 * numbers. Manitoba's committed test derives its expected clock from the SAME
 * `sunriseSunset` module and the SAME rule fields the implementation uses, which
 * is a deliberate choice (a hard-coded clock would fail whenever the algorithm is
 * refined) and means it cannot detect a wrong sign. And Saskatchewan's own test
 * asserted only that a window EXISTED. Presence is not correctness.
 *
 * WHAT THIS DOES INSTEAD. Every rule carries the authority's words in `statedAs`,
 * and the words are the fact. This reads the offset out of that sentence and
 * checks the window actually produced against it. A sign can then never disagree
 * with the sentence printed beside it, because they are compared.
 */

/** The jurisdiction's own sentence, parsed for how far from the solar event it runs. */
function statedOffsetMinutes(statedAs: string): { before: number; after: number } | undefined {
  /*
   * Every phrasing in the corpus, each taken from an authority rather than
   * invented: Alberta and Manitoba write "1/2 hour", Wyoming writes "one-half
   * (1/2) hour", British Columbia writes "one hour". Longest first, so
   * "one-half (1/2) hour" is not matched as "one hour" by a shorter key.
   */
  const WORDS: ReadonlyArray<readonly [string, number]> = [
    ["one-half (1/2) hour", 30],
    ["one-half hour", 30], ["one half hour", 30], ["half an hour", 30], ["a half hour", 30],
    ["1/2 hour", 30], ["30 minutes", 30], ["thirty minutes", 30],
    ["sixty minutes", 60], ["60 minutes", 60], ["one hour", 60], ["an hour", 60],
    ["fifteen minutes", 15], ["15 minutes", 15],
  ];
  const text = statedAs.toLowerCase();
  const escape = (literal: string) => literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const find = (event: "sunrise" | "sunset", relation: "before" | "after") => {
    for (const [phrase, value] of WORDS) {
      /* "one-half hour before sunrise", and the same split by words the statute
         puts between them ("of the following day", "of the next day"). */
      const pattern = new RegExp(`${escape(phrase)}\\s+${relation}\\s+(the\\s+)?${event}`);
      if (pattern.test(text)) return value;
    }
    return undefined;
  };
  /*
   * A prohibition and a permission describe the same window from opposite sides.
   * "from one-half hour AFTER SUNSET to one-half hour BEFORE SUNRISE" is the
   * night, whose complement opens before sunrise and closes after sunset — the
   * numbers are the same either way, which is why this reads the pairing rather
   * than the polarity of the sentence.
   */
  const before = find("sunrise", "before");
  const after = find("sunset", "after");
  return before !== undefined && after !== undefined ? { before, after } : undefined;
}

/**
 * THE SUBJECTS ARE DISCOVERED, NOT LISTED.
 *
 * This was a table of fifteen named imports, and a table only covers what
 * someone remembered to add to it. Measured rather than argued: a fifteenth
 * jurisdiction encoding 60 minutes against a sentence that says "one-half hour"
 * passed this file and `legal-time.test.ts` both — the latter checks DIRECTION,
 * so it is satisfied by any window opening before sunrise, and this file never
 * imported the new module. A sync check in `legal-hours-coverage.test.ts` held
 * the list honest in the meantime; it is retired in the same commit as this,
 * because a list that grows by itself needs nothing keeping it in step.
 *
 * A module that cannot be imported is SKIPPED here — it may need runtime context
 * — which is why the source-level sweep in `legal-hours-coverage.test.ts` stays:
 * it reads the literal out of the file and so still covers a module this cannot
 * load.
 */
const OFFSET_BASES = ["SUNRISE_SUNSET_OFFSET", "SUNRISE_OFFSET_TO_FIXED_CLOSE"] as const;

type DiscoveredRule = readonly [label: string, rule: LegalTimeRule];

async function discoverOffsetRules(): Promise<DiscoveredRule[]> {
  const found: DiscoveredRule[] = [];
  const files = readdirSync(new URL(".", import.meta.url).pathname)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts") && !name.endsWith(".d.ts"))
    .sort();

  for (const file of files) {
    let exported: Record<string, unknown>;
    try {
      exported = (await import(`./${file}`)) as Record<string, unknown>;
    } catch {
      continue; /* Needs runtime context it has not got; the source sweep still covers it. */
    }
    for (const [name, value] of Object.entries(exported)) {
      if (!value || typeof value !== "object") continue;
      const rule = value as Partial<LegalTimeRule> & { basis?: string };
      if (!OFFSET_BASES.includes(rule.basis as typeof OFFSET_BASES[number])) continue;
      if (typeof rule.statedAs !== "string") continue;
      found.push([`${file}:${name}`, value as LegalTimeRule]);
    }
  }

  /*
   * The federal rules are produced by a FUNCTION of latitude, so no export is an
   * offset rule and discovery cannot see them. They are added explicitly, and
   * the derived floor below counts files rather than rules so this cannot be
   * used to pad the count.
   */
  found.push(["federal.ts:federalLegalTimeRule(49)", federalLegalTimeRule(49)]);
  found.push(["federal.ts:federalLegalTimeRule(64)", federalLegalTimeRule(64)]);
  return found;
}

/**
 * The floor is DERIVED from the directory, never remembered.
 *
 * A discovering sweep that finds nothing and a clean corpus produce the same
 * green, so the count needs something independent to be measured against. This
 * greps the source for files declaring the field — a different mechanism from
 * the import used to collect the rules, so a failure of one does not hide in the
 * other.
 */
function filesDeclaringAnOffset(): string[] {
  const dir = new URL(".", import.meta.url);
  return readdirSync(dir.pathname)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts") && !name.endsWith(".d.ts"))
    .filter((name) => /beforeSunriseMinutes:\s*-?\d/.test(readFileSync(new URL(name, dir), "utf8")));
}


test("a solar offset rule opens BEFORE sunrise by the number its own authority states", async () => {
  const rules = await discoverOffsetRules();
  const checked: string[] = [];
  const unparsed: string[] = [];
  for (const [label, rule] of rules) {
    if (rule.basis !== "SUNRISE_SUNSET_OFFSET") continue;
    const stated = statedOffsetMinutes(rule.statedAs);
    if (!stated) { unparsed.push(`${label}: ${rule.statedAs.slice(0, 90)}`); continue; }
    assert.equal(rule.beforeSunriseMinutes, stated.before,
      `${label}: the rule encodes ${rule.beforeSunriseMinutes} minutes before sunrise and its own words say ${stated.before}`);
    assert.equal(rule.afterSunsetMinutes, stated.after,
      `${label}: the rule encodes ${rule.afterSunsetMinutes} minutes after sunset and its own words say ${stated.after}`);
    checked.push(label);
  }

  /*
   * THE POSITIVE CONTROL, DERIVED. Every assertion above is satisfied by finding
   * nothing, so the count is measured against a floor taken from the directory
   * itself rather than from a number someone typed. A file can hold more than
   * one rule, so rules are expected to be at least as many as the files that
   * declare the field — never fewer, which is what a discovery that stopped
   * reaching a module would produce.
   */
  const declaring = filesDeclaringAnOffset();
  assert.ok(declaring.length >= 10,
    `only ${declaring.length} files declare the field; the floor itself has stopped finding its subjects`);
  assert.ok(checked.length >= declaring.length,
    `${declaring.length} files declare an offset but only ${checked.length} rules were checked — ` +
    `discovery is missing a module. Checked:\n  ${checked.join("\n  ")}`);
  assert.deepEqual(unparsed, [], `a rule's stated offset could not be read:\n${unparsed.join("\n")}`);
});

test("the window actually produced opens before sunrise, not after it", () => {
  /*
   * The field could be right and the arithmetic still wrong, so this asserts the
   * OUTPUT. A point with no DST complication and a zone the tz database and the
   * observed clock agree on, so the only thing under test is the offset.
   */
  const point = { latitude: 52.13, longitude: -106.67 };
  const date = "2026-11-20" as IsoDate;
  const zone = pointTimeZone("America/Regina", "SINGLE_ZONE_JURISDICTION");
  const solar = sunriseSunset(point.latitude, point.longitude, { year: 2026, month: 11, day: 20 });
  assert.ok(!("polar" in solar));
  if ("polar" in solar) return;

  const result = legalTimeFor(SASKATCHEWAN_HOURS, point, date, zone);
  assert.equal(result.status, "RESOLVED");
  if (result.status !== "RESOLVED") return;

  const clock = (at: Date) => new Intl.DateTimeFormat("en-CA", {
    timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(at);
  const sunriseClock = clock(solar.sunrise);
  assert.ok(result.window.opensAt < sunriseClock,
    `the window opens at ${result.window.opensAt} and sunrise is ${sunriseClock}: it must open BEFORE sunrise`);
  /* Half an hour before, pulled 2 minutes inward, is 28 minutes before sunrise. */
  assert.equal(result.window.opensAt,
    clock(new Date(solar.sunrise.getTime() - (30 - SOLAR_UNCERTAINTY_MINUTES) * 60_000)));
  assert.ok(result.window.closesAt > clock(solar.sunset), "and closes after sunset");
});
