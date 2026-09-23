/**
 * Dates the regulation writes as rules rather than as calendar days.
 *
 * "The first Saturday after the first Monday in October to the first Sunday
 * after January 19" is how British Columbia in particular writes a waterfowl
 * season, and 57 federal rules were refused for it.
 *
 * A RELATIVE DATE IS NOT STORED AS A CALENDAR DAY. It resolves to a different
 * day each year, so computing it once and storing month and day would be right
 * for one season and quietly wrong for the next — a plausible wrong date, and
 * a season that starts a week early is a hunter hunting out of season with an
 * answer that looked fine. The expression is stored; the day is computed for
 * the year in hand.
 *
 * ONLY OPERATORS THE AUTHORITY CONFIRMED. "after", "before", and the month
 * prepositions "in" and "of" each appear in a window whose computed date was
 * checked against Environment and Climate Change Canada's own published
 * summary (scripts/certify-relative-dates.mjs). "following" does not: every
 * Schedule 3 row that uses it is refused for a unit list, so widening the
 * grammar to accept it bought no verified coverage and carried an unverified
 * reading. It is refused, and the wave that needs it verifies it then.
 *
 * REFUSE RATHER THAN GUESS. Only the forms below are parsed, and anything else
 * — including a form that merely LOOKS like one — returns null so the caller
 * keeps it in the counted refusals. "The first Sunday after January 19" and
 * "the first Sunday on or after January 19" differ by up to seven days and
 * read almost identically; a nearest-match would pick one.
 *
 * NO ROUNDING, EITHER WAY. Where a date cannot be computed the answer is
 * UNKNOWN, never a date nudged somewhere safe. A season is a two-ended fact
 * and there is no safe direction to move it — unlike a legal-time window,
 * where narrowing genuinely is safer.
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDINALS: Readonly<Record<string, number>> = { first: 1, second: 2, third: 3, fourth: 4 };

export type RelativeDate =
  /** "October 10" — already a calendar day; carried so a range can mix forms. */
  | { kind: "CALENDAR"; month: number; day: number }
  /** "the first Saturday in September" */
  | { kind: "NTH_WEEKDAY_IN_MONTH"; nth: number; weekday: number; month: number }
  /** "the last Saturday of September" */
  | { kind: "LAST_WEEKDAY_IN_MONTH"; weekday: number; month: number }
  /** "the first Saturday after October 10" — strictly after. */
  | { kind: "FIRST_WEEKDAY_AFTER_DATE"; weekday: number; month: number; day: number }
  /** "the Tuesday after the second Saturday in September" */
  | { kind: "WEEKDAY_AFTER_NTH"; weekday: number; nth: number; anchorWeekday: number; month: number }
  /** "the Saturday before the third Sunday in October" */
  | { kind: "WEEKDAY_BEFORE_NTH"; weekday: number; nth: number; anchorWeekday: number; month: number };

const monthOf = (name: string) => MONTHS.indexOf(name) + 1;
const weekdayOf = (name: string) => WEEKDAYS.indexOf(name);

/**
 * Parse one date expression, or null.
 *
 * Null is not a failure to try harder: it is the signal that this expression
 * belongs in the counted refusals.
 */
export function parseRelativeDate(text: string): RelativeDate | null {
  const value = text.trim().replace(/\s+/g, " ");

  const calendar = /^([A-Z][a-z]+) (\d{1,2})$/.exec(value);
  if (calendar && monthOf(calendar[1]) > 0) {
    return { kind: "CALENDAR", month: monthOf(calendar[1]), day: Number(calendar[2]) };
  }

  const weekdayAfterNth = /^the ([A-Z][a-z]+) after the (first|second|third|fourth) ([A-Z][a-z]+) (?:in|of) ([A-Z][a-z]+)$/i.exec(value);
  if (weekdayAfterNth) {
    const [, weekday, ordinal, anchor, month] = weekdayAfterNth;
    if (weekdayOf(weekday) >= 0 && weekdayOf(anchor) >= 0 && monthOf(month) > 0) {
      return {
        kind: "WEEKDAY_AFTER_NTH", weekday: weekdayOf(weekday),
        nth: ORDINALS[ordinal.toLowerCase()], anchorWeekday: weekdayOf(anchor), month: monthOf(month),
      };
    }
  }

  const weekdayBeforeNth = /^the ([A-Z][a-z]+) before the (first|second|third|fourth) ([A-Z][a-z]+) (?:in|of) ([A-Z][a-z]+)$/i.exec(value);
  if (weekdayBeforeNth) {
    const [, weekday, ordinal, anchor, month] = weekdayBeforeNth;
    if (weekdayOf(weekday) >= 0 && weekdayOf(anchor) >= 0 && monthOf(month) > 0) {
      return {
        kind: "WEEKDAY_BEFORE_NTH", weekday: weekdayOf(weekday),
        nth: ORDINALS[ordinal.toLowerCase()], anchorWeekday: weekdayOf(anchor), month: monthOf(month),
      };
    }
  }

  /* "the first Saturday after the first Monday in October" — the anchor is an
     nth weekday, so it is the same shape as above with an ordinal in front. */
  const firstWeekdayAfterNth = /^the first ([A-Z][a-z]+) after the (first|second|third|fourth) ([A-Z][a-z]+) (?:in|of) ([A-Z][a-z]+)$/i.exec(value);
  if (firstWeekdayAfterNth) {
    const [, weekday, ordinal, anchor, month] = firstWeekdayAfterNth;
    if (weekdayOf(weekday) >= 0 && weekdayOf(anchor) >= 0 && monthOf(month) > 0) {
      return {
        kind: "WEEKDAY_AFTER_NTH", weekday: weekdayOf(weekday),
        nth: ORDINALS[ordinal.toLowerCase()], anchorWeekday: weekdayOf(anchor), month: monthOf(month),
      };
    }
  }

  const firstAfterDate = /^the first ([A-Z][a-z]+) after ([A-Z][a-z]+) (\d{1,2})$/i.exec(value);
  if (firstAfterDate) {
    const [, weekday, month, day] = firstAfterDate;
    if (weekdayOf(weekday) >= 0 && monthOf(month) > 0) {
      return { kind: "FIRST_WEEKDAY_AFTER_DATE", weekday: weekdayOf(weekday), month: monthOf(month), day: Number(day) };
    }
  }

  const nthInMonth = /^the (first|second|third|fourth) ([A-Z][a-z]+) (?:in|of) ([A-Z][a-z]+)$/i.exec(value);
  if (nthInMonth) {
    const [, ordinal, weekday, month] = nthInMonth;
    if (weekdayOf(weekday) >= 0 && monthOf(month) > 0) {
      return { kind: "NTH_WEEKDAY_IN_MONTH", nth: ORDINALS[ordinal.toLowerCase()], weekday: weekdayOf(weekday), month: monthOf(month) };
    }
  }

  const lastInMonth = /^the last ([A-Z][a-z]+) (?:of|in) ([A-Z][a-z]+)$/i.exec(value);
  if (lastInMonth) {
    const [, weekday, month] = lastInMonth;
    if (weekdayOf(weekday) >= 0 && monthOf(month) > 0) {
      return { kind: "LAST_WEEKDAY_IN_MONTH", weekday: weekdayOf(weekday), month: monthOf(month) };
    }
  }

  return null;
}

const utc = (year: number, month: number, day: number) => new Date(Date.UTC(year, month - 1, day));
const iso = (date: Date) => date.toISOString().slice(0, 10);

/** The nth given weekday in a month, or null where the month has no nth. */
function nthWeekday(year: number, month: number, weekday: number, nth: number): Date | null {
  const first = utc(year, month, 1);
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  const date = utc(year, month, day);
  return date.getUTCMonth() === month - 1 ? date : null;
}

/** Resolve an expression to a calendar day in a given year, or null. */
export function resolveRelativeDate(expression: RelativeDate, year: number): string | null {
  switch (expression.kind) {
    case "CALENDAR": {
      const date = utc(year, expression.month, expression.day);
      return date.getUTCMonth() === expression.month - 1 ? iso(date) : null;
    }
    case "NTH_WEEKDAY_IN_MONTH": {
      const date = nthWeekday(year, expression.month, expression.weekday, expression.nth);
      return date ? iso(date) : null;
    }
    case "LAST_WEEKDAY_IN_MONTH": {
      /* Walk back from the last day of the month. */
      const last = utc(year, expression.month + 1, 0);
      const back = (last.getUTCDay() - expression.weekday + 7) % 7;
      return iso(utc(year, expression.month, last.getUTCDate() - back));
    }
    case "FIRST_WEEKDAY_AFTER_DATE": {
      /* STRICTLY after: where the named date is itself that weekday, the
         answer is the following week, not the same day. */
      const anchor = utc(year, expression.month, expression.day);
      if (anchor.getUTCMonth() !== expression.month - 1) return null;
      const ahead = ((expression.weekday - anchor.getUTCDay() + 7) % 7) || 7;
      return iso(new Date(anchor.getTime() + ahead * 86_400_000));
    }
    case "WEEKDAY_AFTER_NTH": {
      const anchor = nthWeekday(year, expression.month, expression.anchorWeekday, expression.nth);
      if (!anchor) return null;
      const ahead = ((expression.weekday - anchor.getUTCDay() + 7) % 7) || 7;
      return iso(new Date(anchor.getTime() + ahead * 86_400_000));
    }
    case "WEEKDAY_BEFORE_NTH": {
      const anchor = nthWeekday(year, expression.month, expression.anchorWeekday, expression.nth);
      if (!anchor) return null;
      const back = ((anchor.getUTCDay() - expression.weekday + 7) % 7) || 7;
      return iso(new Date(anchor.getTime() - back * 86_400_000));
    }
  }
}

/** The month an expression sits in — every form names exactly one. */
export function monthOfExpression(expression: RelativeDate): number {
  return expression.month;
}

export type RelativeWindow = {
  from: RelativeDate;
  to: RelativeDate;
  /** An end month before the start month puts the end in the next year. */
  crossesYear: boolean;
  statedAs: string;
};

/**
 * A season written as two expressions joined by " to ".
 *
 * Split at the FIRST " to " and require BOTH halves to parse whole. A trailing
 * qualifier — "(only on farmland)", "(only in Provincial Management Units 1-3
 * and 1-8 to 1-15)", ", for Ducks other than Eiders" — therefore refuses the
 * window, which is the point: the dates in such a row are right only for some
 * hunters, some land or some birds, and the date being readable must not make
 * the row encodable. Unit lists containing their own " to " are refused by the
 * same rule rather than by counting separators.
 */
export function parseRelativeWindow(text: string): RelativeWindow | null {
  const value = text.trim().replace(/\s+/g, " ");
  const split = value.indexOf(" to ");
  if (split < 0) return null;

  const from = parseRelativeDate(value.slice(0, split));
  const to = parseRelativeDate(value.slice(split + 4));
  if (!from || !to) return null;

  return { from, to, crossesYear: to.month < from.month, statedAs: value };
}

/**
 * A window's two calendar days for a season that OPENS in `year`.
 *
 * The end takes the following year where the window crosses it, so British
 * Columbia's "October 10 to January 24" is 2026-10-10 to 2027-01-24 and not
 * two days eleven months apart in one year.
 */
export function resolveRelativeWindow(
  window: RelativeWindow,
  year: number,
): { from: string; to: string } | null {
  const from = resolveRelativeDate(window.from, year);
  const to = resolveRelativeDate(window.to, window.crossesYear ? year + 1 : year);
  return from && to ? { from, to } : null;
}
