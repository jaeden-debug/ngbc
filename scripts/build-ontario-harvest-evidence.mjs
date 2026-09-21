import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const SOURCE_URL = "https://data.ontario.ca/dataset/d46a91b9-727d-45d6-9e8c-e2b3b265ea5d/resource/239de98d-fbf9-48ef-9f57-c6bd176106c9/download/white-tailed_deer_2025.csv";
export const DATASET_URL = "https://data.ontario.ca/dataset/white-tailed-deer-hunting-activity-and-harvest";
export const EXPECTED_HASH = "sha256:b91f14b15ac238a0b23761ad8ba692641049b77de8355148a1605e297f514a2d";
export const OUTPUT = resolve("content/intelligence/ca-on-white-tailed-deer-harvest.json");
const EXPECTED_HEADER = ["WMU", "Year", "Active Hunters", "Antlered Harvest", "Antlerless Harvest", "Total Harvest"];

export function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell); cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
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
  if (sorted.length === 1) return [0.5];
  return values.map((value) => ((sorted.indexOf(value) + sorted.lastIndexOf(value)) / 2) / (sorted.length - 1));
}

export function buildBundle(csv) {
  const rows = parseCsv(csv);
  const header = rows.shift()?.map((value) => value.trim());
  if (JSON.stringify(header) !== JSON.stringify(EXPECTED_HEADER)) throw new Error(`Unexpected harvest columns: ${JSON.stringify(header)}`);

  if (rows.length !== 2001) throw new Error(`Expected 2,001 source rows, received ${rows.length}`);
  const totalRows = rows.filter(([wmu]) => wmu.trim() === "Total");
  if (totalRows.length !== 18) throw new Error(`Expected 18 provincial total rows, received ${totalRows.length}`);
  const observations = rows.filter(([wmu]) => wmu.trim() !== "Total").map((fields, index) => {
    if (fields.length !== EXPECTED_HEADER.length) throw new Error(`Row ${index + 2} has ${fields.length} fields`);
    const [wmu, year, activeHunters, antleredHarvest, antlerlessHarvest, totalHarvest] = fields.map((value) => value.trim());
    if (!/^\d{1,3}(?:[A-Z](?:-\d)?)?$/.test(wmu)) throw new Error(`Invalid WMU ${wmu} on row ${index + 2}`);
    const numbers = [year, activeHunters, antleredHarvest, antlerlessHarvest, totalHarvest].map(Number);
    if (numbers.some((value) => !Number.isInteger(value) || value < 0)) throw new Error(`Invalid numeric value on row ${index + 2}`);
    if (numbers[2] + numbers[3] !== numbers[4]) throw new Error(`Harvest parts do not sum on row ${index + 2}`);
    return { wmu, year: numbers[0], activeHunters: numbers[1], antleredHarvest: numbers[2], antlerlessHarvest: numbers[3], totalHarvest: numbers[4] };
  }).sort((a, b) => a.year - b.year || a.wmu.localeCompare(b.wmu, "en", { numeric: true }));

  if (observations.length !== 1983) throw new Error(`Expected 1,983 WMU observations, received ${observations.length}`);
  const latestYear = Math.max(...observations.map(({ year }) => year));
  if (latestYear !== 2025) throw new Error(`Expected source through 2025, received ${latestYear}`);
  const current = observations.filter(({ year }) => year === latestYear);
  if (current.length !== 116) throw new Error(`Expected 116 WMUs in 2025, received ${current.length}`);

  const totals = percentileRanks(current.map(({ totalHarvest }) => totalHarvest));
  const perHunterValues = current.map(({ totalHarvest, activeHunters }) => activeHunters ? totalHarvest / activeHunters : 0);
  const perHunterRanks = percentileRanks(perHunterValues);
  const evidence = current.flatMap((row, index) => {
    const common = {
      speciesId: "species:white-tailed-deer",
      jurisdictionId: "jurisdiction:ca-on",
      geographyId: `management_zone:ca-on-wmu-${row.wmu.toLowerCase()}`,
      geographyType: "MANAGEMENT_ZONE",
      sourceId: "source:ca-on-white-tailed-deer-harvest",
      observationPeriod: { from: `${latestYear}-01-01`, through: `${latestYear}-12-31` },
      retrievedAt: "2026-09-21",
      verifiedAt: "2026-09-21",
      confidence: "MODERATE",
      methodology: "Ontario estimates harvest and active hunters from a sample of resident hunter reports; values are subject to statistical error.",
      spatialPrecision: "Ontario Wildlife Management Unit",
      version: String(latestYear),
      superseded: false,
    };
    return [
      { ...common, id: `evidence:ca-on-wmu-${row.wmu.toLowerCase()}-white-tailed-deer-harvest-${latestYear}`, metric: "HARVEST_TOTAL", rawValue: row.totalHarvest, normalizedValue: Number(totals[index].toFixed(6)), unit: "estimated harvested deer", notes: `${row.totalHarvest} estimated deer harvested; ${row.activeHunters} estimated active resident hunters.` },
      { ...common, id: `evidence:ca-on-wmu-${row.wmu.toLowerCase()}-white-tailed-deer-harvest-per-hunter-${latestYear}`, metric: "HARVEST_PER_HUNTER", rawValue: Number(perHunterValues[index].toFixed(6)), normalizedValue: Number(perHunterRanks[index].toFixed(6)), unit: "estimated harvested deer per estimated active resident hunter", notes: `Derived from the authority's estimated total harvest divided by estimated active resident hunters; not a hunter-success probability.` },
    ];
  });

  return {
    schemaVersion: 1,
    methodologyVersion: "opportunity-v1",
    speciesId: "species:white-tailed-deer",
    jurisdictionId: "jurisdiction:ca-on",
    source: {
      id: "source:ca-on-white-tailed-deer-harvest",
      authority: "Ontario Ministry of Natural Resources",
      title: "White-tailed deer hunting activity and harvest",
      url: DATASET_URL,
      resourceUrl: SOURCE_URL,
      datasetIdentifier: "d46a91b9-727d-45d6-9e8c-e2b3b265ea5d",
      licence: "Open Government Licence – Ontario",
      licenceUrl: "https://www.ontario.ca/page/open-government-licence-ontario",
      sourceHash: sha256(csv),
      retrievedAt: "2026-09-21",
      verifiedAt: "2026-09-21",
    },
    coverage: "PARTIAL_DATA",
    latestObservationYear: latestYear,
    limitations: [
      "The authority says harvest and active-hunter values are estimates from a sample of resident hunters and are subject to statistical error.",
      "Historical harvest is evidence about past reported hunting outcomes, not a claim that deer are currently present.",
      "The evidence does not determine hunting legality, land access, or permission to hunt.",
      "Only WMUs with a published 2025 record receive evidence; absence is no-data, not zero harvest.",
    ],
    observations,
    evidence,
  };
}

export async function fetchSource(fetcher = fetch) {
  const response = await fetcher(SOURCE_URL, { headers: { "user-agent": "NorthGroundBushcraft/1.0 (+https://www.northgroundbushcraft.com)" }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Ontario harvest source returned HTTP ${response.status}`);
  return response.text();
}

export async function main(argv = process.argv.slice(2)) {
  const check = argv.includes("--check");
  const csv = await fetchSource();
  const hash = sha256(csv);
  if (hash !== EXPECTED_HASH) throw new Error(`Ontario harvest source changed: expected ${EXPECTED_HASH}, received ${hash}. Review the diff before publishing.`);
  const output = `${JSON.stringify(buildBundle(csv), null, 2)}\n`;
  if (check) {
    const existing = await readFile(OUTPUT, "utf8");
    if (existing !== output) throw new Error("Committed Ontario harvest evidence does not match the authoritative source");
    return;
  }
  await writeFile(OUTPUT, output);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = message.startsWith("Ontario harvest source changed:") ? 2 : 1;
  });
}
