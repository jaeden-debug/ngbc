import type { IsoDate } from "../../content-contract/index.ts";

/**
 * Where the law has outrun the platform's timezone data.
 *
 * THE DEFECT THIS EXISTS FOR, measured on production 2026-09-30. Manitoba moved
 * to PERMANENT daylight saving time — announced by the province on 17 September
 * 2026, "Manitobans' clocks will not revert to standard time on Nov. 1" — while
 * the runtime's tzdata still switches `America/Winnipeg` to CST on that date.
 * Legal hunting hours there are solar, so the instant was right and the CLOCK
 * WE PRINTED WAS AN HOUR EARLY: Winnipeg, 20 November 2026, white-tailed deer,
 * we said shooting opens at 07:21 when the law permits 08:21.
 *
 * That is the unsafe direction. A hunter reading our answer would have been in
 * the field with a rifle an hour before it was legal, in the middle of deer
 * season, on the live map. The province's own guide added a warning about
 * exactly this failure on page 14 of its 25 September reissue, which is how it
 * surfaced.
 *
 * WHY AN OVERRIDE RATHER THAN WAITING FOR TZDATA. A deployment's tz database is
 * whatever its runtime shipped with, and North Ground does not control when it
 * is updated. A legal answer may not wait on a dependency's release cycle.
 *
 * THE INSTRUMENT, AND WHY IT TOOK THREE READINGS TO GET RIGHT. The fix shipped
 * on a press release, which was the right call at the time — the failure was
 * live and asymmetric. Establishing the instrument afterwards went wrong twice
 * before it went right, and both errors are worth keeping:
 *
 *   - C.C.S.M. c. O70 is the OPTOMETRY Act. The Official Time Act is c. O30.
 *   - The consolidation (current to 26 Sept 2026) shows S.M. 2023, c. 4 as "not
 *     yet proclaimed", and a private member's bill fixing its commencement at
 *     8 March 2026 looked like the answer — but Bill 223 (43-2) is recorded in
 *     the House's own status table as NOT PROCEEDED WITH. It never became law.
 *
 * The real instrument is a proclamation, and it is in Manitoba's proclamations
 * table rather than in either the statute or the news: signed 23 September 2026,
 * naming 31 October 2026. A consolidation current to 26 September could not show
 * an Act that comes into force on 31 October, so nothing was ever stale — the
 * reading was.
 *
 * WHY IT MUST EXPIRE ON EVIDENCE RATHER THAN ON A DATE. When tzdata does catch
 * up, an override that keeps forcing an offset is right by coincidence and
 * wrong the moment anything else changes. So each entry records the offset the
 * LAW requires, `tzdataAgrees` compares that against what the platform actually
 * does, and a test fails when they converge — telling a human to delete the
 * entry instead of letting two sources of truth drift apart silently.
 */

export interface ObservedClockOverride {
  /** The IANA zone whose data is behind the law. */
  timeZone: string;
  /**
   * From this date, inclusive — the first date on which the law and the
   * platform's data DISAGREE.
   *
   * Deliberately not the same as `inForce`. Manitoba's Act came into force on
   * 31 October 2026, and on that date tzdata still said daylight time, so the
   * two agreed and no override was needed. They part on 1 November, the day
   * tzdata falls back and the law does not. Collapsing the two would attach a
   * legal date to an arithmetic fact, and the next reader would not be able to
   * tell which one the number was.
   */
  from: IsoDate;
  /** When the instrument itself took effect. */
  inForce: IsoDate;
  /** The instrument, not a description of it. */
  instrument: string;
  /** How the instrument's date was established. */
  commencement: string;
  /** When a person last checked this against the authority, not against a summary. */
  verifiedAgainstAuthority: IsoDate;
  /**
   * A fixed-offset IANA zone that renders what the law requires.
   *
   * `Etc/GMT+5` is UTC−5 — the POSIX sign convention is inverted, which is a
   * trap worth naming rather than discovering. UTC−5 year-round is permanent
   * Central daylight time.
   */
  renderAs: string;
  /** Minutes from UTC the law requires, for comparing against the platform. */
  offsetMinutes: number;
  authority: string;
  statedAs: string;
  sourceUrl: string;
}

export const OBSERVED_CLOCK_OVERRIDES: readonly ObservedClockOverride[] = [
  {
    timeZone: "America/Winnipeg",
    from: "2026-11-01" as IsoDate,
    inForce: "2026-10-31" as IsoDate,
    instrument: "The Official Time Amendment Act, S.M. 2023, c. 4, amending The Official Time Act, C.C.S.M. c. O30",
    commencement:
      "Brought into force by proclamation signed 23 September 2026 by the Lieutenant Governor, naming 31 October 2026.",
    renderAs: "Etc/GMT+5",
    offsetMinutes: -300,
    authority: "Lieutenant Governor of Manitoba, in Council",
    statedAs:
      "With the advice and consent of the Executive Council of Manitoba, we name October 31, 2026, as the day on which The Official Time Amendment Act (S.M. 2023, c. 4) comes into force.",
    sourceUrl: "https://web2.gov.mb.ca/laws/statutes/proclamations/2023c4(2026-10-31).php",
    verifiedAgainstAuthority: "2026-09-30" as IsoDate,
  },
  {
    /*
     * ALBERTA, found by the sweep rather than by a report — and not yet wrong.
     * Our own output shows the step: Edmonton opens at 08:03 on 31 October and
     * 07:05 on 1 November, which is an hour of clock, not an hour of sun.
     * Fixed 32 days before it would have reached a hunter, in a province whose
     * big-game seasons run through November.
     */
    timeZone: "America/Edmonton",
    from: "2026-11-01" as IsoDate,
    inForce: "2026-06-18" as IsoDate,
    instrument:
      "Red Tape Reduction Statutes Amendment Act, 2026, SA 2026 c. 12, s. 3, amending the Daylight Saving Time Act, RSA 2000 c. D-5",
    commencement:
      "Sections 3, 5(3) to (8) and 11 proclaimed in force 18 June 2026. Alberta keeps UTC-6 year-round as Alberta Time, so clocks do not return to Mountain Standard Time on 1 November 2026.",
    renderAs: "Etc/GMT+6",
    offsetMinutes: -360,
    authority: "Government of Alberta",
    statedAs:
      "Beginning in November 2026, clocks will no longer reset to Mountain Standard Time, and Alberta will remain on Alberta Time year-round.",
    sourceUrl: "https://www.alberta.ca/albertas-new-time-system-abt",
    verifiedAgainstAuthority: "2026-09-30" as IsoDate,
  },
];

/** The override in force for a zone on a date, if any. */
export function observedClockOverride(timeZone: string, date: IsoDate): ObservedClockOverride | null {
  return OBSERVED_CLOCK_OVERRIDES.find((entry) => entry.timeZone === timeZone && date >= entry.from) ?? null;
}

/**
 * The zone to RENDER a clock in — the override where one applies, otherwise the
 * point's own zone.
 *
 * Every consumer that turns an instant into a clock time goes through this. The
 * point's real zone is still what the answer reports to a reader; this decides
 * only the arithmetic.
 */
export function renderingZone(timeZone: string, date: IsoDate): string {
  return observedClockOverride(timeZone, date)?.renderAs ?? timeZone;
}

/** What the platform's own tzdata does for a zone on a date, in minutes from UTC. */
export function platformOffsetMinutes(timeZone: string, date: IsoDate): number {
  /* Noon UTC, so the answer cannot land on a transition hour. */
  const instant = new Date(`${date}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "longOffset",
  }).formatToParts(instant);
  const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+00:00";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/**
 * Whether the platform now does what the law says, making an override
 * unnecessary.
 *
 * A test asserts this is FALSE for every live override. When it turns true the
 * test fails and someone deletes the entry — which is the only way an override
 * stops being a second, silent source of truth.
 */
export function tzdataAgrees(entry: ObservedClockOverride): boolean {
  return platformOffsetMinutes(entry.timeZone, entry.from) === entry.offsetMinutes;
}
