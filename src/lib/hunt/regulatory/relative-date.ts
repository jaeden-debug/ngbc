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
  | { kind: "WEEKDAY_BEFORE_NTH"; weekday: number; nth: number; anchorWeekday: number; month: number }
  /**
   * "the Saturday closest to October 8" — Ontario's most common anchor, and a
   * form no other authority read so far uses.
   *
   * No tie is possible, and that is a property of the week rather than an
   * assumption: the two distances are d and 7 − d for d in 0…6, equal only at
   * 3.5. A tie-break rule here would be dead code impersonating a decision.
   */
  | { kind: "WEEKDAY_CLOSEST_TO"; weekday: number; month: number; day: number }
  /**
   * "the Friday preceding <anchor>", "the Monday next following <anchor>",
   * "the second Sunday next following <anchor>".
   *
   * The general form, whose anchor is any other expression — which is what
   * Ontario needs and what the earlier `WEEKDAY_AFTER_NTH` /
   * `WEEKDAY_BEFORE_NTH` / `FIRST_WEEKDAY_AFTER_DATE` kinds are each a fixed
   * case of. Those three keep their names so no certified federal record
   * changes shape, and all four now resolve through one piece of arithmetic
   * (`weekdayFrom`): a second implementation of "the Friday before X" is the
   * two-homes-for-one-fact defect that has cost this repository five wrong
   * answers, and it would cost this one a season boundary.
   */
  | { kind: "WEEKDAY_FROM"; weekday: number; direction: "AFTER" | "BEFORE"; occurrence: number; anchor: RelativeDate }
  /**
   * "Labour Day", "Thanksgiving Monday" — named in Ontario's own tables.
   *
   * Only the two the authority names, and only with Canadian definitions:
   * Labour Day is the first Monday in September, Thanksgiving Monday the
   * second Monday in October. The United States keeps Thanksgiving in
   * November, so a shared "THANKSGIVING" token would be a wrong season the
   * first time a U.S. jurisdiction is read.
   */
  | { kind: "NAMED_DAY"; named: "LABOUR_DAY" | "THANKSGIVING_MONDAY" }
  /**
   * "to the Friday next following", "to the second Sunday next following",
   * "to the following Sunday" — an end whose anchor is the window's OWN START.
   *
   * Ontario writes this wherever the season is a fixed number of days from
   * whenever it opens: "From the Monday next following November 28 to the
   * Friday next following" is that Monday's own week. The anchor is not in the
   * text because the text already said it.
   *
   * IT CANNOT RESOLVE ALONE, by construction: `resolveRelativeDate` returns
   * null for it, and only `resolveRelativeWindow` can answer, because only a
   * window knows where it started. That is stricter than carrying a nullable
   * anchor around, and it makes the impossible call a type-level dead end
   * rather than a runtime surprise.
   */
  | { kind: "WEEKDAY_FROM_START"; weekday: number; occurrence: number }
  /**
   * "From October 1 to 4" — an end that is a day number in the start's month.
   *
   * Only ever an end, and only ever where the start named the month.
   */
  | { kind: "DAY_IN_START_MONTH"; day: number };

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

  /* ── Ontario's forms (O. Reg. 670/98) ──────────────────────────────────── */

  const named = /^(Labour Day|Thanksgiving Monday)$/i.exec(value);
  if (named) {
    return { kind: "NAMED_DAY", named: /labour/i.test(named[1]) ? "LABOUR_DAY" : "THANKSGIVING_MONDAY" };
  }

  const closestTo = /^the ([A-Z][a-z]+) closest to ([A-Z][a-z]+) (\d{1,2})$/i.exec(value);
  if (closestTo) {
    const [, weekday, month, day] = closestTo;
    if (weekdayOf(weekday) >= 0 && monthOf(month) > 0) {
      return { kind: "WEEKDAY_CLOSEST_TO", weekday: weekdayOf(weekday), month: monthOf(month), day: Number(day) };
    }
  }

  /*
   * "the Friday preceding X", "the Monday next following X", "the second
   * Sunday next following X", "the Sunday immediately prior to X".
   *
   * The anchor is parsed recursively, which is the whole reason this form
   * exists: Ontario nests — "the Friday preceding THE SATURDAY CLOSEST TO
   * OCTOBER 8" — and a flat grammar would need one rule per combination.
   *
   * "following" was deliberately refused by the earlier grammar because no
   * verified window needed it and accepting it would have carried an
   * unverified reading. This wave needs it, so it is verified here: every
   * Ontario form below is checked against the ministry's own 2026 summary in
   * `ontario-relative-date.test.ts`.
   */
  const relative = /^the (?:(first|second|third|fourth) )?([A-Z][a-z]+) (preceding|prior to|immediately prior to|next following|following) (.+)$/i.exec(value);
  if (relative) {
    const [, ordinal, weekday, operator, anchorText] = relative;
    const anchor = parseRelativeDate(anchorText);
    if (weekdayOf(weekday) >= 0 && anchor) {
      return {
        kind: "WEEKDAY_FROM",
        weekday: weekdayOf(weekday),
        direction: /following/i.test(operator) ? "AFTER" : "BEFORE",
        occurrence: ordinal ? ORDINALS[ordinal.toLowerCase()] : 1,
        anchor,
      };
    }
  }

  /*
   * Ends whose anchor is the window's own start. Matched last, because each of
   * them is a suffix of a form that CAN stand alone and a looser rule earlier
   * would swallow "the Friday preceding the Saturday closest to October 8".
   */
  const fromStart = /^the (?:(first|second|third|fourth) )?([A-Z][a-z]+) (?:next )?following$/i.exec(value)
    ?? /^the (?:next )?following ([A-Z][a-z]+)$/i.exec(value)
    ?? /^the (?:(first|second|third|fourth) )?(?:next )?following ([A-Z][a-z]+)$/i.exec(value);
  if (fromStart) {
    /* The one-group form puts the weekday in [1]; the two-group form in [2]. */
    const weekday = fromStart[2] ?? fromStart[1];
    const ordinal = fromStart[2] ? fromStart[1] : undefined;
    if (weekdayOf(weekday) >= 0) {
      return { kind: "WEEKDAY_FROM_START", weekday: weekdayOf(weekday), occurrence: ordinal ? ORDINALS[ordinal.toLowerCase()] : 1 };
    }
  }

  const dayOnly = /^(\d{1,2})$/.exec(value);
  if (dayOnly) return { kind: "DAY_IN_START_MONTH", day: Number(dayOnly[1]) };

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

/**
 * The nth given weekday strictly before or strictly after an anchor.
 *
 * STRICTLY. "The Friday preceding the Saturday closest to October 8" is a
 * different day from that Saturday even in the years the anchor is itself a
 * Friday, and "next following" never means "the same day". An inclusive
 * reading moves the season by a week in one year out of seven and looks
 * correct in the other six — which is why `|| 7` is here rather than a `%`
 * that can return zero.
 */
function weekdayFrom(anchor: Date, weekday: number, direction: "AFTER" | "BEFORE", occurrence: number): Date {
  const step = direction === "AFTER"
    ? ((weekday - anchor.getUTCDay() + 7) % 7) || 7
    : ((anchor.getUTCDay() - weekday + 7) % 7) || 7;
  const days = step + (occurrence - 1) * 7;
  return new Date(anchor.getTime() + (direction === "AFTER" ? days : -days) * 86_400_000);
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
      const anchor = utc(year, expression.month, expression.day);
      if (anchor.getUTCMonth() !== expression.month - 1) return null;
      return iso(weekdayFrom(anchor, expression.weekday, "AFTER", 1));
    }
    case "WEEKDAY_AFTER_NTH": {
      const anchor = nthWeekday(year, expression.month, expression.anchorWeekday, expression.nth);
      return anchor ? iso(weekdayFrom(anchor, expression.weekday, "AFTER", 1)) : null;
    }
    case "WEEKDAY_BEFORE_NTH": {
      const anchor = nthWeekday(year, expression.month, expression.anchorWeekday, expression.nth);
      return anchor ? iso(weekdayFrom(anchor, expression.weekday, "BEFORE", 1)) : null;
    }
    case "WEEKDAY_CLOSEST_TO": {
      const anchor = utc(year, expression.month, expression.day);
      if (anchor.getUTCMonth() !== expression.month - 1) return null;
      const forward = (expression.weekday - anchor.getUTCDay() + 7) % 7;
      return iso(new Date(anchor.getTime() + (forward <= 3 ? forward : forward - 7) * 86_400_000));
    }
    case "NAMED_DAY": {
      const anchor = expression.named === "LABOUR_DAY"
        ? nthWeekday(year, 9, 1, 1)   /* first Monday in September */
        : nthWeekday(year, 10, 1, 2); /* second Monday in October, in Canada */
      return anchor ? iso(anchor) : null;
    }
    case "WEEKDAY_FROM_START":
    case "DAY_IN_START_MONTH":
      /* Answerable only inside a window; see the kind's own note. */
      return null;
    case "WEEKDAY_FROM": {
      const anchorIso = resolveRelativeDate(expression.anchor, year);
      if (!anchorIso) return null;
      const anchor = new Date(`${anchorIso}T00:00:00Z`);
      return iso(weekdayFrom(anchor, expression.weekday, expression.direction, expression.occurrence));
    }
  }
}

/**
 * The month an expression sits in.
 *
 * Not every form names one any more. A nested expression takes its anchor's
 * month, which is the month the window is ABOUT even when the resolved day
 * falls just outside it — "the Friday preceding the Saturday closest to
 * October 8" can land in September, and reporting September would make
 * `crossesYear` wrong for a window that does not cross anything. The named
 * holidays carry the month the authority puts them in.
 */
export function monthOfExpression(expression: RelativeDate): number {
  switch (expression.kind) {
    case "WEEKDAY_FROM": return monthOfExpression(expression.anchor);
    case "NAMED_DAY": return expression.named === "LABOUR_DAY" ? 9 : 10;
    /* Both take the start's month, so a window using one never crosses a year
       by arithmetic it cannot see. `parseRelativeWindow` gives them the start's
       month, and 0 here would make every such window look like it crossed. */
    case "WEEKDAY_FROM_START":
    case "DAY_IN_START_MONTH": return 0;
    default: return expression.month;
  }
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
 * THE SPLIT CANNOT BE THE FIRST " to ", because Ontario's own operators
 * contain one: "the Saturday CLOSEST TO September 17 to December 15" and "the
 * Sunday immediately PRIOR TO the first Monday in November". Splitting at the
 * first separator cut those inside the operator and refused fourteen real
 * season phrases as unreadable.
 *
 * So every " to " is tried, in order, and the first split where BOTH halves
 * parse whole is the answer. That keeps the property the original rule was
 * protecting rather than the mechanism it used: a trailing qualifier — "(only
 * on farmland)", ", for Ducks other than Eiders" — still fails every candidate
 * split, because no split makes the qualifier parse as a date. The dates in
 * such a row are right only for some hunters, some land or some birds, and the
 * dates being readable must not make the row encodable.
 *
 * Left-to-right matters: it takes the EARLIEST valid reading, so a phrase that
 * could be cut two ways is read the way it is written rather than the way that
 * happens to parse last.
 */
export function parseRelativeWindow(text: string): RelativeWindow | null {
  const value = text.trim().replace(/\s+/g, " ");

  for (let at = value.indexOf(" to "); at >= 0; at = value.indexOf(" to ", at + 1)) {
    const from = parseRelativeDate(value.slice(0, at));
    if (!from) continue;
    const to = parseRelativeDate(value.slice(at + 4));
    if (!to) continue;

    /* An end anchored to the start is in the start's own month by definition,
       so it can never be read as crossing the year. */
    const endMonth = monthOfExpression(to);
    const crossesYear = endMonth > 0 && endMonth < monthOfExpression(from);
    return { from, to, crossesYear, statedAs: value };
  }
  return null;
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
  if (!from) return null;

  /*
   * The two start-anchored ends are resolved HERE and only here, because the
   * anchor they need is the day just computed above. Doing it inside
   * `resolveRelativeDate` would mean passing an optional anchor into every
   * form that does not want one — and an optional parameter that is mandatory
   * for two cases is the kind of quiet precondition that eventually goes
   * unpassed.
   */
  if (window.to.kind === "WEEKDAY_FROM_START") {
    const start = new Date(`${from}T00:00:00Z`);
    return { from, to: iso(weekdayFrom(start, window.to.weekday, "AFTER", window.to.occurrence)) };
  }
  if (window.to.kind === "DAY_IN_START_MONTH") {
    const [, month] = from.split("-");
    const end = utc(Number(from.slice(0, 4)), Number(month), window.to.day);
    /* "From October 1 to 4" going backwards would be a season that ends before
       it begins; the authority does not write one, so it is refused. */
    return end.getUTCMonth() + 1 === Number(month) && iso(end) >= from ? { from, to: iso(end) } : null;
  }

  const to = resolveRelativeDate(window.to, window.crossesYear ? year + 1 : year);
  return to ? { from, to } : null;
}
