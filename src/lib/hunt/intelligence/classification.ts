import type {
  EvidenceCoverage,
  EvidenceRecord,
  IntelligenceMetric,
  OpportunityClass,
  OpportunityComponent,
  OpportunityResult,
} from "./types.ts";

export const OPPORTUNITY_METHODOLOGY_VERSION = "opportunity-v1";

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

function evidenceCoverage(records: EvidenceRecord[]): EvidenceCoverage {
  const metrics = new Set(records.map(({ metric }) => metric));
  if (metrics.size === 0) return "NO_HEAT_MAP_DATA";
  if (metrics.size === 1 && metrics.has("RANGE_PRESENCE")) return "RANGE_ONLY";
  if (metrics.size >= 4) return "ROBUST_DATA";
  if (metrics.size >= 2) return "PARTIAL_DATA";
  return "LIMITED_DATA";
}

/**
 * Builds an explainable opportunity result from already-normalized evidence.
 * Equal weighting is deliberate in v1; future methodology changes require a
 * new version rather than silently reinterpreting stored results.
 */
export function classifyOpportunity(records: EvidenceRecord[]): OpportunityResult | null {
  const current = records.filter((record) => !record.superseded);
  if (!current.length) return null;
  const species = new Set(current.map(({ speciesId }) => speciesId));
  const geographies = new Set(current.map(({ geographyId }) => geographyId));
  if (species.size !== 1 || geographies.size !== 1) throw new Error("One opportunity result must describe one species and one geography");

  const coverage = evidenceCoverage(current);
  const usable = current.filter((record) => typeof record.normalizedValue === "number");
  const components: OpportunityComponent[] = current.map((record) => ({
    metric: record.metric,
    label: METRIC_LABELS[record.metric],
    ...(typeof record.normalizedValue === "number" ? { normalizedValue: record.normalizedValue } : {}),
    confidence: record.confidence,
    sourceIds: [record.sourceId],
    explanation: record.notes ?? `${record.rawValue} ${record.unit}, observed ${record.observationPeriod.from} to ${record.observationPeriod.through}.`,
  }));

  const score = usable.length
    ? usable.reduce((sum, record) => sum + record.normalizedValue!, 0) / usable.length
    : null;
  const classification = score === null || coverage === "RANGE_ONLY" ? "LIMITED_DATA" : classifyNormalizedScore(score);

  return {
    speciesId: current[0].speciesId,
    geographyId: current[0].geographyId,
    classification,
    coverage,
    methodologyVersion: OPPORTUNITY_METHODOLOGY_VERSION,
    components,
    explanation: components.map(({ label, explanation }) => `${label} — ${explanation}`),
    legalStatus: null,
  };
}
