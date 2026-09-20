import { contentRepository, type ContentRepository } from "../content/repository.ts";
import { evaluateOntarioRuffedGrouse } from "./regulations.ts";
import type { HuntEvaluation, HuntInput } from "./types.ts";
import { getWeatherContext } from "./weather.ts";
import { resolveOntarioWmu } from "./zone.ts";

export interface HuntDependencies {
  repository?: ContentRepository;
  resolveZone?: typeof resolveOntarioWmu;
  weather?: typeof getWeatherContext;
  now?: () => Date;
}

export async function evaluateHunt(input: HuntInput, dependencies: HuntDependencies = {}): Promise<HuntEvaluation> {
  const repository = dependencies.repository ?? contentRepository;
  const [zone, weather] = await Promise.all([
    (dependencies.resolveZone ?? resolveOntarioWmu)(input.latitude, input.longitude),
    (dependencies.weather ?? getWeatherContext)(input.latitude, input.longitude, input.date, { now: dependencies.now?.() }),
  ]);
  const regulation = evaluateOntarioRuffedGrouse(input, zone);
  const zoneIds = zone.zoneId ? [zone.zoneId] : undefined;
  const knowledge = await repository.getContextualBlocks({
    locale: "en-CA",
    countryId: "country:ca",
    jurisdictionIds: ["jurisdiction:ca-on"],
    zoneIds,
    speciesIds: [input.speciesId],
    date: input.date,
    activityId: "activity:hunting",
    huntTypeId: "hunt_type:upland",
    temperatureC: weather.status === "AVAILABLE" ? weather.temperatureMaxC : undefined,
    blockTypes: ["habitat_tip", "identification_warning", "legal_note"],
    limit: 6,
  });
  const sourceIds = [...new Set([...regulation.sourceIds, zone.sourceId, weather.sourceId, ...knowledge.blocks.flatMap(({ block }) => block.sourceIds ?? [])])];
  const sources = await repository.getSources(sourceIds);
  return {
    input,
    species: { id: "species:ruffed-grouse", name: "Ruffed grouse", canonicalPath: "/hunting/species/ruffed-grouse" },
    zone,
    regulation,
    weather,
    knowledge,
    sources,
    evaluatedAt: (dependencies.now?.() ?? new Date()).toISOString(),
  };
}
