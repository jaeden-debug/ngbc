/**
 * The attribution statements a page owes, one per distinct statement.
 *
 * Some authorities license their material on condition that a statement goes
 * with it: the King's Printer Licence – British Columbia (s. 3.3) requires its
 * statement "displayed prominently at least once in association with any
 * Reproduction"; OpenMB asks the same of Manitoba's data. The statement is
 * data on the source record, so a page that shows a source's material prints
 * the source's statement, never a jurisdiction-shaped string of its own.
 *
 * Once per statement, not once per source: nine BC Laws schedules share one
 * licence, and the same paragraph nine times is noise that hides it.
 *
 * PURE, AND IT MUST STAY SO: the answer card is a client component and imports
 * this. Looking statements up by source id needs the regulatory registry, which
 * is every province's rules — that lives in `source-attribution-lookup.ts`,
 * for server code only.
 */
export interface LicenceNotice {
  licence: string | null;
  text: string;
}

export function distinctAttributions(
  sources: ReadonlyArray<{ licence?: string | null; attribution?: string | null } | null | undefined>,
): LicenceNotice[] {
  const seen = new Map<string, LicenceNotice>();
  for (const source of sources) {
    const text = source?.attribution?.trim();
    if (!text || seen.has(text)) continue;
    seen.set(text, { licence: source?.licence?.trim() || null, text });
  }
  return [...seen.values()];
}
