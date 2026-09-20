import bundleJson from "../../../content/published/en-CA.json" with { type: "json" };
import speciesWaveJson from "../../../content/published/species-wave-1.json" with { type: "json" };
import speciesWave2aJson from "../../../content/published/species-wave-2a.json" with { type: "json" };
import speciesWave2bJson from "../../../content/published/species-wave-2b.json" with { type: "json" };
import speciesWave2cJson from "../../../content/published/species-wave-2c.json" with { type: "json" };
import speciesWave2dJson from "../../../content/published/species-wave-2d.json" with { type: "json" };
import {
  CONTENT_CONTRACT_VERSION,
  type Applicability,
  type BlockResult,
  type ContentBlock,
  type ContentBundle,
  type ContextRequest,
  type Entity,
  type Resource,
  type EntityAlias,
  type AnimalCharacteristicIntent,
  type MediaRecord,
  type SpeciesSexAgeInfo,
  type SpeciesResource,
  type SourceRecord,
} from "../content-contract/types.ts";
import type { CanonicalId } from "../content-contract/ids.ts";
import { canonicalPath, type CanonicalUrlResult } from "./urls.ts";

export interface EntityLookup {
  value: string;
  locale?: string;
}

export type EntityResolution =
  | { status: "resolved"; entity: Entity; matchedBy: "id" | "slug" | "name" | "alias" }
  | { status: "ambiguous"; candidates: Entity[] }
  | { status: "not_found"; candidates: [] };

export interface LocaleOptions {
  locale?: string;
}

export interface BlockQuery extends LocaleOptions {
  activityId?: CanonicalId<"activity">;
  blockTypes?: ContextRequest["blockTypes"];
  limit?: number;
}

export interface RelationshipQuery extends LocaleOptions {
  limit?: number;
}

export interface ResourceSummary {
  id: CanonicalId;
  type: Resource["type"];
  title: string;
  description: string;
  canonicalUrl: string | null;
}

export interface SpeciesSearchResult {
  id: CanonicalId<"species">;
  commonName: string;
  scientificName: string;
  aliases: string[];
  searchTerms: string[];
  category: string;
  canonicalUrl: string;
  intent?: AnimalCharacteristicIntent;
  matchedTerm?: string;
}

export type SpeciesQueryInterpretation =
  | { status: "resolved"; species: SpeciesSearchResult; intent?: AnimalCharacteristicIntent }
  | { status: "choices"; species: SpeciesSearchResult[]; categoryMatch: boolean }
  | { status: "not_found"; species: [] };

export interface ContentRepository {
  resolveEntity(input: EntityLookup): Promise<EntityResolution>;
  getEntity(id: CanonicalId, options?: LocaleOptions): Promise<Entity | null>;
  getResource(id: CanonicalId, options?: LocaleOptions): Promise<Resource | null>;
  getResourceBySlug(slug: string, options?: LocaleOptions): Promise<Resource | null>;
  getBlocksForResource(id: CanonicalId, options?: BlockQuery): Promise<BlockResult>;
  getContextualBlocks(request: ContextRequest): Promise<BlockResult>;
  getRelatedResources(id: CanonicalId, options?: RelationshipQuery): Promise<ResourceSummary[]>;
  getCanonicalUrl(id: CanonicalId, locale: string): Promise<CanonicalUrlResult | null>;
  getSources(ids: CanonicalId<"source">[]): Promise<SourceRecord[]>;
  getPublishedResources(options?: LocaleOptions): Promise<Resource[]>;
  getSpecies(id: CanonicalId<"species">): Promise<SpeciesResource | null>;
  searchSpecies(query: string, options?: LocaleOptions): Promise<SpeciesSearchResult[]>;
  getSpeciesAliases(id: CanonicalId<"species">): Promise<EntityAlias[]>;
  getSpeciesImage(id: CanonicalId<"species">): Promise<MediaRecord | null>;
  getSpeciesImages(id: CanonicalId<"species">): Promise<MediaRecord[]>;
  getSpeciesGroups(id: CanonicalId<"species">): Promise<Entity<"species_group">[]>;
  getSpeciesSexAgeInfo(id: CanonicalId<"species">): Promise<SpeciesSexAgeInfo | null>;
  getSpeciesIdentificationWarnings(id: CanonicalId<"species">): Promise<ContentBlock[]>;
  interpretSpeciesQuery(query: string, options?: LocaleOptions): Promise<SpeciesQueryInterpretation>;
  getSpeciesBlocks(id: CanonicalId<"species">, request: Omit<ContextRequest, "speciesIds" | "ownerIds">): Promise<BlockResult>;
  getRelatedSpecies(id: CanonicalId<"species">): Promise<SpeciesResource[]>;
  getSpeciesSources(id: CanonicalId<"species">): Promise<SourceRecord[]>;
}

const primaryBundle = bundleJson as ContentBundle;
const contentBundles = [
  primaryBundle,
  speciesWaveJson as ContentBundle,
  speciesWave2aJson as ContentBundle,
  speciesWave2bJson as ContentBundle,
  speciesWave2cJson as ContentBundle,
  speciesWave2dJson as ContentBundle,
];
const bundle: ContentBundle = {
  contractVersion: CONTENT_CONTRACT_VERSION,
  generatedAt: contentBundles.at(-1)?.generatedAt ?? primaryBundle.generatedAt,
  entities: contentBundles.flatMap(({ entities: records }) => records),
  resources: contentBundles.flatMap(({ resources: records }) => records),
  blocks: contentBundles.flatMap(({ blocks: records }) => records),
  relationships: contentBundles.flatMap(({ relationships: records }) => records),
  sources: contentBundles.flatMap(({ sources: records }) => records),
  claims: contentBundles.flatMap(({ claims: records }) => records),
  media: contentBundles.flatMap(({ media: records }) => records),
};
const entities = new Map(bundle.entities.map((entity) => [entity.id, entity]));
const resources = new Map(bundle.resources.map((resource) => [resource.id, resource]));
const sources = new Map(bundle.sources.map((source) => [source.id, source]));

function normalized(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLocaleLowerCase("en-CA");
}

function speciesTerms(resource: SpeciesResource, entity: Entity | undefined): Array<{
  value: string;
  intent?: AnimalCharacteristicIntent;
}> {
  const groupTerms = resource.speciesProfile.speciesGroupIds.flatMap((groupId) => {
    const group = entities.get(groupId);
    const discoveryTerms = groupId === "species_group:geese" ? ["goose"]
      : groupId === "species_group:ducks" ? ["duck"]
        : groupId === "species_group:hares-rabbits" ? ["rabbit", "hare"]
          : groupId === "species_group:grouse" ? ["upland bird"]
            : [];
    return [
      ...(group?.names.map(({ value }) => ({ value })) ?? []),
      ...(group?.aliases?.map(({ value }) => ({ value })) ?? []),
      ...discoveryTerms.map((value) => ({ value })),
    ];
  });
  return [
    { value: resource.title },
    { value: resource.speciesProfile.scientificName },
    ...(entity?.names.map(({ value }) => ({ value })) ?? []),
    ...(entity?.aliases?.map(({ value }) => ({ value })) ?? []),
    ...(resource.speciesProfile.aliases?.map(({ value }) => ({ value })) ?? []),
    ...(resource.speciesProfile.sexAgeInfo?.terminology.map(({ value, intent }) => ({ value, intent })) ?? []),
    ...groupTerms,
  ];
}

function intersects<T>(left: T[] | undefined, right: T[] | undefined): boolean {
  if (!left?.length) return true;
  if (!right?.length) return false;
  return left.some((value) => right.includes(value));
}

function inRange(value: number | undefined, range: Applicability["temperatureC"]): boolean {
  if (!range) return true;
  if (value === undefined) return false;
  if (range.min !== undefined && (value < range.min || (value === range.min && range.minInclusive === false))) return false;
  if (range.max !== undefined && (value > range.max || (value === range.max && range.maxInclusive === false))) return false;
  return true;
}

function dateApplies(date: string | undefined, start?: string, end?: string): boolean {
  if ((start || end) && !date) return false;
  if (!date) return true;
  return (!start || date >= start) && (!end || date <= end);
}

function applicabilityMatches(app: Applicability, request: ContextRequest): boolean {
  return (
    intersects(app.countryIds, request.countryId ? [request.countryId] : undefined) &&
    intersects(app.jurisdictionIds, request.jurisdictionIds) &&
    intersects(app.zoneIds, request.zoneIds) &&
    intersects(app.speciesIds, request.speciesIds) &&
    intersects(app.activityIds, [request.activityId]) &&
    intersects(app.huntTypeIds, request.huntTypeId ? [request.huntTypeId] : undefined) &&
    intersects(app.methodIds, request.methodIds) &&
    intersects(app.conditionIds, undefined) &&
    inRange(request.temperatureC, app.temperatureC) &&
    (!app.activityLevels?.length || (request.activityLevel !== undefined && app.activityLevels.includes(request.activityLevel))) &&
    inRange(request.durationMinutes, app.durationMinutes) &&
    (!app.terrainTags?.length || intersects(app.terrainTags, request.terrainTags)) &&
    dateApplies(request.date, app.validFrom, app.validThrough)
  );
}

function exclusionMatches(exclusions: Applicability | undefined, request: ContextRequest): boolean {
  if (!exclusions) return false;
  const dimensions = [
    exclusions.countryIds?.length ? intersects(exclusions.countryIds, request.countryId ? [request.countryId] : undefined) : undefined,
    exclusions.jurisdictionIds?.length ? intersects(exclusions.jurisdictionIds, request.jurisdictionIds) : undefined,
    exclusions.zoneIds?.length ? intersects(exclusions.zoneIds, request.zoneIds) : undefined,
    exclusions.speciesIds?.length ? intersects(exclusions.speciesIds, request.speciesIds) : undefined,
  ].filter((value): value is boolean => value !== undefined);
  return dimensions.length > 0 && dimensions.every(Boolean);
}

function matchReasons(block: ContentBlock, request: ContextRequest): string[] {
  const reasons: string[] = [];
  if (intersects(block.applicability.speciesIds, request.speciesIds) && block.applicability.speciesIds?.length) reasons.push("species");
  if (intersects(block.applicability.jurisdictionIds, request.jurisdictionIds) && block.applicability.jurisdictionIds?.length) reasons.push("jurisdiction");
  if (intersects(block.applicability.zoneIds, request.zoneIds) && block.applicability.zoneIds?.length) reasons.push("management zone");
  if (block.applicability.activityIds?.includes(request.activityId)) reasons.push("activity");
  if (request.huntTypeId && block.applicability.huntTypeIds?.includes(request.huntTypeId)) reasons.push("hunt type");
  if (block.applicability.temperatureC && inRange(request.temperatureC, block.applicability.temperatureC)) reasons.push("temperature");
  return reasons;
}

function specificity(block: ContentBlock, request: ContextRequest): number[] {
  const app = block.applicability;
  return [
    request.ownerIds?.includes(block.ownerId) ? 1 : 0,
    app.speciesIds?.some((id) => request.speciesIds?.includes(id)) ? 1 : 0,
    app.zoneIds?.length ? 3 : app.jurisdictionIds?.length ? 2 : app.countryIds?.length ? 1 : 0,
    app.activityIds?.includes(request.activityId) ? 1 : 0,
    request.huntTypeId && app.huntTypeIds?.includes(request.huntTypeId) ? 1 : 0,
    app.temperatureC ? 1 : 0,
    block.priority,
    Number(block.lastReviewed.replaceAll("-", "")),
  ];
}

function compareTuple(left: number[], right: number[]): number {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (right[index] ?? 0) - (left[index] ?? 0);
    if (difference) return difference;
  }
  return 0;
}

export class InProcessContentRepository implements ContentRepository {
  async resolveEntity(input: EntityLookup): Promise<EntityResolution> {
    const exact = entities.get(input.value as CanonicalId);
    if (exact) return { status: "resolved", entity: exact, matchedBy: "id" };

    const value = normalized(input.value);
    const matches: Array<{ entity: Entity; matchedBy: "slug" | "name" | "alias" }> = [];
    for (const entity of bundle.entities) {
      const locale = input.locale ?? "en-CA";
      if (entity.slugs?.some((slug) => slug.locale === locale && normalized(slug.value) === value)) matches.push({ entity, matchedBy: "slug" });
      else if (entity.names.some((name) => name.locale === locale && normalized(name.value) === value)) matches.push({ entity, matchedBy: "name" });
      else if (entity.aliases?.some((alias) => (!alias.locale || alias.locale === locale) && normalized(alias.value) === value)) matches.push({ entity, matchedBy: "alias" });
    }

    if (matches.length === 1) return { status: "resolved", ...matches[0] };
    if (matches.length > 1) return { status: "ambiguous", candidates: matches.map(({ entity }) => entity) };
    return { status: "not_found", candidates: [] };
  }

  async getEntity(id: CanonicalId): Promise<Entity | null> {
    return entities.get(id) ?? null;
  }

  async getResource(id: CanonicalId, options?: LocaleOptions): Promise<Resource | null> {
    const resource = resources.get(id);
    return resource && (!options?.locale || resource.locale === options.locale) ? resource : null;
  }

  async getResourceBySlug(slug: string, options?: LocaleOptions): Promise<Resource | null> {
    return bundle.resources.find((resource) => resource.slug === slug && (!options?.locale || resource.locale === options.locale)) ?? null;
  }

  async getBlocksForResource(id: CanonicalId, options?: BlockQuery): Promise<BlockResult> {
    return this.getContextualBlocks({
      locale: options?.locale ?? "en-CA",
      activityId: options?.activityId ?? "activity:hunting",
      ownerIds: [id],
      blockTypes: options?.blockTypes,
      limit: options?.limit,
    });
  }

  async getContextualBlocks(request: ContextRequest): Promise<BlockResult> {
    const eligible = bundle.blocks
      .filter((block) => block.status === "published")
      .filter((block) => block.locale === request.locale)
      .filter((block) => !request.ownerIds?.length || request.ownerIds.includes(block.ownerId))
      .filter((block) => !request.blockTypes?.length || request.blockTypes.includes(block.type))
      .filter((block) => dateApplies(request.date, block.validFrom, block.validThrough))
      .filter((block) => applicabilityMatches(block.applicability, request))
      .filter((block) => !exclusionMatches(block.exclusions, request))
      .map((block) => {
        const reasons = matchReasons(block, request);
        const tuple = specificity(block, request);
        return { block, matchTier: Math.max(1, 8 - reasons.length), matchReasons: reasons, specificity: tuple };
      })
      .sort((left, right) => compareTuple(left.specificity, right.specificity) || left.block.id.localeCompare(right.block.id))
      .slice(0, Math.max(0, Math.min(request.limit ?? 12, 50)));

    return {
      contractVersion: CONTENT_CONTRACT_VERSION,
      resolvedLocale: request.locale,
      fallbackUsed: false,
      context: request,
      blocks: eligible,
      warnings: eligible.length ? [] : [{ code: "NO_MATCH", message: "No published North Ground knowledge matched the complete context." }],
      revision: bundle.generatedAt,
    };
  }

  async getRelatedResources(id: CanonicalId, options?: RelationshipQuery): Promise<ResourceSummary[]> {
    const resource = resources.get(id);
    const directIds = resource?.relatedResourceIds ?? [];
    const edgeIds = bundle.relationships.flatMap((relationship) => {
      if (relationship.status !== "active") return [];
      if (relationship.fromId === id) return [relationship.toId];
      if (relationship.direction === "symmetric" && relationship.toId === id) return [relationship.fromId];
      return [];
    });
    return [...new Set([...directIds, ...edgeIds])]
      .map((relatedId) => resources.get(relatedId))
      .filter((related): related is Resource => Boolean(related && related.status === "published" && (!options?.locale || related.locale === options.locale)))
      .slice(0, options?.limit ?? 5)
      .map((related) => ({
        id: related.id,
        type: related.type,
        title: related.title,
        description: related.description,
        canonicalUrl: canonicalPath(related.id)?.path ?? related.canonicalUrl ?? null,
      }));
  }

  async getCanonicalUrl(id: CanonicalId): Promise<CanonicalUrlResult | null> {
    return canonicalPath(id);
  }

  async getSources(ids: CanonicalId<"source">[]): Promise<SourceRecord[]> {
    return ids.flatMap((id) => {
      const source = sources.get(id);
      return source ? [source] : [];
    });
  }

  async getPublishedResources(options?: LocaleOptions): Promise<Resource[]> {
    return bundle.resources.filter((resource) => resource.status === "published" && (!options?.locale || resource.locale === options.locale));
  }

  async getSpecies(id: CanonicalId<"species">): Promise<SpeciesResource | null> {
    const resource = resources.get(id);
    return resource?.type === "species" && resource.status === "published" ? resource : null;
  }

  async searchSpecies(query: string, options?: LocaleOptions): Promise<SpeciesSearchResult[]> {
    const needle = normalized(query);
    if (!needle) return [];
    return bundle.resources
      .filter((resource): resource is SpeciesResource => resource.type === "species" && resource.status === "published" && (!options?.locale || resource.locale === options.locale))
      .map((resource) => {
        const entity = entities.get(resource.speciesProfile.speciesId);
        const aliases = [...(entity?.aliases ?? []), ...(resource.speciesProfile.aliases ?? [])].map(({ value }) => value);
        const terms = speciesTerms(resource, entity).map((term) => ({ ...term, normalized: normalized(term.value) }));
        const exactTerm = terms.find((term) => term.normalized === needle);
        const exact = Boolean(exactTerm);
        const prefix = terms.some((term) => term.normalized.startsWith(needle) || term.normalized.split(/\s+/).some((token) => token.startsWith(needle)));
        const contains = needle.length >= 3 && terms.some((term) => term.normalized.includes(needle));
        if (!exact && !prefix && !contains) return null;
        const groupId = resource.speciesProfile.speciesGroupIds[0];
        const group = groupId ? entities.get(groupId) : undefined;
        return {
          id: resource.speciesProfile.speciesId,
          commonName: resource.title,
          scientificName: resource.speciesProfile.scientificName,
          aliases: [...new Set(aliases)],
          searchTerms: [...new Set(terms.map(({ value }) => value))],
          category: group?.names.find(({ locale }) => locale === "en-CA")?.value ?? "Other",
          canonicalUrl: canonicalPath(resource.id)?.path ?? resource.canonicalUrl ?? "",
          intent: exactTerm?.intent,
          matchedTerm: exactTerm?.value,
          rank: exact ? 0 : prefix ? 1 : 2,
        };
      })
      .filter((result) => result !== null)
      .sort((left, right) => left.rank - right.rank || left.commonName.localeCompare(right.commonName))
      .map((result) => ({
        id: result.id,
        commonName: result.commonName,
        scientificName: result.scientificName,
        aliases: result.aliases,
        searchTerms: result.searchTerms,
        category: result.category,
        canonicalUrl: result.canonicalUrl,
        intent: result.intent,
        matchedTerm: result.matchedTerm,
      }));
  }

  async interpretSpeciesQuery(query: string, options?: LocaleOptions): Promise<SpeciesQueryInterpretation> {
    const species = await this.searchSpecies(query, options);
    if (!species.length) return { status: "not_found", species: [] };
    const needle = normalized(query);
    const exactSpecies = species.filter(({ matchedTerm }) => matchedTerm && normalized(matchedTerm) === needle);
    const categoryMatch = species.some((result) => {
      const resource = resources.get(result.id);
      if (resource?.type !== "species") return false;
      return resource.speciesProfile.speciesGroupIds.some((groupId) => {
        const group = entities.get(groupId);
        return [...(group?.names ?? []), ...(group?.aliases ?? [])]
          .some(({ value }) => normalized(value) === needle);
      });
    });
    if (exactSpecies.length === 1 && !categoryMatch) {
      return { status: "resolved", species: exactSpecies[0], intent: exactSpecies[0].intent };
    }
    if (species.length === 1 && !categoryMatch) {
      return { status: "resolved", species: species[0], intent: species[0].intent };
    }
    return { status: "choices", species, categoryMatch };
  }

  async getSpeciesAliases(id: CanonicalId<"species">): Promise<EntityAlias[]> {
    return entities.get(id)?.aliases ?? [];
  }

  async getSpeciesImage(id: CanonicalId<"species">): Promise<MediaRecord | null> {
    return (await this.getSpeciesImages(id))[0] ?? null;
  }

  async getSpeciesImages(id: CanonicalId<"species">): Promise<MediaRecord[]> {
    return bundle.media.filter((media) => media.kind === "image" && media.status === "active"
      && media.identityVerification === "verified" && media.depictsSpeciesIds?.length === 1
      && media.depictsSpeciesIds[0] === id);
  }

  async getSpeciesGroups(id: CanonicalId<"species">): Promise<Entity<"species_group">[]> {
    const resource = await this.getSpecies(id);
    if (!resource) return [];
    return resource.speciesProfile.speciesGroupIds.flatMap((groupId) => {
      const group = entities.get(groupId);
      return group?.type === "species_group" ? [group as Entity<"species_group">] : [];
    });
  }

  async getSpeciesSexAgeInfo(id: CanonicalId<"species">): Promise<SpeciesSexAgeInfo | null> {
    return (await this.getSpecies(id))?.speciesProfile.sexAgeInfo ?? null;
  }

  async getSpeciesIdentificationWarnings(id: CanonicalId<"species">): Promise<ContentBlock[]> {
    return bundle.blocks.filter((block) => block.ownerId === id && block.status === "published"
      && block.type === "identification_warning");
  }

  async getSpeciesBlocks(id: CanonicalId<"species">, request: Omit<ContextRequest, "speciesIds" | "ownerIds">): Promise<BlockResult> {
    return this.getContextualBlocks({ ...request, speciesIds: [id], ownerIds: [id] });
  }

  async getRelatedSpecies(id: CanonicalId<"species">): Promise<SpeciesResource[]> {
    const resource = await this.getSpecies(id);
    if (!resource) return [];
    return (resource.relatedSpeciesIds ?? []).flatMap((relatedId) => {
      const related = resources.get(relatedId);
      return related?.type === "species" && related.status === "published" ? [related] : [];
    });
  }

  async getSpeciesSources(id: CanonicalId<"species">): Promise<SourceRecord[]> {
    const resource = await this.getSpecies(id);
    if (!resource) return [];
    return this.getSources([...new Set([...(resource.sourceIds ?? []), ...resource.speciesProfile.sourceIds])]);
  }
}

export const contentRepository: ContentRepository = new InProcessContentRepository();
