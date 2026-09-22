/**
 * How a licence to hunt is allocated, kept apart from whether a season is open.
 *
 * Two questions that must never be merged:
 *
 *   REGULATORY AVAILABILITY — is there a season here, today, for this species
 *   and method, and under which hunt code or licence?
 *
 *   PERSONAL ENTITLEMENT — does this person hold the licence, tag or permit that
 *   season requires?
 *
 * North Ground can answer the first from the authority's own publications. It
 * can never answer the second: it cannot see who applied, who drew, or what is
 * in anyone's wallet. So an allocation describes how the authorization is
 * obtained and what state that process is in on a date — "applications closed
 * on 7 April; results are due by 29 May" — and the answer is phrased as
 * conditional on holding it. A draw-only season is DRAW REQUIRED, never CLOSED:
 * the season exists, and whether it is open to a given person is theirs to know.
 *
 * Jurisdiction-neutral. Colorado's limited licences, Idaho's controlled hunts,
 * Wyoming's limited-quota licence types and Alberta's special licences are all
 * DRAW; an over-the-counter licence is OVER_THE_COUNTER whatever a state calls
 * it, and the state's own term is always kept alongside.
 */

export type AllocationMethod =
  /** A licence anyone eligible may buy, with no quota on the hunt. */
  | "OVER_THE_COUNTER"
  /** Sold over the counter until a published cap is reached. */
  | "OVER_THE_COUNTER_CAPPED"
  /** The general licence or tag a state issues for its general seasons. */
  | "GENERAL"
  /** Issued only through a draw; the quota is fixed and published. */
  | "DRAW";

export interface Quota {
  /** The published number, or null where the authority states the quota another way. */
  count: number | null;
  /** The authority's words ("100 licences", "Unlimited", "20% nonresident cap"). */
  statedAs: string;
  sourceSection: string;
}

export interface Allocation {
  method: AllocationMethod;
  /** The state's own name for the authorization ("limited licence", "controlled hunt tag", "Type 1 license"). */
  authorityTerm: string;
  quota?: Quota;
  /** The draw that issues it, when method is DRAW (or a capped sale that follows a draw). */
  drawCycleId?: string;
  /** Whether licences left after the draw are sold, as the authority states it. */
  leftover?: { available: boolean; statedAs: string };
}

/**
 * One published draw: its application window, results and any later rounds.
 * Every date is a calendar day in the jurisdiction, from the authority's own
 * calendar, with the words it used.
 */
export interface DrawCycle {
  id: string;
  /** The authority's name for it ("2026 Big Game Primary Draw", "Controlled hunt drawing"). */
  name: string;
  applicationOpens?: string;
  applicationCloses: string;
  /** The date results are published by, where the authority states one. */
  resultsBy?: string;
  secondRound?: { name: string; applicationOpens?: string; applicationCloses: string; resultsBy?: string };
  /** When unallocated licences go on sale, where the authority states one. */
  leftoverSaleOpens?: string;
  statedAs: string;
  sourceId: string;
  sourceSection: string;
}

export type DrawPhase =
  | "BEFORE_APPLICATIONS"
  | "APPLICATIONS_OPEN"
  /** Applications have closed and results are not yet due. */
  | "DRAW_CLOSED"
  | "RESULTS_PUBLISHED"
  | "SECOND_ROUND_OPEN"
  | "LEFTOVER_SALE";

export interface DrawState {
  cycleId: string;
  phase: DrawPhase;
  /** A sentence a hunter can act on, built only from published dates. */
  statedAs: string;
  sourceId: string;
  sourceSection: string;
}

function readable(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${months[month - 1]} ${day}, ${year}`;
}

/**
 * Where a draw stands on a calendar day.
 *
 * The phase describes the authority's process, never the hunter: "results
 * published" does not mean this person was drawn. Dates compare as calendar
 * days (ISO strings), so no time zone can move a phase boundary.
 */
export function drawStateOn(cycle: DrawCycle, date: string): DrawState {
  const base = { cycleId: cycle.id, sourceId: cycle.sourceId, sourceSection: cycle.sourceSection };
  if (cycle.leftoverSaleOpens && date >= cycle.leftoverSaleOpens) {
    return { ...base, phase: "LEFTOVER_SALE", statedAs: `Licences left after the ${cycle.name} went on sale ${readable(cycle.leftoverSaleOpens)}, where any remain.` };
  }
  const second = cycle.secondRound;
  if (second && date <= second.applicationCloses && (!second.applicationOpens || date >= second.applicationOpens)) {
    return { ...base, phase: "SECOND_ROUND_OPEN", statedAs: `Applications for the ${second.name} close ${readable(second.applicationCloses)}.` };
  }
  if (cycle.resultsBy && date >= cycle.resultsBy) {
    return { ...base, phase: "RESULTS_PUBLISHED", statedAs: `Results of the ${cycle.name} were due by ${readable(cycle.resultsBy)}. Only the authority can confirm whether you drew.` };
  }
  if (date > cycle.applicationCloses) {
    return {
      ...base,
      phase: "DRAW_CLOSED",
      statedAs: `Applications for the ${cycle.name} closed ${readable(cycle.applicationCloses)}` +
        (cycle.resultsBy ? `; results are due by ${readable(cycle.resultsBy)}.` : "."),
    };
  }
  if (cycle.applicationOpens && date < cycle.applicationOpens) {
    return { ...base, phase: "BEFORE_APPLICATIONS", statedAs: `Applications for the ${cycle.name} open ${readable(cycle.applicationOpens)} and close ${readable(cycle.applicationCloses)}.` };
  }
  return { ...base, phase: "APPLICATIONS_OPEN", statedAs: `Applications for the ${cycle.name} are open until ${readable(cycle.applicationCloses)}.` };
}

/**
 * The one sentence every answer under a draw-allocated hunt carries.
 * Worded so it cannot be read as "you can hunt".
 */
export function entitlementStatement(allocation: Allocation, huntCode?: string, huntCodeTerm = "hunt code"): string {
  const under = huntCode ? ` under ${huntCodeTerm} ${huntCode}` : "";
  switch (allocation.method) {
    case "DRAW":
      return `This season is open${under} only to holders of a ${allocation.authorityTerm} issued through the draw. North Ground cannot see whether you applied, were drawn, or hold one.`;
    case "OVER_THE_COUNTER_CAPPED":
      return `This season is open${under} to holders of a ${allocation.authorityTerm}, sold over the counter until its published cap is reached. North Ground has not verified that you hold one.`;
    case "OVER_THE_COUNTER":
      return `This season is open${under} to holders of a ${allocation.authorityTerm}, sold over the counter. North Ground has not verified that you hold one.`;
    case "GENERAL":
      return `This season is open${under} to holders of a ${allocation.authorityTerm}. North Ground has not verified that you hold one.`;
  }
}

/**
 * What an answer says about authorization, separately from its status.
 *
 * Carried on a regulatory result whenever the seasons it rests on are
 * allocated per hunt code or by draw. `entitlementVerified` is the literal
 * `false`: the type admits no other value, so no result can ever claim North
 * Ground verified what a person holds.
 */
export interface AuthorizationContext {
  /** DRAW_REQUIRED when every season cited needs a drawn licence; MIXED when some do. */
  requirement: "GENERAL_LICENCE" | "OVER_THE_COUNTER" | "DRAW_REQUIRED" | "MIXED";
  huntCodes: Array<{
    code: string;
    authorityTerm: string;
    allocation: { method: AllocationMethod; authorityTerm: string; quota?: Quota };
    requiresAuthorizations: string[];
    statedAs: string;
    sourceId: string;
    sourceSection: string;
  }>;
  draws: DrawState[];
  entitlementVerified: false;
}

export function authorizationContext(
  huntCodes: ReadonlyArray<{
    code: string;
    authorityTerm: string;
    allocation: Allocation;
    requiresAuthorizations: string[];
    sourceId: string;
    sourceSection: string;
  }>,
  cycles: readonly DrawCycle[],
  date: string,
): AuthorizationContext | undefined {
  if (!huntCodes.length) return undefined;
  const methods = new Set(huntCodes.map((huntCode) => huntCode.allocation.method));
  const requirement: AuthorizationContext["requirement"] =
    methods.size > 1 ? (methods.has("DRAW") ? "MIXED" : methods.has("GENERAL") ? "GENERAL_LICENCE" : "OVER_THE_COUNTER")
      : methods.has("DRAW") ? "DRAW_REQUIRED"
        : methods.has("GENERAL") ? "GENERAL_LICENCE"
          : "OVER_THE_COUNTER";
  const cycleIds = [...new Set(huntCodes.map((huntCode) => huntCode.allocation.drawCycleId).filter((id): id is string => Boolean(id)))].sort();
  const draws = cycleIds.map((id) => {
    const cycle = cycles.find((candidate) => candidate.id === id);
    if (!cycle) throw new Error(`Hunt code refers to unknown draw ${id}`);
    return drawStateOn(cycle, date);
  });
  return {
    requirement,
    huntCodes: [...huntCodes]
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((huntCode) => ({
        code: huntCode.code,
        authorityTerm: huntCode.authorityTerm,
        allocation: {
          method: huntCode.allocation.method,
          authorityTerm: huntCode.allocation.authorityTerm,
          ...(huntCode.allocation.quota ? { quota: huntCode.allocation.quota } : {}),
        },
        requiresAuthorizations: [...huntCode.requiresAuthorizations],
        statedAs: entitlementStatement(huntCode.allocation, huntCode.code, huntCode.authorityTerm),
        sourceId: huntCode.sourceId,
        sourceSection: huntCode.sourceSection,
      })),
    draws,
    entitlementVerified: false,
  };
}
