export const ENTITY_TYPES = [
  "species",
  "species_group",
  "country",
  "jurisdiction",
  "management_zone",
  "special_territory",
  "activity",
  "hunt_type",
  "method",
  "condition",
  "weather_condition",
  "temperature_band",
  "clothing_system",
  "equipment_category",
  "equipment_item",
  "pack_template",
  "skill",
  "safety_topic",
  "regulation_topic",
  "guide",
  "field_test",
  "tool",
  "product",
  "source",
  "content_block",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];
export type CanonicalId<T extends EntityType = EntityType> = `${T}:${string}`;

const ENTITY_TYPE_SET = new Set<string>(ENTITY_TYPES);

export const CANONICAL_ID_PATTERN =
  /^(species|species_group|country|jurisdiction|management_zone|special_territory|activity|hunt_type|method|condition|weather_condition|temperature_band|clothing_system|equipment_category|equipment_item|pack_template|skill|safety_topic|regulation_topic|guide|field_test|tool|product|source|content_block):[a-z0-9](?:[a-z0-9.-]{0,117}[a-z0-9])?$/;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isCanonicalId(value: unknown): value is CanonicalId {
  return typeof value === "string" && value.length <= 120 && CANONICAL_ID_PATTERN.test(value);
}

export function isCanonicalIdOf<T extends EntityType>(
  value: unknown,
  type: T,
): value is CanonicalId<T> {
  return isCanonicalId(value) && value.startsWith(`${type}:`);
}

export function parseCanonicalId(value: string): { type: EntityType; key: string } | null {
  if (!isCanonicalId(value)) return null;
  const separator = value.indexOf(":");
  const type = value.slice(0, separator);
  if (!ENTITY_TYPE_SET.has(type)) return null;
  return {
    type: type as EntityType,
    key: value.slice(separator + 1),
  };
}

export function assertCanonicalId(value: string): asserts value is CanonicalId {
  if (!isCanonicalId(value)) {
    throw new TypeError(`Invalid North Ground canonical ID: ${value}`);
  }
}

export function isSlug(value: unknown): value is string {
  return typeof value === "string" && value.length <= 100 && SLUG_PATTERN.test(value);
}
