#!/usr/bin/env node
/**
 * The species surface coverage report, generated — never typed.
 *
 *   node scripts/report-species-coverage.mjs           # write docs/species-spatial-coverage.md
 *   node scripts/report-species-coverage.mjs --check   # exit 1 if the committed report is stale
 *   node scripts/report-species-coverage.mjs --json    # the same rows as JSON, for scripts
 *
 * Every row is `spatialStrategyFor` over the certified registries and what the
 * species-surface endpoint actually serves, and "renderable" is the one
 * renderer's own conversion run on that reply. A browser-verified stage is only
 * what the verification record holds for the artifact's CURRENT hash. So the
 * report cannot say a species has a map unless a hunter could receive one.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { permitsSpeciesHeat, takeEligibilityOf } from "../src/lib/content/species-eligibility.ts";
import { toRenderable } from "../src/lib/hunt/exploration/surface-request.ts";
import { spatialStrategies, COVERAGE_STAGES, STALENESS_AS_OF } from "../src/lib/hunt/intelligence/spatial-strategy.ts";
import { speciesSurfaces, SURFACE_TIERS, TIER_MEANING } from "../src/lib/hunt/intelligence/surface.ts";

const OUT = join(process.cwd(), "docs", "species-spatial-coverage.md");

const TIER_WORDS = {
  MEASURED_DENSITY: "T1 measured density",
  MODELLED_ABUNDANCE: "T2 modelled abundance",
  SYSTEMATIC_SURVEY: "T3 systematic survey",
  HABITAT_MODEL: "T4 habitat model",
  RANGE_HABITAT: "T5 range + habitat",
  RANGE_ONLY: "T6 known distribution",
  NO_SURFACE: "no surface",
};

const rows = spatialStrategies().map((row) => {
  const eligible = permitsSpeciesHeat(row.speciesId);
  const reply = row.tier === "NO_SURFACE" ? null : speciesSurfaces(row.speciesId);
  /* Renderable is the one renderer's own conversion run on the reply. */
  const renderable = reply ? reply.surfaces.filter((surface) => toRenderable(surface)).length : 0;
  const served = row.layers.filter((layer) => layer.served);
  const box = served.map((layer) => layer.geography).filter(Boolean).reduce((acc, g) => (acc
    ? { west: Math.min(acc.west, g.west), south: Math.min(acc.south, g.south), east: Math.max(acc.east, g.east), north: Math.max(acc.north, g.north) }
    : g), null);
  return {
    ...row,
    eligible,
    renderable,
    evidence: row.tier === "NO_SURFACE" ? "—" : TIER_MEANING[row.tier].represents,
    geography: box ? `${box.south.toFixed(1)}–${box.north.toFixed(1)}°N, ${(-box.east).toFixed(1)}–${(-box.west).toFixed(1)}°W` : row.plotJurisdictions.length ? `plots in ${row.plotJurisdictions.map((j) => j.replace("jurisdiction:ca-", "").toUpperCase()).join(", ")}` : "—",
  };
});

/* THE DENOMINATOR IS LIVE: the catalogue's species whose canonical take
   eligibility grants Species Heat, computed here and never typed. */
const eligible = rows.filter((row) => row.eligible);
const covered = eligible.filter((row) => row.tier !== "NO_SURFACE" || row.blocker?.genuine);
const uncovered = eligible.filter((row) => !covered.includes(row));
const withSurface = eligible.filter((row) => row.tier !== "NO_SURFACE");
const blocked = eligible.filter((row) => row.tier === "NO_SURFACE");
const count = (predicate) => eligible.filter(predicate).length;
const pct = (n, of = eligible.length) => `${((100 * n) / Math.max(1, of)).toFixed(1)}%`;
const reachable = count((row) => row.funnel.productionReachable);
const nonBlocked = eligible.length - blocked.filter((row) => row.blocker?.genuine).length;

const byClass = {};
for (const row of rows) byClass[takeEligibilityOf(row.speciesId) ?? "UNKNOWN"] = (byClass[takeEligibilityOf(row.speciesId) ?? "UNKNOWN"] ?? 0) + 1;
const funnel = [
  ["Denominator (Hunt-eligible, live)", eligible.length],
  ["Profiled", count((r) => r.funnel.profiled)],
  ["Artifact generated", count((r) => r.funnel.artifact)],
  ["Certified", count((r) => r.funnel.certified)],
  ["Registered", count((r) => r.funnel.registered)],
  ["API served", count((r) => r.funnel.served)],
  ["Hunt selectable", count((r) => r.funnel.selectable)],
  ["Renderable (the renderer's own conversion)", count((r) => r.funnel.served && r.renderable > 0)],
  ["Production reachable (browser: requested, canonical, drawn, no other species)", reachable],
  ["Genuine blockers", blocked.filter((r) => r.blocker?.genuine).length],
];
const layersOf = (predicate) => eligible.flatMap((row) => row.layers.filter((layer) => layer.served && predicate(layer, row)).map(() => row.speciesId));
const quality = {
  tiers: [...SURFACE_TIERS, "NO_SURFACE"].map((tier) => `${TIER_WORDS[tier]}: ${count((row) => row.tier === tier)}`),
  seasonal: count((row) => row.seasonal),
  rangeOnly: count((row) => row.tier === "RANGE_ONLY"),
  rangeHabitat: count((row) => row.layers.some((l) => l.served && l.tier === "RANGE_HABITAT")),
  occurrence: count((row) => row.layers.some((l) => l.served && (l.tier === "RANGE_HABITAT" || l.tier === "RANGE_ONLY"))),
  variation: count((row) => row.layers.some((l) => l.served && l.tier === "RANGE_HABITAT" && l.usefulVariation === true)),
  noVariation: eligible.filter((row) => row.layers.some((l) => l.served && l.tier === "RANGE_HABITAT" && l.usefulVariation === false)).map((row) => row.speciesId.replace("species:", "")),
};
const debt = {
  stale: [...new Set(layersOf((l) => l.staleness === "STALE"))],
  ageing: [...new Set(layersOf((l) => l.staleness === "AGEING"))],
  limited: eligible.filter((row) => row.tier !== "NO_SURFACE" && row.layers.filter((l) => l.served).every((l) => l.confidence === "LIMITED")).map((row) => row.speciesId.replace("species:", "")),
  rangeOnly: eligible.filter((row) => row.tier === "RANGE_ONLY").map((row) => `${row.speciesId.replace("species:", "")} (${row.rangeOnlyReason ?? "no reason recorded"})`),
  huntingSeason: eligible.filter((row) => row.needsHuntingSeasonEvidence).map((row) => `${row.speciesId.replace("species:", "")} (${row.movement?.toLowerCase()})`),
  /* Range edges that stop where recording stops (range-habitat registry, target-group effort). */
  edgeFollowsRecording: JSON.parse(readFileSync("content/intelligence/range-habitat-registry.json", "utf8")).surfaces
    .filter((entry) => (entry.edgeOnUnrecordedGround ?? 0) >= 0.25)
    .sort((a, b) => b.edgeOnUnrecordedGround - a.edgeOnUnrecordedGround)
    .map((entry) => `${entry.speciesId.replace("species:", "")} (${Math.round(entry.edgeOnUnrecordedGround * 100)}%)`),
  surveyOnly: eligible.filter((row) => row.tier === "SYSTEMATIC_SURVEY" && !row.layers.some((l) => l.served && l.tier !== "SYSTEMATIC_SURVEY") && (row.movement === "RESIDENT" || row.movement === "SHORT_DISTANCE")).map((row) => row.speciesId.replace("species:", "")),
};
const byStage = COVERAGE_STAGES.map((stage) => `${stage}: ${count((row) => row.stage === stage)}`);

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify({ eligible: eligible.length, covered: covered.length, uncovered: uncovered.map((r) => r.speciesId), withSurface: withSurface.length, productionReachable: reachable, funnel, quality, debt, rows }, null, 1)}\n`);
  process.exit(0);
}

const cell = (value) => String(value).replace(/\|/g, "\\|");
const list = (items) => (items.length ? items.join(", ") : "none");
const lines = [
  "# Species surface coverage",
  "",
  "Generated by `scripts/report-species-coverage.mjs` from the certified registries",
  "(`content/intelligence/surface-registry.json`, `model-registry.json`, `range-habitat-registry.json`,",
  "the servable evidence bundles), what the species-surface endpoint serves, the one renderer's",
  "own conversion, and the browser verification record. Do not edit by hand; `npm test` fails when",
  "this file is stale.",
  "",
  "CLAUDE.md §41B: every Hunt-eligible species resolves to the strongest surface its evidence",
  "defensibly supports. The denominator is LIVE — the catalogue's species whose canonical take",
  "eligibility grants Species Heat — and never a typed count. NO_SURFACE stands only on a genuine",
  "blocker (not Hunt-eligible, no defensible range, licence forbids); anything else fails the gate.",
  "",
  `**Catalogue:** ${rows.length} published species — ${Object.entries(byClass).sort().map(([k, v]) => `${k} ${v}`).join(" · ")}.`,
  "",
  `**Hunt-eligible (live): ${eligible.length}.** Covered — a served surface or a genuine blocker: **${covered.length} (${pct(covered.length)})**; eligible − covered: **${uncovered.length}**${uncovered.length ? ` (${uncovered.map((r) => r.speciesId.replace("species:", "")).join(", ")})` : ""}.`,
  "",
  `**FULLY_PRODUCTION_REACHABLE: ${reachable} / ${nonBlocked} (${pct(reachable, nonBlocked)})** of the eligible species not genuinely blocked.`,
  "",
  "## Coverage funnel",
  "",
  "| Step | Species |",
  "| --- | --- |",
  ...funnel.map(([step, n]) => `| ${step} | ${n} |`),
  "",
  "## Evidence quality",
  "",
  `**Best tier:** ${quality.tiers.join(" · ")}.`,
  "",
  `Hunting-season surfaces: ${quality.seasonal}. Range + habitat: ${quality.rangeHabitat}. Range only: ${quality.rangeOnly}. Occurrence-supported (range from shared records): ${quality.occurrence}. Range + habitat with useful internal variation: ${quality.variation}; without (one class covers more than 90% of the range): ${list(quality.noVariation)}.`,
  "",
  `**Map-layer stage:** ${byStage.join(" · ")}.`,
  "",
  `## Quality debt (ages as of ${STALENESS_AS_OF})`,
  "",
  `- **Stale sources:** ${list(debt.stale.map((id) => id.replace("species:", "")))}.`,
  `- **Ageing sources:** ${debt.ageing.length} species (land cover epoch 2019 is past its five-year current window).`,
  `- **Low confidence (every served layer LIMITED):** ${list(debt.limited)}.`,
  `- **Range-only, candidates for range + habitat:** ${list(debt.rangeOnly)}.`,
  `- **Moving birds with no hunting-season surface yet:** ${list(debt.huntingSeason)}.`,
  `- **Geographic gaps — resident birds drawn only where the breeding survey reaches:** ${list(debt.surveyOnly)}.`,
  `- **Geographic gaps — range edge follows recording** (a quarter or more of the range's land edge borders ground where the reads hold almost no records of any hunted animal of its group; the share in brackets): ${list(debt.edgeFollowsRecording)}.`,
  "",
  "## Every species",
  "",
  "| Species | Eligibility | Best tier | Surfaces (artifact · season · confidence) | Served | Selectable | Renderable | Production | Evidence | Coverage geography | Zone evidence (card only) | Blocker or range-only reason |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map((row) => {
    const surfaces = row.layers.map((layer) => `${layer.artifactId.replace("surface:", "")} · ${layer.window.toLowerCase().replace("_", " ")} · ${layer.confidence.toLowerCase()}`).join("; ") || (row.plotJurisdictions.length ? "survey plots" : "—");
    const why = row.blocker
      ? `${row.blocker.genuine ? "" : "**NOT GENUINE** "}${row.blocker.reason}: ${cell(row.blocker.detail)}`
      : row.rangeOnlyReason ? `range only: ${cell(row.rangeOnlyReason)}` : "—";
    return `| ${row.speciesId.replace("species:", "")} | ${row.eligibility ?? "—"} | ${TIER_WORDS[row.tier]} | ${cell(surfaces)} | ${row.funnel.served ? "yes" : "—"} | ${row.funnel.selectable ? "yes" : "—"} | ${row.renderable ? "yes" : "—"} | ${row.funnel.productionReachable ? "yes" : "—"} | ${cell(row.evidence)} | ${row.geography} | ${row.zoneEvidenceJurisdictions.map((j) => j.replace("jurisdiction:ca-", "").toUpperCase()).join(", ") || "—"} | ${why} |`;
  }),
  "",
];
const text = lines.join("\n");

if (process.argv.includes("--check")) {
  let current = "";
  try { current = readFileSync(OUT, "utf8"); } catch { /* reported below */ }
  if (current !== text) {
    process.stderr.write("docs/species-spatial-coverage.md is stale. Run node scripts/report-species-coverage.mjs\n");
    process.exit(1);
  }
  process.stdout.write(`species coverage report current: ${covered.length}/${eligible.length} eligible species covered, ${withSurface.length} with a surface, ${reachable} production reachable\n`);
} else {
  writeFileSync(OUT, text);
  process.stdout.write(`Wrote ${OUT}: ${covered.length}/${eligible.length} eligible species covered (${uncovered.length} not), ${withSurface.length} with a surface; ${reachable} production reachable\n`);
}
