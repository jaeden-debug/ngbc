/**
 * Builds Ontario's Ready to Hunt data from the authorities that publish it.
 *
 *   node scripts/build-ontario-readiness.mjs            # rebuild
 *   node scripts/build-ontario-readiness.mjs --check    # fail if a source moved
 *
 * Writes two files:
 *   content/regulatory/readiness/ca-on-2026.json            authorizations, fees,
 *     hunter-orange and method rules, elk seasons (which trigger hunter orange)
 *   content/regulatory/readiness/ca-on-licence-issuers.json the province's own
 *     licence-issuer dataset, for finding somewhere to buy in person
 *
 * Every legal statement below carries the authority's own words, and this
 * refuses to write anything if one of those quotes is no longer present in the
 * source it cites — re-read from that source on every build. A fee must appear
 * on the fee schedule under exactly the label given. So nothing reaches the
 * checklist that the authority did not say, and a changed rule stops the build
 * rather than surviving as a stale requirement.
 *
 * The interpretation (which licences a species needs, how the orange rule
 * applies) is written here, beside its citations, the way the season builders
 * declare how a table heading maps to implements. The facts it rests on are
 * fetched.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  expandWmuSpec, extractFootnotes, extractTables, fetchOfficialWmuIdentifiers, fetchText, jurisdictionToday,
  parseWmuCell, quoteRetrievedAtIndex, readPreviousBundle, retrievedAtFor, stripTags, zoneCanonicalId,
} from "./ontario-source.mjs";

const OUT_DIR = "content/regulatory/readiness";
const OUTPUT = `${OUT_DIR}/ca-on-2026.json`;
const ISSUERS_OUTPUT = `${OUT_DIR}/ca-on-licence-issuers.json`;
const LICENCE_YEAR = 2026;
const JURISDICTION = "jurisdiction:ca-on";
const AUTHORITY = "Ontario Ministry of Natural Resources";

const SUMMARY = "https://www.ontario.ca/document/ontario-hunting-regulations-summary";
const ELAWS_API = "https://www.ontario.ca/laws/api/v2/legislation/en/doc-search/regulation/980665";
const ELAWS_PAGE = "https://www.ontario.ca/laws/regulation/980665";
const ISSUER_SERVICE =
  "https://ws.lioservices.lrc.gov.on.ca/arcgis2/rest/services/LIO_OPEN_DATA/LIO_Open10/MapServer/12";

const ONLINE = "https://www.huntandfishontario.com/";
const PHONE = "1-800-288-1155";
const LICENCE_INFO = `${SUMMARY}/hunting-licence-information`;

/* ── Sources ─────────────────────────────────────────────────────────────── */

/**
 * Each source is fetched once, reduced to comparable text, and hashed. A quote
 * is verified against the text of the source it names — never against another.
 */
const SOURCES = {
  law: {
    id: "source:ca-on-oreg-665-98",
    title: "O. Reg. 665/98 (Hunting) under the Fish and Wildlife Conservation Act, 1997",
    url: ELAWS_PAGE,
    tier: "LAW",
  },
  fees: {
    id: "source:ca-on-hunting-licence-information-2026",
    title: "Hunting licence information — Ontario Hunting Regulations Summary",
    url: LICENCE_INFO,
    tier: "OFFICIAL_FEE_SCHEDULE",
  },
  general: {
    id: "source:ca-on-general-regulations-2026",
    title: "General regulations — Ontario Hunting Regulations Summary",
    url: `${SUMMARY}/general-regulations`,
    tier: "OFFICIAL_SUMMARY",
  },
  smallGame: {
    id: "source:ca-on-small-game-2026",
    title: "Small game and furbearing mammals — Ontario Hunting Regulations Summary",
    url: `${SUMMARY}/small-game-and-furbearing-mammals`,
    tier: "OFFICIAL_SUMMARY",
  },
  deer: {
    id: "source:ca-on-deer-2026",
    title: "White-tailed deer — Ontario Hunting Regulations Summary",
    url: `${SUMMARY}/white-tailed-deer`,
    tier: "OFFICIAL_SUMMARY",
  },
  moose: {
    id: "source:ca-on-moose-2026",
    title: "Moose — Ontario Hunting Regulations Summary",
    url: `${SUMMARY}/moose`,
    tier: "OFFICIAL_SUMMARY",
  },
  elk: {
    id: "source:ca-on-elk-2026",
    title: "Elk — Ontario Hunting Regulations Summary",
    url: `${SUMMARY}/elk`,
    tier: "OFFICIAL_SUMMARY",
  },
  issuers: {
    id: "source:ca-on-licence-issuers",
    title: "Hunting and fishing licence issuers — Land Information Ontario",
    url: "https://geohub.lio.gov.on.ca/datasets/hunting-and-fishing-licence-issuers",
    tier: "OFFICIAL_DATASET",
  },
};

/** Collapses the typographic and whitespace differences between renderings. */
function comparable(text) {
  return text
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The page's own content, and nothing else.
 *
 * ontario.ca injects a per-request bot-management token as an inline script in
 * the page chrome, so hashing the whole page reported every source as changed
 * on every run — a check that is always red is a check nobody reads. The rules
 * live in <main>. Quotes are verified against the same text, so a quote cannot
 * be "found" in the navigation or the footer either.
 */
function mainText(html) {
  const main = /<main[\s\S]*?<\/main>/i.exec(html)?.[0];
  if (!main) throw new Error("A summary page has no <main> content; its structure changed");
  return comparable(stripTags(main.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")));
}

function sha256(text) {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

/* ── The interpretation, beside its citations ────────────────────────────── */

const Q = (source, citation, quote) => ({ source, citation, quote });

/** Fees are named by the fee schedule's own line, and its product heading. */
const fee = (heading, line, appliesTo = {}, variant) => ({ heading, line, appliesTo, variant });

const RESIDENT = { residency: ["RESIDENT"] };
const NON_RESIDENT = { residency: ["NON_RESIDENT"] };

const LICENCE_PURCHASE = {
  channels: ["ONLINE", "PHONE", "PHYSICAL_VENDOR"],
  onlineUrl: ONLINE,
  phone: PHONE,
  infoUrl: LICENCE_INFO,
  vendorDirectoryId: "ca-on-licence-issuers",
};

const AUTHORIZATIONS = [
  {
    id: "authorization:ca-on-hunter-education",
    kind: "HUNTER_EDUCATION",
    officialName: "Ontario Hunter Education Course",
    appliesTo: {},
    prerequisites: [],
    purchase: { channels: [], infoUrl: `${SUMMARY}/ontario-hunter-education-course` },
    fees: [],
    note: "An Ontario-recognized equivalent, such as accreditation from a recognized jurisdiction, also qualifies.",
    provenance: [
      Q("fees", "Hunter accreditation requirements",
        "You must have successfully completed Ontario's Hunter Education Course or an Ontario-recognized equivalent requirement"),
    ],
  },
  {
    id: "authorization:ca-on-outdoors-card",
    kind: "IDENTIFICATION_CARD",
    officialName: "Outdoors Card",
    appliesTo: {},
    prerequisites: ["authorization:ca-on-hunter-education"],
    purchase: LICENCE_PURCHASE,
    fees: [fee("Outdoors Card", "Ontario Outdoors Card (a valid Outdoors Card is required for all resident and non-resident hunters who wish to purchase hunting licences)")],
    note: "It is mailed in about 20 days; until it arrives you can hunt by carrying your licence summary.",
    provenance: [
      Q("law", "O. Reg. 665/98 s. 2",
        "A person shall not be issued a licence to hunt unless the person holds an outdoors card issued under section 4."),
      Q("law", "O. Reg. 665/98 s. 3(1)",
        "Any person who hunts wildlife shall carry their outdoors card on their person while hunting"),
      Q("fees", "How to buy licences or buy or renew Outdoors Card",
        "You will be able to hunt while you wait for your Outdoors Card to arrive in the mail by carrying your licence summary"),
    ],
  },
  {
    id: "authorization:ca-on-small-game-licence",
    kind: "HUNTING_LICENCE",
    officialName: "Small game licence",
    appliesTo: {},
    prerequisites: ["authorization:ca-on-outdoors-card"],
    purchase: LICENCE_PURCHASE,
    fees: [
      fee("Small game", "Resident small game licence", RESIDENT),
      fee("Small game", "Resident small game licence (3-year)", RESIDENT, "3-year"),
      fee("Small game", "Non-resident small game licence", NON_RESIDENT),
      fee("Small game", "Non-resident small game licence (3-year)", NON_RESIDENT, "3-year"),
    ],
    provenance: [
      Q("law", "O. Reg. 665/98 s. 28(1)",
        "A licence to hunt small game shall consist of a licence summary that identifies the small game licence"),
      Q("law", "O. Reg. 665/98 s. 27",
        "Game birds, including wild turkeys."),
    ],
  },
  {
    id: "authorization:ca-on-wild-turkey-tag",
    kind: "TAG",
    officialName: "Wild turkey tag",
    appliesTo: {},
    prerequisites: ["authorization:ca-on-small-game-licence"],
    purchase: LICENCE_PURCHASE,
    fees: [
      fee("Wild turkey", "Resident turkey tag (spring)", RESIDENT, "spring"),
      fee("Wild turkey", "Resident turkey tag (fall)", RESIDENT, "fall"),
      fee("Wild turkey", "Non-resident turkey tag (spring)", NON_RESIDENT, "spring"),
      fee("Wild turkey", "Non-resident turkey tag (fall)", NON_RESIDENT, "fall"),
    ],
    note: "A turkey tag is used with a small game licence, not instead of one.",
    provenance: [
      Q("law", "O. Reg. 665/98 s. 28(4)",
        "A licence to hunt wild turkey shall consist of a licence summary or outdoors card that identifies a small game licence together with a wild turkey tag."),
    ],
  },
  {
    id: "authorization:ca-on-deer-licence",
    kind: "SPECIES_LICENCE",
    officialName: "Deer licence",
    appliesTo: {},
    prerequisites: ["authorization:ca-on-outdoors-card"],
    purchase: LICENCE_PURCHASE,
    fees: [
      fee("White-tailed deer", "Resident deer licence", RESIDENT),
      fee("White-tailed deer", "Non-resident deer licence", NON_RESIDENT),
    ],
    provenance: [
      Q("law", "O. Reg. 665/98 s. 37(1)",
        "A licence to hunt deer shall consist of a licence summary that lists the deer licence together with a deer tag"),
    ],
    residencyNotes: {
      NON_RESIDENT: {
        text: "As a non-resident you may hunt only antlered deer, unless you are issued an additional deer tag.",
        provenance: Q("law", "O. Reg. 665/98 s. 37(3)", "hunt only antlered deer in the area and under the conditions specified on the tag"),
      },
    },
  },
  {
    id: "authorization:ca-on-bear-licence",
    kind: "SPECIES_LICENCE",
    officialName: "Bear licence",
    appliesTo: {},
    prerequisites: ["authorization:ca-on-outdoors-card"],
    purchase: LICENCE_PURCHASE,
    fees: [
      fee("Black bear", "Resident bear licence", RESIDENT),
      fee("Black bear", "Non-resident bear licence", NON_RESIDENT),
    ],
    provenance: [
      Q("law", "O. Reg. 665/98 s. 51(1)",
        "A licence to hunt bear that is issued to a resident shall consist of a licence summary that identifies the bear hunting licence together with a bear tag."),
      Q("law", "O. Reg. 665/98 s. 53(1)",
        "A licence to hunt bear that is issued to a non-resident shall consist of a licence summary that lists the bear hunting licence together with a bear tag and a bear hunting validation certificate obtained from a licensed bear operator."),
    ],
  },
  {
    id: "authorization:ca-on-bear-hunting-validation-certificate",
    kind: "VALIDATION",
    officialName: "Bear hunting validation certificate",
    appliesTo: NON_RESIDENT,
    prerequisites: [],
    purchase: {
      channels: ["LICENSED_OPERATOR"],
      infoUrl: `${SUMMARY}/black-bear`,
      note: "Obtained from the licensed bear operator you have a bear-hunting contract with — not from a licence issuer.",
    },
    fees: [],
    note: "Valid only for the area and period written on it, and only while your contract with that operator is in force.",
    provenance: [
      Q("law", "O. Reg. 665/98 s. 53(1)",
        "a bear hunting validation certificate obtained from a licensed bear operator"),
      Q("law", "O. Reg. 665/98 s. 53(6)",
        "A bear hunting validation certificate is valid only for the area and for the period specified on it."),
    ],
  },
  {
    id: "authorization:ca-on-moose-licence",
    kind: "SPECIES_LICENCE",
    officialName: "Moose licence",
    appliesTo: {},
    prerequisites: ["authorization:ca-on-outdoors-card"],
    purchase: LICENCE_PURCHASE,
    fees: [
      fee("Moose", "Resident moose licence", RESIDENT),
      fee("Moose", "Non-resident moose licence", NON_RESIDENT),
    ],
    provenance: [
      Q("law", "O. Reg. 665/98 s. 43(1)",
        "a moose tag together with a licence summary that identifies the moose licence"),
    ],
  },
  {
    id: "authorization:ca-on-moose-tag",
    kind: "TAG",
    officialName: "Moose tag",
    appliesTo: {},
    prerequisites: ["authorization:ca-on-moose-licence"],
    purchase: {
      channels: ["DRAW"],
      infoUrl: `${SUMMARY}/how-apply-hunt-big-game`,
      note: "Allocated through the annual big game draw — it cannot simply be bought.",
    },
    draw: { required: true, infoUrl: `${SUMMARY}/how-apply-hunt-big-game` },
    // Published without a residency split; kept exactly as published.
    fees: [
      fee("Moose", "Application fee", {}, "draw application"),
      fee("Moose", "Calf tag", {}, "calf"),
      fee("Moose", "Cow/calf tag", {}, "cow/calf"),
      fee("Moose", "Bull tag", {}, "bull"),
    ],
    note: "The tag fee depends on the tag you are allocated.",
    provenance: [
      Q("law", "O. Reg. 665/98 s. 43(1)",
        "if the person is hunting in a party in accordance with Part III with at least one other person who holds a valid moose tag"),
    ],
  },
  {
    id: "authorization:ca-federal-firearms-licence",
    kind: "FIREARMS_LICENCE",
    officialName: "Firearms licence (PAL) or other accepted proof",
    authority: "Canadian Firearms Program (RCMP)",
    jurisdictionId: "jurisdiction:ca-federal",
    appliesTo: { methods: ["RIFLE", "SHOTGUN", "MUZZLELOADER", "AIR_GUN"] },
    prerequisites: [],
    purchase: {
      channels: ["FEDERAL_APPLICATION"],
      infoUrl: "https://rcmp.ca/en/firearms",
      phone: "1-800-731-4000",
    },
    fees: [],
    note: "Accepted: a possession and acquisition licence, a minor's licence, or proof of passing the Canadian Firearms Safety Course. Carry it while hunting.",
    provenance: [
      Q("law", "O. Reg. 665/98 s. 25.2(1)",
        "No person shall hunt with a gun unless the person meets at least one of the following requirements"),
      Q("law", "O. Reg. 665/98 s. 25.2(2)",
        "A person shall carry on their person the documentation required under subsection (1) while hunting with a gun"),
      Q("fees", "Firearms licence requirement",
        "You are not required to carry proof of firearms accreditation if you are hunting with a bow or crossbow in Ontario."),
    ],
  },
];

const FIREARMS_WHEN_GUN = {
  authorizationId: "authorization:ca-federal-firearms-licence",
  when: { methods: ["RIFLE", "SHOTGUN", "MUZZLELOADER", "AIR_GUN"] },
  conditionText: "Required if you hunt with a gun, including an air or pellet gun. Not needed for a bow or crossbow.",
};

const BASE = ["authorization:ca-on-outdoors-card"];

/** Which authorizations each species needs. */
const REQUIREMENTS = {
  "species:ruffed-grouse": [...BASE, "authorization:ca-on-small-game-licence", FIREARMS_WHEN_GUN],
  "species:spruce-grouse": [...BASE, "authorization:ca-on-small-game-licence", FIREARMS_WHEN_GUN],
  "species:sharp-tailed-grouse": [...BASE, "authorization:ca-on-small-game-licence", FIREARMS_WHEN_GUN],
  "species:snowshoe-hare": [...BASE, "authorization:ca-on-small-game-licence", FIREARMS_WHEN_GUN],
  "species:wild-turkey": [
    ...BASE, "authorization:ca-on-small-game-licence", "authorization:ca-on-wild-turkey-tag", FIREARMS_WHEN_GUN,
  ],
  "species:white-tailed-deer": [...BASE, "authorization:ca-on-deer-licence", FIREARMS_WHEN_GUN],
  "species:american-black-bear": [
    ...BASE,
    "authorization:ca-on-bear-licence",
    {
      authorizationId: "authorization:ca-on-bear-hunting-validation-certificate",
      when: { residency: ["NON_RESIDENT"] },
      conditionText: "Required for non-residents.",
    },
    FIREARMS_WHEN_GUN,
  ],
  "species:moose": [
    ...BASE,
    "authorization:ca-on-moose-licence",
    {
      authorizationId: "authorization:ca-on-moose-tag",
      conditionText: "Required unless you hunt in a party with someone who holds a valid moose tag.",
      alwaysConditional: true,
    },
    FIREARMS_WHEN_GUN,
  ],
};

/**
 * Hunter orange, O. Reg. 665/98 s. 26 — the law, not the summary's paraphrase.
 * The summary says "a gun season"; the regulation says every open season for
 * deer, elk or moose "other than the seasons restricted to the use of bows
 * only", which includes muzzle-loader seasons. Where they differ, the law wins.
 */
const ORANGE = {
  specification:
    "A hunter orange garment and a hunter orange head cover. The garment must be solid, not open mesh, " +
    "cover at least 400 square inches above the waist and be visible from all sides. Camouflage orange does not count.",
  provenance: {
    wear: Q("law", "O. Reg. 665/98 s. 26(1)",
      "shall wear a garment in hunter orange and a head cover in hunter orange while hunting wildlife"),
    bigGame: Q("law", "O. Reg. 665/98 s. 26(1)(a)",
      "during the open seasons for deer, elk or moose, other than the seasons restricted to the use of bows only"),
    bear: Q("law", "O. Reg. 665/98 s. 26(1)(b)", "during the open season for bear"),
    garment: Q("law", "O. Reg. 665/98 s. 26(2)",
      "must be solid and not open mesh clothing with a minimum total area of not less than 400 square inches above the waist and visible from all sides"),
    smallGameExempt: Q("law", "O. Reg. 665/98 s. 26(4)(a)", "hunts small game"),
    treeStand: Q("law", "O. Reg. 665/98 s. 26(4)(d)", "is in a tree stand while hunting bear"),
    bowsConcurrent: Q("law", "O. Reg. 665/98 s. 26(4)(c)",
      "hunts moose, deer or elk during an open season for moose, deer or elk that is restricted to the use of bows only and that runs concurrently with the open season for bear"),
    camouflage: Q("law", "O. Reg. 665/98 s. 26(5)", "but does not include camouflage hunter orange colouring"),
  },
};

/** The firearms table, species by species, in the summary's own terms. */
const BIG_GAME_TABLE = {
  rifle: Q("general", "Summary of firearms restrictions for hunting in Ontario", "Yes – Centre-fire rifle only"),
  shotgun: Q("general", "Summary of firearms restrictions for hunting in Ontario",
    "Shotgun not smaller than 20 gauge when using shot; shot size must be SG or number 1 buck or larger."),
};

const METHODS = {
  deer: {
    RIFLE: { restriction: "Centre-fire rifle only.", provenance: [BIG_GAME_TABLE.rifle] },
    SHOTGUN: { restriction: "Not smaller than 20 gauge.", provenance: [BIG_GAME_TABLE.shotgun] },
    MUZZLELOADER: { provenance: [] },
    BOW: {
      restriction: "Draw weight at least 18 kg (39.7 lb) at a draw length of 700 mm (27.6 in) or less. Arrows at least 600 mm (23.6 in) with a broadhead at least 22 mm (0.87 in) wide and at least 2 sharp cutting edges.",
      provenance: [Q("general", "Summary of firearms restrictions for hunting in Ontario", "Bow must have a draw weight of at least 18 kilograms (39.7 pounds)")],
    },
    CROSSBOW: {
      restriction: "Draw length at least 300 mm (11.8 in) and draw weight at least 45 kg (99.2 lb). Bolts with a broadhead at least 22 mm (0.87 in) wide and at least 2 sharp cutting edges.",
      provenance: [Q("general", "Summary of firearms restrictions for hunting in Ontario", "draw weight of at least 45 kilograms (99.2 pounds)")],
    },
  },
  largeGame: {
    RIFLE: { restriction: "Centre-fire rifle only.", provenance: [BIG_GAME_TABLE.rifle] },
    SHOTGUN: { restriction: "Not smaller than 20 gauge.", provenance: [BIG_GAME_TABLE.shotgun] },
    MUZZLELOADER: { provenance: [] },
    BOW: {
      restriction: "Draw weight at least 22 kg (48.5 lb) at a draw length of 700 mm (27.6 in) or less. Arrows at least 600 mm (23.6 in) with a broadhead at least 22 mm (0.87 in) wide and at least 2 sharp cutting edges.",
      provenance: [Q("general", "Summary of firearms restrictions for hunting in Ontario", "Bow must have a draw weight of at least 22 kilograms (48.5 pounds)")],
    },
    CROSSBOW: {
      restriction: "Draw length at least 300 mm (11.8 in) and draw weight at least 54 kg (119 lb). Bolts with a broadhead at least 22 mm (0.87 in) wide and at least 2 sharp cutting edges.",
      provenance: [Q("general", "Summary of firearms restrictions for hunting in Ontario", "draw weight of at least 54 kilograms (119 pounds)")],
    },
  },
  turkey: {
    SHOTGUN: {
      restriction: "10 to 20 gauge.",
      provenance: [Q("law", "O. Reg. 665/98 s. 79(1)(a)", "a shotgun, including a muzzle-loading shotgun of at least 20 gauge but not larger than 10 gauge")],
    },
    MUZZLELOADER: {
      restriction: "A muzzle-loading shotgun of 10 to 20 gauge only. A muzzle-loading rifle is not permitted.",
      provenance: [Q("law", "O. Reg. 665/98 s. 79(1)(a)", "a shotgun, including a muzzle-loading shotgun of at least 20 gauge but not larger than 10 gauge")],
    },
    BOW: {
      restriction: "Draw weight at least 18 kg. Arrows at least 600 mm with a head at least 22 mm wide and at least two sharp cutting edges.",
      provenance: [Q("law", "O. Reg. 665/98 s. 79(3)", "The long-bow must have a draw weight of at least 18 kilograms")],
    },
    CROSSBOW: {
      restriction: "Draw length at least 300 mm and draw weight at least 45 kg.",
      provenance: [Q("law", "O. Reg. 665/98 s. 79(3)", "a draw weight of at least 45 kilograms at the release latch mechanism")],
    },
    notAllowed: {
      RIFLE: [Q("law", "O. Reg. 665/98 s. 79(1)", "A person who hunts wild turkey shall not use a type of firearm other than")],
    },
  },
  smallGame: {
    SHOTGUN: { provenance: [] },
    RIFLE: { provenance: [] },
    MUZZLELOADER: { provenance: [] },
    BOW: { provenance: [] },
    CROSSBOW: { provenance: [] },
    AIR_GUN: {
      provenance: [Q("general", "Firearms", "Air and pellet guns are not permitted for hunting big game but may be used for hunting small game.")],
    },
  },
};

const AMMUNITION = {
  largeGameShot: {
    status: "REQUIRED",
    appliesToMethods: ["SHOTGUN"],
    summary: "With a shotgun, shot must be SG or No. 1 buck or larger.",
    provenance: [BIG_GAME_TABLE.shotgun],
  },
  turkeyShot: {
    status: "REQUIRED",
    appliesToMethods: ["SHOTGUN", "MUZZLELOADER"],
    summary: "Shot size 4, 5, 6 or 7 only.",
    provenance: [Q("law", "O. Reg. 665/98 s. 79(1)(a)", "loaded with shot sizes number 4, 5, 6 or 7")],
  },
  /** Applies only while a big-game season is open in the area — decided at request time. */
  smallGameDuringBigGame: {
    appliesToMethods: ["SHOTGUN"],
    summary:
      "While a deer, moose, elk or bear season is open here: no ball, and no shot larger than No. 2 " +
      "(steel up to BBB and bismuth up to BB are allowed) — unless you hold a licence to hunt that big game in that season.",
    provenance: [
      Q("smallGame", "Firearms",
        "you may not possess or use a centre-fire rifle or shells loaded with ball or with shot larger than No. 2 shot"),
      Q("smallGame", "Firearms",
        "unless you have a valid licence to hunt big game (deer, moose, elk or black bear) during the relevant open season"),
    ],
  },
  /** The same rule's restriction on rifles, shown on the rifle itself. */
  smallGameRifleDuringBigGame: {
    appliesToMethods: ["RIFLE"],
    summary: "No centre-fire rifle while a deer, moose, elk or bear season is open here, unless you hold a licence for that big game.",
    provenance: [
      Q("smallGame", "Firearms",
        "you may not possess or use a centre-fire rifle or shells loaded with ball or with shot larger than No. 2 shot"),
    ],
  },
  southernRifleCalibre: {
    appliesToMethods: ["RIFLE"],
    summary:
      "In 21 southern areas — including Toronto, Hamilton, Niagara, Essex and York — a rifle over .275 calibre may not be used for small game, except a muzzle-loader.",
    provenance: [
      Q("smallGame", "Firearms", "may not carry or use a rifle of greater calibre than a .275-calibre rifle, except a muzzle-loading gun"),
    ],
  },
};

/**
 * North Ground's practical advice. Deliberately short, category-level, and
 * absent where North Ground has no defensible basis — big game gets none,
 * because a calibre recommendation for an ethical kill is not advice to make
 * without evidence. Each one names the legal restriction it was checked
 * against, and `validateRecommendations` refuses one that falls outside it.
 */
const RECOMMENDATIONS = {
  upland: [
    { topic: "WEAPON", appliesToMethods: ["SHOTGUN"], text: "A 20 or 12 gauge shotgun is a practical choice for grouse." },
    {
      topic: "AMMUNITION", appliesToMethods: ["SHOTGUN"], text: "No. 6 to 7½ shot is a common choice at typical grouse ranges.",
      withinLegal: "Smaller than No. 2, so it stays legal even while a big-game season is open.", shotSizes: [6, 7, 7.5],
    },
  ],
  hare: [
    { topic: "WEAPON", appliesToMethods: ["SHOTGUN", "RIFLE"], text: "A 20 or 12 gauge shotgun, or a .22 rimfire rifle, is a practical choice for hare." },
    {
      topic: "AMMUNITION", appliesToMethods: ["SHOTGUN"], text: "No. 4 to 6 shot is a common choice for hare.",
      withinLegal: "Smaller than No. 2, so it stays legal even while a big-game season is open.", shotSizes: [4, 5, 6],
    },
  ],
  turkey: [
    { topic: "WEAPON", appliesToMethods: ["SHOTGUN"], text: "A 12 or 20 gauge shotgun is the usual choice for turkey.", gauges: [12, 20] },
    {
      topic: "AMMUNITION", appliesToMethods: ["SHOTGUN", "MUZZLELOADER"], text: "No. 4, 5 or 6 shot is a common turkey load.",
      withinLegal: "Inside the legal range of shot sizes 4 to 7.", shotSizes: [4, 5, 6],
    },
  ],
};

/** Which method, ammunition and advice groups each species uses. */
const SPECIES_METHODS = {
  "species:ruffed-grouse": { methods: "smallGame", ammunition: [], recommendations: "upland", smallGame: true },
  "species:spruce-grouse": { methods: "smallGame", ammunition: [], recommendations: "upland", smallGame: true },
  "species:sharp-tailed-grouse": { methods: "smallGame", ammunition: [], recommendations: "upland", smallGame: true },
  "species:snowshoe-hare": { methods: "smallGame", ammunition: [], recommendations: "hare", smallGame: true },
  "species:wild-turkey": { methods: "turkey", ammunition: ["turkeyShot"], recommendations: "turkey", smallGame: true },
  "species:white-tailed-deer": { methods: "deer", ammunition: ["largeGameShot"] },
  "species:american-black-bear": { methods: "largeGame", ammunition: ["largeGameShot"] },
  "species:moose": { methods: "largeGame", ammunition: ["largeGameShot"] },
};

/* ── Checks ──────────────────────────────────────────────────────────────── */

/**
 * A recommendation must sit inside the law. Turkey's legal shot sizes are 4 to
 * 7 and gauges 10 to 20; a recommendation of No. 2 or 28 gauge fails the build.
 */
function validateRecommendations() {
  const legal = { turkey: { shot: [4, 5, 6, 7], gauges: [10, 12, 16, 20] } };
  const bigGameWindowMax = 2; // small game: nothing larger than No. 2 while big game is open
  for (const [group, list] of Object.entries(RECOMMENDATIONS)) {
    for (const rec of list) {
      if (!rec.text) throw new Error(`Recommendation in ${group} has no text`);
      if (group === "turkey" && rec.shotSizes?.some((size) => !legal.turkey.shot.includes(size))) {
        throw new Error(`Turkey recommendation "${rec.text}" is outside the legal shot sizes 4 to 7`);
      }
      if (group === "turkey" && rec.gauges?.some((gauge) => !legal.turkey.gauges.includes(gauge))) {
        throw new Error(`Turkey recommendation "${rec.text}" is outside the legal 10 to 20 gauge range`);
      }
      if ((group === "upland" || group === "hare") && rec.shotSizes?.some((size) => size <= bigGameWindowMax)) {
        throw new Error(`Small-game recommendation "${rec.text}" would be illegal while a big-game season is open`);
      }
    }
  }
}

/* ── Fetch and verify ────────────────────────────────────────────────────── */

async function lawText() {
  const payload = JSON.parse(await fetchText(ELAWS_API));
  if (typeof payload.content !== "string" || payload.content.length < 50_000) {
    throw new Error("e-Laws did not return the regulation's text");
  }
  return {
    text: comparable(stripTags(payload.content)),
    // The consolidation the text reflects, so provenance says which law was read.
    consolidation: {
      period: payload.comments?.consolidationPeriod ?? null,
      from: payload.dateFrom ?? null,
      lastAmendment: stripTags(payload.comments?.comment ?? "").replace(/^Last amendment:\s*/i, "").replace(/\.\s*$/, "").trim() || null,
    },
  };
}

function parseFeeSchedule(html) {
  // The "Hunting fees" section only: headings name the product, list items the fee.
  const start = html.indexOf(">Hunting fees<");
  const end = html.indexOf(">Other permits<");
  if (start < 0 || end < 0) throw new Error("The fee schedule's sections could not be found");
  const section = html.slice(start, end);
  const fees = new Map();
  let heading = null;
  for (const token of section.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>|<li[^>]*>([\s\S]*?)<\/li>/g)) {
    if (token[1] !== undefined) { heading = comparable(stripTags(token[1])); continue; }
    const line = comparable(stripTags(token[2]));
    const match = /^(.*?):?\s*\$([\d,]+\.\d{2})$/.exec(line);
    if (!match || !heading) continue;
    fees.set(`${heading}|${match[1].trim()}`, { amount: Number(match[2].replace(/,/g, "")), heading });
  }
  const taxSentence = "All products with a fee are subject to 13% HST unless otherwise indicated.";
  if (!comparable(stripTags(section)).includes(taxSentence)) {
    throw new Error("The fee schedule no longer states how HST applies; review before publishing fees");
  }
  return fees;
}

async function readIssuers() {
  const parameters = new URLSearchParams({
    where: "1=1",
    outFields: "ISSUER_NAME,ISSUER_TYPE,ISSUER_TYPE_FRENCH,ADDRESS,ADDRESS_FRENCH,CITY,POSTAL_OR_ZIP_CODE,WEB_LINK",
    outSR: "4326",
    returnGeometry: "true",
    resultRecordCount: "2000",
    f: "json",
  });
  const payload = JSON.parse(await fetchText(`${ISSUER_SERVICE}/query?${parameters}`));
  if (payload.exceededTransferLimit) throw new Error("The issuer dataset exceeded one page; paginate before publishing");
  const features = payload.features ?? [];
  if (features.length < 100) throw new Error(`Issuer dataset returned only ${features.length} records`);
  const clean = (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined);
  return features
    .filter((feature) => Number.isFinite(feature.geometry?.x) && Number.isFinite(feature.geometry?.y))
    .map((feature) => {
      const a = feature.attributes;
      return {
        name: clean(a.ISSUER_NAME),
        type: clean(a.ISSUER_TYPE),
        typeFr: clean(a.ISSUER_TYPE_FRENCH),
        address: clean(a.ADDRESS),
        addressFr: clean(a.ADDRESS_FRENCH),
        city: clean(a.CITY),
        postalCode: clean(a.POSTAL_OR_ZIP_CODE),
        webLink: clean(a.WEB_LINK),
        // Five decimal places is about a metre: enough to rank by distance.
        latitude: Math.round(feature.geometry.y * 1e5) / 1e5,
        longitude: Math.round(feature.geometry.x * 1e5) / 1e5,
      };
    })
    .filter((issuer) => issuer.name && issuer.city)
    .sort((a, b) => a.name.localeCompare(b.name) || a.city.localeCompare(b.city));
}

/**
 * How a controlled deer hunt's footnote restricts its implements, for one
 * question only: is the hunt "restricted to the use of bows only"? That is the
 * one kind of deer, elk or moose season s. 26(1)(a) exempts from hunter orange.
 * An unrecognised footnote stops the build, so a new "bows only" note cannot
 * slip past and leave a hunter told orange is optional.
 */
const CONTROLLED_FOOTNOTES = [
  { match: /^indicates that rifles, shotguns, muzzle-loading guns and bows are permitted\.?$/i, bowsOnly: false },
  { match: /^indicates that only muzzle-loading guns and bows are permitted\.?$/i, bowsOnly: false },
  { match: /^indicates that only shotguns and muzzle-loading guns are permitted\.?$/i, bowsOnly: false },
  { match: /^indicates that only muzzle-loading guns are permitted\.?$/i, bowsOnly: false },
  { match: /^indicates that only bows are permitted\.?$/i, bowsOnly: true },
];

function footnoteBowsOnly(text) {
  const found = CONTROLLED_FOOTNOTES.find((entry) => entry.match.test(text.trim()));
  if (!found) throw new Error(`Unclassified controlled-hunt footnote, refusing to publish: "${text}"`);
  return found.bowsOnly;
}

/**
 * Seasons that are not the hunt being planned but still change what applies to
 * it. An open deer, elk or moose season other than bows-only puts every hunter
 * in the unit in hunter orange (s. 26(1)(a)); any open big-game season limits a
 * small-game hunter's rifle and shot. Elk and the controlled hunts are not
 * certified as hunts North Ground answers for, but they are read here because
 * leaving them out would say "orange not required" on days the law requires it.
 */
async function readOverlappingSeasons(officialIdentifiers) {
  const seasons = [];
  const texts = {};

  // Elk: one table, no implement restriction, so not bows-only.
  const elkHtml = await fetchText(SOURCES.elk.url);
  texts.elk = mainText(elkHtml);
  const elkTable = extractTables(elkHtml).find((candidate) => candidate.heading === "Elk season");
  if (!elkTable) throw new Error('The elk page no longer has an "Elk season" table');
  if (!/^wildlife management unit$/i.test(elkTable.rows[0]?.[0] ?? "")) throw new Error("The elk season table changed shape");
  for (const [spec, phrase] of elkTable.rows.slice(1).filter((row) => row.length >= 2)) {
    seasons.push({
      speciesId: "species:elk", kind: "GENERAL", officialSpec: spec,
      zoneIds: expandWmuSpec(spec, officialIdentifiers).map(zoneCanonicalId),
      seasonPhrase: phrase, bowsOnly: false, sourceId: SOURCES.elk.id, section: "Elk season",
    });
  }

  // Controlled deer hunts: one row per hunt code, implements set by footnote.
  const deerHtml = await fetchText(SOURCES.deer.url);
  texts.deer = mainText(deerHtml);
  const deerNotes = extractFootnotes(deerHtml);
  const controlledDeer = extractTables(deerHtml).filter((candidate) => candidate.heading === "Controlled deer hunt seasons (with hunt codes)");
  if (!controlledDeer.length) throw new Error("The controlled deer hunt tables are gone from the deer page");
  for (const table of controlledDeer) {
    if (!/^wmu$/i.test(table.rows[0]?.[0] ?? "") || !/hunt code/i.test(table.rows[0]?.[2] ?? "")) {
      throw new Error("A controlled deer hunt table changed shape");
    }
    table.rows.forEach((row, index) => {
      if (index === 0 || row.length < 3) return;
      const tokens = parseWmuCell(table.rawRows[index][0]);
      const bowsOnly = tokens.flatMap((token) => token.footnotes).some((id) => {
        const text = deerNotes.get(id);
        if (!text) throw new Error(`Controlled-hunt footnote ${id} has no definition`);
        return footnoteBowsOnly(text);
      });
      const spec = tokens.map((token) => token.token).join(", ");
      seasons.push({
        speciesId: "species:white-tailed-deer", kind: "CONTROLLED", huntCode: row[2], officialSpec: spec,
        zoneIds: expandWmuSpec(spec, officialIdentifiers).map(zoneCanonicalId),
        seasonPhrase: row[1], bowsOnly, sourceId: SOURCES.deer.id, section: "Controlled deer hunt seasons (with hunt codes)",
      });
    });
  }

  // Moose seasons with controlled hunter numbers: the firearm type is a column.
  const mooseHtml = await fetchText(SOURCES.moose.url);
  texts.moose = mainText(mooseHtml);
  const controlledMoose = extractTables(mooseHtml).find((candidate) => candidate.heading === "Resident seasons with controlled hunter numbers");
  if (!controlledMoose) throw new Error("The moose controlled-hunter-numbers table is gone");
  if (!/firearm type/i.test(controlledMoose.rows[0]?.[2] ?? "")) throw new Error("The moose controlled-hunter-numbers table changed shape");
  for (const row of controlledMoose.rows.slice(1).filter((candidate) => candidate.length >= 3)) {
    const firearm = row[2].trim();
    if (!/^bows only$|^rifles, shotguns, muzzle-loading guns$/i.test(firearm)) {
      throw new Error(`Unrecognised moose firearm type "${firearm}"; review before publishing`);
    }
    seasons.push({
      speciesId: "species:moose", kind: "CONTROLLED", officialSpec: row[0],
      zoneIds: expandWmuSpec(row[0], officialIdentifiers).map(zoneCanonicalId),
      seasonPhrase: row[1], bowsOnly: /^bows only$/i.test(firearm),
      sourceId: SOURCES.moose.id, section: "Resident seasons with controlled hunter numbers",
    });
  }

  return { seasons, texts };
}

/* ── Build ───────────────────────────────────────────────────────────────── */

async function main() {
  const checkOnly = process.argv.includes("--check");
  const previousBundle = readPreviousBundle(OUTPUT);
  const TODAY = jurisdictionToday();
  validateRecommendations();

  console.log("Reading O. Reg. 665/98 from e-Laws...");
  const law = await lawText();
  console.log(`  consolidated ${law.consolidation.period}, last amendment ${law.consolidation.lastAmendment}`);

  console.log("Reading the summary pages...");
  const feeHtml = await fetchText(SOURCES.fees.url);
  const texts = {
    law: law.text,
    fees: mainText(feeHtml),
    general: mainText(await fetchText(SOURCES.general.url)),
    smallGame: mainText(await fetchText(SOURCES.smallGame.url)),
  };
  const fees = parseFeeSchedule(feeHtml);

  console.log("Reading elk seasons and the licence issuer dataset...");
  const officialIdentifiers = await fetchOfficialWmuIdentifiers();
  const overlapping = await readOverlappingSeasons(officialIdentifiers);
  Object.assign(texts, overlapping.texts);
  const issuers = await readIssuers();

  const sourceHashes = Object.fromEntries(Object.entries(texts).map(([key, text]) => [SOURCES[key].id, sha256(text)]));
  const quoteDate = quoteRetrievedAtIndex(previousBundle);
  const retrievedAt = (sourceId, quote) => quoteDate(sourceId, quote, sourceHashes[sourceId], TODAY);

  // Every quote must be in the source it names — re-read today.
  const provenance = (entry) => {
    const source = SOURCES[entry.source];
    if (!source) throw new Error(`Unknown source "${entry.source}"`);
    if (!comparable(texts[entry.source]).includes(comparable(entry.quote))) {
      throw new Error(`Quote not found in ${source.title} (${entry.citation}): "${entry.quote}". The source may have changed; review before publishing.`);
    }
    return {
      sourceId: source.id, url: source.url, citation: entry.citation, tier: source.tier,
      quote: entry.quote, retrievedAt: retrievedAt(source.id, entry.quote),
    };
  };

  const authorizations = AUTHORIZATIONS.map((record) => ({
    id: record.id,
    kind: record.kind,
    officialName: record.officialName,
    authority: record.authority ?? AUTHORITY,
    jurisdictionId: record.jurisdictionId ?? JURISDICTION,
    appliesTo: record.appliesTo,
    prerequisites: record.prerequisites,
    ...(record.draw ? { draw: record.draw } : {}),
    possessionVerifiable: false,
    purchase: record.purchase,
    prices: record.fees.map((entry) => {
      const found = fees.get(`${entry.heading}|${entry.line}`);
      if (!found) {
        throw new Error(`Fee "${entry.line}" is no longer listed under "${entry.heading}"; review before publishing`);
      }
      return {
        amount: found.amount,
        currency: "CAD",
        label: entry.line.replace(/\s*\(a valid Outdoors Card[^)]*\)/, ""),
        appliesTo: entry.appliesTo,
        ...(entry.variant ? { variant: entry.variant } : {}),
        taxNote: "+ 13% HST",
        licenceYear: LICENCE_YEAR,
        provenance: {
          sourceId: SOURCES.fees.id, url: `${SOURCES.fees.url}#section-0`, citation: `Hunting fees — ${entry.heading}`,
          tier: SOURCES.fees.tier, quote: `${entry.line}: $${found.amount.toFixed(2)}`,
          retrievedAt: retrievedAt(SOURCES.fees.id, `${entry.line}: $${found.amount.toFixed(2)}`),
        },
      };
    }),
    provenance: record.provenance.map(provenance),
    ...(record.note ? { note: record.note } : {}),
    ...(record.residencyNotes
      ? {
          residencyNotes: Object.fromEntries(Object.entries(record.residencyNotes).map(([key, value]) => [
            key, { text: value.text, provenance: provenance(value.provenance) },
          ])),
        }
      : {}),
  }));

  const known = new Set(authorizations.map((record) => record.id));
  const requirements = Object.fromEntries(Object.entries(REQUIREMENTS).map(([speciesId, list]) => [
    speciesId,
    list.map((entry) => {
      const item = typeof entry === "string" ? { authorizationId: entry } : entry;
      if (!known.has(item.authorizationId)) throw new Error(`${speciesId} requires unknown ${item.authorizationId}`);
      return item;
    }),
  ]));

  const mapProvenance = (list) => list.map(provenance);
  const methods = Object.fromEntries(Object.entries(METHODS).map(([group, entries]) => [group, {
    allowed: Object.fromEntries(Object.entries(entries).filter(([key]) => key !== "notAllowed").map(([method, value]) => [
      method, { ...(value.restriction ? { restriction: value.restriction } : {}), provenance: mapProvenance(value.provenance) },
    ])),
    notAllowed: Object.fromEntries(Object.entries(entries.notAllowed ?? {}).map(([method, list]) => [method, mapProvenance(list)])),
  }]));
  const ammunition = Object.fromEntries(Object.entries(AMMUNITION).map(([key, value]) => [
    key, { ...value, provenance: mapProvenance(value.provenance) },
  ]));
  const orange = {
    specification: ORANGE.specification,
    provenance: Object.fromEntries(Object.entries(ORANGE.provenance).map(([key, value]) => [key, provenance(value)])),
  };

  // Hash the facts, not the build: an unchanged source rebuilds byte-identically.
  const contentHash = sha256(JSON.stringify({ authorizations, requirements, methods, ammunition, orange, overlapping: overlapping.seasons }));
  const issuersHash = sha256(JSON.stringify(issuers));

  const bundle = {
    contractVersion: 1,
    generatedBy: "scripts/build-ontario-readiness.mjs",
    jurisdictionId: JURISDICTION,
    jurisdictionName: "Ontario",
    officialInfoUrl: LICENCE_INFO,
    licenceYear: LICENCE_YEAR,
    law: { citation: "O. Reg. 665/98", ...law.consolidation },
    retrievedAt: retrievedAtFor(previousBundle, previousBundle?.contentHash, contentHash, TODAY),
    contentHash,
    sourceHashes,
    sources: Object.values(SOURCES).map(({ id, title, url, tier }) => ({ id, title, url, tier })),
    authorizations,
    requirements,
    orange,
    methods,
    ammunition,
    recommendations: RECOMMENDATIONS,
    speciesMethods: SPECIES_METHODS,
    overlappingSeasons: overlapping.seasons,
  };

  const previousIssuers = readPreviousBundle(ISSUERS_OUTPUT);
  const issuerBundle = {
    generatedBy: "scripts/build-ontario-readiness.mjs",
    directoryId: "ca-on-licence-issuers",
    source: { ...SOURCES.issuers, service: ISSUER_SERVICE },
    attribution: "Contains information licensed under the Open Government Licence – Ontario.",
    licenceUrl: "https://www.ontario.ca/page/open-government-licence-ontario",
    retrievedAt: retrievedAtFor(previousIssuers, previousIssuers?.contentHash, issuersHash, TODAY),
    contentHash: issuersHash,
    count: issuers.length,
    issuers,
  };

  if (checkOnly) {
    const moved = [];
    if (!previousBundle) moved.push("no readiness bundle exists");
    else if (previousBundle.contentHash !== contentHash) moved.push(`readiness content ${previousBundle.contentHash} -> ${contentHash}`);
    for (const [id, hash] of Object.entries(sourceHashes)) {
      if (previousBundle?.sourceHashes?.[id] && previousBundle.sourceHashes[id] !== hash) moved.push(`MOVED  ${id}`);
    }
    if (previousIssuers && previousIssuers.contentHash !== issuersHash) moved.push("licence issuer dataset changed");
    if (moved.length) {
      console.error("An Ontario readiness source has CHANGED since the bundle was built:");
      for (const line of moved) console.error(`  ${line}`);
      console.error("Nothing has been published. Rebuild, review, and re-certify before promoting.");
      process.exit(2);
    }
    console.log(`Ontario readiness sources unchanged (${contentHash.slice(0, 23)}...).`);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(bundle, null, 2)}\n`);
  writeFileSync(ISSUERS_OUTPUT, `${JSON.stringify(issuerBundle, null, 2)}\n`);
  console.log(`\nWrote ${OUTPUT}`);
  console.log(`  ${authorizations.length} authorizations, ${authorizations.reduce((n, a) => n + a.prices.length, 0)} published fees`);
  console.log(`  every quote re-read from its source; law consolidated ${law.consolidation.period}`);
  const count = (id, kind) => overlapping.seasons.filter((s) => s.speciesId === id && s.kind === kind).length;
  console.log(`  overlapping seasons: elk ${count("species:elk", "GENERAL")}, controlled deer ${count("species:white-tailed-deer", "CONTROLLED")}, controlled moose ${count("species:moose", "CONTROLLED")} (bows-only: ${overlapping.seasons.filter((s) => s.bowsOnly).length})`);
  console.log(`Wrote ${ISSUERS_OUTPUT}: ${issuers.length} issuers`);
}

main().catch((error) => {
  console.error(`Build failed: ${error.message}`);
  process.exit(1);
});
