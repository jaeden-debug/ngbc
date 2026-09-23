import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "../../../components/Breadcrumbs";
import HuntNav from "../../../components/hunt/HuntNav";
import { contentRepository } from "../../../lib/content/repository";
import { northAmericaCoverageReport, regulatoryJurisdictionsForSpecies } from "../../../lib/hunt/north-america/report";
import { SPECIES_LIBRARY_METADATA } from "../../../lib/seo/species-metadata";
import { currentSpeciesMediaAdmin } from "../../../lib/species-media/admin-auth";
import { getSpeciesPrimaryMediaMap } from "../../../lib/species-media/repository";
import SpeciesLibrary, { type LibrarySpecies } from "./SpeciesLibrary";
import styles from "./page.module.css";

const SPECIES_LIBRARY_OG_IMAGE = "/og/species-library";

export const metadata: Metadata = {
  /* The layout template already appends the brand. */
  title: SPECIES_LIBRARY_METADATA.title,
  description: SPECIES_LIBRARY_METADATA.description,
  alternates: { canonical: "/hunting/species" },
  openGraph: {
    type: "website",
    url: "/hunting/species",
    title: SPECIES_LIBRARY_METADATA.ogTitle,
    description: SPECIES_LIBRARY_METADATA.ogDescription,
    images: [{ url: SPECIES_LIBRARY_OG_IMAGE, width: 1200, height: 630, alt: SPECIES_LIBRARY_METADATA.ogTitle }],
  },
  twitter: {
    card: "summary_large_image",
    title: SPECIES_LIBRARY_METADATA.ogTitle,
    description: SPECIES_LIBRARY_METADATA.ogDescription,
    images: [SPECIES_LIBRARY_OG_IMAGE],
  },
};
export const dynamic = "force-dynamic";

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
  const coverageReport = northAmericaCoverageReport();
  const resources = (await contentRepository.getPublishedResources({ locale: "en-CA" }))
    .filter((resource) => resource.type === "species");
  const [mediaBySpecies, admin] = await Promise.all([
    getSpeciesPrimaryMediaMap(resources.map((resource) => resource.speciesProfile.speciesId)),
    currentSpeciesMediaAdmin(),
  ]);

  const species: LibrarySpecies[] = await Promise.all(resources.map(async (resource) => {
    const speciesId = resource.speciesProfile.speciesId;
    const [aliases, groups] = await Promise.all([
      contentRepository.getSpeciesAliases(speciesId),
      contentRepository.getSpeciesGroups(speciesId),
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
      regulatoryJurisdictions: regulatoryJurisdictionsForSpecies(speciesId, coverageReport)
        .map(({ nameEn }) => nameEn),
      image: mediaBySpecies.get(speciesId) ?? null,
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

        <SpeciesLibrary species={species} adminMode={Boolean(admin)} />

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
