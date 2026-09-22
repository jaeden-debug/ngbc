import { createWfsZoneSource, type WfsZoneSourceConfig } from "./wfs-zone-source.ts";
import type { ZoneLayerSource } from "./types.ts";

/**
 * British Columbia's Management Units, from the province's own WFS.
 *
 * Reviewed 2026-09-22 against three independent statements of the same set:
 *
 *  - the Management Unit Regulation, B.C. Reg. 64/96 (consolidation current to
 *    2026-09-15, last amended by B.C. Reg. 89/2026): "The Province is divided
 *    into 225 management units";
 *  - the BC Data Catalogue record `wildlife-management-units` (Open Government
 *    Licence – British Columbia, record modified 2026-03-10): 225 units in nine
 *    administrative regions;
 *  - the 2026–2028 Hunting and Trapping Regulations Synopsis, which names every
 *    one of the 225 designations the layer publishes and no other unit.
 *
 * The layer returns 225 records, one per unit, each identified as
 * `<region>-<number>` ("7-15"). Numbering has gaps the regulation also has
 * (no 3-1 to 3-11, 3-21 to 3-25, 4-10 to 4-13 or 8-16 to 8-20).
 *
 * Its `REGION_RESPONSIBLE_NAME` calls every Region 7 unit "Omineca", while the
 * regulation's maps divide Region 7 into 7a Omineca and 7b Peace. The field is
 * kept for provenance and must never be shown as the regulatory region.
 */
export const BRITISH_COLUMBIA_MU_WFS = "https://openmaps.gov.bc.ca/geo/pub/WHSE_WILDLIFE_MANAGEMENT.WAA_WILDLIFE_MGMT_UNITS_SVW/ows";
export const BRITISH_COLUMBIA_MU_TYPE_NAME = "pub:WHSE_WILDLIFE_MANAGEMENT.WAA_WILDLIFE_MGMT_UNITS_SVW";

/**
 * A designation as the regulation reads it. Section 3 of B.C. Reg. 64/96 says a
 * reference ending "-01" to "-09" is read as "-1" to "-9", so both forms are the
 * same unit; anything that is not `<region 1–8>-<number>` is not a unit.
 */
export function normaliseBritishColumbiaMu(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const match = /^\s*([1-8])\s*-\s*0*(\d{1,2})\s*$/.exec(raw);
  if (!match || match[2] === "0") return null;
  return `${match[1]}-${Number.parseInt(match[2], 10)}`;
}

export const BRITISH_COLUMBIA_MU_CONFIG: WfsZoneSourceConfig = {
  layerId: "layer:ca-bc-mu",
  jurisdictionCanonicalId: "jurisdiction:ca-bc",
  officialTerm: "Management Unit",
  officialTermShort: "MU",
  zoneType: "WMU",
  authority: "Government of British Columbia",
  sourceCanonicalId: "source:ca-bc-mu-service",
  serviceUrl: BRITISH_COLUMBIA_MU_WFS,
  typeName: BRITISH_COLUMBIA_MU_TYPE_NAME,
  geometryField: "GEOMETRY",
  sortField: "OBJECTID",
  idField: "WILDLIFE_MGMT_UNIT_ID",
  keepFields: ["GAME_MANAGEMENT_ZONE_ID", "GAME_MANAGEMENT_ZONE_NAME", "REGION_RESPONSIBLE_ID", "REGION_RESPONSIBLE_NAME", "FEATURE_AREA_SQM"],
  normalise: normaliseBritishColumbiaMu,
  zoneIdPrefix: "management_zone:ca-bc-mu-",
  officialNamePrefix: "Management Unit",
  expectedRecords: 225,
  expectedUnits: 225,
  multipartUnits: {},
  quarantine: [],
  sourceVersion: "BC Data Catalogue record modified 2026-03-10",
  legalStanding: {
    kind: "DERIVED_FROM_LEGAL_DESCRIPTION",
    statedAs:
      "B.C. Reg. 64/96 s. 1: management units are \"identified by number and shown with their boundaries delineated in heavy " +
      "black dashed lines on the attached maps\" (2026 regional maps enacted by B.C. Reg. 89/2026). Where a river or creek forms " +
      "a boundary it follows the right-hand bank facing downstream, and the left-hand bank for the West Road (Blackwater), Liard " +
      "and Peace rivers (s. 2). The enacted maps and those rules control; this layer is the province's digital product of them.",
    controllingText: {
      title: "Management Units Regulation, B.C. Reg. 64/96",
      url: "https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/64_96",
    },
  },
  timeZone: "America/Vancouver",
};

export function createBritishColumbiaMuSource(fetcher: typeof fetch = fetch): ZoneLayerSource {
  return createWfsZoneSource(BRITISH_COLUMBIA_MU_CONFIG, fetcher);
}
