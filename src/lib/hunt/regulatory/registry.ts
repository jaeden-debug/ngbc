import type { CanonicalId, SourceRecord } from "../../content-contract/index.ts";
import type { SpeciesCoverageRow } from "../canada/report.ts";
import { isMajorGameSpecies, speciesById } from "../coverage.ts";
import { overlaysInZone, type OverlayZoneIndex } from "../overlay-zones.ts";
import { lookupOverlays, restrictionsFor, type OverlayCatalogue } from "../overlays.ts";
import { designationFromOfficialName, layerForJurisdiction } from "../zone-layers.ts";
import type { EvaluationCompleteness, HuntInput, RegulatoryResult, ZoneResolution } from "../types.ts";
import type { ConditionalEvaluation, ConditionalInput, conditionalCoverage } from "./conditional-engine.ts";
import type { RequiredDimension } from "./dimensions.ts";
import { evaluateOntarioMajorGame, majorGameCoverageReport } from "./major-game.ts";
import {
  evaluateManitoba, manitobaCoverageReport, manitobaSourceRecords, MANITOBA_OVERLAYS, MANITOBA_OVERLAY_ZONES, restrictionTokensFor,
} from "./manitoba.ts";
import { evaluateOntarioSmallGame, ontarioCoverageReport } from "./ontario.ts";
import {
  evaluateQuebec, QUEBEC_OVERLAY_DESCRIPTION, QUEBEC_OVERLAYS, quebecCoverageReport, quebecSourceRecords,
} from "./quebec.ts";
import { albertaCoverageReport, albertaSourceRecords, evaluateAlberta } from "./alberta.ts";

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
  /**
   * Whole-zone answers only: the season runs across the zone EXCEPT inside
   * these published areas, which restrict this species. Present only when that
   * is the one reason the zone has no single answer.
   */
  exceptInside?: string[];
}

export interface EvaluationContext {
  verifiedAt: string;
  fetcher?: typeof fetch;
  /**
   * ZONE asks about the whole zone rather than a point in it: nothing
   * point-specific is looked up, and anything that varies inside the zone is
   * left undecided rather than answered for one spot (see `PlaceContext.scope`).
   */
  scope?: "POINT" | "ZONE";
}

export interface RegulatoryEntry {
  jurisdictionId: CanonicalId<"jurisdiction">;
  jurisdictionName: string;
  evaluate(input: HuntInput, zone: ZoneResolution, context: EvaluationContext): Promise<RegulatoryOutcome>;
  /** Computed from the certified bundles at call time; nothing typed by hand. */
  coverage(): { officialUnits: number | null; species: SpeciesCoverageRow[] };
  /** Records for sources the entry's bundles cite, where the content registry does not hold them. */
  sourceRecords?(ids: readonly string[]): SourceRecord[];
  /**
   * Published restrictions this jurisdiction checks only at an exact point
   * ("refuges, wildlife management areas and lands closed to hunting"). A
   * whole-zone summary cannot see them, and says so in these words.
   */
  pointOnlyChecks?: string;
  /**
   * The published special areas inside a zone that restrict at least one
   * certified species, with the species they reach. Null when the zone has not
   * been indexed ("not checked"); an empty list means none reaches a species.
   */
  specialAreasInZone?(designation: string): SpecialAreaInZone[] | null;
}

export interface SpecialAreaInZone {
  name: string;
  /** The authority's layer the area comes from ("closed", "refuges"). */
  layer: string;
  statedAs: string;
  sourceId: string;
  speciesIds: string[];
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
  overlays?: {
    catalogue: OverlayCatalogue;
    tokensFor(speciesId: string): readonly string[];
    describedAs: string;
    /** The layers as the authority serves them, for when they cannot be reached ("refuge, wildlife-management-area and closed-lands layers"). */
    layersDescribedAs: string;
    /** Which catalogued areas lie inside each zone, so a whole-zone answer can account for them. */
    zoneIndex?: OverlayZoneIndex;
  };
}

/** The zone's bare designation, from the name the resolver gave it. */
function designationOf(jurisdictionId: string, zone: ZoneResolution): string | null {
  const layer = layerForJurisdiction(jurisdictionId);
  return layer && zone.officialName ? designationFromOfficialName(layer, zone.officialName) : null;
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
    async evaluate(input, zone, { verifiedAt, fetcher, scope = "POINT" }) {
      /* Land restrictions come from the authority's own layers. When they cannot
         be read, the answer says so rather than assuming there is nothing there.
         A whole-zone question has no point to ask about; the special areas a
         zone contains are then undecided worlds in the engine, not a lookup. */
      const overlays = config.overlays && scope === "POINT"
        ? await lookupOverlays(config.overlays.catalogue, input.latitude, input.longitude, fetcher)
        : null;
      const restrictions = overlays?.available ? restrictionsFor(overlays, config.overlays!.tokensFor(input.speciesId)) : [];
      /* The whole-zone counterpart: the indexed areas inside the zone that reach this species. */
      const designation = scope === "ZONE" ? designationOf(config.jurisdictionId, zone) : null;
      const zoneAreas = designation && config.overlays?.zoneIndex
        ? overlaysInZone(config.overlays.catalogue, config.overlays.zoneIndex, designation)
        : null;
      const zoneRestrictions = zoneAreas ? restrictionsFor(zoneAreas, config.overlays!.tokensFor(input.speciesId)) : [];
      const unreadOverlays = overlays && !overlays.available
        ? [`North Ground could not reach ${config.jurisdictionName}'s ${config.overlays!.layersDescribedAs} for this point, so it has not checked whether one of them restricts this hunt here.`]
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
          scope,
          /* No lookup is "not available" (null), never "none here". */
          overlays: overlays ? overlays.specialIds : scope === "ZONE" ? null : new Set<string>(),
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
      let regulation = evaluation.result ?? pendingRegulationFallback(verifiedAt);
      let exceptInside: string[] | undefined;
      /* A season that runs across the zone does not run inside a refuge or on
         closed land within it. Where such an area reaches this species, the
         zone as a whole has no single answer. */
      if (zoneRestrictions.length && regulation.status === "CONDITIONAL") {
        const names = [...new Set(zoneRestrictions.map((restriction) => restriction.name))];
        exceptInside = names;
        regulation = {
          ...regulation,
          status: "NEEDS_VERIFICATION",
          limitations: [
            `${names.length === 1 ? names[0] : `${names.length} published areas`} inside this ${config.unitTerm} ` +
              `restrict${names.length === 1 ? "s" : ""} this hunt, so the answer depends on where in it you hunt.`,
            ...zoneRestrictions.map((restriction) => `${restriction.name}: \u201c${restriction.statedAs}\u201d`),
            ...regulation.limitations,
          ],
          sourceIds: [...new Set([...regulation.sourceIds, ...zoneRestrictions.map((restriction) => restriction.sourceId as CanonicalId<"source">)])],
        };
      }
      return {
        completeness: "RESOLVED",
        dimensions: evaluation.dimensions,
        regulation: unreadOverlays.length ? { ...regulation, limitations: [...unreadOverlays, ...regulation.limitations] } : regulation,
        ...(exceptInside ? { exceptInside } : {}),
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
    /* Only an unindexed layer is left to the reader as a point-only check. */
    ...(config.overlays && !config.overlays.zoneIndex ? { pointOnlyChecks: config.overlays.describedAs } : {}),
    ...(config.overlays?.zoneIndex ? {
      specialAreasInZone(designation: string) {
        const overlays = config.overlays!;
        const lookup = overlaysInZone(overlays.catalogue, overlays.zoneIndex!, designation);
        if (!lookup) return null;
        const speciesIds = config.coverageReport().species.map((entry) => entry.speciesId);
        const areas = new Map<string, SpecialAreaInZone>();
        for (const hit of lookup.hits) {
          const single = { ...lookup, hits: [hit] };
          const reached = speciesIds.filter((speciesId) => restrictionsFor(single, overlays.tokensFor(speciesId)).length > 0);
          if (!reached.length) continue;
          const [restriction] = restrictionsFor(single, overlays.tokensFor(reached[0]));
          if (!restriction) continue;
          // One area published as several pieces is listed once.
          const key = `${restriction.name}|${restriction.statedAs}`;
          areas.set(key, {
            name: restriction.name,
            layer: hit.layer,
            statedAs: restriction.statedAs,
            sourceId: restriction.sourceId,
            speciesIds: [...new Set([...(areas.get(key)?.speciesIds ?? []), ...reached])].sort(),
          });
        }
        return [...areas.values()].sort((a, b) => a.name.localeCompare(b.name));
      },
    } : {}),
  };
}

const MANITOBA = conditionalEntry({
  jurisdictionId: "jurisdiction:ca-mb",
  jurisdictionName: "Manitoba",
  unitTerm: "Game Hunting Area",
  evaluate: evaluateManitoba,
  coverageReport: manitobaCoverageReport,
  sourceRecords: manitobaSourceRecords,
  overlays: {
    catalogue: MANITOBA_OVERLAYS,
    tokensFor: restrictionTokensFor,
    describedAs: "wildlife refuges, special conservation areas, wildlife management areas and lands closed to hunting",
    layersDescribedAs: "refuge, wildlife-management-area and closed-lands layers",
    zoneIndex: MANITOBA_OVERLAY_ZONES,
  },
});

/* Québec's rules are certified; the entry is only reached once its zone layer
   is served, which waits on parity with the ministry's own service.

   Its closed territories lie inside hunting zones, so a zone's season says
   nothing about them: every species is checked against all of them at the
   point. No zone index is built yet, so a whole-zone card says these are
   checked only at an exact point rather than implying there are none. */
const QUEBEC = conditionalEntry({
  jurisdictionId: "jurisdiction:ca-qc",
  jurisdictionName: "Québec",
  unitTerm: "zone de chasse",
  evaluate: evaluateQuebec,
  coverageReport: quebecCoverageReport,
  sourceRecords: quebecSourceRecords,
  overlays: {
    catalogue: QUEBEC_OVERLAYS,
    // « toute activité de chasse est interdite »: every feature reaches every species.
    tokensFor: () => ["all"],
    describedAs: QUEBEC_OVERLAY_DESCRIPTION,
    layersDescribedAs: "layer of territories closed to all hunting",
  },
});

const ALBERTA = conditionalEntry({
  jurisdictionId: "jurisdiction:ca-ab",
  jurisdictionName: "Alberta",
  unitTerm: "Wildlife Management Unit",
  evaluate: evaluateAlberta,
  coverageReport: albertaCoverageReport,
  sourceRecords: albertaSourceRecords,
});

export const REGULATORY_REGISTRY: readonly RegulatoryEntry[] = [ONTARIO, MANITOBA, QUEBEC, ALBERTA];

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

let certifiedSpecies: ReadonlySet<string> | undefined;

/**
 * Whether some served jurisdiction holds certified rules for this species.
 *
 * Derived from the registry, never listed. The browser's selector already reads
 * coverage per jurisdiction from the same entries; an evaluation request is
 * validated against the same thing, so a species Québec certifies is accepted
 * the moment Québec is served, and a species no served jurisdiction certifies is
 * refused. The set is fixed for the life of the process (bundles and serving
 * flags are build-time facts), so it is computed once.
 */
export function isCertifiedSpecies(value: unknown): value is CanonicalId<"species"> {
  certifiedSpecies ??= new Set(REGULATORY_REGISTRY
    .filter((entry) => regulatoryEntryFor(entry.jurisdictionId))
    .flatMap((entry) => entry.coverage().species.map((row) => row.speciesId)));
  return typeof value === "string" && certifiedSpecies.has(value);
}
