/**
 * The Canada coverage registry.
 *
 * One machine-readable answer to "how much of Canadian hunting does North Ground
 * actually cover?" — and, just as importantly, to "what do we not cover, and do
 * we know it?".
 *
 * Two rules give this file its value:
 *
 *  1. It declares STRUCTURE, never counts. How many units a jurisdiction has
 *     ingested, how many rules it holds, which species are certified — all of
 *     that is computed from the certified data by `report.ts`. A number typed
 *     here would be a claim nobody re-checks, and the first thing to go stale.
 *
 *  2. Absence is explicit. A jurisdiction with no ingested geometry says so with
 *     `IN_DEVELOPMENT` and a named official source still to be reviewed. It never
 *     says `UNAVAILABLE` unless the authority genuinely publishes nothing, and it
 *     never says `VERIFIED` because a source exists.
 *
 * Jurisdiction identity, official management terminology and source leads come
 * from `research/hunting/jurisdictions.csv` and `gis-sources.csv`, which are
 * review inputs rather than production rule data. Nothing here encodes a season,
 * a limit or a legal condition: those live only in certified regulatory bundles.
 */

import type { CanonicalId } from "../../content-contract/index.ts";

/**
 * How far a capability has been taken for a jurisdiction.
 *
 * Deliberately the same vocabulary the rest of the product already uses for
 * coverage, rather than a second scale that would have to be mapped.
 */
export type CoverageState =
  /** Ingested, parity-certified against the authority, and serving production. */
  | "VERIFIED"
  /** Genuinely in production for part of the jurisdiction, with the rest known-absent. */
  | "PARTIAL"
  /** An official source is identified; nothing is certified or served yet. */
  | "IN_DEVELOPMENT"
  /** The authority publishes nothing usable for this capability. */
  | "UNAVAILABLE"
  /** Not yet researched. Distinct from UNAVAILABLE, which is a finding. */
  | "UNKNOWN";

/** Whether a source still reflects the law North Ground published against it. */
export type SourceState = "CURRENT" | "STALE" | "CHANGED" | "NEEDS_REVIEW" | "NOT_INGESTED";

export interface JurisdictionSpatial {
  status: CoverageState;
  /** What this authority calls its units, in its own words. */
  officialTerm: string;
  officialTermFr?: string;
  /** The authority's own published source, not a third-party mirror. */
  officialSourceUrl: string;
  /** Machine-readable service, where one has passed endpoint review. */
  serviceUrl?: string;
  /** Set only once geometry is ingested AND parity-certified against the authority. */
  parityCertified: boolean;
  notes?: string;
}

export interface JurisdictionRegulatory {
  status: CoverageState;
  /** Certified bundles this jurisdiction evaluates from. Empty until one exists. */
  bundleIds: string[];
  /** Named official publications, for review rather than for evaluation. */
  sourceLeads: string[];
  sourceState: SourceState;
  notes?: string;
}

export interface CanadaJurisdiction {
  id: CanonicalId<"jurisdiction">;
  /** ISO 3166-2 subdivision code, or `federal`. */
  code: string;
  nameEn: string;
  nameFr: string;
  /** Federal layers compose WITH a province's rules; they never replace them. */
  kind: "province" | "territory" | "federal";
  spatial: JurisdictionSpatial;
  regulatory: JurisdictionRegulatory;
  /**
   * What is known to be missing. Written as prose because a reviewer needs the
   * reason, not a code — and because an empty list here would be a claim of
   * completeness.
   */
  knownGaps: string[];
}

/* ── The registry ──────────────────────────────────────────────────────────
   Ordered as the rollout runs: Ontario and Québec first, then the prairies,
   British Columbia, Atlantic Canada, the territories, and the federal layer. */

export const CANADA_JURISDICTIONS: CanadaJurisdiction[] = [
  {
    id: "jurisdiction:ca-on",
    code: "CA-ON",
    nameEn: "Ontario",
    nameFr: "Ontario",
    kind: "province",
    spatial: {
      status: "VERIFIED",
      officialTerm: "Wildlife Management Unit (WMU)",
      officialSourceUrl: "https://geohub.lio.gov.on.ca/datasets/mnrf::wildlife-management-unit/about",
      serviceUrl: "https://ws.lioservices.lrc.gov.on.ca/arcgis1071a/rest/services/LIO_OPEN_DATA/LIO_Open04/MapServer/17",
      parityCertified: true,
      notes:
        "All 151 units ingested into PostGIS and certified against the province's own service at 309 sample points " +
        "with zero disagreements. Sub-unit designations are preserved exactly as the authority writes them.",
    },
    regulatory: {
      status: "PARTIAL",
      bundleIds: ["ca-on-small-game-2026", "ca-on-major-game-2026"],
      sourceLeads: ["2026 Ontario Hunting Regulations Summary"],
      sourceState: "CURRENT",
      notes:
        "Eight certified species across two bundles. Coverage is per unit, not per province: a unit no season row " +
        "names stays UNKNOWN, and a unit whose cell reads \"None\" is CLOSED because the authority said so.",
    },
    knownGaps: [
      "WMU 51 (Algonquin Provincial Park) is named by no small-game season row. Hunting there is governed by provincial park legislation North Ground does not hold, so every small-game query there returns UNKNOWN.",
      "Controlled deer hunts and moose seasons with controlled hunter numbers are published but deliberately not certified: both are allocated per hunt code or by draw and are not decidable from location and date.",
      "Migratory game birds are federal and are not covered by either Ontario bundle.",
      "Municipal firearm-discharge bylaws, land access and protected-area restrictions are outside the certified result.",
    ],
  },
  {
    id: "jurisdiction:ca-qc",
    code: "CA-QC",
    nameEn: "Québec",
    nameFr: "Québec",
    kind: "province",
    spatial: {
      // Ingested, parity-certified and served (owner-approved 2026-09-21).
      status: "VERIFIED",
      officialTerm: "Hunting Zone",
      officialTermFr: "zone de chasse",
      officialSourceUrl:
        "https://www.quebec.ca/en/tourism-recreation-sport/sporting-and-outdoor-activities/sport-hunting/hunting-zone-maps",
      /* The ministry's own GeoServer, which is the service behind the government's
         Forêt ouverte map. Found by reading that map's published layer context
         rather than in the open-data portal, where the zones are not listed. */
      serviceUrl:
        "https://servicesvecto3.mern.gouv.qc.ca/geoserver/SmartFaunePub/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=SmartFaunePub:Zone_chasse_da3_sefaq",
      parityCertified: true,
      notes:
        "All 59 designations are in PostGIS exactly as the ministry publishes them — 28 numbered zones (1 to 24 " +
        "and 26 to 29; zone 25 is fishing only) divided into 59 parts, 9,509 polygons, 2,424,981 vertices — held " +
        "VERIFIED and served through the derivative-aware resolver (20260921114908). The part, not the number, is the regulatory " +
        "unit: 19N, 19SE, 19SO and 19SNO are four different seasons. " +
        "Parity is certified against the ministry's own service: 306 points, 0 disagreements " +
        "(fixtures/hunt/ca-qc-spatial-parity.json), including Maniwaki (10O), the named territories 08NMR, 27OSB and " +
        "27ESB, the CWD zones and zone 21's waters. Large zones are resolved through ST_Subdivide parts and measured " +
        "exactly to straight boundary edges; the map draws stored generalisations, never the full geometry. " +
        "check-quebec-zone-layer.mjs watches the layer's fingerprint daily; the layer returns Partie_zon as CP850 " +
        "bytes read as Latin-1, which the adapter reverses through the code page itself.",
    },
    regulatory: {
      status: "PARTIAL",
      bundleIds: ["bundle:ca-qc-2026"],
      sourceLeads: [
        "Ministère de l'Environnement, de la Lutte contre les changements climatiques, de la Faune et des Parcs — official hunting periods",
      ],
      sourceState: "CURRENT",
      notes:
        "Certified from the ministry's five French season pages (moose, white-tailed deer, black bear and wild turkey " +
        "for 2026 and 2027; small game from 1 April 2026), read in French and quoted rather than translated. Ten " +
        "species, 186 rules, each in force for its own year or licence year, persisted and read back identical. " +
        "Every other species answers UNKNOWN.",
    },
    knownGaps: [
      "Six row fragments stay unresolved on purpose: moose and black bear « Partie est et partie ouest de 19 sud (sauf la partie nord-ouest) » (2026 and 2027), which may reach 19SE and 19SO, and the hares' « Île-du-Havre-Aubert » (both licence years), in zone 21. Where they may apply, their dates answer NEEDS_VERIFICATION, never CLOSED.",
      "Species the pages publish but North Ground has not encoded: coyote and wolf, woodchuck, raccoon, fox, grey partridge, ptarmigan, the nuisance birds, released game birds, rock pigeon, and the moose seasons stated per zec. Each section is hashed, so a change is still detected. Migratory birds are federal.",
      "Zones d'exploitation contrôlée (zecs), réserves fauniques and pourvoiries carry their own access rules and, in some zecs, their own seasons (named in the answer). North Ground does not hold their boundaries; the TFS layer's licence (CC-BY-NC-ND 4.0 on Données Québec) must be settled first.",
      "Territories closed to all hunting (72 ecological reserves, 27 Québec and 4 federal national parks, 24 closed territories, all of zone 19 Nord) are read from the ministry's Chasse_Interdite layer at the exact point, and an answer inside one is NEEDS_VERIFICATION, quoting the ministry. They are not indexed per zone, so a whole-zone card says they are checked only at a point.",
      "Zone 17 moose is closed to sport hunting, as the ministry states. Harvesting there under the James Bay and Northern Québec Agreement is a separate legal context North Ground does not evaluate, and every Québec answer says so.",
      "The CWD enhanced surveillance zone (08NZ, 09OZ, 10EZ) is named by no season table, so deer there is UNKNOWN with a note saying where the point is. The disease pages that state its obligations have not been read as a regulatory source.",
      "Legal hunting hours are not certified; turkey's are carried verbatim as the ministry states them.",
      "The licence under which the ministry's GIS layers may be reused is not named by the service (AccessConstraints NONE); the ministry's map states it has no legal value, which every Québec answer repeats.",
    ],
  },
  {
    id: "jurisdiction:ca-mb",
    code: "CA-MB",
    nameEn: "Manitoba",
    nameFr: "Manitoba",
    kind: "province",
    spatial: {
      status: "VERIFIED",
      officialTerm: "Game Hunting Area (GHA)",
      officialSourceUrl: "https://web2.gov.mb.ca/laws/regs/current/220-86.php",
      serviceUrl: "https://services.arcgis.com/mMUesHYPkXjaFGfS/arcgis/rest/services/Manitoba_Game_Hunting_Areas/FeatureServer/0",
      parityCertified: true,
      notes:
        "All 62 Game Hunting Areas defined in M.R. 220/86 ingested from the province's dedicated GHA layer and certified " +
        "against it at 201 points with zero disagreements. The layer's 63rd polygon has no designation and is Riding " +
        "Mountain National Park, which the regulation draws GHAs 23 and 23A around; it is quarantined, not ingested. " +
        "The geometry is the province's map of the written descriptions, which control.",
    },
    regulatory: {
      status: "PARTIAL",
      bundleIds: ["ca-mb-2026"],
      sourceLeads: [
        "Hunting Seasons and Bag Limits Regulation, M.R. 165/91 (controlling)",
        "Hunting Areas and Zones Regulation, M.R. 220/86",
        "General Hunting Regulation, M.R. 351/87",
        "2026 Manitoba Hunting Guide (cross-check only)",
      ],
      sourceState: "CURRENT",
      notes:
        "Built from the regulation itself for the 2026-27 hunting year, certified from 16 June 2026 (M.R. 46/2026). " +
        "Ruffed, spruce and sharp-tailed grouse by game bird hunting zone; white-tailed deer by licence, equipment and age. " +
        "Section 3 makes an undesignated area closed to a licence, so absence here is CLOSED, not UNKNOWN.",
    },
    knownGaps: [
      "Moose, elk, mule deer, black bear, caribou, wild turkey, gray wolf, coyote, ptarmigan, gray partridge and every migratory game bird are not certified; each answers UNKNOWN.",
      "GHA 7A under the non-Canadian archery and muzzleloader deer licences is a CONFLICT: the regulation reaches it only through a range the 2026 guide does not show.",
      "The line between game bird hunting zones 2 and 3 follows a lake shore and a township line with no survey available; in the band between 52.70°N and 53.05°N grouse is answered only where both zones agree.",
      "The Oak Hammock Waterfowl Control Area has no published polygon; near it, grouse answers NEEDS_VERIFICATION.",
      "Game bird refuges, special conservation areas, wildlife management areas and lands closed to hunting (including national parks) are read live from the province's own layers and are never certified as closures: a point inside one whose restriction reaches the species answers NEEDS_VERIFICATION with the authority's text. Provincial parks are not a layer North Ground reads. Only places the season regulation itself names are applied as rules: CFB Shilo out of the grouse season, the Whiteshell Game Bird Refuge out of the GHA 36 deer seasons, and the R.M. of Macdonald part of GHA 38 as its own deer area.",
      "Riding Mountain National Park and First Nation reserve land are not Game Hunting Areas; licensed provincial seasons do not describe them, and harvesting under Treaty or Aboriginal rights is a separate legal context.",
    ],
  },
  {
    id: "jurisdiction:ca-sk",
    code: "CA-SK",
    nameEn: "Saskatchewan",
    nameFr: "Saskatchewan",
    kind: "province",
    spatial: {
      status: "IN_DEVELOPMENT",
      officialTerm: "Wildlife Management Zone (WMZ)",
      officialSourceUrl: "https://gisappl.saskatchewan.ca/Html5Ext/index.html?viewer=habis",
      serviceUrl: "https://gis.saskatchewan.ca/arcgis/rest/services/WildlifeManagement/MapServer/0",
      parityCertified: false,
      notes:
        "The ministry's own Wildlife Management Zones layer serves 83 features (80 numbered zones with their E/W and N/S " +
        "halves, plus the Saskatoon, Regina-Moose Jaw and Prince Albert zones). Registered as a live-service layer: the " +
        "ArcGIS item says \"Not for resale\" despite the province's Standard Unrestricted Use Data Licence, so North Ground " +
        "stores no copy until the Fish and Wildlife Branch clarifies reuse (owner decision, 2026-09-22). The layer defers " +
        "to the Wildlife Management Zones and Special Areas Boundaries Regulations.",
    },
    regulatory: {
      status: "IN_DEVELOPMENT",
      bundleIds: [],
      sourceLeads: ["Saskatchewan Hunting and Trapping Guide"],
      sourceState: "NOT_INGESTED",
    },
    knownGaps: [
      "No rules certified; every Saskatchewan query is UNKNOWN. The zone layer is registered but unserved until it is live-certified.",
      "Reuse terms are contradictory (unrestricted licence versus \"Not for resale\"); the owner sends the clarification request. A refusal returns Saskatchewan to UNAVAILABLE.",
    ],
  },
  {
    id: "jurisdiction:ca-ab",
    code: "CA-AB",
    nameEn: "Alberta",
    nameFr: "Alberta",
    kind: "province",
    spatial: {
      status: "VERIFIED",
      officialTerm: "Wildlife Management Unit (WMU)",
      officialSourceUrl: "https://www.alberta.ca/wildlife-management-units",
      serviceUrl: "https://geospatial.alberta.ca/mimas/rest/services/boundaries/fishwild_wildlife_mgmt_unit_public/FeatureServer/0",
      parityCertified: true,
      notes:
        "Alberta's layer publishes 199 records, which are 189 WMUs: 718, 728 and 794 come in parts and are grouped, and the " +
        "one blank record is Elk Island National Park, quarantined. All 189 are certified against the province's service at " +
        "592 points with zero disagreements, including every part of each multipart unit and a point in each of the five " +
        "national parks, which are in no WMU. Alberta calls its boundaries small-scale approximations of the units legally " +
        "described in the Wildlife Regulation (AR 143/97), which controls.",
    },
    regulatory: {
      status: "PARTIAL",
      bundleIds: ["ca-ab-2026"],
      sourceLeads: [
        "2026 Alberta Guide to Hunting Regulations (government PDF on open.alberta.ca, cross-checked)",
        "Alberta Guide to Hunting Regulations online edition (parsed)",
        "Wildlife Regulation, Alta. Reg. 143/97 (controlling; not yet ingested)",
      ],
      sourceState: "CURRENT",
      notes:
        "2026-27 licence year. Ruffed, spruce and sharp-tailed grouse, and white-tailed deer by implement, antler class and " +
        "special licence. Every source row is cross-checked against the government PDF.",
    },
    knownGaps: [
      "Mule deer, moose, elk, sheep, goat, pronghorn, black bear, cougar, the other game birds and all migratory birds are not encoded.",
      "Special-licence seasons are drawn; North Ground answers them only under the licence the hunter says they hold.",
      "Late elk seasons in WMUs 102-150 differ between the online guide (N17 - D20) and the PDF (N17 - D31); unresolved.",
      "Rules come from the guide, a summary; the Wildlife Regulation itself is not yet ingested as the controlling text.",
      "WMUs 624, 648, 651, 718, 726, 732-738 and 794 are named by no encoded row and answer UNKNOWN.",
    ],
  },
  {
    id: "jurisdiction:ca-bc",
    code: "CA-BC",
    nameEn: "British Columbia",
    nameFr: "Colombie-Britannique",
    kind: "province",
    spatial: {
      // Ingested and parity-certified; not served until its first rules are certified for serving.
      status: "IN_DEVELOPMENT",
      officialTerm: "Management Unit (MU)",
      officialSourceUrl: "https://catalogue.data.gov.bc.ca/dataset/wildlife-management-units",
      serviceUrl: "https://openmaps.gov.bc.ca/geo/pub/WHSE_WILDLIFE_MANAGEMENT.WAA_WILDLIFE_MGMT_UNITS_SVW/ows",
      parityCertified: true,
      notes:
        "All 225 Management Units (B.C. Reg. 64/96 s. 1; BC Data Catalogue; the 2026-2028 synopsis names the same 225) are in " +
        "PostGIS as NEEDS_VERIFICATION, with 0 geometry disagreements and 890/890 authority-derived points and 696/696 live " +
        "service points agreeing. Under B.C. Reg. 64/96 the enacted regional maps (B.C. Reg. 89/2026) and the river-bank " +
        "rule control; the layer is the province's digital product of them. Not yet served.",
    },
    regulatory: {
      status: "IN_DEVELOPMENT",
      bundleIds: [],
      sourceLeads: [
        "Hunting Regulation, B.C. Reg. 190/84, Schedules 1-8 (controlling; BC Laws consolidation current to September 15, 2026)",
        "2026-2028 Hunting and Trapping Regulations Synopsis (cross-check only)",
      ],
      sourceState: "CURRENT",
      notes:
        "A first wave is built from the regulation itself (content/regulatory/ca-bc-2026.json): ruffed, spruce and " +
        "sharp-tailed grouse, rock and willow ptarmigan, snowshoe hare and black bear, 79 rules. It becomes coverage only " +
        "when the layer is served.",
    },
    knownGaps: [
      "Not served: every British Columbia query is UNKNOWN until the layer and its first rules are served.",
      "Limited Entry Hunting (B.C. Reg. 134/93) is layered over general open seasons and is not evaluated; a unit no general-season row names is UNKNOWN, not CLOSED.",
      "Closures inside units that the regulation describes in words or on maps, provincial parks named in Part 2 and private-property-only seasons have no boundary North Ground holds; answers there are NEEDS_VERIFICATION.",
      "Deer, moose, elk, sheep, goat, caribou, bison, cougar, wolf, blue grouse and all migratory birds are not encoded.",
    ],
  },
  {
    id: "jurisdiction:ca-nb",
    code: "CA-NB",
    nameEn: "New Brunswick",
    nameFr: "Nouveau-Brunswick",
    kind: "province",
    spatial: {
      status: "IN_DEVELOPMENT",
      officialTerm: "Wildlife Management Zone (WMZ)",
      officialSourceUrl: "https://geonb.snb.ca/geonb/",
      parityCertified: false,
    },
    regulatory: {
      status: "IN_DEVELOPMENT",
      bundleIds: [],
      sourceLeads: ["New Brunswick Hunting Regulations Summary"],
      sourceState: "NOT_INGESTED",
    },
    knownGaps: ["No geometry ingested and no rules certified; every New Brunswick query is UNKNOWN."],
  },
  {
    id: "jurisdiction:ca-ns",
    code: "CA-NS",
    nameEn: "Nova Scotia",
    nameFr: "Nouvelle-Écosse",
    kind: "province",
    spatial: {
      status: "IN_DEVELOPMENT",
      officialTerm: "Deer/Bear/Moose Management Zone",
      officialSourceUrl: "https://novascotia.ca/natr/hunt/regulations/",
      parityCertified: false,
      notes: "Nova Scotia zones differ per species, so one boundary set cannot serve every species.",
    },
    regulatory: {
      status: "IN_DEVELOPMENT",
      bundleIds: [],
      sourceLeads: ["Nova Scotia Hunting and Furharvesting Summary"],
      sourceState: "NOT_INGESTED",
    },
    knownGaps: [
      "No geometry ingested and no rules certified; every Nova Scotia query is UNKNOWN.",
      "Management zones are species-specific, so the usual one-zone-per-point model does not hold here.",
    ],
  },
  {
    id: "jurisdiction:ca-pe",
    code: "CA-PE",
    nameEn: "Prince Edward Island",
    nameFr: "Île-du-Prince-Édouard",
    kind: "province",
    spatial: {
      status: "UNKNOWN",
      officialTerm: "Wildlife Management Area",
      officialSourceUrl: "https://www.princeedwardisland.ca/en/topic/hunting",
      parityCertified: false,
      notes:
        "Whether Prince Edward Island divides hunting into mapped zones at all has not been established. " +
        "UNKNOWN rather than IN_DEVELOPMENT because the question is unresearched, not merely unfinished.",
    },
    regulatory: {
      status: "IN_DEVELOPMENT",
      bundleIds: [],
      sourceLeads: ["Prince Edward Island Hunting Regulations"],
      sourceState: "NOT_INGESTED",
    },
    knownGaps: ["No geometry ingested and no rules certified; every Prince Edward Island query is UNKNOWN."],
  },
  {
    id: "jurisdiction:ca-nl",
    code: "CA-NL",
    nameEn: "Newfoundland and Labrador",
    nameFr: "Terre-Neuve-et-Labrador",
    kind: "province",
    spatial: {
      status: "IN_DEVELOPMENT",
      officialTerm: "Management Area/Zone (species-specific)",
      officialSourceUrl: "https://www.gov.nl.ca/fal/public-education/wildlife/hunting/boundry/",
      parityCertified: false,
      notes: "Moose, caribou and black bear use different area systems, and the island and Labrador differ again.",
    },
    regulatory: {
      status: "IN_DEVELOPMENT",
      bundleIds: [],
      sourceLeads: ["Newfoundland and Labrador Hunting and Trapping Guide"],
      sourceState: "NOT_INGESTED",
    },
    knownGaps: [
      "No geometry ingested and no rules certified; every Newfoundland and Labrador query is UNKNOWN.",
      "Big game is almost entirely licence-by-draw, so a season lookup is not the product question here.",
    ],
  },
  {
    id: "jurisdiction:ca-yt",
    code: "CA-YT",
    nameEn: "Yukon",
    nameFr: "Yukon",
    kind: "territory",
    spatial: {
      status: "IN_DEVELOPMENT",
      officialTerm: "Game Management Subzone (GMS)",
      officialSourceUrl: "https://open.yukon.ca/data/datasets/game-management-areas-250k",
      serviceUrl: "https://mapservices.gov.yk.ca/arcgis/rest/services/GeoYukon/GY_AdministrativeBoundaries/MapServer/7",
      parityCertified: false,
      notes:
        "GeoYukon's Game Management Areas - 250k layer (Open Government Licence - Yukon). Reconciled 2026-09-22: the " +
        "service holds 445 distinct GAME_MGMT_AREA_ID values, one feature each, against the 443 the dataset states. " +
        "Its 2015 download holds exactly 443; the service adds 102 and 103, whose areas (9,735 and 4,351 km²) and " +
        "point tests match Ivvavik and Vuntut National Parks, while 101, 104 and 105 shrank around them. The dataset " +
        "says subzones cover the Yukon except national parks, and Kluane has no feature, so 102 and 103 are quarantined " +
        "until Environment Yukon confirms their standing. The item also says it is generalized from the legal " +
        "boundaries, which are maps established by order-in-council.",
    },
    regulatory: {
      status: "IN_DEVELOPMENT",
      bundleIds: [],
      sourceLeads: ["Yukon Hunting Regulations Summary"],
      sourceState: "NOT_INGESTED",
    },
    knownGaps: [
      "No geometry ingested and no rules certified; every Yukon query is UNKNOWN.",
      "Service features 102 and 103 lie over Ivvavik and Vuntut National Parks and are not in the stated 443; they stay quarantined, and a point there is UNKNOWN, until Environment Yukon confirms whether they are Game Management Subzones.",
      "First Nations harvesting rights operate under Final Agreements and are a separate legal context from licensed recreational hunting. North Ground must not present one as describing the other.",
    ],
  },
  {
    id: "jurisdiction:ca-nt",
    code: "CA-NT",
    nameEn: "Northwest Territories",
    nameFr: "Territoires du Nord-Ouest",
    kind: "territory",
    spatial: {
      status: "UNAVAILABLE",
      officialTerm: "Wildlife Management Zone/Area",
      officialSourceUrl: "https://www.gov.nt.ca/ecc/en/services/hunting-trapping-and-harvesting",
      parityCertified: false,
      notes:
        "No complete official vector layer exists. The Wildlife Management Zones and Areas Regulations define six " +
        "zones with nested species and outfitter areas, published as guide maps only. The mobile Bathurst caribou " +
        "zone is a separate dated coordinate download that can change in season, and its reuse terms are not " +
        "designated under the NWT open licence. North Ground will not trace a map, so nothing is drawn.",
    },
    regulatory: {
      status: "IN_DEVELOPMENT",
      bundleIds: [],
      sourceLeads: ["Northwest Territories Summary of Hunting Regulations"],
      sourceState: "NOT_INGESTED",
    },
    knownGaps: [
      "No geometry ingested and no rules certified; every Northwest Territories query is UNKNOWN.",
      "Harvesting under land-claim agreements is a distinct legal context from licensed resident hunting and must not be conflated with it.",
      "Complete vectors and explicit reuse terms have to come from Environment and Climate Change before any zone can be drawn; a mobile caribou zone would need effective-dated geometry history.",
    ],
  },
  {
    id: "jurisdiction:ca-nu",
    code: "CA-NU",
    nameEn: "Nunavut",
    nameFr: "Nunavut",
    kind: "territory",
    spatial: {
      status: "UNAVAILABLE",
      officialTerm: "No territory-wide management unit system",
      officialSourceUrl: "https://www.gov.nu.ca/en/environment-and-wildlife",
      parityCertified: false,
      notes:
        "Nunavut has no territory-wide hunting unit. Rules follow species, population and community under the " +
        "Nunavut Agreement, and the annual guide's maps are reference maps. No machine-readable hunting geography " +
        "was found, and the Government of Nunavut's terms bar commercial redistribution without permission. " +
        "Nunavut is not forced into a unit model.",
    },
    regulatory: {
      status: "IN_DEVELOPMENT",
      bundleIds: [],
      sourceLeads: ["Nunavut Wildlife Act and regional Hunters and Trappers Organization rules"],
      sourceState: "NOT_INGESTED",
    },
    knownGaps: [
      "No geometry ingested and no rules certified; every Nunavut query is UNKNOWN.",
      "Harvesting is governed substantially by the Nunavut Agreement and regional Hunters and Trappers Organizations. That is a different legal framework from licensed recreational hunting and is not modelled.",
      "Total allowable harvest, allocation and tag assignment by Hunters and Trappers Organizations need a data-model extension before any rule is encoded; North Ground never infers beneficiary status or an assigned tag.",
    ],
  },
  {
    id: "jurisdiction:ca-federal",
    code: "CA-FEDERAL",
    nameEn: "Canada (federal)",
    nameFr: "Canada (fédéral)",
    kind: "federal",
    spatial: {
      status: "IN_DEVELOPMENT",
      officialTerm: "Migratory Game Bird Hunting District/Zone",
      officialTermFr: "district de chasse aux oiseaux migrateurs considérés comme gibier",
      officialSourceUrl: "https://open.canada.ca/data/en/dataset",
      parityCertified: false,
      notes:
        "Migratory-bird districts are federal geography that does not follow provincial management units, so it " +
        "composes with them rather than replacing them. Environment and Climate Change Canada does publish district " +
        "boundaries for Québec (open.canada.ca, Open Government Licence, updated 2025-06-17), but the dataset is " +
        "labelled Draft and states the limits are indicative only and carry no legal value. North Ground does not " +
        "draw a regulatory boundary the authority itself disclaims, so this cannot be ingested as certified geometry " +
        "in its current form. The legal boundaries live in the Migratory Birds Regulations text.",
    },
    regulatory: {
      status: "IN_DEVELOPMENT",
      bundleIds: [],
      sourceLeads: [
        "Migratory Birds Regulations (Canada)",
        "Environment and Climate Change Canada — Migratory game bird hunting regulations summary",
      ],
      sourceState: "NOT_INGESTED",
    },
    knownGaps: [
      "No federal migratory-bird geography or rules are ingested. Every duck, goose and other migratory-bird query is UNKNOWN, including for the 25 waterfowl and migratory species that already have published biological profiles.",
      "The one district dataset located so far (Québec, ECCC) is marked Draft and expressly has no legal value, so it fails the boundary standard. Certified district geometry has to come from the regulation's own descriptions or from a layer the authority stands behind.",
      "A provincial hunting summary is not the authority for migratory birds, so provincial coverage does not extend to them.",
    ],
  },
];

export const CANADA_JURISDICTION_COUNT = CANADA_JURISDICTIONS.length;

export function jurisdictionByCode(code: string): CanadaJurisdiction | undefined {
  return CANADA_JURISDICTIONS.find((entry) => entry.code.toUpperCase() === code.toUpperCase());
}

export function jurisdictionById(id: string): CanadaJurisdiction | undefined {
  return CANADA_JURISDICTIONS.find((entry) => entry.id === id);
}
