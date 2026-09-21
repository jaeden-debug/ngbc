#!/usr/bin/env node
/**
 * Build North Ground's Ontario small-game regulatory bundle from the authority.
 *
 *   node scripts/build-ontario-regulations.mjs           # rebuild and report
 *   node scripts/build-ontario-regulations.mjs --check   # fail if the source moved
 *
 * The bundle is generated, never hand-edited, so the encoded rule can always be
 * re-derived from the published source and a change in that source shows up as a
 * diff rather than as a silent divergence.
 *
 * Parsing is deliberately strict. Anything this script does not recognise — an
 * unfamiliar season phrase, a limit it cannot read, a WMU reference that does not
 * exist in the official layer — aborts the build. A regulatory bundle that
 * quietly drops a row it could not read is worse than no bundle.
 */

import { createHash } from "node:crypto";
import { writeFileSync, readFileSync } from "node:fs";
import {
  jurisdictionToday, readPreviousBundle, retrievedAtFor,
  expandWmuSpec, extractTables, fetchOfficialWmuIdentifiers, fetchText, slug, zoneCanonicalId,
} from "./ontario-source.mjs";

const SOURCE_URL =
  "https://www.ontario.ca/document/ontario-hunting-regulations-summary/small-game-and-furbearing-mammals";
const OUTPUT = "content/regulatory/ca-on-small-game-2026.json";
const CERTIFIED_UNITS_OUTPUT = "content/regulatory/ca-on-certified-units.json";

/** The licence year this summary is published for. */
const SOURCE_YEAR = 2026;
const SOURCE_VERSION = "2026";
const SOURCE_CANONICAL_ID = "source:ca-on-small-game-2026";

/**
 * Which published tables North Ground certifies, and the canonical species each
 * row applies to. A heading not listed here is left alone: the species library
 * has no entity for it, and inventing one to fill a table would be backwards.
 */
const TABLES = [
  {
    heading: "Ruffed grouse and spruce grouse seasons",
    section: "Ruffed grouse and spruce grouse seasons",
    species: ["species:ruffed-grouse", "species:spruce-grouse"],
    combined: true,
  },
  {
    heading: "Ruffed grouse seasons (no season for spruce grouse in these units)",
    section: "Ruffed grouse seasons (no season for spruce grouse in these units)",
    species: ["species:ruffed-grouse"],
    combined: false,
    // The heading is itself an official statement about another species.
    declaresNoSeasonFor: ["species:spruce-grouse"],
  },
  {
    heading: "Sharp-tailed grouse seasons",
    section: "Sharp-tailed grouse seasons",
    species: ["species:sharp-tailed-grouse"],
    combined: false,
  },
  {
    heading: "Snowshoe (varying) hare seasons",
    section: "Snowshoe (varying) hare seasons",
    species: ["species:snowshoe-hare"],
    combined: false,
  },
];

/**
 * Display names for the species the bundle references.
 *
 * Only used to render a combined limit in the authority's own terms ("combined
 * with spruce grouse"). Canonical IDs remain the identity; this is presentation.
 */
const SPECIES_NAMES = {
  "species:ruffed-grouse": "ruffed grouse",
  "species:spruce-grouse": "spruce grouse",
  "species:sharp-tailed-grouse": "sharp-tailed grouse",
  "species:snowshoe-hare": "snowshoe hare",
};

/* ── Limits, which are specific to the small-game tables ─────────────────── */

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15,
};

function readCount(token) {
  const word = NUMBER_WORDS[token.toLowerCase()];
  if (word !== undefined) return word;
  if (/^\d+$/.test(token)) return Number(token);
  return null;
}

/**
 * Read a published limits phrase.
 *
 * "Combined daily limit of five and possession limit of 15" means one shared
 * allowance across the species named in that table, not five of each. That
 * distinction is the whole reason `combined` is carried through rather than
 * flattened into per-species numbers.
 */
function parseLimits(phrase) {
  const text = phrase.trim().replace(/\s+/g, " ");
  const combined = /\bcombined\b/i.test(text);

  const daily = /daily limits? of ([a-z0-9]+)/i.exec(text);
  const possession = /possession limits? of ([a-z0-9]+)/i.exec(text);
  const noPossession = /no possession limit/i.test(text);

  if (!daily) return null;
  const dailyCount = readCount(daily[1]);
  if (dailyCount === null) return null;

  let possessionCount = null;
  if (possession) {
    possessionCount = readCount(possession[1]);
    if (possessionCount === null) return null;
  } else if (!noPossession) {
    return null;
  }

  return { daily: dailyCount, possession: possessionCount, combined, statedAs: text };
}

/* ── Build ───────────────────────────────────────────────────────────────── */

async function main() {
  const checkOnly = process.argv.includes("--check");
  const previousBundle = readPreviousBundle(OUTPUT);
  const TODAY = jurisdictionToday();

  console.log("Fetching the official Ontario small game summary...");
  const html = await fetchText(SOURCE_URL);
  const tables = extractTables(html);

  console.log("Fetching the official Ontario WMU identifiers...");
  const officialIdentifiers = await fetchOfficialWmuIdentifiers();
  console.log(`  ${officialIdentifiers.length} official units`);

  // Hash the tables rather than the page, so navigation and marketing churn does
  // not look like a regulatory change.
  const tableText = tables.map(({ heading, rows }) => `${heading}\n${rows.map((r) => r.join("|")).join("\n")}`).join("\n\n");
  const sourceHash = `sha256:${createHash("sha256").update(tableText).digest("hex")}`;

  const groups = [];
  const rules = [];
  const noSeason = [];

  for (const table of TABLES) {
    const found = tables.find((candidate) => candidate.heading === table.heading);
    if (!found) throw new Error(`Official table "${table.heading}" is no longer on the page`);

    const dataRows = found.rows.filter((row) => row.length >= 3 && !/wildlife management unit/i.test(row[0]));
    if (!dataRows.length) throw new Error(`Official table "${table.heading}" has no rows`);

    for (const [spec, seasonPhrase, limitsPhrase] of dataRows) {
      const units = expandWmuSpec(spec, officialIdentifiers);
      const limits = parseLimits(limitsPhrase);
      if (!limits) throw new Error(`Cannot read limits "${limitsPhrase}" under "${table.heading}"`);

      const groupId = `regulatory_group:ca-on-${slug(spec)}`;
      if (!groups.some((group) => group.id === groupId)) {
        groups.push({
          id: groupId,
          jurisdictionId: "jurisdiction:ca-on",
          label: `Ontario WMU ${spec}`,
          officialSpec: spec,
          zoneIds: units.map(zoneCanonicalId),
          officialIdentifiers: units,
          sourceId: SOURCE_CANONICAL_ID,
          sourceVersion: SOURCE_VERSION,
        });
      }

      for (const speciesId of table.species) {
        rules.push({
          id: `regulatory_rule:ca-on-${slug(speciesId.replace("species:", ""))}-${slug(spec)}-${SOURCE_VERSION}`,
          speciesId,
          jurisdictionId: "jurisdiction:ca-on",
          regulatoryGroupId: groupId,
          seasonPhrase,
          limits: {
            daily: limits.daily,
            possession: limits.possession,
            combined: limits.combined,
            combinedWith: limits.combined ? table.species.filter((other) => other !== speciesId) : [],
            combinedWithNames: limits.combined
              ? table.species.filter((other) => other !== speciesId).map((other) => SPECIES_NAMES[other] ?? other)
              : [],
            statedAs: limits.statedAs,
          },
          sourceId: SOURCE_CANONICAL_ID,
          sourceSection: table.section,
          sourceVersion: SOURCE_VERSION,
          sourceYear: SOURCE_YEAR,
          reviewStatus: "PUBLISHED",
        });
      }
    }

    for (const speciesId of table.declaresNoSeasonFor ?? []) {
      for (const [spec] of dataRows) {
        noSeason.push({
          speciesId,
          officialSpec: spec,
          zoneIds: expandWmuSpec(spec, officialIdentifiers).map(zoneCanonicalId),
          statedAs: table.heading,
          sourceId: SOURCE_CANONICAL_ID,
          sourceSection: table.section,
        });
      }
    }
  }

  // Ruffed grouse addresses the whole layer bar one unit; that partition is the
  // evidence the bare-number reading is right, so it is asserted at build time.
  const grouseGroups = rules.filter((rule) => rule.speciesId === "species:ruffed-grouse").map((rule) => rule.regulatoryGroupId);
  const grouseUnits = new Set(
    groups.filter((group) => grouseGroups.includes(group.id)).flatMap((group) => group.officialIdentifiers),
  );
  const uncovered = officialIdentifiers.filter((unit) => !grouseUnits.has(unit));
  const duplicates = grouseGroups
    .map((id) => groups.find((group) => group.id === id).officialIdentifiers)
    .flat()
    .filter((unit, index, all) => all.indexOf(unit) !== index);

  if (duplicates.length) throw new Error(`Ruffed grouse groups overlap on: ${[...new Set(duplicates)].join(", ")}`);

  const bundle = {
    contractVersion: 1,
    // No wall-clock stamp: a rebuild that finds the law unchanged must produce
    // an unchanged file. A diff on every rebuild teaches a reviewer to skip
    // diffs, which is the opposite of what the review workflow needs.
    // Provenance lives in `retrievedAt` (date) and `contentHash`.
    generatedBy: "scripts/build-ontario-regulations.mjs",
    jurisdictionId: "jurisdiction:ca-on",
    source: {
      id: SOURCE_CANONICAL_ID,
      authority: "Ontario Ministry of Natural Resources",
      title: "Small game and furbearing mammals — Ontario Hunting Regulations Summary",
      url: SOURCE_URL,
      sourceVersion: SOURCE_VERSION,
      sourceYear: SOURCE_YEAR,
      retrievedAt: retrievedAtFor(previousBundle, previousBundle?.source?.contentHash, sourceHash, TODAY),
      contentHash: sourceHash,
    },
    officialUnitCount: officialIdentifiers.length,
    unitsWithoutRuffedGrouseRow: uncovered,
    groups,
    rules,
    declaredNoSeason: noSeason,
  };

  const serialised = `${JSON.stringify(bundle, null, 2)}\n`;

  if (checkOnly) {
    let previous;
    try {
      previous = JSON.parse(readFileSync(OUTPUT, "utf8"));
    } catch {
      console.error("No existing bundle to check against.");
      process.exit(1);
    }
    if (previous.source.contentHash !== sourceHash) {
      console.error("The official source has CHANGED since the bundle was built.");
      console.error(`  bundle : ${previous.source.contentHash}`);
      console.error(`  live   : ${sourceHash}`);
      console.error("Rebuild, review the diff, and re-certify before publishing.");
      process.exit(2);
    }
    console.log(`Source unchanged (${sourceHash.slice(0, 23)}...).`);
    return;
  }

  writeFileSync(OUTPUT, serialised);

  // The map badge needs to know which units have ANY certified rule. It runs in
  // the browser, so it gets a short list of identifiers rather than the bundle.
  const certifiedUnits = [...new Set(
    rules.flatMap((rule) => groups.find((group) => group.id === rule.regulatoryGroupId).officialIdentifiers),
  )].sort();
  writeFileSync(
    CERTIFIED_UNITS_OUTPUT,
    `${JSON.stringify({
      generatedBy: "scripts/build-ontario-regulations.mjs",
      jurisdictionId: "jurisdiction:ca-on",
      sourceVersion: SOURCE_VERSION,
      officialUnitCount: officialIdentifiers.length,
      certifiedUnits,
      uncertifiedUnits: officialIdentifiers.filter((unit) => !certifiedUnits.includes(unit)),
    }, null, 2)}\n`,
  );

  console.log("");
  console.log(`Wrote ${OUTPUT}`);
  console.log(`  source hash        ${sourceHash}`);
  console.log(`  official units     ${officialIdentifiers.length}`);
  console.log(`  regulatory groups  ${groups.length}`);
  console.log(`  rules              ${rules.length}`);
  for (const speciesId of [...new Set(rules.map((rule) => rule.speciesId))].sort()) {
    const forSpecies = rules.filter((rule) => rule.speciesId === speciesId);
    const units = new Set(
      forSpecies.flatMap((rule) => groups.find((group) => group.id === rule.regulatoryGroupId).officialIdentifiers),
    );
    console.log(`    ${speciesId.padEnd(30)} ${forSpecies.length} rule(s) over ${units.size} units`);
  }
  console.log(`  wrote ${CERTIFIED_UNITS_OUTPUT}`);
  console.log(`  units with no ruffed grouse row: ${uncovered.length ? uncovered.join(", ") : "none"}`);
  console.log(`  explicit no-season declarations : ${noSeason.length}`);
}

main().catch((error) => {
  console.error(`Build failed: ${error.message}`);
  process.exit(1);
});
