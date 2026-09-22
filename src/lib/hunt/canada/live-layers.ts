import type { ArcgisZoneSourceConfig } from "../ingestion/arcgis-zone-source.ts";
import type { ZoneLayer } from "../zone-layers.ts";

/**
 * Canadian layers answered by the authority's own live service.
 *
 * Same shape and rules as the U.S. live layers (`united-states/layers.ts`):
 * North Ground stores no copy of the geometry, asks the authority at request
 * time, and serves a layer only after `scripts/certify-live-zone-layer.mjs`
 * has certified it. A Canadian layer is live-service only when its reuse terms
 * do not permit a stored copy.
 */

interface CanadaLiveLayer {
  layer: ZoneLayer;
  adapter: Omit<ArcgisZoneSourceConfig, "layerId" | "jurisdictionCanonicalId" | "officialTerm" | "officialTermShort" | "authority" | "sourceCanonicalId" | "zoneIdPrefix" | "officialNamePrefix" | "legalStanding">;
}

const SK_WMZ = "https://gis.saskatchewan.ca/arcgis/rest/services/WildlifeManagement/MapServer/0";

const CANADA_LIVE_LAYERS: CanadaLiveLayer[] = [
  {
    layer: {
      id: "layer:ca-sk-wmz",
      jurisdictionId: "jurisdiction:ca-sk",
      jurisdictionName: "Saskatchewan",
      country: "CA",
      officialTerm: "Wildlife Management Zone",
      officialTermShort: "WMZ",
      coverage: "IN_DEVELOPMENT",
      coverageNote:
        "Saskatchewan's 83 Wildlife Management Zones, read from the Ministry of Environment's own map service at the " +
        "time of each question. The dataset carries the Government of Saskatchewan Standard Unrestricted Use Data " +
        "Licence v2.0, which grants commercial reuse, and the same item adds \"Not for resale\", so North Ground reads " +
        "the service live, stores no copy and redistributes no file (owner decision, 2026-09-22). The Wildlife " +
        "Management Zones and Special Areas Boundaries Regulations supersede the layer.",
      authority: "Saskatchewan Ministry of Environment",
      sourceId: "source:ca-sk-wmz-service",
      endpoint: `${SK_WMZ}/query`,
      nameField: "ZONE_NUM",
      bounds: { minLatitude: 48.89, maxLatitude: 60.1, minLongitude: -110.01, maxLongitude: -101.35 },
      serving: true,
      officialNamePrefix: "Wildlife Management Zone ",
      // The ministry's own DA_NAME for the three urban zones; numbered zones are "WMZ No. 55".
      officialNames: { SWMZ: "Saskatoon WMZ", RWMZ: "Regina-Moose Jaw WMZ", PWMZ: "Prince Albert WMZ" },
      zoneIdPrefix: "management_zone:ca-sk-wmz-",
      designationOf: (raw) => {
        const value = typeof raw === "string" ? raw.trim().toUpperCase() : "";
        // Numbered zones, their E/W and N/S halves, and the three urban zones (SWMZ, RWMZ, PWMZ).
        return /^(?:\d{1,2}[EWNS]?|[PRS]WMZ)$/.test(value) ? value : null;
      },
      legalStanding: {
        kind: "DERIVED_FROM_LEGAL_DESCRIPTION",
        statedAs:
          "Saskatchewan Ministry of Environment: “These boundaries are described legally in the Wildlife Management Zones " +
          "and Special Areas Boundaries Regulations, 1990 … Although these digitized boundaries are intended to be as " +
          "accurate as possible, the regulations supersede this data should discrepancies occur.”",
        controllingText: {
          title: "The Wildlife Management Zones and Special Areas Boundaries Regulations, 1990",
          url: "https://publications.saskatchewan.ca/#/products/1607",
        },
      },
      timeZone: "America/Regina",
      resolution: "LIVE_SERVICE",
    },
    adapter: {
      jurisdictionKey: "ca-sk",
      zoneType: "ZONE",
      layerUrl: SK_WMZ,
      idField: "ZONE_NUM",
      keepFields: ["DA_NAME"],
      expectedRecords: 83,
      expectedUnits: 83,
      multipartUnits: {},
      quarantine: [],
      sourceVersion: "WildlifeManagement/MapServer/0, boundaries last revised 2014-03-27",
    },
  },
];

export const CANADA_LIVE_ZONE_LAYERS: ZoneLayer[] = CANADA_LIVE_LAYERS.map((entry) => entry.layer);

/** The certification adapter configuration for a Canadian live layer, from the same description the resolver uses. */
export function canadaLiveAdapterConfig(layerId: string): ArcgisZoneSourceConfig | undefined {
  const entry = CANADA_LIVE_LAYERS.find((candidate) => candidate.layer.id === layerId);
  if (!entry) return undefined;
  const { layer, adapter } = entry;
  return {
    ...adapter,
    layerId: layer.id,
    jurisdictionCanonicalId: layer.jurisdictionId,
    officialTerm: layer.officialTerm,
    officialTermShort: layer.officialTermShort,
    authority: layer.authority,
    sourceCanonicalId: layer.sourceId,
    zoneIdPrefix: layer.zoneIdPrefix,
    officialNamePrefix: layer.officialNamePrefix,
    normalise: adapter.normalise ?? (layer.designationOf ? (raw) => layer.designationOf!(raw) : undefined),
    legalStanding: { kind: layer.legalStanding!.kind, statedAs: layer.legalStanding!.statedAs },
  };
}
