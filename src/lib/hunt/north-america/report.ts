/**
 * The North American coverage report: Canada and the United States, from one
 * regulatory registry.
 *
 * Not a second truth beside the Canada report. Canada's report is used as it
 * is; the United States half is computed the same way — from the regulatory
 * registry Hunt evaluates from, gated on a served layer — so a species can be
 * "Ontario VERIFIED, Colorado PARTIAL, Idaho UNKNOWN" and every surface that
 * reads coverage (the library, profiles, the Hunt selector) says exactly that.
 *
 * Nothing here is typed by hand. A state with no certified bundle has empty
 * rows and says so; 51 jurisdictions tracked is not 51 covered.
 */

import { canadaCoverageReport, type CanadaCoverageReport, type SpeciesCoverageRow, type SpeciesJurisdictionCoverage } from "../canada/report.ts";
import type { CoverageState } from "../canada/registry.ts";
import { regulatoryEntryFor } from "../regulatory/registry.ts";
import { UNITED_STATES_JURISDICTIONS, type UnitedStatesJurisdiction } from "../united-states/registry.ts";

export interface UnitedStatesJurisdictionCoverage {
  id: UnitedStatesJurisdiction["id"];
  code: string;
  nameEn: string;
  kind: UnitedStatesJurisdiction["kind"];
  spatial: {
    status: CoverageState;
    officialTerm: string;
    parityCertified: boolean;
    officialUnits: number | null;
    officialSourceUrl: string;
  };
  regulatory: {
    status: CoverageState;
    speciesCertified: number;
    rules: number;
    bundles: string[];
    sourceState: string;
  };
  species: SpeciesCoverageRow[];
  research: UnitedStatesJurisdiction["research"];
  knownGaps: string[];
}

export interface UnitedStatesCoverageReport {
  generatedFor: "united-states";
  jurisdictions: UnitedStatesJurisdictionCoverage[];
  totals: {
    /** 50 states and D.C.; the federal layer is counted separately. */
    statesAndDistrict: number;
    researchedInDepth: number;
    spatiallyCertified: number;
    withCertifiedRules: number;
    speciesCertified: number;
    rules: number;
    officialUnitsIngested: number;
  };
}

function coverageFor(jurisdiction: UnitedStatesJurisdiction): UnitedStatesJurisdictionCoverage {
  const coverage = regulatoryEntryFor(jurisdiction.id)?.coverage();
  const species = coverage?.species ?? [];
  return {
    id: jurisdiction.id,
    code: jurisdiction.code,
    nameEn: jurisdiction.nameEn,
    kind: jurisdiction.kind,
    spatial: {
      status: jurisdiction.spatial.status,
      officialTerm: jurisdiction.spatial.officialTerm,
      parityCertified: jurisdiction.spatial.parityCertified,
      officialUnits: coverage?.officialUnits ?? null,
      officialSourceUrl: jurisdiction.spatial.officialSourceUrl,
    },
    regulatory: {
      status: jurisdiction.regulatory.status,
      speciesCertified: species.length,
      rules: species.reduce((total, entry) => total + entry.rules, 0),
      bundles: jurisdiction.regulatory.bundleIds,
      sourceState: jurisdiction.regulatory.sourceState,
    },
    species,
    research: jurisdiction.research,
    knownGaps: jurisdiction.knownGaps,
  };
}

export function unitedStatesCoverageReport(): UnitedStatesCoverageReport {
  const jurisdictions = UNITED_STATES_JURISDICTIONS.map(coverageFor);
  const states = jurisdictions.filter((entry) => entry.kind !== "federal");
  return {
    generatedFor: "united-states",
    jurisdictions,
    totals: {
      statesAndDistrict: states.length,
      researchedInDepth: UNITED_STATES_JURISDICTIONS.filter((entry) => entry.kind !== "federal" && entry.research.depth === "WAVE_1_DEEP").length,
      spatiallyCertified: states.filter((entry) => entry.spatial.parityCertified).length,
      withCertifiedRules: states.filter((entry) => entry.regulatory.rules > 0).length,
      speciesCertified: new Set(jurisdictions.flatMap((entry) => entry.species.map((row) => row.speciesId))).size,
      rules: jurisdictions.reduce((total, entry) => total + entry.regulatory.rules, 0),
      officialUnitsIngested: states.reduce((total, entry) => total + (entry.spatial.parityCertified ? entry.spatial.officialUnits ?? 0 : 0), 0),
    },
  };
}

export interface NorthAmericaCoverageReport {
  generatedFor: "north-america";
  canada: CanadaCoverageReport;
  unitedStates: UnitedStatesCoverageReport;
  totals: {
    jurisdictionsWithRules: number;
    rules: number;
    speciesCertified: number;
  };
}

export function northAmericaCoverageReport(): NorthAmericaCoverageReport {
  const canada = canadaCoverageReport();
  const unitedStates = unitedStatesCoverageReport();
  const all = [...canada.jurisdictions, ...unitedStates.jurisdictions];
  return {
    generatedFor: "north-america",
    canada,
    unitedStates,
    totals: {
      jurisdictionsWithRules: all.filter((entry) => entry.regulatory.rules > 0).length,
      rules: canada.totals.rules + unitedStates.totals.rules,
      speciesCertified: new Set(all.flatMap((entry) => entry.species.map((row) => row.speciesId))).size,
    },
  };
}

/**
 * Jurisdiction-aware rule coverage for one canonical species, across both
 * countries. The library, profiles and Hunt selector read this, so a species
 * certified in Colorado says "Colorado" and never implies Idaho or Ontario.
 */
export function regulatoryJurisdictionsForSpecies(
  speciesId: string,
  report: NorthAmericaCoverageReport = northAmericaCoverageReport(),
): SpeciesJurisdictionCoverage[] {
  return [...report.canada.jurisdictions, ...report.unitedStates.jurisdictions].flatMap((jurisdiction) => {
    const species = jurisdiction.species.find((entry) => entry.speciesId === speciesId);
    return species ? [{ id: jurisdiction.id, code: jurisdiction.code, nameEn: jurisdiction.nameEn, requiresInput: species.requiresInput }] : [];
  });
}
