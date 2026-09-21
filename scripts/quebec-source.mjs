/**
 * Reading the Government of Québec's published hunting seasons.
 *
 * Québec publishes its seasons as HTML pages on quebec.ca, one per species or
 * group, in French. French is the authoritative text: the English pages are
 * translations, and a legal term is kept as the ministry wrote it rather than
 * as a translation of it.
 *
 * Everything here is strict. A season phrase, an implement heading, a class
 * label or a paragraph this module does not recognise raises, which stops the
 * build and names the text. Nothing is dropped and nothing is guessed: a page
 * change North Ground has not read must reach a person, never a hunter.
 *
 * The functions are pure over HTML strings so they are tested against recorded
 * fixtures; only `fetchText` and `fetchDesignations` touch the network.
 */

import { createHash } from "node:crypto";

export const SEASON_PAGE_BASE =
  "https://www.quebec.ca/tourisme-loisirs-sport/activites-sportives-et-de-plein-air/chasse-sportive/periodes-limites";

export const ZONE_WFS = "https://servicesvecto3.mern.gouv.qc.ca/geoserver/SmartFaunePub/ows";

const USER_AGENT = "NorthGroundBushcraft/1.0 (+https://www.northgroundbushcraft.com)";

/**
 * One page or service response, retried on a dropped connection or a server
 * error. A 4xx is raised at once: a missing page is a change to review, not a
 * transient failure to wait out.
 */
export async function fetchText(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/json" },
        signal: AbortSignal.timeout(90_000),
      });
      if (response.status >= 400 && response.status < 500) {
        throw Object.assign(new Error(`${url} -> HTTP ${response.status}`), { permanent: true });
      }
      if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      if (error.permanent) throw error;
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 3_000 * attempt));
    }
  }
  throw new Error(`${url}: ${lastError?.message ?? "failed"}`);
}

export function sha256(text) {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

/* ── Text ─────────────────────────────────────────────────────────────────── */

const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘",
  laquo: "«", raquo: "»", eacute: "é", egrave: "è", ecirc: "ê", agrave: "à", acirc: "â",
  ccedil: "ç", ocirc: "ô", icirc: "î", ucirc: "û", ugrave: "ù", Eacute: "É", Icirc: "Î",
  hellip: "…", ndash: "–", mdash: "—",
};

export function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name] ?? match);
}

/**
 * Visible text, with the spacing a reader sees.
 *
 * The ministry wraps non-breaking spaces in `<span class="nbsp">`, writes
 * apostrophes both as ' and ’, and uses both "ilots" and "îlots". Those are
 * normalised for comparison only; the verbatim text a person reads is kept
 * separately wherever it is shown.
 */
export function textOf(html) {
  return decodeEntities(
    html
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|div|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t  ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** One line, for a phrase that should not contain structure. */
export function lineOf(html) {
  return textOf(html).replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
}

/** Comparison form: case, apostrophe style and whitespace no longer matter. */
export function normalise(text) {
  return text.replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
}

/* ── Page structure ───────────────────────────────────────────────────────── */

export function mainContent(html) {
  const match = /<main\b[\s\S]*?<\/main>/i.exec(html);
  if (!match) throw new Error("Page has no <main> element; the page layout changed.");
  return match[0].replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "");
}

export function pageTitle(html) {
  const match = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(mainContent(html));
  if (!match) throw new Error("Page has no <h1>.");
  return lineOf(match[1]);
}

const FRENCH_MONTHS = {
  janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7,
  août: 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
};

function iso(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Impossible date ${year}-${month}-${day}`);
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthNumber(word) {
  const month = FRENCH_MONTHS[word.toLowerCase()];
  if (!month) throw new Error(`Unknown French month "${word}"`);
  return month;
}

/**
 * "Dernière mise à jour : 18 septembre 2026" — the page's own version marker.
 *
 * Kept because it is the ministry's statement of when the page last changed,
 * which is independent of when North Ground read it.
 */
export function pageLastUpdated(html) {
  const text = textOf(html);
  const match = /Dernière mise à jour\s*:?\s*(\d{1,2})(?:er)?\s+([a-zéû]+)\s+(\d{4})/i.exec(text);
  if (!match) throw new Error("Page has no 'Dernière mise à jour' date.");
  return iso(Number(match[3]), monthNumber(match[2]), Number(match[1]));
}

/**
 * The page as an ordered list of blocks under their headings.
 *
 * Order matters: the deer page states a table's implement in a paragraph
 * immediately before that table ("Engin : arbalète et arc"), so a note is only
 * meaningful relative to the table it precedes.
 */
export function pageBlocks(html) {
  const main = mainContent(html);
  const blocks = [];
  let heading = { level: 1, text: "" };
  const pattern = /<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>|<table\b[\s\S]*?<\/table>|<(p|li)\b[^>]*>([\s\S]*?)<\/\3>/gi;
  for (const match of main.matchAll(pattern)) {
    if (match[1]) {
      heading = { level: Number(match[1]), text: lineOf(match[2]) };
      blocks.push({ kind: "heading", heading });
      continue;
    }
    if (match[0].toLowerCase().startsWith("<table")) {
      blocks.push({ kind: "table", heading, table: parseTable(match[0]) });
      continue;
    }
    // A paragraph inside a table cell belongs to the table, not to the prose.
    const before = main.slice(0, match.index);
    const openTables = (before.match(/<table\b/gi) ?? []).length;
    const closedTables = (before.match(/<\/table>/gi) ?? []).length;
    if (openTables > closedTables) continue;
    const text = lineOf(match[4]);
    if (text) blocks.push({ kind: match[3].toLowerCase() === "li" ? "item" : "paragraph", heading, text, html: match[4] });
  }
  return blocks;
}

export function parseTable(tableHtml) {
  const rows = [];
  for (const rowMatch of tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [];
    for (const cellMatch of rowMatch[1].matchAll(/<t([hd])\b[^>]*>([\s\S]*?)<\/t\1>/gi)) {
      cells.push({ header: cellMatch[1].toLowerCase() === "h", html: cellMatch[2], text: lineOf(cellMatch[2]) });
    }
    if (cells.length) rows.push(cells);
  }
  if (!rows.length) throw new Error("Empty table.");
  const [header, ...body] = rows;
  return { headers: header.map((cell) => cell.text), rows: body };
}

/* ── Season phrases ───────────────────────────────────────────────────────── */

/**
 * The years a season column covers, from its header.
 *
 * Big game prints one column per calendar year ("Période de chasse 2026");
 * small game prints one per season that runs across two ("Période de chasse
 * 2026-2027"). A date read from a column must fall inside that column, which
 * catches a mistyped year on the page instead of certifying it.
 */
export function seasonColumn(header) {
  const match = /Période de chasse\s+(\d{4})(?:\s*[-–]\s*(\d{4}))?/i.exec(header);
  if (!match) throw new Error(`Unrecognised season column header "${header}"`);
  const from = Number(match[1]);
  const to = match[2] ? Number(match[2]) : from;
  if (to !== from && to !== from + 1) throw new Error(`Season column spans ${from} to ${to}`);
  return { label: match[2] ? `${from}-${to}` : String(from), firstYear: from, lastYear: to };
}

const DAY = String.raw`(\d{1,2})(?:er)?`;
const MONTH = String.raw`([a-zéûA-ZÉ]+)`;
const YEAR = String.raw`(\d{4})`;
/* "Du 26 septembre au 4 octobre 2026", "Du 3 au 16 octobre 2026",
   "Du 19 septembre 2026 au 31 mars 2027", "Du 1er août au 31 août 2026". */
const WINDOW = new RegExp(
  String.raw`^Du ${DAY}(?:\s+${MONTH})?(?:\s+${YEAR})?\s+au\s+${DAY}\s+${MONTH}\s+${YEAR}$`,
  "i",
);

function parseWindow(phrase, column) {
  const match = WINDOW.exec(phrase.trim());
  if (!match) throw new Error(`Unreadable season phrase "${phrase}"`);
  const [, openDay, openMonthWord, openYearText, closeDay, closeMonthWord, closeYearText] = match;
  const closeYear = Number(closeYearText);
  const closeMonth = monthNumber(closeMonthWord);
  const openMonth = openMonthWord ? monthNumber(openMonthWord) : closeMonth;
  const openYear = openYearText ? Number(openYearText) : closeYear;
  const opens = iso(openYear, openMonth, Number(openDay));
  const closes = iso(closeYear, closeMonth, Number(closeDay));
  if (opens > closes) throw new Error(`Season "${phrase}" closes before it opens`);
  if (openYear < column.firstYear || closeYear > column.lastYear) {
    throw new Error(`Season "${phrase}" falls outside its column ${column.label}`);
  }
  return { opens, closes };
}

/**
 * Every window in one season cell.
 *
 * Bear prints two windows in one cell, spring and fall, one per line. Each is
 * read on its own; a cell that does not split cleanly into readable windows
 * raises rather than yielding the part that did.
 */
export function parseSeasonCell(cellHtml, column) {
  const lines = textOf(cellHtml).split("\n").map((line) => line.trim()).filter(Boolean);
  if (!lines.length) throw new Error("Empty season cell");
  const windows = lines.map((line) => parseWindow(line, column));
  return { phrase: lines.join(" / "), windows };
}

/* ── Per-year class cells ─────────────────────────────────────────────────── */

/**
 * The animal class a row allows, per season year.
 *
 * Usually one label for both years. Where the ministry alternates a zone
 * between restrictive and permissive years, the cell carries one label per
 * year — `<p><strong>2026 </strong>Orignal avec bois</p><p><strong>2027
 * </strong>Orignal</p>` — and flattening it would give one of those two years
 * the wrong animal class. Every part must name one of the table's own years.
 */
export function parseClassCell(cellHtml, columnLabels) {
  const paragraphs = [...cellHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => match[1]);
  const yearly = paragraphs.map((paragraph) => /^\s*<strong>\s*(\d{4})\s*<\/strong>([\s\S]*)$/i.exec(paragraph));
  if (paragraphs.length > 1 || yearly.some(Boolean)) {
    if (!yearly.every(Boolean)) throw new Error(`Class cell mixes per-year and plain parts: "${lineOf(cellHtml)}"`);
    const byYear = {};
    for (const match of yearly) {
      const year = match[1];
      if (!columnLabels.includes(year)) throw new Error(`Class cell names ${year}, which is not a column of this table`);
      if (byYear[year]) throw new Error(`Class cell names ${year} twice`);
      byYear[year] = lineOf(match[2]);
    }
    for (const label of columnLabels) {
      if (!byYear[label]) throw new Error(`Class cell gives no class for ${label}`);
    }
    return byYear;
  }
  const label = lineOf(cellHtml);
  if (!label) throw new Error("Empty class cell");
  return Object.fromEntries(columnLabels.map((year) => [year, label]));
}

/* ── Implements ───────────────────────────────────────────────────────────── */

/**
 * Canonical implements.
 *
 * Shared with Ontario where the words mean the same thing (RIFLE, SHOTGUN,
 * MUZZLELOADER, BOW) and extended where Québec names an implement Ontario does
 * not: the crossbow is its own implement here, with its own prohibitions, and
 * small game adds air guns and snares.
 */
export const IMPLEMENTS = ["RIFLE", "SHOTGUN", "MUZZLELOADER", "CROSSBOW", "BOW", "AIR_GUN", "SNARE"];

/**
 * "Armes à feu" is expanded using the ministry's own definition, printed in the
 * deer page's heading: "armes à feu (carabine, fusil, arme à chargement par la
 * bouche)". It is recorded as a definition statement in the bundle so the
 * expansion is traceable rather than assumed.
 */
export const FIREARMS_DEFINITION =
  "armes à feu (carabine, fusil, arme à chargement par la bouche)";
const FIREARMS = ["RIFLE", "SHOTGUN", "MUZZLELOADER"];

/**
 * Implement headings as the ministry prints them, and nothing else.
 *
 * An unrecognised heading raises. The turkey heading — "fusil, arme à
 * chargement par la bouche ou la culasse, arbalète et arc" — is deliberately
 * left unmapped: whether "arme à chargement par la culasse" admits a rifle for
 * turkey is a legal reading these pages do not settle, so turkey rules carry
 * the heading verbatim and never ask or answer the implement question.
 */
const IMPLEMENT_HEADINGS = [
  [/^Périodes de chasse (?:à l'arbalète et à l'arc|à l'arc et à l'arbalète)$/, ["CROSSBOW", "BOW"]],
  [/^Périodes de chasse à l'arc$/, ["BOW"]],
  [/^Périodes de chasse aux armes à feu, à l'arbalète et à l'arc$/, [...FIREARMS, "CROSSBOW", "BOW"]],
  [/^Périodes de chasse au fusil, à l'arme à chargement par la bouche, à l'arbalète et à l'arc$/, ["SHOTGUN", "MUZZLELOADER", "CROSSBOW", "BOW"]],
  [/^Périodes de chasse aux armes à feu \(carabine, fusil, arme à chargement par la bouche\), à l'arbalète et à l'arc$/, [...FIREARMS, "CROSSBOW", "BOW"]],
  [/^Fusil, arme à chargement par la bouche ou la culasse, arbalète et arc$/, null],
];

export function implementsForHeading(heading) {
  const text = heading.replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
  for (const [pattern, implementsList] of IMPLEMENT_HEADINGS) {
    if (pattern.test(text)) return { implements: implementsList, label: heading.trim() };
  }
  throw new Error(`Unrecognised implement heading "${heading}"`);
}

/**
 * The deer relève tables state their implement in a paragraph before the table
 * ("Engin : arbalète et arc") rather than in a heading. Read strictly, like the
 * headings.
 */
const RELEVE_ENGINS = [
  [/^arbalète et arc$/i, ["CROSSBOW", "BOW"]],
  [/^armes à feu, à l'arbalète et à l'arc$/i, [...FIREARMS, "CROSSBOW", "BOW"]],
];

export function implementsForEnginParagraph(text) {
  const phrase = text.replace(/^Engin\s*:\s*/i, "").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
  for (const [pattern, implementsList] of RELEVE_ENGINS) {
    if (pattern.test(phrase)) return { implements: implementsList, label: phrase };
  }
  throw new Error(`Unrecognised relève implement "${text}"`);
}

/** Small-game "Engin" cells: the implement phrase, plus any note printed inside the cell. */
const ENGIN_PHRASES = [
  [/^Armes à feu et à air comprimé, arbalète et arc\.?$/i, [...FIREARMS, "AIR_GUN", "CROSSBOW", "BOW"]],
  [/^Armes à feu, à air comprimé et arc\.?$/i, [...FIREARMS, "AIR_GUN", "BOW"]],
  [/^Armes à feu, arbalète et arc\.?$/i, [...FIREARMS, "CROSSBOW", "BOW"]],
  [/^Collet\.?$/i, ["SNARE"]],
];

export function parseEnginCell(cellHtml) {
  /* The note sits in the same cell as the implement phrase, usually as a
     second paragraph and sometimes run on after a full stop. */
  const text = textOf(cellHtml).replace(/[’‘]/g, "'");
  const noteStart = text.search(/(?:L'utilisation de|Dans la zone)/);
  const phrase = (noteStart >= 0 ? text.slice(0, noteStart) : text).replace(/\s+/g, " ").trim();
  const note = noteStart >= 0 ? text.slice(noteStart).replace(/\s+/g, " ").trim() : null;
  for (const [pattern, implementsList] of ENGIN_PHRASES) {
    if (pattern.test(phrase)) return { implements: implementsList, label: phrase.replace(/\.$/, ""), note };
  }
  throw new Error(`Unrecognised small-game implement "${phrase}"`);
}

/**
 * "L'utilisation de l'arbalète est interdite dans les zones 22, 23 et 24."
 *
 * Returns the zone numbers the crossbow is prohibited in. A crossbow note is
 * the Québec form of Ontario's footnote problem: it subtracts an implement from
 * a table whose heading names it, so a rule stored with the heading's
 * implements would tell a crossbow hunter in zone 22 that the season is open.
 */
export function parseCrossbowBan(text) {
  const match = /^(?:Note\s*:\s*)?L'utilisation de l'arbalète est interdite dans (?:la zone|les zones)\s+([\d,\s]+(?:et\s+\d+)?)\s*\.?$/i
    .exec(text.replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim());
  if (!match) return null;
  return match[1].split(/,|\bet\b/).map((part) => part.trim()).filter(Boolean).map((part) => part.padStart(2, "0"));
}

/* ── Zone lists written as prose ──────────────────────────────────────────── */

/**
 * "zones 1 à 12, 14 à 16, 22, 26 et 27" → ["01", …, "12", "14", "15", "16", "22", "26", "27"].
 *
 * Used only for the zone lists inside the ministry's own sentences (the
 * antlerless-moose permit regime). Every number produced is checked against the
 * zones the layer publishes, so a range can never invent a zone 25.
 */
export function expandZoneNumberList(text, publishedNumbers) {
  const numbers = [];
  for (const part of text.split(/,|\bet\b/).map((piece) => piece.trim()).filter(Boolean)) {
    const range = /^(\d{1,2})\s+à\s+(\d{1,2})$/.exec(part);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (to < from) throw new Error(`Backwards zone range "${part}"`);
      for (let zone = from; zone <= to; zone += 1) numbers.push(String(zone).padStart(2, "0"));
      continue;
    }
    if (!/^\d{1,2}$/.test(part)) throw new Error(`Unreadable zone list item "${part}" in "${text}"`);
    numbers.push(part.padStart(2, "0"));
  }
  for (const number of numbers) {
    if (!publishedNumbers.has(number)) throw new Error(`Zone ${number} in "${text}" is not a published hunting zone`);
  }
  return numbers;
}

/* ── Designations ─────────────────────────────────────────────────────────── */

/**
 * The layer's designations, attributes only.
 *
 * Label resolution needs every designation's number and part name, never its
 * geometry, so this asks for three attributes and pages quickly. It proves
 * completeness the same way the geometry adapter does: every feature the
 * service says exists must arrive exactly once.
 */
export async function fetchDesignations(repairPartName) {
  const seen = new Set();
  const byDesignation = new Map();
  let startIndex = 0;
  let expected = null;
  for (;;) {
    const parameters = new URLSearchParams({
      service: "WFS", version: "2.0.0", request: "GetFeature",
      typeNames: "SmartFaunePub:Zone_chasse_da3_sefaq", outputFormat: "application/json",
      propertyName: "Zone,No_zone,Partie_zon", count: "1000", startIndex: String(startIndex),
      sortBy: "Zone ASC,Latitude ASC,Longitude ASC",
    });
    const page = JSON.parse(await fetchText(`${ZONE_WFS}?${parameters}`));
    expected ??= page.numberMatched ?? page.totalFeatures ?? null;
    const rows = page.features ?? [];
    if (!rows.length) break;
    for (const row of rows) {
      if (!row.id || seen.has(row.id)) continue;
      seen.add(row.id);
      const designation = String(row.properties?.Zone ?? "").trim();
      if (!designation) throw new Error(`Feature ${row.id} has no Zone`);
      if (!byDesignation.has(designation)) {
        byDesignation.set(designation, {
          designation,
          zoneNumber: String(row.properties?.No_zone ?? "").trim(),
          partName: repairPartName(String(row.properties?.Partie_zon ?? "").trim()),
        });
      }
    }
    startIndex += rows.length;
    if (expected !== null && startIndex >= expected) break;
  }
  if (expected === null || seen.size !== expected) {
    throw new Error(`Incomplete designation read: ${seen.size} of ${expected ?? "?"} features`);
  }
  return [...byDesignation.values()].sort((a, b) => a.designation.localeCompare(b.designation));
}

/* ── Bundle comparison ────────────────────────────────────────────────────── */

/**
 * What changed between two Québec bundles, per rule, with the designations each
 * change touches.
 *
 * Rules are matched by identity, so a reordered table reads as no change while
 * a moved date, a narrowed implement or a different animal class reads as one.
 */
export function diffQuebecBundles(previous, next) {
  const index = (bundle) => new Map((bundle?.rules ?? []).map((rule) => [rule.id, rule]));
  const before = index(previous);
  const after = index(next);
  const added = [...after.keys()].filter((id) => !before.has(id)).sort();
  const removed = [...before.keys()].filter((id) => !after.has(id)).sort();
  const changed = [];
  const fields = ["seasonPhrase", "windows", "permittedImplements", "animalClasses", "classLabel", "seasonType",
    "designations", "caveats", "conditionIds", "declaredNoSeason"];
  for (const [id, rule] of after) {
    const prior = before.get(id);
    if (!prior) continue;
    const moved = fields
      .filter((field) => JSON.stringify(prior[field]) !== JSON.stringify(rule[field]))
      .map((field) => ({ field, from: prior[field], to: rule[field] }));
    if (moved.length) changed.push({ id, speciesId: rule.speciesId, designations: rule.designations, fields: moved });
  }
  const touched = new Set([
    ...added.flatMap((id) => after.get(id).designations),
    ...removed.flatMap((id) => before.get(id).designations),
    ...changed.flatMap((entry) => entry.designations),
  ]);
  return { added, removed, changed, designationsTouched: [...touched].sort() };
}

export function formatQuebecDiff(diff) {
  const lines = [];
  for (const id of diff.removed) lines.push(`  REMOVED  ${id}`);
  for (const id of diff.added) lines.push(`  ADDED    ${id}`);
  for (const entry of diff.changed) {
    lines.push(`  CHANGED  ${entry.id}`);
    lines.push(`           ${entry.designations.length} designation(s): ${entry.designations.slice(0, 10).join(", ")}${entry.designations.length > 10 ? " …" : ""}`);
    for (const field of entry.fields) {
      const show = (value) => (typeof value === "string" ? value : JSON.stringify(value));
      lines.push(`           ${field.field}: ${show(field.from)}  ->  ${show(field.to)}`);
    }
  }
  lines.push(`  blast radius: ${diff.added.length + diff.removed.length + diff.changed.length} rule(s), ` +
    `${diff.designationsTouched.length} designation(s)`);
  return lines.join("\n");
}
