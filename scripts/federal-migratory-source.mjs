/**
 * Reading the Migratory Birds Regulations, 2022 (SOR/2022-105).
 *
 * The open seasons are the law's own tables. Schedule 3, "Open Seasons, Limits
 * and Special Measures", carries a Part per province and territory, and
 * s. 28(1) binds to it directly: a person must not hunt a species of migratory
 * game bird in an area referred to in Schedule 3 except during an open season
 * for that area and species. Columns are Area, Species, Possession Limit, Open
 * Season and Daily Bag Limit.
 *
 * This is the binding text, not the annual summary. Environment and Climate
 * Change Canada's district boundary layer is separately published as Draft with
 * no legal value, and is NOT read here: the areas below are the regulation's
 * own definitions, most of which are named sets of PROVINCIAL units North
 * Ground already holds parity-certified.
 *
 * Nothing here decides a season. It reads cells and refuses what it cannot read
 * exactly.
 */

import { createHash } from "node:crypto";

export const MBR_URL = "https://laws-lois.justice.gc.ca/eng/regulations/SOR-2022-105/FullText.html";
export const MBR_CITATION = "Migratory Birds Regulations, 2022, SOR/2022-105";

/** Schedule 3's Parts, in the regulation's own order. */
export const MBR_PARTS = [
  [1, "Newfoundland and Labrador", "jurisdiction:ca-nl"],
  [2, "Prince Edward Island", "jurisdiction:ca-pe"],
  [3, "Nova Scotia", "jurisdiction:ca-ns"],
  [4, "New Brunswick", "jurisdiction:ca-nb"],
  [5, "Quebec", "jurisdiction:ca-qc"],
  [6, "Ontario", "jurisdiction:ca-on"],
  [7, "Manitoba", "jurisdiction:ca-mb"],
  [8, "Saskatchewan", "jurisdiction:ca-sk"],
  [9, "Alberta", "jurisdiction:ca-ab"],
  [10, "British Columbia", "jurisdiction:ca-bc"],
  [11, "Northwest Territories", "jurisdiction:ca-nt"],
  [12, "Yukon", "jurisdiction:ca-yt"],
  [13, "Nunavut", "jurisdiction:ca-nu"],
];

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const sha256 = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”",
  ndash: "–", mdash: "—", deg: "°", prime: "′",
};

export function decode(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}

/** Cell text with its list labels kept: "(a) Ducks", "(i) Sept. 1 to Sept. 15". */
export const cellText = (html) => decode(
  html
    .replace(/<span class="tablelabel">([^<]*)<\/span>/g, "$1 ")
    .replace(/<\/(li|p|div)>/g, " ␟ ")
    .replace(/<[^>]+>/g, " "),
)
  .replace(/\s*␟\s*/g, "␟")
  .replace(/[ \t ]+/g, " ")
  .replace(/␟+$/, "")
  .trim();

/** A cell's list items, where the regulation numbers sub-periods (i), (ii). */
export const cellItems = (html) => cellText(html).split("␟").map((part) => part.trim()).filter(Boolean);

/**
 * One HTML table to a grid, honouring rowspan and colspan.
 *
 * The Area cell spans every species row beneath it, so a naive row read would
 * attach each species to the wrong area — or to none. Refusing is not enough
 * here: a shifted column reads as a real answer.
 */
export function parseTable(tableHtml) {
  const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((match) => match[1]);
  const grid = [];
  const carry = new Map(); // column index -> { html, rowsLeft }
  for (const row of rows) {
    const cells = [...row.matchAll(/<(t[hd])([^>]*)>([\s\S]*?)<\/\1>/g)];
    const out = [];
    let column = 0;
    const place = (html, rowSpan, colSpan) => {
      for (let n = 0; n < colSpan; n += 1) {
        while (carry.has(column)) {
          const held = carry.get(column);
          out[column] = held.html;
          held.rowsLeft -= 1;
          if (held.rowsLeft <= 0) carry.delete(column);
          column += 1;
        }
        out[column] = html;
        if (rowSpan > 1) carry.set(column, { html, rowsLeft: rowSpan - 1 });
        column += 1;
      }
    };
    for (const [, , attributes, html] of cells) {
      const rowSpan = Number(/rowspan="(\d+)"/.exec(attributes)?.[1] ?? 1);
      const colSpan = Number(/colspan="(\d+)"/.exec(attributes)?.[1] ?? 1);
      place(html, rowSpan, colSpan);
    }
    /* Trailing carried cells, after the row's own cells are exhausted. */
    while (carry.has(column)) {
      const held = carry.get(column);
      out[column] = held.html;
      held.rowsLeft -= 1;
      if (held.rowsLeft <= 0) carry.delete(column);
      column += 1;
    }
    grid.push(out);
  }
  return grid;
}

/** Schedule 3's slice of the document, and every Part inside it. */
export function scheduleThree(html) {
  const marker = html.indexOf("Open Seasons, Limits and Special Measures", 60_000);
  if (marker < 0) throw new Error("Schedule 3 not found; the regulation's structure has changed");
  return html.slice(marker);
}

/** The HTML of one Part of Schedule 3, from its heading to the next Part's. */
export function partHtml(scheduleHtml, number, name) {
  /* The heading splits its label and title across spans:
     <h3><span class="HLabel1">PART 2</span><span class="HTitleText1">Prince
     Edward Island</span></h3>. Matched structurally rather than by flattened
     text, so a Part whose title changes is a loud failure, not a silent one. */
  const heading = new RegExp(
    `<h[2-6][^>]*>\\s*<span[^>]*>\\s*PART\\s*${number}\\s*</span>\\s*<span[^>]*>\\s*${escapeRegExp(name)}\\s*</span>`,
    "i",
  );
  const start = scheduleHtml.search(heading);
  if (start < 0) throw new Error(`Schedule 3 Part ${number} (${name}) not found`);
  const after = scheduleHtml.slice(start + 1);
  /* Same structure for the NEXT Part's heading. Getting this wrong does not
     fail — it silently returns every following province's tables too, which is
     exactly how a Part's rules would be attributed to the wrong jurisdiction. */
  const next = after.search(/<h[2-6][^>]*>\s*<span[^>]*>\s*PART\s*\d+\s*<\/span>/i);
  return next < 0 ? scheduleHtml.slice(start) : scheduleHtml.slice(start, start + 1 + next);
}

/** Every table in one Part, as grids, with its caption. */
export function partTables(html) {
  return [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)].map((match) => {
    const before = html.slice(0, match.index);
    const caption = /TABLE\s*(\d+)[^<]*/i.exec(cellText(before.slice(-400)))?.[0]?.trim() ?? "";
    return { caption, grid: parseTable(match[1]) };
  });
}
