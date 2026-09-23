import { createSocrataZoneSource, type SocrataZoneSourceConfig } from "./socrata-zone-source.ts";
import type { LegalStanding } from "../zone-layers.ts";
import type { ZoneLayerSource } from "./types.ts";

/**
 * Nova Scotia's Deer Management Zones.
 *
 * The province publishes twelve zones (101-112) as 234 rows on its open-data
 * portal, one row per polygon part, under the Nova Scotia Open Government
 * Licence. Moose is NOT here: Nova Scotia's moose geography appears only on
 * the Provincial Landscape Viewer's ArcGIS service, which carries no licence
 * of any kind, so North Ground holds no moose boundary for the province and
 * says so rather than drawing one.
 *
 * The designation arrives as a float string — "101.0" — because the column is
 * numeric. It is normalised to the integer the regulation uses, so the
 * canonical id is `management_zone:ca-ns-dmz-101` and not `...-101-0`.
 */

export const NOVA_SCOTIA_DEER_HOST = "data.novascotia.ca";
export const NOVA_SCOTIA_DEER_DATASET = "m6qa-i3w9";

export const NOVA_SCOTIA_LICENCE = "Nova Scotia Open Government Licence";

export const NOVA_SCOTIA_DEER_LEGAL_STANDING: LegalStanding = {
  kind: "DERIVED_FROM_LEGAL_DESCRIPTION",
  statedAs:
    "Government of Nova Scotia: “Nova Scotia is divided in 12 deer management zones and deer hunting regulations may " +
    "vary by zone. When accuracy is needed, consult the official legal wording of the Wildlife Act and its " +
    "Regulations.” The dataset is the province's digital product of those regulations, and defers to them.",
  controllingText: {
    title: "Wildlife Act and the regulations made under it",
    url: "https://novascotia.ca/natr/wildlife/laws/actsregs.asp",
  },
};

/** "101.0" → "101"; the column is numeric, the regulation's zones are not. */
export function normaliseNovaScotiaDeerZone(raw: unknown): string | null {
  const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (!/^\d+(\.0+)?$/.test(text)) return null;
  const zone = Number(text);
  if (!Number.isInteger(zone) || zone < 101 || zone > 112) return null;
  return String(zone);
}

/**
 * How many rows each zone is published as, counted from the authority
 * 2026-09-23. A zone gaining or losing parts is a change to Nova Scotia's
 * geography and fails the ingest rather than being published quietly.
 */
const PARTS_PER_ZONE = {
  "101": 43, "102": 31, "103": 26, "104": 1, "105": 7, "106": 59,
  "107": 1, "108": 2, "109": 7, "110": 3, "111": 46, "112": 8,
} as const;

export const NOVA_SCOTIA_DEER_CONFIG: SocrataZoneSourceConfig = {
  layerId: "layer:ca-ns-deer-zone",
  jurisdictionCanonicalId: "jurisdiction:ca-ns",
  officialTerm: "Deer Management Zone",
  officialTermShort: "DMZ",
  zoneType: "ZONE",
  authority: "Nova Scotia Department of Natural Resources and Renewables",
  sourceCanonicalId: "source:ca-ns-deer-zone-service",
  host: NOVA_SCOTIA_DEER_HOST,
  datasetId: NOVA_SCOTIA_DEER_DATASET,
  geometryField: "the_geom",
  idField: "deer_zone",
  keepFields: ["area", "hectares"],
  normalise: normaliseNovaScotiaDeerZone,
  zoneIdPrefix: "management_zone:ca-ns-dmz-",
  officialNamePrefix: "Deer Management Zone ",
  expectedRecords: 234,
  expectedUnits: 12,
  multipartUnits: PARTS_PER_ZONE,
  sourceVersion: "data.novascotia.ca/resource/m6qa-i3w9, read 2026-09-23",
  legalStanding: NOVA_SCOTIA_DEER_LEGAL_STANDING,
  timeZone: "America/Halifax",
};

export const createNovaScotiaDeerSource = (fetcher: typeof fetch = fetch): ZoneLayerSource =>
  createSocrataZoneSource(NOVA_SCOTIA_DEER_CONFIG, fetcher);
