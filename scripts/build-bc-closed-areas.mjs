/**
 * B.C. Reg. 76/84 (Closed Areas Regulation) → within-zone restrictions.
 *
 * Reads the enumeration taken from the authority's own CivixML and emits one
 * `WithinZoneRestriction` per FACT, not per area. That is the whole point of
 * the exercise:
 *
 *   71 areas both close the season AND designate a no-shooting area
 *  122 prohibit shooting and leave the season open
 *   32 close the season and are not no-shooting areas
 *   29 restrict ammunition only
 *
 * Collapsing those into one "restricted" flag is wrong in both directions at
 * once. Telling a hunter a no-shooting area is a closed season shuts a season
 * that is open; telling them a closed season is a no-shooting area sends them
 * to hunt where there is none. So an area carrying two facts becomes two
 * restrictions, each with its own `kind`.
 *
 * SCOPE. An area named inside a management unit is a SUB-AREA of it, never the
 * whole unit, so a named unit is CANDIDATE_AREAS — it lies partly within, and
 * where inside is the open question this model exists to keep open.
 *
 * `UNLISTED` carries two different things, and they are labelled differently
 * in `statedAs` because they are not the same claim:
 *   NO_UNIT_NAMED   the regulation names no unit — a fact about the source.
 *   NOT_DETERMINED  North Ground could not resolve the unit vocabulary — a gap
 *                   in our reading. Schedule 3 #19 is one: "Management Units
 *                   1-1 to 1-15 and 2-1 to 2-19" names thirty-four units, and
 *                   a reader that stored two would be confidently wrong.
 * "I could not find one" is not "there is none" (§8), so neither is written as
 * the other.
 *
 * PERIODS are a list because one area carries shapes a range cannot hold, and
 * both are in this regulation: Pitt Wildlife Management Area is restricted for
 * a date range AND on four weekdays during a second range; Cowichan Bay runs
 * "March 11 to the Saturday following Labour Day", whose end is a rule rather
 * than a date and is never pre-resolved into one. An area the regulation gives
 * no period gets an explicit ALWAYS, because an empty list would be
 * indistinguishable from a gap.
 *
 * PRECEDENCE travels with every row. s. 1.1 makes this regulation prevail over
 * any other under the Act to the extent of the conflict, so these are not
 * ordinary overlays on the 190/84 bundle and the record must say so.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const INPUT = "docs/research/bc-within-zone/ca-bc-closed-areas-enumeration.json";
const OUTPUT = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : "content/regulatory/ca-bc-closed-areas.json";

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};
const WEEKDAYS = { monday: "MON", tuesday: "TUE", wednesday: "WED", thursday: "THU", friday: "FRI", saturday: "SAT", sunday: "SUN" };

const text = (value) => (value && typeof value === "object" ? value.text : value) ?? undefined;

function monthDay(month, day) {
  const m = MONTHS[month.toLowerCase()];
  if (!m) throw new Error(`Unrecognised month "${month}"`);
  return { month: m, day: Number(day) };
}

/** Every date range the phrase names, in order. */
function ranges(phrase) {
  const found = [];
  const pattern = /([A-Z][a-z]+)\s+(\d{1,2})\s+to\s+([A-Z][a-z]+)\s+(\d{1,2})/g;
  for (const match of phrase.matchAll(pattern)) {
    found.push({ from: monthDay(match[1], match[2]), to: monthDay(match[3], match[4]), statedAs: match[0] });
  }
  return found;
}

/**
 * The periods one area states.
 *
 * Recognised shapes are modelled; anything else is carried verbatim as
 * AS_STATED rather than approximated into a range. A shape this parser has not
 * met is evidence the schema is incomplete (§41A), never a licence to round.
 */
function periodsFor(phrase) {
  if (!phrase) {
    return [{
      kind: "ALWAYS",
      statedAs: "B.C. Reg. 76/84 states no period for this area, so the restriction is in force whenever the regulation is.",
    }];
  }

  /* A rule rather than a date at one end — never pre-resolved. */
  if (/Saturday following Labour Day/i.test(phrase)) {
    const start = /([A-Z][a-z]+)\s+(\d{1,2})\s+to\s+the\s+Saturday following Labour Day/i.exec(phrase);
    return [{
      kind: "FLOATING",
      ...(start ? { from: monthDay(start[1], start[2]) } : {}),
      toStatedAs: "the Saturday following Labour Day",
      statedAs: phrase,
    }];
  }

  const named = Object.entries(WEEKDAYS).filter(([word]) => new RegExp(`\\b${word}s?\\b`, "i").test(phrase));
  if (named.length) {
    /* Two periods of different shapes on one area: a range, and weekdays
       within a second range. Pitt Wildlife Management Area. */
    const found = ranges(phrase);
    const periods = [];
    if (found[0]) periods.push({ kind: "DATE_RANGE", ...found[0], statedAs: phrase });
    periods.push({
      kind: "WEEKDAYS",
      weekdays: named.map(([, code]) => code),
      ...(found[1] ? { within: { from: found[1].from, to: found[1].to } } : {}),
      statedAs: phrase,
    });
    return periods;
  }

  const found = ranges(phrase);
  if (found.length === 1) return [{ kind: "DATE_RANGE", from: found[0].from, to: found[0].to, statedAs: phrase }];

  return [{ kind: "AS_STATED", statedAs: phrase }];
}

function scopeFor(row) {
  const units = row.managementUnits ?? [];
  if (units.length) return { kind: "CANDIDATE_AREAS", candidateAreas: units };
  if (row.unitDetermination === "NOT_DETERMINED") {
    return {
      kind: "UNLISTED",
      statedAs:
        `North Ground could not resolve which management units this area lies in: ${row.unitDeterminationReason} ` +
        "This is a gap in North Ground's reading, not a statement that the regulation names none.",
    };
  }
  return {
    kind: "UNLISTED",
    statedAs: "B.C. Reg. 76/84 names no management unit for this area; its geography is the boundary description only.",
  };
}

/** The facts one area states, each as its own restriction. */
function kindsFor(row) {
  const kinds = [];
  if (row.closesSeason) kinds.push("NO_OPEN_SEASON");
  if (row.prohibitsShooting) kinds.push("NO_DISCHARGE");
  if (row.restrictsAmmunition) kinds.push("AMMUNITION");
  return kinds;
}

const enumeration = JSON.parse(readFileSync(INPUT, "utf8"));
const live = enumeration.areas.filter((row) => row.status === "LIVE");

const PREVAILS = {
  statedAs:
    "If there is a conflict between this regulation and another regulation made under the Act, this regulation " +
    "prevails to the extent of the conflict.",
  citation: "B.C. Reg. 76/84, s. 1.1",
};

const restrictions = [];
for (const row of live) {
  const kinds = kindsFor(row);
  if (!kinds.length) throw new Error(`Schedule ${row.schedule} #${row.entryNumber} states no restriction fact`);
  const periods = periodsFor(text(row.periodStatedAs));
  const scope = scopeFor(row);
  for (const kind of kinds) {
    restrictions.push({
      id: `within_zone_restriction:ca-bc-76-84-s${row.schedule}-${row.entryNumber}-${kind.toLowerCase().replace(/_/g, "-")}`,
      name: text(row.areaName),
      statedAs: text(row.effectStatedAs),
      kind,
      scope,
      citation: `${row.governingSection}, Schedule ${row.schedule}, item ${row.entryNumber}`,
      sourceId: enumeration.source.id,
      periods,
      prevailsOverConflicting: PREVAILS,
    });
  }
}

const payload = {
  jurisdictionId: enumeration.package.jurisdictionId,
  source: enumeration.source,
  builtFrom: { path: INPUT, sha256: `sha256:${createHash("sha256").update(readFileSync(INPUT)).digest("hex")}` },
  counts: {
    areasInRegulation: enumeration.areas.length,
    areasLive: live.length,
    restrictions: restrictions.length,
    byKind: restrictions.reduce((totals, entry) => ({ ...totals, [entry.kind]: (totals[entry.kind] ?? 0) + 1 }), {}),
    byScope: restrictions.reduce((totals, entry) => ({ ...totals, [entry.scope.kind]: (totals[entry.scope.kind] ?? 0) + 1 }), {}),
  },
  restrictions,
};

writeFileSync(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${OUTPUT}`);
console.log(`  ${live.length} live areas -> ${restrictions.length} restrictions`);
console.log(`  by kind:  ${JSON.stringify(payload.counts.byKind)}`);
console.log(`  by scope: ${JSON.stringify(payload.counts.byScope)}`);
