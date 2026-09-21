import type { CanonicalId, SourceRecord } from "../../content-contract/index.ts";
import type { SpeciesCoverageRow } from "../canada/report.ts";
import { isMajorGameSpecies, speciesById } from "../coverage.ts";
import { lookupOverlays, restrictionsFor, type OverlayCatalogue } from "../overlays.ts";
import { layerForJurisdiction } from "../zone-layers.ts";
import type { EvaluationCompleteness, HuntInput, RegulatoryResult, ZoneResolution } from "../types.ts";
import type { ConditionalEvaluation, ConditionalInput, conditionalCoverage } from "./conditional-engine.ts";
import type { RequiredDimension } from "./dimensions.ts";
import { evaluateOntarioMajorGame, majorGameCoverageReport } from "./major-game.ts";
import {
  evaluateManitoba, manitobaCoverageReport, manitobaSourceRecords, MANITOBA_OVERLAYS, restrictionTokensFor,
} from "./manitoba.ts";
import { evaluateOntarioSmallGame, ontarioCoverageReport } from "./ontario.ts";

/**
 * Which jurisdictions North Ground holds certified rules for, and how each is
 * evaluated.
 *
 * One list. What Hunt can evaluate, what the national coverage report counts,
 * and what the species library, profiles and selector say about a species are
 * all read from here, so they cannot disagree. A jurisdiction is added with one
 * entry, never with a branch in the code that calls it.
 *
 * An entry is routed to by the jurisdiction of the RESOLVED ZONE, never by the
 * box a point falls in: Ontario's extent reaches into Québec and Manitoba, and
 * answering a Manitoba zone with Ontario's rules would be answering it wrongly.
 */

export interface RegulatoryOutcome {
  completeness: EvaluationCompleteness;
  required?: RequiredDimension;
  dimensions: RequiredDimension[];
  regulation: RegulatoryResult;
}

export interface EvaluationContext {
  verifiedAt: string;
  fetcher?: typeof fetch;
}

export interface RegulatoryEntry {
  jurisdictionId: CanonicalId<"jurisdiction">;
  jurisdictionName: string;
  evaluate(input: HuntInput, zone: ZoneResolution, context: EvaluationContext): Promise<RegulatoryOutcome>;
  /** Computed from the certified bundles at call time; nothing typed by hand. */
  coverage(): { officialUnits: number | null; species: SpeciesCoverageRow[] };
  /** Records for sources the entry's bundles cite, where the content registry does not hold them. */
  sourceRecords?(ids: readonly string[]): SourceRecord[];
}

/**
 * While a question is outstanding there is no regulatory answer yet.
 *
 * The placeholder deliberately carries `NEEDS_VERIFICATION` rather than any
 * status a reader could act on. An outstanding question must never render as
 * CLOSED (the hunt is off) or as UNKNOWN (North Ground has no rules here) — both
 * are false, and one of them is dangerous.
 */
export function pendingRegulation(jurisdictionName: string, required: RequiredDimension, verifiedAt: string): RegulatoryResult {
  return {
    status: "NEEDS_VERIFICATION",
    summary: `North Ground holds the applicable ${jurisdictionName} rules and needs one more fact before it can answer: ${required.question}`,
    legalTime: {
      status: "NOT_AVAILABLE",
      text: "Legal hunting hours are reported once the applicable rule is resolved.",
    },
    requirements: [],
    limitations: [required.reason],
    sourceIds: [],
    verifiedAt,
  };
}

/* The engine always supplies a result when it resolves; this exists so a future
   engine change cannot silently produce an evaluation with no regulatory field. */
export function pendingRegulationFallback(verifiedAt: string): RegulatoryResult {
  return {
    status: "NEEDS_VERIFICATION",
    summary: "North Ground could not complete this regulatory evaluation and will not infer a status.",
    legalTime: { status: "NOT_AVAILABLE", text: "Legal hunting hours are not available." },
    requirements: [],
    limitations: [],
    sourceIds: [],
    verifiedAt,
  };
}

/* ── Ontario ───────────────────────────────────────────────────────────── */

/**
 * Ontario, on its own engines, exactly as before the registry existed.
 *
 * Small game is answerable from where, when and which species, so it asks
 * nothing. Major game is published as separate tables per residency, implement
 * or tag, so it asks, one fact at a time.
 */
const ONTARIO: RegulatoryEntry = {
  jurisdictionId: "jurisdiction:ca-on",
  jurisdictionName: "Ontario",
  async evaluate(input, zone, { verifiedAt }) {
    if (!isMajorGameSpecies(input.speciesId)) {
      return { completeness: "RESOLVED", dimensions: [], regulation: evaluateOntarioSmallGame(input, zone) };
    }
    const evaluation = evaluateOntarioMajorGame({ speciesId: input.speciesId, date: input.date }, zone, input.answers ?? {});
    if (evaluation.completeness === "NEEDS_INPUT" && evaluation.required) {
      return {
        completeness: "NEEDS_INPUT",
        required: evaluation.required,
        dimensions: evaluation.dimensions,
        regulation: pendingRegulation("Ontario", evaluation.required, verifiedAt),
      };
    }
    return {
      completeness: "RESOLVED",
      dimensions: evaluation.dimensions,
      regulation: evaluation.result ?? pendingRegulationFallback(verifiedAt),
    };
  },
  /**
   * Small game and major game report differently because the province
   * publishes them differently: small game names the units a season covers,
   * major game the units its season groupings reach. Both are normalised to
   * the same three-way split — covered, declared closed, unknown.
   */
  coverage() {
    const small = ontarioCoverageReport();
    const major = majorGameCoverageReport();
    const species: SpeciesCoverageRow[] = small.species.map((entry) => ({
      speciesId: entry.speciesId,
      unitsCovered: entry.certifiedUnits,
      unitsDeclaredClosed: entry.declaredNoSeasonUnits,
      unitsUnknown: entry.unknownUnits,
      rules: entry.rules,
      requiresInput: false,
    }));
    for (const entry of major.species) {
      species.push({
        speciesId: entry.speciesId,
        unitsCovered: entry.unitsReached,
        /* Major game counts rules that state "None" rather than units, because
           one such rule can close a whole grouping. Reported as its own figure
           rather than folded into the unit counts, which would overstate precision. */
        unitsDeclaredClosed: entry.rulesStatingNone,
        unitsUnknown: entry.unitsNotReached,
        rules: entry.rules,
        requiresInput: true,
      });
    }
    return { officialUnits: small.officialUnits, species: species.sort((a, b) => a.speciesId.localeCompare(b.speciesId)) };
  },
};

/* ── Jurisdictions on the conditional engine ───────────────────────────── */

interface ConditionalJurisdiction {
  jurisdictionId: CanonicalId<"jurisdiction">;
  jurisdictionName: string;
  /** The authority's term for its units ("Game Hunting Area", "Wildlife Management Unit"). */
  unitTerm: string;
  evaluate(input: ConditionalInput): ConditionalEvaluation;
  coverageReport(): { officialUnits: number; species: ReturnType<typeof conditionalCoverage> };
  sourceRecords?(ids: readonly string[]): SourceRecord[];
  /** Published land restrictions the authority serves, where it does. */
  overlays?: { catalogue: OverlayCatalogue; tokensFor(speciesId: string): readonly string[] };
}

/**
 * One registry entry for a jurisdiction whose rules run on the conditional
 * engine. Everything jurisdiction-specific is in the config; this is the same
 * for all of them.
 */
function conditionalEntry(config: ConditionalJurisdiction): RegulatoryEntry {
  return {
    jurisdictionId: config.jurisdictionId,
    jurisdictionName: config.jurisdictionName,
    async evaluate(input, zone, { verifiedAt, fetcher }) {
      /* Land restrictions come from the authority's own layers. When they cannot
         be read, the answer says so rather than assuming there is nothing there. */
      const overlays = config.overlays
        ? await lookupOverlays(config.overlays.catalogue, input.latitude, input.longitude, fetcher)
        : null;
      const restrictions = overlays?.available ? restrictionsFor(overlays, config.overlays!.tokensFor(input.speciesId)) : [];
      const unreadOverlays = overlays && !overlays.available
        ? [`North Ground could not reach ${config.jurisdictionName}'s refuge, wildlife-management-area and closed-lands layers for this point, so it has not checked whether one of them restricts this hunt here.`]
        : [];

      if (zone.status !== "RESOLVED" || !zone.zoneId) {
        return {
          completeness: "RESOLVED",
          dimensions: [],
          regulation: {
            ...pendingRegulationFallback(verifiedAt),
            summary: `North Ground could not place this point in a certified ${config.unitTerm}, so it will not infer a hunting status.`,
            limitations: [
              zone.message,
              ...restrictions.map((restriction) => `${restriction.name}: \u201c${restriction.statedAs}\u201d`),
              ...unreadOverlays,
            ],
            sourceIds: [...new Set([zone.sourceId, ...restrictions.map((restriction) => restriction.sourceId as CanonicalId<"source">)])],
          },
        };
      }

      const speciesName = speciesById(input.speciesId)?.displayName.toLowerCase() ?? input.speciesId.replace("species:", "").replace(/-/g, " ");
      const evaluation = config.evaluate({
        speciesId: input.speciesId,
        speciesName,
        date: input.date,
        answers: input.answers ?? {},
        place: {
          zoneId: zone.zoneId,
          zoneName: zone.officialName ?? zone.zoneId,
          latitude: input.latitude,
          longitude: input.longitude,
          overlays: overlays ? overlays.specialIds : new Set<string>(),
        },
        restrictions,
      });

      if (evaluation.completeness === "NEEDS_INPUT" && evaluation.required) {
        return {
          completeness: "NEEDS_INPUT",
          required: evaluation.required,
          dimensions: evaluation.dimensions,
          regulation: pendingRegulation(config.jurisdictionName, evaluation.required, verifiedAt),
        };
      }
      const regulation = evaluation.result ?? pendingRegulationFallback(verifiedAt);
      return {
        completeness: "RESOLVED",
        dimensions: evaluation.dimensions,
        regulation: unreadOverlays.length ? { ...regulation, limitations: [...unreadOverlays, ...regulation.limitations] } : regulation,
      };
    },
    coverage() {
      const report = config.coverageReport();
      return {
        officialUnits: report.officialUnits,
        species: report.species.map((entry) => ({
          speciesId: entry.speciesId,
          unitsCovered: entry.unitsReached,
          /* Closed because the law says so where the bundle records that (Manitoba
             s. 3), never because nothing was found. */
          unitsDeclaredClosed: entry.unitsClosedByAbsence,
          unitsUnknown: entry.unitsUnknown,
          rules: entry.rules,
          requiresInput: entry.requiresInput,
        })),
      };
    },
    ...(config.sourceRecords ? { sourceRecords: config.sourceRecords } : {}),
  };
}

const MANITOBA = conditionalEntry({
  jurisdictionId: "jurisdiction:ca-mb",
  jurisdictionName: "Manitoba",
  unitTerm: "Game Hunting Area",
  evaluate: evaluateManitoba,
  coverageReport: manitobaCoverageReport,
  sourceRecords: manitobaSourceRecords,
  overlays: { catalogue: MANITOBA_OVERLAYS, tokensFor: restrictionTokensFor },
});

export const REGULATORY_REGISTRY: readonly RegulatoryEntry[] = [ONTARIO, MANITOBA];

/**
 * The entry for a jurisdiction — only while its zone layer is served.
 *
 * Rules are useful to a person only where Hunt can place them in a zone. A
 * jurisdiction whose rules are certified but whose geometry is not yet served
 * would otherwise be claimed by the coverage report and the species surfaces as
 * "rules available" at places Hunt cannot answer. Tying the entry to a served
 * layer makes that half-wired state impossible rather than merely avoided.
 */
export function regulatoryEntryFor(jurisdictionId: string | undefined): RegulatoryEntry | undefined {
  if (!jurisdictionId || layerForJurisdiction(jurisdictionId)?.serving !== true) return undefined;
  return REGULATORY_REGISTRY.find((entry) => entry.jurisdictionId === jurisdictionId);
}
