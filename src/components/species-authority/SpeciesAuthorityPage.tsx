import Link from "next/link";
import Breadcrumbs from "../Breadcrumbs";
import HuntNav from "../hunt/HuntNav";
import SpeciesPrimaryImage, { SpeciesPhotoCredit } from "../species/SpeciesPrimaryImage";
import StructuredData from "../StructuredData";
import type { SpeciesResource } from "../../lib/content-contract/types";
import type { SpeciesPrimaryMedia } from "../../lib/species-media/types";
import type { AuthorityClaim, AuthoritySection, AuthorityShotExplorer, AuthorityVisualExplorer, AuthorityVisualRendition, AuthoritySectionId, SpeciesAuthorityPage as PageData
} from "../../lib/species-authority/types";
import { absoluteUrl } from "../../lib/site";
import { speciesArticleJsonLd, speciesFaqJsonLd } from "../../lib/seo/structured-data";
import AuthorityNavigator from "./AuthorityNavigator";
import ShareSectionButton from "./ShareSectionButton";
import { SpeciesShotPlacementExplorer, SpeciesVisualExplorer } from "./SpeciesVisualExplorers";
import { TAKE_MODE_LABELS } from "../../lib/content/species-take-evidence";
import { LISTING_IS_NOT_A_SEASON, TAKE_EVIDENCE_READ } from "../../lib/content/species-take-words";
import styles from "./SpeciesAuthorityPage.module.css";

const LAYER_LABEL = {
  BIOLOGY: "Biology",
  FIELD_KNOWLEDGE: "Field knowledge",
  HUNTING_INTELLIGENCE: "Hunting intelligence",
  GEOSPATIAL_INTELLIGENCE: "Geospatial intelligence",
  REGULATORY_HANDOFF: "Regulatory handoff",
} as const;

function Claims({ claims, sourceNumbers }: { claims: AuthorityClaim[]; sourceNumbers: Map<string, number> }) {
  if (!claims.length) return null;
  return <div className={styles.claims}>{claims.map((claim) => (
    <p key={claim.id}>{claim.text}{" "}<span className={styles.citations}>{claim.citations.map(({ sourceId, locator }) => (
      <a key={`${sourceId}-${locator ?? ""}`} href={`#${sourceId.replace("source:", "source-")}`} aria-label={`Source ${sourceNumbers.get(sourceId)}${locator ? `, ${locator}` : ""}`}>[{sourceNumbers.get(sourceId)}]</a>
    ))}</span></p>
  ))}</div>;
}

/**
 * The question the "rules stay separate" card asks.
 *
 * DERIVED from §16 take eligibility rather than authored, because the honest
 * question differs by eligibility and a single hard-coded "Can I hunt this
 * deer?" was being asked of every species the renderer served. A non-quarry
 * animal is not asked whether it may be hunted; it is told that it is not
 * quarry, which is a different sentence and a different fact.
 */
const HUNT_QUESTION: Record<PageData["huntingCompatibility"], string> = {
  HUNTABLE: "Can I hunt this species here?",
  LIMITED_TAKE: "Is there a legal opportunity here?",
  NUISANCE_OR_INVASIVE_TAKE: "Is removal permitted here?",
  NON_QUARRY: "Why is this species here?",
  UNKNOWN: "What is established here?",
};

/**
 * What the "rules stay separate" card says beneath its question. The
 * NON_QUARRY line never invites a hunt, because inviting one is the failure
 * §16 names.
 */
const HUNT_ANSWER: Record<PageData["huntingCompatibility"], string> = {
  HUNTABLE: "Answer with a location and date. Species biology, habitat and map shading never make a hunt legal.",
  LIMITED_TAKE: "Legal take exists only under narrow conditions. Answer with a location and date; nothing on this page establishes an opportunity.",
  NUISANCE_OR_INVASIVE_TAKE: "Removal is not a game season. Answer with a location and date before acting on anything here.",
  NON_QUARRY: "North Ground does not treat this species as quarry. It is published so it can be told apart from the game species it resembles, and Hunt never offers it.",
  UNKNOWN: "North Ground has not established meaningful legal take of this species. That is a gap in the evidence, not a finding that it is protected or that it is open.",
};

function StandardSection({ section, sourceNumbers, explorer, renditions, speciesName }: { section: AuthoritySection; sourceNumbers: Map<string, number>; explorer?: AuthorityVisualExplorer | AuthorityShotExplorer; renditions: Record<string, AuthorityVisualRendition>; speciesName: string }) {
  const numberRecord = Object.fromEntries(sourceNumbers);
  return (
    <section id={section.id} className={styles.section} aria-labelledby={`${section.id}-heading`}>
      <header className={styles.sectionHead}>
        <div><span className={styles.layer}>{LAYER_LABEL[section.layer]}</span><h2 id={`${section.id}-heading`}>{section.title}</h2></div>
        <ShareSectionButton id={section.id} title={section.title} speciesName={speciesName} />
      </header>
      <p className={styles.directAnswer}>{section.directAnswer}{section.directAnswerCitations?.length ? <> <span className={styles.citations}>{section.directAnswerCitations.map(({ sourceId }) => <a key={sourceId} href={`#${sourceId.replace("source:", "source-")}`}>[{sourceNumbers.get(sourceId)}]</a>)}</span></> : null}</p>
      <Claims claims={section.claims} sourceNumbers={sourceNumbers} />
      {explorer ? (section.id === "shot-placement"
        ? <SpeciesShotPlacementExplorer explorer={explorer as AuthorityShotExplorer} renditions={renditions} sourceNumbers={numberRecord} />
        : <SpeciesVisualExplorer explorer={explorer} renditions={renditions} sourceNumbers={numberRecord} />) : null}
      {section.subsections?.map((subsection) => (
        <div className={styles.subsection} id={subsection.id} key={subsection.id}>
          <h3>{subsection.title}</h3>
          <p className={styles.subAnswer}>{subsection.directAnswer}</p>
          <Claims claims={subsection.claims} sourceNumbers={sourceNumbers} />
          {subsection.caution ? <p className={styles.caution}><strong>Field caution:</strong> {subsection.caution}</p> : null}
          {subsection.compareLink ? <Link className={styles.inlineLink} href={subsection.compareLink.href}>{subsection.compareLink.label} <span aria-hidden="true">→</span></Link> : null}
        </div>
      ))}
    </section>
  );
}

/** The block type a field note is, in words. §24's own vocabulary. */
const NOTE_LABEL: Record<string, string> = {
  safety_note: "Safety", habitat_tip: "Habitat", identification_warning: "Identification",
  seasonal_behavior: "Seasonal", legal_note: "Legal",
};

export default function SpeciesAuthorityPage({ page, resource, image, regulatoryJurisdictions }: {
  page: PageData;
  resource: SpeciesResource;
  image: SpeciesPrimaryMedia | null;
  regulatoryJurisdictions: readonly { nameEn: string }[];
}) {
  const sourceNumbers = new Map(page.sources.map((source, index) => [source.id, index + 1]));
  /*
   * The six carried families, read from the contract rather than from props.
   *
   * They were props, which meant one renderer's caller decided whether a
   * species kept its take evidence. They are a PROJECTION of data the species
   * already owns (see `context.ts`), so they default here: a contract-only
   * render — a test, a future API or MCP consumer — must not throw because the
   * projection was not supplied, and a rendered page must not be missing it.
   */
  const {
    takeListings = [], authoritySources = [], conservationStatements = [], lookalikes = [],
    fieldNotes = [], groups = [], relatedResources = [], lastReviewed = null,
  } = page.context ?? ({} as Partial<NonNullable<PageData["context"]>>);
  const authorityById = new Map(authoritySources.map((source) => [source.id, source]));
  /*
   * Field notes sit on the section they qualify, not in one appended list.
   *
   * §41A classifies every sentence by whether a hunter who ignored it could
   * break the law, be unsafe or be turned away, and attaches it to what it
   * qualifies. An identification warning belongs beside identification; a
   * legal note beside the rules. A note whose section this species does not
   * render falls back to the first section rather than being dropped — 334 of
   * 485 species carry notes, and silently losing one is the drop this carry
   * exists to prevent.
   */
  const FIELD_NOTE_SECTION: Record<string, AuthoritySectionId> = {
    identification_warning: "identification", habitat_tip: "habitat",
    seasonal_behavior: "seasonal-pattern", legal_note: "regulations", safety_note: "overview",
  };
  const rendered = new Set(page.sections.map((section) => section.id));
  const fallbackSection = page.sections[0]?.id;
  const notesBySection = new Map<string, typeof fieldNotes>();
  for (const note of fieldNotes) {
    const target = FIELD_NOTE_SECTION[note.type] ?? "overview";
    const id = rendered.has(target) ? target : fallbackSection;
    if (!id) continue;
    notesBySection.set(id, [...(notesBySection.get(id) ?? []), note]);
  }
  /* Authored search copy where a page supplies it; otherwise the page's own
     direct answer, which is already a one-sentence summary of this species. */
  const description = page.seo?.description ?? page.identity.directAnswer;
  const breadcrumbs = [
    { name: "Home", path: "/" }, { name: "Hunting", path: "/hunting" },
    { name: "Species library", path: "/hunting/species" }, { name: page.identity.commonName, path: page.canonicalPath },
  ];
  /* Navigation is built from sections that EXIST. The `!` here would throw if
     an ordered id had no section — the validator refuses that, but a renderer
     should not crash on data it can simply not link to. §11: no dead anchors. */
  const navItems = page.sectionOrder
    .map((id) => ({ id, section: page.sections.find((section) => section.id === id) }))
    .filter((entry): entry is { id: typeof entry.id; section: NonNullable<typeof entry.section> } => entry.section !== undefined)
    .map(({ id, section }) => ({ id, label: section.shortTitle }));
  const renditions = Object.fromEntries(page.visualAssets.flatMap((asset) => asset.renditions ?? []).map((rendition) => [rendition.id, rendition]));
  /* Only the explorers the page declares; most species declare none. */
  const explorersBySection = Object.fromEntries(Object.values(page.visualExplorers ?? {}).filter((explorer) => explorer !== undefined).map((explorer) => [explorer.sectionId, explorer]));

  return (
    <main className="ng-product-page">
      <StructuredData data={speciesArticleJsonLd(resource, absoluteUrl(page.canonicalPath), { description, imageUrl: image?.source === "MANUAL" ? absoluteUrl(image.renditions.profile.url) : null })} />
      {/* FAQ schema ONLY where the page renders an FAQ. This was emitted
          unconditionally, and a FAQPage with an empty mainEntity is invalid
          structured data — §14 of the goal and §29's "never create schema
          claims unsupported by page content". It was invisible while one page
          existed and every page had questions; an adapter-built page has none,
          so it would have published an empty FAQPage on every species. */}
      {page.faq.length ? <StructuredData data={speciesFaqJsonLd(page.faq, absoluteUrl(page.canonicalPath))} /> : null}
      <HuntNav current="/hunting/species" />
      <div className={`ng-shell ${styles.shell}`}>
        <Breadcrumbs items={breadcrumbs} />
        {/*
          IMAGE-OPTIONAL BY COMPOSITION, not by substitution.

          216 of 485 species have no verified photograph, so the absent state is
          the common one. It used to render a 280px bordered box with a photo
          icon and the caption "No verified primary photograph is set" — an
          empty frame and an apology, which is the placeholder state this
          milestone forbids and which would have shipped on nearly half the
          catalogue.

          The figure is simply not rendered. The hero becomes one column and the
          copy takes the width; the quick-facts list below it already supplies
          the structure a photograph would have given. The policy itself — that
          North Ground shows a photograph only once it is identified as this
          exact species, and never substitutes a lookalike — is a real §16 rule,
          but it belongs where media provenance is discussed, not as a caption
          on a box that is not there.
        */}
        <header className={styles.hero} data-media={image ? "photo" : "none"}>
          <div className={styles.heroCopy}>
            <div className={styles.heroMeta}>{page.status === "REFERENCE_IMPLEMENTATION" ? <span className={styles.reference}>Reference implementation</span> : null}<span>Species authority page</span></div>
            <h1>{page.identity.commonName}</h1>
            {/* Built from the parts that EXIST. Rendering the French name
                unconditionally left " ·  · Family" on every species without
                one, and §47 forbids inventing a localized name to fill it. */}
            <p className={styles.scientific}>
              <i>{page.identity.scientificName}</i>
              {[page.identity.frenchName, page.identity.family, ...groups.map(({ name }) => name)].filter(Boolean).map((part) => <span key={part}> · {part}</span>)}
            </p>
            <p className={styles.heroAnswer}>{page.identity.directAnswer}</p>
            <div className={styles.heroActions}>
              <Link className="ng-action" href={page.huntLinks.legality}>Check rules for a place and date</Link>
              {/* The species map, only where §41B allows this species one. A
                  NON_QUARRY or LIMITED_TAKE page offering "open the map" is a
                  hunter-facing where-to-look surface for an animal that may
                  not have one. */}
              {page.huntLinks.map ? <Link className="ng-action-quiet" href={page.huntLinks.map}>Open the {page.identity.commonName.toLowerCase()} map</Link> : null}
            </div>
            <p className={styles.coverage}>Certified rules currently represented in Hunt: {regulatoryJurisdictions.length ? regulatoryJurisdictions.map(({ nameEn }) => nameEn).join(", ") : "coverage in development"}. This is coverage, not a legal answer.</p>
          </div>
          {image ? (
            <figure className={styles.heroMedia}>
              <SpeciesPrimaryImage media={image} variant="profile" loading="eager" />
              {/* Provider images keep their visible credit, which §16 makes a
                  condition of showing them at all. */}
              <figcaption>{image.caption ? `${image.caption} ` : null}<SpeciesPhotoCredit media={image} />{!image.credit ? `${image.creator} · ${image.licence}` : null}</figcaption>
            </figure>
          ) : null}
        </header>

        <dl className={styles.facts}>{page.facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
        <AuthorityNavigator items={navItems} />

        <div className={styles.layout}>
          <article className={styles.article}>
            {page.sections.map((section) => {
              if (section.id === "faq") return (
                <section id="faq" className={styles.section} aria-labelledby="faq-heading" key={section.id}>
                  <header className={styles.sectionHead}><div><span className={styles.layer}>{LAYER_LABEL[section.layer]}</span><h2 id="faq-heading">{section.title}</h2></div><ShareSectionButton id="faq" title={section.title} speciesName={page.identity.commonName} /></header>
                  <p className={styles.directAnswer}>{section.directAnswer}{section.directAnswerCitations?.length ? <> <span className={styles.citations}>{section.directAnswerCitations.map(({ sourceId }) => <a key={sourceId} href={`#${sourceId.replace("source:", "source-")}`}>[{sourceNumbers.get(sourceId)}]</a>)}</span></> : null}</p>
                  <div className={styles.faq}>{page.faq.map((item) => <details id={item.id} key={item.id}><summary>{item.question}</summary><p>{item.directAnswer} <span className={styles.citations}>{item.citations.map(({ sourceId }) => <a key={sourceId} href={`#${sourceId.replace("source:", "source-")}`}>[{sourceNumbers.get(sourceId)}]</a>)}</span></p></details>)}</div>
                </section>
              );
              if (section.id === "sources") return (
                <section id="sources" className={styles.section} aria-labelledby="sources-heading" key={section.id}>
                  <header className={styles.sectionHead}><div><span className={styles.layer}>{LAYER_LABEL[section.layer]}</span><h2 id="sources-heading">{section.title}</h2></div><ShareSectionButton id="sources" title={section.title} speciesName={page.identity.commonName} /></header>
                  <p className={styles.directAnswer}>{section.directAnswer}{section.directAnswerCitations?.length ? <> <span className={styles.citations}>{section.directAnswerCitations.map(({ sourceId }) => <a key={sourceId} href={`#${sourceId.replace("source:", "source-")}`}>[{sourceNumbers.get(sourceId)}]</a>)}</span></> : null}</p>
                  <ol className={styles.sources}>{page.sources.map((source) => <li id={source.id.replace("source:", "source-")} key={source.id}><div><span className={styles.sourceKind}>{source.kind.replaceAll("_", " ")}</span><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></div><p>{source.publisher} · reviewed {source.reviewedAt}</p><p>{source.note}</p></li>)}</ol>
                  {page.visualAssets.length ? <div className={styles.assetManifest}><h3>Visual asset manifest</h3><p>Original educational artwork is listed with its intrinsic dimensions and publication decision. Optimized WebP derivatives are used in the explorers; the supplied originals remain unchanged.</p><ul>{page.visualAssets.map((asset) => <li key={asset.id}><strong>{asset.purpose}</strong><span data-status={asset.status}>{asset.status.replaceAll("_", " ")}</span><p>{asset.width} × {asset.height} · {asset.role} · {asset.requirement}</p><code>{asset.originalPath}</code></li>)}</ul></div> : null}
                </section>
              );
              return (
                <div key={section.id}>
                  <StandardSection section={section} sourceNumbers={sourceNumbers} explorer={explorersBySection[section.id]} renditions={renditions} speciesName={page.identity.commonName} />
                  {/* Identification safety: the species this one is confused
                      with, attached to the section that identifies it. */}
                  {section.id === "identification" && lookalikes.length ? (
                    <div className={styles.subsection} id="similar-species">
                      <h3>Species it is confused with</h3>
                      <p className={styles.subAnswer}>Check these before deciding what you are looking at. If you are not certain what it is, do not shoot.</p>
                      <ul>{lookalikes.map((other) => (
                        /* No linkable profile, no link: an unpublished
                           lookalike is still a species to rule out. */
                        <li key={other.speciesId}>{other.href ? <Link className={styles.inlineLink} href={other.href}>{other.title}</Link> : other.title}{other.scientificName ? <> · <i>{other.scientificName}</i></> : null}</li>
                      ))}</ul>
                    </div>
                  ) : null}
                  {/* The species' own field notes for this section: North
                      Ground knowledge (§6 layer C), labelled as what it is and
                      carrying its own sources. Visible, never collapsed —
                      §41A forbids progressive disclosure for anything a hunter
                      could be unsafe for having missed. */}
                  {notesBySection.get(section.id)?.length ? (
                    <div className={styles.subsection} id={`field-notes-${section.id}`}>
                      <h3>Field notes</h3>
                      <ul>{notesBySection.get(section.id)!.map((note) => (
                        <li key={note.id}>
                          <strong>{NOTE_LABEL[note.type] ?? note.type.replaceAll("_", " ")}</strong> {note.content.plainText}
                          {note.sourceIds?.length ? <span className={styles.citations}>{note.sourceIds.filter((sourceId) => sourceNumbers.has(sourceId)).map((sourceId) => <a key={sourceId} href={`#${sourceId.replace("source:", "source-")}`}>[{sourceNumbers.get(sourceId)}]</a>)}</span> : null}
                        </li>
                      ))}</ul>
                    </div>
                  ) : null}
                  {/* §16's conservation layer: the authority's own statement,
                      kept as recorded, with its authority linked. A listing or
                      a protection is not a season either way, which is why
                      this sits beside the take evidence and not instead of
                      it. */}
                  {section.id === "regulations" && conservationStatements.length ? (
                    <div className={styles.subsection} id="conservation-and-protection">
                      <h3>Conservation and protection</h3>
                      <ul>{conservationStatements.map((statement) => (
                        <li key={statement.text}>
                          {statement.status ? <strong>{statement.status}</strong> : null}{statement.status ? " — " : null}{statement.text}
                          {statement.sourceIds.map((id) => authorityById.get(id)).filter((source) => source !== undefined).map((source) => (
                            <span key={source.id}>{" · "}<a href={source.url} rel="noopener noreferrer" target="_blank">{source.title}</a></span>
                          ))}
                        </li>
                      ))}</ul>
                    </div>
                  ) : null}
                  {/* §16's regulatory evidence, read from the take-evidence
                      bundle rather than copied into the page contract. */}
                  {section.id === "regulations" && takeListings.length ? (
                    <div className={styles.subsection} id="where-it-is-listed">
                      <h3>Where legal take is listed</h3>
                      <ul>{takeListings.map((listing) => (
                        <li key={listing.jurisdictionId}>
                          <strong>{listing.jurisdictionName}</strong>
                          {listing.takeModes.length ? <> — {listing.takeModes.map((mode) => (TAKE_MODE_LABELS as Record<string, string>)[mode] ?? mode).join(", ")}</> : null}
                          {listing.conditions?.map((condition) => <span key={condition}> <span aria-hidden="true">!</span> {condition}</span>)}
                          {/* The authority behind the listing, linked. §7: the
                              original authoritative source stays one click
                              away from the claim that it exists. */}
                          {listing.sourceIds.map((id) => authorityById.get(id)).filter((source) => source !== undefined).map((source) => (
                            <span key={source.id}>{" · "}<a href={source.url} rel="noopener noreferrer" target="_blank">{source.title}</a></span>
                          ))}
                        </li>
                      ))}</ul>
                      {/* Said every time the list is shown, because the list is
                          exactly what a hunter would misread. */}
                      <p className={styles.subAnswer}>{LISTING_IS_NOT_A_SEASON} Listings read {TAKE_EVIDENCE_READ}.</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </article>

          <aside className={styles.aside} aria-label={`${page.identity.commonName} actions`}>
            <div className="ng-glass-card"><span className={styles.layer}>Rules stay separate</span><h2>{HUNT_QUESTION[page.huntingCompatibility]}</h2><p>{HUNT_ANSWER[page.huntingCompatibility]}</p><Link className="ng-action" href={page.huntLinks.legality}>Check in Hunt</Link></div>
            {/* Related North Ground resources — 485 of 485 species have them,
                and the legacy page linked them. Dropping them would have cut
                every species' only path into the deeper guides. */}
            {relatedResources.length ? (
              <div className="ng-glass-card"><span className={styles.layer}>Go deeper</span><h2>North Ground resources</h2>
                <ul className={styles.asideLinks}>{relatedResources.map((item) => (
                  <li key={item.id}>{item.href ? <Link className={styles.inlineLink} href={item.href}>{item.title}</Link> : item.title}</li>
                ))}</ul>
              </div>
            ) : null}
            {page.huntLinks.map ? (
              <div className="ng-glass-card"><span className={styles.layer}>Production-verified surface</span><h2>Where should I investigate?</h2><p>Open the existing range-and-habitat layer, then confirm conditions and fresh sign on the ground.</p><Link className="ng-action-quiet" href={page.huntLinks.map}>Open Species Heat</Link></div>
            ) : null}
          </aside>
        </div>
        {/* Two review dates, said separately where they differ: the page's own
            and the species record's. The legacy page stated the second, and
            collapsing them would date the biology by when the page was
            written. */}
        <footer className={styles.footer}>Reviewed {page.reviewedAt}.{lastReviewed && lastReviewed !== page.reviewedAt ? ` Identification and habitat reviewed ${lastReviewed}.` : ""}{page.status === "REFERENCE_IMPLEMENTATION" ? " This page is North Ground's reference implementation for the species authority format." : ""}</footer>
      </div>
    </main>
  );
}
