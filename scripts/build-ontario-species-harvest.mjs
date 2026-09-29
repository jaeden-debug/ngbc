import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertZonesExist,
  buildEvidence,
  count,
  fetchSource,
  parseCsv,
  partitionLargerAreas,
  sha256,
} from "./ontario-harvest.mjs";

/**
 * Ontario's remaining openly-licensed harvest datasets.
 *
 * Every one is published on data.ontario.ca under the Open Government Licence –
 * Ontario, the same licence as the deer dataset already served, and each was
 * recorded in `content/intelligence/source-registry.json` with its resource
 * URL, its resolution and its pitfalls before any of this was written.
 *
 * WHAT IS DELIBERATELY NOT HERE, and why, because an absence is the part of a
 * coverage claim nobody checks:
 *
 *   WOLF AND COYOTE. Ontario publishes one file with a single "Harvest" column
 *   covering both species together. Splitting it would invent two numbers the
 *   authority never published, and attributing the combined figure to either
 *   species would overstate that one. It stays unserved with that reason
 *   recorded, not because of a licence — the licence is fine.
 *
 *   ELK. Openly licensed and perfectly good, and reported by Elk Harvest Area
 *   (57-01 to 63-08), a geography North Ground does not hold. Mapping it onto
 *   Wildlife Management Units would draw a boundary the authority never drew.
 */

const RETRIEVED_AT = "2026-09-29";
const METHODOLOGY = "Ontario estimates harvest and active hunters from a sample of resident hunter reports; values are subject to statistical error.";

/**
 * One entry per species. `columns` is asserted against the file's own header,
 * so a column the authority renames stops the build rather than shifting every
 * figure one place to the left.
 */
export const DATASETS = [
  {
    slug: "moose",
    speciesId: "species:moose",
    output: "content/intelligence/ca-on-moose-harvest.json",
    sourceId: "source:ca-on-moose-harvest",
    datasetIdentifier: "deb6e8be-5b71-4d4e-8d50-1ae08c8dbf3c",
    title: "Moose hunting activity and harvests",
    datasetUrl: "https://data.ontario.ca/dataset/moose-hunting-activity-and-harvests",
    resourceUrl: "https://data.ontario.ca/dataset/deb6e8be-5b71-4d4e-8d50-1ae08c8dbf3c/resource/61d62c0e-784a-4061-8bbe-8ee8a42afde7/download/moose_2025.csv",
    expectedHash: "sha256:1526860683d4395605bd4efd7785272608f4d33bb4d12c92a87d32a561a1aa5c",
    columns: ["WMU", "Year", "Active Hunters", "Bull Harvest", "Cow Harvest", "Calf Harvest", "Total Harvest"],
    unit: "estimated harvested moose",
    /* The parts the authority publishes, kept beside the total. Sex and age
       classes are regulatory facts as well as biological ones, and discarding
       them here would mean re-fetching the source to answer a later question. */
    figuresOf: (fields, row) => {
      const [, , activeHunters, bull, cow, calf, total] = fields;
      const figures = {
        activeHunters: count(activeHunters, row),
        bullHarvest: count(bull, row),
        cowHarvest: count(cow, row),
        calfHarvest: count(calf, row),
        totalHarvest: count(total, row),
      };
      if ([figures.bullHarvest, figures.cowHarvest, figures.calfHarvest].every((value) => value !== null)
        && figures.bullHarvest + figures.cowHarvest + figures.calfHarvest !== figures.totalHarvest) {
        throw new Error(`Moose harvest parts do not sum on row ${row}`);
      }
      return figures;
    },
    limitations: [
      "The authority says harvest and active-hunter values are estimates from a sample of resident hunters and are subject to statistical error.",
      "Historical harvest is evidence about past reported hunting outcomes, not a claim that moose are currently present.",
      "Active hunters are carried as hunting effort and never move the heat shade; how many people hunted a unit is not how many animals live in it.",
      "The evidence does not determine hunting legality, land access, or permission to hunt.",
      "Only units with a published record for the latest year receive evidence; absence is no-data, not zero harvest.",
    ],
  },
  {
    slug: "american-black-bear",
    speciesId: "species:american-black-bear",
    output: "content/intelligence/ca-on-american-black-bear-harvest.json",
    sourceId: "source:ca-on-black-bear-harvest",
    datasetIdentifier: "c14b7d2b-7c42-4727-92c6-99f140ed3a57",
    title: "Black bear hunting activity and harvests",
    datasetUrl: "https://data.ontario.ca/dataset/black-bear-hunting-activity-and-harvests",
    resourceUrl: "https://data.ontario.ca/dataset/c14b7d2b-7c42-4727-92c6-99f140ed3a57/resource/7dd6328e-74cc-4291-a041-2345cf7c6186/download/black_bear_2025.csv",
    expectedHash: "sha256:e5b7e0151d601978230be120c85815adcbd4235050821ea7743c0c8dd606879b",
    columns: ["WMU", "Year", "Active Hunters", "Harvest"],
    unit: "estimated harvested black bears",
    figuresOf: (fields, row) => {
      const [, , activeHunters, harvest] = fields;
      return { activeHunters: count(activeHunters, row), totalHarvest: count(harvest, row) };
    },
    limitations: [
      "The authority says harvest and active-hunter values are estimates from a sample of resident hunters and are subject to statistical error.",
      "Historical harvest is evidence about past reported hunting outcomes, not a claim that black bears are currently present.",
      "Active hunters are carried as hunting effort and never move the heat shade; how many people hunted a unit is not how many animals live in it.",
      "The evidence does not determine hunting legality, land access, or permission to hunt.",
      "Only units with a published record for the latest year receive evidence; absence is no-data, not zero harvest.",
    ],
  },
  {
    slug: "wild-turkey",
    speciesId: "species:wild-turkey",
    output: "content/intelligence/ca-on-wild-turkey-harvest.json",
    sourceId: "source:ca-on-wild-turkey-harvest",
    datasetIdentifier: "187dbcbc-7cc5-4a41-8e70-f2fa838f88d6",
    title: "Wild turkey harvests",
    datasetUrl: "https://data.ontario.ca/dataset/wild-turkey-harvests",
    resourceUrl: "https://data.ontario.ca/dataset/187dbcbc-7cc5-4a41-8e70-f2fa838f88d6/resource/088a23b8-5858-4079-a035-715663f3ed00/download/wild_turkey_2025.csv",
    expectedHash: "sha256:6898e6d1024509c95b7436c26eb7172a6aa8c19af6388985a3674022380837e4",
    columns: ["WMU", "Year", "Spring Harvest", "Fall Harvest", "Total Harvest"],
    unit: "estimated harvested wild turkeys",
    /* No hunter count is published, so there is no denominator and no rate.
       This is the case the derivation module exists for: the honest name for
       the number that remains is a total. */
    figuresOf: (fields, row) => {
      const [, , spring, fall, total] = fields;
      return {
        springHarvest: count(spring, row),
        fallHarvest: count(fall, row),
        totalHarvest: count(total, row),
      };
    },
    limitations: [
      "The authority says its harvest figures are estimates and are subject to statistical error.",
      "No hunter count is published for wild turkey, so no rate is derived; the evidence is harvest volume only.",
      "The authority suppresses some seasonal figures. A suppressed cell is withheld data, never zero.",
      "Historical harvest is evidence about past reported hunting outcomes, not a claim that wild turkeys are currently present.",
      "The evidence does not determine hunting legality, land access, or permission to hunt.",
    ],
  },
];

export function buildBundle(dataset, csv) {
  const rows = parseCsv(csv);
  const header = rows.shift()?.map((value) => value.trim());
  if (JSON.stringify(header) !== JSON.stringify(dataset.columns)) {
    throw new Error(`Unexpected ${dataset.slug} columns: ${JSON.stringify(header)}`);
  }

  const observations = rows
    .filter((fields) => fields[0].trim() !== "Total")
    .map((fields, index) => {
      const row = index + 2;
      if (fields.length !== dataset.columns.length) throw new Error(`Row ${row} has ${fields.length} fields`);
      const wmu = fields[0].trim();
      if (!/^\d{1,3}(?:[A-Z](?:-\d)?)?$/.test(wmu)) throw new Error(`Invalid WMU ${wmu} on row ${row}`);
      const year = Number(fields[1].trim());
      if (!Number.isInteger(year) || year < 1950 || year > 2100) throw new Error(`Invalid year on row ${row}`);
      return { wmu, year, figures: dataset.figuresOf(fields.map((value) => value.trim()), row) };
    })
    .sort((a, b) => a.year - b.year || a.wmu.localeCompare(b.wmu, "en", { numeric: true }));

  const year = Math.max(...observations.map((observation) => observation.year));
  /* A unit whose TOTAL the authority suppressed has no figure to rank, and
     ranking it as zero would publish "nothing taken here" over withheld data. */
  const current = observations.filter((observation) => observation.year === year && observation.figures.totalHarvest !== null);
  if (!current.length) throw new Error(`No usable ${dataset.slug} records for ${year}`);

  const { mapped, larger } = partitionLargerAreas(current, dataset.sourceId, year);
  if (!mapped.length) throw new Error(`No ${dataset.slug} record maps to a published unit`);

  const evidence = buildEvidence({
    mapped,
    speciesId: dataset.speciesId,
    sourceId: dataset.sourceId,
    slug: dataset.slug,
    year,
    retrievedAt: RETRIEVED_AT,
    unit: dataset.unit,
    methodology: METHODOLOGY,
  });
  assertZonesExist(evidence);

  return {
    schemaVersion: 1,
    /* The bundle's own NORMALIZATION methodology: percentile rank within this
       dataset's units. How those ranks are combined into a shade is the
       composite methodology, versioned separately in `methodology.ts`. */
    methodologyVersion: "opportunity-v1",
    speciesId: dataset.speciesId,
    jurisdictionId: "jurisdiction:ca-on",
    source: {
      id: dataset.sourceId,
      authority: "Ontario Ministry of Natural Resources",
      title: dataset.title,
      url: dataset.datasetUrl,
      resourceUrl: dataset.resourceUrl,
      datasetIdentifier: dataset.datasetIdentifier,
      licence: "Open Government Licence – Ontario",
      licenceUrl: "https://www.ontario.ca/page/open-government-licence-ontario",
      attribution: "Contains information licensed under the Open Government Licence – Ontario.",
      sourceHash: sha256(csv),
      retrievedAt: RETRIEVED_AT,
      verifiedAt: RETRIEVED_AT,
    },
    coverage: "PARTIAL_DATA",
    latestObservationYear: year,
    limitations: larger.length
      ? [...dataset.limitations, `${larger.length} area${larger.length === 1 ? " is" : "s are"} reported by the authority at a larger area than its layer publishes. They are carried in reportedAtLargerArea with the authority's figures, are never apportioned across sub-units, and are excluded from the ranked pool and from opportunity classes.`]
      : dataset.limitations,
    observations,
    evidence,
    reportedAtLargerArea: larger,
  };
}

export async function main(argv = process.argv.slice(2)) {
  const check = argv.includes("--check");
  for (const dataset of DATASETS) {
    const csv = await fetchSource(dataset.resourceUrl);
    const hash = sha256(csv);
    if (dataset.expectedHash && hash !== dataset.expectedHash) {
      throw new Error(`Ontario ${dataset.slug} source changed: expected ${dataset.expectedHash}, received ${hash}. Review the diff before publishing.`);
    }
    const output = `${JSON.stringify(buildBundle(dataset, csv), null, 2)}\n`;
    const path = resolve(dataset.output);
    if (check) {
      const existing = await readFile(path, "utf8");
      if (existing !== output) throw new Error(`Committed Ontario ${dataset.slug} evidence does not match the authoritative source`);
    } else {
      await writeFile(path, output);
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = /source changed:/.test(message) ? 2 : 1;
  });
}
