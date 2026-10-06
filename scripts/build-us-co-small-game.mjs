/**
 * Build Colorado's certified small game and furbearer bundle from 2 CCR 406-3,
 * Chapter W-3 — "Furbearers and Small Game, Except Migratory Birds" — the
 * 07/16/2026 edition, effective 1 September 2026.
 *
 * WHAT IS READ, AND WHY THESE THREE.
 *
 *  - CHAPTER W-3 sets every season, unit list, bag and possession limit, legal
 *    method and licence requirement encoded here. It is Colorado's regulation,
 *    not a brochure about it, and CPW's Rules and Regulations page links this
 *    exact file today. Every season below is matched against its printed
 *    wording and the build stops if the wording moves.
 *  - CHAPTER W-0 (General Provisions, 05/06/2026, effective 1 July 2026)
 *    supplies three standing rules that reach these species — dogs during big
 *    game seasons, organized dog pursuit events, and the centerfire limit west
 *    of I-25 during the regular deer and elk seasons — and the unit descriptions
 *    `scripts/derive-us-co-gmu-sides.mjs` places units with.
 *  - C.R.S. § 33-6-109(1), read from the Office of Legislative Legal Services'
 *    2026 publication of Title 33, is what makes silence CLOSED: hunting any
 *    wildlife is unlawful "except as permitted by articles 1 to 6 of this title
 *    or by rule or regulation of the commission". A species or a unit Chapter
 *    W-3 opens no season for has nothing permitting it.
 *
 * FOUR THINGS ABOUT COLORADO THAT ARE NOT MONTANA:
 *
 *  1. SEASONS ARE WRITTEN IN HIGHWAYS AS OFTEN AS IN UNITS. Dusky grouse is
 *     open "West of U.S. Interstate 25"; pheasant closes on different days on
 *     either side of it; quail adds I-70, US 36 and five counties; prairie-
 *     chicken adds Morgan County and Colo 71. Every such line is turned into
 *     units by the derivation, and a unit it cannot place wholly stays a
 *     special geography the engine treats as UNRESOLVED — never assigned.
 *  2. METHOD DECIDES LEGALITY. #303 lists the legal methods per class of
 *     animal and declares "Any method of take not listed herein shall be
 *     prohibited". A rifle is legal for dusky grouse and not for pheasant; a
 *     slingshot for a cottontail and not for a coyote; hawking for every game
 *     bird and mammal and for no furbearer. So every rule carries its permitted
 *     implements, and the falconry seasons are rules of their own.
 *  3. THE GENERAL PHEASANT SEASON IS A COCK SEASON; THE FALCONRY ONE IS NOT.
 *     #319(B) limits the regular season to three cocks a day and #319(C) gives
 *     falconers three birds. That difference is a legal animal class.
 *  4. PRAIRIE DOGS TURN ON LAND. #309: "Public Land: June 15 - end of February
 *     annually" and "Private Land: January 1 - December 31 annually". Chapter
 *     W-3 does not define public land, so the hunter states which they are on.
 *
 * Run: node scripts/build-us-co-small-game.mjs [--check]
 */

import { readFileSync } from "node:fs";
import {
  expectOne, fetchBytes, fetchPdf, flatten, jurisdictionToday, readPreviousBundle,
  recordSourcesFromArgs, retrievedAtFor, sha256, writeOrCheck,
} from "./us-source.mjs";

const BUNDLE = "content/regulatory/us-co-small-game-2026.json";
const CERTIFIED = "content/regulatory/us-co-certified-units.json";
const SIDES = "research/hunting/us-co-gmu-sides.json";
const QUAIL_LINE_FILE = "research/hunting/us-co-quail-line.json";
const TIME_ZONE = "America/Denver";

const W3_PAGE = "https://cpw.widen.net/s/kmpdszcx6j/ch03";
const W0_PAGE = "https://cpw.widen.net/s/zvhkgggcgh/chapter-w-0---general-provisions";
const REGULATIONS_PAGE = "https://cpw.state.co.us/rules-and-regulations";
const CRS_URL = "https://olls.info/crs/crs2026-title-33.htm";
const GMU_SERVICE = "https://services5.arcgis.com/ttNGmDvKQA7oeDQ3/arcgis/rest/services/CPWAdminData/FeatureServer/6";

const W3 = "source:us-co-ccr-406-3-chapter-w-3";
const W0 = "source:us-co-ccr-406-0-chapter-w-0";
const CRS = "source:us-co-crs-title-33";
const GMU = "source:us-co-gmu-service";

const W3_VERSION = "2 CCR 406-3, Chapter W-3 — Furbearers and Small Game, Except Migratory Birds (07/16/2026; effective September 1, 2026)";
const W0_VERSION = "2 CCR 406-0, Chapter W-0 — General Provisions (05/06/2026; effective July 1, 2026)";
const CRS_VERSION = "Colorado Revised Statutes 2026, Title 33 (Office of Legislative Legal Services)";

const PERIOD = { from: "2026-09-01", to: "2027-08-31" };

/* ── Units ──────────────────────────────────────────────────────────────── */

const SIDES_FILE = JSON.parse(readFileSync(SIDES, "utf8"));
const ALL = Object.keys(SIDES_FILE.i25).sort((a, b) => Number(a) - Number(b));
if (ALL.length !== 186) throw new Error(`expected 186 units in ${SIDES}, found ${ALL.length}`);
const zoneId = (unit) => `management_zone:us-co-gmu-${unit}`;
const without = (units, removed) => units.filter((unit) => !removed.includes(unit));
const WEST_OF_I25 = ALL.filter((unit) => SIDES_FILE.i25[unit].side === "WEST");
const EAST_OF_I25 = ALL.filter((unit) => SIDES_FILE.i25[unit].side === "EAST");
if (WEST_OF_I25.length + EAST_OF_I25.length !== ALL.length) throw new Error("a unit is not placed against I-25");

/** #314(A)(1)–(2): ptarmigan's later-closing units. */
const PTARMIGAN_LATE = ["44", "45", "53", "54", "66", "67", "68", "70", "71", "74", "75", "76", "77", "78", "79", "80", "81", "444", "751"];
/** #315(A)(1): greater sage-grouse except North Park; 18 and 28 lose a portion each. */
const SAGE_GROUSE = ["2", "3", "4", "5", "10", "11", "13", "18", "27", "28", "37", "181", "201", "211", "301", "441"];
/** #315(B)(1): North Park. */
const SAGE_GROUSE_NORTH_PARK = ["6", "16", "17", "161", "171"];
/** #317(A)(1): "Closed statewide except". */
const SHARPTAIL = ["4", "5", "12", "13", "14", "23", "131", "211", "214", "441"];
/** #321(A)(1): the units named outright. */
const PRAIRIE_CHICKEN_NAMED = ["93", "97", "98", "100", "101", "102", "103", "109"];
/** W-0 #024: units whose descriptions name Morgan County. */
const MORGAN = ["95", "96", "97", "99", "100", "951"];
/** W-0 #024: "That portion of Jackson Co …" — the units the Arapaho National Wildlife Refuge can lie in. */
const JACKSON = ["6", "16", "17", "161", "171"];

/*
 * GREATER PRAIRIE-CHICKEN: "Units 93, 97, 98, 100, 101, 102, 103, 109, all of
 * Morgan County, and those portions east of Colorado State Highway 71 and south
 * of Colorado State Highway 14 and U.S. Highway 138."
 *
 * Open: the named units, and the units the derivation places wholly east of
 * Colo 71 — 89 excepted, which W-0 bounds "on the south by Colo 14", so it is
 * north of it.
 * Closed: every unit wholly west of Colo 71 that names no Morgan County, and
 * 89 and 90, which lie north of Colo 14 and US 138 by their own descriptions.
 * Everything else — Morgan County units, units reaching south of where Colo 71
 * bounds units, units the line passes through — is an UNRESOLVED portion.
 */
const NORTH_OF_SH14_US138 = ["87", "88", "89", "90"];
const GPC_OPEN = [...new Set([
  ...PRAIRIE_CHICKEN_NAMED,
  ...EAST_OF_I25.filter((unit) => SIDES_FILE.sh71[unit].side === "EAST" && !NORTH_OF_SH14_US138.includes(unit)),
])].sort((a, b) => Number(a) - Number(b));
const GPC_CLOSED = ALL.filter((unit) => !GPC_OPEN.includes(unit) && !MORGAN.includes(unit) &&
  (SIDES_FILE.sh71[unit].side === "WEST" || NORTH_OF_SH14_US138.includes(unit)));
const GPC_PORTION = ALL.filter((unit) => !GPC_OPEN.includes(unit) && !GPC_CLOSED.includes(unit));

/*
 * QUAIL (#320). Area 1 closes 31 January; areas 2 and 3 on 3 January.
 *   1. East of I-25 and south of I-70 (I-25 to Byers) / US 36 (Byers to Kansas),
 *      plus the parts of Pueblo, Fremont, Huerfano, El Paso and Las Animas
 *      counties west of I-25.
 *   2. East of I-25 and north of that line.
 *   3. West of I-25, except those five counties.
 * East of I-25, W-0 bounds every unit north of the line by roads that lie north
 * of it (Colo 14, Colo 7, I-76, US 34, US 6, US 36 east of Byers), and every
 * unit south of it by I-70 or US 36 east of Byers.
 *
 * THREE EAST UNITS STRADDLE, AND THE NAME OF A ROAD DOES NOT SETTLE TWO OF THEM.
 * W-0 bounds 99 on the south and 105 on the north by "US 36" between Colo 79
 * (Bennett) and Byers, where #320 draws the line along I-70. Read as one road,
 * both units would sit wholly on one side. They are not one road there: CDOT's
 * own route network carries US 36 east of Watkins as its own routes (036C,
 * 036D), and CPW's own polygons put the 99/105 edge on them, up to 0.99 km
 * NORTH of I-70 west of Strasburg and up to 0.66 km SOUTH of it in the last few
 * kilometres before the Byers interchange. So 105 holds ground north of I-70
 * west of Byers on every reading; 99 holds ground south of I-70 unless "Byers",
 * where the line passes to US 36, is placed at US 36's crossing of I-70 six
 * kilometres west of the interchange — which #320 does not say. Unit 104 holds
 * Denver, which I-70 crosses outright. All three stay unresolved.
 * (`scripts/derive-us-co-quail-line.mjs`, research/hunting/us-co-quail-line.json.)
 *
 * West of I-25, a unit whose description names only those five counties is
 * area 1, one naming none is area 3, and one naming some is an unresolved
 * portion — except 83. Its description lists "Alamosa, Costilla and Huerfano
 * counties" and then bounds it on the north by US 160 and the Alamosa-Costilla
 * line and on the east by the Costilla-Huerfano line, which leaves no Huerfano
 * ground inside it; CPW's polygon sampled against the Census counties finds
 * none (95% Costilla, 5% Alamosa). Its bounds decide it: area 3.
 */
const QUAIL_EAST_NORTH = ["87", "88", "89", "90", "91", "92", "93", "94", "95", "96", "97", "98", "100", "101", "102", "951"];
const QUAIL_EAST_STRADDLE = ["99", "104", "105"];
const QUAIL_EAST_SOUTH = without(EAST_OF_I25, [...QUAIL_EAST_NORTH, ...QUAIL_EAST_STRADDLE]);
/** W-0 #024 county lists: every county named is one of the five. */
const QUAIL_WEST_FIVE_COUNTIES = ["85", "512", "591", "861"];
/** W-0 #024 county lists: some, not all, of the counties named are among the five (83 excepted, above). */
const QUAIL_WEST_STRADDLE = ["57", "58", "59", "69", "84", "86", "511", "581", "691", "851"];
const QUAIL_WEST_REST = without(WEST_OF_I25, [...QUAIL_WEST_FIVE_COUNTIES, ...QUAIL_WEST_STRADDLE]);

/* The measured control. The lists above are the descriptions' reading; the
   derivation must agree with every one of them, or the build stops. */
const QUAIL_LINE = JSON.parse(readFileSync(QUAIL_LINE_FILE, "utf8"));
for (const [unit, measured] of Object.entries(QUAIL_LINE.east)) {
  /* "Crosses" on the interchange reading; 99 crosses on that reading only, which is why it is not placed. */
  const crosses = measured.westOfByersInterchange.crosses;
  if (crosses !== QUAIL_EAST_STRADDLE.includes(unit)) throw new Error(`quail: unit ${unit} ${crosses ? "crosses" : "does not cross"} I-70 west of Byers`);
}
for (const [unit, measured] of Object.entries(QUAIL_LINE.west)) {
  const share = measured.percentInFiveCounties;
  const expected = QUAIL_WEST_FIVE_COUNTIES.includes(unit) ? "ALL" : QUAIL_WEST_STRADDLE.includes(unit) ? "SOME" : "NONE";
  const found = share >= 99.5 ? "ALL" : share <= 0.5 ? "NONE" : "SOME";
  if (found !== expected) throw new Error(`quail: unit ${unit} is ${share}% in the five counties, but is listed as ${expected}`);
}
for (const unit of [...QUAIL_EAST_NORTH, ...QUAIL_EAST_STRADDLE]) {
  if (!EAST_OF_I25.includes(unit)) throw new Error(`quail: unit ${unit} is not east of I-25`);
}
for (const unit of [...QUAIL_WEST_FIVE_COUNTIES, ...QUAIL_WEST_STRADDLE]) {
  if (!WEST_OF_I25.includes(unit)) throw new Error(`quail: unit ${unit} is not west of I-25`);
}

/* ── Special geographies: what a unit list cannot say ───────────────────── */

const SAGE_18_PORTION = "us-co-sage-grouse-unit-18-east-of-colo-125";
const SAGE_28_PORTION = "us-co-sage-grouse-unit-28-north-east-of-church-park-rd";
const QUAIL_AREA_1_PORTION = "us-co-quail-area-1-portion";
const GPC_PORTION_ID = "us-co-prairie-chicken-morgan-and-east-of-colo-71";

const SPECIAL_GEOGRAPHIES = [
  {
    id: SAGE_18_PORTION, name: "The portion of unit 18 east of Colo 125 in Grand County", resolution: "UNRESOLVED",
    statedAs: "18 except that portion of unit 18 east of Colo 125 in Grand County", candidateAreas: ["18"],
    reason: "Chapter W-3 excepts it from the sage-grouse season by a highway, and North Ground holds no geometry for that line.",
  },
  {
    id: SAGE_28_PORTION, name: "The portion of unit 28 north and east of Grand County Road 50 and US 40", resolution: "UNRESOLVED",
    statedAs: "28 except that portion of GMU 28 north and east of Grand Co Rd 50 (Church Park Rd) and US 40", candidateAreas: ["28"],
    reason: "Chapter W-3 excepts it from the sage-grouse season by roads, and North Ground holds no geometry for them.",
  },
  {
    id: QUAIL_AREA_1_PORTION, name: "The part of this unit in quail area 1", resolution: "UNRESOLVED",
    statedAs:
      "East of U.S. Interstate 25 and south of Interstate 70 from I-25 to Byers and U.S. Highway 36 from Byers to the Kansas line, " +
      "and those portions of Pueblo, Fremont, Huerfano, El Paso and Las Animas counties lying west of I-25",
    candidateAreas: [...QUAIL_EAST_STRADDLE, ...QUAIL_WEST_STRADDLE].sort((a, b) => Number(a) - Number(b)),
    reason: "The line between quail areas crosses this unit along a highway or a county line North Ground holds no geometry for.",
  },
  {
    id: GPC_PORTION_ID, name: "Morgan County, and the area east of Colo 71 and south of Colo 14 and US 138", resolution: "UNRESOLVED",
    statedAs: "all of Morgan County, and those portions east of Colorado State Highway 71 and south of Colorado State Highway 14 and U.S. Highway 138",
    candidateAreas: GPC_PORTION,
    reason: "This unit is partly in Morgan County, or reaches ground where Colo 71 is not a unit boundary, so which part of it the season covers cannot be placed.",
  },
];

/* ── Methods (#303) ─────────────────────────────────────────────────────── */

const GAME_MAMMAL = ["RIFLE", "HANDGUN", "SHOTGUN", "BOW", "CROSSBOW", "AIR_GUN", "SLINGSHOT", "FALCONRY"];
/** #303(C): rifles, handguns, air guns and slingshots for dusky grouse and ptarmigan only. */
const GROUSE_AND_PTARMIGAN = GAME_MAMMAL;
const OTHER_GAME_BIRD = ["SHOTGUN", "BOW", "CROSSBOW", "FALCONRY"];
/** #303(E)(1)–(4): no slingshot and no hawking for furbearers. */
const FURBEARER = ["RIFLE", "HANDGUN", "SHOTGUN", "BOW", "CROSSBOW", "AIR_GUN"];
const FALCONRY = ["FALCONRY"];

/* ── Dates ──────────────────────────────────────────────────────────────── */

const pad = (n) => String(n).padStart(2, "0");
const lastOfFebruary = (year) => (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28);

/**
 * A season Chapter W-3 states "annually", as the windows that touch the
 * certified period. `close: "END_FEB"` is the regulation's "end of February".
 */
function annually([openMonth, openDay], close, statedAs) {
  const windows = [];
  for (const year of [2025, 2026, 2027]) {
    const [closeMonth, closeDay] = close === "END_FEB" ? [2, null] : close;
    const closeYear = closeMonth < openMonth || (closeMonth === openMonth && (closeDay ?? 0) < openDay) ? year + 1 : year;
    const opensIso = `${year}-${pad(openMonth)}-${pad(openDay)}`;
    const closesIso = `${closeYear}-${pad(closeMonth)}-${pad(closeDay ?? lastOfFebruary(closeYear))}`;
    if (closesIso < PERIOD.from || opensIso > PERIOD.to) continue;
    windows.push({ opensIso, closesIso, statedAs });
  }
  return windows;
}

const once = (opensIso, closesIso, statedAs) => [{ opensIso, closesIso, statedAs }];

/* ── Reading the sources ────────────────────────────────────────────────── */

/** The PDF CPW's share page serves today, found from the page rather than remembered. */
async function w3PdfUrl() {
  const html = (await fetchBytes(W3_PAGE)).toString("utf8");
  const match = /\/content\/([a-z0-9]+)\/original\/Ch03\.pdf\?u=([a-z0-9]+)/.exec(html);
  if (!match) throw new Error(`${W3_PAGE} no longer links Ch03.pdf`);
  return `https://cpw.widen.net/content/${match[1]}/original/Ch03.pdf?u=${match[2]}&download=true`;
}

/** One continuous text: page headers (the page number) dropped, layout whitespace collapsed. */
const joined = (pages) => flatten(pages.map((page) => page.replace(/^\s*\d+\s+/, "")).join(" "));

/** The printed wording, or the build stops. Whitespace in the source may vary; nothing else may. */
function printed(text, literal, what) {
  const pattern = new RegExp(literal.trim().split(/\s+/).map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*"));
  expectOne(text, pattern, what);
  return literal;
}

/** Wording the source repeats (an effective-date clause in each Basis and Purpose). Present, at least once. */
function stated(text, literal, what) {
  const pattern = new RegExp(literal.trim().split(/\s+/).map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*"));
  if (!pattern.test(text)) throw new Error(`${what}: the published wording was not found. The source may have changed.`);
}

/* ── Rules ──────────────────────────────────────────────────────────────── */

const SOURCE_VERSION = W3_VERSION;
const groups = new Map();

function group(id, officialSpec, units, partialUnits = []) {
  const full = `regulatory_group:us-co-small-game-2026-${id}`;
  const existing = groups.get(full);
  if (existing && JSON.stringify(existing.officialIdentifiers) !== JSON.stringify(units)) throw new Error(`group ${id} redefined`);
  groups.set(full, {
    id: full, officialSpec, zoneIds: units.map(zoneId), officialIdentifiers: units,
    ...(partialUnits.length ? { partialZoneIds: partialUnits.map(zoneId) } : {}),
  });
  return full;
}

const STATEWIDE = () => group("statewide", "Statewide — every Game Management Unit", ALL);

function rule({
  id, speciesId, groupId, statedAs, units, specialInclude = [], specialExclude = [], appliesWhen = {}, seasonLabel,
  seasonPhrase, windows, limits, conditionIds, section, animalClasses, legalAnimalClassIds, notes = [], implementLabel,
}) {
  return {
    id: `regulatory_rule:us-co-small-game-2026-${id}`,
    speciesId,
    regulatoryGroupId: groupId,
    geography: {
      statedAs,
      include: { ghas: units, gbhz: [], special: specialInclude },
      exclude: { ghas: [], special: specialExclude },
    },
    appliesWhen,
    seasonLabel,
    seasonPhrase,
    ...(implementLabel ? { implementLabel } : {}),
    ...(animalClasses ? { animalClasses, legalAnimalClassIds } : {}),
    windows,
    declaredNoSeason: false,
    /* A limit cites its own provision — "B. Daily Bag and Possession Limits" — not the season's. Two seasons sharing
       one limit must carry identical limits, or the engine reads them as different answers. */
    ...(limits ? { limits: { ...limits, section: limits.section ?? `${/^#\d+/.exec(section)[0]}(B)` } } : {}),
    conditionIds,
    caveats: [],
    notes,
    disputes: [],
    sourceId: W3,
    sourceSection: section,
    sourceVersion: SOURCE_VERSION,
    reviewStatus: "VERIFIED",
    authority: { level: "STATE_REGULATION", instrument: W3_VERSION },
  };
}

const SMALL_GAME_LICENCE = ["us-co-small-game-licence", "us-co-hip-registration"];
const FURBEARER_LICENCE = ["us-co-furbearer-licence"];
const WEST_CENTERFIRE = "us-co-centerfire-west-of-i25";
const ARAPAHO = "us-co-arapaho-nwr-nontoxic-shot";
const FALCONRY_NOTE = "us-co-falconry-chapter-w-6";
const GAME_MAMMAL_CONDITIONS = [...SMALL_GAME_LICENCE, "us-co-game-mammal-shotgun", WEST_CENTERFIRE, ARAPAHO];
const GAME_BIRD_CONDITIONS = [...SMALL_GAME_LICENCE, "us-co-game-bird-shotgun", WEST_CENTERFIRE, ARAPAHO];
const OTHER_SMALL_GAME_CONDITIONS = [...SMALL_GAME_LICENCE, WEST_CENTERFIRE, ARAPAHO];
const FURBEARER_CONDITIONS = [...FURBEARER_LICENCE, WEST_CENTERFIRE];

function buildRules(w3) {
  const rules = [];
  const add = (entry) => rules.push(rule(entry));

  /* #306 — rabbits and hares. */
  const s306 = "#306(A)(1)";
  printed(w3, "#306 – Cottontail Rabbit, Snowshoe Hare, White-tailed & Black-tailed jackrabbit A. Season Dates and Units 1. Statewide: October 1 - end of February annually. 2. Extended Falconry and Dog Pursuit Season - Statewide: September 1 - March 31 annually.", "#306 seasons");
  printed(w3, "B. Daily Bag and Possession Limits 1. Daily Bag Limit - Ten (10) cottontail rabbits, ten (10) snowshoe hares, ten (10) jackrabbits. 2. Possession Limit: Twenty (20) cottontail rabbits, twenty (20) snowshoe hares, and twenty (20) jackrabbits.", "#306 limits");
  const leporids = [
    ["desert-cottontail", { daily: 10, possession: 20, combined: true, combinedWithNames: ["cottontail rabbits"], statedAs: "Ten (10) cottontail rabbits daily; twenty (20) in possession" }],
    ["eastern-cottontail", { daily: 10, possession: 20, combined: true, combinedWithNames: ["cottontail rabbits"], statedAs: "Ten (10) cottontail rabbits daily; twenty (20) in possession" }],
    ["mountain-cottontail", { daily: 10, possession: 20, combined: true, combinedWithNames: ["cottontail rabbits"], statedAs: "Ten (10) cottontail rabbits daily; twenty (20) in possession" }],
    ["snowshoe-hare", { daily: 10, possession: 20, combined: false, statedAs: "Ten (10) snowshoe hares daily; twenty (20) in possession" }],
    ["white-tailed-jackrabbit", { daily: 10, possession: 20, combined: true, combinedWithNames: ["jackrabbits"], statedAs: "Ten (10) jackrabbits daily; twenty (20) in possession" }],
    ["black-tailed-jackrabbit", { daily: 10, possession: 20, combined: true, combinedWithNames: ["jackrabbits"], statedAs: "Ten (10) jackrabbits daily; twenty (20) in possession" }],
  ];
  for (const [slug, limits] of leporids) {
    const speciesId = `species:${slug}`;
    const cottontail = slug.endsWith("cottontail");
    const notes = cottontail
      ? ["Chapter W-3 sets one season and one limit for “cottontail rabbit”, naming no species; Colorado's three cottontails are all within it, and the limit is shared among them."]
      : [];
    add({
      id: `${slug}-statewide`, speciesId, groupId: STATEWIDE(), statedAs: "Statewide", units: ALL,
      appliesWhen: { permittedImplements: GAME_MAMMAL }, seasonLabel: "Small game season",
      seasonPhrase: "Statewide: October 1 - end of February annually", windows: annually([10, 1], "END_FEB", "October 1 - end of February annually"),
      limits, conditionIds: [...GAME_MAMMAL_CONDITIONS, "us-co-dogs-during-big-game"], section: s306, notes,
    });
    add({
      id: `${slug}-falconry`, speciesId, groupId: STATEWIDE(), statedAs: "Statewide", units: ALL,
      appliesWhen: { permittedImplements: FALCONRY }, seasonLabel: "Extended falconry season", implementLabel: "Extended Falconry and Dog Pursuit Season",
      seasonPhrase: "Extended Falconry and Dog Pursuit Season - Statewide: September 1 - March 31 annually",
      windows: annually([9, 1], [3, 31], "September 1 - March 31 annually"),
      limits, conditionIds: [...SMALL_GAME_LICENCE, FALCONRY_NOTE], section: "#306(A)(2)", notes,
    });
    add({
      id: `${slug}-dog-pursuit-event`, speciesId, groupId: STATEWIDE(), statedAs: "Statewide", units: ALL,
      appliesWhen: { SEASON_TYPE: "DOG_PURSUIT_EVENT" }, seasonLabel: "Extended dog pursuit season (organized events)", implementLabel: "Extended Falconry and Dog Pursuit Season",
      seasonPhrase: "Extended Falconry and Dog Pursuit Season - Statewide: September 1 - March 31 annually",
      windows: annually([9, 1], [3, 31], "September 1 - March 31 annually"),
      limits, conditionIds: [...SMALL_GAME_LICENCE, "us-co-dog-pursuit-event"], section: "#306(A)(2); Chapter W-0 #004(A)(2)(a)(3)–(4)",
      notes: [
        ...notes,
        "Neither Chapter W-3 nor Chapter W-0 states by what method a rabbit or hare may be taken at an organized dog pursuit event, so no method is stated here.",
      ],
    });
  }

  /* #307 — Abert's squirrel. */
  printed(w3, "#307 – Abert's Squirrels A. Season Dates and Units 1. Statewide: November 15 - January 15 annually. B. Daily Bag and Possession Limits 1. Daily Bag Limit - Two (2) squirrels. 2. Possession Limit - Four (4) squirrels.", "#307");
  add({
    id: "aberts-squirrel-statewide", speciesId: "species:aberts-squirrel", groupId: STATEWIDE(), statedAs: "Statewide", units: ALL,
    appliesWhen: { permittedImplements: GAME_MAMMAL }, seasonLabel: "Small game season",
    seasonPhrase: "Statewide: November 15 - January 15 annually", windows: annually([11, 15], [1, 15], "November 15 - January 15 annually"),
    limits: { daily: 2, possession: 4, combined: false, statedAs: "Two (2) squirrels daily; four (4) in possession" },
    conditionIds: [...GAME_MAMMAL_CONDITIONS, "us-co-dogs-during-big-game"], section: "#307",
  });

  /* #308 — fox squirrel and pine squirrels. */
  printed(w3, "#308 – Fox Squirrel and Pine Squirrels A. Season Dates and Units 1. Statewide: October 1 - end of February annually. 2. Extended Falconry Season - Statewide: September 1 - March 31 annually. B. Daily Bag and Possession Limits 1. Daily Bag Limit - Five (5) fox squirrels and five (5) pine squirrels. 2. Possession Limit - Ten (10) fox squirrels and ten (10) pine squirrels.", "#308");
  for (const [slug, word] of [["fox-squirrel", "fox squirrels"], ["american-red-squirrel", "pine squirrels"]]) {
    const limits = { daily: 5, possession: 10, combined: false, statedAs: `Five (5) ${word} daily; ten (10) in possession` };
    const notes = slug === "american-red-squirrel" ? ["Chapter W-3 calls this species the pine squirrel."] : [];
    add({
      id: `${slug}-statewide`, speciesId: `species:${slug}`, groupId: STATEWIDE(), statedAs: "Statewide", units: ALL,
      appliesWhen: { permittedImplements: GAME_MAMMAL }, seasonLabel: "Small game season",
      seasonPhrase: "Statewide: October 1 - end of February annually", windows: annually([10, 1], "END_FEB", "October 1 - end of February annually"),
      limits, conditionIds: [...GAME_MAMMAL_CONDITIONS, "us-co-dogs-during-big-game"], section: "#308(A)(1)", notes,
    });
    add({
      id: `${slug}-falconry`, speciesId: `species:${slug}`, groupId: STATEWIDE(), statedAs: "Statewide", units: ALL,
      appliesWhen: { permittedImplements: FALCONRY }, seasonLabel: "Extended falconry season", implementLabel: "Extended Falconry Season",
      seasonPhrase: "Extended Falconry Season - Statewide: September 1 - March 31 annually", windows: annually([9, 1], [3, 31], "September 1 - March 31 annually"),
      limits, conditionIds: [...SMALL_GAME_LICENCE, FALCONRY_NOTE], section: "#308(A)(2)", notes,
    });
  }

  /* #309 — Wyoming ground squirrel and prairie dogs: "any method not otherwise prohibited" (#303(D)), no limit. */
  printed(w3, "1. Wyoming ground squirrel: a. Statewide: January 1 - December 31 annually. 2. Black-tailed, white-tailed and Gunnison prairie dogs: a. Public Land: June 15 - end of February annually. b. Private Land: January 1 - December 31 annually.", "#309 seasons");
  printed(w3, "B. Daily Bag and Possession Limits 1. There shall be no bag or possession limit.", "#309 limits");
  printed(w3, "D. Species listed in #300(D)(3). 1. Any method not otherwise prohibited.", "#303(D)");
  const noLimit = { statedAs: "There shall be no bag or possession limit." };
  const anyMethod = "Chapter W-3 #303(D) allows “any method not otherwise prohibited” for this species, so no list of methods is stated.";
  add({
    id: "wyoming-ground-squirrel-statewide", speciesId: "species:wyoming-ground-squirrel", groupId: STATEWIDE(), statedAs: "Statewide", units: ALL,
    seasonLabel: "Small game season", seasonPhrase: "Statewide: January 1 - December 31 annually",
    windows: annually([1, 1], [12, 31], "January 1 - December 31 annually"), limits: noLimit,
    conditionIds: OTHER_SMALL_GAME_CONDITIONS, section: "#309(A)(1)", notes: [anyMethod],
  });
  for (const slug of ["black-tailed-prairie-dog", "white-tailed-prairie-dog", "gunnisons-prairie-dog"]) {
    add({
      id: `${slug}-public-land`, speciesId: `species:${slug}`, groupId: STATEWIDE(), statedAs: "Statewide, on public land", units: ALL,
      appliesWhen: { LAND_TYPE: "PUBLIC_LAND" }, seasonLabel: "Public land season", seasonPhrase: "Public Land: June 15 - end of February annually",
      windows: annually([6, 15], "END_FEB", "June 15 - end of February annually"), limits: noLimit,
      conditionIds: OTHER_SMALL_GAME_CONDITIONS, section: "#309(A)(2)(a)", notes: [anyMethod],
    });
    add({
      id: `${slug}-private-land`, speciesId: `species:${slug}`, groupId: STATEWIDE(), statedAs: "Statewide, on private land", units: ALL,
      appliesWhen: { LAND_TYPE: "PRIVATE_LAND" }, seasonLabel: "Private land season", seasonPhrase: "Private Land: January 1 - December 31 annually",
      windows: annually([1, 1], [12, 31], "January 1 - December 31 annually"), limits: noLimit,
      conditionIds: OTHER_SMALL_GAME_CONDITIONS, section: "#309(A)(2)(b)", notes: [anyMethod],
    });
  }

  /* #310–#312 — snapping turtle, marmot, prairie rattlesnake. */
  printed(w3, "#310 – Common Snapping Turtle A. Season Dates and Units 1. Statewide: April 1 - October 31 annually. B. Daily Bag and Possession Limits 1. Daily Bag Limit - Three (3) turtles. 2. Possession Limit - Six (6) turtles.", "#310");
  add({
    id: "common-snapping-turtle-statewide", speciesId: "species:common-snapping-turtle", groupId: STATEWIDE(), statedAs: "Statewide", units: ALL,
    seasonLabel: "Small game season", seasonPhrase: "Statewide: April 1 - October 31 annually",
    windows: annually([4, 1], [10, 31], "April 1 - October 31 annually"),
    limits: { daily: 3, possession: 6, combined: false, statedAs: "Three (3) turtles daily; six (6) in possession" },
    conditionIds: ["us-co-snapping-turtle-licence", ARAPAHO], section: "#310", notes: [anyMethod],
  });
  printed(w3, "#311 – Marmot A. Season Dates and Units 1. Statewide: August 10 - October 15 annually. B. Daily Bag and Possession limits 1. Daily Bag Limit - Two (2) marmots. 2. Possession Limit - Four (4) marmots.", "#311");
  add({
    id: "yellow-bellied-marmot-statewide", speciesId: "species:yellow-bellied-marmot", groupId: STATEWIDE(), statedAs: "Statewide", units: ALL,
    appliesWhen: { permittedImplements: GAME_MAMMAL }, seasonLabel: "Small game season", seasonPhrase: "Statewide: August 10 - October 15 annually",
    windows: annually([8, 10], [10, 15], "August 10 - October 15 annually"),
    limits: { daily: 2, possession: 4, combined: false, statedAs: "Two (2) marmots daily; four (4) in possession" },
    conditionIds: GAME_MAMMAL_CONDITIONS, section: "#311",
  });
  printed(w3, "#312 – Prairie Rattlesnake A. Season Dates and Units 1. Statewide: June 15 - August 15 annually. B. Daily Bag and Possession Limits 1. Daily Bag Limit - Three (3) snakes. 2. Possession Limit - Six (6) snakes.", "#312");
  add({
    id: "prairie-rattlesnake-statewide", speciesId: "species:prairie-rattlesnake", groupId: STATEWIDE(), statedAs: "Statewide", units: ALL,
    seasonLabel: "Small game season", seasonPhrase: "Statewide: June 15 - August 15 annually",
    windows: annually([6, 15], [8, 15], "June 15 - August 15 annually"),
    limits: { daily: 3, possession: 6, combined: false, statedAs: "Three (3) snakes daily; six (6) in possession" },
    conditionIds: [...SMALL_GAME_LICENCE, ARAPAHO], section: "#312", notes: [anyMethod],
  });

  /* #313 — dusky grouse, west of I-25 only. */
  printed(w3, "#313 – Dusky (Blue) Grouse A. Season Dates and Units 1. West of U.S. Interstate 25. a. September 1 - November 22, 2026. b. Extended Falconry Season: September 1 - March 31 annually. B. Daily Bag and Possession Limits 1. Daily Bag Limit - Three (3) birds. 2. Possession Limit - Nine (9) birds.", "#313");
  const west = group("west-of-i25", "West of U.S. Interstate 25", WEST_OF_I25);
  const east = group("east-of-i25", "East of I-25", EAST_OF_I25);
  const dusky = { daily: 3, possession: 9, combined: false, statedAs: "Three (3) birds daily; nine (9) in possession" };
  add({
    id: "dusky-grouse-west-of-i25", speciesId: "species:dusky-grouse", groupId: west, statedAs: "West of U.S. Interstate 25", units: WEST_OF_I25,
    appliesWhen: { permittedImplements: GROUSE_AND_PTARMIGAN }, seasonLabel: "Grouse season", seasonPhrase: "September 1 - November 22, 2026",
    windows: once("2026-09-01", "2026-11-22", "September 1 - November 22, 2026"), limits: dusky, conditionIds: GAME_BIRD_CONDITIONS, section: "#313(A)(1)(a)",
  });
  add({
    id: "dusky-grouse-west-of-i25-falconry", speciesId: "species:dusky-grouse", groupId: west, statedAs: "West of U.S. Interstate 25", units: WEST_OF_I25,
    appliesWhen: { permittedImplements: FALCONRY }, seasonLabel: "Extended falconry season", implementLabel: "Extended Falconry Season",
    seasonPhrase: "Extended Falconry Season: September 1 - March 31 annually", windows: annually([9, 1], [3, 31], "September 1 - March 31 annually"),
    limits: dusky, conditionIds: [...SMALL_GAME_LICENCE, FALCONRY_NOTE], section: "#313(A)(1)(b)",
  });

  /* #314 — white-tailed ptarmigan. */
  printed(w3, "#314 – White-tailed Ptarmigan A. Season Dates and Units 1. Statewide except units 44, 45, 53, 54, 66, 67, 68, 70, 71, 74, 75, 76, 77, 78, 79, 80, 81, 444 and 751. a. September 12 - October 4, 2026. b. Extended Falconry Season: September 1 - March 31 annually. 2. Units 44, 45, 53, 54, 66, 67, 68, 70, 71, 74, 75, 76, 77, 78, 79, 80, 81, 444 and 751. a. September 12 - November 22, 2026. b. Extended Falconry Season: September 1 - March 31 annually. B. Daily Bag and Possession Limits 1. Daily Bag Limit - Three (3) birds. 2. Possession Limit - Six (6) birds.", "#314");
  const ptarmiganRest = without(ALL, PTARMIGAN_LATE);
  const ptarmigan = { daily: 3, possession: 6, combined: false, statedAs: "Three (3) birds daily; six (6) in possession" };
  const ptarmiganConditions = [...GAME_BIRD_CONDITIONS, "us-co-grouse-ptarmigan-permit"];
  const restGroup = group("ptarmigan-statewide-except", "Statewide except units 44, 45, 53, 54, 66, 67, 68, 70, 71, 74, 75, 76, 77, 78, 79, 80, 81, 444 and 751", ptarmiganRest);
  const lateGroup = group("ptarmigan-late-units", "Units 44, 45, 53, 54, 66, 67, 68, 70, 71, 74, 75, 76, 77, 78, 79, 80, 81, 444 and 751", PTARMIGAN_LATE);
  add({
    id: "white-tailed-ptarmigan-statewide-except", speciesId: "species:white-tailed-ptarmigan", groupId: restGroup,
    statedAs: "Statewide except units 44, 45, 53, 54, 66, 67, 68, 70, 71, 74, 75, 76, 77, 78, 79, 80, 81, 444 and 751", units: ptarmiganRest,
    appliesWhen: { permittedImplements: GROUSE_AND_PTARMIGAN }, seasonLabel: "Ptarmigan season", seasonPhrase: "September 12 - October 4, 2026",
    windows: once("2026-09-12", "2026-10-04", "September 12 - October 4, 2026"), limits: ptarmigan, conditionIds: ptarmiganConditions, section: "#314(A)(1)(a)",
  });
  add({
    id: "white-tailed-ptarmigan-late-units", speciesId: "species:white-tailed-ptarmigan", groupId: lateGroup,
    statedAs: "Units 44, 45, 53, 54, 66, 67, 68, 70, 71, 74, 75, 76, 77, 78, 79, 80, 81, 444 and 751", units: PTARMIGAN_LATE,
    appliesWhen: { permittedImplements: GROUSE_AND_PTARMIGAN }, seasonLabel: "Ptarmigan season", seasonPhrase: "September 12 - November 22, 2026",
    windows: once("2026-09-12", "2026-11-22", "September 12 - November 22, 2026"), limits: ptarmigan, conditionIds: ptarmiganConditions, section: "#314(A)(2)(a)",
  });
  add({
    id: "white-tailed-ptarmigan-falconry", speciesId: "species:white-tailed-ptarmigan", groupId: STATEWIDE(), statedAs: "Statewide", units: ALL,
    appliesWhen: { permittedImplements: FALCONRY }, seasonLabel: "Extended falconry season", implementLabel: "Extended Falconry Season",
    seasonPhrase: "Extended Falconry Season: September 1 - March 31 annually", windows: annually([9, 1], [3, 31], "September 1 - March 31 annually"),
    limits: ptarmigan, conditionIds: [...SMALL_GAME_LICENCE, "us-co-grouse-ptarmigan-permit", FALCONRY_NOTE], section: "#314(A)(1)(b), (A)(2)(b)",
  });

  /* #315 — greater sage-grouse. */
  printed(w3, "#315 – Greater Sage-grouse A. Season Dates, Units and Limits, Except North Park 1. Units 2, 3, 4, 5, 10, 11, 13, 18 except that portion of unit 18 east of Colo 125 in Grand County, 27, 28 except that portion of GMU 28 north and east of Grand Co Rd 50 (Church Park Rd) and US 40, 37, 181, 201, 211, 301 and 441. a. September 12 - September 18, 2026. b. Extended Falconry Season: September 1 - January 31 annually. 2. Daily Bag and Possession Limits a. Daily Bag Limit - Two (2) birds. b. Possession Limit - Four (4) birds.", "#315(A)");
  printed(w3, "B. Season Dates, Units and Limits, North Park 1. Units 6, 16, 17, 161, and 171. a. September 12 - September 13, 2026. b. Extended Falconry Season: September 1 - January 31 annually. 2. Daily Bag and Possession Limits a. Daily Bag Limit - Two (2) birds. b. Possession Limit - Two (2) birds.", "#315(B)");
  const sageStated = "Units 2, 3, 4, 5, 10, 11, 13, 18 except that portion of unit 18 east of Colo 125 in Grand County, 27, 28 except that portion of GMU 28 north and east of Grand Co Rd 50 (Church Park Rd) and US 40, 37, 181, 201, 211, 301 and 441";
  const sageGroup = group("sage-grouse-except-north-park", sageStated, SAGE_GROUSE);
  const northPark = group("sage-grouse-north-park", "North Park: units 6, 16, 17, 161, and 171", SAGE_GROUSE_NORTH_PARK);
  const sageConditions = [...GAME_BIRD_CONDITIONS, "us-co-grouse-ptarmigan-permit"];
  const sageLimits = { daily: 2, possession: 4, combined: false, statedAs: "Two (2) birds daily; four (4) in possession", section: "#315(A)(2)" };
  const parkLimits = { daily: 2, possession: 2, combined: false, statedAs: "Two (2) birds daily; two (2) in possession", section: "#315(B)(2)" };
  for (const [suffix, phrase, windows, implementsSet, label, section, extra] of [
    ["", "September 12 - September 18, 2026", once("2026-09-12", "2026-09-18", "September 12 - September 18, 2026"), OTHER_GAME_BIRD, "Sage-grouse season", "#315(A)(1)(a)", []],
    ["-falconry", "Extended Falconry Season: September 1 - January 31 annually", annually([9, 1], [1, 31], "September 1 - January 31 annually"), FALCONRY, "Extended falconry season", "#315(A)(1)(b)", [FALCONRY_NOTE]],
  ]) {
    add({
      id: `greater-sage-grouse${suffix}`, speciesId: "species:greater-sage-grouse", groupId: sageGroup, statedAs: sageStated, units: SAGE_GROUSE,
      specialExclude: [SAGE_18_PORTION, SAGE_28_PORTION], appliesWhen: { permittedImplements: implementsSet }, seasonLabel: label,
      ...(suffix ? { implementLabel: "Extended Falconry Season" } : {}),
      seasonPhrase: phrase, windows, limits: sageLimits, conditionIds: [...sageConditions, ...extra], section,
    });
  }
  for (const [suffix, phrase, windows, implementsSet, label, section, extra] of [
    ["", "September 12 - September 13, 2026", once("2026-09-12", "2026-09-13", "September 12 - September 13, 2026"), OTHER_GAME_BIRD, "Sage-grouse season (North Park)", "#315(B)(1)(a)", []],
    ["-falconry", "Extended Falconry Season: September 1 - January 31 annually", annually([9, 1], [1, 31], "September 1 - January 31 annually"), FALCONRY, "Extended falconry season (North Park)", "#315(B)(1)(b)", [FALCONRY_NOTE]],
  ]) {
    add({
      id: `greater-sage-grouse-north-park${suffix}`, speciesId: "species:greater-sage-grouse", groupId: northPark, statedAs: "North Park: units 6, 16, 17, 161, and 171", units: SAGE_GROUSE_NORTH_PARK,
      appliesWhen: { permittedImplements: implementsSet }, seasonLabel: label, ...(suffix ? { implementLabel: "Extended Falconry Season" } : {}),
      seasonPhrase: phrase, windows, limits: parkLimits, conditionIds: [...sageConditions, ...extra], section,
    });
  }

  /* #317 — mountain sharp-tailed grouse. Closed everywhere else, by its own words and by C.R.S. 33-6-109(1). */
  printed(w3, "#317 – Mountain Sharp-tailed Grouse A. Season Dates and Units. 1. Closed statewide except: Units 4, 5, 12, 13, 14, 23, 131, 211, 214, and 441. a. September 1 - September 20, 2026. b. Extended Falconry Season: September 1 - January 31 annually. B. Daily Bag and Possession Limits 1. Daily Bag Limit - Two (2) birds. 2. Possession Limit - Four (4) birds.", "#317");
  const sharpGroup = group("sharp-tailed-grouse", "Units 4, 5, 12, 13, 14, 23, 131, 211, 214, and 441", SHARPTAIL);
  const sharpLimits = { daily: 2, possession: 4, combined: false, statedAs: "Two (2) birds daily; four (4) in possession" };
  const sharpNote = ["Chapter W-3 names this the mountain sharp-tailed grouse; outside these units the season is “Closed statewide”."];
  add({
    id: "sharp-tailed-grouse", speciesId: "species:sharp-tailed-grouse", groupId: sharpGroup, statedAs: "Units 4, 5, 12, 13, 14, 23, 131, 211, 214, and 441", units: SHARPTAIL,
    appliesWhen: { permittedImplements: OTHER_GAME_BIRD }, seasonLabel: "Mountain sharp-tailed grouse season", seasonPhrase: "September 1 - September 20, 2026",
    windows: once("2026-09-01", "2026-09-20", "September 1 - September 20, 2026"), limits: sharpLimits, conditionIds: [...GAME_BIRD_CONDITIONS, "us-co-grouse-ptarmigan-permit"], section: "#317(A)(1)(a)", notes: sharpNote,
  });
  add({
    id: "sharp-tailed-grouse-falconry", speciesId: "species:sharp-tailed-grouse", groupId: sharpGroup, statedAs: "Units 4, 5, 12, 13, 14, 23, 131, 211, 214, and 441", units: SHARPTAIL,
    appliesWhen: { permittedImplements: FALCONRY }, seasonLabel: "Extended falconry season", implementLabel: "Extended Falconry Season",
    seasonPhrase: "Extended Falconry Season: September 1 - January 31 annually", windows: annually([9, 1], [1, 31], "September 1 - January 31 annually"),
    limits: sharpLimits, conditionIds: [...SMALL_GAME_LICENCE, "us-co-grouse-ptarmigan-permit", FALCONRY_NOTE], section: "#317(A)(1)(b)", notes: sharpNote,
  });

  /* #318 — chukar. */
  printed(w3, "#318 – Chukar Partridge A. Season Dates and Units 1. Statewide: September 1 - November 30 annually. 2. Extended Falconry Season - Statewide: September 1 - March 31 annually. B. Daily Bag and Possession Limits 1. Daily Bag Limit - Four (4) birds. 2. Possession Limit - Twelve (12) birds.", "#318");
  const chukar = { daily: 4, possession: 12, combined: false, statedAs: "Four (4) birds daily; twelve (12) in possession" };
  add({
    id: "chukar-statewide", speciesId: "species:chukar", groupId: STATEWIDE(), statedAs: "Statewide", units: ALL,
    appliesWhen: { permittedImplements: OTHER_GAME_BIRD }, seasonLabel: "Chukar season", seasonPhrase: "Statewide: September 1 - November 30 annually",
    windows: annually([9, 1], [11, 30], "September 1 - November 30 annually"), limits: chukar, conditionIds: GAME_BIRD_CONDITIONS, section: "#318(A)(1)",
  });
  add({
    id: "chukar-falconry", speciesId: "species:chukar", groupId: STATEWIDE(), statedAs: "Statewide", units: ALL,
    appliesWhen: { permittedImplements: FALCONRY }, seasonLabel: "Extended falconry season", implementLabel: "Extended Falconry Season",
    seasonPhrase: "Extended Falconry Season - Statewide: September 1 - March 31 annually", windows: annually([9, 1], [3, 31], "September 1 - March 31 annually"),
    limits: chukar, conditionIds: [...SMALL_GAME_LICENCE, FALCONRY_NOTE], section: "#318(A)(2)",
  });

  /* #319 — pheasant: cocks in the regular season, any bird for falconers. */
  printed(w3, "#319 – Pheasant A. Season Dates and Units 1. East of I-25: November 14, 2026 - January 31, 2027. 2. West of I-25: November 14, 2026 - January 3, 2027. 3. Extended Falconry Season - Statewide: September 1 - March 31 annually. B. Daily Bag and Possession Limits 1. Daily Bag Limit - Three (3) cocks. 2. Possession Limit - Nine (9) cocks. C. Extended Falconry Season Daily Bag and Possession Limits 1. Daily Bag Limit - Three (3) birds. 2. Possession Limit - Nine (9) birds.", "#319");
  const cocks = { daily: 3, possession: 9, combined: false, animalClass: "cocks", statedAs: "Three (3) cocks daily; nine (9) cocks in possession", section: "#319(B)" };
  const cockClass = { animalClasses: ["COCK"], legalAnimalClassIds: ["legal_animal_class:us-co-pheasant-cock"] };
  add({
    id: "ring-necked-pheasant-east-of-i25", speciesId: "species:ring-necked-pheasant", groupId: east, statedAs: "East of I-25", units: EAST_OF_I25,
    appliesWhen: { permittedImplements: OTHER_GAME_BIRD }, seasonLabel: "Pheasant season", seasonPhrase: "East of I-25: November 14, 2026 - January 31, 2027",
    windows: once("2026-11-14", "2027-01-31", "November 14, 2026 - January 31, 2027"), limits: cocks, ...cockClass, conditionIds: GAME_BIRD_CONDITIONS, section: "#319(A)(1)",
  });
  add({
    id: "ring-necked-pheasant-west-of-i25", speciesId: "species:ring-necked-pheasant", groupId: west, statedAs: "West of I-25", units: WEST_OF_I25,
    appliesWhen: { permittedImplements: OTHER_GAME_BIRD }, seasonLabel: "Pheasant season", seasonPhrase: "West of I-25: November 14, 2026 - January 3, 2027",
    windows: once("2026-11-14", "2027-01-03", "November 14, 2026 - January 3, 2027"), limits: cocks, ...cockClass, conditionIds: GAME_BIRD_CONDITIONS, section: "#319(A)(2)",
  });
  add({
    id: "ring-necked-pheasant-falconry", speciesId: "species:ring-necked-pheasant", groupId: STATEWIDE(), statedAs: "Statewide", units: ALL,
    appliesWhen: { permittedImplements: FALCONRY }, seasonLabel: "Extended falconry season", implementLabel: "Extended Falconry Season",
    seasonPhrase: "Extended Falconry Season - Statewide: September 1 - March 31 annually", windows: annually([9, 1], [3, 31], "September 1 - March 31 annually"),
    limits: { daily: 3, possession: 9, combined: false, statedAs: "Three (3) birds daily; nine (9) birds in possession", section: "#319(C)" },
    conditionIds: [...SMALL_GAME_LICENCE, FALCONRY_NOTE], section: "#319(A)(3)",
  });

  /* #320 — quail. */
  stated(w3, "#320 – Quail (Northern Bobwhite, Scaled, Gambel's)", "#320 heading");
  printed(w3, "A. Season Dates and Units 1. East of U.S. Interstate 25 and south of Interstate 70 from I-25 to Byers and U.S. Highway 36 from Byers to the Kansas line, and those portions of Pueblo, Fremont, Huerfano, El Paso and Las Animas counties lying west of I-25: November 14, 2026 - January 31, 2027. 2. East of U.S. Interstate 25 and north of Interstate 70 from I-25 east to Byers and U.S. Highway 36 from Byers to the Kansas line: November 14, 2026 - January 3, 2027. 3. West of U.S. Interstate I-25, except Pueblo, Fremont, Huerfano, El Paso and Las Animas counties: November 14, 2026 - January 3, 2027. 4. Extended Falconry Season - Statewide: September 1 through March 31 annually. B. Daily Bag and Possession Limits 1. Daily Bag Limit - Eight (8) quail of each species. 2. Possession Limit - Twenty-four (24) quail of each species.", "#320");
  const area1Units = [...QUAIL_EAST_SOUTH, ...QUAIL_WEST_FIVE_COUNTIES].sort((a, b) => Number(a) - Number(b));
  const area2Units = [...QUAIL_EAST_NORTH, ...QUAIL_EAST_STRADDLE].sort((a, b) => Number(a) - Number(b));
  const area3Units = [...QUAIL_WEST_REST, ...QUAIL_WEST_STRADDLE].sort((a, b) => Number(a) - Number(b));
  const area1Stated = "East of U.S. Interstate 25 and south of Interstate 70 from I-25 to Byers and U.S. Highway 36 from Byers to the Kansas line, and those portions of Pueblo, Fremont, Huerfano, El Paso and Las Animas counties lying west of I-25";
  const area2Stated = "East of U.S. Interstate 25 and north of Interstate 70 from I-25 east to Byers and U.S. Highway 36 from Byers to the Kansas line";
  const area3Stated = "West of U.S. Interstate I-25, except Pueblo, Fremont, Huerfano, El Paso and Las Animas counties";
  const quailGroups = [
    group("quail-area-1", area1Stated, area1Units, [...QUAIL_EAST_STRADDLE, ...QUAIL_WEST_STRADDLE].sort((a, b) => Number(a) - Number(b))),
    group("quail-area-2", area2Stated, area2Units),
    group("quail-area-3", area3Stated, area3Units),
  ];
  for (const slug of ["northern-bobwhite", "scaled-quail", "gambels-quail"]) {
    const speciesId = `species:${slug}`;
    const limits = { daily: 8, possession: 24, combined: false, statedAs: "Eight (8) quail of each species daily; twenty-four (24) of each species in possession" };
    add({
      id: `${slug}-area-1`, speciesId, groupId: quailGroups[0], statedAs: area1Stated, units: area1Units, specialInclude: [QUAIL_AREA_1_PORTION],
      appliesWhen: { permittedImplements: OTHER_GAME_BIRD }, seasonLabel: "Quail season", seasonPhrase: "November 14, 2026 - January 31, 2027",
      windows: once("2026-11-14", "2027-01-31", "November 14, 2026 - January 31, 2027"), limits, conditionIds: GAME_BIRD_CONDITIONS, section: "#320(A)(1)",
    });
    add({
      id: `${slug}-area-2`, speciesId, groupId: quailGroups[1], statedAs: area2Stated, units: area2Units, specialExclude: [QUAIL_AREA_1_PORTION],
      appliesWhen: { permittedImplements: OTHER_GAME_BIRD }, seasonLabel: "Quail season", seasonPhrase: "November 14, 2026 - January 3, 2027",
      windows: once("2026-11-14", "2027-01-03", "November 14, 2026 - January 3, 2027"), limits, conditionIds: GAME_BIRD_CONDITIONS, section: "#320(A)(2)",
    });
    add({
      id: `${slug}-area-3`, speciesId, groupId: quailGroups[2], statedAs: area3Stated, units: area3Units, specialExclude: [QUAIL_AREA_1_PORTION],
      appliesWhen: { permittedImplements: OTHER_GAME_BIRD }, seasonLabel: "Quail season", seasonPhrase: "November 14, 2026 - January 3, 2027",
      windows: once("2026-11-14", "2027-01-03", "November 14, 2026 - January 3, 2027"), limits, conditionIds: GAME_BIRD_CONDITIONS, section: "#320(A)(3)",
    });
    add({
      id: `${slug}-falconry`, speciesId, groupId: STATEWIDE(), statedAs: "Statewide", units: ALL,
      appliesWhen: { permittedImplements: FALCONRY }, seasonLabel: "Extended falconry season", implementLabel: "Extended Falconry Season",
      seasonPhrase: "Extended Falconry Season - Statewide: September 1 through March 31 annually", windows: annually([9, 1], [3, 31], "September 1 through March 31 annually"),
      limits, conditionIds: [...SMALL_GAME_LICENCE, FALCONRY_NOTE], section: "#320(A)(4)",
    });
  }

  /* #321 — greater prairie-chicken. */
  printed(w3, "#321 – Greater Prairie-Chicken A. Season Dates and Units. 1. Closed statewide except: Units 93, 97, 98, 100, 101, 102, 103, 109, all of Morgan County, and those portions east of Colorado State Highway 71 and south of Colorado State Highway 14 and U.S. Highway 138. a. October 1 - January 31 annually. B. Daily Bag and Possession Limits 1. Daily Bag Limit - Two (2) birds. 2. Possession Limit - Six (6) birds.", "#321");
  const gpcStated = "Units 93, 97, 98, 100, 101, 102, 103, 109, all of Morgan County, and those portions east of Colorado State Highway 71 and south of Colorado State Highway 14 and U.S. Highway 138";
  add({
    id: "greater-prairie-chicken", speciesId: "species:greater-prairie-chicken", groupId: group("greater-prairie-chicken", gpcStated, GPC_OPEN, GPC_PORTION),
    statedAs: gpcStated, units: GPC_OPEN, specialInclude: [GPC_PORTION_ID],
    appliesWhen: { permittedImplements: OTHER_GAME_BIRD }, seasonLabel: "Prairie-chicken season", seasonPhrase: "October 1 - January 31 annually",
    windows: annually([10, 1], [1, 31], "October 1 - January 31 annually"),
    limits: { daily: 2, possession: 6, combined: false, statedAs: "Two (2) birds daily; six (6) in possession" },
    conditionIds: GAME_BIRD_CONDITIONS, section: "#321(A)(1)(a)",
  });

  /* #323–#326 — furbearers. */
  printed(w3, "#323 – Mink, pine marten, badger, gray fox, red fox, swift fox, raccoon, ring-tailed cat, striped skunk, western spotted skunk, long-tailed weasel, short-tailed weasel, opossum, and muskrat A. Season Dates and Units 1. Statewide: November 1 - end of February annually. B. Daily Bag and Possession Limits 1. Daily Bag Limit - two (2) mink, two (2) pine marten, two (2) badger, two (2) gray fox, two (2) red fox, two (2) swift fox, two (2) raccoon, two (2) ring-tailed cat, two (2) striped skunk, two (2) western spotted skunk, two (2) long-tailed weasel, two (2) short-tailed weasel, two (2) opossum, and two (2) muskrat. 2. Unlimited possession.", "#323");
  for (const [slug, word] of [
    ["american-mink", "mink"], ["american-marten", "pine marten"], ["american-badger", "badger"], ["gray-fox", "gray fox"], ["red-fox", "red fox"],
    ["swift-fox", "swift fox"], ["raccoon", "raccoon"], ["ringtail", "ring-tailed cat"], ["striped-skunk", "striped skunk"],
    ["western-spotted-skunk", "western spotted skunk"], ["long-tailed-weasel", "long-tailed weasel"], ["american-ermine", "short-tailed weasel"],
    ["virginia-opossum", "opossum"], ["muskrat", "muskrat"],
  ]) {
    add({
      id: `${slug}-statewide`, speciesId: `species:${slug}`, groupId: STATEWIDE(), statedAs: "Statewide", units: ALL,
      appliesWhen: { permittedImplements: FURBEARER }, seasonLabel: "Furbearer season", seasonPhrase: "Statewide: November 1 - end of February annually",
      windows: annually([11, 1], "END_FEB", "November 1 - end of February annually"),
      limits: { daily: 2, combined: false, statedAs: `two (2) ${word} daily; unlimited possession` },
      conditionIds: FURBEARER_CONDITIONS, section: "#323",
      notes: ["pine marten", "ring-tailed cat", "short-tailed weasel", "opossum"].includes(word) ? [`Chapter W-3 calls this species the ${word}.`] : [],
    });
  }
  printed(w3, "#324 – Bobcat A. Season Dates and Units 1. Statewide: December 1 - end of February annually. B. Daily Bag and Possession Limits 1. Daily Bag Limit - two (2) bobcat. 2. Unlimited possession.", "#324");
  add({
    id: "bobcat-statewide", speciesId: "species:bobcat", groupId: STATEWIDE(), statedAs: "Statewide", units: ALL,
    appliesWhen: { permittedImplements: FURBEARER }, seasonLabel: "Furbearer season", seasonPhrase: "Statewide: December 1 - end of February annually",
    windows: annually([12, 1], "END_FEB", "December 1 - end of February annually"),
    limits: { daily: 2, combined: false, statedAs: "two (2) bobcat daily; unlimited possession" },
    conditionIds: [...FURBEARER_CONDITIONS, "us-co-air-gun-coyote-bobcat", "us-co-bobcat-sealing"], section: "#324",
  });
  printed(w3, "#325 – Coyote A. Season Dates and Units 1. Statewide: January 1 - December 31 annually. B. Daily Bag and Possession Limits 1. Daily Bag Limit - two (2) coyote 2. Unlimited possession.", "#325");
  add({
    id: "coyote-statewide", speciesId: "species:coyote", groupId: STATEWIDE(), statedAs: "Statewide", units: ALL,
    appliesWhen: { permittedImplements: FURBEARER }, seasonLabel: "Coyote season", seasonPhrase: "Statewide: January 1 - December 31 annually",
    windows: annually([1, 1], [12, 31], "January 1 - December 31 annually"),
    limits: { daily: 2, combined: false, statedAs: "two (2) coyote daily; unlimited possession" },
    conditionIds: ["us-co-coyote-licence", "us-co-hip-registration", WEST_CENTERFIRE, "us-co-air-gun-coyote-bobcat"], section: "#325",
  });
  printed(w3, "#326 – Beaver A. Season Dates and Units 1. Statewide: October 1 - March 31annually. B. Daily Bag and Possession Limits 1. Daily Bag Limit - two (2) beaver. 2. Unlimited possession.", "#326");
  add({
    id: "beaver-statewide", speciesId: "species:beaver", groupId: STATEWIDE(), statedAs: "Statewide", units: ALL,
    appliesWhen: { permittedImplements: FURBEARER }, seasonLabel: "Furbearer season", seasonPhrase: "Statewide: October 1 - March 31 annually",
    windows: annually([10, 1], [3, 31], "October 1 - March 31 annually"),
    limits: { daily: 2, combined: false, statedAs: "two (2) beaver daily; unlimited possession" },
    conditionIds: [...FURBEARER_CONDITIONS, "us-co-beaver-sealing"], section: "#326",
  });

  const ids = new Set();
  for (const entry of rules) {
    if (ids.has(entry.id)) throw new Error(`duplicate rule ${entry.id}`);
    ids.add(entry.id);
    for (const unit of entry.geography.include.ghas) if (!ALL.includes(unit)) throw new Error(`${entry.id}: unit ${unit} is not a Colorado GMU`);
  }
  return rules;
}

/* ── Conditions, every one checked against its source's printed words ──── */

function buildConditions(w3, w0) {
  printed(w3, "A. A small game license authorizes the take of coyotes and those species defined in #300(D) as small game, except wild turkey.", "#304(A)");
  printed(w3, "B. A small game license combined with the purchase of a furbearer harvest permit authorizes the take of those species defined in #300(D) as small game, except wild turkey, and authorizes the take of all species defined in #300(B) as furbearers.", "#304(B)");
  printed(w3, "D. A furbearer license authorizes the take of all species defined in #300(B) as furbearers.", "#304(D)");
  printed(w3, "E. A youth small game license authorizes the take of all species defined in #300(D) as small game and all species identified in #300(B) as furbearers.", "#304(E)");
  printed(w3, "F. Common snapping turtles may be taken with either a small game license or a fishing license.", "#304(F)");
  printed(w3, "G. Each hunter must register their intent to hunt migratory birds, small game or coyotes by completing a Harvest Information Program (HIP) survey", "#304(G)");
  printed(w3, "no hunter shall take any greater sage-grouse, mountain sharp-tailed grouse, or white-tailed ptarmigan unless at the time of such taking they have purchased one (1) greater sage-grouse, mountain sharp-tailed grouse, and white-tailed ptarmigan permit in addition to a small game license.", "#304(H)");
  printed(w3, "2. Any shotgun not larger than 10 gauge, incapable of holding more than three (3) shells in magazine and chamber combined.", "#303(B)(2)");
  printed(w3, "2. Shotguns not larger than 10 gauge not firing a single slug, and incapable of holding more than three (3) shells in the magazine and chamber combined.", "#303(C)(2)");
  printed(w3, "4. Any air gun, except that for coyote or bobcat the air gun must be a pre-charged pneumatic air gun .25 caliber or larger.", "#303(E)(4)");
  printed(w3, "a. Arapaho National Wildlife Refuge (Jackson County). No person shall use or possess shot (either in shot-shells or as loose shot for muzzle-loading) other than non-toxic shot while taking or attempting to take any resident small game species with a shotgun.", "#303(A)(4)");
  printed(w3, "All bobcat, or their pelts, shall be personally presented by the licensee for inspection and must be sealed within 30 days after take, or within 5 days after the close of the season, whichever is sooner, with a seal provided by the Division.", "#324(B)(3)(a)");
  printed(w3, "1. Licensees shall personally present beaver pelts or hides to the Division for sealing within 30 days of take or within 5 days of the end of the season, whichever is sooner.", "#326(C)(1)");
  printed(w3, "The presentation and sealing requirements of this rule only apply to beaver taken in Colorado after October 1, 2026 by avocational sportspersons.", "#326(C)(4)");
  printed(w0, "B. It shall be unlawful to hunt any game birds, small game mammals or furbearers, with a centerfire rifle larger than .23 caliber during the regular deer and elk seasons west of Interstate 25, unless the hunter holds an unfilled deer or elk license for the season he is hunting.", "W-0 #004(B)");
  printed(w0, "Except as provided in (3) of this subsection, dogs shall not be used to hunt or take cottontail rabbits, snowshoe hares, and tree squirrels where a regular deer, elk, pronghorn or moose season is in progress.", "W-0 #004(A)(2)(a)(1)");
  printed(w0, "3. Organized dog pursuit events involving the hunting of rabbits or hares conducted by state or nationally-recognized sporting associations may be conducted on", "W-0 #004(A)(2)(a)(3)");
  printed(w0, "private lands or public lands not concurrently open to big game hunting during the extended dog pursuit season for such species. 4. A valid small game license is required for all dog handlers participating in any dog pursuit event involving the hunting of rabbits or hares", "W-0 #004(A)(2)(a)(3)–(4)");

  return [
    {
      id: W3,
      authority: "Colorado Parks and Wildlife",
      title: W3_VERSION,
      url: W3_PAGE,
      conditions: [
        { id: "us-co-small-game-licence", sourceId: W3, sourceSection: "#304(A), (C), (E)", text: "A Colorado small game licence (or a small game and fishing combination licence, or a youth small game licence) is required. North Ground has not verified what you hold." },
        { id: "us-co-hip-registration", sourceId: W3, sourceSection: "#304(G)", text: "Register for the Harvest Information Program (HIP) before your first small game or coyote hunt of the season (March 1 through March 31 of the following year)." },
        { id: "us-co-furbearer-licence", sourceId: W3, sourceSection: "#304(B)–(E)", text: "Furbearers need a furbearer licence, or a small game licence (or small game and fishing combination licence) with an annual furbearer harvest permit; a youth small game licence also covers them." },
        { id: "us-co-coyote-licence", sourceId: W3, sourceSection: "#304(A), (D)", text: "Coyotes may be taken under a small game licence or a furbearer licence." },
        { id: "us-co-snapping-turtle-licence", sourceId: W3, sourceSection: "#304(F)", text: "Common snapping turtles may be taken under either a small game licence or a fishing licence." },
        { id: "us-co-grouse-ptarmigan-permit", sourceId: W3, sourceSection: "#304(H)", text: "You must also hold the greater sage-grouse, mountain sharp-tailed grouse and white-tailed ptarmigan permit, bought in addition to the small game licence." },
        { id: "us-co-game-mammal-shotgun", sourceId: W3, sourceSection: "#303(B)(2)", text: "A shotgun must be 10 gauge or smaller and hold no more than three shells in magazine and chamber combined." },
        { id: "us-co-game-bird-shotgun", sourceId: W3, sourceSection: "#303(C)(2)", text: "A shotgun must be 10 gauge or smaller, must not fire a single slug, and must hold no more than three shells in magazine and chamber combined." },
        { id: "us-co-air-gun-coyote-bobcat", sourceId: W3, sourceSection: "#303(E)(4)", speciesIds: ["species:coyote", "species:bobcat"], text: "An air gun used for coyote or bobcat must be a pre-charged pneumatic air gun of .25 calibre or larger." },
        { id: "us-co-arapaho-nwr-nontoxic-shot", sourceId: W3, sourceSection: "#303(A)(4)(a)", zoneIds: JACKSON.map(zoneId), text: "On the Arapaho National Wildlife Refuge (Jackson County), only non-toxic shot may be used or possessed when hunting small game with a shotgun." },
        { id: "us-co-bobcat-sealing", sourceId: W3, sourceSection: "#324(B)(3)(a)", text: "Present every bobcat or pelt in person for a Division seal within 30 days of take or 5 days after the season closes, whichever is sooner, and before it leaves Colorado." },
        {
          id: "us-co-beaver-sealing", sourceId: W3, sourceSection: "#326(C)", activeWindows: [{ opensIso: "2026-10-02", closesIso: PERIOD.to }],
          text: "Present every beaver pelt or hide in person for a Division seal within 30 days of take or 5 days after the season ends, whichever is sooner, and before it leaves Colorado. This applies to beaver taken after October 1, 2026 by avocational hunters.",
        },
        { id: "us-co-falconry-chapter-w-6", sourceId: W3, sourceSection: "#303(B)(5), (C)(5)", text: "Hawking is a legal method for these species; falconry itself is regulated by Chapter W-6 (Raptors), which North Ground has not read." },
      ],
    },
    {
      id: W0,
      authority: "Colorado Parks and Wildlife",
      title: W0_VERSION,
      url: W0_PAGE,
      conditions: [
        {
          id: "us-co-centerfire-west-of-i25", sourceId: W0, sourceSection: "#004(B)", zoneIds: WEST_OF_I25.map(zoneId),
          text: "West of I-25, during the regular deer and elk seasons, a centerfire rifle larger than .23 calibre may not be used to hunt game birds, small game mammals or furbearers unless you hold an unfilled deer or elk licence for that season.",
        },
        {
          id: "us-co-dogs-during-big-game", sourceId: W0, sourceSection: "#004(A)(2)(a)(1)",
          text: "Dogs may not be used to hunt cottontails, snowshoe hares or tree squirrels where a regular deer, elk, pronghorn or moose season is in progress, except at an organized dog pursuit event.",
        },
        {
          id: "us-co-dog-pursuit-event", sourceId: W0, sourceSection: "#004(A)(2)(a)(3)–(4)",
          text: "Only at an organized dog pursuit event run by a state or nationally recognized sporting association, on private land or on public land not open to big game hunting at the time; every dog handler needs a valid small game licence.",
        },
      ],
    },
  ];
}

/* ── Statute ────────────────────────────────────────────────────────────── */

const CLOSED_WORLD =
  "It is unlawful for any person to hunt, take, or have in such person's possession any wildlife that is the property of this state " +
  "as provided in section 33-1-101, except as permitted by articles 1 to 6 of this title or by rule or regulation of the commission.";

function readStatute(html) {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&rsquo;|&lsquo;/g, "'").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
    .replace(/[‘’]/g, "'");
  printed(flatten(text), `33-6-109. Wildlife - illegal possession - penalties. (1) ${CLOSED_WORLD}`, "C.R.S. 33-6-109(1)");
}

/* ── Build ──────────────────────────────────────────────────────────────── */

async function main() {
  const check = process.argv.includes("--check");
  recordSourcesFromArgs();
  const w3Url = await w3PdfUrl();
  const [w3Pdf, w0Pdf, crsBytes] = await Promise.all([fetchPdf(w3Url), fetchPdf(W0_PAGE), fetchBytes(CRS_URL)]);
  const w3 = joined(w3Pdf.pages);
  const w0 = joined(w0Pdf.pages);
  stated(w3, "EFFECTIVE DATE - THESE REGULATIONS SHALL BECOME EFFECTIVE SEPTEMBER 1, 2026 AND SHALL REMAIN IN FULL FORCE AND EFFECT UNTIL REPEALED, AMENDED OR SUPERSEDED.", "W-3 effective date");
  printed(w3, "Any method of take not listed herein shall be prohibited", "#303 closed list of methods");
  printed(w3, "1. Small Game - from one-half (1/2) hour before sunrise to sunset. 2. Furbearers - from one-half (1/2) hour before sunrise to one-half (1/2) hour after sunset.", "#302(A)");
  /* The publication is a Word export in windows-1252: its non-breaking spaces are single 0xA0 bytes. */
  readStatute(crsBytes.toString("latin1"));

  const rules = buildRules(w3);
  const sources = buildConditions(w3, w0);
  const sidesHash = sha256(readFileSync(SIDES));
  const quailLineHash = sha256(readFileSync(QUAIL_LINE_FILE));
  const sourceHashes = { w3Pdf: w3Pdf.sha256, w0Pdf: w0Pdf.sha256, crs: sha256(crsBytes), unitSides: sidesHash, quailLine: quailLineHash };
  const contentHash = sha256(JSON.stringify(sourceHashes));
  const previous = readPreviousBundle(BUNDLE);
  const retrievedAt = retrievedAtFor(previous, previous?.contentHash, contentHash, jurisdictionToday(TIME_ZONE));

  const sourceRights = {
    accessState: "PUBLIC_READABLE", reuseState: "UNSTATED", archiveState: "UNCONFIRMED", derivedFactsState: "USABLE",
    termsStatus: "NOT_LOCATED", authorityLevel: "PRIMARY_GOVERNMENT", lastVerified: retrievedAt,
  };
  const bundle = {
    schemaVersion: 1,
    bundleId: "regulatory_bundle:us-co-small-game-2026",
    jurisdictionId: "jurisdiction:us-co",
    sourceVersion: W3_VERSION,
    retrievedAt,
    contentHash,
    certifiedPeriod: {
      ...PERIOD,
      reason:
        "Chapter W-3 took effect on September 1, 2026 and remains in force until repealed, amended or superseded; its dated seasons are the " +
        "2026–27 seasons and its other seasons recur annually. North Ground certifies one year from the effective date and re-reads the " +
        "chapter before relying on it later.",
    },
    absence: {
      meaning: "CLOSED",
      /* OURS, though the builder verifies the statute's own sentence above: the quotation contract's languages are
         en-CA and fr-CA, and labelling a Colorado statute either would misstate it. */
      words: {
        owner: "NORTH_GROUND",
        text:
          "Colorado makes it unlawful to hunt or take any wildlife except as its wildlife statutes or a Parks and Wildlife Commission " +
          "rule permits (C.R.S. § 33-6-109(1)). Chapter W-3 sets every small game and furbearer season, so a place, date or method it " +
          "does not open for a species is closed.",
      },
      section: "C.R.S. § 33-6-109(1); 2 CCR 406-3, Article II",
      sourceId: CRS,
      explanation:
        "Colorado makes hunting any wildlife unlawful except as statute or a Commission regulation permits, and Chapter W-3 Article II sets " +
        "the small game and furbearer seasons by species, date and place. A unit, date or method it does not open for a species has nothing permitting it.",
    },
    officialUnitCount: ALL.length,
    units: ALL.map((identifier) => ({ identifier, zoneId: zoneId(identifier) })),
    specialGeographies: SPECIAL_GEOGRAPHIES,
    legalAnimalClasses: [
      {
        id: "legal_animal_class:us-co-pheasant-cock",
        statedAs: "cocks",
        statedLanguage: "en",
        appliesToSpecies: ["species:ring-necked-pheasant"],
        criterionStatus: "NOT_MEASURED",
        sourceId: W3,
      },
    ],
    sources: sources.map((source, index) => ({
      ...source,
      ...sourceRights,
      retrievalMethod: "OFFICIAL_PDF",
      ...(index === 0 ? { extractedWith: `pypdf ${w3Pdf.pypdf}`, sourceHashes } : {}),
    })),
    sourceRecords: [
      { id: W3, authority: "Colorado Parks and Wildlife", title: W3_VERSION, url: W3_PAGE, ...sourceRights, retrievalMethod: "OFFICIAL_PDF", listedOn: REGULATIONS_PAGE },
      { id: W0, authority: "Colorado Parks and Wildlife", title: W0_VERSION, url: W0_PAGE, ...sourceRights, retrievalMethod: "OFFICIAL_PDF", listedOn: REGULATIONS_PAGE },
      { id: CRS, authority: "Colorado General Assembly, Office of Legislative Legal Services", title: CRS_VERSION, url: CRS_URL, ...sourceRights, retrievalMethod: "OFFICIAL_HTML" },
      { id: GMU, authority: "Colorado Parks and Wildlife", title: "Game Management Units (CPWAdminData feature service, layer 6)", url: GMU_SERVICE },
    ],
    unitDerivation: {
      file: SIDES,
      hash: sidesHash,
      method: SIDES_FILE.method,
      i25ChainDisagreementDegrees: SIDES_FILE.i25ChainDisagreementDegrees,
      quail: { measuredBy: QUAIL_LINE_FILE, measurementHash: quailLineHash, area1Units: [...QUAIL_EAST_SOUTH, ...QUAIL_WEST_FIVE_COUNTIES].sort((a, b) => Number(a) - Number(b)), unresolvedPortions: [...QUAIL_EAST_STRADDLE, ...QUAIL_WEST_STRADDLE].sort((a, b) => Number(a) - Number(b)) },
      greaterPrairieChicken: { open: GPC_OPEN, closed: GPC_CLOSED.length, unresolvedPortions: GPC_PORTION },
    },
    limitations: [
      "This is a state-licensed recreational result under Colorado's Chapter W-3. It does not describe hunting under tribal authority or under treaty or other rights, which North Ground does not evaluate.",
      "Colorado's Game Management Unit descriptions in Chapter W-0 are the exact boundaries; CPW's maps are approximate. Near a unit line, and near I-25 where seasons change, confirm where you are.",
      "National parks, national wildlife refuges, military installations, State Wildlife Areas and State Trust Lands have their own access and hunting rules, which North Ground does not evaluate here.",
      "Trapping, take by landowners to protect property (C.R.S. § 33-6-107(9)) and take under the Predatory Animal Control Act are not described here.",
      "The Parks and Wildlife Commission amends Chapter W-3 during the year; North Ground read the 07/16/2026 edition.",
    ],
    groups: [...groups.values()].sort((a, b) => a.id.localeCompare(b.id)),
    /* `crossesYear` on every window (ConditionalWindow declares it; a bundle that omits it fails
       crossesYearAgreesWithTheBundle). A resolved window is anchored to its year and never wraps, so a season
       spans the turn of the year exactly when its two dates fall in different years. */
    rules: rules.map((rule) => ({
      ...rule,
      windows: rule.windows.map((window) => ({ ...window, crossesYear: window.opensIso.slice(0, 4) !== window.closesIso.slice(0, 4) })),
    })),
  };

  const certified = {
    jurisdictionId: "jurisdiction:us-co",
    layerId: "layer:us-co-gmu",
    officialUnitCount: ALL.length,
    certifiedUnits: ALL,
  };

  writeOrCheck({ check, outputs: { [BUNDLE]: bundle, [CERTIFIED]: certified }, bundlePath: BUNDLE, contentHash, previous, label: "Colorado small game 2026" });
  if (!check) {
    const bySpecies = {};
    for (const entry of rules) bySpecies[entry.speciesId] = (bySpecies[entry.speciesId] ?? 0) + 1;
    console.log(`${rules.length} rules over ${Object.keys(bySpecies).length} species in ${groups.size} groups.`);
  }
}

main().catch((error) => {
  console.error(`Colorado small game build failed: ${error.message}`);
  process.exit(1);
});
