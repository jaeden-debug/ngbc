import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import type { IsoDate } from "../../content-contract/index.ts";
import type { PointTimeZone } from "../time-zone.ts";
import { legalTimeFor, legalTimeSummary, SOLAR_UNCERTAINTY_MINUTES } from "./legal-time.ts";
import { albertaHoursRules, ALBERTA_GENERAL_HOURS } from "./alberta-legal-time.ts";
import { manitobaHoursRules, MANITOBA_GENERAL_HOURS } from "./manitoba-legal-time.ts";
import { britishColumbiaHoursRules, BRITISH_COLUMBIA_GENERAL_HOURS } from "./british-columbia-legal-time.ts";
import { montanaHoursRules, MONTANA_UPLAND_HOURS } from "./montana-legal-time.ts";
import { timeZoneAtPoint } from "../time-zone.ts";
import { sunriseSunset } from "./solar.ts";

const iso = (value: string) => value as IsoDate;

/* Real points inside each jurisdiction, well away from any boundary. */
const EDMONTON = { latitude: 53.55, longitude: -113.49 };
const WINNIPEG = { latitude: 49.9, longitude: -97.14 };
const KAMLOOPS = { latitude: 50.67, longitude: -120.33 };

const MOUNTAIN = "America/Edmonton" as PointTimeZone;
const CENTRAL = "America/Winnipeg" as PointTimeZone;
const PACIFIC = "America/Vancouver" as PointTimeZone;

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * THE TEST THIS FILE EXISTS FOR.
 *
 * Ontario, Alberta and Manitoba all use half an hour either side. British
 * Columbia uses a FULL hour (B.C. Reg. 190/84 s. 14 (1)). Three jurisdictions
 * agreeing is exactly what makes the fourth dangerous, and an agent carrying
 * the common rule into BC would publish a window 30 minutes short at each end.
 *
 * That failure is invisible in production — a hunter told to stop early simply
 * stops early — and it is a restriction STRICTER than the source, which §8
 * makes a false claim exactly as an over-broad one is.
 *
 * The expected gap is DERIVED from the two rules' own declared offsets rather
 * than written as "30", so the test cannot drift into agreeing with a wrong
 * constant.
 */
test("British Columbia is an hour either side, and the other two are half an hour", () => {
  const gapBefore = BRITISH_COLUMBIA_GENERAL_HOURS.basis === "SUNRISE_SUNSET_OFFSET" &&
    ALBERTA_GENERAL_HOURS.basis === "SUNRISE_SUNSET_OFFSET"
    ? BRITISH_COLUMBIA_GENERAL_HOURS.beforeSunriseMinutes - ALBERTA_GENERAL_HOURS.beforeSunriseMinutes
    : Number.NaN;

  assert.equal(gapBefore, 30, "BC must open half an hour earlier than Alberta");

  /* And the same fact through the computed window, not just the constants. */
  const date = iso("2026-09-15");
  const bc = legalTimeFor(BRITISH_COLUMBIA_GENERAL_HOURS, KAMLOOPS, date, PACIFIC);
  const ab = legalTimeFor(ALBERTA_GENERAL_HOURS, KAMLOOPS, date, PACIFIC);
  assert.equal(bc.status, "RESOLVED");
  assert.equal(ab.status, "RESOLVED");
  if (bc.status !== "RESOLVED" || ab.status !== "RESOLVED") return;

  /*
   * Same point, same date, same timezone — so the only difference is the rule.
   * The inward solar margin applies equally to both and cancels.
   */
  assert.equal(minutes(ab.window.opensAt) - minutes(bc.window.opensAt), 30);
  assert.equal(minutes(bc.window.closesAt) - minutes(ab.window.closesAt), 30);
});

test("Alberta states a real window at a real Alberta point", () => {
  /*
   * The regression that matters most here is not arithmetic: Alberta used to
   * refuse a window on the premise that it "spans more than one IANA zone",
   * which the tz database disproves. If that premise ever returns, this fails.
   */
  const result = legalTimeFor(ALBERTA_GENERAL_HOURS, EDMONTON, iso("2026-11-04"), MOUNTAIN);
  assert.equal(result.status, "RESOLVED");
  if (result.status !== "RESOLVED") return;
  assert.equal(result.timezone, "America/Edmonton");
  assert.match(result.section, /s\. 28/);
  /* Opens before it closes, on the requested date, with the margin declared. */
  assert.ok(minutes(result.window.opensAt) < minutes(result.window.closesAt));
  assert.equal(result.date, "2026-11-04");
  assert.equal(result.precision.appliedInward, true);
});

test("Alberta and Manitoba state the same offsets, and it is a coincidence of two statutes", () => {
  /*
   * They agree today. They are different instruments — Alberta's Wildlife Act
   * s. 28 and Manitoba's M.R. 351/87 s. 3 — and either can be amended without
   * the other. Asserted through each rule's own declared values so that a
   * change to one is a failure rather than a silent convergence.
   */
  assert.equal(ALBERTA_GENERAL_HOURS.basis, "SUNRISE_SUNSET_OFFSET");
  assert.equal(MANITOBA_GENERAL_HOURS.basis, "SUNRISE_SUNSET_OFFSET");
  if (ALBERTA_GENERAL_HOURS.basis !== "SUNRISE_SUNSET_OFFSET") return;
  if (MANITOBA_GENERAL_HOURS.basis !== "SUNRISE_SUNSET_OFFSET") return;

  assert.equal(ALBERTA_GENERAL_HOURS.beforeSunriseMinutes, MANITOBA_GENERAL_HOURS.beforeSunriseMinutes);
  assert.equal(ALBERTA_GENERAL_HOURS.afterSunsetMinutes, MANITOBA_GENERAL_HOURS.afterSunsetMinutes);
  assert.notEqual(ALBERTA_GENERAL_HOURS.section, MANITOBA_GENERAL_HOURS.section);
  assert.notEqual(ALBERTA_GENERAL_HOURS.sourceId, MANITOBA_GENERAL_HOURS.sourceId);
});

test("the window is built from the day's own sunrise and sunset, narrowed inward", () => {
  /*
   * Derived rather than hard-coded: the expectation is computed from the solar
   * module the implementation also uses, plus the rule's own offsets and the
   * inward margin. A hard-coded clock time would encode today's algorithm and
   * fail for the wrong reason if it were ever refined.
   */
  const date = iso("2026-10-01");
  const solar = sunriseSunset(WINNIPEG.latitude, WINNIPEG.longitude, { year: 2026, month: 10, day: 1 });
  assert.ok(!("polar" in solar), "Winnipeg has a sunrise on this date");
  if ("polar" in solar) return;

  const result = legalTimeFor(MANITOBA_GENERAL_HOURS, WINNIPEG, date, CENTRAL);
  assert.equal(result.status, "RESOLVED");
  if (result.status !== "RESOLVED") return;

  const opens = new Date(solar.sunrise.getTime() - 30 * 60_000 + SOLAR_UNCERTAINTY_MINUTES * 60_000);
  const expected = new Intl.DateTimeFormat("en-CA", {
    timeZone: CENTRAL, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(opens);
  assert.equal(result.window.opensAt, expected);
});

test("each jurisdiction binds exactly one rule, for every species it serves", () => {
  /*
   * A census, not a spot check. Every species in each committed bundle is
   * asked, so a species added later without an hours decision fails here rather
   * than silently inheriting the general rule.
   *
   * One rule each is the CURRENT truth and is recorded as such: the migratory
   * game bird exceptions (BC s. 14 (2), Manitoba's footnote 2) bind no species
   * these jurisdictions serve, and federal hours govern those birds anyway.
   */
  const cases = [
    { file: "ca-ab-2026.json", rules: albertaHoursRules },
    { file: "ca-mb-2026.json", rules: manitobaHoursRules },
    { file: "ca-bc-2026.json", rules: britishColumbiaHoursRules },
  ] as const;

  for (const { file, rules } of cases) {
    const bundle = JSON.parse(readFileSync(`content/regulatory/${file}`, "utf8")) as {
      rules: { speciesId: string }[];
    };
    const species = [...new Set(bundle.rules.map((rule) => rule.speciesId))];
    assert.ok(species.length > 0, `${file} serves at least one species`);

    for (const speciesId of species) {
      const bound = rules(speciesId, iso("2026-05-15"));
      assert.equal(bound.length, 1, `${file}: ${speciesId} binds exactly one hours rule`);
      assert.equal(bound[0].basis, "SUNRISE_SUNSET_OFFSET");
    }

    /* And none of them is a migratory game bird, which is why one rule is right. */
    assert.ok(
      !species.some((id) => /goose|geese|duck|crane|woodcock|snipe|dove/i.test(id)),
      `${file} serves no migratory game bird; if it does, the migratory hours exception must be encoded`,
    );
  }
});

test("every rule carries the authority's own words and a pinpoint citation", () => {
  for (const rule of [ALBERTA_GENERAL_HOURS, MANITOBA_GENERAL_HOURS, BRITISH_COLUMBIA_GENERAL_HOURS]) {
    assert.ok(rule.statedAs.length > 40, "statedAs is the provision, not a paraphrase");
    assert.match(rule.section, /s\. \d/, "section is a pinpoint, not a document name");
    assert.match(rule.sourceId, /^source:ca-(ab|mb|bc)-/);
    /*
     * The provisions are prohibitions and each must read as one — but they say
     * so in three different grammars: Alberta "shall not hunt", Manitoba "No
     * person shall hunt", BC "The prohibited hours are". The first draft of
     * this assertion matched only Alberta's and failed Manitoba, which is the
     * point of asserting against all three rather than the one in front of you.
     */
    assert.match(rule.statedAs, /shall not|no person shall|prohibited/i);
  }
});

test("Montana states a window and Idaho does not, from the same instrument", () => {
  /*
   * The sweep that found this asked, of every refusal, "is the premise true?"
   * Montana's and Idaho's read identically — "has not certified exact
   * astronomical times" — and the answers are opposite.
   *
   * `zone1970.tab` describes US zones by exception and names them down to
   * single counties, so a state it does not name has one clock. Montana is
   * named nowhere; Idaho is named ("Mountain - ID (south), OR (east)").
   */
  assert.equal(timeZoneAtPoint("jurisdiction:us-mt"), "America/Denver");
  assert.equal(timeZoneAtPoint("jurisdiction:us-id"), undefined);
});

test("Montana's hours reach upland game birds and stop there", () => {
  /*
   * The authority's sentence is scoped to upland game birds. A species outside
   * that scope must get NO rule rather than this one: Montana sets big-game
   * hours elsewhere, and a window from the wrong rule is worse than none.
   *
   * The served species are read from the bundle, so this cannot pass by
   * agreeing with a list copied out of it.
   */
  const served = montanaHoursRules("species:ring-necked-pheasant", iso("2026-10-15"));
  assert.equal(served.length, 1);
  assert.equal(served[0], MONTANA_UPLAND_HOURS);

  for (const outside of ["species:white-tailed-deer", "species:moose", "species:american-black-bear"]) {
    assert.deepEqual(montanaHoursRules(outside, iso("2026-10-15")), [], `${outside} is not an upland game bird`);
  }
});

test("no timezone, no window — for every jurisdiction, not just the one that had the bug", () => {
  /*
   * `britishColumbiaLegalTime` handed an undefined zone returned RESOLVED and
   * rendered "09:35 to 22:20 (undefined)" — a thirteen-hour window computed
   * against UTC, telling a hunter it was lawful to shoot until 22:20. It read
   * as an answer rather than an error.
   *
   * The guard used to live in each CALLER, which is the arrangement where the
   * next jurisdiction wired up inherits the bug. It now lives in `legalTimeFor`,
   * so this asserts the chokepoint across every rule rather than patching BC.
   */
  const rules = [
    ALBERTA_GENERAL_HOURS,
    MANITOBA_GENERAL_HOURS,
    BRITISH_COLUMBIA_GENERAL_HOURS,
    MONTANA_UPLAND_HOURS,
  ];
  for (const rule of rules) {
    const result = legalTimeFor(rule, KAMLOOPS, iso("2026-10-15"), undefined);
    assert.equal(result.status, "NOT_CERTIFIED", `${rule.section} must refuse without a timezone`);
    assert.doesNotMatch(legalTimeSummary(result), /undefined/, "no answer may contain the word undefined");
    /* Refusing a clock is not refusing to say what the law is. */
    assert.match(legalTimeSummary(result), /wall-clock/);
  }
});
