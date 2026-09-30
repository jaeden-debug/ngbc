#!/usr/bin/env node
/**
 * Print the national coverage report.
 *
 *   npm run report:canada          human-readable
 *   npm run report:canada -- --json   machine-readable
 *
 * Every figure is computed from certified bundles at run time. Nothing here
 * declares coverage; this script only renders what the data supports.
 */
import { pathToFileURL } from "node:url";

const { canadaCoverageReport } = await import("../src/lib/hunt/canada/report.ts");

function render(report) {
  const t = report.totals;
  const lines = [];
  lines.push("NORTH GROUND HUNT — CANADA COVERAGE");
  lines.push("=".repeat(78));
  lines.push("");
  lines.push(`Jurisdictions tracked            ${t.jurisdictions} (13 provinces and territories + federal)`);
  lines.push(`Spatial VERIFIED                 ${t.spatialVerified}`);
  lines.push(`Spatial IN_DEVELOPMENT           ${t.spatialInDevelopment}`);
  lines.push(`Regulatory PARTIAL or better     ${t.regulatoryPartialOrBetter}`);
  lines.push(`Official units parity-certified  ${t.officialUnitsIngested.toLocaleString("en-CA")}`);
  lines.push(`Species with certified rules     ${t.speciesCertified}`);
  lines.push(`Certified rules                  ${t.rules}`);
  lines.push("");
  lines.push("MILESTONES");
  lines.push("-".repeat(78));
  for (const [name, milestone] of Object.entries(report.milestones)) {
    lines.push(`  [${milestone.met ? "MET" : "   "}] ${name}`);
    lines.push(`         ${milestone.detail}`);
  }
  lines.push("");
  /*
   * The zero-rule jurisdictions, named.
   *
   * Spatial and regulatory coverage are different capabilities, and the failure
   * this block exists to prevent is reading "11 of 11" off the spatial line and
   * calling Canada covered. A hunter in a jurisdiction with drawn zones and no
   * certified rules gets a correctly named zone and no season — which is honest,
   * and is not coverage. Naming them costs four lines and removes the only way
   * the aggregate can be misread.
   */
  const drawnButUnanswerable = report.jurisdictions.filter(
    (j) => j.scope?.state !== "OUT_OF_SCOPE" && j.spatial.parityCertified && j.regulatory.rules === 0,
  );
  if (drawnButUnanswerable.length) {
    lines.push("ZONES DRAWN, NO CERTIFIED RULES");
    lines.push("-".repeat(78));
    lines.push(
      `  ${drawnButUnanswerable.length} jurisdiction${drawnButUnanswerable.length === 1 ? "" : "s"} ` +
      "can be reached on the map and cannot answer a season:",
    );
    for (const j of drawnButUnanswerable) lines.push(`    ${j.code.padEnd(8)} ${j.nameEn}`);
    lines.push("");
  }
  lines.push("BY JURISDICTION");
  lines.push("-".repeat(78));
  lines.push(
    "  " + "CODE".padEnd(12) + "SPATIAL".padEnd(17) + "REGULATORY".padEnd(17) + "SPECIES".padStart(8) + "RULES".padStart(8),
  );
  for (const j of report.jurisdictions) {
    lines.push(
      "  " + j.code.padEnd(12) +
      j.spatial.status.padEnd(17) +
      j.regulatory.status.padEnd(17) +
      String(j.regulatory.speciesCertified).padStart(8) +
      String(j.regulatory.rules).padStart(8),
    );
  }
  lines.push("");
  for (const j of report.jurisdictions) {
    if (!j.species.length && !j.knownGaps.length) continue;
    lines.push(`${j.nameEn} (${j.code}) — ${j.spatial.officialTerm}`);
    if (j.species.length) {
      lines.push(
        "    " + "SPECIES".padEnd(34) + "COVERED".padStart(9) + "CLOSED".padStart(9) + "UNKNOWN".padStart(9) + "RULES".padStart(7) + "  ASKS",
      );
      for (const s of j.species) {
        lines.push(
          "    " + s.speciesId.replace("species:", "").padEnd(34) +
          String(s.unitsCovered).padStart(9) +
          String(s.unitsDeclaredClosed).padStart(9) +
          String(s.unitsUnknown).padStart(9) +
          String(s.rules).padStart(7) +
          (s.requiresInput ? "   yes" : "    no"),
        );
      }
    }
    for (const gap of j.knownGaps) lines.push(`    gap: ${gap}`);
    lines.push("");
  }
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = canadaCoverageReport();
  process.stdout.write(process.argv.includes("--json") ? `${JSON.stringify(report, null, 2)}\n` : `${render(report)}\n`);
}
