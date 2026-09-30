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
  /** From this date, inclusive. */
  from: IsoDate;
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
    renderAs: "Etc/GMT+5",
    offsetMinutes: -300,
    authority: "Government of Manitoba",
    statedAs:
      "This change means Manitobans' clocks will not revert to standard time on Nov. 1.",
    sourceUrl: "https://news.gov.mb.ca/news/index.html?item=75397",
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
