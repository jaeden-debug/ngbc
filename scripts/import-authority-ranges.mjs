#!/usr/bin/env node
/**
 * Authority range maps, from a runner's read to the range builder's inputs.
 *
 *   node scripts/import-authority-ranges.mjs --from .research/authority-ranges
 *
 * Reads what scripts/fetch-authority-ranges.py wrote on a runner and commits,
 * per heat species with a surface profile, the 0.1° cells of each authority's
 * range by season under content/intelligence/range-habitat/authority/. These
 * are derived facts (which grid cells an authority's published range covers),
 * attributed to the file they came from; the authority's files themselves are
 * not stored (CLAUDE.md §44: deriving is not archiving).
 *
 * WHAT IS IMPORTED (scripts/lib/authority-range.mjs decides, and says why):
 * only a map whose parts describe where the species IS. A part that mixes in
 * ground where it is only possibly present, extirpated or historical is not
 * imported, because the builder would then draw that ground as range.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gapSelection } from "./lib/authority-range.mjs";

const args = process.argv.slice(2);
const FROM = args.includes("--from") ? args[args.indexOf("--from") + 1] : ".research/authority-ranges";
const OUT = "content/intelligence/range-habitat/authority";
const profiles = JSON.parse(readFileSync("content/intelligence/surface-profiles.json", "utf8")).species;

mkdirSync(OUT, { recursive: true });
for (const file of readdirSync(OUT)) if (file.endsWith(".json")) rmSync(join(OUT, file));

const report = { imported: [], refused: [] };
const gapDir = join(FROM, "gap");
for (const file of existsSync(gapDir) ? readdirSync(gapDir).filter((f) => f.endsWith(".json") && !f.startsWith("_")) : []) {
  const read = JSON.parse(readFileSync(join(gapDir, file), "utf8"));
  if (!profiles[read.speciesId]) continue;
  const decision = gapSelection(read);
  if (!decision.import) {
    report.refused.push({ speciesId: read.speciesId, code: read.code, why: decision.why });
    continue;
  }
  const entry = {
    speciesId: read.speciesId,
    reads: [{
      authority: "USGS Gap Analysis Project",
      dataset: "Species Range Maps CONUS_2001",
      code: read.code,
      name: `${read.commonName} (${read.scientificName})`,
      matchedBy: read.matchedBy,
      doi: read.doi,
      url: read.itemUrl,
      file: read.file,
      fileUrl: read.fileUrl,
      sha256: read.sha256,
      retrievedAt: read.retrievedAt,
      published: decision.published,
      licence: read.licence,
      attribution: `Range map: U.S. Geological Survey Gap Analysis Project, ${read.commonName} (${read.scientificName}) ${read.code}_CONUS_2001v1 Range Map, https://doi.org/${String(read.doi).replace(/^doi:/, "")} (public domain).`,
      limitation: "The GAP map describes 2001 ground conditions in the conterminous United States, by sub-watershed.",
      selected: decision.why,
      completeWithin: "CONUS",
      cells: decision.cells,
    }],
  };
  writeFileSync(join(OUT, file), `${JSON.stringify(entry)}\n`);
  report.imported.push({ speciesId: read.speciesId, code: read.code, seasons: Object.keys(decision.cells) });
}
writeFileSync(join(OUT, "_import.json"), `${JSON.stringify(report, null, 1)}\n`);
process.stdout.write(`${report.imported.length} imported, ${report.refused.length} refused\n`);
for (const r of report.refused) process.stdout.write(`  refused ${r.speciesId} (${r.code}): ${r.why}\n`);
