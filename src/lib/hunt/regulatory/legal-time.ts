/**
 * Legal hunting time as a regulatory determination.
 *
 * Not "when is sunrise". A legal hunting time is derived from an authority's
 * rule, carries that rule's provenance, and is wrong in the same way a season
 * is wrong. A weather provider's sunrise is environmental context and is never
 * an input here — see `solar.ts` for why the calculation is ours.
 *
 * The engine returns times ON the chosen date, already resolved in the point's
 * own timezone. A caller renders them; it never recomputes an offset, and it
 * is deliberately not given the raw solar times to recompute one from.
 */

import type { CanonicalId } from "../../content-contract/index.ts";
import type { IsoDate } from "../../content-contract/index.ts";
import type { PointTimeZone } from "../time-zone.ts";
import { SOLAR_ALGORITHM_VERSION, localDate, sunriseSunset, wallClock } from "./solar.ts";

/**
 * How far our computed solar times may sit from the authority's published
 * ones, measured rather than assumed.
 *
 * Verified against the US Naval Observatory's published values at six
 * Canadian sites across the year (see `solar.test.ts`): worst disagreement 2
 * minutes, and BIASED — our sunrise runs up to a minute early and our sunset
 * up to two minutes late, so our computed daylight is systematically WIDER
 * than the authority's. That is the direction that would authorise hunting
 * outside the legal window, so the margin below is applied INWARD and is
 * sized to the worst observed error rather than to the average.
 */
export const SOLAR_UNCERTAINTY_MINUTES = 2;

export type LegalTimeBasis =
  | "SUNRISE_TO_SUNSET"
  | "SUNRISE_SUNSET_OFFSET"
  | "FIXED_LOCAL_TIMES"
  | "AUTHORITY_TABLE";

/**
 * A jurisdiction's legal-time rule, as the authority states it.
 *
 * `AUTHORITY_TABLE` is deliberately absent: where an authority publishes its
 * own table of legal hunting times, THAT TABLE IS THE LAW AND OUR ASTRONOMY IS
 * NOT — the same rule as `DERIVED_FROM_LEGAL_DESCRIPTION` on zone geometry —
 * so it is supplied as read values, never computed here.
 */
export type LegalTimeRule =
  | {
      basis: "SUNRISE_TO_SUNSET";
      statedAs: string;
      section: string;
      sourceId: CanonicalId<"source">;
    }
  | {
      basis: "SUNRISE_SUNSET_OFFSET";
      /** Signed minutes. Negative starts before sunrise; positive ends after sunset. May be asymmetric. */
      beforeSunriseMinutes: number;
      afterSunsetMinutes: number;
      statedAs: string;
      section: string;
      sourceId: CanonicalId<"source">;
    }
  | {
      basis: "FIXED_LOCAL_TIMES";
      opensAt: string;
      closesAt: string;
      statedAs: string;
      section: string;
      sourceId: CanonicalId<"source">;
    };

export type LegalTimeResult =
  | {
      status: "RESOLVED";
      basis: LegalTimeBasis;
      /** Wall-clock times ON the requested date, in `timezone`. */
      window: { opensAt: string; closesAt: string };
      timezone: string;
      date: IsoDate;
      statedAs: string;
      sourceId: CanonicalId<"source">;
      /** Stated, never implied: the margin already applied, and the algorithm. */
      precision: { marginMinutes: number; appliedInward: true; algorithm: string };
    }
  | {
      /** The sun does not rise or set that day. A real answer, not an error. */
      status: "NO_SOLAR_EVENT";
      reason: "SUN_UP_ALL_DAY" | "SUN_DOWN_ALL_DAY";
      timezone: string;
      date: IsoDate;
      statedAs: string;
      sourceId: CanonicalId<"source">;
    }
  | {
      status: "NOT_CERTIFIED";
      /** Why, and who to ask. Never an error state. */
      reason: string;
      authority: string;
      sourceId?: CanonicalId<"source">;
    };

const pad = (value: number) => String(value).padStart(2, "0");

/** Shift a wall clock by minutes, staying on the same day's clock face. */
function shift(clock: string, minutes: number): string {
  const total = Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5)) + minutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${pad(Math.floor(wrapped / 60))}:${pad(wrapped % 60)}`;
}

/**
 * The legal window for a rule at a point on a date.
 *
 * The margin is applied INWARD on both ends — later start, earlier end — so a
 * computed value that is wrong by up to `SOLAR_UNCERTAINTY_MINUTES` can never
 * authorise a minute outside the legal window. The cost is a hunter losing a
 * few minutes they were entitled to; the cost of the other direction is a
 * hunter shooting before it was legal.
 */
export function legalTimeFor(
  rule: LegalTimeRule,
  point: { latitude: number; longitude: number },
  date: IsoDate,
  timezone: PointTimeZone,
): LegalTimeResult {
  const [year, month, day] = date.split("-").map(Number);

  if (rule.basis === "FIXED_LOCAL_TIMES") {
    /* No solar term, so no solar uncertainty: the times are the law's own. */
    return {
      status: "RESOLVED",
      basis: rule.basis,
      window: { opensAt: rule.opensAt, closesAt: rule.closesAt },
      timezone, date, statedAs: rule.statedAs, sourceId: rule.sourceId,
      precision: { marginMinutes: 0, appliedInward: true, algorithm: "none" },
    };
  }

  const solar = sunriseSunset(point.latitude, point.longitude, { year, month, day });
  if ("polar" in solar) {
    return {
      status: "NO_SOLAR_EVENT",
      reason: solar.polar,
      timezone, date, statedAs: rule.statedAs, sourceId: rule.sourceId,
    };
  }

  /*
   * The solar event must fall on the requested local date. Near the poles, and
   * at a timezone whose offset pushes an event across midnight, it may not —
   * and a window built from another day's sunrise would look ordinary.
   */
  if (localDate(solar.sunrise, timezone) !== date || localDate(solar.sunset, timezone) !== date) {
    return {
      status: "NOT_CERTIFIED",
      reason:
        "Sunrise or sunset for this point falls on a different local date, so North Ground will not state a legal window for it.",
      authority: "North Ground",
    };
  }

  const before = rule.basis === "SUNRISE_SUNSET_OFFSET" ? rule.beforeSunriseMinutes : 0;
  const after = rule.basis === "SUNRISE_SUNSET_OFFSET" ? rule.afterSunsetMinutes : 0;
  const opensAt = shift(wallClock(solar.sunrise, timezone), -before + SOLAR_UNCERTAINTY_MINUTES);
  const closesAt = shift(wallClock(solar.sunset, timezone), after - SOLAR_UNCERTAINTY_MINUTES);

  return {
    status: "RESOLVED",
    basis: rule.basis,
    window: { opensAt, closesAt },
    timezone, date, statedAs: rule.statedAs, sourceId: rule.sourceId,
    precision: {
      marginMinutes: SOLAR_UNCERTAINTY_MINUTES,
      appliedInward: true,
      algorithm: SOLAR_ALGORITHM_VERSION,
    },
  };
}

/** The honest answer where the point's timezone cannot be established. */
export function legalTimeNotCertified(reason: string, authority: string, sourceId?: CanonicalId<"source">): LegalTimeResult {
  return { status: "NOT_CERTIFIED", reason, authority, ...(sourceId ? { sourceId } : {}) };
}

/**
 * One sentence for a caller that still needs prose.
 *
 * Derived from the result rather than authored beside it, so the words and the
 * window can never disagree. A caller rendering the window itself does not use
 * this.
 */
export function legalTimeSummary(result: LegalTimeResult): string {
  if (result.status === "RESOLVED") {
    return `${result.window.opensAt} to ${result.window.closesAt} (${result.timezone}) on ${result.date}. ` +
      `${result.statedAs}.` +
      (result.precision.marginMinutes
        ? ` Narrowed by ${result.precision.marginMinutes} minutes at each end so a calculation error cannot authorise a minute outside the legal window.`
        : "");
  }
  if (result.status === "NO_SOLAR_EVENT") {
    return result.reason === "SUN_UP_ALL_DAY"
      ? `The sun does not set at this point on ${result.date}, so this rule states no window for it.`
      : `The sun does not rise at this point on ${result.date}, so this rule states no window for it.`;
  }
  return result.reason;
}
