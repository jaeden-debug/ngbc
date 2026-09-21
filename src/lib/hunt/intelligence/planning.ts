import type { OpportunityResult } from "./types.ts";

export type CanonicalLegalState = "OPEN" | "CONDITIONAL" | "CLOSED" | "UNKNOWN" | "CONFLICT" | "NEEDS_VERIFICATION";

export interface PotentialAreaInput {
  opportunity: OpportunityResult | null;
  ownership: "PUBLIC" | "PRIVATE" | "UNKNOWN";
  access: "CONFIRMED" | "RESTRICTED" | "UNKNOWN";
  legalStatus: CanonicalLegalState;
  knownProhibition: boolean;
}

export interface PotentialAreaResult {
  state: "POTENTIAL_HUNTING_AREA" | "CHECK_THIS_AREA" | "NOT_A_CANDIDATE" | "INSUFFICIENT_DATA";
  reasons: string[];
  /** No derived planning result is itself a legal decision. */
  requiresHuntEvaluation: true;
}

export function derivePotentialArea(input: PotentialAreaInput): PotentialAreaResult {
  const reasons: string[] = [];
  if (input.knownProhibition || input.legalStatus === "CLOSED") {
    return { state: "NOT_A_CANDIDATE", reasons: [input.knownProhibition ? "A known prohibition applies." : "The canonical regulatory engine reports CLOSED."], requiresHuntEvaluation: true };
  }
  if (!input.opportunity || input.opportunity.coverage === "NO_HEAT_MAP_DATA") {
    return { state: "INSUFFICIENT_DATA", reasons: ["No species-opportunity evidence is available here."], requiresHuntEvaluation: true };
  }
  reasons.push(`${input.opportunity.classification.replaceAll("_", " ")} species-opportunity evidence.`);
  reasons.push(input.ownership === "PUBLIC" ? "Public/Crown ownership evidence is present; access and permission remain separate." : `Ownership is ${input.ownership.toLowerCase()}.`);
  reasons.push(input.access === "CONFIRMED" ? "A source-backed access feature is present." : `Access is ${input.access.toLowerCase()}.`);
  if (input.legalStatus === "OPEN" && input.ownership === "PUBLIC" && input.access === "CONFIRMED") {
    return { state: "POTENTIAL_HUNTING_AREA", reasons, requiresHuntEvaluation: true };
  }
  reasons.push(`Legal status is ${input.legalStatus}; run the full Hunt evaluation.`);
  return { state: "CHECK_THIS_AREA", reasons, requiresHuntEvaluation: true };
}
