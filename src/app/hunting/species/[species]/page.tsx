import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumbs from "../../../../components/Breadcrumbs";
import {
  AppBlockList,
  DirectAnswer,
  KeyFacts,
  RelatedResources,
  SourceList,
} from "../../../../components/content/ContentPatterns";
import StructuredData from "../../../../components/StructuredData";
import type { SpeciesResource } from "../../../../lib/content-contract/types";
import { contentRepository } from "../../../../lib/content/repository";
import { speciesArticleJsonLd } from "../../../../lib/seo/structured-data";
import { absoluteUrl } from "../../../../lib/site";
import styles from "./page.module.css";

type Props = { params: Promise<{ species: string }> };

async function getSpeciesResource(slug: string): Promise<SpeciesResource | null> {
  const resource = await contentRepository.getResourceBySlug(slug, { locale: "en-CA" });
  return resource?.type === "species" && resource.status === "published" ? resource : null;
}

export async function generateStaticParams() {
  const resources = await contentRepository.getPublishedResources({ locale: "en-CA" });
  return resources.filter((resource) => resource.type === "species").map((resource) => ({ species: resource.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { species } = await params;
  const resource = await getSpeciesResource(species);
  if (!resource) return {};
  return {
    title: resource.title,
    description: resource.description,
    alternates: { canonical: resource.canonicalUrl },
    openGraph: {
      type: "article",
      url: resource.canonicalUrl,
      title: resource.title,
      description: resource.description,
      images: [{
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${resource.title} | North Ground`,
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: resource.title,
      description: resource.description,
      images: ["/opengraph-image"],
    },
  };
}

export default async function SpeciesPage({ params }: Props) {
  const { species } = await params;
  const resource = await getSpeciesResource(species);
  if (!resource) notFound();

  const blocksPromise = contentRepository.getSpeciesBlocks(resource.speciesProfile.speciesId, {
    locale: resource.locale,
    countryId: "country:ca",
    jurisdictionIds: resource.speciesProfile.documentedHuntingJurisdictionIds,
    activityId: "activity:hunting",
    blockTypes: ["habitat_tip", "identification_warning", "seasonal_behavior", "legal_note"],
    date: resource.lastReviewed,
  });
  const [related, relatedSpecies, image, blocks] = await Promise.all([
    contentRepository.getRelatedResources(resource.id, { locale: resource.locale, limit: 5 }),
    contentRepository.getRelatedSpecies(resource.speciesProfile.speciesId),
    contentRepository.getSpeciesImage(resource.speciesProfile.speciesId),
    blocksPromise,
  ]);
  const sourceIds = new Set(resource.sourceIds ?? []);
  for (const sourceId of resource.speciesProfile.sourceIds) sourceIds.add(sourceId);
  for (const { block } of blocks.blocks) {
    for (const sourceId of block.sourceIds ?? []) sourceIds.add(sourceId);
  }
  const sources = await contentRepository.getSources([...sourceIds]);

  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Species library", path: "/hunting/species" },
    { name: resource.title, path: resource.canonicalUrl ?? `/hunting/species/${resource.slug}` },
  ];

  return (
    <main className={styles.page}>
      <StructuredData data={speciesArticleJsonLd(resource, absoluteUrl(resource.canonicalUrl ?? `/hunting/species/${resource.slug}`))} />
      <div className={styles.shell}>
        <div className={styles.breadcrumb}><Breadcrumbs items={breadcrumbs} /></div>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Species reference</p>
          <h1>{resource.title}</h1>
          <p className={styles.scientific}>{resource.speciesProfile.scientificName}</p>
          <p className={styles.identity}>Canonical ID: <code>{resource.speciesProfile.speciesId}</code></p>
          {image ? (
            <figure className={styles.photo}>
              {/* eslint-disable-next-line @next/next/no-img-element -- external licensed media is contract-gated and responsive. */}
              <img src={image.assetUrl} alt={image.altText ?? ""} width={image.width} height={image.height} />
              <figcaption>{image.caption} {image.attribution}</figcaption>
            </figure>
          ) : (
            <div className={styles.noPhoto} role="note">
              <strong>No species photograph published</strong>
              <span>North Ground publishes a wildlife photo only after exact-species identity and attribution are verified.</span>
            </div>
          )}
          <div className={styles.directAnswer}><DirectAnswer>{resource.quickAnswer}</DirectAnswer></div>
          <div className={styles.ctaRow}>
            <Link className={styles.primaryCta} href="/hunt?species=ruffed-grouse">Check a location and date</Link>
            <a className={styles.secondaryCta} href="#sources">Inspect sources</a>
          </div>
        </header>

        <section className={styles.section} aria-labelledby="key-facts">
          <h2 id="key-facts">Key facts</h2>
          <div className={styles.facts}><KeyFacts facts={resource.keyFacts ?? []} /></div>
        </section>

        <section className={styles.section} aria-labelledby="habitat-context">
          <h2 id="habitat-context">Habitat and seasonal context</h2>
          <div className={styles.sectionText}>
            {resource.speciesProfile.habitat?.map((section) => <p key={section.text}>{section.text}</p>)}
            {resource.speciesProfile.rangeSummary?.map((section) => <p key={section.value}>{section.value} Range describes possible occurrence, not huntability or exact local presence.</p>)}
            {resource.speciesProfile.seasonalBehavior?.map((section) => <p key={section.text}>{section.text}</p>)}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="identification-context">
          <h2 id="identification-context">Identification and confusion risks</h2>
          <div className={styles.sectionText}>
            {resource.speciesProfile.identification.map((section) => <p key={section.text}>{section.text}</p>)}
            {resource.speciesProfile.signsAndTracks?.map((section) => <p key={section.text}>{section.text}</p>)}
          </div>
          {relatedSpecies.length ? (
            <ul className={styles.relatedSpecies}>
              {relatedSpecies.map((species) => <li key={species.id}><Link href={species.canonicalUrl ?? `/hunting/species/${species.slug}`}>Compare {species.title}</Link></li>)}
            </ul>
          ) : null}
        </section>

        <section className={styles.section} aria-labelledby="field-use">
          <h2 id="field-use">What matters in the field</h2>
          <div className={styles.blocks}><AppBlockList result={blocks} /></div>
        </section>

        <section className={styles.section} id="sources" aria-labelledby="source-heading">
          <h2 id="source-heading">Sources</h2>
          <p className={styles.review}>Scientific identity and habitat reviewed {resource.lastReviewed}. Regulatory status is intentionally handled by Hunt, not this page.</p>
          <div className={styles.sources}><SourceList sources={sources} /></div>
        </section>

        <section className={styles.section} aria-labelledby="next-question">
          <h2 id="next-question">Next question</h2>
          <p><Link className={styles.primaryCta} href={`/hunt?species=${resource.slug}`}>Check this species in North Ground Hunt</Link></p>
          <div className={styles.related}><RelatedResources resources={related} /></div>
        </section>
      </div>
    </main>
  );
}
