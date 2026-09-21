/**
 * Reading Alberta's hunting regulations summary.
 *
 * Alberta publishes one summary through two channels:
 *
 *   - the PDF on open.alberta.ca (publisher: Alberta Forestry and Parks), which is
 *     the copy North Ground cites; and
 *   - the same guide online at albertaregulations.ca, linked from alberta.ca as
 *     "Alberta Guide to Hunting Regulations – Online", whose season tables are
 *     real HTML tables with explicit cells.
 *
 * The HTML is parsed because a PDF text layer merges runs across columns, and a
 * season date or a special-licence mark attributed to the wrong column is a
 * wrong legal answer. Every cell used is then cross-checked against the PDF
 * (`scripts/crosscheck-alberta-guide.py`), and the two documents' hashes are
 * pinned, so the parse channel can never silently diverge from the cited one.
 *
 * Neither document is the law. Alberta's own catalogue record says the guide "is
 * neither a legal document nor a complete listing of current Alberta hunting
 * regulations"; the Wildlife Regulation (Alta. Reg. 143/97) is. North Ground
 * records facts from the summary — dates, units, classes — with the verbatim
 * cell as provenance, and says what it is.
 *
 * Everything here refuses rather than guesses: an unrecognised date form,
 * footnote, unit token or cell shape stops the build with the text printed.
 */

import { createHash } from "node:crypto";

export const GUIDE_PDF_URL =
  "https://open.alberta.ca/dataset/995b1ca1-0e65-4204-b432-98e4d6ccbf46/resource/106a1a7d-ee3a-40db-96c8-e4f67003db29/download/fp-alberta-guide-to-hunting-regulations-2026.pdf";
export const GUIDE_CATALOGUE_URL = "https://open.alberta.ca/publications/1485-4287";
export const GUIDE_HTML_BASE = "https://www.albertaregulations.ca/huntingregs/";
export const WMU_QUERY =
  "https://geospatial.alberta.ca/mimas/rest/services/boundaries/fishwild_wildlife_mgmt_unit_public/FeatureServer/0/query";

const USER_AGENT = "NorthGroundBushcraft/1.0 (+https://www.northgroundbushcraft.com)";

async function fetchWithRetry(url, read, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(120_000) });
      if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
      return await read(response);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
  throw lastError;
}

export const fetchText = (url) => fetchWithRetry(url, (response) => response.text());
export const fetchBytes = (url) => fetchWithRetry(url, async (response) => Buffer.from(await response.arrayBuffer()));

export function sha256(content) {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

/* ── Official units ──────────────────────────────────────────────────────── */

/** The authority's own WMU codes, normalised to their displayed form (00102 → 102). */
export async function fetchOfficialWmuIdentifiers() {
  const parameters = new URLSearchParams({
    where: "1=1",
    outFields: "WMUNIT_CODE",
    returnDistinctValues: "true",
    returnGeometry: "false",
    f: "json",
  });
  const payload = JSON.parse(await fetchText(`${WMU_QUERY}?${parameters}`));
  const codes = (payload.features ?? [])
    .map((feature) => String(feature.attributes?.WMUNIT_CODE ?? "").trim())
    .filter((code) => /^\d{5}$/.test(code))
    .map((code) => String(Number(code)));
  const unique = [...new Set(codes)].sort((a, b) => Number(a) - Number(b));
  if (unique.length !== 189) throw new Error(`Alberta WMU layer returned ${unique.length} named units; expected 189`);
  return unique;
}

/* ── HTML tables ─────────────────────────────────────────────────────────── */

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', nbsp: " ", apos: "'", ndash: "–", mdash: "—", rsquo: "’" };

export function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}

/** Cell text with line breaks kept and footnote references made explicit as ^N. */
export function cellText(html) {
  const text = html
    .replace(/<span class="textsuperscript">\s*([0-9,\s]+?)\s*<\/span>/gi, (_, refs) => `^${refs.replace(/\s+/g, "")}`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(text)
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/ \^/g, "^")
    .trim();
}

/**
 * Every <table> on the page as a rectangular grid, rowspans and colspans
 * expanded, so a row reads as the reader of the printed table reads it.
 */
export function parseTables(html) {
  const tables = [];
  for (const tableMatch of html.matchAll(/<table\b[\s\S]*?<\/table>/gi)) {
    const rows = [];
    const pending = new Map();
    for (const rowMatch of tableMatch[0].matchAll(/<tr\b[\s\S]*?<\/tr>/gi)) {
      const cells = [...rowMatch[0].matchAll(/<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi)].map((cell) => ({
        text: cellText(cell[3]),
        rowspan: Number(/rowspan="(\d+)"/i.exec(cell[2])?.[1] ?? 1),
        colspan: Number(/colspan="(\d+)"/i.exec(cell[2])?.[1] ?? 1),
      }));
      const row = [];
      let column = 0;
      while (cells.length || pending.has(column)) {
        if (pending.has(column)) {
          const carried = pending.get(column);
          row.push(carried.text);
          if (carried.left > 1) pending.set(column, { ...carried, left: carried.left - 1 });
          else pending.delete(column);
          column += 1;
          continue;
        }
        const cell = cells.shift();
        for (let span = 0; span < cell.colspan; span += 1) {
          row.push(cell.text);
          if (cell.rowspan > 1) pending.set(column, { text: cell.text, left: cell.rowspan - 1 });
          column += 1;
        }
      }
      rows.push(row);
    }
    tables.push(rows);
  }
  return tables;
}

/** Footnotes printed beneath a table: "(2) This season is open to ..." keyed by number. */
export function parseFootnotes(html) {
  const notes = new Map();
  for (const match of html.matchAll(/<p[^>]*>\s*\((\d+)\)([\s\S]*?)<\/p>/gi)) {
    notes.set(Number(match[1]), cellText(match[2]).replace(/\s+/g, " ").trim());
  }
  return notes;
}

/**
 * What a page says, without what merely surrounds it.
 *
 * The online edition carries rotating advertisements. Hashing the whole page
 * would flag an ad swap as a regulatory change, and a check that cries wolf
 * gets ignored. This keeps every table cell and every paragraph — the season
 * tables, their footnotes and notes such as the Sunday prohibition — so any
 * change to a date, unit, mark or footnote still moves the hash.
 */
export function regulatoryContent(html) {
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => cellText(match[1]).replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return JSON.stringify({ tables: parseTables(html), paragraphs });
}

/* ── Units ───────────────────────────────────────────────────────────────── */

/**
 * Expand an Alberta WMU specification against the authority's own unit list.
 *
 * Alberta: "Where a dash (-) is used between WMUs … the dash is to be
 * interpreted as including all WMUs that have numbers falling between the two
 * WMUs listed." So "102-402" is every published unit from 102 to 402, never a
 * run of integers. A named unit the layer does not publish stops the build.
 *
 * Returns the units plus anything else the cell carried — footnote references
 * and parenthesised place names — so nothing is silently discarded.
 */
export function expandWmuSpec(spec, officialIdentifiers) {
  const official = new Set(officialIdentifiers);
  const numeric = officialIdentifiers.map(Number);
  const footnotes = [];
  const names = [];
  let text = spec.replace(/\^([\d,]+)/g, (_, refs) => {
    footnotes.push(...refs.split(",").map(Number));
    return "";
  });
  text = text.replace(/\(([A-Za-z][^)]*)\)/g, (_, name) => {
    names.push(name.trim());
    return "";
  });
  // Parentheses that only group numbers, e.g. "(132, 136, 138)", carry no meaning of their own.
  text = text.replace(/[()]/g, " ");
  const identifiers = [];
  for (const raw of text.split(/[,\n]/).map((token) => token.trim()).filter(Boolean)) {
    const range = /^(\d{3})\s*[-–]\s*(\d{3})$/.exec(raw);
    if (range) {
      const [from, to] = [Number(range[1]), Number(range[2])];
      if (!official.has(range[1]) || !official.has(range[2]) || from >= to) {
        throw new Error(`WMU range "${raw}" in "${spec}" does not run between two published units`);
      }
      identifiers.push(...numeric.filter((value) => value >= from && value <= to).map(String));
      continue;
    }
    if (/^\d{3}$/.test(raw)) {
      if (!official.has(raw)) throw new Error(`WMU ${raw} in "${spec}" is not a published unit`);
      identifiers.push(raw);
      continue;
    }
    throw new Error(`Unrecognised WMU token "${raw}" in "${spec}"`);
  }
  if (!identifiers.length) throw new Error(`No WMUs in "${spec}"`);
  if (new Set(identifiers).size !== identifiers.length) throw new Error(`A WMU is named twice in "${spec}"`);
  return { identifiers, footnotes, names };
}

/* ── Dates ───────────────────────────────────────────────────────────────── */

/** Alberta's month letters, as printed in the guide's own abbreviation key. */
const MONTHS = { A: 8, S: 9, O: 10, N: 11, D: 12, J: 1, F: 2, M: 3, Ap: 4, Ma: 5, Ju: 6 };
const DATE = /^(Ap|Ma|Ju|A|S|O|N|D|J|F|M)(\d{1,2})$/;

const pad = (value) => String(value).padStart(2, "0");

function daysIn(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * One season window, anchored to the licence year the guide covers.
 *
 * The guide covers the licence year April 1 to March 31. A window opening from
 * August to December is in the first calendar year; January to June belongs to
 * the next only when the cell says so (", 2027") or the window runs on from a
 * first-year opening ("S1 - J15"). Anything else is refused: a spring date with
 * no year could be either spring, and guessing would move a season by a year.
 */
export function anchorWindow(statedAs, licenceYear) {
  const match = /^(\S+)\s*-\s*(\S+?)(?:,\s*(\d{4}))?$/.exec(statedAs.trim());
  if (!match) throw new Error(`Unrecognised season window "${statedAs}"`);
  const [, openText, closeText, explicitYear] = match;
  const open = DATE.exec(openText);
  const close = DATE.exec(closeText);
  if (!open || !close) throw new Error(`Unrecognised season date in "${statedAs}"`);
  const openMonth = MONTHS[open[1]];
  const closeMonth = MONTHS[close[1]];
  const secondYear = licenceYear + 1;
  if (explicitYear && Number(explicitYear) !== secondYear) {
    throw new Error(`"${statedAs}" names ${explicitYear}, outside the ${licenceYear}-${secondYear} licence year`);
  }
  const firstYearMonth = (month) => month >= 8;
  let openYear;
  let closeYear;
  if (firstYearMonth(openMonth)) {
    openYear = licenceYear;
    closeYear = firstYearMonth(closeMonth) ? licenceYear : secondYear;
    if (closeYear === licenceYear && explicitYear) throw new Error(`"${statedAs}" names ${explicitYear} for an autumn close`);
  } else {
    if (!explicitYear) throw new Error(`"${statedAs}" opens in ${open[1]} without a year; refusing to guess which spring`);
    openYear = secondYear;
    closeYear = secondYear;
  }
  const openDay = Number(open[2]);
  const closeDay = Number(close[2]);
  if (openDay > daysIn(openYear, openMonth) || closeDay > daysIn(closeYear, closeMonth)) {
    throw new Error(`"${statedAs}" is not a calendar date`);
  }
  const opensIso = `${openYear}-${pad(openMonth)}-${pad(openDay)}`;
  const closesIso = `${closeYear}-${pad(closeMonth)}-${pad(closeDay)}`;
  if (closesIso < opensIso) throw new Error(`"${statedAs}" closes before it opens`);
  return { opensIso, closesIso, statedAs: statedAs.trim() };
}

function isoDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function isoOf(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * The same window with Sundays removed, as consecutive Monday–Saturday runs.
 *
 * Alberta prohibits big-game hunting on Sundays in named units. A window that
 * reads "S1 - N3" is therefore not open on the Sundays inside it there, and a
 * date-in-window test would say it was.
 */
export function withoutSundays(window) {
  const runs = [];
  let start = null;
  const end = isoDate(window.closesIso);
  for (let day = isoDate(window.opensIso); day <= end; day = new Date(day.getTime() + 86_400_000)) {
    if (day.getUTCDay() === 0) {
      if (start) runs.push({ opensIso: isoOf(start), closesIso: isoOf(new Date(day.getTime() - 86_400_000)) });
      start = null;
    } else if (!start) {
      start = day;
    }
  }
  if (start) runs.push({ opensIso: isoOf(start), closesIso: window.closesIso });
  return runs.map((run) => ({ ...run, statedAs: `${window.statedAs} (Sundays excluded)` }));
}

/** Every date a window covers falls on one of these weekdays (0 = Sunday). */
export function coversOnlyWeekdays(window, weekdays) {
  const end = isoDate(window.closesIso);
  for (let day = isoDate(window.opensIso); day <= end; day = new Date(day.getTime() + 86_400_000)) {
    if (!weekdays.includes(day.getUTCDay())) return false;
  }
  return true;
}

/**
 * A season cell: its windows, whether it is special-licence only (■), and any
 * weekday note or footnote it carries. Unknown text in a cell stops the build.
 */
export function parseSeasonCell(text, licenceYear) {
  const footnotes = [];
  let body = text.replace(/\^([\d,]+)/g, (_, refs) => {
    footnotes.push(...refs.split(",").map(Number));
    return "";
  });
  const marks = (body.match(/■/g) ?? []).length;
  body = body.replace(/■/g, "\n");
  let weekdayNote = null;
  body = body.replace(/\((Wed\s*-\s*Sat only|Monday to (?:Friday|Saturday) only)\)/gi, (_, note) => {
    weekdayNote = note.replace(/\s+/g, " ");
    return "\n";
  });
  const pieces = body.split(/\n/).map((piece) => piece.trim()).filter(Boolean);
  const windows = pieces.map((piece) => anchorWindow(piece, licenceYear));
  if (marks) {
    // Two printed forms: one ■ leading the whole cell ("■(Wed - Sat only) N4 -
    // N7 …"), or one ■ per window ("■ S1 - S30 / ■ O1 - O24"). A cell marking
    // only some of its windows has no single licence reading and is refused
    // rather than split by guesswork.
    // A lone leading ■ covers the whole cell only when nothing else could be
    // meant: the cell has one window, or the ■ heads the cell's weekday note.
    // "■ S1 - S30 / O1 - O24" could mark the first window alone.
    const leadsCell = marks === 1 && text.trim().startsWith("■") &&
      (windows.length === 1 || /^■\s*\(/.test(text.trim()));
    if (!leadsCell && marks !== windows.length) {
      throw new Error(`Season cell "${text}" marks only some of its windows as special-licence`);
    }
  }
  if (weekdayNote === "Wed - Sat only") {
    for (const window of windows) {
      if (!coversOnlyWeekdays(window, [3, 4, 5, 6])) {
        throw new Error(`"${window.statedAs}" is printed as Wed - Sat only but covers other days`);
      }
    }
  } else if (weekdayNote) {
    throw new Error(`Season cell "${text}" carries a weekday restriction this builder does not model: ${weekdayNote}`);
  }
  return { windows, special: marks > 0, weekdayNote, footnotes };
}
