import { contentRepository, type ContentRepository } from "../content/repository.ts";
import { isMajorGameSpecies, speciesById } from "./coverage.ts";
import { regulatoryEntryFor, type RegulatoryOutcome } from "./regulatory/registry.ts";
import type { HuntEvaluation, HuntInput, RegulatoryResult } from "./types.ts";
import type { ZoneResolution } from "./types.ts";
import { getWeatherContext } from "./weather.ts";
import { jurisdictionOfZoneId, resolveZone as resolveZoneDefault } from "./zone.ts";

export interface HuntDependencies {
  repository?: ContentRepository;
  resolveZone?: typeof resolveZoneDefault;
  weather?: typeof getWeatherContext;
  /** Used for the authority's own overlay layers, where a jurisdiction has them. */
  fetch?: typeof fetch;
  now?: () => Date;
}

/**
 * Route to the rules of the jurisdiction the ZONE belongs to.
 *
 * The registry holds one entry per jurisdiction with certified rules. A zone
 * the registry places in a jurisdiction North Ground has no rules for is never
 * evaluated against another's: an Ontario "no row names this unit" would read
 * as a statement about Québec or Manitoba law.
 */
async function evaluateRegulation(
  input: HuntInput,
  zone: ZoneResolution,
  verifiedAt: string,
  fetcher?: typeof fetch,
): Promise<RegulatoryOutcome> {
  /* An unresolved zone carries no jurisdiction of its own. It is handed to the
     entry whose service was asked, which says it could not certify the zone —
     exactly as before the registry existed. */
  /* A zone's own id decides its jurisdiction. A zone carrying neither (callers
     that predate the field) keeps the behaviour it always had: Ontario. */
  const jurisdictionId = zone.jurisdictionId ?? jurisdictionOfZoneId(zone.zoneId) ?? "jurisdiction:ca-on";
  const entry = regulatoryEntryFor(jurisdictionId);
  if (!entry) return { completeness: "RESOLVED", dimensions: [], regulation: uncertifiedJurisdiction(zone, verifiedAt) };
  return await entry.evaluate(input, zone, { verifiedAt, fetcher });
}

/** A zone in a jurisdiction whose hunting rules North Ground has not certified. */
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

export async function evaluateHunt(input: HuntInput, dependencies: HuntDependencies = {}): Promise<HuntEvaluation> {
  const repository = dependencies.repository ?? contentRepository;
  const evaluatedAt = (dependencies.now?.() ?? new Date()).toISOString();
  const [zone, weather] = await Promise.all([
    (dependencies.resolveZone ?? resolveZoneDefault)(input.latitude, input.longitude),
    (dependencies.weather ?? getWeatherContext)(input.latitude, input.longitude, input.date, { now: dependencies.now?.() }),
  ]);

  const { completeness, required, dimensions, regulation } = await evaluateRegulation(input, zone, evaluatedAt, dependencies.fetch);

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
  const known = await repository.getSources(sourceIds);
  /* Sources a jurisdiction's bundle cites and the content registry does not
     hold are described from the bundle itself, which carries their version and
     hash. Ontario's entry supplies none, so its sources are exactly as before. */
  const missing = sourceIds.filter((id) => !known.some((source) => source.id === id));
  const fromBundle = missing.length ? regulatoryEntryFor(zone.jurisdictionId)?.sourceRecords?.(missing) ?? [] : [];
  const sources = [...known, ...fromBundle];
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
