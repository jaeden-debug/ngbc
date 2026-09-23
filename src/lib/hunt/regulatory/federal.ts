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
  daily?: { kind: string; count?: number; subLimit?: string; statedAs: string };
  possession?: { kind: string; count?: number; subLimit?: string; statedAs: string };
}

const RULES = bundle.rules as readonly FederalRule[];

/** Whether this species is a migratory game bird the federal rules reach. */
export function isFederalMigratoryBird(speciesId: string): boolean {
  return groupsForSpecies(speciesId).length > 0;
}

/** Every species any federal group names — what wave 1 makes answerable. */
export function federalSpeciesIds(): ReadonlyArray<CanonicalId<"species">> {
  return [...new Set(FEDERAL_GROUPS.flatMap((group) => group.members))];
}

const dayOfYear = (month: number, day: number) => month * 100 + day;

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
  point: { latitude: number },
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
    (rule) => rule.jurisdictionId === jurisdictionId && rule.area === area.area.name && groupIds.has(rule.groupId),
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

  const open = here.find((rule) => rule.window && insideWindow(rule.window, date));
  if (!open) {
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
      `Federal open season for ${open.groupStatedAs} in ${area.area.name}: ${open.window!.statedAs}.`,
    season: {
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
export function composeFederalWithProvincial(
  federal: FederalAnswer,
  provincial: RegulatoryResult,
  jurisdictionName: string,
): RegulatoryResult {
  const provincialCertified = provincial.status !== "UNKNOWN";
  const limitations = [
    ...federal.limitations,
    ...provincial.limitations,
  ];
  if (!provincialCertified) {
    limitations.unshift(
      `Federal rules set the season and limits for migratory game birds. ${jurisdictionName}'s own requirements — its ` +
      "hunting licence, and any area it closes or restricts — also apply, and North Ground has not certified them. " +
      "Check the province before relying on this.",
    );
  }
  if (federal.sharedLimit) {
    limitations.push(
      `The daily and possession limits are SHARED across ${federal.sharedLimit.sharedWith}` +
      (federal.sharedLimit.coversUnlisted ? ", including birds North Ground does not publish" : "") +
      `, not per species: ${federal.sharedLimit.statedAs}.`,
    );
  }

  /* A province that has certified a restriction can only make the answer more
     restrictive, never less: conjunction takes the binding one. */
  const status: RegulatoryStatus =
    provincial.status === "CLOSED" || provincial.status === "CONFLICT" || provincial.status === "NEEDS_VERIFICATION"
      ? provincial.status
      : federal.status;

  return {
    status,
    summary: federal.summary,
    ...(federal.season && status === "CONDITIONAL" ? { season: federal.season } : {}),
    legalTime: provincial.legalTime,
    requirements: [...federal.requirements, ...provincial.requirements],
    limitations,
    sourceIds: [...new Set([FEDERAL_SOURCE_ID, ...provincial.sourceIds])],
    verifiedAt: provincial.verifiedAt,
  };
}
