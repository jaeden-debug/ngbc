import { catalogueSpecies } from "../species-media/provider/catalogue.ts";
import { validateSpeciesAuthorityPage } from "./validate.ts";
import { whiteTailedDeerAuthorityPage } from "./white-tailed-deer.ts";
import type { SpeciesAuthorityPage } from "./types.ts";

const publishedSpeciesIds = new Set(catalogueSpecies().map(({ speciesId }) => speciesId));
const pages = new Map<string, SpeciesAuthorityPage>([
  [whiteTailedDeerAuthorityPage.speciesId, validateSpeciesAuthorityPage(whiteTailedDeerAuthorityPage, publishedSpeciesIds)],
]);

export function speciesAuthorityPageFor(speciesId: string) {
  return pages.get(speciesId) ?? null;
}

export function speciesAuthorityPages() {
  return [...pages.values()];
}
