import { DERIVATIONS } from "./derivation.ts";
import { tierOfMetric } from "./evidence-ladder.ts";
import type { EvidenceConfidence, EvidenceRecord, IntelligenceMetric } from "./types.ts";

/**
 * How the species heat layer's intensity is computed, written down.
 *
 * The v1 model averaged every normalized value a bundle carried. British
 * Columbia's bundles carry five: reported harvest, harvest per hunter, harvest
 * per hunter day, HUNTER COUNT and HUNTER DAYS. So two fifths of what the map
 * drew as "where to look for an animal" was a measure of HOW MANY PEOPLE WENT
 * HUNTING THERE — a unit beside a highway with a thousand hunters and little
 * game outranked a remote unit with few hunters and good game, and the map said
 * so in the colour a hunter reads as abundance.
 *
 * That is the exact confusion CLAUDE.md §41B and the owner's brief forbid:
 * hunting pressure is not animal density. Pressure follows roads, towns,
 * tradition and access as much as it follows animals, and the direction of the
 * error is unknowable per unit.
 *
 * v2 therefore declares, per metric, whether it may move the intensity at all.
 * Effort is kept — it is real, published, and a hunter wants to know a unit is
 * crowded — but it is kept as CONTEXT, shown beside the answer and never inside
 * it. The weights are written here, the applied ones travel in every result,
 * and changing either is a new version rather than a quiet re-interpretation.
 */

export const OPPORTUNITY_METHODOLOGY_VERSION = "opportunity-v2";

/**
 * What a metric is allowed to do to the heat.
 *
 * - ABUNDANCE_SIGNAL — evidence about the animals. It may move the intensity.
 * - EFFORT_CONTEXT — evidence about the hunters. Shown, never scored.
 * - EXTENT_ONLY — evidence that the species occurs here, which says nothing
 *   about more or less. It cannot rank.
 * - PLACE_CONTEXT — evidence about the land. Never evidence about an animal.
 */
export type MetricRole = "ABUNDANCE_SIGNAL" | "EFFORT_CONTEXT" | "EXTENT_ONLY" | "PLACE_CONTEXT";

export const METRIC_ROLES: Record<IntelligenceMetric, MetricRole> = {
  POPULATION_DENSITY: "ABUNDANCE_SIGNAL",
  POPULATION_ESTIMATE: "ABUNDANCE_SIGNAL",
  SURVEY_OBSERVATION: "ABUNDANCE_SIGNAL",
  HUNTER_SUCCESS_RATE: "ABUNDANCE_SIGNAL",
  HARVEST_PER_EFFORT: "ABUNDANCE_SIGNAL",
  HARVEST_PER_HUNTER: "ABUNDANCE_SIGNAL",
  HARVEST_TOTAL: "ABUNDANCE_SIGNAL",
  HABITAT_SUITABILITY: "ABUNDANCE_SIGNAL",
  /* The two that caused this version. */
  HUNTER_COUNT: "EFFORT_CONTEXT",
  HUNTER_DAYS: "EFFORT_CONTEXT",
  RANGE_PRESENCE: "EXTENT_ONLY",
  PUBLIC_LAND_AVAILABILITY: "PLACE_CONTEXT",
  ACCESS_OPPORTUNITY: "PLACE_CONTEXT",
};

/**
 * The declared relative weight of each contributing metric, and why.
 *
 * Ordered by how directly the metric measures the animal rather than the
 * hunting of it. A rate that carries its own denominator outranks a raw total,
 * because a raw total is as much a measure of how big and how hunted a unit is
 * as of how many animals live in it.
 *
 * A metric absent from a zone's evidence contributes nothing; the weights of
 * those PRESENT are renormalized to sum to one, and the applied set travels in
 * the result so a reader can see what actually decided the shade.
 */
export const METRIC_WEIGHTS: Record<IntelligenceMetric, number> = {
  POPULATION_DENSITY: 0.40,
  POPULATION_ESTIMATE: 0.30,
  SURVEY_OBSERVATION: 0.30,
  HUNTER_SUCCESS_RATE: 0.22,
  HARVEST_PER_EFFORT: 0.22,
  HARVEST_PER_HUNTER: 0.20,
  HARVEST_TOTAL: 0.12,
  HABITAT_SUITABILITY: 0.08,
  HUNTER_COUNT: 0,
  HUNTER_DAYS: 0,
  RANGE_PRESENCE: 0,
  PUBLIC_LAND_AVAILABILITY: 0,
  ACCESS_OPPORTUNITY: 0,
};

export const METRIC_MEANINGS: Record<IntelligenceMetric, string> = {
  HARVEST_TOTAL: "How many animals the authority reported were taken here. A record of hunting, not a count of animals.",
  HARVEST_PER_HUNTER: "Reported harvest divided by the active hunters the authority itself counted. Not a hunter-success probability.",
  HUNTER_SUCCESS_RATE: "The share of hunters who took an animal, as the authority published it.",
  HUNTER_COUNT: "How many hunters the authority counted here. A measure of hunting pressure, never of animals.",
  HUNTER_DAYS: "How many days hunters spent here, as the authority counted them. Effort, never animals.",
  HARVEST_PER_EFFORT: "Reported harvest divided by the hunter days the authority counted.",
  POPULATION_ESTIMATE: "The authority's own estimate of how many animals are here.",
  POPULATION_DENSITY: "The authority's own estimate of animals per square kilometre.",
  SURVEY_OBSERVATION: "What the authority's own survey observed here.",
  RANGE_PRESENCE: "That the species occurs somewhere within this area. Never more here than there.",
  HABITAT_SUITABILITY: "How closely the land resembles what this species uses. Suitable land is not an animal.",
  PUBLIC_LAND_AVAILABILITY: "How much of this area is public land. Context about the place, not the animal.",
  ACCESS_OPPORTUNITY: "How reachable this area is. Context about the place, not the animal.",
};

/** The metrics of a set of evidence that may move the intensity at all. */
export function contributingMetrics(metrics: readonly IntelligenceMetric[]): IntelligenceMetric[] {
  return [...new Set(metrics)].filter((metric) => METRIC_ROLES[metric] === "ABUNDANCE_SIGNAL" && METRIC_WEIGHTS[metric] > 0);
}

/**
 * The weights actually applied, renormalized over what is present and summing
 * to one. Empty when nothing present may contribute — which is a real answer,
 * and the caller must render it as "cannot be ranked", never as a low value.
 */
export function appliedWeights(metrics: readonly IntelligenceMetric[]): Map<IntelligenceMetric, number> {
  const contributing = contributingMetrics(metrics);
  const total = contributing.reduce((sum, metric) => sum + METRIC_WEIGHTS[metric], 0);
  const applied = new Map<IntelligenceMetric, number>();
  if (total <= 0) return applied;
  for (const metric of contributing) applied.set(metric, METRIC_WEIGHTS[metric] / total);
  return applied;
}

/**
 * How many INDEPENDENT values a set of evidence really holds.
 *
 * Not the number of metrics. British Columbia publishes three numbers per unit
 * — harvest, hunters, hunter days — and North Ground derives two more from
 * them. Counting metrics graded that ROBUST_DATA: five metrics, three facts,
 * two of them restatements of the other three. A derived rate cannot corroborate
 * the total it was divided from.
 *
 * So a metric that a declared derivation could have produced from other metrics
 * present here is not counted. What remains is what the authority independently
 * published.
 */
export function independentValueCount(metrics: readonly IntelligenceMetric[]): number {
  const present = new Set(metrics);
  let count = 0;
  for (const metric of present) {
    const derivation = DERIVATIONS.find((entry) => entry.produces === metric);
    const reconstructable = derivation
      && present.has(derivation.numerator)
      && (derivation.denominator === "AREA_SQUARE_KILOMETRES" || present.has(derivation.denominator as IntelligenceMetric));
    if (!reconstructable) count += 1;
  }
  return count;
}

/**
 * How well-evidenced a zone's shade is — a different question from how hot it is.
 *
 * §41B and the owner's brief both insist on this separation: a zone can be
 * ranked at the top of its dataset on one thin number, and a hunter shown that
 * shade without its strength is shown a confident hotspot built out of sparse
 * evidence. Intensity answers "compared with its peers, how does this rank";
 * strength answers "how much should you trust that".
 */
export type EvidenceStrength = "STRONG" | "MODERATE" | "WEAK" | "INSUFFICIENT";

export const STRENGTH_MEANINGS: Record<EvidenceStrength, string> = {
  STRONG: "Several independent measurements by the authority, and the strongest kind of evidence it publishes.",
  MODERATE: "More than one independent measurement, or one strong one.",
  WEAK: "A single independent measurement. The rank is real but thin; treat it as a hint, not a finding.",
  INSUFFICIENT: "Not enough independent evidence to rank this area at all.",
};

const CONFIDENCE_RANK: Record<EvidenceConfidence, number> = { HIGH: 3, MODERATE: 2, LOW: 1, UNKNOWN: 0 };

/**
 * How many INDEPENDENT FACTS ABOUT THE ANIMALS a set of evidence holds.
 *
 * Stricter than `independentValueCount`, and deliberately so — they answer
 * different questions. That one asks how much the authority published;
 * this one asks how many separate things are known about the animals.
 *
 * A rate whose NUMERATOR is already present adds no new animal fact, whether
 * or not its denominator is. British Columbia publishes harvest, hunters and
 * hunter days, and North Ground derives harvest per hunter and harvest per
 * hunter day. Three of those five are measurements of hunting effort or
 * divisions by it; the whole of what is known about the animals is ONE number,
 * the reported harvest. Counting the two rates as corroboration would let one
 * measurement vouch for itself twice.
 *
 * The consequence is that every dataset served today is WEAK, and that is the
 * true answer: today's map is one harvest figure per unit. The measure becomes
 * informative the moment an aerial survey or a population estimate arrives
 * beside it, which is exactly when a hunter should be told the ground changed.
 */
export function independentAbundanceCount(metrics: readonly IntelligenceMetric[]): number {
  const present = new Set(metrics);
  const abundance = [...present].filter((metric) => METRIC_ROLES[metric] === "ABUNDANCE_SIGNAL");
  return abundance.filter((metric) => {
    const derivation = DERIVATIONS.find((entry) => entry.produces === metric);
    return !derivation || !present.has(derivation.numerator);
  }).length;
}

/**
 * Strength from what is actually held: how many independent facts about the
 * animals, what kind of evidence they are, and how confident the authority
 * itself said they were.
 *
 * Deliberately never reads the intensity. The two must be computable from each
 * other's absence, or one will start standing in for the other.
 */
export function evidenceStrength(records: readonly Pick<EvidenceRecord, "metric" | "confidence">[]): EvidenceStrength {
  const contributing = records.filter((record) => METRIC_ROLES[record.metric] === "ABUNDANCE_SIGNAL");
  if (!contributing.length) return "INSUFFICIENT";
  const independent = independentAbundanceCount(contributing.map(({ metric }) => metric));
  if (!independent) return "INSUFFICIENT";
  const measured = contributing.some((record) => tierOfMetric(record.metric) === "T1_OFFICIAL_MEASURED");
  const modelled = contributing.some((record) => tierOfMetric(record.metric) === "T2_OFFICIAL_MODELLED");
  const worstConfidence = Math.min(...contributing.map((record) => CONFIDENCE_RANK[record.confidence]));

  if (independent >= 3 && (measured || modelled) && worstConfidence >= 2) return "STRONG";
  if (independent >= 2 && (measured || modelled) && worstConfidence >= 2) return "MODERATE";
  /* One independent fact is WEAK however confident the authority is about it.
     Confidence describes a measurement; strength describes how many there are,
     and a single number cannot be corroborated by being trusted. */
  return "WEAK";
}

export interface MethodologyRecord {
  id: string;
  version: string;
  effectiveFrom: string;
  statedAs: string;
  normalization: string;
  missingData: string;
  effort: string;
  confidence: string;
  limitations: readonly string[];
}

/**
 * The record behind "How is this calculated?". Fixed for a version; anything
 * about a particular species or place is assembled beside it, never inside it.
 */
export const OPPORTUNITY_METHODOLOGY: MethodologyRecord = {
  id: "methodology:species-heat",
  version: OPPORTUNITY_METHODOLOGY_VERSION,
  effectiveFrom: "2026-09-29",
  statedAs:
    "A zone's shade is its RANK against the other zones of the same authority's own dataset for the same species — not a count of animals, and not a density unless the authority itself published a density.",
  normalization:
    "Each published measurement is converted to a percentile rank within that dataset's zones, then combined with the declared weights of the measurements actually present, renormalized to sum to one.",
  missingData:
    "A zone with no certified evidence is not drawn at all. Missing evidence is never treated as zero, and no value is ever interpolated into a zone the authority did not report.",
  effort:
    "Hunter counts and hunter days are shown as context and never move the shade. How many people hunted somewhere measures roads, towns and tradition as much as it measures animals.",
  confidence:
    "How strongly a shade is evidenced is reported separately from how hot it is. A single thin measurement can rank high and still be weak evidence.",
  limitations: [
    "Every rank is relative to one dataset. Two jurisdictions' shades are not comparable with each other.",
    "Harvest evidence records past reported hunting, which is not a census and not a statement that animals are present now.",
    "The shade never states, implies or modifies hunting legality.",
  ],
} as const;

/**
 * The engineering grade of a species-and-place dataset, from the owner's brief.
 *
 * A — direct density or abundance; B — an official survey or population
 * estimate; C — official harvest or other indirect measurement; D — range,
 * habitat or occurrence only; E — nothing defensible.
 *
 * It grades the EVIDENCE, not the place. A grade C dataset is a good dataset;
 * it simply cannot be called population density, and this is where that is
 * recorded so that no legend has to decide it.
 */
export type EvidenceGrade = "A" | "B" | "C" | "D" | "E";

export const GRADE_MEANINGS: Record<EvidenceGrade, string> = {
  A: "Direct density or abundance measured by the authority.",
  B: "An official survey, population estimate or observation programme.",
  C: "Official harvest or effort records — indirect evidence about the animals.",
  D: "Range, habitat or occurrence extent only; it cannot rank one area above another.",
  E: "No defensible spatial evidence is held.",
};

export function evidenceGrade(metrics: readonly IntelligenceMetric[]): EvidenceGrade {
  const present = new Set(metrics);
  if (present.has("POPULATION_DENSITY")) return "A";
  if (present.has("POPULATION_ESTIMATE") || present.has("SURVEY_OBSERVATION")) return "B";
  if (
    present.has("HARVEST_TOTAL") || present.has("HARVEST_PER_HUNTER") || present.has("HARVEST_PER_EFFORT")
    || present.has("HUNTER_SUCCESS_RATE") || present.has("HUNTER_COUNT") || present.has("HUNTER_DAYS")
  ) return "C";
  if (present.has("RANGE_PRESENCE") || present.has("HABITAT_SUITABILITY")) return "D";
  return "E";
}
