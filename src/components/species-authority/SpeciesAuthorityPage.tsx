import Link from "next/link";
import Breadcrumbs from "../Breadcrumbs";
import HuntNav from "../hunt/HuntNav";
import SpeciesPrimaryImage, { SpeciesImagePlaceholder, SpeciesPhotoCredit } from "../species/SpeciesPrimaryImage";
import StructuredData from "../StructuredData";
import type { SpeciesResource } from "../../lib/content-contract/types";
import type { SpeciesPrimaryMedia } from "../../lib/species-media/types";
import type { AuthorityClaim, AuthoritySection, AuthorityShotExplorer, AuthorityVisualExplorer, AuthorityVisualRendition, SpeciesAuthorityPage as PageData } from "../../lib/species-authority/types";
import { absoluteUrl } from "../../lib/site";
import { speciesArticleJsonLd, speciesFaqJsonLd } from "../../lib/seo/structured-data";
import AuthorityNavigator from "./AuthorityNavigator";
import ShareSectionButton from "./ShareSectionButton";
import { SpeciesShotPlacementExplorer, SpeciesVisualExplorer } from "./SpeciesVisualExplorers";
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

function StandardSection({ section, sourceNumbers, explorer, renditions }: { section: AuthoritySection; sourceNumbers: Map<string, number>; explorer?: AuthorityVisualExplorer | AuthorityShotExplorer; renditions: Record<string, AuthorityVisualRendition> }) {
  const numberRecord = Object.fromEntries(sourceNumbers);
  return (
    <section id={section.id} className={styles.section} aria-labelledby={`${section.id}-heading`}>
      <header className={styles.sectionHead}>
        <div><span className={styles.layer}>{LAYER_LABEL[section.layer]}</span><h2 id={`${section.id}-heading`}>{section.title}</h2></div>
        <ShareSectionButton id={section.id} title={section.title} />
      </header>
      <p className={styles.directAnswer}>{section.directAnswer}</p>
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
          {subsection.id === "similar-species" ? <Link className={styles.inlineLink} href="/hunting/species/mule-deer">Compare the Mule deer profile <span aria-hidden="true">→</span></Link> : null}
        </div>
      ))}
    </section>
  );
}

export default function SpeciesAuthorityPage({ page, resource, image, regulatoryJurisdictions }: {
  page: PageData;
  resource: SpeciesResource;
  image: SpeciesPrimaryMedia | null;
  regulatoryJurisdictions: readonly { nameEn: string }[];
}) {
  const sourceNumbers = new Map(page.sources.map((source, index) => [source.id, index + 1]));
  const description = "Identify white-tailed deer, read habitat and sign, plan an ethical hunt, understand shot placement, and open current rules and Species Heat in North Ground Hunt.";
  const breadcrumbs = [
    { name: "Home", path: "/" }, { name: "Hunting", path: "/hunting" },
    { name: "Species library", path: "/hunting/species" }, { name: page.identity.commonName, path: page.canonicalPath },
  ];
  const navItems = page.sectionOrder.map((id) => ({ id, label: page.sections.find((section) => section.id === id)!.shortTitle }));
  const renditions = Object.fromEntries(page.visualAssets.flatMap((asset) => asset.renditions ?? []).map((rendition) => [rendition.id, rendition]));
  const explorersBySection = Object.fromEntries(Object.values(page.visualExplorers).map((explorer) => [explorer.sectionId, explorer]));

  return (
    <main className="ng-product-page">
      <StructuredData data={speciesArticleJsonLd(resource, absoluteUrl(page.canonicalPath), { description, imageUrl: image?.source === "MANUAL" ? absoluteUrl(image.renditions.profile.url) : null })} />
      <StructuredData data={speciesFaqJsonLd(page.faq, absoluteUrl(page.canonicalPath))} />
      <HuntNav current="/hunting/species" />
      <div className={`ng-shell ${styles.shell}`}>
        <Breadcrumbs items={breadcrumbs} />
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.heroMeta}><span className={styles.reference}>Reference implementation</span><span>Species authority page</span></div>
            <h1>{page.identity.commonName}</h1>
            <p className={styles.scientific}><i>{page.identity.scientificName}</i> · {page.identity.frenchName} · {page.identity.family}</p>
            <p className={styles.heroAnswer}>{page.identity.directAnswer}</p>
            <div className={styles.heroActions}>
              <Link className="ng-action" href={page.huntLinks.legality}>Check rules for a place and date</Link>
              <Link className="ng-action-quiet" href={page.huntLinks.map}>Open the white-tail map</Link>
            </div>
            <p className={styles.coverage}>Certified rules currently represented in Hunt: {regulatoryJurisdictions.length ? regulatoryJurisdictions.map(({ nameEn }) => nameEn).join(", ") : "coverage in development"}. This is coverage, not a legal answer.</p>
          </div>
          <figure className={styles.heroMedia}>
            {image ? <SpeciesPrimaryImage media={image} variant="profile" loading="eager" /> : <SpeciesImagePlaceholder className={styles.placeholder} label={page.identity.commonName} />}
            <figcaption>{image ? <>{image.caption ? `${image.caption} ` : null}<SpeciesPhotoCredit media={image} />{!image.credit ? `${image.creator} · ${image.licence}` : null}</> : "No verified primary photograph is set; a lookalike is never substituted."}</figcaption>
          </figure>
        </header>

        <dl className={styles.facts}>{page.facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
        <AuthorityNavigator items={navItems} />

        <div className={styles.layout}>
          <article className={styles.article}>
            {page.sections.map((section) => {
              if (section.id === "faq") return (
                <section id="faq" className={styles.section} aria-labelledby="faq-heading" key={section.id}>
                  <header className={styles.sectionHead}><div><span className={styles.layer}>{LAYER_LABEL[section.layer]}</span><h2 id="faq-heading">{section.title}</h2></div><ShareSectionButton id="faq" title={section.title} /></header>
                  <p className={styles.directAnswer}>{section.directAnswer}</p>
                  <div className={styles.faq}>{page.faq.map((item) => <details id={item.id} key={item.id}><summary>{item.question}</summary><p>{item.directAnswer} <span className={styles.citations}>{item.citations.map(({ sourceId }) => <a key={sourceId} href={`#${sourceId.replace("source:", "source-")}`}>[{sourceNumbers.get(sourceId)}]</a>)}</span></p></details>)}</div>
                </section>
              );
              if (section.id === "sources") return (
                <section id="sources" className={styles.section} aria-labelledby="sources-heading" key={section.id}>
                  <header className={styles.sectionHead}><div><span className={styles.layer}>{LAYER_LABEL[section.layer]}</span><h2 id="sources-heading">{section.title}</h2></div><ShareSectionButton id="sources" title={section.title} /></header>
                  <p className={styles.directAnswer}>{section.directAnswer}</p>
                  <ol className={styles.sources}>{page.sources.map((source) => <li id={source.id.replace("source:", "source-")} key={source.id}><div><span className={styles.sourceKind}>{source.kind.replaceAll("_", " ")}</span><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></div><p>{source.publisher} · reviewed {source.reviewedAt}</p><p>{source.note}</p></li>)}</ol>
                  <div className={styles.assetManifest}><h3>Visual asset manifest</h3><p>Original educational artwork is listed with its intrinsic dimensions and publication decision. Optimized WebP derivatives are used in the explorers; the supplied originals remain unchanged.</p><ul>{page.visualAssets.map((asset) => <li key={asset.id}><strong>{asset.purpose}</strong><span data-status={asset.status}>{asset.status.replaceAll("_", " ")}</span><p>{asset.width} × {asset.height} · {asset.role} · {asset.requirement}</p><code>{asset.originalPath}</code></li>)}</ul></div>
                </section>
              );
              return <StandardSection key={section.id} section={section} sourceNumbers={sourceNumbers} explorer={explorersBySection[section.id]} renditions={renditions} />;
            })}
          </article>

          <aside className={styles.aside} aria-label="White-tailed deer actions">
            <div className="ng-glass-card"><span className={styles.layer}>Rules stay separate</span><h2>Can I hunt this deer?</h2><p>Answer with a location and date. Species biology, habitat and map shading never make a hunt legal.</p><Link className="ng-action" href={page.huntLinks.legality}>Check in Hunt</Link></div>
            <div className="ng-glass-card"><span className={styles.layer}>Production-verified surface</span><h2>Where should I investigate?</h2><p>Open the existing range-and-habitat layer, then confirm conditions and fresh sign on the ground.</p><Link className="ng-action-quiet" href={page.huntLinks.map}>Open Species Heat</Link></div>
          </aside>
        </div>
        <footer className={styles.footer}>Reviewed {page.reviewedAt}. White-tailed Deer is the reference implementation; catalogue-wide rollout is waiting for owner review.</footer>
      </div>
    </main>
  );
}
