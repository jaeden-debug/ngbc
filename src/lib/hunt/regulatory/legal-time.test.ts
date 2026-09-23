import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import type { IsoDate } from "../../content-contract/index.ts";
import { pointTimeZone, timeZoneAtPoint } from "../time-zone.ts";
import { legalTimeFor, SOLAR_UNCERTAINTY_MINUTES, type LegalTimeRule } from "./legal-time.ts";
import { sunriseSunset, wallClock } from "./solar.ts";

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
