/**
 * The federal migratory-game-bird answer, and how it composes with a province's.
 *
 * COMPOSITION IS CONJUNCTION HERE, and that is a claim about these two
 * authorities specifically. Parliament sets the season and the bag for
 * migratory game birds; a province sets its own licensing and its own
 * restrictions on where and how anyone may hunt within it. Both bind, neither
 * refines the other, and a hunter must satisfy both.
 *
 * That is NOT the general shape of "two rules at one point". Units nested
 * inside one authority's own layer are more likely specialization — the
 * specific refining the general — and composing those by conjunction would
 * manufacture conflicts where the authority was being deliberate. This path is
 * for federal-and-provincial and must not be reused for that case.
 */

import bundle from "../../../../content/regulatory/ca-federal-2026.json" with { type: "json" };
import type { CanonicalId } from "../../content-contract/index.ts";
import type { RegulatoryResult, RegulatoryStatus } from "../types.ts";
import type { IsoDate } from "../../content-contract/index.ts";
import { FEDERAL_SOURCE_ID, federalRequirementsFor } from "./federal-requirements.ts";
import { general, type Limitation } from "../limitation.ts";
import { legalTimeFor, legalTimeNotCertified, type LegalTimeRule } from "./legal-time.ts";
import { timeZoneAtPoint } from "../time-zone.ts";
import { resolveRelativeWindow, type RelativeWindow } from "./relative-date.ts";
import { federalAreaAt, type FederalArea } from "./federal-areas.ts";
import { FEDERAL_GROUPS, groupsForSpecies, type FederalGroup } from "./federal-groups.ts";

interface FederalRule {
  jurisdictionId: string;
  area: string;
  groupId: string;
  groupStatedAs: string;
  declaredNoSeason: boolean;
  statedAs?: string;
  sourceSection: string;
  window?: { from: { month: number; day: number }; to: { month: number; day: number }; crossesYear: boolean; statedAs: string };
  /*
   * A season Schedule 3 writes as a RULE rather than as days — "the Saturday
   * after the first Monday in October to the first Sunday after January 19".
   * It is stored as the rule and resolved for the year being asked about,
   * because it lands on a different pair of days every year: computing it once
   * and storing the days would be right for one season and quietly wrong for
   * the next. Every wording here was checked against the authority's own
   * published dates (scripts/certify-relative-dates.mjs).
   */
  relativeWindow?: RelativeWindow;
  /*
   * The season applies only in these provincial units, not across the whole
   * federal district. British Columbia's District No. 6 ducks runs September
   * 1-30 in most units, October 1 - November 30 EVERYWHERE, and December 1 -
   * January 15 in the rest: the narrowed entries ADD windows rather than
   * replace the district-wide one, which is how Schedule 3 states them.
   */
  units?: readonly string[];
  /*
   * The season runs on different days depending on whether the year is a leap
   * year, and this rule is one branch of it. Stored as the branch rather than
   * as the days it produced when the bundle was built, for the same reason a
   * relative date is: it would be right for one year and wrong for the next.
   */
  leapYear?: boolean;
  daily?: { kind: string; count?: number; subLimit?: string; statedAs: string };
  possession?: { kind: string; count?: number; subLimit?: string; statedAs: string };
}

const RULES = bundle.rules as readonly FederalRule[];

/** Rows the build refused, which still cover real dates. */
const REFUSED = bundle.notEncoded as ReadonlyArray<{
  jurisdictionId?: string; groupId?: string; coversArea?: string; reason: string; statedAs: string;
}>;

/** Whether this species is a migratory game bird the federal rules reach. */
export function isFederalMigratoryBird(speciesId: string): boolean {
  return groupsForSpecies(speciesId).length > 0;
}

/** Every species any federal group names — what wave 1 makes answerable. */
export function federalSpeciesIds(): ReadonlyArray<CanonicalId<"species">> {
  return [...new Set(FEDERAL_GROUPS.flatMap((group) => group.members))];
}

const dayOfYear = (month: number, day: number) => month * 100 + day;

const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/**
 * The year a stored window OPENED in, for a date inside it.
 *
 * A season crossing the new year opened the PREVIOUS year when the date falls
 * in its tail. The leap-year branch is a property of the season, so it must be
 * tested against the year the season began — not against whatever year the
 * hunter's date happens to sit in.
 */
function openingYearOf(window: NonNullable<FederalRule["window"]>, date: IsoDate): number {
  const year = Number(date.slice(0, 4));
  if (!window.crossesYear) return year;
  return Number(date.slice(5, 7)) <= window.to.month ? year - 1 : year;
}

/**
 * The exact days a relative season runs, for the season a date falls in.
 *
 * A window crossing the new year has TWO candidate seasons on any date: the
 * one that opened this year and the one that opened last. January 3 belongs to
 * the season that opened in October, not to one that has not started yet, so
 * both are tested and the containing one is returned.
 */
function relativeDaysFor(window: RelativeWindow, date: IsoDate): { from: string; to: string } | null {
  const year = Number(date.slice(0, 4));
  for (const opening of window.crossesYear ? [year, year - 1] : [year]) {
    const days = resolveRelativeWindow(window, opening);
    /* ISO dates compare correctly as strings; both ends are inclusive. */
    if (days && date >= days.from && date <= days.to) return days;
  }
  return null;
}

function insideWindow(window: NonNullable<FederalRule["window"]>, date: IsoDate): boolean {
  /* Element 0 is the whole match, so the year must be skipped explicitly.
     Taking [, month, day] read the YEAR as the month and the month as the day,
     which put every season's test in the wrong place in the calendar. */
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!parts) throw new Error(`Not an ISO date: ${date}`);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const value = dayOfYear(month, day);
  const from = dayOfYear(window.from.month, window.from.day);
  const to = dayOfYear(window.to.month, window.to.day);
  /* A season that ends in an earlier month than it starts runs over the new
     year, so the test is a union of two ranges rather than one interval. */
  return window.crossesYear ? value >= from || value <= to : value >= from && value <= to;
}

export interface FederalAnswer {
  status: RegulatoryStatus;
  summary: string;
  limitations: string[];
  requirements: string[];
  season?: { opens: string; closes: string; datesInclusive: boolean };
  /**
   * The group this limit belongs to, always. A daily bag is the GROUP's, never
   * the species', and an answer that cannot name what it is shared with does
   * not report a number at all.
   */
  sharedLimit?: { daily?: number; possession?: number; statedAs: string; sharedWith: string; coversUnlisted: boolean };
  area?: FederalArea;
}

const monthDay = (month: number, day: number) => `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/**
 * The federal answer for a species at a point on a date.
 *
 * Returns UNKNOWN rather than nothing wherever North Ground cannot answer, so
 * a caller never has to tell silence from absence.
 */
export function evaluateFederal(
  speciesId: string,
  jurisdictionId: string,
  point: { latitude: number; longitude?: number },
  date: IsoDate,
  designation?: string,
): FederalAnswer {
  const requirements = federalRequirementsFor(speciesId).map(
    (requirement) => `${requirement.summary} (Migratory Birds Regulations, 2022, ${requirement.section})`,
  );

  const groups = groupsForSpecies(speciesId);
  if (!groups.length) {
    return {
      status: "UNKNOWN",
      summary: "This species is not a migratory game bird the federal regulations name.",
      limitations: [], requirements: [],
    };
  }

  const area = federalAreaAt(jurisdictionId, point, designation);
  if (area.status !== "RESOLVED") {
    return {
      status: area.status === "NEEDS_VERIFICATION" ? "NEEDS_VERIFICATION" : "UNKNOWN",
      summary:
        area.status === "NEEDS_VERIFICATION"
          ? "North Ground will not decide which federal migratory-bird area this point is in."
          : "North Ground holds no federal migratory-bird season for this point.",
      limitations: [area.statedAs],
      requirements,
    };
  }

  const groupIds = new Set(groups.map((group) => group.id));
  const here = RULES.filter(
    (rule) =>
      rule.jurisdictionId === jurisdictionId && rule.area === area.area.name && groupIds.has(rule.groupId)
      /*
       * A rule narrowed to named units cannot be shown to apply without the
       * unit, so it does not. Applying it district-wide would give a season
       * that is right in part of the district and wrong in the rest; applying
       * it to an unknown unit would be the same claim with less evidence.
       */
      && (rule.units === undefined || (designation !== undefined && rule.units.includes(designation)))
      /* One branch of a leap-year season applies only in its own kind of year. */
      && (rule.leapYear === undefined || rule.window === undefined
          || isLeapYear(openingYearOf(rule.window, date)) === rule.leapYear),
  );
  if (!here.length) {
    return {
      status: "UNKNOWN",
      summary: `North Ground holds no certified federal rule for this species in ${area.area.name}.`,
      limitations: [`The Migratory Birds Regulations may set one; North Ground has not encoded it. Federal area: ${area.area.statedAs}`],
      requirements,
      area: area.area,
    };
  }

  /* A declared closure is the authority saying there is no season. It is
     CLOSED, and it outranks any other reading of the same group. */
  const closed = here.find((rule) => rule.declaredNoSeason);
  if (closed && here.every((rule) => rule.declaredNoSeason)) {
    return {
      status: "CLOSED",
      summary: `The Migratory Birds Regulations declare no open season for ${closed.groupStatedAs} in ${area.area.name}.`,
      limitations: [], requirements, area: area.area,
    };
  }

  /* A rule is open on this date by a stored window or by a computed one. */
  const open = here.find((rule) =>
    rule.window
      ? insideWindow(rule.window, date)
      : rule.relativeWindow !== undefined && relativeDaysFor(rule.relativeWindow, date) !== null,
  );
  const openDays = open?.relativeWindow ? relativeDaysFor(open.relativeWindow, date) : null;
  if (!open) {
    /*
     * A row this build REFUSED still covers real dates. Yukon's August duck
     * season exists — for residents of Yukon — and was refused because the
     * limit varies by residency. Answering CLOSED for August 20 would tell a
     * Yukon resident they may not hunt when the law says they may: a
     * restriction stricter than the source, which is as false as an invented
     * permission and quieter, because nobody complains about being told no.
     */
    const refused = REFUSED.filter(
      (entry) => entry.jurisdictionId === jurisdictionId && entry.coversArea === area.area.name && entry.groupId && groupIds.has(entry.groupId),
    );
    if (refused.length) {
      return {
        status: "UNKNOWN",
        summary:
          `North Ground cannot say whether ${here[0].groupStatedAs} is open in ${area.area.name} on this date.`,
        limitations: refused.map(
          (entry) => `The Migratory Birds Regulations set a season here that North Ground did not encode because ${entry.reason}: ${entry.statedAs}`,
        ),
        requirements, area: area.area,
      };
    }
    return {
      status: "CLOSED",
      summary:
        `${date} is outside every federal open season North Ground holds for ${here[0].groupStatedAs} in ${area.area.name}.`,
      limitations: [], requirements, area: area.area,
    };
  }

  const group = FEDERAL_GROUPS.find((entry) => entry.id === open.groupId)!;
  return {
    status: "CONDITIONAL",
    summary:
      `Federal open season for ${open.groupStatedAs} in ${area.area.name}: ${(open.window ?? open.relativeWindow)!.statedAs}.`,
    /*
     * A computed season reports the days it actually runs this year, not the
     * rule that produced them: "the first Sunday after January 19" is not a
     * date a hunter can act on, and the hunter asked about a date.
     */
    season: openDays
      ? { opens: monthDay(Number(openDays.from.slice(5, 7)), Number(openDays.from.slice(8, 10))),
          closes: monthDay(Number(openDays.to.slice(5, 7)), Number(openDays.to.slice(8, 10))),
          datesInclusive: true }
      : {
          opens: monthDay(open.window!.from.month, open.window!.from.day),
          closes: monthDay(open.window!.to.month, open.window!.to.day),
          datesInclusive: true,
        },
    sharedLimit: sharedLimitOf(open, group),
    limitations: [], requirements, area: area.area,
  };
}

/**
 * A limit, stated as the shared thing it is.
 *
 * The regulation sets a bag for a GROUP. Six ducks a day is six across every
 * duck in the group, not six of the species in hand, and a number printed
 * without that sentence is read as a species limit. So the shared wording is
 * required, not decorative: without it there is no limit to report.
 */
function sharedLimitOf(rule: FederalRule, group: FederalGroup): FederalAnswer["sharedLimit"] {
  const daily = rule.daily?.kind === "COUNT" ? rule.daily.count : undefined;
  const possession = rule.possession?.kind === "COUNT" ? rule.possession.count : undefined;
  if (daily === undefined && possession === undefined) return undefined;
  return {
    ...(daily === undefined ? {} : { daily }),
    ...(possession === undefined ? {} : { possession }),
    statedAs: [rule.daily?.statedAs && `daily ${rule.daily.statedAs}`, rule.possession?.statedAs && `possession ${rule.possession.statedAs}`]
      .filter(Boolean).join("; "),
    sharedWith: group.statedAs,
    coversUnlisted: group.coversUnlistedSpecies,
  };
}

/**
 * Federal and provincial, composed. Both apply; neither replaces the other.
 *
 * The SEASON for a migratory game bird is Parliament's, so the federal status
 * decides it. What a province adds — its own licence, its closed areas, its
 * restrictions — is conjunctive on top, and where North Ground has not
 * certified that half, the answer SAYS SO rather than implying the federal
 * season is the whole of the law.
 */
/**
 * The federal legal-hours rule, s. 28(3), which states its own latitude split.
 *
 * "one hour after sunset ... one hour before sunrise" north of 60°N, and half
 * an hour either side south of it. The split is the regulation's, computed
 * from the point exactly as Yukon's federal area bands are — every part of
 * Yukon is north of 60°N, and Prince Edward Island is south of it.
 */
export function federalLegalTimeRule(latitude: number): Extract<LegalTimeRule, { basis: "SUNRISE_SUNSET_OFFSET" }> {
  const minutes = latitude > 60 ? 60 : 30;
  return {
    basis: "SUNRISE_SUNSET_OFFSET",
    beforeSunriseMinutes: minutes,
    afterSunsetMinutes: minutes,
    statedAs:
      latitude > 60
        ? "Migratory Birds Regulations, 2022, s. 28(3)(a): hunting is prohibited from one hour after sunset to one hour before sunrise, north of 60° north latitude"
        : "Migratory Birds Regulations, 2022, s. 28(3)(b): hunting is prohibited from half an hour after sunset to half an hour before sunrise, south of 60° north latitude",
    section: "s. 28(3)",
    sourceId: FEDERAL_SOURCE_ID,
  };
}

/**
 * The federal legal window at a point, where the point's timezone is known.
 *
 * A jurisdiction spanning several IANA zones has no point timezone yet, so it
 * answers NOT_CERTIFIED naming the authority rather than a wall-clock time
 * that would be an hour wrong somewhere in it.
 */
export function federalLegalTime(
  jurisdictionId: string,
  point: { latitude: number; longitude: number },
  date: IsoDate,
) {
  const timezone = timeZoneAtPoint(jurisdictionId);
  if (!timezone) {
    return legalTimeNotCertified(
      "North Ground cannot establish the timezone at this point, because this jurisdiction spans more than one, so it " +
        "will not state a legal hunting window here. The federal rule still applies: " +
        federalLegalTimeRule(point.latitude).statedAs + ".",
      "Environment and Climate Change Canada",
      FEDERAL_SOURCE_ID,
    );
  }
  return legalTimeFor(federalLegalTimeRule(point.latitude), point, date, timezone);
}

export function composeFederalWithProvincial(
  federal: FederalAnswer,
  provincial: RegulatoryResult,
  jurisdictionName: string,
  federalLegal?: RegulatoryResult["legalTime"],
): RegulatoryResult {
  const provincialCertified = provincial.status !== "UNKNOWN";
  const limitations: Limitation[] = [
    ...federal.limitations.map((text) => general(text)),
    ...provincial.limitations,
  ];
  if (!provincialCertified) {
    limitations.unshift(general(
      `Federal rules set the season and limits for migratory game birds. ${jurisdictionName}'s own requirements — its ` +
      "hunting licence, and any area it closes or restricts — also apply, and North Ground has not certified them. " +
      "Check the province before relying on this.",
    ));
  }
  if (federal.sharedLimit) {
    limitations.push(general(
      `The daily and possession limits are SHARED across ${federal.sharedLimit.sharedWith}` +
      (federal.sharedLimit.coversUnlisted ? ", including birds North Ground does not publish" : "") +
      `, not per species: ${federal.sharedLimit.statedAs}.`,
    ));
  }

  /* A province that has certified a restriction can only make the answer more
     restrictive, never less: conjunction takes the binding one. */
  const status: RegulatoryStatus =
    provincial.status === "CLOSED" || provincial.status === "CONFLICT" || provincial.status === "NEEDS_VERIFICATION"
      ? provincial.status
      : federal.status;

  return {
    /*
     * A composed answer needs the first date BOTH layers permit, which is not
     * either side's own next opening — a federal season opening while the
     * provincial one is shut is not a date anyone may hunt. Neither side
     * computes a next opening yet, so composing them cannot invent one; when
     * one does, this must become that intersection and not a passthrough.
     */
    next: { kind: "NOT_CERTIFIED" },
    status,
    summary: federal.summary,
    ...(federal.season && status === "CONDITIONAL" ? { season: federal.season } : {}),
    /*
     * A migratory bird's legal hours are the FEDERAL rule's, because s. 28(3)
     * sets them. The provincial line is kept only where the federal one could
     * not be resolved.
     */
    legalTime: federalLegal ?? provincial.legalTime,
    requirements: [...federal.requirements, ...provincial.requirements],
    limitations,
    sourceIds: [...new Set([FEDERAL_SOURCE_ID, ...provincial.sourceIds])],
    verifiedAt: provincial.verifiedAt,
  };
}
