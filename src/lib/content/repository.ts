import bundleJson from "../../../content/published/en-CA.json" with { type: "json" };
import {
  CONTENT_CONTRACT_VERSION,
  type Applicability,
  type BlockResult,
  type ContentBlock,
  type ContentBundle,
  type ContextRequest,
  type Entity,
  type Resource,
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
}

const bundle = bundleJson as ContentBundle;
const entities = new Map(bundle.entities.map((entity) => [entity.id, entity]));
const resources = new Map(bundle.resources.map((resource) => [resource.id, resource]));
const sources = new Map(bundle.sources.map((source) => [source.id, source]));

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("en-CA");
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
}

export const contentRepository: ContentRepository = new InProcessContentRepository();
