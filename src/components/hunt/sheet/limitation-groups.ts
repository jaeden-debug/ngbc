import type { Limitation } from "../../../lib/hunt/limitation";

/**
 * Where each limitation goes on screen, decided by the scope its author gave
 * it — never by reading the words.
 *
 * Three destinations, because a hunter has three different relationships with
 * these sentences:
 *
 * - **here** — CRITICAL and CONTEXTUAL. True of this hunt, today, at this
 *   point. Beside the status, never behind a disclosure.
 * - **always** — GENERAL. True everywhere the jurisdiction reaches, always.
 *   Collapsed, said once, complete.
 * - **sources** — SOURCE_DETAIL. The authority's own caveat about its own
 *   data. It belongs with the source it describes, quoted and attributed.
 *
 * CONTEXTUAL arrives only when the evaluation has already decided its
 * condition, so its presence IS the condition holding; this never re-tests it.
 */
export interface LimitationGroups {
  here: Limitation[];
  always: Limitation[];
  sources: Limitation[];
}

export function groupLimitations(limitations: readonly Limitation[]): LimitationGroups {
  const groups: LimitationGroups = { here: [], always: [], sources: [] };
  for (const limitation of limitations) {
    if (limitation.scope === "CRITICAL" || limitation.scope === "CONTEXTUAL") groups.here.push(limitation);
    else if (limitation.scope === "SOURCE_DETAIL") groups.sources.push(limitation);
    else groups.always.push(limitation);
  }
  /* CRITICAL before CONTEXTUAL: both apply here, but one changes what a hunter
     may do and the other explains why something is uncertain. */
  groups.here.sort((a, b) => Number(b.scope === "CRITICAL") - Number(a.scope === "CRITICAL"));
  return groups;
}

/** The authority's own caveats for one source, in the order they were given. */
export function sourceCaveats(groups: LimitationGroups, sourceId: string): Limitation[] {
  return groups.sources.filter((limitation) => limitation.scope === "SOURCE_DETAIL" && limitation.sourceId === sourceId);
}

/** Caveats whose source is not among the sources shown, so none is ever dropped. */
export function orphanCaveats(groups: LimitationGroups, shown: readonly string[]): Limitation[] {
  const known = new Set(shown);
  return groups.sources.filter((limitation) => limitation.scope === "SOURCE_DETAIL" && !known.has(limitation.sourceId));
}
