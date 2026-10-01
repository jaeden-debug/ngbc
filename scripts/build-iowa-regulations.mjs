/**
 * Iowa's statewide small-game rules: the first bundle whose geography is the
 * whole jurisdiction rather than a list of units.
 *
 * WHY IOWA IS THE PILOT. Iowa publishes no hunting units for small game; its
 * Natural Resource Commission writes each season in 571 IAC chapter 96 and
 * ends five of the eight with the sentence "Entire state open." That is a rule
 * whose own scope is the State of Iowa, so §41A ("Resolving inside a
 * jurisdiction is not drawing its boundary") lets the Census Bureau's state
 * boundary place a point for it — and for nothing narrower. The one season the
 * chapter does NOT give the whole state (ruffed grouse, 96.4(1), "that portion
 * of the state lying north and east of a line" along named highways) is
 * refused here: a highway-line area is the authority's to draw, and the state
 * boundary must never stand in for it.
 *
 * THE SOURCE. The Iowa Legislature's own publication of the Iowa
 * Administrative Code, read 2026-10-01:
 *   https://www.legis.iowa.gov/docs/iac/chapter/571.96.pdf
 *   (sha256 970fefc2c3356a515a78aecaa8eec1e32f3cb452cdbad5acd95216a353007c8a)
 * Edition currency was checked, not assumed: the Legislature's rule listing
 * for agency 571, chapter 96 at publication date 10-01-2026 lists rules
 * 96.1–96.9, every one at the 05-14-2025 edition (ARC 9239C, IAB 5/14/25,
 * effective 6/18/25), and the chapter footer carries the same IAC date.
 * Chapter 97 (snipe, rail, woodcock, ruffed grouse, dove) was rescinded by ARC
 * 9238C on the same date, so nothing migratory is read here. The closed-season
 * rule is Iowa Code 2026 §481A.48(1), read from
 *   https://www.legis.iowa.gov/docs/code/481A.pdf
 *   (sha256 8579ba090f5674bbcf89af86aeb5cfcad65ad7373c7b462f9004480888672475).
 * legis.iowa.gov's robots.txt disallows only /chambers/; both documents were
 * read with an ordinary request. Terms of reuse were not located, so (§44)
 * the facts are derived and attributed and no copy of either document is
 * stored.
 *
 * THE DATES ARE STANDING RULES. Every window is written as an ordinal over
 * weekdays ("the last Saturday in October through January 10 of the
 * succeeding year"), so the chapter is standing law until amended (its
 * rescission date under Iowa Code §17A.7 is 6/18/30). The windows are DERIVED
 * here with the same helpers New Brunswick uses, and both forms are stored.
 *
 * THREE THINGS THAT WOULD BE WRONG IF FLATTENED:
 *
 *  1. FALCONRY IS ITS OWN SEASON (96.9). It runs 1 October (1 September for
 *     cottontail and squirrel) to 31 March, takes pheasants of both sexes, and
 *     has its own, lower limits. Flattening it away would call February
 *     pheasant hunting CLOSED for a falconer and would show a falconer the gun
 *     season's limits. Which methods are lawful OTHER than falconry is set
 *     outside chapter 96 and is not certified, so the other rules state no
 *     implement: they are keyed "not by falconry", never "firearm".
 *  2. JACKRABBIT IS CLOSED ALL YEAR (96.7) — EXCEPT BY FALCONRY (96.9(3)(a)).
 *  3. THE YOUTH PHEASANT WEEKEND (96.1(3)) is Iowa residents aged 15 or
 *     younger, on the weekend before the regular opener. Without it that
 *     weekend would read CLOSED to the hunters it exists for.
 *
 * Run: node scripts/build-iowa-regulations.mjs
 */

import { writeFileSync } from "node:fs";
import { isoOf, lastWeekdayOfMonth, nthWeekdayOfMonth } from "./nb-dates.mjs";

const OUT = "content/regulatory/us-ia-2026.json";
const JURISDICTION = "jurisdiction:us-ia";

const IAC = "source:us-ia-iac-571-96";
const CODE = "source:us-ia-code-481a";
const CENSUS = "source:us-census-tigerweb-states";

const RETRIEVED = "2026-10-01";
const SOURCE_VERSION = "571 IAC chapter 96 (IAC 5/14/25; ARC 9239C, effective 6/18/25); Iowa Code 2026 §481A.48";
/* The short form each rule carries: an answer names the instrument it rests on. */
const RULE_VERSION = "571 IAC chapter 96 (IAC 5/14/25)";
const ruleUrl = (rule) => `https://www.legis.iowa.gov/docs/iac/rule/05-14-2025.571.${rule}.pdf`;

/* Season years derived: the rules took effect 18 June 2025, so the 2025–26
   and 2026–27 seasons are both governed by this text. */
const YEARS = [2025, 2026];
const SATURDAY = 6;
const MONDAY = 1;
const DAY = 86_400_000;

const lastSaturdayInOctober = (year) => lastWeekdayOfMonth(year, 10, SATURDAY);
const secondSaturdayInOctober = (year) => nthWeekdayOfMonth(year, 10, SATURDAY, 2);
/* "the Saturday before Labor Day": Labor Day is the first Monday in September
   (5 U.S.C. §6103(a)), so the Saturday is two days before it. */
const saturdayBeforeLaborDay = (year) => nthWeekdayOfMonth(year, 9, MONDAY, 1) - 2 * DAY;
const fixed = (year, month, day) => Date.UTC(year, month - 1, day);

/* Every window says whether it spans the turn of the calendar year, as every
   new bundle must (engine-answers-somewhere.test.ts): a resolved window never
   wraps, so it crosses exactly when it opens and closes in different years. */
function windows(phrase, open, close) {
  return YEARS.map((year) => {
    const opensIso = isoOf(open(year));
    const closesIso = isoOf(close(year));
    if (closesIso < opensIso) throw new Error(`${phrase}: ${opensIso}..${closesIso} closes before it opens`);
    return { opensIso, closesIso, crossesYear: opensIso.slice(0, 4) !== closesIso.slice(0, 4), statedAs: phrase };
  });
}

/* ── Geography ──────────────────────────────────────────────────────────── */

/**
 * ONE GROUP, NO ZONES. The rules below say "Entire state open." — their
 * geography is the State of Iowa, expressed as `include.jurisdiction`, never
 * as a list of units Iowa does not publish and never as a synthetic zone.
 */
const STATEWIDE_GROUP = "regulatory_group:us-ia-2026-statewide";
const statewide = (statedAs) => ({
  statedAs,
  include: { ghas: [], gbhz: [], special: [], jurisdiction: JURISDICTION },
  exclude: { ghas: [], special: [] },
});

/* ── Conditions ─────────────────────────────────────────────────────────── */

const conditions = [
  {
    id: "us-ia-youth-pheasant",
    text:
      "The youth pheasant weekend is for Iowa residents aged 15 or younger. Each youth must be accompanied by an adult " +
      "aged 18 or older who holds a valid hunting licence and habitat stamp if normally required to have them; only the " +
      "youth may shoot. The youth needs no hunting licence or stamps.",
    sourceId: IAC,
    sourceSection: "571 IAC 96.1(3)",
  },
  {
    id: "us-ia-falconry-permit",
    text: "Hunting by falconry needs a falconry permit and every other licence, stamp and permit the law requires. An observer needs no hunting licence but may not assist in the hunt.",
    sourceId: IAC,
    sourceSection: "571 IAC 96.9(1)",
  },
  {
    id: "us-ia-falconry-no-gun-or-bow",
    text: "No falconer or observer may possess a long gun, bow or crossbow while in the field with a raptor or in the act of falconry.",
    sourceId: IAC,
    sourceSection: "571 IAC 96.9(2)",
  },
  {
    id: "us-ia-pheasant-transport",
    text: "A pheasant transported within Iowa must keep a leg and foot, a fully feathered wing, or a fully feathered head attached to the intact carcass.",
    sourceId: IAC,
    sourceSection: "571 IAC 96.1(2)",
  },
];

/* ── Rules ──────────────────────────────────────────────────────────────── */

const NOT_FALCONRY = { byFalconry: "NOT_FALCONRY" };
const FALCONRY = { byFalconry: "FALCONRY", permittedImplements: ["FALCONRY"] };

function rule({ id, speciesId, appliesWhen, seasonLabel, seasonPhrase, windows: spans, limits, section, scope, conditionIds = [], animalClasses, declaredNoSeason = false, closureStatedAs, notes = [] }) {
  return {
    id: `regulatory_rule:us-ia-2026-${id}`,
    speciesId,
    regulatoryGroupId: STATEWIDE_GROUP,
    geography: statewide(scope),
    appliesWhen,
    seasonLabel,
    ...(animalClasses ? { animalClasses } : {}),
    seasonPhrase,
    windows: spans,
    declaredNoSeason,
    ...(closureStatedAs ? { closureStatedAs } : {}),
    ...(limits ? { limits: { ...limits, section } } : {}),
    conditionIds,
    caveats: [],
    notes,
    disputes: [],
    sourceId: IAC,
    sourceSection: section,
    sourceUrl: ruleUrl(section.match(/96\.\d/)[0]),
    sourceVersion: RULE_VERSION,
    authority: { level: "STATE_REGULATION", instrument: "Iowa Administrative Code, Natural Resource Commission [571], chapter 96" },
    reviewStatus: "VERIFIED",
  };
}

const ENTIRE_STATE = "Entire state open.";
/* 96.9 restates no area. Its seasons are read as statewide because the
   falconry rule names no area and 96.9(3) is a season "of each year" for the
   species it lists; ruffed grouse, whose regular season IS area-limited, is
   left out (see `refused`). */
const FALCONRY_SCOPE = "Statewide: 96.9 states no area for the falconry seasons it sets";

const falconryAutumn = (phrase) => windows(phrase, (year) => fixed(year, 10, 1), (year) => fixed(year + 1, 3, 31));
const falconryLateSummer = (phrase) => windows(phrase, (year) => fixed(year, 9, 1), (year) => fixed(year + 1, 3, 31));
const FALCONRY_AUTUMN_PHRASE = "October 1 of each year through March 31 of the following year";
const FALCONRY_SUMMER_PHRASE = "September 1 of each year through March 31 of the following year";
const FALCONRY_CONDITIONS = ["us-ia-falconry-permit", "us-ia-falconry-no-gun-or-bow"];

const rules = [
  /* Pheasant — 96.1 */
  rule({
    id: "pheasant", speciesId: "species:ring-necked-pheasant", appliesWhen: NOT_FALCONRY,
    seasonLabel: "Pheasant season", animalClasses: ["COCK"],
    seasonPhrase: "the last Saturday in October through January 10 of the succeeding year",
    windows: windows("the last Saturday in October through January 10 of the succeeding year", lastSaturdayInOctober, (year) => fixed(year + 1, 1, 10)),
    limits: { daily: 3, possession: 12, statedAs: "3 cocks daily; 12 in possession", animalClass: "COCK" },
    section: "571 IAC 96.1(1)", scope: ENTIRE_STATE, conditionIds: ["us-ia-pheasant-transport"],
  }),
  rule({
    id: "pheasant-youth", speciesId: "species:ring-necked-pheasant",
    appliesWhen: { ...NOT_FALCONRY, RESIDENCY: "IOWA_RESIDENT", HUNTER_AGE: "15_OR_YOUNGER" },
    seasonLabel: "Youth pheasant hunt (Iowa residents 15 and under)", animalClasses: ["COCK"],
    seasonPhrase: "the weekend preceding the last Saturday in October",
    windows: windows("the weekend preceding the last Saturday in October", (year) => lastSaturdayInOctober(year) - 7 * DAY, (year) => lastSaturdayInOctober(year) - 6 * DAY),
    limits: { daily: 1, possession: 2, statedAs: "1 cock daily; possession limit 2 after the first day", animalClass: "COCK" },
    section: "571 IAC 96.1(3)", scope: ENTIRE_STATE, conditionIds: ["us-ia-youth-pheasant", "us-ia-pheasant-transport"],
  }),
  rule({
    id: "pheasant-falconry", speciesId: "species:ring-necked-pheasant", appliesWhen: FALCONRY,
    seasonLabel: "Falconry season (both sexes)", animalClasses: ["COCK", "HEN"],
    seasonPhrase: FALCONRY_AUTUMN_PHRASE, windows: falconryAutumn(FALCONRY_AUTUMN_PHRASE),
    limits: { daily: 2, possession: 4, statedAs: "2 pheasants daily, no more than 1 of them a hen; 4 in possession" },
    section: "571 IAC 96.9(3)(a), 96.9(4)(a)", scope: FALCONRY_SCOPE, conditionIds: [...FALCONRY_CONDITIONS, "us-ia-pheasant-transport"],
  }),

  /* Gray (Hungarian) partridge — 96.2 */
  rule({
    id: "gray-partridge", speciesId: "species:gray-partridge", appliesWhen: NOT_FALCONRY,
    seasonLabel: "Gray (Hungarian) partridge season",
    seasonPhrase: "the second Saturday in October through January 31 of the succeeding year",
    windows: windows("the second Saturday in October through January 31 of the succeeding year", secondSaturdayInOctober, (year) => fixed(year + 1, 1, 31)),
    limits: { daily: 8, possession: 16, statedAs: "8 daily; 16 in possession" },
    section: "571 IAC 96.2", scope: ENTIRE_STATE,
  }),
  rule({
    id: "gray-partridge-falconry", speciesId: "species:gray-partridge", appliesWhen: FALCONRY,
    seasonLabel: "Falconry season", seasonPhrase: FALCONRY_AUTUMN_PHRASE, windows: falconryAutumn(FALCONRY_AUTUMN_PHRASE),
    limits: { daily: 2, possession: 4, statedAs: "2 daily; 4 in possession" },
    section: "571 IAC 96.9(3)(a), 96.9(4)(b)", scope: FALCONRY_SCOPE, conditionIds: FALCONRY_CONDITIONS,
  }),

  /* Bobwhite quail — 96.3 */
  rule({
    id: "bobwhite-quail", speciesId: "species:northern-bobwhite", appliesWhen: NOT_FALCONRY,
    seasonLabel: "Bobwhite quail season",
    seasonPhrase: "the last Saturday in October through January 31 of the succeeding year",
    windows: windows("the last Saturday in October through January 31 of the succeeding year", lastSaturdayInOctober, (year) => fixed(year + 1, 1, 31)),
    limits: { daily: 8, possession: 16, statedAs: "8 daily; 16 in possession" },
    section: "571 IAC 96.3", scope: ENTIRE_STATE,
  }),
  rule({
    id: "bobwhite-quail-falconry", speciesId: "species:northern-bobwhite", appliesWhen: FALCONRY,
    seasonLabel: "Falconry season", seasonPhrase: FALCONRY_AUTUMN_PHRASE, windows: falconryAutumn(FALCONRY_AUTUMN_PHRASE),
    limits: { daily: 2, possession: 4, statedAs: "2 daily; 4 in possession" },
    section: "571 IAC 96.9(3)(a), 96.9(4)(b)", scope: FALCONRY_SCOPE, conditionIds: FALCONRY_CONDITIONS,
  }),

  /* Cottontail rabbit — 96.6 */
  rule({
    id: "cottontail", speciesId: "species:eastern-cottontail", appliesWhen: NOT_FALCONRY,
    seasonLabel: "Cottontail rabbit season",
    seasonPhrase: "the Saturday before Labor Day through February 28 of the succeeding year",
    windows: windows("the Saturday before Labor Day through February 28 of the succeeding year", saturdayBeforeLaborDay, (year) => fixed(year + 1, 2, 28)),
    limits: { daily: 10, possession: 20, statedAs: "10 daily; 20 in possession" },
    section: "571 IAC 96.6", scope: ENTIRE_STATE,
    notes: ["571 IAC 96.6 sets the season for \"cottontail rabbits\"; the eastern cottontail is answered as a cottontail rabbit."],
  }),
  rule({
    id: "cottontail-falconry", speciesId: "species:eastern-cottontail", appliesWhen: FALCONRY,
    seasonLabel: "Falconry season", seasonPhrase: FALCONRY_SUMMER_PHRASE, windows: falconryLateSummer(FALCONRY_SUMMER_PHRASE),
    limits: { daily: 4, possession: 8, statedAs: "4 daily; 8 in possession" },
    section: "571 IAC 96.9(3)(b), 96.9(4)(b)", scope: FALCONRY_SCOPE, conditionIds: FALCONRY_CONDITIONS,
  }),

  /* Jackrabbit — 96.7 and 96.9 */
  rule({
    id: "jackrabbit-closed", speciesId: "species:white-tailed-jackrabbit", appliesWhen: NOT_FALCONRY,
    seasonLabel: "Jackrabbit", seasonPhrase: "Continuous closed season.", windows: [], declaredNoSeason: true,
    closureStatedAs: "Iowa keeps a continuous closed season on jackrabbits (571 IAC 96.7); only falconry has a season.",
    section: "571 IAC 96.7", scope: ENTIRE_STATE,
  }),
  rule({
    id: "jackrabbit-falconry", speciesId: "species:white-tailed-jackrabbit", appliesWhen: FALCONRY,
    seasonLabel: "Falconry season", seasonPhrase: FALCONRY_AUTUMN_PHRASE, windows: falconryAutumn(FALCONRY_AUTUMN_PHRASE),
    limits: { daily: 1, possession: 2, statedAs: "1 daily; 2 in possession" },
    section: "571 IAC 96.9(3)(a), 96.9(4)(a)", scope: FALCONRY_SCOPE, conditionIds: FALCONRY_CONDITIONS,
  }),

  /* Squirrels (fox and gray) — 96.8. One limit across both species. */
  ...[["fox-squirrel", "species:fox-squirrel"], ["gray-squirrel", "species:eastern-gray-squirrel"]].flatMap(([slug, speciesId]) => [
    rule({
      id: slug, speciesId, appliesWhen: NOT_FALCONRY,
      seasonLabel: "Squirrel season (fox and gray)",
      seasonPhrase: "the Saturday before Labor Day through January 31 of the succeeding year",
      windows: windows("the Saturday before Labor Day through January 31 of the succeeding year", saturdayBeforeLaborDay, (year) => fixed(year + 1, 1, 31)),
      limits: { daily: 6, possession: 12, combined: true, combinedWithNames: ["fox squirrel", "gray squirrel"], statedAs: "6 squirrels daily, fox and gray together; 12 in possession" },
      section: "571 IAC 96.8", scope: ENTIRE_STATE,
    }),
    rule({
      id: `${slug}-falconry`, speciesId, appliesWhen: FALCONRY,
      seasonLabel: "Falconry season", seasonPhrase: FALCONRY_SUMMER_PHRASE, windows: falconryLateSummer(FALCONRY_SUMMER_PHRASE),
      limits: { daily: 4, possession: 8, combined: true, combinedWithNames: ["fox squirrel", "gray squirrel"], statedAs: "4 squirrels daily; 8 in possession" },
      section: "571 IAC 96.9(3)(b), 96.9(4)(b)", scope: FALCONRY_SCOPE, conditionIds: FALCONRY_CONDITIONS,
    }),
  ]),
];

/* ── Shooting hours, as the chapter states them per species ──────────────── */

const legalHours = {
  "species:ring-necked-pheasant": { basis: "FIXED_LOCAL_TIMES", opensAt: "08:00", closesAt: "16:30", statedAs: "Shooting hours are 8 a.m. to 4:30 p.m.", section: "571 IAC 96.1(1)", sourceId: IAC },
  "species:gray-partridge": { basis: "FIXED_LOCAL_TIMES", opensAt: "08:00", closesAt: "16:30", statedAs: "Shooting hours are 8 a.m. to 4:30 p.m.", section: "571 IAC 96.2", sourceId: IAC },
  "species:northern-bobwhite": { basis: "FIXED_LOCAL_TIMES", opensAt: "08:00", closesAt: "16:30", statedAs: "Shooting hours are 8 a.m. to 4:30 p.m.", section: "571 IAC 96.3", sourceId: IAC },
  "species:eastern-cottontail": { basis: "SUNRISE_TO_SUNSET", statedAs: "Shooting hours are sunrise to sunset.", section: "571 IAC 96.6", sourceId: IAC },
  /* Stated as an absence of restriction, which is a real rule — not a window
     North Ground failed to find. */
  "species:fox-squirrel": { basis: "NO_RESTRICTION", statedAs: "There are no restrictions on shooting hours.", section: "571 IAC 96.8", sourceId: IAC },
  "species:eastern-gray-squirrel": { basis: "NO_RESTRICTION", statedAs: "There are no restrictions on shooting hours.", section: "571 IAC 96.8", sourceId: IAC },
};

/* ── What this bundle deliberately does not answer ──────────────────────── */

const refused = [
  {
    what: "Ruffed grouse (571 IAC 96.4)",
    reason: "NARROWER_THAN_THE_STATE",
    detail:
      "Open only in \"that portion of the state lying north and east of a line\" along State Highway 64, U.S. 151, State Highway 13, " +
      "U.S. 20 and U.S. 63 (96.4(1)). That area is the authority's to draw; the state boundary must never stand in for it (§41A), and " +
      "North Ground holds no geometry for the highway line. Ruffed grouse stays UNKNOWN in Iowa.",
  },
  {
    what: "Ruffed grouse by falconry (571 IAC 96.9(3)(a))",
    reason: "SCOPE_NOT_STATED",
    detail: "96.9 lists ruffed grouse among its falconry species without saying whether 96.4(1)'s area limit applies to falconry. Not inferred either way.",
  },
  {
    what: "Pigeon (571 IAC 96.5)",
    reason: "SPECIES_NOT_IDENTIFIED",
    detail: "\"There is a continuous open season for hunting pigeons\" names no species, and North Ground will not choose one for it.",
  },
  {
    what: "Which methods other than falconry are lawful for these species",
    reason: "OUTSIDE_THIS_INSTRUMENT",
    detail: "Chapter 96 sets seasons, limits and hours; the legal weapons are set elsewhere and are not certified, so the non-falconry rules state no implement.",
  },
  {
    what: "Licence, habitat stamp and hunter orange",
    reason: "OUTSIDE_THIS_INSTRUMENT",
    detail:
      "Iowa Code §481A.122(2) requires blaze orange when hunting \"upland game birds, as defined by the department\"; the definition was not read, " +
      "so no orange answer is given for any species in either direction. Licence and stamp requirements are in Iowa Code chapter 483A, not read.",
  },
  {
    what: "Deer, turkey, furbearers, migratory birds and every other Iowa season",
    reason: "NOT_RESEARCHED",
    detail: "Other chapters of 571 IAC, many of them by county or zone; not read for this pilot. Chapter 97 (snipe, rail, woodcock, dove) was rescinded effective 6/18/25.",
  },
  {
    what: "State, federal and tribal land closures",
    reason: "NO_GEOMETRY",
    detail:
      "Iowa's wildlife refuges closed to hunting, federal land with its own rules (national wildlife refuges, Effigy Mounds National Monument) and " +
      "the Meskwaki Settlement are separate instruments with their own geography. None is checked at a point; every answer says so.",
  },
];

/* ── Bundle ─────────────────────────────────────────────────────────────── */

const bundle = {
  bundleId: "us-ia-2026",
  jurisdictionId: JURISDICTION,
  sourceVersion: SOURCE_VERSION,
  retrievedAt: RETRIEVED,
  geographyScope: {
    kind: "WHOLE_JURISDICTION",
    statedAs: "Entire state open.",
    resolvedBy: CENSUS,
    why:
      "Iowa publishes no small-game units; chapter 96 gives these seasons to the whole state. A point is placed in Iowa by the U.S. Census " +
      "Bureau's state boundary (TIGERweb), read live and never stored or drawn, which may place a point only for a rule whose own scope is the " +
      "whole state (CLAUDE.md §41A).",
  },
  editionCurrency: {
    checkedAt: RETRIEVED,
    statedAs:
      "The Iowa Legislature's rule listing for 571 IAC chapter 96 at publication date 10-01-2026 lists rules 96.1–96.9 at the 05-14-2025 " +
      "edition (ARC 9239C, IAB 5/14/25, effective 6/18/25). Iowa Code chapter 481A was read in the Code 2026 edition.",
    listingUrl: "https://www.legis.iowa.gov/law/administrativeRules/rules?agency=571&chapter=96&pubDate=10-01-2026",
  },
  certifiedPeriod: {
    from: "2025-06-18",
    to: "2027-06-17",
    reason:
      "Iowa's small-game seasons are STANDING rules, so this period is North Ground's declared derivation span rather than the authority's: " +
      "from the date the current text took effect (ARC 9239C, 18 June 2025) through the two season years derived (2025–26 and 2026–27). " +
      "The rules continue; what is certified is the arithmetic for these dates.",
  },
  absence: {
    meaning: "UNKNOWN",
    section: "571 IAC chapter 96",
    sourceId: IAC,
    explanation:
      "Every rule in this bundle reaches the whole state, so a place no rule reaches is outside Iowa or inside an exception, and that says " +
      "nothing about whether a season is open there.",
  },
  closedOutsideSeason: {
    statedAs: "Outside the open season the commission establishes, Iowa Code §481A.48(1) prohibits taking these species.",
    section: "Iowa Code §481A.48(1)",
    sourceId: CODE,
  },
  sources: [
    {
      id: IAC,
      title: "Iowa Administrative Code 571—Chapter 96, Small Game Hunting",
      url: "https://www.legis.iowa.gov/docs/iac/chapter/571.96.pdf",
      authority: "Iowa Natural Resource Commission, published by the Iowa Legislature",
      edition: "IAC 5/14/25 (ARC 9239C, effective 6/18/25)",
      contentHash: "sha256:970fefc2c3356a515a78aecaa8eec1e32f3cb452cdbad5acd95216a353007c8a",
      accessState: "PUBLIC_READABLE",
      reuseState: "UNSTATED",
      archiveState: "UNCONFIRMED",
      derivedFactsState: "USABLE",
      termsStatus: "NOT_LOCATED",
      retrievalMethod: "OFFICIAL_PDF",
      lastVerified: RETRIEVED,
      authorityLevel: "PRIMARY_GOVERNMENT",
      conditions,
    },
    {
      id: CODE,
      title: "Iowa Code 2026, chapter 481A, Wildlife Conservation",
      url: "https://www.legis.iowa.gov/docs/code/481A.pdf",
      authority: "Iowa Legislature",
      edition: "Iowa Code 2026",
      contentHash: "sha256:8579ba090f5674bbcf89af86aeb5cfcad65ad7373c7b462f9004480888672475",
      accessState: "PUBLIC_READABLE",
      reuseState: "UNSTATED",
      archiveState: "UNCONFIRMED",
      derivedFactsState: "USABLE",
      termsStatus: "NOT_LOCATED",
      retrievalMethod: "OFFICIAL_PDF",
      lastVerified: RETRIEVED,
      authorityLevel: "PRIMARY_GOVERNMENT",
    },
  ],
  legalHours,
  units: [],
  officialUnitCount: null,
  groups: [{ id: STATEWIDE_GROUP, officialSpec: "The whole State of Iowa (\"Entire state open.\")", zoneIds: [] }],
  rules,
  deliberatelyNotEncoded: refused,
};

writeFileSync(OUT, `${JSON.stringify(bundle, null, 2)}\n`);
console.log(`${OUT}: ${rules.length} rules over ${new Set(rules.map((entry) => entry.speciesId)).size} species, ${refused.length} refusals`);
