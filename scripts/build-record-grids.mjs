#!/usr/bin/env node
/**
 * Recorded-presence grids: where openly licensed occurrence records place
 * each species, as squares. Certified into `records-registry.json`.
 *
 *   node scripts/build-record-grids.mjs [--in .research/gbif] [--check]
 *
 * WHAT A SQUARE MEANS. At least MIN_RECORDS records of the species inside it,
 * since 2000, whose own licence permits commercial reuse (CC0, CC BY 4.0),
 * as GBIF aggregates them (`fetch-gbif-presence.mjs` reads them). "Seen here",
 * and nothing more: not how many, not how often, not where it is scarce.
 * Where people look and share records shapes this layer as much as where
 * animals live, which is why it has its own tier (T3_RECORDED_PRESENCE), its
 * own paint (a hatch, off the heat ramp) and its own words in the legend.
 *
 * THE RULES, DECLARED BEFORE ANY DATA WAS READ:
 *   - a square is drawn with at least 2 records, so one misidentified or
 *     misplaced record cannot draw a square on its own;
 *   - a species gets a layer with at least 30 open records and 5 drawn
 *     squares; below that it is declined, with its counts, in the registry.
 *   - squares are GBIF's own (0.3515625°, 64/4096 of a zoom-3 EPSG:4326
 *     tile), never smoothed, never filled between.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const IN = args.includes("--in") ? args[args.indexOf("--in") + 1] : ".research/gbif";
const CHECK = args.includes("--check");
const OUT_DIR = "content/intelligence/records";
const REGISTRY = "content/intelligence/records-registry.json";
const METHODOLOGY = { id: "methodology:recorded-presence-grid", version: "1.0.0", effectiveFrom: "2026-09-30" };
export const MIN_RECORDS = 2;
export const MIN_SPECIES_RECORDS = 30;
export const MIN_SQUARES = 5;
const STEP = 0.3515625;
/* Aligned to GBIF's own squares: west edge -180, rows counted north from 90. */
const GRID = { west: -180, south: 90 - 214 * STEP, lonStep: STEP, latStep: STEP, cols: 384, rows: 214 };

const sha = (text) => `sha256:${createHash("sha256").update(text).digest("hex")}`;

function build() {
  const files = existsSync(IN) ? readdirSync(IN).filter((f) => f.endsWith(".json") && !f.startsWith("_")) : [];
  if (!files.length) throw new Error(`no records read in ${IN}; run the research runner's gbif-presence source first`);
  const titles = existsSync(join(IN, "_datasets.json")) ? JSON.parse(readFileSync(join(IN, "_datasets.json"), "utf8")) : {};
  const surfaces = [];
  const declined = [];
  const artifacts = [];
  const credited = new Map();
  for (const file of files.sort()) {
    const read = JSON.parse(readFileSync(join(IN, file), "utf8"));
    if (read.refused || !read.squares) {
      const failed = String(read.refused ?? "").startsWith("read failed");
      declined.push({
        speciesId: read.speciesId,
        reason: failed ? "READ_FAILED" : "NO_TAXON_MATCH",
        detail: failed ? `GBIF did not answer for ${read.scientificName}: ${read.refused.replace(/^read failed: /, "")}` : `GBIF holds no exact name match for ${read.scientificName}.`,
      });
      continue;
    }
    /* Ground the service would not answer about cannot be drawn as ground
       with no records, so a species with any unread tile is declined. */
    if (read.unreadTiles?.length) {
      declined.push({
        speciesId: read.speciesId,
        reason: "INCOMPLETE_READ",
        detail: `GBIF refused ${read.unreadTiles.length} of the tiles over Canada and the United States for ${read.scientificName} (${read.unreadTiles.map((t) => t.tile).join(", ")}); a partial grid would draw unread ground as ground with no records.`,
      });
      continue;
    }
    const cells = new Map();
    for (const [west, south, records] of read.squares) {
      const col = Math.round((west - GRID.west) / STEP);
      const row = Math.round((south - GRID.south) / STEP);
      if (row < 0 || row >= GRID.rows || col < 0 || col >= GRID.cols) continue;
      const key = row * GRID.cols + col;
      cells.set(key, (cells.get(key) ?? 0) + records);
    }
    const drawn = [...cells].filter(([, records]) => records >= MIN_RECORDS).sort((a, b) => a[0] - b[0]);
    const slug = read.speciesId.replace("species:", "");
    if (read.openRecordCount < MIN_SPECIES_RECORDS || drawn.length < MIN_SQUARES) {
      declined.push({
        speciesId: read.speciesId,
        reason: "TOO_FEW_OPEN_RECORDS",
        detail: `${read.openRecordCount} openly licensed records in Canada and the United States since 2000, ${drawn.length} squares with ${MIN_RECORDS} or more; a layer needs ${MIN_SPECIES_RECORDS} records and ${MIN_SQUARES} squares.`,
      });
      continue;
    }
    for (const { datasetKey, count } of read.datasets) credited.set(datasetKey, (credited.get(datasetKey) ?? 0) + count);
    const through = read.retrievedAt;
    const artifact = {
      id: `surface:records-${slug}-gbif-${through.slice(0, 4)}`,
      speciesId: read.speciesId,
      metric: "RECORDS_IN_SQUARE",
      unit: "shared records",
      sitesSurveyed: drawn.length,
      sitesDetected: drawn.length,
      source: {
        authority: `GBIF.org — ${read.datasets.length} contributing ${read.datasets.length === 1 ? "dataset" : "datasets"}`,
        title: `Occurrence records of ${read.scientificName}, openly licensed (CC0 and CC BY 4.0), Canada and the United States, 2000 onward`,
        url: read.portalQuery,
        licence: "Records under CC0 1.0 and CC BY 4.0 only; records under non-commercial licences are excluded",
        attribution: `Contains occurrence records published through GBIF.org (retrieved ${through}) under CC0 1.0 and CC BY 4.0 by the ${read.datasets.length} datasets credited in content/intelligence/records/datasets.json.`,
        retrievedAt: through,
        verifiedAt: through,
      },
      limitations: [
        "A record says an animal was seen there. It says nothing about how many live there, and where people look and share records shapes this layer as much as where the animals are.",
        "A square with no record is ground nobody shared a record from. It is not a finding that the species is absent.",
        `A square is drawn only with ${MIN_RECORDS} or more records, so a single misidentified or misplaced record cannot draw one; records can still be wrong.`,
        "Records from every season since 2000 are combined. For a species that migrates, being recorded in one season is not being there in another.",
        "Records published under non-commercial licences — including most iNaturalist observations — are excluded, so the layer shows fewer squares than exist.",
      ],
      observationPeriod: { from: "2000-01-01", through },
      methodology: { ...METHODOLOGY },
      methodologyStatedAs: `Occurrence records matched to ${read.scientificName} (GBIF taxon ${read.usageKey}), filtered to CC0 and CC BY 4.0, Canada and the United States, 2000 onward, no geospatial issue, occurrence status present, fossils and living specimens excluded; aggregated by GBIF into squares of ${STEP}°. A square is drawn with ${MIN_RECORDS} or more records.`,
      scaleStatedAs: `A hatched square holds ${MIN_RECORDS} or more shared records of this species since 2000. Seen there — not how many, and not where it is scarce.`,
      season: {
        observedSeason: "All seasons, 2000 onward",
        matchesHuntingSeason: false,
        warning: "Records from every season are combined; for a species that migrates, where it was recorded in one season says nothing about another.",
      },
      grid: GRID,
      cells: {
        row: drawn.map(([key]) => Math.floor(key / GRID.cols)),
        col: drawn.map(([key]) => key % GRID.cols),
        intensity: drawn.map(([, records]) => records),
      },
      contributingDatasets: read.datasets,
    };
    const text = `${JSON.stringify(artifact)}\n`;
    const path = join(OUT_DIR, `${slug}.json`);
    artifacts.push({ path, text });
    surfaces.push({
      speciesId: read.speciesId,
      surfaceKind: "OBSERVATION_GRID",
      evidenceClass: "OCCURRENCE_RECORDS",
      artifactId: artifact.id,
      artifactPath: path,
      artifactHash: sha(text),
      sourceDatasetId: "dataset:gbif-open-occurrence-records",
      metric: artifact.metric,
      unit: artifact.unit,
      effectiveResolutionMetres: 39000,
      effectiveResolutionStatedAs: `Squares of ${STEP}°, about 39 km north to south; a record's own position can be less precise than its square`,
      season: artifact.season.observedSeason,
      matchesHuntingSeason: false,
      tier: "T3_RECORDED_PRESENCE",
      grade: "D",
      methodologyId: METHODOLOGY.id,
      methodologyVersion: METHODOLOGY.version,
      interpolationPermitted: false,
      coverage: "PARTIAL_DATA",
      unmappedGround: "NOT_SURVEYED",
      sitesSurveyed: drawn.length,
      sitesDetected: drawn.length,
      supportedCells: drawn.length,
      surveyedAndNoneFound: 0,
      openRecords: read.openRecordCount,
    });
  }
  const credits = Object.fromEntries([...credited].sort((a, b) => b[1] - a[1]).map(([key, records]) => [key, { records, ...(titles[key] ?? {}) }]));
  const registry = {
    schemaVersion: 1,
    note: "Recorded-presence grids from openly licensed occurrence records, certified by scripts/build-record-grids.mjs. Separate from the survey registry so no builder can erase another's surfaces.",
    methodology: { ...METHODOLOGY, minimumRecordsPerSquare: MIN_RECORDS, minimumRecordsPerSpecies: MIN_SPECIES_RECORDS, minimumSquares: MIN_SQUARES },
    surfaces,
    declined,
  };
  return { artifacts, registry, credits };
}

const { artifacts, registry, credits } = build();
const registryText = `${JSON.stringify(registry, null, 2)}\n`;
const creditsText = `${JSON.stringify({ note: "Every dataset whose openly licensed records contributed to a recorded-presence grid, with the records it contributed across all species. CC BY 4.0 publishers are credited here and in each grid's provenance.", datasets: credits }, null, 1)}\n`;
if (CHECK) {
  let stale = !existsSync(REGISTRY) || readFileSync(REGISTRY, "utf8") !== registryText;
  for (const { path, text } of artifacts) if (!existsSync(path) || readFileSync(path, "utf8") !== text) stale = true;
  if (stale) { process.stderr.write("records grids are not what the builder produces\n"); process.exit(1); }
  process.stdout.write(`records grids current: ${registry.surfaces.length} surfaces, ${registry.declined.length} declined\n`);
} else {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const { path, text } of artifacts) writeFileSync(path, text);
  writeFileSync(REGISTRY, registryText);
  writeFileSync(join(OUT_DIR, "datasets.json"), creditsText);
  process.stdout.write(`${registry.surfaces.length} recorded-presence grids; ${registry.declined.length} declined; ${Object.keys(credits).length} datasets credited\n`);
}
