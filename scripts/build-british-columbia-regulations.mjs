#!/usr/bin/env node
/**
 * Build British Columbia's first certified rule wave from the law itself.
 *
 *   node scripts/build-british-columbia-regulations.mjs            # fetch, build, write
 *   node scripts/build-british-columbia-regulations.mjs --check    # fail unless the committed bundle reproduces
 *   node scripts/build-british-columbia-regulations.mjs --offline <dir>  # read saved pages instead of BC Laws
 *
 * Source: the Hunting Regulation, B.C. Reg. 190/84, as BC Laws serves it (the
 * body and Schedules 1–8, one per region). Part 1 of each schedule lists open
 * seasons and bag limits (s. 4); "**" applies that schedule's Part 2 (s. 6) and
 * "***" its Part 3 (s. 7). The 2026–2028 synopsis is only a cross-check, read by
 * scripts/crosscheck-british-columbia-synopsis.py; every range the two disagree
 * on must be a reviewed dispute below, encoded as CONFLICT, never resolved.
 *
 * First wave: ruffed and spruce grouse, sharp-tailed grouse, rock and willow
 * ptarmigan, snowshoe hare and American black bear. Every Part 2 clause that
 * reaches one of them is written out in REVIEWED_PART_TWO and verified verbatim
 * against the schedule on every build; a first-wave row marked "**" that no
 * reviewed clause explains aborts the build.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  BC_DOCUMENTS, BC_LAWS, BC_SYNOPSIS_URL, BC_TIME_ZONE,
  consolidationDate, containsVerbatim, expandUnits, parseBag, parseSeasons, partOneRows, schedulePart, sha256, windowsIn,
} from "./british-columbia-source.mjs";

const OUT = "content/regulatory/ca-bc-2026.json";
const CERTIFIED_UNITS_OUT = "content/regulatory/ca-bc-certified-units.json";
const CROSSCHECK = "content/regulatory/sources/ca-bc-synopsis-2026-2028-crosscheck.json";
const INVENTORY = "fixtures/hunt/ca-bc-zone-certification.json";

/* The certified period. B.C. Reg. 97/2026 took effect July 1, 2026, the start of
   the 2026–2028 synopsis; one year of seasons is certified at a time, so a
   season after June 30, 2027 is outside the certified period, not closed. */
const PERIOD = { from: "2026-07-01", to: "2027-06-30", reason: "B.C. Reg. 190/84 as amended to B.C. Reg. 97/2026 (in force July 1, 2026), certified for one year of seasons." };

const SOURCE_ID = (schedule) => `source:ca-bc-hunting-regulation-sch${schedule}`;
const BODY_SOURCE = "source:ca-bc-hunting-regulation";
const SYNOPSIS_SOURCE = "source:ca-bc-hunting-synopsis-2026-2028";
const ZONE_PREFIX = "management_zone:ca-bc-mu-";

/* ── Species ───────────────────────────────────────────────────────────── */

/** Canonical species a Part 1 species cell names, in the first wave. */
function speciesOf(cell) {
  const out = [];
  for (const name of cell.split(";").map((part) => part.trim().toUpperCase())) {
    if (/^RUFFED GROUSE$/.test(name)) out.push("species:ruffed-grouse");
    else if (/^SPRUCE \(FRANKLIN\) GROUSE$/.test(name)) out.push("species:spruce-grouse");
    else if (/^SHARP-TAILED GROUSE$/.test(name)) out.push("species:sharp-tailed-grouse");
    // B.C.'s "ptarmigan" is every ptarmigan; North Ground's library holds rock and willow.
    else if (/^PTARMIGAN$/.test(name)) out.push("species:rock-ptarmigan", "species:willow-ptarmigan");
    else if (/^SNOWSHOE HARE$/.test(name)) out.push("species:snowshoe-hare");
    else if (/^BLACK BEAR$/.test(name)) out.push("species:american-black-bear");
  }
  return out;
}

const SPECIES_GROUP = {
  "species:ruffed-grouse": "ruffed-spruce-grouse",
  "species:spruce-grouse": "ruffed-spruce-grouse",
  "species:sharp-tailed-grouse": "sharp-tailed-grouse",
  "species:rock-ptarmigan": "ptarmigan",
  "species:willow-ptarmigan": "ptarmigan",
  "species:snowshoe-hare": "snowshoe-hare",
  "species:american-black-bear": "black-bear",
};

const GROUSE = ["species:ruffed-grouse", "species:spruce-grouse"];
const BEAR = ["species:american-black-bear"];
const PTARMIGAN = ["species:rock-ptarmigan", "species:willow-ptarmigan"];
const BOW = ["BOW", "CROSSBOW"];

/* ── Reviewed Part 2 ───────────────────────────────────────────────────── *
 *
 * Every clause of Part 2 that reaches a first-wave species, read 2026-09-22 from
 * the consolidation current to September 15, 2026. `quote` must appear verbatim
 * in that schedule's Part 2 or the build fails. Four kinds:
 *
 *  - area:  an area inside named units, with no geometry North Ground holds,
 *           that `excludes` the listed species from every rule there (or that a
 *           rule `includes` only, for "on private property").
 *  - youth: the listed Part 1 items are restricted to persons under 18.
 *  - extra: a season Part 2 itself states ("the open season ... with a bow only
 *           ... is"), as a rule of its own.
 *  - none:  a "**" whose Part 2 has no clause naming the species (recorded).
 */
const REVIEWED_PART_TWO = [
  // Schedule 1 — Vancouver Island
  { kind: "area", id: "bc-s1-5-parks", schedule: 1, section: "s. 5 (1)", species: [...GROUSE, ...PTARMIGAN, "species:snowshoe-hare", ...BEAR],
    name: "Cape Scott (west of Dakota Creek), Gibson Marine, Octopus Islands Marine, Thurston Bay Marine and Sandy Island parks",
    candidateAreas: ["1-6", "1-8", "1-13", "1-15"],
    quote: "There is no open season on wildlife except ducks, coots, common snipe, snow geese, Ross' geese, Canada geese, cackling geese and white-fronted geese in" },
  { kind: "area", id: "bc-s1-8e-conuma", schedule: 1, section: "s. 8 (e)", species: BEAR, firearmsOnly: true,
    name: "The Conuma River watershed portion of M.U. 1-12 (no big game hunting with a firearm)",
    candidateAreas: ["1-12"],
    quote: "big game with a firearm in that portion of M.U. 1-12 contained within the boundaries of the Conuma River Watershed" },
  { kind: "area", id: "bc-s1-9-bear", schedule: 1, section: "s. 9", species: BEAR,
    name: "Described portions of M.U.s 1-11, 1-14 and 1-15 closed to black bear",
    candidateAreas: ["1-11", "1-14", "1-15"],
    quote: "There is no open season for black bear in those portions of M.U. 1-15 contained within the following described boundaries" },
  { kind: "area", id: "bc-s1-12-denman", schedule: 1, section: "s. 12", species: [...GROUSE, ...PTARMIGAN],
    name: "Denman Island (M.U. 1-6), closed to upland game birds",
    candidateAreas: ["1-6"],
    quote: "There is no open season for upland game birds in that portion of M.U. 1-6 being all of Denman Island" },
  { kind: "area", id: "bc-s1-4-bow-exceptions", schedule: 1, section: "s. 4 (4)", species: [],
    name: "The Gulf Islands other than Gabriola (M.U. 1-1) and the south fork of the Nanaimo River watershed (M.U. 1-5), where the bow only seasons do not apply",
    candidateAreas: ["1-1", "1-5"],
    quote: "The open seasons for hunting with a bow only, listed in subsection (1) (a) and (b), do not apply to the following areas" },
  { kind: "extra", schedule: 1, section: "s. 4 (1) (a)", species: BEAR, units: "1-1 to 1-15", season: "Aug. 25 to Sept. 9",
    appliesWhen: { permittedImplements: BOW }, bag: "2", excludeAreas: ["bc-s1-4-bow-exceptions"],
    quote: "mule (black-tailed) deer bucks and black bear in M.U.s 1-1 to 1-15, is from August 25 to September 9" },
  { kind: "extra", schedule: 1, section: "s. 4 (1) (b)", species: ["species:ruffed-grouse"], units: "1-1 to 1-15", season: "Aug. 20 to Aug. 31",
    appliesWhen: { permittedImplements: BOW }, bag: "5(15)", excludeAreas: ["bc-s1-4-bow-exceptions"],
    quote: "blue and ruffed grouse in M.U.s 1-1 to 1-15 is from August 20 to August 31" },
  // Schedule 2 — Lower Mainland
  { kind: "extra", schedule: 2, section: "s. 4 (a)", species: [...BEAR, ...GROUSE], units: "2-2 to 2-19", season: "Sept. 1 to Sept. 9",
    appliesWhen: { permittedImplements: BOW },
    quote: "antlered mule (black-tailed) deer, black bear and blue, spruce (Franklin) and ruffed grouse in M.U.s 2-2 to 2-19" },
  { kind: "extra", schedule: 2, section: "s. 4 (b)", species: PTARMIGAN, units: "2-2, 2-3, 2-5 to 2-19", season: "Sept. 1 to Sept. 9",
    appliesWhen: { permittedImplements: BOW },
    quote: "ptarmigan in M.U.s 2-2, 2-3 and 2-5 to 2-19 with a bow only is from September 1 to September 9" },
  // Schedule 3 — Thompson
  { kind: "area", id: "bc-s3-8-sharptail", schedule: 3, section: "s. 8", species: ["species:sharp-tailed-grouse"],
    name: "M.U. 3-30 south of the Scottie Creek Forest Service Road (5040 FSR)",
    candidateAreas: ["3-30"],
    quote: "There is no open season for Sharp-tailed grouse in that portion of M.U. 3-30 south of the Scottie Creek Forest Service Road (5040 FSR)" },
  { kind: "youth", schedule: 3, section: "s. 9 (d)", items: ["28.1"],
    quote: "the open season for hunting blue (Dusky) grouse, spruce (Franklin) grouse and ruffed grouse in M.U.s 3-12 to 3-20 and 3-26 to 3-44 from September 1 to September 9" },
  // Schedule 4 — Kootenay
  { kind: "extra", schedule: 4, section: "s. 15 (2)", species: BEAR, units: "4-1 to 4-9, 4-14 to 4-40", season: "Sept. 1 to Sept. 9",
    appliesWhen: { permittedImplements: BOW },
    quote: "The open season for hunting with a bow only for black bear in M.U.s 4-1 to 4-9 and 4-14 to 4-40 is September 1 to September 9" },
  { kind: "area", id: "bc-s4-21-private", schedule: 4, section: "s. 21", species: [],
    name: "Private property in M.U.s 4-1 to 4-9 and 4-14 to 4-40",
    candidateAreas: "4-1 to 4-9, 4-14 to 4-40",
    reason: "The Hunting Regulation opens this season on private property only. North Ground does not know whether this point is private property, or whether you have the owner's permission.",
    quote: "Despite Part 1 of Schedule 4, a person may hunt black bear on private property in M.U.s 4.1 to 4-9 and 4-14 to 4-40 from August 1 to August 31" },
  { kind: "extra", schedule: 4, section: "s. 21", species: BEAR, units: "4-1 to 4-9, 4-14 to 4-40", season: "Aug. 1 to Aug. 31",
    appliesWhen: {}, onlyIn: "bc-s4-21-private",
    // The regulation writes "4.1"; it is read as M.U. 4-1, the only reading that names a unit.
    quote: "a person may hunt black bear on private property in M.U.s 4.1 to 4-9 and 4-14 to 4-40 from August 1 to August 31" },
  // Schedule 5 — Cariboo
  { kind: "area", id: "bc-s5-15-sharptail", schedule: 5, section: "s. 15", species: ["species:sharp-tailed-grouse"],
    name: "The described portion of M.U. 5-3 and the mapped portion of M.U. 5-14 closed to sharp-tailed grouse",
    candidateAreas: ["5-3", "5-14"],
    quote: "there is no open season on Sharp-tailed grouse in that portion of M.U. 5-3 contained within the following described boundaries" },
  { kind: "youth", schedule: 5, section: "s. 16 (c)", items: ["20.3"],
    quote: "the open season for hunting blue (Sooty, Dusky) grouse, spruce (Franklin) grouse and ruffed grouse in M.U.s 5-1 to 5-15 from September 1 to September 9" },
  { kind: "area", id: "bc-s5-17-bear", schedule: 5, section: "s. 17 (1)", species: BEAR,
    name: "The mapped portion of M.U. 5-9 closed to black bear",
    candidateAreas: ["5-9"],
    quote: "there is no open season on black bear in those portions of M.U. 5-9 outlined in red on map '2022 Black Bear MU 5-9 Closed Season'" },
  { kind: "area", id: "bc-s5-17-estuaries", schedule: 5, section: "s. 17 (2)", species: BEAR,
    name: "Within one km of the Korich River Estuary, Kainet Creek Estuary, Culpepper Lagoon or Salmon Bay (M.U. 5-9)",
    candidateAreas: ["5-9"],
    quote: "The open season for black bear in those portions of M.U. 5-9 within one km of the Korich River Estuary, Kainet Creek Estuary, Culpepper Lagoon or Salmon Bay" },
  { kind: "extra", schedule: 5, section: "s. 17 (2)", species: BEAR, units: "5-9", season: "Apr. 1 to Apr. 30 Oct. 16 to Nov. 30",
    appliesWhen: {}, onlyIn: "bc-s5-17-estuaries",
    quote: "is from April 1 to April 30 and from October 16 to November 30" },
  // Schedule 6 — Skeena
  { kind: "extra", schedule: 6, section: "s. 15", species: GROUSE, units: "6-1 to 6-30", season: "Sept. 1 to Sept. 9",
    appliesWhen: { permittedImplements: BOW },
    quote: "The open season for hunting blue, spruce (Franklin) and ruffed grouse with a bow only in M.U.s 6-1 to 6-30 is September 1 to September 9" },
  { kind: "area", id: "bc-s6-18-bear", schedule: 6, section: "s. 18", species: BEAR,
    name: "The mapped portions of M.U.s 6-3 and 6-11 closed to black bear",
    candidateAreas: ["6-3", "6-11"],
    quote: "There is no open season for black bear in those portions of M.U.s 6-3 and 6-11 outlined in red on map '2022 Black Bear MUs 6-3 and 6-11 Closed Season'" },
  // Schedule 7 — Omineca-Peace
  { kind: "none", schedule: 7, items: ["51", "52", "53", "54"],
    note: "The Hunting Regulation marks this season \"**\" (Part 2 of Schedule 7 applies), and Part 2 of Schedule 7 contains no clause naming spruce or ruffed grouse. The 2026–2028 synopsis prints no restriction for it either." },
  // Schedule 8 — Okanagan
  { kind: "extra", schedule: 8, section: "s. 11 (1)", species: GROUSE, units: "8-1 to 8-15, 8-21 to 8-26", season: "Dec. 1 to Dec. 10",
    appliesWhen: { permittedImplements: BOW },
    quote: "The open season for hunting blue, spruce (Franklin) and ruffed grouse with a bow only in M.U.s 8-1 to 8-15 and 8-21 to 8-26 is December 1 to December 10" },
  { kind: "area", id: "bc-s8-13-private", schedule: 8, section: "s. 13", species: [],
    name: "Private property in M.U.s 8-1 to 8-26",
    candidateAreas: "8-1 to 8-15, 8-21 to 8-26",
    reason: "The Hunting Regulation opens this season on private property only. North Ground does not know whether this point is private property, or whether you have the owner's permission.",
    quote: "Despite Part 1 of Schedule 8, a person may hunt black bear on private property in M.U.s 8-01 to 8-26 from August 1 to August 31" },
  { kind: "extra", schedule: 8, section: "s. 13", species: BEAR, units: "8-1 to 8-15, 8-21 to 8-26", season: "Aug. 1 to Aug. 31",
    appliesWhen: {}, onlyIn: "bc-s8-13-private",
    quote: "a person may hunt black bear on private property in M.U.s 8-01 to 8-26 from August 1 to August 31" },
  { kind: "extra", schedule: 8, section: "s. 15 (d)", species: GROUSE, units: "8-1 to 8-15, 8-21 to 8-26", season: "Sept. 1 to Sept. 9",
    appliesWhen: { HUNTER_AGE: "UNDER_18" }, bag: "5(15)",
    dispute: "Schedule 8 s. 15 (d) restricts a September 1 to September 9 grouse season to persons under 18, and the 2026–2028 synopsis prints it, but Part 1 of Schedule 8 lists no such season.",
    quote: "the open season for hunting blue (Dusky) grouse, spruce (Franklin) grouse and ruffed grouse in M.U.s 8-1 to 8-15 and 8-21 to 8-26 from September 1 to September 9" },
];

/* Ranges the synopsis prints differently from the law, reviewed one by one. The
   law's own range stays the rule; the part only the synopsis states becomes a
   disputed rule, so those days alone answer CONFLICT. */
const REVIEWED_SYNOPSIS_DISPUTES = [
  { schedule: 3, item: "14", species: BEAR, lawRange: "Apr. 1 to June 20", synopsisOnly: "June 21 to June 30",
    statedAs: "B.C. Reg. 190/84 Schedule 3 item 14 opens the spring black bear season in M.U.s 3-12 to 3-20 and 3-26 to 3-44 from April 1 to June 20; the 2026–2028 synopsis prints April 1 to June 30." },
];

/* Rows the law marks "**" whose Part 2 matters only for species outside this wave. */
const PART_TWO_NOT_REACHING = {
  "1:6": "Schedule 1 black bear: Part 2 ss. 4, 5, 8 and 9 are all reviewed above.",
  "1:13": "Blue (Sooty) grouse is not in this wave.",
  "1:14": "Schedule 1 ruffed grouse: Part 2 ss. 4, 5 and 12 are reviewed above.",
  "2:10": "Schedule 2 black bear: Part 2 s. 4 is reviewed above.",
  "2:22": "Schedule 2 ptarmigan: Part 2 s. 4 is reviewed above.",
  "3:29": "Schedule 3 sharp-tailed grouse: Part 2 s. 8 is reviewed above.",
  "5:8": "Schedule 5 black bear: Part 2 s. 17 is reviewed above.",
  "5:20.1": "Blue grouse is not in this wave.",
  "5:21": "Schedule 5 sharp-tailed grouse: Part 2 s. 15 is reviewed above.",
  "6:21": "Schedule 6 black bear: Part 2 s. 18 is reviewed above.",
  "6:29": "Schedule 6 grouse: Part 2 s. 15 is reviewed above.",
  "7:49": "Blue (Dusky) grouse is not in this wave.",
  "7:50": "Blue (Dusky) grouse is not in this wave.",
  "8:14": "Schedule 8 black bear: Part 2 s. 13 is reviewed above.",
};

/* ── Fetch ─────────────────────────────────────────────────────────────── */

async function read(id, offline) {
  if (offline) return readFileSync(`${offline}/${id}.html`, "utf8");
  const response = await fetch(`${BC_LAWS}/${id}`, { headers: { "user-agent": "NorthGround/1.0 (+https://www.northgroundbushcraft.com)" }, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`BC Laws ${id} returned ${response.status}`);
  return response.text();
}

/* ── Build ─────────────────────────────────────────────────────────────── */

const MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const stable = (value) => JSON.stringify(value);
const hash8 = (value) => sha256(stable(value)).slice(7, 15);

export async function build({ offline } = {}) {
  const inventory = JSON.parse(readFileSync(INVENTORY, "utf8")).officialIdentifiers;
  if (inventory.length !== 225) throw new Error(`Expected the 225 certified Management Units, found ${inventory.length}`);
  const zoneIdOf = (unit) => `${ZONE_PREFIX}${unit}`;

  const body = await read(BC_DOCUMENTS.body.id, offline);
  const consolidated = consolidationDate(body);
  const bodyText = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const LEGAL_TIME = "The prohibited hours for hunting wildlife are from one hour after sunset on any day until one hour before sunrise of the day following.";
  if (!containsVerbatim(bodyText, LEGAL_TIME)) throw new Error("s. 14 (1) no longer reads as reviewed");
  const ABSENCE = "The open seasons for the hunting of each species and type of game animal, subject to section 6, are those set forth in Parts 1 and 2 of each Schedule.";
  if (!containsVerbatim(bodyText, ABSENCE)) throw new Error("s. 4 no longer reads as reviewed");
  const CLOSURE_ORDERS = "An open season declared by this regulation shall cease to be in effect in any area";
  if (!containsVerbatim(bodyText, CLOSURE_ORDERS)) throw new Error("s. 5 no longer reads as reviewed");

  const schedules = {};
  const sources = [{
    id: BODY_SOURCE, authority: "Province of British Columbia", title: BC_DOCUMENTS.body.title,
    url: `${BC_LAWS}/${BC_DOCUMENTS.body.id}`, sourceHashes: { body: sha256([LEGAL_TIME, ABSENCE, CLOSURE_ORDERS].join("\n")) },
  }];
  for (let schedule = 1; schedule <= 8; schedule += 1) {
    const html = await read(BC_DOCUMENTS[schedule].id, offline);
    if (consolidationDate(html) !== consolidated) throw new Error(`Schedule ${schedule} is consolidated to a different date than the body`);
    const rows = partOneRows(html, schedule);
    const partTwo = schedulePart(html, 2);
    const partThree = schedulePart(html, 3);
    schedules[schedule] = { rows, partTwo, partThree };
    sources.push({
      id: SOURCE_ID(schedule), authority: "Province of British Columbia", title: BC_DOCUMENTS[schedule].title,
      url: `${BC_LAWS}/${BC_DOCUMENTS[schedule].id}`,
      sourceHashes: { partOne: sha256(stable(rows)), partTwo: sha256(partTwo), partThree: sha256(partThree) },
    });
  }

  // Every reviewed clause still reads exactly as reviewed.
  for (const clause of REVIEWED_PART_TWO) {
    if (clause.quote && !containsVerbatim(schedules[clause.schedule].partTwo, clause.quote)) {
      throw new Error(`Schedule ${clause.schedule} ${clause.section ?? clause.items}: reviewed clause no longer appears verbatim: "${clause.quote.slice(0, 80)}…"`);
    }
  }

  const unitsFrom = (spec) => expandUnits(spec, inventory).units;
  const specialGeographies = REVIEWED_PART_TWO.filter((clause) => clause.kind === "area").map((clause) => ({
    id: clause.id,
    name: clause.name,
    statedAs: clause.quote,
    resolution: "UNRESOLVED",
    candidateAreas: typeof clause.candidateAreas === "string" ? unitsFrom(clause.candidateAreas) : clause.candidateAreas,
    reason: clause.reason ?? `B.C. Reg. 190/84 Schedule ${clause.schedule} Part 2 ${clause.section}. North Ground holds no boundary for it, so it cannot tell whether this point is inside it.`,
  }));
  for (const special of specialGeographies) {
    for (const unit of special.candidateAreas) if (!inventory.includes(unit)) throw new Error(`${special.id}: ${unit} is not a Management Unit`);
  }
  const excludedBySpecies = (schedule, speciesId, { bowOnly = false, own } = {}) => REVIEWED_PART_TWO
    .filter((clause) => clause.kind === "area" && clause.schedule === schedule && clause.species.includes(speciesId))
    // A firearm restriction does not reach a bow only season; a season's own area does not exclude it.
    .filter((clause) => !(bowOnly && clause.firearmsOnly) && clause.id !== own)
    .map((clause) => clause.id);

  const groups = new Map();
  const groupFor = (spec, units) => {
    const key = [...units].sort().join(",");
    const id = `regulatory_group:ca-bc-2026-${hash8(key)}`;
    if (!groups.has(id)) groups.set(id, { id, officialSpec: spec, zoneIds: units.map(zoneIdOf) });
    return id;
  };

  const rules = [];
  const seen = new Set();
  const limitsFrom = (bagText, schedule, speciesId, partThree) => {
    const bag = parseBag(bagText);
    const limits = {};
    if (bag.daily !== undefined) limits.daily = bag.daily;
    if (bag.possession !== undefined) limits.possession = bag.possession;
    if (bag.bag !== undefined) limits.bag = bag.bag;
    const grouse = GROUSE.includes(speciesId);
    const ptarmigan = PTARMIGAN.includes(speciesId);
    limits.combined = grouse || ptarmigan;
    if (ptarmigan) limits.combinedWithNames = ["all ptarmigan"];
    limits.statedAs = bag.daily !== undefined
      ? `${bag.daily} per day${bag.possession !== undefined ? `, ${bag.possession} in possession` : ""}${ptarmigan ? " (all ptarmigan together)" : ""}`
      : bag.bag !== undefined ? `${bag.bag} (season bag limit)` : bag.statedAs;
    limits.section = `Schedule ${schedule}, Part 1`;
    // Part 3 grouse bag rules apply wherever they are written, "***" or not; quote them.
    const partThreeGrouse = grouse ? /Grouse \d+(?:\.\d+)? ([^[]+?)\[/.exec(partThree) ?? /Blue grouse, spruce grouse and ruffed grouse \d+ ([^[]+?)\[/.exec(partThree) : null;
    return { limits, partThreeNote: partThreeGrouse ? `Bag limit, Schedule ${schedule} Part 3: ${partThreeGrouse[1].trim()}` : null };
  };

  const addRule = ({ speciesId, schedule, item, section, spec, units, ranges, appliesWhen, bagText, partThree, notes = [], disputes = [], excludeSpecials = [], includeSpecials = [], label }) => {
    const windows = ranges.flatMap((range) => windowsIn(range, PERIOD));
    const { limits, partThreeNote } = limitsFrom(bagText, schedule, speciesId, partThree);
    const geography = {
      statedAs: spec,
      include: { ghas: includeSpecials.length ? [] : units, gbhz: [], special: includeSpecials },
      exclude: { ghas: [], special: excludeSpecials },
    };
    const identity = { speciesId, schedule, item, section, units, ranges: ranges.map((range) => range.statedAs), appliesWhen, excludeSpecials, includeSpecials, disputes };
    const id = `regulatory_rule:ca-bc-2026-${speciesId.slice("species:".length)}-${hash8(identity)}`;
    if (seen.has(id)) throw new Error(`Duplicate rule ${id}`);
    seen.add(id);
    rules.push({
      id,
      speciesId,
      regulatoryGroupId: groupFor(spec, units),
      geography,
      appliesWhen,
      seasonLabel: label,
      seasonPhrase: ranges.map((range) => range.statedAs).join("; "),
      windows,
      declaredNoSeason: false,
      limits,
      conditionIds: [],
      caveats: [],
      notes: [...notes, ...(partThreeNote ? [partThreeNote] : [])],
      disputes,
      sourceId: SOURCE_ID(schedule),
      sourceSection: section,
      sourceVersion: `B.C. Reg. 190/84, consolidated to ${consolidated}`,
      reviewStatus: "VERIFIED",
    });
  };

  // Part 1 rows.
  const unexplained = [];
  const notEncoded = [];
  for (let schedule = 1; schedule <= 8; schedule += 1) {
    const { rows, partThree } = schedules[schedule];
    for (const row of rows) {
      const species = speciesOf(row.species);
      if (!species.length) {
        if (/GROUSE|PTARMIGAN/i.test(row.species)) notEncoded.push(`Schedule ${schedule} item ${row.item}: ${row.species} (blue grouse is not in the species library)`);
        continue;
      }
      const marked = /\*\*(?!\*)/.test(`${row.units} ${row.season} ${row.bag.replace(/\*\*\*/g, "")}`);
      const youth = REVIEWED_PART_TWO.find((clause) => clause.kind === "youth" && clause.schedule === schedule && clause.items.includes(row.item));
      const none = REVIEWED_PART_TWO.find((clause) => clause.kind === "none" && clause.schedule === schedule && clause.items.includes(row.item));
      if (marked && !youth && !none && !PART_TWO_NOT_REACHING[`${schedule}:${row.item}`]) unexplained.push(`Schedule ${schedule} item ${row.item} (${row.species})`);
      const { units } = expandUnits(row.units, inventory);
      const spec = row.units.replace(/\*+/g, "").trim();
      const ranges = parseSeasons(row.season);
      const dispute = REVIEWED_SYNOPSIS_DISPUTES.find((entry) => entry.schedule === schedule && entry.item === row.item);
      for (const speciesId of species) {
        const common = {
          speciesId, schedule, item: row.item, section: `Schedule ${schedule}, Part 1, item ${row.item}`, spec, units,
          appliesWhen: youth ? { HUNTER_AGE: "UNDER_18" } : {},
          bagText: row.bag, partThree,
          notes: [
            ...(youth ? [`Restricted to persons under 18 (Schedule ${schedule} Part 2 ${youth.section}).`] : []),
            ...(none ? [none.note] : []),
          ],
          excludeSpecials: excludedBySpecies(schedule, speciesId),
          label: youth ? "Youth season" : "General open season",
        };
        addRule({ ...common, ranges });
        if (dispute && dispute.species.includes(speciesId)) {
          addRule({
            ...common,
            ranges: parseSeasons(dispute.synopsisOnly),
            disputes: [{ statedAs: dispute.statedAs }],
            label: "Synopsis-only dates",
            notes: [...common.notes, "Only the 2026–2028 synopsis states these dates; the regulation does not."],
          });
        }
      }
    }
  }
  if (unexplained.length) throw new Error(`First-wave rows marked "**" with no reviewed Part 2 reading:\n  ${unexplained.join("\n  ")}`);

  // Part 2 seasons.
  for (const clause of REVIEWED_PART_TWO.filter((entry) => entry.kind === "extra")) {
    const units = expandUnits(clause.units, inventory).units;
    for (const speciesId of clause.species) {
      const bow = clause.appliesWhen.permittedImplements;
      addRule({
        speciesId, schedule: clause.schedule, item: null, section: `Schedule ${clause.schedule}, Part 2, ${clause.section}`,
        spec: clause.units, units, ranges: parseSeasons(clause.season), appliesWhen: clause.appliesWhen,
        bagText: clause.bag ?? bagFor(schedules[clause.schedule].rows, speciesId), partThree: schedules[clause.schedule].partThree,
        notes: [
          ...(bow ? ["Bow only: the Wildlife Act defines a bow as a longbow or crossbow."] : []),
          ...(clause.onlyIn?.endsWith("private") ? ["Open on private property only (the owner's permission is needed to hunt there)."] : []),
          ...(clause.onlyIn?.endsWith("estuaries") ? ["This season applies only within one km of the named estuaries; elsewhere in M.U. 5-9 the general season applies."] : []),
          ...(clause.appliesWhen.HUNTER_AGE ? [`Restricted to persons under 18 (Schedule ${clause.schedule} Part 2 ${clause.section}).`] : []),
        ],
        disputes: clause.dispute ? [{ statedAs: clause.dispute }] : [],
        excludeSpecials: [...excludedBySpecies(clause.schedule, speciesId, { bowOnly: Boolean(bow), own: clause.onlyIn }), ...(clause.excludeAreas ?? [])],
        includeSpecials: clause.onlyIn ? [clause.onlyIn] : [],
        label: bow ? "Bow only season" : clause.onlyIn?.endsWith("private") ? "Private property season" : clause.onlyIn ? "Estuary season" : "Youth season",
      });
    }
  }

  crossCheck(rules);

  const unitsWithRules = new Set(rules.flatMap((rule) => [...rule.geography.include.ghas, ...rule.geography.include.special.flatMap((id) => specialGeographies.find((special) => special.id === id).candidateAreas)]));
  const bundle = {
    schemaVersion: 1,
    bundleId: "bundle:ca-bc-2026",
    jurisdictionId: "jurisdiction:ca-bc",
    sourceVersion: `B.C. Reg. 190/84, consolidated to ${consolidated}`,
    retrievedAt: isoDate(consolidated),
    contentHash: "",
    certifiedPeriod: PERIOD,
    absence: {
      meaning: "UNKNOWN",
      excludedCombination: "CLOSED",
      statedAs: ABSENCE,
      section: "B.C. Reg. 190/84, s. 4",
      sourceId: BODY_SOURCE,
      explanation:
        "No row of the Hunting Regulation's schedules names this Management Unit for this species. Limited entry hunting seasons are set by a " +
        "separate regulation (B.C. Reg. 134/93) that North Ground has not read, so this is not stated as closed.",
    },
    officialUnitCount: inventory.length,
    officialIdentifiers: inventory,
    units: inventory.map((unit) => ({ identifier: unit, zoneId: zoneIdOf(unit) })),
    specialGeographies,
    legalTime: { statedAs: LEGAL_TIME, section: "B.C. Reg. 190/84, s. 14 (1)" },
    sources: [
      ...sources,
      { id: SYNOPSIS_SOURCE, authority: "Province of British Columbia", title: "2026–2028 Hunting and Trapping Regulations Synopsis (cross-check only)",
        url: BC_SYNOPSIS_URL, sourceHashes: { pdf: JSON.parse(readFileSync(CROSSCHECK, "utf8")).pdfSha256 } },
    ],
    limitations: [
      "These are general open seasons under British Columbia's Hunting Regulation (B.C. Reg. 190/84). Limited entry hunting (LEH) seasons under B.C. Reg. 134/93 are not evaluated.",
      "An open season does not apply in an area under a Forest Service closure order or a minister's order under s. 40 of the Wildlife Act (B.C. Reg. 190/84, s. 5). North Ground does not check those orders.",
      "Hunting is prohibited in all national parks. No-shooting areas, motor vehicle prohibitions and provincial park and protected-area rules are not evaluated here.",
      "This describes licensed hunting under the Wildlife Act. It does not describe harvesting under Aboriginal or treaty rights, which is a separate legal context North Ground does not evaluate.",
      "Management Unit boundaries are the regulation's enacted maps (B.C. Reg. 64/96); a river boundary follows the right-hand bank, or the left-hand bank of the West Road (Blackwater), Liard and Peace rivers. North Ground's map is the province's digital product of them.",
      `BC Laws states this consolidation is current to ${consolidated}; it is not the official version of the regulation. In-season changes are published by the province.`,
    ],
    notEncoded: [
      "Blue (Dusky, Sooty) grouse, which the species library does not hold.",
      "Deer, moose, elk, sheep, goat, caribou, bison, cougar, wolf, coyote, furbearers, turkey, pheasant, partridge, quail, doves, waterfowl and every other species: not in this wave.",
      ...notEncoded,
    ],
    groups: [...groups.values()].sort((a, b) => a.id.localeCompare(b.id)),
    rules: rules.sort((a, b) => a.id.localeCompare(b.id)),
  };
  bundle.contentHash = sha256(stable({ ...bundle, contentHash: "" }));
  const certifiedUnits = {
    jurisdictionId: "jurisdiction:ca-bc",
    officialUnitCount: inventory.length,
    certifiedUnits: [...unitsWithRules].sort((a, b) => a.localeCompare(b, "en", { numeric: true })),
  };
  return { bundle, certifiedUnits };
}

function bagFor(rows, speciesId) {
  const row = rows.find((candidate) => speciesOf(candidate.species).includes(speciesId));
  if (!row) throw new Error(`No Part 1 row gives a bag limit for ${speciesId}`);
  return row.bag;
}

function isoDate(stated) {
  const [month, day, year] = stated.replace(",", "").split(" ");
  return `${year}-${String(MONTH_NAMES.indexOf(month)).padStart(2, "0")}-${String(Number(day)).padStart(2, "0")}`;
}

/**
 * The law's ranges against the synopsis's, per region and species group, after
 * joining ranges that touch (Aug. 1 to Mar. 31 and Apr. 1 to Apr. 30 are one
 * season). Anything the two disagree on must be a reviewed dispute.
 */
function crossCheck(rules) {
  const record = JSON.parse(readFileSync(CROSSCHECK, "utf8"));
  const merge = (ranges) => {
    const keys = new Set(ranges.map((range) => range.join("/")));
    let changed = true;
    let list = [...keys].map((key) => key.split("/").map(Number));
    while (changed) {
      changed = false;
      outer: for (const a of list) for (const b of list) {
        if (a === b) continue;
        const next = new Date(Date.UTC(2001, a[2] - 1, a[3] + 1));
        if (next.getUTCMonth() + 1 === b[0] && next.getUTCDate() === b[1]) {
          list = list.filter((entry) => entry !== a && entry !== b);
          list.push([a[0], a[1], b[2], b[3]]);
          changed = true;
          break outer;
        }
      }
    }
    return new Set(list.map((range) => range.join("/")));
  };
  const problems = [];
  for (let schedule = 1; schedule <= 8; schedule += 1) {
    const bySpecies = new Map();
    // Every rule, disputed ones included: a reviewed dispute is the synopsis's reading, encoded.
    for (const rule of rules.filter((candidate) => candidate.sourceId === SOURCE_ID(schedule))) {
      const group = SPECIES_GROUP[rule.speciesId];
      /* A species the table does not name would collect its rules under an
         `undefined` key and be silently cross-checked against nothing. The
         table has to grow with the bundle, so say so rather than drift. */
      if (!group) {
        throw new Error(
          `${rule.speciesId} has no SPECIES_GROUP entry; add it alongside ${Object.keys(SPECIES_GROUP).join(", ")}`,
        );
      }
      const set = bySpecies.get(group) ?? [];
      for (const phrase of rule.seasonPhrase.split("; ")) {
        for (const range of parseSeasons(phrase)) set.push([...range.from, ...range.to]);
      }
      bySpecies.set(group, set);
    }
    const synopsis = record.regions[String(schedule)] ?? {};
    for (const group of new Set([...bySpecies.keys(), ...Object.keys(synopsis)])) {
      const law = merge(bySpecies.get(group) ?? []);
      const printed = merge(synopsis[group]?.ranges ?? []);
      const onlyLaw = [...law].filter((key) => !printed.has(key));
      const onlySynopsis = [...printed].filter((key) => !law.has(key));
      if (onlyLaw.length || onlySynopsis.length) {
        problems.push(`Schedule ${schedule} ${group}: only in the law [${onlyLaw.join(" ")}], only in the synopsis [${onlySynopsis.join(" ")}]`);
      }
    }
  }
  if (problems.length) throw new Error(`The synopsis and the regulation disagree beyond the reviewed disputes:\n  ${problems.join("\n  ")}`);
}

async function main() {
  const args = process.argv.slice(2);
  const offline = args.includes("--offline") ? args[args.indexOf("--offline") + 1] : undefined;
  const { bundle, certifiedUnits } = await build({ offline });
  const text = `${JSON.stringify(bundle, null, 2)}\n`;
  const unitsText = `${JSON.stringify(certifiedUnits, null, 2)}\n`;
  if (args.includes("--check")) {
    const same = existsSync(OUT) && readFileSync(OUT, "utf8") === text && existsSync(CERTIFIED_UNITS_OUT) && readFileSync(CERTIFIED_UNITS_OUT, "utf8") === unitsText;
    if (!same) {
      console.error(`British Columbia's regulation has moved or the bundle was edited: ${OUT} does not reproduce. Rebuild and review the diff.`);
      process.exit(2);
    }
    console.log(`British Columbia sources unchanged; ${OUT} reproduces exactly (${bundle.contentHash.slice(0, 23)}…).`);
    return;
  }
  writeFileSync(OUT, text);
  writeFileSync(CERTIFIED_UNITS_OUT, unitsText);
  const bySpecies = {};
  for (const rule of bundle.rules) bySpecies[rule.speciesId] = (bySpecies[rule.speciesId] ?? 0) + 1;
  console.log(`Wrote ${OUT}: ${bundle.rules.length} rules in ${bundle.groups.length} groups, ${bundle.specialGeographies.length} unresolved areas, consolidated to ${bundle.sourceVersion.split("to ")[1]}.`);
  console.log(`  ${JSON.stringify(bySpecies)}`);
  console.log(`  ${certifiedUnits.certifiedUnits.length} of ${certifiedUnits.officialUnitCount} Management Units carry at least one certified rule.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => { console.error(`British Columbia build failed: ${error.message}`); process.exit(1); });
}

export { REVIEWED_PART_TWO, REVIEWED_SYNOPSIS_DISPUTES, BC_TIME_ZONE };
