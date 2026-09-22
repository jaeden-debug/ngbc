import { CANADA_JURISDICTIONS } from "../canada/registry.ts";
import type { IntelligenceCoverage } from "./applicability.ts";
import { COVERAGE_EXPLANATIONS } from "./applicability.ts";
import type { EvidenceTier } from "./evidence-ladder.ts";
import type { SpatialPrecision } from "./spatial-precision.ts";

/**
 * What species evidence North Ground holds, per species and per jurisdiction.
 *
 * The honest starting state of a matrix like this is empty, and saying so is
 * the whole point. A cell with no entry is IN_RESEARCH — nobody has looked —
 * which is a different and much weaker statement than UNAVAILABLE, which means
 * someone looked and the authority publishes nothing usable. Conflating the two
 * is how a coverage map comes to claim work that was never done.
 *
 * So every count here is computed from the entries at call time, never typed.
 * A jurisdiction cannot be made to look covered by editing a number, exactly as
 * `canada/report.ts` established for regulatory coverage. This matrix is its
 * counterpart for species evidence, and deliberately mirrors its discipline.
 *
 * Entries are added only from PRIMARY sources — the authority's own
 * publication — and Canadian source certification belongs to the Canada
 * workstream. This module records findings and their provenance; it does not
 * certify a source itself.
 */

export interface EvidenceMatrixEntry {
  speciesId: string;
  jurisdictionId: string;
  tier: EvidenceTier;
  coverage: IntelligenceCoverage;
  /** The finest the authority actually publishes, which caps every drawing of it. */
  precision: SpatialPrecision;
  /** The authority's own publication. A portal mirror is not a primary source. */
  authority: string;
  sourceUrl: string;
  /** ISO date a person read the source and recorded this row. */
  verifiedAt: string;
  /** What is known to be missing or qualified, in a reviewer's words. */
  limitation: string;
}

/**
 * The researched cells. Empty until a primary source has been read.
 *
 * Adding a row is a claim that someone opened the authority's own publication
 * and recorded what it says, including when it says nothing.
 */
export const EVIDENCE_MATRIX: readonly EvidenceMatrixEntry[] = [];

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
  /** What a person is told about this cell, including when it is empty. */
  explanation: string;
}

/**
 * One cell, including the empty ones.
 *
 * Never returns null. An absent cell is a real answer — nobody has looked —
 * and returning nothing would let a caller render blank, which a hunter reads
 * as "no animals here".
 */
export function matrixCell(speciesId: string, jurisdictionId: string): MatrixCell {
  const entries = EVIDENCE_MATRIX.filter((entry) => entry.speciesId === speciesId && entry.jurisdictionId === jurisdictionId);
  if (!entries.length) {
    return { speciesId, jurisdictionId, coverage: "IN_RESEARCH", tiers: [], entries: [], explanation: COVERAGE_EXPLANATIONS.IN_RESEARCH };
  }
  // The cell is as covered as its best-covered entry; the weaker ones remain
  // listed rather than being averaged away.
  const order: IntelligenceCoverage[] = ["AVAILABLE", "PARTIAL", "STALE", "UNRESOLVED", "RESTRICTED", "UNAVAILABLE", "IN_RESEARCH"];
  const coverage = order.find((state) => entries.some((entry) => entry.coverage === state))!;
  return {
    speciesId,
    jurisdictionId,
    coverage,
    tiers: [...new Set(entries.map(({ tier }) => tier))].sort(),
    entries,
    explanation: COVERAGE_EXPLANATIONS[coverage],
  };
}

export interface MatrixReport {
  /** Cells with at least one researched entry. */
  researchedCells: number;
  /** Species × in-scope jurisdictions that no entry names. */
  unresearchedCells: number;
  speciesCount: number;
  jurisdictionCount: number;
  byCoverage: Record<IntelligenceCoverage, number>;
  /** Named so a reviewer can see exactly which cells are claimed, not just how many. */
  researched: Array<{ speciesId: string; jurisdictionId: string; coverage: IntelligenceCoverage }>;
}

/**
 * The matrix's own coverage, computed rather than declared.
 *
 * `speciesIds` is passed in rather than held here, because which species are in
 * scope is the species library's question, not this module's.
 */
export function matrixReport(speciesIds: readonly string[]): MatrixReport {
  const jurisdictions = matrixJurisdictions();
  const byCoverage: Record<IntelligenceCoverage, number> = {
    AVAILABLE: 0, PARTIAL: 0, STALE: 0, RESTRICTED: 0, UNRESOLVED: 0, UNAVAILABLE: 0, IN_RESEARCH: 0,
  };
  const researched: MatrixReport["researched"] = [];
  let researchedCells = 0;

  for (const speciesId of speciesIds) {
    for (const { id } of jurisdictions) {
      const cell = matrixCell(speciesId, id);
      byCoverage[cell.coverage] += 1;
      if (cell.entries.length) {
        researchedCells += 1;
        researched.push({ speciesId, jurisdictionId: id, coverage: cell.coverage });
      }
    }
  }

  return {
    researchedCells,
    unresearchedCells: speciesIds.length * jurisdictions.length - researchedCells,
    speciesCount: speciesIds.length,
    jurisdictionCount: jurisdictions.length,
    byCoverage,
    researched,
  };
}

/** Structural faults a reviewer must fix before a row may be trusted. */
export function validateEvidenceMatrix(): string[] {
  const problems: string[] = [];
  const known = new Set(CANADA_JURISDICTIONS.map(({ id }) => id));
  const seen = new Set<string>();
  for (const entry of EVIDENCE_MATRIX) {
    const key = `${entry.speciesId}|${entry.jurisdictionId}|${entry.tier}`;
    if (seen.has(key)) problems.push(`Duplicate entry for ${key}`);
    seen.add(key);
    if (!known.has(entry.jurisdictionId as never)) problems.push(`${key} names a jurisdiction the registry does not declare`);
    if (!entry.sourceUrl.startsWith("https://")) problems.push(`${key} must cite an HTTPS primary source`);
    if (!entry.authority.trim()) problems.push(`${key} must name the authority that published it`);
    if (!entry.limitation.trim()) problems.push(`${key} must state its limitation; an empty one is a claim of completeness`);
    // A researched cell that found nothing is UNAVAILABLE — a finding. It may
    // not be recorded as IN_RESEARCH, which would erase the work of looking.
    if (entry.coverage === "IN_RESEARCH") problems.push(`${key} is an entry, so it has been researched; IN_RESEARCH is the state of cells with no entry`);
  }
  return problems;
}
