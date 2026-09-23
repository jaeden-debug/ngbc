/**
 * Ready to Hunt requirements as STRUCTURE rather than as a checklist shape.
 *
 * This is the engine's output row: one statement about one requirement, in the
 * vocabulary every category shares (`Statement<T>`), carrying what a renderer
 * needs to show it truthfully and nothing it needs to decide anything.
 *
 * The rule the whole design exists to enforce, and the reason it is written
 * here rather than assumed:
 *
 *   **There is no safe direction for a requirement.** Adding one nobody
 *   imposed turns a hunter away; dropping one sends them out unlicensed. A
 *   legal-time window may be narrowed inward because waiting two minutes
 *   breaks no law — that asymmetry is justified by ITS failure directions and
 *   does not travel here. So no requirement gets a default in either
 *   direction: PROHIBITED needs positive evidence, NOT_CERTIFIED is the
 *   default, and neither is ever derived by subtraction.
 *
 * Nor are the failure directions uniform ACROSS requirement kinds, which is
 * why no single margin habit can be applied to all of them: a stricter licence
 * requirement is a false claim, a stricter hunter-orange requirement is
 * conservative advice dressed as law, and a stricter method prohibition is the
 * defect removed from `notAllowed` — three different wrongs.
 *
 * This is ADDITIVE. `RegulatoryResult.requirements` remains prose written by
 * five producers; nothing here replaces it, and the prose is retired only when
 * every producer has moved.
 */

import type {
  AuthorizationChecklistItem, AuthorizationKind, Provenance, Statement,
} from "./types.ts";

/** Marked so a renderer QUOTES an authority's words rather than paraphrasing. */
export interface AuthorityText {
  text: string;
  lang: "en-CA" | "fr-CA";
  owner: "AUTHORITY";
}

export type RequirementCategory =
  | "AUTHORIZATION" | "VISIBILITY" | "METHOD" | "AMMUNITION"
  | "SPECIES_CONDITION" | "PLACE_CONDITION" | "TIME_CONDITION";

export interface RequirementRow {
  /** Stable within a result: React keys, tests, and naming one row in a Brief. */
  id: string;
  category: RequirementCategory;
  /** The sub-kind within the category, for grouping only — never for display. */
  kind: AuthorizationKind | string;
  /** The authority's own name for the thing, never North Ground's paraphrase. */
  officialName: AuthorityText;
  statement: Statement<null>;
  /**
   * What must be held first, as references rather than prose, so a renderer
   * can nest them. A flat list implies independent purchases and a hunter buys
   * the wrong thing.
   *
   * Each entry carries its NAME as well as its id, because a prerequisite is
   * not always a row in the same result: Ontario's Outdoors Card requires the
   * Hunter Education Course, which is a record but not a line on this hunt's
   * checklist. An id alone would dangle, and a renderer given a pointer to
   * nothing either draws nothing or invents a label.
   *
   * The alternative — emitting the prerequisite as its own REQUIRED row —
   * would assert a requirement from the parent's provenance rather than from
   * a source that states it, which is the synthesis this model refuses
   * everywhere else.
   */
  requires: Array<{ id: string; officialName: AuthorityText }>;
  /** Where to obtain it. §41A: a checklist without this is half a checklist. */
  obtain?: { channels: string[]; infoUrl: string; onlineUrl?: string; phone?: string; note?: string };
  /**
   * Exceptions as structure, each with its own words, so an exception stays
   * attached to the rule it modifies. In prose it floats away and is read as
   * a separate sentence, or not read at all.
   */
  exceptions: Array<{ statedAs: AuthorityText; provenance: Provenance[] }>;
}

/**
 * An authorization checklist item as a requirement row.
 *
 * The three states map without inventing anything:
 *
 *  - REQUIRED    → REQUIRED, carrying the provenance that established it.
 *  - CONDITIONAL → CONDITIONAL, and the condition travels WITH it. The type
 *                  makes a CONDITIONAL without a condition impossible to build,
 *                  and Hunt overhaul refuses to render one; where the item has
 *                  no condition text, the row is NOT_CERTIFIED instead of a
 *                  conditional with an empty condition, because a condition
 *                  nobody can read is not a condition.
 *  - UNKNOWN     → NOT_CERTIFIED with somewhere to go. Not "not required": the
 *                  hunter is told to verify, and the row never disappears,
 *                  because a missing row reads as "nothing required".
 */
export function authorizationRow(item: AuthorizationChecklistItem, verifyAt: string): RequirementRow {
  const officialName: AuthorityText = { text: item.officialName, lang: "en-CA", owner: "AUTHORITY" };
  const base = {
    id: item.id,
    category: "AUTHORIZATION" as const,
    kind: item.kind,
    officialName,
    requires: item.prerequisites.map((entry) => ({
      id: entry.id,
      officialName: { text: entry.officialName, lang: "en-CA" as const, owner: "AUTHORITY" as const },
    })),
    ...(item.purchase
      ? {
          obtain: {
            channels: [...item.purchase.channels],
            infoUrl: item.purchase.infoUrl,
            ...(item.purchase.onlineUrl ? { onlineUrl: item.purchase.onlineUrl } : {}),
            ...(item.purchase.phone ? { phone: item.purchase.phone } : {}),
            ...(item.purchase.note ? { note: item.purchase.note } : {}),
          },
        }
      : {}),
    exceptions: [],
  };

  /* A legal statement with no source is refused at the boundary rather than
     rendered — an empty `provenance` array type-checks, and an empty array is
     what let a sourceless prohibition reach a hunter once already. */
  const where = item.purchase?.infoUrl ?? verifyAt;
  if (item.provenance.length === 0) {
    return { ...base, statement: { state: "NOT_CERTIFIED", value: null, verifyAt: where } };
  }
  if (item.status === "REQUIRED") {
    return { ...base, statement: { state: "REQUIRED", value: null, provenance: item.provenance } };
  }
  if (item.status === "CONDITIONAL" && item.conditionText?.trim()) {
    return {
      ...base,
      statement: {
        state: "CONDITIONAL", value: null, provenance: item.provenance,
        condition: { when: {}, statedAs: item.conditionText },
      },
    };
  }
  return { ...base, statement: { state: "NOT_CERTIFIED", value: null, verifyAt: where } };
}

/** Every authorization in a checklist, as requirement rows, in the given order. */
export function authorizationRows(
  items: readonly AuthorizationChecklistItem[],
  verifyAt: string,
): RequirementRow[] {
  return items.map((item) => authorizationRow(item, verifyAt));
}
