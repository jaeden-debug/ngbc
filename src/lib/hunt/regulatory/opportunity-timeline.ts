/**
 * "When can I hunt this" — the opportunities a hunter has, in time.
 *
 * THE RULE THAT SHAPES IT: group truly identical opportunities, and never merge
 * legally distinct ones because their dates overlap. `opportunityIdentity`
 * already keys on the legal facts with dates deliberately absent, so grouping
 * is that function's answer rather than a second opinion about it. This file
 * adds only what time does to a group.
 *
 * WHAT IT REFUSES TO SAY. A group whose last published window has passed is
 * **not** "closed" and not "over": the authority may simply not have published
 * next season's dates yet, and North Ground cannot tell those apart from the
 * windows it holds. So the state is named for what is known — no further
 * published window — and a renderer that wants to say "closed" has to get that
 * from the regulatory engine, which is the only thing entitled to say it.
 *
 * Dates are never reformatted or merged. Two adjacent windows the authority
 * published separately stay two windows; exact duplicates arriving from two
 * legally identical rules are shown once, which is not repeating rather than
 * combining.
 */

import {
  groupOpportunities, windowContains,
  type OpportunityWindow, type ResolvedOpportunity,
} from "./opportunity-row.ts";

/**
 * Where a group sits relative to the day being asked about.
 *
 * `NO_FURTHER_PUBLISHED_WINDOW` is deliberately long. "Closed" and "over" are
 * both claims about the law; this is a statement about the records North Ground
 * holds, and the difference matters most in the one place a hunter would act on
 * it — late in a season, when next year's dates are not out.
 */
export type TimelineState = "OPEN_ON_DATE" | "OPENS_LATER" | "NO_FURTHER_PUBLISHED_WINDOW";

export interface TimelineEntry {
  identity: string;
  /** Every row in the group. They differ only in their dates. */
  rows: readonly ResolvedOpportunity[];
  /** The published windows, sorted, de-duplicated, never merged or reformatted. */
  windows: readonly OpportunityWindow[];
  state: TimelineState;
  /** The next window that opens strictly after the date, where one is published. */
  nextOpens: string | null;
  /** The window containing the date, where one does. */
  openWindow: OpportunityWindow | null;
}

function sortedDistinct(windows: readonly OpportunityWindow[]): OpportunityWindow[] {
  const seen = new Map<string, OpportunityWindow>();
  for (const window of windows) {
    /* Keyed on the published bounds AND the inclusivity, because a window that
       excludes its closing day is a different window from one that includes it,
       however identical the two dates look. */
    seen.set(`${window.opens}\u0000${window.closes}\u0000${window.datesInclusive}`, window);
  }
  return [...seen.values()].sort((a, b) => (a.opens === b.opens ? a.closes.localeCompare(b.closes) : a.opens.localeCompare(b.opens)));
}

/**
 * The timeline for a set of rows, as at one day.
 *
 * Insertion order is preserved from `groupOpportunities`, which preserves the
 * engine's own ordering — the authority's table order — so what a hunter reads
 * is the order the ministry published rather than one North Ground imposed.
 */
export function opportunityTimeline(
  rows: readonly ResolvedOpportunity[],
  dateIso: string,
): TimelineEntry[] {
  return groupOpportunities(rows).map((group) => {
    const windows = sortedDistinct(group.windows);
    const openWindow = windows.find((window) => windowContains(window, dateIso)) ?? null;
    /* Strictly after: a window that opens ON the date is the one the hunter is
       already in, not the next one. */
    const nextOpens = windows.map((window) => window.opens).find((opens) => opens > dateIso) ?? null;
    const state: TimelineState = openWindow
      ? "OPEN_ON_DATE"
      : nextOpens
        ? "OPENS_LATER"
        : "NO_FURTHER_PUBLISHED_WINDOW";
    return { identity: group.identity, rows: group.rows, windows, state, nextOpens, openWindow };
  });
}

/**
 * The timeline ordered for reading: what is open, then what opens next, then
 * what has no further published window.
 *
 * Within a band the published order is kept. Sorting the whole list by date
 * would scatter a jurisdiction's own table across the screen, and sorting by
 * nothing would bury the one entry a hunter can act on today.
 */
const BAND: Record<TimelineState, number> = {
  OPEN_ON_DATE: 0,
  OPENS_LATER: 1,
  NO_FURTHER_PUBLISHED_WINDOW: 2,
};

export function readingOrder(entries: readonly TimelineEntry[]): TimelineEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const band = BAND[a.entry.state] - BAND[b.entry.state];
      if (band !== 0) return band;
      /* Within OPENS_LATER, the soonest first — that is the question the band
         is answering. Everywhere else, the authority's own order. */
      if (a.entry.state === "OPENS_LATER" && a.entry.nextOpens && b.entry.nextOpens) {
        const soonest = a.entry.nextOpens.localeCompare(b.entry.nextOpens);
        if (soonest !== 0) return soonest;
      }
      return a.index - b.index;
    })
    .map(({ entry }) => entry);
}
