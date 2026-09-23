import { createArcgisZoneSource, type ArcgisZoneSourceConfig } from "./arcgis-zone-source.ts";
import type { LegalStanding } from "../zone-layers.ts";
import type { ZoneLayerSource } from "./types.ts";

/**
 * Prince Edward Island: the province IS the hunting geography.
 *
 * Established from the authority's own text, not inferred. The consolidated
 * Wildlife Conservation Act Hunting Regulations contain the word "zone" ZERO
 * times, "county" zero times and "district" zero times; harvestable wildlife is
 * listed province-wide in Schedule 2 with no geographic qualifier. "Wildlife
 * management area" appears six times and only inside a prohibition — no hunting
 * migratory waterfowl within 100 m of the centre line of a highway right-of-way
 * forming a boundary of the Indian River, Rollo Bay, New Glasgow or Pisquid
 * River Wildlife Management Areas. Those are restricted PLACES and belong with
 * the special-area layers; they are not management geography and must never be
 * drawn as zones.
 *
 * So Prince Edward Island has no wildlife-authority geography to ingest,
 * because it needs none. The polygon below is a GENERAL-PURPOSE provincial
 * boundary from Statistics Canada, used to draw the province's extent. It is
 * provenance for the OUTLINE only: the authority for "the rules apply
 * province-wide" is the regulation, and the citation a hunter reads stays the
 * province's own hunting page, never Statistics Canada.
 */

export const PRINCE_EDWARD_ISLAND_BOUNDARY_LAYER =
  "https://geo.statcan.gc.ca/geo_wa/rest/services/2021/Cartographic_boundary_files/MapServer/0";

export const PRINCE_EDWARD_ISLAND_BOUNDARY_LICENCE = "Open Government Licence – Canada";

export const PRINCE_EDWARD_ISLAND_LEGAL_STANDING: LegalStanding = {
  kind: "DERIVED_FROM_LEGAL_DESCRIPTION",
  statedAs:
    "Prince Edward Island's Wildlife Conservation Act Hunting Regulations set hunting rules for the whole province: " +
    "the regulations name no zone, county or district, and list harvestable wildlife province-wide. The province is " +
    "therefore the extent to which its hunting rules apply. The outline drawn is Statistics Canada's cartographic " +
    "provincial boundary, which is provenance for the shape and is not the authority for any rule.",
  controllingText: {
    title: "Wildlife Conservation Act Hunting Regulations (Prince Edward Island)",
    url: "https://www.princeedwardisland.ca/sites/default/files/legislation/w04-1-5-wildlife_conservation_act_hunting_regulations.pdf",
  },
};

/**
 * PRUID 11 is Prince Edward Island; nothing else in the file is this province.
 *
 * The designation is the province's own name, because for a jurisdiction-level
 * geography that is what the area IS. Nothing is synthesised: there is no
 * "PE-1", and Hunt answers with the jurisdiction rather than a zone.
 */
export function normalisePrinceEdwardIsland(raw: unknown): string | null {
  const value = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  return value === "11" ? "Prince Edward Island" : null;
}

export const PRINCE_EDWARD_ISLAND_CONFIG: ArcgisZoneSourceConfig = {
  layerId: "layer:ca-pe-province",
  jurisdictionCanonicalId: "jurisdiction:ca-pe",
  jurisdictionKey: "ca-pe",
  officialTerm: "Province",
  officialTermShort: "PE",
  zoneType: "REGION",
  authority: "Prince Edward Island Department of Environment, Energy and Climate Action",
  sourceCanonicalId: "source:ca-pe-provincial-boundary",
  layerUrl: PRINCE_EDWARD_ISLAND_BOUNDARY_LAYER,
  idField: "PRUID",
  keepFields: ["PRNAME"],
  normalise: normalisePrinceEdwardIsland,
  /*
   * A storage key for the outline. Prince Edward Island publishes no zone, so
   * Hunt answers with the jurisdiction and no zone id; this row exists only to
   * hold the province's shape.
   */
  zoneIdPrefix: "management_zone:ca-pe-",
  officialNamePrefix: "",
  expectedRecords: 1,
  expectedUnits: 1,
  multipartUnits: {},
  quarantine: [],
  sourceVersion: "Statistics Canada 2021 cartographic boundary file, PR layer, read 2026-09-23",
  legalStanding: PRINCE_EDWARD_ISLAND_LEGAL_STANDING,
  where: "PRUID='11'",
};

export const createPrinceEdwardIslandSource = (fetcher: typeof fetch = fetch): ZoneLayerSource =>
  createArcgisZoneSource(PRINCE_EDWARD_ISLAND_CONFIG, fetcher);
