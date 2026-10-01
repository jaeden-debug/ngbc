import assert from "node:assert/strict";
import test from "node:test";
import { SOLAR_UNCERTAINTY_MINUTES, legalTimeFor, type LegalTimeRule } from "./legal-time.ts";
import { sunriseSunset } from "./solar.ts";
import { pointTimeZone } from "../time-zone.ts";
import type { IsoDate } from "../../content-contract/index.ts";
import { ALBERTA_GENERAL_HOURS } from "./alberta-legal-time.ts";
import { BRITISH_COLUMBIA_GENERAL_HOURS, BRITISH_COLUMBIA_MIGRATORY_HOURS } from "./british-columbia-legal-time.ts";
import { IDAHO_BIG_GAME_HOURS } from "./idaho-legal-time.ts";
import { MANITOBA_GENERAL_HOURS } from "./manitoba-legal-time.ts";
import { MONTANA_UPLAND_HOURS } from "./montana-legal-time.ts";
import { NEWFOUNDLAND_BIG_GAME_HOURS } from "./newfoundland-legal-time.ts";
import { NEW_BRUNSWICK_HOURS } from "./new-brunswick.ts";
import { ONTARIO_GENERAL_HOURS, ONTARIO_SPRING_TURKEY_HOURS } from "./ontario-legal-time.ts";
import { QUEBEC_GENERAL_HOURS, QUEBEC_TURKEY_HOURS } from "./quebec-legal-time.ts";
import { SASKATCHEWAN_HOURS } from "./saskatchewan.ts";
import { WYOMING_BIG_GAME_HOURS } from "./wyoming-legal-time.ts";
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

const RULES: ReadonlyArray<readonly [string, LegalTimeRule]> = [
  ["Alberta", ALBERTA_GENERAL_HOURS],
  ["British Columbia", BRITISH_COLUMBIA_GENERAL_HOURS],
  ["British Columbia migratory", BRITISH_COLUMBIA_MIGRATORY_HOURS],
  ["Idaho", IDAHO_BIG_GAME_HOURS],
  ["Manitoba", MANITOBA_GENERAL_HOURS],
  ["Montana upland", MONTANA_UPLAND_HOURS],
  ["New Brunswick", NEW_BRUNSWICK_HOURS],
  ["Newfoundland and Labrador", NEWFOUNDLAND_BIG_GAME_HOURS],
  ["Ontario", ONTARIO_GENERAL_HOURS],
  ["Ontario spring turkey", ONTARIO_SPRING_TURKEY_HOURS],
  ["Québec", QUEBEC_GENERAL_HOURS],
  ["Québec turkey", QUEBEC_TURKEY_HOURS],
  ["Saskatchewan", SASKATCHEWAN_HOURS],
  ["Wyoming", WYOMING_BIG_GAME_HOURS],
  ["federal south of 60", federalLegalTimeRule(49)],
  ["federal north of 60", federalLegalTimeRule(64)],
];

test("a solar offset rule opens BEFORE sunrise by the number its own authority states", () => {
  const checked: string[] = [];
  const unparsed: string[] = [];
  for (const [label, rule] of RULES) {
    if (rule.basis !== "SUNRISE_SUNSET_OFFSET") continue;
    const stated = statedOffsetMinutes(rule.statedAs);
    if (!stated) { unparsed.push(`${label}: ${rule.statedAs.slice(0, 90)}`); continue; }
    assert.equal(rule.beforeSunriseMinutes, stated.before,
      `${label}: the rule encodes ${rule.beforeSunriseMinutes} minutes before sunrise and its own words say ${stated.before}`);
    assert.equal(rule.afterSunsetMinutes, stated.after,
      `${label}: the rule encodes ${rule.afterSunsetMinutes} minutes after sunset and its own words say ${stated.after}`);
    checked.push(label);
  }
  /* The positive control: an empty sweep and a clean one are the same output. */
  assert.ok(checked.length >= 10, `only ${checked.length} offset rules were checked, so this may be reading nothing`);
  /* And a sentence this cannot read is named rather than skipped silently — the
     set is asserted, so a new unreadable one fails instead of joining it. */
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
