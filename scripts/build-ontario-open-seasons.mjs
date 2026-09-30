/**
 * ONTARIO'S OPEN SEASONS, FROM THE INSTRUMENT THAT PRESCRIBES THEM.
 *
 * The certified bundle carried Ontario's seasons as the regulations summary
 * prints them — "September 19 to December 15", with no year — so 119 of 135
 * major-game rules had no window anything could evaluate. A guide's derivation
 * is not the law, and a yearless string is not a window.
 *
 * O. Reg. 670/98 (Open Seasons — Wildlife) prescribes them, and it prints no
 * dates at all:
 *
 *   Table 5, item 1: "From September 1 to the Friday preceding the Saturday
 *   closest to October 8, IN ANY YEAR."
 *
 * So this reads the tables and stores BOTH FORMS — the authority's rule and the
 * date it produces for a stated year — which is what Nova Scotia's bundle
 * already does and what §41A requires: the rule survives the year and the date
 * stays checkable. Every derived date is certified for the year named in
 * `derivedForYear` and for no other.
 *
 * FOUR ASYMMETRIES BETWEEN THE TABLES, EACH OF WHICH IS ITSELF A FACT.
 *
 * 1. **Deer and moose state residents and non-residents in SEPARATE columns**,
 *    and "Closed season" appears in one while the other is open. WMUs 76A–81B
 *    archery is residents-only: a non-resident asking about that hunt has a
 *    definite CLOSED, not an absence. Dropping the column would hand them the
 *    resident's answer.
 * 2. **Black bear has NO class-of-firearm column**, and O. Reg. 665/98 s. 69
 *    covers only deer, elk and moose. So bear implements are not derivable from
 *    a class; they come from the general rules, where s. 82 governs the bow.
 *    A blanket "the class number decides the implements" rule would be wrong
 *    for bear, and the ABSENCE OF THE COLUMN is what says so.
 * 3. **Wild turkey's column is "TYPE of Firearm", in words** — "Bow or Shotgun
 *    (including muzzle-loading shotgun)" — not a class number. Reading it as a
 *    class would index into s. 69's table with something that is not an index.
 * 4. **Turkey also carries a Time Limits column** the others do not
 *    ("½ hour before sunrise to 7 p.m."), which is a legal-hours fact and is
 *    carried as the authority's words rather than converted.
 *
 * WHAT IT REFUSES. An area cell naming anything but WMUs — a township, a named
 * park, "All areas" — is refused with its text, because resolving it needs
 * O. Reg. 663/98's area descriptions and guessing would put a season on ground
 * the authority did not name. A season cell that does not parse whole is
 * refused with its text. Refusals are counted, written into the artifact and
 * printed; they are never thinned.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CACHE = join(ROOT, ".cache", "on-seasons");
/*
 * `extracted/`, not `content/regulatory/` itself. Eight readers glob that
 * directory non-recursively and treat what they find as certified serving
 * coverage; writing here made the readiness report drop RESOLVED dimensions
 * for four species AND claim elk as covered when nothing serves it. See the
 * directory's README. It moves up a level on the day it is wired in.
 */
const OUTPUT = join(ROOT, "content", "regulatory", "extracted", "ca-on-open-seasons-2026.json");
const DERIVED_FOR_YEAR = 2026;

const { parseRelativeWindow, resolveRelativeWindow } = await import("../src/lib/hunt/regulatory/relative-date.ts");

/*
 * §44's three rights, recorded separately because they are three questions.
 * North Ground reads these regulations live and derives structured facts from
 * them; it does NOT hold a permitted archival copy, so no source here claims a
 * snapshot hash. That distinction is why the build's own hash is named
 * `extraction` below rather than `contentHash`: a bundle-level content hash
 * asserts a permitted copy exists to verify against, and asserting one we do
 * not hold is an unearned trust signal.
 */
const RIGHTS = {
  accessState: "PUBLIC_READABLE",
  reuseState: "UNSTATED",
  archiveState: "NOT_ESTABLISHED",
  derivedFactsState: "USABLE",
  authorityLevel: "PRIMARY_GOVERNMENT",
  retrievalMethod: "OFFICIAL_HTML",
};

const SOURCES = {
  openSeasons: {
    id: "source:ca-on-oreg-670-98",
    authority: "Government of Ontario",
    title: "O. Reg. 670/98: Open Seasons — Wildlife, under the Fish and Wildlife Conservation Act, 1997",
    url: "https://www.ontario.ca/laws/regulation/980670",
    ...RIGHTS,
  },
  hunting: {
    id: "source:ca-on-oreg-665-98",
    authority: "Government of Ontario",
    title: "O. Reg. 665/98: Hunting, under the Fish and Wildlife Conservation Act, 1997",
    url: "https://www.ontario.ca/laws/regulation/980665",
    ...RIGHTS,
  },
};

/**
 * The classes of firearm, from O. Reg. 665/98 s. 69's own Table.
 *
 * s. 69 prescribes these "as the classes of firearm that a person may use or
 * carry to hunt DEER, ELK OR MOOSE" — which is why bear is not here — and
 * O. Reg. 670/98 s. 6 is what sends a table's class number to them.
 *
 * "Bow" expands to BOW and CROSSBOW because s. 82 says a bow used for big game
 * must be "a crossbow or long-bow". The expansion lives here, once, where the
 * class is defined: typing the resulting list at each row would be a second
 * home for a fact the instrument already computes.
 */
const BOWS = ["BOW", "CROSSBOW"];
const FIREARM_CLASSES = {
  1: { content: "Bow", species: ["deer", "elk", "moose"], implements: [...BOWS] },
  2: { content: "Bow, or muzzle-loading gun", species: ["deer", "elk", "moose"], implements: [...BOWS, "MUZZLELOADER"] },
  3: { content: "Bow, shotgun, or muzzle-loading gun", species: ["deer"], implements: [...BOWS, "SHOTGUN", "MUZZLELOADER"] },
  4: { content: "Rifle, shotgun, or muzzle-loading gun", species: ["deer", "elk", "moose"], implements: ["RIFLE", "SHOTGUN", "MUZZLELOADER"] },
  5: { content: "Muzzle-loading gun", species: ["deer"], implements: ["MUZZLELOADER"] },
  6: { content: "Shotgun, or muzzle-loading gun", species: ["deer"], implements: ["SHOTGUN", "MUZZLELOADER"] },
  7: { content: "Bow, rifle, shotgun, or muzzle-loading gun", species: ["deer", "elk", "moose"], implements: [...BOWS, "RIFLE", "SHOTGUN", "MUZZLELOADER"] },
};

/** Each table this reads, and the shape its rows actually have. */
const TABLES = [
  { heading: "Table 1 American Elk", speciesId: "species:elk", table: "Table 1", columns: ["AREA", "SEASON_BOTH", "CLASS"] },
  { heading: "table 2 black bear", speciesId: "species:american-black-bear", table: "Table 2", columns: ["AREA", "SEASON_BOTH"] },
  { heading: "Table 5 Deer", speciesId: "species:white-tailed-deer", table: "Table 5", columns: ["AREA", "SEASON_RESIDENT", "SEASON_NON_RESIDENT", "CLASS"] },
  { heading: "Table 7.2 Wild Turkey", speciesId: "species:wild-turkey", table: "Table 7.2", columns: ["AREA", "SEASON_BOTH", "TIME_LIMITS", "FIREARM_TYPE_WORDS"] },
  { heading: "Table 8 Moose", speciesId: "species:moose", table: "Table 8", columns: ["AREA", "SEASON_RESIDENT", "SEASON_NON_RESIDENT", "CLASS"] },
  { heading: "Table 10 Woodland Caribou", speciesId: "species:caribou", table: "Table 10", columns: ["AREA", "SEASON_BOTH"] },
];

const sha256 = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;

const textOf = (html) => html
  .replace(/<br\s*\/?>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&#8212;|&mdash;/g, "—").replace(/&#8211;|&ndash;/g, "–")
  .replace(/&#8217;|&rsquo;/g, "'").replace(/&nbsp;|&#160;/g, " ")
  .replace(/&#189;|&frac12;/g, "½").replace(/&amp;/g, "&")
  .replace(/\s+/g, " ").trim();

async function cachedPage(name, url, refresh) {
  const path = join(CACHE, `${name}.html`);
  if (!refresh && existsSync(path)) return readFileSync(path, "utf8");
  const response = await fetch(url, {
    headers: { "user-agent": "NorthGroundBot/1.0 (+https://northground.ca; regulatory verification)" },
  });
  if (!response.ok) throw new Error(`${url} → ${response.status}`);
  const html = await response.text();
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(path, html);
  return html;
}

/**
 * Every designation the official Ontario layer holds, as the spatial
 * certification recorded them. The regulation's spellings are resolved AGAINST
 * this rather than trusted: a designation no layer carries cannot be drawn, and
 * §8 counts deliverable answers rather than encoded records.
 */
const OFFICIAL_DESIGNATIONS = (() => {
  const units = JSON.parse(readFileSync(join(ROOT, "content/regulatory/ca-on-certified-units.json"), "utf8"));
  return new Set([...(units.certifiedUnits ?? []), ...(units.uncertifiedUnits ?? [])].map(String));
})();

/**
 * O. Reg. 670/98 s. 4, quoted because the rule is the authority's:
 *
 *   "if a wildlife management unit is referred to by whole number only, the
 *    whole number includes a reference to all of the wildlife management units
 *    referred to in Schedule 1 by that number used in combination with a
 *    letter, or a letter and another number."
 *
 * So "53" in a table means 53A and 53B, and "69" means 69A-1, 69A-2, 69A-3 and
 * 69B. Twenty-five bare numbers appear across the tables, and without this a
 * hunter standing in 53A would resolve to a zone and then be told nothing
 * applies there — the rule was encoded and could never be delivered.
 *
 * It applies ONLY to a whole number. "69A" is not one, and s. 4 does not reach
 * it: see `SPELLING_VARIANTS` for what does and does not follow from that.
 */
function sectionFourExpansion(token) {
  if (!/^\d+$/.test(token)) return null;
  const children = [...OFFICIAL_DESIGNATIONS].filter((official) => new RegExp(`^${token}[A-Z]`).test(official));
  return children.length ? children.sort() : null;
}

/**
 * Spellings that differ between the regulation and the official layer.
 *
 * The regulation writes 69A1 and 69A2; the layer writes 69A-1 and 69A-2. That
 * is punctuation, and the correspondence is one-to-one and checkable — the
 * layer holds exactly 69A-1, 69A-2 and 69A-3 and the regulation uses exactly
 * the same three numbers. So it is declared here, as a mapping, rather than
 * repaired by a general "strip the hyphens" rule that would also equate things
 * the authority keeps apart.
 *
 * WHAT IS DELIBERATELY NOT HERE: bare "69A", which Tables 2 and 5 both use.
 *
 * O. Reg. 663/98 Schedule 1 — the schedule s. 4 points to — defines exactly
 * 69A-1, 69A-2 and 69A-3 and NO bare 69A. So the designation the open-seasons
 * tables write names no unit in the schedule that describes the areas, and
 * s. 4 reaches whole numbers only. Nothing in either instrument says whether it
 * means 69A-1 alone or all three.
 *
 * The plausible reading is "all three", by analogy with s. 4 one level down.
 * Plausible is not the standard: guessing wide grants a season to two units
 * that may not have it, guessing narrow withholds it from two that do, and
 * §8 forbids filling an evidentiary gap by inference merely to reduce the
 * number of unresolved results. It stays unresolved, with the evidence named,
 * which is a question the ministry can answer and a guess is not.
 */
const SPELLING_VARIANTS = { "69A1": "69A-1", "69A2": "69A-2", "69A3": "69A-3" };

/**
 * The WMUs an area cell names, or a refusal.
 *
 * A cell is accepted only when EVERY token resolves. One township in a list of
 * fifty is enough to refuse the row: encoding the fifty and dropping the
 * township would publish a season for ground the authority described
 * differently, and silently narrow one it described more widely.
 */
export function parseAreas(cell) {
  const value = cell.replace(/\.$/, "").trim();
  const tokens = value.split(/,| and /).map((token) => token.trim()).filter(Boolean);
  if (!tokens.length) return { refused: "AREA_EMPTY" };

  const units = [];
  const expansions = [];
  for (const token of tokens) {
    if (!/^\d{1,3}[A-Z]?\d?$/.test(token)) return { refused: "AREA_NOT_ONLY_WMUS", detail: token };

    const variant = SPELLING_VARIANTS[token];
    if (variant && OFFICIAL_DESIGNATIONS.has(variant)) {
      units.push(variant);
      expansions.push({ stated: token, resolvedTo: [variant], basis: "SPELLING_VARIANT" });
      continue;
    }
    if (OFFICIAL_DESIGNATIONS.has(token)) { units.push(token); continue; }

    const children = sectionFourExpansion(token);
    if (children) {
      units.push(...children);
      expansions.push({ stated: token, resolvedTo: children, basis: "O_REG_670_98_S_4" });
      continue;
    }
    /* A designation neither the layer nor s. 4 accounts for. Naming it is the
       finding; assuming it is the finding's opposite. */
    return { refused: "AREA_DESIGNATION_UNRESOLVED", detail: token };
  }
  return { units: [...new Set(units)].sort(), expansions };
}

/**
 * The windows a season cell states, or a refusal.
 *
 * Cells join several windows with "AND:", and each is parsed whole by the same
 * grammar the federal and Nova Scotia work uses. "Closed season" is a real,
 * stated answer — never an absence — so it is its own result.
 */
export function parseSeasonCell(cell) {
  const value = cell.trim();
  if (/^closed season\.?$/i.test(value)) return { declaredNoSeason: true, statedAs: value };

  const segments = value.split(/\s*AND:\s*/).map((part) => part.trim()).filter(Boolean);
  const windows = [];
  for (const segment of segments) {
    /*
     * "From" is optional on a continuation. The cell reads "From September 1 to
     * … , in any year. AND: November 16 to November 30, in any year." — the
     * authority does not repeat the preposition after AND:, and requiring it
     * refused five real windows as unreadable.
     */
    const phrase = /^(?:From )?(.+?),? in any year\.?$/i.exec(segment);
    if (!phrase) return { refused: "SEASON_NOT_IN_ANY_YEAR_FORM", detail: segment.slice(0, 110) };
    const parsed = parseRelativeWindow(phrase[1]);
    if (!parsed) return { refused: "SEASON_UNPARSED", detail: phrase[1].slice(0, 110) };
    const resolved = resolveRelativeWindow(parsed, DERIVED_FOR_YEAR);
    if (!resolved) return { refused: "SEASON_UNRESOLVED", detail: phrase[1].slice(0, 110) };
    windows.push({
      rule: parsed.from && parsed.to ? { from: parsed.from, to: parsed.to } : null,
      crossesYear: parsed.crossesYear,
      /* The authority's own words for this window, kept verbatim. */
      statedAs: phrase[1],
      opensIso: resolved.from,
      closesIso: resolved.to,
    });
  }
  if (!windows.length) return { refused: "SEASON_EMPTY" };
  return { windows, declaredNoSeason: false, statedAs: value };
}

/** The class number a cell states, or a refusal — never a guess. */
function parseClass(cell) {
  const value = cell.trim().replace(/\.$/, "");
  if (!/^[1-7]$/.test(value)) return { refused: "CLASS_NOT_A_NUMBER", detail: value.slice(0, 40) };
  return { classNumber: Number(value) };
}

function tablesFrom(html) {
  const blocks = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map((match) => match[0]);
  const split = html.split(/<table/i);
  return blocks.map((block, index) => ({
    block,
    /* The heading sits in the markup BEFORE the table, so a table is identified
       by what introduces it rather than by its position — which moves whenever
       a revoked table is removed. */
    precededBy: textOf(split[index]).slice(-90),
  }));
}

export async function build({ refresh = false } = {}) {
  const html = await cachedPage("oreg670", SOURCES.openSeasons.url, refresh);
  const huntingHtml = await cachedPage("oreg665", SOURCES.hunting.url, refresh);
  const found = tablesFrom(html);

  const rules = [];
  const refusals = [];
  const hashedCells = [];
  let rowsRead = 0;

  for (const spec of TABLES) {
    const match = found.find((entry) => entry.precededBy.toLowerCase().includes(spec.heading.toLowerCase()));
    if (!match) {
      refusals.push({ table: spec.table, reason: "TABLE_NOT_FOUND" });
      continue;
    }
    const rows = [...match.block.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
    for (const row of rows) {
      const cells = [...row.matchAll(/<t[dh][\s\S]*?<\/t[dh]>/gi)].map((m) => textOf(m[0]));
      /* The header row names its own columns; anything whose first cell is not
         an item number is a header or a citation line, not a row. */
      const item = /^(\d+)\.$/.exec(cells[0] ?? "");
      if (!item) continue;
      if (cells.length !== spec.columns.length + 1) {
        refusals.push({ table: spec.table, item: Number(item[1]), reason: "ROW_COLUMN_COUNT", detail: `${cells.length - 1} of ${spec.columns.length}` });
        continue;
      }
      rowsRead += 1;
      /*
       * WHAT THE CONTENT HASH IS OVER, and it is not the page.
       *
       * ontario.ca serves a per-request CDN token inside a <script> block, so
       * hashing the HTML made this source read as MOVED on every run — and a
       * change detector that always fires is a detector nobody reads, which is
       * worse than not having one. The hash is over the CELLS THIS BUILD READ,
       * so a changed season, area or class moves it and a session token does
       * not. It also covers rows that were REFUSED, because a refused row
       * becoming readable is exactly the change §45 wants reviewed.
       */
      hashedCells.push(`${spec.table}#${item[1]}|${cells.slice(1).join("|")}`);

      const byColumn = Object.fromEntries(spec.columns.map((name, index) => [name, cells[index + 1]]));
      const areas = parseAreas(byColumn.AREA);
      if (areas.refused) {
        refusals.push({ table: spec.table, item: Number(item[1]), reason: areas.refused, detail: (areas.detail ?? byColumn.AREA).slice(0, 110) });
        continue;
      }

      let firearm = null;
      if (spec.columns.includes("CLASS")) {
        const parsed = parseClass(byColumn.CLASS);
        if (parsed.refused) {
          refusals.push({ table: spec.table, item: Number(item[1]), reason: parsed.refused, detail: parsed.detail });
          continue;
        }
        const klass = FIREARM_CLASSES[parsed.classNumber];
        firearm = {
          basis: "CLASS_OF_FIREARM",
          classNumber: parsed.classNumber,
          statedAs: klass.content,
          permittedImplements: klass.implements,
          sourceId: SOURCES.hunting.id,
          sourceSection: "s. 69, Table",
        };
      } else if (spec.columns.includes("FIREARM_TYPE_WORDS")) {
        /* Turkey states the types in words. They are carried as the authority's
           words and NOT mapped to implements here: the mapping would be North
           Ground's reading of prose, and §41A keeps that separate from a fact
           the instrument states as a class. */
        firearm = {
          basis: "TYPE_OF_FIREARM_STATED_IN_WORDS",
          statedAs: byColumn.FIREARM_TYPE_WORDS,
          permittedImplements: null,
          sourceId: SOURCES.openSeasons.id,
          sourceSection: `${spec.table}, Column 4`,
        };
      } else {
        /* Black bear and woodland caribou. The column does not exist, and s. 69
           does not reach these species, so no class governs their implements. */
        firearm = {
          basis: "NO_CLASS_COLUMN_IN_TABLE",
          statedAs: null,
          permittedImplements: null,
          note: "The table states no class of firearm and O. Reg. 665/98 s. 69 prescribes classes only for deer, elk and moose. Implements come from the general rules, where s. 82 governs a bow.",
          sourceId: SOURCES.openSeasons.id,
          sourceSection: `${spec.table}`,
        };
      }

      const residencies = spec.columns.includes("SEASON_RESIDENT")
        ? [["RESIDENT", byColumn.SEASON_RESIDENT], ["NON_RESIDENT", byColumn.SEASON_NON_RESIDENT]]
        : [["RESIDENT_AND_NON_RESIDENT", byColumn.SEASON_BOTH]];

      for (const [residency, cell] of residencies) {
        const season = parseSeasonCell(cell);
        if (season.refused) {
          refusals.push({ table: spec.table, item: Number(item[1]), residency, reason: season.refused, detail: season.detail });
          continue;
        }
        rules.push({
          id: `regulatory_rule:ca-on-oreg670-${spec.table.toLowerCase().replace(/[^a-z0-9]+/g, "")}-item${item[1]}-${residency.toLowerCase()}`,
          speciesId: spec.speciesId,
          jurisdictionId: "jurisdiction:ca-on",
          table: spec.table,
          item: Number(item[1]),
          /* WHO the season is for. Never merged: "Closed season" in one column
             while the other is open is a real CLOSED for a described hunter. */
          appliesWhen: { RESIDENCY: residency, ...(firearm.permittedImplements ? { permittedImplements: firearm.permittedImplements } : {}) },
          designations: areas.units,
          ...(areas.expansions?.length ? { designationsStatedAs: areas.expansions } : {}),
          firearm,
          ...(byColumn.TIME_LIMITS ? { timeLimitsStatedAs: byColumn.TIME_LIMITS } : {}),
          declaredNoSeason: season.declaredNoSeason,
          seasonStatedAs: season.statedAs,
          windows: (season.windows ?? []).map((window) => ({
            opensIso: window.opensIso,
            closesIso: window.closesIso,
            crossesYear: window.crossesYear,
            statedAs: window.statedAs,
          })),
          derivedForYear: DERIVED_FOR_YEAR,
          sourceId: SOURCES.openSeasons.id,
          sourceSection: `${spec.table}, item ${item[1]}`,
        });
      }
    }
  }

  /* s. 69's Table decides what every class number means, so it is hashed too —
     from its own text, for the same reason. */
  const sixtyNine = textOf(huntingHtml.slice(huntingHtml.indexOf("69."), huntingHtml.indexOf("70.", huntingHtml.indexOf("69."))));
  return {
    rules, refusals, rowsRead,
    extractionHash: sha256(`${hashedCells.join("\n")}\n--- O. Reg. 665/98 s. 69 ---\n${sixtyNine}`),
  };
}

export async function main(argv = process.argv.slice(2)) {
  const check = argv.includes("--check");
  const { rules, refusals, rowsRead, extractionHash } = await build({ refresh: argv.includes("--refresh") });

  const tally = (list, key) => {
    const counts = {};
    for (const entry of list) counts[entry[key]] = (counts[entry[key]] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ [key]: name, count }));
  };

  const bundle = {
    contractVersion: 1,
    generatedBy: "scripts/build-ontario-open-seasons.mjs",
    jurisdictionId: "jurisdiction:ca-on",
    /*
     * The dates below are derived for this year and certified for it alone. The
     * RULE each came from travels with it in `statedAs`, so next year is a
     * re-derivation rather than a re-extraction.
     */
    derivedForYear: DERIVED_FOR_YEAR,
    /*
     * NOT a content hash of the source, and named so it cannot be read as one.
     * North Ground holds no permitted archival copy of these regulations
     * (§44: reading, deriving and archiving are three different rights), so a
     * `contentHash` would assert a snapshot that does not exist. This is a hash
     * of the CELLS THIS BUILD READ plus O. Reg. 665/98 s. 69's table — enough
     * that a changed season, area, class or refused row moves it, and little
     * enough that ontario.ca's per-request CDN token does not.
     */
    extraction: {
      hash: extractionHash,
      hashedOver: "Every table cell this build read, by table and item, plus the text of O. Reg. 665/98 s. 69 and its Table.",
      isNotASourceSnapshot: "North Ground stores no copy of these regulations; §44 separates reading and deriving from archiving.",
    },
    sources: Object.values(SOURCES),
    firearmClasses: Object.entries(FIREARM_CLASSES).map(([number, klass]) => ({
      classNumber: Number(number), statedAs: klass.content, appliesToSpecies: klass.species,
      permittedImplements: klass.implements,
      sourceId: SOURCES.hunting.id, sourceSection: "s. 69, Table",
    })),
    unresolvedDesignations: [{
      stated: "69A",
      usedBy: ["Table 2", "Table 5"],
      finding:
        "O. Reg. 663/98 Schedule 1 defines 69A-1, 69A-2 and 69A-3 and no bare 69A, and O. Reg. 670/98 s. 4 expands whole numbers only. Neither instrument says whether 69A means 69A-1 alone or all three, so every row naming it is refused rather than resolved either way.",
      evidenceUrl: "https://www.ontario.ca/laws/regulation/980663",
    }],
    whyBowExpandsToTwoImplements:
      "O. Reg. 665/98 s. 82: a person shall not hunt big game with a bow unless it is a crossbow or long-bow. The expansion lives with the class definition rather than being typed at each row.",
    reading: {
      rowsRead,
      rulesEmitted: rules.length,
      refusalCount: refusals.length,
      refusedByReason: tally(refusals, "reason"),
      refusedByTable: tally(refusals, "table"),
      examples: Object.values(refusals.reduce((seen, entry) => {
        if (!seen[entry.reason]) seen[entry.reason] = { reason: entry.reason, table: entry.table, detail: entry.detail ?? null };
        return seen;
      }, {})),
    },
    rules,
  };

  const next = `${JSON.stringify(bundle, null, 2)}\n`;
  if (check) {
    const current = existsSync(OUTPUT) ? readFileSync(OUTPUT, "utf8") : "";
    if (current !== next) {
      process.stderr.write(`\nOntario open seasons differ from the committed artifact. Rebuild and review.\n`);
      process.exitCode = 2;
    } else {
      process.stdout.write("Ontario open seasons reproduce byte for byte.\n");
    }
  } else {
    mkdirSync(dirname(OUTPUT), { recursive: true });
    writeFileSync(OUTPUT, next);
  }

  const bySpecies = {};
  for (const rule of rules) bySpecies[rule.speciesId] = (bySpecies[rule.speciesId] ?? 0) + 1;
  process.stdout.write(`\n${rowsRead} table rows read → ${rules.length} rules (${refusals.length} refusals)\n`);
  for (const [speciesId, count] of Object.entries(bySpecies).sort()) {
    process.stdout.write(`  ${speciesId.padEnd(30)} ${String(count).padStart(4)}\n`);
  }
  for (const entry of bundle.reading.refusedByReason) {
    process.stdout.write(`  refused ${entry.reason.padEnd(30)} ${String(entry.count).padStart(4)}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
