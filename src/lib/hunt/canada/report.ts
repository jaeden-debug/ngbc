/**
 * The national coverage report.
 *
 * Every number here is computed from certified data at call time. Nothing is
 * declared, so the report cannot drift from what North Ground actually holds,
 * and a jurisdiction cannot be made to look covered by editing a constant.
 *
 * It exists to answer one question exactly: how much of Canadian hunting do we
 * cover? The honest answer today is "one province, partially" — and the report
 * says so with counts rather than adjectives.
 */

import { majorGameCoverageReport } from "../regulatory/major-game.ts";
import { ontarioCoverageReport } from "../regulatory/ontario.ts";
import { CANADA_JURISDICTIONS, type CanadaJurisdiction, type CoverageState } from "./registry.ts";
import type { CanonicalId } from "../../content-contract/index.ts";

export interface SpeciesCoverageRow {
  speciesId: string;
  /** Units where a certified rule can produce a season for this species. */
  unitsCovered: number;
  /** Units the authority itself declared closed. Not the same as uncovered. */
  unitsDeclaredClosed: number;
  /** Units no certified row names. The honest remainder. */
  unitsUnknown: number;
  rules: number;
  /** Facts the hunter must supply before this species can be answered. */
  requiresInput: boolean;
}

export interface JurisdictionCoverage {
  id: CanadaJurisdiction["id"];
  code: string;
  nameEn: string;
  nameFr: string;
  kind: CanadaJurisdiction["kind"];
  spatial: {
    status: CoverageState;
    officialTerm: string;
    parityCertified: boolean;
    /** Units the authority publishes, once its layer has been ingested. */
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
  knownGaps: string[];
}

export interface CanadaCoverageReport {
  generatedFor: "canada";
  jurisdictions: JurisdictionCoverage[];
  totals: {
    jurisdictions: number;
    spatialVerified: number;
    spatialInDevelopment: number;
    regulatoryPartialOrBetter: number;
    /** Distinct species with a certified rule anywhere in Canada. */
    speciesCertified: number;
    rules: number;
    officialUnitsIngested: number;
  };
  /** The national milestones from the blueprint, each with its own evidence. */
  milestones: {
    spatialComplete: { met: boolean; detail: string };
    coreGameComplete: { met: boolean; detail: string };
    migratoryComplete: { met: boolean; detail: string };
    coverageAudited: { met: boolean; detail: string };
  };
}

export interface SpeciesJurisdictionCoverage {
  id: CanonicalId<"jurisdiction">;
  code: string;
  nameEn: string;
  requiresInput: boolean;
}

/**
 * Ontario's certified numbers, read from the two bundles rather than restated.
 *
 * Small game and major game report differently because the province publishes
 * them differently: small game names the units a season covers, major game
 * names the units its season groupings reach. Both are normalised here to the
 * same three-way split — covered, declared closed, unknown — because that is
 * the distinction a reader needs and the one it is dangerous to blur.
 */
function ontarioSpecies(): SpeciesCoverageRow[] {
  const small = ontarioCoverageReport();
  const major = majorGameCoverageReport();

  const rows: SpeciesCoverageRow[] = small.species.map((entry) => ({
    speciesId: entry.speciesId,
    unitsCovered: entry.certifiedUnits,
    unitsDeclaredClosed: entry.declaredNoSeasonUnits,
    unitsUnknown: entry.unknownUnits,
    rules: entry.rules,
    requiresInput: false,
  }));

  for (const entry of major.species) {
    rows.push({
      speciesId: entry.speciesId,
      unitsCovered: entry.unitsReached,
      /* Major game counts rules that state "None" rather than units, because one
         such rule can close a whole grouping. Reported as its own figure rather
         than folded into the unit counts, which would overstate precision. */
      unitsDeclaredClosed: entry.rulesStatingNone,
      unitsUnknown: entry.unitsNotReached,
      rules: entry.rules,
      requiresInput: true,
    });
  }

  return rows.sort((left, right) => left.speciesId.localeCompare(right.speciesId));
}

function coverageFor(jurisdiction: CanadaJurisdiction): JurisdictionCoverage {
  const isOntario = jurisdiction.id === "jurisdiction:ca-on";
  const species = isOntario ? ontarioSpecies() : [];
  const officialUnits = isOntario ? ontarioCoverageReport().officialUnits : null;

  return {
    id: jurisdiction.id,
    code: jurisdiction.code,
    nameEn: jurisdiction.nameEn,
    nameFr: jurisdiction.nameFr,
    kind: jurisdiction.kind,
    spatial: {
      status: jurisdiction.spatial.status,
      officialTerm: jurisdiction.spatial.officialTerm,
      parityCertified: jurisdiction.spatial.parityCertified,
      officialUnits,
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
    knownGaps: jurisdiction.knownGaps,
  };
}

export function canadaCoverageReport(): CanadaCoverageReport {
  const jurisdictions = CANADA_JURISDICTIONS.map(coverageFor);

  const spatialVerified = jurisdictions.filter((entry) => entry.spatial.status === "VERIFIED").length;
  const speciesCertified = new Set(
    jurisdictions.flatMap((entry) => entry.species.map((row) => row.speciesId)),
  ).size;
  const rules = jurisdictions.reduce((total, entry) => total + entry.regulatory.rules, 0);
  const officialUnitsIngested = jurisdictions.reduce(
    (total, entry) => total + (entry.spatial.parityCertified ? entry.spatial.officialUnits ?? 0 : 0),
    0,
  );

  const federal = jurisdictions.find((entry) => entry.kind === "federal");
  const provincesAndTerritories = jurisdictions.filter((entry) => entry.kind !== "federal");
  const withRules = provincesAndTerritories.filter((entry) => entry.regulatory.rules > 0);

  return {
    generatedFor: "canada",
    jurisdictions,
    totals: {
      jurisdictions: jurisdictions.length,
      spatialVerified,
      spatialInDevelopment: jurisdictions.filter((entry) => entry.spatial.status === "IN_DEVELOPMENT").length,
      regulatoryPartialOrBetter: jurisdictions.filter(
        (entry) => entry.regulatory.status === "VERIFIED" || entry.regulatory.status === "PARTIAL",
      ).length,
      speciesCertified,
      rules,
      officialUnitsIngested,
    },
    milestones: {
      spatialComplete: {
        met: provincesAndTerritories.every((entry) => entry.spatial.parityCertified),
        detail:
          `${provincesAndTerritories.filter((entry) => entry.spatial.parityCertified).length} of ` +
          `${provincesAndTerritories.length} provinces and territories have parity-certified official geography.`,
      },
      coreGameComplete: {
        met: provincesAndTerritories.every((entry) => entry.regulatory.rules > 0),
        detail:
          `${withRules.length} of ${provincesAndTerritories.length} provinces and territories hold at least one ` +
          "certified regulatory rule.",
      },
      migratoryComplete: {
        met: (federal?.regulatory.rules ?? 0) > 0,
        detail:
          (federal?.regulatory.rules ?? 0) > 0
            ? "Federal migratory-game-bird rules are certified."
            : "No federal migratory-game-bird rules are certified, so every waterfowl query is UNKNOWN.",
      },
      coverageAudited: {
        /* The one milestone that is currently met: every jurisdiction states its
           own gaps, so nothing is missing by accident. */
        met: jurisdictions.every((entry) => entry.knownGaps.length > 0 || entry.regulatory.rules > 0),
        detail:
          "Every jurisdiction declares its known gaps, so remaining coverage is intentionally UNKNOWN " +
          "rather than accidentally absent.",
      },
    },
  };
}

/**
 * Jurisdiction-aware rule coverage for one canonical species.
 *
 * This reads the same computed report used by the national coverage surface, so
 * publishing a profile never turns into a global claim that rules exist. When a
 * new jurisdiction is wired into the report, the library, profiles and Hunt
 * selector gain its coverage without editing any species profile.
 */
export function regulatoryJurisdictionsForSpecies(
  speciesId: string,
  report: CanadaCoverageReport = canadaCoverageReport(),
): SpeciesJurisdictionCoverage[] {
  return report.jurisdictions.flatMap((jurisdiction) => {
    const species = jurisdiction.species.find((entry) => entry.speciesId === speciesId);
    return species ? [{
      id: jurisdiction.id,
      code: jurisdiction.code,
      nameEn: jurisdiction.nameEn,
      requiresInput: species.requiresInput,
    }] : [];
  });
}
