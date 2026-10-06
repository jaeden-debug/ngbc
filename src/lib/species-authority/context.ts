import type { SpeciesResource } from "../content-contract/types.ts";
import type { ContentBlock } from "../content-contract/types.ts";
import type { SpeciesTakeListing } from "../content/species-take-evidence.ts";
import type { SpeciesAuthorityPage } from "./types.ts";

/**
 * The six field families a species page carries BESIDE its prose, carried in
 * the contract rather than passed to one renderer as props.
 *
 * WHY IN THE CONTRACT. Migrating 485 species to the authority renderer would
 * otherwise have dropped them: measured across the catalogue, take evidence
 * reaches 466 species (Mallard 52 jurisdictions, coyote 55), lookalikes 300,
 * field-note blocks 334, and groups, related resources and the review date
 * 485 each. A renderer that cannot express them does not render a shorter
 * page; it renders a page missing evidence the species already holds.
 *
 * WHY DERIVED AND NEVER AUTHORED. Every value here is projected from the data
 * that already owns it — the take-evidence bundle, the resource, the content
 * repository — at the moment the page is built. Nothing is hand-copied into a
 * second file, so the two cannot drift: `context.test.ts` asserts the
 * projection equals its source for all 485 species. §14 keeps one home per
 * fact; this is a view of that home, not a copy of it.
 */
export interface SpeciesPageContext {
  /**
   * Where an authority lists legal take, with the whole evidence row: the
   * take modes, the authority's own statuses and names, what resolved it, and
   * its sources. The narrowed shape this replaced kept the modes and dropped
   * `statuses`, `authorityNames`, `resolvedBy` and `sourceIds`, which is the
   * part that makes a listing auditable rather than decorative.
   */
  takeListings: readonly SpeciesTakeListing[];
  /**
   * The authorities the take listings and conservation statements cite, so each
   * can link its own.
   *
   * The legacy page linked them per listing and the authority renderer did
   * not, which would have published 466 species' take evidence with the
   * authority's name removed. §7: a user should be able to reach the original
   * authoritative source, and §8 makes provenance non-negotiable.
   */
  authoritySources: readonly { id: string; title: string; url: string }[];
  /**
   * The authority's own conservation statements, kept as recorded.
   *
   * Carried rather than built into the page, for the reason §16 gives: a
   * listed subspecies or population is named as the authority names it, and
   * these are facts about the SPECIES, not prose about the page. It was in the
   * adapter, which meant the 484 adapted pages showed them and the one
   * authored page did not — measured, white-tailed deer's own two statements
   * (Columbian white-tailed deer, Key deer) appeared on neither renderer.
   */
  conservationStatements: readonly { status?: string; text: string; sourceIds: readonly string[] }[];
  /**
   * The species this one is confused with.
   *
   * `similarSpeciesIds` is canonical, not the resource's `relatedSpeciesIds`:
   * measured over all 485, every related id is also a similar id (0
   * exceptions), similar covers 300 species against related's 294, and in the
   * 8 species where they differ similar holds more. The legacy page reads
   * `relatedSpeciesIds`, so it shows no lookalikes at all for six species —
   * white-tailed deer among them, on the one page where they are authored.
   */
  lookalikes: readonly { speciesId: string; title: string; href: string | null; scientificName?: string }[];
  /** Contextual field notes (safety, habitat, identification, seasonal, legal). */
  fieldNotes: readonly ContentBlock[];
  /**
   * EVERY group this species belongs to, with the display name used.
   *
   * Both renderers showed `groups[0]` alone, so 316 species lost a real
   * classification — willow ptarmigan is both Grouse and Upland game birds,
   * and only one of those appeared. 339 names were missing on both pages.
   */
  groups: readonly { id: string; name: string }[];
  /** North Ground resources related to this species. */
  relatedResources: readonly { id: string; title: string; href: string | null }[];
  /** The review date already on the resource, carried so the page can state it. */
  lastReviewed: string | null;
}

/**
 * The page with its context attached.
 *
 * Pure and total: an authored page and an adapted one take the same context by
 * the same path, so the reference implementation cannot be served a different
 * projection from the other 484.
 */
export function withSpeciesContext(page: SpeciesAuthorityPage, context: SpeciesPageContext): SpeciesAuthorityPage {
  return { ...page, context };
}

/** The projection itself, from the data that owns each family. */
export function speciesPageContext(input: {
  resource: SpeciesResource;
  takeListings: readonly SpeciesTakeListing[];
  /**
   * The authorities the take listings and conservation statements cite, so each
   * can link its own.
   *
   * The legacy page linked them per listing and the authority renderer did
   * not, which would have published 466 species' take evidence with the
   * authority's name removed. §7: a user should be able to reach the original
   * authoritative source, and §8 makes provenance non-negotiable.
   */
  authoritySources: readonly { id: string; title: string; url: string }[];
  /**
   * The authority's own conservation statements, kept as recorded.
   *
   * Carried rather than built into the page, for the reason §16 gives: a
   * listed subspecies or population is named as the authority names it, and
   * these are facts about the SPECIES, not prose about the page. It was in the
   * adapter, which meant the 484 adapted pages showed them and the one
   * authored page did not — measured, white-tailed deer's own two statements
   * (Columbian white-tailed deer, Key deer) appeared on neither renderer.
   */
  conservationStatements: readonly { status?: string; text: string; sourceIds: readonly string[] }[];
  lookalikes: readonly { id: string; title: string; href: string | null; scientificName: string }[];
  fieldNotes: readonly ContentBlock[];
  groups: readonly { id: string; names: ReadonlyArray<{ locale: string; value: string }> }[];
  relatedResources: readonly { id: string; title: string; href?: string | null }[];
}): SpeciesPageContext {
  const { resource } = input;
  return {
    takeListings: input.takeListings,
    authoritySources: input.authoritySources.flatMap(({ id, title, url }) => (url ? [{ id, title, url }] : [])),
    conservationStatements: input.conservationStatements.map(({ status, text, sourceIds }) => ({
      ...(status ? { status } : {}), text, sourceIds: sourceIds ?? [],
    })),
    lookalikes: input.lookalikes.map(({ id, title, href, scientificName }) => ({
      speciesId: id, title, href, ...(scientificName ? { scientificName } : {}),
    })),
    fieldNotes: input.fieldNotes,
    /* The locale's own name where the bundle has one, the first otherwise: a
       group without an en-CA name still has an identity worth showing, and
       §47 forbids inventing a localized term for it. */
    groups: input.groups.map((group) => ({
      id: group.id,
      name: group.names.find(({ locale }) => locale === resource.locale)?.value
        ?? group.names[0]?.value ?? group.id,
    })),
    relatedResources: input.relatedResources.map(({ id, title, href }) => ({ id, title, href: href ?? null })),
    lastReviewed: resource.lastReviewed ?? null,
  };
}
