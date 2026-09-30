import registryJson from "../../../../content/intelligence/source-registry.json" with { type: "json" };
import type { DatasetCoverage } from "./types.ts";

export interface IntelligenceDatasetRecord {
  id: string;
  layer: string;
  jurisdictionId: string;
  speciesIds: string[];
  authority: string;
  title: string;
  url: string;
  resourceUrl: string;
  datasetIdentifier?: string;
  spatialResolution: string;
  temporalCoverage: string;
  licence: string;
  licenceUrl?: string;
  commercialReuse: "ALLOWED" | "PROHIBITED" | "UNCLEAR";
  redistribution: "ALLOWED" | "PROHIBITED" | "UNCLEAR" | "RUNTIME_ONLY";
  legalStanding: string;
  ingestionStatus: string;
  productionStatus: DatasetCoverage;
  limitations: string;
}

/**
 * Whether anything finer than a management zone EXISTS, and why not where it
 * does not.
 *
 * This is machine-readable because the answer is a product answer, not a
 * footnote: for moose, deer, elk and bear there is no public Canadian evidence
 * finer than the zone, and Hunt has to be able to SAY that where a hunter looks
 * for it rather than render around the gap. A status here is a finding about
 * the search — what was looked at, by whom, and what it turned out to be — and
 * never a finding about the animals.
 */
export type SubZoneEvidenceStatus =
  /** Finer evidence exists and is held. It is a sample, so it covers only what was surveyed. */
  | "AVAILABLE_SAMPLED"
  /** The authority surveys finer but publishes only prose or PDF at that resolution. */
  | "NOT_MACHINE_READABLE"
  /** Finer evidence exists and its licence forbids the use. */
  | "LICENCE_BLOCKED"
  /** The authority publishes at zone resolution and no finer. */
  | "ZONE_RESOLUTION_ONLY"
  /** The authority publishes nothing about where the animals are, at any resolution. */
  | "NONE_PUBLISHED";

export interface SubZoneEvidenceFinding {
  id: string;
  speciesGroup: string;
  jurisdictionIds: string[];
  status: SubZoneEvidenceStatus;
  authoritySearched: string;
  /** What resolution it reaches, where it reaches one. */
  resolution: string | null;
  reason: string;
  /** The datasets that hold it, where a finding claims finer evidence exists. */
  datasetIds?: string[];
  verifiedAt: string;
}

const registry = registryJson as unknown as {
  schemaVersion: number;
  verifiedAt: string;
  datasets: IntelligenceDatasetRecord[];
  subZoneEvidence: { note: string; findings: SubZoneEvidenceFinding[] };
};

/** Every recorded finding about evidence finer than a zone. */
export function subZoneEvidenceFindings(): readonly SubZoneEvidenceFinding[] {
  return registry.subZoneEvidence.findings;
}

/**
 * What Hunt can say about finer evidence for a species group in one place.
 *
 * Null means nobody has looked yet, which is different from having looked and
 * found nothing — the distinction §41B draws between UNAVAILABLE and
 * IN_RESEARCH, and the reason this returns a finding rather than a boolean.
 */
export function subZoneEvidenceFor(speciesGroup: string, jurisdictionId: string): SubZoneEvidenceFinding | null {
  return registry.subZoneEvidence.findings.find(
    (finding) => finding.speciesGroup === speciesGroup && finding.jurisdictionIds.includes(jurisdictionId),
  ) ?? null;
}

export function intelligenceDatasetRegistry(): readonly IntelligenceDatasetRecord[] {
  return registry.datasets;
}

export function datasetsForLayer(layer: string, jurisdictionId?: string): readonly IntelligenceDatasetRecord[] {
  return registry.datasets.filter((dataset) => dataset.layer === layer && (!jurisdictionId || dataset.jurisdictionId === jurisdictionId));
}

export function validateIntelligenceDatasetRegistry(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const dataset of registry.datasets) {
    if (ids.has(dataset.id)) errors.push(`Duplicate dataset id ${dataset.id}`);
    ids.add(dataset.id);
    if (!dataset.url.startsWith("https://") || !dataset.resourceUrl.startsWith("https://")) errors.push(`${dataset.id} must use HTTPS sources`);
    if (dataset.productionStatus === "VERIFIED" && dataset.redistribution !== "ALLOWED" && dataset.redistribution !== "RUNTIME_ONLY") {
      errors.push(`${dataset.id} cannot be VERIFIED without allowed delivery`);
    }
    if (dataset.productionStatus === "LICENCE_PENDING" && dataset.ingestionStatus === "INGESTED") {
      errors.push(`${dataset.id} cannot be ingested while its licence is pending`);
    }
    if (!dataset.limitations.trim()) errors.push(`${dataset.id} must state limitations`);
  }
  /* A finding with no reason is a status nobody can act on or challenge, and a
     status claiming finer evidence without naming the resolution is the same
     overclaim in the other direction. */
  const findingIds = new Set<string>();
  for (const finding of registry.subZoneEvidence.findings) {
    if (findingIds.has(finding.id)) errors.push(`Duplicate sub-zone finding ${finding.id}`);
    findingIds.add(finding.id);
    if (!finding.reason.trim()) errors.push(`${finding.id} must say why`);
    if (!finding.jurisdictionIds.length) errors.push(`${finding.id} must name the jurisdictions it was established for`);
    if (finding.status === "AVAILABLE_SAMPLED") {
      if (!finding.resolution) errors.push(`${finding.id} claims finer evidence and must state its resolution`);
      if (!finding.datasetIds?.length) errors.push(`${finding.id} claims finer evidence and must name the datasets holding it`);
      for (const datasetId of finding.datasetIds ?? []) {
        if (!ids.has(datasetId)) errors.push(`${finding.id} names a dataset that is not registered: ${datasetId}`);
      }
    }
  }
  return errors;
}
