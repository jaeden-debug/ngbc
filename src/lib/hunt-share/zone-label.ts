import { DEFAULT_ZONE_LOCALE, presentZoneById, type ZoneLocale } from "../hunt/zone-presentation.ts";

/**
 * How a Hunt Brief names its zone. The brief stores identity — the canonical
 * zone id and the authority's official name — and the readable label is derived
 * at render time, so a brief written before this existed reads "Zone 10 West"
 * too and a later locale cannot change what was stored.
 */
export function briefZoneLabels(
  zone: { id: string; displayName: string } | undefined,
  locale: ZoneLocale = DEFAULT_ZONE_LOCALE,
): { label: string; officialName: string; accessibleLabel: string } | null {
  if (!zone) return null;
  const presented = presentZoneById(zone.id, locale, zone.displayName);
  if (presented.status !== "PRESENTED") {
    return { label: zone.displayName, officialName: zone.displayName, accessibleLabel: zone.displayName };
  }
  return { label: presented.fullLabel, officialName: presented.officialName ?? zone.displayName, accessibleLabel: presented.accessibleLabel };
}
