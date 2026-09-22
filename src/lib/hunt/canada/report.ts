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

import { REGULATORY_REGISTRY, regulatoryEntryFor } from "../regulatory/registry.ts";
import { certifiedUnitCount } from "./certified-units.ts";
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
  /** Present only where the owner has set a jurisdiction outside the current target. */
  scope?: CanadaJurisdiction["scope"];
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
  /** Jurisdictions the owner has set outside the current target, with the date and reason. */
  outOfScope: Array<{ id: CanadaJurisdiction["id"]; name: string; decidedOn: string; reason: string }>;
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
 * A jurisdiction's certified numbers, read from the regulatory registry — the
 * same list Hunt evaluates from — so the report, the species surfaces and what
 * Hunt can actually answer cannot disagree. A jurisdiction with no entry has no
 * certified rules, and says so with empty rows rather than a typed zero.
 */
function coverageFor(jurisdiction: CanadaJurisdiction): JurisdictionCoverage {
  const coverage = regulatoryEntryFor(jurisdiction.id)?.coverage();
  const species = coverage?.species ?? [];
  /*
   * How many official units the authority has is a fact about the geography,
   * so it is read from the bundle itself rather than through the answering
   * entry, and from the certified ingestion adapter where there is no bundle:
   * geography certified ahead of its rules is still counted, and the reduce
   * below still requires parity certification.
   */
  const officialUnits =
    REGULATORY_REGISTRY.find((entry) => entry.jurisdictionId === jurisdiction.id)?.coverage().officialUnits
    ?? certifiedUnitCount(jurisdiction.id);

  return {
    id: jurisdiction.id,
    code: jurisdiction.code,
    nameEn: jurisdiction.nameEn,
    nameFr: jurisdiction.nameFr,
    kind: jurisdiction.kind,
    ...(jurisdiction.scope ? { scope: jurisdiction.scope } : {}),
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
  const inScope = provincesAndTerritories.filter((entry) => entry.scope?.state !== "OUT_OF_SCOPE");
  const outOfScope = provincesAndTerritories.filter((entry) => entry.scope?.state === "OUT_OF_SCOPE");
  const outOfScopeNote = outOfScope.length
    ? ` ${outOfScope.map((entry) => entry.nameEn).join(" and ")} ${outOfScope.length === 1 ? "is" : "are"} out of scope by owner decision and ${outOfScope.length === 1 ? "is" : "are"} not counted either way.`
    : "";

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
    /* Out of scope is reported, never hidden: a jurisdiction the owner has set
       aside still says so, with the date and the reason. */
    outOfScope: outOfScope.map((entry) => ({ id: entry.id, name: entry.nameEn, decidedOn: entry.scope!.decidedOn, reason: entry.scope!.reason })),
    milestones: {
      spatialComplete: {
        met: inScope.every((entry) => entry.spatial.parityCertified),
        detail:
          `${inScope.filter((entry) => entry.spatial.parityCertified).length} of ` +
          `${inScope.length} in-scope provinces and territories have parity-certified official geography.${outOfScopeNote}`,
      },
      coreGameComplete: {
        met: inScope.every((entry) => entry.regulatory.rules > 0),
        detail:
          `${inScope.filter((entry) => entry.regulatory.rules > 0).length} of ${inScope.length} in-scope provinces and ` +
          `territories hold at least one certified regulatory rule.${outOfScopeNote}`,
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
