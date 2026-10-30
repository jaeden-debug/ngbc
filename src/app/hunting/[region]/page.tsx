import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumbs from "../../../components/Breadcrumbs";
import HuntNav from "../../../components/hunt/HuntNav";
import StructuredData from "../../../components/StructuredData";
import LicenceNotices from "../../../components/hunt/LicenceNotices";
import { distinctAttributions } from "../../../lib/hunt/source-attribution";
import {
  calendarDay,
  dayLabel,
  regionDirectAnswer,
  regionFaq,
  regionMetaDescription,
  regionMetaTitle,
  stateBreakdown,
} from "../../../lib/hunt/season-pages/copy";
import { seasonRegions } from "../../../lib/hunt/season-pages/regions";
import { regionPage } from "../../../lib/hunt/season-pages/seasons";
import { STATUS_STYLE } from "../../../lib/hunt/season-pages/status-style";
import { OPEN_GRAPH_BASE } from "../../../lib/seo/open-graph";
import { datedWebPageJsonLd, faqPageJsonLd } from "../../../lib/seo/structured-data";
import { absoluteUrl } from "../../../lib/site";
import styles from "./season.module.css";

type Props = { params: Promise<{ region: string }> };

/*
 * Every province with certified rules, and only those: an unknown slug is a
 * route miss that Next renders in full on the server, never an empty page.
 * The answer is about one calendar day, so the page is regenerated hourly and
 * turns over within the hour after the province's own midnight.
 */
export const dynamicParams = false;
export const revalidate = 3600;

export function generateStaticParams() {
  return seasonRegions().map((region) => ({ region: region.slug }));
}

const SITE_CARD = { url: "/opengraph-image", width: 1200, height: 630, alt: "North Ground" };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await regionPage((await params).region);
  if (!page) return {};
  const path = `/hunting/${page.region.slug}`;
  const title = regionMetaTitle(page);
  const description = regionMetaDescription(page);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { ...OPEN_GRAPH_BASE, type: "website", url: path, title, description, images: [SITE_CARD] },
    twitter: { card: "summary_large_image", title, description, images: [SITE_CARD.url] },
  };
}

export default async function RegionSeasonsPage({ params }: Props) {
  const page = await regionPage((await params).region);
  if (!page) notFound();
  const path = `/hunting/${page.region.slug}`;
  const faq = regionFaq(page);
  const answer = regionDirectAnswer(page);
  const term = page.layers[0];

  return (
    <main className="ng-product-page">
      <StructuredData data={datedWebPageJsonLd({
        path,
        name: `${page.region.name} hunting seasons`,
        description: regionMetaDescription(page),
        dateModified: page.date,
        spatialCoverage: page.region.name,
        citations: page.sources,
      })} />
      <StructuredData data={faqPageJsonLd(faq, absoluteUrl(path))} />
      <HuntNav current="/hunting" />

      <div className={`ng-shell ${styles.shell}`}>
        <Breadcrumbs items={[
          { name: "Home", path: "/" },
          { name: "Hunting", path: "/hunting" },
          { name: page.region.name, path },
        ]} />

        <header className={styles.hero}>
          <p className="ng-eyebrow">North Ground Hunt · {page.region.name}</p>
          <h1 className={styles.title}>{`${page.region.name} hunting seasons`}</h1>
        </header>

        <section className={`${styles.answer} ng-glass-panel`} aria-labelledby="today">
          <h2 id="today" className={`ng-section-title ${styles.answerLabel}`}>What is in season today</h2>
          <p className={styles.answerText}>{answer}</p>
          <span className={styles.asOf}>
            Status for <time dateTime={page.date}>{dayLabel(page.date)}</time> in {page.region.name}
            {page.verifiedAt ? <> · rules last verified <time dateTime={page.verifiedAt}>{calendarDay(page.verifiedAt)}</time></> : null}
          </span>
          <div className={styles.actions}>
            <Link className="ng-action" href="/hunt">
              Find your zone in Hunt
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="species">
          <div className={styles.sectionHead}>
            <p className="ng-eyebrow">Certified species</p>
            <h2 id="species" className={styles.sectionTitle}>Season status by species</h2>
            <p className={styles.sectionText}>
              Each count is a number of {term ? term.officialTermPlural : "zones"} on {dayLabel(page.date)}, evaluated
              by the same engine as the Hunt map. A unit that is not covered is a gap in North Ground&apos;s coverage,
              not a closed season.
            </p>
          </div>
          <div className={styles.speciesGrid}>
            {page.species.map((species) => (
              <Link key={species.speciesId} href={`${path}/${species.speciesSlug}`} className={`${styles.speciesCard} ng-glass-card`}>
                <h3 className={styles.speciesName}>{species.name}</h3>
                <p className={styles.speciesLine}>
                  {species.opportunityZones > 0
                    ? `Season running in ${species.opportunityZones} of ${species.zoneCount} ${species.term}.`
                    : `No season running in any of ${species.zoneCount} ${species.term}.`}
                </p>
                <ul className={styles.counts} aria-label={`${species.name} by unit`}>
                  {stateBreakdown(species.counts).map(({ state, label, count }) => (
                    <li key={state}>
                      <span className="ng-status" data-status={STATUS_STYLE[state]}>{label}</span>
                      <span className={styles.countNumber}>{count}</span>
                    </li>
                  ))}
                </ul>
                {species.nextOpening ? (
                  <p className={styles.speciesLine}>Next certified opening: {calendarDay(species.nextOpening.opens)}</p>
                ) : null}
                <span className={styles.speciesMore}>Dates by unit →</span>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="zones">
          <div className={styles.sectionHead}>
            <p className="ng-eyebrow">Official geography</p>
            <h2 id="zones" className={styles.sectionTitle}>How {page.region.name} divides its hunting</h2>
          </div>
          <div className={`${styles.tableWrap} ng-glass-card`}>
            <table className={styles.table}>
              <thead>
                <tr><th scope="col">Official unit</th><th scope="col">Authority</th><th scope="col">Units evaluated</th></tr>
              </thead>
              <tbody>
                {page.layers.map((layer) => (
                  <tr key={layer.id}>
                    <th scope="row">{layer.officialTermPlural}</th>
                    <td>{layer.authority}</td>
                    <td className="ng-numeric">{layer.zones}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={`${styles.sectionText} ${styles.note}`}>
            Every boundary in Hunt traces to the authority&apos;s own published GIS. A drawn boundary is not a claim
            that rules inside it are certified; each species page says unit by unit which are.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="faq">
          <div className={styles.sectionHead}>
            <p className="ng-eyebrow">Questions</p>
            <h2 id="faq" className={styles.sectionTitle}>{page.region.name} hunting seasons: answers</h2>
          </div>
          <div className={styles.faq}>
            {faq.map((item) => (
              <article key={item.id} className={`${styles.faqItem} ng-glass-card`}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        {page.region.knownGaps.length ? (
          <section className={styles.section} aria-labelledby="gaps">
            <div className={styles.sectionHead}>
              <p className="ng-eyebrow">Limits</p>
              <h2 id="gaps" className={styles.sectionTitle}>What North Ground does not cover here</h2>
            </div>
            <ul className={styles.limits}>
              {page.region.knownGaps.map((gap) => <li key={gap}>{gap}</li>)}
              <li>
                This page describes sport hunting seasons. It does not describe harvesting under treaty or Aboriginal
                rights, which is a separate legal context North Ground does not evaluate.
              </li>
            </ul>
          </section>
        ) : null}

        <section className={styles.section} aria-labelledby="sources">
          <div className={styles.sectionHead}>
            <p className="ng-eyebrow">Provenance</p>
            <h2 id="sources" className={styles.sectionTitle}>Official sources</h2>
            <p className={styles.sectionText}>
              The authority&apos;s own regulations are the law. North Ground reads them, structures each rule and cites
              it; it does not replace them.
            </p>
          </div>
          <ul className={styles.sources}>
            {page.sources.map((source) => (
              <li key={source.id}>
                {source.url ? <a href={source.url} rel="noopener">{source.title}</a> : source.title}
                <span className={styles.muted}> · {source.publisher}</span>
              </li>
            ))}
            {page.region.huntingAuthorityUrl ? (
              <li>
                <a href={page.region.huntingAuthorityUrl} rel="noopener">{page.region.name} hunting regulations</a>
                <span className={styles.muted}> · the authority&apos;s own hunting page</span>
              </li>
            ) : null}
          </ul>
          <LicenceNotices notices={distinctAttributions(page.sources)} className={styles.licenceNotices} />
        </section>

        <section className={styles.section} aria-labelledby="other-regions">
          <div className={styles.sectionHead}>
            <h2 id="other-regions" className="ng-section-title">Other provinces</h2>
          </div>
          <ul className={styles.related}>
            {seasonRegions().filter((region) => region.slug !== page.region.slug).map((region) => (
              <li key={region.slug}><Link href={`/hunting/${region.slug}`}>{region.name}</Link></li>
            ))}
          </ul>
        </section>

        <footer className={styles.footer}>
          <Link href="/hunt">North Ground Hunt</Link>
          <span aria-hidden="true">·</span>
          <Link href="/hunting/how-north-ground-verifies">How North Ground verifies</Link>
          <span aria-hidden="true">·</span>
          <Link href="/hunting/species">Species library</Link>
        </footer>
      </div>
    </main>
  );
}
