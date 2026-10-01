#!/usr/bin/env node
/**
 * Build Wyoming's certified elk bundle from the Wyoming Game and Fish
 * Commission's Chapter 7, Elk Hunting Seasons (dated April 22, 2026).
 *
 *   node scripts/build-us-wy-elk.mjs            write the bundle and certified units
 *   node scripts/build-us-wy-elk.mjs --check    exit 2 if a source moved, 3 if a committed file differs
 *
 * WHY ELK, AND ONLY ELK. Wyoming writes every species' seasons in that
 * species' own hunt areas, and the one Wyoming geography North Ground reads is
 * the Department's elk hunt area service (`layer:us-wy-elk-area`). Chapter 7's
 * table is written in exactly those 105 areas, and the builder stops unless the
 * table and the service name the same 105. Deer, antelope, moose, sheep, goat,
 * bear, lion, wolf, turkey and the upland and small game seasons are written in
 * geographies North Ground does not hold, so they are not encoded here.
 *
 * WHAT A ROW IS. Chapter 7 Section 2 is one table: hunt area(s), license type
 * (General, or limited quota Types 1–9), special archery dates, regular season
 * dates, quota, and a "limitations" cell that states the legal animal class and,
 * often, the part of the area the row is valid in. A row is one license's
 * season; one license may have several rows (any elk to Nov. 20, then
 * antlerless only). Each row becomes:
 *
 *   - a special archery rule (bow or crossbow, with an archery license — s. 3,
 *     Chapter 2 s. 11) where the row prints archery dates, and
 *   - a regular season rule (any legal weapon — Chapter 2 s. 11, Chapter 32) —
 *     archery only for Type 9 (s. 3(e)).
 *
 * WHICH LICENSE. The license is the hunt: a limited quota license is valid only
 * in its area(s) under its type's limitations, a resident general license in
 * every area whose rows name General licenses, and a nonresident region general
 * license only in its region's areas (s. 6). So the one fact asked is which
 * license, offered per place (`HUNT_CODE`), and North Ground never assumes the
 * hunter holds it.
 *
 * WHAT IS NOT RESOLVED, AND HOW IT IS KEPT. A limitation that confines a row to
 * part of an area in words ("valid off national forest", "valid in the Muddy
 * Creek drainage") is a part North Ground holds no boundary for: an UNRESOLVED
 * special geography carrying the authority's words, which the engine answers
 * as NEEDS_VERIFICATION wherever the part decides the answer. "Off national
 * forest" and "off private land" are encoded as the complements Chapter 2
 * defines them as (s. 2(ii), (jj), (qq)), so a row valid off national forest and
 * a row valid on it never leave a point in neither. Hunt Areas 75 (Grand Teton
 * National Park) and 77 (National Elk Refuge) are federal-permit hunts with
 * closures drawn on maps issued with the permit; they are not encoded and
 * answer UNKNOWN.
 *
 * Every limitation string is matched against the grammar below, and anything
 * the grammar does not recognise stops the build rather than being guessed.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  expectOne, fetchBytes, fetchJson, flatten, jurisdictionToday, pdfPages, readPreviousBundle,
  retrievedAtFor, sha256, writeOrCheck,
} from "./us-source.mjs";
import { classDefect } from "../src/lib/hunt/regulatory/physical-criterion.ts";

const BUNDLE = "content/regulatory/us-wy-elk-2026.json";
const CERTIFIED = "content/regulatory/us-wy-certified-units.json";
const TIME_ZONE = "America/Denver";
const JURISDICTION = "jurisdiction:us-wy";
const SPECIES = "species:elk";
const LICENCE_YEAR = 2026;

const CH7 = { id: "source:us-wy-elk-ch7-2026", url: "https://wgfd.wyo.gov/media/33695/download?inline", title: "Chapter 7, Elk Hunting Seasons (Wyoming Game and Fish Commission, dated April 22, 2026)" };
const CH2 = { id: "source:us-wy-general-hunting-ch2-2026", url: "https://wgfd.wyo.gov/media/33692/download?inline", title: "Chapter 2, General Hunting Regulation (Wyoming Game and Fish Commission, dated April 22, 2026)" };
const CH32 = { id: "source:us-wy-firearm-archery-ch32", url: "https://wgfd.wyo.gov/media/29250/download?inline", title: "Chapter 32, Regulation Governing Firearm Cartridges and Archery Equipment (Wyoming Game and Fish Commission, dated January 15, 2020)" };
const BROCHURE = { id: "source:us-wy-elk-brochure-2026", url: "https://wgfd.wyo.gov/media/33853/download?inline", title: "2026 Wyoming Elk Hunting Regulations (brochure)" };
const LAYER_SOURCE = "source:us-wy-elk-area-service";
const AREA_SERVICE = "https://services6.arcgis.com/cWzdqIyxbijuhPLw/arcgis/rest/services/ElkHuntAreas/FeatureServer/0/query?where=1%3D1&outFields=HUNTAREA&returnGeometry=false&f=json";
const REGULATIONS_PAGE = "https://wgfd.wyo.gov/regulations";
const AUTHORITY = "Wyoming Game and Fish Department";
const SOURCE_VERSION = "Wyoming Game and Fish Commission Chapter 7, Elk Hunting Seasons, dated April 22, 2026";
const INSTRUMENT = { level: "STATE_REGULATION", instrument: "Wyoming Game and Fish Commission Chapter 7, Elk Hunting Seasons (2026)" };

const zoneId = (area) => `management_zone:us-wy-elk-area-${area}`;
/** Hunt areas whose elk hunting is under a federal park or refuge permit (Chapter 7 s. 8). */
const FEDERAL_PERMIT_AREAS = new Set(["75", "77"]);

/* ── Reading the PDFs ───────────────────────────────────────────────────── */

/** Layout text of each page, through the pinned pypdf (scripts/pdf-layout-text.py). */
function layoutPages(bytes) {
  const run = spawnSync("python3", [new URL("./pdf-layout-text.py", import.meta.url).pathname], { input: bytes, maxBuffer: 256 * 1024 * 1024 });
  if (run.status !== 0) throw new Error(`PDF layout extraction failed (exit ${run.status}): ${run.stderr?.toString().trim() || "no output"}`);
  return JSON.parse(run.stdout.toString("utf8"));
}

async function readPdf(source, { layout = false } = {}) {
  const bytes = await fetchBytes(source.url);
  const { pypdf, pages } = layout ? layoutPages(bytes) : pdfPages(bytes);
  return { sha256: sha256(bytes), pypdf, pages, text: pages.map(flatten).join(" ") };
}

/* ── Chapter 7 Section 2: the season table ─────────────────────────────── */

const DATE = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\. (\d{1,2})/g;
const HAS_DATE = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\. \d{1,2}/;
const HEADER = /CHAPTER 7|ELK HUNTING SEASONS|Section [12]\.|Hunt areas, season dates|Statutes §|Special\s+Regular|Hunt\s+Archery Dates|Area\s+Type\s+Opens|Chronic Wasting|regarding Chronic|Please see Important Hunting/;

/**
 * The rows of Section 2, read by column. A row whose dates sit under "Special
 * Archery Dates" is an archery season and one whose dates sit under "Regular
 * Season Dates" is a regular season; Chapter 7 leaves the other cells blank, so
 * the printed column is the only thing that says which. A row printing four
 * dates has both. Continuation lines carry more hunt areas (left column), the
 * rest of a type ("Youth only"), or the rest of the limitation (right column);
 * anything else stops the build.
 */
export function readSeasonTable(pages) {
  const rows = [];
  let current = null;
  let ended = false;
  for (let page = 0; page < pages.length && !ended; page += 1) {
    for (const raw of pages[page].split("\n")) {
      if (/Section 3\.\s+Special Archery Seasons/.test(raw)) { ended = true; break; }
      const line = raw.replace(/\s+$/, "");
      if (!line.trim() || /^\s*7-\d+$/.test(line) || HEADER.test(line)) continue;
      const closed = /^\s{0,4}(\d{1,3})\s+Closed$/.exec(line);
      if (closed) {
        current = { page: page + 1, areas: closed[1], type: "", typeMore: [], dates: [], quota: null, limitation: ["Closed"], closed: true };
        rows.push(current);
        continue;
      }
      const start = /^\s{0,4}(\d{1,3}(?:, ?\d{1,3})*,?)(?:\s+(Gen-?|Youth|\d{1,2}))?(?=\s|$)/.exec(line);
      if (start && (start[2] || HAS_DATE.test(line))) {
        const dates = [...line.matchAll(DATE)].map((match) => ({ column: match.index, text: match[0] }));
        const lastEnd = dates.length ? dates.at(-1).column + dates.at(-1).text.length : start[0].length;
        const tail = line.slice(lastEnd);
        const quota = /^\s+(Unlimited|\d+)(?=\s{2,}|$)/.exec(tail);
        const limitation = (quota ? tail.slice(quota[0].length) : tail).trim();
        current = { page: page + 1, areas: start[1], type: start[2] ?? "", typeMore: [], dates, quota: quota ? quota[1] : null, limitation: limitation ? [limitation] : [], closed: false };
        rows.push(current);
        continue;
      }
      if (!current) throw new Error(`Chapter 7 p. ${page + 1}: a line before the first row: "${line.trim()}"`);
      for (const segment of line.matchAll(/\S+(?: \S+)*/g)) {
        const column = segment.index;
        if (column < 8 && /^\d{1,3},?$/.test(segment[0])) current.areas += ` ${segment[0]}`;
        else if (column >= 8 && column < 40) current.typeMore.push(segment[0]);
        else if (column >= 100) current.limitation.push(segment[0]);
        else throw new Error(`Chapter 7 p. ${page + 1}: "${segment[0]}" at column ${column} belongs to no column of the season table`);
      }
    }
  }
  if (!ended) throw new Error("Chapter 7: Section 3 (Special Archery Seasons) not found after the season table");
  return rows.map((row) => {
    if (![0, 2, 4].includes(row.dates.length)) throw new Error(`Chapter 7 p. ${row.page}: a row with ${row.dates.length} dates`);
    const four = row.dates.length === 4;
    const two = row.dates.length === 2;
    /* Archery dates print under "Special Archery Dates" (columns 20–45 in the
       layout text); regular dates under "Regular Season Dates" (59 and right). */
    const archery = four ? row.dates.slice(0, 2) : two && row.dates[0].column < 50 ? row.dates : [];
    const regular = four ? row.dates.slice(2) : two && row.dates[0].column >= 50 ? row.dates : [];
    if (four && !(row.dates[0].column < 50 && row.dates[2].column >= 50)) throw new Error(`Chapter 7 p. ${row.page}: four dates not in the archery and regular columns`);
    const typeText = [row.type, ...row.typeMore].join(" ").trim();
    return {
      page: row.page,
      areas: row.areas.split(/[,\s]+/).filter(Boolean).map((area) => String(Number(area))),
      type: typeText.startsWith("Gen") ? "Gen" : typeText,
      typeStatedAs: typeText,
      archery: archery.map((date) => date.text),
      regular: regular.map((date) => date.text),
      quota: row.quota,
      limitation: row.limitation.join(" ").replace(/\s+/g, " ").trim(),
      closed: row.closed,
    };
  });
}

/* ── What a limitation cell means ───────────────────────────────────────── */

const CLASS_PREFIXES = [
  ["Any elk, archery only", "ANY", true],
  ["Any elk, spikes excluded", "ANY_NO_SPIKE", false],
  ["Antlered elk, spikes excluded", "ANTLERED_NO_SPIKE", false],
  ["Antlered elk five (5) points or less on either antler", "ANTLERED_MAX5", false],
  ["Antlered elk four (4) points or less on either antler", "ANTLERED_MAX4", false],
  ["Spike or antlerless elk", "SPIKE_OR_ANTLERLESS", false],
  ["Antlered elk", "ANTLERED", false],
  ["Antlerless elk", "ANTLERLESS", false],
  ["Cow or calf", "COW_OR_CALF", false],
  ["Any elk", "ANY", false],
];

/**
 * Cells whose words cannot be read by the clause grammar without a reading of
 * which areas they reach. Each reading is recorded here, with why.
 */
const READINGS = {
  /* Antlered elk are legal everywhere in Area 36 (on national forest by the
     first clause, and off it as "any elk"); only antlerless elk depend on the
     land. Encoded so, a point is never refused for not knowing the land when
     an antlered elk is legal on both sides. */
  "Antlered elk valid on national forest; any elk off national forest": () => [
    { classKey: "ANTLERED", own: { kind: "WHOLE" } },
    { classKey: "ANY", own: { kind: "OFF", what: "national forest" } },
  ],
  /* The same shape: antlered with four points or less everywhere, any elk
     within two miles of the irrigation project. */
  "Antlered elk four (4) points or less on either antler; any elk valid within two (2) miles of the Farson-Eden Irrigation Project": () => [
    { classKey: "ANTLERED_MAX4", own: { kind: "WHOLE" } },
    { classKey: "ANY", own: { kind: "PART", text: "within two (2) miles of the Farson-Eden Irrigation Project" } },
  ],
  /* The cell names Area 100 itself: the license reaches the described land in
     both Area 25 and Area 100. */
  "Cow or calf valid on or within one-half (1/2) mile of private land adjoining the Sweetwater River in Area 25 and Area 100 west of the Three Forks-Atlantic City Road (Fremont County Road 512 and B.L.M. Road 2317)": (row) => {
    if (row.areas.join(",") !== "25") throw new Error("the Area 25/100 cell moved");
    const text = "on or within one-half (1/2) mile of private land adjoining the Sweetwater River in Area 25 and Area 100 west of the Three Forks-Atlantic City Road (Fremont County Road 512 and B.L.M. Road 2317)";
    return [{ classKey: "COW_OR_CALF", own: { kind: "PART", text }, extend: [{ areas: ["100"], text }] }];
  },
  /* A row for Areas 84 and 85 whose cell describes a different part of each. */
  "Cow or calf valid on private land in Area 84; also valid in that portion of Area 85 on or within 200 yards of irrigated land north of Fall Creek": (row) => {
    if (row.areas.join(",") !== "84,85") throw new Error("the Area 84/85 cell moved");
    return [{
      classKey: "COW_OR_CALF",
      own: { kind: "NONE" },
      extend: [
        { areas: ["84"], text: "on private land in Area 84" },
        { areas: ["85"], text: "that portion of Area 85 on or within 200 yards of irrigated land north of Fall Creek" },
      ],
    }];
  },
  /* The second clause names no hunt area. The North Fork of the Shoshone River
     drainage lies partly in Area 54 and in Areas 55 and 56 (Section 9's own
     descriptions name it for those three and no others), so the clause may
     reach any of them; which, the cell does not say. */
  "Cow or calf valid north of the Clark's Fork River and west of Wyoming Highway 120; also valid within the North Fork of the Shoshone River drainage": (row) => {
    if (row.areas.join(",") !== "54") throw new Error("the Area 54 cell moved");
    return [{
      classKey: "COW_OR_CALF",
      own: { kind: "PART", text: "north of the Clark's Fork River and west of Wyoming Highway 120" },
      extend: [{ areas: ["54", "55", "56"], text: "within the North Fork of the Shoshone River drainage", unnamedArea: true }],
    }];
  },
};

/** Clauses after the first that describe more of the row's OWN area(s). */
const OWN_MORE = /^(?:also valid (?:in all of Platte County|on or within .+|off national forest in the remainder of the area|within the Grass Creek drainage .+)|not valid in .+)$/;

/**
 * A limitation cell, as structure: which class, valid where in the row's own
 * area(s), what else it reaches, what is closed. Throws on any wording the
 * grammar does not recognise.
 */
export function readLimitation(row) {
  let text = row.limitation;
  const youth = text.endsWith("; youth only");
  if (youth) text = text.slice(0, -"; youth only".length);
  if (READINGS[text]) return { youth, archeryOnly: false, parts: READINGS[text](row) };

  const prefix = CLASS_PREFIXES.find(([words]) => text === words || text.startsWith(`${words} `) || text.startsWith(`${words};`));
  if (!prefix) throw new Error(`Chapter 7 p. ${row.page}: limitation "${row.limitation}" names no class North Ground recognises`);
  const [words, classKey, archeryOnly] = prefix;
  const clauses = text.slice(words.length).split("; ");
  const first = clauses.shift().trim();
  const part = { classKey, own: { kind: "WHOLE" }, extend: [], exclude: [], closedAfter: null };
  if (first && first !== "valid in the entire area") {
    const qualifier = first.replace(/^valid /, "");
    if (qualifier === "off national forest") part.own = { kind: "OFF", what: "national forest" };
    else if (qualifier === "on national forest") part.own = { kind: "ON", what: "national forest" };
    else if (qualifier === "off private land") part.own = { kind: "OFF", what: "private land" };
    else if (qualifier === "on private land") part.own = { kind: "ON", what: "private land" };
    else part.own = { kind: "PART", text: qualifier };
  }
  for (const clause of clauses) {
    let match;
    if ((match = /^also valid in Area (\d+)$/.exec(clause))) part.extend.push({ areas: [match[1]], whole: true });
    else if ((match = /^also valid in (?:that portion of )?Area (\d+) (.+)$/.exec(clause))) part.extend.push({ areas: [match[1]], text: clause.replace(/^also valid /, "") });
    else if ((match = /^also valid on private land in Areas (\d+) and (\d+)$/.exec(clause))) {
      part.extend.push({ areas: [match[1]], on: "private land" }, { areas: [match[2]], on: "private land" });
    } else if (OWN_MORE.test(clause)) {
      if (part.own.kind === "WHOLE") throw new Error(`Chapter 7 p. ${row.page}: "${clause}" extends an area already valid whole`);
      const before = part.own.kind === "PART" ? part.own.text : `${part.own.kind === "ON" ? "on" : "off"} ${part.own.what}`;
      part.own = { kind: "PART", text: `${before}; ${clause}` };
    } else if ((match = /^except (.+) shall be closed after (Nov)\. (\d{1,2})$/.exec(clause))) {
      part.closedAfter = { text: match[1], afterIso: isoDate(`${match[2]}. ${match[3]}`), statedAs: clause };
    } else if ((match = /^except (.+) shall be closed$/.exec(clause))) part.exclude.push({ text: match[1], statedAs: clause });
    else throw new Error(`Chapter 7 p. ${row.page}: clause "${clause}" in "${row.limitation}" is not understood`);
  }
  if (archeryOnly !== (row.type === "9")) throw new Error(`Chapter 7 p. ${row.page}: "archery only" on a Type ${row.type} row, or a Type 9 row without it`);
  return { youth, archeryOnly, parts: [part] };
}

const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

/** A printed day in the 2026 seasons: August–December 2026, January 2027. */
function isoDate(printed) {
  const match = /^([A-Z][a-z]{2})\. (\d{1,2})$/.exec(printed);
  if (!match || !MONTHS[match[1]]) throw new Error(`Unreadable date "${printed}"`);
  const month = MONTHS[match[1]];
  if (month > 1 && month < 8) throw new Error(`"${printed}" falls outside the August–January seasons Chapter 7 sets`);
  const year = month === 1 ? LICENCE_YEAR + 1 : LICENCE_YEAR;
  const date = new Date(Date.UTC(year, month - 1, Number(match[2])));
  if (date.getUTCMonth() !== month - 1) throw new Error(`"${printed}" names a day that does not exist`);
  return `${year}-${String(month).padStart(2, "0")}-${String(match[2]).padStart(2, "0")}`;
}

function windowOf(pair) {
  const opensIso = isoDate(pair[0]);
  const closesIso = isoDate(pair[1]);
  if (closesIso < opensIso) throw new Error(`${pair.join(" – ")} closes before it opens`);
  return { opensIso, closesIso, statedAs: `${pair[0]} – ${pair[1]}` };
}

const dayBefore = (iso) => new Date(Date.parse(`${iso}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
const dayAfter = (iso) => new Date(Date.parse(`${iso}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/* ── Legal animal classes ───────────────────────────────────────────────── */

const CLASS_ID = (slug) => `legal_animal_class:us-wy-elk-${slug}`;

/*
 * The tokens are what a scannable row prints. A class narrower than "antlered"
 * gets its own token, because the row has no room for the criterion and
 * "Antlered" printed for "five points or less" or for "spike" would tell a
 * hunter a six-point bull is legal. The legal test itself lives in the class
 * (`legalAnimalClasses`), never in the token.
 */
const CLASSES = {
  ANY: { tokens: ["ANTLERED", "ANTLERLESS"], ids: [CLASS_ID("antlered"), CLASS_ID("antlerless")], label: "any elk" },
  ANTLERED: { tokens: ["ANTLERED"], ids: [CLASS_ID("antlered")], label: "antlered elk", antleredOnly: true },
  ANTLERLESS: { tokens: ["ANTLERLESS"], ids: [CLASS_ID("antlerless")], label: "antlerless elk" },
  COW_OR_CALF: { tokens: ["COW_OR_CALF"], ids: [CLASS_ID("cow-or-calf")], label: "cow or calf" },
  ANTLERED_NO_SPIKE: { tokens: ["ANTLERED_SPIKES_EXCLUDED"], ids: [CLASS_ID("antlered-spikes-excluded")], label: "antlered elk, spikes excluded", antleredOnly: true },
  ANY_NO_SPIKE: { tokens: ["ANTLERED_SPIKES_EXCLUDED", "ANTLERLESS"], ids: [CLASS_ID("antlered-spikes-excluded"), CLASS_ID("antlerless")], label: "any elk, spikes excluded" },
  ANTLERED_MAX5: { tokens: ["ANTLERED_FIVE_POINTS_OR_LESS"], ids: [CLASS_ID("antlered-five-points-or-less")], label: "antlered elk, five points or less on either antler", antleredOnly: true },
  ANTLERED_MAX4: { tokens: ["ANTLERED_FOUR_POINTS_OR_LESS"], ids: [CLASS_ID("antlered-four-points-or-less")], label: "antlered elk, four points or less on either antler", antleredOnly: true },
  SPIKE_OR_ANTLERLESS: { tokens: ["SPIKE", "ANTLERLESS"], ids: [CLASS_ID("spike"), CLASS_ID("antlerless")], label: "spike or antlerless elk" },
};

function legalAnimalClasses() {
  const points = (count, word) => ({
    measure: "ANTLER_POINT_COUNT",
    comparator: "AT_MOST",
    published: [{ value: count, unit: "points" }],
    /* "on either antler" with a maximum: Chapter 2 s. 2(c) says how points are
       counted only where a MINIMUM is specified, so whether this reads as each
       antler or one antler is not settled by the authority. */
    aggregation: "UNSTATED",
    statedAs: `Antlered elk ${word} (${count}) points or less on either antler`,
    statedLanguage: "en",
    sourceId: CH7.id,
    sourceSection: "Section 2; “Point” means any protrusion from an antler one (1) inch or more in length (Chapter 2 s. 2(oo))",
  });
  return [
    { id: CLASS_ID("antlered"), statedAs: "Antlered elk", statedLanguage: "en", appliesToSpecies: [SPECIES], criterionStatus: "NOT_MEASURED", sourceId: CH2.id },
    { id: CLASS_ID("antlerless"), statedAs: "Antlerless elk", statedLanguage: "en", appliesToSpecies: [SPECIES], criterionStatus: "BY_NEGATION", negates: CLASS_ID("antlered"), sourceId: CH2.id },
    { id: CLASS_ID("cow-or-calf"), statedAs: "Cow or calf", statedLanguage: "en", appliesToSpecies: [SPECIES], criterionStatus: "NOT_MEASURED", sourceId: CH2.id },
    { id: CLASS_ID("spike"), statedAs: "Spike elk", statedLanguage: "en", appliesToSpecies: [SPECIES], criterionStatus: "NOT_MEASURED", sourceId: CH2.id },
    { id: CLASS_ID("antlered-spikes-excluded"), statedAs: "Antlered elk, spikes excluded", statedLanguage: "en", appliesToSpecies: [SPECIES], criterionStatus: "NOT_MEASURED", sourceId: CH7.id },
    { id: CLASS_ID("antlered-five-points-or-less"), statedAs: "Antlered elk five (5) points or less on either antler", statedLanguage: "en", appliesToSpecies: [SPECIES], criterionStatus: "STATED", criterion: points(5, "five"), sourceId: CH7.id },
    { id: CLASS_ID("antlered-four-points-or-less"), statedAs: "Antlered elk four (4) points or less on either antler", statedLanguage: "en", appliesToSpecies: [SPECIES], criterionStatus: "STATED", criterion: points(4, "four"), sourceId: CH7.id },
  ];
}

/* ── Special geographies: parts of areas held only in words ─────────────── */

const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const shortHash = (text) => createHash("sha256").update(text).digest("hex").slice(0, 6);

function landSpecial(area, what) {
  const definition = what === "national forest"
    ? "“On National Forest” means lands administered by the U.S. Forest Service; “Off National Forest” means lands other than those (Chapter 2 s. 2(ii), (jj))."
    : "“Private Land” means all fee title/deeded lands owned by a private individual, partnership or corporation (Chapter 2 s. 2(qq)).";
  return {
    id: `us-wy-elk-area-${area}-on-${slug(what)}`,
    name: `${what === "national forest" ? "National forest land" : "Private land"} in Elk Hunt Area ${area}`,
    resolution: "UNRESOLVED",
    candidateAreas: [area],
    statedAs: definition,
    reason: `Some Chapter 7 seasons in Elk Hunt Area ${area} are valid only on or only off ${what}. North Ground holds no ${what === "national forest" ? "land-administration" : "land-ownership"} boundary, so it cannot say which side of it this point is on.`,
  };
}

function partSpecial(areas, text, { closed = false, unnamedArea = false, row }) {
  const id = `us-wy-elk-area-${areas.join("-")}-${slug(text).slice(0, 48).replace(/-+$/, "")}-${shortHash(text)}`;
  const where = areas.length > 1 ? `Elk Hunt Areas ${areas.join(", ")}` : `Elk Hunt Area ${areas[0]}`;
  return {
    id,
    name: closed ? `Closed part of ${where}` : `Part of ${where}: ${text}`,
    resolution: "UNRESOLVED",
    candidateAreas: areas,
    statedAs: `Chapter 7 Section 2, ${where}: ${closed ? "closed in" : "valid"} “${text}”`,
    reason: closed
      ? `Chapter 7 closes this part of ${where} in words: “${text}”. North Ground holds no boundary for it, so it cannot say whether this point is inside it.`
      : `Chapter 7 makes this season valid only in a part of ${where} described in words: “${text}”.` +
        (unnamedArea ? " The regulation names no hunt area for this part; it is checked in each area whose Section 9 description includes it." : "") +
        " North Ground holds no boundary for that part, so it cannot say whether this point is inside it.",
  };
}

/* ── Conditions ─────────────────────────────────────────────────────────── */

function conditions(region, specialManagementAreas) {
  return {
    [CH7.id]: [
      { id: "wy-elk-general-license", sourceId: CH7.id, sourceSection: "Section 2; Section 6",
        text: "A general elk license is required. A resident general license is valid in every hunt area whose seasons name General licenses; a nonresident region general license is valid only in its own region's areas. North Ground cannot see which license you hold." },
      { id: "wy-elk-limited-quota-license", sourceId: CH7.id, sourceSection: "Section 2; Section 3(d)",
        text: "This season is for the limited quota elk license of this hunt area and type, valid only in its area(s) and under its type's limitations. North Ground cannot see whether you hold one." },
      { id: "wy-elk-archery-license", sourceId: CH7.id, sourceSection: "Section 3(b); Chapter 2 s. 11",
        text: "A special archery season needs an archery license as well as your elk license, and only archery equipment may be used." },
      { id: "wy-elk-type-9-archery-only", sourceId: CH7.id, sourceSection: "Section 3(e)",
        text: "Type 9 licenses are valid for archery only and need no separate archery license." },
      { id: "wy-elk-special-management-permit", sourceId: CH7.id, sourceSection: "Section 7",
        zoneIds: specialManagementAreas.map(zoneId),
        text: "An Elk Special Management Permit is required to hunt elk in this hunt area, and must be carried while hunting." },
      { id: "wy-elk-youth-antlerless", sourceId: CH7.id, sourceSection: "Section 5",
        text: "A youth hunter whose full price license is valid for an antlered elk may take an antlerless elk instead, in the hunt area(s) where the license is valid." },
      { id: "wy-elk-youth-only", sourceId: CH7.id, sourceSection: "Section 2",
        text: "Youth only: this season is open only to hunters holding a youth license." },
    ],
    [CH2.id]: [
      { id: "wy-elk-bag-limit", sourceId: CH2.id, sourceSection: "Section 3",
        text: "One elk per license." },
    ],
    [BROCHURE.id]: [
      { id: "wy-hunter-orange", sourceId: BROCHURE.id, sourceSection: "p. 9, Clothing Requirements",
        text: "During a regular season, wear at least one exterior garment of fluorescent orange or fluorescent pink — a hat, shirt, jacket, coat, vest or sweater. Orange or pink camouflage is legal." },
      { id: "wy-nonresident-wilderness-guide", sourceId: BROCHURE.id, sourceSection: "p. 9, Guides Required; Exceptions",
        text: "A nonresident may hunt elk in a designated wilderness area only with a licensed professional guide or a resident guide." },
      { id: "wy-conservation-stamp", sourceId: BROCHURE.id, sourceSection: "p. 6, Conservation Stamp",
        text: "A Wyoming conservation stamp is required to hunt, unless your license is one the brochure lists as exempt." },
    ],
  };
}

/* ── Build ──────────────────────────────────────────────────────────────── */

const IMPLEMENTS_ARCHERY = ["BOW", "CROSSBOW"];
const IMPLEMENTS_REGULAR = ["FIREARM", "MUZZLELOADER", "SHOTGUN", "BOW", "CROSSBOW"];

async function main() {
  const check = process.argv.includes("--check");
  const [ch7, ch2, ch32, brochure, service, regulationsPage] = await Promise.all([
    readPdf(CH7, { layout: true }), readPdf(CH2), readPdf(CH32), readPdf(BROCHURE), fetchJson(AREA_SERVICE),
    fetchBytes(REGULATIONS_PAGE).then((bytes) => bytes.toString("utf8")),
  ]);

  /* ── Currency: the regulations page links these exact documents, and each is dated. */
  for (const [source, title] of [[CH7, "CH 7 Final April 2026"], [CH2, "CH 2 Final April 2026"], [CH32, "Regulation Governing Firearm Cartridges and Archery Equipment - Chapter 32"], [BROCHURE, "2026_Big game regulations_Elk"]]) {
    const path = new URL(source.url).pathname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!new RegExp(`href="${path}\\?inline"[^>]*title="${title}"`).test(regulationsPage)) {
      throw new Error(`${REGULATIONS_PAGE} no longer links ${source.url} as “${title}”. Read the current edition before rebuilding.`);
    }
  }
  expectOne(ch7.text, /Dated: April 22, 2026/, "Chapter 7 date");
  expectOne(ch2.text, /Dated: April 22, 2026/, "Chapter 2 date");
  expectOne(ch32.text, /Dated: January 15, 2020/, "Chapter 32 date");
  if (ch7.pages.length !== 45) throw new Error(`Chapter 7 has ${ch7.pages.length} pages; 45 were reviewed`);

  /* ── Every sentence North Ground relies on outside the table, as published. */
  expectOne(ch7.text, /\(b\) Archers shall possess a limited quota elk license or a General elk license and an archery license in order to hunt elk with archery equipment during any special archery season\./, "archery license (Ch. 7 s. 3(b))");
  expectOne(ch7.text, /\(c\) Archers with a General elk license shall only hunt in those hunt areas open to hunting with a General license/, "general archers (Ch. 7 s. 3(c))");
  expectOne(ch7.text, /\(e\) Type 9 limited quota elk licenses are valid for “archery only” and do not require a separate archery license\./, "Type 9 (Ch. 7 s. 3(e))");
  expectOne(ch7.text, /may hunt elk starting five \(5\) days prior to the earliest opening regular season date/, "season extension permit (Ch. 7 s. 4)");
  expectOne(ch7.text, /Youth hunters who possess a full price elk license valid for the taking of an antlered elk may take either an antlered elk as specified in Section 2 of this Chapter or may take an antlerless elk in the hunt area\(s\) where their license is valid\./, "youth (Ch. 7 s. 5)");
  expectOne(ch7.text, /\(a\) Nonresident region general elk licenses shall only be valid within the specific region for which they are issued and only for those hunt areas in the region as listed in this section\./, "region licenses (Ch. 7 s. 6(a))");
  const regionTable = expectOne(ch7.text, /Region Elk Hunt Areas Quotas Eastern ([\d, -]+?) (\d{4}) Southern ([\d, -]+?) (\d{4}) Western ([\d, -]+?) (\d{4}) ([\d, -]+?) Section 7\. Elk Special Management Permit/, "region table (Ch. 7 s. 6(b))");
  const smp = expectOne(ch7.text, /An Elk Special Management Permit shall be required of any person who hunts elk in the hunt areas identified in subsection \(a\) of this section\..*?\(a\) Elk Hunt Areas ([\d, -]+)\./, "special management permit (Ch. 7 s. 7)");
  expectOne(ch2.text, /Big game, trophy game and small game animals may only be taken from one-half \(1\/2\) hour before sunrise to one-half \(1\/2\) hour after sunset\./, "hours (Ch. 2 s. 5(a))");
  expectOne(ch2.text, /one \(1\) elk per license/, "bag limit (Ch. 2 s. 3)");
  expectOne(ch2.text, /Legal archery equipment and firearms may be used to hunt big game or trophy game animals during the regular hunting seasons as set forth in Commission regulations\./, "regular-season weapons (Ch. 2 s. 11)");
  expectOne(ch2.text, /All areas within the State not opened by specific order of the Commission shall be closed to the taking of all big game animals/, "closed areas (Ch. 2 s. 19)");
  expectOne(ch2.text, /“Antlered” means a deer, elk or moose that has visible antler growth plainly protruding from the skull\./, "antlered (Ch. 2 s. 2(c))");
  expectOne(ch2.text, /“Antlerless” means a deer, elk or moose that has no antler growth plainly protruding from the skull\./, "antlerless (Ch. 2 s. 2(d))");
  expectOne(ch2.text, /“Point” means any protrusion from an antler one \(1\) inch or more in length\./, "point (Ch. 2 s. 2(oo))");
  expectOne(ch2.text, /“Spike Elk” means an elk with at least one \(1\) antler consisting of a single unbranched beam\./, "spike elk (Ch. 2 s. 2(zz))");
  expectOne(ch2.text, /“Off National Forest” means lands other than those administered by the U\.S\. Forest Service\./, "off national forest (Ch. 2 s. 2(ii))");
  expectOne(ch2.text, /“Private Land” means all fee title\/deeded lands owned by a private individual, partnership or corporation\./, "private land (Ch. 2 s. 2(qq))");
  expectOne(ch32.text, /“Archery Equipment” means crossbows, longbows, recurve bows, compound bows, arrows and bolts\./, "archery equipment (Ch. 32 s. 3(a))");
  expectOne(ch32.text, /\(a\) For the taking of bighorn sheep, elk, moose, mountain goat or black bear by the use of a firearm, a hunter shall use:/, "elk firearms (Ch. 32 s. 4(a))");
  expectOne(ch32.text, /\(iii\) Any shotgun firing “00” or larger buckshot, or a slug\. \(b\) For the taking of antelope/, "elk shotgun (Ch. 32 s. 4(a)(iii))");
  expectOne(ch32.text, /\(c\) For the taking of any big or trophy game animal with a crossbow, a hunter shall use a crossbow having a peak draw weight of at least ninety \(90\) pounds/, "crossbow (Ch. 32 s. 6(c))");
  const page = (number) => flatten(brochure.pages[number - 1]);
  expectOne(page(6), /Hunters and anglers must purchase a conservation stamp prior to hunting and fishing in Wyoming\./, "conservation stamp (brochure p. 6)");
  expectOne(page(9), /shall wear in a visible manner one \(1\) or more exterior garments of a/, "orange (brochure p. 9)");
  expectOne(page(9), /fluorescent orange or fluorescent pink color that shall include at least/, "orange colours (brochure p. 9)");
  expectOne(page(9), /Archers and crossbow hunters hunting during a special archery/, "orange archery exemption (brochure p. 9)");
  expectOne(page(9), /No nonresident shall hunt big or trophy game animals on any designat- ed wilderness area, as defined by federal or state law, in Wyoming un- less accompanied by a licensed professional guide or a resident guide\./, "wilderness guide (brochure p. 9)");

  const expandList = (list) => list.split(/,\s*/).map((token) => token.replace(/\s+/g, "")).filter(Boolean).flatMap((token) => {
    const range = /^(\d+)-(\d+)$/.exec(token);
    if (range) return Array.from({ length: Number(range[2]) - Number(range[1]) + 1 }, (_, index) => String(Number(range[1]) + index));
    if (!/^\d+$/.test(token)) throw new Error(`Unreadable hunt area "${token}"`);
    return [token];
  });
  const REGIONS = {
    EASTERN: { name: "Eastern", areas: expandList(regionTable[1]), quota: Number(regionTable[2]) },
    SOUTHERN: { name: "Southern", areas: expandList(regionTable[3]), quota: Number(regionTable[4]) },
    WESTERN: { name: "Western", areas: expandList(`${regionTable[5]}, ${regionTable[7]}`), quota: Number(regionTable[6]) },
  };
  const specialManagementAreas = expandList(smp[1]);

  /* ── The geography the table is written in is the geography North Ground reads. */
  const layerAreas = new Set((service.features ?? []).map((feature) => String(feature.attributes.HUNTAREA)));
  if (layerAreas.size !== 105) throw new Error(`The elk hunt area service lists ${layerAreas.size} areas; 105 were reviewed`);

  const rows = readSeasonTable(ch7.pages);
  if (rows.length !== 464) throw new Error(`Chapter 7 Section 2 has ${rows.length} rows; 464 were reviewed`);
  const tableAreas = new Set(rows.flatMap((row) => row.areas));
  const missing = [...layerAreas].filter((area) => !tableAreas.has(area));
  const extra = [...tableAreas].filter((area) => !layerAreas.has(area));
  if (missing.length || extra.length) throw new Error(`Chapter 7 and the area service disagree: not in the table ${missing}, not in the service ${extra}`);

  const regionOf = (area) => Object.entries(REGIONS).find(([, region]) => region.areas.includes(area))?.[0] ?? null;
  const generalAreas = new Set(rows.filter((row) => row.type === "Gen").flatMap((row) => row.areas));
  for (const area of generalAreas) if (!regionOf(area)) throw new Error(`Area ${area} names General licenses but is in no nonresident region`);

  /* ── Hunt codes: the licenses ────────────────────────────────────────── */

  const codeOf = (row) => `Area ${row.areas.join(", ")} Type ${row.type}`;
  const huntCodes = new Map();
  const ensureCode = (code, make) => { if (!huntCodes.has(code)) huntCodes.set(code, make()); return huntCodes.get(code); };
  const GENERAL = "General (resident)";
  const regionCode = (key) => `Nonresident ${REGIONS[key].name} Region general`;

  const encoded = rows.filter((row) => !row.areas.some((area) => FEDERAL_PERMIT_AREAS.has(area)));
  const quotas = new Map();
  for (const row of encoded) {
    if (row.closed || row.type === "Gen") continue;
    if (!/^[1-9]$/.test(row.type)) throw new Error(`Chapter 7 p. ${row.page}: license type "${row.type}" is not a limited quota type`);
    const code = codeOf(row);
    if (row.quota) {
      if (quotas.has(code) && quotas.get(code) !== row.quota) throw new Error(`${code} prints two quotas`);
      quotas.set(code, row.quota);
    }
  }

  const specials = new Map();
  const groups = new Map();
  const rules = [];
  const addSpecial = (entry) => { if (!specials.has(entry.id)) specials.set(entry.id, entry); return entry.id; };
  const rowIndex = new Map();

  for (const row of encoded) {
    if (row.closed) {
      const area = row.areas[0];
      const groupId = `regulatory_group:us-wy-elk-2026-area-${area}-closed`;
      groups.set(groupId, { id: groupId, officialSpec: `Elk Hunt Area ${area}: Closed (Chapter 7, Section 2)`, zoneIds: [zoneId(area)], partialZoneIds: [] });
      rules.push({
        id: `regulatory_rule:us-wy-elk-2026-area-${area}-closed`,
        speciesId: SPECIES,
        regulatoryGroupId: groupId,
        geography: { statedAs: `Elk Hunt Area ${area}`, include: { ghas: [area], gbhz: [], special: [] }, exclude: { ghas: [], special: [] } },
        appliesWhen: {},
        seasonLabel: "No elk season",
        seasonPhrase: "Closed",
        windows: [],
        declaredNoSeason: true,
        closureStatedAs: "Closed",
        conditionIds: [],
        caveats: [],
        notes: [],
        disputes: [],
        sourceId: CH7.id,
        sourceSection: `Section 2, Area ${area}`,
        sourceVersion: SOURCE_VERSION,
        reviewStatus: "VERIFIED",
        authority: INSTRUMENT,
      });
      continue;
    }

    const { youth, archeryOnly, parts } = readLimitation(row);
    const codes = row.type === "Gen"
      ? [GENERAL, regionCode(regionOf(row.areas[0]))]
      : [codeOf(row)];
    if (row.type === "Gen" && row.areas.length !== 1) throw new Error(`Chapter 7 p. ${row.page}: a General row for several areas`);

    for (const code of codes) {
      const isGeneral = row.type === "Gen";
      const regionKey = isGeneral && code !== GENERAL ? regionOf(row.areas[0]) : null;
      const codeSlug = slug(code);
      const groupId = `regulatory_group:us-wy-elk-2026-${codeSlug}`;
      const huntCode = ensureCode(code, () => ({
        id: `hunt_code:us-wy-elk-${codeSlug}`,
        code,
        jurisdictionId: JURISDICTION,
        authorityTerm: "elk license",
        speciesId: SPECIES,
        geography: {
          regulatoryGroupId: groupId,
          statedAs: !isGeneral
            ? `Elk Hunt Area${row.areas.length > 1 ? "s" : ""} ${row.areas.join(", ")}`
            : regionKey
              ? `the ${REGIONS[regionKey].name} Region's elk hunt areas open to general licenses (Chapter 7, Section 6)`
              : "every elk hunt area whose Chapter 7 seasons name General licenses",
        },
        allocation: isGeneral && !regionKey
          ? { method: "GENERAL", authorityTerm: "resident general elk license" }
          : isGeneral
            ? { method: "DRAW", authorityTerm: "nonresident region general elk license", quota: { count: REGIONS[regionKey].quota, statedAs: `${REGIONS[regionKey].quota} licenses for the ${REGIONS[regionKey].name} Region`, sourceSection: "Section 6(b)" } }
            : {
              method: "DRAW",
              authorityTerm: "limited quota elk license",
              quota: quotas.get(code) === "Unlimited"
                ? { count: null, statedAs: "Unlimited", sourceSection: "Section 2" }
                : { count: Number(quotas.get(code)), statedAs: `${quotas.get(code)} licenses`, sourceSection: "Section 2" },
            },
        requiresAuthorizations: [
          isGeneral ? (regionKey ? "authorization:us-wy-nonresident-region-general-elk-license" : "authorization:us-wy-resident-general-elk-license") : `authorization:us-wy-elk-limited-quota-type-${row.type}`,
          "authorization:us-wy-conservation-stamp",
        ],
        sourceId: CH7.id,
        sourceSection: isGeneral ? "Section 2; Section 6" : "Section 2",
      }));
      if (!isGeneral && !quotas.has(code)) throw new Error(`${code} prints no quota`);

      const index = (rowIndex.get(code) ?? 0) + 1;
      rowIndex.set(code, index);
      const group = groups.get(groupId) ?? { id: groupId, officialSpec: "", zoneIds: [], partialZoneIds: [] };
      group.officialSpec = isGeneral
        ? `${code}: ${huntCode.geography.statedAs} (Chapter 7, Section 2)`
        : `${code} (Chapter 7, Section 2)`;

      parts.forEach((part, partIndex) => {
        const cls = CLASSES[part.classKey];
        const include = { ghas: [], gbhz: [], special: [] };
        const exclude = { ghas: [], special: [] };
        const whole = [];
        const partial = [];
        for (const area of row.areas) {
          if (part.own.kind === "WHOLE") { include.ghas.push(area); whole.push(area); }
          else if (part.own.kind === "OFF") { include.ghas.push(area); exclude.special.push(addSpecial(landSpecial(area, part.own.what))); partial.push(area); }
          else if (part.own.kind === "ON") { include.special.push(addSpecial(landSpecial(area, part.own.what))); partial.push(area); }
          else if (part.own.kind === "PART") { include.special.push(addSpecial(partSpecial([area], part.own.text, { row }))); partial.push(area); }
        }
        for (const extension of part.extend ?? []) {
          for (const area of extension.areas) {
            if (!layerAreas.has(area)) throw new Error(`Chapter 7 p. ${row.page}: extends to Area ${area}, which the service does not publish`);
          }
          if (extension.whole) { include.ghas.push(...extension.areas); whole.push(...extension.areas); }
          else if (extension.on) { for (const area of extension.areas) include.special.push(addSpecial(landSpecial(area, extension.on))); partial.push(...extension.areas); }
          else { include.special.push(addSpecial(partSpecial(extension.areas, extension.text, { row, unnamedArea: extension.unnamedArea }))); partial.push(...extension.areas); }
        }
        for (const closure of part.exclude ?? []) {
          for (const area of row.areas) exclude.special.push(addSpecial(partSpecial([area], closure.text, { row, closed: true })));
        }
        group.zoneIds = [...new Set([...group.zoneIds, ...whole.map(zoneId)])];
        group.partialZoneIds = [...new Set([...group.partialZoneIds, ...partial.map(zoneId)])].filter((id) => !group.zoneIds.includes(id));

        const segments = [];
        if (row.archery.length) segments.push({ kind: "archery", window: windowOf(row.archery) });
        if (row.regular.length) {
          const window = windowOf(row.regular);
          if (part.closedAfter && part.closedAfter.afterIso < window.closesIso && part.closedAfter.afterIso >= window.opensIso) {
            segments.push({ kind: "regular", window: { opensIso: window.opensIso, closesIso: part.closedAfter.afterIso, statedAs: window.statedAs } });
            segments.push({ kind: "regular", window: { opensIso: dayAfter(part.closedAfter.afterIso), closesIso: window.closesIso, statedAs: window.statedAs }, closedPart: part.closedAfter });
          } else if (part.closedAfter) {
            throw new Error(`Chapter 7 p. ${row.page}: "${part.closedAfter.statedAs}" falls outside its regular season`);
          } else segments.push({ kind: "regular", window });
        }
        if (!segments.length) throw new Error(`Chapter 7 p. ${row.page}: a row with no season`);

        segments.forEach((segment, segmentIndex) => {
          const archery = segment.kind === "archery";
          const segmentExclude = { ghas: [...exclude.ghas], special: [...exclude.special] };
          if (segment.closedPart) for (const area of row.areas) segmentExclude.special.push(addSpecial(partSpecial([area], segment.closedPart.text, { row, closed: true })));
          const implementsHere = archery || archeryOnly ? IMPLEMENTS_ARCHERY : IMPLEMENTS_REGULAR;
          const conditionIds = [
            isGeneral ? "wy-elk-general-license" : "wy-elk-limited-quota-license",
            "wy-conservation-stamp",
            ...(archery ? ["wy-elk-archery-license"] : []),
            ...(archeryOnly ? ["wy-elk-type-9-archery-only"] : []),
            ...(!archery && !archeryOnly ? ["wy-hunter-orange"] : []),
            ...(youth ? ["wy-elk-youth-only"] : []),
            ...(cls.antleredOnly ? ["wy-elk-youth-antlerless"] : []),
            "wy-elk-special-management-permit",
            "wy-nonresident-wilderness-guide",
            "wy-elk-bag-limit",
          ];
          const seasonName = archery ? "Special Archery Season" : archeryOnly ? "Regular Hunting Season, archery only" : "Regular Hunting Season";
          rules.push({
            id: `regulatory_rule:us-wy-elk-2026-${codeSlug}-row-${index}${parts.length > 1 ? `-part-${partIndex + 1}` : ""}-${archery ? "archery" : "regular"}${segments.filter((entry) => entry.kind === segment.kind).length > 1 ? `-${segmentIndex + 1}` : ""}`,
            speciesId: SPECIES,
            regulatoryGroupId: groupId,
            geography: {
              statedAs: `${code}: ${row.limitation}`,
              include: { ghas: [...new Set(include.ghas)], gbhz: [], special: [...new Set(include.special)] },
              exclude: { ghas: segmentExclude.ghas, special: [...new Set(segmentExclude.special)] },
            },
            appliesWhen: {
              HUNT_CODE: code,
              permittedImplements: implementsHere,
              ...(youth ? { HUNTER_AGE: "YOUTH" } : {}),
            },
            seasonLabel: `${code} — ${seasonName.toLowerCase()} (${cls.label})`,
            seasonPhrase: segment.window.statedAs,
            implementLabel: seasonName,
            windows: [segment.window],
            declaredNoSeason: false,
            animalClasses: cls.tokens,
            legalAnimalClassIds: cls.ids,
            limits: { bag: 1, statedAs: "One elk per license" },
            conditionIds,
            caveats: [],
            notes: [],
            disputes: [],
            sourceId: CH7.id,
            sourceSection: `Section 2, p. 7-${row.page}, ${row.type === "Gen" ? "General" : `Type ${row.type}`}, Area ${row.areas.join(", ")}${archery ? " (special archery dates)" : ""}`,
            sourceVersion: SOURCE_VERSION,
            reviewStatus: "VERIFIED",
            huntCodeId: huntCode.id,
            authority: INSTRUMENT,
          });
        });
      });
      groups.set(groupId, group);
    }
  }

  const ruleIds = rules.map((rule) => rule.id);
  if (new Set(ruleIds).size !== ruleIds.length) throw new Error("Two rules share an id");
  const classes = legalAnimalClasses();
  for (const entry of classes) { const defect = classDefect(entry); if (defect) throw new Error(defect); }

  const sourceHashes = {
    ch7: ch7.sha256, ch7Text: sha256(JSON.stringify(ch7.pages)),
    ch2: ch2.sha256, ch2Text: sha256(JSON.stringify(ch2.pages)),
    ch32: ch32.sha256, ch32Text: sha256(JSON.stringify(ch32.pages)),
    brochureText: sha256(JSON.stringify(brochure.pages)),
    areas: sha256(JSON.stringify([...layerAreas].sort((a, b) => Number(a) - Number(b)))),
  };
  const contentHash = sha256(JSON.stringify(sourceHashes));
  const previous = readPreviousBundle(BUNDLE);
  const retrievedAt = retrievedAtFor(previous, previous?.contentHash, contentHash, jurisdictionToday(TIME_ZONE));
  const areaList = [...layerAreas].sort((a, b) => Number(a) - Number(b));
  const conditionsBySource = conditions(REGIONS, specialManagementAreas);
  const reached = new Set(rules.flatMap((rule) => [...rule.geography.include.ghas, ...rule.geography.include.special.flatMap((id) => specials.get(id).candidateAreas)]));

  const bundle = {
    schemaVersion: 1,
    bundleId: "regulatory_bundle:us-wy-elk-2026",
    jurisdictionId: JURISDICTION,
    sourceVersion: SOURCE_VERSION,
    retrievedAt,
    contentHash,
    certifiedPeriod: {
      from: "2026-08-01",
      to: "2027-01-31",
      reason: "Chapter 7 (dated April 22, 2026) sets elk seasons from August 1, 2026 to January 31, 2027. North Ground has not established the date it took effect or the instrument that follows it, so dates outside those seasons are not answered from it.",
    },
    absence: {
      meaning: "UNKNOWN",
      excludedCombination: "CLOSED",
      /* OURS: Chapter 7 sets every elk season by hunt area and license type, and
         Chapter 2 s. 19 closes what no Commission order opens; the reading that a
         license, weapon or date no row of this area opens is therefore closed to
         that hunter is North Ground's. */
      words: {
        owner: "NORTH_GROUND",
        text: "Chapter 7 sets every elk season by hunt area and license type, and Chapter 2 Section 19 closes every area the Commission has not opened. A license, weapon or date that no season in this area opens is closed to you.",
      },
      section: "Chapter 7 Section 2; Chapter 2 Section 19",
      sourceId: CH7.id,
    },
    officialUnitCount: layerAreas.size,
    units: areaList.map((area) => ({ identifier: area, zoneId: zoneId(area) })),
    specialGeographies: [...specials.values()].sort((a, b) => a.id.localeCompare(b.id)),
    legalAnimalClasses: classes,
    sources: [
      { id: CH7.id, authority: AUTHORITY, title: CH7.title, url: CH7.url, extractedWith: `pypdf ${ch7.pypdf} (layout)`, sourceHashes, conditions: conditionsBySource[CH7.id] },
      { id: CH2.id, authority: AUTHORITY, title: CH2.title, url: CH2.url, conditions: conditionsBySource[CH2.id] },
      { id: CH32.id, authority: AUTHORITY, title: CH32.title, url: CH32.url },
      { id: BROCHURE.id, authority: AUTHORITY, title: BROCHURE.title, url: BROCHURE.url, conditions: conditionsBySource[BROCHURE.id] },
    ],
    sourceRecords: [
      { id: CH7.id, authority: AUTHORITY, title: CH7.title, url: CH7.url },
      { id: CH2.id, authority: AUTHORITY, title: CH2.title, url: CH2.url },
      { id: CH32.id, authority: AUTHORITY, title: CH32.title, url: CH32.url },
      { id: BROCHURE.id, authority: AUTHORITY, title: BROCHURE.title, url: BROCHURE.url },
      { id: LAYER_SOURCE, authority: AUTHORITY, title: "Elk Hunt Areas (feature service)", url: "https://services6.arcgis.com/cWzdqIyxbijuhPLw/arcgis/rest/services/ElkHuntAreas/FeatureServer/0" },
    ],
    limitations: [
      "Wyoming's elk hunt area map is general reference; the written hunt area descriptions in Chapter 7, Section 9 control. Near a boundary, confirm which area you are in.",
      "Elk Hunt Areas 75 (Grand Teton National Park) and 77 (National Elk Refuge) are hunted with a federal park or refuge permit, under closures drawn on maps issued with it (Chapter 7, Section 8). North Ground has not certified them.",
      "A holder of a Hunting Season Extension Permit may begin five days before the earliest regular opening for their license (Chapter 7, Section 4). North Ground does not evaluate that permit, so a closed answer in those five days does not describe it.",
      "Commission seasons outside Chapter 7, such as depredation seasons, can add elk hunts (Chapter 2, Section 3). North Ground has not certified them. A season may also be closed on 48 hours' notice in an emergency (Chapter 2, Section 8).",
      "Federal, tribal (including the Wind River Reservation), private-land permission, travel and wilderness-access rules are not evaluated.",
      "This is a state-licensed recreational result. It does not describe hunting under tribal authority or treaty rights, which North Ground does not evaluate.",
    ],
    huntCodes: [...huntCodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
    groups: [...groups.values()].sort((a, b) => a.id.localeCompare(b.id)),
    rules: rules.sort((a, b) => a.id.localeCompare(b.id)),
  };

  const certified = {
    jurisdictionId: JURISDICTION,
    layerId: "layer:us-wy-elk-area",
    officialUnitCount: layerAreas.size,
    certifiedUnits: areaList.filter((area) => reached.has(area)),
  };
  writeOrCheck({ check, outputs: { [BUNDLE]: bundle, [CERTIFIED]: certified }, bundlePath: BUNDLE, contentHash, previous, label: "Wyoming elk 2026" });
  if (!check) {
    console.log(`${encoded.length} of ${rows.length} rows encoded (${rows.length - encoded.length} in Areas 75 and 77 not); ${rules.length} rules, ${huntCodes.size} licenses, ${specials.size} parts held in words; ${certified.certifiedUnits.length} of ${layerAreas.size} areas certified.`);
  }
}

main().catch((error) => {
  console.error(`Wyoming elk build failed: ${error.message}`);
  process.exit(1);
});
