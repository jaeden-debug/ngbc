/**
 * New Brunswick's ordinal date rules, derived rather than typed.
 *
 * Every window in Hunting Regulation s. 11(1) ends in the word "annually" and is
 * written as an ordinal over weekdays. Typing the ISO dates would lose the rule
 * and answer the next year wrongly; deriving them keeps both, which is what the
 * bundle stores.
 *
 * Exported separately from the builder so the derivation can be tested on its own
 * against dates the province publishes.
 */

const DAY = 86_400_000;
const utc = (y, m, d) => Date.UTC(y, m - 1, d);
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const dow = (ms) => new Date(ms).getUTCDay(); // 0 = Sunday

/** The nth given weekday in a month. `n` is 1-based. */
export function nthWeekdayOfMonth(year, month, weekday, n) {
  const first = utc(year, month, 1);
  const delta = (weekday - dow(first) + 7) % 7;
  return first + (delta + (n - 1) * 7) * DAY;
}

/** The last given weekday in a month. */
export function lastWeekdayOfMonth(year, month, weekday) {
  const nextMonth = month === 12 ? utc(year + 1, 1, 1) : utc(year, month + 1, 1);
  const last = nextMonth - DAY;
  return last - ((dow(last) - weekday + 7) % 7) * DAY;
}

/** The last day of a month, which is how "the last day in February" is read. */
export function lastDayOfMonth(year, month) {
  const nextMonth = month === 12 ? utc(year + 1, 1, 1) : utc(year, month + 1, 1);
  return nextMonth - DAY;
}

/**
 * The last week of a month that lies WHOLLY inside it, as [start, end].
 *
 * "the last full week of September" is the phrase New Brunswick uses for its
 * moose season and for two licence-expiry dates, and it does not say where a
 * week begins. Both conventions are computed and the caller asserts they agree,
 * because a silent disagreement would move the moose season by a day.
 */
export function lastFullWeek(year, month, weekStartsOn) {
  const first = utc(year, month, 1);
  const last = lastDayOfMonth(year, month);
  let start = first + ((weekStartsOn - dow(first) + 7) % 7) * DAY;
  let found = null;
  while (start + 6 * DAY <= last) {
    found = [start, start + 6 * DAY];
    start += 7 * DAY;
  }
  if (!found) throw new Error(`No full week in ${year}-${month}`);
  return found;
}

/** Both conventions, asserted to agree, then returned. */
export function lastFullWeekAgreed(year, month) {
  const sunday = lastFullWeek(year, month, 0);
  const monday = lastFullWeek(year, month, 1);
  /* Tue-Sat of the week is what the moose definition takes, and the Saturday
     before the week is what two other provisions take. Both are compared under
     both conventions, so agreement is checked on what is USED, not on the week's
     own bounds — the weeks themselves can differ by a day and still give the
     same Tuesday and the same preceding Saturday. */
  const tueSat = ([s]) => [s + ((2 - dow(s) + 7) % 7) * DAY, s + ((6 - dow(s) + 7) % 7) * DAY];
  const satBefore = ([s]) => s - ((dow(s) - 6 + 7) % 7 || 7) * DAY;
  const a = tueSat(sunday), b = tueSat(monday);
  if (iso(a[0]) !== iso(b[0]) || iso(a[1]) !== iso(b[1])) {
    throw new Error(`"last full week of ${year}-${month}" gives different Tue-Sat under the two week conventions: ${iso(a[0])}..${iso(a[1])} vs ${iso(b[0])}..${iso(b[1])}`);
  }
  if (iso(satBefore(sunday)) !== iso(satBefore(monday))) {
    throw new Error(`"the Saturday before the last full week of ${year}-${month}" differs under the two week conventions`);
  }
  return { tuesday: iso(a[0]), saturday: iso(a[1]), saturdayBefore: iso(satBefore(sunday)) };
}

export const isoOf = iso;
export const days = DAY;

/** `n` consecutive weeks beginning on `startMs`, as an inclusive ISO pair. */
export function consecutiveWeeks(startMs, weeks) {
  return { opensIso: iso(startMs), closesIso: iso(startMs + (weeks * 7 - 1) * DAY) };
}
