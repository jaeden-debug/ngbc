/**
 * Reading Manitoba's published hunting law.
 *
 * Manitoba publishes its seasons in the regulation itself — the Hunting Seasons
 * and Bag Limits Regulation, M.R. 165/91 — as structured, bilingual HTML on the
 * King's Printer's site. That is the controlling source, and it is also the most
 * machine-readable one, so rules are built from it and the annual guide (which
 * states on its own contents page that it "is neither a legal document nor a
 * complete collection of wildlife regulations") is used only to cross-check.
 *
 * Everything here is strict. A table row, footnote, equipment term, date phrase
 * or area token this module does not recognise throws; it is never skipped. A
 * regulatory bundle that quietly drops what it could not read is worse than no
 * bundle.
 */

import { createHash } from "node:crypto";

export const MANITOBA_TIME_ZONE = "America/Winnipeg";

export function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export async function fetchBytes(url, { attempts = 3 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "NorthGroundBushcraft/1.0 (+https://www.northgroundbushcraft.com)" },
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  throw lastError;
}

export async function fetchText(url) {
  return (await fetchBytes(url)).toString("utf8");
}

export async function fetchJson(url) {
  const payload = JSON.parse(await fetchText(url));
  if (payload && payload.error) throw new Error(`${url} -> ${payload.error.message ?? "service error"}`);
  return payload;
}

/* ── HTML ───────────────────────────────────────────────────────────────── */

const ENTITIES = {
  "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&deg;": "°",
  "&ndash;": "–", "&mdash;": "—", "&rsquo;": "’", "&lsquo;": "‘", "&ldquo;": "“", "&rdquo;": "”",
  "&eacute;": "é", "&egrave;": "è", "&ecirc;": "ê", "&agrave;": "à", "&acirc;": "â", "&ccedil;": "ç",
  "&ocirc;": "ô", "&icirc;": "î", "&ucirc;": "û", "&laquo;": "«", "&raquo;": "»", "&Eacute;": "É",
};

export function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&[a-z]+;/gi, (entity) => ENTITIES[entity] ?? entity)
    .replace(/ | /g, " ");
}

/** Cell markup to text, keeping line breaks and recording footnote markers. */
export function cellText(html) {
  const footnotes = [...html.matchAll(/<sup>\s*([^<]+?)\s*<\/sup>/gi)].map((match) => match[1].trim());
  const text = decodeEntities(
    html
      .replace(/<sup>[\s\S]*?<\/sup>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h\d|li|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return { text, footnotes };
}

/** All body text of a Manitoba Laws consolidation, English and French, for hashing. */
export function lawBody(html) {
  const blocks = [];
  for (const cls of ["regcol-e", "regcol-f"]) {
    let index = 0;
    for (;;) {
      const start = html.indexOf(`class="${cls}"`, index);
      if (start < 0) break;
      const open = html.lastIndexOf("<", start);
      let depth = 0;
      let cursor = open;
      const tag = /<(\/?)div\b[^>]*>/gi;
      tag.lastIndex = open;
      for (let match = tag.exec(html); match; match = tag.exec(html)) {
        depth += match[1] ? -1 : 1;
        cursor = tag.lastIndex;
        if (depth === 0) break;
      }
      blocks.push(`${cls}:\n${cellText(html.slice(open, cursor)).text}`);
      index = cursor;
    }
  }
  if (blocks.length < 10) throw new Error("The consolidation page no longer carries its regulation body in the expected columns");
  return blocks.join("\n\n");
}

const MONTH_NAMES = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function isoFromWords(text) {
  const match = /^([A-Z][a-z]+) (\d{1,2}), (\d{4})$/.exec(text.trim());
  const month = match && MONTH_NAMES[match[1].toLowerCase()];
  if (!match || !month) throw new Error(`Unreadable consolidation date "${text}"`);
  return `${match[3]}-${String(month).padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

/**
 * Which version of the regulation this is, as the King's Printer states it.
 *
 * The page also prints "As of <today>, this is the most current version", which
 * changes every day and is deliberately not part of the version or the hash.
 */
export function consolidationVersion(html) {
  const text = decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
  const since = /It has been in effect since ([A-Z][a-z]+ \d{1,2}, \d{4})\./.exec(text);
  const last = /Last amendment included: M\.R\. (\d+\/\d{4})/.exec(text);
  const title = /<meta name="TitleEn" content="([^"]+)"/.exec(html);
  if (!since || !last || !title) throw new Error("The consolidation page no longer states its version");
  return { title: decodeEntities(title[1]), inEffectSince: isoFromWords(since[1]), lastAmendment: `M.R. ${last[1]}` };
}

/* ── Tables ─────────────────────────────────────────────────────────────── */

/**
 * The first table after a schedule heading, as rows of cells with `rowspan`
 * carried down, so every row is complete.
 *
 * English schedules are anchored `id="SchA"` … `id="SchH"`; the French ones are
 * `id="AnnA"` …, and are deliberately not read here — the English table is
 * parsed and the whole bilingual body is hashed.
 */
export function scheduleTable(html, scheduleId) {
  const anchor = html.indexOf(`id="${scheduleId}"`);
  if (anchor < 0) throw new Error(`Schedule ${scheduleId} is not on the page`);
  const start = html.indexOf("<table", anchor);
  const end = html.indexOf("</table>", start);
  if (start < 0 || end < 0) throw new Error(`Schedule ${scheduleId} has no table`);
  const table = html.slice(start, end);
  const heading = cellText(html.slice(anchor, start)).text;

  const rows = [];
  const carried = []; // column -> { cell, remaining }
  for (const rowMatch of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)].map((match) => ({
      attributes: match[1],
      html: match[2],
      ...cellText(match[2]),
      rowspan: Number(/rowspan="(\d+)"/i.exec(match[1])?.[1] ?? 1),
      colspan: Number(/colspan="(\d+)"/i.exec(match[1])?.[1] ?? 1),
    }));
    const row = [];
    let column = 0;
    let next = 0;
    while (next < cells.length || (carried[column] && carried[column].remaining > 0)) {
      if (carried[column] && carried[column].remaining > 0) {
        row.push({ ...carried[column].cell, carried: true });
        carried[column].remaining -= 1;
        column += 1;
        continue;
      }
      const cell = cells[next++];
      if (!cell) break;
      row.push(cell);
      if (cell.rowspan > 1) carried[column] = { cell, remaining: cell.rowspan - 1 };
      column += cell.colspan;
    }
    rows.push(row);
  }
  return { heading, rows };
}

/**
 * Split a schedule's rows into its lettered parts, one per licence.
 *
 * A part heading is a single full-width cell such as "A. MANITOBA RESIDENT
 * GAME BIRD …". Column headings and spacer rows are recognised and skipped;
 * footnote rows ("¹ Under age 18 only.") are collected per part. Anything else
 * that is not a data row of the expected width is refused.
 */
export function scheduleParts(table, width) {
  const parts = [];
  let current = null;
  for (const row of table.rows) {
    const texts = row.map((cell) => cell.text);
    if (row.length === 1 && row[0].colspan === width && !row[0].footnotes.length && !texts[0].startsWith("*")) {
      const part = /^([A-H])\.\s+(.+)$/.exec(texts[0]);
      if (!part) throw new Error(`Unrecognised full-width row "${texts[0]}"`);
      current = { letter: part[1], heading: part[2].replace(/\s+/g, " ").trim(), rows: [], footnotes: {} };
      parts.push(current);
      continue;
    }
    if (texts.every((text) => text === "")) continue;
    if (texts.every((text) => /^COLUMN \d$/.test(text))) continue;
    if (/^(Species|Hunting Areas)$/.test(texts[0])) continue;
    if (!current) throw new Error(`Row before any licence part: "${texts.join(" | ")}"`);

    const first = row[0];
    /* A footnote row carries its markers at the start of the first cell and
       nothing else in the row — either as one full-width cell or as a first
       cell followed by empty ones. */
    const startsWithMarker = /^\s*<sup>/i.test(first.html) || texts[0].startsWith("*");
    const footnoteRow = startsWithMarker && !first.carried && row.slice(1).every((cell) => cell.text === "");
    if (footnoteRow) {
      if (texts[0].startsWith("*")) {
        current.footnotes["*"] = texts[0].slice(1).trim();
      } else if (first.footnotes.length === 1) {
        current.footnotes[first.footnotes[0]] = texts[0];
      } else {
        // Several footnote bodies in one cell ("¹In GBHZ 4 … ²Up to …"): the
        // markup puts each marker before its own text.
        const bodies = first.html.split(/<sup>\s*([^<]+?)\s*<\/sup>/i);
        for (let index = 1; index < bodies.length; index += 2) {
          current.footnotes[bodies[index].trim()] = cellText(bodies[index + 1]).text;
        }
      }
      continue;
    }
    if (row.length !== width) {
      throw new Error(`Part ${current.letter} row has ${row.length} cells, expected ${width}: "${texts.join(" | ")}"`);
    }
    current.rows.push(row);
  }
  if (!parts.length) throw new Error("Schedule has no licence parts");
  return parts;
}

/* ── Game Hunting Areas ─────────────────────────────────────────────────── */

/**
 * The areas M.R. 220/86 defines, in the regulation's own order.
 *
 * This list is the legal definition of what a GHA is. The official GIS layer
 * is checked against it, never the other way round.
 */
export function definedGameHuntingAreas(html) {
  const body = lawBody(html);
  const english = body.split("\n\n").filter((block) => block.startsWith("regcol-e:")).join("\n");
  const areas = [...english.matchAll(/^Area (\d{1,2}[A-C]?)$/gm)].map((match) => match[1]);
  if (areas.length < 50) throw new Error(`M.R. 220/86 yielded only ${areas.length} area headings`);
  if (new Set(areas).size !== areas.length) throw new Error("M.R. 220/86 defines an area twice");
  return areas;
}

export function compareAreas(left, right) {
  const parse = (value) => {
    const match = /^(\d+)([A-Z]*)$/.exec(value);
    if (!match) throw new Error(`Not a Game Hunting Area designation: "${value}"`);
    return [Number(match[1]), match[2]];
  };
  const [a, as] = parse(left);
  const [b, bs] = parse(right);
  return a !== b ? a - b : as < bs ? -1 : as > bs ? 1 : 0;
}

/**
 * Expand a list of areas as the regulation writes them.
 *
 * A range covers every defined area that sorts between its two ends in the
 * authority's order: "5-7" is 5, 6, 6A and 7 — not 7A, which sorts after 7.
 * That reading is not assumed; the 2026 guide confirms it three ways (6A in
 * zone A under "5-7", 13A under "12-14" for non-Canadian residents, and 7A
 * absent), and the builder cross-checks every range against the guide.
 *
 * Members a range reaches only because of that reading — lettered areas the
 * text never names — are reported separately, because they are where an
 * interpretation, rather than the text, puts an area inside a rule.
 */
export function expandAreaList(items, ordered) {
  const areas = [];
  const interpretive = [];
  for (const raw of items) {
    const item = raw.replace(/[–—]/g, "-").replace(/\s+/g, "");
    if (/^\d+[A-Z]?$/.test(item)) {
      if (!ordered.includes(item)) throw new Error(`Area "${item}" is not defined in M.R. 220/86`);
      areas.push(item);
      continue;
    }
    const range = /^(\d+[A-Z]?)-(\d+[A-Z]?)$/.exec(item);
    if (!range) throw new Error(`Unrecognised area token "${raw}"`);
    const [from, to] = [range[1], range[2]];
    if (!ordered.includes(from) || !ordered.includes(to)) throw new Error(`Range "${raw}" names an undefined area`);
    if (compareAreas(from, to) >= 0) throw new Error(`Range "${raw}" does not ascend`);
    for (const area of ordered) {
      if (compareAreas(area, from) >= 0 && compareAreas(area, to) <= 0) {
        areas.push(area);
        // Named by the text: the endpoints, and bare numbers inside the range.
        if (area !== from && area !== to && /[A-Z]$/.test(area)) interpretive.push({ area, range: raw.trim() });
      }
    }
  }
  if (new Set(areas).size !== areas.length) throw new Error(`Area list "${items.join(", ")}" names an area twice`);
  return { areas: areas.sort(compareAreas), interpretive };
}

/* ── Geography ──────────────────────────────────────────────────────────── */

/**
 * Named places the season tables carve out or single out. Each is a separate
 * geography with its own authority, never a word to be dropped. A name not
 * listed here stops the build.
 */
export const NAMED_GEOGRAPHIES = {
  "CFB Shilo": "special_geography:ca-mb-cfb-shilo",
  "Oak Hammock Waterfowl Control Area": "special_geography:ca-mb-oak-hammock-waterfowl-control-area",
  "Whiteshell Game Bird Refuge": "special_geography:ca-mb-whiteshell-game-bird-refuge",
};

const MACDONALD_PORTION = /^those parts of area 38 found within the R\.M\. of Macdonald$/i;
export const GHA38_MACDONALD = "special_geography:ca-mb-gha-38-rm-of-macdonald";

function splitList(text) {
  return text
    .split(/,\s*|\s+and\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Read a Column 1/2 cell into an explicit geography expression.
 *
 *   "GBHZ 3 & 4 (excluding GHA 19, 19B, 22-24, 27-33, CFB Shilo and Oak …)"
 *   "Areas 26, 36 (excluding Whiteshell Game Bird Refuge)"
 *   "Area 33, those parts of Area 38 found within the R.M. of Macdonald"
 */
export function parseGeography(cell, ordered) {
  const text = cell.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  const exclusion = /^(.*?)\s*\(excluding ([^)]+)\)$/.exec(text);
  const base = exclusion ? exclusion[1] : text;

  const include = { ghas: [], gbhz: [], special: [], interpretive: [] };
  const gbhz = /^GBHZ ([\d, &]+)$/.exec(base);
  if (gbhz) {
    include.gbhz = gbhz[1].split(/[,&]/).map((value) => Number(value.trim())).filter(Boolean).sort();
    if (!include.gbhz.length || include.gbhz.some((zone) => zone < 1 || zone > 4)) {
      throw new Error(`Unreadable game bird hunting zones "${base}"`);
    }
  } else {
    const listed = base.replace(/^(Areas|Area|GHA)\s+/i, "");
    const tokens = [];
    for (const item of splitList(listed)) {
      if (MACDONALD_PORTION.test(item)) { include.special.push(GHA38_MACDONALD); continue; }
      tokens.push(item.replace(/^(Areas|Area|GHA)\s+/i, ""));
    }
    if (tokens.length) {
      const expanded = expandAreaList(tokens, ordered);
      include.ghas = expanded.areas;
      include.interpretive = expanded.interpretive;
    }
    if (!include.ghas.length && !include.special.length) throw new Error(`No geography in "${text}"`);
  }

  const exclude = { ghas: [], special: [], interpretive: [] };
  if (exclusion) {
    const areaTokens = [];
    for (const item of splitList(exclusion[2])) {
      const named = NAMED_GEOGRAPHIES[item];
      if (named) { exclude.special.push(named); continue; }
      const token = item.replace(/^GHA\s+/i, "");
      if (!/^\d+[A-Z]?(-\d+[A-Z]?)?$/.test(token)) throw new Error(`Unrecognised exclusion "${item}" in "${text}"`);
      areaTokens.push(token);
    }
    if (areaTokens.length) {
      const expanded = expandAreaList(areaTokens, ordered);
      exclude.ghas = expanded.areas;
      exclude.interpretive = expanded.interpretive;
    }
  }
  return { statedAs: text, include, exclude };
}

/**
 * Which areas a moose or elk row names, for dating a condition on OTHER hunters.
 *
 * Section 10.3 bars deer hunting in some areas "during a moose season" or "during
 * an elk season" without the right licence, so the builder needs to know when
 * those seasons run — not to certify moose or elk, only to say when a deer
 * hunter's condition applies. Area tokens are read strictly. A partial-area
 * phrase ("that part of Area 14 west of …") or an exclusion ("excluding those
 * portions of the Cross Lake Registered Trapline Section …") is kept verbatim as
 * a caveat on that condition rather than dropped or guessed at.
 */
export function mentionedAreas(cell, ordered) {
  let text = cell.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  const caveats = [];
  // An exclusion can close the list or sit after one area inside it
  // ("9, 9A (excluding … Plan No. 20703), 11"); either way it stays attached
  // to what it qualifies.
  text = text.replace(/\s*(\b\d+[A-Z]?\b)?\s*\(excluding ([^)]+)\)/g, (_match, area, excluded) => {
    // Attached to the area it follows; a trailing exclusion with no area in
    // front of it qualifies the whole row.
    caveats.push({ area: area ?? null, text: area ? `Area ${area} excluding ${excluded}` : `excluding ${excluded}` });
    return area ? ` ${area}` : "";
  }).trim();
  const partial = [];
  text = text.replace(/,?\s*(?:and )?that part of Area (\d+[A-Z]?) [^,]+$/i, (phrase, area) => {
    partial.push(area);
    caveats.push({ area, text: phrase.replace(/^,?\s*(and )?/, "").trim() });
    return "";
  });
  const tokens = splitList(text.replace(/^(Areas|Area)\s+/i, "")).map((item) => item.replace(/^(Areas|Area)\s+/i, ""));
  const { areas } = expandAreaList(tokens, ordered);
  return { areas, partial, caveats, statedAs: cell.replace(/\n/g, " ").replace(/\s+/g, " ").trim() };
}

/* ── Seasons ────────────────────────────────────────────────────────────── */

const MONTH_ABBREVIATIONS = {
  "jan.": 1, "feb.": 2, "mar.": 3, "apr.": 4, "may": 5, "jun.": 6, "june": 6,
  "jul.": 7, "july": 7, "aug.": 8, "sept.": 9, "sep.": 9, "oct.": 10, "nov.": 11, "dec.": 12,
};

function anchor(text) {
  const last = /^the last day of (february|[a-z]+)( of the following year)?$/i.exec(text);
  if (last) {
    const month = MONTH_NAMES[last[1].toLowerCase()];
    if (!month) throw new Error(`Unreadable season anchor "${text}"`);
    return { anchor: { month, lastDay: true }, following: Boolean(last[2]) };
  }
  const plain = /^([A-Za-z]+\.?) (\d{1,2})$/.exec(text);
  const month = plain && MONTH_ABBREVIATIONS[plain[1].toLowerCase()];
  const day = plain && Number(plain[2]);
  if (!month || !(day >= 1 && day <= 31)) throw new Error(`Unreadable season anchor "${text}"`);
  return { anchor: { month, day }, following: false };
}

/**
 * One cell of open-season dates: one window per line.
 *
 *   "Aug. 31 – Sept. 20\nOct. 12 – Nov. 8"
 *   "Sept. 1 – The last day of February of the following year"
 */
export function parseSeasonCell(text) {
  const windows = [];
  for (const line of text.split("\n")) {
    const match = /^(.+?)\s+[–-]\s+(.+)$/.exec(line.trim());
    if (!match) throw new Error(`Unreadable season "${line}"`);
    const opens = anchor(match[1].trim());
    const closes = anchor(match[2].trim());
    windows.push({ opens: opens.anchor, closes: closes.anchor, statedAs: line.trim(), followingYear: closes.following });
  }
  if (!windows.length) throw new Error("Empty season cell");
  return windows;
}

/* ── Equipment ──────────────────────────────────────────────────────────── */

/**
 * The regulation's equipment words and what each permits, from its own
 * definitions. "Archery" (s. 3.3) is a long, recurved or compound bow and does
 * NOT include a crossbow; "all equipment" (s. 3.4) does. Crossbow is therefore
 * its own method here: collapsing it into "bow" would open archery seasons to
 * crossbows that the regulation keeps out of them (s. 29.1 permits a crossbow
 * under an archery licence only with a disabled crossbow permit).
 */
export const EQUIPMENT = {
  Archery: { methods: ["BOW"], label: "Archery", definedIn: "s. 3.3" },
  "Muzzleloader and Crossbow": { methods: ["MUZZLELOADER", "CROSSBOW"], label: "Muzzleloader and crossbow", definedIn: "Schedule B" },
  "All equipment": { methods: ["RIFLE", "SHOTGUN", "MUZZLELOADER", "CROSSBOW", "BOW"], label: "All equipment", definedIn: "s. 3.4" },
  "Shotgun and Muzzleloader": { methods: ["SHOTGUN", "MUZZLELOADER"], label: "Shotgun and muzzleloader", definedIn: "Schedule B" },
};

export function parseEquipment(text) {
  const entry = EQUIPMENT[text.trim()];
  if (!entry) throw new Error(`Unrecognised equipment "${text}"`);
  return entry;
}

/* ── Limits ─────────────────────────────────────────────────────────────── */

/** Schedule A's "6 (Possession 12)". */
export function parseBirdLimit(text) {
  const match = /^(\d+) \(Possession (\d+)\)$/.exec(text.replace(/\s+/g, " ").trim());
  if (!match) throw new Error(`Unreadable bag limit "${text}"`);
  return { daily: Number(match[1]), possession: Number(match[2]), statedAs: text.replace(/\s+/g, " ").trim() };
}

/* ── Body text ──────────────────────────────────────────────────────────── */

/**
 * Assert that a provision still reads exactly as encoded.
 *
 * Body provisions — equipment definitions, licence prerequisites, bag limits,
 * the moose- and elk-season restriction on deer hunters — are written into
 * rules as conditions. If the sentence is amended, the condition may be wrong,
 * so a missing sentence stops the build rather than leaving stale law in place.
 */
export function requireProvision(body, sentence, section) {
  const normalised = body.replace(/\s+/g, " ");
  if (!normalised.includes(sentence)) {
    throw new Error(`${section} no longer reads "${sentence.slice(0, 90)}…"; review before rebuilding`);
  }
  return { section, text: sentence };
}

/** Section 10.3: the areas where a deer hunter needs a moose or elk licence. */
export function section10_3(body) {
  const text = body.replace(/\s+/g, " ");
  const moose = /\(a\) in areas ([\dA-Z, ]+?) and (\d+[A-Z]?) during a moose season, unless the person holds a valid Manitoba resident draw general moose licence for that area with an unused tag;/.exec(text);
  const elk = /\(b\) in areas (\d+[A-Z]?) and (\d+[A-Z]?) during an elk season, unless the person holds a valid Manitoba resident draw archery elk licence for that area with an unused tag\./.exec(text);
  if (!moose || !elk) throw new Error("Section 10.3 no longer reads as encoded; review before rebuilding");
  return {
    moose: [...moose[1].split(",").map((item) => item.trim()), moose[2]],
    elk: [elk[1], elk[2]],
  };
}

/** The GHA list on the province's CWD page: "This includes the areas of … and 35A". */
export function cwdAreasFromPage(html) {
  const text = decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
  const match = /mandatory surveillance zone \. This includes the areas of Game Hunting Areas \(GHAs\) ([\dA-Z, ]+?),? and (\d+[A-Z]?)\b/.exec(text) ??
    /This includes the areas of Game Hunting Areas \(GHAs\) ([\dA-Z, ]+?),? and (\d+[A-Z]?)\b/.exec(text);
  if (!match) throw new Error("The CWD page no longer lists the mandatory surveillance GHAs as encoded");
  const areas = [...match[1].split(",").map((item) => item.trim()).filter(Boolean), match[2]];
  const statement = /By law, licenced hunters are required to submit biological samples ([^.]+)\./.exec(text);
  if (!statement) throw new Error("The CWD page no longer states the mandatory sampling requirement as encoded");
  return { areas, statement: `By law, licenced hunters are required to submit biological samples ${statement[1]}.` };
}

/* ── Restrictions on overlapping land ───────────────────────────────────── */

/**
 * What a published land restriction affects, as explicit tokens.
 *
 * Manitoba's wildlife-lands and lands-closed layers carry the authority's own
 * restriction text for each refuge, WMA, park and closed area. Each sentence is
 * matched against a closed list of the forms it is written in. A sentence that
 * matches none is returned as UNCLASSIFIED, and a restriction with anything
 * unclassified affects every species — the conservative reading, because an
 * unread restriction may be the one that closes the hunt.
 *
 * Tokens name what is prohibited ("upland_game_bird", "deer", "all") or how
 * ("firearm", "centrefire_rifle"). Which tokens reach a species is the
 * vocabulary's decision, not this parser's.
 */
const CLASS_WORDS = [
  [/^(?:any )?wildlife$/, "wildlife"],
  [/^an? upland game bird$/, "upland_game_bird"],
  [/^an? game bird$/, "game_bird"],
  [/^an? wild turkey$/, "wild_turkey"],
  [/^an? migratory (?:game )?bird$|^migratory game birds$|^any species of goose$|^waterfowl$/, "migratory_game_bird"],
  [/^(?:an? )?big game animal other than white-tailed deer$/, "big_game_except_white_tailed_deer"],
  [/^(?:an? )?big game animal$/, "big_game"],
  [/^an? fur ?bearing animal$/, "furbearer"],
  [/^an? moose$/, "moose"],
  [/^an? black bear$/, "black_bear"],
  [/^an? deer$|^deer$/, "deer"],
  [/^elk$/, "elk"],
  [/^upland game bird$/, "upland_game_bird"],
  [/^wild turkey$/, "wild_turkey"],
  [/^black bear$/, "black_bear"],
  [/^an? muskrat$/, "muskrat"],
  [/^an? garter snake$/, "garter_snake"],
];

function classesIn(list) {
  const items = list
    .replace(/,? as per the Manitoba Wildlife Act\.?$/i, "")
    .replace(/ (?:in|within) (?:Riding Mountain National Park|Wapusk National Park|Birds Hill Provincial Park|Beaudry Provincial Park)\b.*$/i, "")
    .replace(/, except a furbearing animal or gray \(timber\) wolf by trapping$/i, "")
    .split(/,\s*(?:or |and )?|\s+or\s+|\s+and\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const tokens = [];
  for (const item of items) {
    const match = CLASS_WORDS.find(([pattern]) => pattern.test(item));
    if (!match) return null;
    tokens.push(match[1]);
  }
  return tokens.length ? tokens : null;
}

/** Sentences that restrict something other than hunting: recorded, never a hunting effect. */
const NOT_ABOUT_HUNTING = [
  /^national parks have special regulations/i,
  /^for more information, contact/i,
  /^camp during/i,
  /^bring or allow an animal/i,
  /^no person shall engage in angling/i,
  /^no person shall operate an off-road vehicle/i,
  /^no person, except the lawful occupant of the land which constitutes the refuge, shall use a vehicle/i,
  /^trapping:$/i,
  /^no person shall:$/i,
];

function classifySentence(raw) {
  const sentence = raw.replace(/^-/, "").replace(/[,;]?\s*(?:or)?$/i, "").trim();
  if (NOT_ABOUT_HUNTING.some((pattern) => pattern.test(sentence))) return { tokens: [] };
  let match;
  if (/^hunting is prohibited$/i.test(sentence)) return { tokens: ["all"] };
  /* Whether an order is in effect is not published with the layer, so being in
     the area may itself be prohibited: every hunt there is affected. */
  if (/^no person shall enter or be in a special conservation area during the period when an order or notice of closure is in effect$/i.test(sentence)) {
    return { tokens: ["entry_closure_order"] };
  }
  if (/ is closed to all hunting$/i.test(sentence)) return { tokens: ["all"] };
  if ((match = /^CFB Shilo is excluded from (.+?) hunting seasons in GHA \d+[A-Z]?/i.exec(sentence))) {
    const tokens = classesIn(match[1]);
    return tokens ? { tokens } : { unclassified: raw };
  }
  if ((match = /^area is excluded from the GHA [\dA-Z ,and]+ (?:fall )?(?:archery and )?(?:draw general \(rifle\) )?(moose|elk) season$/i.exec(sentence))) {
    return { tokens: [match[1].toLowerCase()] };
  }
  if ((match = /^no licenced (elk|caribou) hunting\b/i.exec(sentence))) return { tokens: [match[1].toLowerCase()] };
  if (/^resident draw elk licences may only be used/i.test(sentence)) return { tokens: ["elk"] };
  if (/^no person shall hunt with a rifle requiring a centrefire cartridge$/i.test(sentence)) return { tokens: ["centrefire_rifle"] };
  if ((match = /^no person shall discharge a firearm or bow while hunting (.+)$/i.exec(sentence))) {
    const tokens = classesIn(match[1]);
    return tokens ? { tokens } : { unclassified: raw };
  }
  if (/^(?:no person shall )?possess a firearm, unless the person is in a\s+vehicle on a developed road/i.test(sentence)) return { tokens: ["firearm"] };
  if (/^no person shall possess a firearm, unless the person is hunting big game or game birds under the authority of a licence/i.test(sentence)) {
    return { tokens: [] };
  }
  if (/^a person may only possess a loaded firearm if they are trapping fur bearing animals or hunting big game under the authority of a licence/i.test(sentence)) {
    return { tokens: ["firearm_unless_big_game_or_trapping"] };
  }
  if ((match = /^no person shall hunt, take, kill, capture, retrieve or possess (.+?), or possess(?: or discharge)? a loaded firearm$/i.exec(sentence))) {
    const tokens = classesIn(match[1]);
    return tokens ? { tokens: [...tokens, "firearm"] } : { unclassified: raw };
  }
  if ((match = /^(?:no person shall )?(?:hunt|trap)(?:(?:,| or)\s*(?:take|kill|capture|retrieve|possess|trap|shoot|or))*(?:,? or)? (?:kill|shoot|possess|capture) (.+)$/i.exec(sentence)) ||
      (match = /^(?:no person shall )?hunt or kill (.+)$/i.exec(sentence)) ||
      (match = /^(?:no person shall )?trap (.+)$/i.exec(sentence)) ||
      (match = /^in township \d+, range \d+ (?:east|west) and being [^,]+, no person shall hunt, take, kill, capture or possess (.+)$/i.exec(sentence))) {
    const tokens = classesIn(match[1]);
    return tokens ? { tokens } : { unclassified: raw };
  }
  if ((match = /^no person shall trap or shoot (.+)$/i.exec(sentence))) {
    const tokens = classesIn(match[1]);
    return tokens ? { tokens } : { unclassified: raw };
  }
  return { unclassified: raw };
}

export function classifyRestriction(text) {
  const sentences = decodeEntities(String(text ?? ""))
    .split(/<br\s*\/?>|\n/i)
    .flatMap((line) => line.replace(/<[^>]+>/g, "").split(/(?<=\.)\s+(?=[A-Z])/))
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const tokens = new Set();
  const unclassified = [];
  for (const sentence of sentences) {
    const result = classifySentence(sentence.replace(/\.$/, ""));
    if (result.unclassified) unclassified.push(sentence);
    for (const token of result.tokens ?? []) tokens.add(token);
  }
  return { tokens: [...tokens].sort(), unclassified };
}

/** Game bird hunting zones, M.R. 220/86 s. 1.1, checked sentence by sentence. */
export function gameBirdZones(body) {
  const text = body.replace(/\s+/g, " ");
  /* The degree signs are superscript markup on the page and do not survive as
     text; the numbers do, and they are what is encoded. */
  const zone1 = "All that portion of the province lying north of the 57th parallel of north latitude and that part lying east of the meridian of 94 west longitude and north of the parallel of 56 north latitude;";
  const zone2 = "commencing at the intersection of the boundary between Manitoba and Saskatchewan and the 53rd parallel; thence east along the said parallel to the east shore of Lake Winnipegosis; thence southeasterly following the sinuosities of the east shoreline of the said lake to the north limit of Township 43; thence east along the north limit of the said township to the boundary between Manitoba and Ontario;";
  const zone3 = "All that portion of the province lying between game bird hunting zone 2 and game bird hunting zone 4;";
  const zone4 = /All that portion of the province that lies within game hunting areas ([\dA-Z, ]+?) and (\d+[A-Z]?)\./.exec(text);
  for (const [sentence, name] of [[zone1, "zone 1"], [zone2, "zone 2"], [zone3, "zone 3"]]) {
    if (!text.includes(sentence)) throw new Error(`M.R. 220/86 s. 1.1 ${name} no longer reads as encoded; review before rebuilding`);
  }
  if (!zone4) throw new Error("M.R. 220/86 s. 1.1 zone 4 no longer reads as encoded");
  return {
    zone1: { statedAs: zone1, northOfLatitude: 57, eastOfLongitude: -94, andNorthOfLatitude: 56 },
    zone2Line: { statedAs: zone2 },
    zone3: { statedAs: zone3 },
    zone4Areas: [...zone4[1].split(",").map((item) => item.trim()), zone4[2]],
  };
}
