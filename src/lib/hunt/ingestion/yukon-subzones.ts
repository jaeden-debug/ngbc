import { createArcgisZoneSource, type ArcgisZoneSourceConfig } from "./arcgis-zone-source.ts";
import type { LegalStanding } from "../zone-layers.ts";
import type { ZoneLayerSource } from "./types.ts";

/**
 * Yukon's Game Management Subzones.
 *
 * GeoYukon serves the subzones as one integer per feature — 417 for subzone
 * 4-17 — so the designation is rebuilt as the territory writes it: the zone,
 * a hyphen, and the subzone padded to two digits.
 *
 * The service holds 445 features against the 443 subzones Yukon states. The
 * two extra, 102 and 103, are Ivvavik and Vuntut National Parks, where the
 * dataset itself says subzones do not apply (Kluane has no feature at all).
 * They are quarantined until Environment Yukon answers
 * `docs/correspondence/2026-09-22-yukon-gms-102-103-query.md`; no subzone
 * number is invented for them, and nothing of them is published.
 */

export const YUKON_GMS_LAYER =
  "https://mapservices.gov.yk.ca/arcgis/rest/services/GeoYukon/GY_AdministrativeBoundaries/MapServer/7";

export const YUKON_LICENCE = "Open Government Licence – Yukon";

export const YUKON_LEGAL_STANDING: LegalStanding = {
  kind: "DERIVED_FROM_LEGAL_DESCRIPTION",
  statedAs:
    "Government of Yukon: “Game Management Areas (GMAs) are legal boundaries that define an area within which big game " +
    "management objectives can be met through the setting of area-specific regulations.” The item states the layer is " +
    "generalized from those boundaries, which are the maps established by order-in-council under the Wildlife Act.",
  controllingText: {
    title: "Wildlife Act and the Game Management Subzone maps established under it",
    url: "https://laws.yukon.ca/cms/images/LEGISLATION/regs/oic2012_084.pdf",
  },
};

/** Ivvavik (102) and Vuntut (103) National Parks, by their stable service ids. */
const PARK_QUARANTINE = [
  {
    reason:
      "Game Management Area 102 covers Ivvavik National Park (about 9,735 km²). The dataset states subzones cover the " +
      "Yukon except national parks, and the province's own 443-feature release does not contain it.",
    match: { field: "OBJECTID", value: 445 },
  },
  {
    reason:
      "Game Management Area 103 covers Vuntut National Park (about 4,351 km²), on the same reasoning as 102.",
    match: { field: "OBJECTID", value: 441 },
  },
];

/** 417 → "4-17"; the parks' 102 and 103 are not subzone numbers. */
export function normaliseYukonSubzone(raw: unknown): string | null {
  const value = typeof raw === "number" ? raw : typeof raw === "string" && /^\d+$/.test(raw.trim()) ? Number(raw) : NaN;
  if (!Number.isInteger(value) || value < 100 || value > 1199) return null;
  if (value === 102 || value === 103) return null;
  const zone = Math.floor(value / 100);
  const subzone = value % 100;
  if (zone < 1 || zone > 11 || subzone < 1) return null;
  return `${zone}-${String(subzone).padStart(2, "0")}`;
}

export const YUKON_GMS_CONFIG: ArcgisZoneSourceConfig = {
  layerId: "layer:ca-yt-gms",
  jurisdictionCanonicalId: "jurisdiction:ca-yt",
  jurisdictionKey: "ca-yt",
  officialTerm: "Game Management Subzone",
  officialTermShort: "GMS",
  zoneType: "ZONE",
  authority: "Government of Yukon, Department of Environment",
  sourceCanonicalId: "source:ca-yt-gms-service",
  layerUrl: YUKON_GMS_LAYER,
  idField: "GAME_MGMT_AREA_ID",
  keepFields: [],
  normalise: normaliseYukonSubzone,
  zoneIdPrefix: "management_zone:ca-yt-gms-",
  officialNamePrefix: "Game Management Subzone ",
  expectedRecords: 445,
  expectedUnits: 443,
  multipartUnits: {},
  quarantine: PARK_QUARANTINE,
  sourceVersion: "GY_AdministrativeBoundaries/MapServer/7, read 2026-09-22",
  legalStanding: YUKON_LEGAL_STANDING,
  objectIdField: "OBJECTID",
};

export const createYukonSubzoneSource = (fetcher: typeof fetch = fetch): ZoneLayerSource =>
  createArcgisZoneSource(YUKON_GMS_CONFIG, fetcher);
