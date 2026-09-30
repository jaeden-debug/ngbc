import type { CanonicalId } from "../content-contract/index.ts";
import type { SpeciesSelectorOption } from "./coverage.ts";

/**
 * The Hunt picker's options, sent as tuples and rebuilt once in the browser.
 *
 * WHY. With 468 species the option objects were a 228 KB chunk of the first
 * HTML, and most of it was the same eleven key names written 468 times, each
 * doubled by the RSC string escaping. A tuple carries the values alone. Nothing
 * is dropped: `unpackSpeciesOptions(packSpeciesOptions(x))` equals `x` for the
 * server-built options (image is always null there; media arrives separately).
 */
type PackedJurisdiction = [id: string, name: string, asksQuestion: 0 | 1];
export type PackedSpeciesOption = [
  id: string,
  displayName: string,
  scientificName: string,
  category: string,
  aliases: string[],
  searchTerms: string[],
  groupIds: string[],
  resourcePath: string | null,
  regulatoryJurisdictions: PackedJurisdiction[],
  flags: number,
];

const OPPORTUNITY = 1;
const SURFACE = 2;

export function packSpeciesOptions(options: readonly SpeciesSelectorOption[]): PackedSpeciesOption[] {
  return options.map((option) => [
    option.id,
    option.displayName,
    option.scientificName,
    option.category,
    option.aliases,
    option.searchTerms,
    option.groupIds,
    option.resourcePath,
    option.regulatoryJurisdictions.map(({ id, name, asksQuestion }) => [id, name, asksQuestion ? 1 : 0] as PackedJurisdiction),
    (option.hasOpportunityEvidence ? OPPORTUNITY : 0) | (option.hasSpeciesSurface ? SURFACE : 0),
  ]);
}

export function unpackSpeciesOptions(packed: readonly PackedSpeciesOption[]): SpeciesSelectorOption[] {
  return packed.map(([id, displayName, scientificName, category, aliases, searchTerms, groupIds, resourcePath, jurisdictions, flags]) => ({
    id: id as CanonicalId<"species">,
    displayName,
    scientificName,
    category,
    aliases,
    searchTerms,
    groupIds,
    resourcePath,
    image: null,
    regulatoryJurisdictions: jurisdictions.map(([jurisdictionId, name, asksQuestion]) => ({
      id: jurisdictionId as CanonicalId<"jurisdiction">,
      name,
      asksQuestion: asksQuestion === 1,
    })),
    hasOpportunityEvidence: (flags & OPPORTUNITY) !== 0,
    hasSpeciesSurface: (flags & SURFACE) !== 0,
  }));
}
