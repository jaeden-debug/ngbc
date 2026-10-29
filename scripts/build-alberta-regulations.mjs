#!/usr/bin/env node
/**
 * Build Alberta's certified regulatory bundle from the 2026 hunting guide.
 *
 *   node scripts/build-alberta-regulations.mjs                    # write the bundle
 *   node scripts/build-alberta-regulations.mjs --check            # exit 2 if a source moved,
 *                                                                 # 3 if the bundle is not what this builds
 *   node scripts/build-alberta-regulations.mjs --emit-rows FILE   # rows for the PDF cross-check
 *
 * First wave, chosen to prove three different shapes of rule:
 *
 *   ruffed, spruce and sharp-tailed grouse   straightforward: where and when, nothing asked
 *   white-tailed deer                        conditional: implement, antler class and licence
 *
 * White-tailed deer is where Alberta's model differs from Ontario's. Each cell of
 * the season table is an archery-only or a general season, and a ■ on the cell
 * means it "appl[ies] only to hunters with applicable special licences" — drawn
 * authorisations North Ground cannot see. So a season existing is not a season
 * open to the person asking: the licence is asked, answered as an assumption,
 * and never verified.
 *
 * Every rule is generated; none is written by hand. An unrecognised row, cell,
 * footnote, unit or date stops the build. A row the government PDF does not
 * confirm is published as a dispute, which the engine answers as CONFLICT.
 */

import { readFileSync, writeFileSync } from "node:fs";
import {
  GUIDE_CATALOGUE_URL, GUIDE_HTML_BASE, GUIDE_PDF_URL,
  anchorWindow, cellText, expandWmuSpec, fetchBytes, fetchOfficialWmuIdentifiers, fetchText, officialWmuIdentifiersFrom,
  parseFootnotes, parseSeasonCell, parseTables, regulatoryContent, sha256, withoutSundays,
} from "./alberta-source.mjs";
import { jurisdictionToday, readPreviousBundle, retrievedAtFor } from "./ontario-source.mjs";

const OUTPUT = "content/regulatory/ca-ab-2026.json";
const CERTIFIED_UNITS_OUTPUT = "content/regulatory/ca-ab-certified-units.json";
const CROSSCHECK = "content/regulatory/sources/ca-ab-hunting-guide-2026-crosscheck.json";
const LICENCE_YEAR = 2026;
const SOURCE_ID = "source:ca-ab-hunting-guide-2026";
const SOURCE_VERSION = "2026 Alberta Guide to Hunting Regulations";
const TIME_ZONE = "America/Edmonton";

/** Region pages of the online edition and the PDF page each one reproduces. */
const REGIONS = [
  { page: "wmu100", pdfPage: 47, name: "Prairie WMUs (100 series & 732)" },
  { page: "wmu200", pdfPage: 50, name: "Parkland WMUs (200 series & 728, 730, 936)" },
  { page: "wmu300", pdfPage: 52, name: "Foothills WMUs (300 series)" },
  { page: "wmu400", pdfPage: 54, name: "Mountain WMUs (400 series)" },
  { page: "wmu500", pdfPage: 56, name: "Boreal WMUs (500 series & 841)" },
];
const BIRD_PAGE = { page: "bird-seasons", pdfPage: 63, name: "Game Bird Seasons and Bag Limits" };

/**
 * Big-game species rows encoded, keyed by the table's species cell in lower
 * case, and the rows read past. White-tailed deer keeps the row keys it was
 * certified under; the second wave (2026-10-29) adds mule deer, moose and elk.
 */
const BIG_GAME_ENCODED = {
  "white-tailed deer": { speciesId: "species:white-tailed-deer", slug: "white-tailed-deer" },
  "mule deer": { speciesId: "species:mule-deer", slug: "mule-deer" },
  "moose": { speciesId: "species:moose", slug: "moose" },
  "elk": { speciesId: "species:elk", slug: "elk" },
};
const BIG_GAME_NOT_YET = ["Class 1 sheep"];
/** The black bear table (its own page), and the rows of it a licence year this bundle certifies. */
const BEAR_PAGE = { page: "bear-cougar-seasons", pdfPage: 58, name: "Black Bear Seasons" };
/** Additional special-licence draw hunts, printed outside the region tables (Big Game Regulations page). */
const GAME_REGS_PAGE = { page: "gameregs", name: "Big Game Regulations" };
/**
 * Units where hunting big game with a rifle or shotgun is unlawful (General
 * Regulations, "It is unlawful to … set out, use or employ … a rifle or
 * shotgun in WMUs 212, 247, 248 or 410"). A general season there is open only
 * to a muzzleloader, crossbow or bow unless its own footnote says otherwise.
 */
const RIFLE_SHOTGUN_PROHIBITED_SPEC = "212, 247, 248, 410";
const NO_RIFLE_OR_SHOTGUN_IMPLEMENTS = ["MUZZLELOADER", "CROSSBOW", "BOW"];
/** Parkland footnote 2: "open to hunting only by means of archery, crossbow, muzzle loader or shotgun". */
const PRIMITIVE_SEASON_IMPLEMENTS = ["SHOTGUN", "MUZZLELOADER", "CROSSBOW", "BOW"];
/** Rows that only point elsewhere in the guide. */
const NAVIGATION_ROW = /^Click here for /;

const BIRDS_ENCODED = {
  "Ruffed grouse": "species:ruffed-grouse",
  "Spruce grouse": "species:spruce-grouse",
  "Sharp-tailed grouse": "species:sharp-tailed-grouse",
};
const BIRDS_NOT_YET = [
  "Snow or Ross’s geese", "Canada or white-fronted geese", "Ducks, coots, snipe, cormorants", "Sandhill crane",
  "Male pheasant", "Ptarmigan", "Blue grouse", "Gray partridge", "Wild turkey", "Species",
];

/** Units where Alberta makes big-game hunting on Sunday unlawful (guide p. 31, item 15). */
const SUNDAY_PROHIBITED_SPEC = "102-160, 624, 728, 730, 936";

const GENERAL_IMPLEMENTS = ["RIFLE", "SHOTGUN", "MUZZLELOADER", "CROSSBOW", "BOW"];
const ARCHERY_IMPLEMENTS = ["BOW"];

/**
 * Footnotes this builder knows, by region page and number, and what each does.
 * Anything else a row references stops the build: a footnote can narrow a
 * season (Parkland (2) removes rifles), and dropping one silently is a wrong
 * answer. `match` is checked against the footnote's own text on every build.
 *
 *   CONDITION   attaches a condition to the rule
 *   DEFINITION  points at a class definition carried as its own condition
 *   METHODS     the window is open only to the implements listed
 *   PORTION     the special-licence windows apply to part of the unit only
 *   NOTE        information in North Ground's words, not a legal condition
 */
const KNOWN_FOOTNOTES = {
  "wmu100:1": { effect: "DEFINITION", match: /3-point or larger elk/i },
  "wmu200:1": { effect: "CONDITION", conditionId: "ab-wmu-936-discharge-permit", match: /firearms discharge permit to\s+hunt in WMU 936/i },
  "wmu200:2": { effect: "METHODS", implements: PRIMITIVE_SEASON_IMPLEMENTS, conditionId: "ab-primitive-weapons-season", match: /only by means of archery, crossbow, muzzle loader or shotgun/i },
  "wmu200:3": { effect: "DEFINITION", match: /3-point or larger elk/i },
  "wmu200:4": { effect: "NOTE", note: "Alberta issues the WMU 212 antlerless elk archery licence and the WMU 212 antlerless elk special licence with two tags each.", match: /issued with two tags/i },
  "wmu300:1": { effect: "PORTION", match: /antlerless moose in WMU 353 and antlerless elk in WMU 344 applies only to a portion of the WMU/i },
  "wmu300:2": { effect: "DEFINITION", match: /3-point or larger elk/i },
  "wmu400:1": { effect: "DEFINITION", match: /3-point or larger elk and 6-point or larger elk/i },
  "wmu400:2": { effect: "PORTION", match: /antlerless elk in WMU 438, 441 and 444 applies only to a portion of the WMU/i },
  "wmu500:1": { effect: "NOTE", note: "If hunting with an outfitter, Alberta splits these WMUs into two seasons: September 1 to October 31, or November 1 to November 30.", match: /hunting with an outfitter/i },
  "wmu500:2": { effect: "DEFINITION", match: /3-point or larger elk and 6-point or larger elk/i },
};

/** The condition a PORTION footnote attaches, by species. */
const PORTION_CONDITIONS = {
  "species:moose": "ab-moose-special-portion",
  "species:elk": "ab-elk-special-portion",
};

/* ── Conditions: what every answer must carry, in the guide's own terms ─── */

const CONDITIONS = [
  {
    id: "ab-licence-required",
    text: "A Wildlife Identification Number, a wildlife certificate and a licence for this species are required. North Ground has not verified what you hold.",
    sourceSection: "p. 21, Licences",
  },
  {
    id: "ab-special-licence",
    text: "This season applies only to hunters with an applicable special licence from the Alberta Hunting Draws. The answer assumes you hold one valid for this species, class and unit; North Ground has not verified it.",
    sourceSection: "p. 47, Big Game Seasons (■)",
  },
  {
    id: "ab-bowhunting-permit",
    text: "Hunting with a bow and arrow also requires a bowhunting permit (not required for a crossbow).",
    sourceSection: "p. 21, Licences",
  },
  {
    id: "ab-non-resident-big-game",
    text: "Licences open to non-residents differ from residents', and non-residents hunt big game with a resident hunter host or a designated guide.",
    sourceSection: "p. 17, Definitions; pp. 24–26, Licences",
  },
  {
    id: "ab-sunday-big-game",
    text: "Hunting big game on Sundays is unlawful in WMUs 102–160, 624, 728, 730 and 936; Sundays are excluded from the dates given here.",
    sourceSection: "p. 31, Unlawful activities, item 15",
  },
  {
    id: "ab-cwd-head-submission",
    text: "Heads of deer harvested in specific WMUs must be submitted for chronic wasting disease testing.",
    sourceSection: "pp. 3, 33 and 66",
  },
  {
    id: "ab-wmu-936-discharge-permit",
    text: "Hunters, including bowhunters, require a firearms discharge permit to hunt in WMU 936 (Cooking Lake–Blackfoot Provincial Recreation Area).",
    sourceSection: "p. 50, Parkland footnote 1; p. 63",
    /*
     * The permit is WMU 936's alone, but the footnote rides on rules whose
     * groups span dozens of units — so without this the engine told a hunter in
     * WMU 102 that they needed a WMU 936 discharge permit. A restriction
     * stricter than the source is as false as a looser one (§8). A literal,
     * because `zoneId` is declared below this table.
     */
    zoneIds: ["management_zone:ca-ab-wmu-936"],
  },
  {
    id: "ab-game-bird-licence",
    text: "A wildlife certificate and an Alberta game bird licence are required. North Ground has not verified what you hold.",
    sourceSection: "p. 21, Licences",
  },
  {
    id: "ab-cfb-wainwright",
    text: "WMUs 728 and 730 (CFB Wainwright): every hunter attends a mandatory 7:00 am safety briefing on their first day, and game-bird hunters using shotguns must use non-toxic shot.",
    sourceSection: "p. 63",
    zoneIds: ["management_zone:ca-ab-wmu-728", "management_zone:ca-ab-wmu-730"],
  },
  {
    id: "ab-no-rifle-or-shotgun",
    text: "Hunting big game with a rifle or shotgun is unlawful in WMUs 212, 247, 248 and 410; a general season there is open to a muzzleloader, crossbow or bow unless the guide states otherwise for that season.",
    sourceSection: "General Regulations, Big game — It is unlawful to set out, use or employ a rifle or shotgun in WMUs 212, 247, 248 or 410",
    zoneIds: ["management_zone:ca-ab-wmu-212", "management_zone:ca-ab-wmu-247", "management_zone:ca-ab-wmu-248", "management_zone:ca-ab-wmu-410"],
  },
  {
    id: "ab-primitive-weapons-season",
    text: "This season is open only to hunting with a bow, crossbow, muzzleloader or shotgun.",
    sourceSection: "p. 51, Parkland footnote 2",
    zoneIds: ["management_zone:ca-ab-wmu-212", "management_zone:ca-ab-wmu-248"],
  },
  {
    id: "ab-elk-three-point",
    text: "A 3-point or larger elk is a male elk with an antler whose main beam carries at least two tines, each at least 7.6 cm (3 in.) long, with the tip of the main beam at least 7.6 cm (3 in.) beyond the base of the last tine counted.",
    sourceSection: "Big Game Regulations, Big Game Identification — Three-point elk",
    speciesIds: ["species:elk"],
  },
  {
    id: "ab-elk-six-point",
    text: "A 6-point or larger elk is a male elk with an antler whose main beam carries at least five tines, each at least 7.6 cm (3 in.) long, with the tip of the main beam at least 7.6 cm (3 in.) beyond the base of the last tine counted.",
    sourceSection: "Big Game Regulations, Big Game Identification — Six-point elk",
    speciesIds: ["species:elk"],
  },
  {
    id: "ab-moose-calf",
    text: "This season is for a calf moose only, under a calf moose special licence. The guide describes a calf as small, with a short nose and face, about 1.2 m (4 ft.) high at the shoulder, and seldom alone.",
    sourceSection: "Big Game Regulations, Big Game Identification — Moose; Evidence of sex, species and class",
    speciesIds: ["species:moose"],
  },
  {
    id: "ab-moose-special-portion",
    text: "In WMU 353 the special-licence season for antlerless moose applies only to part of the unit, set out in the Alberta Hunting Draws booklet.",
    sourceSection: "p. 53, Foothills footnote 1",
    zoneIds: ["management_zone:ca-ab-wmu-353"],
    speciesIds: ["species:moose"],
  },
  {
    id: "ab-elk-special-portion",
    text: "In this WMU the special-licence (draw) season for antlerless elk applies only to part of the unit, set out in the Alberta Hunting Draws booklet; an archery season for antlerless elk there covers the whole unit.",
    sourceSection: "p. 53, Foothills footnote 1; p. 55, Mountain footnote 2",
    zoneIds: ["management_zone:ca-ab-wmu-344", "management_zone:ca-ab-wmu-438", "management_zone:ca-ab-wmu-441", "management_zone:ca-ab-wmu-444"],
    speciesIds: ["species:elk"],
  },
  {
    id: "ab-wmu-624-weekdays",
    text: "In WMU 624 this elk season is open Monday to Friday only; Saturdays and Sundays are excluded from the dates given here.",
    sourceSection: "p. 47, Prairie WMUs (WMU 624 - Monday to Friday only)",
    zoneIds: ["management_zone:ca-ab-wmu-624"],
    speciesIds: ["species:elk"],
  },
  {
    id: "ab-black-bear-cub",
    text: "It is unlawful to hunt a black bear under one year old, or a female black bear accompanied by a cub under one year old.",
    sourceSection: "p. 58, Black Bear Seasons — It is unlawful to",
    speciesIds: ["species:american-black-bear"],
  },
  {
    id: "ab-black-bear-licence",
    text: "A Wildlife Identification Number, a wildlife certificate and a black bear licence are required. North Ground has not verified what you hold.",
    sourceSection: "p. 21, Licences",
    speciesIds: ["species:american-black-bear"],
  },
];

const LIMITATIONS = [
  "Alberta's own catalogue record says the guide \"is neither a legal document nor a complete listing of current Alberta hunting regulations\"; the Wildlife Act and the Wildlife Regulation (Alta. Reg. 143/97) are the law.",
  "Alberta describes its WMU maps as small-scale approximations of units legally described in the Wildlife Regulation, which prevails near a boundary.",
  "Being inside a WMU is not permission to hunt there: land access, provincial parks, restricted areas and local bylaws are separate questions North Ground has not resolved.",
  "This is a recreational licence result. It is not a determination of treaty, Aboriginal or Métis harvesting rights.",
];

/**
 * Alberta's legal animal classes, from the guide's own definitions. "Antlered"
 * is defined once for white-tailed deer, moose and elk — and NOT for mule deer,
 * so mule deer's classes are carried as unresolved rather than borrowed.
 */
const ANTLERED_DEFINITION = "Antlered - A white-tailed deer, moose or elk having an antler exceeding 10.2 cm (4 in.) in length.";
const DEFINITIONS_SECTION = "Big Game Regulations, Big Game Identification";
const LEGAL_ANIMAL_CLASSES = [
  {
    id: "legal_animal_class:ca-ab-antlered",
    statedAs: "antlered",
    statedLanguage: "en",
    appliesToSpecies: ["species:white-tailed-deer", "species:moose", "species:elk"],
    criterionStatus: "STATED",
    criterion: {
      measure: "ANTLER_LENGTH",
      comparator: "EXCEEDING",
      published: [{ value: 10.2, unit: "cm" }, { value: 4, unit: "in" }],
      aggregation: "ANY_SIDE",
      statedAs: ANTLERED_DEFINITION,
      statedLanguage: "en",
      sourceId: SOURCE_ID,
      sourceSection: DEFINITIONS_SECTION,
    },
    sourceId: SOURCE_ID,
  },
  {
    id: "legal_animal_class:ca-ab-antlerless",
    statedAs: "antlerless",
    statedLanguage: "en",
    appliesToSpecies: ["species:white-tailed-deer", "species:moose", "species:elk"],
    criterionStatus: "BY_NEGATION",
    negates: "legal_animal_class:ca-ab-antlered",
    sourceId: SOURCE_ID,
  },
  {
    id: "legal_animal_class:ca-ab-mule-deer-antlered",
    statedAs: "antlered",
    statedLanguage: "en",
    appliesToSpecies: ["species:mule-deer"],
    criterionStatus: "UNRESOLVED",
    criterionBlocker: "The guide's definition of antlered names white-tailed deer, moose and elk, not mule deer; the Wildlife Regulation's own definition for mule deer has not been read.",
    sourceId: SOURCE_ID,
  },
  {
    id: "legal_animal_class:ca-ab-mule-deer-antlerless",
    statedAs: "antlerless",
    statedLanguage: "en",
    appliesToSpecies: ["species:mule-deer"],
    criterionStatus: "UNRESOLVED",
    criterionBlocker: "The guide's definition of antlerless names white-tailed deer, moose and elk, not mule deer; the Wildlife Regulation's own definition for mule deer has not been read.",
    sourceId: SOURCE_ID,
  },
  {
    id: "legal_animal_class:ca-ab-elk-three-point",
    statedAs: "3-point or larger",
    statedLanguage: "en",
    appliesToSpecies: ["species:elk"],
    criterionStatus: "UNRESOLVED",
    criterionBlocker: "Alberta's test is compound — at least two tines on the main beam, each at least 7.6 cm (3 in.), with the beam tip at least 7.6 cm beyond the last tine counted — and the criterion model holds one measure. The full definition is carried as condition ab-elk-three-point.",
    sourceId: SOURCE_ID,
  },
  {
    id: "legal_animal_class:ca-ab-elk-six-point",
    statedAs: "6-point or larger",
    statedLanguage: "en",
    appliesToSpecies: ["species:elk"],
    criterionStatus: "UNRESOLVED",
    criterionBlocker: "Alberta's test is compound — at least five tines on the main beam, each at least 7.6 cm (3 in.), with the beam tip at least 7.6 cm beyond the last tine counted — and the criterion model holds one measure. The full definition is carried as condition ab-elk-six-point.",
    sourceId: SOURCE_ID,
  },
  {
    id: "legal_animal_class:ca-ab-moose-calf",
    statedAs: "calf",
    statedLanguage: "en",
    appliesToSpecies: ["species:moose"],
    criterionStatus: "NOT_MEASURED",
    sourceId: SOURCE_ID,
  },
];

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const zoneId = (identifier) => `management_zone:ca-ab-wmu-${identifier}`;
const compareUnits = (a, b) => Number(a) - Number(b);

/* ── Animal classes ──────────────────────────────────────────────────────
 *
 * Alberta's classes NEST: a 6-point bull is also a 3-point bull and antlered,
 * and a moose calf is antlerless. A single class answer cannot express that,
 * so a rule MATCHES on two keys — the antler class, and for elk the point
 * class — while it DISPLAYS the class the guide printed (`animalClasses`).
 * A hunter describing a 6-point bull therefore reaches every season a 6-point
 * bull is legal in, which is what the guide's nested definitions say.
 */
const CLASS_KEY = "ANIMAL_CLASS:ANTLER_CLASS";
const POINTS_KEY = "ANIMAL_CLASS:ANTLER_POINTS";
const THREE_POINT_OR_LARGER = ["THREE_TO_FIVE_POINT", "SIX_POINT_OR_MORE"];

/**
 * The legal class a type cell states, as one or more variants. A cell naming
 * two classes with a single window set — "Antlered (6-point or larger) and
 * antlerless" — is one season in which either may be taken, but no single
 * conjunction of answers expresses it, so it becomes two rules with the same
 * dates.
 */
function classVariants(typeCell, speciesId, footnoteText) {
  const refs = [];
  const type = typeCell.replace(/\^([\d,]+)/g, (_, list) => { refs.push(...list.split(",").map(Number)); return ""; })
    .replace(/\s+/g, " ").trim();
  for (const number of refs) {
    const known = footnoteText(number);
    if (known?.effect !== "DEFINITION") throw new Error(`Class cell "${typeCell}" cites footnote ${number}, which is not a class definition`);
  }
  const antlerless = speciesId === "species:moose" ? ["ANTLERLESS", "CALF"] : "ANTLERLESS";
  const elk = (shape) => { if (speciesId !== "species:elk") throw new Error(`"${typeCell}" is an elk class on a ${speciesId} row`); return shape; };
  switch (type) {
    case "Antlered and antlerless":
      return [{ display: ["ANTLERED", "ANTLERLESS"], appliesWhen: {}, conditionIds: [] }];
    case "Antlered":
      return [{ display: ["ANTLERED"], appliesWhen: { [CLASS_KEY]: "ANTLERED" }, conditionIds: [] }];
    case "Antlerless":
      return [{ display: ["ANTLERLESS"], appliesWhen: { [CLASS_KEY]: antlerless }, conditionIds: [] }];
    case "Antlerless (calf only)":
      if (speciesId !== "species:moose") throw new Error(`"${typeCell}" on a ${speciesId} row`);
      return [{ display: ["CALF"], appliesWhen: { [CLASS_KEY]: "CALF" }, conditionIds: ["ab-moose-calf"] }];
    case "Antlered (3-point or larger)":
    case "Antlered 3-point or larger":
      return elk([{ display: ["ANTLERED_THREE_POINT_OR_LARGER"], appliesWhen: { [CLASS_KEY]: "ANTLERED", [POINTS_KEY]: THREE_POINT_OR_LARGER }, conditionIds: ["ab-elk-three-point"] }]);
    case "Antlered (6-point or larger)":
      return elk([{ display: ["ANTLERED_SIX_POINT_OR_LARGER"], appliesWhen: { [CLASS_KEY]: "ANTLERED", [POINTS_KEY]: "SIX_POINT_OR_MORE" }, conditionIds: ["ab-elk-six-point"] }]);
    case "Antlered (6-point or larger) and antlerless":
      return elk([
        { display: ["ANTLERED_SIX_POINT_OR_LARGER"], appliesWhen: { [CLASS_KEY]: "ANTLERED", [POINTS_KEY]: "SIX_POINT_OR_MORE" }, conditionIds: ["ab-elk-six-point"], variant: "six-point" },
        { display: ["ANTLERLESS"], appliesWhen: { [CLASS_KEY]: "ANTLERLESS" }, conditionIds: [], variant: "antlerless" },
      ]);
    default:
      throw new Error(`Unrecognised big-game class "${typeCell}"`);
  }
}

/** A class slug for rule ids that stays what white-tailed deer was certified under. */
function classSlugOf(variant) {
  if (!Object.keys(variant.appliesWhen).length) return "either-class";
  if (variant.variant) return variant.variant;
  return variant.display.join("-").toLowerCase().replace(/_/g, "-");
}

/* ── Units with their own days ───────────────────────────────────────────── */

const WEEKDAYS_MONDAY_TO_FRIDAY = [1, 2, 3, 4, 5];

/**
 * What a parenthesised name in a WMU cell does. Only the forms the 2026 guide
 * prints are recognised; anything else stops the build.
 */
function unitNotes(names, identifiers) {
  const weekdays = new Map();
  let mondayToSaturday = false;
  for (const name of names) {
    const perUnit = /^WMU (\d{3}) - Monday to Friday only$/.exec(name);
    if (perUnit) {
      if (!identifiers.includes(perUnit[1])) throw new Error(`"${name}" names a unit the row does not list`);
      weekdays.set(perUnit[1], WEEKDAYS_MONDAY_TO_FRIDAY);
      continue;
    }
    if (name === "Monday to Saturday only") { mondayToSaturday = true; continue; }
    if (name === "CFB Suffield" && identifiers.length === 1 && identifiers[0] === "732") continue;
    throw new Error(`Unrecognised place name "${name}" in a WMU cell`);
  }
  return { weekdays, mondayToSaturday };
}

/** A window cut to the weekdays it is open, as consecutive runs. */
function onlyOnWeekdays(window, weekdays, label) {
  const runs = [];
  let start = null;
  const day = (iso) => new Date(`${iso}T00:00:00Z`);
  const iso = (date) => date.toISOString().slice(0, 10);
  const end = day(window.closesIso);
  for (let current = day(window.opensIso); current <= end; current = new Date(current.getTime() + 86_400_000)) {
    if (!weekdays.includes(current.getUTCDay())) {
      if (start) runs.push({ opensIso: iso(start), closesIso: iso(new Date(current.getTime() - 86_400_000)) });
      start = null;
    } else if (!start) {
      start = current;
    }
  }
  if (start) runs.push({ opensIso: iso(start), closesIso: window.closesIso });
  return runs.map((run) => ({ ...run, statedAs: `${window.statedAs} (${label})` }));
}

/**
 * A season cell with each window's own footnotes. "■ N1 - N30^2 ■ D1 - D31"
 * marks only its first window, so a footnote is read per window, not per cell.
 */
function seasonWindows(cell) {
  if (!cell) return null;
  const parsed = parseSeasonCell(cell, LICENCE_YEAR);
  const pieces = cell.split("■").map((piece) => piece.trim()).filter(Boolean);
  const perWindow = pieces.length === parsed.windows.length
    ? pieces.map((piece) => [...piece.matchAll(/\^([\d,]+)/g)].flatMap((match) => match[1].split(",").map(Number)))
    : null;
  if (!perWindow && parsed.footnotes.length) throw new Error(`Season cell "${cell}" carries a footnote this builder cannot place on one window`);
  return {
    ...parsed,
    windows: parsed.windows.map((window, index) => ({ ...window, footnotes: perWindow ? perWindow[index] : [] })),
  };
}

function speciesName(cell) {
  return cell.replace(/\s+/g, " ").trim();
}

/* ── Build ───────────────────────────────────────────────────────────────── */

async function readSources(offline) {
  const pages = {};
  const pageIds = [...REGIONS, BIRD_PAGE, BEAR_PAGE, GAME_REGS_PAGE].map(({ page }) => page);
  if (offline) {
    /* A runner's saved reads, for working on the builder where the authority
       cannot be reached. Never what a committed bundle is built from: the
       build-regulations workflow runs this builder online. */
    for (const page of pageIds) pages[page] = readFileSync(`${offline}/ab-guide-${page}.html`, "utf8");
    const pdf = readFileSync(`${offline}/ab-guide-2026-pdf.pdf`);
    const officialIdentifiers = officialWmuIdentifiersFrom(JSON.parse(readFileSync(`${offline}/ab-wmu-identifiers.html`, "utf8")));
    return { pages, pdf, officialIdentifiers };
  }
  for (const page of pageIds) pages[page] = await fetchText(`${GUIDE_HTML_BASE}${page}.html`);
  const pdf = await fetchBytes(GUIDE_PDF_URL);
  const officialIdentifiers = await fetchOfficialWmuIdentifiers();
  return { pages, pdf, officialIdentifiers };
}

/**
 * Every big-game row of every region table, in printed order, for the species
 * encoded. A row is kept whole — its type, both columns and its units — and
 * each window carries its own footnotes. What the footnotes DO is decided in
 * `build`, against `KNOWN_FOOTNOTES`.
 */
function parseBigGame(pages, officialIdentifiers) {
  const rows = [];
  const sentinels = {};
  for (const region of REGIONS) {
    const html = pages[region.page];
    const tables = parseTables(html);
    if (!tables.length) throw new Error(`${region.page}: no season table`);
    const footnotes = parseFootnotes(html);
    const footnote = (number) => {
      const known = KNOWN_FOOTNOTES[`${region.page}:${number}`];
      const text = footnotes.get(number) ?? "";
      if (!known || !known.match.test(text)) {
        throw new Error(`${region.page}: footnote ${number} ("${text}") is not one this builder models`);
      }
      return known;
    };
    const [header, subheader, ...body] = tables[0];
    if (header.join("|") !== "Species|Type|SEASON|SEASON|WMUs" || subheader[2] !== "Archery Only" || subheader[3] !== "General") {
      throw new Error(`${region.page}: season table columns changed: ${JSON.stringify([header, subheader])}`);
    }
    const order = {};
    let sentinel = null;
    let encodedAny = false;
    for (const row of body) {
      const species = speciesName(row[0]).replace(/\^[\d,]+$/, "");
      const encoded = BIG_GAME_ENCODED[species.toLowerCase()];
      if (!encoded) {
        const recognised = NAVIGATION_ROW.test(species) ||
          BIG_GAME_NOT_YET.some((name) => species.toLowerCase() === name.toLowerCase());
        if (!recognised) throw new Error(`${region.page}: unrecognised species row "${species}"`);
        if (encodedAny && !sentinel && !NAVIGATION_ROW.test(species)) sentinel = row;
        continue;
      }
      if (sentinel) throw new Error(`${region.page}: an encoded ${species} row follows a row this builder reads past`);
      encodedAny = true;
      order[encoded.slug] = (order[encoded.slug] ?? 0) + 1;
      const units = expandWmuSpec(row[4], officialIdentifiers);
      const notes = unitNotes(units.names, units.identifiers);
      const archery = seasonWindows(row[2]);
      const general = seasonWindows(row[3]);
      for (const number of units.footnotes) {
        const known = footnote(number);
        if (known.effect === "DEFINITION" || known.effect === "METHODS") {
          throw new Error(`${region.page}: footnote ${number} is a ${known.effect} footnote on a WMU list`);
        }
      }
      for (const window of [...(archery?.windows ?? []), ...(general?.windows ?? [])]) {
        for (const number of window.footnotes) {
          const known = footnote(number);
          if (known.effect === "DEFINITION" || known.effect === "PORTION") {
            throw new Error(`${region.page}: footnote ${number} is a ${known.effect} footnote on a season window`);
          }
        }
      }
      /* White-tailed deer keeps the row keys it was certified under; the
         second-wave species carry their own, so no two rows share a key. */
      const key = encoded.slug === "white-tailed-deer"
        ? `${region.page}#${order[encoded.slug]}`
        : `${region.page}:${encoded.slug}#${order[encoded.slug]}`;
      rows.push({
        key,
        region,
        speciesId: encoded.speciesId,
        slug: encoded.slug,
        type: row[1],
        variants: classVariants(row[1], encoded.speciesId, footnote),
        archery,
        general,
        cells: { archery: row[2], general: row[3], wmus: row[4] },
        units: units.identifiers,
        unitFootnotes: units.footnotes.map((number) => ({ number, ...footnote(number) })),
        windowFootnote: (number) => footnote(number),
        unitNotes: notes,
      });
    }
    if (!encodedAny) throw new Error(`${region.page}: no encoded big-game rows`);
    sentinels[region.page] = sentinel ? sentinel[4] : null;
  }
  return { rows, sentinels };
}

/* ── Black bear ─────────────────────────────────────────────────────────── */

const LONG_MONTHS = { "Jan.": 1, "Feb.": 2, "Mar.": 3, "Apr.": 4, "May": 5, "June": 6, "July": 7, "Aug.": 8, "Sept.": 9, "Oct.": 10, "Nov.": 11, "Dec.": 12 };

/** "Aug. 25 – Aug. 31" in the 2026 fall season, as an ISO window. */
function longWindow(text, year) {
  const match = /^(\S+?\.?|May|June|July) (\d{1,2}) – (\S+?\.?|May|June|July) (\d{1,2})$/.exec(text.trim());
  if (!match || !LONG_MONTHS[match[1]] || !LONG_MONTHS[match[3]]) throw new Error(`Unrecognised bear season "${text}"`);
  const pad = (value) => String(value).padStart(2, "0");
  const opensIso = `${year}-${pad(LONG_MONTHS[match[1]])}-${pad(match[2])}`;
  const closesIso = `${year}-${pad(LONG_MONTHS[match[3]])}-${pad(match[4])}`;
  if (closesIso < opensIso) throw new Error(`"${text}" closes before it opens`);
  return { opensIso, closesIso, statedAs: text.trim() };
}

/**
 * The black bear table. Fall 2026 is encoded; Spring 2027 is a season of the
 * NEXT licence year ("Requires a new year licence") and lies outside the
 * period this bundle certifies, so it is recorded as read and not encoded.
 */
function parseBears(html, officialIdentifiers) {
  const table = parseTables(html)[0];
  if (!table) throw new Error("bear-cougar-seasons: no black bear table");
  const [header, subheader, ...body] = table;
  if (header.join("|") !== "Black bear season|SEASON|SEASON|WMUs" || subheader[1] !== "Archery Only" || subheader[2] !== "General") {
    throw new Error(`bear-cougar-seasons: columns changed: ${JSON.stringify([header, subheader])}`);
  }
  const rows = [];
  const spring = [];
  let order = 0;
  for (const row of body) {
    const label = row[0].replace(/\s+/g, " ").trim();
    if (/^Spring 2027 \(Requires a new year licence\)$/.test(label)) { spring.push(row); continue; }
    if (label !== "Fall 2026") throw new Error(`bear-cougar-seasons: unrecognised season "${label}"`);
    order += 1;
    const units = expandWmuSpec(row[3], officialIdentifiers);
    if (units.footnotes.length || units.names.length) throw new Error(`bear-cougar-seasons: unexpected mark in "${row[3]}"`);
    rows.push({
      key: `bear-cougar-seasons#${order}`,
      archery: row[1] ? longWindow(row[1], LICENCE_YEAR) : null,
      general: row[2] ? longWindow(row[2], LICENCE_YEAR) : null,
      cells: { archery: row[1], general: row[2], wmus: row[3] },
      units: units.identifiers,
    });
  }
  if (!rows.length) throw new Error("bear-cougar-seasons: no Fall 2026 rows");
  return { rows, springRows: spring.length };
}

/* ── Additional special-licence draw hunts ─────────────────────────────── */

/**
 * The one additional draw hunt that lands in a unit the region tables name for
 * the same species: "WMU 300 elk special licence (3-point or larger)". Its
 * dates are printed and its permitted weapons are not, so it is carried as
 * days the guide leaves unsettled (NEEDS_VERIFICATION) rather than as a season
 * — and its presence stops the region table's silence from reading as CLOSED.
 */
function parseAdditionalHunts(html) {
  const text = cellText(html).replace(/\s+/g, " ");
  const statedAs = "WMU 300 elk special licence (3-point or larger) —S9 - O24, O25 - D24, D25 - J31, 2027, F1 - F28, 2027";
  if (!text.includes(statedAs)) throw new Error(`gameregs: the WMU 300 elk additional hunt is no longer printed as "${statedAs}"`);
  const windows = ["S9 - O24", "O25 - D24", "D25 - J31, 2027", "F1 - F28, 2027"].map((window) => anchorWindow(window, LICENCE_YEAR));
  return { statedAs, windows };
}

function parseBirds(html, officialIdentifiers) {
  const table = parseTables(html)[0];
  if (!table) throw new Error("bird-seasons: no season table");
  const rows = [];
  let order = 0;
  for (const row of table) {
    const species = speciesName(row[0]);
    if (!BIRDS_ENCODED[species]) {
      if (!BIRDS_NOT_YET.includes(species)) throw new Error(`bird-seasons: unrecognised species row "${species}"`);
      continue;
    }
    if (row.length < 5 || !row[3]) continue; // the species' own heading line, before its unit rows
    order += 1;
    const units = expandWmuSpec(row[3], officialIdentifiers);
    const season = parseSeasonCell(row[4], LICENCE_YEAR);
    if (season.special || season.weekdayNote || season.footnotes.length) {
      throw new Error(`bird-seasons: ${species} row "${row[3]}" carries a mark this builder does not model`);
    }
    const daily = Number(row[1]);
    const possession = Number(row[2]);
    if (!Number.isInteger(daily) || !Number.isInteger(possession)) {
      throw new Error(`bird-seasons: unreadable limits for ${species}: ${row[1]} / ${row[2]}`);
    }
    const wainwright = units.names.some((name) => /Wainwright/.test(name));
    if (units.names.length && !wainwright) throw new Error(`bird-seasons: unexpected place name in "${row[3]}"`);
    rows.push({
      key: `bird-seasons#${order}`,
      speciesId: BIRDS_ENCODED[species],
      species,
      daily,
      possession,
      wmuText: row[3],
      seasonText: row[4],
      season,
      units: units.identifiers,
      conditionIds: [
        "ab-game-bird-licence",
        ...(wainwright ? ["ab-cfb-wainwright"] : []),
        ...(units.identifiers.includes("936") ? ["ab-wmu-936-discharge-permit"] : []),
      ],
    });
  }
  for (const species of Object.keys(BIRDS_ENCODED)) {
    if (!rows.some((row) => row.species === species)) throw new Error(`bird-seasons: no rows for ${species}`);
  }
  return rows;
}

/** The rows the PDF cross-check confirms, in the shape the Python oracle reads. */
/** The PDF pages each region's table is printed across, in order. */
const REGION_PDF_PAGES = { wmu100: [47, 50], wmu200: [50, 51], wmu300: [52, 53], wmu400: [54, 55], wmu500: [56, 57] };

/* A footnote reference stays attached to its unit as "^1.2": the PDF may fuse it
   into the number ("9361") or set it apart as a superscript, so the oracle
   matches it either way. */
const needleOf = (wmus) => wmus
  .replace(/\^(\d{1,2}(?:,\d{1,2}(?!\d))*)/g, (_, refs) => `^${refs.replace(/,/g, ".")}`)
  .split(/,\s*/).map((token) => token.trim());

/** The rows the PDF cross-check confirms, in the shape the Python oracle reads. */
function crosscheckManifest({ rows: bigGame, sentinels }, birds, bears) {
  const bigGameByPages = {};
  REGIONS.forEach((region, index) => {
    const pagesKey = REGION_PDF_PAGES[region.page].join(",");
    const list = (bigGameByPages[pagesKey] = []);
    for (const row of bigGame.filter((candidate) => candidate.region === region)) {
      list.push({
        key: row.key,
        wmus: needleOf(row.cells.wmus),
        archery: { dates: row.archery?.windows.map((window) => window.statedAs.replace(/\s+/g, " ")) ?? [], special: Boolean(row.archery?.special) },
        general: { dates: row.general?.windows.map((window) => window.statedAs.replace(/\s+/g, " ")) ?? [], special: Boolean(row.general?.special) },
      });
    }
    /* What bounds the last row: the first row read past, else the next
       region's first row, which may sit on the same printed page. Where the
       oracle cannot find it, the bottom of the region's last page bounds it. */
    const next = REGIONS[index + 1] ? bigGame.find((row) => row.region === REGIONS[index + 1]) : null;
    const bound = sentinels[region.page] ?? next?.cells.wmus ?? null;
    if (bound) {
      list.push({ key: `${region.page}#sentinel`, sentinel: true, wmus: needleOf(bound.replace(/[()]/g, "")) });
    }
  });
  return {
    pdfUrl: GUIDE_PDF_URL,
    bigGame: bigGameByPages,
    birds: {
      [BIRD_PAGE.pdfPage]: birds.map((row) => ({
        key: row.key, species: row.species, daily: row.daily, possession: row.possession,
        wmuText: row.wmuText.replace(/\s+/g, " "), season: row.seasonText.replace(/\s+/g, " "),
      })),
    },
    /* Black bear dates are printed as words ("Aug. 25 – Aug. 31"), so they
       are confirmed as text: archery-only dates, general dates, then the row's
       first units, in order on one printed line, each in its own column. */
    textRows: {
      [BEAR_PAGE.pdfPage]: bears.rows.map((row) => ({
        key: row.key,
        archery: row.cells.archery ? row.cells.archery.replace(/\s+/g, " ").trim() : null,
        general: row.cells.general ? row.cells.general.replace(/\s+/g, " ").trim() : null,
        wmus: needleOf(row.cells.wmus).slice(0, 2),
      })),
    },
  };
}

/**
 * The days a PDF disagreement is about, per column, or null when it cannot be
 * narrowed honestly.
 *
 * Each online window is matched to the date the PDF prints: identical wording
 * agrees whole; a PDF date opening the same day agrees on the days the two
 * share, and the days only one prints are unsettled; an online window the PDF
 * does not print is unsettled whole. A PDF date with no online counterpart
 * cannot be placed in a column, and a disagreement about special-licence marks
 * is not about days, so either keeps the whole row in CONFLICT.
 */
function narrowDisagreement(row, verdict) {
  if (!verdict || verdict.agree || !verdict.marksAgree || !Array.isArray(verdict.pdfDates)) return null;
  const key = (text) => text.replace(/\s+/g, " ").replace(/,\s*/g, ", ").trim();
  const remaining = verdict.pdfDates.map(key);
  const take = (predicate) => {
    const index = remaining.findIndex(predicate);
    return index < 0 ? null : remaining.splice(index, 1)[0];
  };
  const result = {};
  const pending = [];
  for (const column of ["archery", "general"]) {
    result[column] = { agreed: new Map(), unsettled: new Map() };
    for (const window of row[column]?.windows ?? []) {
      if (take((date) => date === key(window.statedAs))) result[column].agreed.set(window, [window]);
      else pending.push([column, window]);
    }
  }
  const day = (iso, offset) => new Date(Date.parse(`${iso}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
  for (const [column, window] of pending) {
    const opening = key(window.statedAs).split(" - ")[0];
    const printed = take((date) => date.split(" - ")[0] === opening);
    const words = (pdfText) => ({
      owner: "NORTH_GROUND",
      text: pdfText
        ? `Alberta's online guide prints ${key(window.statedAs)} for this season and its published PDF prints ${pdfText}. North Ground has not certified the days on which they differ; check with Alberta Fish and Wildlife.`
        : `Alberta's online guide prints ${key(window.statedAs)} for this season and its published PDF does not print it. North Ground has not certified these days; check with Alberta Fish and Wildlife.`,
    });
    if (!printed) {
      result[column].unsettled.set(window, [{ opensIso: window.opensIso, closesIso: window.closesIso, words: words(null) }]);
      continue;
    }
    const pdfWindow = anchorWindow(printed, LICENCE_YEAR);
    if (pdfWindow.opensIso !== window.opensIso) return null;
    const shorter = pdfWindow.closesIso < window.closesIso ? pdfWindow : window;
    const longer = shorter === window ? pdfWindow : window;
    result[column].agreed.set(window, [{ opensIso: shorter.opensIso, closesIso: shorter.closesIso, statedAs: shorter.statedAs }]);
    result[column].unsettled.set(window, [{ opensIso: day(shorter.closesIso, 1), closesIso: longer.closesIso, words: words(printed) }]);
  }
  return remaining.length ? null : result;
}

function build({ pages, pdf, officialIdentifiers }, crosscheck, previous) {
  const bigGameParse = parseBigGame(pages, officialIdentifiers);
  const bigGame = bigGameParse.rows;
  const birds = parseBirds(pages[BIRD_PAGE.page], officialIdentifiers);
  const bears = parseBears(pages[BEAR_PAGE.page], officialIdentifiers);
  const additional = parseAdditionalHunts(pages[GAME_REGS_PAGE.page]);
  const sunday = new Set(expandWmuSpec(SUNDAY_PROHIBITED_SPEC, officialIdentifiers).identifiers);
  const noRifleOrShotgun = new Set(expandWmuSpec(RIFLE_SHOTGUN_PROHIBITED_SPEC, officialIdentifiers).identifiers);

  const pdfHash = sha256(pdf);
  if (crosscheck.pdf.sha256 !== pdfHash) {
    throw new Error(
      `The PDF cross-check is for ${crosscheck.pdf.sha256}, but the published PDF is now ${pdfHash}. ` +
      "Re-run scripts/crosscheck-alberta-guide.py before building.",
    );
  }
  const verdicts = new Map(crosscheck.rows.map((row) => [row.key, row]));

  const groups = new Map();
  const groupFor = (identifiers, statedAs) => {
    const sorted = [...identifiers].sort(compareUnits);
    const id = `regulatory_group:ca-ab-2026-${slug(sorted.join("-")).slice(0, 80)}-${sha256(sorted.join(",")).slice(7, 15)}`;
    if (!groups.has(id)) {
      groups.set(id, { id, officialSpec: statedAs, zoneIds: sorted.map(zoneId), officialIdentifiers: sorted });
    }
    return id;
  };

  const rules = [];
  const disputesFor = (key) => {
    const verdict = verdicts.get(key);
    if (!verdict) throw new Error(`Row ${key} has no PDF cross-check verdict; re-run the cross-check`);
    /* North Ground's own cross-check found the disagreement; the sentence
       describing it is ours, not either document's. */
    return verdict.agree ? [] : [{ words: { owner: "NORTH_GROUND", text: `The online guide and the published PDF disagree for this row: ${verdict.detail}` } }];
  };

  for (const row of birds) {
    rules.push({
      id: `regulatory_rule:ca-ab-2026-${slug(row.speciesId.slice(8))}-${row.key.split("#")[1]}`,
      speciesId: row.speciesId,
      regulatoryGroupId: groupFor(row.units, row.wmuText),
      appliesWhen: {},
      seasonLabel: "Open season",
      seasonPhrase: row.seasonText,
      windows: row.season.windows,
      declaredNoSeason: false,
      limits: { daily: row.daily, possession: row.possession, combined: false, statedAs: `${row.daily} daily, ${row.possession} in possession` },
      conditionIds: row.conditionIds,
      caveats: [],
      notes: [],
      sourceId: SOURCE_ID,
      sourceSection: "p. 63, Game Bird Seasons and Bag Limits",
      sourceVersion: SOURCE_VERSION,
      reviewStatus: "VERIFIED",
      disputes: disputesFor(row.key),
    });
  }

  const DEER = new Set(["species:white-tailed-deer", "species:mule-deer"]);

  for (const row of bigGame) {
    /* Where the two channels disagree only about particular days, those days
       are unsettled and every day both print stays a season (§8: uncertainty
       about D21 – D31 must not erase S1 – D20). A disagreement that cannot be
       narrowed that way keeps the whole row in CONFLICT. */
    const narrowed = narrowDisagreement(row, verdicts.get(row.key));
    const disputes = narrowed ? [] : disputesFor(row.key);
    const unitConditions = row.unitFootnotes.filter((note) => note.effect === "CONDITION").map((note) => note.conditionId);
    const portion = row.unitFootnotes.some((note) => note.effect === "PORTION");
    const unitNotesText = row.unitFootnotes.filter((note) => note.effect === "NOTE").map((note) => note.note);
    for (const [column, cell] of [["archery", row.archery], ["general", row.general]]) {
      if (!cell) continue;
      /* Split the row's units by what changes the open days or the weapons:
         the Sunday prohibition, a unit's own weekdays (WMU 624), and the
         rifle-and-shotgun ban. A window is per rule, and the same printed
         dates are not the same open days on both sides of any of these. */
      const partitions = new Map();
      for (const unit of row.units) {
        const sundays = sunday.has(unit) || row.unitNotes.mondayToSaturday;
        const weekdays = row.unitNotes.weekdays.get(unit) ?? null;
        const bowZone = column === "general" && noRifleOrShotgun.has(unit);
        const key = `${sundays}|${weekdays ? weekdays.join("") : ""}|${bowZone}`;
        const partition = partitions.get(key) ?? { units: [], sundays, weekdays, bowZone };
        partition.units.push(unit);
        partitions.set(key, partition);
      }
      for (const partition of partitions.values()) {
        /* Windows grouped by the implements they are open to: a footnote can
           narrow one window of a cell and leave the others alone. */
        const byImplements = new Map();
        for (const window of cell.windows) {
          const methods = window.footnotes.map((number) => row.windowFootnote(number)).filter((note) => note.effect === "METHODS");
          const implementsHere = column === "archery" ? ARCHERY_IMPLEMENTS
            : methods.length ? methods[0].implements
            : partition.bowZone ? NO_RIFLE_OR_SHOTGUN_IMPLEMENTS
            : GENERAL_IMPLEMENTS;
          const extraConditions = methods.map((note) => note.conditionId);
          const notes = window.footnotes.map((number) => row.windowFootnote(number)).filter((note) => note.effect === "NOTE").map((note) => note.note);
          const groupKey = `${implementsHere.join(",")}|${extraConditions.join(",")}`;
          const group = byImplements.get(groupKey) ?? { implements: implementsHere, conditions: extraConditions, windows: [], notes: [] };
          group.windows.push(window);
          group.notes.push(...notes);
          byImplements.set(groupKey, group);
        }
        const groupsHere = [...byImplements.values()];
        const openDays = (bare) => {
          if (partition.weekdays) return onlyOnWeekdays(bare, partition.weekdays, "Monday to Friday only");
          return partition.sundays ? withoutSundays(bare) : [bare];
        };
        groupsHere.forEach((implementGroup, groupIndex) => {
          const settled = narrowed ? implementGroup.windows.flatMap((window) => narrowed[column].agreed.get(window) ?? []) : implementGroup.windows;
          const windows = settled.flatMap((window) => openDays({ opensIso: window.opensIso, closesIso: window.closesIso, statedAs: window.statedAs }));
          const unestablished = narrowed
            ? implementGroup.windows.flatMap((window) => narrowed[column].unsettled.get(window) ?? [])
              .flatMap((range) => openDays({ opensIso: range.opensIso, closesIso: range.closesIso, statedAs: "" })
                .map((run) => ({ opensIso: run.opensIso, closesIso: run.closesIso, words: range.words })))
            : [];
          for (const variant of row.variants) {
            const idParts = [
              `regulatory_rule:ca-ab-2026-${row.slug}-${row.region.page}-${row.key.split("#")[1]}`,
              column,
              classSlugOf(variant),
            ];
            if (partition.sundays) idParts.push("no-sunday");
            if (partition.weekdays) idParts.push("weekdays");
            if (partition.bowZone) idParts.push("no-rifle");
            if (groupsHere.length > 1) idParts.push(`w${groupIndex + 1}`);
            rules.push({
              id: idParts.join("-"),
              speciesId: row.speciesId,
              regulatoryGroupId: groupFor(partition.units, row.cells.wmus.replace(/\^[\d,]+/g, "")),
              appliesWhen: {
                ...variant.appliesWhen,
                ...(cell.special ? { LICENCE_TYPE: "SPECIAL" } : {}),
                permittedImplements: implementGroup.implements,
              },
              animalClasses: variant.display,
              seasonLabel: `${column === "archery" ? "Archery-only" : "General"} season${cell.special ? " (special licence)" : ""}`,
              seasonPhrase: (column === "archery" ? row.cells.archery : row.cells.general).replace(/\s*\n\s*/g, " ").replace(/\^[\d,]+/g, ""),
              windows,
              declaredNoSeason: false,
              conditionIds: [...new Set([
                cell.special ? "ab-special-licence" : "ab-licence-required",
                ...(column === "archery" ? ["ab-bowhunting-permit"] : []),
                ...(partition.sundays ? ["ab-sunday-big-game"] : []),
                ...(partition.weekdays ? ["ab-wmu-624-weekdays"] : []),
                ...(partition.bowZone ? ["ab-no-rifle-or-shotgun"] : []),
                ...(cell.special && portion ? [PORTION_CONDITIONS[row.speciesId]] : []),
                "ab-non-resident-big-game",
                ...(DEER.has(row.speciesId) ? ["ab-cwd-head-submission"] : []),
                ...variant.conditionIds,
                ...implementGroup.conditions,
                ...unitConditions,
              ])],
              caveats: [],
              notes: [
                ...(cell.weekdayNote ? [`Printed "(${cell.weekdayNote})"; every window listed falls on Wednesday to Saturday.`] : []),
                ...new Set([...unitNotesText, ...implementGroup.notes]),
              ],
              sourceId: SOURCE_ID,
              sourceSection: `p. ${row.region.pdfPage}, Big Game Seasons — ${row.region.name}`,
              sourceVersion: SOURCE_VERSION,
              reviewStatus: "VERIFIED",
              disputes,
              ...(unestablished.length ? { unestablished } : {}),
            });
          }
        });
      }
    }
  }

  /* The additional WMU 300 elk draw hunt: printed dates, unprinted weapons. */
  rules.push({
    id: "regulatory_rule:ca-ab-2026-elk-gameregs-wmu300-three-point-special",
    speciesId: "species:elk",
    regulatoryGroupId: groupFor(["300"], "WMU 300"),
    appliesWhen: { [CLASS_KEY]: "ANTLERED", [POINTS_KEY]: THREE_POINT_OR_LARGER, LICENCE_TYPE: "SPECIAL" },
    animalClasses: ["ANTLERED_THREE_POINT_OR_LARGER"],
    seasonLabel: "Additional special-licence draw hunt",
    seasonPhrase: additional.statedAs,
    windows: [],
    declaredNoSeason: false,
    conditionIds: ["ab-special-licence", "ab-elk-three-point", "ab-non-resident-big-game"],
    caveats: [],
    notes: [],
    unestablished: additional.windows.map((window) => ({
      opensIso: window.opensIso,
      closesIso: window.closesIso,
      words: {
        owner: "NORTH_GROUND",
        text: "Alberta lists a WMU 300 special-licence season for 3-point or larger elk among its additional draw hunts on these dates, without stating which weapons it allows; North Ground has not certified it. Check the 2026 Alberta Hunting Draws booklet.",
      },
    })),
    sourceId: SOURCE_ID,
    sourceSection: "Big Game Regulations, Additional Special Licence Draw Hunts",
    sourceVersion: SOURCE_VERSION,
    reviewStatus: "VERIFIED",
    disputes: [],
  });

  /* Black bear, fall 2026. The spring 2026 days belong to the previous guide,
     which North Ground has not certified, so they are unsettled, never CLOSED. */
  const springBefore = [{
    opensIso: `${LICENCE_YEAR}-04-01`,
    closesIso: `${LICENCE_YEAR}-06-30`,
    words: {
      owner: "NORTH_GROUND",
      text: "This guide prints Alberta's fall 2026 and spring 2027 black bear seasons. The spring 2026 season was set by the previous year's guide, which North Ground has not certified.",
    },
  }];
  for (const row of bears.rows) {
    const disputes = disputesFor(row.key);
    for (const [column, window] of [["archery", row.archery], ["general", row.general]]) {
      if (!window) continue;
      const partitions = [
        { units: row.units.filter((unit) => sunday.has(unit)), sundays: true },
        { units: row.units.filter((unit) => !sunday.has(unit)), sundays: false },
      ].filter(({ units }) => units.length);
      for (const partition of partitions) {
        const bowZone = column === "general" && partition.units.some((unit) => noRifleOrShotgun.has(unit));
        if (bowZone) throw new Error(`bear-cougar-seasons: a general black bear season reaches a no-rifle unit (${row.cells.wmus})`);
        rules.push({
          id: `regulatory_rule:ca-ab-2026-american-black-bear-${row.key.replace("#", "-")}-${column}${partition.sundays ? "-no-sunday" : ""}`,
          speciesId: "species:american-black-bear",
          regulatoryGroupId: groupFor(partition.units, row.cells.wmus),
          appliesWhen: { permittedImplements: column === "archery" ? ARCHERY_IMPLEMENTS : GENERAL_IMPLEMENTS },
          animalClasses: ["ANY_EXCEPT_CUB_OR_FEMALE_WITH_CUB"],
          seasonLabel: `${column === "archery" ? "Archery-only" : "General"} season, fall 2026`,
          seasonPhrase: window.statedAs,
          windows: partition.sundays ? withoutSundays(window) : [window],
          declaredNoSeason: false,
          conditionIds: [
            "ab-black-bear-licence",
            ...(column === "archery" ? ["ab-bowhunting-permit"] : []),
            ...(partition.sundays ? ["ab-sunday-big-game"] : []),
            "ab-black-bear-cub",
            "ab-non-resident-big-game",
          ],
          caveats: [],
          notes: [],
          unestablished: springBefore,
          sourceId: SOURCE_ID,
          sourceSection: `p. ${BEAR_PAGE.pdfPage}, ${BEAR_PAGE.name}`,
          sourceVersion: SOURCE_VERSION,
          reviewStatus: "VERIFIED",
          disputes,
        });
      }
    }
  }

  const ids = new Set();
  for (const rule of rules) {
    if (ids.has(rule.id)) throw new Error(`Duplicate rule id ${rule.id}`);
    ids.add(rule.id);
    /* Every window says whether it spans the turn of the year. A resolved
       window is anchored to the licence year and never wraps, so its own dates
       decide it, exactly as the month-and-day anchors would. */
    rule.windows = rule.windows.map((window) => ({ ...window, crossesYear: window.opensIso.slice(0, 4) !== window.closesIso.slice(0, 4) }));
  }

  const sourceHashes = {
    pdf: pdfHash,
    ...Object.fromEntries(Object.entries(pages).map(([page, html]) => [page, sha256(regulatoryContent(html))])),
  };
  const contentHash = sha256(JSON.stringify(sourceHashes));
  const today = jurisdictionToday(TIME_ZONE);

  /* Units with at least one certified rule, for the map's per-unit badge. A unit
     outside this list is boundary-only: its official geometry is drawn, and no
     rule is claimed inside it. */
  const reached = new Set(rules.flatMap((rule) => groups.get(rule.regulatoryGroupId).officialIdentifiers));
  const certifiedUnits = {
    jurisdictionId: "jurisdiction:ca-ab",
    layerId: "layer:ca-ab-wmu",
    officialUnitCount: officialIdentifiers.length,
    certifiedUnits: officialIdentifiers.filter((unit) => reached.has(unit)),
  };

  return {
    manifest: crosscheckManifest(bigGameParse, birds, bears),
    certifiedUnits,
    bundle: {
      schemaVersion: 1,
      bundleId: "regulatory_bundle:ca-ab-2026",
      jurisdictionId: "jurisdiction:ca-ab",
      sourceVersion: SOURCE_VERSION,
      retrievedAt: retrievedAtFor(previous, previous?.contentHash, contentHash, today),
      contentHash,
      certifiedPeriod: { from: `${LICENCE_YEAR}-04-01`, to: `${LICENCE_YEAR + 1}-03-31` },
      absence: {
        meaning: "UNKNOWN",
        /* OURS. The guide states no such thing; this is North Ground's reading
           of what its silence does and does not establish, and it says so in
           its own text. It is not verified verbatim against any source, which
           is the discriminator. */
        words: {
          owner: "NORTH_GROUND",
          text:
            "No row of the 2026 guide names this unit for this species. The guide is a summary and does not say an " +
            "unnamed unit is closed for big game, so North Ground reports UNKNOWN rather than CLOSED.",
        },
        section: "Big Game Seasons; Game Bird Seasons and Bag Limits",
        sourceId: SOURCE_ID,
        /* A unit the guide DOES name for a species has its seasons listed in
           full — every white-tailed deer unit is given both classes, both
           columns — so a combination none of them opens is closed by the
           table itself, not unknown. */
        excludedCombination: "CLOSED",
      },
      officialUnitCount: officialIdentifiers.length,
      officialIdentifiers,
      sources: [{
        id: SOURCE_ID,
        authority: "Government of Alberta (Alberta Forestry and Parks)",
        title: SOURCE_VERSION,
        url: GUIDE_PDF_URL,
        catalogueUrl: GUIDE_CATALOGUE_URL,
        parsedFrom: GUIDE_HTML_BASE,
        licence: "No open licence. North Ground records facts — dates, units, classes and limits — with the printed cell as provenance.",
        sourceHashes,
        crosscheck: { file: CROSSCHECK, rowsChecked: crosscheck.rowsChecked, disagreements: crosscheck.disagreements },
        conditions: CONDITIONS.map((condition) => ({
          ...condition,
          /* The Sunday list is a list of units; carried as zones so the `!` is
             decided by the units the law names, not by which rules carry it. */
          ...(condition.id === "ab-sunday-big-game" ? { zoneIds: [...sunday].sort(compareUnits).map(zoneId) } : {}),
          sourceId: SOURCE_ID,
        })),
      }],
      limitations: LIMITATIONS,
      notEncoded: {
        bigGame: BIG_GAME_NOT_YET,
        gameBirds: BIRDS_NOT_YET.filter((name) => name !== "Species"),
        reason: "Not yet encoded. Their rows are read and recognised, so a renamed or new row still stops the build.",
        blackBearSpring2027: {
          rows: bears.springRows,
          reason: "Printed as \"Spring 2027 (Requires a new year licence)\": a season of the next licence year, outside the period this bundle certifies.",
        },
        additionalDrawHunts: "Alberta's additional special-licence draw hunts (class 2 sheep, CFB Wainwright deer and moose, pronghorn, either-sex elk in WMUs 728 and 730, mountain goat) are not encoded; their units are not named for those species in the region tables, so they answer UNKNOWN. The WMU 300 3-point elk hunt is carried as unsettled days.",
      },
      legalAnimalClasses: LEGAL_ANIMAL_CLASSES,
      groups: [...groups.values()].sort((a, b) => a.id.localeCompare(b.id)),
      rules,
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const emitRows = args.includes("--emit-rows") ? args[args.indexOf("--emit-rows") + 1] : null;
  const offline = args.includes("--offline") ? args[args.indexOf("--offline") + 1] : null;
  const sources = await readSources(offline);

  if (emitRows) {
    const bigGame = parseBigGame(sources.pages, sources.officialIdentifiers);
    const birds = parseBirds(sources.pages[BIRD_PAGE.page], sources.officialIdentifiers);
    const bears = parseBears(sources.pages[BEAR_PAGE.page], sources.officialIdentifiers);
    writeFileSync(emitRows, `${JSON.stringify(crosscheckManifest(bigGame, birds, bears), null, 2)}\n`);
    console.log(`Wrote ${bigGame.rows.length + birds.length + bears.rows.length} rows for the PDF cross-check to ${emitRows}.`);
    return;
  }

  const crosscheck = JSON.parse(readFileSync(CROSSCHECK, "utf8"));
  const previous = readPreviousBundle(OUTPUT);

  let built;
  try {
    built = build(sources, crosscheck, previous);
  } catch (error) {
    if (check && /cross-check is for/.test(error.message)) {
      console.error(`SOURCE MOVED: ${error.message}`);
      process.exit(2);
    }
    throw error;
  }
  const { bundle, certifiedUnits } = built;

  if (check) {
    if (!previous) {
      console.error(`${OUTPUT} does not exist.`);
      process.exit(3);
    }
    if (previous.contentHash !== bundle.contentHash) {
      const moved = Object.keys(bundle.sources[0].sourceHashes)
        .filter((key) => previous.sources?.[0]?.sourceHashes?.[key] !== bundle.sources[0].sourceHashes[key]);
      console.error(`SOURCE MOVED: ${moved.join(", ")} changed since ${OUTPUT} was built. Review before rebuilding.`);
      process.exit(2);
    }
    if (JSON.stringify(previous) !== JSON.stringify(bundle)) {
      console.error(`${OUTPUT} is not what this builder produces from unchanged sources. Was it edited by hand?`);
      process.exit(3);
    }
    let previousUnits = null;
    try {
      previousUnits = readFileSync(CERTIFIED_UNITS_OUTPUT, "utf8");
    } catch {
      /* absent is reported below */
    }
    if (previousUnits !== `${JSON.stringify(certifiedUnits, null, 2)}\n`) {
      console.error(`${CERTIFIED_UNITS_OUTPUT} is missing or is not what this builder produces.`);
      process.exit(3);
    }
    console.log(`Alberta sources unchanged; ${OUTPUT} reproduces exactly.`);
    return;
  }

  writeFileSync(OUTPUT, `${JSON.stringify(bundle, null, 2)}\n`);
  writeFileSync(CERTIFIED_UNITS_OUTPUT, `${JSON.stringify(certifiedUnits, null, 2)}\n`);
  const bySpecies = {};
  for (const rule of bundle.rules) bySpecies[rule.speciesId] = (bySpecies[rule.speciesId] ?? 0) + 1;
  console.log(`Wrote ${OUTPUT}: ${bundle.rules.length} rules in ${bundle.groups.length} groups.`);
  for (const [speciesId, count] of Object.entries(bySpecies)) console.log(`  ${speciesId}: ${count} rules`);
  const disputed = bundle.rules.filter((rule) => rule.disputes.length);
  console.log(`  disputed against the PDF: ${disputed.length}`);
}

main().catch((error) => {
  console.error(`Alberta build failed: ${error.message}`);
  process.exit(1);
});
