/**
 * Which published rule is in force on a date, when later publications amend it.
 *
 * Regulation is layered. A state statute authorises a commission; the
 * commission adopts a regulation; an annual order or brochure states the
 * seasons; a correction notice fixes a printed row; an emergency order closes a
 * unit for a fire; a land manager closes a refuge. Scraping all of them and
 * letting the newest page win would let a brochure typo override a regulation,
 * and would erase what the law was last month.
 *
 * So an amendment is its own record, never an edit to the rule it amends. It
 * names what it changes, what it does, the interval it is in force, and the
 * authority that issued it. For any date, the rules in force are computed from
 * the original rules plus the amendments in force that day, by fixed
 * precedence:
 *
 *  1. An amendment applies only on dates inside its own effective interval.
 *     Outside it, the rule reads as originally published. Historical truth is
 *     never rewritten.
 *  2. An amendment can change a rule only if its issuing authority ranks at
 *     least as high as the authority the rule was stated by. A brochure
 *     correction can correct a brochure row; it cannot loosen a commission
 *     regulation. An amendment that tries is reported as a conflict, not
 *     applied.
 *  3. Two amendments in force on the same rule on the same date are resolved
 *     only by an explicit statement: the later one names the earlier in
 *     `supersedes`, or one outranks the other. Otherwise they conflict, and the
 *     engine answers CONFLICT rather than choosing — publication order is not
 *     precedence.
 *  4. A restriction (a closure) and a relaxation never cancel silently. A
 *     closure in force closes the rule for its interval whatever else applies,
 *     provided rule 2 allows its authority to act on the rule. The rule is kept
 *     with the closed days removed, so the place still reads CLOSED "by order"
 *     rather than UNKNOWN "no rule found".
 *
 * Jurisdiction-neutral: nothing here knows a state or province. Canada's
 * bundles carry no amendments and pass through unchanged.
 */

/**
 * The kind of instrument a rule or amendment is stated in, highest first.
 *
 * Ranks describe legal hierarchy, not recency. Where a state's instruments do
 * not map cleanly onto this list, its builder records the mapping with the
 * source text that justifies it; nothing is ranked by inference at runtime.
 */
export const AUTHORITY_LEVELS = [
  "FEDERAL_STATUTE",
  "FEDERAL_REGULATION",
  "STATE_STATUTE",
  /** Commission- or department-adopted rule with the force of law (administrative code, chapter regulation). */
  "STATE_REGULATION",
  /** An order issued under a regulation for a period: annual season order, emergency order, closure order. */
  "STATE_ORDER",
  /** The agency's published summary of the law (brochure, guide, booklet), and corrections to it. */
  "PUBLISHED_SUMMARY",
  /** A land manager's own rules for its land (refuge, park, base), where North Ground reads them. */
  "LAND_MANAGER",
] as const;

export type AuthorityLevel = (typeof AUTHORITY_LEVELS)[number];

export function authorityRank(level: AuthorityLevel): number {
  // Lower index is higher authority; returned so that larger means stronger.
  return AUTHORITY_LEVELS.length - AUTHORITY_LEVELS.indexOf(level);
}

export interface RuleAuthority {
  level: AuthorityLevel;
  /** The instrument's own name ("Chapter 7, Elk Hunting Seasons", "2026 Big Game Brochure"). */
  instrument: string;
}

export interface DateWindow {
  opensIso: string;
  closesIso: string;
  statedAs?: string;
}

export type AmendmentEffect =
  /** No hunting under the rule during the amendment's interval (a closure). */
  | { kind: "CLOSE" }
  /** The rule is replaced for the interval by one with these windows (a correction of dates). */
  | { kind: "REPLACE_WINDOWS"; windows: DateWindow[] }
  /** The rule stops applying from `effective.from` onward (a later rule replaces it). */
  | { kind: "SUPERSEDE" };

export interface Amendment {
  id: string;
  /** Ids of the rules this amendment changes. Never a pattern; the builder resolves them. */
  amends: string[];
  effect: AmendmentEffect;
  /** Inclusive calendar days. `to` absent means until further notice. */
  effective: { from: string; to?: string };
  authority: RuleAuthority;
  /** Ids of earlier amendments this one expressly replaces. */
  supersedes?: string[];
  statedAs: string;
  sourceId: string;
  sourceSection: string;
}

export interface AmendableRule {
  id: string;
  windows: DateWindow[];
  /** Absent for rules built before authority was recorded; treated as a published summary. */
  authority?: RuleAuthority;
}

export interface AppliedAmendment {
  amendmentId: string;
  ruleId: string;
  effect: AmendmentEffect["kind"];
  statedAs: string;
  sourceId: string;
  sourceSection: string;
}

export interface AmendmentConflict {
  ruleId: string;
  amendmentIds: string[];
  statedAs: string;
}

export interface RulesInForce<R> {
  /** Rules as they read on the date, with any amended windows applied. */
  rules: R[];
  applied: AppliedAmendment[];
  /**
   * Rules whose reading on the date cannot be established without choosing
   * between sources. Each carries both readings in `alternatives`; the engine
   * evaluates both and answers CONFLICT where they differ.
   */
  conflicts: Array<AmendmentConflict & { alternatives: [R, R] }>;
  /** Amendments refused because their authority cannot change the rule. */
  refused: AmendmentConflict[];
}

function inForce(amendment: Amendment, date: string): boolean {
  return date >= amendment.effective.from && (amendment.effective.to === undefined || date <= amendment.effective.to);
}

const DEFAULT_AUTHORITY: RuleAuthority = { level: "PUBLISHED_SUMMARY", instrument: "unrecorded" };

function dayBefore(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function dayAfter(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * The windows with a closed interval taken out. A closure does not delete the
 * season: the rule still names this place, so the answer inside the closure is
 * CLOSED because an order closed it, not UNKNOWN because no rule was found.
 */
export function withoutInterval(windows: readonly DateWindow[], from: string, to?: string): DateWindow[] {
  const out: DateWindow[] = [];
  for (const window of windows) {
    if (window.closesIso < from || (to !== undefined && window.opensIso > to)) {
      out.push({ ...window });
      continue;
    }
    if (window.opensIso < from) out.push({ ...window, closesIso: dayBefore(from) });
    if (to !== undefined && window.closesIso > to) out.push({ ...window, opensIso: dayAfter(to) });
  }
  return out;
}

function withEffect<R extends AmendableRule>(rule: R, amendment: Pick<Amendment, "effect" | "effective">): R | null {
  if (amendment.effect.kind === "SUPERSEDE") return null;
  if (amendment.effect.kind === "CLOSE") return { ...rule, windows: withoutInterval(rule.windows, amendment.effective.from, amendment.effective.to) };
  return { ...rule, windows: amendment.effect.windows.map((window) => ({ ...window })) };
}

/**
 * The rules in force on `date`.
 *
 * Deterministic: the same rules, amendments and date always give the same
 * result, whatever order the amendments were supplied in.
 */
export function rulesInForce<R extends AmendableRule>(rules: readonly R[], amendments: readonly Amendment[], date: string): RulesInForce<R> {
  const byRule = new Map<string, Amendment[]>();
  const known = new Set(rules.map((rule) => rule.id));
  for (const amendment of [...amendments].sort((a, b) => a.id.localeCompare(b.id))) {
    for (const ruleId of amendment.amends) {
      if (!known.has(ruleId)) throw new Error(`Amendment ${amendment.id} names unknown rule ${ruleId}`);
      byRule.set(ruleId, [...(byRule.get(ruleId) ?? []), amendment]);
    }
  }

  const out: R[] = [];
  const applied: AppliedAmendment[] = [];
  const conflicts: RulesInForce<R>["conflicts"] = [];
  const refused: AmendmentConflict[] = [];

  for (const rule of rules) {
    const candidates = (byRule.get(rule.id) ?? []).filter((amendment) => inForce(amendment, date));
    if (!candidates.length) {
      out.push(rule);
      continue;
    }
    const ruleRank = authorityRank((rule.authority ?? DEFAULT_AUTHORITY).level);

    // Rule 2: an amendment from a lower authority cannot change the rule.
    const permitted: Amendment[] = [];
    for (const amendment of candidates) {
      if (authorityRank(amendment.authority.level) < ruleRank) {
        refused.push({
          ruleId: rule.id,
          amendmentIds: [amendment.id],
          statedAs:
            `${amendment.authority.instrument} would change a rule stated in ${(rule.authority ?? DEFAULT_AUTHORITY).instrument}, ` +
            "which ranks above it. North Ground does not apply it and treats the rule as disputed.",
        });
        continue;
      }
      permitted.push(amendment);
    }
    const refusedHere = refused.filter((entry) => entry.ruleId === rule.id);
    if (refusedHere.length && !permitted.length) {
      // The published rule stands, but a lower instrument disagrees with it: disputed, not silently kept.
      const alternative = withEffect(rule, candidates.find((amendment) => refusedHere.some((entry) => entry.amendmentIds.includes(amendment.id)))!);
      conflicts.push({
        ruleId: rule.id,
        amendmentIds: refusedHere.flatMap((entry) => entry.amendmentIds),
        statedAs: refusedHere.map((entry) => entry.statedAs).join(" "),
        alternatives: [rule, alternative ?? { ...rule, windows: [] }],
      });
      continue;
    }

    // Rule 4: a permitted closure or supersession wins over any relaxation in force with it.
    const superseding = permitted.find((amendment) => amendment.effect.kind === "SUPERSEDE");
    const closure = superseding ?? permitted.find((amendment) => amendment.effect.kind === "CLOSE");
    if (closure) {
      applied.push({
        amendmentId: closure.id, ruleId: rule.id, effect: closure.effect.kind,
        statedAs: closure.statedAs, sourceId: closure.sourceId, sourceSection: closure.sourceSection,
      });
      const closed = withEffect(rule, closure);
      if (closed) out.push(closed);
      continue;
    }

    // Rule 3: several replacements in force at once need an explicit order.
    const superseded = new Set(permitted.flatMap((amendment) => amendment.supersedes ?? []));
    const standing = permitted.filter((amendment) => !superseded.has(amendment.id));
    const strongest = Math.max(...standing.map((amendment) => authorityRank(amendment.authority.level)));
    const winners = standing.filter((amendment) => authorityRank(amendment.authority.level) === strongest);
    if (winners.length > 1) {
      const readings = winners.map((amendment) => withEffect(rule, amendment) ?? { ...rule, windows: [] });
      conflicts.push({
        ruleId: rule.id,
        amendmentIds: winners.map((amendment) => amendment.id),
        statedAs:
          `${winners.map((amendment) => amendment.authority.instrument).join(" and ")} each change this rule for the same date, ` +
          "and neither says it replaces the other.",
        alternatives: [readings[0], readings[1]],
      });
      continue;
    }
    const winner = winners[0];
    const amended = withEffect(rule, winner);
    applied.push({
      amendmentId: winner.id, ruleId: rule.id, effect: winner.effect.kind,
      statedAs: winner.statedAs, sourceId: winner.sourceId, sourceSection: winner.sourceSection,
    });
    if (amended) out.push(amended);
  }

  return { rules: out, applied, conflicts, refused };
}
