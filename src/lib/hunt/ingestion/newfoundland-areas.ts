import { createArcgisZoneSource, type ArcgisZoneSourceConfig } from "./arcgis-zone-source.ts";
import type { ZoneLayerSource } from "./types.ts";
import type { LegalStanding } from "../zone-layers.ts";

/**
 * Newfoundland and Labrador's big-game management areas.
 *
 * The province manages each big-game species in its own geography, so there is
 * no single "hunting zone" here: moose areas, caribou areas and black bear
 * areas are three different maps of the same province. They are three layers,
 * each scoped to the species whose seasons the province writes in it. The
 * Wildlife Division serves all three from one FeatureServer, published under
 * the Newfoundland and Labrador Open Government Licence.
 *
 * The moose layer also carries records that are not hunting areas: the four
 * national parks, the Nunavut boundary sliver, and two records the province
 * itself names "Not a Labrador Moose Hunting Zone". Each is quarantined by its
 * own stable id, with the province's words as the reason; none is given an
 * invented designation.
 */

export const NEWFOUNDLAND_BIG_GAME_SERVICE =
  "https://services8.arcgis.com/aCyQID5qQcyrJMm2/arcgis/rest/services/WLD_BigGameManagementArea/FeatureServer";

export const NEWFOUNDLAND_LICENCE = "Newfoundland and Labrador Open Government Licence";

/** The province's own words about its boundaries, carried on every answer that rests on them. */
export const NEWFOUNDLAND_LEGAL_STANDING: LegalStanding = {
  kind: "DERIVED_FROM_LEGAL_DESCRIPTION",
  statedAs:
    "The Wildlife Division maintains these layers as the centralized dataset for management-area boundaries. The areas " +
    "themselves, and the seasons and quotas set in them, are established under the Wild Life Act and its regulations, " +
    "which control where they and the map differ.",
};

/** Areas the authority serves as several polygons; the count is the authority's own. */
export const NEWFOUNDLAND_MOOSE_MULTIPART: Readonly<Record<string, number>> = {
  "001": 2, "002A": 2, "005A": 2, "006": 2, "015": 5, "022": 11, "025": 4, "026": 2, "028": 2, "030": 4, "057": 2, "058": 2,
};

/** The province's own "Not a Newfoundland Caribou Hunting Zone" polygons (area 099). */
const CARIBOU_QUARANTINE = [23, 24, 25, 26, 27, 28, 29, 30, 31, 33, 34].map((objectid) => ({
  reason: "Area 099, which the province names \"Not a Newfoundland Caribou Hunting Zone\".",
  match: { field: "objectid", value: objectid },
}));

export const NEWFOUNDLAND_CARIBOU_MULTIPART: Readonly<Record<string, number>> = { "070": 4, "071": 2 };



/** Records in the moose layer that the province does not manage as hunting areas. */
const MOOSE_QUARANTINE = [
  { objectid: 69, reason: "Area 000, which the province names \"Not Applicable\": geography, not a moose management area." },
  { objectid: 42, reason: "Terra Nova National Park: federal land drawn in the layer, with no moose management area number." },
  { objectid: 46, reason: "Gros Morne National Park: federal land drawn in the layer, with no moose management area number." },
  { objectid: 85, reason: "Mealy Mountains National Park: federal land drawn in the layer, with no moose management area number." },
  { objectid: 97, reason: "Mealy Mountains National Park, second polygon." },
  { objectid: 87, reason: "Torngat Mountains National Park: federal land drawn in the layer, with no moose management area number." },
  { objectid: 99, reason: "Torngat Mountains National Park, second polygon." },
  { objectid: 81, reason: "Nunavut Territory: outside Newfoundland and Labrador's jurisdiction." },
  { objectid: 83, reason: "The province names this record \"Not a Labrador Moose Hunting Zone\"." },
  { objectid: 94, reason: "The province names this record \"Not a Labrador Moose Hunting Zone\", second polygon." },
].map((entry) => ({ reason: entry.reason, match: { field: "objectid", value: entry.objectid } }));

/**
 * "044" as the province writes it. A record without a numbered area is not a
 * unit, and neither are the codes the province reserves for "this is not a
 * hunting zone": moose 000 ("Not Applicable") and caribou 099 ("Not a
 * Newfoundland Caribou Hunting Zone"). They are geography, not areas, so they
 * are refused a designation rather than quarantined under a number.
 */
export function normaliseNewfoundlandArea(raw: unknown, notAnArea: readonly string[] = ["000"]): string | null {
  const value = typeof raw === "string" ? raw.trim().toUpperCase() : typeof raw === "number" ? String(raw) : "";
  if (notAnArea.includes(value)) return null;
  return /^\d{3}[A-Z]?$/.test(value) ? value : null;
}

const shared = {
  jurisdictionCanonicalId: "jurisdiction:ca-nl",
  jurisdictionKey: "ca-nl",
  authority: "Newfoundland and Labrador Department of Fisheries, Forestry and Agriculture",
  zoneType: "ZONE" as const,
  legalStanding: NEWFOUNDLAND_LEGAL_STANDING,
  sourceVersion: "WLD_BigGameManagementArea FeatureServer, read 2026-09-22",
};

export const NEWFOUNDLAND_MOOSE_CONFIG: ArcgisZoneSourceConfig = {
  ...shared,
  layerId: "layer:ca-nl-moose-area",
  officialTerm: "Moose Management Area",
  officialTermShort: "MMA",
  sourceCanonicalId: "source:ca-nl-big-game-area-service",
  layerUrl: `${NEWFOUNDLAND_BIG_GAME_SERVICE}/0`,
  idField: "mma",
  keepFields: ["mma_name", "mmu", "licenseissuer"],
  normalise: normaliseNewfoundlandArea,
  zoneIdPrefix: "management_zone:ca-nl-mma-",
  officialNamePrefix: "Moose Management Area ",
  expectedRecords: 112,
  expectedUnits: 74,
  multipartUnits: NEWFOUNDLAND_MOOSE_MULTIPART,
  quarantine: MOOSE_QUARANTINE,
  objectIdField: "objectid",
};

export const NEWFOUNDLAND_CARIBOU_CONFIG: ArcgisZoneSourceConfig = {
  ...shared,
  layerId: "layer:ca-nl-caribou-area",
  officialTerm: "Caribou Management Area",
  officialTermShort: "CMA",
  sourceCanonicalId: "source:ca-nl-big-game-area-service",
  layerUrl: `${NEWFOUNDLAND_BIG_GAME_SERVICE}/1`,
  idField: "cma",
  keepFields: ["cma_name", "cmu"],
  normalise: (raw) => normaliseNewfoundlandArea(raw, ["099"]),
  zoneIdPrefix: "management_zone:ca-nl-cma-",
  officialNamePrefix: "Caribou Management Area ",
  expectedRecords: 34,
  expectedUnits: 19,
  multipartUnits: NEWFOUNDLAND_CARIBOU_MULTIPART,
  quarantine: CARIBOU_QUARANTINE,
  objectIdField: "objectid",
};

export const NEWFOUNDLAND_BEAR_CONFIG: ArcgisZoneSourceConfig = {
  ...shared,
  layerId: "layer:ca-nl-bear-area",
  officialTerm: "Black Bear Management Area",
  officialTermShort: "BMA",
  sourceCanonicalId: "source:ca-nl-big-game-area-service",
  layerUrl: `${NEWFOUNDLAND_BIG_GAME_SERVICE}/2`,
  idField: "bma",
  // The bear layer numbers its seven areas 200-206 and names each one.
  keepFields: ["name"],
  normalise: (raw) => (typeof raw === "number" && Number.isInteger(raw) && raw >= 200 && raw <= 299 ? String(raw) : null),
  zoneIdPrefix: "management_zone:ca-nl-bma-",
  officialNamePrefix: "Black Bear Management Area ",
  expectedRecords: 7,
  expectedUnits: 7,
  multipartUnits: {},
  quarantine: [],
  objectIdField: "objectid",
};

export const createNewfoundlandMooseSource = (fetcher: typeof fetch = fetch): ZoneLayerSource =>
  createArcgisZoneSource(NEWFOUNDLAND_MOOSE_CONFIG, fetcher);
export const createNewfoundlandCaribouSource = (fetcher: typeof fetch = fetch): ZoneLayerSource =>
  createArcgisZoneSource(NEWFOUNDLAND_CARIBOU_CONFIG, fetcher);
export const createNewfoundlandBearSource = (fetcher: typeof fetch = fetch): ZoneLayerSource =>
  createArcgisZoneSource(NEWFOUNDLAND_BEAR_CONFIG, fetcher);
