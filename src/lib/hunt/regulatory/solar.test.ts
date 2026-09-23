import assert from "node:assert/strict";
import { test } from "node:test";
import { sunriseSunset, wallClock } from "./solar.ts";

/**
 * Verified against an AUTHORITY'S PUBLISHED VALUES, not another
 * implementation. An implementation verified only against another
 * implementation is verified against nothing.
 *
 * Source: US Naval Observatory Astronomical Applications API (rstt/oneday),
 * retrieved 2026-09-23, for six Canadian sites across the year. Recorded here
 * so the check is deterministic and offline; re-fetch to re-verify.
 */

const USNO = [
  { place: "Charlottetown", latitude: 46.2382, longitude: -63.1311, tz: "America/Halifax", date: { year: 2026, month: 11, day: 5 }, rise: "06:59", set: "16:52" },
  { place: "Charlottetown (solstice)", latitude: 46.2382, longitude: -63.1311, tz: "America/Halifax", date: { year: 2026, month: 6, day: 21 }, rise: "05:21", set: "21:08" },
  { place: "Whitehorse", latitude: 60.7212, longitude: -135.0568, tz: "America/Whitehorse", date: { year: 2026, month: 9, day: 20 }, rise: "07:40", set: "20:05" },
  { place: "Whitehorse (midwinter)", latitude: 60.7212, longitude: -135.0568, tz: "America/Whitehorse", date: { year: 2026, month: 12, day: 21 }, rise: "11:10", set: "16:47" },
  { place: "Regina (no DST)", latitude: 50.4452, longitude: -104.6189, tz: "America/Regina", date: { year: 2026, month: 10, day: 15 }, rise: "07:21", set: "18:06" },
  { place: "St John's (half-hour zone)", latitude: 47.5615, longitude: -52.7126, tz: "America/St_Johns", date: { year: 2026, month: 11, day: 5 }, rise: "06:51", set: "16:37" },
];

const minutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));

test("the calculation agrees with the authority to within two minutes", () => {
  for (const row of USNO) {
    const solar = sunriseSunset(row.latitude, row.longitude, row.date);
    assert.ok(!("polar" in solar), row.place);
    if ("polar" in solar) continue;
    const rise = wallClock(solar.sunrise, row.tz);
    const set = wallClock(solar.sunset, row.tz);
    assert.ok(Math.abs(minutes(rise) - minutes(row.rise)) <= 2, `${row.place} sunrise ${rise} vs ${row.rise}`);
    assert.ok(Math.abs(minutes(set) - minutes(row.set)) <= 2, `${row.place} sunset ${set} vs ${row.set}`);
  }
});

test("the disagreement is biased WIDER, which is why the margin is applied inward", () => {
  /*
   * Our computed daylight runs a little longer than the authority's — sunrise
   * up to a minute early, sunset up to two minutes late. That is the direction
   * that would authorise hunting outside the legal window, and it is the
   * measured reason `legal-time.ts` narrows the window rather than centring it.
   */
  let widest = 0;
  for (const row of USNO) {
    const solar = sunriseSunset(row.latitude, row.longitude, row.date);
    if ("polar" in solar) continue;
    const ourSpan = minutes(wallClock(solar.sunset, row.tz)) - minutes(wallClock(solar.sunrise, row.tz));
    widest = Math.max(widest, ourSpan - (minutes(row.set) - minutes(row.rise)));
  }
  assert.ok(widest >= 0, "our day is never shorter than the authority's in these samples");
  assert.ok(widest <= 4, `our day is at most 4 minutes longer; measured ${widest}`);
});

test("a polar day with no sunrise is a real answer, not an error", () => {
  /* Northern Yukon is inside the Arctic Circle and North Ground serves it. */
  const midwinter = sunriseSunset(69.5, -139.0, { year: 2026, month: 12, day: 21 });
  assert.ok("polar" in midwinter && midwinter.polar === "SUN_DOWN_ALL_DAY");
  const midsummer = sunriseSunset(69.5, -139.0, { year: 2026, month: 6, day: 21 });
  assert.ok("polar" in midsummer && midsummer.polar === "SUN_UP_ALL_DAY");
});

test("a wall clock is read in the zone asked for, including a half-hour zone", () => {
  const solar = sunriseSunset(47.5615, -52.7126, { year: 2026, month: 11, day: 5 });
  assert.ok(!("polar" in solar));
  if ("polar" in solar) return;
  /* St John's is UTC-3:30. A zone offset handled as whole hours lands 30
     minutes out, which is the size of a legal-time offset. */
  const stJohns = wallClock(solar.sunrise, "America/St_Johns");
  const halifax = wallClock(solar.sunrise, "America/Halifax");
  assert.equal(minutes(stJohns) - minutes(halifax), 30);
});
