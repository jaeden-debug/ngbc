import {
  type CanonicalId,
  type EntityType,
  parseCanonicalId,
} from "../content-contract/ids.ts";

/**
 * Canonical URL resolution for North Ground content.
 *
 * This module is the single implementation of docs/content-system/ROUTE-REGISTRY.md.
 * Content records store canonical IDs and never store paths; pages, sitemaps,
 * structured data and the Hunt app all resolve paths through here. Changing a
 * route family means changing this file and adding a redirect — nothing else.
 */

export type UrlLocale = string;

export interface CanonicalUrlResult {
  /** Absolute-from-root path, no origin, no trailing slash. */
  path: string;
  /** Historical paths that MUST 301 to `path`. */
  previousPaths?: string[];
}

/** Composite pages have no single entity ID, so they are resolved explicitly. */
export interface SpeciesInJurisdictionRef {
  countryKey: string;
  jurisdictionKey: string;
  speciesKey: string;
}

const HUNTING = "/hunting";

/**
 * Jurisdiction keys are `{country}-{region}` (e.g. `ca-qc`), because the
 * taxonomy needs them globally unique. Routes are nested instead, so the
 * country prefix is stripped when it matches the parent segment.
 */
export function jurisdictionSegments(key: string): { country: string; region: string } | null {
  const dash = key.indexOf("-");
  if (dash <= 0 || dash === key.length - 1) return null;
  return { country: key.slice(0, dash), region: key.slice(dash + 1) };
}

/** Route family for each entity type, or null when the type is not a page. */
const FAMILY: Partial<Record<EntityType, (key: string) => string | null>> = {
  species: (k) => `${HUNTING}/species/${k}`,
  species_group: (k) => `${HUNTING}/species/groups/${k}`,
  country: (k) => `${HUNTING}/${k}`,
  jurisdiction: (k) => {
    const parts = jurisdictionSegments(k);
    return parts ? `${HUNTING}/${parts.country}/${parts.region}` : null;
  },
  hunt_type: (k) => `${HUNTING}/guides/${k}`,
  method: (k) => `${HUNTING}/guides/${k}`,
  condition: (k) => `${HUNTING}/conditions/${k}`,
  weather_condition: (k) => `${HUNTING}/conditions/${k}`,
  temperature_band: (k) => `${HUNTING}/conditions/${k}`,
  clothing_system: (k) => `${HUNTING}/clothing/${k}`,
  pack_template: (k) => `${HUNTING}/packs/${k}`,
  skill: (k) => `${HUNTING}/skills/${k}`,
  safety_topic: (k) => `${HUNTING}/skills/${k}`,
  regulation_topic: (k) => `${HUNTING}/guides/${k}`,
  equipment_category: (k) => `${HUNTING}/gear/${k}`,
  field_test: (k) => `${HUNTING}/field-tests/${k}`,
  guide: (k) => `${HUNTING}/guides/${k}`,
  tool: (k) => `/tools/${k}`,
};

/**
 * Canonical overrides for tools that are products in their own right.
 *
 * `/tools/{slug}` remains the family route for utilities. North Ground Hunt is the
 * flagship product rather than a utility, and the homepage sends people straight
 * into it, so it earns a short product route. The former path is recorded here and
 * permanently redirects — this is the only place the move is expressed.
 */
const CANONICAL_OVERRIDES: Record<string, CanonicalUrlResult> = {
  "tool:season-finder": { path: "/hunt", previousPaths: ["/tools/season-finder"] },
};

/** Every historical path that must permanently redirect, with its destination. */
export function redirectPairs(): Array<{ from: string; to: string }> {
  return Object.values(CANONICAL_OVERRIDES).flatMap(({ path, previousPaths }) =>
    (previousPaths ?? []).map((from) => ({ from, to: path })),
  );
}

/**
 * Types that are real entities but deliberately have no public page of their
 * own. They surface inside a parent page, so linking to them is a bug rather
 * than a missing route.
 */
const NON_ROUTED: ReadonlySet<EntityType> = new Set<EntityType>([
  "activity",
  "content_block",
  "source",
  "equipment_item",
  "product",
  "management_zone",
  "special_territory",
]);

export function isRoutableType(type: EntityType): boolean {
  return !NON_ROUTED.has(type) && type in FAMILY;
}

/**
 * Resolve a canonical ID to its public path.
 *
 * Returns null for unknown IDs and for entity types that intentionally have no
 * page. Callers MUST treat null as "do not render a link" rather than falling
 * back to a constructed string.
 */
export function canonicalPath(id: string): CanonicalUrlResult | null {
  const parsed = parseCanonicalId(id);
  if (!parsed) return null;

  const build = FAMILY[parsed.type];
  if (!build || NON_ROUTED.has(parsed.type)) return null;

  const override = CANONICAL_OVERRIDES[id];
  if (override) return override;

  const path = build(parsed.key);
  return path ? { path } : null;
}

/**
 * Species x jurisdiction pages are compositions of two entities, so they carry
 * no ID of their own. Per ROUTE-REGISTRY these may only be created when they
 * hold material information beyond both parents; that gate is enforced by the
 * repository, not here.
 */
export function speciesInJurisdictionPath(ref: SpeciesInJurisdictionRef): string {
  return `${HUNTING}/${ref.countryKey}/${ref.jurisdictionKey}/${ref.speciesKey}`;
}

export function speciesInJurisdictionPathFromIds(
  speciesId: CanonicalId<"species">,
  jurisdictionId: CanonicalId<"jurisdiction">,
): string | null {
  const species = parseCanonicalId(speciesId);
  const jurisdiction = parseCanonicalId(jurisdictionId);
  if (!species || !jurisdiction) return null;
  if (species.type !== "species" || jurisdiction.type !== "jurisdiction") return null;

  const parts = jurisdictionSegments(jurisdiction.key);
  if (!parts) return null;

  return speciesInJurisdictionPath({
    countryKey: parts.country,
    jurisdictionKey: parts.region,
    speciesKey: species.key,
  });
}

/** Absolute URL for canonical tags, sitemaps and structured data. */
export function absoluteUrl(path: string, origin: string): string {
  const base = origin.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}
