import { legalTimeNotCertified } from "./legal-time.ts";
import { contextual, general, type Limitation } from "../limitation.ts";
import { britishColumbiaCoverageReport, britishColumbiaSourceRecords, evaluateBritishColumbia } from "./british-columbia.ts";
import type { CanonicalId, SourceRecord } from "../../content-contract/index.ts";
import type { SpeciesCoverageRow } from "../canada/report.ts";
import { FEDERAL_MIGRATORY_SERVING, isMajorGameSpecies, speciesById, SUPPORTED_SPECIES } from "../coverage.ts";
import { overlaysInZone, type OverlayZoneIndex } from "../overlay-zones.ts";
import { lookupOverlays, restrictionsFor, type OverlayCatalogue } from "../overlays.ts";
import { provenancedLine, type ProvenancedText } from "../provenance.ts";
import { designationFromOfficialName, layerApplicability, layerForJurisdiction, layerOfZoneId } from "../zone-layers.ts";
import { presentZoneById } from "../zone-presentation.ts";
import type { EvaluationCompleteness, HuntInput, RegulatoryResult, ZoneResolution } from "../types.ts";
import type { ConditionalEvaluation, ConditionalInput, conditionalCoverage } from "./conditional-engine.ts";
import type { ResolvedOpportunity } from "./opportunity-row.ts";
import type { RequiredDimension } from "./dimensions.ts";
import { evaluateOntarioMajorGame, majorGameCoverageReport } from "./major-game.ts";
import {
  evaluateManitoba, manitobaCoverageReport, manitobaSourceRecords, MANITOBA_OVERLAYS, MANITOBA_OVERLAY_ZONES, restrictionTokensFor,
} from "./manitoba.ts";
import { evaluateNovaScotia, novaScotiaCoverageReport } from "./nova-scotia.ts";
import { evaluateNewfoundland, newfoundlandCoverageReport } from "./newfoundland.ts";
import { evaluateNewBrunswick, newBrunswickCoverageReport } from "./new-brunswick.ts";
import { evaluateSaskatchewan, saskatchewanCoverageReport } from "./saskatchewan.ts";
import { evaluateIowa, iowaCoverageReport, iowaSourceRecords } from "./iowa.ts";
import { jurisdictionScopeServing } from "../jurisdiction-scope-declarations.ts";
import { proximityStatement } from "../jurisdiction-scope.ts";
import { evaluateOntarioSmallGame, ontarioCoverageReport } from "./ontario.ts";
import {
  evaluateQuebec, QUEBEC_OVERLAY_DESCRIPTION, QUEBEC_OVERLAYS, quebecCoverageReport, quebecSourceRecords,
} from "./quebec.ts";
import { albertaCoverageReport, albertaSourceRecords, evaluateAlberta } from "./alberta.ts";
import { evaluateIdaho, idahoCoverageReport, idahoSourceRecords } from "./us-idaho.ts";
import { coloradoCoverageReport, coloradoSourceRecords, evaluateColorado } from "./us-colorado.ts";
import { evaluateMontana, montanaCoverageReport, montanaRestrictionTokensFor, montanaSourceRecords, MONTANA_OVERLAYS } from "./us-montana.ts";
import { evaluateWyoming, wyomingCoverageReport, wyomingSourceRecords } from "./us-wyoming.ts";

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
   * The distinct legal harvest opportunities behind this answer, where the
   * evaluator produces them.
   *
   * `regulation.season` is ONE season with no animal class and no implement —
   * the flattening a card cannot render "antlered with a bow in October" beside
   * "either sex with a rifle in November" from. These are the rows the engine
   * selected to reach that answer, carried rather than discarded, so a surface
   * never re-derives which rules apply to a place. Absent where an evaluator
   * does not emit them (Ontario has its own path), and absence is a gap in what
   * is carried, never a statement that no opportunity exists.
   */
  opportunities?: ResolvedOpportunity[];
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
  /** The species' name from the content library, for answers about species Canada's list does not name. */
  speciesName?: string;
}

export interface RegulatoryEntry {
  jurisdictionId: CanonicalId<"jurisdiction">;
  jurisdictionName: string;
  /** How a point reaches this entry's rules (see `ConditionalJurisdiction.resolvesBy`). */
  resolvesBy?: "ZONE_LAYER" | "JURISDICTION_BOUNDARY";
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
  /** Authorship remains explicit across the domain/API boundary. */
  words: ProvenancedText;
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
    next: { kind: "NOT_CERTIFIED" },
    status: "NEEDS_VERIFICATION",
    summary: `North Ground holds the applicable ${jurisdictionName} rules and needs one more fact before it can answer: ${required.question}`,
    legalTime: legalTimeNotCertified("Legal hunting hours are reported once the applicable rule is resolved.", "North Ground"),
    requirements: [],
    limitations: [general(required.reason)],
    sourceIds: [],
    verifiedAt,
  };
}

/* The engine always supplies a result when it resolves; this exists so a future
   engine change cannot silently produce an evaluation with no regulatory field. */
export function pendingRegulationFallback(verifiedAt: string): RegulatoryResult {
  return {
    next: { kind: "NOT_CERTIFIED" },
    status: "NEEDS_VERIFICATION",
    summary: "North Ground could not complete this regulatory evaluation and will not infer a status.",
    legalTime: legalTimeNotCertified("Legal hunting hours are not available.", "North Ground"),
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
    /*
     * THE WHOLE INPUT, NOT A RECONSTRUCTION. This line rebuilt an object from
     * two fields and discarded the coordinate, one line after the small game
     * path passed the same input through intact. Two sibling paths disagreeing
     * about their own contract, with nothing recorded about which was intended
     * — and legal hunting time needs the point that was being dropped.
     */
    const evaluation = evaluateOntarioMajorGame(input, zone, input.answers ?? {});
    if (evaluation.completeness === "NEEDS_INPUT" && evaluation.required) {
      return {
        completeness: "NEEDS_INPUT",
        required: evaluation.required,
        dimensions: evaluation.dimensions,
        /* The legal window does not depend on the pending answer, so it is not
           withheld pending it. */
        regulation: {
          ...pendingRegulation("Ontario", evaluation.required, verifiedAt),
          ...(evaluation.legalTime ? { legalTime: evaluation.legalTime } : {}),
        },
        /* Carried while the question is outstanding, exactly as `conditionalEntry`
           does: the engine asks BECAUSE the seasons differ, so the hunter who has
           answered nothing is the one who most needs to see what exists. */
        ...(evaluation.opportunities?.length ? { opportunities: evaluation.opportunities } : {}),
      };
    }
    return {
      completeness: "RESOLVED",
      dimensions: evaluation.dimensions,
      regulation: evaluation.result ?? pendingRegulationFallback(verifiedAt),
      ...(evaluation.opportunities?.length ? { opportunities: evaluation.opportunities } : {}),
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
  /** `officialUnits` is null where the jurisdiction publishes no units for these rules. */
  coverageReport(): { officialUnits: number | null; species: ReturnType<typeof conditionalCoverage> };
  /**
   * How a point reaches these rules. ZONE_LAYER (the default): through the
   * jurisdiction's served zone layer. JURISDICTION_BOUNDARY: every rule is
   * whole-jurisdiction and the point is placed by the jurisdiction boundary
   * (§41A, "Resolving inside a jurisdiction is not drawing its boundary").
   */
  resolvesBy?: "ZONE_LAYER" | "JURISDICTION_BOUNDARY";
  sourceRecords?(ids: readonly string[]): SourceRecord[];
  /** Published land restrictions the authority serves, where it does. */
  overlays?: {
    catalogue: OverlayCatalogue;
    /** `date` lets a token whose rule is seasonal reach only the days it can be in force. */
    tokensFor(speciesId: string, date?: string): readonly string[];
    describedAs: string;
    /** The layers as the authority serves them, for when they cannot be reached ("refuge, wildlife-management-area and closed-lands layers"). */
    layersDescribedAs: string;
    /** Which catalogued areas lie inside each zone, so a whole-zone answer can account for them. */
    zoneIndex?: OverlayZoneIndex;
    /** Every catalogued layer is published as closed to all hunting, so no zone season is stated inside one. */
    prohibitsAllHunting?: boolean;
  };
}

/**
 * How the engine's English prose names a zone: "Zone 10 West" rather than
 * "Zone de chasse 10O". Only words change; the zone id carries identity.
 */
function zoneProseName(zone: ZoneResolution): string {
  if (!zone.zoneId) return zone.officialName ?? "this zone";
  const presented = presentZoneById(zone.zoneId, "en-CA", zone.officialName);
  return presented.status === "PRESENTED" ? presented.fullLabel : zone.officialName ?? zone.zoneId;
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
/**
 * What placed a point that has no zone, said beside the answer it produced.
 *
 * §41A's limits on a jurisdiction-boundary answer are carried here, for every
 * jurisdiction alike: it is labelled as the cartographic boundary it is, its
 * proximity to the line is stated (CONTEXTUAL, so it fires only where the
 * bracket says near or unmeasured), and known differences between hunting
 * jurisdiction and drawn extent are said rather than smoothed. A zone
 * resolution is returned unchanged.
 */
function withPlacement(regulation: RegulatoryResult, zone: ZoneResolution): RegulatoryResult {
  const scope = zone.jurisdictionScope;
  if (!scope) return regulation;
  const placement: Limitation[] = [
    general(scope.boundary.statedAs),
    ...(scope.proximity === "CLEAR" ? [] : [contextual(proximityStatement(scope), "NEAR_BOUNDARY")]),
    ...scope.knownDifferences.map((text) => general(text)),
  ];
  /* The boundary's source is NOT added to `sourceIds`: those are what
     decided the answer, and a cartographic state line decided only where the
     point is. The evaluation lists it separately, as what placed the point. */
  return {
    ...regulation,
    limitations: [...placement, ...regulation.limitations],
  };
}

/**
 * What the engine is told about published overlays at the point: the areas a
 * lookup found, or `null` where none was read.
 *
 * NO LOOKUP IS "NOT AVAILABLE", NEVER "NONE HERE". An entry with no overlay
 * catalogue used to pass an empty set at a point, which the engine reads as a
 * layer consulted and found empty — so an exception stated as a published
 * overlay ("statewide except the state parks") was tested against nothing and
 * never fired. That failed open exactly where a point is placed only by the
 * jurisdiction boundary and the overlay is the one test left. `null` makes
 * such an exception an open world: a closer look, not the statewide answer.
 */
export function overlaysReadAtPoint(lookup: { specialIds: ReadonlySet<string> | null } | null): ReadonlySet<string> | null {
  return lookup ? lookup.specialIds : null;
}

function conditionalEntry(config: ConditionalJurisdiction): RegulatoryEntry {
  return {
    jurisdictionId: config.jurisdictionId,
    jurisdictionName: config.jurisdictionName,
    ...(config.resolvesBy ? { resolvesBy: config.resolvesBy } : {}),
    async evaluate(input, zone, context) {
      const { verifiedAt, fetcher, scope = "POINT" } = context;
      /* Land restrictions come from the authority's own layers. When they cannot
         be read, the answer says so rather than assuming there is nothing there.
         A whole-zone question has no point to ask about; the special areas a
         zone contains are then undecided worlds in the engine, not a lookup. */
      const overlays = config.overlays && scope === "POINT"
        ? await lookupOverlays(config.overlays.catalogue, input.latitude, input.longitude, fetcher)
        : null;
      const restrictions = overlays?.available ? restrictionsFor(overlays, config.overlays!.tokensFor(input.speciesId, input.date)) : [];
      /* The whole-zone counterpart: the indexed areas inside the zone that reach this species. */
      const designation = scope === "ZONE" ? designationOf(config.jurisdictionId, zone) : null;
      const zoneAreas = designation && config.overlays?.zoneIndex
        ? overlaysInZone(config.overlays.catalogue, config.overlays.zoneIndex, designation)
        : null;
      const zoneRestrictions = zoneAreas ? restrictionsFor(zoneAreas, config.overlays!.tokensFor(input.speciesId, input.date)) : [];
      const unreadOverlays = overlays && !overlays.available
        ? [`North Ground could not reach ${config.jurisdictionName}'s ${config.overlays!.layersDescribedAs} for this point, so it has not checked whether one of them restricts this hunt here.`]
        : [];

      /* A point placed in the jurisdiction rather than a zone reaches the
         engine with no zone id; only rules whose geography is the whole
         jurisdiction can match it there. */
      if (zone.status !== "RESOLVED" || (!zone.zoneId && !zone.jurisdictionScope)) {
        return {
          completeness: "RESOLVED",
          dimensions: [],
          regulation: {
            ...pendingRegulationFallback(verifiedAt),
            summary: `North Ground could not place this point in a certified ${config.unitTerm}, so it will not infer a hunting status.`,
            limitations: [
              general(zone.message),
              ...restrictions.map((restriction) => general(provenancedLine(restriction.name, restriction.words))),
              ...unreadOverlays.map((text) => general(text)),
            ],
            sourceIds: [...new Set([zone.sourceId, ...restrictions.map((restriction) => restriction.sourceId as CanonicalId<"source">)])].filter((id): id is CanonicalId<"source"> => Boolean(id)),
          },
        };
      }

      /* The geometry must be one the authority writes this species in, for a
         period that includes the date. Otherwise the zone is real but it is
         the wrong geography to answer from, and the answer says so. */
      const layer = layerOfZoneId(zone.zoneId);
      const applicability = layer ? layerApplicability(layer, input.speciesId, input.date) : { applies: true as const };
      if (!applicability.applies) {
        return {
          completeness: "RESOLVED",
          dimensions: [],
          regulation: {
            ...pendingRegulationFallback(verifiedAt),
            status: applicability.reason === "SPECIES_OUT_OF_SCOPE" ? "UNKNOWN" : "NEEDS_VERIFICATION",
            summary: applicability.message,
            limitations: layer?.legalStanding ? [general(layer.legalStanding.statedAs)] : [],
            sourceIds: zone.sourceId ? [zone.sourceId] : [],
          },
        };
      }

      const speciesName = speciesById(input.speciesId)?.displayName.toLowerCase() ??
        context.speciesName?.toLowerCase() ??
        input.speciesId.replace("species:", "").replace(/-/g, " ");
      const evaluation = config.evaluate({
        speciesId: input.speciesId,
        speciesName,
        date: input.date,
        answers: input.answers ?? {},
        place: {
          zoneId: zone.zoneId,
          /* Always the jurisdiction, so a whole-jurisdiction rule composes
             with unit rules at a zone point as well as answering alone at a
             point placed only in the jurisdiction. */
          jurisdictionId: config.jurisdictionId,
          // Prose names the zone as a reader would; identity stays in zoneId.
          zoneName: zoneProseName(zone),
          latitude: input.latitude,
          longitude: input.longitude,
          scope,
          overlays: overlaysReadAtPoint(overlays),
        },
        restrictions,
        restrictionsProhibitAllHunting: config.overlays?.prohibitsAllHunting === true,
      });

      if (evaluation.completeness === "NEEDS_INPUT" && evaluation.required) {
        return {
          completeness: "NEEDS_INPUT",
          required: evaluation.required,
          dimensions: evaluation.dimensions,
          regulation: withPlacement(pendingRegulation(config.jurisdictionName, evaluation.required, verifiedAt), zone),
          /* Carried while the question is outstanding, which is the case they
             matter most in: the engine asks BECAUSE the seasons differ, so the
             hunter who has answered nothing is the one who most needs to see
             what exists rather than being asked to name a method first. */
          ...(evaluation.opportunities ? { opportunities: evaluation.opportunities } : {}),
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
          next: { kind: "NOT_CERTIFIED" },
    status: "NEEDS_VERIFICATION",
          limitations: [
            general(
              `${names.length === 1 ? names[0] : `${names.length} published areas`} inside this ${config.unitTerm} ` +
                `restrict${names.length === 1 ? "s" : ""} this hunt, so the answer depends on where in it you hunt.`,
            ),
            ...zoneRestrictions.map((restriction) => general(provenancedLine(restriction.name, restriction.words))),
            ...regulation.limitations,
          ],
          sourceIds: [...new Set([...regulation.sourceIds, ...zoneRestrictions.map((restriction) => restriction.sourceId as CanonicalId<"source">)])],
        };
      }
      return {
        completeness: "RESOLVED",
        dimensions: evaluation.dimensions,
        regulation: withPlacement(unreadOverlays.length
          ? { ...regulation, limitations: [...unreadOverlays.map((text) => general(text)), ...regulation.limitations] }
          : regulation, zone),
        ...(exceptInside ? { exceptInside } : {}),
        ...(evaluation.opportunities ? { opportunities: evaluation.opportunities } : {}),
      };
    },
    coverage() {
      const report = config.coverageReport();
      return {
        officialUnits: report.officialUnits,
        species: report.species.map((entry) => ({
          speciesId: entry.speciesId,
          unitsCovered: entry.unitsReached,
          /*
           * Closed because the law says so, never because nothing was found —
           * and the law says so in TWO ways, which are summed here rather than
           * one of them being dropped. Silence in a closed-world instrument
           * closes an unnamed unit (Manitoba's M.R. 165/91 s. 3), and a rule can
           * close a named unit outright (Newfoundland's six caribou areas, which
           * NLR 43/26 s. 9(2) names no season for). Reporting only the first
           * showed Newfoundland as 19 caribou areas covered and none closed,
           * hiding six closures in a jurisdiction whose own guide already
           * under-reports them as three. They cannot double-count: a unit closed
           * by an explicit rule is a unit the rules reach.
           */
          unitsDeclaredClosed: entry.unitsClosedByAbsence + entry.unitsDeclaredClosedByRule,
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
          const key = `${restriction.name}|${restriction.words.text}`;
          areas.set(key, {
            name: restriction.name,
            layer: hit.layer,
            words: restriction.words,
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
    prohibitsAllHunting: true,
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

/* British Columbia's first wave, from B.C. Reg. 190/84. Its closures without a
   boundary North Ground holds are unresolved areas inside the bundle, so no
   overlay is read at run time. Counts only once its layer is served. */
const BRITISH_COLUMBIA = conditionalEntry({
  jurisdictionId: "jurisdiction:ca-bc",
  jurisdictionName: "British Columbia",
  unitTerm: "Management Unit",
  evaluate: evaluateBritishColumbia,
  coverageReport: britishColumbiaCoverageReport,
  sourceRecords: britishColumbiaSourceRecords,
});

/* Montana's upland game bird rules. Reached only once Montana's layers are
   served, which waits on these rules' certification. */
const MONTANA = conditionalEntry({
  jurisdictionId: "jurisdiction:us-mt",
  jurisdictionName: "Montana",
  unitTerm: "Upland Game Bird District",
  evaluate: evaluateMontana,
  coverageReport: montanaCoverageReport,
  sourceRecords: montanaSourceRecords,
  overlays: {
    catalogue: MONTANA_OVERLAYS,
    tokensFor: montanaRestrictionTokensFor,
    describedAs: "Indian reservations, national parks, refuges, wildlife management areas (Bad Rock Canyon WMA and the winter-range entry closure) and other restricted areas, and the Carbon County partridge portion",
    layersDescribedAs: "reservation, restricted-area, wildlife-management-area and partridge-portion layers",
  },
});

/* Idaho's pronghorn controlled hunts. Reached only once Idaho's unit layer is
   served, which waits on these rules' certification. */
const IDAHO = conditionalEntry({
  jurisdictionId: "jurisdiction:us-id",
  jurisdictionName: "Idaho",
  unitTerm: "Game Management Unit",
  evaluate: evaluateIdaho,
  coverageReport: idahoCoverageReport,
  sourceRecords: idahoSourceRecords,
});

/* Wyoming's elk seasons, from the Commission's Chapter 7 (2026). Reached only
   once Wyoming's elk hunt area layer is served, which waits on the Department's
   position on reuse of that service (layers.ts). Every season is answered per
   license, and parts of areas described only in words answer
   NEEDS_VERIFICATION with the regulation's own words; Areas 75 and 77 are
   federal-permit hunts and answer UNKNOWN. */
const WYOMING = conditionalEntry({
  jurisdictionId: "jurisdiction:us-wy",
  jurisdictionName: "Wyoming",
  unitTerm: "Elk Hunt Area",
  evaluate: evaluateWyoming,
  coverageReport: wyomingCoverageReport,
  sourceRecords: wyomingSourceRecords,
});

/* Colorado's small game and furbearers, from Chapter W-3. Reached only once
   Colorado's unit layer is served, which waits on a reuse grant for CPW's GMU
   service; the rules do not. Seasons written in highways (I-25, Colo 71, I-70)
   are placed in units by `scripts/derive-us-co-gmu-sides.mjs`, and a unit the
   line crosses stays an unresolved portion rather than a guess. */
const COLORADO = conditionalEntry({
  jurisdictionId: "jurisdiction:us-co",
  jurisdictionName: "Colorado",
  unitTerm: "Game Management Unit",
  evaluate: evaluateColorado,
  coverageReport: coloradoCoverageReport,
  sourceRecords: coloradoSourceRecords,
});

/* Nova Scotia's rules are certified for eight species from six codified
   instruments. Its deer zone layer is served for drawing and zone resolution, and
   every encoded season is province-wide in the regulation's own words, so the
   answer does not wait on any geography North Ground lacks.

   What it DOES wait on is named in the bundle's `deliberatelyNotEncoded`: the
   pheasant season is written by county and Nova Scotia publishes no county
   polygons, so it stays unresolved rather than being forced onto these zones. */
const NOVA_SCOTIA = conditionalEntry({
  jurisdictionId: "jurisdiction:ca-ns",
  jurisdictionName: "Nova Scotia",
  unitTerm: "Deer Management Zone",
  evaluate: evaluateNovaScotia,
  coverageReport: novaScotiaCoverageReport,
});

/* Newfoundland and Labrador's big game, from the orders rather than a regulation.
   The province's Wild Life Regulations carry no dates — they delegate to
   ministerial orders and declare in s. 89 that a species no order names has no
   open season — so this bundle is built from the annual Open Seasons Hunting and
   Trapping Order for the dates and three standing species orders for the areas.

   Three species-scoped layers are served and all three answer: 74 moose
   management areas, 19 caribou areas and 7 black bear areas. Every rule is
   Island-scoped or Labrador-scoped, because the province genuinely has two
   answers: Island moose closes 31 December and Labrador's runs to 14 March,
   and caribou is closed in Labrador by declaration.

   What it waits on is in the bundle's `deliberatelyNotEncoded`: small game,
   coyote and the fur bearers are written in geographies North Ground does not
   hold, moose management areas 100 and 101 are highway-buffer corridors the
   province publishes no geometry for, and the two national parks run their own
   moose hunts under a federal authority nothing here has certified. */
const NEWFOUNDLAND = conditionalEntry({
  jurisdictionId: "jurisdiction:ca-nl",
  jurisdictionName: "Newfoundland and Labrador",
  unitTerm: "management area",
  evaluate: evaluateNewfoundland,
  coverageReport: newfoundlandCoverageReport,
});

/* New Brunswick: standing ordinal rules, so no annual ingest. Its 27 Wildlife
   Management Zones are served, and eleven species answer from the Hunting
   Regulation, the Moose Hunting Regulation and the Hunter Orange Regulation.

   Deer is three answers by zone — no antlered season in 4, 5 and 9, five weeks
   antlered-only in 1, 2 and 3, eight weeks elsewhere — and the bow-and-crossbow
   opening weeks split it again by method.

   What it waits on is in the bundle's `deliberatelyNotEncoded`: the antlerless
   deer quota and the moose quota are ministerial determinations published
   nowhere in the regulation, the muzzle-loading week's zones depend on the
   first of them, and "squirrel", "cormorant" and groundhog are species the
   source or the catalogue does not resolve. */
const NEW_BRUNSWICK = conditionalEntry({
  jurisdictionId: "jurisdiction:ca-nb",
  jurisdictionName: "New Brunswick",
  unitTerm: "Wildlife Management Zone",
  evaluate: evaluateNewBrunswick,
  coverageReport: newBrunswickCoverageReport,
});

/* Saskatchewan: a standing ministerial regulation, so no annual ingest, and the
   only jurisdiction so far whose geometry is read LIVE at the time of each
   question — its data licence grants commercial reuse and the same item says "Not
   for resale", so North Ground stores no copy (owner decision, 2026-09-22).

   Thirteen species answer across the 83 Wildlife Management Zones. The licence
   class is the dimension here rather than a condition: Saskatchewan writes every
   season for a named class and the class changes the zones AND the dates, so the
   dimension draws its values from the place.

   What it waits on is in the bundle's `deliberatelyNotEncoded`: 34 season rows
   whose whole geography is provincial parks and recreation sites North Ground
   holds no boundary for, ptarmigan (the regulation's word is coarser than the
   catalogue's species), barren-ground caribou (its season provision is repealed
   and a separate subsistence regime exists), waterfowl (federal), fur animals
   (another instrument), and fees (no fee instrument was located for any of the 41
   licence classes). */
const SASKATCHEWAN = conditionalEntry({
  jurisdictionId: "jurisdiction:ca-sk",
  jurisdictionName: "Saskatchewan",
  unitTerm: "Wildlife Management Zone",
  evaluate: evaluateSaskatchewan,
  coverageReport: saskatchewanCoverageReport,
});

/* Iowa's statewide small game, from 571 IAC chapter 96. The first entry whose
   rules are all whole-jurisdiction: Iowa publishes no small-game units, so a
   point reaches these rules through the Census state boundary, never through
   a zone (§41A, "Resolving inside a jurisdiction is not drawing its
   boundary"). Ruffed grouse — the one season chapter 96 scopes to part of the
   state — is refused in the bundle's `deliberatelyNotEncoded`, not answered
   statewide. */
const IOWA = conditionalEntry({
  jurisdictionId: "jurisdiction:us-ia",
  jurisdictionName: "Iowa",
  unitTerm: "State of Iowa",
  evaluate: evaluateIowa,
  coverageReport: iowaCoverageReport,
  sourceRecords: iowaSourceRecords,
  resolvesBy: "JURISDICTION_BOUNDARY",
});

export const REGULATORY_REGISTRY: readonly RegulatoryEntry[] = [ONTARIO, MANITOBA, QUEBEC, ALBERTA, BRITISH_COLUMBIA, NOVA_SCOTIA, NEWFOUNDLAND, NEW_BRUNSWICK, SASKATCHEWAN, MONTANA, IDAHO, WYOMING, COLORADO, IOWA];

/**
 * The entry for a jurisdiction — only while its zone layer is served.
 *
 * Rules are useful to a person only where Hunt can place them in a zone, so an
 * entry needs a served layer. It needs more than that: the layer must also have
 * its rules certified in production (`rulesServing`). A jurisdiction whose
 * boundaries are drawn but whose rules are not certified answers UNKNOWN for
 * every species and points at the authority, which is what section 41A means by
 * a boundary not being a claim about rules. Both half-wired states — rules
 * without geometry, geometry without certified rules — are impossible here
 * rather than merely avoided.
 */
export function regulatoryEntryFor(jurisdictionId: string | undefined): RegulatoryEntry | undefined {
  const layer = layerForJurisdiction(jurisdictionId);
  if (!jurisdictionId) return undefined;
  if (layer?.serving === true && layer.rulesServing === true) {
    return REGULATORY_REGISTRY.find((entry) => entry.jurisdictionId === jurisdictionId);
  }
  /* The other road in: a jurisdiction with no served layer whose rules are
     all whole-jurisdiction, placed by its boundary and declared serving in
     `jurisdiction-scope-declarations.ts`. Geometry without rules and rules
     without a way to place a point stay impossible. */
  if (!layer && jurisdictionScopeServing(jurisdictionId)) {
    return REGULATORY_REGISTRY.find((entry) => entry.jurisdictionId === jurisdictionId && entry.resolvesBy === "JURISDICTION_BOUNDARY");
  }
  return undefined;
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
  certifiedSpecies ??= new Set([
    ...REGULATORY_REGISTRY
      .filter((entry) => regulatoryEntryFor(entry.jurisdictionId))
      .flatMap((entry) => entry.coverage().species.map((row) => row.speciesId)),
    /*
     * The migratory game birds. Federal rules answer for them nationally and
     * the federal jurisdiction has no zone layer of its own, so they cannot
     * arrive through the per-jurisdiction path above — they are certified by
     * the federal bundle, gated by the same one flag that offers them in the
     * selector, so the two can never disagree about what is answerable.
     */
    ...(FEDERAL_MIGRATORY_SERVING ? SUPPORTED_SPECIES.map((species) => species.id) : []),
  ]);
  return typeof value === "string" && certifiedSpecies.has(value);
}
