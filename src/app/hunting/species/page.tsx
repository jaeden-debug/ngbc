import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "../../../components/Breadcrumbs";
import HuntNav from "../../../components/hunt/HuntNav";
import { contentRepository } from "../../../lib/content/repository";
import { SUPPORTED_SPECIES_IDS } from "../../../lib/hunt/coverage";
import SpeciesLibrary, { type LibrarySpecies } from "./SpeciesLibrary";
import styles from "./page.module.css";

export const metadata: Metadata = {
  /* The layout template already appends the brand. Setting it here too produced
     "Species Library | North Ground | North Ground" in the live tab. */
  title: "Species library",
  description: "Field-useful species profiles with verified taxonomy, identification cautions, habitat context and clear separation from hunting regulations.",
  alternates: { canonical: "/hunting/species" },
};

/**
 * The library reads the published resources directly rather than searching for
 * each species by its own title.
 *
 * The previous approach called `searchSpecies(resource.title)` once per species
 * and kept the first hit, which silently depends on a species never ranking
 * behind another for its own name. That was survivable at ten species and is not
 * at sixty — `Brant` and `Canada goose` both match several rows. Reading the
 * resource gives the same fields with no ranking involved, and it is the pattern
 * `/hunt` already uses to build its selector.
 */
export default async function SpeciesLibraryPage() {
  const resources = (await contentRepository.getPublishedResources({ locale: "en-CA" }))
    .filter((resource) => resource.type === "species");

  const species: LibrarySpecies[] = await Promise.all(resources.map(async (resource) => {
    const speciesId = resource.speciesProfile.speciesId;
    const [aliases, groups, image] = await Promise.all([
      contentRepository.getSpeciesAliases(speciesId),
      contentRepository.getSpeciesGroups(speciesId),
      contentRepository.getSpeciesImage(speciesId),
    ]);
    const commonNames = resource.speciesProfile.commonNames;
    return {
      id: speciesId,
      commonName: resource.title,
      scientificName: resource.speciesProfile.scientificName,
      frenchName: commonNames.find(({ locale }) => locale.startsWith("fr"))?.value ?? null,
      category: groups[0]?.names.find(({ locale }) => locale === "en-CA")?.value ?? "Other",
      canonicalUrl: resource.canonicalUrl ?? `/hunting/species/${resource.slug}`,
      /* Everything the client filter matches on is assembled here, so the browser
         never needs the bundle to search. */
      searchTerms: [...new Set([
        resource.title,
        resource.speciesProfile.scientificName,
        ...commonNames.map(({ value }) => value),
        ...aliases.map(({ value }) => value),
        ...(resource.speciesProfile.sexAgeInfo?.terminology.map(({ value }) => value) ?? []),
        ...groups.flatMap((group) => group.names.map(({ value }) => value)),
      ])],
      coverage: (SUPPORTED_SPECIES_IDS as readonly string[]).includes(speciesId)
        ? "VERIFIED" as const
        : "IN_DEVELOPMENT" as const,
      /* No species has completed exact-identity and attribution verification yet,
         so this is null for all sixty. The card handles both states rather than
         needing a change when the first verified photograph lands. */
      image: image ? { url: image.assetUrl, alt: image.altText ?? "" } : null,
    };
  }));

  species.sort((left, right) => left.commonName.localeCompare(right.commonName, "en-CA"));

  return (
    <main className="ng-product-page">
      <HuntNav current="/hunting/species" />

      <div className={`ng-shell ${styles.shell}`}>
        <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Species library", path: "/hunting/species" }]} />

        <header className={styles.header}>
          <p className="ng-eyebrow">North Ground Hunt</p>
          <h1 className={styles.title}>Species library</h1>
          <p className={styles.lede}>
            Identification, habitat and field marks for {species.length} North American species.
            Search a common, scientific, French or hunter name.
          </p>

          <div className={`${styles.boundary} ng-glass-card`}>
            <svg className={styles.boundaryIcon} width="16" height="16" viewBox="0 0 18 18" aria-hidden="true" fill="none">
              <path d="M9 1.6 2.6 4.1v5.1c0 3.7 2.7 6.4 6.4 7.2 3.7-.8 6.4-3.5 6.4-7.2V4.1L9 1.6Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              <path d="m6.4 9 1.9 1.9 3.5-3.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className={styles.boundaryText}>
              A profile is biological knowledge, not permission to hunt. Whether a season is
              open depends on location and date — check it in <Link href="/hunt">Hunt</Link>.
            </p>
          </div>
        </header>

        <SpeciesLibrary species={species} />

        <footer className={styles.footer}>
          <p>
            Species knowledge and hunting regulations are maintained separately. North Ground
            organises official information and does not replace the legislation, regulations or
            instructions of the responsible authority.
          </p>
          <p>
            <Link href="/hunt">North Ground Hunt</Link>
            {" · "}
            <Link href="/">North Ground</Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
