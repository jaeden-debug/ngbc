import type { IntelligenceCoverage, TemporalApplicability } from "./applicability.ts";
import { COVERAGE_EXPLANATIONS, coverageIsPaintable, mayShow } from "./applicability.ts";
import type { EvidenceClaim, EvidenceTier } from "./evidence-ladder.ts";
import { EVIDENCE_TIERS, tierSupports } from "./evidence-ladder.ts";
import type { SpatialResolution } from "./spatial-precision.ts";
import { describeResolution, permitsVisualisationAt } from "./spatial-precision.ts";
import type { IntelligenceMetric } from "./types.ts";

/**
 * Choosing what to draw, and being able to say why.
 *
 * The selection is not "the best data we have". It is the best data that can
 * carry the CLAIM being made, at the resolution being drawn, on the date being
 * asked about. A candidate can be the finest, freshest thing North Ground holds
 * and still be the wrong answer — a habitat model is better data than a range
 * polygon and cannot be used to say the species occurs somewhere.
 *
 * Every rejection is kept. The explanatory record is built from the same
 * decision that produced the picture, so "Why am I seeing this?" cannot drift
 * away from what was actually shown. A separate explanation written by hand
 * would be a second truth, and the blueprint has one.
 *
 * Server-side by design. A selection reads licences and registries and returns
 * only what a viewport needs; national evidence never reaches the browser.
 */

export interface LayerCandidate {
  datasetId: string;
  tier: EvidenceTier;
  metrics: readonly IntelligenceMetric[];
  resolution: SpatialResolution;
  coverage: IntelligenceCoverage;
  applicability: TemporalApplicability;
  authority: string;
  title: string;
  sourceUrl: string;
  attribution: string | null;
  /** The freshest observation this programme publishes, for the record's wording. */
  observedThrough?: string;
}

/**
 * What a viewport asks for.
 *
 * Bounds are part of the question, not an optimisation applied afterwards.
 * Canada's overview payload is already near its budget, so an intelligence
 * layer that answered nationally and filtered in the browser would be
 * unshippable on a phone before it was written.
 */
export interface LayerRequest {
  speciesId: string;
  claim: EvidenceClaim;
  /** The resolution the map intends to draw at, which the evidence must permit. */
  drawAt: SpatialResolution;
  onDate: string;
  bounds: { west: number; south: number; east: number; north: number };
  /** Hard ceiling on features returned; an over-large answer is refused, not truncated silently. */
  maxFeatures: number;
}

export interface CandidateRejection {
  datasetId: string;
  reason: string;
}

export interface LayerSelection {
  chosen: LayerCandidate | null;
  rejected: CandidateRejection[];
  /** Coverage of the answer as a whole, so an empty map still says something true. */
  coverage: IntelligenceCoverage;
  message: string;
}

/**
 * The best candidate for one claim at one resolution, and why each other was
 * not it.
 *
 * Ordered by tier rank among those that pass, so the strongest evidence that
 * can carry the claim wins. Nothing here mixes tiers into a composite: a
 * composite is a methodology with its own version, not a side effect of
 * selection.
 */
export function selectLayer(candidates: readonly LayerCandidate[], request: LayerRequest): LayerSelection {
  const rejected: CandidateRejection[] = [];
  const eligible: LayerCandidate[] = [];

  for (const candidate of candidates) {
    if (!tierSupports(candidate.tier, request.claim)) {
      rejected.push({
        datasetId: candidate.datasetId,
        reason: `${EVIDENCE_TIERS[candidate.tier].label} cannot support ${request.claim}. ${EVIDENCE_TIERS[candidate.tier].cannotSay}`,
      });
      continue;
    }
    if (!coverageIsPaintable(candidate.coverage)) {
      rejected.push({ datasetId: candidate.datasetId, reason: COVERAGE_EXPLANATIONS[candidate.coverage] });
      continue;
    }
    if (!mayShow(candidate.applicability)) {
      rejected.push({
        datasetId: candidate.datasetId,
        reason: candidate.applicability === "NOT_YET_EFFECTIVE"
          ? `Does not apply until after ${request.onDate}.`
          : "Carries no usable dates, so it cannot be placed in time.",
      });
      continue;
    }
    const verdict = permitsVisualisationAt(candidate.resolution, request.drawAt);
    if (!verdict.permitted) {
      rejected.push({ datasetId: candidate.datasetId, reason: verdict.reason });
      continue;
    }
    eligible.push(candidate);
  }

  if (!eligible.length) {
    // Never blank. A hunter reading an empty map concludes there are no animals.
    const coverage: IntelligenceCoverage = candidates.length ? "PARTIAL" : "IN_RESEARCH";
    return {
      chosen: null,
      rejected,
      coverage,
      message: candidates.length
        ? "Nothing North Ground holds here can answer this at the resolution shown. What is held, and why it was not used, is listed."
        : COVERAGE_EXPLANATIONS.IN_RESEARCH,
    };
  }

  const chosen = [...eligible].sort((a, b) => EVIDENCE_TIERS[a.tier].rank - EVIDENCE_TIERS[b.tier].rank)[0];
  for (const candidate of eligible) {
    if (candidate !== chosen) {
      rejected.push({ datasetId: candidate.datasetId, reason: `Superseded for this question by stronger evidence (${EVIDENCE_TIERS[chosen.tier].label.toLowerCase()}). It remains available on its own terms.` });
    }
  }
  return { chosen, rejected, coverage: chosen.coverage, message: COVERAGE_EXPLANATIONS[chosen.coverage] };
}

/**
 * "Why am I seeing this?" — one record, produced by the selection itself.
 *
 * Reusable across the Specie Heat Map, a zone card, a Potential Hunting Area
 * and any future layer, because every one of them owes a hunter the same six
 * answers: what this is, where it came from, when it was measured, how finely
 * it actually describes the ground, what it cannot tell you, and what was not
 * used.
 */
export interface EvidenceExplanation {
  /** The claim in plain words, never a metric name. */
  showing: string;
  tier: EvidenceTier;
  tierLabel: string;
  authority: string;
  title: string;
  sourceUrl: string;
  attribution: string | null;
  measured: string;
  resolution: string;
  /** The tier's own limit, restated where the hunter is looking at it. */
  cannotTellYou: string;
  coverage: IntelligenceCoverage;
  coverageMeans: string;
  /** Everything considered and not used, so the absence is accountable. */
  notUsed: CandidateRejection[];
  /** Always. Opportunity and legality never meet in one field. */
  legalStatus: null;
}

const CLAIM_WORDS: Record<EvidenceClaim, string> = {
  ABUNDANCE_COMPARISON: "how this area compares with others on the evidence available",
  HARVEST_RECORD: "what the authority reported was taken here",
  POPULATION_ESTIMATE: "the authority's own estimate of the population here",
  PRESENCE_EXTENT: "where this species is known to occur",
  HABITAT_SUITABILITY: "where the land resembles what this species uses",
  CONTEXT_ONLY: "context about the place itself, not about the animals",
};

export function explainSelection(selection: LayerSelection, request: LayerRequest, measured: string): EvidenceExplanation | null {
  const { chosen } = selection;
  if (!chosen) return null;
  return {
    showing: CLAIM_WORDS[request.claim],
    tier: chosen.tier,
    tierLabel: EVIDENCE_TIERS[chosen.tier].label,
    authority: chosen.authority,
    title: chosen.title,
    sourceUrl: chosen.sourceUrl,
    attribution: chosen.attribution,
    measured,
    resolution: `Drawn at ${describeResolution(request.drawAt)}; measured at ${describeResolution(chosen.resolution)}.`,
    cannotTellYou: EVIDENCE_TIERS[chosen.tier].cannotSay,
    coverage: chosen.coverage,
    coverageMeans: COVERAGE_EXPLANATIONS[chosen.coverage],
    notUsed: selection.rejected,
    legalStatus: null,
  };
}
