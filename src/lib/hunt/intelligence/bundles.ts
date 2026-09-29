import bcBlackBear from "../../../../content/intelligence/ca-bc-american-black-bear-harvest.json" with { type: "json" };
import bcBobcat from "../../../../content/intelligence/ca-bc-bobcat-harvest.json" with { type: "json" };
import bcLynx from "../../../../content/intelligence/ca-bc-canada-lynx-harvest.json" with { type: "json" };
import bcCaribou from "../../../../content/intelligence/ca-bc-caribou-harvest.json" with { type: "json" };
import bcElk from "../../../../content/intelligence/ca-bc-elk-harvest.json" with { type: "json" };
import bcGrayWolf from "../../../../content/intelligence/ca-bc-gray-wolf-harvest.json" with { type: "json" };
import bcMoose from "../../../../content/intelligence/ca-bc-moose-harvest.json" with { type: "json" };
import bcMuleDeer from "../../../../content/intelligence/ca-bc-mule-deer-harvest.json" with { type: "json" };
import bcWhiteTailedDeer from "../../../../content/intelligence/ca-bc-white-tailed-deer-harvest.json" with { type: "json" };
import onWhiteTailedDeer from "../../../../content/intelligence/ca-on-white-tailed-deer-harvest.json" with { type: "json" };
import { classifyOpportunity } from "./classification.ts";
import type { EvidenceRecord, OpportunityResult } from "./types.ts";

/**
 * Every certified opportunity bundle, and what each one can actually answer.
 *
 * WHAT IS SERVABLE IS DERIVED FROM THE DATA, never declared. A bundle states
 * its own species, jurisdiction and geographies; this module indexes them and
 * nothing else decides. Adding a bundle to `BUNDLES` is the whole of adding a
 * species: no route, handler, list or UI constant names one.
 *
 * That rule exists because the first version of the endpoint hard-coded
 * `species:white-tailed-deer` and an Ontario-shaped zone pattern, which made
 * 97% of the committed evidence unreachable while every test still passed.
 */

export interface IntelligenceBundleSource {
  id: string;
  authority: string;
  title: string;
  url: string;
  resourceUrl: string;
  licence: string;
  licenceUrl: string;
  attribution?: string;
  sourceHash: string;
  retrievedAt: string;
  verifiedAt: string;
}

export interface IntelligenceBundle {
  schemaVersion: number;
  methodologyVersion: string;
  speciesId: string;
  jurisdictionId: string;
  coverage: string;
  latestObservationYear: number;
  limitations: string[];
  source: IntelligenceBundleSource;
  evidence: EvidenceRecord[];
}

/** The committed bundles. One line per dataset; nothing else lists them. */
const BUNDLES = [
  bcBlackBear, bcBobcat, bcLynx, bcCaribou, bcElk, bcGrayWolf, bcMoose, bcMuleDeer, bcWhiteTailedDeer,
  onWhiteTailedDeer,
] as unknown as IntelligenceBundle[];

export interface ServableDataset {
  speciesId: string;
  jurisdictionId: string;
  /** Geographies this dataset actually carries evidence for. */
  geographyCount: number;
  evidenceRecordCount: number;
  latestObservationYear: number;
  coverage: string;
  methodologyVersion: string;
  sourceId: string;
  authority: string;
}

interface Indexed {
  bundle: IntelligenceBundle;
  byGeography: Map<string, EvidenceRecord[]>;
}

const indexed: Indexed[] = BUNDLES.map((bundle) => {
  const byGeography = new Map<string, EvidenceRecord[]>();
  for (const record of bundle.evidence) {
    const records = byGeography.get(record.geographyId) ?? [];
    records.push(record);
    byGeography.set(record.geographyId, records);
  }
  return { bundle, byGeography };
});

/** speciesId → the datasets that carry evidence for it, whatever jurisdiction. */
const bySpecies = new Map<string, Indexed[]>();
for (const entry of indexed) {
  const list = bySpecies.get(entry.bundle.speciesId) ?? [];
  list.push(entry);
  bySpecies.set(entry.bundle.speciesId, list);
}

/** Every species × jurisdiction pair the committed evidence can answer for. */
export function servableDatasets(): readonly ServableDataset[] {
  return indexed.map(({ bundle, byGeography }) => ({
    speciesId: bundle.speciesId,
    jurisdictionId: bundle.jurisdictionId,
    geographyCount: byGeography.size,
    evidenceRecordCount: bundle.evidence.length,
    latestObservationYear: bundle.latestObservationYear,
    coverage: bundle.coverage,
    methodologyVersion: bundle.methodologyVersion,
    sourceId: bundle.source.id,
    authority: bundle.source.authority,
  }));
}

/** The species that have any opportunity evidence at all. */
export function speciesWithEvidence(): readonly string[] {
  return [...bySpecies.keys()].sort();
}

/** True when some committed bundle carries evidence for this species. */
export function hasEvidenceForSpecies(speciesId: string): boolean {
  return bySpecies.has(speciesId);
}

export interface OpportunityResponse {
  result: OpportunityResult;
  source: IntelligenceBundleSource;
  limitations: string[];
  latestObservationYear: number;
  jurisdictionId: string;
}

/**
 * One species at one geography, across every bundle.
 *
 * Null means NO EVIDENCE IS HELD HERE — never a cold or zero value. Absent
 * evidence is not evidence of absence (CLAUDE.md §41A, species layer).
 */
export function opportunityAt(speciesId: string, geographyId: string): OpportunityResponse | null {
  for (const { bundle, byGeography } of bySpecies.get(speciesId) ?? []) {
    const records = byGeography.get(geographyId);
    if (!records) continue;
    const result = classifyOpportunity(records);
    if (!result) continue;
    return {
      result,
      source: bundle.source,
      limitations: bundle.limitations,
      latestObservationYear: bundle.latestObservationYear,
      jurisdictionId: bundle.jurisdictionId,
    };
  }
  return null;
}

export interface ZoneOpportunity {
  geographyId: string;
  classification: OpportunityResult["classification"];
  coverage: OpportunityResult["coverage"];
}

/**
 * Many geographies at once: the shape a map layer needs.
 *
 * Only geographies WITH evidence come back. A caller must read a missing
 * geography as "nothing is held", and must not render it as a low value.
 */
export function opportunityAcross(speciesId: string, geographyIds: readonly string[]): ZoneOpportunity[] {
  const datasets = bySpecies.get(speciesId);
  if (!datasets) return [];
  const out: ZoneOpportunity[] = [];
  const seen = new Set<string>();
  for (const geographyId of geographyIds) {
    if (seen.has(geographyId)) continue;
    seen.add(geographyId);
    for (const { byGeography } of datasets) {
      const records = byGeography.get(geographyId);
      if (!records) continue;
      const result = classifyOpportunity(records);
      if (!result) break;
      out.push({ geographyId, classification: result.classification, coverage: result.coverage });
      break;
    }
  }
  return out;
}

/** The attribution and limitation a species' evidence carries, per jurisdiction touched. */
export function evidenceProvenance(speciesId: string): Array<{
  jurisdictionId: string;
  authority: string;
  title: string;
  url: string;
  licence: string;
  attribution?: string;
  latestObservationYear: number;
  limitations: string[];
}> {
  return (bySpecies.get(speciesId) ?? []).map(({ bundle }) => ({
    jurisdictionId: bundle.jurisdictionId,
    authority: bundle.source.authority,
    title: bundle.source.title,
    url: bundle.source.url,
    licence: bundle.source.licence,
    ...(bundle.source.attribution ? { attribution: bundle.source.attribution } : {}),
    latestObservationYear: bundle.latestObservationYear,
    limitations: bundle.limitations,
  }));
}
