import type { IntelligenceMetric } from "./types.ts";

/**
 * What KIND of evidence a record is, and therefore what it may be used to say.
 *
 * The five tiers coexist. They are not a queue in which a better tier replaces
 * a worse one: a management unit may hold measured harvest, a published
 * population estimate, a range polygon and a habitat model at the same time,
 * and each answers a different question. T1 does not delete T3; T4 never
 * becomes T1 by being drawn next to it.
 *
 * The tier is a property of how the number was produced, not of how good it
 * looks. It decides which CLAIMS the evidence can support, which is the only
 * thing that actually protects a hunter from a confident wrong answer.
 */
export type EvidenceTier =
  /** The authority counted or was reported something: harvest, hunters, effort, survey observations. */
  | "T1_OFFICIAL_MEASURED"
  /** The authority published an estimate from its own model: population, density, trend. */
  | "T2_OFFICIAL_MODELLED"
  /** An authority or published science states where the species occurs, and nothing more. */
  | "T3_OFFICIAL_EXTENT"
  /** North Ground derived it from published inputs, reproducibly: habitat suitability. */
  | "T4_DERIVED_HABITAT"
  /** Not about the animal at all: public land, access, land cover. Context for a hunter. */
  | "T5_CONTEXT";

/**
 * A statement the product might want to make about a place.
 *
 * Phrased as what a hunter would hear, because that is what has to be true.
 */
export type EvidenceClaim =
  /** "More was taken here than there." Comparative, within one measured programme. */
  | "ABUNDANCE_COMPARISON"
  /** "This many were reported taken here." The authority's own figure, restated. */
  | "HARVEST_RECORD"
  /** "The authority estimates this many animals, or this many per unit area." */
  | "POPULATION_ESTIMATE"
  /** "The species occurs here." Presence, with no quantity and no density. */
  | "PRESENCE_EXTENT"
  /** "The land here looks like what this species uses." Not a count, not a presence. */
  | "HABITAT_SUITABILITY"
  /** "Here is something about the place." Never about the animal. */
  | "CONTEXT_ONLY";

export interface EvidenceTierDefinition {
  tier: EvidenceTier;
  /** Ordering for the SAME claim only. A lower rank is not better at another tier's job. */
  rank: number;
  label: string;
  definition: string;
  /** Everything this tier may be used to say. Anything absent is refused, not hedged. */
  claims: readonly EvidenceClaim[];
  /** What a hunter must not be allowed to conclude from it. */
  cannotSay: string;
}

export const EVIDENCE_TIERS: Record<EvidenceTier, EvidenceTierDefinition> = {
  T1_OFFICIAL_MEASURED: {
    tier: "T1_OFFICIAL_MEASURED",
    rank: 1,
    label: "Measured and reported by the authority",
    definition: "Counts the authority collected or received: harvest, active hunters, hunter days, survey observations.",
    claims: ["HARVEST_RECORD", "ABUNDANCE_COMPARISON", "PRESENCE_EXTENT"],
    cannotSay: "A harvest figure is a record of hunting, not a count of the animals that live there.",
  },
  T2_OFFICIAL_MODELLED: {
    tier: "T2_OFFICIAL_MODELLED",
    rank: 2,
    label: "Estimated by the authority",
    definition: "The authority's own published estimate, produced by its own model or survey design.",
    claims: ["POPULATION_ESTIMATE", "ABUNDANCE_COMPARISON", "PRESENCE_EXTENT"],
    cannotSay: "An estimate is not a count, and its precision is the model's, not the map's.",
  },
  T3_OFFICIAL_EXTENT: {
    tier: "T3_OFFICIAL_EXTENT",
    rank: 3,
    label: "Known range",
    definition: "A published statement of where the species occurs, at the extent the publisher drew it.",
    claims: ["PRESENCE_EXTENT"],
    cannotSay: "Range says occurs somewhere in here. It never says more here than there.",
  },
  T4_DERIVED_HABITAT: {
    tier: "T4_DERIVED_HABITAT",
    rank: 4,
    label: "North Ground habitat model",
    definition: "Derived by North Ground from published inputs, with every input, weight and version recorded.",
    claims: ["HABITAT_SUITABILITY"],
    cannotSay: "Suitable habitat is not presence, not abundance and not density.",
  },
  T5_CONTEXT: {
    tier: "T5_CONTEXT",
    rank: 5,
    label: "Context about the place",
    definition: "Land, access and cover information that helps a hunter plan. It is not evidence about the animal.",
    claims: ["CONTEXT_ONLY"],
    cannotSay: "Public land is not permission, and an access road is not an animal.",
  },
};

/** Which tier a metric belongs to. A new metric adds a row; there is no default. */
export const METRIC_TIERS: Record<IntelligenceMetric, EvidenceTier> = {
  HARVEST_TOTAL: "T1_OFFICIAL_MEASURED",
  HARVEST_PER_HUNTER: "T1_OFFICIAL_MEASURED",
  HUNTER_SUCCESS_RATE: "T1_OFFICIAL_MEASURED",
  HUNTER_COUNT: "T1_OFFICIAL_MEASURED",
  HUNTER_DAYS: "T1_OFFICIAL_MEASURED",
  HARVEST_PER_EFFORT: "T1_OFFICIAL_MEASURED",
  SURVEY_OBSERVATION: "T1_OFFICIAL_MEASURED",
  POPULATION_ESTIMATE: "T2_OFFICIAL_MODELLED",
  POPULATION_DENSITY: "T2_OFFICIAL_MODELLED",
  RANGE_PRESENCE: "T3_OFFICIAL_EXTENT",
  HABITAT_SUITABILITY: "T4_DERIVED_HABITAT",
  PUBLIC_LAND_AVAILABILITY: "T5_CONTEXT",
  ACCESS_OPPORTUNITY: "T5_CONTEXT",
};

export function tierOfMetric(metric: IntelligenceMetric): EvidenceTier {
  return METRIC_TIERS[metric];
}

/** Whether a tier may be used to make a claim. Absence is a refusal, not a weak yes. */
export function tierSupports(tier: EvidenceTier, claim: EvidenceClaim): boolean {
  return EVIDENCE_TIERS[tier].claims.includes(claim);
}

export interface ClaimRefusal {
  claim: EvidenceClaim;
  /** Tiers that were actually present, so the refusal can say what IS known. */
  tiersPresent: EvidenceTier[];
  reason: string;
}

/**
 * The strongest present tier that can carry a claim, or a refusal naming what is
 * there instead.
 *
 * Refusing returns the tiers that ARE present so the surface can say "range
 * only" rather than going blank, which reads to a hunter as "no animals".
 */
export function strongestTierFor(claim: EvidenceClaim, present: readonly EvidenceTier[]): EvidenceTier | ClaimRefusal {
  const tiersPresent = [...new Set(present)].sort((a, b) => EVIDENCE_TIERS[a].rank - EVIDENCE_TIERS[b].rank);
  const supporting = tiersPresent.filter((tier) => tierSupports(tier, claim));
  if (supporting.length) return supporting[0];
  return {
    claim,
    tiersPresent,
    reason: tiersPresent.length
      ? `No evidence here can support ${claim}. What is held is ${tiersPresent.map((tier) => EVIDENCE_TIERS[tier].label.toLowerCase()).join(", ")}.`
      : `No evidence here at all, which is not the same as none of this species being here.`,
  };
}

export function isClaimRefusal(value: EvidenceTier | ClaimRefusal): value is ClaimRefusal {
  return typeof value === "object";
}
