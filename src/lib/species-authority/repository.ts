import type { SourceRecord } from "../content-contract/types.ts";
import { catalogueSpecies } from "../species-media/provider/catalogue.ts";
import { adaptSpeciesAuthorityPage, adapterInputFor } from "./adapt.ts";
import { validateSpeciesAuthorityPage } from "./validate.ts";
import { whiteTailedDeerAuthorityPage } from "./white-tailed-deer.ts";
import type { SpeciesAuthorityPage } from "./types.ts";

const publishedSpeciesIds = new Set(catalogueSpecies().map(({ speciesId }) => speciesId));
const pages = new Map<string, SpeciesAuthorityPage>([
  [whiteTailedDeerAuthorityPage.speciesId, validateSpeciesAuthorityPage(whiteTailedDeerAuthorityPage, publishedSpeciesIds)],
]);

/**
 * Whether a species with no authored page is served the adapted authority
 * renderer.
 *
 * ONE reversible decision, and it is OFF in this commit. The carry below it is
 * complete and certified, and the 484 adapted pages are not yet served: that
 * way the contract change can be read and deployed on its own, and the renderer
 * change is the single line that follows.
 *
 * The legacy renderer is untouched behind it, so this default — or
 * `NG_ADAPTED_AUTHORITY_PAGES=off` once it is on — returns all 484 species to
 * exactly the page they had, with no merge to unpick. The authored
 * White-tailed Deer page does not pass through here and is unaffected either
 * way.
 */
export const ADAPTED_AUTHORITY_PAGES = process.env.NG_ADAPTED_AUTHORITY_PAGES === "on";

/** An authored page, and only an authored page. */
export function speciesAuthorityPageFor(speciesId: string) {
  return pages.get(speciesId) ?? null;
}

export function speciesAuthorityPages() {
  return [...pages.values()];
}

/**
 * The authority page for a species: the authored one where it exists, the
 * adapted one otherwise.
 *
 * Validation runs on the adapted page and a failure returns null, which sends
 * the route to the legacy renderer. The catalogue-wide test certifies all 485
 * in CI, so a failure here means production data the gate did not see — and
 * the honest response to that is the page the species had before, not a 500
 * and not a page that skipped its own contract.
 */
export function authorityPageForSpecies(
  resource: Parameters<typeof adapterInputFor>[0],
  sources: readonly SourceRecord[],
  reviewedAt: string,
): SpeciesAuthorityPage | null {
  const authored = pages.get(resource.speciesProfile.speciesId);
  if (authored) return authored;
  if (!ADAPTED_AUTHORITY_PAGES) return null;
  const page = adaptSpeciesAuthorityPage(adapterInputFor(resource, sources, reviewedAt));
  if (!page) return null;
  try {
    return validateSpeciesAuthorityPage(page, publishedSpeciesIds);
  } catch {
    return null;
  }
}
