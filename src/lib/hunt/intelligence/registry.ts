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

const registry = registryJson as unknown as { schemaVersion: number; verifiedAt: string; datasets: IntelligenceDatasetRecord[] };

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
  return errors;
}
