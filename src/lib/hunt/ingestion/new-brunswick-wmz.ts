import { createArcgisZoneSource, type ArcgisZoneSourceConfig } from "./arcgis-zone-source.ts";
import type { LegalStanding } from "../zone-layers.ts";
import type { ZoneLayerSource } from "./types.ts";

/**
 * New Brunswick's Wildlife Management Zones.
 *
 * The province serves 27 zones, one record each, numbered 1 to 27, from its
 * own OpenData ArcGIS service. The layer itself carries no copyright text; the
 * licence lives on the province's catalogue record, which publishes the
 * dataset under the New Brunswick Open Government Licence — so that is where
 * it was read, not from the service.
 *
 * The designation is a plain integer, and the service's object-id column is
 * `OBJECTID_1` rather than the usual `OBJECTID`.
 */

export const NEW_BRUNSWICK_WMZ_LAYER =
  "https://gis-erd-der.gnb.ca/server/rest/services/OpenData/WMZ/MapServer/0";

export const NEW_BRUNSWICK_LICENCE = "New Brunswick Open Government Licence";

export const NEW_BRUNSWICK_WMZ_LEGAL_STANDING: LegalStanding = {
  kind: "DERIVED_FROM_LEGAL_DESCRIPTION",
  statedAs:
    "Government of New Brunswick: the Wildlife Management Zones are the administrative units the Department of " +
    "Natural Resources and Energy Development uses to manage populations and harvest of deer, moose, bear and " +
    "furbearer species. The zones are described in the regulations made under the Fish and Wildlife Act, which " +
    "control; this layer is the province's digital product of them.",
  controllingText: {
    title: "Fish and Wildlife Act and the regulations made under it",
    url: "https://laws.gnb.ca/en/browse/title/Fish%20and%20Wildlife%20Act",
  },
};

/** 1 to 27, as the regulation numbers them; nothing else is a zone. */
export function normaliseNewBrunswickWmz(raw: unknown): string | null {
  const value = typeof raw === "number" ? raw : typeof raw === "string" && /^\d+$/.test(raw.trim()) ? Number(raw) : NaN;
  if (!Number.isInteger(value) || value < 1 || value > 27) return null;
  return String(value);
}

export const NEW_BRUNSWICK_WMZ_CONFIG: ArcgisZoneSourceConfig = {
  layerId: "layer:ca-nb-wmz",
  jurisdictionCanonicalId: "jurisdiction:ca-nb",
  jurisdictionKey: "ca-nb",
  officialTerm: "Wildlife Management Zone",
  officialTermShort: "WMZ",
  zoneType: "ZONE",
  authority: "New Brunswick Department of Natural Resources and Energy Development",
  sourceCanonicalId: "source:ca-nb-wmz-service",
  layerUrl: NEW_BRUNSWICK_WMZ_LAYER,
  idField: "WMZ",
  keepFields: [],
  normalise: normaliseNewBrunswickWmz,
  zoneIdPrefix: "management_zone:ca-nb-wmz-",
  officialNamePrefix: "Wildlife Management Zone ",
  expectedRecords: 27,
  expectedUnits: 27,
  // Every zone is one record; the province publishes none of them in parts.
  multipartUnits: {},
  quarantine: [],
  sourceVersion: "OpenData/WMZ/MapServer/0, read 2026-09-23",
  legalStanding: NEW_BRUNSWICK_WMZ_LEGAL_STANDING,
  objectIdField: "OBJECTID_1",
};

export const createNewBrunswickWmzSource = (fetcher: typeof fetch = fetch): ZoneLayerSource =>
  createArcgisZoneSource(NEW_BRUNSWICK_WMZ_CONFIG, fetcher);
