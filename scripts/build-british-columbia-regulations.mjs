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
import {
  DEER_AREAS, DEER_DISPUTES, DEER_EXTRAS, DEER_RANGE_REVIEW, DEER_RESTRICTIONS, DEER_ROWS, DEER_SYNOPSIS_ONLY, composeDeer, deerRowOf,
} from "./british-columbia-deer.mjs";

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
    // "MOOSE Bulls" and "MOOSE Bulls (2 pt.)": the class is read by classOf below.
    else if (/^MOOSE BULLS(?: \(2 PT\.\))?$/.test(name)) out.push("species:moose");
    // Every elk row is read through ELK_PLAN, which states its units and class explicitly.
    else if (/^ELK (?:BULLS(?: \((?:3|6) PT\.(?: OR BETTER)?\))?|ANTLERLESS)$/.test(name)) out.push("species:elk");
  }
  return out;
}

/*
 * The class a big-game row is for. "Buck" and "bull" are defined in s. 1:
 * "with reference to deer, moose or elk means one bearing visible bony antlers,
 * but does not include a calf". A row's printed "(2 pt.)" is the synopsis
 * shorthand for a Part 2 restriction, which is encoded from Part 2 itself
 * (REVIEWED_PART_TWO, kind "points"), never from the shorthand.
 */
function classOf(cell) {
  if (/^MOOSE BULLS/i.test(cell.trim())) return { key: "ANTLERED", display: ["ANTLERED"] };
  return null;
}

const SPECIES_GROUP = {
  "species:ruffed-grouse": "ruffed-spruce-grouse",
  "species:spruce-grouse": "ruffed-spruce-grouse",
  "species:sharp-tailed-grouse": "sharp-tailed-grouse",
  "species:rock-ptarmigan": "ptarmigan",
  "species:willow-ptarmigan": "ptarmigan",
  "species:snowshoe-hare": "snowshoe-hare",
  "species:american-black-bear": "black-bear",
  "species:moose": "moose",
  "species:elk": "elk",
  "species:mule-deer": "mule-deer",
  "species:white-tailed-deer": "white-tailed-deer",
};

const MOOSE = ["species:moose"];
const ELK = ["species:elk"];
/* Bull elk antler restrictions as ANIMAL_CLASS:ANTLER_POINTS answers. B.C. writes
   them as "at least 6 tines (points) on one antler" (Schedule 4) or "at least one
   branched antler with at least 6 (or 3) tines" (Schedules 6, 7, 8); a point is
   at least 2.5 cm long (s. 1), so both read as the same count. */
const ELK6 = ["ELK_SIX_OR_MORE"];
const ELK3 = ["ELK_THREE_TO_FIVE", "ELK_SIX_OR_MORE"];
const ELK35 = ["ELK_THREE_TO_FIVE"];
/* The bull moose a Part 2 antler restriction leaves open, as the answers to
   ANIMAL_CLASS:ANTLER_POINTS. Each is a class the regulation states. */
const SPIKE_FORK = ["MOOSE_SPIKE_FORK"];
const SPIKE_FORK_TRIPALM_TEN = ["MOOSE_SPIKE_FORK", "MOOSE_TRIPALM_OR_TEN_POINT"];

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
  // Moose (second wave), read 2026-10-29 from the consolidation current to the same date.
  { kind: "points", schedule: 3, section: "s. 6 (1)", items: ["11", "11.1", "11.2"], species: MOOSE, points: SPIKE_FORK,
    quote: "there is no open season for bull moose in Region 3 unless the bull moose has no more than two tines (points) on one antler" },
  { kind: "points", schedule: 4, section: "s. 1.1 (1)", items: ["13.1", "13.2"], species: MOOSE, points: SPIKE_FORK,
    quote: "there is no open season on bull moose, unless the bull moose has no more than two tines (points) on one antler" },
  { kind: "extra", schedule: 4, section: "s. 15 (12) (a)", species: MOOSE, units: "4-7 to 4-9, 4-14 to 4-18, 4-27 to 4-33, 4-36 to 4-40", season: "Sept. 1 to Sept. 19",
    appliesWhen: { permittedImplements: BOW }, points: SPIKE_FORK,
    quote: "The open season for hunting with a bow only for bull moose having no more than 2 tines (points) on one antler (a) in M.U.s 4-7 to 4-9, 4-14 to 4-18, 4-27 to 4-33 and 4-36 to 4-40 is September 1 to September 19" },
  { kind: "extra", schedule: 4, section: "s. 15 (12) (b)", species: MOOSE, units: "4-1 to 4-6, 4-19 to 4-26, 4-34, 4-35", season: "Sept. 1 to Oct. 14",
    appliesWhen: { permittedImplements: BOW }, points: SPIKE_FORK,
    quote: "(b) in M.U.s 4-1 to 4-6, 4-19 to 4-26, 4-34 and 4-35 is September 1 to October 14" },
  { kind: "extra", schedule: 6, section: "s. 6 (1)", species: MOOSE, units: "6-1, 6-2", season: "Sept. 1 to Sept. 9 Nov. 16 to Nov. 20",
    appliesWhen: { permittedImplements: BOW }, bull: true,
    quote: "The open seasons for hunting with a bow only for bull moose in M.U.s 6-1 and 6-2 are from September 1 to September 9 and November 16 to November 20" },
  { kind: "area", id: "bc-s6-6-tweedsmuir", schedule: 6, section: "s. 6 (2)", species: [],
    name: "The portion of M.U. 6-2 within Tweedsmuir Park",
    candidateAreas: ["6-2"],
    quote: "The open season for bull moose in that portion of M.U. 6-2 located within Tweedsmuir Park is from October 20 to November 15" },
  { kind: "extra", schedule: 6, section: "s. 6 (2)", species: MOOSE, units: "6-2", season: "Oct. 20 to Nov. 15",
    appliesWhen: {}, bull: true, onlyIn: "bc-s6-6-tweedsmuir", label: "Tweedsmuir Park season",
    quote: "is from October 20 to November 15" },
  { kind: "area", id: "bc-s6-6-leh-zones", schedule: 6, section: "s. 6 (4)", species: MOOSE,
    name: "The mapped moose zones of M.U.s 6-19 to 6-21 and 6-23 to 6-26 open only under limited entry hunting",
    candidateAreas: ["6-19", "6-20", "6-21", "6-22", "6-23", "6-24", "6-25", "6-26"],
    quote: "There is no open season for moose, except as provided in the Limited Entry Hunting Regulation (B.C. Reg. 134/93), in any of the following zones" },
  /* The synopsis prints an antler-restricted Haines Highway season (Sept 1 –
     Oct 31) in M.U.s 6-28 and 6-29; neither Schedule 6 nor B.C. Reg. 134/93,
     as consolidated to October 27, 2026, states one. Inside that area both
     readings are carried as a dispute; outside it the law stands alone. */
  { kind: "area", id: "bc-s6-haines-synopsis", schedule: 6, section: "synopsis only", species: [],
    name: "The Haines Highway area of M.U.s 6-28 and 6-29 (2026–2028 synopsis, Map F40)",
    candidateAreas: ["6-28", "6-29"],
    reason: "Only the 2026–2028 synopsis describes this area, on its Map F40; the Hunting Regulation names no such area, and North Ground holds no boundary for it." },
  { kind: "synopsisArea", schedule: 6, item: "12", species: MOOSE, area: "bc-s6-haines-synopsis",
    season: "Sept. 1 to Oct. 31", points: SPIKE_FORK_TRIPALM_TEN,
    statedAs: "Within the Haines Highway area of M.U.s 6-28 and 6-29, the 2026–2028 synopsis prints an antler-restricted bull moose season of September 1 to October 31 (spike-fork, tripalm or ten-point bulls). B.C. Reg. 190/84 Schedule 6 item 12, as consolidated to October 27, 2026, opens August 23 to October 31 to any bull and states no such restriction." },
  { kind: "extra", schedule: 7, section: "s. 1 (2), (4)", species: MOOSE, units: "7-2 to 7-15", season: "Sept. 1 to Sept. 9",
    appliesWhen: { permittedImplements: BOW }, points: SPIKE_FORK,
    quote: "The open season for hunting with a bow only in M.U.s 7-2 to 7-15 for bull moose is September 1 to September 9" },
  { kind: "points", schedule: 7, section: "s. 3 (1)", items: ["14", "17"], species: MOOSE, points: SPIKE_FORK,
    quote: "there is no open season on bull moose in M.U.s 7-2 to 7-18, 7-23 to 7-30 and 7-38 from September 10 to November 5, or in M.U.s 7-37 and 7-39 to 7-41 from August 15 to November 5 unless the bull moose has no more than two tines (points) on one antler" },
  { kind: "points", schedule: 7, section: "s. 13 (5)", items: ["20", "20.1"], species: MOOSE, points: SPIKE_FORK_TRIPALM_TEN,
    quote: "unless that bull moose (d) has no more than two points on one antler, (e) has at least one antler with a distinct brow palm bearing three or more points, or (f) has at least one antler which has at least ten tines" },
  { kind: "area", id: "bc-s7-13-closed", schedule: 7, section: "s. 13 (8), (10)", species: MOOSE,
    name: "The mapped portions of M.U.s 7-31 and 7-51 closed to moose",
    candidateAreas: ["7-31", "7-51"],
    quote: "There is no open season for moose in that portion of M.U. 7-31 outlined in red on map '2022 Moose 7-31 Closed Season'" },
  { kind: "area", id: "bc-s7-13-leh-zones", schedule: 7, section: "s. 13 (11), (12)", species: MOOSE,
    name: "Zone A of M.U. 7-52, Zones A and B of M.U. 7-33 and Zone A of M.U. 7-43, open to moose only under limited entry hunting",
    candidateAreas: ["7-33", "7-43", "7-52"],
    quote: "there is no open season on moose in any of the following: (a) Zone A of M.U. 7-33" },
  { kind: "points", schedule: 8, section: "s. 8 (1)", items: ["10"], species: MOOSE, points: SPIKE_FORK,
    quote: "there is no open season for bull moose in Region 8 unless the bull moose has no more than two tines (points) on one antler" },
  // Elk (third wave), read 2026-10-29 from the consolidation current to October 27, 2026.
  { kind: "extra", schedule: 4, section: "s. 15 (4)", species: ELK, units: "4-1 to 4-7, 4-20 to 4-26, 4-34 to 4-36, 4-40", season: "Sept. 1 to Sept. 9",
    appliesWhen: { permittedImplements: BOW }, bull: true,
    quote: "the open season for hunting with a bow only for bull elk in M.U.s 4-1 to 4-9, 4-14 to 4-38, and 4-40 is September 1 to September 9" },
  { kind: "extra", schedule: 4, section: "s. 15 (4), (4.1)", species: ELK, units: "4-8, 4-9, 4-14 to 4-19, 4-27 to 4-33, 4-37, 4-38", season: "Sept. 1 to Sept. 9",
    appliesWhen: { permittedImplements: BOW }, points: ELK6,
    quote: "There is no open season for hunting bull elk in M.U.s 4-8, 4-9, 4-14 to 4-19, 4-27 to 4-33, 4-37 and 4-38 from September 1 to September 9 unless the bull elk has at least one antler with at least 6 tines (points)" },
  { kind: "extra", schedule: 6, section: "s. 16 (1)", species: ELK, units: "6-13", season: "Sept. 1 to Sept. 14",
    appliesWhen: { permittedImplements: BOW }, bull: true,
    quote: "The open season for hunting bull elk with a bow only in M.U. 6-13 is September 1 to September 14" },
  { kind: "extra", schedule: 7, section: "s. 11 (9), (10)", species: ELK, units: "7-50", season: "Sept. 10 to Oct. 31",
    appliesWhen: { permittedImplements: BOW }, points: ELK3,
    quote: "A person commits an offence if the person kills a bull elk during the bow only season in M.U. 7-50 unless the bull has at least one branched antler with at least three tines (points)" },
  { kind: "extra", schedule: 7, section: "s. 11 (9), (11)", species: ELK, units: "7-2 to 7-18, 7-23 to 7-30, 7-38 to 7-40", season: "Sept. 1 to Sept. 9",
    appliesWhen: { permittedImplements: BOW }, points: ELK6,
    quote: "A person commits an offence if the person kills a bull elk during the bow only season in M.U.s 7-02 to 7-18, 7-23 to 7-30 and 7-38 to 7-40 unless the bull elk has at least one branched antler with at least six tines (points)" },
  { kind: "extra", schedule: 8, section: "s. 14 (1)", species: ELK, units: "8-1 to 8-15, 8-21 to 8-26", season: "Sept. 1 to Sept. 9",
    appliesWhen: { permittedImplements: BOW }, points: ELK6,
    quote: "The open season for hunting with a bow only for bull elk that have at least one branched antler with at least 6 tines (points) in M.U.s 8-1 to 8-15 and 8-21 to 8-26 is September 1 to September 9" },
  { kind: "area", id: "bc-s7-elk-7-42a", schedule: 7, section: "s. 11 (1)", species: [],
    name: "Zone A of M.U. 7-42 for elk (map '2010 Elk GOS Zone A of 7-42')", candidateAreas: ["7-42"],
    quote: "Zone A of M.U. 7-42, as shown on map '2010 Elk GOS Zone A of 7-42'" },
  { kind: "area", id: "bc-s7-elk-7-42b", schedule: 7, section: "s. 11 (3)", species: [],
    name: "Zone B of M.U. 7-42 for elk (map '2010 Elk GOS Zone B of 7-42')", candidateAreas: ["7-42"],
    quote: "Zone B of M.U. 7-42, as shown on map '2010 Elk GOS Zone B of 7-42'" },
  { kind: "area", id: "bc-s7-elk-7-20a", schedule: 7, section: "s. 11 (12), (13)", species: [],
    name: "Zone A of M.U. 7-20 for elk (map '2010 Elk GOS Zone A of 7-20'), reaching into M.U.s 7-21, 7-35, 7-45 and 7-46",
    candidateAreas: ["7-20", "7-21", "7-35", "7-45", "7-46"],
    quote: "Zone A of M.U. 7-20, as shown on map '2010 Elk GOS Zone A of 7-20'" },
  { kind: "area", id: "bc-s7-elk-7-43a", schedule: 7, section: "s. 2 (10)", species: [],
    name: "Zone A of M.U. 7-43 (west of the line described in Schedule 7 Part 2 s. 2 (10))", candidateAreas: ["7-43"],
    quote: "Zone A of M.U. 7-43 lies to the west and Zone B of M.U. 7-43 lies to the east of the following described line" },
  { kind: "area", id: "bc-s7-elk-7-43b", schedule: 7, section: "s. 2 (10)", species: [],
    name: "Zone B of M.U. 7-43 (east of the line described in Schedule 7 Part 2 s. 2 (10))", candidateAreas: ["7-43"],
    quote: "Zone B of M.U. 7-43 lies to the east of the following described line" },
  // Deer (fourth wave): the areas its seasons and restrictions name, in british-columbia-deer.mjs.
  ...DEER_AREAS,
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

/*
 * EVERY ELK ROW, READ BY HAND.
 *
 * Elk rows name map zones inside Management Units, and their antler
 * restrictions live in Part 2 clauses that overlap one another, so each row is
 * stated here as the rules it makes: its units or zones, its class, the points
 * the Part 2 clauses leave open there, and every disagreement found reading it.
 * `spec` is the row's unit column as printed (asterisks removed); a changed row
 * fails the build rather than being read through a stale plan.
 *
 * Restrictions compose: two "no open season … unless" clauses reaching the same
 * place and days both apply, so the stricter one decides. Where that reading
 * and the synopsis differ, both are carried — `reading: "LAW"` holds in the
 * world where the regulation as written is right, `"SYNOPSIS"` in the other —
 * and the engine answers CONFLICT exactly where they lead to different answers.
 */
const ELK_LAW_VS_SYNOPSIS = {
  "7-44, 7-58": "B.C. Reg. 190/84 Schedule 7 Part 2 s. 11 (12) opens 3-point bull elk in M.U.s 7-44 and 7-58 from September 1 to October 31, but s. 11 (13) (7-44) and s. 11 (3) (7-58) close the same days to any bull with fewer than 6 points, and both restrictions apply. The 2026–2028 synopsis prints a 3-point season for both units.",
  "7-45": "In the part of M.U. 7-45 outside Zone A of 7-20, B.C. Reg. 190/84 Schedule 7 Part 2 s. 11 (13) closes September 1 to October 31 to any bull elk with fewer than 6 points, on top of s. 11 (12)'s 3-point restriction. The 2026–2028 synopsis prints a 3-point season for all of M.U. 7-45.",
  "7-35": "In the part of M.U. 7-35 outside Zone A of 7-20, B.C. Reg. 190/84 opens elk (Schedule 7 items 24 and 27.11, with Part 2 s. 11 (13) requiring 6 points for bulls). The 2026–2028 synopsis prints the 7-35 elk seasons for the shaded portion of the unit only (its Map H12), and none outside it.",
  "7-32 to 7-34": "The 2026–2028 synopsis prints a 3-point bull elk season (September 1 to October 31) and an antlerless elk season (September 15 to October 15) in M.U.s 7-32 to 7-34. B.C. Reg. 190/84 Schedule 7, as consolidated to October 27, 2026, lists neither.",
  "8 any weapon": "B.C. Reg. 190/84 Schedule 8 item 11 opens 6-point bull elk in M.U.s 8-1 to 8-15 and 8-21 to 8-26 from September 1 to October 20 with any weapon. The 2026–2028 synopsis prints that general season from September 10, with September 1 to 9 for bows only.",
};
const ELK_PLAN = {
  "4:8.1": { spec: "4-1 to 4-7, 4-20 to 4-26, 4-34 to 4-36, 4-40", section: "Part 2 s. 2 (a)",
    rules: [{ units: "4-1 to 4-7, 4-20 to 4-26, 4-34 to 4-36, 4-40", points: ELK6 }] },
  "4:8.2": { spec: "4-08, 4-09, 4-14 to 4-19, 4-27 to 4-33, 4-37, 4-38", section: "Part 2 s. 2 (b)",
    rules: [{ units: "4-8, 4-9, 4-14 to 4-19, 4-27 to 4-33, 4-37, 4-38", points: ELK6 }] },
  "6:13": { spec: "6-13", rules: [{ units: "6-13" }] },
  "6:13.1": { spec: "6-1, 6-2, 6-4 to 6-6, 6-8, 6-9", section: "Part 2 s. 16 (2)",
    rules: [{ units: "6-1, 6-2, 6-4 to 6-6, 6-8, 6-9", points: ELK6 }] },
  "7:21": { spec: "7-2 to 7-18, 7-23 to 7-30, 7-38 to 7-40", section: "Part 2 s. 11 (3)",
    rules: [{ units: "7-2 to 7-18, 7-23 to 7-30, 7-38 to 7-40", points: ELK6 }] },
  "7:22": { spec: "7-49, 7-50 and Zone A of M.U. 7-42 as described in the Limited Entry Hunting Regulation, Schedule II, as shown on map 2009/2010 Elk Zone A and B of 7-42", section: "Part 2 s. 11 (1)",
    rules: [{ units: "7-49, 7-50", include: ["bc-s7-elk-7-42a"], points: ELK3 }] },
  "7:23": { spec: "7-19 to 7-22, 7-31, 7-36, Zone A of 7-43 as described in section 2 (10) of Part 2, those portions of 7-20, 7-21 and 7-46 located outside Zone A of 7-20 as shown on map '2010 Elk GOS Zone A of 7-20'", section: "Part 2 s. 11 (13)",
    rules: [
      { units: "7-19, 7-22, 7-31, 7-36", include: ["bc-s7-elk-7-43a"], points: ELK6 },
      // Inside Zone A of 7-20 item 24 governs (3 points, s. 11 (12)); this row reaches the rest of these units.
      { units: "7-20, 7-21, 7-46", exclude: ["bc-s7-elk-7-20a"], points: ELK6 },
    ] },
  "7:24": { spec: "7-35, 7-44, 7-45, 7-58, Zone A of 7-20 as shown on map '2010 Elk GOS Zone A of 7-20', Zone B of 7-43 as described in section 2 (10) of Part 2", section: "Part 2 s. 11 (12)",
    rules: [
      { include: ["bc-s7-elk-7-20a", "bc-s7-elk-7-43b"], points: ELK3 },
      { units: "7-44, 7-58", points: ELK6 },
      { units: "7-44, 7-58", points: ELK35, reading: "SYNOPSIS", dispute: "7-44, 7-58" },
      { units: "7-45", exclude: ["bc-s7-elk-7-20a"], points: ELK6 },
      { units: "7-45", exclude: ["bc-s7-elk-7-20a"], points: ELK35, reading: "SYNOPSIS", dispute: "7-45" },
      { units: "7-35", exclude: ["bc-s7-elk-7-20a"], points: ELK6, reading: "LAW", dispute: "7-35" },
    ] },
  "7:25": { spec: "7-37, 7-41, 7-57, Zone B of 7-42 as shown on map '2010 Elk GOS Zone B of 7-42'", section: "Part 2 s. 11 (3)",
    rules: [{ units: "7-37, 7-41, 7-57", include: ["bc-s7-elk-7-42b"], points: ELK6 }] },
  "7:26": { spec: "7-48, 7-49, 7-50 and Zone A of M.U. 7-42 as described in the Limited Entry Hunting Regulation, Schedule II, as shown on map 2009/2010 Elk Zone A and B of 7-42", section: "Part 2 s. 11 (3)",
    rules: [{ units: "7-48, 7-49, 7-50", include: ["bc-s7-elk-7-42a"], points: ELK6 }] },
  "7:27": { spec: "7-51, 7-52, 7-53, 7-54", section: "Part 2 s. 11 (3)", rules: [{ units: "7-51 to 7-54", points: ELK6 }] },
  "7:27.11": { spec: "7-44, 7-45, 7-49, 7-58, Zone A of 7-20 as shown on map '2010 Elk GOS Zone A of 7-20', 7-35, Zone B of 7-43 as described in section 2 (10) of Part 2",
    rules: [
      { units: "7-44, 7-45, 7-49, 7-58", include: ["bc-s7-elk-7-20a", "bc-s7-elk-7-43b"] },
      { units: "7-35", exclude: ["bc-s7-elk-7-20a"], reading: "LAW", dispute: "7-35" },
    ] },
  "8:11": { spec: "8-1 to 8-15, 8-21 to 8-26", section: "Part 2 s. 2 (1)",
    rules: [
      { units: "8-1 to 8-15, 8-21 to 8-26", points: ELK6, season: "Sept. 10 to Oct. 20" },
      { units: "8-1 to 8-15, 8-21 to 8-26", points: ELK6, season: "Sept. 1 to Sept. 9", reading: "LAW", dispute: "8 any weapon" },
    ] },
};

/* Seasons only the synopsis prints, carried as its reading of a dispute. */
const ELK_SYNOPSIS_ONLY = [
  { schedule: 7, units: "7-32 to 7-34", season: "Sept. 1 to Oct. 31", points: ELK3, dispute: "7-32 to 7-34" },
  { schedule: 7, units: "7-32 to 7-34", season: "Sept. 15 to Oct. 15", antlerless: true, dispute: "7-32 to 7-34" },
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
  "6:12": "Schedule 6 moose: Part 2 s. 6 (4), the limited-entry-only zones, is reviewed above; s. 6 states no antler restriction.",
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

/*
 * How to recognise each of this bundle's species in the Limited Entry Hunting
 * schedule, declared rather than guessed.
 *
 * DECLARED SO THE BUILD FAILS CLOSED. A species added to this bundle without a
 * probe here stops the build, because the alternative is silently treating it
 * as "not in LEH" and stating an unlisted unit CLOSED for a species limited
 * entry may well cover — a restriction stricter than the source, which is as
 * false as an invented permission.
 *
 * The probes are the common names the schedule itself uses. Checked 2026-09-23
 * against B.C. Reg. 134/93 Schedule I: black bear appears (item 1177, Haida
 * Gwaii, MUs 6-12 and 6-13); grouse, ptarmigan and hare appear NOWHERE. Turkey
 * appears 24 times, so game birds are not categorically outside limited entry
 * — which is why this is read rather than assumed.
 */
const LEH_PROBES = {
  "species:american-black-bear": ["black bear"],
  "species:ruffed-grouse": ["ruffed grouse", "grouse"],
  "species:spruce-grouse": ["spruce grouse", "grouse"],
  "species:sharp-tailed-grouse": ["sharp-tailed grouse", "sharp tailed grouse", "grouse"],
  "species:rock-ptarmigan": ["rock ptarmigan", "ptarmigan"],
  "species:willow-ptarmigan": ["willow ptarmigan", "ptarmigan"],
  "species:snowshoe-hare": ["snowshoe hare"],
  "species:moose": ["moose"],
  "species:elk": ["elk"],
  // Schedule I names "mule (black-tailed) deer" 92 times and white-tailed deer nowhere (read 2026-10-29).
  "species:mule-deer": ["mule (black-tailed) deer", "mule deer"],
  "species:white-tailed-deer": ["white-tailed deer"],
};

/** The species B.C. Reg. 134/93 Schedule I names, read from the schedule. */
function limitedEntrySpecies(lehText, speciesIds) {
  const text = lehText.toLowerCase();
  const named = new Set();
  for (const speciesId of speciesIds) {
    const probes = LEH_PROBES[speciesId];
    if (!probes) {
      throw new Error(
        `${speciesId} has no limited-entry probe. Add one to LEH_PROBES after checking B.C. Reg. 134/93 ` +
        "Schedule I: without it this build cannot say whether an unlisted unit is closed for this species.",
      );
    }
    if (probes.some((probe) => text.includes(probe))) named.add(speciesId);
  }
  return named;
}

export async function build({ offline } = {}) {
  const inventory = JSON.parse(readFileSync(INVENTORY, "utf8")).officialIdentifiers;
  if (inventory.length !== 225) throw new Error(`Expected the 225 certified Management Units, found ${inventory.length}`);
  const zoneIdOf = (unit) => `${ZONE_PREFIX}${unit}`;

  const body = await read(BC_DOCUMENTS.body.id, offline);
  /*
   * The limited entry schedule, read so the closed-world claim above can be
   * made for the species it does NOT name — and withheld for the ones it does.
   */
  const lehText = (await read(BC_DOCUMENTS.leh.id, offline)).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const LEH_STATED = "a limited entry hunting authorization is required to hunt a species of wildlife referred to in column 5 of an item in Schedule I " +
    "during a period set out in column 4 of the item in an area defined by columns 1, 2 and 3 of the item";
  const LEH_SOURCE = "source:ca-bc-limited-entry-hunting";
  const consolidated = consolidationDate(body);
  const bodyText = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const LEGAL_TIME = "The prohibited hours for hunting wildlife are from one hour after sunset on any day until one hour before sunrise of the day following.";
  if (!containsVerbatim(bodyText, LEGAL_TIME)) throw new Error("s. 14 (1) no longer reads as reviewed");
  /*
   * s. 14 (2) narrows MIGRATORY GAME BIRDS to half an hour either side, DESPITE
   * s. 14 (1)'s hour. It binds no species British Columbia serves today, so it
   * is latent — and that is exactly why it is carried rather than left out. A
   * migratory species served later would otherwise inherit the hour, a window
   * 30 minutes too generous at each end, in the direction that puts a hunter
   * outside the law. Read once now, or remembered by someone later.
   */
  const LEGAL_TIME_MIGRATORY = "Despite subsection (1), the prohibited hours for hunting migratory game birds are from one-half hour after sunset on any day until one-half hour before sunrise of the day following.";
  if (!containsVerbatim(bodyText, LEGAL_TIME_MIGRATORY)) throw new Error("s. 14 (2) no longer reads as reviewed");
  const ABSENCE = "The open seasons for the hunting of each species and type of game animal, subject to section 6, are those set forth in Parts 1 and 2 of each Schedule.";
  if (!containsVerbatim(bodyText, ABSENCE)) throw new Error("s. 4 no longer reads as reviewed");
  const CLOSURE_ORDERS = "An open season declared by this regulation shall cease to be in effect in any area";
  if (!containsVerbatim(bodyText, CLOSURE_ORDERS)) throw new Error("s. 5 no longer reads as reviewed");

  const schedules = {};
  const sources = [{
    id: BODY_SOURCE, authority: "Province of British Columbia", title: BC_DOCUMENTS.body.title,
    url: `${BC_LAWS}/${BC_DOCUMENTS.body.id}`, sourceHashes: { body: sha256([LEGAL_TIME, LEGAL_TIME_MIGRATORY, ABSENCE, CLOSURE_ORDERS].join("\n")) },
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

  for (const clause of [...DEER_RESTRICTIONS, ...DEER_EXTRAS, ...Object.values(DEER_ROWS).flatMap((plan) => (plan.bow ? [{ ...plan.bow, schedule: Number(Object.keys(DEER_ROWS).find((key) => DEER_ROWS[key] === plan).split(":")[0]) }] : []))]) {
    if (!containsVerbatim(schedules[clause.schedule].partTwo, clause.quote)) {
      throw new Error(`Schedule ${clause.schedule} ${clause.section}: reviewed deer clause no longer appears verbatim: "${clause.quote.slice(0, 80)}…"`);
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

  const addRule = ({ speciesId, schedule, item, section, spec, units, ranges, appliesWhen, animalClasses, bagText, partThree, notes = [], disputes = [], excludeSpecials = [], includeSpecials = [], label, reading, keepUnits = false, windows: given, seasonPhrase }) => {
    /* Every window says whether it spans the turn of the year; a resolved window
       never wraps, so its own dates decide it. */
    const windows = (given ?? ranges.flatMap((range) => windowsIn(range, PERIOD)))
      .map((window) => ({ ...window, crossesYear: window.opensIso.slice(0, 4) !== window.closesIso.slice(0, 4) }));
    const { limits, partThreeNote } = limitsFrom(bagText, schedule, speciesId, partThree);
    const geography = {
      statedAs: spec,
      include: { ghas: includeSpecials.length && !keepUnits ? [] : units, gbhz: [], special: includeSpecials },
      exclude: { ghas: [], special: excludeSpecials },
    };
    const identity = { speciesId, schedule, item, section, units, ranges: ranges.map((range) => range.statedAs), appliesWhen, excludeSpecials, includeSpecials, disputes,
      ...(reading ? { reading } : {}), ...(given ? { windows: given.map((window) => [window.opensIso, window.closesIso]) } : {}) };
    const id = `regulatory_rule:ca-bc-2026-${speciesId.slice("species:".length)}-${hash8(identity)}`;
    if (seen.has(id)) throw new Error(`Duplicate rule ${id}`);
    seen.add(id);
    rules.push({
      id,
      speciesId,
      regulatoryGroupId: groupFor(spec, units),
      geography,
      appliesWhen,
      ...(animalClasses ? { animalClasses } : {}),
      seasonLabel: label,
      seasonPhrase: seasonPhrase ?? ranges.map((range) => range.statedAs).join("; "),
      windows,
      declaredNoSeason: false,
      limits,
      conditionIds: [],
      caveats: [],
      notes: [...notes, ...(partThreeNote ? [partThreeNote] : [])],
      disputes,
      ...(reading ? { reading } : {}),
      sourceId: SOURCE_ID(schedule),
      sourceSection: section,
      sourceVersion: `B.C. Reg. 190/84, consolidated to ${consolidated}`,
      reviewStatus: "VERIFIED",
    });
  };

  // Part 1 rows.
  const deerSeasons = [];
  const unexplained = [];
  const notEncoded = [];
  for (let schedule = 1; schedule <= 8; schedule += 1) {
    const { rows, partThree } = schedules[schedule];
    for (const row of rows) {
      const species = speciesOf(row.species);
      if (species.includes("species:elk")) {
        addElkRow(schedule, row, partThree);
        continue;
      }
      const deer = deerRowOf(row.species);
      if (deer) {
        const plan = DEER_ROWS[`${schedule}:${row.item}`];
        if (!plan) throw new Error(`Schedule ${schedule} item ${row.item} (${row.species}) has no reviewed deer plan`);
        const printed = row.units.replace(/\*+/g, "").replace(/\s+/g, " ").trim();
        if (printed !== plan.spec) throw new Error(`Schedule ${schedule} item ${row.item} no longer prints its units as reviewed: "${printed}"`);
        for (const part of plan.parts ?? [{ units: plan.spec }]) {
          const ranges = parseSeasons(part.season ?? row.season);
          deerSeasons.push({
            ...deer, schedule, item: row.item, units: part.units, include: part.include ?? [], exclude: part.exclude ?? [],
            windows: ranges.flatMap((range) => windowsIn(range, PERIOD)), bow: Boolean(plan.bow), ages: deer.youth ? ["UNDER_18"] : null,
            bagText: row.bag, partThree, section: `Schedule ${schedule}, Part 1, item ${row.item}${plan.bow ? ` (bow only, Part 2 ${plan.bow.section})` : ""}`,
            phrase: ranges.map((range) => range.statedAs).join("; "), dispute: part.dispute,
          });
        }
        continue;
      }
      if (/^FALLOW DEER$/i.test(row.species.trim())) {
        notEncoded.push(`Schedule ${schedule} item ${row.item}: fallow deer (an introduced species the library does not hold as quarry)`);
        continue;
      }
      if (!species.length) {
        if (/GROUSE|PTARMIGAN/i.test(row.species)) notEncoded.push(`Schedule ${schedule} item ${row.item}: ${row.species} (blue grouse is not in the species library)`);
        continue;
      }
      const marked = /\*\*(?!\*)/.test(`${row.units} ${row.season} ${row.bag.replace(/\*\*\*/g, "")}`);
      const youth = REVIEWED_PART_TWO.find((clause) => clause.kind === "youth" && clause.schedule === schedule && clause.items.includes(row.item));
      const none = REVIEWED_PART_TWO.find((clause) => clause.kind === "none" && clause.schedule === schedule && clause.items.includes(row.item));
      const points = REVIEWED_PART_TWO.find((clause) => clause.kind === "points" && clause.schedule === schedule && clause.items.includes(row.item));
      const cls = classOf(row.species);
      if (marked && !youth && !none && !points && !PART_TWO_NOT_REACHING[`${schedule}:${row.item}`]) unexplained.push(`Schedule ${schedule} item ${row.item} (${row.species})`);
      const { units } = expandUnits(row.units, inventory);
      const spec = row.units.replace(/\*+/g, "").trim();
      const ranges = parseSeasons(row.season);
      const dispute = REVIEWED_SYNOPSIS_DISPUTES.find((entry) => entry.schedule === schedule && entry.item === row.item);
      for (const speciesId of species) {
        const common = {
          speciesId, schedule, item: row.item, section: `Schedule ${schedule}, Part 1, item ${row.item}`, spec, units,
          appliesWhen: {
            ...(youth ? { HUNTER_AGE: "UNDER_18" } : {}),
            ...(cls ? { [CLASS_KEY]: cls.key } : {}),
            ...(points ? { [POINTS_KEY]: points.points.length === 1 ? points.points[0] : points.points } : {}),
          },
          animalClasses: points ? [pointsDisplay(points.points)] : cls?.display,
          bagText: row.bag, partThree,
          notes: [
            ...(youth ? [`Restricted to persons under 18 (Schedule ${schedule} Part 2 ${youth.section}).`] : []),
            ...(none ? [none.note] : []),
            ...(points ? [`Antler restriction, Schedule ${schedule} Part 2 ${points.section}: ${pointsNote(points.points)}`] : []),
          ],
          excludeSpecials: excludedBySpecies(schedule, speciesId),
          label: youth ? "Youth season" : "General open season",
        };
        const contested = REVIEWED_PART_TWO.find((clause) => clause.kind === "synopsisArea" && clause.schedule === schedule
          && clause.item === row.item && clause.species.includes(speciesId));
        addRule({ ...common, ranges, excludeSpecials: [...common.excludeSpecials, ...(contested ? [contested.area] : [])] });
        if (contested) {
          const words = [{ words: { owner: "NORTH_GROUND", text: contested.statedAs } }];
          // The law's reading inside the area, held only where the synopsis is wrong…
          addRule({ ...common, ranges, includeSpecials: [contested.area], disputes: words, label: "General open season (disputed in this area)" });
          // …and the synopsis's, held exactly where the law's is not.
          addRule({
            ...common, ranges: parseSeasons(contested.season), includeSpecials: [contested.area], disputes: words, reading: "ALTERNATIVE",
            appliesWhen: { ...common.appliesWhen, [POINTS_KEY]: contested.points },
            animalClasses: [pointsDisplay(contested.points)],
            label: "Synopsis-only antler-restricted season",
            notes: [...common.notes, "Only the 2026–2028 synopsis states this season; the regulation does not."],
          });
        }
        if (dispute && dispute.species.includes(speciesId)) {
          addRule({
            ...common,
            ranges: parseSeasons(dispute.synopsisOnly),
            /* A dispute is North Ground's reading of a conflict its cross-check found, so it is authored by construction. */
            disputes: [{ words: { owner: "NORTH_GROUND", text: dispute.statedAs } }],
            label: "Synopsis-only dates",
            notes: [...common.notes, "Only the 2026–2028 synopsis states these dates; the regulation does not."],
          });
        }
      }
    }
  }
  if (unexplained.length) throw new Error(`First-wave rows marked "**" with no reviewed Part 2 reading:\n  ${unexplained.join("\n  ")}`);

  /* Elk: each Part 1 row through its reviewed plan. */
  function addElkRow(schedule, row, partThree) {
    const plan = ELK_PLAN[`${schedule}:${row.item}`];
    if (!plan) throw new Error(`Schedule ${schedule} item ${row.item} (${row.species}) has no reviewed elk plan`);
    const printed = row.units.replace(/\*+/g, "").replace(/\s+/g, " ").trim();
    if (printed !== plan.spec) throw new Error(`Schedule ${schedule} item ${row.item} no longer prints its units as reviewed: "${printed}"`);
    const antlerless = /ANTLERLESS/i.test(row.species);
    for (const entry of plan.rules) {
      addElkRule({ schedule, item: row.item, section: `Schedule ${schedule}, Part 1, item ${row.item}`, spec: plan.spec,
        entry, ranges: parseSeasons(entry.season ?? row.season), antlerless, bagText: row.bag, partThree, restriction: plan.section });
    }
  }
  function addElkRule({ schedule, item, section, spec, entry, ranges, antlerless, bagText, partThree, restriction, label }) {
    const units = entry.units ? expandUnits(entry.units, inventory).units : [];
    const disputes = entry.dispute ? [{ words: { owner: "NORTH_GROUND", text: ELK_LAW_VS_SYNOPSIS[entry.dispute] } }] : [];
    if (entry.dispute && !ELK_LAW_VS_SYNOPSIS[entry.dispute]) throw new Error(`No dispute text for ${entry.dispute}`);
    addRule({
      speciesId: "species:elk", schedule, item, section, spec, units, ranges,
      appliesWhen: {
        [CLASS_KEY]: antlerless ? "ANTLERLESS" : "ANTLERED",
        ...(entry.points ? { [POINTS_KEY]: entry.points.length === 1 ? entry.points[0] : entry.points } : {}),
      },
      animalClasses: antlerless ? ["ANTLERLESS"] : entry.points ? [pointsDisplay(entry.points)] : ["ANTLERED"],
      bagText, partThree,
      notes: [
        ...(entry.points && restriction ? [`Antler restriction, Schedule ${schedule} ${restriction}: ${pointsNote(entry.points)}`] : []),
        ...(entry.reading === "SYNOPSIS" ? ["Only the 2026–2028 synopsis states this; the regulation, read as written, does not."] : []),
      ],
      disputes,
      reading: entry.reading === "SYNOPSIS" ? "ALTERNATIVE" : undefined,
      includeSpecials: entry.include ?? [],
      excludeSpecials: entry.exclude ?? [],
      keepUnits: true,
      label: label ?? (antlerless ? "Antlerless season" : "General open season"),
    });
  }
  for (const entry of ELK_SYNOPSIS_ONLY) {
    addElkRule({ schedule: entry.schedule, item: null, section: `Schedule ${entry.schedule} (synopsis only)`, spec: entry.units,
      entry: { ...entry, reading: "SYNOPSIS" }, ranges: parseSeasons(entry.season), antlerless: Boolean(entry.antlerless),
      bagText: "1", partThree: schedules[entry.schedule].partThree, label: "Synopsis-only season" });
  }

  /* Deer: Part 1 rows and Part 2 seasons, composed with every Part 2 restriction. */
  const deerBag = (schedule, speciesId) => {
    const row = schedules[schedule].rows.find((candidate) => deerRowOf(candidate.species)?.species === speciesId);
    if (!row) throw new Error(`No Part 1 row gives a ${speciesId} bag limit in Schedule ${schedule}`);
    return row.bag;
  };
  for (const extra of DEER_EXTRAS) {
    const ranges = parseSeasons(extra.season);
    deerSeasons.push({
      species: extra.species, cls: extra.cls, schedule: extra.schedule, item: null, units: extra.units, include: extra.include ?? [],
      exclude: extra.exclude ?? [], windows: ranges.flatMap((range) => windowsIn(range, PERIOD)), bow: Boolean(extra.bow), ages: extra.ages ?? null,
      bagText: deerBag(extra.schedule, extra.species), partThree: schedules[extra.schedule].partThree,
      section: `Schedule ${extra.schedule}, Part 2, ${extra.section}`, phrase: ranges.map((range) => range.statedAs).join("; "), note: extra.note,
    });
  }
  for (const entry of DEER_SYNOPSIS_ONLY) {
    const ranges = parseSeasons(entry.season);
    deerSeasons.push({
      species: entry.species, cls: entry.cls, schedule: entry.schedule, item: null, units: entry.units, include: [], exclude: [],
      windows: ranges.flatMap((range) => windowsIn(range, PERIOD)), bow: false, ages: entry.ages ?? null,
      bagText: deerBag(entry.schedule, entry.species), partThree: schedules[entry.schedule].partThree,
      section: `Schedule ${entry.schedule} (synopsis only)`, phrase: ranges.map((range) => range.statedAs).join("; "),
      dispute: entry.dispute, reading: "SYNOPSIS", synopsisOnly: true,
    });
  }
  const composed = composeDeer(deerSeasons, DEER_RESTRICTIONS.map((restriction) => restriction), {
    expand: (spec) => expandUnits(spec, inventory).units,
    windowsFor: (days) => parseSeasons(days).flatMap((range) => windowsIn(range, PERIOD)),
  });
  for (const rule of composed) {
    const season = rule.season;
    const ages = rule.ages;
    addRule({
      speciesId: season.species, schedule: season.schedule, item: season.item, section: season.section,
      spec: season.units ?? (season.include ?? []).join(", "), units: rule.units, ranges: [], windows: rule.windows, seasonPhrase: season.phrase,
      appliesWhen: {
        ...(season.bow ? { permittedImplements: BOW } : {}),
        ...(rule.cls ? { [CLASS_KEY]: rule.cls } : {}),
        ...(rule.points ? { [POINTS_KEY]: rule.points.length === 1 ? rule.points[0] : rule.points } : {}),
        ...(ages ? { HUNTER_AGE: ages.length === 1 ? ages[0] : ages } : {}),
      },
      animalClasses: rule.cls === null ? ["ANTLERED", "ANTLERLESS"] : rule.points ? [pointsDisplay(rule.points)] : [rule.cls],
      bagText: season.bagText, partThree: season.partThree,
      notes: [
        ...(season.bow ? ["Bow only: the Wildlife Act defines a bow as a longbow or crossbow."] : []),
        ...(rule.points ? [`Antler restriction: ${pointsNote(rule.points)}`] : []),
        ...(ages ? [ages.includes("SENIOR_65") ? "Restricted to persons under 18 or at least 65 years of age." : "Restricted to persons under 18."] : []),
        ...(season.note ? [season.note] : []),
      ],
      includeSpecials: rule.include ?? [],
      excludeSpecials: [...(season.exclude ?? []), ...excludedBySpecies(season.schedule, season.species)],
      keepUnits: true,
      disputes: season.dispute ? [{ words: { owner: "NORTH_GROUND", text: DEER_DISPUTES[season.dispute] ?? (() => { throw new Error(`No dispute text ${season.dispute}`); })() } }] : [],
      reading: season.reading === "SYNOPSIS" ? "ALTERNATIVE" : undefined,
      label: season.synopsisOnly ? "Synopsis-only season" : season.bow ? "Bow only season" : ages ? (ages.includes("SENIOR_65") ? "Youth and senior season" : "Youth season") : rule.cls === "ANTLERLESS" ? "Antlerless season" : "General open season",
    });
  }

  // Part 2 seasons.
  for (const clause of REVIEWED_PART_TWO.filter((entry) => entry.kind === "extra")) {
    const units = expandUnits(clause.units, inventory).units;
    for (const speciesId of clause.species) {
      const bow = clause.appliesWhen.permittedImplements;
      const classed = clause.points || clause.bull;
      addRule({
        speciesId, schedule: clause.schedule, item: null, section: `Schedule ${clause.schedule}, Part 2, ${clause.section}`,
        spec: clause.units, units, ranges: parseSeasons(clause.season),
        appliesWhen: {
          ...clause.appliesWhen,
          ...(classed ? { [CLASS_KEY]: "ANTLERED" } : {}),
          ...(clause.points ? { [POINTS_KEY]: clause.points.length === 1 ? clause.points[0] : clause.points } : {}),
        },
        animalClasses: clause.points ? [pointsDisplay(clause.points)] : clause.bull ? ["ANTLERED"] : undefined,
        bagText: clause.bag ?? bagFor(schedules[clause.schedule].rows, speciesId), partThree: schedules[clause.schedule].partThree,
        notes: [
          ...(bow ? ["Bow only: the Wildlife Act defines a bow as a longbow or crossbow."] : []),
          ...(clause.onlyIn?.endsWith("private") ? ["Open on private property only (the owner's permission is needed to hunt there)."] : []),
          ...(clause.onlyIn?.endsWith("estuaries") ? ["This season applies only within one km of the named estuaries; elsewhere in M.U. 5-9 the general season applies."] : []),
          ...(clause.appliesWhen.HUNTER_AGE ? [`Restricted to persons under 18 (Schedule ${clause.schedule} Part 2 ${clause.section}).`] : []),
          ...(clause.points ? [`Antler restriction, Schedule ${clause.schedule} Part 2 ${clause.section}: ${pointsNote(clause.points)}`] : []),
        ],
        disputes: clause.dispute ? [{ words: { owner: "NORTH_GROUND", text: clause.dispute } }] : [],
        excludeSpecials: [...excludedBySpecies(clause.schedule, speciesId, { bowOnly: Boolean(bow), own: clause.onlyIn }), ...(clause.excludeAreas ?? [])],
        includeSpecials: clause.onlyIn ? [clause.onlyIn] : [],
        label: clause.label ?? (bow ? "Bow only season" : clause.onlyIn?.endsWith("private") ? "Private property season" : clause.onlyIn ? "Estuary season" : "Youth season"),
      });
    }
  }

  crossCheck(rules);

  const unitsWithRules = new Set(rules.flatMap((rule) => [...rule.geography.include.ghas, ...rule.geography.include.special.flatMap((id) => specialGeographies.find((special) => special.id === id).candidateAreas)]));
  /*
   * Which of this bundle's species limited entry actually names. Read from the
   * schedule rather than declared, so the closed-world claim rests on the
   * authority and a species nobody has checked stops the build.
   */
  const limitedEntry = limitedEntrySpecies(lehText, [...new Set(rules.map((rule) => rule.speciesId))].sort());
  if (!limitedEntry.size) {
    throw new Error(
      "No species in this bundle was found in B.C. Reg. 134/93 Schedule I. Black bear is expected there " +
      "(item 1177, Haida Gwaii); finding none means the schedule was not read as reviewed.",
    );
  }

  const bundle = {
    schemaVersion: 1,
    bundleId: "bundle:ca-bc-2026",
    jurisdictionId: "jurisdiction:ca-bc",
    sourceVersion: `B.C. Reg. 190/84, consolidated to ${consolidated}`,
    retrievedAt: isoDate(consolidated),
    contentHash: "",
    certifiedPeriod: PERIOD,
    /*
     * AN UNLISTED UNIT IS CLOSED, BECAUSE THE REGULATION SAYS SO.
     *
     * s. 4: "The open seasons ... are those set forth in Parts 1 and 2 of each
     * Schedule." s. 6, the only thing s. 4 is subject to, is "Restrictions on
     * open seasons" — it restricts Part 1 seasons and creates none. So the
     * Hunting Regulation is closed-world and a species with no row in a
     * Schedule has no general open season there.
     *
     * This read UNKNOWN until 2026-09-23, on one caveat: limited entry hunting
     * is set by a separate regulation nobody had read. That caveat is true —
     * for the species limited entry names. It was being applied to all of
     * them, so a certified CLOSED was suppressed for six species across 391
     * unit combinations. A refusal that looked principled, applied where its
     * reason did not hold.
     *
     * The caveat now attaches per species, to the ones B.C. Reg. 134/93
     * Schedule I actually names, read at build time.
     */
    absence: {
      meaning: "CLOSED",
      excludedCombination: "CLOSED",
      /* The authority's own sentence: `containsVerbatim` above throws if s. 4
         no longer reads this way, so this is a checked quotation. */
      words: { owner: "AUTHORITY", text: ABSENCE, sourceId: BODY_SOURCE, citation: "B.C. Reg. 190/84, s. 4", lang: "en-CA" },
      section: "B.C. Reg. 190/84, s. 4",
      sourceId: BODY_SOURCE,
      explanation:
        "No row of the Hunting Regulation's schedules names this Management Unit for this species, and s. 4 states that the open seasons are " +
        "those set forth in the Schedules.",
      speciesExceptions: Object.fromEntries([...limitedEntry].map((speciesId) => [speciesId, {
        meaning: "UNKNOWN",
        excludedCombination: "CLOSED",
        words: { owner: "AUTHORITY", text: LEH_STATED, sourceId: LEH_SOURCE, citation: "B.C. Reg. 134/93, s. 1.1", lang: "en-CA" },
        section: "B.C. Reg. 134/93, s. 1.1",
        sourceId: LEH_SOURCE,
        explanation:
          "No row of the Hunting Regulation's schedules names this Management Unit for this species, but limited entry hunting seasons for it " +
          "are set by B.C. Reg. 134/93, Schedule I, which North Ground has not encoded — so this is not stated as closed.",
      }])),
    },
    officialUnitCount: inventory.length,
    officialIdentifiers: inventory,
    units: inventory.map((unit) => ({ identifier: unit, zoneId: zoneIdOf(unit) })),
    specialGeographies,
    legalTime: { statedAs: LEGAL_TIME, section: "B.C. Reg. 190/84, s. 14 (1)" },
    /*
     * Exceptions to the general rule, each naming what it applies to. Kept
     * beside `legalTime` rather than replacing it: the general rule is still
     * the general rule, and a consumer reading only `legalTime` is not
     * silently given a narrower window meant for a different species group.
     */
    legalTimeExceptions: [
      {
        statedAs: LEGAL_TIME_MIGRATORY,
        section: "B.C. Reg. 190/84, s. 14 (2)",
        appliesTo: "migratory game birds",
      },
    ],
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
      "Sheep, goat, caribou, bison, cougar, wolf, coyote, furbearers, turkey, pheasant, partridge, quail, doves, waterfowl and every other species: not in this wave.",
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

const CLASS_KEY = "ANIMAL_CLASS:ANTLER_CLASS";
const POINTS_KEY = "ANIMAL_CLASS:ANTLER_POINTS";

/** The row's class as shown: one token naming exactly the bulls the restriction leaves open. */
function pointsDisplay(points) {
  const key = [...points].sort().join("+");
  if (key === "MOOSE_SPIKE_FORK") return "SPIKE_FORK_BULL";
  if (key === "MOOSE_SPIKE_FORK+MOOSE_TRIPALM_OR_TEN_POINT") return "SPIKE_FORK_TRIPALM_OR_TEN_POINT_BULL";
  if (key === "MD_FOUR_OR_MORE") return "BUCK_FOUR_POINT_OR_MORE";
  if (key === "MD_FOUR_OR_MORE+MD_TWO_OR_THREE") return "BUCK_TWO_POINT_OR_MORE";
  if (key === "ELK_SIX_OR_MORE") return "ANTLERED_SIX_POINT_OR_LARGER";
  if (key === "ELK_SIX_OR_MORE+ELK_THREE_TO_FIVE") return "ANTLERED_THREE_POINT_OR_LARGER";
  if (key === "ELK_THREE_TO_FIVE") return "ELK_THREE_TO_FIVE_POINT_BULL";
  throw new Error(`No display class for antler restriction ${key}`);
}

/** The restriction in North Ground's words; the regulation's own words are the clause's quote. */
function pointsNote(points) {
  const key = [...points].sort().join("+");
  if (key === "MOOSE_SPIKE_FORK") return "only a bull moose with no more than two points (tines) on one antler.";
  if (key === "MOOSE_SPIKE_FORK+MOOSE_TRIPALM_OR_TEN_POINT") {
    return "only a bull moose with no more than two points on one antler, with at least one antler bearing a distinct brow palm of three or more points, or with at least one antler of at least ten tines.";
  }
  if (key === "MD_FOUR_OR_MORE") return "only a mule deer buck with at least 4 points (tines) of at least 2.5 cm on one antler, not counting the brow tine.";
  if (key === "MD_FOUR_OR_MORE+MD_TWO_OR_THREE") return "only a mule deer buck with at least 2 points (tines) of at least 2.5 cm on one antler, not counting the brow tine.";
  if (key === "ELK_SIX_OR_MORE") return "only a bull elk with at least 6 points (tines) on one antler.";
  if (key === "ELK_SIX_OR_MORE+ELK_THREE_TO_FIVE") return "only a bull elk with at least one branched antler of at least 3 points (tines).";
  if (key === "ELK_THREE_TO_FIVE") return "a bull elk with 3 to 5 points on its best antler.";
  throw new Error(`No note for antler restriction ${key}`);
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
    // Sorted, so the same ranges always join the same way whichever order they arrived in.
    let list = [...keys].sort().map((key) => key.split("/").map(Number));
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
      const reviewed = DEER_RANGE_REVIEW[`${schedule}:${group}`];
      const onlyLaw = [...law].filter((key) => !printed.has(key) && !(reviewed?.onlyLaw ?? []).includes(key));
      const onlySynopsis = [...printed].filter((key) => !law.has(key) && !(reviewed?.onlySynopsis ?? []).includes(key));
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
