import bcBlackBear from "../../../../content/intelligence/ca-bc-american-black-bear-harvest.json" with { type: "json" };
import bcBobcat from "../../../../content/intelligence/ca-bc-bobcat-harvest.json" with { type: "json" };
import bcLynx from "../../../../content/intelligence/ca-bc-canada-lynx-harvest.json" with { type: "json" };
import bcCaribou from "../../../../content/intelligence/ca-bc-caribou-harvest.json" with { type: "json" };
import bcElk from "../../../../content/intelligence/ca-bc-elk-harvest.json" with { type: "json" };
import bcGrayWolf from "../../../../content/intelligence/ca-bc-gray-wolf-harvest.json" with { type: "json" };
import bcMoose from "../../../../content/intelligence/ca-bc-moose-harvest.json" with { type: "json" };
import bcMuleDeer from "../../../../content/intelligence/ca-bc-mule-deer-harvest.json" with { type: "json" };
import bcWhiteTailedDeer from "../../../../content/intelligence/ca-bc-white-tailed-deer-harvest.json" with { type: "json" };
import onBlackBear from "../../../../content/intelligence/ca-on-american-black-bear-harvest.json" with { type: "json" };
import onMoose from "../../../../content/intelligence/ca-on-moose-harvest.json" with { type: "json" };
import onWhiteTailedDeer from "../../../../content/intelligence/ca-on-white-tailed-deer-harvest.json" with { type: "json" };
import onWildTurkey from "../../../../content/intelligence/ca-on-wild-turkey-harvest.json" with { type: "json" };
import { permitsHuntingOpportunity } from "../../content/species-eligibility.ts";
import { classifyOpportunity } from "./classification.ts";
import { EWS25_BUNDLES } from "./ews25.ts";
import {
  METRIC_MEANINGS,
  METRIC_ROLES,
  OPPORTUNITY_METHODOLOGY,
  appliedWeights,
  evidenceGrade,
  independentValueCount,
} from "./methodology.ts";
import type { EvidenceGrade } from "./methodology.ts";
import type { HeatRenderKind } from "./rendering.ts";
import { RENDER_KIND_MEANINGS, renderKindFor } from "./rendering.ts";
import type { EvidenceRecord, IntelligenceMetric, OpportunityResult } from "./types.ts";

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

/**
 * When the authority looked, when its answer applies, and what to say when
 * those are not the same season.
 *
 * WHY THIS IS A FIELD AND NOT A LIMITATION STRING. The Eastern Waterfowl Survey
 * counts BREEDING birds in May. Drawn on a hunting map in October it looks like
 * an answer to "where are the ducks now" and is an answer to a different
 * question. A hunter reading the shade has to be told that where they are
 * reading it, not in a panel they may never open — so it travels with the heat
 * on every surface that carries the heat, and a bundle whose survey season and
 * hunting season differ cannot omit it.
 */
export interface SeasonalBasis {
  /** When the authority actually counted. The authority's own words. */
  observedSeason: string;
  /** Whether that season is the one a hunter is asking about. */
  matchesHuntingSeason: boolean;
  /** One sentence, shown beside the shade. Required when the seasons differ. */
  warning?: string;
}

export interface IntelligenceBundle {
  schemaVersion: number;
  methodologyVersion: string;
  speciesId: string;
  jurisdictionId: string;
  coverage: string;
  latestObservationYear: number;
  limitations: string[];
  /** Absent where the authority's season is the hunting season. */
  seasonalBasis?: SeasonalBasis;
  source: IntelligenceBundleSource;
  evidence: EvidenceRecord[];
}

/**
 * A bundle whose seasons differ MUST carry the sentence to show. Enforced at
 * load, not at review: a missing warning is silent, and the failure it causes
 * is a hunter believing a May map in October.
 */
function assertSeasonalBasis(bundle: IntelligenceBundle): void {
  const basis = bundle.seasonalBasis;
  if (!basis) return;
  if (!basis.matchesHuntingSeason && !basis.warning?.trim()) {
    throw new Error(
      `${bundle.speciesId}/${bundle.jurisdictionId}: surveyed in ${basis.observedSeason}, which is not the hunting season, and carries no warning to show`,
    );
  }
}

/** The committed bundles. One line per dataset; nothing else lists them. */
const BUNDLES = [
  bcBlackBear, bcBobcat, bcLynx, bcCaribou, bcElk, bcGrayWolf, bcMoose, bcMuleDeer, bcWhiteTailedDeer,
  onWhiteTailedDeer, onMoose, onBlackBear, onWildTurkey,
] as unknown as IntelligenceBundle[];

/* The harvest datasets above, plus the Eastern Waterfowl Survey's plot evidence.
   Both are bundles and neither is privileged; what each one may claim is carried
   in the bundle, not in this list. */
const ALL_BUNDLES = [...BUNDLES, ...EWS25_BUNDLES];

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
  /** Every metric the dataset publishes for this species, and what each may do. */
  metrics: Array<{ metric: IntelligenceMetric; role: string; contributes: boolean }>;
  /** How many of those are independently published rather than derived from the others. */
  independentValues: number;
  /** The owner's A-E engineering grade of this evidence. */
  grade: EvidenceGrade;
  /** The finest way it may be drawn. */
  renderKind: HeatRenderKind;
  /** The authority's own words for how finely it describes the ground. */
  spatialPrecision: string;
}

interface Indexed {
  bundle: IntelligenceBundle;
  byGeography: Map<string, EvidenceRecord[]>;
}

/* Evidence for a species whose eligibility grants no hunting opportunity is not
   indexed, so no heat, opportunity or methodology answer can be built from it.
   The evidence stays committed; it is only never served as "where to look". */
const indexed: Indexed[] = ALL_BUNDLES.filter((bundle) => permitsHuntingOpportunity(bundle.speciesId)).map((bundle) => {
  assertSeasonalBasis(bundle);
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

function metricsOf(bundle: IntelligenceBundle): IntelligenceMetric[] {
  return [...new Set(bundle.evidence.map(({ metric }) => metric))].sort();
}

/** Every species × jurisdiction pair the committed evidence can answer for. */
export function servableDatasets(): readonly ServableDataset[] {
  return indexed.map(({ bundle, byGeography }) => {
    const metrics = metricsOf(bundle);
    const weights = appliedWeights(metrics);
    return {
      speciesId: bundle.speciesId,
      jurisdictionId: bundle.jurisdictionId,
      geographyCount: byGeography.size,
      evidenceRecordCount: bundle.evidence.length,
      latestObservationYear: bundle.latestObservationYear,
      coverage: bundle.coverage,
      methodologyVersion: bundle.methodologyVersion,
      sourceId: bundle.source.id,
      authority: bundle.source.authority,
      metrics: metrics.map((metric) => ({ metric, role: METRIC_ROLES[metric], contributes: weights.has(metric) })),
      independentValues: independentValueCount(metrics),
      grade: evidenceGrade(metrics),
      renderKind: renderKindFor(bundle.evidence.map(({ geographyType }) => geographyType)),
      /* The authority's own prose, read from a record rather than restated here. */
      spatialPrecision: bundle.evidence[0]?.spatialPrecision ?? "not stated",
    };
  });
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
  /** Travels with the shade, because the shade is where it can mislead. */
  seasonalBasis?: SeasonalBasis;
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
      ...(bundle.seasonalBasis ? { seasonalBasis: bundle.seasonalBasis } : {}),
      latestObservationYear: bundle.latestObservationYear,
      jurisdictionId: bundle.jurisdictionId,
    };
  }
  return null;
}

export interface ZoneOpportunity {
  geographyId: string;
  classification: OpportunityResult["classification"];
  /** The continuous value the ramp paints; null where the evidence will not rank. */
  intensity: OpportunityResult["intensity"];
  coverage: OpportunityResult["coverage"];
  /** How well-evidenced the shade is, carried beside it and never folded into it. */
  strength: OpportunityResult["strength"];
  /** The finest way this zone's evidence may be drawn. */
  renderKind: OpportunityResult["renderKind"];
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
      out.push({
        geographyId,
        classification: result.classification,
        intensity: result.intensity,
        coverage: result.coverage,
        strength: result.strength,
        renderKind: result.renderKind,
      });
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
  seasonalBasis?: SeasonalBasis;
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
    ...(bundle.seasonalBasis ? { seasonalBasis: bundle.seasonalBasis } : {}),
  }));
}

/**
 * One bundle's records for a species and jurisdiction, for the surface contract.
 *
 * It hands back the BUNDLE as well as the records because a surface has to
 * carry the season, the limitations and the source, and reassembling those from
 * a second lookup is how the two drift apart.
 */
export function surfaceEvidenceFor(speciesId: string, jurisdictionId: string): { bundle: IntelligenceBundle; records: EvidenceRecord[] } | null {
  for (const { bundle } of bySpecies.get(speciesId) ?? []) {
    if (bundle.jurisdictionId !== jurisdictionId) continue;
    return { bundle, records: bundle.evidence };
  }
  return null;
}

export interface HeatMethodology {
  speciesId: string;
  methodology: typeof OPPORTUNITY_METHODOLOGY;
  /** One entry per authority whose dataset contributes to this species' heat. */
  datasets: Array<{
    jurisdictionId: string;
    authority: string;
    title: string;
    url: string;
    licence: string;
    attribution?: string;
    /** The year of the observations actually drawn. */
    observationYear: number;
    /** The authority's own words for how finely it describes the ground. */
    spatialPrecision: string;
    renderKind: HeatRenderKind;
    renderKindMeaning: string;
    grade: EvidenceGrade;
    zoneCount: number;
    recordCount: number;
    independentValues: number;
    /** Every metric, its role, its applied weight and what it means. */
    measures: Array<{
      metric: IntelligenceMetric;
      role: string;
      meaning: string;
      contributes: boolean;
      /** Present only where it contributes; the renormalized weight actually used. */
      weight?: number;
    }>;
    limitations: string[];
    seasonalBasis?: SeasonalBasis;
  }>;
}

/**
 * Everything "How is this calculated?" needs, assembled from the same bundles
 * the map is painted from.
 *
 * Nothing here is written for the panel. If the panel and the map could be fed
 * from two places they would eventually disagree, and the panel is precisely
 * where a hunter goes to find out whether to believe the map.
 *
 * Null means no certified evidence for this species anywhere — which the caller
 * must state as a gap in gathering, not as a finding about the animals.
 */
export function heatMethodology(speciesId: string): HeatMethodology | null {
  const datasets = bySpecies.get(speciesId);
  if (!datasets?.length) return null;
  return {
    speciesId,
    methodology: OPPORTUNITY_METHODOLOGY,
    datasets: datasets.map(({ bundle, byGeography }) => {
      const metrics = metricsOf(bundle);
      const weights = appliedWeights(metrics);
      return {
        jurisdictionId: bundle.jurisdictionId,
        authority: bundle.source.authority,
        title: bundle.source.title,
        url: bundle.source.url,
        licence: bundle.source.licence,
        ...(bundle.source.attribution ? { attribution: bundle.source.attribution } : {}),
        observationYear: bundle.latestObservationYear,
        spatialPrecision: bundle.evidence[0]?.spatialPrecision ?? "not stated",
        renderKind: renderKindFor(bundle.evidence.map(({ geographyType }) => geographyType)),
        renderKindMeaning: RENDER_KIND_MEANINGS[renderKindFor(bundle.evidence.map(({ geographyType }) => geographyType))],
        grade: evidenceGrade(metrics),
        zoneCount: byGeography.size,
        recordCount: bundle.evidence.length,
        independentValues: independentValueCount(metrics),
        measures: metrics.map((metric) => ({
          metric,
          role: METRIC_ROLES[metric],
          meaning: METRIC_MEANINGS[metric],
          contributes: weights.has(metric),
          ...(weights.has(metric) ? { weight: Number(weights.get(metric)!.toFixed(4)) } : {}),
        })),
        limitations: bundle.limitations,
        ...(bundle.seasonalBasis ? { seasonalBasis: bundle.seasonalBasis } : {}),
      };
    }),
  };
}
