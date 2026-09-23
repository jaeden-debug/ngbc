/**
 * A restriction that applies inside a management unit rather than to it.
 *
 * `SpecialGeography` already carries identity, resolution and geometry hints,
 * and it works for the twelve British Columbia specials that name candidate
 * units. Three things it cannot express, each found in B.C. Reg. 76/84 and
 * each a different shape of failure:
 *
 *  1. **A jurisdiction-wide restriction has nowhere to live.** s.12 forbids
 *     shooting from a highway and within 15 m of one, province-wide. There is
 *     no unit to list, and `geography.ts` skips a special when the point
 *     resolves to no area at all — so the restriction cannot be expressed.
 *
 *  2. **An area naming no unit is INVISIBLE rather than unresolved.** The
 *     resolution reads `if (!entry.candidateAreas?.includes(area)) continue`,
 *     and for an entry with no `candidateAreas` that is `!undefined`, which is
 *     true. It does not fail; it silently never fires. That is the
 *     can-only-pass shape, in the data layer instead of the test layer, and
 *     BC's Schedule 1 areas name no management unit at all.
 *
 *  3. **One field cannot say WHAT is restricted.** ss.2, 4, 8 and 8.1 say
 *     "there is no open season"; ss.6 and 7.1 designate no-shooting areas and
 *     say nothing about the season; s.10 sets ammunition rules per area. Those
 *     are three different facts with three different consequences, and a
 *     hunter told "restricted" learns none of them.
 *
 * So kind is a dimension and scope admits jurisdiction-wide. Nothing here is
 * British Columbia-shaped: the model names no province, and B.C. Reg. 76/84 is
 * cited only as the evidence that each case is real.
 */

/**
 * WHAT the restriction does. Required — there is no sensible default, and a
 * wrong one is consequential in both directions: reading a no-shooting area as
 * a closed season tells a hunter the season is shut when it is open, and
 * reading a closed season as a no-shooting area tells them to hunt where there
 * is no season.
 */
export type RestrictionKind =
  /** No open season here. The season does not run inside this area. */
  | "NO_OPEN_SEASON"
  /** No discharge or shooting here. The season is untouched, and a hunter
   *  using a bow is NOT addressed by it. */
  | "NO_DISCHARGE"
  /**
   * No hunting here, by any method. Distinct from both neighbours, and Alberta
   * is why: its 11 road corridor wildlife sanctuaries say "it is unlawful to
   * HUNT within 365 metres of the centre-line", which closes no season and
   * does reach a bow hunter. Filed as NO_DISCHARGE it would tell an archer the
   * rule is not theirs; filed as NO_OPEN_SEASON it would claim the season is
   * shut everywhere in the unit.
   */
  | "NO_HUNTING"
  /** Ammunition or implement limits specific to this area. */
  | "AMMUNITION"
  /** Entry or access is restricted, whatever the season says. */
  | "ACCESS"
  /** Something else the authority states; `statedAs` carries it. */
  | "OTHER";

/**
 * WHERE it applies.
 *
 * `UNLISTED` exists so that an area naming no unit is a loud unknown rather
 * than a silent no-op. It is the one case the previous model turned into
 * nothing at all.
 */
export type RestrictionScope =
  /** Everywhere in the jurisdiction. No unit list, and none is expected. */
  | { kind: "JURISDICTION_WIDE"; statedAs: string }
  /** Wholly contains these units. */
  | { kind: "AREAS"; areas: string[] }
  /** Lies partly within these units; where inside is the open question. */
  | { kind: "CANDIDATE_AREAS"; candidateAreas: string[] }
  /** Real, and names no unit North Ground can match. NEVER silently dropped. */
  | { kind: "UNLISTED"; statedAs: string };

/* ── When a restriction applies ──────────────────────────────────────────── */

/** A day in the year as the authority writes it, with no year attached. */
export interface MonthDay { month: number; day: number }

export type Weekday = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

/**
 * WHEN a restriction is in force.
 *
 * A from/to pair cannot hold two shapes British Columbia actually publishes,
 * and both are in one regulation:
 *
 *  - **A floating boundary.** Cowichan Bay 7 runs "March 11 to the Saturday
 *    following Labour Day". The end is a RULE, not a date: it resolves per
 *    year against a calendar. Storing a computed date for it would put North
 *    Ground's arithmetic where the regulation's words belong, and the
 *    arithmetic would silently become the citation.
 *
 *  - **A weekday pattern.** Pitt Wildlife Management Area is restricted for
 *    one period AND on Mondays, Tuesdays, Thursdays and Fridays during
 *    another. Two periods of different shapes on one area — not a range, and
 *    not one range with a note.
 *
 * So a restriction carries a LIST of periods, each of which knows its own
 * shape, and `AS_STATED` exists for a shape this model has not met. §41A: a
 * source that does not fit is evidence the schema is incomplete, so an
 * unmodellable period is carried verbatim rather than flattened into a range.
 */
export type RestrictionPeriod =
  /** In force whenever the restriction is. Stated, never inferred from silence. */
  | { kind: "ALWAYS"; statedAs: string }
  /** Both ends are calendar days the authority names. */
  | { kind: "DATE_RANGE"; from: MonthDay; to: MonthDay; statedAs: string }
  /**
   * One or both ends is a rule rather than a date. The rule is kept as the
   * authority's words and is NEVER pre-resolved into a stored date.
   */
  | { kind: "FLOATING"; from?: MonthDay; fromStatedAs?: string; to?: MonthDay; toStatedAs?: string; statedAs: string }
  /** In force on these weekdays, optionally only within a range. */
  | { kind: "WEEKDAYS"; weekdays: Weekday[]; within?: { from: MonthDay; to: MonthDay }; statedAs: string }
  /** A shape this model has not met. Carried verbatim, never approximated. */
  | { kind: "AS_STATED"; statedAs: string };

export interface WithinZoneRestriction {
  id: string;
  name: string;
  /** The authority's own words. */
  statedAs: string;
  kind: RestrictionKind;
  scope: RestrictionScope;
  citation: string;
  sourceId: string;
  /**
   * When it is in force. REQUIRED, and a restriction with no stated period
   * carries an explicit ALWAYS rather than an empty list — because an empty
   * list and "the authority states no period" would look identical, and the
   * first is a gap while the second is a fact.
   *
   * A LIST because one area can carry periods of different shapes at once.
   */
  periods: RestrictionPeriod[];
  /**
   * The instrument's own precedence, where it states one. B.C. Reg. 76/84
   * s.1.1: "If there is a conflict between this regulation and another
   * regulation made under the Act, this regulation prevails to the extent of
   * the conflict." Recorded because a restriction that prevails over the
   * bundle's own source is not an ordinary overlay.
   */
  prevailsOverConflicting?: { statedAs: string; citation: string };
}

export type RestrictionVerdict =
  /** It applies here, and `kind` says what that means. */
  | { state: "APPLIES"; restriction: WithinZoneRestriction }
  /** It cannot reach this point. */
  | { state: "DOES_NOT_APPLY"; restriction: WithinZoneRestriction }
  /** It may reach this point and North Ground cannot tell. Never silence. */
  | { state: "UNKNOWN"; restriction: WithinZoneRestriction; because: string };

/**
 * Whether a restriction reaches a place.
 *
 * Every branch returns a verdict. There is deliberately no path that returns
 * nothing: a restriction that cannot be evaluated is UNKNOWN and says why,
 * because the failure this model exists to prevent is one that produced
 * silence.
 */
export function restrictionAt(
  restriction: WithinZoneRestriction,
  place: { area?: string; scope: "POINT" | "ZONE" },
): RestrictionVerdict {
  const scope = restriction.scope;

  if (scope.kind === "JURISDICTION_WIDE") {
    /* No area needed, and none is consulted. A point anywhere in the
       jurisdiction is inside it; whether the hunter is within 15 m of a
       highway is not something a zone lookup can answer, so it is APPLIES
       with the authority's words rather than a computed yes or no. */
    return { state: "APPLIES", restriction };
  }

  if (scope.kind === "UNLISTED") {
    return {
      state: "UNKNOWN",
      restriction,
      because: `${restriction.name} names no management unit North Ground can match, so it cannot be placed. ${scope.statedAs}`,
    };
  }

  if (!place.area) {
    return {
      state: "UNKNOWN",
      restriction,
      because: `${restriction.name} is listed by management unit, and this place resolved to none.`,
    };
  }

  if (scope.kind === "AREAS") {
    return scope.areas.includes(place.area)
      ? { state: "APPLIES", restriction }
      : { state: "DOES_NOT_APPLY", restriction };
  }

  if (!scope.candidateAreas.includes(place.area)) {
    return { state: "DOES_NOT_APPLY", restriction };
  }
  return {
    state: "UNKNOWN",
    restriction,
    because: place.scope === "ZONE"
      ? `${restriction.name} covers part of this area, so the answer depends on where in it you hunt.`
      : `${restriction.name} may include this point; North Ground holds no boundary for it.`,
  };
}

/**
 * What a hunter is told, by kind.
 *
 * Kept here rather than in a renderer so that the distinction the kind exists
 * to preserve cannot be flattened by a caller writing one sentence for all of
 * them.
 */
export function restrictionSummary(restriction: WithinZoneRestriction): string {
  switch (restriction.kind) {
    case "NO_OPEN_SEASON": return `No open season inside ${restriction.name}.`;
    case "NO_DISCHARGE": return `No shooting inside ${restriction.name}. The season itself is not closed here, and this does not reach a hunter using a bow.`;
    case "NO_HUNTING": return `No hunting of any kind inside ${restriction.name}, whatever the season says.`;
    case "AMMUNITION": return `Ammunition limits apply inside ${restriction.name}.`;
    case "ACCESS": return `Access is restricted inside ${restriction.name}.`;
    default: return `${restriction.name} restricts hunting here.`;
  }
}


/* ── Evaluating a period ─────────────────────────────────────────────────── */

const MONTH_DAY = (date: string): MonthDay => ({ month: Number(date.slice(5, 7)), day: Number(date.slice(8, 10)) });
const onOrAfter = (a: MonthDay, b: MonthDay) => a.month > b.month || (a.month === b.month && a.day >= b.day);
const onOrBefore = (a: MonthDay, b: MonthDay) => a.month < b.month || (a.month === b.month && a.day <= b.day);
const WEEKDAYS: Weekday[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function inRange(day: MonthDay, from: MonthDay, to: MonthDay): boolean {
  /* A window that wraps the new year — December to February — is inside when
     the day is after the start OR before the end, not both. */
  return onOrAfter(from, to)
    ? onOrAfter(day, from) || onOrBefore(day, to)
    : onOrAfter(day, from) && onOrBefore(day, to);
}

/**
 * Whether a period covers a date.
 *
 * UNKNOWN is a real answer here and is returned wherever a boundary is a rule
 * this model cannot resolve. It never guesses a floating date: a hunter told
 * "restricted until the Saturday following Labour Day" has the authority's
 * rule, and a hunter told a wrong Saturday has our arithmetic.
 */
export function periodCovers(period: RestrictionPeriod, isoDate: string): "YES" | "NO" | "UNKNOWN" {
  const day = MONTH_DAY(isoDate);
  switch (period.kind) {
    case "ALWAYS":
      return "YES";
    case "DATE_RANGE":
      return inRange(day, period.from, period.to) ? "YES" : "NO";
    case "WEEKDAYS": {
      if (period.within && !inRange(day, period.within.from, period.within.to)) return "NO";
      const weekday = WEEKDAYS[new Date(`${isoDate}T00:00:00Z`).getUTCDay()];
      return period.weekdays.includes(weekday) ? "YES" : "NO";
    }
    case "FLOATING": {
      /* One end may be a plain date, and that alone can settle a NO: before a
         known start, or after a known end, is outside whatever the other end
         resolves to. Anything else needs the rule resolved. */
      if (period.from && !period.to && onOrBefore(day, period.from) && !onOrAfter(day, period.from)) return "NO";
      if (period.to && !period.from && onOrAfter(day, period.to) && !onOrBefore(day, period.to)) return "NO";
      return "UNKNOWN";
    }
    default:
      return "UNKNOWN";
  }
}

/**
 * Whether any of a restriction's periods covers a date.
 *
 * UNKNOWN wins over NO and loses to YES: if one period certainly applies the
 * restriction is in force whatever the others do, but an unresolved period
 * cannot be read as absence.
 */
export function restrictionCovers(restriction: WithinZoneRestriction, isoDate: string): "YES" | "NO" | "UNKNOWN" {
  const verdicts = restriction.periods.map((period) => periodCovers(period, isoDate));
  if (verdicts.includes("YES")) return "YES";
  return verdicts.includes("UNKNOWN") ? "UNKNOWN" : "NO";
}
