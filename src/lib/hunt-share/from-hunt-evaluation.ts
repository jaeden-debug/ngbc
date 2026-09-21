import type { CanonicalId } from "../content-contract/index.ts";
import type { HuntEvaluation } from "../hunt/types.ts";
import { METHOD_LABELS, priceLine } from "../hunt/readiness/format.ts";
import type { HuntBriefReadiness, HuntShareProjectionInput } from "./model.ts";

export interface HuntShareContext {
  jurisdiction: {
    id: CanonicalId<"jurisdiction">;
    displayName: string;
  };
  generalLocation?: {
    label: string;
    shareApproved: boolean;
  };
}

function verificationTimestamp(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value;
}

/**
 * The hunter's own answers, in the words the question used.
 *
 * Recorded so a shared result cannot be read as universal: a deer season that
 * opens for a resident with a shotgun is not the same season for anyone else,
 * and the snapshot has to say which hunt it described. Values are mapped back to
 * the option labels the dimension offered, so the brief reads as the question
 * and answer a person actually saw rather than as internal codes. Anything not
 * offered by the dimension is dropped rather than shown.
 */
function shareableAssumptions(evaluation: HuntEvaluation): Array<{ question: string; answer: string }> {
  const answers = evaluation.input.answers;
  if (!answers) return [];
  const assumptions: Array<{ question: string; answer: string }> = [];
  for (const dimension of evaluation.dimensions) {
    const value = (answers as Record<string, unknown>)[dimension.id];
    if (typeof value !== "string") continue;
    const option = dimension.options.find((candidate) => candidate.value === value);
    if (!option) continue;
    assumptions.push({ question: dimension.question, answer: option.label });
  }
  return assumptions;
}

/**
 * Ready to Hunt, compacted for a brief: what to hold, whether orange applies,
 * and which methods are legal. No purchase links, vendors or recommendations —
 * those are for the person planning, not for whoever the brief is sent to, and a
 * vendor search's location must never leave the device that made it.
 */
function shareableReadiness(evaluation: HuntEvaluation): HuntBriefReadiness | undefined {
  const readiness = evaluation.readiness;
  if (!readiness) return undefined;
  return {
    coverage: readiness.coverage,
    jurisdictionName: readiness.jurisdictionName,
    officialInfoUrl: readiness.officialInfoUrl.startsWith("https://") ? readiness.officialInfoUrl : undefined,
    authorizations: readiness.authorizations.slice(0, 12).map((item) => ({
      status: item.status,
      name: item.officialName,
      authority: item.authority,
      condition: item.conditionText,
      fee: priceLine(item.price),
    })),
    orange: readiness.orange ? { status: readiness.orange.status, summary: readiness.orange.summary } : undefined,
    legalMethods: (readiness.methods?.allowed ?? []).slice(0, 8).map((method) =>
      method.restriction ? `${METHOD_LABELS[method.method]}: ${method.restriction}` : METHOD_LABELS[method.method]),
  };
}

/**
 * Projects the regulatory engine's result without re-evaluating or simplifying it.
 * Coordinates and map geometry are intentionally not copied.
 */
export function huntEvaluationToShareInput(
  evaluation: HuntEvaluation,
  context: HuntShareContext,
): HuntShareProjectionInput {
  const identificationWarnings = evaluation.knowledge.blocks
    .filter(({ block }) => block.type === "identification_warning" || block.type === "safety_note")
    .map(({ block }) => block.content.plainText);
  const zoneWarning = evaluation.zone.nearBoundary || evaluation.zone.status !== "RESOLVED"
    ? [evaluation.zone.message]
    : [];

  return {
    species: {
      id: evaluation.species.id,
      displayName: evaluation.species.name,
    },
    jurisdiction: context.jurisdiction,
    managementZone:
      evaluation.zone.zoneId && evaluation.zone.officialName
        ? {
            id: evaluation.zone.zoneId,
            displayName: evaluation.zone.officialName,
          }
        : undefined,
    selectedDate: evaluation.input.date,
    assumptions: shareableAssumptions(evaluation),
    location: context.generalLocation
      ? {
          generalLabel: context.generalLocation.label,
          shareApproved: context.generalLocation.shareApproved,
        }
      : undefined,
    regulatory: {
      status: evaluation.regulation.status,
      summary: evaluation.regulation.summary,
      verifiedAt: verificationTimestamp(evaluation.regulation.verifiedAt),
      season: evaluation.regulation.season,
    },
    legalTime: {
      status: evaluation.regulation.legalTime.status,
      summary: evaluation.regulation.legalTime.text,
      verified: evaluation.regulation.legalTime.status === "RULE_ONLY",
      verifiedAt:
        evaluation.regulation.legalTime.status === "RULE_ONLY"
          ? verificationTimestamp(evaluation.regulation.verifiedAt)
          : undefined,
    },
    weather:
      evaluation.weather.status === "AVAILABLE"
        ? {
            status: "available",
            summary: evaluation.weather.summary,
            asOf: evaluation.evaluatedAt,
            validFor: evaluation.weather.date,
          }
        : {
            status: evaluation.weather.status === "PROVIDER_ERROR" ? "provider_error" : "unavailable",
            reason: evaluation.weather.summary,
          },
    warnings: [
      ...zoneWarning,
      ...evaluation.regulation.requirements,
      ...evaluation.regulation.limitations,
      ...identificationWarnings,
    ].slice(0, 8),
    officialSources: evaluation.sources
      .filter((source) => source.type === "official")
      .map((source) => ({
        id: source.id,
        authority: source.authority ?? source.publisher,
        title: source.title,
        url: source.url,
        verifiedAt: source.retrievedAt,
        effectiveDate:
          source.effectiveFrom && source.effectiveThrough
            ? `${source.effectiveFrom}–${source.effectiveThrough}`
            : source.effectiveFrom ?? source.effectiveThrough,
      })),
    readiness: shareableReadiness(evaluation),
    resourceReferences: [
      {
        id: evaluation.species.id,
        title: evaluation.species.name,
        href: evaluation.species.canonicalPath,
      },
    ],
  };
}
