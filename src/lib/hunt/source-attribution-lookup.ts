import { regulatoryEntryFor } from "./regulatory/registry.ts";
import { distinctAttributions, type LicenceNotice } from "./source-attribution.ts";

/**
 * The statements owed for sources known only by id, as a stored Hunt Brief
 * knows them. Server only: it reads the regulatory registry, and a client
 * component that imported it would ship every province's rules to the browser.
 */
export function attributionsForSourceIds(jurisdictionId: string | undefined, ids: ReadonlyArray<string | undefined>): LicenceNotice[] {
  const wanted = ids.filter((id): id is string => Boolean(id));
  if (!wanted.length) return [];
  return distinctAttributions(regulatoryEntryFor(jurisdictionId)?.sourceRecords?.(wanted) ?? []);
}
