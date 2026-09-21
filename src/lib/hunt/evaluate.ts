import { contentRepository, type ContentRepository } from "../content/repository.ts";
import { isMajorGameSpecies, speciesById } from "./coverage.ts";
import { evaluateOntarioMajorGame } from "./regulatory/major-game.ts";
import { evaluateOntarioSmallGame } from "./regulatory/ontario.ts";
import type { EvaluationCompleteness, HuntEvaluation, HuntInput, RegulatoryResult } from "./types.ts";
import type { RequiredDimension } from "./regulatory/dimensions.ts";
import type { ZoneResolution } from "./types.ts";
import { getWeatherContext } from "./weather.ts";
import { resolveOntarioWmu } from "./zone.ts";

export interface HuntDependencies {
  repository?: ContentRepository;
  resolveZone?: typeof resolveOntarioWmu;
  weather?: typeof getWeatherContext;
  now?: () => Date;
}

interface RegulatoryOutcome {
  completeness: EvaluationCompleteness;
  required?: RequiredDimension;
  dimensions: RequiredDimension[];
  regulation: RegulatoryResult;
}

/**
 * While a question is outstanding there is no regulatory answer yet.
 *
 * The placeholder deliberately carries `NEEDS_VERIFICATION` rather than any
 * status a reader could act on. An outstanding question must never render as
 * CLOSED (the hunt is off) or as UNKNOWN (North Ground has no rules here) — both
 * are false, and one of them is dangerous.
 */
function pendingRegulation(required: RequiredDimension, verifiedAt: string): RegulatoryResult {
  return {
    status: "NEEDS_VERIFICATION",
    summary: `North Ground holds the applicable Ontario rules and needs one more fact before it can answer: ${required.question}`,
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

/**
 * Route to the engine that matches how the province publishes this species.
 *
 * Small game is answerable from where, when and which species, so it asks
 * nothing and must keep asking nothing. Major game is published as separate
 * tables per residency, implement or tag, so a single answer would have to be
 * wrong for someone — it asks, one fact at a time.
 */
function evaluateRegulation(input: HuntInput, zone: ZoneResolution, verifiedAt: string): RegulatoryOutcome {
  /* Ontario's rules answer only for Ontario zones. A zone the registry places in
     another jurisdiction is never evaluated against them — an Ontario "no row
     names this unit" would read as a statement about Québec or Manitoba law. */
  if (zone.status === "RESOLVED" && zone.jurisdictionId && zone.jurisdictionId !== "jurisdiction:ca-on") {
    return { completeness: "RESOLVED", dimensions: [], regulation: uncertifiedJurisdiction(zone, verifiedAt) };
  }
  if (!isMajorGameSpecies(input.speciesId)) {
    return { completeness: "RESOLVED", dimensions: [], regulation: evaluateOntarioSmallGame(input, zone) };
  }

  const evaluation = evaluateOntarioMajorGame(
    { speciesId: input.speciesId, date: input.date },
    zone,
    input.answers ?? {},
  );

  if (evaluation.completeness === "NEEDS_INPUT" && evaluation.required) {
    return {
      completeness: "NEEDS_INPUT",
      required: evaluation.required,
      dimensions: evaluation.dimensions,
      regulation: pendingRegulation(evaluation.required, verifiedAt),
    };
  }

  return {
    completeness: "RESOLVED",
    dimensions: evaluation.dimensions,
    regulation: evaluation.result ?? pendingRegulationFallback(verifiedAt),
  };
}

/** A zone in a jurisdiction whose rules this path has not certified. */
function uncertifiedJurisdiction(zone: ZoneResolution, verifiedAt: string): RegulatoryResult {
  return {
    status: "UNKNOWN",
    summary:
      `${zone.officialName ?? "This zone"} is outside the jurisdictions whose hunting rules North Ground has certified. ` +
      "That is a gap in North Ground's coverage, not a statement that there is no season.",
    legalTime: { status: "NOT_AVAILABLE", text: "Legal hunting hours are not available for this jurisdiction." },
    requirements: [],
    limitations: [],
    sourceIds: [zone.sourceId],
    verifiedAt,
  };
}

/* The engine always supplies a result when it resolves; this exists so a future
   engine change cannot silently produce an evaluation with no regulatory field. */
function pendingRegulationFallback(verifiedAt: string): RegulatoryResult {
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

export async function evaluateHunt(input: HuntInput, dependencies: HuntDependencies = {}): Promise<HuntEvaluation> {
  const repository = dependencies.repository ?? contentRepository;
  const evaluatedAt = (dependencies.now?.() ?? new Date()).toISOString();
  const [zone, weather] = await Promise.all([
    (dependencies.resolveZone ?? resolveOntarioWmu)(input.latitude, input.longitude),
    (dependencies.weather ?? getWeatherContext)(input.latitude, input.longitude, input.date, { now: dependencies.now?.() }),
  ]);

  const { completeness, required, dimensions, regulation } = evaluateRegulation(input, zone, evaluatedAt);

  const zoneIds = zone.zoneId ? [zone.zoneId] : undefined;
  const speciesResource = await repository.getSpecies(input.speciesId);
  const knowledge = await repository.getContextualBlocks({
    locale: "en-CA",
    countryId: "country:ca",
    jurisdictionIds: [zone.jurisdictionId ?? "jurisdiction:ca-on"],
    zoneIds,
    speciesIds: [input.speciesId],
    date: input.date,
    activityId: "activity:hunting",
    /* Only asserted where it is true. Declaring every hunt upland would match a
       moose hunter against grouse guidance. */
    huntTypeId: isMajorGameSpecies(input.speciesId) ? undefined : "hunt_type:upland",
    temperatureC: weather.status === "AVAILABLE" ? weather.temperatureMaxC : undefined,
    blockTypes: ["habitat_tip", "identification_warning", "legal_note"],
    limit: 6,
  });
  const sourceIds = [...new Set([...regulation.sourceIds, zone.sourceId, weather.sourceId, ...knowledge.blocks.flatMap(({ block }) => block.sourceIds ?? [])])];
  const sources = await repository.getSources(sourceIds);
  return {
    input,
    species: {
      id: input.speciesId,
      // Identity comes from the canonical species library; the regulatory engine
      // supplies legality and never restates biology.
      name: speciesResource?.title ?? speciesById(input.speciesId)?.displayName ?? input.speciesId,
      canonicalPath: speciesResource?.canonicalUrl ?? speciesById(input.speciesId)?.resourcePath ?? "/hunt",
    },
    zone,
    completeness,
    required,
    dimensions,
    regulation,
    weather,
    knowledge,
    sources,
    evaluatedAt,
  };
}
