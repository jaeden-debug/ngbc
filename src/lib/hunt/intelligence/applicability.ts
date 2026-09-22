import type { CoverageState } from "../canada/registry.ts";
import type { DatasetCoverage, EvidenceRecord, IntelligenceMetric } from "./types.ts";

/**
 * When evidence applies, and how completely a layer is covered.
 *
 * Two dates are kept apart throughout, because collapsing them is how a map
 * comes to show 2019 as though it were today:
 *
 *   OBSERVATION PERIOD — when the thing was measured. A 2019 harvest season was
 *   measured in 2019 and always will have been. It does not expire.
 *   EFFECTIVE PERIOD — when the authority says the figure governs or describes.
 *   Most statistical evidence has none, and inventing one would be a claim the
 *   publisher never made.
 *
 * So evidence is not "expired"; it is old, and how old is stated. What does go
 * stale is North Ground's confidence that it is still the CURRENT published
 * figure — a different thing, tracked separately, and the reason the answer
 * distinguishes "this is what 2019 said" from "this is the latest there is".
 */

export type TemporalApplicability =
  /** Inside a stated effective period, or the authority's most recent publication. */
  | "CURRENT"
  /** Real, measured, and older than the freshest the authority publishes. */
  | "HISTORICAL"
  /** An effective period that has not begun. Never shown as though it had. */
  | "NOT_YET_EFFECTIVE"
  /** Old enough that North Ground should re-check the source before relying on it. */
  | "STALE"
  /** No usable dates at all. Undatable evidence is not timeless, it is unverifiable. */
  | "UNDATED";

/**
 * How long a metric stays trustworthy as "the current figure" without a
 * re-check, in years.
 *
 * These are review intervals for North Ground, not claims about the animals.
 * Annual programmes are re-published annually; a range map may stand for a
 * decade; a habitat model is as old as its inputs and is re-derived, not aged.
 */
export const REVIEW_INTERVAL_YEARS: Record<IntelligenceMetric, number> = {
  HARVEST_TOTAL: 2,
  HARVEST_PER_HUNTER: 2,
  HUNTER_SUCCESS_RATE: 2,
  HUNTER_COUNT: 2,
  HUNTER_DAYS: 2,
  HARVEST_PER_EFFORT: 2,
  POPULATION_ESTIMATE: 3,
  POPULATION_DENSITY: 3,
  SURVEY_OBSERVATION: 3,
  RANGE_PRESENCE: 10,
  HABITAT_SUITABILITY: 5,
  PUBLIC_LAND_AVAILABILITY: 2,
  ACCESS_OPPORTUNITY: 2,
};

export interface ApplicabilityVerdict {
  applicability: TemporalApplicability;
  /** Whole years between the end of observation and the date asked about. */
  observationAgeYears: number | null;
  /** What a person is told, naming the period rather than implying it is now. */
  statedAs: string;
}

function years(fromIso: string, toIso: string): number | null {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return (to - from) / (365.2425 * 24 * 60 * 60 * 1000);
}

/**
 * Whether a record applies on a date, and how old it is.
 *
 * `latestObservationThrough` is the freshest observation the same programme
 * publishes. With it, an older record is HISTORICAL — a real measurement that
 * has been superseded by a newer one — rather than stale. Without it, age alone
 * decides, which is the conservative reading.
 */
export function temporalApplicability(
  record: Pick<EvidenceRecord, "metric" | "observationPeriod" | "effectivePeriod">,
  onDate: string,
  latestObservationThrough?: string,
): ApplicabilityVerdict {
  const observedThrough = record.observationPeriod?.through;
  const age = observedThrough ? years(observedThrough, onDate) : null;
  const ageYears = age === null ? null : Math.max(0, Math.floor(age));
  const measured = observedThrough
    ? `Measured ${record.observationPeriod.from} to ${observedThrough}.`
    : "The publisher states no measurement period.";

  if (record.effectivePeriod) {
    const { from, through } = record.effectivePeriod;
    if (onDate < from) {
      return { applicability: "NOT_YET_EFFECTIVE", observationAgeYears: ageYears, statedAs: `The authority states this applies from ${from}. ${measured}` };
    }
    if (onDate > through) {
      return { applicability: "HISTORICAL", observationAgeYears: ageYears, statedAs: `The authority stated this applied through ${through}. ${measured}` };
    }
    return { applicability: "CURRENT", observationAgeYears: ageYears, statedAs: `The authority states this applies ${from} to ${through}. ${measured}` };
  }

  if (!observedThrough || age === null) {
    return { applicability: "UNDATED", observationAgeYears: null, statedAs: "This record carries no usable dates, so North Ground cannot say when it applied." };
  }
  if (latestObservationThrough && observedThrough < latestObservationThrough) {
    return { applicability: "HISTORICAL", observationAgeYears: ageYears, statedAs: `${measured} A more recent season is published (${latestObservationThrough}).` };
  }
  if (age > REVIEW_INTERVAL_YEARS[record.metric]) {
    return {
      applicability: "STALE",
      observationAgeYears: ageYears,
      statedAs: `${measured} That is ${ageYears} year${ageYears === 1 ? "" : "s"} old and past North Ground's review interval for this kind of evidence.`,
    };
  }
  return { applicability: "CURRENT", observationAgeYears: ageYears, statedAs: `${measured} It is the most recent published.` };
}

/** Evidence that may be shown at all. Stale may be shown, clearly labelled; future may not. */
export function mayShow(applicability: TemporalApplicability): boolean {
  return applicability !== "NOT_YET_EFFECTIVE" && applicability !== "UNDATED";
}

/**
 * What North Ground holds for one species, one jurisdiction and one layer.
 *
 * Distinct from the regulatory `CoverageState` and the dataset-level
 * `DatasetCoverage` already in the codebase, because it answers a different
 * question: not "is this jurisdiction's geography certified" but "can this
 * species be painted here, and if not, why not". The two are mapped explicitly
 * below rather than being allowed to drift into a third private scale.
 *
 * The distinction that matters to a hunter is between "we looked and there is
 * nothing" and "we have not looked". An empty map must never mean the second.
 */
export type IntelligenceCoverage =
  /** Enough evidence to paint, within its stated resolution and tier. */
  | "AVAILABLE"
  /** Real evidence for part of the area or part of the period, with the gap named. */
  | "PARTIAL"
  /** Held, past its review interval, shown with its age rather than withdrawn. */
  | "STALE"
  /** Held but not publishable: a sensitive species, or a licence that forbids it. */
  | "RESTRICTED"
  /** A source exists and has not been reconciled — a conflict, a parity failure. */
  | "UNRESOLVED"
  /** Looked for, and the authority publishes nothing usable. A finding, not a gap. */
  | "UNAVAILABLE"
  /** Not yet investigated. The honest default, and never dressed as UNAVAILABLE. */
  | "IN_RESEARCH";

/** Canada's registry vocabulary, mapped rather than duplicated. */
export function coverageFromRegistry(state: CoverageState): IntelligenceCoverage {
  const map: Record<CoverageState, IntelligenceCoverage> = {
    VERIFIED: "AVAILABLE",
    PARTIAL: "PARTIAL",
    IN_DEVELOPMENT: "IN_RESEARCH",
    UNAVAILABLE: "UNAVAILABLE",
    UNKNOWN: "IN_RESEARCH",
  };
  return map[state];
}

/** The dataset registry's vocabulary, mapped the same way. */
export function coverageFromDataset(state: DatasetCoverage): IntelligenceCoverage {
  const map: Record<DatasetCoverage, IntelligenceCoverage> = {
    VERIFIED: "AVAILABLE",
    PARTIAL: "PARTIAL",
    LIMITED: "PARTIAL",
    IN_DEVELOPMENT: "IN_RESEARCH",
    UNAVAILABLE: "UNAVAILABLE",
    LICENCE_PENDING: "RESTRICTED",
    LICENCE_BLOCKED: "RESTRICTED",
    STALE: "STALE",
    NEEDS_VERIFICATION: "UNRESOLVED",
  };
  return map[state];
}

/** Whether a coverage state may put anything on the map. */
export function coverageIsPaintable(coverage: IntelligenceCoverage): boolean {
  return coverage === "AVAILABLE" || coverage === "PARTIAL" || coverage === "STALE";
}

/**
 * What an unpaintable layer says instead of nothing.
 *
 * A layer control that simply goes quiet reads as "there is nothing here",
 * which about a wild animal is a claim North Ground cannot make.
 */
export const COVERAGE_EXPLANATIONS: Record<IntelligenceCoverage, string> = {
  AVAILABLE: "North Ground holds evidence for this species here.",
  PARTIAL: "North Ground holds evidence for part of this area or period. The rest is not measured, which is not the same as empty.",
  STALE: "The evidence here is past its review interval. It is shown with its age so you can judge it.",
  RESTRICTED: "Evidence exists but North Ground may not publish it here, because of the publisher's terms or a protection on this species.",
  UNRESOLVED: "Sources for this area disagree, or have not been reconciled against the authority. Nothing is shown until they are.",
  UNAVAILABLE: "North Ground looked: this authority publishes nothing usable for this species. That is a finding about the data, not about the animals.",
  IN_RESEARCH: "North Ground has not yet researched this species here. Nothing is claimed either way.",
};
