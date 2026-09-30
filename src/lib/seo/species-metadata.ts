/**
 * Search and social copy for the species library and every species profile.
 *
 * One function decides it for all species, from data the page already holds, so
 * no species gets hand-written metadata and none can claim more than its record
 * supports:
 *
 * - "Hunting Guide" is earned by a hunted group (big game, waterfowl, upland…)
 *   or by certified rules. A species that is only a furbearer is described as
 *   what it is — identification, habitat, range — because library presence never
 *   implies a hunting opportunity.
 * - "Certified hunting rules" is said only where the coverage report holds them,
 *   and names where. Everything else says field knowledge, never rules.
 * - Service copy says Canada, not North America: only Canada is properly served
 *   today (owner, 2026-09-29). Revert to North America when the U.S. is. Species
 *   RANGE text elsewhere is biology and keeps its own geography.
 */

export const SPECIES_LIBRARY_METADATA = {
  /** The layout template appends " | North Ground". */
  title: "Canadian Game Species Guide",
  description:
    "Explore Canadian game species with identification, habitat, range, hunting information, field knowledge and links to North Ground Hunt.",
  ogTitle: "Canadian Game Species | North Ground",
  ogDescription:
    "Explore game animals across Canada. Learn their habitat, range, identification and hunting context with North Ground.",
} as const;

/** Groups whose members are hunted somewhere they occur. Anything else defaults
    to the non-hunting description: an unknown group must not earn a hunting claim. */
const HUNTED_GROUP_IDS = new Set([
  "species_group:big-game",
  "species_group:deer",
  "species_group:small-game",
  "species_group:hares-rabbits",
  "species_group:squirrels",
  "species_group:upland-game-birds",
  "species_group:grouse",
  "species_group:ptarmigan",
  "species_group:turkey",
  "species_group:waterfowl",
  "species_group:ducks",
  "species_group:geese",
  "species_group:migratory-game-birds",
  "species_group:doves-pigeons",
  "species_group:predators",
  "species_group:wild-sheep",
  "species_group:exotic-big-game",
  "species_group:wild-pig",
  "species_group:peccaries",
  "species_group:quail",
  "species_group:prairie-grouse",
  "species_group:sea-ducks",
  "species_group:swans",
  "species_group:rails-coots",
  "species_group:crows",
]);

/** Protected species published as identification safety content, because they are
    confused with a game species (whooping crane with sandhill crane, trumpeter with
    tundra swan, Gunnison with greater sage-grouse). Group membership would call them
    a hunting guide; they are never titled one. */
export const PROTECTED_LOOKALIKE_IDS = new Set([
  "species:whooping-crane",
  "species:trumpeter-swan",
  "species:gunnison-sage-grouse",
]);

/** Leading words that stay capitalized in running prose. */
const PROPER_LEADING_WORDS = new Set([
  "American", "Canada", "North", "Barrow's", "Wilson's", "Abert's", "Gambel's", "Ross's", "Montezuma",
  "California", "Virginia", "New", "Eurasian", "Gunnison",
]);

export interface CoverageJurisdiction {
  /** Canonical id, "jurisdiction:ca-on". */
  id: string;
  nameEn: string;
}

export interface SpeciesMetadataInput {
  /** The resource title, sentence case ("Ruffed grouse"). */
  name: string;
  /** Canonical id, so a protected lookalike is never called a hunting guide. */
  speciesId?: string;
  groupIds: readonly string[];
  /** Jurisdictions where North Ground holds certified rules for this species. */
  regulatoryJurisdictions: readonly CoverageJurisdiction[];
}

export interface SpeciesMetadataCopy {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  hunted: boolean;
}

/** "White-tailed deer" → "White-tailed Deer": each word, not each hyphen part. */
export function speciesTitleCase(name: string): string {
  return name.split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

/** "Ruffed grouse" → "ruffed grouse"; "American black bear" stays. */
export function speciesProseName(name: string): string {
  const [first, ...rest] = name.split(" ");
  const lead = PROPER_LEADING_WORDS.has(first) ? first : first.charAt(0).toLowerCase() + first.slice(1);
  return [lead, ...rest].join(" ");
}

function count(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** "Idaho", "Ontario and Québec", "5 provinces", "5 provinces and 1 state". */
export function coveragePhrase(jurisdictions: readonly CoverageJurisdiction[]): string | null {
  if (jurisdictions.length && jurisdictions.length <= 2) return jurisdictions.map(({ nameEn }) => nameEn).join(" and ");
  const codes = jurisdictions.map(({ id }) => id.replace(/^jurisdiction:/, ""));
  const territories = codes.filter((code) => /^ca-(yt|nt|nu)$/.test(code)).length;
  const provinces = codes.filter((code) => code.startsWith("ca-")).length - territories;
  const states = codes.filter((code) => code.startsWith("us-")).length;
  const parts = [
    provinces ? count(provinces, "province", "provinces") : null,
    territories ? count(territories, "territory", "territories") : null,
    states ? count(states, "state", "states") : null,
  ].filter((part): part is string => part !== null);
  if (!parts.length) return null;
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

export function speciesMetadataCopy(input: SpeciesMetadataInput): SpeciesMetadataCopy {
  const display = speciesTitleCase(input.name);
  const prose = speciesProseName(input.name);
  const coverage = coveragePhrase(input.regulatoryJurisdictions);
  const protectedLookalike = input.speciesId !== undefined && PROTECTED_LOOKALIKE_IDS.has(input.speciesId);
  const hunted = !protectedLookalike && (coverage !== null || input.groupIds.some((id) => HUNTED_GROUP_IDS.has(id)));

  if (!hunted) {
    return {
      title: `${display}: Identification, Habitat & Range`,
      description: `Learn where the ${prose} lives, how to tell it from its lookalikes, and its habitat and behaviour in Canada.`,
      ogTitle: `${display} | North Ground`,
      ogDescription: `Identification, habitat, range and field knowledge for the ${prose} in Canada.`,
      hunted,
    };
  }
  return {
    title: `${display}: Habitat, Range & Hunting Guide`,
    description: coverage
      ? `Learn where the ${prose} lives, how to identify it, its habitat and behaviour, and check certified hunting rules in ${coverage}.`
      : `Learn where the ${prose} lives, how to identify it, its habitat and behaviour, and the field knowledge hunters use in Canada.`,
    ogTitle: `${display} | North Ground`,
    ogDescription: `Habitat, range, identification, field knowledge and hunting context for the ${prose} in Canada.`,
    hunted,
  };
}
