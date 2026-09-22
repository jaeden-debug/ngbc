import { tierOfMetric } from "./evidence-ladder.ts";
import type { SpatialResolution } from "./spatial-precision.ts";
import { finestPermittedResolution } from "./spatial-precision.ts";
import type { EvidenceRecord, IntelligenceMetric } from "./types.ts";

/**
 * Deriving one number from others, without losing what makes it true.
 *
 * Almost every wrong thing a hunting map can say is a division whose
 * denominator went missing. 400 deer taken in a unit with 4,000 hunters and 400
 * taken in a unit with 300 hunters are the same numerator and opposite
 * conclusions. A rate whose denominator is not carried with it is not a rate,
 * it is a rumour.
 *
 * So a derivation here is a declaration: this metric, from exactly these
 * metrics, meaning exactly this. Anything not declared cannot be derived, and
 * the refusal says what the evidence CAN be called instead — which is what
 * stops the caller from reaching for the nearest confident-sounding label.
 */

/**
 * The area a population estimate was made over. Not an IntelligenceMetric,
 * because it is a property of the geography rather than evidence about the
 * animal — but it is still a denominator, and must still travel with the value.
 */
export type AreaDenominator = "AREA_SQUARE_KILOMETRES";

export type DerivationInputMetric = IntelligenceMetric | AreaDenominator;

export interface Derivation {
  produces: IntelligenceMetric;
  numerator: IntelligenceMetric;
  denominator: DerivationInputMetric;
  unit: string;
  /** What the resulting number means, in the words a hunter would be shown. */
  statedAs: string;
}

/**
 * Every division North Ground is willing to perform. There are only three.
 *
 * Deliberately short. A metric absent from `produces` is one the authority must
 * publish itself, because North Ground cannot reconstruct it from what it holds.
 */
export const DERIVATIONS: readonly Derivation[] = [
  {
    produces: "HARVEST_PER_HUNTER",
    numerator: "HARVEST_TOTAL",
    denominator: "HUNTER_COUNT",
    unit: "animals per active hunter",
    statedAs: "Reported harvest divided by the active hunters the authority counted.",
  },
  {
    produces: "HARVEST_PER_EFFORT",
    numerator: "HARVEST_TOTAL",
    denominator: "HUNTER_DAYS",
    unit: "animals per hunter day",
    statedAs: "Reported harvest divided by the hunter days the authority counted.",
  },
  {
    produces: "POPULATION_DENSITY",
    numerator: "POPULATION_ESTIMATE",
    denominator: "AREA_SQUARE_KILOMETRES",
    unit: "animals per square kilometre",
    statedAs: "The authority's own population estimate divided by the area it estimated over.",
  },
];

/**
 * Metrics North Ground will never compute, with the reason and the honest
 * alternative.
 *
 * These are the specific mistakes this module exists to prevent, written down
 * so that reaching for one produces a sentence rather than a number.
 */
export const NEVER_DERIVED: Record<string, { reason: string; sayInstead: string }> = {
  HUNTER_SUCCESS_RATE: {
    reason:
      "A success rate is the share of hunters who took an animal. Harvest divided by hunters is not that number — one hunter may take several, and an authority's own success rate counts successful hunters, not animals.",
    sayInstead: "HARVEST_PER_HUNTER",
  },
  POPULATION_ESTIMATE: {
    reason: "How many animals live somewhere can only come from the authority's own survey or model. Harvest is a record of hunting, not a census.",
    sayInstead: "HARVEST_TOTAL",
  },
  RANGE_PRESENCE: {
    reason: "Whether a species occurs somewhere is a published statement of extent. A habitat model describes land, and land that looks right is not an animal.",
    sayInstead: "HABITAT_SUITABILITY",
  },
};

export interface DerivationRefusal {
  refused: true;
  produces: string;
  reason: string;
  /** The metric the evidence actually supports, so the caller has somewhere to go. */
  sayInstead?: string;
}

export interface DerivedValue {
  refused: false;
  metric: IntelligenceMetric;
  value: number;
  unit: string;
  statedAs: string;
  /** Both sides, kept. A derived value that cannot show its denominator is not publishable. */
  numerator: { metric: string; value: number; unit: string; sourceId: string };
  denominator: { metric: string; value: number; unit: string; sourceId: string };
  /** Present only where both inputs published one; a rate over 12 animals is not a rate over 12,000. */
  sampleSize?: number;
  /** The coarser of the two inputs: a derived number is never finer than its parts. */
  resolution: SpatialResolution;
}

export interface DerivationInput {
  metric: DerivationInputMetric;
  value: number;
  unit: string;
  sourceId: string;
  resolution: SpatialResolution;
  sampleSize?: number;
}

/**
 * Compute a declared derivation, or refuse and say why.
 *
 * Refuses when the metric is not derivable at all, when the denominator is
 * missing, when the denominator is zero (which is not infinity, it is a place
 * nobody hunted), and when the two inputs describe geographies that cannot be
 * compared — dividing a unit's harvest by a province's hunters produces a
 * number with no meaning at either scale.
 */
export function derive(
  produces: IntelligenceMetric,
  inputs: readonly DerivationInput[],
): DerivedValue | DerivationRefusal {
  const never = NEVER_DERIVED[produces];
  if (never) return { refused: true, produces, reason: never.reason, sayInstead: never.sayInstead };

  const derivation = DERIVATIONS.find((entry) => entry.produces === produces);
  if (!derivation) {
    return { refused: true, produces, reason: `North Ground declares no way to compute ${produces} from evidence it holds.` };
  }

  const numerator = inputs.find((input) => input.metric === derivation.numerator);
  const denominator = inputs.find((input) => input.metric === derivation.denominator);
  if (!numerator) {
    return { refused: true, produces, reason: `${produces} needs ${derivation.numerator}, which is not present.` };
  }
  if (!denominator) {
    // The whole point of the module. The numerator alone keeps its own honest name.
    return {
      refused: true,
      produces,
      reason: `${produces} needs ${derivation.denominator}, which this authority did not publish here. Without it the harvest figure is a total, not a rate.`,
      sayInstead: derivation.numerator,
    };
  }
  if (denominator.value === 0) {
    return { refused: true, produces, reason: `${derivation.denominator} is zero here, so no rate exists.`, sayInstead: derivation.numerator };
  }

  const resolution = finestPermittedResolution([numerator.resolution, denominator.resolution]);
  if (!resolution) {
    return {
      refused: true,
      produces,
      reason: `${derivation.numerator} and ${derivation.denominator} describe geographies that do not nest, so dividing one by the other means nothing at either scale.`,
      sayInstead: derivation.numerator,
    };
  }

  return {
    refused: false,
    metric: produces,
    value: numerator.value / denominator.value,
    unit: derivation.unit,
    statedAs: derivation.statedAs,
    numerator: { metric: numerator.metric, value: numerator.value, unit: numerator.unit, sourceId: numerator.sourceId },
    denominator: { metric: denominator.metric, value: denominator.value, unit: denominator.unit, sourceId: denominator.sourceId },
    ...(numerator.sampleSize !== undefined && denominator.sampleSize !== undefined
      ? { sampleSize: Math.min(numerator.sampleSize, denominator.sampleSize) }
      : {}),
    resolution,
  };
}

/**
 * Whether a set of evidence may be LABELLED as a metric.
 *
 * Separate from `derive` because a label can be applied without any arithmetic
 * at all — a legend, a card heading, a tooltip — and that is exactly where
 * "harvest" quietly becomes "success". A metric may be claimed only when the
 * authority published it, or when every input its declared derivation needs is
 * present.
 */
export function mayLabelAs(produces: IntelligenceMetric, present: readonly IntelligenceMetric[]): boolean {
  if (present.includes(produces)) return true;
  if (NEVER_DERIVED[produces]) return false;
  const derivation = DERIVATIONS.find((entry) => entry.produces === produces);
  if (!derivation) return false;
  // An area denominator is a property of the geography, always available where
  // the geography is; a metric denominator has to have actually been published.
  const denominatorHeld = derivation.denominator === "AREA_SQUARE_KILOMETRES" || present.includes(derivation.denominator);
  return present.includes(derivation.numerator) && denominatorHeld;
}

/**
 * The metrics a set of evidence may honestly be described by: what is held,
 * plus what can be derived from it. Nothing else may reach a legend.
 */
export function availableMetrics(records: readonly Pick<EvidenceRecord, "metric">[]): IntelligenceMetric[] {
  const present = [...new Set(records.map(({ metric }) => metric))];
  const derived = DERIVATIONS.map(({ produces }) => produces).filter((metric) => mayLabelAs(metric, present));
  return [...new Set([...present, ...derived])].sort();
}

/** The tier a derived metric inherits: a derivation never promotes evidence. */
export function derivedTier(derivation: Derivation) {
  return tierOfMetric(derivation.numerator);
}
