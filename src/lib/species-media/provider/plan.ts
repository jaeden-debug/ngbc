/**
 * Which species the provider pipeline may touch. Precedence is
 * MANUAL > PROVIDER > PLACEHOLDER, so a species with a manual image — or one
 * already carrying an active provider image — is never searched, re-chosen or
 * written. A re-run can therefore only fill placeholders.
 */
export interface CurrentImages {
  manual: ReadonlySet<string>;
  provider: ReadonlyMap<string, unknown>;
}

export function needsProviderImage(speciesId: string, current: CurrentImages): boolean {
  return !current.manual.has(speciesId) && !current.provider.has(speciesId);
}

export function publishQueue<T extends { speciesId: string; outcome: string }>(outcomes: T[], current: CurrentImages): T[] {
  return outcomes.filter((row) => row.outcome === "APPROVED" && needsProviderImage(row.speciesId, current));
}
