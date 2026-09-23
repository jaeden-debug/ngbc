/**
 * The clock a hunting hour is measured by, computed from the statute.
 *
 * NOT FROM A TIMEZONE DATABASE, and the distinction is the point. Ontario's
 * Time Act, R.S.O. 1990, c. T.9, s. 1 says an expression of time in any
 * regulation IS the time that Act provides. So "7 p.m." in a hunting
 * regulation is statutory time, and the statute states it completely:
 *
 *   s. 2 (1)  east of the meridian of 90°W — five hours behind Greenwich
 *   s. 2 (2)  west of that meridian        — six hours behind Greenwich
 *   s. 2 (3)  daylight saving time is one hour ahead of standard time
 *   s. 2 (4)  daylight saving time is in effect from 2 a.m. standard time on
 *             the second Sunday in March to 2 a.m. daylight saving time on the
 *             first Sunday in November; standard time the rest of the year
 *
 * s. 2 (5) lets the Lieutenant Governor in Council vary any of it by
 * regulation. It has been exercised exactly once — O. Reg. 111/06, Variation of
 * Time in Effect — and that regulation was REVOKED on 2 March 2010 (O. Reg.
 * 49/10), its content having been written into s. 2 (4) by 2009, c. 33. Checked
 * 2026-09-23 against e-Laws, which lists no current regulations under the Act.
 * So nothing varies the reckoning, and the statute is the whole rule.
 *
 * The offsets are carried into date arithmetic through FIXED-OFFSET zones
 * (`Etc/GMT+5`, `Etc/GMT+6`), never through a named regional zone, because a
 * named zone imports a database's DST policy and the policy here is the Act's.
 * `America/Atikokan` in particular encodes observed local practice that the
 * statute does not provide for — see `divergence` below.
 *
 * NOT IN FORCE, and deliberately not encoded: 2020, c. 28 would move Ontario to
 * permanent standard time (four and five hours behind Greenwich). It is printed
 * inline in the Act's own text and awaits proclamation. An implementer reading
 * the amendment notes rather than the status line encodes the wrong offset.
 */

import type { IsoDate } from "../../content-contract/index.ts";

export type StatutoryClock =
  | {
      status: "RESOLVED";
      /** Minutes behind UTC, negative west of Greenwich. */
      offsetMinutes: number;
      /** A fixed-offset IANA zone carrying exactly that offset and no policy. */
      zone: string;
      /** Whether the Act's daylight saving period covers this date. */
      daylightSaving: boolean;
      statedAs: string;
      section: string;
      /**
       * Present where civil time as locally observed is known to differ from
       * the statutory reckoning. The window is still the statute's; a hunter
       * reading a local clock is not reading this one.
       */
      divergence?: StatutoryClockDivergence;
      /** Whether the locally observed clock is the statutory one — see `ObservedClock`. */
      observed: ObservedClock;
    }
  | {
      status: "NOT_CERTIFIED";
      reason: string;
      authority: string;
    };

/**
 * Whether the clock a hunter's phone shows is the clock the rule is written in.
 *
 * §41A requires the hunter-facing time to be the one they should actually
 * follow, and forbids making them convert. Both facts are kept: the statutory
 * basis is the legal truth and is never discarded, and the observed clock is
 * presentation and actionability only.
 *
 * Where they are the same, one window serves both and there is nothing to
 * convert. Where they may differ, North Ground does not invent a local clock it
 * cannot place a point in — showing a time an hour out is worse in both
 * directions than showing the statutory time and saying so.
 */
export type ObservedClock =
  | {
      status: "SAME_AS_STATUTORY";
      /** How that was established, rather than assumed. */
      statedAs: string;
    }
  | {
      status: "NOT_CERTIFIED";
      reason: string;
    };

export interface StatutoryClockDivergence {
  /** What is observed, and on whose say-so — never an instrument, or it would not diverge. */
  observed: string;
  statedAs: string;
}

/**
 * How close to a statutory meridian is too close to call.
 *
 * The Act draws a line of longitude; a consumer GPS fix is not a survey, and
 * §41 forbids presenting one as legally infallible. About 150 m at Ontario's
 * latitudes — far wider than any real fix, deliberately: an extra
 * NOT_CERTIFIED costs a hunter a check with the authority, and the other error
 * costs them an hour of the wrong clock.
 */
export const MERIDIAN_TOLERANCE_DEGREES = 0.002;

/** Ontario's Time Act boundary. */
const ONTARIO_MERIDIAN = -90;

const utc = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day);

/** The nth given weekday of a month, as a UTC day number. */
function nthWeekday(year: number, month: number, weekday: number, nth: number): number {
  const first = new Date(utc(year, month, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return 1 + offset + (nth - 1) * 7;
}

/**
 * Whether the Act's daylight saving period covers a calendar date.
 *
 * s. 2 (4) starts and ends at 2 a.m., so the boundary days are partly one and
 * partly the other. A hunting window is stated in whole local times and the
 * transition falls at 2 a.m. — before any legal hunting hour on those dates in
 * this latitude band — so the day is taken whole. Where that ever stops being
 * true the answer must become NOT_CERTIFIED rather than pick an hour.
 */
export function daylightSavingInEffect(date: IsoDate): boolean {
  const [year, month, day] = date.split("-").map(Number);
  const start = nthWeekday(year, 3, 0, 2);   // second Sunday in March
  const end = nthWeekday(year, 11, 0, 1);    // first Sunday in November
  const value = utc(year, month, day);
  return value >= utc(year, 3, start) && value < utc(year, 11, end);
}

/**
 * Ontario's statutory clock at a point, for a date.
 *
 * Longitude decides the standard offset, the date decides daylight saving, and
 * a point on the meridian decides nothing — it refuses.
 */
export function ontarioStatutoryClock(
  point: { longitude: number },
  date: IsoDate,
): StatutoryClock {
  if (Math.abs(point.longitude - ONTARIO_MERIDIAN) <= MERIDIAN_TOLERANCE_DEGREES) {
    return {
      status: "NOT_CERTIFIED",
      reason:
        "This point is within about 150 m of the meridian of 90° W. longitude, which Ontario's Time Act uses to " +
        "divide standard time. North Ground will not choose a side of it.",
      authority: "Province of Ontario",
    };
  }

  const east = point.longitude > ONTARIO_MERIDIAN;
  const daylightSaving = daylightSavingInEffect(date);
  const standardHours = east ? 5 : 6;
  const hoursBehind = standardHours - (daylightSaving ? 1 : 0);

  return {
    status: "RESOLVED",
    offsetMinutes: -hoursBehind * 60,
    /* POSIX sign convention: Etc/GMT+5 is five hours BEHIND Greenwich. */
    zone: `Etc/GMT+${hoursBehind}`,
    daylightSaving,
    statedAs: east
      ? "Standard time in the part of Ontario that lies east of the meridian of 90° W. longitude shall be reckoned as five hours behind Greenwich time."
      : "Standard time in the part of Ontario that lies west of the meridian of 90° W. longitude shall be reckoned as six hours behind Greenwich time.",
    section: east ? "Time Act, R.S.O. 1990, c. T.9, s. 2 (1)" : "Time Act, R.S.O. 1990, c. T.9, s. 2 (2)",
    observed: east ? OBSERVED_EAST : OBSERVED_WEST,
    ...(east ? {} : { divergence: ONTARIO_WEST_DIVERGENCE }),
  };
}

/**
 * West of the meridian, some Ontario communities keep Eastern time all year —
 * Atikokan and Pickle Lake are the known ones, and the IANA database carries
 * `America/Atikokan` for exactly that practice.
 *
 * NO INSTRUMENT BACKS IT. s. 2 (5) is the only mechanism that could, it has
 * been exercised once, and that regulation was revoked. So the practice has no
 * force under the Act and the legal clock remains the statutory one — while
 * the clock on a hunter's phone there may not be.
 *
 * Recorded as a fact rather than a boundary, because North Ground holds no
 * authority's description of where the practice extends. Inventing one would be
 * the same error as inventing a zone line.
 */
const ONTARIO_WEST_DIVERGENCE: StatutoryClockDivergence = {
  observed:
    "Some communities west of the meridian — Atikokan and Pickle Lake among them — observe Eastern time all year, " +
    "which is one hour ahead of the statutory reckoning while daylight saving time is not in effect.",
  statedAs:
    "No regulation under the Time Act provides for this. Section 2 (5) permits the Lieutenant Governor in Council to " +
    "vary the reckoning; it was exercised once, by O. Reg. 111/06, which was revoked on 2 March 2010.",
};


/**
 * East of the meridian the two clocks are the same, and that is MEASURED.
 *
 * Every day of 2026 and 2027 — 730 of them — `America/Toronto`'s offset equals
 * the offset computed from the Act, with no exceptions. So the statutory window
 * is already the window a hunter's phone shows, one window serves both purposes
 * and nothing is converted. The IANA zone is the evidence here, never the
 * source: the offset still comes from the statute.
 */
const OBSERVED_EAST: ObservedClock = {
  status: "SAME_AS_STATUTORY",
  statedAs:
    "East of the meridian the locally observed clock and the Time Act's reckoning agree on every day of 2026 and " +
    "2027, checked against the IANA zone America/Toronto. The window shown is the statutory one and needs no conversion.",
};

/**
 * West of it, North Ground cannot say which clock a point keeps.
 *
 * Most of western Ontario observes the statutory reckoning — `America/Winnipeg`
 * agrees with it on all 730 days — but Atikokan and Pickle Lake keep Eastern
 * time all year, and `America/Atikokan` differs from the statute on 254 of
 * those days, every one of them outside the daylight saving period.
 *
 * Which of the two a point keeps is a question about where those communities
 * extend, and NORTH GROUND HOLDS NO AUTHORITY'S DESCRIPTION OF THAT. Inventing
 * a boundary to produce a friendlier answer is the same error as inventing a
 * zone line. The statutory window stands as the legal answer; the local clock
 * is refused rather than guessed.
 */
const OBSERVED_WEST: ObservedClock = {
  status: "NOT_CERTIFIED",
  reason:
    "West of the meridian, some communities keep Eastern time all year while others follow the statutory reckoning, " +
    "and North Ground holds no official description of where each applies. The times here are the Time Act's; a clock " +
    "at this location may read an hour later outside the daylight saving period.",
};
