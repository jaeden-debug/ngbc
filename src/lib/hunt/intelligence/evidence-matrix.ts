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
    // Nine Elk Harvest Areas (57-01 to 63-08), which are NOT the WMU geography.
    // This is what SPECIES_MANAGEMENT_AREA is for, and it does not nest with
    // the units the map draws, so it may never be repainted as WMUs.
    //
    // But non-nesting is the second fact. The first is that North Ground does
    // not HOLD the Elk Harvest Area geometry at all, so there is nothing to
    // draw at any resolution. The registry says so in its own field —
    // ingestionStatus REJECTED_FOR_GEOGRAPHY — and openly licensed data with
    // no geometry is still unpaintable.
    precision: "SPECIES_MANAGEMENT_AREA",
    caveat: "Reported by Elk Harvest Area (57-01 to 63-08), a geography North Ground does not hold or certify. Openly licensed; held back for want of the geometry, not for a licence.",
  },
  "dataset:ca-on-cwd-surveillance-2025": {
    tier: "T1_OFFICIAL_MEASURED",
    // The registry says the reusable spatial fields still need schema review.
    // Unestablished is not fine-grained; it is unpaintable until someone looks.
    precision: null,
    caveat:
      "Sample records whose reusable spatial fields have not passed schema review, so no precision is established. A sample record is not a confirmed detection area, not a mandatory-testing area and not a carcass-transport restriction — three different legal objects a reader would otherwise assume from a dot on a map. That distinction must survive if this ever becomes paintable, not merely the resolution.",
  },
  "dataset:ca-qc-moose-harvest": { tier: "T1_OFFICIAL_MEASURED", precision: "MANAGEMENT_UNIT" },
  "dataset:ca-qc-white-tailed-deer-harvest": { tier: "T1_OFFICIAL_MEASURED", precision: "MANAGEMENT_UNIT" },
  "dataset:ca-qc-black-bear-harvest": { tier: "T1_OFFICIAL_MEASURED", precision: "MANAGEMENT_UNIT" },
  "dataset:ca-qc-wild-turkey-harvest": { tier: "T1_OFFICIAL_MEASURED", precision: "MANAGEMENT_UNIT" },
  "dataset:ca-bc-big-game-harvest": {
    tier: "T1_OFFICIAL_MEASURED",
    precision: "MANAGEMENT_UNIT",
    /* The rollup rows are EXCLUDED, not demoted. Region (R99), province (999)
       and the regional codes 100–900 with 770/780 for regions 7A Omineca and
       7B Peace are totals over the units beneath them. Reading them as
       coarser evidence would put a provincial number on the map that
       double-counts its own units — worse than dropping them. */
    caveat:
      "Region (R99), province (999) and regional rollup codes (100–900, with 770/780 for regions 7A Omineca and 7B Peace) are totals over the units beneath them, not units, and carry no evidence at any resolution. Resident and non-resident hunters, hunter days and kills stay separate components; success is never derived beyond the authority's own denominators. Cougar, mountain goat, mountain sheep and grizzly bear appear in the file but build no evidence, as North Ground holds no canonical record for them; grizzly hunting has been closed in British Columbia since 2017.",
  },
  "dataset:ca-bc-hunter-sample-survey-estimates": { tier: "T1_OFFICIAL_MEASURED", precision: "MANAGEMENT_UNIT" },
  "dataset:ca-sk-hunter-harvest-survey": {
    tier: "T1_OFFICIAL_MEASURED",
    precision: "MANAGEMENT_UNIT",
    /* Licence first: the site-wide Crown copyright requires advance written
       permission for commercial use, so this is blocked outright and the
       precision question does not yet arise. And zone resolution is the
       MINORITY of the data, not the default with exceptions. */
    caveat:
      "Blocked: the site-wide Crown copyright requires advance written permission for commercial use. Separately, zone resolution covers the minority of the data — only draw and big-game-management licences are reported by zone, while the highest-volume regular-licence harvest, including resident white-tailed deer, is published province-wide with no zone breakdown at all.",
  },
  "dataset:ca-nb-big-game-harvest": { tier: "T1_OFFICIAL_MEASURED", precision: "MANAGEMENT_UNIT" },
  "dataset:ca-ns-deer-moose-harvest": {
    tier: "T1_OFFICIAL_MEASURED",
    precision: "MANAGEMENT_UNIT",
    /* The edition is part of the identity here. Per-zone deer harvest appears
       in the 2022, 2023 and 2024 editions and was DROPPED from 2025, which is
       province-wide only — so a pipeline that follows "latest" silently loses
       all zone resolution and reports no error. Exactly the failure this
       architecture exists to make loud. */
    caveat:
      "Pin the edition and its hash; never follow \"latest\". Per-zone deer harvest appears in the 2022, 2023 and 2024 editions and was dropped from the 2025 edition, which is province-wide only, so following the newest edition silently downgrades zone evidence to jurisdiction evidence without error. The authority publishes a moose success rate by zone, which is publishable because the authority computed it; North Ground never derives one. Nova Scotia's only openly licensed wildlife data is its bear extracts, which are county-level and therefore the wrong geography for a zone map.",
  },
  "dataset:ca-nl-big-game-area-evidence": {
    tier: "T1_OFFICIAL_MEASURED",
    // Moose Management Areas and Caribou Management Areas are separate
    // species-specific geographies, not one set of units.
    precision: "SPECIES_MANAGEMENT_AREA",
    caveat:
      "Moose and caribou are reported on separate species-specific area maps, which are not interchangeable with each other. North Ground has parity-certified both geographies (74 Moose Management Areas, 19 Caribou Management Areas), so the blocker is the licence, which names none and does not address commercial use. One page mixes vintages — 2022 survey tables beside 2024 success rates — so every record must carry its own effective period rather than the page's.",
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
  /** The registry's own pipeline state, read rather than inferred. */
  ingestionStatus: string;
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
        ingestionStatus: dataset.ingestionStatus,
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

/**
 * Whether one entry could actually put something on a map today.
 *
 * Three independent conditions, because each can fail on its own and each has
 * a different remedy:
 *
 *   INGESTED — the registry's own field. Ontario's elk harvest is openly
 *   licensed and perfectly good, and North Ground does not hold the nine Elk
 *   Harvest Areas at all (REJECTED_FOR_GEOGRAPHY), so there is nothing to draw
 *   at any resolution. Read rather than inferred, so nobody can make it
 *   paintable by promoting its production status while the geometry is missing.
 *   COVERAGE — the licence and certification state.
 *   PRECISION — an established geography. Unknown is not fine.
 */
export function entryIsPaintable(entry: EvidenceMatrixEntry): boolean {
  return entry.ingestionStatus === "INGESTED"
    && entry.precision !== null
    && ["AVAILABLE", "PARTIAL", "STALE"].includes(entry.coverage);
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
  const paintable = cell.some(entryIsPaintable);
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
    if (entry.ingestionStatus === "INGESTED" && entry.precision === null) {
      problems.push(`${entry.datasetId} is ingested yet declares no precision; an ingested dataset has a geography, so establish it`);
    }
    if (entry.coverage === "UNAVAILABLE" && entry.precision !== null) {
      problems.push(`${entry.datasetId} is recorded UNAVAILABLE yet declares a precision; a dataset that publishes nothing usable has no geography to state`);
    }
  }
  return problems;
}
