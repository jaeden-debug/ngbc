import { presentZone } from "../zone-presentation.ts";

/**
 * The words written on a zone polygon.
 *
 * The owner's rule: polygons carry the zone's compact label, cards and sheets
 * the full one. The chain is compact → designation label → nothing. A label is
 * never the raw source designation: Québec's "11O" is read as "110" at map
 * size, which is exactly the misreading the presentation contract exists to
 * prevent. A zone the contract cannot present is drawn without a label rather
 * than with a code nobody can read; the zones list still names it.
 */
export function mapLabelFor(zone: { layerId: string; name: string }): string | null {
  const presented = presentZone({ designation: zone.name, layerId: zone.layerId });
  if (presented.status !== "PRESENTED") return null;
  return presented.compactLabel || presented.designationLabel || null;
}
