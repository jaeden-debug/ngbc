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
import type { ObservedClock } from "./statutory-time.ts";
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
  | "SUNRISE_OFFSET_TO_FIXED_CLOSE"
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
    }
  /*
   * A window whose two ends come from different kinds of fact: one solar, one
   * a clock time the regulation names. Two jurisdictions state wild turkey
   * this way and both END EARLY —
   *
   *   Ontario  O. Reg. 670/98, Table 7.2: half an hour before sunrise to 7 p.m.
   *   Québec   C-61.1, r. 12, s. 14:      half an hour before sunrise to noon
   *
   * Neither is expressible as an offset pair or as two fixed times, and
   * computing either from a general sunrise-to-sunset rule overshoots by
   * hours — Ontario's by about two in mid-May.
   */
  | {
      basis: "SUNRISE_OFFSET_TO_FIXED_CLOSE";
      /** Minutes before sunrise the window opens. */
      beforeSunriseMinutes: number;
      /** The clock time it closes, in the statute's own terms. */
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
      /*
       * Whether this window is also the clock a hunter reads at the point.
       *
       * The window is always the LEGAL truth, in the basis the rule is written
       * in. Where the locally observed clock is the same one, it is directly
       * actionable and nothing is converted. Where North Ground cannot place
       * the point's observed clock, this says so, and the renderer must not
       * present the time as a local reading (§41A).
       *
       * Absent where the jurisdiction has no statutory-versus-observed
       * question to answer.
       */
      observedClock?: ObservedClock;
      timezone: string;
      date: IsoDate;
      statedAs: string;
      /**
       * The pinpoint the window comes from ("M.R. 351/87, s. 3").
       *
       * A refusal always named its provision, because the reason string
       * carried it. A stated window did not, so certifying a jurisdiction
       * silently REMOVED its citation from the answer — provenance going
       * backwards as coverage went forwards. It travels with the window now.
       */
      section: string;
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
      timezone, date, statedAs: rule.statedAs, section: rule.section, sourceId: rule.sourceId,
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

  const before = rule.basis === "SUNRISE_SUNSET_OFFSET" || rule.basis === "SUNRISE_OFFSET_TO_FIXED_CLOSE"
    ? rule.beforeSunriseMinutes
    : 0;
  const after = rule.basis === "SUNRISE_SUNSET_OFFSET" ? rule.afterSunsetMinutes : 0;
  const opensAt = shift(wallClock(solar.sunrise, timezone), -before + SOLAR_UNCERTAINTY_MINUTES);
  /*
   * A closing the regulation names as a clock time carries NO solar margin —
   * it is not a solar term, so there is nothing to be uncertain about. Only the
   * sunrise end is nudged inward.
   */
  const closesAt = rule.basis === "SUNRISE_OFFSET_TO_FIXED_CLOSE"
    ? rule.closesAt
    : shift(wallClock(solar.sunset, timezone), after - SOLAR_UNCERTAINTY_MINUTES);

  return {
    status: "RESOLVED",
    basis: rule.basis,
    window: { opensAt, closesAt },
    timezone, date, statedAs: rule.statedAs, section: rule.section, sourceId: rule.sourceId,
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
    /*
     * The provision supplies its own full stop when it is a whole sentence —
     * Ontario's s. 20 (1) and Alberta's s. 28 both end in one — so appending
     * another produced "wildlife.. Narrowed by". Quoted legal text is never
     * reworded to fit our punctuation; the punctuation gives way.
     */
    const stated = /[.!?]$/.test(result.statedAs) ? result.statedAs : `${result.statedAs}.`;
    return `${result.window.opensAt} to ${result.window.closesAt} (${result.timezone}) on ${result.date}. ` +
      `${stated} (${result.section})` +
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

/**
 * Two rules that both bind, composed into the window a hunter may actually use.
 *
 * INTERSECTION, NEVER REPLACEMENT. Ontario is the worked case: the Fish and
 * Wildlife Conservation Act s. 20 PROHIBITS hunting between half an hour after
 * sunset and half an hour before sunrise, while O. Reg. 670/98 Table 7.2
 * PRESCRIBES times for wild turkey. A hunter must satisfy both, so the lawful
 * window is the overlap — the later opening and the earlier closing.
 *
 * It would be easy to skip this: in spring turkey the table's 7 p.m. always
 * falls before sunset plus thirty minutes, so the table simply wins, and
 * "narrower replaces broader" would give the right answer every time. That is a
 * fact about this season's arithmetic, not about the law, and encoding it would
 * break silently the first time a prescribed time fell later than the general
 * rule's close. The overlap is computed rather than assumed.
 *
 * An empty overlap is a real answer — no lawful window that day — not an error.
 */
export function intersectLegalTime(results: readonly LegalTimeResult[]): LegalTimeResult {
  if (!results.length) {
    return legalTimeNotCertified("No legal-time rule was supplied for this answer.", "North Ground");
  }
  /* A rule that could not be resolved makes the composition unresolvable: the
     unknown half could be the binding one. */
  const unresolved = results.find((result) => result.status !== "RESOLVED");
  if (unresolved) return unresolved;

  const resolved = results.filter((result): result is Extract<LegalTimeResult, { status: "RESOLVED" }> =>
    result.status === "RESOLVED");

  const opensAt = resolved.map((result) => result.window.opensAt).sort().at(-1)!;
  const closesAt = resolved.map((result) => result.window.closesAt).sort()[0]!;

  if (opensAt >= closesAt) {
    return {
      status: "NOT_CERTIFIED",
      reason:
        "The rules that apply here leave no overlapping time on this date. North Ground will not state a window it " +
        "cannot show a hunter may use.",
      authority: resolved[0].sourceId ? "Province of Ontario" : "North Ground",
    };
  }

  /* The binding end carries its own provenance: a hunter asking why the day
     ends at seven should be shown the rule that ends it, not the other one. */
  const bindingClose = resolved.find((result) => result.window.closesAt === closesAt)!;
  const bindingOpen = resolved.find((result) => result.window.opensAt === opensAt)!;

  return {
    ...bindingClose,
    status: "RESOLVED",
    window: { opensAt, closesAt },
    statedAs: [...new Set(resolved.map((result) => result.statedAs))].join(" "),
    /* Both provisions bind, so both are cited — the window is their intersection. */
    section: [...new Set(resolved.map((result) => result.section))].join("; "),
    basis: bindingClose.basis,
    precision: bindingOpen.precision,
  };
}
