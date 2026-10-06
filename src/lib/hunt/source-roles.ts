import type { SourceRecord } from "../content-contract/index.ts";
import type { HuntEvaluation } from "./types.ts";

/**
 * Which sources decided a Hunt answer, which only placed its point, and which
 * only support its context.
 *
 * A result cites three kinds of source. The rules and the zone boundary come
 * from the authority of the jurisdiction the point is in; they ARE the
 * answer's authority. A point that has no zone was PLACED in its jurisdiction
 * by a boundary that is not a hunting boundary at all — the U.S. Census
 * Bureau's cartographic state line (§41A, "Resolving inside a jurisdiction is
 * not drawing its boundary") — and that boundary decided where, never what.
 * Field notes and weather cite whatever supports them — an Ontario page on
 * moose biology can properly support an identification note anywhere.
 *
 * Listing them as one set of "official sources" would present that Ontario
 * page as authority for a Québec answer, and the Census line as a zone
 * boundary for an Iowa one. So every surface that names the answer's authority
 * reads it from here, and the placement is never among it — whatever cites it.
 */
export interface EvaluationSourceGroups {
  /** What decided the answer: the rules and, where there is one, the zone boundary. */
  authority: SourceRecord[];
  /**
   * What placed a point that has no zone in its jurisdiction. Shown beside its
   * own label (`placementLabel`), never among what decided the answer.
   */
  placement: SourceRecord[];
  /** Behind field notes and weather; never authority for the answer. */
  context: SourceRecord[];
}

export function partitionEvaluationSources(evaluation: Pick<HuntEvaluation, "sources" | "regulation" | "zone">): EvaluationSourceGroups {
  const placing = new Set<string>(
    [evaluation.zone.jurisdictionScope?.boundary.sourceId].filter((id) => Boolean(id)) as string[],
  );
  const decisive = new Set<string>(
    [...evaluation.regulation.sourceIds, evaluation.zone.sourceId].filter((id) => Boolean(id) && !placing.has(id as string)) as string[],
  );
  const groups: EvaluationSourceGroups = { authority: [], placement: [], context: [] };
  for (const source of evaluation.sources) {
    (placing.has(source.id) ? groups.placement : decisive.has(source.id) ? groups.authority : groups.context).push(source);
  }
  return groups;
}

/**
 * The words beside a placement source, wherever it is shown: what it is, and
 * that it is not a hunting boundary and did not decide the answer. Null where
 * the point was placed by a zone, which is itself among the authority.
 */
export function placementLabel(evaluation: Pick<HuntEvaluation, "zone">): string | null {
  const scope = evaluation.zone.jurisdictionScope;
  if (!scope) return null;
  const described = scope.boundary.describedAs;
  return `What placed this point: ${described}. It is not a hunting boundary, and it did not decide this answer.`;
}

/** The heading over what decided the answer — "the zone boundary" only where there is a zone. */
export function authorityLabel(evaluation: Pick<HuntEvaluation, "zone">): string {
  return evaluation.zone.jurisdictionScope
    ? "What decided this answer: the rules."
    : "What decided this answer: the rules and the zone boundary.";
}
