#!/usr/bin/env node
/**
 * Build the federal migratory-game-bird bundle from the regulation itself.
 *
 *   node scripts/build-federal-migratory-regulations.mjs [--check]
 *
 * Source: Migratory Birds Regulations, 2022 (SOR/2022-105), Schedule 3, which
 * s. 28(1) binds to directly. Not the annual summary, and NOT Environment and
 * Climate Change Canada's district layer, which is published as Draft with no
 * legal value.
 *
 * WAVE 1 covers the jurisdictions whose federal areas resolve without any new
 * geometry, because the regulation defines them over geography North Ground
 * already holds:
 *
 *   Prince Edward Island  "Throughout Prince Edward Island" — the province,
 *                         which is its whole hunting geography.
 *   Yukon                 latitude bands, computed exactly from the point.
 *   Alberta               explicit Provincial Wildlife Management Unit lists,
 *                         every one checked against the certified inventory.
 *
 * Everything this cannot read EXACTLY is refused into `notEncoded` with the
 * regulation's own words. That includes residency-varying limits, seasons
 * narrowed to a sub-list of units, and bag limits that change inside a window.
 * A bundle that guessed any of those would answer confidently and wrongly.
 */

import { readFileSync, writeFileSync } from "node:fs";
import {
  MBR_CITATION, MBR_URL, cellItems, cellText, partHtml, partTables, scheduleThree, sha256,
} from "./federal-migratory-source.mjs";
import { federalGroupFor, isRepealedRow } from "../src/lib/hunt/regulatory/federal-groups.ts";
import { parseRelativeWindow } from "../src/lib/hunt/regulatory/relative-date.ts";
import { saskatchewanZones } from "./saskatchewan-live-inventory.mjs";

const BUNDLE = "content/regulatory/ca-federal-2026.json";
const CACHE = "/tmp/mbr2022.html";

/*
 * Units a federal district defines only a PORTION of.
 *
 * Read from Schedule 3's own definitions: "the portions of Provincial Wildlife
 * Management Units 1D, 25 and 26 lying north of latitude 51° and east of
 * longitude 83°45′". A point in one of these is on one side of a line North
 * Ground does not hold, so it cannot be placed in a federal district and the
 * answer is UNKNOWN rather than a guess.
 *
 * NOTE the distinction that decides the whole wave: "the portion of ONTARIO
 * included in Units 42 to 44" is a WHOLE-unit list — the part of the province
 * those units make up. Only "the portionS of UNITS …" splits a unit. Reading
 * the word "portion" alone as a split said Ontario had NO resolvable districts,
 * which is wrong; what follows the word is what matters.
 */
const PORTION_OF_A_UNIT =
  /portions?\s+of\s+(?:Provincial\s+)?(?:Wildlife\s+Management\s+)?(?:Hunting\s+)?(?:Units?|Zones?)\b/i;

const SPLIT_UNITS = {
  "jurisdiction:ca-on": ["1D", "25", "26"],
  "jurisdiction:ca-qc": ["2", "18", "21", "27", "28"],
};

const WAVE_1 = [
  {
    part: 2, name: "Prince Edward Island", jurisdictionId: "jurisdiction:ca-pe",
    /* "Throughout Prince Edward Island" is the whole province, which is also
       the whole of its hunting geography (geography level JURISDICTION). */
    areaKind: "JURISDICTION",
  },
  {
    part: 12, name: "Yukon", jurisdictionId: "jurisdiction:ca-yt",
    /* Latitude bands the regulation states exactly, so they are computed from
       the point rather than drawn. */
    areaKind: "LATITUDE_BAND",
  },
  {
    part: 9, name: "Alberta", jurisdictionId: "jurisdiction:ca-ab",
    unitPhrase: "Provincial Wildlife Management Units",
    /* Explicit Provincial Wildlife Management Unit lists. */
    areaKind: "PROVINCIAL_UNITS",
    inventory: "content/regulatory/ca-ab-certified-units.json",
  },
  /* ── Wave 2: the districts defined over units North Ground already holds ── */
  {
    part: 10, name: "British Columbia", jurisdictionId: "jurisdiction:ca-bc",
    unitPhrase: "Provincial Management Units",
    /* All eight districts are whole-unit lists; none splits a unit. */
    areaKind: "PROVINCIAL_UNITS",
    inventory: "content/regulatory/ca-bc-certified-units.json",
  },
  {
    part: 6, name: "Ontario", jurisdictionId: "jurisdiction:ca-on",
    unitPhrase: "Provincial Wildlife Management Units",
    /* Central and Southern are whole-unit; Hudson-James Bay and Northern split
       1D, 25 and 26 by latitude 51° and longitude 83°45′. */
    areaKind: "PROVINCIAL_UNITS",
    inventory: "content/regulatory/ca-on-certified-units.json",
  },
  {
    part: 8, name: "Saskatchewan", jurisdictionId: "jurisdiction:ca-sk",
    unitPhrase: "Provincial Wildlife Management Zones",
    /*
     * Two whole-zone districts, and the only jurisdiction here whose inventory
     * is read from the authority's LIVE service instead of a stored file —
     * Saskatchewan's data may be used commercially but not resold, so North
     * Ground keeps no copy (owner decision, 2026-09-22). The build fails
     * closed if that service cannot be read.
     */
    areaKind: "PROVINCIAL_UNITS",
    liveInventory: "ca-sk",
  },
  {
    part: 5, name: "Quebec", jurisdictionId: "jurisdiction:ca-qc",
    unitPhrase: "Provincial Hunting Zones",
    /* Districts A, C and G are whole-zone; B, D, E and F split zones 2, 18,
       21, 27 and 28 by longitude, by a route, and by an electoral district. */
    areaKind: "PROVINCIAL_UNITS",
    inventory: "content/regulatory/ca-qc-certified-units.json",
  },
];

/** Yukon's bands, read from the regulation's own definitions. */
const LATITUDE_BAND =
  /^the portion of Yukon lying (?:north of latitude (\d+)\u00b0|south of latitude (\d+)\u00b0|between latitude (\d+)\u00b0 and (\d+)\u00b0)/;

/**
 * How many areas each Part must yield.
 *
 * Without this the degree sign in "between latitude 62\u00b0 and 66\u00b0N" quietly cost
 * Central Yukon: two bands were derived where the regulation defines three,
 * and nothing failed. A missing area is not an empty answer — it is a hunter
 * in central Yukon getting no federal rule while the build reports success.
 */
const EXPECTED_AREAS = {
  "jurisdiction:ca-pe": 1,
  "jurisdiction:ca-sk": 2,
  "jurisdiction:ca-yt": 3,
  "jurisdiction:ca-ab": 2,
  "jurisdiction:ca-bc": 8,
  /* Ontario and Québec yield only their WHOLE-unit districts; the ones that
     split a unit are refused below and are not areas. Québec is 2, not 3:
     District G is defined by a COUNTY (the Magdalen Islands), which is a
     different kind of geography and one North Ground does not hold. */
  "jurisdiction:ca-on": 2,
  "jurisdiction:ca-qc": 2,
};

const MONTHS = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
};

/** "October 1 to January 15" -> {from:{month,day}, to:{month,day}}, or null. */
function readWindow(text) {
  const match = /^([A-Z][a-z]+)\s+(\d{1,2})\s+to\s+([A-Z][a-z]+)\s+(\d{1,2})$/.exec(text.trim());
  if (!match) return null;
  const [, fromMonth, fromDay, toMonth, toDay] = match;
  if (!MONTHS[fromMonth] || !MONTHS[toMonth]) return null;
  return {
    from: { month: MONTHS[fromMonth], day: Number(fromDay) },
    to: { month: MONTHS[toMonth], day: Number(toDay) },
    /* A window whose end month precedes its start crosses the new year. */
    crossesYear: MONTHS[toMonth] < MONTHS[fromMonth],
    statedAs: text.trim(),
  };
}

/** A plain integer limit, or null where the cell says anything else. */
function readLimit(text) {
  const value = text.trim();
  if (/^No limit$/i.test(value)) return { kind: "NO_LIMIT", statedAs: value };
  if (/^N\/A$/i.test(value)) return { kind: "NOT_APPLICABLE", statedAs: value };
  const plain = /^(\d+)$/.exec(value);
  if (plain) return { kind: "COUNT", count: Number(plain[1]), statedAs: value };
  const withSub = /^(\d+)\s*\((.+)\)$/.exec(value);
  if (withSub) return { kind: "COUNT", count: Number(withSub[1]), subLimit: withSub[2], statedAs: value };
  return null;
}

const stripLabel = (text) => text.replace(/^\((?:[a-z]+|[ivx]+|[A-Z])\)\s*/, "").trim();


/**
 * The provincial units a federal area names, expanded against the AUTHORITY'S
 * OWN inventory rather than by integer arithmetic.
 *
 * "202 to 204" looks like 202, 203, 204 and Alberta's Wildlife Management
 * Units are not contiguous, so arithmetic would INVENT units that do not
 * exist — a wrong value that passes, because the arithmetic looks obviously
 * correct. Every unit named must already be in the certified inventory, and a
 * reference that resolves to nothing stops the build.
 */
function expandUnits(text, inventory, where, namedZones = new Map(), unitPhrase = "") {
  const units = new Set();
  const unreadable = [];
  for (const raw of text.replace(/\band\b/g, ",").split(",").map((part) => part.trim()).filter(Boolean)) {
    /*
     * A zone the regulation names in WORDS rather than by number: Saskatchewan
     * puts "the Saskatoon and Regina-Moose Jaw Provincial Wildlife Management
     * Zones" in District No. 2 (South). The name is matched against the
     * ministry's OWN name for the zone, exactly — never by resemblance, and
     * never against a designation this build made up from the words. A name
     * the authority does not publish is unreadable and refuses the district.
     */
    const bare = raw.replace(/^the\s+/i, "").replace(new RegExp(`\\s*${unitPhrase}$`, "i"), "").trim();
    const byName = namedZones.get(bare.toLowerCase());
    if (byName) { units.add(byName); continue; }

    const token = raw;
    const range = /^(\S+)\s+to\s+(\S+)$/.exec(token);
    if (range) {
      const inside = expandRange(range[1], range[2], inventory, where);
      if (!inside.length) unreadable.push(token);
      inside.forEach((unit) => units.add(unit));
      continue;
    }
    if (inventory.includes(token)) units.add(token);
    else unreadable.push(token);
  }
  if (unreadable.length) {
    throw new Error(`${where}: the regulation names units North Ground cannot resolve: ${unreadable.join(", ")}`);
  }
  return [...units].sort();
}

/**
 * A range, expanded by SELECTING from the authority's inventory — never by
 * generating designations.
 *
 * That property is the whole safety argument: every unit returned is one the
 * province publishes, so no arithmetic can invent one. Two forms, because two
 * authorities write ranges differently and a single loosened parser would
 * accept things that mean neither:
 *
 *   NUMBERED   "Units 53 to 59" (Ontario, Alberta, Saskatchewan, Québec).
 *   HYPHENATED "Units 1-1 to 1-15" (British Columbia).
 *
 * THE NUMBERED FORM RANGES OVER UNIT NUMBERS, NOT OVER UNIT NAMES, and that
 * distinction is load-bearing. Ontario's regulation says "53 to 59" while the
 * province publishes no unit called "53" at all — it publishes 53A and 53B.
 * Both are units numbered 53 and both are inside the range. Reading the
 * endpoints as literal names drops every lettered subdivision in the country,
 * silently, leaving a federal district missing the units it actually covers.
 */
function expandRange(from, to, inventory, where) {
  const numeric = /^(\d+)$/;
  if (numeric.test(from) && numeric.test(to)) {
    const [low, high] = [Number(from), Number(to)];
    if (high < low) throw new Error(`${where}: the range ${from} to ${to} runs backwards.`);
    /* Every published unit whose NUMBER falls in the range, lettered
       subdivisions included. Selection, so nothing can be invented. */
    return inventory.filter((unit) => {
      const number = /^(\d+)/.exec(unit);
      return number ? Number(number[1]) >= low && Number(number[1]) <= high : false;
    });
  }

  const hyphenated = /^(\d+)-(\d+)$/;
  const start = hyphenated.exec(from);
  const finish = hyphenated.exec(to);
  if (start && finish) {
    if (start[1] !== finish[1]) {
      throw new Error(`${where}: the range ${from} to ${to} crosses regions, which this build does not read.`);
    }
    const [low, high] = [Number(start[2]), Number(finish[2])];
    return inventory.filter((unit) => {
      const parts = hyphenated.exec(unit);
      return parts ? parts[1] === start[1] && Number(parts[2]) >= low && Number(parts[2]) <= high : false;
    });
  }

  /* A form this build has not been taught. Refused rather than guessed. */
  throw new Error(`${where}: the range ${from} to ${to} is not in a form this build reads.`);
}

/**
 * The derived areas an area cell names — by selection, never by parsing.
 *
 * Exactly one name, or a conjunction ("Districts C and D", "District No. 1
 * (North) and District No. 2 (South)").
 *
 * Every part must be a district the build RECOGNISES — one it derived, or one
 * it explicitly refused. That distinction is what keeps a silent parse failure
 * from looking like a refusal: an unrecognised name returns null and refuses
 * the whole row loudly, naming the district.
 *
 * A conjunction is then encoded for the parts that were DERIVED. Québec writes
 * one season for "Districts C and D"; C is derived and D was refused, and the
 * season the regulation states for both is correct in C. Dropping C too would
 * discard real coverage to no purpose — a point in D cannot resolve to D in
 * the first place, so nothing is gained by also refusing C.
 */
function areasNamedBy(cell, derived, recognised) {
  const value = cell.replace(/\u241F/g, " ").replace(/\s+/g, " ").trim();
  if (derived.includes(value)) return [value];
  if (recognised.includes(value)) return [];

  /* "Districts C and D" distributes the plural noun across both parts, so the
     singular is restored before matching; "District No. 1 (North) and District
     No. 2 (South)" already repeats it. */
  const plural = /^(Districts|Zones|Units)\s+(.+)$/.exec(value);
  const parts = (plural ? plural[2] : value).split(/\s+and\s+|,\s*/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  const singular = plural ? plural[1].replace(/s$/, "") : null;
  const named = parts.map((part) => {
    for (const candidate of [part, singular ? `${singular} ${part}` : null]) {
      if (candidate && (derived.includes(candidate) || recognised.includes(candidate))) return candidate;
    }
    return null;
  });
  if (!named.every(Boolean)) return null;
  return named.filter((part) => derived.includes(part));
}

/** One Part's definition block, as "term -> definition" pairs. */
function definitionsOf(partText) {
  const defs = new Map();
  /* "Zone No. 1 Zone No. 1 means Provincial Wildlife Management Units ... ( Zone n o 1 )"
     — the term is printed twice, then the definition, then the French name. */
  for (const match of partText.matchAll(/([A-Z][A-Za-z0-9 .'()-]{2,40}?)\s+\1\s+means\s+([^(]+?)\s*\(\s*[^)]*\)/g)) {
    defs.set(match[1].trim(), match[2].replace(/\s+/g, " ").trim().replace(/\.$/, ""));
  }
  return defs;
}

async function main() {
  /*
   * Read every live inventory BEFORE any parsing, so an unreachable authority
   * stops the build at the start rather than half-way through writing a
   * bundle. A partial bundle is worse than no bundle: it looks complete.
   */
  const liveZones = new Map();
  for (const entry of WAVE_1) {
    if (entry.liveInventory && !liveZones.has(entry.liveInventory)) {
      const zones = await saskatchewanZones();
      console.log(`${entry.name}: read ${zones.identifiers.length} zone identifiers live from ${zones.serviceUrl}`);
      liveZones.set(entry.liveInventory, zones);
    }
  }

  const html = readFileSync(CACHE, "utf8");
  const documentHash = sha256(html);
  const schedule = scheduleThree(html);

  const rules = [];
  const notEncoded = [];
  const areas = [];
  /* Districts whose DEFINITION was refused, per jurisdiction. A row naming one
     is refused knowingly; a row naming something in neither list is a parse
     failure and must be loud. */
  const refusedAreas = new Map();
  let considered = 0;

  for (const { part, name, jurisdictionId, areaKind, inventory, unitPhrase, liveInventory } of WAVE_1) {
    const partText = partHtml(schedule, part, name);
    const flat = cellText(partText.slice(0, partText.indexOf("<table"))).replace(/\u241F/g, " ");
    const definitions = definitionsOf(flat);

    if (areaKind === "PROVINCIAL_UNITS") {
      /*
       * The authority's inventory: a certified file, or — for Saskatchewan,
       * whose dataset North Ground is licensed to use but not to keep — the
       * ministry's own service, read now. Both do the same job: no unit
       * reference in the regulation may expand into a zone the province does
       * not publish. Saskatchewan's read failing stops the build; it is never
       * replaced by a remembered list, because a remembered list IS the stored
       * copy the licence decision rules out.
       */
      const live = liveInventory ? liveZones.get(liveInventory) : undefined;
      const certified = live
        ? live.identifiers
        : JSON.parse(readFileSync(inventory, "utf8")).certifiedUnits.map(String);
      /* The ministry's own DA_NAME, minus its "WMZ" suffix, for the zones the
         regulation names in words rather than by number. */
      const namedZones = new Map(
        [...(live?.names ?? [])]
          .map(([designation, daName]) => [daName.replace(/\s*WMZ$/i, "").trim().toLowerCase(), designation])
          .filter(([label]) => label && !/^wmz no\.?/i.test(label)),
      );
      for (const [term, definition] of definitions) {
        /*
         * A district that defines only a PORTION of a unit is refused whole.
         * The regulation draws a line inside that unit — latitude 51°,
         * longitude 83°45′, Route 185, an electoral district — and North
         * Ground holds none of them, so a point in that unit cannot be placed
         * on a side. Encoding the district's whole-unit half and silently
         * dropping the rest would answer confidently for units the regulation
         * only partly names.
         */
        if (PORTION_OF_A_UNIT.test(definition)) {
          notEncoded.push({
            where: `${name} Schedule 3 definitions`, statedAs: `${term}: ${definition}`,
            reason: "the district is defined by a portion of a provincial unit, and North Ground holds no line to place a point on a side of",
          });
          refusedAreas.set(jurisdictionId, [...(refusedAreas.get(jurisdictionId) ?? []), term]);
          continue;
        }
        /*
         * The authority's OWN wording, declared per jurisdiction rather than a
         * pattern loosened until everything matches. British Columbia writes
         * "Provincial Management Units"; Alberta and Ontario write "Provincial
         * WILDLIFE Management Units"; Saskatchewan writes Zones; Québec writes
         * "Provincial Hunting Zones". A regex widened to accept all of them
         * would also accept a wording that means something else, and a regex
         * relaxed until it passes is a threshold lowered until it passes.
         *
         * "the portion of ONTARIO included in <phrase> 42 to 44" is a
         * whole-unit list, so the leading words are stripped rather than read
         * as a split — that distinction is checked above, not here.
         */
        const named = new RegExp(`${unitPhrase}\\s+(.+)$`).exec(definition);
        if (!named) {
          /*
           * A district defined over something OTHER than provincial units.
           * Québec's District G is "the lands and waters included in the
           * County of the Magdalen Islands" — a COUNTY, which §8 makes a
           * first-class geography and never a zone, and which North Ground
           * does not hold. Refused with the reason rather than skipped: a
           * silent `continue` here is how a real place gets no federal rule
           * while the build reports success.
           *
           * The same shape Michigan raised from the other direction — the
           * governing geography is not always the same KIND of thing.
           */
          notEncoded.push({
            where: `${name} Schedule 3 definitions`, statedAs: `${term}: ${definition}`,
            reason: `the district is not defined over ${unitPhrase}, so North Ground cannot resolve it from provincial geography it holds`,
          });
          refusedAreas.set(jurisdictionId, [...(refusedAreas.get(jurisdictionId) ?? []), term]);
          continue;
        }
        const split = new Set(SPLIT_UNITS[jurisdictionId] ?? []);
        const units = expandUnits(named[1], certified, `${name} ${term}`, namedZones, unitPhrase).filter((unit) => !split.has(unit));
        areas.push({ jurisdictionId, kind: areaKind, name: term, statedAs: definition, units });
      }
      for (const unit of SPLIT_UNITS[jurisdictionId] ?? []) {
        notEncoded.push({
          where: `${name} Schedule 3 definitions`, statedAs: `Provincial unit ${unit}`,
          reason: "the regulation places only PART of this unit in a federal district, so a point in it answers UNKNOWN rather than being assigned a side",
        });
      }
      const inAnyArea = new Set(areas.filter((area) => area.jurisdictionId === jurisdictionId).flatMap((area) => area.units));
      const outside = certified.filter((unit) => !inAnyArea.has(unit));
      if (outside.length) {
        notEncoded.push({
          where: `${name} Schedule 3`, statedAs: `Units ${outside.join(", ")}`,
          reason: "the regulation places these certified provincial units in no federal area, so migratory-bird queries there are UNKNOWN rather than assumed into one",
        });
      }
    }

    if (areaKind === "LATITUDE_BAND") {
      for (const [term, definition] of definitions) {
        const band = LATITUDE_BAND.exec(definition);
        if (!band) continue;
        const [, northOf, southOf, betweenLow, betweenHigh] = band;
        areas.push({
          jurisdictionId, kind: areaKind, name: term, statedAs: definition,
          band: northOf ? { minLatitude: Number(northOf) }
            : southOf ? { maxLatitude: Number(southOf) }
            : { minLatitude: Number(betweenLow), maxLatitude: Number(betweenHigh) },
        });
      }
    }

    if (areaKind === "JURISDICTION") {
      areas.push({
        jurisdictionId, kind: areaKind, name: `Throughout ${name}`,
        statedAs: `Throughout ${name}`,
      });
    }

    const derived = areas.filter((area) => area.jurisdictionId === jurisdictionId).length;
    if (derived !== EXPECTED_AREAS[jurisdictionId]) {
      throw new Error(
        `${name}: derived ${derived} federal areas, expected ${EXPECTED_AREAS[jurisdictionId]}. ` +
        "An area the regulation defines and this build did not read would leave a real place with no federal rule.",
      );
    }

    const tables = partTables(partText);
    for (const table of tables) {
      const isTable1 = /TABLE 1/.test(table.caption);
      for (const row of table.grid) {
        const item = cellText(row[0] ?? "");
        if (!item || /^(Item|Column 1)$/.test(item)) continue;
        const speciesCell = cellText(row[2] ?? "");
        if (!speciesCell) continue;
        if (isRepealedRow(stripLabel(speciesCell))) continue;
        considered += 1;

        const where = `${name} Schedule 3 ${isTable1 ? "Table 1" : "Table 2"} item ${item}`;
        if (!isTable1) {
          notEncoded.push({ where, statedAs: table.caption.replace(/␟/g, " — "),
            reason: "Special measures for overabundant species are a separate regime and are not encoded in wave 1." });
          continue;
        }

        const group = federalGroupFor(speciesCell);
        if (!group) throw new Error(`${where}: unrecognised species group ${JSON.stringify(speciesCell)}`);

        /*
         * WHICH DERIVED AREAS THIS ROW IS ABOUT.
         *
         * The area cell was previously taken verbatim, and 67 of 194 rules —
         * over a third — named an area the bundle does not contain. Two
         * causes, both silent:
         *
         *   A CONJUNCTION. Saskatchewan's table says "District No. 1 (North)
         *   and District No. 2 (South)" in one cell; Québec's says "Districts
         *   C and D". Stored whole, the string matches neither district and
         *   the rule can never be found.
         *
         *   A REFUSED DISTRICT. Ontario's Hudson-James Bay and Northern
         *   districts, and Québec's B, E, F and G, were refused at definition
         *   time because the regulation splits provincial units along lines
         *   North Ground does not hold. Their ROWS were still encoded, against
         *   areas that were deliberately never derived.
         *
         * Neither published a wrong season — every one of those points already
         * answered UNKNOWN — but the build REPORTED them as encoded, and a
         * coverage count that overstates what can be answered is the thing
         * this project treats as the defect. A jurisdiction is serviced only
         * when it truthfully states what it knows.
         *
         * So the cell is resolved by SELECTION from the areas actually
         * derived for this jurisdiction, never by parsing district names out
         * of prose: an exact name, or a conjunction whose every part is a
         * derived name. Anything else is refused, with the district named.
         */
        const areaCell = cellText(row[1] ?? "");
        const derived = areas.filter((entry) => entry.jurisdictionId === jurisdictionId).map((entry) => entry.name);
        const areaNames = areasNamedBy(areaCell, derived, refusedAreas.get(jurisdictionId) ?? []);
        if (!areaNames?.length) {
          notEncoded.push({
            where, group: group.statedAs, area: areaCell,
            statedAs: [...cellItems(row[4] ?? ""), ...cellItems(row[5] ?? "")].join(" | "),
            reason: areaNames
              ? `the regulation writes this season for ${areaCell}, whose definition North Ground refused, so a point ` +
                `there answers UNKNOWN rather than being given this season`
              : `the regulation writes this season for ${areaCell}, which this build could not match to any federal ` +
                `area it derived or refused, so the row is refused rather than assigned to a district`,
          });
          continue;
        }

        for (const area of areaNames) {
          const seasons = cellItems(row[4] ?? "");
          const bags = cellItems(row[5] ?? "");
          const possessionCell = cellText(row[3] ?? "");

          /* A declared closure is CLOSED, not UNKNOWN: the authority has said
             there is no season, which is a different fact from silence. */
          if (seasons.length === 1 && /^No open season$/i.test(stripLabel(seasons[0]))) {
            rules.push({
              jurisdictionId, area, groupId: group.id, groupStatedAs: group.statedAs,
              declaredNoSeason: true, statedAs: "No open season", sourceSection: where,
            });
            continue;
          }

          /* Anything with a residency condition, a unit sub-list, or a limit that
             changes inside the window is refused whole. Encoding the readable
             half of such a row would publish a limit that is right for some
             hunters and wrong for others. */
          const rowText = [...seasons, ...bags, possessionCell].join(" | ");
          const refusal =
            /resident/i.test(rowText) ? "the limit or season varies by residency"
            : /\(in Provincial/i.test(rowText) ? "the season applies only in a sub-list of provincial units"
            : /\(from [A-Z]/i.test(rowText) ? "the daily bag changes inside the open season"
            : /plus an additional/i.test(rowText) ? "the daily bag carries an additional species-specific allowance"
            : null;
          if (refusal) {
            /*
             * Structured, not just prose: the evaluator must be able to find
             * these. A refused row still covers real dates — Yukon's August duck
             * season exists, for residents — and a date inside one must answer
             * UNKNOWN rather than CLOSED. Saying CLOSED there would state a
             * restriction STRICTER than the law, which is its own false claim.
             */
            notEncoded.push({
              where, group: group.statedAs, area, statedAs: rowText, reason: refusal,
              jurisdictionId, groupId: group.id, coversArea: area,
            });
            continue;
          }

          if (seasons.length !== 1 || bags.length !== 1) {
            notEncoded.push({ where, group: group.statedAs, area, statedAs: rowText,
              reason: "the row carries more than one season or bag entry and is not a single window" });
            continue;
          }

          const window = readWindow(stripLabel(seasons[0]));
          const daily = readLimit(stripLabel(bags[0]));
          const possession = readLimit(possessionCell);

          /*
           * A season the regulation writes as a RULE rather than as days. Tried
           * only after the plain calendar reading, so nothing already encoded
           * changes shape. It is stored as the rule, never as the days it
           * produces this year: the same rule lands on a different pair of days
           * every year, and storing one year's answer would be right once and
           * quietly wrong afterwards.
           *
           * Every wording accepted here was checked against Environment and
           * Climate Change Canada's OWN published provincial summaries, which
           * state the same seasons as calendar dates —
           * scripts/certify-relative-dates.mjs, 24/24 at the time of writing.
           * A phrasing that check never confirmed is refused below.
           */
          const relativeWindow = window ? null : parseRelativeWindow(stripLabel(seasons[0]));
          if (relativeWindow && daily && possession) {
            rules.push({
              jurisdictionId, area, groupId: group.id, groupStatedAs: group.statedAs,
              relativeWindow, daily, possession, declaredNoSeason: false, sourceSection: where,
            });
            continue;
          }

          if (!window || !daily || !possession) {
            /*
             * Say WHICH part could not be read. A single catch-all reason hid
             * the fact that 53 of 84 refusals were one thing — a RELATIVE DATE
             * ("the first Saturday after the first Monday in October") — and a
             * bucket that large and that uniform is a missing capability, not a
             * collection of oddities. A refusal that cannot be counted cannot be
             * prioritised.
             */
            const unreadSeason = !window && !relativeWindow;
            /*
             * A relative date this build does NOT recognise exactly keeps its
             * own reason, so the bucket stays countable. "The first Sunday after
             * January 19" and "the first Sunday ON OR AFTER January 19" differ by
             * up to seven days and read almost identically, so there is no
             * nearest-match and no fallback: an unrecognised phrasing is refused,
             * not approximated. Where the date is unreadable the answer is
             * UNKNOWN, never a date nudged somewhere safe — a season is a
             * two-ended fact and there is no safe direction to move it.
             */
            const relative = unreadSeason && /\b(first|second|third|fourth|last)\s+[A-Z]?[a-z]+day\b/i.test(stripLabel(seasons[0]));
            notEncoded.push({
              where, group: group.statedAs, area, statedAs: rowText,
              jurisdictionId, groupId: group.id, coversArea: area,
              reason: relative
                ? "the season is written in a relative-date phrasing this build does not recognise exactly, and no nearest match is guessed"
                : unreadSeason
                  ? "the season is not a plain calendar window this build reads"
                  : "a daily bag or possession limit is not in a form this build reads exactly",
            });
            continue;
          }

          rules.push({
            jurisdictionId, area, groupId: group.id, groupStatedAs: group.statedAs,
            window, daily, possession, declaredNoSeason: false, sourceSection: where,
          });
        }
      }
    }
  }

  const bundle = {
    schemaVersion: 1,
    bundleId: "bundle:ca-federal-2026",
    jurisdictionId: "jurisdiction:ca-federal",
    sourceVersion: MBR_CITATION,
    sourceUrl: MBR_URL,
    retrievedAt: "2026-09-23",
    contentHash: documentHash,
    wave: 1,
    waveCovers: WAVE_1.map(({ name, jurisdictionId }) => ({ name, jurisdictionId })),
    composition:
      "Federal migratory-bird rules COMPOSE with provincial rules; they never replace them. A hunter must satisfy " +
      "both. Where a federal and a provincial rule disagree, the answer is CONFLICT stating both.",
    areas,
    rules,
    notEncoded,
  };

  const serialised = `${JSON.stringify(bundle, null, 2)}\n`;
  if (process.argv.includes("--check")) {
    const existing = readFileSync(BUNDLE, "utf8");
    if (existing !== serialised) throw new Error("The bundle does not reproduce from the source.");
    console.log("Bundle reproduces byte for byte.");
    return;
  }
  writeFileSync(BUNDLE, serialised);
  console.log(`areas derived ${areas.length}: ${areas.map((area) => `${area.name}${area.units ? ` (${area.units.length} units)` : ""}`).join(", ")}`);
  console.log(`rows considered ${considered} | encoded ${rules.length} | refused ${notEncoded.length}`);
  console.log(`  declared closures: ${rules.filter((rule) => rule.declaredNoSeason).length}`);
  for (const reason of new Set(notEncoded.map((entry) => entry.reason))) {
    console.log(`  refused: ${notEncoded.filter((entry) => entry.reason === reason).length}x ${reason}`);
  }
  console.log(`Wrote ${BUNDLE} (${documentHash})`);
}

await main();
