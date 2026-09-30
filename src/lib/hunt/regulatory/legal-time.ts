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

import type { LimitationLang } from "../limitation.ts";
import type { CanonicalId } from "../../content-contract/index.ts";
import type { ObservedClock } from "./statutory-time.ts";
import type { IsoDate } from "../../content-contract/index.ts";
import type { PointTimeZone } from "../time-zone.ts";
import { observedClockOverride, renderingZone } from "./observed-clock.ts";
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
 * `AUTHORITY_TABLE` is here and carries READ VALUES. Where an authority
 * publishes its own table of legal hunting times, THAT TABLE IS THE LAW AND OUR
 * ASTRONOMY IS NOT — the same rule as `DERIVED_FROM_LEGAL_DESCRIPTION` on zone
 * geometry — so its rows are supplied as printed and no branch of this module
 * computes them. It was declared as a basis and left without a rule variant,
 * which meant a table-based jurisdiction could not be encoded at all; Washington
 * and Pennsylvania are both table-based, so the gap was the thing standing
 * between them and an answer.
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
  /*
   * A WINDOW THE AUTHORITY PUBLISHED AS A CLOCK TABLE, READ RATHER THAN COMPUTED.
   *
   * Two states settled this, and both look at a glance like solar rules:
   *
   *   Washington  WAC 220-416-020 opens "The following tables show the lawful
   *               hunting hours (1/2 hour before sunrise to 1/2 hour after
   *               sunset)". The parenthetical states the PRINCIPLE; the tables
   *               are the RULE. There are SEVEN of them, selected by the
   *               weekday 1 September falls on, each split into Western and
   *               Eastern Washington, in week-long date bands, partitioned into
   *               daylight-saving and standard-time blocks, rounded to five
   *               minutes.
   *   Pennsylvania 58 Pa. Code § 141.4 reads "1/2 hour before sunrise to 1/2
   *               hour after sunset AS ILLUSTRATED IN APPENDIX G", and Appendix
   *               G is a fixed statewide table of begin/end clock times per
   *               date range, then adjusted by longitude band.
   *
   * Taking either parenthetical as a formula is the error §41A names: rounding
   * the source into the nearest existing field. Our astronomy would return
   * times that DISAGREE with the authority's printed ones, and the printed ones
   * are the law. So the rows are read values and this branch computes nothing.
   *
   * Dates are ABSOLUTE rather than "week 3 of the season", which is what makes
   * one shape serve both: Washington's seven weekday variants are seven
   * different sets of absolute dates, so choosing the table is just finding the
   * row that contains the hunt date. It also forces the temporal fact into the
   * open — a licence year whose table has not been read has no rows, and gets
   * an explicit refusal instead of a computed guess.
   */
  | {
      basis: "AUTHORITY_TABLE";
      /**
       * Rows exactly as printed, each covering an inclusive date range.
       *
       * `area` is the authority's OWN geographic split where it has one
       * (Washington's "Western Washington", Pennsylvania's meridian bands) and
       * is absent where the table is statewide.
       */
      rows: ReadonlyArray<{
        from: IsoDate;
        to: IsoDate;
        area?: string;
        opensAt: string;
        closesAt: string;
      }>;
      /**
       * Which area's rows bind here, resolved BEFORE this rule is built — by
       * the authority's own published band geometry, never by guessing from a
       * longitude. Absent only where the table itself is statewide.
       */
      area?: string;
      statedAs: string;
      section: string;
      sourceId: CanonicalId<"source">;
    }
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

/**
 * A provision that is in force for this hunt but does not move the computed
 * window, because whether it bites turns on a fact the evaluation does not hold.
 *
 * THE SCHEMA EXPECTED A WINDOW AND QUÉBEC PUBLISHES A PROHIBITION WITH NAMED
 * PERMISSIONS. Its general hours are not stated as hours at all: C-61.1 s. 56
 * forbids hunting except as a regulation permits, s. 1 defines night, and
 * Règlement sur la chasse, r. 12, s. 21 then permits hunting AT NIGHT for a
 * short enumerated list — hare or rabbit by snare, three frogs, and raccoon
 * with a hound. For a hare hunter the lawful window therefore depends on what
 * they carry: a rifle is bound by the day window, a snare is not bound at all.
 *
 * Rounding that into the nearest existing field would be wrong in the direction
 * §41A warns about. Dropping the permission tells a lawful snare hunter their
 * hunt is illegal — a restriction stricter than the source, which §8 makes as
 * false as a loose one. Widening the window to fit the permission tells a rifle
 * hunter they may shoot at night. Neither is available, so the exception is
 * carried BESIDE the window as its own fact, with its own citation.
 *
 * `effect` is the safety-relevant half and is stated, never inferred from the
 * wording: WIDENS means the shown window is narrower than the law for a hunter
 * this reaches, NARROWS means it may be more permissive than their real one.
 */
export interface LegalTimeException {
  /** Stable, so a consumer can key and test one line. */
  id: string;
  /** What it does, in North Ground's own words — never a paraphrase passed off as the law's. */
  text: string;
  /** Which way it moves the real window for a hunter it reaches. */
  effect: "WIDENS" | "NARROWS";
  section: string;
  sourceId: CanonicalId<"source">;
}

export type LegalTimeResult =
  | {
      status: "RESOLVED";
      basis: LegalTimeBasis;
      /** Wall-clock times ON the requested date, in `timezone`. */
      window: { opensAt: string; closesAt: string };
      /**
       * In force here today, but outside the computed window — see
       * `LegalTimeException`. A renderer shows these WITH the window and never
       * behind a disclosure: an exception that widens the law is the one a
       * hunter is most likely to be wrongly denied by, and one that narrows it
       * is the one they can be charged under.
       */
      exceptions?: LegalTimeException[];
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
      /**
       * The language `reason` is written in, and whose words it is.
       *
       * Absent means North Ground's own English — which is what every one of
       * these was until Québec put the ministry's own wild-turkey sentence
       * here: « La chasse est permise à partir d'une demi-heure avant le lever
       * du soleil jusqu'à midi. » A LEGAL-HOURS ANSWER, rendered in a language
       * the reader may not have, with nothing saying whose words they were.
       * Declared by the producer; never detected at render.
       */
      reasonLang?: LimitationLang;
      reasonOwner?: "AUTHORITY" | "NORTH_GROUND";
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
  timezone: PointTimeZone | undefined,
): LegalTimeResult {
  /*
   * A WINDOW IS A WALL-CLOCK TIME, SO WITHOUT A ZONE THERE IS NO WINDOW.
   *
   * `timezone` is branded, so the compiler stops an ordinary string — but a
   * caller holding `PointTimeZone | undefined` from `timeZoneAtPoint` can pass
   * the undefined through, and every jurisdiction that resolves its own zone
   * holds exactly that. Until now the guard lived in each CALLER, which is the
   * arrangement where the next jurisdiction to be wired up inherits the bug.
   *
   * Handed nothing, this computed against UTC and returned RESOLVED: British
   * Columbia rendered "09:35 to 22:20 (undefined)", a thirteen-hour window
   * telling a hunter it is lawful to shoot until 22:20. It read as an answer,
   * not as an error, which is the failure this whole module is built to avoid.
   */
  if (!timezone) {
    return legalTimeNotCertified(
      "North Ground cannot state a legal hunting window without the timezone at the hunt location, because the " +
        "window is a wall-clock time.",
      "North Ground",
      rule.sourceId,
    );
  }

  const [year, month, day] = date.split("-").map(Number);

  if (rule.basis === "AUTHORITY_TABLE") {
    /* Read, never computed. Placed here, above every solar term, so there is
       no path from a table-based jurisdiction into our astronomy. */
    const row = rule.rows.find((entry) =>
      entry.from <= date && date <= entry.to && (rule.area === undefined || entry.area === rule.area));
    if (!row) {
      /* The authority publishes a table and it does not cover this date. That
         is an answer about the table, not a licence to calculate one: §8's
         "could not find" is never "there is none". */
      return legalTimeNotCertified(
        `${rule.section} states legal hunting hours as a published table${rule.area ? ` for ${rule.area}` : ""}, ` +
          `and North Ground has not read a row covering ${date}. The authority's own table is the law here, so no ` +
          "window is computed from sunrise and sunset.",
        "North Ground",
        rule.sourceId,
      );
    }
    return {
      status: "RESOLVED",
      basis: rule.basis,
      window: { opensAt: row.opensAt, closesAt: row.closesAt },
      timezone, date, statedAs: rule.statedAs, section: rule.section, sourceId: rule.sourceId,
      /* No solar term was evaluated, so there is no solar uncertainty to
         absorb; the margin would be a claim about arithmetic we did not do. */
      precision: { marginMinutes: 0, appliedInward: true, algorithm: "none" },
    };
  }

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
  /*
   * THE CLOCK IS RENDERED IN THE ZONE THE LAW REQUIRES, which is not always the
   * one the platform's tzdata implements. Manitoba's permanent daylight time
   * arrived faster than the tz database; rendering in `timezone` printed every
   * Manitoba window an hour early from 1 November 2026. See `observed-clock.ts`.
   *
   * The date comparison below uses the same zone deliberately: a window whose
   * clock came from one basis and whose date check came from another would
   * disagree with itself at the midnight boundary.
   */
  const clockZone = renderingZone(timezone, date);
  const override = observedClockOverride(timezone, date);

  if (localDate(solar.sunrise, clockZone) !== date || localDate(solar.sunset, clockZone) !== date) {
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
  const opensAt = shift(wallClock(solar.sunrise, clockZone), -before + SOLAR_UNCERTAINTY_MINUTES);
  /*
   * A closing the regulation names as a clock time carries NO solar margin —
   * it is not a solar term, so there is nothing to be uncertain about. Only the
   * sunrise end is nudged inward.
   */
  const closesAt = rule.basis === "SUNRISE_OFFSET_TO_FIXED_CLOSE"
    ? rule.closesAt
    : shift(wallClock(solar.sunset, clockZone), after - SOLAR_UNCERTAINTY_MINUTES);

  return {
    status: "RESOLVED",
    basis: rule.basis,
    window: { opensAt, closesAt },
    /* The point's own zone is what a reader is told; the override says whose
       say-so the clock came from, so a divergence is never silent. */
    ...(override
      ? {
        observedClock: {
          status: "SAME_AS_STATUTORY" as const,
          statedAs: `${override.authority}: ${override.statedAs} The platform's own timezone data does not yet carry this, so North Ground renders the clock at the offset the authority states (${override.sourceUrl}).`,
        },
      }
      : {}),
    timezone, date, statedAs: rule.statedAs, section: rule.section, sourceId: rule.sourceId,
    precision: {
      marginMinutes: SOLAR_UNCERTAINTY_MINUTES,
      appliedInward: true,
      algorithm: SOLAR_ALGORITHM_VERSION,
    },
  };
}

/** The honest answer where the point's timezone cannot be established. */
export function legalTimeNotCertified(
  reason: string,
  authority: string,
  sourceId?: CanonicalId<"source">,
  /** Supplied where `reason` is not North Ground's own English. */
  words?: { lang: LimitationLang; owner: "AUTHORITY" | "NORTH_GROUND" },
): LegalTimeResult {
  return {
    status: "NOT_CERTIFIED",
    reason,
    authority,
    ...(sourceId ? { sourceId } : {}),
    ...(words ? { reasonLang: words.lang, reasonOwner: words.owner } : {}),
  };
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
