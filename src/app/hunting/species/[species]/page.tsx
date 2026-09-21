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
import HuntNav from "../../../../components/hunt/HuntNav";
import StructuredData from "../../../../components/StructuredData";
import type { SpeciesResource } from "../../../../lib/content-contract/types";
import { contentRepository } from "../../../../lib/content/repository";
import { regulatoryJurisdictionsForSpecies } from "../../../../lib/hunt/canada/report";
import { speciesArticleJsonLd } from "../../../../lib/seo/structured-data";
import { absoluteUrl } from "../../../../lib/site";
import styles from "./page.module.css";

type Props = { params: Promise<{ species: string }> };

async function getSpeciesResource(slug: string): Promise<SpeciesResource | null> {
  const resource = await contentRepository.getResourceBySlug(slug, { locale: "en-CA" });
  return resource?.type === "species" && resource.status === "published" ? resource : null;
}

/**
 * Only the species that were published at build time exist.
 *
 * Without this an unknown slug fell through to on-demand rendering, reached
 * `notFound()` after the response had begun streaming, and served a 404 whose
 * body existed only inside the RSC payload: an empty page to anyone without
 * JavaScript and to anyone on a slow connection until it arrived. Declaring the
 * set closed makes an unknown slug a route miss, which Next renders in full on
 * the server. It is also simply true — `generateStaticParams` is the list.
 */
export const dynamicParams = false;

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

  const speciesId = resource.speciesProfile.speciesId;
  const blocksPromise = contentRepository.getSpeciesBlocks(speciesId, {
    locale: resource.locale,
    countryId: "country:ca",
    jurisdictionIds: resource.speciesProfile.documentedHuntingJurisdictionIds,
    activityId: "activity:hunting",
    blockTypes: ["habitat_tip", "identification_warning", "seasonal_behavior", "legal_note"],
    date: resource.lastReviewed,
  });
  const [related, relatedSpecies, image, blocks, groups] = await Promise.all([
    contentRepository.getRelatedResources(resource.id, { locale: resource.locale, limit: 5 }),
    contentRepository.getRelatedSpecies(speciesId),
    contentRepository.getSpeciesImage(speciesId),
    blocksPromise,
    contentRepository.getSpeciesGroups(speciesId),
  ]);
  const sourceIds = new Set(resource.sourceIds ?? []);
  for (const sourceId of resource.speciesProfile.sourceIds) sourceIds.add(sourceId);
  for (const { block } of blocks.blocks) {
    for (const sourceId of block.sourceIds ?? []) sourceIds.add(sourceId);
  }
  const sources = await contentRepository.getSources([...sourceIds]);

  const category = groups[0]?.names.find(({ locale }) => locale === "en-CA")?.value ?? null;
  const frenchName = resource.speciesProfile.commonNames.find(({ locale }) => locale.startsWith("fr"))?.value ?? null;
  /* Whether North Ground holds certified rules — deliberately separate from what
     those rules say, which only Hunt can answer for a location and date. */
  const regulatoryJurisdictions = regulatoryJurisdictionsForSpecies(speciesId);
  const hasRegulatoryCoverage = regulatoryJurisdictions.length > 0;

  const profile = resource.speciesProfile;
  const habitat = [
    ...(profile.habitat ?? []).map((section) => section.text),
    ...(profile.rangeSummary ?? []).map((section) => `${section.value} Range describes possible occurrence, not huntability or exact local presence.`),
    ...(profile.seasonalBehavior ?? []).map((section) => section.text),
  ];
  const identification = [
    ...profile.identification.map((section) => section.text),
    ...(profile.signsAndTracks ?? []).map((section) => section.text),
  ];
  const sexAge = profile.sexAgeInfo;
  const canonicalUrl = resource.canonicalUrl ?? `/hunting/species/${resource.slug}`;

  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Species library", path: "/hunting/species" },
    { name: resource.title, path: canonicalUrl },
  ];

  return (
    <main className="ng-product-page">
      <StructuredData data={speciesArticleJsonLd(resource, absoluteUrl(canonicalUrl))} />
      <HuntNav current="/hunting/species" />

      <div className={`ng-shell ${styles.shell}`}>
        <Breadcrumbs items={breadcrumbs} />

        <header className={`${styles.hero} ng-glass-panel`}>
          <div className={styles.heroHead}>
            <p className="ng-eyebrow">{category ? `Species · ${category}` : "Species"}</p>
            <span className="ng-coverage" data-coverage={hasRegulatoryCoverage ? "VERIFIED" : "IN_DEVELOPMENT"}>
              {hasRegulatoryCoverage
                ? `Rules: ${regulatoryJurisdictions.map(({ nameEn }) => nameEn).join(", ")}`
                : "Knowledge profile · no certified rules"}
            </span>
          </div>

          <h1 className={styles.name}>{resource.title}</h1>

          <div className={styles.names}>
            <p className={styles.scientific}>{profile.scientificName}</p>
            {frenchName ? <p className={styles.french}>{frenchName}</p> : null}
          </div>

          <div className={styles.answer}><DirectAnswer>{resource.quickAnswer}</DirectAnswer></div>

          {image ? (
            <figure className={styles.photo}>
              {/* eslint-disable-next-line @next/next/no-img-element -- external licensed media is contract-gated and responsive. */}
              <img src={image.assetUrl} alt={image.altText ?? ""} width={image.width} height={image.height} />
              <figcaption>{image.caption} {image.attribution}</figcaption>
            </figure>
          ) : (
            /* The standard stated plainly. A wrong wildlife photograph on an
               identification page is a safety failure, so no photograph is the
               correct state — not a gap to be dressed with a placeholder. */
            <p className={styles.mediaNote}>
              <svg className={styles.mediaNoteIcon} width="14" height="14" viewBox="0 0 18 18" aria-hidden="true" fill="none">
                <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.3" />
                <path d="M9 5.4v4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="9" cy="12.4" r="0.85" fill="currentColor" />
              </svg>
              <span>No photograph is published. North Ground publishes wildlife imagery only after exact-species identity, licence and attribution are verified.</span>
            </p>
          )}

          <div className={styles.actions}>
            <Link
              className="ng-action"
              href={hasRegulatoryCoverage ? `/hunt?species=${encodeURIComponent(speciesId)}` : "/hunt"}
            >
              {hasRegulatoryCoverage ? "Open this species in Hunt" : "Check current Hunt coverage"}
            </Link>
            <a className="ng-action-quiet" href="#sources">Inspect sources</a>
          </div>
        </header>

        <div className={styles.body}>
          {identification.length ? (
            <section className={styles.section} aria-labelledby="identification">
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle} id="identification">Identification</h2>
              </div>
              <div className={`${styles.panel} ng-glass-card`}>
                <div className={styles.prose}>
                  {identification.map((text) => <p key={text}>{text}</p>)}
                </div>
              </div>
            </section>
          ) : null}

          {resource.keyFacts?.length ? (
            <section className={styles.section} aria-labelledby="key-facts">
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle} id="key-facts">At a glance</h2>
              </div>
              <div className={styles.facts}><KeyFacts facts={resource.keyFacts} /></div>
            </section>
          ) : null}

          {relatedSpecies.length ? (
            <section className={styles.section} aria-labelledby="lookalikes">
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle} id="lookalikes">Similar species</h2>
                <p className="ng-meta">Confusable in the field — confirm before you act.</p>
              </div>
              <ul className={styles.lookalikes}>
                {relatedSpecies.map((other) => (
                  <li key={other.id} className={`${styles.lookalike} ng-glass-card`}>
                    <Link className={styles.lookalikeLink} href={other.canonicalUrl ?? `/hunting/species/${other.slug}`}>
                      <span className={styles.lookalikeText}>
                        <span className={styles.lookalikeName}>{other.title}</span>
                        <span className={styles.lookalikeScientific}>{other.speciesProfile.scientificName}</span>
                      </span>
                      <svg className={styles.lookalikeArrow} width="15" height="15" viewBox="0 0 18 18" aria-hidden="true" fill="none">
                        <path d="M6.8 3.8 12 9l-5.2 5.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {habitat.length ? (
            <section className={styles.section} aria-labelledby="habitat">
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle} id="habitat">Habitat and seasonal behaviour</h2>
              </div>
              <div className={`${styles.panel} ng-glass-card`}>
                <div className={styles.prose}>
                  {habitat.map((text) => <p key={text}>{text}</p>)}
                </div>
              </div>
            </section>
          ) : null}

          {sexAge ? (
            <section className={styles.section} aria-labelledby="sex-age">
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle} id="sex-age">Sex and age</h2>
              </div>
              <div className={`${styles.panel} ng-glass-card`}>
                <div className={styles.prose}>
                  {sexAge.sexDifferences?.map((section) => <p key={section.text}>{section.text}</p>)}
                  {sexAge.ageDifferences?.map((section) => <p key={section.text}>{section.text}</p>)}
                  {sexAge.terminology.length ? (
                    <p>Hunter terminology: {sexAge.terminology.map(({ value }) => value).join(", ")}.</p>
                  ) : null}
                  {/* Biological identification and regulatory animal class are
                      different things; a doe is not automatically antlerless in
                      the sense a season table means it. */}
                  <p>Biological sex and age are not substitutes for a jurisdiction&apos;s regulatory animal-class definition.</p>
                </div>
              </div>
            </section>
          ) : null}

          {blocks.blocks.length ? (
            <section className={styles.section} aria-labelledby="field-notes">
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle} id="field-notes">North Ground field notes</h2>
              </div>
              <div className={styles.blocks}><AppBlockList result={blocks} /></div>
            </section>
          ) : null}

          {sources.length ? (
            <section className={styles.section} id="sources" aria-labelledby="source-heading">
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle} id="source-heading">Biological sources</h2>
              </div>
              <div className={`${styles.panel} ng-glass-card`}>
                {/* Named for what they are. A wildlife reference is not the legal
                    hunting authority, and must never be presented as one. */}
                <p className={styles.sourceNote}>
                  Identification and habitat reviewed {resource.lastReviewed}. These are biological
                  and taxonomic references, not hunting-regulation authorities — regulatory sources
                  are cited in Hunt alongside the rule they support.
                </p>
                <div className={styles.sources}><SourceList sources={sources} /></div>
              </div>
            </section>
          ) : null}

          {related.length ? (
            <section className={styles.section} aria-labelledby="related">
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle} id="related">Related North Ground resources</h2>
              </div>
              <div className={styles.related}><RelatedResources resources={related} /></div>
            </section>
          ) : null}

          <section className={`${styles.handoff} ng-glass-card`} aria-labelledby="next">
            <h2 className="ng-visually-hidden" id="next">Check this species in Hunt</h2>
            <p className={styles.handoffText}>
              This page describes the animal. Whether a season is open where you are
              hunting, on the date you are hunting, is a separate question.
            </p>
            <Link className="ng-action" href="/hunt">Check a location and date in Hunt</Link>
          </section>
        </div>

        <footer className={styles.footer}>
          <p>
            Species knowledge and hunting regulations are maintained separately. North Ground
            organises official information and does not replace the legislation, regulations or
            instructions of the responsible authority.
          </p>
          <p>
            <Link href="/hunting/species">Species library</Link>
            {" · "}
            <Link href="/hunt">North Ground Hunt</Link>
            {" · "}
            <Link href="/">North Ground</Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
