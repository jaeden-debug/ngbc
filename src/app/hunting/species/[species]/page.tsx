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
import SpeciesPrimaryImage, { SpeciesImagePlaceholder, SpeciesPhotoCredit } from "../../../../components/species/SpeciesPrimaryImage";
import StructuredData from "../../../../components/StructuredData";
import type { SpeciesResource } from "../../../../lib/content-contract/types";
import { contentRepository } from "../../../../lib/content/repository";
import { speciesProfileHref } from "../../../../lib/content/species-route";
import { TAKE_MODE_LABELS, jurisdictionDisplayName, takeListingsFor } from "../../../../lib/content/species-take-evidence";
import { regulatoryJurisdictionsForSpecies } from "../../../../lib/hunt/north-america/report";
import { OPEN_GRAPH_BASE } from "../../../../lib/seo/open-graph";
import { cachedSpeciesPrimaryMedia } from "../../../../lib/species-media/social";
import { speciesMetadataCopy } from "../../../../lib/seo/species-metadata";
import { speciesArticleJsonLd } from "../../../../lib/seo/structured-data";
import { absoluteUrl } from "../../../../lib/site";
import SpeciesAuthorityPage from "../../../../components/species-authority/SpeciesAuthorityPage";
import { speciesAuthorityPageFor } from "../../../../lib/species-authority/repository";
import styles from "./page.module.css";

type Props = { params: Promise<{ species: string }> };

async function getSpeciesResource(slug: string): Promise<SpeciesResource | null> {
  const resource = await contentRepository.getResourceBySlug(slug, { locale: "en-CA" });
  /* A profile without its own canonical URL is not rendered under a guessed one:
     the canonical, breadcrumb and Article identity all come from it. */
  return resource?.type === "species" && resource.status === "published" && speciesProfileHref(resource) ? resource : null;
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
export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const resources = await contentRepository.getPublishedResources({ locale: "en-CA" });
  return resources.filter((resource) => resource.type === "species").map((resource) => ({ species: resource.slug }));
}

const TAKE_EVIDENCE_READ = "2026-09-30";

/* Said in words for each eligibility class (CLAUDE.md §16: conservation status,
   take eligibility and legality are three questions). Only regulatory evidence
   says whether a species may be taken here and now; these say which question
   this page is answering. */
const TAKE_HEADINGS = {
  HUNTABLE: "Where it is listed for legal take",
  LIMITED_TAKE: "Limited legal take",
  NUISANCE_OR_INVASIVE_TAKE: "Where it is listed for removal or nuisance take",
  NON_QUARRY: "Not a quarry species",
  UNKNOWN: "Take status not established",
} as const;
const TAKE_LEADS = {
  HUNTABLE: "These authorities list this species for legal take in their own regulations.",
  LIMITED_TAKE: "Legal take of this species exists only under narrow conditions — a quota, a draw, a permit or a small area — set by the authorities below. Nowhere else is a legal opportunity implied, and Hunt shows one only where a certified rule establishes it.",
  NUISANCE_OR_INVASIVE_TAKE: "These authorities list this species as nuisance, invasive or unprotected wildlife that may be taken. This is not a game season.",
  NON_QUARRY: "North Ground does not treat this species as quarry: it is published so it can be told apart from the game species it resembles, and Hunt never offers it. If you are not certain what it is, do not shoot.",
  UNKNOWN: "North Ground has not established meaningful legal take of this species. That is a gap in the evidence, not a finding that it is protected or that it is open.",
} as const;
const CONSERVATION_WORDS = {
  ENDANGERED: "Endangered",
  THREATENED: "Threatened",
  SPECIAL_CONCERN: "Special concern",
  PROTECTED: "Protected",
  CLOSED_TO_TAKE: "Closed to take",
} as const;

/** Search, social and structured-data copy all say the same thing. */
function speciesCopy(resource: SpeciesResource, groups: readonly { id: string }[]) {
  const speciesId = resource.speciesProfile.speciesId;
  return speciesMetadataCopy({
    name: resource.title,
    takeEligibility: resource.speciesProfile.takeEligibility,
    groupIds: groups.map((group) => group.id),
    regulatoryJurisdictions: regulatoryJurisdictionsForSpecies(speciesId),
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { species } = await params;
  const resource = await getSpeciesResource(species);
  if (!resource) return {};
  const [groups, media] = await Promise.all([
    contentRepository.getSpeciesGroups(resource.speciesProfile.speciesId),
    cachedSpeciesPrimaryMedia(resource.speciesProfile.speciesId),
  ]);
  const copy = speciesCopy(resource, groups);
  const authorityPage = speciesAuthorityPageFor(resource.speciesProfile.speciesId);
  const authorityCopy = authorityPage ? {
    title: "White-tailed Deer: Identification, Habitat & Hunting Guide",
    description: "Identify white-tailed deer, read habitat and sign, plan an ethical hunt, understand shot placement, and open current rules and Species Heat in North Ground Hunt.",
    ogTitle: "White-tailed Deer Field & Hunting Guide | North Ground",
    ogDescription: "A sourced, answer-first white-tail reference: identification, habitat, sign, hunting, ethical shot placement, rules and map intelligence.",
  } : null;
  /* The species' own card; its alt text is the verified photo's, where there is one. */
  const image = {
    url: `/og/species/${resource.slug}`,
    width: 1200,
    height: 630,
    alt: media?.altText ?? copy.ogTitle,
  };
  return {
    title: authorityCopy?.title ?? copy.title,
    description: authorityCopy?.description ?? copy.description,
    alternates: { canonical: resource.canonicalUrl },
    openGraph: {
      ...OPEN_GRAPH_BASE,
      type: "article",
      url: resource.canonicalUrl,
      title: authorityCopy?.ogTitle ?? copy.ogTitle,
      description: authorityCopy?.ogDescription ?? copy.ogDescription,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: authorityCopy?.ogTitle ?? copy.ogTitle,
      description: authorityCopy?.ogDescription ?? copy.ogDescription,
      images: [image],
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
    blockTypes: ["safety_note", "habitat_tip", "identification_warning", "seasonal_behavior", "legal_note"],
    date: resource.lastReviewed,
  });
  const [related, relatedSpecies, image, blocks, groups] = await Promise.all([
    contentRepository.getRelatedResources(resource.id, { locale: resource.locale, limit: 5 }),
    contentRepository.getRelatedSpecies(speciesId),
    cachedSpeciesPrimaryMedia(speciesId),
    blocksPromise,
    contentRepository.getSpeciesGroups(speciesId),
  ]);
  const sourceIds = new Set(resource.sourceIds ?? []);
  for (const sourceId of resource.speciesProfile.sourceIds) sourceIds.add(sourceId);
  for (const { block } of blocks.blocks) {
    for (const sourceId of block.sourceIds ?? []) sourceIds.add(sourceId);
  }
  /* Authority pages are kept apart from the biological references: a wildlife
     reference is not a regulator, and a regulator is not a field guide. */
  const takeListings = takeListingsFor(speciesId);
  const [sources, takeSources] = await Promise.all([
    contentRepository.getSources([...sourceIds]),
    contentRepository.getSources([...new Set([
      ...takeListings.flatMap(({ sourceIds: ids }) => ids),
      ...(resource.speciesProfile.conservationStatus ?? []).flatMap(({ sourceIds: ids }) => ids),
    ])]),
  ]);
  const takeSourceById = new Map(takeSources.map((source) => [source.id, source]));

  const category = groups[0]?.names.find(({ locale }) => locale === "en-CA")?.value ?? null;
  const frenchName = resource.speciesProfile.commonNames.find(({ locale }) => locale.startsWith("fr"))?.value ?? null;
  /* Whether North Ground holds certified rules — deliberately separate from what
     those rules say, which only Hunt can answer for a location and date. */
  const regulatoryJurisdictions = regulatoryJurisdictionsForSpecies(speciesId);
  const hasRegulatoryCoverage = regulatoryJurisdictions.length > 0;

  const authorityPage = speciesAuthorityPageFor(speciesId);
  if (authorityPage) {
    return <SpeciesAuthorityPage page={authorityPage} resource={resource} image={image} regulatoryJurisdictions={regulatoryJurisdictions} />;
  }

  const profile = resource.speciesProfile;
  const habitat = [
    ...(profile.habitat ?? []).map((section) => section.text),
    ...(profile.rangeSummary ?? []).map((section) => `${section.value} Range describes possible occurrence, not huntability or exact local presence.`),
    ...(profile.seasonalBehavior ?? []).map((section) => section.text),
    ...(profile.behavior ?? []).map((section) => section.text),
  ];
  const identification = [
    ...profile.identification.map((section) => section.text),
    ...(profile.signsAndTracks ?? []).map((section) => section.text),
  ];
  const sexAge = profile.sexAgeInfo;
  const canonicalUrl = speciesProfileHref(resource)!;

  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Hunting", path: "/hunting" },
    { name: "Species library", path: "/hunting/species" },
    { name: resource.title, path: canonicalUrl },
  ];

  return (
    <main className="ng-product-page">
      <StructuredData data={speciesArticleJsonLd(resource, absoluteUrl(canonicalUrl), {
        description: speciesCopy(resource, groups).description,
        // Only a photograph served from our own host is declared as the page's image.
        imageUrl: image?.source === "MANUAL" ? absoluteUrl(image.renditions.profile.url) : null,
      })} />
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
              <SpeciesPrimaryImage media={image} variant="profile" loading="eager" />
              <figcaption>
                {image.credit
                  ? <>{image.caption ? <>{image.caption} </> : null}<SpeciesPhotoCredit media={image} /></>
                  : <>{image.caption} {image.creator} · {image.licence}</>}
              </figcaption>
            </figure>
          ) : (
            <div className={styles.mediaFallback}>
              <SpeciesImagePlaceholder className={styles.profilePlaceholder} label={resource.title} />
              <p className={styles.mediaNote}>No photograph is set. North Ground shows a photograph only once it is identified as this exact species; a similar-looking animal is never used in its place.</p>
            </div>
          )}

          <div className={styles.actions}>
            <Link
              className="ng-action"
              href={hasRegulatoryCoverage ? `/hunt?species=${encodeURIComponent(speciesId.slice("species:".length))}` : "/hunt"}
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
                {relatedSpecies.map((other) => {
                  const href = speciesProfileHref(other);
                  const text = (
                    <span className={styles.lookalikeText}>
                      <span className={styles.lookalikeName}>{other.title}</span>
                      <span className={styles.lookalikeScientific}>{other.speciesProfile.scientificName}</span>
                    </span>
                  );
                  return (
                    <li key={other.id} className={`${styles.lookalike} ng-glass-card`}>
                      {/* No linkable profile, no link: the name is still worth showing. */}
                      {href ? (
                        <Link className={styles.lookalikeLink} href={href}>
                          {text}
                          <svg className={styles.lookalikeArrow} width="15" height="15" viewBox="0 0 18 18" aria-hidden="true" fill="none">
                            <path d="M6.8 3.8 12 9l-5.2 5.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </Link>
                      ) : <div className={styles.lookalikeLink}>{text}</div>}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {habitat.length ? (
            <section className={styles.section} aria-labelledby="habitat">
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle} id="habitat">Habitat and behaviour</h2>
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

          <section className={styles.section} aria-labelledby="take">
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle} id="take">{TAKE_HEADINGS[profile.takeEligibility]}</h2>
            </div>
            <div className={`${styles.panel} ng-glass-card`}>
              <div className={styles.prose}>
                <p>{TAKE_LEADS[profile.takeEligibility]}</p>
                {profile.conservationStatus?.length ? (
                  <>
                    <h3 className={styles.takeSubhead}>Conservation and protection</h3>
                    <ul className={styles.takeList}>
                      {profile.conservationStatus.map((statement) => (
                        <li key={`${statement.status}-${statement.jurisdictionIds.join()}`}>
                          <strong>{CONSERVATION_WORDS[statement.status]}</strong>
                          {" — "}{statement.jurisdictionIds.map((id) => jurisdictionDisplayName(id) ?? id).join(", ")}: {statement.text}
                          {statement.sourceIds.map((id) => takeSourceById.get(id)).filter((source) => source?.url).map((source) => (
                            <span key={source!.id}>{" · "}<a href={source!.url} rel="noopener">{source!.title}</a></span>
                          ))}
                        </li>
                      ))}
                    </ul>
                    {takeListings.length ? <h3 className={styles.takeSubhead}>Where legal take is listed</h3> : null}
                  </>
                ) : null}
                {takeListings.length ? (
                  <>
                    <ul className={styles.takeList}>
                      {takeListings.map((listing) => (
                        <li key={listing.jurisdictionId}>
                          <strong>{listing.jurisdictionName}</strong>
                          {" — "}{listing.takeModes.map((mode) => TAKE_MODE_LABELS[mode]).join(", ")}
                          {listing.conditions?.map((condition) => <span key={condition} className={styles.takeCondition}>{" "}<span aria-hidden="true">!</span> {condition}</span>)}
                          {listing.sourceIds.map((id) => takeSourceById.get(id)).filter((source) => source?.url).map((source) => (
                            <span key={source!.id}>{" · "}<a href={source!.url} rel="noopener">{source!.title}</a></span>
                          ))}
                        </li>
                      ))}
                    </ul>
                    {/* A listing is not a season. Said every time, because the
                        list above is exactly what a hunter would misread. */}
                    <p className={styles.sourceNote}>
                      Being listed is not an open season. Seasons, zones, licences, methods and limits decide whether
                      this animal may be taken on a given day and place — check Hunt or the authority before you go.
                      {" "}Listings read {TAKE_EVIDENCE_READ}.
                    </p>
                  </>
                ) : null}
              </div>
            </div>
          </section>

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
