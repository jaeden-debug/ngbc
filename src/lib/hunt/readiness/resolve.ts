import type {
  ApplicabilityCondition, AuthorizationChecklistItem, AuthorizationId, AuthorizationRecord,
  AuthorizationRequirement, MethodClass, Price, PriceState,
} from "./types.ts";

/**
 * Jurisdiction-neutral composition: requirements + records + the hunter's own
 * answers → the authorizations this hunt needs.
 *
 * Nothing here knows which province or state it is serving. Ontario's Outdoors
 * Card + small game licence + turkey tag and a U.S. state's licence + stamp +
 * federal duck stamp resolve through the same three rules:
 *
 *   A requirement whose condition the answers satisfy is REQUIRED.
 *   One whose condition turns on a fact nobody has given is CONDITIONAL, and
 *     says which fact.
 *   One whose condition the answers rule out is not shown.
 *
 * A requirement naming an authorization North Ground has not described is kept
 * as UNKNOWN, never dropped — dropping it would read as "nothing needed".
 */

export interface HunterAnswers {
  RESIDENCY?: string;
  HUNT_METHOD?: string;
  TAG_TYPE?: string;
}

export interface ResolveContext {
  answers: HunterAnswers;
  /** The licence year in force today, in the jurisdiction's own calendar. */
  licenceYearToday: number;
  /**
   * A price variant the hunt itself decides — the season a turkey tag is for.
   * Variants the hunter chooses between (a 3-year licence) are kept as options.
   */
  seasonVariant?: string;
}

/**
 * Whether a hunter's ANSWER matches a condition.
 *
 * Its UNKNOWN is deliberately NOT the requirements model's NOT_CERTIFIED and
 * must not be renamed with it: this one means the hunter has not told us
 * something, which is a fact about the conversation. NOT_CERTIFIED means North
 * Ground holds no certified record, which is a fact about our data. Three
 * different UNKNOWNs live in this lane — this one, the certification state,
 * and RegulatoryStatus.UNKNOWN — and a blanket rename would merge them.
 */
type Match = "MATCH" | "NO_MATCH" | "UNKNOWN";

/**
 * How the engine's BOW answer maps onto the method classes a rule can name:
 * the engine asks "bow" and means any bow, crossbows included.
 */
function methodsOfAnswer(answer: string): MethodClass[] {
  return answer === "BOW" ? ["BOW", "CROSSBOW"] : [answer as MethodClass];
}

export function matchCondition(when: ApplicabilityCondition | undefined, answers: HunterAnswers): Match {
  if (!when) return "MATCH";
  const results: Match[] = [];
  if (when.residency?.length) {
    const answer = answers.RESIDENCY;
    results.push(!answer ? "UNKNOWN" : when.residency.includes(answer as never) ? "MATCH" : "NO_MATCH");
  }
  if (when.methods?.length) {
    const answer = answers.HUNT_METHOD;
    results.push(!answer ? "UNKNOWN" : methodsOfAnswer(answer).some((method) => when.methods!.includes(method)) ? "MATCH" : "NO_MATCH");
  }
  if (when.tagTypes?.length) {
    const answer = answers.TAG_TYPE;
    results.push(!answer ? "UNKNOWN" : when.tagTypes.includes(answer) ? "MATCH" : "NO_MATCH");
  }
  if (results.includes("NO_MATCH")) return "NO_MATCH";
  if (results.includes("UNKNOWN")) return "UNKNOWN";
  return "MATCH";
}

const SEASON_VARIANTS = new Set(["spring", "fall"]);

/**
 * The fee to show, or why none is shown.
 *
 * A fee is shown only when it is from the licence year in force and the
 * hunter's category is known. Where fees differ by residency and nobody has
 * said, the answer is one choice away — never both figures blended, and never
 * one guessed. Where North Ground holds no current fee, it says so.
 */
export function priceState(record: AuthorizationRecord, context: ResolveContext): PriceState {
  if (!record.prices.length) {
    return { kind: "CHECK_OFFICIAL", reason: "North Ground has not read a current official fee for this." };
  }
  const current = record.prices.filter((price) => price.licenceYear === context.licenceYearToday);
  if (!current.length) {
    const years = [...new Set(record.prices.map((price) => price.licenceYear))].join(", ");
    return {
      kind: "CHECK_OFFICIAL",
      reason: `The fee North Ground read is from the ${years} schedule, so it is not shown as current.`,
    };
  }

  let candidates: Price[] = current;
  if (context.seasonVariant && current.some((price) => price.variant && SEASON_VARIANTS.has(price.variant))) {
    candidates = candidates.filter((price) => !price.variant || !SEASON_VARIANTS.has(price.variant) || price.variant === context.seasonVariant);
  }

  const splitByResidency = candidates.some((price) => price.appliesTo.residency?.length);
  const residency = context.answers.RESIDENCY;
  if (splitByResidency && !residency) return { kind: "NEEDS_CATEGORY", dimension: "RESIDENCY" };
  if (residency) {
    candidates = candidates.filter((price) => !price.appliesTo.residency?.length || price.appliesTo.residency.includes(residency as never));
  }
  if (!candidates.length) return { kind: "CHECK_OFFICIAL", reason: "No published fee matches this hunter's category." };
  return { kind: "VERIFIED", prices: candidates };
}

interface RequirementEntry extends AuthorizationRequirement {
  alwaysConditional?: boolean;
}

export function resolveAuthorizations(
  requirements: RequirementEntry[],
  records: ReadonlyMap<string, AuthorizationRecord & { residencyNotes?: Record<string, { text: string }> }>,
  context: ResolveContext,
): AuthorizationChecklistItem[] {
  const shownIds = new Set<string>();
  const items: AuthorizationChecklistItem[] = [];

  for (const requirement of requirements) {
    const record = records.get(requirement.authorizationId);
    if (!record) {
      items.push({
        id: requirement.authorizationId,
        status: "NOT_CERTIFIED",
        officialName: "Authorization required — not yet described by North Ground",
        kind: "OTHER",
        authority: "Check the official source",
        conditionText: requirement.conditionText,
        price: { kind: "CHECK_OFFICIAL", reason: "North Ground has not described this authorization." },
        prerequisites: [],
        provenance: requirement.provenance ?? [],
      });
      shownIds.add(requirement.authorizationId);
      continue;
    }

    // The requirement's own condition and the record's applicability both count.
    const combined = [matchCondition(requirement.when, context.answers), matchCondition(record.appliesTo, context.answers)];
    if (combined.includes("NO_MATCH")) continue;
    const unknown = combined.includes("UNKNOWN");

    const residencyNote = context.answers.RESIDENCY ? record.residencyNotes?.[context.answers.RESIDENCY]?.text : undefined;
    items.push({
      id: record.id,
      status: unknown || requirement.alwaysConditional ? "CONDITIONAL" : "REQUIRED",
      officialName: record.officialName,
      kind: record.kind,
      authority: record.authority,
      ...(unknown || requirement.alwaysConditional ? { conditionText: requirement.conditionText } : {}),
      price: priceState(record, context),
      purchase: record.purchase,
      prerequisites: [],
      ...(record.draw ? { draw: record.draw } : {}),
      ...(record.note || residencyNote ? { note: [residencyNote, record.note].filter(Boolean).join(" ") } : {}),
      provenance: record.provenance,
    });
    shownIds.add(record.id);
  }

  // A prerequisite is named only when it is not already its own line — the
  // Outdoors Card is a line, so "requires an Outdoors Card" would repeat it.
  for (const item of items) {
    const record = records.get(item.id);
    if (!record) continue;
    item.prerequisites = record.prerequisites
      .filter((id) => !shownIds.has(id))
      .map((id) => ({ id: id as AuthorizationId, officialName: records.get(id)?.officialName ?? id }));
  }
  return items;
}
