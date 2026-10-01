/**
 * Saskatchewan's certified rules, from a standing regulation and two derivations.
 *
 * Three inputs, and the division between them is the point:
 *
 *  1. `content/regulatory/sources/ca-sk-open-seasons-rows.json` — the 197 season
 *     rows of The Open Seasons Game Regulations, 2009, normalised and
 *     adversarially verified. Their dates, zones, licence classes, bag limits and
 *     animal classes are used as they stand.
 *  2. `saskatchewan-methods.ts` — the permitted implements, which the rows' own
 *     `methods` field gets WRONG. It was read off section headings, and the
 *     regulation's envelopes nest: a bow is lawful in the muzzleloader season. The
 *     rows file says so itself in `whatMustNotBeTrustedHere`.
 *  3. `saskatchewan-geography.ts` — the 83 designations, s. 3(c)'s suffix rule and
 *     the Game Bird District derivation.
 *
 * FOUR THINGS THAT MAKE SASKATCHEWAN DIFFERENT FROM THE FOUR PROVINCES BEFORE IT:
 *
 *  1. THE DATES ARE STANDING AND THE LICENCE IS A CALENDAR YEAR. Every season is
 *     month-and-day with no year (s. 4 of the Act's definition path), so the
 *     seasons recur until amended — and s. 4 of this regulation makes a licence
 *     valid "only during the calendar year in which the licence is issued". A
 *     calendar year is a fifth distinct validity basis, after Nova Scotia's four,
 *     New Brunswick's two adjacent-subsection expiries and Newfoundland's
 *     event-based one.
 *
 *  2. THE LICENCE CLASS IS THE DIMENSION. The regulation names 41 of them and the
 *     seasons turn on them: residency changes the zones AND the dates. So rules
 *     are keyed on the authority's own licence names, and the dimension draws its
 *     values from the PLACE so a hunter sees the handful reaching their zone
 *     rather than all 41.
 *
 *  3. BIRD SEASONS CARRY NO METHOD AT ALL. ss. 46 to 51 name no permitted means,
 *     where every big-game section does. So a bird rule is unconstrained rather
 *     than carrying a guessed set.
 *
 *  4. PARKS ARE WHERE THE COVERAGE STOPS. 47 of the 197 rows have no resolvable
 *     zone — their whole geography is provincial parks and recreation sites North
 *     Ground holds no boundary for. They are recorded with their dates and counted
 *     nowhere, because §8 requires capability reporting to measure deliverable
 *     answers.
 *
 * Run: node scripts/build-saskatchewan-regulations.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { SASKATCHEWAN_ZONES } from "../src/lib/hunt/regulatory/saskatchewan-geography.ts";
import { SECTION_ENVELOPES, implementsPermittedIn } from "../src/lib/hunt/regulatory/saskatchewan-methods.ts";

const OUT = "content/regulatory/ca-sk-2026.json";
const ROWS = "content/regulatory/sources/ca-sk-open-seasons-rows.json";

const ACT = "source:ca-sk-wildlife-act";
const OSGR = "source:ca-sk-open-seasons-game-regulations";
const WLR = "source:ca-sk-wildlife-regulations";
const WMZ_REG = "source:ca-sk-wmz-boundaries-regulations";
const GUIDE = "source:ca-sk-hunters-guide-2026-27";
const WMZ_SERVICE = "source:ca-sk-wmz-service";

const RETRIEVED = "2026-10-01";
const SOURCE_VERSION =
  "The Open Seasons Game Regulations, 2009, c. W-13.12 Reg 3, consolidated through SR 50/2026 (filed 31 July 2026); " +
  "The Wildlife Regulations, 1981, c. W-13.1 Reg 1; The Wildlife Act, 1998, c. W-13.12";

/* ── The year the standing dates are derived for ────────────────────────── */

const BASE_YEAR = 2026;
const MONTHS = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
};

/**
 * One of the regulation's date bounds, as an ISO day in the derived year.
 *
 * The regulation writes month and day with no year, and fourteen bounds carry its
 * own cross-year qualifiers instead — "December 30 in the current year", "January
 * 14 in the following year", "November 1 in each year", "August 15 in one year".
 * Those decide which year the bound falls in, so they are read rather than
 * inferred from whether the close precedes the open.
 */
function isoBound(statedAs) {
  const match = /^([A-Z][a-z]+) (\d{1,2})(?: in (the current|the following|each|one) year)?$/.exec(statedAs);
  if (!match) throw new Error(`Cannot read the date bound "${statedAs}"`);
  const month = MONTHS[match[1]];
  if (!month) throw new Error(`Unknown month in "${statedAs}"`);
  const year = match[3] === "the following" ? BASE_YEAR + 1 : BASE_YEAR;
  return `${year}-${String(month).padStart(2, "0")}-${String(Number(match[2])).padStart(2, "0")}`;
}

/**
 * One season window, with the cross-year case handled EXPLICITLY.
 *
 * Most bounds carry their own year qualifier, and two do not: s. 29.2(2) and (3)
 * say plainly "from October 15 to March 15" and leave the reader to see that March
 * is the following year. The extraction marks those rows `crossesYear`, and the
 * first build of this bundle ignored the flag and emitted a wolf season running
 * 2026-10-15 to 2026-03-15 — a window that closes five months before it opens, so
 * no date is ever inside it and wolf read CLOSED all year in two zones.
 *
 * It was caught by `engine-answers-somewhere.test.ts`, which asks the engine for an
 * answer at the midpoint of every rule's own first window: a window whose midpoint
 * falls outside itself is exactly what that guard exists to notice.
 *
 * So the close advances a year when the regulation's own words put it there, or
 * when the row is marked cross-year and the close would otherwise precede the
 * open. And a window that still closes before it opens throws rather than being
 * emitted, because there is no reading of the regulation under which one is right.
 */
function windowFor(row) {
  const opensIso = isoBound(row.opensStatedAs);
  let closesIso = isoBound(row.closesStatedAs);
  const closeNamesItsYear = / in (?:the current|the following|each|one) year$/.test(row.closesStatedAs);
  if (closesIso < opensIso && !closeNamesItsYear) {
    const [year, rest] = [Number(closesIso.slice(0, 4)), closesIso.slice(4)];
    closesIso = `${year + 1}${rest}`;
  }
  if (closesIso < opensIso) {
    throw new Error(
      `s. ${row.section}: "${row.opensStatedAs}" to "${row.closesStatedAs}" derives ${opensIso}..${closesIso}, ` +
      "which closes before it opens");
  }
  const crossesYear = closesIso.slice(0, 4) !== opensIso.slice(0, 4);
  return {
    opensIso,
    closesIso,
    statedAs: `from ${row.opensStatedAs} to ${row.closesStatedAs}`,
    /* Always present, true or false. An absent flag is indistinguishable from a
       window nobody checked, which is what hid the cross-year case in four other
       bundles; `crossesYearAgreesWithTheBundle` records those and refuses a new
       one. */
    crossesYear,
    ...(crossesYear
      ? {
        crossYearBasis: closeNamesItsYear
          ? "the regulation states which year the close falls in"
          : "the regulation leaves it to the reader: the close precedes the open in the calendar, so it is the following year",
      }
      : {}),
  };
}

/* ── Species ────────────────────────────────────────────────────────────── */

/**
 * The regulation's species words, mapped to canonical ids.
 *
 * Two entries are deliberately absent and are recorded as gaps rather than
 * guessed. "ptarmigan" — the regulation's own word, and the catalogue carries
 * willow and rock ptarmigan as separate species, so encoding either narrows the
 * source and encoding both turns one rule into two. "barren-ground caribou" — its
 * only season-granting subsection, s. 27(2), is repealed, and a separate
 * subsistence-use regime exists under The Wildlife Regulations, 1981 Part IX.1, so
 * a flat CLOSED would be wrong for the people that Part is for.
 */
const SPECIES = {
  "white-tailed deer": "species:white-tailed-deer",
  "mule deer": "species:mule-deer",
  elk: "species:elk",
  moose: "species:moose",
  "black bear": "species:american-black-bear",
  /* The regulation's class is "plains bison", a subspecies of the canonical
     American bison; the authority's own term is kept on every rule. */
  "plains bison": "species:american-bison",
  /* Saskatchewan's "wolf" is the grey wolf; s. 2 does not define it further. */
  wolf: "species:gray-wolf",
  "pronghorn antelope": "species:pronghorn",
  "sharp-tailed grouse": "species:sharp-tailed-grouse",
  "gray, or Hungarian, partridge": "species:gray-partridge",
  "ruffed grouse": "species:ruffed-grouse",
  "spruce grouse": "species:spruce-grouse",
  pheasant: "species:ring-necked-pheasant",
};

const BIG_GAME = new Set([
  "species:white-tailed-deer", "species:mule-deer", "species:elk", "species:moose",
  "species:american-black-bear", "species:american-bison", "species:gray-wolf", "species:pronghorn",
]);

/* ── Read the rows ──────────────────────────────────────────────────────── */

const artefact = JSON.parse(readFileSync(ROWS, "utf8"));
const rows = artefact.groups.flatMap((group) => group.rows);

const encodable = [];
const parksOnly = [];
const skipped = [];
for (const row of rows) {
  if (!row.seasonName) continue;                       // the limits sections grant no season
  const speciesId = SPECIES[row.speciesStatedAs];
  if (!speciesId) { skipped.push(row); continue; }
  if (!row.zones.length) { parksOnly.push(row); continue; }
  encodable.push({ ...row, speciesId });
}

/* ── Groups, one per distinct zone set ──────────────────────────────────── */

const groups = [];
const groupOf = new Map();
for (const row of encodable) {
  const signature = [...row.zones].sort().join(",");
  if (!groupOf.has(signature)) {
    const id = `regulatory_group:ca-sk-2026-g${String(groups.length + 1).padStart(2, "0")}`;
    groups.push({
      id,
      officialSpec: row.statedGeography.replace(/^in /, ""),
      zoneIds: [...row.zones].sort().map((zone) => `management_zone:ca-sk-wmz-${zone.toLowerCase()}`),
    });
    groupOf.set(signature, id);
  }
}

/* ── Conditions ─────────────────────────────────────────────────────────── */

const condition = (id, scope, text, sourceId, sourceSection, extra = {}) =>
  ({ id, scope, text, sourceId, sourceSection, ...extra });

const BASE = ["ca-sk-licence-required", "ca-sk-licence-calendar-year", "ca-sk-landowner-consent",
  "ca-sk-night", "ca-sk-time-is-cst", "ca-sk-no-vehicle-firearm", "ca-sk-impaired", "ca-sk-careless"];
const BIG_GAME_CONDITIONS = [...BASE, "ca-sk-hunter-clothing", "ca-sk-deemed-open-areas"];

const CONDITIONS = {
  [ACT]: [
    condition("ca-sk-licence-required", "JURISDICTION",
      "A licence is required, and you may hunt only at the times, in the places and in the manner the Act and its regulations prescribe.",
      ACT, "The Wildlife Act, 1998, s. 25(1)"),
    condition("ca-sk-landowner-consent", "JURISDICTION",
      "You may not hunt on any land without the consent of the owner or occupant, except on vacant provincial land. If you are charged, the onus is on YOU to prove you had consent. Where an owner permits hunting by posted signs, you must follow the posted instructions, and access to park land is governed by The Parks Act instead.",
      ACT, "The Wildlife Act, 1998, ss. 41(1), 41(2), 41(3), 41(6), 41(7), 41(8)",
      { note: "The inverse of most provinces: consent is the DEFAULT rather than the exception, and the burden of proving it is reversed." }),
    condition("ca-sk-no-vehicle-firearm", "JURISDICTION",
      "You may not carry a loaded firearm in or on a vehicle or while on horseback, or discharge a firearm from either, unless the minister authorizes it.",
      ACT, "The Wildlife Act, 1998, s. 40"),
    condition("ca-sk-impaired", "JURISDICTION",
      "You may not hunt while intoxicated or under the influence of a narcotic or alcohol.",
      ACT, "The Wildlife Act, 1998, s. 39"),
    condition("ca-sk-careless", "JURISDICTION",
      "You may not discharge or handle a firearm without reasonable consideration for persons or property, or without due care and attention.",
      ACT, "The Wildlife Act, 1998, s. 38"),
  ],
  [OSGR]: [
    condition("ca-sk-licence-calendar-year", "JURISDICTION",
      "A licence authorizes you to hunt only during the CALENDAR YEAR in which it was issued, subject to six named exceptions.",
      OSGR, "The Open Seasons Game Regulations, 2009, s. 4",
      { note: "Not a licence year and not a season: the calendar year of issue. The exceptions are ss. 22, 27, 29.2, 51, 58 and 63." }),
    condition("ca-sk-time-is-cst", "JURISDICTION",
      "Every time in these regulations is Central Standard Time.",
      OSGR, "The Open Seasons Game Regulations, 2009, s. 3(b)",
      { note:
        "Across this certified period the statutory basis and the hunter's own clock coincide everywhere in the " +
        "province, so there is nothing to convert — but that is contingent rather than structural, and the reason " +
        "matters to anyone computing a window from it. Saskatchewan observes Central Standard Time (UTC-6) " +
        "year-round and changes no clocks, and the Government of Saskatchewan states there are currently no time " +
        "option areas. Until 2026 the City of Lloydminster and the surrounding area differed, observing Mountain " +
        "Standard Time (UTC-7) from November to March — an hour behind the rest of the province. That ended when " +
        "Alberta adopted Alberta Time (UTC-6) year-round from November 2026, so from its final spring-forward in " +
        "March 2026 Alberta has been UTC-6 continuously and this period begins after it. The Time Act, 2026 " +
        "expressly allows time option areas to be established in regulation for border communities, so a legal-time " +
        "module must read the basis as data for the date asked and must not treat single-zone permanent CST as a " +
        "fixed property of the province." }),
    condition("ca-sk-deemed-open-areas", "JURISDICTION",
      "Where a zone is open for a big game species, eight protected and national wildlife areas inside it are DEEMED OPEN for that species: Anderson Island and Waskwei River Protected Areas, and the Bradwell, Last Mountain Lake, Prairie (Units 1 to 28), Stalwart Lake, Tway and Webb National Wildlife Areas. The exclusions run the other way: Fort à la Corne Wildlife Management Unit and the St. Denis National Wildlife Research Area are carved out, and provincial parks and recreation sites are closed except those the regulation lists.",
      OSGR, "The Open Seasons Game Regulations, 2009, ss. 7, 7.1",
      { note: "This inverts the usual assumption that a protected area inside an open zone is closed. North Ground holds no boundary for any of these areas, so the deeming is stated rather than resolved at a point." }),
    condition("ca-sk-bull-elk-antler", "JURISDICTION",
      "A “bull elk” is a male elk with an antler at least 15 centimetres long, measured on the outside curve from the skull to the tip.",
      OSGR, "The Open Seasons Game Regulations, 2009, s. 2(h)",
      { speciesIds: ["species:elk"] }),
    condition("ca-sk-bull-moose-age", "JURISDICTION",
      "A “bull moose” is a male moose at least one year old.",
      OSGR, "The Open Seasons Game Regulations, 2009, s. 2(i)",
      { speciesIds: ["species:moose"] }),
    condition("ca-sk-antlerless-definitions", "JURISDICTION",
      "“Antlerless” means a female, or a young animal — and the age test differs by species: an antlerless elk is one less than one year old, while an antlerless moose, mule deer, white-tailed deer or doe pronghorn is one born in the year it is hunted.",
      OSGR, "The Open Seasons Game Regulations, 2009, ss. 2(b), 2(c), 2(d), 2(e), 2(m)",
      { speciesIds: ["species:elk", "species:moose", "species:mule-deer", "species:white-tailed-deer", "species:pronghorn"] }),
    condition("ca-sk-cock-pheasant", "JURISDICTION",
      "Only cock pheasants — males — may be hunted.",
      OSGR, "The Open Seasons Game Regulations, 2009, ss. 2(k), 50(2)",
      { speciesIds: ["species:ring-necked-pheasant"] }),
  ],
  [WLR]: [
    condition("ca-sk-night", "JURISDICTION",
      "You may not hunt from half an hour after sunset to half an hour before sunrise.",
      WLR, "The Wildlife Regulations, 1981, s. 11(1)"),
    condition("ca-sk-hunter-clothing", "JURISDICTION",
      "Hunting big game, and accompanying or guiding someone who is, you must wear a torso-covering outer garment in scarlet, bright yellow, blaze orange, WHITE or any combination — or CSA-approved high-visibility apparel labelled CAN/CSA Z96 Class 2 — AND a cap or toque in scarlet, bright yellow or blaze orange. White is lawful for the garment and NOT for the cap. A patch may cover less than 100 cm² of the garment and less than 50 cm² of the cap.",
      WLR, "The Wildlife Regulations, 1981, ss. 21(1), 21(1.1), 21(1.2), 21(2), 21(3)",
      {
        note: "Saskatchewan is not a blaze-orange jurisdiction: four colours or a CSA label satisfy it, the two colour lists differ by exactly one colour, and the requirement binds the person accompanying or guiding as well as the hunter. s. 21(2) lifts it for a bow, crossbow, muzzle-loading firearm or shotgun where such a season exists; s. 21(3) reinstates it for an archery mule deer licence while the special mule deer rifle season runs concurrently.",
      }),
  ],
};

/* ── Rules ──────────────────────────────────────────────────────────────── */

const RULES = encodable.map((row, index) => {
  const birdSeason = !SECTION_ENVELOPES[row.seasonName];
  const implementsFor = birdSeason ? undefined : [...implementsPermittedIn(row.seasonName)];
  const conditionIds = [
    ...(BIG_GAME.has(row.speciesId) ? BIG_GAME_CONDITIONS : BASE),
    ...(row.speciesId === "species:elk" ? ["ca-sk-bull-elk-antler"] : []),
    ...(row.speciesId === "species:moose" ? ["ca-sk-bull-moose-age"] : []),
    ...(/antlerless/i.test(row.animalClassStatedAs ?? "") ? ["ca-sk-antlerless-definitions"] : []),
    ...(row.speciesId === "species:ring-necked-pheasant" ? ["ca-sk-cock-pheasant"] : []),
  ];
  return {
    id: `regulatory_rule:ca-sk-2026-${String(index + 1).padStart(3, "0")}-s${row.section.replace(/[()]/g, "")}`,
    speciesId: row.speciesId,
    regulatoryGroupId: groupOf.get([...row.zones].sort().join(",")),
    geography: {
      statedAs: row.statedGeography,
      include: { ghas: [...row.zones].sort(), gbhz: [], special: [] },
      exclude: { ghas: [], special: [] },
    },
    appliesWhen: {
      ...(implementsFor ? { permittedImplements: implementsFor } : {}),
      ...(row.licenceClasses?.length ? { LICENCE_TYPE: row.licenceClasses } : {}),
    },
    seasonLabel: "Open season",
    seasonPhrase: `${row.opensStatedAs} to ${row.closesStatedAs}`,
    windows: [windowFor(row)],
    declaredNoSeason: false,
    limits: row.bagStatedAs
      ? {
        statedAs: row.bagStatedAs,
        ...(row.bagNumber ? { bag: Number(row.bagNumber) } : {}),
        ...(row.animalClassStatedAs ? { animalClass: row.animalClassStatedAs } : {}),
        section: `The Open Seasons Game Regulations, 2009, s. ${row.section}`,
      }
      : { statedAs: "The regulation states no bag limit in this subsection" },
    conditionIds,
    caveats: [],
    notes: [
      ...(birdSeason
        ? [{ text: `This is an upland game bird season. The regulation names no permitted means for it — ss. 46 to 51 carry no method envelope where every big-game section does — so no method restriction is stated. The geography is the ${(row.districtsStatedAs ?? []).join(" and ")} Game Bird District, derived from the zones its Game Bird Management Units name.` }]
        : [{ text: `Permitted means come from s. ${row.section.split("(")[0]}(1)'s own envelope — "${row.seasonName}" — not from the section's title. The envelopes nest, so this season permits ${implementsFor.join(", ")}.` }]),
      ...(row.unresolvedGeography?.length
        ? [{ text: `This season also reaches geography North Ground holds no boundary for, and those places are not in this rule: ${row.unresolvedGeography.join("; ")}.` }]
        : []),
    ],
    disputes: [],
    sourceId: OSGR,
    sourceSection: `The Open Seasons Game Regulations, 2009, s. ${row.section}`,
    sourceVersion: SOURCE_VERSION,
    reviewStatus: "VERIFIED",
  };
});

/* ── Sources ────────────────────────────────────────────────────────────── */

const READABLE_TERMS_UNSTATED = {
  accessState: "PUBLIC_READABLE",
  reuseState: "UNSTATED",
  archiveState: "UNCONFIRMED",
  derivedFactsState: "USABLE",
  termsStatus: "NOT_LOCATED",
  retrievalMethod: "OFFICIAL_API",
  authorityLevel: "PRIMARY_GOVERNMENT",
  lastVerified: RETRIEVED,
};

const UNOFFICIAL =
  "This consolidation is not official. Amendments have been incorporated for convenience of reference and the " +
  "original statutes and regulations should be consulted for all purposes of interpretation and application of the law.";

const SOURCES = [
  {
    id: ACT, title: "The Wildlife Act, 1998, c. W-13.12",
    url: "https://publications.saskatchewan.ca/api/v1/products/938/formats/1513/download",
    authority: "Government of Saskatchewan (Office of the King's Printer)",
    ...READABLE_TERMS_UNSTATED, unofficialConsolidationNotice: UNOFFICIAL,
    note: "Carries the closed world (s. 25(1): times AND places AND manner), the landowner-consent default (s. 41) and the definition of “open season” as a period specified in the REGULATIONS (s. 2). Its only order power, s. 27, is geography — so there is no annual season order to miss.",
    conditions: CONDITIONS[ACT],
  },
  {
    id: OSGR, title: "The Open Seasons Game Regulations, 2009, c. W-13.12 Reg 3",
    url: "https://publications.saskatchewan.ca/api/v1/products/27548/formats/34643/download",
    authority: "Minister of Environment, Saskatchewan",
    ...READABLE_TERMS_UNSTATED, unofficialConsolidationNotice: UNOFFICIAL,
    consolidatedAs: "SR 50/2026, filed 31 July 2026; catalogue last update posted 11 August 2026",
    note: "The instrument that carries the dates, made under Act s. 83(2)(a). Its own ss. 3(b) and 3(c) fix Central Standard Time and the zone-suffix rule; ss. 7 and 7.1 deem eight protected and national wildlife areas open.",
    conditions: CONDITIONS[OSGR],
  },
  {
    id: WLR, title: "The Wildlife Regulations, 1981, c. W-13.1 Reg 1",
    url: "https://publications.saskatchewan.ca/api/v1/products/1602/formats/2841/download",
    authority: "Lieutenant Governor in Council, Saskatchewan",
    ...READABLE_TERMS_UNSTATED, unofficialConsolidationNotice: UNOFFICIAL,
    note: "The conduct regulation. Carries legal hours (s. 11(1)) and hunting clothing (s. 21). Its chapter prefix is W-13.1 rather than W-13.12 because it was made under the repealed Act and continues in force under the 1998 one.",
    conditions: CONDITIONS[WLR],
  },
  {
    id: WMZ_REG, title: "The Wildlife Management Zones and Special Areas Boundaries Regulations, 1990, c. W-13.1 Reg 45",
    url: "https://publications.saskatchewan.ca/#/products/1607",
    authority: "Lieutenant Governor in Council, Saskatchewan",
    ...READABLE_TERMS_UNSTATED,
    note: "The written boundary descriptions, which the ministry says supersede its own digital layer where they disagree.",
  },
  {
    id: GUIDE, title: "Saskatchewan Hunters and Trappers Guide 2026-27",
    url: "https://publications.saskatchewan.ca/api/v1/products/121483/formats/140653/download",
    authority: "Saskatchewan Ministry of Environment",
    ...READABLE_TERMS_UNSTATED, authorityLevel: "GOVERNMENT_SUMMARY", retrievalMethod: "OFFICIAL_PDF",
    note: "A summary, and it says so: “The guide is not a legal document and is intended for use as a reference only.” Used to cross-check the regulation's dates, which it restates. It diverges from s. 21 on hunter clothing in three places and is MORE permissive on one of them — see `guideDivergence`.",
  },
  {
    id: WMZ_SERVICE, title: "WildlifeManagement/MapServer/0 (Wildlife Management Zones)",
    url: "https://gis.saskatchewan.ca/arcgis/rest/services/WildlifeManagement/MapServer/0",
    authority: "Saskatchewan Ministry of Environment",
    authorityLevel: "PRIMARY_GOVERNMENT",
    accessState: "PUBLIC_READABLE", reuseState: "GRANTED", archiveState: "FORBIDDEN",
    derivedFactsState: "USABLE", termsStatus: "LOCATED",
    retrievalMethod: "OFFICIAL_API", lastVerified: "2026-09-30",
    note: "The geography, read LIVE at the time of each question. The Standard Unrestricted Use Data Licence v2.0 grants commercial reuse and the same item adds “Not for resale”, so North Ground stores no copy and redistributes no file (owner decision, 2026-09-22).",
  },
];

/* ── Absence ────────────────────────────────────────────────────────────── */

const ABSENCE = {
  meaning: "CLOSED",
  words: {
    owner: "AUTHORITY",
    text: "Subject to subsection (2), no person shall hunt any wildlife within Saskatchewan: (a) other than at the times, in the places and in the manner prescribed by this Part and the regulations; and (b) without a licence where a licence is required by this Part or the regulations.",
    sourceId: ACT,
    citation: "The Wildlife Act, 1998, c. W-13.12, s. 25(1)",
    lang: "en-CA",
  },
  section: "The Wildlife Act, 1998, s. 25(1); s. 2, definition of “open season”",
  sourceId: ACT,
  explanation:
    "Saskatchewan's closed world is one sentence covering times AND places AND manner, which is the cleanest of the " +
    "five provinces certified so far — Newfoundland needed three provisions and New Brunswick two read together. " +
    "s. 2 then defines “open season” as “a period specified in the regulations”, so a time, place or manner no " +
    "regulation prescribes is not lawful.",
  negativeControl:
    "The Act's only order power is s. 27, which constitutes conservation blocks — geography, not seasons. A grep of " +
    "the Act for order-making language (“by order”, “make an order”, “vary”, “close”) found no power to open, " +
    "close, vary or shorten a season by order, so there is no unpublished annual layer between consolidations. The " +
    "caveat is kept: s. 83(1) runs (a) to (vv) and not every intervening clause was read, and a term search is a term " +
    "search.",
  theStandingLimitOnEveryClosedClaim: {
    citation: "The Wildlife Act, 1998, s. 83(2)(a)",
    statedAs: "The minister may make regulations: (a) defining and declaring open seasons during which and areas within which a person may hunt certain wildlife",
    whyItMatters:
      "The seasons are a ministerial regulation amended by numbered Saskatchewan Regulations — twenty of them since " +
      "2009, the most recent SR 50/2026 filed 31 July 2026. A closed answer here is closed on the consolidation North " +
      "Ground read; a later SR can open a season without any other instrument changing.",
  },
};

/* ── Deliberate gaps ────────────────────────────────────────────────────── */

const NOT_ENCODED = [
  {
    what: `${parksOnly.length} season rows whose entire geography is provincial parks and recreation sites`,
    reason: "GEOGRAPHY NOT HELD",
    detail:
      "These are real seasons with real dates — Great Blue Heron, Greenwater Lake, Meadow Lake, Narrow Hills, " +
      "Clarence-Steepbank Lakes, Wildcat Hill, Duck Mountain, Moose Mountain, Porcupine Hills, Lac La Ronge and " +
      "Clearwater River Provincial Parks, the Bronson Forest, Nesslin Lake and Round Lake Recreation Sites, Fort à la " +
      "Corne Wildlife Management Unit, and partial descriptions like “that portion of Douglas Provincial Park lying " +
      "west of Diefenbaker Lake”. North Ground holds no boundary for any of them, so none of these rows can be " +
      "delivered at a point and none is counted. Their dates are kept in " +
      "`content/regulatory/sources/ca-sk-open-seasons-rows.json` so a park layer makes them live without re-reading " +
      "the regulation.",
    rows: parksOnly.map((row) => ({
      section: row.section, species: row.speciesStatedAs,
      season: `${row.opensStatedAs} to ${row.closesStatedAs}`,
      geography: row.statedGeography,
    })),
  },
  {
    what: "Ptarmigan",
    reason: "SOURCE NAMES NO SPECIES AT THE CATALOGUE'S GRANULARITY",
    detail:
      "s. 51(2) gives ptarmigan a season from 1 November to 31 March in the following year in the North Game Bird " +
      "District. The regulation's word is “ptarmigan” and North Ground's catalogue carries willow ptarmigan and rock " +
      "ptarmigan as separate species, so encoding either narrows the source and encoding both turns one rule into two. " +
      "Recorded rather than guessed, the same treatment as New Brunswick's “squirrel” and “cormorant”.",
  },
  {
    what: "Barren-ground caribou",
    reason: "SEASON PROVISION REPEALED, AND A SEPARATE REGIME EXISTS",
    detail:
      "s. 27(2), the only season-granting subsection in s. 27, was repealed by SR 46/2018 s. 16, so s. 27 now " +
      "establishes no open season at all and only its means prohibition survives. A flat CLOSED would still be wrong: " +
      "The Wildlife Regulations, 1981 Part IX.1 creates a subsistence-use barren-ground caribou licence, which is a " +
      "different regime North Ground has not certified. So caribou is left unanswered rather than declared closed.",
  },
  {
    what: "Waterfowl — ducks, coots, snipe, sandhill cranes, dark geese, white geese (Part X)",
    reason: "COMPOSES WITH THE FEDERAL MIGRATORY BIRDS REGULATIONS",
    detail:
      "ss. 59 to 63 give real seasons, and s. 6 makes them subject to the Migratory Birds Regulations. " +
      "`migratoryComplete` is unmet, so these are out of scope until the federal layer lands rather than encoded " +
      "against a provincial reading alone.",
  },
  {
    what: "Fur animals and the trapping regime",
    reason: "SEPARATE INSTRUMENT",
    detail:
      "The Fur Animals Open Seasons Regulations (King's Printer product 32635) govern them. Trapping is a distinct " +
      "activity from hunting and a separate capability.",
  },
  {
    what: "Licence fees, for all 41 licence classes",
    reason: "NO FEE INSTRUMENT LOCATED",
    detail:
      "The Open Seasons Game Regulations name 41 licence classes and prescribe no fees, and no fee or licence-class " +
      "instrument was located in the King's Printer catalogue. §41A requires a fee to be certified as applicable AND " +
      "current in its own terms; neither can be established, so no figure is shown. This is the opposite of New " +
      "Brunswick, where both certifications hold.",
  },
  {
    what: "The upland game bird limits in ss. 52 to 58",
    reason: "NOT YET MODELLED AS CONDITIONS",
    detail:
      "Thirteen rows carry bag and possession limits and the raptor rule rather than seasons. s. 58(2) restricts " +
      "hunting upland game birds with raptors to 15 August in one year to 28 February in the following year, " +
      "notwithstanding any other provision — and that window is NOT a superset of every species season, because " +
      "ptarmigan runs to 31 March. An extraction claiming otherwise was caught in the permissive direction. The limits " +
      "are in the rows artefact and are the cheapest remaining win here.",
  },
  {
    what: "An AGE measure for `physical-criterion.ts`, and Saskatchewan's non-complementary elk classes",
    reason: "ANOTHER LANE'S CONTRACT",
    detail:
      "s. 2(h) states a bull elk as “a male elk having an antler at least 15 centimetres in length as measured on the " +
      "outside curve of the antler from the skull to the tip” — a STATED criterion the contract can hold. s. 2(i)'s " +
      "“a male moose that is at least one year old” is an AGE test the measure vocabulary cannot state. More " +
      "importantly, bull elk and antlerless elk are NOT complementary: a male elk over a year old with antlers under " +
      "15 cm is neither, so the BY_NEGATION convention Ontario and Québec use would be a misstatement here. Both are " +
      "stated as conditions on the rules meanwhile, and raised rather than resolved unilaterally.",
  },
];

/* ── Assemble ───────────────────────────────────────────────────────────── */

const windows = RULES.flatMap((rule) => rule.windows);
const from = [...windows.map((window) => window.opensIso)].sort()[0];
const to = [...windows.map((window) => window.closesIso)].sort().at(-1);

const bundle = {
  bundleId: "regulatory_bundle:ca-sk-2026",
  jurisdictionId: "jurisdiction:ca-sk",
  sourceVersion: SOURCE_VERSION,
  retrievedAt: RETRIEVED,
  licenceYear: null,
  whyThereIsNoLicenceYear: {
    finding:
      "Saskatchewan's licences run on the CALENDAR YEAR OF ISSUE, not a licence year and not a season. The Open " +
      "Seasons Game Regulations, 2009 s. 4: “Subject to sections 22, 27, 29.2, 51, 58 and 63, a licence authorizes " +
      "the person to whom the licence is issued to hunt only during the calendar year in which the licence is issued.”",
    negativeControl:
      "The provision names six exceptions by section number, which is what makes the calendar year the rule rather " +
      "than an approximation of one: the authority identified where its own basis does not hold.",
    whatTheAuthorityDefinesInstead: [
      "A calendar year of issue, for every licence (s. 4).",
      "Six named exceptions to it: ss. 22, 27, 29.2, 51, 58 and 63.",
      "Standing season dates, month and day with no year, which recur until a numbered Saskatchewan Regulation amends them.",
    ],
  },
  certifiedPeriod: {
    from, to,
    reason:
      `Saskatchewan's seasons are STANDING rules written as month and day, so this period is North Ground's declared ` +
      `derivation span for ${BASE_YEAR} rather than the authority's: from the earliest bound the derivation opens to ` +
      `the latest it closes, including the fourteen bounds the regulation itself qualifies as falling in the current, ` +
      `the following or each year. The rules continue; what is certified is the arithmetic for these dates.`,
  },
  absence: ABSENCE,
  sources: SOURCES,
  legalHours: {
    basis: "SUNRISE_SUNSET_OFFSET",
    /* POSITIVE opens BEFORE sunrise; `legalTimeFor` shifts by `-before`. */
    beforeSunriseMinutes: 30,
    afterSunsetMinutes: 30,
    statedAs: "No person shall hunt any wildlife during the period from one-half hour after sunset to one-half hour before sunrise.",
    section: "The Wildlife Regulations, 1981, s. 11(1)",
    statedAsAProhibition: true,
    howItWasDerived:
      "The regulation states the closed period, so the permitted window is its inverse: half an hour before sunrise " +
      "to half an hour after sunset. Verified by a positive control that the rule is NOT in the seasons regulation — " +
      "zero hits for sunrise or sunset terms there, against the same search matching in this instrument.",
    statutoryBasisIsCST:
      "The Open Seasons Game Regulations s. 3(b) fixes Central Standard Time as the basis for every time in them. " +
      "Saskatchewan does not observe daylight saving, so for most of the province CST IS the observed clock and the " +
      "conversion is the identity — but the basis is fixed regardless, and the Lloydminster area observes Alberta " +
      "time. The basis is preserved and never collapsed into the civil clock (§41A).",
    oneSpeciesException:
      "s. 11(3) excepts a licensed trapper taking fur animals by trap during an open fur season. s. 11.1(5) " +
      "separately bars discharging a firearm for hunting from a highway, road, road allowance, right of way or ditch " +
      "during the same night period.",
  },
  units: SASKATCHEWAN_ZONES.map((zone) => ({ identifier: zone, zoneId: `management_zone:ca-sk-wmz-${zone.toLowerCase()}` })),
  officialUnitCount: SASKATCHEWAN_ZONES.length,
  groups,
  rules: RULES,
  methodEnvelopesAreReadNotInferred: {
    finding:
      "Every big-game season's permitted means come from its own first subsection, not from the section's title, and " +
      "the envelopes NEST: archery is a bow only, the crossbow season permits a bow or a crossbow, the muzzleloader " +
      "season permits a bow, a crossbow or a muzzle-loader. Keying the section titled “muzzle-loading firearm open " +
      "seasons” as MUZZLELOADER alone tells a bow hunter CLOSED when the season is open to them.",
    where: "src/lib/hunt/regulatory/saskatchewan-methods.ts, all 40 envelopes with the authority's own wording.",
    theFortiethWasHiddenByATypo:
      "s. 35(1) omits the word “than” — “by any means other a bow and arrow, crossbow, muzzle-loading firearm or " +
      "shotgun” — so a search for “other than” returns 39 envelopes where the instrument has 40. The missing one " +
      "is a whole shotgun season, 1 November to 7 December in the Regina/Moose Jaw and Saskatoon zones.",
    birdSeasonsCarryNone:
      "ss. 46 to 51 name no permitted means at all, so a bird rule states no method restriction rather than a guessed " +
      "set. The one exception is s. 58's raptor window.",
  },
  theSuffixRule: {
    citation: "The Open Seasons Game Regulations, 2009, s. 3(c)",
    statedAs: "unless otherwise indicated, references to Wildlife Management Zones by number include zones that contain the descriptor “East”, “West”, “North” or “South” in the zone title",
    whyItMatters:
      "A literal numeric match would drop 2E, 2W, 7E, 7W, 14E, 14W, 42E, 42W, 45E, 45W, 68N and 68S from every season " +
      "naming their number — twelve of the province's 83 zones, reported CLOSED. The regulation uses BOTH styles: the " +
      "antlered deer sections write bare ranges (“Zones 1 to 16 and 18 to 29”) while the antlerless ones enumerate " +
      "the suffixed zones explicitly, so a builder must handle each.",
  },
  theSecondGeography: {
    finding:
      "Bird seasons are written in Game Bird Districts, which compose from six Game Bird Management Units, each " +
      "defined as a list of zones PLUS parks, recreation sites and national wildlife areas. The zone lists alone are " +
      "disjoint and all but complete — 82 of 83 designations in exactly one unit — so a point that resolves to a " +
      "zone resolves to a district without any park geometry.",
    thePrinceAlbertZone:
      "The regulation names it in no unit, while naming it twelve times in the big-game Parts, so no bird rule in this " +
      "bundle reaches it — and the silence is DELIBERATE. The ministry's 2026-27 Hunters Guide states three separate " +
      "times, in its upland, migratory and goose sections, that “The Prince Albert WMZ is closed to all game bird " +
      "hunting.” So a bird question there is CLOSED on Act s. 25(1) rather than UNRESOLVED. An earlier reading here " +
      "said UNRESOLVED, which was an unnecessary refusal — the direction §8 warns nobody ever reports.",
    andThatIsWhyTheGuideWasRead:
      "The regulation alone cannot distinguish a deliberate exclusion from a drafting omission, and the two have " +
      "opposite answers. The authority's own summary settled it.",
    where: "src/lib/hunt/regulatory/saskatchewan-geography.ts",
  },
  guideDivergence: {
    whatWasCompared:
      "Every date in this bundle was read from the regulation and then checked against the ministry's 2026-27 Hunters " +
      "Guide, which restates them. The guide disclaims itself: “The guide is not a legal document.”",
    hunterClothing: [
      { where: "framing", guide: "orange is triggered by hunting big game WITH A RIFLE, or accompanying a rifle hunter", regulation: "s. 21(1) imposes it on every method, with s. 21(2) lifting it where an archery, muzzle-loading, crossbow or shotgun season exists", resolution: "The regulation controls. Encoding the guide's framing would invert the default and lose s. 21(3)'s concurrent-season case." },
      { where: "CSA class", guide: "both Class 2 vests and Class 3 coveralls are lawful", regulation: "s. 21(1)(a)(ii) names only CAN/CSA Z96 Class 2", resolution: "The regulation controls. The guide is MORE permissive than the text it summarises, and a looser reading must never widen a legal permission." },
      { where: "patch size", guide: "a crest “not exceeding” 100 cm² (15 in²)", regulation: "s. 21(1.1) says it must cover “less than” 100 cm² (15.5 in²)", resolution: "A different test and a different imperial conversion. The regulation controls." },
    ],
    reportedAsDivergenceNotConflict:
      "The only text available is a consolidation that marks itself unofficial, so which prevails would need the " +
      "official instrument or the Gazette. s. 21 is encoded and the divergence is recorded.",
  },
  deliberatelyNotEncoded: NOT_ENCODED,
  whyTheZoneListIsUnderGhas:
    "`ghas` is the engine's generic list of area designations, and `areaOf` resolves a point's zone id to an " +
    "identifier through `units` before matching it there. Saskatchewan's identifiers are the ministry's own forms — " +
    "“1”, “2E”, “68N”, “SWMZ” — which is what `designationOf` on the live layer produces.",
};

for (const rule of RULES) {
  for (const window of rule.windows) {
    if (window.closesIso < window.opensIso) throw new Error(`${rule.id} emits ${window.opensIso}..${window.closesIso}`);
    if (window.opensIso < bundle.certifiedPeriod.from || window.closesIso > bundle.certifiedPeriod.to) {
      throw new Error(`${rule.id} has a window outside the certified period`);
    }
  }
}

writeFileSync(OUT, `${JSON.stringify(bundle, null, 1)}\n`);

const bySpecies = {};
for (const rule of RULES) bySpecies[rule.speciesId] = (bySpecies[rule.speciesId] ?? 0) + 1;
console.log(`${OUT}: ${RULES.length} rules, ${groups.length} groups, ${bundle.units.length} units, ${SOURCES.length} sources`);
console.log(`  encoded ${encodable.length} rows | parks-only ${parksOnly.length} | species not canonical ${skipped.length}`);
console.log(`  certified period ${from} .. ${to}`);
console.log(bySpecies);
