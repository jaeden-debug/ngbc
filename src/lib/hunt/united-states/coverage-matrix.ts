import hoursEvidence from "../../../../content/registry/us-hunting-hours-evidence.json" with { type: "json" };
import coverageEvidence from "../../../../content/registry/us-coverage-evidence.generated.json" with { type: "json" };
import { certificationFor, type StateCertification } from "./certification.ts";
import { UNITED_STATES_JURISDICTIONS, type UnitedStatesJurisdiction } from "./registry.ts";

/** The user-facing production classification requested for every state. */
export type StateProductionStatus = "COMPLETE" | "PARTIAL" | "BOUNDARIES_ONLY" | "REGULATIONS_ONLY" | "UNSUPPORTED";

export type HuntingHoursStatus = "NOT_CERTIFIED" | "RULE_CERTIFIED_EXACT_CLOCK_UNAVAILABLE" | "CERTIFIED_EXACT_POINT";

export interface UnitedStatesCoverageMatrixRow {
  code: string;
  jurisdictionId: string;
  name: string;
  productionStatus: StateProductionStatus;
  authority: UnitedStatesJurisdiction["authority"];
  regulationsSource: UnitedStatesJurisdiction["officialSources"][number];
  boundarySource: UnitedStatesJurisdiction["officialSources"][number] | null;
  managementGeography: string;
  map: StateCertification["map"];
  species: { status: StateCertification["regulations"]["status"]; canonicalIds: string[] };
  regulations: StateCertification["regulations"];
  huntingHours: {
    status: HuntingHoursStatus;
    basis: string | null;
    sourceId: string | null;
    citation: string | null;
    detail: string;
  };
  provenance: "CERTIFIED" | "DISCOVERED";
  intelligence: StateCertification["intelligence"];
  readyToHunt: "SUPPORTED" | "PARTIAL" | "NOT_IMPLEMENTED";
  knownGaps: string[];
}

type HoursRecord = {
  status: Exclude<HuntingHoursStatus, "NOT_CERTIFIED">;
  basis: string;
  sourceId: string;
  citation: string;
  detail: string;
};

const hours = hoursEvidence.states as Record<string, HoursRecord | undefined>;
type MatrixSource = UnitedStatesJurisdiction["officialSources"][number];
type ParityEvidence = { layerId: string; service: string; legalStanding: string };
type BundleEvidence = { source?: { id: string; title: string; url: string; licence: string | null } | null };
const parityEvidence = coverageEvidence.parity as Record<string, ParityEvidence[] | undefined>;
const bundleEvidence = coverageEvidence.bundles as Record<string, BundleEvidence[] | undefined>;

function productionStatus(certification: StateCertification): StateProductionStatus {
  const mapServed = certification.map.status === "SERVED";
  const regulationsServed = certification.regulations.status === "SERVED";
  if (mapServed && regulationsServed) return "PARTIAL"; // Hours/readiness/core-species breadth still gate COMPLETE.
  if (mapServed) return "BOUNDARIES_ONLY";
  if (["CERTIFIED", "SERVED"].includes(certification.regulations.status)) return "REGULATIONS_ONLY";
  if (certification.map.status === "CERTIFIED" || certification.regulations.status === "PARTIAL") return "PARTIAL";
  return "UNSUPPORTED";
}

function isBoundarySource(source: UnitedStatesJurisdiction["officialSources"][number]): boolean {
  return /GIS|MAP|BOUNDAR|UNIT|DISTRICT|ZONE/i.test(`${source.scope} ${source.title}`) && source.scope !== "STATE_OFFICIAL_HUB";
}

function certifiedRegulationsSource(code: string, fallback: MatrixSource): MatrixSource {
  const source = bundleEvidence[code]?.find((bundle) => bundle.source)?.source;
  return source ? {
    id: source.id,
    scope: "ANNUAL_REGULATION",
    title: source.title,
    url: source.url,
    legalStanding: source.licence ?? "Certified production regulation source.",
    licenceStatus: "FACT_EXTRACTION_RECORDED",
    verificationStatus: "CERTIFIED",
  } : fallback;
}

function certifiedBoundarySource(code: string, fallback: MatrixSource | null): MatrixSource | null {
  const source = parityEvidence[code]?.[0];
  return source ? {
    id: `${source.layerId}:official-service`,
    scope: "OFFICIAL_GIS_SERVICE",
    title: "Official hunting-management boundary service",
    url: source.service,
    legalStanding: source.legalStanding,
    licenceStatus: "SEE_MAP_LAYER_LICENCE",
    verificationStatus: "CERTIFIED_PARITY",
  } : fallback;
}

export function unitedStatesCoverageMatrix(): UnitedStatesCoverageMatrixRow[] {
  return UNITED_STATES_JURISDICTIONS
    .filter((jurisdiction) => jurisdiction.kind !== "federal")
    .map((jurisdiction) => {
      const code = jurisdiction.code.slice(3);
      const certification = certificationFor(code);
      const regulationsSource = jurisdiction.officialSources.find((source) => source.scope === "STATE_OFFICIAL_HUB");
      if (!regulationsSource) throw new Error(`${code} has no official regulations source`);
      const hour = hours[code];
      return {
        code,
        jurisdictionId: jurisdiction.id,
        name: jurisdiction.nameEn,
        productionStatus: productionStatus(certification),
        authority: jurisdiction.authority,
        regulationsSource: certifiedRegulationsSource(code, regulationsSource),
        boundarySource: certifiedBoundarySource(code, jurisdiction.officialSources.find(isBoundarySource) ?? null),
        managementGeography: jurisdiction.spatial.officialTerm,
        map: certification.map,
        species: { status: certification.regulations.status, canonicalIds: certification.regulations.species },
        regulations: certification.regulations,
        huntingHours: hour ?? {
          status: "NOT_CERTIFIED",
          basis: null,
          sourceId: null,
          citation: null,
          detail: "No state hunting-hours rule is certified in the production regulatory path.",
        },
        provenance: certification.map.status === "SERVED" || ["CERTIFIED", "SERVED"].includes(certification.regulations.status)
          ? "CERTIFIED"
          : "DISCOVERED",
        intelligence: certification.intelligence,
        readyToHunt: code === "ID" ? "PARTIAL" : "NOT_IMPLEMENTED",
        knownGaps: [
          ...jurisdiction.knownGaps.filter((gap) =>
            !(certification.map.layers.length > 0 || certification.regulations.rules > 0) ||
            !gap.startsWith("No geometry ingested and no rules certified;")),
          ...(certification.map.detail ? [certification.map.detail] : []),
          ...(hour ? [] : ["Hunting-hours coverage is not certified."]),
          code === "ID"
            ? "Ready to Hunt covers the hunting licence and controlled-hunt tag only; methods, orange, education, ammunition and current fees remain uncertified."
            : "Ready to Hunt requirements are not implemented for this state.",
        ],
      } satisfies UnitedStatesCoverageMatrixRow;
    });
}
