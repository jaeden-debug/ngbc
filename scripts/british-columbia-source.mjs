/**
 * Reading British Columbia's Hunting Regulation, B.C. Reg. 190/84.
 *
 * The open seasons are the law's own tables: Schedules 1 to 8 (one per region),
 * published by BC Laws as HTML with real table cells. Part 1 of each schedule
 * lists open seasons and bag limits; an open season marked "**" is subject to
 * that schedule's Part 2 (s. 6), and a bag limit marked "***" to its Part 3
 * (s. 7). The 2026-2028 Hunting and Trapping Regulations Synopsis is a summary
 * and is used only as a cross-check.
 *
 * Nothing here decides a season. It reads rows, expands Management Unit
 * references against the certified unit inventory, and parses dates, and it
 * refuses anything it cannot read exactly.
 */

import { createHash } from "node:crypto";

export const BC_TIME_ZONE = "America/Vancouver";
export const BC_LAWS = "https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg";

/** Schedules 1–8 of B.C. Reg. 190/84, by region, and the regulation's body. */
export const BC_DOCUMENTS = {
  body: { id: "190_84_01", title: "Hunting Regulation, B.C. Reg. 190/84 (sections 1 to 19)" },
  1: { id: "190_84_02", title: "Hunting Regulation, Schedule 1 — Region 1 (Vancouver Island)" },
  2: { id: "190_84_03", title: "Hunting Regulation, Schedule 2 — Region 2 (Lower Mainland)" },
  3: { id: "190_84_04", title: "Hunting Regulation, Schedule 3 — Region 3 (Thompson)" },
  4: { id: "190_84_05", title: "Hunting Regulation, Schedule 4 — Region 4 (Kootenay)" },
  5: { id: "190_84_06", title: "Hunting Regulation, Schedule 5 — Region 5 (Cariboo)" },
  6: { id: "190_84_07", title: "Hunting Regulation, Schedule 6 — Region 6 (Skeena)" },
  7: { id: "190_84_08", title: "Hunting Regulation, Schedule 7 — Region 7 (Omineca-Peace)" },
  8: { id: "190_84_09", title: "Hunting Regulation, Schedule 8 — Region 8 (Okanagan)" },
};

export const BC_SYNOPSIS_URL =
  "https://www2.gov.bc.ca/assets/gov/sports-recreation-arts-and-culture/outdoor-recreation/fishing-and-hunting/hunting/regulations/hunting-trapping-synopsis.pdf";

export const sha256 = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—" };
export function decode(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}
export const clean = (html) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** The "current to" date BC Laws states for a consolidation. */
export function consolidationDate(html) {
  const match = /current to ([A-Z][a-z]+ \d{1,2}, \d{4})/.exec(clean(html));
  if (!match) throw new Error("BC Laws page states no consolidation date");
  return match[1];
}

/**
 * Part 1 rows of a schedule: Item, Species, Management Units, Open Season, Bag
 * Limit. A table whose header is anything else is not Part 1.
 */
export function partOneRows(html, schedule) {
  const tables = html.match(/<table[\s\S]*?<\/table>/g) ?? [];
  const rows = [];
  for (const table of tables) {
    const trs = table.match(/<tr[\s\S]*?<\/tr>/g) ?? [];
    const cells = trs.map((tr) => [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((cell) => clean(cell[1])));
    const header = cells.find((row) => row[0] === "Item");
    if (!header) continue;
    if (header.join("|") !== "Item|Species|Management Units|Open Season|Bag Limit") {
      throw new Error(`Schedule ${schedule}: unexpected Part 1 header ${header.join("|")}`);
    }
    for (const row of cells) {
      if (row[0] === "Item") continue;
      if (row.length === 2 && /^Repealed/.test(row[1])) continue;
      if (row.length !== 5) {
        if (row.some((cell) => /Repealed/.test(cell))) continue;
        throw new Error(`Schedule ${schedule}: a Part 1 row with ${row.length} cells: ${row.join(" | ")}`);
      }
      const [item, species, units, season, bag] = row;
      if (!/^\d+(\.\d+)?$/.test(item)) throw new Error(`Schedule ${schedule}: unreadable item "${item}"`);
      rows.push({ schedule, item, species, units, season, bag });
    }
  }
  if (!rows.length) throw new Error(`Schedule ${schedule}: no Part 1 rows found`);
  return rows;
}

/** A schedule's Part 2 or Part 3 as plain text, for quoting and verification. */
export function schedulePart(html, part) {
  const text = decode(html.replace(/<table[\s\S]*?<\/table>/g, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
  const start = text.indexOf(`Part ${part} —`);
  if (start < 0) throw new Error(`No Part ${part} heading`);
  const next = text.indexOf(`Part ${part + 1} —`, start + 1);
  const end = next > 0 ? next : text.indexOf("Contents", start);
  return text.slice(start, end > 0 ? end : undefined).trim();
}

/** Whitespace-insensitive "does this passage appear verbatim in the source". */
export function containsVerbatim(haystack, passage) {
  const flat = (value) => value.replace(/\s+/g, " ").replace(/\s+([,.;:)])/g, "$1").trim();
  return flat(haystack).includes(flat(passage));
}

/**
 * Expand a Management Unit reference ("3-12 to 3-20, 3-26 to 3-44**",
 * "3-30**, 3-31") against the certified inventory. A range is every published
 * unit of that region numbered within it; a unit that does not exist aborts.
 * "**" after the last token restricts the whole entry; after an inner token,
 * only that unit.
 */
export function expandUnits(spec, inventory) {
  const known = new Set(inventory);
  const parts = spec.replace(/\s+and\s+/g, ", ").split(/\s*[,;]\s*/).filter(Boolean);
  const units = [];
  const restricted = new Set();
  let wholeRestricted = false;
  parts.forEach((raw, index) => {
    const marked = /\*\*$/.test(raw);
    const token = raw.replace(/\*+$/, "").trim();
    const range = /^([1-8])-(\d{1,2})\s+to\s+([1-8])-(\d{1,2})$/.exec(token);
    const single = /^([1-8])-(\d{1,2})$/.exec(token);
    let expanded;
    if (range) {
      const [, r1, a, r2, b] = range;
      if (r1 !== r2) throw new Error(`A range across regions: "${token}"`);
      expanded = inventory.filter((unit) => {
        const [region, number] = unit.split("-").map(Number);
        return region === Number(r1) && number >= Number(a) && number <= Number(b);
      });
      for (const end of [`${r1}-${Number(a)}`, `${r2}-${Number(b)}`]) {
        if (!known.has(end)) throw new Error(`Range "${token}" ends at ${end}, which is not a Management Unit`);
      }
    } else if (single) {
      const unit = `${single[1]}-${Number(single[2])}`;
      if (!known.has(unit)) throw new Error(`"${token}" is not a Management Unit`);
      expanded = [unit];
    } else {
      throw new Error(`Unreadable Management Unit reference "${raw}" in "${spec}"`);
    }
    units.push(...expanded);
    if (marked) {
      if (index === parts.length - 1 && parts.length > 1) wholeRestricted = true;
      else if (parts.length === 1) wholeRestricted = true;
      else for (const unit of expanded) restricted.add(unit);
    }
  });
  return { units: [...new Set(units)], restrictedUnits: wholeRestricted ? [...new Set(units)] : [...restricted], wholeRestricted };
}

const MONTHS = { "Jan.": 1, "Feb.": 2, "Mar.": 3, "Apr.": 4, "May": 5, "June": 6, "July": 7, "Aug.": 8, "Sept.": 9, "Oct.": 10, "Nov.": 11, "Dec.": 12 };
const MONTH = "(Jan\\.|Feb\\.|Mar\\.|Apr\\.|May|June|July|Aug\\.|Sept\\.|Oct\\.|Nov\\.|Dec\\.)";

/** "Sept. 10 to Dec. 10 Apr. 1 to June 15" → month/day ranges, in the order stated. */
export function parseSeasons(text) {
  const pattern = new RegExp(`${MONTH}\\s*(\\d{1,2})\\s+to\\s+${MONTH}\\s*(\\d{1,2})`, "g");
  const ranges = [...text.matchAll(pattern)].map(([statedAs, m1, d1, m2, d2]) => ({
    from: [MONTHS[m1], Number(d1)], to: [MONTHS[m2], Number(d2)], statedAs: statedAs.replace(/\s+/g, " "),
  }));
  const rest = text.replace(pattern, "").replace(/\*+/g, "").trim();
  if (!ranges.length || rest) throw new Error(`Unreadable open season "${text}"`);
  return ranges;
}

const iso = (year, [month, day]) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/** Concrete windows of a month/day range that overlap a certified period. */
export function windowsIn(range, period) {
  const crosses = range.to[0] < range.from[0] || (range.to[0] === range.from[0] && range.to[1] < range.from[1]);
  const windows = [];
  for (const year of [Number(period.from.slice(0, 4)) - 1, Number(period.from.slice(0, 4)), Number(period.from.slice(0, 4)) + 1]) {
    const opensIso = iso(year, range.from);
    const closesIso = iso(crosses ? year + 1 : year, range.to);
    if (closesIso >= period.from && opensIso <= period.to) windows.push({ opensIso, closesIso, statedAs: range.statedAs });
  }
  return windows;
}

/** "5(15)", "10 per day", "2", "10(30)***", "NBL". */
export function parseBag(text) {
  const bare = text.replace(/\*+/g, "").trim();
  const partThree = /\*\*\*/.test(text) && !/\*\*\*\*/.test(text);
  const partTwo = /(^|[^*])\*\*$/.test(text.trim());
  let match;
  if ((match = /^(\d+)\s*\((\d+)\)$/.exec(bare))) return { daily: Number(match[1]), possession: Number(match[2]), statedAs: bare, partThree, partTwo };
  if ((match = /^(\d+) per day$/.exec(bare))) return { daily: Number(match[1]), statedAs: bare, partThree, partTwo };
  if ((match = /^(\d+)$/.exec(bare))) return { bag: Number(match[1]), statedAs: bare, partThree, partTwo };
  if (bare === "NBL") return { statedAs: "No bag limit", partThree, partTwo };
  throw new Error(`Unreadable bag limit "${text}"`);
}
