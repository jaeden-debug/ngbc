import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import type { IsoDate } from "../../content-contract/index.ts";
import { pointTimeZone, timeZoneAtPoint } from "../time-zone.ts";
import { legalTimeFor, SOLAR_UNCERTAINTY_MINUTES, type LegalTimeRule } from "./legal-time.ts";
import { renderingZone } from "./observed-clock.ts";
import { sunriseSunset, wallClock } from "./solar.ts";
import { federalLegalTimeRule } from "./federal.ts";
import { MANITOBA_GENERAL_HOURS } from "./manitoba-legal-time.ts";
import { NEW_BRUNSWICK_HOURS } from "./new-brunswick.ts";
import { ONTARIO_GENERAL_HOURS } from "./ontario-legal-time.ts";
import { SASKATCHEWAN_HOURS } from "./saskatchewan.ts";


const on = (value: string) => value as IsoDate;
const HALIFAX = pointTimeZone("America/Halifax", "SINGLE_ZONE_JURISDICTION");
const WHITEHORSE = pointTimeZone("America/Whitehorse", "SINGLE_ZONE_JURISDICTION");
const REGINA = pointTimeZone("America/Regina", "SINGLE_ZONE_JURISDICTION");
const ST_JOHNS = pointTimeZone("America/St_Johns", "SINGLE_ZONE_JURISDICTION");

const CHARLOTTETOWN = { latitude: 46.2382, longitude: -63.1311 };
const WHITEHORSE_POINT = { latitude: 60.7212, longitude: -135.0568 };
const NORTHERN_YUKON = { latitude: 69.5, longitude: -139.0 };

const halfHourRule: LegalTimeRule = {
  basis: "SUNRISE_SUNSET_OFFSET",
  beforeSunriseMinutes: 30,
  afterSunsetMinutes: 30,
  statedAs: "one-half hour before sunrise to one-half hour after sunset",
  section: "s. 1",
  sourceId: "source:ca-federal-migratory-birds-regulations",
};

const minutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));

test("an offset rule resolves to times on the date, in the point's own zone", () => {
  const result = legalTimeFor(halfHourRule, CHARLOTTETOWN, on("2026-11-05"), HALIFAX);
  assert.equal(result.status, "RESOLVED");
  if (result.status !== "RESOLVED") return;
  assert.equal(result.timezone, "America/Halifax");
  assert.equal(result.date, "2026-11-05");
  assert.equal(result.basis, "SUNRISE_SUNSET_OFFSET");
  /* Sunrise 06:59 - 30 min = 06:29, plus the inward margin. */
  assert.equal(result.window.opensAt, "06:31");
});

test("THE MARGIN IS APPLIED INWARD: never a minute outside the legal window", () => {
  /*
   * Our solar times run up to two minutes wider than the authority's, so a
   * centred window would authorise hunting before it was legal. The window is
   * narrowed on BOTH ends instead: the cost is a hunter losing a few minutes
   * they were owed, and the cost of the other direction is a hunter shooting
   * before it was legal.
   */
  const solar = sunriseSunset(CHARLOTTETOWN.latitude, CHARLOTTETOWN.longitude, { year: 2026, month: 11, day: 5 });
  assert.ok(!("polar" in solar));
  if ("polar" in solar) return;
  const result = legalTimeFor(halfHourRule, CHARLOTTETOWN, on("2026-11-05"), HALIFAX);
  assert.equal(result.status, "RESOLVED");
  if (result.status !== "RESOLVED") return;

  const naiveOpen = minutes(wallClock(solar.sunrise, "America/Halifax")) - 30;
  const naiveClose = minutes(wallClock(solar.sunset, "America/Halifax")) + 30;
  assert.equal(minutes(result.window.opensAt) - naiveOpen, SOLAR_UNCERTAINTY_MINUTES, "opens LATER than naive");
  assert.equal(naiveClose - minutes(result.window.closesAt), SOLAR_UNCERTAINTY_MINUTES, "closes EARLIER than naive");
  assert.equal(result.precision.appliedInward, true);
  assert.equal(result.precision.marginMinutes, SOLAR_UNCERTAINTY_MINUTES);
});

test("a fixed-times rule carries no solar margin, because it has no solar term", () => {
  const result = legalTimeFor(
    { basis: "FIXED_LOCAL_TIMES", opensAt: "05:00", closesAt: "23:00", statedAs: "05:00 to 23:00", section: "s. 2", sourceId: "source:ca-federal-migratory-birds-regulations" },
    CHARLOTTETOWN, on("2026-11-05"), HALIFAX,
  );
  assert.equal(result.status, "RESOLVED");
  if (result.status !== "RESOLVED") return;
  assert.deepEqual(result.window, { opensAt: "05:00", closesAt: "23:00" });
  assert.equal(result.precision.marginMinutes, 0);
});

/* ── Daylight saving, both directions ────────────────────────────────────── */

test("a hunt on the spring-forward day resolves in local time", () => {
  /* 2027-03-14: North American clocks go forward at 02:00 local. */
  const result = legalTimeFor(halfHourRule, CHARLOTTETOWN, on("2027-03-14"), HALIFAX);
  assert.equal(result.status, "RESOLVED");
  if (result.status !== "RESOLVED") return;
  /* The window must be a real clock time that existed that day: nothing
     between 02:00 and 03:00 local, which did not happen. */
  const opens = minutes(result.window.opensAt);
  assert.ok(opens < 120 || opens >= 180, `opens at ${result.window.opensAt}, inside the skipped hour`);
});

test("a hunt on the fall-back day resolves in local time", () => {
  /* 2026-11-01: clocks go back at 02:00 local, so 01:00-02:00 happens twice. */
  const result = legalTimeFor(halfHourRule, CHARLOTTETOWN, on("2026-11-01"), HALIFAX);
  assert.equal(result.status, "RESOLVED");
  if (result.status !== "RESOLVED") return;
  /* Sunrise that morning is after the transition, so the window sits in the
     second pass of the hour and the clock reading is unambiguous. */
  assert.match(result.window.opensAt, /^0[6-9]:\d\d$/);
});

test("a jurisdiction that does not observe DST is unaffected by the transition", () => {
  const before = legalTimeFor(halfHourRule, { latitude: 50.4452, longitude: -104.6189 }, on("2026-10-31"), REGINA);
  const after = legalTimeFor(halfHourRule, { latitude: 50.4452, longitude: -104.6189 }, on("2026-11-02"), REGINA);
  assert.equal(before.status, "RESOLVED");
  assert.equal(after.status, "RESOLVED");
  if (before.status !== "RESOLVED" || after.status !== "RESOLVED") return;
  /* Two days either side of the transition differ only by the sun moving, a
     few minutes — not by an hour. */
  assert.ok(Math.abs(minutes(after.window.opensAt) - minutes(before.window.opensAt)) < 30);
});

test("a half-hour zone keeps its half hour", () => {
  const result = legalTimeFor(halfHourRule, { latitude: 47.5615, longitude: -52.7126 }, on("2026-11-05"), ST_JOHNS);
  assert.equal(result.status, "RESOLVED");
  if (result.status !== "RESOLVED") return;
  /*
   * Asserted as a PROPERTY, not a literal: a literal here would have to come
   * from somewhere, and taking it from the authority's table while the window
   * is built from our own calculation bakes a one-minute disagreement into an
   * expectation. The property is the thing that matters — St John's is UTC-3:30
   * and a zone handled as whole hours lands 30 minutes out, which is exactly
   * the size of the offset being applied and so cancels invisibly.
   */
  const halifaxSame = legalTimeFor(halfHourRule, { latitude: 47.5615, longitude: -52.7126 }, on("2026-11-05"), HALIFAX);
  assert.equal(halifaxSame.status, "RESOLVED");
  if (halifaxSame.status !== "RESOLVED") return;
  assert.equal(minutes(result.window.opensAt) - minutes(halifaxSame.window.opensAt), 30);
  assert.match(result.window.opensAt, /:\d[23]$/, "the half hour survives into the minutes");
});

/* ── Polar and not-certified ─────────────────────────────────────────────── */

test("a day with no sunrise says so rather than inventing a window", () => {
  const result = legalTimeFor(halfHourRule, NORTHERN_YUKON, on("2026-12-21"), WHITEHORSE);
  assert.equal(result.status, "NO_SOLAR_EVENT");
  if (result.status !== "NO_SOLAR_EVENT") return;
  assert.equal(result.reason, "SUN_DOWN_ALL_DAY");
});

test("Whitehorse midwinter still resolves, because the sun does rise there", () => {
  const result = legalTimeFor(halfHourRule, WHITEHORSE_POINT, on("2026-12-21"), WHITEHORSE);
  assert.equal(result.status, "RESOLVED");
});

test("only a single-zone jurisdiction yields a point timezone", () => {
  assert.ok(timeZoneAtPoint("jurisdiction:ca-pe"));
  assert.ok(timeZoneAtPoint("jurisdiction:ca-yt"));
  /* These genuinely span zones. A jurisdiction-wide value would be wrong
     somewhere, so there is none to give. */
  /* Whole-extent-one-zone, established from the tz database's own table. */
  assert.equal(timeZoneAtPoint("jurisdiction:ca-ab"), "America/Edmonton");
  assert.equal(timeZoneAtPoint("jurisdiction:ca-mb"), "America/Winnipeg");
  assert.equal(timeZoneAtPoint("jurisdiction:ca-bc"), undefined);
  assert.equal(timeZoneAtPoint("jurisdiction:ca-on"), undefined);
  assert.equal(timeZoneAtPoint("jurisdiction:ca-nl"), undefined);
});

/* ── The weather separation is real, not stated ──────────────────────────── */

test("legal time cannot read the weather, as a fact about the module graph", () => {
  /*
   * The separation is architectural, not a convention a reviewer has to
   * notice. Neither module that decides a legal time may import the weather
   * module, transitively or otherwise — so a provider's sunrise cannot become
   * a regulatory answer even by accident.
   */
  for (const file of ["src/lib/hunt/regulatory/legal-time.ts", "src/lib/hunt/regulatory/solar.ts"]) {
    const source = readFileSync(file, "utf8");
    const imports = [...source.matchAll(/^import .*?from "([^"]+)";/gm)].map((match) => match[1]);
    for (const specifier of imports) {
      assert.ok(!/weather/i.test(specifier), `${file} imports ${specifier}`);
    }
  }
});

test("a legal result carries no weather provenance", () => {
  const result = legalTimeFor(halfHourRule, CHARLOTTETOWN, on("2026-11-05"), HALIFAX);
  const serialised = JSON.stringify(result);
  /*
   * PROVIDER identity, not the word "sunrise": the rule's own words are
   * "one-half hour before sunrise to one-half hour after sunset", and
   * stripping the authority's language to satisfy a test would be the
   * stricter-than-the-source error in a new place.
   */
  for (const provider of ["open-meteo", "openmeteo", "google", "source:weather"]) {
    assert.ok(!serialised.includes(provider), `the legal answer carries ${provider} provenance`);
  }
  assert.equal(result.status === "RESOLVED" ? result.sourceId : "", "source:ca-federal-migratory-birds-regulations");
});

/* ── PE and YT against the real certified federal rule ───────────────────── */

test("the federal rule states its own latitude split, and Yukon is entirely north of 60", async () => {
  const { federalLegalTimeRule } = await import("./federal.ts");
  /* s. 28(3): one hour north of 60°N, half an hour south of it. */
  assert.equal(federalLegalTimeRule(46.5).beforeSunriseMinutes, 30);
  /* Southern Yukon's southernmost point is 60.0°N — north of 60, so the whole
     territory takes the one-hour rule. A rule split at a latitude the
     jurisdiction sits exactly on is where an off-by-one would live. */
  assert.equal(federalLegalTimeRule(60.03).beforeSunriseMinutes, 60);
  assert.equal(federalLegalTimeRule(69.5).beforeSunriseMinutes, 60);
});

test("Prince Edward Island resolves a real window from the certified federal rule", async () => {
  const { federalLegalTime } = await import("./federal.ts");
  const result = federalLegalTime("jurisdiction:ca-pe", { latitude: 46.50355, longitude: -63.61605 }, on("2026-10-05"));
  assert.equal(result.status, "RESOLVED");
  if (result.status !== "RESOLVED") return;
  assert.equal(result.timezone, "America/Halifax");
  assert.match(result.statedAs, /s\. 28\(3\)\(b\)/);
  assert.match(result.statedAs, /south of 60/);
  assert.equal(result.sourceId, "source:ca-federal-migratory-birds-regulations");
});

test("Yukon resolves with the ONE HOUR rule, not the half hour", async () => {
  const { federalLegalTime } = await import("./federal.ts");
  const yukon = federalLegalTime("jurisdiction:ca-yt", { latitude: 60.03257, longitude: -135.09455 }, on("2026-10-05"));
  const island = federalLegalTime("jurisdiction:ca-pe", { latitude: 46.50355, longitude: -63.61605 }, on("2026-10-05"));
  assert.equal(yukon.status, "RESOLVED");
  assert.equal(island.status, "RESOLVED");
  if (yukon.status !== "RESOLVED" || island.status !== "RESOLVED") return;
  assert.match(yukon.statedAs, /one hour/);
  assert.match(island.statedAs, /half an hour/);
  assert.equal(yukon.timezone, "America/Whitehorse");
});

test("a multi-zone jurisdiction refuses a window and still says what the law is", async () => {
  const { federalLegalTime } = await import("./federal.ts");
  /*
   * Alberta was in this list and does not belong: the tz database puts it
   * wholly inside America/Edmonton. Ontario, BC and Québec genuinely span
   * zones whose wall clocks differ.
   */
  for (const jurisdiction of ["jurisdiction:ca-on", "jurisdiction:ca-bc", "jurisdiction:ca-qc"]) {
    const result = federalLegalTime(jurisdiction, { latitude: 52, longitude: -110 }, on("2026-10-05"));
    assert.equal(result.status, "NOT_CERTIFIED", jurisdiction);
    if (result.status !== "NOT_CERTIFIED") continue;
    /* Refusing a clock is not refusing to say what the law is. */
    assert.match(result.reason, /spans more than one/);
    assert.match(result.reason, /s\. 28\(3\)/);
    assert.equal(result.authority, "Environment and Climate Change Canada");
  }
});

test("a non-finite coordinate refuses, for every jurisdiction, from one guard", () => {
  /*
   * THE TIMEZONE GUARD'S TWIN, AND IT WAS LEFT IN THE CALLERS.
   *
   * This file already records why the timezone guard moved inward: leaving it in
   * each caller "is the arrangement where the next jurisdiction to be wired up
   * inherits the bug". The coordinate guard stayed outside, and eight of the ten
   * jurisdiction modules did not have it — Manitoba, Alberta, Montana, British
   * Columbia and the rest threw `RangeError: Invalid time value` from four
   * frames down in `solar.ts`. Only Ontario and Québec guarded, because they
   * were written with the zone-versus-point question in mind.
   *
   * A throw in a regulatory path is worse than a refusal: a refusal is an answer
   * a hunter can read, and an exception is a failed request that says nothing
   * about the law at all.
   */
  const rule: LegalTimeRule = {
    basis: "SUNRISE_SUNSET_OFFSET",
    beforeSunriseMinutes: 30,
    afterSunsetMinutes: 30,
    statedAs: "half an hour before sunrise to half an hour after sunset",
    section: "test",
    sourceId: "source:test" as never,
  };
  const zone = pointTimeZone("America/Winnipeg", "SINGLE_ZONE_JURISDICTION");

  for (const point of [
    { latitude: Number.NaN, longitude: -97 },
    { latitude: 49.9, longitude: Number.NaN },
    { latitude: Number.POSITIVE_INFINITY, longitude: -97 },
  ]) {
    const result = legalTimeFor(rule, point, "2026-10-15" as never, zone);
    assert.equal(result.status, "NOT_CERTIFIED", JSON.stringify(point));
    if (result.status === "NOT_CERTIFIED") {
      assert.match(result.reason, /time at a place/);
    }
  }

  /* Positive control: a usable point still resolves, so the guard is not simply
     refusing everything. */
  const good = legalTimeFor(rule, { latitude: 49.9, longitude: -97.1 }, "2026-10-15" as never, zone);
  assert.equal(good.status, "RESOLVED");
});

test("every rule opens when its own words say it does", () => {
  /*
   * THE INVARIANT THAT CATCHES A WRONG SIGN, AND IT CAUGHT TWO.
   *
   * `beforeSunriseMinutes` was documented as "Negative starts before sunrise" in
   * a sentence that covered two fields with opposite conventions. The
   * arithmetic is `shift(sunrise, -before + margin)`, so POSITIVE opens before
   * sunrise — and New Brunswick and Saskatchewan both encoded `-30`, shipping a
   * window half an hour AFTER sunrise while their own statutes, quoted in their
   * own `statedAs`, say half an hour BEFORE it. An hour of legal morning
   * withheld, every day, in both provinces.
   *
   * §8's over-strict direction, and §8 also says why it survived: a hunter told
   * they may not hunt yet does not report it.
   *
   * So the test is not "the sign is 30". It is: compute the window, and check it
   * against what the rule's own wording claims. A rule whose words say "before
   * sunrise" must open before sunrise.
   */
  const RULES: Array<{ name: string; rule: LegalTimeRule; point: { latitude: number; longitude: number }; zone: string }> = [
    { name: "New Brunswick", rule: NEW_BRUNSWICK_HOURS, point: { latitude: 46.0878, longitude: -64.7782 }, zone: "America/Moncton" },
    { name: "Saskatchewan", rule: SASKATCHEWAN_HOURS, point: { latitude: 50.45, longitude: -104.6 }, zone: "America/Regina" },
    { name: "Manitoba", rule: MANITOBA_GENERAL_HOURS, point: { latitude: 49.9, longitude: -97.1 }, zone: "America/Winnipeg" },
    { name: "Ontario", rule: ONTARIO_GENERAL_HOURS, point: { latitude: 43.7, longitude: -79.4 }, zone: "America/Toronto" },
    { name: "federal south of 60", rule: federalLegalTimeRule(46), point: { latitude: 46.0878, longitude: -64.7782 }, zone: "America/Moncton" },
    { name: "federal north of 60", rule: federalLegalTimeRule(62), point: { latitude: 60.7, longitude: -135.1 }, zone: "America/Whitehorse" },
  ];

  let checked = 0;
  for (const { name, rule, point, zone } of RULES) {
    if (rule.basis !== "SUNRISE_SUNSET_OFFSET") continue;
    const date = "2026-11-20" as IsoDate;
    const result = legalTimeFor(rule, point, date, pointTimeZone(zone, "SINGLE_ZONE_JURISDICTION"));
    assert.equal(result.status, "RESOLVED", name);
    if (result.status !== "RESOLVED") continue;

    const [year, month, day] = date.split("-").map(Number);
    const solar = sunriseSunset(point.latitude, point.longitude, { year, month, day });
    assert.ok(!("polar" in solar), `${name}: polar day or night has no sunrise to compare`);
    if ("polar" in solar) continue;
    /*
     * SUNRISE IS READ THROUGH THE SAME `renderingZone` THE WINDOW WAS.
     *
     * Not through `result.timezone`, which deliberately reports the POINT's own
     * zone — Manitoba observes permanent daylight time from 1 November 2026, so
     * the window is rendered at the offset the province legislated while the
     * place is still America/Winnipeg and tzdata is the thing that is stale.
     * Comparing a window in the legislated clock against a sunrise in tzdata's
     * made Manitoba look 32 minutes late on 20 November. The window was right
     * both times; my comparison was wrong, and the override that exposed it is
     * the one that stopped Manitoba publishing windows an hour EARLY.
     */
    const clock = renderingZone(zone, date);
    const sunrise = wallClock(solar.sunrise, clock);
    const sunset = wallClock(solar.sunset, clock);

    /* Every rule here quotes a statute that opens BEFORE sunrise and closes
       AFTER sunset. Both halves are asserted, because a sign error in either
       direction is a wrong answer and only one of them gets reported. */
    assert.match(rule.statedAs, /before sunrise/i, `${name}: this test assumes the rule claims to open before sunrise`);
    assert.ok(result.window.opensAt < sunrise,
      `${name}: opens ${result.window.opensAt}, sunrise ${sunrise} — its own words say before sunrise`);
    assert.ok(result.window.closesAt > sunset,
      `${name}: closes ${result.window.closesAt}, sunset ${sunset} — its own words say after sunset`);
    checked += 1;
  }
  assert.ok(checked >= 6, `only ${checked} offset rules were checked`);
});
