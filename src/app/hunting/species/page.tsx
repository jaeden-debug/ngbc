import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "../../../components/Breadcrumbs";
import { contentRepository } from "../../../lib/content/repository";
import SpeciesLibrary from "./SpeciesLibrary";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Species Library | North Ground",
  description: "Field-useful species profiles with verified taxonomy, identification cautions, habitat context and clear separation from hunting regulations.",
  alternates: { canonical: "/hunting/species" },
};

export default async function SpeciesLibraryPage() {
  const resources = (await contentRepository.getPublishedResources({ locale: "en-CA" }))
    .filter((resource) => resource.type === "species");
  const species = (await Promise.all(resources.map((resource) => contentRepository.searchSpecies(resource.title, { locale: "en-CA" }))))
    .flatMap((results) => results.slice(0, 1))
    .sort((left, right) => left.category.localeCompare(right.category) || left.commonName.localeCompare(right.commonName));

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Species library", path: "/hunting/species" }]} />
        <header className={styles.hero}>
          <p className={styles.eyebrow}>North Ground knowledge</p>
          <h1>Species library</h1>
          <p className={styles.lede}>Biological identity, field marks and habitat—kept separate from the location- and date-specific rules that decide whether a hunt is legal.</p>
          <p className={styles.rule}><strong>A species profile is not a hunting permission.</strong> Use <Link href="/hunt">North Ground Hunt</Link> for available regulatory coverage.</p>
        </header>
        <SpeciesLibrary species={species} />
      </div>
    </main>
  );
}
