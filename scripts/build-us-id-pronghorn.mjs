#!/usr/bin/env node
/**
 * Build Idaho's certified pronghorn bundle from the 2026 Big Game Seasons and
 * Rules booklet.
 *
 *   node scripts/build-us-id-pronghorn.mjs            write the bundle and certified units
 *   node scripts/build-us-id-pronghorn.mjs --check    exit 2 if a source moved, 3 if a committed file differs
 *
 * Idaho states that "All pronghorn hunting, including archery seasons, is by
 * controlled hunt" (p. 63). So a pronghorn answer is always an answer about a
 * controlled hunt: a four-digit hunt number, a hunt area, a tag quota drawn in
 * the May–June drawing (or "Unlimited, 1st choice only"), and a weapon and
 * animal class the hunt fixes. That is what this bundle models, first-class:
 *
 *   - each hunt is a hunt-code record (`hunt_code:us-id-4007`), never folded
 *     into a species;
 *   - each is allocated by draw, with its published quota and the published
 *     drawing calendar, and North Ground never assumes anyone holds a tag;
 *   - each hunt area is read from its written description (p. 67): "All of
 *     Units …" becomes whole Game Management Units; "that portion of Unit …"
 *     is a part North Ground holds no boundary for, where the answer is
 *     NEEDS_VERIFICATION with the description quoted.
 *
 * Two channels: the booklet (the source) and Idaho Fish and Game's Hunt
 * Planner feed (a cross-check). A hunt the two disagree on is published as a
 * dispute, which the engine answers as CONFLICT.
 *
 * Landowner Permission Hunts are published in a separate brochure and are not
 * encoded; every answer says so, and a unit no booklet hunt names is UNKNOWN,
 * never CLOSED.
 */

import {
  expectOne, fetchJson, fetchPdf, flatten, jurisdictionToday, parseRange, readPreviousBundle,
  retrievedAtFor, sha256, recordSourcesFromArgs, writeOrCheck,
} from "./us-source.mjs";

const BUNDLE = "content/regulatory/us-id-pronghorn-2026.json";
const CERTIFIED = "content/regulatory/us-id-certified-units.json";
const PDF_URL = "https://idfg.idaho.gov/sites/default/files/seasons-rules-big-game-2026.pdf";
const PLANNER_URL = "https://idfg.idaho.gov/ifwis/huntplanner/api/1.1/list/?game=3&start=2026-1-1&end=2027-12-31&limit=2000&offset=0";
const GMU_URL = "https://gisportal-idfg.idaho.gov/hosting/rest/services/Hunting/MapServer/3/query?where=1%3D1&outFields=NAME&returnGeometry=false&f=json";
const SOURCE_ID = "source:us-id-big-game-seasons-2026";
const PLANNER_ID = "source:us-id-hunt-planner";
const SOURCE_VERSION = "Idaho Big Game 2026 Seasons and Rules";
const LICENCE_YEAR = 2026;
const TIME_ZONE = "America/Boise";
const SPECIES = "species:pronghorn";
const DRAW_ID = "draw:us-id-controlled-hunts-2026";

const zoneId = (unit) => `management_zone:us-id-gmu-${unit.toLowerCase()}`;
const REVIEWED_CORRECTIONS = [
  "72-HOUR TRAP CHECK REQUIREMENT",
];

/* ── The booklet ────────────────────────────────────────────────────────── */

const SECTIONS = [
  { heading: "2026 Controlled Pronghorn Hunts (2,040 Tags Plus Unlimited Tags) Either Sex Pronghorn", kind: "EITHER_SEX" },
  { heading: "2026 Controlled Hunts Doe or Fawn Pronghorn", kind: "DOE_FAWN" },
  { heading: "2026 Controlled Pronghorn Hunts Either Sex Pronghorn", kind: "EITHER_SEX" },
  { heading: "2026 Controlled Hunts Archery Only - Archery Permit Required", kind: "ARCHERY" },
  { heading: "2026 Controlled Hunts Pronghorn Youth Only", kind: "YOUTH" },
  { heading: "2026 Controlled Hunts Short Range Weapon", kind: "SHORT_RANGE" },
  { heading: "2026 Controlled Hunts Muzzleloader Only - Muzzleloader Permit Required", kind: "MUZZLELOADER" },
];

const TABLE_HEAD = "Hunt No. Controlled Hunt Areas Tags Season Dates Notes";
const ROW = /(?:^| )(4\d{3}) (\d{1,2}[A-Z]?(?:-\d[ab])?)\s+(?:\(See pg 67\)\s+)?(Unlimited 1st choice only|\d+) ([A-Z][a-z]{2} \d{1,2} - [A-Z][a-z]{2} \d{1,2})(.*?)(?= 4\d{3} \d{1,2}[A-Z]?(?:-\d[ab])?\s| a This hunt| For details| Black Cheek| Notes: 1\.| 2026 Controlled|$)/g;

function readSections(pages) {
  // The pronghorn hunt tables are printed on booklet pages 63–66 (PDF pages 64–67).
  const text = pages.slice(63, 67).map(flatten).join(" ");
  // The page opens with a drop cap, which the extractor prints as "A ll".
  expectOne(text, /A ?ll pronghorn hunting, including archery seasons, is by controlled hunt\./, "controlled-hunt-only statement (p. 63)");
  const positions = SECTIONS.map((section) => {
    const at = text.indexOf(section.heading);
    if (at < 0) throw new Error(`Pronghorn section "${section.heading}" is not in the booklet as reviewed`);
    return { ...section, at };
  }).sort((a, b) => a.at - b.at);
  const rows = [];
  positions.forEach((section, index) => {
    const end = index + 1 < positions.length ? positions[index + 1].at : text.length;
    const body = text.slice(section.at + section.heading.length, end);
    if (!body.trimStart().startsWith(TABLE_HEAD)) throw new Error(`Pronghorn section "${section.heading}" no longer opens with its table head`);
    for (const match of body.matchAll(ROW)) {
      rows.push({
        kind: section.kind,
        number: match[1],
        areaCode: match[2],
        tags: match[3],
        dates: match[4],
        notes: match[5].trim().replace(/\s+/g, " "),
      });
    }
  });
  const numbers = rows.map((row) => row.number);
  if (new Set(numbers).size !== numbers.length) throw new Error("A pronghorn hunt number appears twice");
  return rows;
}

function readAreaDescriptions(pages) {
  const text = flatten(pages[67]);
  expectOne(text, /Please note that hunt areas are different for each species\./, "hunt area note (p. 67)");
  const descriptions = new Map();
  for (const match of text.matchAll(/Hunt Area (\d{1,2}[A-Z]?(?:-\d)?) — (.+?)(?= Hunt Area \d| Please note| PRONGHORN CONTROLLED HUNT AREA DESCRIPTIONS|$)/g)) {
    if (descriptions.has(match[1])) throw new Error(`Hunt Area ${match[1]} is described twice`);
    descriptions.set(match[1], match[2].trim());
  }
  return descriptions;
}

/**
 * The units a hunt area covers, read from its written description. Only these
 * clause shapes are understood; any other wording stops the build:
 *
 *   "All of Unit(s) A, B, and C"        whole units
 *   "All of Unit A and Unit B"          whole units
 *   "All of Unit A except …/excluding …" part of A
 *   "that portion|part of Unit A …"     part of A
 */
export function readHuntArea(description, units) {
  const body = description.replace(/\s*\(See [^)]*\)\s*\.?/g, "").replace(/\s+/g, " ").trim().replace(/\.$/, "");
  const clauses = body.split(/,? and (?=that (?:part|portion) of Unit|all of Unit)|, and (?=all of)/i);
  const whole = [];
  const partial = [];
  const unitList = (list) => list.split(/,\s*(?:and\s+)?|\s+and\s+/).map((token) => token.replace(/^Unit\s+/, "").trim()).filter(Boolean);
  for (const raw of clauses) {
    const clause = raw.trim();
    let match;
    if ((match = /^All of Unit ([\dA-Z]+) (?:except|excluding) /i.exec(clause))) partial.push(match[1]);
    else if ((match = /^(?:that|That) (?:portion|part) of Unit ([\dA-Z]+)\b/.exec(clause))) partial.push(match[1]);
    else if ((match = /^All of Units? ([\dA-Z, ]+?(?:,? and (?:Unit )?[\dA-Z]+)?)$/i.exec(clause))) whole.push(...unitList(match[1]));
    else throw new Error(`Hunt area description clause not understood: "${clause}"`);
  }
  for (const unit of [...whole, ...partial]) {
    if (!/^\d{1,2}[A-Z]?$/.test(unit) || !units.has(unit)) throw new Error(`Hunt area names Unit "${unit}", which Idaho's unit layer does not publish`);
  }
  return { whole: [...new Set(whole)], partial: [...new Set(partial)].filter((unit) => !whole.includes(unit)) };
}

function readCalendar(pages) {
  const text = flatten(pages[7]);
  expectOne(text, /Big Game 2026 Seasons and Rules July 2026 – June 2027/, "booklet period (p. 7)");
  const first = expectOne(text, /May 1 - June 5: First controlled hunt application period\. Successful applicants will be notified and results will be posted at GoOutdoorsIdaho\.com (by early July)\./, "first drawing (p. 7)");
  expectOne(text, /August 5 - 15: Second controlled hunt application period: Successful applicants will be notified by August 25\./, "second drawing (p. 7)");
  expectOne(text, /August 25 \(or next business day\): Leftover tags from second drawing go on sale at 10 a\.m\. Mountain Time\./, "leftover sale (p. 7)");
  return {
    id: DRAW_ID,
    name: "2026 controlled hunt drawing (deer, elk, pronghorn)",
    applicationOpens: "2026-05-01",
    applicationCloses: "2026-06-05",
    secondRound: { name: "2026 second controlled hunt drawing", applicationOpens: "2026-08-05", applicationCloses: "2026-08-15", resultsBy: "2026-08-25" },
    leftoverSaleOpens: "2026-08-25",
    // Idaho gives no date for first-drawing results, only "by early July", so
    // no resultsBy is recorded and the words are kept.
    statedAs: `Dates to Remember (p. 7): first application period May 1 – June 5, results posted ${first[1]}; second application period August 5 – 15, notified by August 25; leftover tags on sale August 25 at 10 a.m. Mountain Time.`,
    sourceId: SOURCE_ID,
    sourceSection: "p. 7, Dates to Remember",
  };
}

function readCorrections(pages) {
  const text = flatten(pages[1]);
  expectOne(text, /2026 Idaho Big Game Seasons and Rules Corrections/, "corrections page (p. 2)");
  // Each correction is an upper-case heading on its own line, followed by the
  // page(s) it changes on the next line.
  const lines = pages[1].split("\n").map((line) => line.trim());
  const headings = lines
    .filter((line, index) => /^[A-Z0-9][A-Z0-9 -]{8,}$/.test(line) && /^\d{1,3}(?:[,-] ?\d{1,3})*$/.test(lines[index + 1] ?? ""))
    .map((line) => line.replace(/\s+/g, " "));
  const unreviewed = headings.filter((heading) => !REVIEWED_CORRECTIONS.includes(heading));
  if (unreviewed.length || headings.length !== REVIEWED_CORRECTIONS.length) {
    throw new Error(`Idaho's corrections page lists ${JSON.stringify(headings)}; reviewed ${JSON.stringify(REVIEWED_CORRECTIONS)}. Review each correction before rebuilding.`);
  }
  return headings;
}

/* ── What each kind of hunt means ────────────────────────────────────────── */

function classAndMethod(row) {
  const notes = row.notes;
  const classFrom = () => {
    if (/\bBuck only\b/i.test(notes)) return { value: "BUCK_ONLY", label: "Buck only" };
    if (/\bDoe or Fawn only\b/i.test(notes)) return { value: "DOE_OR_FAWN", label: "Doe or fawn only" };
    if (/\bEither sex\b/i.test(notes)) return { value: "EITHER_SEX", label: "Either sex" };
    throw new Error(`Hunt ${row.number}: its notes do not state which pronghorn may be taken ("${notes}")`);
  };
  switch (row.kind) {
    case "EITHER_SEX": return { animalClass: { value: "EITHER_SEX", label: "Either sex" }, method: { label: "Any weapon" } };
    case "DOE_FAWN": return { animalClass: { value: "DOE_OR_FAWN", label: "Doe or fawn only" }, method: { label: "Any weapon" } };
    case "ARCHERY": return { animalClass: classFrom(), method: { label: "Archery only", permit: "archery" } };
    case "SHORT_RANGE": return { animalClass: classFrom(), method: { label: "Short range weapons only" } };
    case "MUZZLELOADER": return { animalClass: classFrom(), method: { label: "Muzzleloader only", permit: "muzzleloader" } };
    case "YOUTH": {
      const method = /Archery only/i.test(notes)
        ? { label: "Archery only", permit: "archery" }
        : /Muzzleloader only/i.test(notes)
          ? { label: "Muzzleloader only", permit: "muzzleloader" }
          : { label: "Any weapon" };
      return { animalClass: classFrom(), method, youth: true };
    }
    default: throw new Error(`Unknown section ${row.kind}`);
  }
}

/* ── The Hunt Planner cross-check ─────────────────────────────────────── */

const PLANNER_ORNAMENT = { EITHER_SEX: "Antlerless or Antlered", DOE_OR_FAWN: "Doe or Fawn", BUCK_ONLY: "Bucks Only" };

function plannerDate(value) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  return `20${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function crossCheck(row, window, animalClass, planner) {
  const entry = planner.find((candidate) => candidate.number === row.number);
  if (!entry) return [`The Hunt Planner has no hunt ${row.number}.`];
  const problems = [];
  if (plannerDate(entry.open) !== window.opensIso || plannerDate(entry.close) !== window.closesIso) {
    problems.push(`The Hunt Planner gives hunt ${row.number} ${entry.open} – ${entry.close}; the booklet prints ${row.dates}.`);
  }
  const unlimited = row.tags.startsWith("Unlimited");
  const plannerUnlimited = entry.permits === 99999 || entry.permits === 999999;
  if (unlimited !== plannerUnlimited || (!unlimited && Number(row.tags) !== entry.permits)) {
    problems.push(`The Hunt Planner gives hunt ${row.number} ${plannerUnlimited ? "unlimited" : entry.permits} tags; the booklet prints ${row.tags}.`);
  }
  if (PLANNER_ORNAMENT[animalClass.value] !== entry.ornament) {
    problems.push(`The Hunt Planner gives hunt ${row.number} "${entry.ornament}"; the booklet prints "${animalClass.label}".`);
  }
  return problems;
}

/* ── Build ──────────────────────────────────────────────────────────────── */

async function main() {
  const check = process.argv.includes("--check");
  recordSourcesFromArgs();
  const [{ sha256: pdfHash, pypdf, pages }, planner, gmuLayer] = await Promise.all([fetchPdf(PDF_URL), fetchJson(PLANNER_URL), fetchJson(GMU_URL)]);
  if (pages.length !== 125) throw new Error(`The booklet has ${pages.length} pages; 125 were reviewed`);
  const units = new Set(gmuLayer.features.map((feature) => String(feature.attributes.NAME).trim()).filter((name) => name !== "YNP"));
  if (units.size !== 99) throw new Error(`Idaho's unit layer lists ${units.size} units; 99 were reviewed`);

  // The hunting-hours sentence is quoted in us-idaho.ts; a change must stop the build.
  expectOne(flatten(pages[95]), /Big game animals may be hunted only from one-half hour before sunrise to one-half hour after sunset\./, "hunting hours (p. 95)");
  const corrections = readCorrections(pages);
  const draw = readCalendar(pages);
  const rows = readSections(pages);
  const areas = readAreaDescriptions(pages);
  if (rows.length !== 54) throw new Error(`The booklet lists ${rows.length} pronghorn hunts; 54 were reviewed`);
  const plannerRows = (planner.rows ?? []).filter((entry) => entry.game === "Pronghorn Antelope");
  const landownerHunts = plannerRows.filter((entry) => /Landowner Permission/.test(entry.season));

  const groups = new Map();
  const specials = new Map();
  const rules = [];
  const huntCodes = [];
  for (const row of rows) {
    const code = row.areaCode.replace(/[ab]$/, "");
    const flag = /[ab]$/.test(row.areaCode) ? row.areaCode.slice(-1) : null;
    const description = areas.get(code) ?? (flag ? null : `All of Unit ${code}`);
    if (!description) throw new Error(`Hunt ${row.number} names Hunt Area ${code}, which p. 67 does not describe`);
    const { whole, partial } = areas.has(code) ? readHuntArea(description, units) : { whole: [code], partial: [] };
    if (flag === "a" && whole.length + partial.length < 2) throw new Error(`Hunt ${row.number} is marked "a" (other units) but its area covers one unit`);
    if (flag === "b" && !partial.length) throw new Error(`Hunt ${row.number} is marked "b" (a portion) but its area has no partial unit`);
    if (!flag && (partial.length || whole.length !== 1)) throw new Error(`Hunt ${row.number} is unmarked but its area is not one whole unit`);

    const groupId = `regulatory_group:us-id-pronghorn-2026-area-${code.toLowerCase()}`;
    groups.set(groupId, {
      id: groupId,
      officialSpec: areas.has(code) ? `Hunt Area ${code} — ${description}` : `Unit ${code}`,
      zoneIds: whole.map(zoneId),
      partialZoneIds: partial.map(zoneId),
      officialIdentifiers: whole,
      partialIdentifiers: partial,
    });
    const specialIds = partial.map((unit) => {
      const id = `us-id-pronghorn-area-${code.toLowerCase()}-in-unit-${unit.toLowerCase()}`;
      specials.set(id, {
        id, name: `Pronghorn Hunt Area ${code} (part of Unit ${unit})`, resolution: "UNRESOLVED", candidateAreas: [unit],
        statedAs: `Hunt Area ${code} — ${description}`,
        reason: `Idaho describes this hunt area in words (p. 67) and North Ground holds no boundary for the part of Unit ${unit} it includes, so it cannot say whether this point is in it.`,
      });
      return id;
    });

    const window = parseRange(row.dates, { licenceYear: LICENCE_YEAR, firstMonth: 3 });
    const { animalClass, method, youth } = classAndMethod(row);
    const unlimited = row.tags.startsWith("Unlimited");
    const huntCodeId = `hunt_code:us-id-${row.number}`;
    const permit = method.permit === "archery" ? "authorization:us-id-archery-permit-validation" : method.permit === "muzzleloader" ? "authorization:us-id-muzzleloader-permit-validation" : null;
    huntCodes.push({
      id: huntCodeId,
      code: row.number,
      jurisdictionId: "jurisdiction:us-id",
      authorityTerm: "controlled hunt",
      speciesId: SPECIES,
      geography: { regulatoryGroupId: groupId, statedAs: areas.has(code) ? `Hunt Area ${code}` : `Unit ${code}` },
      allocation: {
        method: "DRAW",
        authorityTerm: "controlled hunt tag",
        quota: unlimited
          ? { count: null, statedAs: "Unlimited tags, 1st choice only", sourceSection: "pp. 63–66" }
          : { count: Number(row.tags), statedAs: `${row.tags} tags`, sourceSection: "pp. 63–66" },
        drawCycleId: DRAW_ID,
      },
      requiresAuthorizations: ["authorization:us-id-hunting-license", "authorization:us-id-pronghorn-controlled-hunt-tag", ...(permit ? [permit] : [])],
      sourceId: SOURCE_ID,
      sourceSection: "pp. 63–66, Pronghorn Controlled Hunts",
    });
    const disputes = crossCheck(row, window, animalClass, plannerRows).map((statedAs) => ({ statedAs }));
    rules.push({
      id: `regulatory_rule:us-id-pronghorn-2026-${row.number}`,
      speciesId: SPECIES,
      regulatoryGroupId: groupId,
      geography: {
        statedAs: groups.get(groupId).officialSpec,
        include: { ghas: whole, gbhz: [], special: specialIds },
        exclude: { ghas: [], special: [] },
      },
      // The hunt number fixes the weapon, animal class and age: nothing else is asked.
      appliesWhen: { HUNT_CODE: row.number },
      seasonLabel: `Controlled hunt ${row.number} (${animalClass.label.toLowerCase()}, ${method.label.toLowerCase()}${youth ? ", youth only" : ""})`,
      seasonPhrase: row.dates,
      windows: [window],
      declaredNoSeason: false,
      limits: { bag: 1, animalClass: animalClass.label, statedAs: `One pronghorn per tag: ${animalClass.label.toLowerCase()}`, section: "p. 63, Pronghorn Definitions" },
      conditionIds: [
        "id-controlled-hunt-tag",
        ...(method.permit === "archery" ? ["id-archery-permit"] : method.permit === "muzzleloader" ? ["id-muzzleloader-permit"] : []),
        ...(youth ? ["id-youth-only"] : []),
        ...(row.kind === "SHORT_RANGE" ? ["id-short-range"] : []),
        "id-mandatory-report",
      ],
      caveats: [],
      notes: row.notes ? [row.notes] : [],
      disputes,
      sourceId: SOURCE_ID,
      sourceSection: `pp. 63–66, hunt ${row.number}`,
      sourceVersion: SOURCE_VERSION,
      reviewStatus: "VERIFIED",
      huntCodeId,
      authority: { level: "STATE_REGULATION", instrument: "Idaho Fish and Game Commission 2026 big game seasons (Big Game 2026 Seasons and Rules)" },
    });
  }

  const sourceHashes = {
    pdf: pdfHash, text: sha256(JSON.stringify(pages)),
    planner: sha256(JSON.stringify(plannerRows)), units: sha256(JSON.stringify([...units].sort())),
  };
  const contentHash = sha256(JSON.stringify(sourceHashes));
  const previous = readPreviousBundle(BUNDLE);
  const retrievedAt = retrievedAtFor(previous, previous?.contentHash, contentHash, jurisdictionToday(TIME_ZONE));
  const unitList = [...units].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const reached = new Set([...groups.values()].flatMap((group) => [...group.officialIdentifiers, ...group.partialIdentifiers]));

  const bundle = {
    schemaVersion: 1,
    bundleId: "regulatory_bundle:us-id-pronghorn-2026",
    jurisdictionId: "jurisdiction:us-id",
    sourceVersion: SOURCE_VERSION,
    retrievedAt,
    contentHash,
    certifiedPeriod: {
      from: "2026-07-01", to: "2027-06-30",
      reason: "The 2026 Big Game Seasons and Rules cover July 2026 – June 2027; pronghorn seasons run August 2026 – February 2027 (cover, p. 7).",
    },
    absence: {
      /* Idaho says all pronghorn hunting is by controlled hunt, but Landowner
         Permission Hunts are controlled hunts published elsewhere, so a unit no
         booklet hunt names is not something this bundle can call closed. */
      meaning: "UNKNOWN",
      excludedCombination: "CLOSED",
      statedAs: "All pronghorn hunting, including archery seasons, is by controlled hunt (p. 63). A hunt that does not match what you hold, or is not running on this date, is closed to you.",
      section: "p. 63",
      sourceId: SOURCE_ID,
    },
    officialUnitCount: units.size,
    units: unitList.map((unit) => ({ identifier: unit, zoneId: zoneId(unit) })),
    specialGeographies: [...specials.values()].sort((a, b) => a.id.localeCompare(b.id)),
    sources: [{
      id: SOURCE_ID,
      authority: "Idaho Department of Fish and Game",
      title: SOURCE_VERSION,
      url: PDF_URL,
      licence: "Published regulations; North Ground records facts — hunts, areas, dates and quotas — with the page as provenance.",
      extractedWith: `pypdf ${pypdf}`,
      sourceHashes,
      correctionsReviewed: corrections,
      crossCheck: { url: PLANNER_URL, hunts: plannerRows.length, disputes: rules.filter((rule) => rule.disputes.length).length },
      conditions: [
        { id: "id-controlled-hunt-tag", sourceId: SOURCE_ID, sourceSection: "p. 63", text: "All pronghorn hunting in Idaho is by controlled hunt: a controlled hunt tag for this hunt number, with a hunting license, is required. North Ground cannot see whether you were drawn or hold one." },
        { id: "id-archery-permit", sourceId: SOURCE_ID, sourceSection: "p. 63, Archery and Muzzleloader Permits", text: "Any person hunting in an archery only season, including controlled hunts, must have their license with archery permit validation." },
        { id: "id-muzzleloader-permit", sourceId: SOURCE_ID, sourceSection: "p. 63, Archery and Muzzleloader Permits", text: "Any person hunting in a muzzleloader only season, including controlled hunts, must have their license with muzzleloader permit validation." },
        { id: "id-youth-only", sourceId: SOURCE_ID, sourceSection: "p. 66, Youth Only", text: "Youth only hunt; see pages 110 and 114 of the booklet for who qualifies." },
        { id: "id-short-range", sourceId: SOURCE_ID, sourceSection: "p. 66, Short Range Weapon", text: "Short range weapons only." },
        { id: "id-mandatory-report", sourceId: SOURCE_ID, sourceSection: "p. 63, Mandatory Hunter Report", text: "A hunter report is due within 10 days after harvest, or within 10 days after the season closes if you do not harvest." },
      ],
    }],
    sourceRecords: [
      { id: SOURCE_ID, authority: "Idaho Department of Fish and Game", title: SOURCE_VERSION, url: PDF_URL },
      { id: PLANNER_ID, authority: "Idaho Department of Fish and Game", title: "Idaho Hunt Planner (cross-check)", url: "https://idfg.idaho.gov/ifwis/huntplanner/" },
      { id: "source:us-id-gmu-service", authority: "Idaho Department of Fish and Game", title: "Game Management Units (map service)", url: "https://gisportal-idfg.idaho.gov/hosting/rest/services/Hunting/MapServer/3" },
    ],
    limitations: [
      `Idaho also issues ${landownerHunts.length} Landowner Permission Hunts for doe or fawn pronghorn (${landownerHunts.map((entry) => entry.area).join("; ")}), published in a separate brochure. North Ground has not certified them; if your tag is for one, this answer does not describe it.`,
      "Idaho's unit map is a best representation; the written unit and hunt area descriptions in the booklet control. Near a boundary, confirm which unit you are in.",
      "Motorized-vehicle rules, federal land rules (including Idaho National Laboratory and Craters of the Moon), wildlife management area restrictions and landowner permission are not evaluated.",
      "This is a state-licensed recreational result. It does not describe hunting under tribal authority or treaty rights, which North Ground does not evaluate.",
    ],
    huntCodes: huntCodes.sort((a, b) => a.code.localeCompare(b.code)),
    drawCycles: [draw],
    groups: [...groups.values()].sort((a, b) => a.id.localeCompare(b.id)),
    rules: rules.sort((a, b) => a.id.localeCompare(b.id)),
  };

  const certified = {
    jurisdictionId: "jurisdiction:us-id",
    layerId: "layer:us-id-gmu",
    officialUnitCount: units.size,
    certifiedUnits: unitList.filter((unit) => reached.has(unit)),
  };
  writeOrCheck({ check, outputs: { [BUNDLE]: bundle, [CERTIFIED]: certified }, bundlePath: BUNDLE, contentHash, previous, label: "Idaho pronghorn 2026" });
  if (!check) {
    const disputed = rules.filter((rule) => rule.disputes.length);
    console.log(`${rules.length} hunts in ${groups.size} hunt areas over ${certified.certifiedUnits.length} units; ${specials.size} partial-unit areas; ${disputed.length} disputed against the Hunt Planner.`);
    for (const rule of disputed) console.log(`  ${rule.id}: ${rule.disputes.map((dispute) => dispute.statedAs).join(" ")}`);
  }
}

main().catch((error) => {
  console.error(`Idaho pronghorn build failed: ${error.message}`);
  process.exit(1);
});
