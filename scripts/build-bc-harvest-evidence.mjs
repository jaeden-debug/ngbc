#!/usr/bin/env node
/**
 * British Columbia big game harvest evidence, per Management Unit.
 *
 *   node scripts/build-bc-harvest-evidence.mjs            rebuild the bundles
 *   node scripts/build-bc-harvest-evidence.mjs --check    fail if they would change
 *
 * One file from the authority (Open Government Licence - British Columbia)
 * carries hunters, hunter days and kills for resident and non-resident hunters
 * separately, 1976 to 2024. Harvest, effort and the two ratios are kept as
 * separate components with the authority's own units: the province publishes no
 * success rate, so none is presented as one.
 *
 * The file codes a unit as an integer (101 is Management Unit 1-01). Region
 * rollups (100, 200, ... 900) are not units and are recorded as such rather
 * than drawn. A code that matches no published unit is never given an id.
 *
 * Evidence is about past reported hunting outcomes. It is not a claim that
 * animals are present, and it says nothing about whether hunting is permitted.
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import certifiedZones from "../fixtures/hunt/ca-bc-zone-certification.json" with { type: "json" };

const DATASET_URL = "https://catalogue.data.gov.bc.ca/dataset/big-game-harvest-statistics-1976-to-2024";
const SOURCE_URL =
  "https://catalogue.data.gov.bc.ca/dataset/f2303645-5952-4766-bd5c-3b9b50dda1ca/resource/ea1505f6-77ab-4838-b4a9-309ec55a3c20/download/big-game-harvest-statistics-1976-to-2024-wmu.csv";
const EXPECTED_HASH = "sha256:e7cdcc1c069b49262d8c3098e51bd7549adc9596ad7aa7bdb4edce121e744016";
const LATEST_YEAR = 2024;

const OFFICIAL_UNITS = new Set(certifiedZones.officialIdentifiers);

/** The authority's species codes, and the canonical species each one is. */
export const SPECIES = {
  BEAB: "species:american-black-bear",
  BOBC: "species:bobcat",
  CARI: "species:caribou",
  DEMU: "species:mule-deer",
  DEWT: "species:white-tailed-deer",
  ELK: "species:elk",
  LYNX: "species:canada-lynx",
  MOOS: "species:moose",
  WOLF: "species:gray-wolf",
};

/**
 * Codes the file carries that North Ground holds no species record for:
 * cougar, mountain goat, mountain sheep and grizzly bear. Recorded rather than
 * silently skipped. Grizzly hunting has been closed in British Columbia since
 * 2017, so its rows are historical whatever the library holds.
 */
export const SPECIES_WITHOUT_RECORD = { COUG: "cougar", GOAT: "mountain goat", SHEE: "mountain sheep", BEAG: "grizzly bear" };

export const sha256 = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;

/** "101" is Management Unit 1-01. Anything else is not a unit code. */
export function designationOf(code) {
  const value = String(code ?? "").trim().toUpperCase();
  if (!/^[1-8]\d{2}$/.test(value)) return null;
  const unit = Number(value.slice(1));
  return unit ? `${value[0]}-${unit}` : null;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell); cell = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export function percentileRanks(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length <= 1) return values.map(() => 0.5);
  return values.map((value) => ((sorted.indexOf(value) + sorted.lastIndexOf(value)) / 2) / (sorted.length - 1));
}

const count = (value) => {
  const text = String(value ?? "").trim();
  if (text === "") return 0;
  const number = Number(text);
  if (!Number.isInteger(number) || number < 0) throw new Error(`Unreadable count "${value}"`);
  return number;
};

export function buildBundles(csv) {
  const rows = parseCsv(csv.replace(/^﻿/, ""));
  const header = rows.shift()?.map((value) => value.trim());
  const expected = ["HUNT YEAR", "SPECIES", "CI", "WMU", "REGION", "RESIDENT HUNTERS", "RESIDENT DAYS", "RESIDENT KILLS"];
  if (JSON.stringify(header?.slice(0, 8)) !== JSON.stringify(expected)) throw new Error(`Unexpected columns: ${JSON.stringify(header)}`);
  const at = (fields, name) => fields[header.indexOf(name)];

  const current = rows.filter((fields) => at(fields, "HUNT YEAR").trim() === String(LATEST_YEAR));
  if (!current.length) throw new Error(`No ${LATEST_YEAR} rows in the authority's file`);

  const bundles = [];
  const rollups = new Set();

  for (const [code, speciesId] of Object.entries(SPECIES)) {
    const forSpecies = current.filter((fields) => at(fields, "SPECIES").trim().toUpperCase() === code);
    if (!forSpecies.length) throw new Error(`The authority published no ${LATEST_YEAR} rows for ${code}`);

    const units = [];
    for (const fields of forSpecies) {
      const reported = at(fields, "WMU").trim();
      const designation = designationOf(reported);
      /* A code that is not a unit is a rollup the authority adds for reading:
         one per region (100 to 900), and two for region 7, which the province
         manages as 7A Omineca and 7B Peace and rolls up as 770 and 780. Every
         region has exactly one such code and region 7 has none of its own, so
         these are totals, not units. They are recorded, never drawn. */
      if (!designation || !OFFICIAL_UNITS.has(designation)) { rollups.add(reported); continue; }
      const hunters = count(at(fields, "RESIDENT HUNTERS")) + count(at(fields, "NON-RESIDENT HUNTERS"));
      const days = count(at(fields, "RESIDENT DAYS")) + count(at(fields, "NON-RESIDENT DAYS"));
      const kills = count(at(fields, "RESIDENT KILLS")) + count(at(fields, "NON-RESIDENT KILLS"));
      units.push({ designation, hunters, days, kills, compulsoryInspection: at(fields, "CI").trim().toLowerCase() === "yes" });
    }
    if (!units.length) throw new Error(`No ${code} row named a published Management Unit`);

    const harvestRanks = percentileRanks(units.map(({ kills }) => kills));
    const perHunter = units.map(({ kills, hunters }) => (hunters ? kills / hunters : 0));
    const perHunterRanks = percentileRanks(perHunter);
    const perHundredDays = units.map(({ kills, days }) => (days ? (kills / days) * 100 : 0));
    const perDayRanks = percentileRanks(perHundredDays);

    const evidence = units.flatMap((unit, index) => {
      const id = (metric) => `evidence:ca-bc-mu-${unit.designation}-${speciesId.slice("species:".length)}-${metric}-${LATEST_YEAR}`;
      const common = {
        speciesId,
        jurisdictionId: "jurisdiction:ca-bc",
        geographyId: `management_zone:ca-bc-mu-${unit.designation}`,
        geographyType: "MANAGEMENT_ZONE",
        sourceId: "source:ca-bc-big-game-harvest",
        observationPeriod: { from: `${LATEST_YEAR}-01-01`, through: `${LATEST_YEAR}-12-31` },
        retrievedAt: RETRIEVED_AT,
        verifiedAt: RETRIEVED_AT,
        /* The authority's own flag: a compulsorily inspected species is counted,
           the rest are estimated from its hunter sample. */
        confidence: unit.compulsoryInspection ? "HIGH" : "MODERATE",
        methodology: unit.compulsoryInspection
          ? "British Columbia records this species through compulsory inspection; figures combine resident and non-resident hunters."
          : "British Columbia estimates hunters, hunter days and kills from its hunter sample survey; figures combine resident and non-resident hunters and are subject to sampling error.",
        spatialPrecision: "British Columbia Management Unit",
        version: String(LATEST_YEAR),
        superseded: false,
      };
      return [
        { ...common, id: id("harvest"), metric: "HARVEST_TOTAL", rawValue: unit.kills, normalizedValue: Number(harvestRanks[index].toFixed(6)), unit: "animals killed", notes: `${unit.kills} killed by ${unit.hunters} hunters over ${unit.days} hunter days.` },
        { ...common, id: id("hunters"), metric: "HUNTER_COUNT", rawValue: unit.hunters, normalizedValue: Number(harvestRanks[index].toFixed(6)), unit: "hunters", notes: "Resident and non-resident hunters, as the authority reports them." },
        { ...common, id: id("hunter-days"), metric: "HUNTER_DAYS", rawValue: unit.days, normalizedValue: Number(harvestRanks[index].toFixed(6)), unit: "hunter days", notes: "Resident and non-resident hunter days, as the authority reports them." },
        { ...common, id: id("harvest-per-hunter"), metric: "HARVEST_PER_HUNTER", rawValue: Number(perHunter[index].toFixed(6)), normalizedValue: Number(perHunterRanks[index].toFixed(6)), unit: "animals per hunter", notes: "Derived from the authority's own kills and hunters. It is not a hunter-success probability, which British Columbia does not publish." },
        { ...common, id: id("harvest-per-100-hunter-days"), metric: "HARVEST_PER_EFFORT", rawValue: Number(perHundredDays[index].toFixed(6)), normalizedValue: Number(perDayRanks[index].toFixed(6)), unit: "animals per 100 hunter days", notes: "Derived from the authority's own kills and hunter days." },
      ];
    });

    for (const record of evidence) {
      const designation = record.geographyId.slice("management_zone:ca-bc-mu-".length);
      if (!OFFICIAL_UNITS.has(designation)) throw new Error(`Evidence names ${record.geographyId}, which the authority's layer does not publish`);
    }

    bundles.push({
      file: `ca-bc-${speciesId.slice("species:".length)}-harvest.json`,
      bundle: {
        schemaVersion: 1,
        methodologyVersion: "opportunity-v1",
        speciesId,
        jurisdictionId: "jurisdiction:ca-bc",
        source: {
          id: "source:ca-bc-big-game-harvest",
          authority: "British Columbia Ministry of Water, Land and Resource Stewardship, Wildlife and Habitat Branch",
          title: "Big Game Harvest Statistics 1976 to 2024",
          url: DATASET_URL,
          resourceUrl: SOURCE_URL,
          datasetIdentifier: "f2303645-5952-4766-bd5c-3b9b50dda1ca",
          licence: "Open Government Licence – British Columbia",
          licenceUrl: "https://www2.gov.bc.ca/gov/content?id=A519A56BC2BF44E4A008B33FCF527F61",
          attribution: "Contains information licensed under the Open Government Licence – British Columbia.",
          sourceHash: sha256(csv),
          retrievedAt: RETRIEVED_AT,
          verifiedAt: RETRIEVED_AT,
        },
        coverage: "PARTIAL_DATA",
        latestObservationYear: LATEST_YEAR,
        limitations: [
          "Harvest, hunters and hunter days are the authority's own figures. The two ratios are derived from them and are stated as such; British Columbia publishes no hunter success rate, so none is shown.",
          "Figures combine resident and non-resident hunters.",
          "Except where the authority's compulsory-inspection flag is set, values are estimates from its hunter sample survey and carry sampling error.",
          "Harvest is evidence about past reported hunting outcomes, not a claim that animals are present now.",
          "The evidence does not determine hunting legality, land access, or permission to hunt.",
          "Only Management Units with a published 2024 record for this species receive evidence; absence is no-data, not zero harvest.",
          "The authority's regional rollup codes (100 to 900, and 770 and 780 for regions 7A Omineca and 7B Peace) are totals rather than units and carry no evidence.",
        ],
        evidence,
      },
    });
  }

  return { bundles, rollups: [...rollups].sort() };
}

let RETRIEVED_AT = "2026-09-22";

export async function fetchSource(fetcher = fetch) {
  const response = await fetcher(SOURCE_URL, { headers: { "user-agent": "NorthGroundBushcraft/1.0 (+https://www.northgroundbushcraft.com)" }, signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`British Columbia harvest source returned HTTP ${response.status}`);
  return response.text();
}

export async function main(argv = process.argv.slice(2)) {
  const check = argv.includes("--check");
  const csv = await fetchSource();
  const hash = sha256(csv);
  if (EXPECTED_HASH !== "sha256:PENDING" && hash !== EXPECTED_HASH) {
    throw new Error(`British Columbia harvest source changed: expected ${EXPECTED_HASH}, received ${hash}. Review the diff before publishing.`);
  }
  const { bundles, rollups } = buildBundles(csv);
  for (const { file, bundle } of bundles) {
    const path = new URL(`../content/intelligence/${file}`, import.meta.url);
    const output = `${JSON.stringify(bundle, null, 2)}\n`;
    if (check) {
      const existing = await readFile(path, "utf8");
      if (existing !== output) throw new Error(`Committed ${file} does not match the authoritative source`);
    } else {
      await writeFile(path, output);
    }
  }
  if (!check) {
    console.log(`source hash ${hash}`);
    console.log(`${bundles.length} species; rollup codes not units: ${rollups.join(", ")}`);
    for (const { file, bundle } of bundles) console.log(`  ${file}: ${bundle.evidence.length} records over ${bundle.evidence.length / 5} units`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
