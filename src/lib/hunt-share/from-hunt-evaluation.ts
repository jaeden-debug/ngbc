import type { CanonicalId } from "../content-contract/index.ts";
import type { HuntEvaluation } from "../hunt/types.ts";
import { METHOD_LABELS, priceLine } from "../hunt/readiness/format.ts";
import { partitionEvaluationSources } from "../hunt/source-roles.ts";
import { HUNT_BRIEF_MAX_WARNINGS, type HuntBriefReadiness, type HuntShareProjectionInput } from "./model.ts";

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
 * Every warning, in the engine's order (regulatory requirements and
 * limitations before field notes). If there are more than a brief holds, the
 * last kept line says how many were left out, so a reader is never told less
 * than the answer said without knowing it.
 */
function boundedWarnings(warnings: string[]): string[] {
  if (warnings.length <= HUNT_BRIEF_MAX_WARNINGS) return warnings;
  const kept = warnings.slice(0, HUNT_BRIEF_MAX_WARNINGS - 1);
  const omitted = warnings.length - kept.length;
  return [...kept, `${omitted} further conditions and limitations are not shown in this brief. Check the current Hunt result for all of them.`];
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
    ...(evaluation.regulation.authorization
      ? {
          authorization: {
            requirement: evaluation.regulation.authorization.requirement,
            huntCodes: evaluation.regulation.authorization.huntCodes.slice(0, 8).map((huntCode) => ({
              code: huntCode.code,
              authorityTerm: huntCode.authorityTerm,
              allocationTerm: huntCode.allocation.authorityTerm,
              ...(huntCode.allocation.quota ? { quota: huntCode.allocation.quota.statedAs } : {}),
            })),
            draws: evaluation.regulation.authorization.draws.slice(0, 4).map((draw) => draw.statedAs),
            statedAs: evaluation.regulation.authorization.huntCodes[0].statedAs,
          },
        }
      : {}),
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
    warnings: boundedWarnings([
      ...zoneWarning,
      ...evaluation.regulation.requirements,
      ...evaluation.regulation.limitations.map((limitation) => limitation.text),
      ...identificationWarnings,
    ]),
    /* Only the sources that decided the answer. A field note's supporting page
       (an Ontario biology page behind a moose identification note) is not the
       authority for a Québec answer and never appears as one. */
    officialSources: partitionEvaluationSources(evaluation).authority
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
