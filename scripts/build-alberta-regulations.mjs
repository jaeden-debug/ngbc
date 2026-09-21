#!/usr/bin/env node
/**
 * Build Alberta's certified regulatory bundle from the 2026 hunting guide.
 *
 *   node scripts/build-alberta-regulations.mjs                    # write the bundle
 *   node scripts/build-alberta-regulations.mjs --check            # exit 2 if a source moved,
 *                                                                 # 3 if the bundle is not what this builds
 *   node scripts/build-alberta-regulations.mjs --emit-rows FILE   # rows for the PDF cross-check
 *
 * First wave, chosen to prove three different shapes of rule:
 *
 *   ruffed, spruce and sharp-tailed grouse   straightforward: where and when, nothing asked
 *   white-tailed deer                        conditional: implement, antler class and licence
 *
 * White-tailed deer is where Alberta's model differs from Ontario's. Each cell of
 * the season table is an archery-only or a general season, and a ■ on the cell
 * means it "appl[ies] only to hunters with applicable special licences" — drawn
 * authorisations North Ground cannot see. So a season existing is not a season
 * open to the person asking: the licence is asked, answered as an assumption,
 * and never verified.
 *
 * Every rule is generated; none is written by hand. An unrecognised row, cell,
 * footnote, unit or date stops the build. A row the government PDF does not
 * confirm is published as a dispute, which the engine answers as CONFLICT.
 */

import { readFileSync, writeFileSync } from "node:fs";
import {
  GUIDE_CATALOGUE_URL, GUIDE_HTML_BASE, GUIDE_PDF_URL,
  expandWmuSpec, fetchBytes, fetchOfficialWmuIdentifiers, fetchText, parseFootnotes, parseSeasonCell,
  parseTables, regulatoryContent, sha256, withoutSundays,
} from "./alberta-source.mjs";
import { jurisdictionToday, readPreviousBundle, retrievedAtFor } from "./ontario-source.mjs";

const OUTPUT = "content/regulatory/ca-ab-2026.json";
const CROSSCHECK = "content/regulatory/sources/ca-ab-hunting-guide-2026-crosscheck.json";
const LICENCE_YEAR = 2026;
const SOURCE_ID = "source:ca-ab-hunting-guide-2026";
const SOURCE_VERSION = "2026 Alberta Guide to Hunting Regulations";
const TIME_ZONE = "America/Edmonton";

/** Region pages of the online edition and the PDF page each one reproduces. */
const REGIONS = [
  { page: "wmu100", pdfPage: 47, name: "Prairie WMUs (100 series & 732)" },
  { page: "wmu200", pdfPage: 50, name: "Parkland WMUs (200 series & 728, 730, 936)" },
  { page: "wmu300", pdfPage: 52, name: "Foothills WMUs (300 series)" },
  { page: "wmu400", pdfPage: 54, name: "Mountain WMUs (400 series)" },
  { page: "wmu500", pdfPage: 56, name: "Boreal WMUs (500 series & 841)" },
];
const BIRD_PAGE = { page: "bird-seasons", pdfPage: 63, name: "Game Bird Seasons and Bag Limits" };

/** Big-game species rows the first wave encodes, and the rows it reads past. */
const BIG_GAME_ENCODED = { "White-tailed deer": "species:white-tailed-deer" };
const BIG_GAME_NOT_YET = ["Mule deer", "Moose", "Elk", "Class 1 sheep"];
/** Rows that only point elsewhere in the guide. */
const NAVIGATION_ROW = /^Click here for /;

const BIRDS_ENCODED = {
  "Ruffed grouse": "species:ruffed-grouse",
  "Spruce grouse": "species:spruce-grouse",
  "Sharp-tailed grouse": "species:sharp-tailed-grouse",
};
const BIRDS_NOT_YET = [
  "Snow or Ross’s geese", "Canada or white-fronted geese", "Ducks, coots, snipe, cormorants", "Sandhill crane",
  "Male pheasant", "Ptarmigan", "Blue grouse", "Gray partridge", "Wild turkey", "Species",
];

/** Units where Alberta makes big-game hunting on Sunday unlawful (guide p. 31, item 15). */
const SUNDAY_PROHIBITED_SPEC = "102-160, 624, 728, 730, 936";

const GENERAL_IMPLEMENTS = ["RIFLE", "SHOTGUN", "MUZZLELOADER", "CROSSBOW", "BOW"];
const ARCHERY_IMPLEMENTS = ["BOW"];

/**
 * Footnotes this builder knows, by region page and number. Anything else a
 * row references stops the build: a footnote can narrow a season (Parkland (2)
 * removes rifles), and dropping one silently is a wrong answer.
 */
const KNOWN_FOOTNOTES = {
  "wmu200:1": { conditionId: "ab-wmu-936-discharge-permit", match: /firearms discharge permit to\s+hunt in WMU 936/i },
};

/* ── Conditions: what every answer must carry, in the guide's own terms ─── */

const CONDITIONS = [
  {
    id: "ab-licence-required",
    text: "A Wildlife Identification Number, a wildlife certificate and a licence for this species are required. North Ground has not verified what you hold.",
    sourceSection: "p. 21, Licences",
  },
  {
    id: "ab-special-licence",
    text: "This season applies only to hunters with an applicable special licence from the Alberta Hunting Draws. The answer assumes you hold one valid for this species, class and unit; North Ground has not verified it.",
    sourceSection: "p. 47, Big Game Seasons (■)",
  },
  {
    id: "ab-bowhunting-permit",
    text: "Hunting with a bow and arrow also requires a bowhunting permit (not required for a crossbow).",
    sourceSection: "p. 21, Licences",
  },
  {
    id: "ab-non-resident-big-game",
    text: "Licences open to non-residents differ from residents', and non-residents hunt big game with a resident hunter host or a designated guide.",
    sourceSection: "p. 17, Definitions; pp. 24–26, Licences",
  },
  {
    id: "ab-sunday-big-game",
    text: "Hunting big game on Sundays is unlawful in WMUs 102–160, 624, 728, 730 and 936; Sundays are excluded from the dates given here.",
    sourceSection: "p. 31, Unlawful activities, item 15",
  },
  {
    id: "ab-cwd-head-submission",
    text: "Heads of deer harvested in specific WMUs must be submitted for chronic wasting disease testing.",
    sourceSection: "pp. 3, 33 and 66",
  },
  {
    id: "ab-wmu-936-discharge-permit",
    text: "Hunters, including bowhunters, require a firearms discharge permit to hunt in WMU 936 (Cooking Lake–Blackfoot Provincial Recreation Area).",
    sourceSection: "p. 50, Parkland footnote 1; p. 63",
  },
  {
    id: "ab-game-bird-licence",
    text: "A wildlife certificate and an Alberta game bird licence are required. North Ground has not verified what you hold.",
    sourceSection: "p. 21, Licences",
  },
  {
    id: "ab-cfb-wainwright",
    text: "WMUs 728 and 730 (CFB Wainwright): every hunter attends a mandatory 7:00 am safety briefing on their first day, and game-bird hunters using shotguns must use non-toxic shot.",
    sourceSection: "p. 63",
  },
];

const LIMITATIONS = [
  "Alberta's own catalogue record says the guide \"is neither a legal document nor a complete listing of current Alberta hunting regulations\"; the Wildlife Act and the Wildlife Regulation (Alta. Reg. 143/97) are the law.",
  "Alberta describes its WMU maps as small-scale approximations of units legally described in the Wildlife Regulation, which prevails near a boundary.",
  "Being inside a WMU is not permission to hunt there: land access, provincial parks, restricted areas and local bylaws are separate questions North Ground has not resolved.",
  "This is a recreational licence result. It is not a determination of treaty, Aboriginal or Métis harvesting rights.",
];

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const zoneId = (identifier) => `management_zone:ca-ab-wmu-${identifier}`;
const compareUnits = (a, b) => Number(a) - Number(b);

function animalClass(type) {
  const normalised = type.replace(/\s+/g, " ").trim();
  if (normalised === "Antlered") return "ANTLERED";
  if (normalised === "Antlerless") return "ANTLERLESS";
  if (normalised === "Antlered and antlerless") return null;
  throw new Error(`Unrecognised white-tailed deer class "${type}"`);
}

function speciesName(cell) {
  return cell.replace(/\s+/g, " ").trim();
}

/* ── Build ───────────────────────────────────────────────────────────────── */

async function readSources() {
  const pages = {};
  for (const { page } of [...REGIONS, BIRD_PAGE]) pages[page] = await fetchText(`${GUIDE_HTML_BASE}${page}.html`);
  const pdf = await fetchBytes(GUIDE_PDF_URL);
  const officialIdentifiers = await fetchOfficialWmuIdentifiers();
  return { pages, pdf, officialIdentifiers };
}

function parseBigGame(pages, officialIdentifiers) {
  const rows = [];
  for (const region of REGIONS) {
    const html = pages[region.page];
    const tables = parseTables(html);
    if (!tables.length) throw new Error(`${region.page}: no season table`);
    const footnotes = parseFootnotes(html);
    const [header, subheader, ...body] = tables[0];
    if (header.join("|") !== "Species|Type|SEASON|SEASON|WMUs" || subheader[2] !== "Archery Only" || subheader[3] !== "General") {
      throw new Error(`${region.page}: season table columns changed: ${JSON.stringify([header, subheader])}`);
    }
    let order = 0;
    const encoded = [];
    let sentinel = null;
    for (const row of body) {
      const species = speciesName(row[0]).replace(/\^[\d,]+$/, "");
      if (!BIG_GAME_ENCODED[species]) {
        const recognised = NAVIGATION_ROW.test(species) ||
          BIG_GAME_NOT_YET.some((name) => species.toLowerCase() === name.toLowerCase());
        if (!recognised) throw new Error(`${region.page}: unrecognised species row "${species}"`);
        if (encoded.length && !sentinel && !NAVIGATION_ROW.test(species)) sentinel = row;
        continue;
      }
      order += 1;
      const units = expandWmuSpec(row[4], officialIdentifiers);
      const archery = row[2] ? parseSeasonCell(row[2], LICENCE_YEAR) : null;
      const general = row[3] ? parseSeasonCell(row[3], LICENCE_YEAR) : null;
      const referenced = [...units.footnotes, ...(archery?.footnotes ?? []), ...(general?.footnotes ?? [])];
      const conditionIds = [];
      for (const number of referenced) {
        const known = KNOWN_FOOTNOTES[`${region.page}:${number}`];
        const text = footnotes.get(number) ?? "";
        if (!known || !known.match.test(text)) {
          throw new Error(`${region.page}: footnote ${number} ("${text}") on "${row[4]}" is not one this builder models`);
        }
        conditionIds.push(known.conditionId);
      }
      if (units.names.length) throw new Error(`${region.page}: unexpected place name in "${row[4]}"`);
      encoded.push({
        key: `${region.page}#${order}`,
        region,
        speciesId: BIG_GAME_ENCODED[species],
        type: row[1],
        animalClass: animalClass(row[1]),
        archery,
        general,
        cells: { archery: row[2], general: row[3], wmus: row[4] },
        units: units.identifiers,
        conditionIds,
      });
    }
    if (!encoded.length) throw new Error(`${region.page}: no white-tailed deer rows`);
    if (!sentinel) throw new Error(`${region.page}: no row follows the white-tailed deer rows to bound them`);
    rows.push(...encoded.map((row) => ({ ...row, sentinelWmus: sentinel[4] })));
  }
  return rows;
}

function parseBirds(html, officialIdentifiers) {
  const table = parseTables(html)[0];
  if (!table) throw new Error("bird-seasons: no season table");
  const rows = [];
  let order = 0;
  for (const row of table) {
    const species = speciesName(row[0]);
    if (!BIRDS_ENCODED[species]) {
      if (!BIRDS_NOT_YET.includes(species)) throw new Error(`bird-seasons: unrecognised species row "${species}"`);
      continue;
    }
    if (row.length < 5 || !row[3]) continue; // the species' own heading line, before its unit rows
    order += 1;
    const units = expandWmuSpec(row[3], officialIdentifiers);
    const season = parseSeasonCell(row[4], LICENCE_YEAR);
    if (season.special || season.weekdayNote || season.footnotes.length) {
      throw new Error(`bird-seasons: ${species} row "${row[3]}" carries a mark this builder does not model`);
    }
    const daily = Number(row[1]);
    const possession = Number(row[2]);
    if (!Number.isInteger(daily) || !Number.isInteger(possession)) {
      throw new Error(`bird-seasons: unreadable limits for ${species}: ${row[1]} / ${row[2]}`);
    }
    const wainwright = units.names.some((name) => /Wainwright/.test(name));
    if (units.names.length && !wainwright) throw new Error(`bird-seasons: unexpected place name in "${row[3]}"`);
    rows.push({
      key: `bird-seasons#${order}`,
      speciesId: BIRDS_ENCODED[species],
      species,
      daily,
      possession,
      wmuText: row[3],
      seasonText: row[4],
      season,
      units: units.identifiers,
      conditionIds: [
        "ab-game-bird-licence",
        ...(wainwright ? ["ab-cfb-wainwright"] : []),
        ...(units.identifiers.includes("936") ? ["ab-wmu-936-discharge-permit"] : []),
      ],
    });
  }
  for (const species of Object.keys(BIRDS_ENCODED)) {
    if (!rows.some((row) => row.species === species)) throw new Error(`bird-seasons: no rows for ${species}`);
  }
  return rows;
}

/** The rows the PDF cross-check confirms, in the shape the Python oracle reads. */
function crosscheckManifest(bigGame, birds) {
  const bigGameByPage = {};
  for (const row of bigGame) {
    const list = (bigGameByPage[row.region.pdfPage] ??= []);
    list.push({
      key: row.key,
      // The PDF, like the HTML, prints a footnote digit fused to its unit ("9361"
      // is WMU 936, footnote 1), so the search needle keeps it fused.
      wmus: row.cells.wmus.replace(/\^([\d,]+)/g, "$1").split(/,\s*/).map((token) => token.trim()),
      archery: { dates: row.archery?.windows.map((window) => window.statedAs.replace(/\s+/g, " ")) ?? [], special: Boolean(row.archery?.special) },
      general: { dates: row.general?.windows.map((window) => window.statedAs.replace(/\s+/g, " ")) ?? [], special: Boolean(row.general?.special) },
    });
  }
  for (const region of REGIONS) {
    const sentinelWmus = bigGame.find((row) => row.region === region)?.sentinelWmus ?? "";
    bigGameByPage[region.pdfPage].push({
      key: `${region.page}#sentinel`,
      sentinel: true,
      wmus: sentinelWmus.replace(/[()]/g, "").replace(/\^[\d,]+/g, "").split(/,\s*/).map((token) => token.trim()),
    });
  }
  return {
    pdfUrl: GUIDE_PDF_URL,
    bigGame: bigGameByPage,
    birds: {
      [BIRD_PAGE.pdfPage]: birds.map((row) => ({
        key: row.key, species: row.species, daily: row.daily, possession: row.possession,
        wmuText: row.wmuText.replace(/\s+/g, " "), season: row.seasonText.replace(/\s+/g, " "),
      })),
    },
  };
}

function build({ pages, pdf, officialIdentifiers }, crosscheck, previous) {
  const bigGame = parseBigGame(pages, officialIdentifiers);
  const birds = parseBirds(pages[BIRD_PAGE.page], officialIdentifiers);
  const sunday = new Set(expandWmuSpec(SUNDAY_PROHIBITED_SPEC, officialIdentifiers).identifiers);

  const pdfHash = sha256(pdf);
  if (crosscheck.pdf.sha256 !== pdfHash) {
    throw new Error(
      `The PDF cross-check is for ${crosscheck.pdf.sha256}, but the published PDF is now ${pdfHash}. ` +
      "Re-run scripts/crosscheck-alberta-guide.py before building.",
    );
  }
  const verdicts = new Map(crosscheck.rows.map((row) => [row.key, row]));

  const groups = new Map();
  const groupFor = (identifiers, statedAs) => {
    const sorted = [...identifiers].sort(compareUnits);
    const id = `regulatory_group:ca-ab-2026-${slug(sorted.join("-")).slice(0, 80)}-${sha256(sorted.join(",")).slice(7, 15)}`;
    if (!groups.has(id)) {
      groups.set(id, { id, officialSpec: statedAs, zoneIds: sorted.map(zoneId), officialIdentifiers: sorted });
    }
    return id;
  };

  const rules = [];
  const disputesFor = (key) => {
    const verdict = verdicts.get(key);
    if (!verdict) throw new Error(`Row ${key} has no PDF cross-check verdict; re-run the cross-check`);
    return verdict.agree ? [] : [{ statedAs: `The online guide and the published PDF disagree for this row: ${verdict.detail}` }];
  };

  for (const row of birds) {
    rules.push({
      id: `regulatory_rule:ca-ab-2026-${slug(row.speciesId.slice(8))}-${row.key.split("#")[1]}`,
      speciesId: row.speciesId,
      regulatoryGroupId: groupFor(row.units, row.wmuText),
      appliesWhen: {},
      seasonLabel: "Open season",
      seasonPhrase: row.seasonText,
      windows: row.season.windows,
      declaredNoSeason: false,
      limits: { daily: row.daily, possession: row.possession, combined: false, statedAs: `${row.daily} daily, ${row.possession} in possession` },
      conditionIds: row.conditionIds,
      caveats: [],
      notes: [],
      sourceId: SOURCE_ID,
      sourceSection: "p. 63, Game Bird Seasons and Bag Limits",
      sourceVersion: SOURCE_VERSION,
      reviewStatus: "VERIFIED",
      disputes: disputesFor(row.key),
    });
  }

  for (const row of bigGame) {
    const disputes = disputesFor(row.key);
    for (const [column, cell] of [["archery", row.archery], ["general", row.general]]) {
      if (!cell) continue;
      // Split the row's units by the Sunday prohibition: a window is per rule,
      // and the same printed dates are not the same open days on both sides.
      const partitions = [
        { units: row.units.filter((unit) => sunday.has(unit)), sundays: true },
        { units: row.units.filter((unit) => !sunday.has(unit)), sundays: false },
      ].filter(({ units }) => units.length);
      for (const partition of partitions) {
        const windows = partition.sundays ? cell.windows.flatMap(withoutSundays) : cell.windows;
        const classSlug = row.animalClass ? row.animalClass.toLowerCase() : "either-class";
        rules.push({
          id: `regulatory_rule:ca-ab-2026-white-tailed-deer-${row.key.replace("#", "-")}-${column}-${classSlug}${partition.sundays ? "-no-sunday" : ""}`,
          speciesId: row.speciesId,
          regulatoryGroupId: groupFor(partition.units, row.cells.wmus.replace(/\^[\d,]+/g, "")),
          appliesWhen: {
            ...(row.animalClass ? { "ANIMAL_CLASS:ANTLER_CLASS": row.animalClass } : {}),
            ...(cell.special ? { LICENCE_TYPE: "SPECIAL" } : {}),
            permittedImplements: column === "archery" ? ARCHERY_IMPLEMENTS : GENERAL_IMPLEMENTS,
          },
          seasonLabel: `${column === "archery" ? "Archery-only" : "General"} season${cell.special ? " (special licence)" : ""}`,
          seasonPhrase: (column === "archery" ? row.cells.archery : row.cells.general).replace(/\s*\n\s*/g, " ").replace(/\^[\d,]+/g, ""),
          windows,
          declaredNoSeason: false,
          conditionIds: [
            cell.special ? "ab-special-licence" : "ab-licence-required",
            ...(column === "archery" ? ["ab-bowhunting-permit"] : []),
            ...(partition.sundays ? ["ab-sunday-big-game"] : []),
            "ab-non-resident-big-game",
            "ab-cwd-head-submission",
            ...row.conditionIds,
          ],
          caveats: [],
          notes: cell.weekdayNote ? [`Printed "(${cell.weekdayNote})"; every window listed falls on Wednesday to Saturday.`] : [],
          sourceId: SOURCE_ID,
          sourceSection: `p. ${row.region.pdfPage}, Big Game Seasons — ${row.region.name}`,
          sourceVersion: SOURCE_VERSION,
          reviewStatus: "VERIFIED",
          disputes,
        });
      }
    }
  }

  const ids = new Set();
  for (const rule of rules) {
    if (ids.has(rule.id)) throw new Error(`Duplicate rule id ${rule.id}`);
    ids.add(rule.id);
  }

  const sourceHashes = {
    pdf: pdfHash,
    ...Object.fromEntries(Object.entries(pages).map(([page, html]) => [page, sha256(regulatoryContent(html))])),
  };
  const contentHash = sha256(JSON.stringify(sourceHashes));
  const today = jurisdictionToday(TIME_ZONE);

  return {
    manifest: crosscheckManifest(bigGame, birds),
    bundle: {
      schemaVersion: 1,
      bundleId: "regulatory_bundle:ca-ab-2026",
      jurisdictionId: "jurisdiction:ca-ab",
      sourceVersion: SOURCE_VERSION,
      retrievedAt: retrievedAtFor(previous, previous?.contentHash, contentHash, today),
      contentHash,
      certifiedPeriod: { from: `${LICENCE_YEAR}-04-01`, to: `${LICENCE_YEAR + 1}-03-31` },
      absence: {
        meaning: "UNKNOWN",
        statedAs:
          "No row of the 2026 guide names this unit for this species. The guide is a summary and does not say an " +
          "unnamed unit is closed for big game, so North Ground reports UNKNOWN rather than CLOSED.",
        section: "Big Game Seasons; Game Bird Seasons and Bag Limits",
        sourceId: SOURCE_ID,
        /* A unit the guide DOES name for a species has its seasons listed in
           full — every white-tailed deer unit is given both classes, both
           columns — so a combination none of them opens is closed by the
           table itself, not unknown. */
        excludedCombination: "CLOSED",
      },
      officialUnitCount: officialIdentifiers.length,
      officialIdentifiers,
      sources: [{
        id: SOURCE_ID,
        authority: "Government of Alberta (Alberta Forestry and Parks)",
        title: SOURCE_VERSION,
        url: GUIDE_PDF_URL,
        catalogueUrl: GUIDE_CATALOGUE_URL,
        parsedFrom: GUIDE_HTML_BASE,
        licence: "No open licence. North Ground records facts — dates, units, classes and limits — with the printed cell as provenance.",
        sourceHashes,
        crosscheck: { file: CROSSCHECK, rowsChecked: crosscheck.rowsChecked, disagreements: crosscheck.disagreements },
        conditions: CONDITIONS.map((condition) => ({ ...condition, sourceId: SOURCE_ID })),
      }],
      limitations: LIMITATIONS,
      notEncoded: {
        bigGame: BIG_GAME_NOT_YET,
        gameBirds: BIRDS_NOT_YET.filter((name) => name !== "Species"),
        reason: "Not in the first Alberta wave. Their rows are read and recognised, so a renamed or new row still stops the build.",
      },
      groups: [...groups.values()].sort((a, b) => a.id.localeCompare(b.id)),
      rules,
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const emitRows = args.includes("--emit-rows") ? args[args.indexOf("--emit-rows") + 1] : null;
  const sources = await readSources();

  if (emitRows) {
    const bigGame = parseBigGame(sources.pages, sources.officialIdentifiers);
    const birds = parseBirds(sources.pages[BIRD_PAGE.page], sources.officialIdentifiers);
    writeFileSync(emitRows, `${JSON.stringify(crosscheckManifest(bigGame, birds), null, 2)}\n`);
    console.log(`Wrote ${bigGame.length + birds.length} rows for the PDF cross-check to ${emitRows}.`);
    return;
  }

  const crosscheck = JSON.parse(readFileSync(CROSSCHECK, "utf8"));
  const previous = readPreviousBundle(OUTPUT);

  let built;
  try {
    built = build(sources, crosscheck, previous);
  } catch (error) {
    if (check && /cross-check is for/.test(error.message)) {
      console.error(`SOURCE MOVED: ${error.message}`);
      process.exit(2);
    }
    throw error;
  }
  const { bundle } = built;

  if (check) {
    if (!previous) {
      console.error(`${OUTPUT} does not exist.`);
      process.exit(3);
    }
    if (previous.contentHash !== bundle.contentHash) {
      const moved = Object.keys(bundle.sources[0].sourceHashes)
        .filter((key) => previous.sources?.[0]?.sourceHashes?.[key] !== bundle.sources[0].sourceHashes[key]);
      console.error(`SOURCE MOVED: ${moved.join(", ")} changed since ${OUTPUT} was built. Review before rebuilding.`);
      process.exit(2);
    }
    if (JSON.stringify(previous) !== JSON.stringify(bundle)) {
      console.error(`${OUTPUT} is not what this builder produces from unchanged sources. Was it edited by hand?`);
      process.exit(3);
    }
    console.log(`Alberta sources unchanged; ${OUTPUT} reproduces exactly.`);
    return;
  }

  writeFileSync(OUTPUT, `${JSON.stringify(bundle, null, 2)}\n`);
  const bySpecies = {};
  for (const rule of bundle.rules) bySpecies[rule.speciesId] = (bySpecies[rule.speciesId] ?? 0) + 1;
  console.log(`Wrote ${OUTPUT}: ${bundle.rules.length} rules in ${bundle.groups.length} groups.`);
  for (const [speciesId, count] of Object.entries(bySpecies)) console.log(`  ${speciesId}: ${count} rules`);
  const disputed = bundle.rules.filter((rule) => rule.disputes.length);
  console.log(`  disputed against the PDF: ${disputed.length}`);
}

main().catch((error) => {
  console.error(`Alberta build failed: ${error.message}`);
  process.exit(1);
});
