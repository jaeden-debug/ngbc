import { legalTimeNotCertified } from "./regulatory/legal-time.ts";
import { general } from "./limitation.ts";
import { contentRepository, type ContentRepository } from "../content/repository.ts";
import { isMajorGameSpecies, speciesById } from "./coverage.ts";
import { resolveReadiness } from "./readiness/index.ts";
import { regulatoryEntryFor, type RegulatoryOutcome } from "./regulatory/registry.ts";
import type { OpportunityAvailability } from "./regulatory/opportunity-row.ts";
import { composeFederalWithProvincial, evaluateFederal, federalLegalTime, isFederalMigratoryBird } from "./regulatory/federal.ts";
import { FEDERAL_MIGRATORY_SERVING } from "./coverage.ts";
import type { CanonicalId } from "../content-contract/index.ts";
import type { HuntEvaluation, HuntInput, RegulatoryResult } from "./types.ts";
import type { ZoneResolution } from "./types.ts";
import { getWeatherContext } from "./weather.ts";
import { jurisdictionOfZoneId, resolveInLayer, resolveZone as resolveZoneDefault } from "./zone.ts";
import { countryOfJurisdiction, designationFromOfficialName, layerForJurisdiction, layerOfZoneId, speciesLayerFor } from "./zone-layers.ts";

export interface HuntDependencies {
  repository?: ContentRepository;
  resolveZone?: typeof resolveZoneDefault;
  /** Places a point in one particular layer, for species-scoped geographies. */
  resolveInLayer?: typeof resolveInLayer;
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
  speciesName?: string,
): Promise<RegulatoryOutcome> {
  /* A zone's own id decides its jurisdiction. An unresolved point carries one
     only where the resolver could attribute it to a single served layer; where
     extents overlap and no authority placed it, no jurisdiction's rules or
     wording apply, and none is borrowed. */
  const jurisdictionId = zone.jurisdictionId ?? jurisdictionOfZoneId(zone.zoneId);
  if (!jurisdictionId) return { completeness: "RESOLVED", dimensions: [], regulation: unplacedPoint(zone, verifiedAt) };
  const entry = regulatoryEntryFor(jurisdictionId);
  /*
   * A jurisdiction's engine is only asked about a species its own bundle
   * certifies. Handing it one it does not know is how a mallard gets answered
   * out of a grouse bundle: the engine falls through to its small-game path
   * and returns a season for the wrong animal, which reads as a normal answer.
   * Migratory game birds made this reachable — they are selectable nationally
   * while almost no province certifies them — but the hazard was always there.
   */
  const provincialCertifies = entry?.coverage().species.some((row) => row.speciesId === input.speciesId) ?? false;
  const provincial = entry && provincialCertifies
    ? await entry.evaluate(input, zone, { verifiedAt, fetcher, ...(speciesName ? { speciesName } : {}) })
    : {
        completeness: "RESOLVED" as const,
        dimensions: [],
        /* A jurisdiction North Ground DOES certify, for a species it does not,
           is not "outside the jurisdictions North Ground has certified" — that
           sentence is false about Iowa, whose pheasant is certified and whose
           ruffed grouse is not. Said only where the point was placed in the
           jurisdiction itself, so every zone answer reads exactly as before. */
        regulation: entry && zone.jurisdictionScope
          ? uncertifiedSpecies(entry.jurisdictionName, zone, verifiedAt, speciesName)
          : uncertifiedJurisdiction(zone, verifiedAt),
      };

  /*
   * A migratory game bird's season is Parliament's, not the province's, so the
   * federal answer composes on top of whatever the province said — including
   * when the province said nothing. Both bind; neither replaces the other, and
   * the composed answer names the half North Ground has not certified rather
   * than implying the federal season is the whole of the law.
   *
   * Gated by the same flag that offers these species at all, so a species can
   * never be selectable without this path answering for it.
   */
  if (FEDERAL_MIGRATORY_SERVING && isFederalMigratoryBird(input.speciesId)) {
    /* A designation exists only where a jurisdiction has a layer. A point
       placed in its jurisdiction by the boundary has a jurisdiction name, not
       a zone name, and passing it as one would invent a designation. */
    const layer = layerForJurisdiction(jurisdictionId);
    const federal = evaluateFederal(
      input.speciesId,
      jurisdictionId,
      { latitude: input.latitude, longitude: input.longitude },
      input.date,
      layer && !zone.jurisdictionScope ? designationFromOfficialName(layer, zone.officialName) : undefined,
    );
    return {
      ...provincial,
      regulation: composeFederalWithProvincial(
        federal,
        provincial.regulation,
        layerForJurisdiction(jurisdictionId)?.jurisdictionName ?? "This jurisdiction",
        federalLegalTime(jurisdictionId, { latitude: input.latitude, longitude: input.longitude }, input.date),
      ),
    };
  }

  return provincial;
}

/** A point no authority placed in a hunting zone, attributable to no one jurisdiction. */
function unplacedPoint(zone: ZoneResolution, verifiedAt: string): RegulatoryResult {
  return {
    next: { kind: "NOT_CERTIFIED" },
    status: "NEEDS_VERIFICATION",
    summary: "North Ground could not place this point in an official hunting zone, so it will not infer a hunting status.",
    legalTime: legalTimeNotCertified("Legal hunting hours are not available without a resolved zone.", "North Ground"),
    requirements: [],
    limitations: [general(zone.message)],
    sourceIds: zone.sourceId ? [zone.sourceId] : [],
    verifiedAt,
  };
}

/** A species North Ground has not certified, in a jurisdiction it certifies for other species. */
function uncertifiedSpecies(jurisdictionName: string, zone: ZoneResolution, verifiedAt: string, speciesName?: string): RegulatoryResult {
  return {
    next: { kind: "NOT_CERTIFIED" },
    status: "UNKNOWN",
    summary:
      `North Ground has not certified ${jurisdictionName}'s rules for ${speciesName ? speciesName.toLowerCase() : "this species"}. ` +
      "That is a gap in North Ground's coverage, not a statement that there is no season.",
    legalTime: legalTimeNotCertified("Legal hunting hours are not available for a species whose rules are not certified here.", "North Ground"),
    requirements: [],
    limitations: zone.jurisdictionScope ? [general(zone.jurisdictionScope.boundary.statedAs)] : [],
    sourceIds: zone.sourceId ? [zone.sourceId] : [],
    verifiedAt,
  };
}

/** A zone in a jurisdiction whose hunting rules North Ground has not certified. */
function uncertifiedJurisdiction(zone: ZoneResolution, verifiedAt: string): RegulatoryResult {
  return {
    next: { kind: "NOT_CERTIFIED" },
    status: "UNKNOWN",
    summary:
      `${zone.officialName ?? "This point"} is outside the jurisdictions whose hunting rules North Ground has certified. ` +
      "That is a gap in North Ground's coverage, not a statement that there is no season.",
    legalTime: legalTimeNotCertified("Legal hunting hours are not available for this jurisdiction.", "North Ground"),
    requirements: [],
    limitations: [],
    sourceIds: zone.sourceId ? [zone.sourceId] : [],
    verifiedAt,
  };
}

export async function evaluateHunt(input: HuntInput, dependencies: HuntDependencies = {}): Promise<HuntEvaluation> {
  const repository = dependencies.repository ?? contentRepository;
  const evaluatedAt = (dependencies.now?.() ?? new Date()).toISOString();
  const [resolved, weather] = await Promise.all([
    (dependencies.resolveZone ?? resolveZoneDefault)(input.latitude, input.longitude),
    (dependencies.weather ?? getWeatherContext)(input.latitude, input.longitude, input.date, { now: dependencies.now?.() }),
  ]);

  /* The zone states its jurisdiction explicitly, so everything downstream (the
     rules, the knowledge blocks, the shared brief) reads one field, not a guess. */
  const jurisdictionOfZone = resolved.jurisdictionId ?? jurisdictionOfZoneId(resolved.zoneId);
  const located: ZoneResolution = jurisdictionOfZone ? { ...resolved, jurisdictionId: jurisdictionOfZone } : resolved;

  /* A state can set different species' seasons in different geographies at
     the same place. Where the zone a point resolved to is not the geography
     this species is written in, the point is placed again in the one that is,
     by that layer's own authority. The jurisdiction stays the one the first
     answer established. */
  let zone = located;
  const locatedLayer = layerOfZoneId(located.zoneId) ?? layerForJurisdiction(located.jurisdictionId);
  if (located.jurisdictionId && locatedLayer?.speciesScope && !locatedLayer.speciesScope.includes(input.speciesId)) {
    const speciesLayer = speciesLayerFor(located.jurisdictionId, input.speciesId);
    if (speciesLayer && speciesLayer.id !== locatedLayer.id) {
      const placed = await (dependencies.resolveInLayer ?? resolveInLayer)(speciesLayer, input.latitude, input.longitude, dependencies.fetch);
      zone = { ...placed, jurisdictionId: located.jurisdictionId };
    }
  }

  const speciesResource = await repository.getSpecies(input.speciesId);
  const { completeness, required, dimensions, regulation, opportunities, opportunityGap } =
    await evaluateRegulation(input, zone, evaluatedAt, dependencies.fetch, speciesResource?.title);
  /*
   * THE ENGINE'S OWN ROWS, carried rather than discarded. This line used to
   * destructure four of the outcome's six fields, so §8's legal-harvest
   * opportunities died one statement before the result was built.
   *
   * Absence keeps its reason: a gap the engine reported is NOT_ENUMERATED, and
   * everything else is ENUMERATED — including the empty case, which genuinely
   * means none apply here.
   */
  const availability: OpportunityAvailability = opportunityGap
    ? { kind: "NOT_ENUMERATED", reason: opportunityGap }
    : { kind: "ENUMERATED", rows: opportunities ?? [] };

  const zoneIds = zone.zoneId ? [zone.zoneId] : undefined;
  const knowledge = await repository.getContextualBlocks({
    locale: "en-CA",
    // The country the zone is in, never assumed: a U.S. hunt gets no Canadian-only guidance.
    countryId: countryOfJurisdiction(zone.jurisdictionId) === "US" ? "country:us" : "country:ca",
    // Unplaced, only guidance that names no jurisdiction can apply.
    jurisdictionIds: zone.jurisdictionId ? [zone.jurisdictionId] : [],
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
  /* A zone with no authority cites none: a point outside every served layer
     has no source, and inventing one named Ontario everywhere for as long as
     Ontario was the only jurisdiction served. */
  /* What placed a point that has no zone is fetched so it can be shown — as
     what placed it, never among what decided it (`source-roles.ts`). */
  const sourceIds = [...new Set([
    ...regulation.sourceIds, zone.sourceId, zone.jurisdictionScope?.boundary.sourceId, weather.sourceId,
    ...knowledge.blocks.flatMap(({ block }) => block.sourceIds ?? []),
  ])]
    .filter((id) => Boolean(id)) as CanonicalId<"source">[];
  const known = await repository.getSources(sourceIds);
  /* Sources a jurisdiction's bundle cites and the content registry does not
     hold are described from the bundle itself, which carries their version and
     hash. Ontario's entry supplies none, so its sources are exactly as before. */
  const missing = sourceIds.filter((id) => !known.some((source) => source.id === id));
  const fromBundle = missing.length ? regulatoryEntryFor(zone.jurisdictionId)?.sourceRecords?.(missing) ?? [] : [];
  const sources = [...known, ...fromBundle];
  /* Ready to Hunt reads the same answers as the regulation, so it can never
     disagree with it. Where North Ground has no checklist for the jurisdiction,
     it points at the source this answer already cites rather than a guess. */
  const readiness = completeness === "RESOLVED"
    ? resolveReadiness(input, zone, regulation, {
        now: dependencies.now?.(),
        fallbackInfoUrl: sources.find((source) => regulation.sourceIds.includes(source.id) && source.url)?.url,
      })
    : undefined;
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
    opportunities: availability,
    weather,
    knowledge,
    sources,
    ...(readiness ? { readiness } : {}),
    evaluatedAt,
  };
}
