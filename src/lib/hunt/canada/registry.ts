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
    nameEn: "Quebec",
    nameFr: "Québec",
    kind: "province",
    spatial: {
      status: "IN_DEVELOPMENT",
      officialTerm: "Hunting Zone",
      officialTermFr: "zone de chasse",
      officialSourceUrl:
        "https://www.quebec.ca/en/tourism-recreation-sport/sporting-and-outdoor-activities/sport-hunting/hunting-zone-maps",
      /* The ministry's own GeoServer, which is the service behind the government's
         Forêt ouverte map. Found by reading that map's published layer context
         rather than in the open-data portal, where the zones are not listed. */
      serviceUrl:
        "https://servicesvecto3.mern.gouv.qc.ca/geoserver/SmartFaunePub/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=SmartFaunePub:Zone_chasse_da3_sefaq",
      parityCertified: false,
      notes:
        "Source FOUND and reviewed 2026-09-21. WFS 2.0.0 with application/json output and native EPSG:4326 " +
        "reprojection from the layer's EPSG:32198; AccessConstraints NONE, Fees NONE, provider MFFP. " +
        "Structure independently verified: the layer carries exactly the 28 numeric zones quebec.ca publishes " +
        "(1 to 24 and 26 to 29, no zone 25), divided into 59 named designations across 9,509 polygons and " +
        "2,424,980 vertices. A full live fetch through the adapter completed in 68 s with zero unclosed rings and " +
        "every coordinate inside Québec. " +
        "Still IN_DEVELOPMENT because nothing is ingested into PostGIS, parity-certified or served — the adapter " +
        "exists, the registry does not. " +
        "Two cautions for whoever ingests it: the season tables are written per PART (19N, 19SE, 19SO, 19SNO are " +
        "four different seasons), so the part and not the number is the regulatory unit; and this layer returns Partie_zon " +
        "as CP850 bytes read as Latin-1 (\"Île\" arrives as \"×le\"), which the adapter reverses through the code " +
        "page itself rather than by rewriting the phrases that happen to exist today.",
    },
    regulatory: {
      status: "IN_DEVELOPMENT",
      bundleIds: [],
      sourceLeads: [
        "Ministère de l'Environnement, de la Lutte contre les changements climatiques, de la Faune et des Parcs — official hunting periods",
      ],
      sourceState: "NOT_INGESTED",
      notes:
        "Québec publishes its seasons in French with zone-and-species tables that do not share Ontario's shape. " +
        "Nothing is certified; the official French terminology is to be preserved rather than translated.",
    },
    knownGaps: [
      "No hunting-zone geometry is ingested into PostGIS, so no Québec point resolves to a zone yet. The source is no longer the blocker: the ministry's WFS is identified, reviewed and proven to fetch cleanly through `createQuebecZoneSource`. What remains is ingestion, parity certification against the service, and switching the resolver on.",
      "The published season tables name zones in words (\"10 West\", \"19 South\") while the GIS layer uses codes (10O, 19SE). That mapping is a legal interpretation, not a formatting detail, and must be settled by evidence the way Ontario's bare-number WMU groupings were.",
      "No regulatory bundle exists, so every Québec species query is UNKNOWN.",
      "Zones d'exploitation contrôlée (zecs), réserves fauniques and pourvoiries carry their own access rules that a zone-level season does not decide. Their boundaries are on the same GeoServer as SmartFaunePub:TFS; the Données Québec copy is CC-BY-NC-ND 4.0, so the licence under which they may be used needs settling before they are ingested.",
      "Zone 17 moose hunting is reserved for Indigenous subsistence hunting under the James Bay and Northern Québec Agreement. Sport hunting there is closed. That is a treaty context, not a recreational season, and must never be presented as one.",
      "The designations 08NZ, 09OZ and 10EZ are the enhanced surveillance zone (zone de surveillance rehaussée) for chronic wasting disease, covering 17 municipalities around the 2018 infected farm. No season table names them, and their antlerless-permit and registration obligations are published on the disease pages rather than the hunting pages. Those pages have not been read as a regulatory source, so a hunter inside a ZSR cannot yet be told they are in one.",
      "Québec publishes one animal class per year inside a single cell — moose zone 13 firearms reads \"2026 Orignal avec bois / 2027 Orignal\". No field in the current rule schema carries a segment that changes between the two published years, so these rows cannot be encoded without flattening them.",
    ],
  },
  {
    id: "jurisdiction:ca-mb",
    code: "CA-MB",
    nameEn: "Manitoba",
    nameFr: "Manitoba",
    kind: "province",
    spatial: {
      status: "IN_DEVELOPMENT",
      officialTerm: "Hunting Area",
      officialSourceUrl: "https://geoportal.gov.mb.ca/",
      parityCertified: false,
    },
    regulatory: {
      status: "IN_DEVELOPMENT",
      bundleIds: [],
      sourceLeads: ["Manitoba Hunting Guide"],
      sourceState: "NOT_INGESTED",
    },
    knownGaps: ["No geometry ingested and no rules certified; every Manitoba query is UNKNOWN."],
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
      parityCertified: false,
      notes: "The provincial viewer is identified; whether it exposes a machine-readable layer is not yet reviewed.",
    },
    regulatory: {
      status: "IN_DEVELOPMENT",
      bundleIds: [],
      sourceLeads: ["Saskatchewan Hunting and Trapping Guide"],
      sourceState: "NOT_INGESTED",
    },
    knownGaps: ["No geometry ingested and no rules certified; every Saskatchewan query is UNKNOWN."],
  },
  {
    id: "jurisdiction:ca-ab",
    code: "CA-AB",
    nameEn: "Alberta",
    nameFr: "Alberta",
    kind: "province",
    spatial: {
      status: "IN_DEVELOPMENT",
      officialTerm: "Wildlife Management Unit (WMU)",
      officialSourceUrl: "https://www.alberta.ca/wildlife-management-units.aspx",
      parityCertified: false,
    },
    regulatory: {
      status: "IN_DEVELOPMENT",
      bundleIds: [],
      sourceLeads: ["Alberta Guide to Hunting Regulations"],
      sourceState: "NOT_INGESTED",
    },
    knownGaps: [
      "No geometry ingested and no rules certified; every Alberta query is UNKNOWN.",
      "Alberta allocates much big game by draw, which is not decidable from location and date alone.",
    ],
  },
  {
    id: "jurisdiction:ca-bc",
    code: "CA-BC",
    nameEn: "British Columbia",
    nameFr: "Colombie-Britannique",
    kind: "province",
    spatial: {
      status: "IN_DEVELOPMENT",
      officialTerm: "Management Unit (MU)",
      officialSourceUrl: "https://catalogue.data.gov.bc.ca/dataset/wildlife-management-units",
      parityCertified: false,
      notes: "Published through the BC Data Catalogue, which is a strong candidate for machine-readable ingestion.",
    },
    regulatory: {
      status: "IN_DEVELOPMENT",
      bundleIds: [],
      sourceLeads: ["British Columbia Hunting and Trapping Regulations Synopsis"],
      sourceState: "NOT_INGESTED",
    },
    knownGaps: [
      "No geometry ingested and no rules certified; every British Columbia query is UNKNOWN.",
      "BC layers Limited Entry Hunting over general open seasons, which a season lookup alone cannot resolve.",
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
      officialSourceUrl: "https://open.yukon.ca/data/datasets/game-management-subzones",
      parityCertified: false,
      notes: "Published on Yukon's open-data portal, which is a strong machine-readable candidate.",
    },
    regulatory: {
      status: "IN_DEVELOPMENT",
      bundleIds: [],
      sourceLeads: ["Yukon Hunting Regulations Summary"],
      sourceState: "NOT_INGESTED",
    },
    knownGaps: [
      "No geometry ingested and no rules certified; every Yukon query is UNKNOWN.",
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
      status: "IN_DEVELOPMENT",
      officialTerm: "Wildlife Management Unit/Area",
      officialSourceUrl: "https://www.gov.nt.ca/ecc/en/services/hunting-trapping-and-harvesting",
      parityCertified: false,
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
    ],
  },
  {
    id: "jurisdiction:ca-nu",
    code: "CA-NU",
    nameEn: "Nunavut",
    nameFr: "Nunavut",
    kind: "territory",
    spatial: {
      status: "IN_DEVELOPMENT",
      officialTerm: "Hunting Area",
      officialSourceUrl: "https://www.gov.nu.ca/en/environment-and-wildlife",
      parityCertified: false,
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
