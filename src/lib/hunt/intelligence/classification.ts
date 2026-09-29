import {
  METRIC_MEANINGS,
  METRIC_ROLES,
  OPPORTUNITY_METHODOLOGY_VERSION,
  appliedWeights,
  evidenceGrade,
  evidenceStrength,
  independentValueCount,
} from "./methodology.ts";
import { renderKindFor } from "./rendering.ts";
import type {
  EvidenceCoverage,
  EvidenceRecord,
  IntelligenceMetric,
  OpportunityClass,
  OpportunityComponent,
  OpportunityResult,
} from "./types.ts";

export { OPPORTUNITY_METHODOLOGY_VERSION };

/**
 * The named bands the ramp and the legend share.
 *
 * The map draws a CONTINUOUS intensity; these bands are what that intensity is
 * CALLED. They are here, in one place, so a word and a shade can never come
 * from different thresholds — the failure where a zone reads "High" in a card
 * and sits in the moderate band on the map.
 */
export const OPPORTUNITY_THRESHOLDS: ReadonlyArray<{ minimum: number; classification: Exclude<OpportunityClass, "LIMITED_DATA"> }> = [
  { minimum: 0.8, classification: "VERY_HIGH" },
  { minimum: 0.6, classification: "HIGH" },
  { minimum: 0.4, classification: "MODERATE" },
  { minimum: 0, classification: "LOW" },
];

const METRIC_LABELS: Record<IntelligenceMetric, string> = {
  HARVEST_TOTAL: "Harvest evidence",
  HARVEST_PER_HUNTER: "Harvest per hunter",
  HUNTER_SUCCESS_RATE: "Hunter success",
  HUNTER_COUNT: "Hunter activity",
  HUNTER_DAYS: "Hunter effort",
  HARVEST_PER_EFFORT: "Harvest per unit effort",
  POPULATION_ESTIMATE: "Population evidence",
  POPULATION_DENSITY: "Population density",
  SURVEY_OBSERVATION: "Survey evidence",
  RANGE_PRESENCE: "Range evidence",
  HABITAT_SUITABILITY: "Habitat evidence",
  PUBLIC_LAND_AVAILABILITY: "Public-land opportunity",
  ACCESS_OPPORTUNITY: "Access opportunity",
};

export function classifyNormalizedScore(score: number): Exclude<OpportunityClass, "LIMITED_DATA"> {
  if (!Number.isFinite(score) || score < 0 || score > 1) throw new RangeError("Normalized opportunity values must be between 0 and 1");
  return OPPORTUNITY_THRESHOLDS.find(({ minimum }) => score >= minimum)!.classification;
}

export function percentileRanks(values: ReadonlyArray<number>): number[] {
  if (!values.length) return [];
  if (values.some((value) => !Number.isFinite(value))) throw new TypeError("Evidence values must be finite numbers");
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return [0.5];
  return values.map((value) => {
    const first = sorted.indexOf(value);
    const last = sorted.lastIndexOf(value);
    return ((first + last) / 2) / (sorted.length - 1);
  });
}

/**
 * How much of a dataset's evidence is independently measured, not how many
 * names it goes under.
 *
 * The previous version counted DISTINCT METRICS. British Columbia's five
 * metrics per unit are three published numbers and two rates derived from
 * them, and that graded ROBUST_DATA — the strongest coverage word the product
 * has, awarded for restating three facts five ways. Worse, the grade was
 * structurally incapable of noticing when two of those series carried the same
 * values, which is a defect that actually shipped.
 */
export function evidenceCoverage(records: readonly Pick<EvidenceRecord, "metric">[]): EvidenceCoverage {
  const metrics = records.map(({ metric }) => metric);
  if (!metrics.length) return "NO_HEAT_MAP_DATA";
  const present = new Set(metrics);
  if (present.size === 1 && present.has("RANGE_PRESENCE")) return "RANGE_ONLY";
  const independent = independentValueCount(metrics);
  if (independent >= 4) return "ROBUST_DATA";
  if (independent >= 2) return "PARTIAL_DATA";
  return "LIMITED_DATA";
}

/**
 * Builds an explainable opportunity result from already-normalized evidence.
 *
 * Two things decide the shade and neither is an average of everything present:
 *
 *   WHAT MAY CONTRIBUTE — only evidence about the animals. Hunter counts and
 *   hunter days are carried as components, marked as not contributing, and
 *   shown; they never move the number. See `methodology.ts` for why.
 *
 *   HOW MUCH EACH CONTRIBUTES — the declared weights, renormalized over what
 *   this zone actually holds and reported in the result. A rate that carries
 *   its own denominator outweighs a raw total.
 *
 * `intensity` is the continuous value the map paints; `classification` is the
 * word for the band it falls in. Both come from the same number, so a card and
 * a polygon cannot disagree.
 */
export function classifyOpportunity(records: EvidenceRecord[]): OpportunityResult | null {
  const current = records.filter((record) => !record.superseded);
  if (!current.length) return null;
  const species = new Set(current.map(({ speciesId }) => speciesId));
  const geographies = new Set(current.map(({ geographyId }) => geographyId));
  if (species.size !== 1 || geographies.size !== 1) throw new Error("One opportunity result must describe one species and one geography");

  const coverage = evidenceCoverage(current);
  const weights = appliedWeights(current.map(({ metric }) => metric));

  const components: OpportunityComponent[] = current.map((record) => {
    const weight = weights.get(record.metric);
    return {
      metric: record.metric,
      label: METRIC_LABELS[record.metric],
      ...(typeof record.normalizedValue === "number" ? { normalizedValue: record.normalizedValue } : {}),
      confidence: record.confidence,
      sourceIds: [record.sourceId],
      role: METRIC_ROLES[record.metric],
      /* The flag a reader can check against the shade. An effort component
         appears with this false, which is the whole visible difference between
         v1 and v2 in a response body. */
      contributesToIntensity: typeof weight === "number" && typeof record.normalizedValue === "number",
      ...(typeof weight === "number" && typeof record.normalizedValue === "number" ? { appliedWeight: Number(weight.toFixed(6)) } : {}),
      meaning: METRIC_MEANINGS[record.metric],
      explanation: record.notes ?? `${record.rawValue} ${record.unit}, observed ${record.observationPeriod.from} to ${record.observationPeriod.through}.`,
    };
  });

  /* Only what may contribute, and only where a normalized value exists. A
     weighted mean over the applied weights of exactly those records. */
  const contributing = components.filter((component) => component.contributesToIntensity);
  const weightSum = contributing.reduce((sum, component) => sum + component.appliedWeight!, 0);
  const intensity = weightSum > 0
    ? contributing.reduce((sum, component) => sum + component.normalizedValue! * component.appliedWeight!, 0) / weightSum
    : null;

  const classification = intensity === null || coverage === "RANGE_ONLY" ? "LIMITED_DATA" : classifyNormalizedScore(intensity);

  return {
    speciesId: current[0].speciesId,
    geographyId: current[0].geographyId,
    classification,
    /* Null wherever the class is LIMITED_DATA, so a caller cannot paint a shade
       for a zone whose evidence refuses to rank. */
    intensity: intensity === null || classification === "LIMITED_DATA" ? null : Number(intensity.toFixed(6)),
    coverage,
    strength: evidenceStrength(current),
    grade: evidenceGrade(current.map(({ metric }) => metric)),
    renderKind: renderKindFor(current.map(({ geographyType }) => geographyType)),
    methodologyVersion: OPPORTUNITY_METHODOLOGY_VERSION,
    components,
    explanation: components.map(({ label, explanation }) => `${label} — ${explanation}`),
    legalStatus: null,
  };
}
