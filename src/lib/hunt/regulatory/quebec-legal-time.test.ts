import assert from "node:assert/strict";
import test from "node:test";
import type { IsoDate } from "../../content-contract/index.ts";
import { daylightSavingInEffect } from "./statutory-time.ts";
import { quebecStatutoryClock } from "./quebec-statutory-time.ts";
import { quebecHoursRules, quebecLegalTime, quebecNightPermission, QUEBEC_GENERAL_HOURS, QUEBEC_TURKEY_HOURS } from "./quebec-legal-time.ts";

/**
 * Québec's hours, tested on the seams rather than on the happy path.
 *
 * The happy path — a southern zone in September — is the case that would pass
 * under almost any encoding, including several wrong ones. What is worth
 * testing is the 63rd meridian, the east's three reckonings, the method-
 * dependent night permission, and the turkey narrowing, because each is a place
 * where a plausible implementation gives a confident wrong answer.
 */

const MANIWAKI = { latitude: 46.3789, longitude: -75.9664 };
const day = (value: string) => value as IsoDate;

test("the general window is half an hour either side, not sunrise to sunset", () => {
  /* The offsets are the whole difference between this rule and a careless one.
     A sunrise-to-sunset reading loses a hunter an hour of lawful time a day. */
  assert.equal(QUEBEC_GENERAL_HOURS.basis, "SUNRISE_SUNSET_OFFSET");
  assert.equal(
    QUEBEC_GENERAL_HOURS.basis === "SUNRISE_SUNSET_OFFSET" ? QUEBEC_GENERAL_HOURS.beforeSunriseMinutes : null, 30);
  assert.equal(
    QUEBEC_GENERAL_HOURS.basis === "SUNRISE_SUNSET_OFFSET" ? QUEBEC_GENERAL_HOURS.afterSunsetMinutes : null, 30);
});

test("the window cites BOTH instruments that make it", () => {
  /*
   * The fact is a join: the Act DEFINES night and the regulation RESTRICTS
   * hunting in it. A citation naming only one of them points a hunter at a
   * provision that does not say what the answer says — which is the failure
   * mode of a schema field that can hold a single section.
   */
  const section = QUEBEC_GENERAL_HOURS.section;
  assert.match(section, /C-61\.1/);
  assert.match(section, /r\. 12, s\. 21/);
  assert.match(section, /ss\. 1 and 56/);
});

test("Maniwaki on a September day resolves to the day window", () => {
  const result = quebecLegalTime("species:arctic-hare", MANIWAKI, day("2026-09-29"));
  assert.equal(result.status, "RESOLVED");
  if (result.status !== "RESOLVED") return;
  /* Sunrise 06:59 and sunset 18:48 EDT, each moved 30 minutes out and 2 back
     in. Asserted as values rather than recomputed: a test that repeats the
     implementation's arithmetic agrees with it however wrong it is. */
  assert.deepEqual(result.window, { opensAt: "06:31", closesAt: "19:16" });
  assert.equal(result.timezone, "Etc/GMT+4");
});

test("the margin is applied inward, so a solar error cannot authorise an illegal minute", () => {
  const result = quebecLegalTime("species:ruffed-grouse", MANIWAKI, day("2026-09-29"));
  assert.equal(result.status, "RESOLVED");
  if (result.status !== "RESOLVED") return;
  assert.equal(result.precision.appliedInward, true);
  assert.ok(result.precision.marginMinutes > 0);
});

test("west of the 63rd meridian the statutory clock is the observed clock", () => {
  const result = quebecLegalTime("species:ruffed-grouse", MANIWAKI, day("2026-09-29"));
  assert.equal(result.status, "RESOLVED");
  if (result.status !== "RESOLVED") return;
  assert.equal(result.observedClock?.status, "SAME_AS_STATUTORY");
});

test("east of the 63rd meridian is refused, and the refusal names why", () => {
  /*
   * Blanc-Sablon, on the Basse-Côte-Nord. Three reckonings are live east of the
   * line — Minganie keeps Eastern, the Îles-de-la-Madeleine and Listuguj
   * advance, the remainder never does — and they are an hour apart in winter.
   * A confident answer here is the failure; the refusal is the correct output.
   */
  const result = quebecLegalTime("species:ruffed-grouse", { latitude: 51.42, longitude: -57.13 }, day("2026-12-10"));
  assert.equal(result.status, "NOT_CERTIFIED");
  if (result.status !== "NOT_CERTIFIED") return;
  assert.match(result.reason, /63°/);
  assert.match(result.reason, /Minganie/);
});

test("a point on the meridian itself chooses no side", () => {
  const result = quebecStatutoryClock({ longitude: -63 }, day("2026-09-29"));
  assert.equal(result.status, "NOT_CERTIFIED");
});

test("the statutory offset follows the Act's own daylight-saving period", () => {
  /*
   * Read from the Act's rule rather than from a named IANA zone, which would
   * import a database's policy in place of the statute's. The two agree today;
   * the test asserts the statute so that they can be shown to.
   */
  const summer = quebecStatutoryClock({ longitude: -73.5 }, day("2026-07-01"));
  const winter = quebecStatutoryClock({ longitude: -73.5 }, day("2026-12-15"));
  assert.equal(summer.status === "RESOLVED" && summer.offsetMinutes, -240);
  assert.equal(winter.status === "RESOLVED" && winter.offsetMinutes, -300);
  assert.equal(daylightSavingInEffect(day("2026-07-01")), true);
  assert.equal(daylightSavingInEffect(day("2026-12-15")), false);
});

test("hare carries s. 21's night permission, and it is marked as WIDENING", () => {
  /*
   * The owner's own worked case. Arctic hare is on s. 21's list, so the day
   * window is not the whole law for a snare hunter — and the effect is stated
   * because the two directions are not interchangeable: a WIDENS exception left
   * off tells a lawful hunter they may not go.
   */
  const result = quebecLegalTime("species:arctic-hare", MANIWAKI, day("2026-09-29"));
  assert.equal(result.status, "RESOLVED");
  if (result.status !== "RESOLVED") return;
  assert.equal(result.exceptions?.length, 1);
  assert.equal(result.exceptions?.[0].effect, "WIDENS");
  /* The MEANS is part of the permission. A line saying only "hare may be
     hunted at night" would be read by a hunter carrying a rifle. */
  assert.match(result.exceptions?.[0].text ?? "", /snare/);
  assert.match(result.exceptions?.[0].section ?? "", /s\. 21/);
});

test("a species s. 21 does not name carries no night permission", () => {
  assert.equal(quebecNightPermission("species:ruffed-grouse"), null);
  assert.equal(quebecNightPermission("species:white-tailed-deer"), null);
  const result = quebecLegalTime("species:ruffed-grouse", MANIWAKI, day("2026-09-29"));
  assert.equal(result.status === "RESOLVED" && result.exceptions, undefined);
});

test("wild turkey composes to the morning close, and it beats the general rule", () => {
  /*
   * s. 14's noon and s. 56's general window BOTH bind, so the lawful time is
   * the overlap. Computing the general rule alone would publish roughly seven
   * hours of unlawful afternoon with a source link beside it.
   */
  const rules = quebecHoursRules("species:wild-turkey", day("2026-05-01"));
  assert.equal(rules.length, 2);
  const result = quebecLegalTime("species:wild-turkey", MANIWAKI, day("2026-05-01"));
  assert.equal(result.status, "RESOLVED");
  if (result.status !== "RESOLVED") return;
  assert.equal(result.window.closesAt, "12:00");
  assert.match(result.section, /art\. 14, septième alinéa/);
});

test("a whole-zone question gets no window, and says it is about a point", () => {
  /* A zone spans degrees of longitude; its sunrise differs across it. */
  const result = quebecLegalTime("species:arctic-hare", { latitude: Number.NaN, longitude: Number.NaN }, day("2026-09-29"));
  assert.equal(result.status, "NOT_CERTIFIED");
  if (result.status !== "NOT_CERTIFIED") return;
  assert.match(result.reason, /point/);
});

test("the turkey citation is the septième alinéa, and it is anchored as well as numbered", () => {
  /*
   * THIS SHIPPED WRONG ONCE, AS "s. 14, para. 6".
   *
   * The turkey text is at index 6 counting from zero; the Québec alinéa
   * convention makes the opening paragraph the PREMIER alinéa, so the correct
   * ordinal is the seventh. What makes this worth a test of its own is where
   * the wrong citation LANDED: the sixième alinéa is a real provision about
   * small-game hunting in zone 3. An off-by-one that points at nothing gets
   * caught; one that points at a different real rule gets believed, because a
   * reader who checks it finds a genuine provision and concludes the reference
   * is sound and the text was mis-transcribed.
   *
   * The anchor is asserted too. An index is a position and positions move when
   * a regulation is amended, which is how this class of error is born.
   */
  assert.match(QUEBEC_TURKEY_HOURS.section, /art\. 14, septième alinéa/);
  assert.doesNotMatch(QUEBEC_TURKEY_HOURS.section, /para\. \d/, "never cited by a zero-based paragraph index");
  assert.match(QUEBEC_TURKEY_HOURS.section, /dindon sauvage/, "carries a locator, not only a position");
});

test("no Québec hours citation is pinned by a bare paragraph index", () => {
  /* A sweep rather than a spot check: every rule this module can emit. An
     index-derived citation is the defect shape, so none may reappear anywhere. */
  const sections = [
    QUEBEC_GENERAL_HOURS.section,
    QUEBEC_TURKEY_HOURS.section,
    quebecNightPermission("species:arctic-hare")!.section,
  ];
  for (const section of sections) {
    assert.doesNotMatch(section, /\bpara\. \d/, `${section} is not pinned by a paragraph index`);
  }
});

test("the one-and-a-half-hour definition of night never reaches the window", () => {
  /*
   * C-61.1 s. 30.1 defines night as ONE AND A HALF hours either side, for its
   * own evidentiary presumption. Picking it up would widen every Québec answer
   * by an hour at each end, and would still look like a plausible window.
   * Asserted against the encoded offsets so a future edit that resolves « nuit »
   * by name rather than by section fails here.
   */
  const offsets = QUEBEC_GENERAL_HOURS.basis === "SUNRISE_SUNSET_OFFSET"
    ? [QUEBEC_GENERAL_HOURS.beforeSunriseMinutes, QUEBEC_GENERAL_HOURS.afterSunsetMinutes]
    : [];
  assert.deepEqual(offsets, [30, 30], "s. 30.1's 90-minute night is not the hunting window");
});
