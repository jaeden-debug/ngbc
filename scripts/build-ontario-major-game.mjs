#!/usr/bin/env node
/**
 * Build North Ground's Ontario major-game regulatory bundle.
 *
 *   node scripts/build-ontario-major-game.mjs           # rebuild and report
 *   node scripts/build-ontario-major-game.mjs --check   # fail if a source moved
 *
 * Major game differs from small game in one structural way: a season depends on
 * facts the hunter supplies. Ontario publishes deer seasons in three separate
 * tables by method, each with distinct resident and non-resident columns, and
 * "None" in a non-resident cell is a real closure rather than a gap. So a rule
 * here carries the dimension values it applies to, and the engine asks for them.
 *
 * As with small game, parsing is strict. A season phrase carrying a
 * qualification beyond its dates, an unreadable WMU token, or a table that has
 * moved all abort the build rather than producing a confident wrong answer.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import {
  diffBundles, expandWmuSpec, extractFootnotes, extractTables, fetchOfficialWmuIdentifiers,
  fetchText, formatBundleDiff, parseWmuCell, slug, zoneCanonicalId,
} from "./ontario-source.mjs";

/**
 * Implements, not table headings.
 *
 * Ontario's season tables grant a SET of implements, and per-unit footnotes take
 * some away: footnote 1 removes rifles from units listed under a table headed
 * "Rifles, shotguns, muzzle-loading guns and bows". Modelling the heading as a
 * single method would tell a hunter in WMU 65 that a rifle is fine when the
 * source says it is not, so a rule carries the set that actually applies to it.
 */
const IMPLEMENTS = { RIFLE: "RIFLE", SHOTGUN: "SHOTGUN", MUZZLELOADER: "MUZZLELOADER", BOW: "BOW" };

const ALL_IMPLEMENTS = [IMPLEMENTS.RIFLE, IMPLEMENTS.SHOTGUN, IMPLEMENTS.MUZZLELOADER, IMPLEMENTS.BOW];

/**
 * How a footnote changes the rule it is attached to.
 *
 * Matched on the authority's exact wording. Anything unrecognised aborts the
 * build: a footnote North Ground cannot classify may be the one that makes the
 * answer wrong, and silently ignoring it is the failure this whole file exists
 * to prevent.
 */
const FOOTNOTE_EFFECTS = [
  {
    match: /^indicates that rifles are not permitted/i,
    effect: { kind: "REMOVE_IMPLEMENTS", implements: [IMPLEMENTS.RIFLE] },
  },
  {
    // Bear, WMU 7A. Unlike the deer footnote this REPLACES the permitted set
    // rather than subtracting from it, because the table it sits under names no
    // implements at all.
    match: /^only bows and muzzle-loading guns are permitted in wmu/i,
    effect: { kind: "SET_IMPLEMENTS", implements: [IMPLEMENTS.MUZZLELOADER, IMPLEMENTS.BOW] },
  },
  {
    // Bear, WMUs 82A and 84: legal only inside named geographic townships,
    // whose boundaries North Ground does not hold.
    match: /^indicates bear hunting is only permitted in the geographic townships/i,
    effect: { kind: "GEOGRAPHIC_EXCLUSION" },
  },
  {
    // Moose: in the units carrying it, a "bow tag" is valid for the bows and
    // muzzle-loading guns season instead. That changes which tag opens which
    // season, so it travels as a caveat rather than being applied silently.
    match: /^for these wmus\s*,?\s*.bow tags. are for the bows and muzzle-loading guns only season/i,
    effect: { kind: "GEOGRAPHIC_EXCLUSION" },
  },
  {
    match: /^excluding parts of wmus? .* algonquin provincial park/i,
    // A boundary inside a boundary. North Ground holds WMU geometry, not the
    // park's, so this cannot be evaluated and must travel as a caveat.
    effect: { kind: "GEOGRAPHIC_EXCLUSION" },
  },
];

function classifyFootnote(text) {
  const found = FOOTNOTE_EFFECTS.find((entry) => entry.match.test(text));
  if (!found) throw new Error(`Unclassified footnote, refusing to publish: "${text}"`);
  return found.effect;
}

const OUTPUT = "content/regulatory/ca-on-major-game-2026.json";
const SOURCE_YEAR = 2026;
const SOURCE_VERSION = "2026";

const DOCUMENT = "https://www.ontario.ca/document/ontario-hunting-regulations-summary";

/**
 * The published season tables North Ground certifies.
 *
 * `dimensions` names what each table's columns turn on. The headings are matched
 * exactly: if Ontario renames or restructures one, the build stops rather than
 * guessing which table replaced it.
 */
const SPECIES = [
  {
    speciesId: "species:white-tailed-deer",
    page: "white-tailed-deer",
    sourceId: "source:ca-on-deer-2026",
    sourceTitle: "White-tailed deer — Ontario Hunting Regulations Summary",
    tables: [
      {
        heading: "Rifles, shotguns, muzzle-loading guns and bows",
        label: "gun season",
        implements: ALL_IMPLEMENTS,
        residencyColumns: true,
      },
      {
        heading: "Muzzle-loading guns and bows",
        label: "muzzle-loader season",
        implements: [IMPLEMENTS.MUZZLELOADER, IMPLEMENTS.BOW],
        residencyColumns: true,
      },
      {
        heading: "Bows only",
        label: "archery season",
        implements: [IMPLEMENTS.BOW],
        residencyColumns: true,
      },
    ],
    /**
     * Season tables on this page that North Ground deliberately does not
     * certify. Each needs a reason, and their content is still hashed so a
     * change to one triggers review even though no rule comes from it.
     */
    excludedTables: [
      {
        heading: "Controlled deer hunt seasons (with hunt codes)",
        reason:
          "Controlled hunts are drawn per hunt code and are not open to a hunter by location and " +
          "date alone. Surfaced to readers by the deer-controlled condition instead.",
      },
    ],
    /** Conditions the season tables do not resolve, each with its own provenance. */
    conditions: [
      {
        id: "deer-licence",
        text:
          "A deer licence and the applicable seal or tag are required. North Ground cannot verify " +
          "what you hold; confirm your own licensing before hunting.",
        sourceSection: "Hunting licence information",
      },
      {
        id: "deer-antlerless",
        text:
          "Taking an antlerless deer generally requires an additional validated tag obtained through " +
          "the antlerless deer draw. North Ground does not evaluate draw outcomes or tag validation.",
        sourceSection: "Last year's antlerless deer draw results",
      },
      {
        id: "deer-controlled",
        text:
          "Some units also run controlled deer hunts with their own seasons and hunt codes. " +
          "North Ground has not certified those and they are not reflected in this result.",
        sourceSection: "Controlled deer hunt seasons (with hunt codes)",
      },
    ],
  },
  {
    speciesId: "species:wild-turkey",
    page: "wild-turkey",
    sourceId: "source:ca-on-wild-turkey-2026",
    sourceTitle: "Wild turkey — Ontario Hunting Regulations Summary",
    /**
     * Turkey publishes one season column for residents and non-residents alike,
     * and no rifle or muzzle-loader season at all. The spring season is limited
     * to bearded birds, which is a fact about the animal in front of you rather
     * than about the date, so it travels as a condition on the spring rules only.
     */
    tables: [
      {
        heading: "Spring wild turkey season \u2014 shotgun or bow",
        label: "spring season",
        implements: [IMPLEMENTS.SHOTGUN, IMPLEMENTS.BOW],
        residencyColumns: false,
        conditionIds: ["turkey-bearded"],
      },
      {
        heading: "Fall wild turkey season \u2014 shotgun or bow",
        label: "fall shotgun season",
        implements: [IMPLEMENTS.SHOTGUN, IMPLEMENTS.BOW],
        residencyColumns: false,
      },
      {
        heading: "Fall wild turkey season \u2014 bow",
        label: "fall archery season",
        implements: [IMPLEMENTS.BOW],
        residencyColumns: false,
      },
    ],
    conditions: [
      {
        id: "turkey-licence",
        text:
          "A wild turkey licence and a valid turkey tag are required, and the season is one bird " +
          "per tag. North Ground cannot verify what you hold.",
        sourceSection: "Wild turkey licences and tags",
      },
      {
        id: "turkey-bearded",
        tableScoped: true,
        text:
          "The spring season is restricted to bearded turkeys. Identifying the bird before shooting " +
          "is the hunter's responsibility and North Ground cannot do it for you.",
        sourceSection: "Spring wild turkey season",
      },
      {
        id: "turkey-mandatory-report",
        text:
          "Wild turkey harvests must be reported to the province. North Ground does not file reports.",
        sourceSection: "Reporting your wild turkey hunt",
      },
    ],
  },
  {
    speciesId: "species:american-black-bear",
    page: "black-bear",
    sourceId: "source:ca-on-black-bear-2026",
    sourceTitle: "Black bear \u2014 Ontario Hunting Regulations Summary",
    /**
     * Bear tables name no implements in their headings, so the default is every
     * implement and the footnotes narrow it: WMU 7A is bows and muzzle-loading
     * guns only, and two units are legal in named townships only.
     */
    tables: [
      {
        heading: "Spring black bear seasons",
        label: "spring season",
        implements: ALL_IMPLEMENTS,
        residencyColumns: false,
      },
      {
        heading: "Fall black bear seasons",
        label: "fall season",
        implements: ALL_IMPLEMENTS,
        residencyColumns: false,
      },
    ],
    conditions: [
      {
        id: "bear-licence",
        text:
          "A black bear licence and a valid bear tag are required for the wildlife management unit " +
          "you hunt in. North Ground cannot verify what you hold.",
        sourceSection: "Black bear licences and tags",
      },
      {
        id: "bear-cubs",
        text:
          "It is illegal to hunt a bear cub, or a female bear with a cub. Identification is the " +
          "hunter's responsibility and North Ground cannot make it for you.",
        sourceSection: "Black bear hunting rules",
      },
      {
        id: "bear-non-resident-outfitter",
        text:
          "Non-residents generally must hunt black bear through a licensed outfitter or on land they " +
          "own. North Ground has not certified which arrangement applies to you.",
        sourceSection: "Non-resident black bear hunting",
      },
    ],
  },
  {
    speciesId: "species:moose",
    page: "moose",
    sourceId: "source:ca-on-moose-2026",
    sourceTitle: "Moose \u2014 Ontario Hunting Regulations Summary",
    /**
     * Moose is gated by the TAG, not the implement. The province heads these
     * tables "seasons when gun tags are valid" and "season when bow tags are
     * valid": a person carrying a bow with no bow tag has no season here, so
     * the rule records the tag type the table is for and the engine asks which
     * tag was drawn. Every result stays conditional on a validated tag that
     * North Ground cannot see.
     *
     * The allocation tables on the same page are last year's draw quotas and
     * hunt codes, not seasons. They are not listed here, and the build refuses
     * any unlisted table that looks like a season.
     */
    tables: [
      {
        heading: "Rifles, shotguns, muzzle-loading guns and bows (the \"gun\" seasons when \"gun tags\" are valid)",
        label: "gun-tag season",
        implements: ALL_IMPLEMENTS,
        residencyColumns: true,
        appliesWhen: { TAG_TYPE: "GUN" },
      },
      {
        heading: "Bows and muzzle-loading guns only (seasons when bows and muzzle-loading guns only tags are valid)",
        label: "bow-and-muzzle-loader-tag season",
        implements: [IMPLEMENTS.MUZZLELOADER, IMPLEMENTS.BOW],
        residencyColumns: true,
        appliesWhen: { TAG_TYPE: "BOW_MUZZLELOADER" },
      },
      {
        heading: "Bows only (season when \"bow tags\" are valid)",
        label: "bow-tag season",
        implements: [IMPLEMENTS.BOW],
        residencyColumns: true,
        appliesWhen: { TAG_TYPE: "BOW" },
      },
    ],
    excludedTables: [
      {
        heading: "Resident seasons with controlled hunter numbers",
        reason:
          "Controlled hunter numbers, including seasons restricted to hunters with a lower limb " +
          "disability and unit-specific rules. Eligibility is not decidable from location and date, " +
          "so these are surfaced by the moose-controlled condition rather than published as seasons.",
      },
    ],
    conditions: [
      {
        id: "moose-tag",
        text:
          "Every moose season requires a validated moose tag allocated through the province's tag " +
          "draw, and the tag determines both the season and the animal you may take. North Ground " +
          "does not evaluate draw applications, points or tag validation.",
        sourceSection: "Moose tag allocation process",
      },
      {
        id: "moose-calf",
        text:
          "A calf tag, a bull tag and a cow/calf tag permit different animals. Which one you hold " +
          "decides what is legal to take, and North Ground cannot verify it.",
        sourceSection: "Tag allocation process hunt codes",
      },
      {
        id: "moose-controlled",
        text:
          "Some units also run resident seasons with controlled hunter numbers, including seasons " +
          "for hunters with a lower limb disability and unit-specific rules. North Ground has not " +
          "certified those and they are not reflected in this result.",
        sourceSection: "Resident seasons with controlled hunter numbers",
      },
    ],
  },
];

/** A published cell meaning there is no season for that column. */
function isNoSeason(phrase) {
  return /^none$/i.test(phrase.trim());
}

async function main() {
  const checkOnly = process.argv.includes("--check");

  const officialIdentifiers = await fetchOfficialWmuIdentifiers();
  console.log(`Official Ontario units: ${officialIdentifiers.length}`);

  const groups = [];
  const rules = [];
  const sources = [];
  const hashParts = [];

  for (const species of SPECIES) {
    const url = `${DOCUMENT}/${species.page}`;
    console.log(`Fetching ${url}`);
    const pageHtml = await fetchText(url);
    const tables = extractTables(pageHtml);
    const footnoteText = extractFootnotes(pageHtml);

    // A page may carry tables North Ground has not certified — moose publishes
    // six allocation tables alongside its seasons. Ignoring them is correct;
    // ignoring a NEW season table would not be, so anything that looks like one
    // and is not declared stops the build.
    const declared = new Set(species.tables.map((table) => table.heading));
    for (const candidate of tables) {
      if (declared.has(candidate.heading)) continue;
      const header = (candidate.rows[0] ?? []).join(" ");
      if (!/open season/i.test(header)) continue;
      const excluded = (species.excludedTables ?? []).find((entry) => entry.heading === candidate.heading);
      if (!excluded) {
        throw new Error(
          `Undeclared season table on the ${species.page} page: "${candidate.heading}". ` +
          "Certify it or declare why it is excluded before publishing.",
        );
      }
      // Hashed even though no rule comes from it, so a change to an excluded
      // season still triggers review rather than passing unnoticed.
      hashParts.push(`${species.page}|EXCLUDED|${candidate.heading}|${candidate.rows.map((r) => r.join("~")).join("\n")}`);
    }

    for (const table of species.tables) {
      const found = tables.find((candidate) => candidate.heading === table.heading);
      if (!found) throw new Error(`Table "${table.heading}" is no longer on the ${species.page} page`);

      const header = found.rows[0] ?? [];
      const dataRows = found.rows.filter((row) => row.length >= 2 && !/wildlife management unit/i.test(row[0]));
      if (!dataRows.length) throw new Error(`Table "${table.heading}" has no rows`);
      hashParts.push(`${species.page}|${table.heading}|${found.rows.map((r) => r.join("~")).join("\n")}`);

      // Column order is read from the header rather than assumed.
      const residentColumn = header.findIndex((cell) => /^resident/i.test(cell));
      const nonResidentColumn = header.findIndex((cell) => /^non-?resident/i.test(cell));
      if (table.residencyColumns && (residentColumn < 1 || nonResidentColumn < 1)) {
        throw new Error(`Table "${table.heading}" no longer has the expected resident/non-resident columns`);
      }

      const tableImplements = table.implements;
      if (!tableImplements?.length) throw new Error(`No implement set declared for table "${table.heading}"`);

      for (const rowIndex of dataRows.keys()) {
        const row = dataRows[rowIndex];
        const rawRow = found.rawRows[found.rows.indexOf(row)];
        const spec = row[0];

        // Units in one row can carry different footnotes, so they are grouped by
        // the implement set and caveats that actually end up applying to them.
        const tokens = parseWmuCell(rawRow?.[0] ?? spec);
        const variants = new Map();
        for (const { token, footnotes } of tokens) {
          let permitted = [...tableImplements];
          const caveats = [];
          for (const id of footnotes) {
            const text = footnoteText.get(id);
            if (!text) throw new Error(`Footnote ${id} referenced under "${table.heading}" has no definition`);
            const effect = classifyFootnote(text);
            if (effect.kind === "REMOVE_IMPLEMENTS") {
              permitted = permitted.filter((item) => !effect.implements.includes(item));
            } else if (effect.kind === "SET_IMPLEMENTS") {
              permitted = [...effect.implements];
            } else {
              caveats.push(text);
            }
          }
          const key = `${permitted.join("+")}|${caveats.join("|")}`;
          if (!variants.has(key)) variants.set(key, { permitted, caveats, tokens: [] });
          variants.get(key).tokens.push(token);
        }

        for (const variant of variants.values()) {
          const variantSpec = variant.tokens.join(", ");
          const units = expandWmuSpec(variantSpec, officialIdentifiers);
          const groupId = `regulatory_group:ca-on-${slug(variantSpec)}`;
          if (!groups.some((group) => group.id === groupId)) {
            groups.push({
              id: groupId,
              jurisdictionId: "jurisdiction:ca-on",
              label: `Ontario WMU ${variantSpec}`,
              officialSpec: variantSpec,
              officialIdentifiers: units,
              zoneIds: units.map(zoneCanonicalId),
              sourceId: species.sourceId,
              sourceVersion: SOURCE_VERSION,
            });
          }

          const columns = table.residencyColumns
            ? [
                { residency: "RESIDENT", phrase: row[residentColumn] ?? "" },
                { residency: "NON_RESIDENT", phrase: row[nonResidentColumn] ?? "" },
              ]
            : [{ residency: null, phrase: row[1] ?? "" }];

          for (const column of columns) {
            if (!column.phrase) continue;
            const closed = isNoSeason(column.phrase);
            rules.push({
              id: `regulatory_rule:ca-on-${slug(species.speciesId.replace("species:", ""))}` +
                `-${slug(table.label)}-${slug(variantSpec)}-${slug(variant.permitted.join("-"))}` +
                `-${slug(column.residency ?? "any")}-${SOURCE_VERSION}`,
              speciesId: species.speciesId,
              jurisdictionId: "jurisdiction:ca-on",
              regulatoryGroupId: groupId,
              // The facts this rule applies to. The engine asks for exactly these.
              appliesWhen: {
                permittedImplements: variant.permitted,
                ...(column.residency ? { RESIDENCY: column.residency } : {}),
                ...(table.appliesWhen ?? {}),
              },
              // What the province calls this season. Not a question — the date
              // decides it — but it says which season an answer came from.
              seasonLabel: table.label,
              seasonPhrase: closed ? null : column.phrase,
              declaredNoSeason: closed,
              caveats: variant.caveats,
              // Species-wide conditions, plus the ones this particular season
              // carries. A condition marked `tableScoped` is defined once for
              // provenance but attaches only where a table names it — the
              // bearded-turkey rule is a spring rule, not a turkey rule.
              conditionIds: [
                ...species.conditions.filter((condition) => !condition.tableScoped).map((condition) => condition.id),
                ...(table.conditionIds ?? []),
              ],
              sourceId: species.sourceId,
              sourceSection: table.heading,
              sourceVersion: SOURCE_VERSION,
              sourceYear: SOURCE_YEAR,
              reviewStatus: "PUBLISHED",
            });
          }
        }
      }
    }

    sources.push({
      id: species.sourceId,
      authority: "Ontario Ministry of Natural Resources",
      title: species.sourceTitle,
      url,
      sourceVersion: SOURCE_VERSION,
      sourceYear: SOURCE_YEAR,
      // `tableScoped` is build-time bookkeeping; the published record carries
      // the condition itself and where it came from.
      conditions: species.conditions.map((condition) => ({
        id: condition.id,
        text: condition.text,
        sourceSection: condition.sourceSection,
        sourceId: species.sourceId,
      })),
    });
  }

  const contentHash = `sha256:${createHash("sha256").update(hashParts.join("\n\n")).digest("hex")}`;

  const bundle = {
    contractVersion: 1,
    generatedBy: "scripts/build-ontario-major-game.mjs",
    jurisdictionId: "jurisdiction:ca-on",
    sourceVersion: SOURCE_VERSION,
    sourceYear: SOURCE_YEAR,
    retrievedAt: new Date().toISOString().slice(0, 10),
    contentHash,
    officialUnitCount: officialIdentifiers.length,
    sources,
    groups,
    rules,
  };

  if (checkOnly) {
    let previous;
    try {
      previous = JSON.parse(readFileSync(OUTPUT, "utf8"));
    } catch {
      console.error("No existing major-game bundle to check against.");
      process.exit(1);
    }
    if (previous.contentHash !== contentHash) {
      console.error("An official major-game source has CHANGED since the bundle was built.");
      console.error(`  bundle : ${previous.contentHash}`);
      console.error(`  live   : ${contentHash}`);
      // A moved hash alone does not tell a reviewer whether a season shifted or
      // a footnote appeared that removes an implement, so name the rules.
      const diff = diffBundles(previous, bundle);
      const affected = diff.added.length + diff.removed.length + diff.changed.length;
      if (affected) {
        console.error(`\n${affected} rule(s) affected:\n`);
        console.error(formatBundleDiff(diff));
      } else {
        console.error("\nNo rule changed: the source moved in a way that does not affect published rules.");
      }
      console.error("\nNothing has been published. Rebuild, review, and re-certify before promoting.");
      process.exit(2);
    }
    console.log(`Major-game sources unchanged (${contentHash.slice(0, 23)}...).`);
    return;
  }

  writeFileSync(OUTPUT, `${JSON.stringify(bundle, null, 2)}\n`);

  console.log("");
  console.log(`Wrote ${OUTPUT}`);
  console.log(`  content hash ${contentHash}`);
  console.log(`  groups       ${groups.length}`);
  console.log(`  rules        ${rules.length}`);
  for (const species of SPECIES) {
    const forSpecies = rules.filter((rule) => rule.speciesId === species.speciesId);
    const open = forSpecies.filter((rule) => !rule.declaredNoSeason);
    const closed = forSpecies.filter((rule) => rule.declaredNoSeason);
    const units = new Set(
      open.flatMap((rule) => groups.find((group) => group.id === rule.regulatoryGroupId).officialIdentifiers),
    );
    console.log(`    ${species.speciesId}`);
    console.log(`      rules with a season : ${open.length}`);
    console.log(`      rules stating None  : ${closed.length}`);
    console.log(`      units reached       : ${units.size} of ${officialIdentifiers.length}`);
  }
}

main().catch((error) => {
  console.error(`Build failed: ${error.message}`);
  process.exit(1);
});
