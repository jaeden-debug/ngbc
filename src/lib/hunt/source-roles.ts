import type { SourceRecord } from "../content-contract/index.ts";
import type { HuntEvaluation } from "./types.ts";

/**
 * Which sources decided a Hunt answer, and which only support its context.
 *
 * A result cites two kinds of source. The rules and the zone boundary come from
 * the authority of the jurisdiction the point is in; they ARE the answer's
 * authority. Field notes and weather cite whatever supports them — an Ontario
 * page on moose biology can properly support an identification note anywhere.
 * Listing both as one set of "official sources" would present that Ontario page
 * as authority for a Québec answer, so every surface that names the answer's
 * authority reads it from here.
 */
export function partitionEvaluationSources(evaluation: Pick<HuntEvaluation, "sources" | "regulation" | "zone">): {
  authority: SourceRecord[];
  context: SourceRecord[];
} {
  const decisive = new Set<string>([...evaluation.regulation.sourceIds, evaluation.zone.sourceId]);
  const authority: SourceRecord[] = [];
  const context: SourceRecord[] = [];
  for (const source of evaluation.sources) (decisive.has(source.id) ? authority : context).push(source);
  return { authority, context };
}
