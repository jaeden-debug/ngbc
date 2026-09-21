import bundleJson from "../../../../content/intelligence/ca-on-white-tailed-deer-harvest.json" with { type: "json" };
import { classifyOpportunity } from "./classification.ts";
import type { EvidenceRecord, OpportunityResult } from "./types.ts";

interface OntarioHarvestBundle {
  schemaVersion: number;
  methodologyVersion: string;
  speciesId: string;
  jurisdictionId: string;
  coverage: string;
  latestObservationYear: number;
  limitations: string[];
  source: {
    id: string;
    authority: string;
    title: string;
    url: string;
    resourceUrl: string;
    licence: string;
    licenceUrl: string;
    sourceHash: string;
    retrievedAt: string;
    verifiedAt: string;
  };
  evidence: EvidenceRecord[];
}

const bundle = bundleJson as unknown as OntarioHarvestBundle;
const byGeography = new Map<string, EvidenceRecord[]>();
for (const record of bundle.evidence) {
  const records = byGeography.get(record.geographyId) ?? [];
  records.push(record);
  byGeography.set(record.geographyId, records);
}

export interface OpportunityResponse {
  result: OpportunityResult;
  source: OntarioHarvestBundle["source"];
  limitations: string[];
  latestObservationYear: number;
}

/** The first production evidence adapter. Other datasets implement this boundary. */
export function ontarioWhiteTailedDeerOpportunity(geographyId: string): OpportunityResponse | null {
  const records = byGeography.get(geographyId);
  if (!records) return null;
  const result = classifyOpportunity(records);
  return result ? { result, source: bundle.source, limitations: bundle.limitations, latestObservationYear: bundle.latestObservationYear } : null;
}

export function ontarioHarvestEvidenceCoverage() {
  return {
    speciesId: bundle.speciesId,
    jurisdictionId: bundle.jurisdictionId,
    geographyCount: byGeography.size,
    evidenceRecordCount: bundle.evidence.length,
    latestObservationYear: bundle.latestObservationYear,
    coverage: bundle.coverage,
  } as const;
}
