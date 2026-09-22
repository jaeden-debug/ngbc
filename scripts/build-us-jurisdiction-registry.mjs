#!/usr/bin/env node
/**
 * Build the United States half of the national coverage registry from the
 * research inventory.
 *
 *   node scripts/build-us-jurisdiction-registry.mjs          write
 *   node scripts/build-us-jurisdiction-registry.mjs --check  exit 3 if the committed file differs
 *
 * `research/hunting/us/` holds the 51-row readiness matrix (50 states and D.C.)
 * and the official-source manifest. This turns them into the structure the
 * coverage report reads — identity, the authority's own management terms, the
 * official hub, the research blockers — so fifty-one entries are not retyped
 * by hand and cannot drift from the research they came from.
 *
 * It declares STRUCTURE only. Nothing here says a state is covered: spatial and
 * regulatory status for a state North Ground has certified are declared in
 * `src/lib/hunt/united-states/registry.ts`, next to the evidence, and every
 * count is computed from certified bundles by the report.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MATRIX = join(ROOT, "research/hunting/us/state-coverage-matrix.csv");
const MANIFEST = join(ROOT, "research/hunting/us/source-manifest.csv");
const OUT = join(ROOT, "src/lib/hunt/united-states/jurisdictions.generated.json");

/** RFC 4180 CSV, which the research files are: quoted fields may hold commas. */
export function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (character !== "\r") field += character;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter((entry) => entry.some((cell) => cell !== ""));
  return body.map((cells) => {
    if (cells.length !== header.length) throw new Error(`CSV row has ${cells.length} cells; header has ${header.length}: ${cells.slice(0, 3).join(",")}`);
    return Object.fromEntries(header.map((key, index) => [key, cells[index]]));
  });
}

export function buildRegistry(matrixText, manifestText) {
  const matrix = parseCsv(matrixText);
  const manifest = parseCsv(manifestText);
  if (matrix.length !== 51) throw new Error(`Research matrix has ${matrix.length} rows; expected 50 states and D.C.`);
  const codes = new Set(matrix.map((row) => row.subdivision_code));
  if (codes.size !== 51) throw new Error("Research matrix repeats a subdivision code");

  const sourcesFor = (jurisdictionId) => manifest.filter((row) => row.jurisdiction_id === jurisdictionId);
  const jurisdictions = matrix
    .map((row) => {
      const sources = sourcesFor(row.jurisdiction_id);
      const hub = sources.find((source) => source.scope === "STATE_OFFICIAL_HUB");
      if (!hub) throw new Error(`${row.jurisdiction_id} has no official hub in the source manifest`);
      if (!/^https:\/\//.test(hub.url)) throw new Error(`${row.jurisdiction_id} hub is not https: ${hub.url}`);
      return {
        id: row.jurisdiction_id,
        code: `US-${row.subdivision_code}`,
        name: row.jurisdiction_name,
        kind: row.subdivision_code === "DC" ? "district" : "state",
        authorityId: row.authority_id,
        managementGeographies: row.management_geographies,
        officialSourceUrl: hub.url,
        research: {
          depth: row.research_depth,
          gisStatus: row.gis_status,
          gisLegalStanding: row.gis_legal_standing,
          gisLicensing: row.gis_licensing,
          implementationReadiness: row.implementation_readiness,
          engineCompatibility: row.engine_compatibility,
          engineGaps: row.engine_gaps,
          annualArtifact: row.annual_artifact,
          reviewedAt: row.reviewed_at,
        },
        sourceLeads: sources
          .filter((source) => source.scope !== "STATE_OFFICIAL_HUB")
          .map((source) => ({ title: source.title, url: source.url, legalStanding: source.legal_standing })),
        knownGaps: [row.known_blockers, `Federal dependencies: ${row.federal_land_dependencies}`].filter(Boolean),
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  const federalSources = manifest.filter((row) => row.jurisdiction_id === "jurisdiction:us-federal");
  if (!federalSources.length) throw new Error("The source manifest has no federal rows");
  return {
    generatedFrom: ["research/hunting/us/state-coverage-matrix.csv", "research/hunting/us/source-manifest.csv"],
    jurisdictions,
    federal: {
      id: "jurisdiction:us-federal",
      code: "US-FEDERAL",
      name: "United States (federal)",
      kind: "federal",
      sources: federalSources.map((source) => ({ title: source.title, url: source.url, scope: source.scope, legalStanding: source.legal_standing })),
    },
  };
}

function render(registry) {
  return `${JSON.stringify(registry, null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const next = render(buildRegistry(readFileSync(MATRIX, "utf8"), readFileSync(MANIFEST, "utf8")));
  if (process.argv.includes("--check")) {
    let current = "";
    try { current = readFileSync(OUT, "utf8"); } catch { /* absent */ }
    if (current !== next) {
      console.error("jurisdictions.generated.json is not what the research inventory produces. Run node scripts/build-us-jurisdiction-registry.mjs.");
      process.exit(3);
    }
    console.log("U.S. jurisdiction registry matches the research inventory.");
  } else {
    writeFileSync(OUT, next);
    console.log(`Wrote ${OUT}`);
  }
}
