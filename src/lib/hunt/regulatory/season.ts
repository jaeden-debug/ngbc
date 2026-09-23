import { daysInMonth, isValidYmd, toIso } from "../date.ts";

/**
 * Open-season windows as the authority writes them.
 *
 * Ontario states seasons as month-and-day anchors inside a licence year —
 * "September 15 to December 31", "September 15 to March 31", "September 25 to the
 * last day of February". Three things in that make a naive implementation wrong:
 *
 *  - A window whose close precedes its open crosses into the next calendar year.
 *    Comparing month/day inside one year silently closes the season on 31
 *    December and reopens it on 1 January.
 *
 *  - "The last day of February" is not 28. Hard-coding it produces a defect that
 *    only appears in leap years, on exactly one day, four years after it ships.
 *
 *  - A summary describes its own licence year. For a season that crosses the year
 *    end, the January-to-March part of the SOURCE year belongs to the previous
 *    summary, which North Ground has not certified. Reporting CLOSED there would
 *    be asserting something the source does not say.
 */

export type SeasonAnchor =
  | { month: number; day: number }
  | { month: number; lastDay: true };

export interface SeasonWindow {
  opens: SeasonAnchor;
  closes: SeasonAnchor;
}

export type SeasonVerdict = "IN_SEASON" | "OUT_OF_SEASON" | "OUTSIDE_CERTIFIED_PERIOD";

export interface ResolvedWindow {
  opensIso: string;
  closesIso: string;
  crossesYear: boolean;
}

function anchorDay(anchor: SeasonAnchor, year: number): number {
  return "lastDay" in anchor ? daysInMonth(year, anchor.month) : anchor.day;
}

/** Month/day ordering, independent of any year. */
function anchorOrder(anchor: SeasonAnchor): number {
  // February's "last day" orders after every other February date, whatever the
  // year, so a common year and a leap year compare identically here.
  return anchor.month * 100 + ("lastDay" in anchor ? 99 : anchor.day);
}

export function crossesYear(window: SeasonWindow): boolean {
  return anchorOrder(window.closes) < anchorOrder(window.opens);
}

/**
 * Anchor a window to the licence year it is published for.
 *
 * `sourceYear` is the year the season opens in, so a crossing window closes in
 * `sourceYear + 1` and the closing day is computed in THAT year — which is what
 * makes the last day of February correct across the leap cycle.
 */
export function resolveWindow(window: SeasonWindow, sourceYear: number): ResolvedWindow {
  const crossing = crossesYear(window);
  const closeYear = crossing ? sourceYear + 1 : sourceYear;
  const opensDay = anchorDay(window.opens, sourceYear);
  const closesDay = anchorDay(window.closes, closeYear);

  if (!isValidYmd(sourceYear, window.opens.month, opensDay) || !isValidYmd(closeYear, window.closes.month, closesDay)) {
    throw new Error("Season window does not describe real calendar days");
  }

  return {
    opensIso: toIso(sourceYear, window.opens.month, opensDay),
    closesIso: toIso(closeYear, window.closes.month, closesDay),
    crossesYear: crossing,
  };
}

/**
 * The span of dates this rule actually speaks to.
 *
 * For a window inside one calendar year the summary describes that whole year, so
 * a date in it that is outside the season is genuinely closed. For a crossing
 * window it does not: the part of the source year before the opening belongs to
 * the previous summary, so that is not certified rather than closed.
 */
export function certifiedSpan(windows: SeasonWindow[], sourceYear: number): { from: string; to: string } {
  if (!windows.length) throw new Error("A rule must declare at least one season window");
  const resolved = windows.map((window) => resolveWindow(window, sourceYear));
  const anyCrossing = resolved.some((window) => window.crossesYear);

  const earliestOpen = resolved.map((window) => window.opensIso).sort()[0];
  const latestClose = resolved.map((window) => window.closesIso).sort().at(-1)!;

  return anyCrossing
    ? { from: earliestOpen, to: latestClose }
    : { from: toIso(sourceYear, 1, 1), to: toIso(sourceYear, 12, 31) };
}

export interface SeasonEvaluation {
  verdict: SeasonVerdict;
  /** The window containing the date, when there is one. */
  window?: ResolvedWindow;
  /** Every window this rule defines for the source year, for display. */
  windows: ResolvedWindow[];
  span: { from: string; to: string };
}

/**
 * Where a date falls relative to a rule's season.
 *
 * Dates are compared as ISO strings, which order correctly and never pass through
 * a timestamp — a hunt date is a calendar day, and converting it to an instant is
 * how a season silently shifts by one day for half the country.
 */
export function evaluateSeason(
  windows: SeasonWindow[],
  sourceYear: number,
  date: string,
): SeasonEvaluation {
  const resolved = windows.map((window) => resolveWindow(window, sourceYear));
  const span = certifiedSpan(windows, sourceYear);
  const containing = resolved.find((window) => date >= window.opensIso && date <= window.closesIso);

  if (containing) return { verdict: "IN_SEASON", window: containing, windows: resolved, span };
  if (date >= span.from && date <= span.to) return { verdict: "OUT_OF_SEASON", windows: resolved, span };
  return { verdict: "OUTSIDE_CERTIFIED_PERIOD", windows: resolved, span };
}

/* ── Licence years that do not start on 1 January ────────────────────────── */

/**
 * The first day of a jurisdiction's licence year, as a month and day.
 *
 * Ontario's summary is read as a calendar year, which is what everything above
 * assumes. Manitoba's is not: its regulation defines the "hunting year" as
 * 1 April to 31 March, so an elk season written "Jan. 11 – Jan. 24" in the
 * 2026 regulation means January 2027, and anchoring it to the year the summary
 * was published would put it ten months in the past.
 */
export interface LicenceYearStart {
  month: number;
  day: number;
}

function monthDayOrder(month: number, day: number): number {
  return month * 100 + day;
}

/**
 * Anchor a window to the licence year beginning on `startYear`-`start`.
 *
 * A window whose opening falls before the licence year's first day belongs to
 * the next calendar year; a window that closes before it opens crosses into the
 * year after its opening. Everything is computed on (year, month, day) triples
 * and never through a timestamp, so no time zone can move a season by a day.
 */
export function anchorToLicenceYear(
  window: SeasonWindow,
  startYear: number,
  start: LicenceYearStart,
): ResolvedWindow {
  const opensInFollowingYear = anchorOrder(window.opens) < monthDayOrder(start.month, start.day);
  const openYear = opensInFollowingYear ? startYear + 1 : startYear;
  const crossing = crossesYear(window);
  const closeYear = crossing ? openYear + 1 : openYear;

  const opensDay = anchorDay(window.opens, openYear);
  const closesDay = anchorDay(window.closes, closeYear);
  if (!isValidYmd(openYear, window.opens.month, opensDay) || !isValidYmd(closeYear, window.closes.month, closesDay)) {
    throw new Error("Season window does not describe real calendar days");
  }

  const resolved = {
    opensIso: toIso(openYear, window.opens.month, opensDay),
    closesIso: toIso(closeYear, window.closes.month, closesDay),
    crossesYear: crossing,
  };
  /* A licence year is twelve months. A window that closes after the year ends
     describes a different year and cannot be certified against this one. */
  const lastDay = toIso(startYear + 1, start.month, start.day);
  if (resolved.closesIso >= lastDay) {
    throw new Error(`Season window ${resolved.opensIso} to ${resolved.closesIso} runs past its licence year`);
  }
  return resolved;
}

/**
 * Where a date falls against windows already anchored to real days.
 *
 * `certified` is the span the source actually speaks to: the part of the
 * licence year for which the version North Ground read was in force. Outside it
 * the answer is not "closed" — it is that a different version of the law
 * governs, which North Ground has not certified.
 */
export function evaluateResolvedWindows(
  windows: ResolvedWindow[],
  certified: { from: string; to: string },
  date: string,
): SeasonEvaluation {
  if (!windows.length) throw new Error("A rule must declare at least one season window");
  if (date < certified.from || date > certified.to) {
    return { verdict: "OUTSIDE_CERTIFIED_PERIOD", windows, span: certified };
  }
  const containing = windows.find((window) => date >= window.opensIso && date <= window.closesIso);
  return containing
    ? { verdict: "IN_SEASON", window: containing, windows, span: certified }
    : { verdict: "OUT_OF_SEASON", windows, span: certified };
}

/* ── Parsing the authority's own wording ─────────────────────────────────── */

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function parseAnchor(raw: string): SeasonAnchor | null {
  const text = raw.trim().toLowerCase();
  const last = /^the last day of ([a-z]+)$/.exec(text);
  if (last) {
    const month = MONTHS[last[1]];
    return month ? { month, lastDay: true } : null;
  }
  const plain = /^([a-z]+) (\d{1,2})$/.exec(text);
  if (plain) {
    const month = MONTHS[plain[1]];
    const day = Number(plain[2]);
    return month && day >= 1 && day <= 31 ? { month, day } : null;
  }
  return null;
}

/** One published range: "September 15 to December 31", "… to the last day of February". */
const WINDOW_PATTERN = /([a-z]+ \d{1,2}) to (the last day of [a-z]+|[a-z]+ \d{1,2})/g;

/**
 * Turn a published season phrase into windows.
 *
 * Ontario's split seasons arrive from the page with no separator between them —
 * "November 16 to November 22November 30 to December 6" is two windows, not one
 * malformed range — so every range in the phrase is read, not just the first.
 *
 * Deliberately strict in both directions: a phrase with no recognisable range
 * returns null, and so does one where the ranges do not account for essentially
 * all of the text. That second check is what stops "September 15 to December 31
 * except in controlled hunt areas" from being silently truncated to its dates.
 */
export function parseSeasonPhrase(phrase: string): SeasonWindow[] | null {
  const text = phrase.trim().toLowerCase().replace(/\s+/g, " ");
  if (!text) return null;

  const windows: SeasonWindow[] = [];
  for (const match of text.matchAll(WINDOW_PATTERN)) {
    const opens = parseAnchor(match[1]);
    const closes = parseAnchor(match[2]);
    if (!opens || !closes) return null;
    windows.push({ opens, closes });
  }

  if (!windows.length) return null;
  // Only trivial connective text may remain between ranges. Anything else means
  // the phrase carries a qualification the dates alone do not express.
  const residue = text.replace(WINDOW_PATTERN, "").replace(/[\s,;.]|and/g, "");
  if (residue.length > 0) return null;
  return windows;
}

/**
 * When the next season opens, as a fact that cannot be mistaken for another.
 *
 * The owner's requirement is that **closed-until-further-notice and we-do-not-
 * know must not share a representation**. An optional field with `null` leaves
 * that one typo from breaking — `next?: {…} | null` renders "absent" and "null"
 * identically at every call site that forgets which it meant. So this is a
 * discriminated union and the field is REQUIRED: every producer has to say
 * which of these it means, and the compiler asks.
 *
 * DEPENDS_ON_HUNTER is not a hedge. When an answer needs a fact from the
 * hunter, the engine returns before it evaluates any season window at all —
 * there is literally nothing to read a next opening from, and computing one
 * anyway would mean evaluating windows the engine deliberately did not, which
 * is a second interpretation of the rules. A next opening stated there would
 * also be true for only some licences, which is the stricter-or-looser-than-
 * the-source failure wearing a helpful face.
 */
export type NextSeason =
  /** A further season is established, and these are its days. */
  | { kind: "SEASON"; opens: string; closes: string }
  /** There is a next opening, but which one depends on who is hunting. */
  | { kind: "DEPENDS_ON_HUNTER" }
  /** Certified through this date, and no further season begins before it. */
  | { kind: "NONE_IN_CERTIFIED_PERIOD"; through: string }
  /** North Ground holds no certified basis for saying. Never "none". */
  | { kind: "NOT_CERTIFIED" };

/**
 * The earliest opening strictly after `date`, across every season the engine
 * evaluated for this answer.
 *
 * Reads the engine's OWN resolved windows rather than re-deriving them, so a
 * next opening cannot disagree with the season the same answer reports. Where
 * several rules apply, the earliest future opening among them is the one a
 * hunter is waiting for.
 */
export function nextOpening(
  evaluations: readonly SeasonEvaluation[],
  date: string,
): NextSeason {
  if (!evaluations.length) return { kind: "NOT_CERTIFIED" };

  const upcoming = evaluations
    .flatMap((evaluation) => evaluation.windows)
    /* STRICTLY after: a window that opened today is the current season, which
       the answer already reports, and repeating it as "next" would tell a
       hunter to wait for a day that has arrived. */
    .filter((window) => window.opensIso > date)
    .sort((a, b) => a.opensIso.localeCompare(b.opensIso));

  const soonest = upcoming[0];
  if (soonest) return { kind: "SEASON", opens: soonest.opensIso, closes: soonest.closesIso };

  /*
   * Nothing further inside what the sources certify. That is a statement about
   * the CERTIFIED PERIOD, not about the world: the authority's next summary may
   * well open a season the day after it ends, so the date is carried and the
   * claim stops there.
   */
  const through = evaluations.map((evaluation) => evaluation.span.to).sort().at(-1);
  return through ? { kind: "NONE_IN_CERTIFIED_PERIOD", through } : { kind: "NOT_CERTIFIED" };
}
