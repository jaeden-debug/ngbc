import { CANADA_JURISDICTIONS } from "../canada/registry.ts";
import type { IntelligenceCoverage } from "./applicability.ts";
import { COVERAGE_EXPLANATIONS, coverageFromDataset } from "./applicability.ts";
import type { EvidenceTier } from "./evidence-ladder.ts";
import { intelligenceDatasetRegistry } from "./registry.ts";
import type { SpatialPrecision } from "./spatial-precision.ts";

/**
 * What species evidence North Ground holds, per species and per jurisdiction.
 *
 * DERIVED, never typed. `content/intelligence/source-registry.json` is already
 * the researched record of which authority publishes what, under which licence,
 * at which resolution — so this matrix is a view over it, not a second list
 * beside it. A hand-maintained copy would drift from the registry within weeks
 * and then quietly disagree with it, which is the failure mode section 14
 * exists to prevent.
 *
 * Two things the registry does not carry, because they are this architecture's
 * questions rather than ingestion's: what KIND of evidence a dataset is, and
 * what machine-readable precision its prose resolution corresponds to. Both are
 * declared below, per dataset, with no default — a new species-bearing dataset
 * is a compile-and-test failure until someone decides, rather than being
 * silently assumed to be measured evidence at management-unit resolution.
 *
 * The distinction the matrix protects is between IN_RESEARCH — the work is not
 * finished, whether because nobody has looked or because a source is identified
 * and uncertified — and UNAVAILABLE, which means someone read the authority's
 * own publication and found nothing usable. Conflating them is how a coverage
 * map comes to claim work that was never done, in one direction, or to write
 * off an authority nobody checked, in the other.
 */

export interface DatasetEvidenceKind {
  tier: EvidenceTier;
  /**
   * The finest precision the dataset can support, or null where it has not been
   * established. Null is honest and unpaintable; it is never read as fine.
   */
  precision: SpatialPrecision | null;
  /** Anything about the geography a reader must know before drawing it. */
  caveat?: string;
}

/**
 * What each species-bearing dataset is, and how finely it describes the ground.
 *
 * Every entry here was read from the registry's own `spatialResolution` prose,
 * which the ingestion work recorded from the authority. Nothing is inferred
 * from a dataset's name.
 */
export const DATASET_EVIDENCE: Record<string, DatasetEvidenceKind> = {
  "dataset:ca-on-white-tailed-deer-harvest": { tier: "T1_OFFICIAL_MEASURED", precision: "MANAGEMENT_UNIT" },
  "dataset:ca-on-moose-harvest": { tier: "T1_OFFICIAL_MEASURED", precision: "MANAGEMENT_UNIT" },
  "dataset:ca-on-black-bear-harvest": { tier: "T1_OFFICIAL_MEASURED", precision: "MANAGEMENT_UNIT" },
  "dataset:ca-on-wolf-coyote-harvest": { tier: "T1_OFFICIAL_MEASURED", precision: "MANAGEMENT_UNIT" },
  "dataset:ca-on-wild-turkey-harvest": { tier: "T1_OFFICIAL_MEASURED", precision: "MANAGEMENT_UNIT" },
  "dataset:ca-on-elk-harvest": {
    tier: "T1_OFFICIAL_MEASURED",
    // Nine Elk Harvest Areas, which are NOT the WMU geography. This is exactly
    // what SPECIES_MANAGEMENT_AREA is for, and it does not nest with the units
    // the map draws, so it may never be repainted as WMUs.
    precision: "SPECIES_MANAGEMENT_AREA",
    caveat: "Reported by Elk Harvest Area (9), a different geography from the Wildlife Management Units the map draws.",
  },
  "dataset:ca-on-cwd-surveillance-2025": {
    tier: "T1_OFFICIAL_MEASURED",
    // The registry says the reusable spatial fields still need schema review.
    // Unestablished is not fine-grained; it is unpaintable until someone looks.
    precision: null,
    caveat: "Sample records whose reusable spatial fields have not passed schema review, so no precision is established.",
  },
  "dataset:ca-qc-moose-harvest": { tier: "T1_OFFICIAL_MEASURED", precision: "MANAGEMENT_UNIT" },
  "dataset:ca-qc-white-tailed-deer-harvest": { tier: "T1_OFFICIAL_MEASURED", precision: "MANAGEMENT_UNIT" },
  "dataset:ca-qc-black-bear-harvest": { tier: "T1_OFFICIAL_MEASURED", precision: "MANAGEMENT_UNIT" },
  "dataset:ca-qc-wild-turkey-harvest": { tier: "T1_OFFICIAL_MEASURED", precision: "MANAGEMENT_UNIT" },
  "dataset:ca-bc-big-game-harvest": {
    tier: "T1_OFFICIAL_MEASURED",
    precision: "MANAGEMENT_UNIT",
    caveat: "Carries region and province rollup rows that are not units. Those rows are jurisdiction-level evidence and must never be painted per management unit.",
  },
  "dataset:ca-bc-hunter-sample-survey-estimates": { tier: "T1_OFFICIAL_MEASURED", precision: "MANAGEMENT_UNIT" },
  "dataset:ca-sk-hunter-harvest-survey": {
    tier: "T1_OFFICIAL_MEASURED",
    precision: "MANAGEMENT_UNIT",
    caveat: "Only draw and big-game-management licences are reported by zone; ordinary resident licences are reported province-wide and are jurisdiction-level evidence.",
  },
  "dataset:ca-nb-big-game-harvest": { tier: "T1_OFFICIAL_MEASURED", precision: "MANAGEMENT_UNIT" },
  "dataset:ca-ns-deer-moose-harvest": {
    tier: "T1_OFFICIAL_MEASURED",
    precision: "MANAGEMENT_UNIT",
    caveat: "The authority publishes a moose success rate by zone. It is publishable as such because the authority computed it; North Ground never derives one.",
  },
  "dataset:ca-nl-big-game-area-evidence": {
    tier: "T1_OFFICIAL_MEASURED",
    // Moose Management Areas and Caribou Management Areas are separate
    // species-specific geographies, not one set of units.
    precision: "SPECIES_MANAGEMENT_AREA",
    caveat: "Moose and caribou are reported on separate species-specific area maps, which are not interchangeable with each other.",
  },
  "dataset:ca-nt-harvest-evidence": {
    tier: "T1_OFFICIAL_MEASURED",
    precision: "SPECIES_MANAGEMENT_AREA",
    caveat: "Reported by region, herd or subpopulation; there is no hunting-unit grid to paint.",
  },
  "dataset:ca-nu-harvest-evidence": {
    tier: "T1_OFFICIAL_MEASURED",
    precision: "SPECIES_MANAGEMENT_AREA",
    caveat: "Reported by region, herd or subpopulation; there is no hunting-unit grid to paint.",
  },
};

export interface EvidenceMatrixEntry {
  speciesId: string;
  jurisdictionId: string;
  datasetId: string;
  tier: EvidenceTier;
  coverage: IntelligenceCoverage;
  precision: SpatialPrecision | null;
  authority: string;
  sourceUrl: string;
  /** The registry's own limitation, plus any geography caveat declared here. */
  limitation: string;
}

/** Every species × jurisdiction claim the registry supports, expanded. */
export function evidenceMatrixEntries(): EvidenceMatrixEntry[] {
  const entries: EvidenceMatrixEntry[] = [];
  for (const dataset of intelligenceDatasetRegistry()) {
    const kind = DATASET_EVIDENCE[dataset.id];
    // A dataset naming no species says nothing about a species. Land, fire and
    // land-use datasets live here too and are deliberately not matrix cells.
    if (!kind || !dataset.speciesIds.length) continue;
    for (const speciesId of dataset.speciesIds) {
      entries.push({
        speciesId,
        jurisdictionId: dataset.jurisdictionId,
        datasetId: dataset.id,
        tier: kind.tier,
        coverage: coverageFromDataset(dataset.productionStatus),
        precision: kind.precision,
        authority: dataset.authority,
        sourceUrl: dataset.url,
        limitation: kind.caveat ? `${dataset.limitations} ${kind.caveat}` : dataset.limitations,
      });
    }
  }
  return entries;
}

/** Jurisdictions in the current national target, as the spatial registry declares them. */
export function matrixJurisdictions() {
  return CANADA_JURISDICTIONS.filter(({ scope }) => scope?.state !== "OUT_OF_SCOPE");
}

export interface MatrixCell {
  speciesId: string;
  jurisdictionId: string;
  coverage: IntelligenceCoverage;
  /** Every tier researched here. Tiers coexist, so this is a list, not a winner. */
  tiers: EvidenceTier[];
  entries: EvidenceMatrixEntry[];
  /** Whether anything here could be drawn at all, before a claim is even chosen. */
  paintable: boolean;
  explanation: string;
}

/* Best-covered first. A cell takes its best entry's state, and the weaker
   entries stay listed rather than being averaged away. */
const COVERAGE_ORDER: IntelligenceCoverage[] = ["AVAILABLE", "PARTIAL", "STALE", "UNRESOLVED", "RESTRICTED", "UNAVAILABLE", "IN_RESEARCH"];

/**
 * One cell, including the empty ones.
 *
 * Never returns null. An absent cell is a real answer — nobody has looked — and
 * returning nothing would let a caller render blank, which a hunter reads as
 * "no animals here".
 */
export function matrixCell(speciesId: string, jurisdictionId: string, entries = evidenceMatrixEntries()): MatrixCell {
  const cell = entries.filter((entry) => entry.speciesId === speciesId && entry.jurisdictionId === jurisdictionId);
  if (!cell.length) {
    return {
      speciesId, jurisdictionId,
      coverage: "IN_RESEARCH", tiers: [], entries: [], paintable: false,
      explanation: "North Ground has not yet looked for evidence for this species here. Nothing is claimed either way.",
    };
  }
  const coverage = COVERAGE_ORDER.find((state) => cell.some((entry) => entry.coverage === state))!;
  // Paintable needs BOTH a servable coverage state and an established
  // precision. A dataset whose geography has not been resolved cannot be drawn,
  // however good its licence.
  const paintable = cell.some((entry) => entry.precision !== null && ["AVAILABLE", "PARTIAL", "STALE"].includes(entry.coverage));
  return {
    speciesId, jurisdictionId, coverage,
    tiers: [...new Set(cell.map(({ tier }) => tier))].sort(),
    entries: cell,
    paintable,
    /* An identified-but-uncertified source and an unexamined cell are both
       "nothing you can use yet", and both are IN_RESEARCH — but they are not
       the same sentence, and a reviewer needs to know which one they are
       looking at. */
    explanation: coverage === "IN_RESEARCH"
      ? `A source is identified (${[...new Set(cell.map(({ authority }) => authority))].join("; ")}) and is not yet certified or served.`
      : COVERAGE_EXPLANATIONS[coverage],
  };
}

export interface MatrixReport {
  researchedCells: number;
  unresearchedCells: number;
  /** Cells that could actually put something on a map today. */
  paintableCells: number;
  speciesCount: number;
  jurisdictionCount: number;
  byCoverage: Record<IntelligenceCoverage, number>;
  researched: Array<{ speciesId: string; jurisdictionId: string; coverage: IntelligenceCoverage; paintable: boolean }>;
}

/**
 * The matrix's own coverage, computed at call time.
 *
 * `speciesIds` is passed in because which species are in scope is the species
 * library's question, not this module's.
 */
export function matrixReport(speciesIds: readonly string[]): MatrixReport {
  const jurisdictions = matrixJurisdictions();
  const entries = evidenceMatrixEntries();
  const byCoverage: Record<IntelligenceCoverage, number> = {
    AVAILABLE: 0, PARTIAL: 0, STALE: 0, RESTRICTED: 0, UNRESOLVED: 0, UNAVAILABLE: 0, IN_RESEARCH: 0,
  };
  const researched: MatrixReport["researched"] = [];
  let paintableCells = 0;

  for (const speciesId of speciesIds) {
    for (const { id } of jurisdictions) {
      const cell = matrixCell(speciesId, id, entries);
      byCoverage[cell.coverage] += 1;
      if (cell.paintable) paintableCells += 1;
      if (cell.entries.length) researched.push({ speciesId, jurisdictionId: id, coverage: cell.coverage, paintable: cell.paintable });
    }
  }

  return {
    researchedCells: researched.length,
    unresearchedCells: speciesIds.length * jurisdictions.length - researched.length,
    paintableCells,
    speciesCount: speciesIds.length,
    jurisdictionCount: jurisdictions.length,
    byCoverage,
    researched,
  };
}

/**
 * Structural faults a reviewer must fix.
 *
 * The important one is the first: a species-bearing dataset with no declared
 * kind. It makes adding a range or habitat dataset a visible decision rather
 * than something that inherits "measured, at management-unit resolution"
 * because that is what every dataset happened to be on the day this was written.
 */
export function validateEvidenceMatrix(): string[] {
  const problems: string[] = [];
  const known = new Set(CANADA_JURISDICTIONS.map(({ id }) => String(id)));
  const registry = intelligenceDatasetRegistry();
  const ids = new Set(registry.map(({ id }) => id));

  for (const dataset of registry) {
    if (dataset.speciesIds.length && !DATASET_EVIDENCE[dataset.id]) {
      problems.push(`${dataset.id} names species but declares no evidence kind; decide its tier and precision rather than inheriting a default`);
    }
    if (dataset.speciesIds.length && !known.has(dataset.jurisdictionId)) {
      problems.push(`${dataset.id} names a jurisdiction the spatial registry does not declare`);
    }
  }
  for (const id of Object.keys(DATASET_EVIDENCE)) {
    if (!ids.has(id)) problems.push(`${id} is declared here but no longer exists in the source registry`);
  }
  for (const entry of evidenceMatrixEntries()) {
    if (!entry.sourceUrl.startsWith("https://")) problems.push(`${entry.datasetId} must cite an HTTPS primary source`);
    if (!entry.limitation.trim()) problems.push(`${entry.datasetId} must state a limitation; an empty one is a claim of completeness`);
    // An entry exists because someone researched it. IN_RESEARCH is the state
    // of a cell with NO entry, and recording it here would erase the looking.
    // Deliberately NOT a rule that an entry may never be IN_RESEARCH. A source
    // can be identified and recorded while its certification is unfinished —
    // the registry's own IN_DEVELOPMENT — and that is still "not usable yet".
    // The distinction that matters is IN_RESEARCH against UNAVAILABLE, which is
    // a finding that the authority publishes nothing usable.
    if (entry.coverage === "UNAVAILABLE" && entry.precision !== null) {
      problems.push(`${entry.datasetId} is recorded UNAVAILABLE yet declares a precision; a dataset that publishes nothing usable has no geography to state`);
    }
  }
  return problems;
}
