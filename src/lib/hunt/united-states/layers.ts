import type { ProvenanceTimeZone } from "../time-zone.ts";
import idahoCertifiedUnits from "../../../../content/regulatory/us-id-certified-units.json" with { type: "json" };
import montanaCertifiedUnits from "../../../../content/regulatory/us-mt-certified-units.json" with { type: "json" };
import wyomingCertifiedUnits from "../../../../content/regulatory/us-wy-certified-units.json" with { type: "json" };
import coloradoCertifiedUnits from "../../../../content/regulatory/us-co-certified-units.json" with { type: "json" };
import type { ArcgisZoneSourceConfig } from "../ingestion/arcgis-zone-source.ts";
import { licencePermitsServing, type SourceLicence } from "../source-licence.ts";
import type { ZoneLayer } from "../zone-layers.ts";

/**
 * United States management geography, first wave: Idaho, Montana, Colorado and
 * Wyoming.
 *
 * Each state is described once here, and the same description serves the
 * production resolver (the `ZoneLayer`) and the certification adapter (the
 * `ArcgisZoneSourceConfig`), so what is certified is exactly what is served.
 *
 * Every U.S. layer is LIVE_SERVICE. The states publish their GIS without an
 * open licence — as "a best representation only" (Idaho), "product and
 * property of" the agency (Colorado), "as is" (Montana), or with no terms at
 * all (Wyoming) — so North Ground places a point by asking the state's own
 * service and stores no copy of its polygons (owner decision, 2026-09-21).
 * Certification reads the whole layer into memory, compares it with the
 * state's point answers and with the production resolver, and keeps only the
 * sample points and results.
 *
 * Every layer records what the state says its map is in law. None of them is
 * the legal boundary: each state's written descriptions control, and every
 * answer carries that in the state's own words.
 *
 * This module reaches the browser through `zone-layers.ts`; it holds endpoints
 * and words, never geometry or rules.
 */

interface UsLayer {
  layer: ZoneLayer;
  adapter: Omit<ArcgisZoneSourceConfig, "layerId" | "jurisdictionCanonicalId" | "officialTerm" | "officialTermShort" | "authority" | "sourceCanonicalId" | "zoneIdPrefix" | "officialNamePrefix" | "legalStanding">;
}

const MT_UPLAND_NAMES: Readonly<Record<string, string>> = {
  "West of the Continental Divide: Mountain Grouse, Partridge, Pheasant": "West of the Continental Divide",
  "East of the Continental Divide:Sage-grouse, Sharp-tailed Grouse, Mountain Grouse, Partridge, Pheasant": "East of the Continental Divide",
};

const MT_SPECIES_UPLAND = [
  "species:ruffed-grouse", "species:spruce-grouse", "species:dusky-grouse", "species:sharp-tailed-grouse", "species:greater-sage-grouse",
  "species:gray-partridge", "species:chukar", "species:ring-necked-pheasant",
] as const;

const US_LAYERS: UsLayer[] = [
  {
    layer: {
      id: "layer:us-id-gmu",
      jurisdictionId: "jurisdiction:us-id",
      jurisdictionName: "Idaho",
      country: "US",
      officialTerm: "Game Management Unit",
      officialTermShort: "Unit",
      coverage: "IN_DEVELOPMENT",
      coverageNote:
        "Idaho's Game Management Units, read from Idaho Fish and Game's own map service at the time of each question. " +
        "Idaho describes the layer as a best representation only; the unit boundary descriptions in the regulation booklet control.",
      authority: "Idaho Department of Fish and Game",
      sourceId: "source:us-id-gmu-service",
      endpoint: "https://gisportal-idfg.idaho.gov/hosting/rest/services/Hunting/MapServer/3/query",
      nameField: "NAME",
      bounds: { minLatitude: 41.98, maxLatitude: 49.01, minLongitude: -117.25, maxLongitude: -111.03 },
      serving: true,
      // Certified pronghorn rules (54 controlled hunts) answer through this layer.
      rulesServing: true,
      officialNamePrefix: "Game Management Unit ",
      zoneIdPrefix: "management_zone:us-id-gmu-",
      // The layer's Yellowstone National Park record is not an Idaho unit.
      designationOf: (raw) => (typeof raw === "string" && raw.trim() !== "" && raw.trim() !== "YNP" ? raw.trim() : null),
      legalStanding: {
        kind: "DERIVED_FROM_LEGAL_DESCRIPTION",
        statedAs:
          "Idaho Fish and Game: “Refer to the boundaries published in the current IDFG regulation booklet before hunting or " +
          "pursuing game animals. The data represented in this file is true and accurate to the best of our knowledge but is " +
          "considered a best representation only.” The booklet's Unit Boundary Descriptions control.",
        controllingText: { title: "Idaho Big Game 2026 Seasons & Rules, Unit Boundary Descriptions", url: "https://idfg.idaho.gov/sites/default/files/seasons-rules-big-game-2026.pdf" },
      },
      provenanceTimeZone: "America/Boise" as ProvenanceTimeZone,
      resolution: "LIVE_SERVICE",
    },
    adapter: {
      jurisdictionKey: "us-id",
      zoneType: "GMU",
      layerUrl: "https://gisportal-idfg.idaho.gov/hosting/rest/services/Hunting/MapServer/3",
      idField: "NAME",
      keepFields: ["ID", "Elk_Zone"],
      expectedRecords: 100,
      expectedUnits: 99,
      multipartUnits: {},
      quarantine: [{ reason: "Yellowstone National Park, drawn in the layer but not an Idaho Game Management Unit.", match: { field: "NAME", value: "YNP" } }],
      sourceVersion: "Hunting/MapServer/3, units last edited 2026-08-21",
    },
  },
  {
    layer: {
      id: "layer:us-mt-deer-elk-hd",
      jurisdictionId: "jurisdiction:us-mt",
      jurisdictionName: "Montana",
      country: "US",
      officialTerm: "Deer and Elk Hunting District",
      officialTermShort: "HD",
      coverage: "IN_DEVELOPMENT",
      coverageNote:
        "Montana's deer and elk hunting districts for the 2026 licence year, read from Montana Fish, Wildlife & Parks' own map service. " +
        "The district descriptions the Commission adopted control; the map is a guide.",
      authority: "Montana Fish, Wildlife & Parks",
      sourceId: "source:us-mt-deer-elk-hd-service",
      endpoint: "https://fwp-gis.mt.gov/arcgis/rest/services/admbnd/huntingDistricts/MapServer/11/query",
      nameField: "DISTRICT",
      bounds: { minLatitude: 44.35, maxLatitude: 49.01, minLongitude: -116.06, maxLongitude: -104.03 },
      serving: false,
      officialNamePrefix: "Hunting District ",
      zoneIdPrefix: "management_zone:us-mt-hd-",
      speciesScope: ["species:elk", "species:mule-deer", "species:white-tailed-deer"],
      drawnByDefault: true,
      legalStanding: {
        kind: "DERIVED_FROM_LEGAL_DESCRIPTION",
        statedAs:
          "Montana Fish, Wildlife & Parks: its maps are “intended for use as a guide”, and “It is your responsibility to know " +
          "the legal boundaries of where you are hunting.” The hunting district descriptions the Commission adopted on December 4, 2025 control.",
        controllingText: {
          title: "2026–2027 hunting district legal descriptions",
          url: "https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-2027-legal-descriptions-finalfor-web.pdf",
        },
      },
      geometryPeriod: { from: "2026-03-01", to: "2027-02-28", statedAs: "Montana's 2026 licence year (March 1, 2026 to February 28, 2027)" },
      provenanceTimeZone: "America/Denver" as ProvenanceTimeZone,
      resolution: "LIVE_SERVICE",
    },
    adapter: {
      jurisdictionKey: "us-mt",
      zoneType: "DISTRICT",
      layerUrl: "https://fwp-gis.mt.gov/arcgis/rest/services/admbnd/huntingDistricts/MapServer/11",
      idField: "DISTRICT",
      keepFields: ["REG", "REGYEAR"],
      expectedRecords: 139,
      expectedUnits: 139,
      multipartUnits: {},
      quarantine: [],
      expectedAttributes: { REGYEAR: "2026" },
      sourceVersion: "huntingDistricts/MapServer/11, REGYEAR 2026",
    },
  },
  {
    layer: {
      id: "layer:us-mt-upland",
      jurisdictionId: "jurisdiction:us-mt",
      jurisdictionName: "Montana",
      country: "US",
      officialTerm: "Upland Game Bird District",
      officialTermShort: "Upland district",
      coverage: "IN_DEVELOPMENT",
      coverageNote:
        "Montana sets upland game bird seasons statewide, divided only at the Continental Divide. The two districts are read from " +
        "Montana Fish, Wildlife & Parks' own map service.",
      authority: "Montana Fish, Wildlife & Parks",
      sourceId: "source:us-mt-upland-district-service",
      endpoint: "https://fwp-gis.mt.gov/arcgis/rest/services/admbnd/huntingDistricts/MapServer/31/query",
      nameField: "NAME",
      bounds: { minLatitude: 44.35, maxLatitude: 49.01, minLongitude: -116.06, maxLongitude: -104.03 },
      serving: false,
      officialNamePrefix: "",
      zoneIdPrefix: "management_zone:us-mt-upland-",
      designationOf: (raw) => (typeof raw === "string" ? MT_UPLAND_NAMES[raw] ?? null : null),
      speciesScope: MT_SPECIES_UPLAND,
      drawnByDefault: false,
      legalStanding: {
        kind: "DERIVED_FROM_LEGAL_DESCRIPTION",
        statedAs:
          "Montana's upland game bird regulations divide the state at the Continental Divide. The map service is Montana Fish, Wildlife " +
          "& Parks' guide to that line; the regulations control.",
        controllingText: { title: "2026 Montana Upland Game Bird Regulations", url: "https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-upgbrd-final-for-web.pdf" },
      },
      geometryPeriod: { from: "2026-03-01", to: "2027-02-28", statedAs: "Montana's 2026 licence year (March 1, 2026 to February 28, 2027)" },
      provenanceTimeZone: "America/Denver" as ProvenanceTimeZone,
      resolution: "LIVE_SERVICE",
    },
    adapter: {
      jurisdictionKey: "us-mt",
      zoneType: "DISTRICT",
      layerUrl: "https://fwp-gis.mt.gov/arcgis/rest/services/admbnd/huntingDistricts/MapServer/31",
      idField: "NAME",
      normalise: (raw) => (typeof raw === "string" ? MT_UPLAND_NAMES[raw] ?? null : null),
      keepFields: ["REG"],
      expectedRecords: 2,
      expectedUnits: 2,
      multipartUnits: {},
      quarantine: [],
      sourceVersion: "huntingDistricts/MapServer/31 (no year field; checked 2026-09-21)",
    },
  },
  {
    layer: {
      id: "layer:us-co-gmu",
      jurisdictionId: "jurisdiction:us-co",
      jurisdictionName: "Colorado",
      country: "US",
      officialTerm: "Game Management Unit",
      officialTermShort: "GMU",
      coverage: "IN_DEVELOPMENT",
      coverageNote:
        "Colorado's Game Management Units, read from Colorado Parks and Wildlife's own feature service at the time of each question. " +
        "The written unit descriptions are the exact boundaries; maps are approximate.",
      authority: "Colorado Parks and Wildlife",
      sourceId: "source:us-co-gmu-service",
      endpoint: "https://services5.arcgis.com/ttNGmDvKQA7oeDQ3/arcgis/rest/services/CPWAdminData/FeatureServer/6/query",
      nameField: "GMUID",
      bounds: { minLatitude: 36.99, maxLatitude: 41.01, minLongitude: -109.07, maxLongitude: -102.03 },
      serving: false,
      officialNamePrefix: "Game Management Unit ",
      zoneIdPrefix: "management_zone:us-co-gmu-",
      legalStanding: {
        kind: "DERIVED_FROM_LEGAL_DESCRIPTION",
        statedAs:
          "Colorado Parks and Wildlife: “These descriptions are exact boundaries of the units; the boundaries depicted on the maps " +
          "in this brochure are approximate.” The unit descriptions in regulation (Chapter W-0) control.",
        controllingText: { title: "2026 Colorado Big Game Brochure, Game Management Unit boundary descriptions", url: "https://cpw.state.co.us/sites/default/files/dam/erjzbk48be/colorado-big-game-hunting-brochure.pdf" },
      },
      provenanceTimeZone: "America/Denver" as ProvenanceTimeZone,
      resolution: "LIVE_SERVICE",
    },
    adapter: {
      jurisdictionKey: "us-co",
      zoneType: "GMU",
      layerUrl: "https://services5.arcgis.com/ttNGmDvKQA7oeDQ3/arcgis/rest/services/CPWAdminData/FeatureServer/6",
      idField: "GMUID",
      objectIdField: "FID",
      // 568,339 vertices in all: read in small pages the hosted service will answer.
      pageSize: 20,
      keepFields: ["COUNTY", "ELKDAU", "DEERDAU"],
      expectedRecords: 186,
      expectedUnits: 186,
      multipartUnits: {},
      quarantine: [],
      sourceVersion: "CPWAdminData/FeatureServer/6, layer last edited 2026-08-27",
    },
  },
  {
    layer: {
      id: "layer:us-wy-elk-area",
      jurisdictionId: "jurisdiction:us-wy",
      jurisdictionName: "Wyoming",
      country: "US",
      officialTerm: "Elk Hunt Area",
      officialTermShort: "Elk Area",
      coverage: "IN_DEVELOPMENT",
      coverageNote:
        "Wyoming sets hunt areas per species. Its elk hunt areas are read from the Wyoming Game and Fish Department's own feature " +
        "service; the written descriptions in Chapter 7 take precedence in any locational dispute.",
      authority: "Wyoming Game and Fish Department",
      sourceId: "source:us-wy-elk-area-service",
      endpoint: "https://services6.arcgis.com/cWzdqIyxbijuhPLw/arcgis/rest/services/ElkHuntAreas/FeatureServer/0/query",
      nameField: "HUNTAREA",
      bounds: { minLatitude: 40.99, maxLatitude: 45.01, minLongitude: -111.06, maxLongitude: -104.05 },
      serving: false,
      officialNamePrefix: "Elk Hunt Area ",
      zoneIdPrefix: "management_zone:us-wy-elk-area-",
      speciesScope: ["species:elk"],
      drawnByDefault: true,
      legalStanding: {
        kind: "PLANNING_GUIDANCE",
        statedAs:
          "Wyoming Game and Fish Department: the data “should never be used at a scale larger than 1:100,000”, “published written " +
          "boundary descriptions … take precedence in resolving locational disputes”, and the data “are not legal documents”.",
        controllingText: { title: "Chapter 7, Elk Hunting Seasons, Section 9 hunt area descriptions (effective June 10, 2026)", url: "https://wgfd.wyo.gov/media/33695/download?inline" },
      },
      geometryPeriod: { from: "2026-06-10", to: "2027-05-31", statedAs: "Chapter 7 as filed effective June 10, 2026, before its three-year successor" },
      provenanceTimeZone: "America/Denver" as ProvenanceTimeZone,
      resolution: "LIVE_SERVICE",
    },
    adapter: {
      jurisdictionKey: "us-wy",
      zoneType: "OTHER",
      layerUrl: "https://services6.arcgis.com/cWzdqIyxbijuhPLw/arcgis/rest/services/ElkHuntAreas/FeatureServer/0",
      idField: "HUNTAREA",
      keepFields: ["HUNTNAME", "HERDUNIT", "Region"],
      expectedRecords: 105,
      expectedUnits: 105,
      multipartUnits: {},
      quarantine: [],
      sourceVersion: "ElkHuntAreas/FeatureServer/0, data last edited 2026-03-19",
    },
  },
  {
    layer: {
      id: "layer:us-ma-wmz",
      jurisdictionId: "jurisdiction:us-ma",
      jurisdictionName: "Massachusetts",
      country: "US",
      officialTerm: "Wildlife Management Zone",
      officialTermShort: "Zone",
      coverage: "IN_DEVELOPMENT",
      coverageNote:
        "Massachusetts' 15 Wildlife Management Zones, read from MassWildlife's own feature service at the time of each " +
        "question. The division states no reuse terms for the dataset, so under the owner's 2026-10-06 decision North " +
        "Ground queries the public service live and stores no copy of its polygons. Zone 4 is genuinely split into 4N " +
        "and 4S and both are rule-bearing, so the layer carries 15 designations rather than 14.",
      authority: "Massachusetts Division of Fisheries and Wildlife",
      sourceId: "source:us-ma-wmz-service",
      endpoint: "https://services1.arcgis.com/7iJyYTjCtKsZS1LR/arcgis/rest/services/WildlifeManagementZones/FeatureServer/0/query",
      nameField: "DMZ",
      bounds: { minLatitude: 41.18, maxLatitude: 42.89, minLongitude: -73.51, maxLongitude: -69.86 },
      serving: true,
      /* No Massachusetts regulatory bundle is certified, so the layer resolves a
         point to its official zone and answers no season. Boundary capability
         and regulatory capability are tracked separately and this is the first
         without the second. */
      rulesServing: false,
      officialNamePrefix: "Wildlife Management Zone ",
      zoneIdPrefix: "management_zone:us-ma-wmz-",
      /* 1 to 14, with 4 served as 4N and 4S. A value outside that set is not a
         Massachusetts zone and is refused rather than passed through. */
      designationOf: (raw) => {
        const value = typeof raw === "string" ? raw.trim().toUpperCase() : typeof raw === "number" ? String(raw) : "";
        return /^(?:[1-9]|1[0-4]|4[NS])$/.test(value) ? value : null;
      },
      legalStanding: {
        kind: "DERIVED_FROM_LEGAL_DESCRIPTION",
        statedAs:
          "MassWildlife describes the dataset in its own words as the zones it manages deer by: “MassWildlife manages deer " +
          "numbers in the state with regulated hunting in these 15 Wildlife Management Zones.” The division publishes no " +
          "statement that the layer is the legal boundary, and the zone descriptions in 321 CMR control.",
        controllingText: { title: "321 CMR 3.02: Hunting", url: "https://www.mass.gov/regulations/321-CMR-302-hunting" },
      },
      provenanceTimeZone: "America/New_York" as ProvenanceTimeZone,
      resolution: "LIVE_SERVICE",
    },
    adapter: {
      jurisdictionKey: "us-ma",
      zoneType: "ZONE",
      layerUrl: "https://services1.arcgis.com/7iJyYTjCtKsZS1LR/arcgis/rest/services/WildlifeManagementZones/FeatureServer/0",
      idField: "DMZ",
      keepFields: ["OBJECTID", "ACRES"],
      expectedRecords: 15,
      expectedUnits: 15,
      multipartUnits: {},
      quarantine: [],
      sourceVersion: "WildlifeManagementZones/FeatureServer/0, read 2026-10-06",
    },
  },
  {
    layer: {
      id: "layer:us-la-deer-area",
      jurisdictionId: "jurisdiction:us-la",
      jurisdictionName: "Louisiana",
      country: "US",
      officialTerm: "Deer Management Area",
      officialTermShort: "Area",
      coverage: "IN_DEVELOPMENT",
      coverageNote:
        "Louisiana's 10 Deer Management Areas, read from the Department of Wildlife and Fisheries' own feature " +
        "service at the time of each question. The department states no reuse terms, so under the owner's " +
        "2026-10-06 decision North Ground queries the public service live and stores no copy.",
      authority: "Louisiana Department of Wildlife and Fisheries",
      sourceId: "source:us-la-deer-area-service",
      endpoint: "https://services1.arcgis.com/6euNCaGPCgCzgAVF/arcgis/rest/services/HuntingAreas/FeatureServer/3/query",
      nameField: "Area_ID",
      bounds: { minLatitude: 28.85, maxLatitude: 33.03, minLongitude: -94.05, maxLongitude: -88.75 },
      serving: true,
      rulesServing: false,
      /*
       * ONE SERVICE, SEVEN SPECIES GEOGRAPHIES. Layers 0 to 5 are Alligator,
       * Dove, Goose, Deer, Waterfowl and Turkey, and they are different
       * boundaries. Drawing the deer areas under a turkey question would put a
       * right-looking official boundary under the wrong answer — the case
       * Newfoundland's moose, caribou and bear areas already establish — so this
       * layer is scoped to deer and drawn by default before a species is chosen.
       */
      speciesScope: ["species:white-tailed-deer"],
      drawnByDefault: true,
      officialNamePrefix: "Deer Management Area ",
      zoneIdPrefix: "management_zone:us-la-deer-area-",
      /* Area 1 to 10; anything else is not a Louisiana deer area. */
      designationOf: (raw) => {
        const value = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
        return /^(?:[1-9]|10)$/.test(value) ? value : null;
      },
      legalStanding: {
        kind: "DERIVED_FROM_LEGAL_DESCRIPTION",
        statedAs:
          "The Department of Wildlife and Fisheries publishes the deer areas as a map layer and states nothing about " +
          "its legal standing. The area descriptions in the Louisiana Administrative Code control.",
        controllingText: { title: "Louisiana Administrative Code Title 76, Part XIX (Hunting and WMA Regulations)", url: "https://www.wlf.louisiana.gov/page/hunting-regulations" },
      },
      provenanceTimeZone: "America/Chicago" as ProvenanceTimeZone,
      resolution: "LIVE_SERVICE",
    },
    adapter: {
      jurisdictionKey: "us-la",
      zoneType: "ZONE",
      layerUrl: "https://services1.arcgis.com/6euNCaGPCgCzgAVF/arcgis/rest/services/HuntingAreas/FeatureServer/3",
      idField: "Area_ID",
      keepFields: ["OBJECTID"],
      expectedRecords: 10,
      expectedUnits: 10,
      multipartUnits: {},
      quarantine: [],
      sourceVersion: "HuntingAreas/FeatureServer/3, read 2026-10-07",
    },
  },
];

const LICENCES: Readonly<Record<string, SourceLicence>> = {
  "layer:us-la-deer-area": {
    statedAs:
      "NONE STATED. The Louisiana Department of Wildlife and Fisheries states no reuse, redistribution or attribution " +
      "term for this dataset. Verbatim at every slot checked on 2026-10-07: FeatureServer copyrightText \"\"; layer 3 " +
      "copyrightText \"\".",
    url: "https://services1.arcgis.com/6euNCaGPCgCzgAVF/arcgis/rest/services/HuntingAreas/FeatureServer?f=json",
    retrievedAt: "2026-10-07",
    sha256: "sha256:6a4c566f100a778103814ff917c391f521d9c61025252c90ad75951f267b48df",
    redistribution: "UNRESOLVED",
    permittedUse: "LIVE_READ_NO_STATED_TERMS",
    attribution: "Louisiana Department of Wildlife and Fisheries",
    note:
      "An absence with the evidence of the absence. The service answered anonymously over ordinary HTTPS with no " +
      "authentication and no referrer (HTTP 200, 166 ms), layer 3 supports Query, and ten features carry Area_ID 1 to " +
      "10. POSITIVE CONTROL: the same slots DO carry terms elsewhere in this file — Idaho's CC-BY and Montana's " +
      "\"as is\" were read from them — so an empty result here is measured rather than a failed lookup. Permits the " +
      "LIVE query and never a stored copy.",
  },
  "layer:us-ma-wmz": {
    statedAs:
      "NONE STATED. MassWildlife states no reuse, redistribution or attribution term for this dataset. Verbatim at every " +
      "slot checked on 2026-10-06: FeatureServer copyrightText \"\"; layer 0 copyrightText \"\"; ArcGIS Online item " +
      "licenseInfo \"\"; item accessInformation null.",
    url: "https://services1.arcgis.com/7iJyYTjCtKsZS1LR/arcgis/rest/services/WildlifeManagementZones/FeatureServer?f=json",
    retrievedAt: "2026-10-06",
    sha256: "sha256:f9887d6b3b675ecfd2a610d6421bcfbf6714cd7c85c17978ac4ff3f3d926bb1d",
    redistribution: "UNRESOLVED",
    permittedUse: "LIVE_READ_NO_STATED_TERMS",
    attribution: "Massachusetts Division of Fisheries and Wildlife",
    note:
      "An absence, recorded with the evidence of the absence. The service answered anonymously over ordinary HTTPS with no " +
      "authentication and no referrer (HTTP 200, 281 ms), its layer supports Query, and the hosting ArcGIS Online item is " +
      "organisation-owned rather than a personal account. Nothing at any slot prohibits automated read-only use and nothing " +
      "grants reuse. POSITIVE CONTROL for the absence: the same search pattern DOES return terms elsewhere in this file — " +
      "Idaho's CC-BY and Montana's \"as is\" were both read from the same slots — so an empty result here is a measured " +
      "absence rather than a failed lookup. Under the owner's 2026-10-06 decision this permits the LIVE query and never a " +
      "stored copy; `licencePermitsStoredCopy` refuses this state structurally.",
  },
  "layer:us-id-gmu": {
    statedAs: "CC-BY Idaho Fish and Game",
    url: "https://gisportal-idfg.idaho.gov/hosting/rest/services/Hunting/MapServer?f=json",
    retrievedAt: "2026-09-22",
    sha256: "sha256:dba42260efa36b846633480ebb4976c09cfafc63d6f4209da0619a37aa0ae8b0",
    redistribution: "UNRESOLVED",
    permittedUse: "COMMERCIAL_PERMITTED",
    attribution: "Idaho Fish and Game",
    note: "The service's own copyrightText names CC-BY, which permits commercial use with attribution. The Game Units layer's copyrightText is “Idaho Fish and Game”.",
  },
  "layer:us-mt-deer-elk-hd": {
    statedAs: "INFORMATION ON MONTANA FISH, WILDIFE & PARK'S COMPUTER SYSTEMS IS MADE AVAILABLE AS A PUBLIC SERVICE, WITHOUT EXPRESS OR IMPLIED WARRANTIES OF ANY KIND, AND IS SUBJECT TO THE FOLLOWING DISCLAIMERS: … 4. COPYRIGHT LIMITATIONS FWP has made the content of certain pages of its web sites available to the public. Anyone may view, copy, or distribute information found within these web pages (not including the design or layout of the pages) for personal or informational use without owing an obligation to FWP if the documents are not modified in any respect, and unless otherwise stated on the particular materials or information to which a restriction on free use applies.",
    url: "https://fwp.mt.gov/terms-of-use",
    retrievedAt: "2026-10-07",
    sha256: "sha256:59804ca299ce1299501317b1a264d9a587c97e2d225b0712590ae6f8e108ece4",
    redistribution: "UNRESOLVED",
    permittedUse: "UNRESOLVED",
    attribution: "Montana Fish, Wildlife & Parks",
    note: "MEASURED 2026-10-07. CORRECTION TO MY OWN EARLIER READING AND TO MY FIRST CLASSIFICATION TODAY. The earlier note here said FWP's terms “state no reuse or redistribution grant”, and I was about to record Montana as TERMS_SILENT_ON_USE alongside Colorado and Wyoming. Both are wrong: section 4, COPYRIGHT LIMITATIONS, DOES address use and grants one — “Anyone may view, copy, or distribute information found within these web pages … for personal or informational use … if the documents are not modified in any respect”. SO MONTANA IS NEITHER SILENT NOR PLAINLY REFUSING. It grants copying and distribution under two conditions North Ground's use does not obviously satisfy: a commercial outdoor-intelligence product is arguably neither personal nor informational use, and normalising geometry into our own model is modification. A third question is scope: the section speaks of “the content of certain pages of its web sites”, and whether an ArcGIS feature service is such a page is not something this record can settle. IT STAYS UNRESOLVED, deliberately: calling it RESTRICTED would assert a refusal FWP has not made of us, and calling it a grant would assert permission it has not given for this use — §8 in both directions. HOW IT WAS MEASURED: fwp.mt.gov/terms-of-use read anonymously, HTTP 200, 6.7 s, full text extracted and swept for ‘reuse’, ‘redistribut’, ‘commercial’, ‘licen’, ‘copyright’, ‘resale’, ‘republish’ and ‘derivative’ — only ‘copyright’ hit, twice, and reading those two hits is what found the grant a keyword list for ‘licence’ would have missed. The service itself (fwp-gis.mt.gov/arcgis/rest/services/admbnd/huntingDistricts/MapServer, HTTP 200, 455 ms) is self-hosted ArcGIS Server with no item licence field at all: its copyrightText is “Montana Fish, Wildlife & Parks” and its serviceDescription and layer description are purpose statements, so the website terms are the only slot that can carry use terms, and they do. Escalated: a person must obtain FWP's position on commercial reuse of the hunting district service before Montana serves.",
  },
  "layer:us-mt-upland": {
    statedAs: "INFORMATION ON MONTANA FISH, WILDIFE & PARK'S COMPUTER SYSTEMS IS MADE AVAILABLE AS A PUBLIC SERVICE, WITHOUT EXPRESS OR IMPLIED WARRANTIES OF ANY KIND, AND IS SUBJECT TO THE FOLLOWING DISCLAIMERS: … 4. COPYRIGHT LIMITATIONS FWP has made the content of certain pages of its web sites available to the public. Anyone may view, copy, or distribute information found within these web pages (not including the design or layout of the pages) for personal or informational use without owing an obligation to FWP if the documents are not modified in any respect, and unless otherwise stated on the particular materials or information to which a restriction on free use applies.",
    url: "https://fwp.mt.gov/terms-of-use",
    retrievedAt: "2026-10-07",
    sha256: "sha256:59804ca299ce1299501317b1a264d9a587c97e2d225b0712590ae6f8e108ece4",
    redistribution: "UNRESOLVED",
    permittedUse: "UNRESOLVED",
    attribution: "Montana Fish, Wildlife & Parks",
    note: "MEASURED 2026-10-07. CORRECTION TO MY OWN EARLIER READING AND TO MY FIRST CLASSIFICATION TODAY. The earlier note here said FWP's terms “state no reuse or redistribution grant”, and I was about to record Montana as TERMS_SILENT_ON_USE alongside Colorado and Wyoming. Both are wrong: section 4, COPYRIGHT LIMITATIONS, DOES address use and grants one — “Anyone may view, copy, or distribute information found within these web pages … for personal or informational use … if the documents are not modified in any respect”. SO MONTANA IS NEITHER SILENT NOR PLAINLY REFUSING. It grants copying and distribution under two conditions North Ground's use does not obviously satisfy: a commercial outdoor-intelligence product is arguably neither personal nor informational use, and normalising geometry into our own model is modification. A third question is scope: the section speaks of “the content of certain pages of its web sites”, and whether an ArcGIS feature service is such a page is not something this record can settle. IT STAYS UNRESOLVED, deliberately: calling it RESTRICTED would assert a refusal FWP has not made of us, and calling it a grant would assert permission it has not given for this use — §8 in both directions. HOW IT WAS MEASURED: fwp.mt.gov/terms-of-use read anonymously, HTTP 200, 6.7 s, full text extracted and swept for ‘reuse’, ‘redistribut’, ‘commercial’, ‘licen’, ‘copyright’, ‘resale’, ‘republish’ and ‘derivative’ — only ‘copyright’ hit, twice, and reading those two hits is what found the grant a keyword list for ‘licence’ would have missed. The service itself (fwp-gis.mt.gov/arcgis/rest/services/admbnd/huntingDistricts/MapServer, HTTP 200, 455 ms) is self-hosted ArcGIS Server with no item licence field at all: its copyrightText is “Montana Fish, Wildlife & Parks” and its serviceDescription and layer description are purpose statements, so the website terms are the only slot that can carry use terms, and they do. Escalated: a person must obtain FWP's position on commercial reuse of the hunting district service before Montana serves.",
  },
  "layer:us-co-gmu": {
    statedAs: "This map is a product and property of the Colorado Parks and Wildlife, a division of the Colorado Department of Natural Resources. Care should be taken in interpreting these data. Written documents may accompany this map and should be referenced. The Colorado Department of Natural Resources is not responsible and shall not be liable to the user for damages of any kind arising out of the use of data or information provided by the Department, including the installation of the data or information, its use, or the results obtained from its use. ANY DATA OR INFORMATION PROVIDED BY THE DEPARTMENT OF NATURAL RESOURCES IS PROVIDED \"AS IS\" WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MECHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. Data or information provided by the Department of Natural Resources shall be used and relied upon only at the user's sole risk, and the user agrees to indemnify and hold harmless the Department of Natural Resources, its officials, officers and employees from any liability arising out of the use of the data or information provided.",
    url: "https://www.arcgis.com/home/item.html?id=168fccb0583f42f1afe57de6c9ce846d",
    retrievedAt: "2026-10-07",
    sha256: "sha256:a7f10277b62f7bebbeb444bc3982a2375b91134ea3a73c79aa73fb3990d44c9d",
    redistribution: "UNRESOLVED",
    permittedUse: "TERMS_SILENT_ON_USE",
    attribution: "Colorado Parks and Wildlife",
    note: "MEASURED 2026-10-07 to the Massachusetts standard, and it CORRECTS the earlier note here, which read “a copyright line only; no terms found on the service”. That was true of the SERVICE; the terms are on the ITEM: root copyrightText \"Colorado Parks and Wildlife\"; layer 6 copyrightText \"Colorado Parks and Wildlife GIS Group\"; root serviceDescription and description are purpose and lineage (\"to provide public access to CPW data\", \"for public distribution\"); item accessInformation \"Colorado Parks and Wildlife\". The item licenceInfo above is the only slot addressing anything beyond attribution and lineage, and what it addresses is WARRANTY, LIABILITY and where to obtain the data — not use. SO THIS IS NOT THE SILENCE CASE the owner's 2026-10-06 decision unblocked: §44 requires an absence looked for and measured, with a positive control proving the search could have found terms had any existed, and here the search found terms. POSITIVE CONTROL: the same search returns licenceInfo null for two further items over the same Colorado service and populated for this one, so the slot is read when it is filled. ORGANISATION: ttNGmDvKQA7oeDQ3 resolves to \"Colorado Parks & Wildlife\", urlKey CPW. OPEN FOR THE OWNER: whether terms that exist and do not address use permit a live read is an extension of §44 and is not ours to make, so nothing is served on it.",
  },
  "layer:us-wy-elk-area": {
    statedAs: "The State of Wyoming and Wyoming Game and Fish Department provide this data and any related materials \"as is\", without warranty of any kind, expressed or implied, including the utility of the data on non-State of Wyoming computer systems. The State of Wyoming and Wyoming Game and Fish Department shall not be held liable for improper or incorrect use of the data described and/or contained herein. The State of Wyoming and Wyoming Game and Fish Department give no warranty, expressed or implied, as to the accuracy, reliability, or completeness of these data. It is strongly recommended that these data be directly acquired from the Wyoming Game and Fish Department and not indirectly through other sources, which may have changed the data in some way. This disclaimer applies both to individual use of the data and aggregate use with other data. This data set should never be used at a scale larger than 1:100,000. When applicable, published written boundary descriptions maintained by and available from the Wyoming Game and Fish Department should be referenced for detailed boundary information and take precedence in resolving locational disputes. These data and related graphics (i.e. \"PDF or JPG\" format files) are not legal documents and are not intended to be used as such. The information contained in these data is dynamic and may change over time. The data are not better than the original sources from which they were derived. It is the responsibility of the data user to use the data appropriately and consistent within the limitations of geospatial data in general and these data in particular. Any related graphics are intended to aid the data user in acquiring relevant data; it is not appropriate to use the related graphics as data.",
    url: "https://www.arcgis.com/home/item.html?id=1cd21d69c98649f782a8d44380343259",
    retrievedAt: "2026-10-07",
    sha256: "sha256:d66aec6a32cc4d62fb37610d9a97345c23048fcfc150799db4309ccbab96919d",
    redistribution: "UNRESOLVED",
    permittedUse: "TERMS_SILENT_ON_USE",
    attribution: "Wyoming Game and Fish Department, State of Wyoming",
    note: "MEASURED 2026-10-07 to the Massachusetts standard, and it CORRECTS the earlier note here, which read “a copyright line only; no terms found on the service”. That was true of the SERVICE; the terms are on the ITEM: root and layer 0 copyrightText both \"Wyoming Game and Fish Department, State of Wyoming\"; root serviceDescription and description are purpose and lineage; item accessInformation \"Wyoming Game and Fish Department, State of Wyoming\". The item licenceInfo above is the only slot addressing anything beyond attribution and lineage, and what it addresses is WARRANTY, LIABILITY and where to obtain the data — not use. SO THIS IS NOT THE SILENCE CASE the owner's 2026-10-06 decision unblocked: §44 requires an absence looked for and measured, with a positive control proving the search could have found terms had any existed, and here the search found terms. POSITIVE CONTROL: the same search returns licenceInfo null for two further items over the same Colorado service and populated for this one, so the slot is read when it is filled. ORGANISATION: the item owner is WyomingGameAndFish@wgfd; the org endpoint for cWzdqIyxbijuhPLw refuses an anonymous read (\"You do not have permissions to access this resource\"), so ownership rests on the owner account rather than on a portal name. The field is published as HTML; the text above is the same words with the publisher's markup removed, recorded rather than passed off as the raw field. OPEN FOR THE OWNER: whether terms that exist and do not address use permit a live read is an extension of §44 and is not ours to make, so nothing is served on it.",
  },
};

const CERTIFIED_UNITS = new Map<string, readonly string[]>([
  [montanaCertifiedUnits.layerId, montanaCertifiedUnits.certifiedUnits],
  [idahoCertifiedUnits.layerId, idahoCertifiedUnits.certifiedUnits],
  [wyomingCertifiedUnits.layerId, wyomingCertifiedUnits.certifiedUnits],
  [coloradoCertifiedUnits.layerId, coloradoCertifiedUnits.certifiedUnits],
]);
for (const { layer } of US_LAYERS) {
  layer.certifiedDesignations = new Set((CERTIFIED_UNITS.get(layer.id) ?? []).map((unit) => unit.toUpperCase()));
  layer.licence = LICENCES[layer.id];
  /* The licence decides, not the intent above: a dataset whose publisher grants
     no reuse is not drawn, resolved or answered from, however certified its
     geometry and rules are. Resolving one is a person's job, not an agent's. */
  if (!licencePermitsServing(layer.licence)) {
    layer.serving = false;
    layer.rulesServing = false;
  }
}

export const US_ZONE_LAYERS: ZoneLayer[] = US_LAYERS.map((entry) => entry.layer);

/** The certification adapter configuration for a layer, derived from the same description the resolver uses. */
export function usAdapterConfig(layerId: string): ArcgisZoneSourceConfig {
  const entry = US_LAYERS.find((candidate) => candidate.layer.id === layerId);
  if (!entry) throw new Error(`No U.S. layer ${layerId}. Known: ${US_LAYERS.map((candidate) => candidate.layer.id).join(", ")}`);
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

export const US_LAYER_IDS = US_LAYERS.map((entry) => entry.layer.id);
