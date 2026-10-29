import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumbs from "../../../../components/Breadcrumbs";
import HuntNav from "../../../../components/hunt/HuntNav";
import StructuredData from "../../../../components/StructuredData";
import { EXPLORATION_WORDING } from "../../../../lib/hunt/exploration/states";
import { scannableBoundary } from "../../../../lib/hunt/date";
import type { NextSeason } from "../../../../lib/hunt/regulatory/season";
import type { SeasonDates } from "../../../../lib/hunt/types";
import { huntDeepLink } from "../../../../lib/hunt/exploration/url-state";
import {
  calendarDay,
  dayLabel,
  speciesDirectAnswer,
  speciesFaq,
  speciesMetaDescription,
  speciesMetaTitle,
  stateBreakdown,
  windowParts,
  zoneList,
} from "../../../../lib/hunt/season-pages/copy";
import { seasonPageParams, speciesSeasonPage, type SeasonGroup, type ZoneAnswer } from "../../../../lib/hunt/season-pages/seasons";
import { STATUS_STYLE } from "../../../../lib/hunt/season-pages/status-style";
import { OPEN_GRAPH_BASE } from "../../../../lib/seo/open-graph";
import { datedWebPageJsonLd, faqPageJsonLd } from "../../../../lib/seo/structured-data";
import { absoluteUrl } from "../../../../lib/site";
import type { CanonicalId } from "../../../../lib/content-contract";
import AuthorityText from "../../../../components/hunt/sheet/AuthorityText";
import { INTERFACE_LANGUAGE } from "../../../../lib/hunt/translation";
import styles from "../season.module.css";

type Props = { params: Promise<{ region: string; species: string }> };

/* Only species with certified rules in the province have a page; anything
   else is a route miss rendered in full. Regenerated hourly, as the hub. */
export const dynamicParams = false;
export const revalidate = 3600;

export async function generateStaticParams() {
  return seasonPageParams();
}

const SITE_CARD = { url: "/opengraph-image", width: 1200, height: 630, alt: "North Ground" };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region, species } = await params;
  const page = await speciesSeasonPage(region, species);
  if (!page) return {};
  const path = `/hunting/${page.region.slug}/${page.speciesSlug}`;
  const title = speciesMetaTitle(page);
  const description = speciesMetaDescription(page);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { ...OPEN_GRAPH_BASE, type: "website", url: path, title, description, images: [SITE_CARD] },
    twitter: { card: "summary_large_image", title, description, images: [SITE_CARD.url] },
  };
}

function seasonText(season: SeasonDates | undefined) {
  if (!season) return <span className={styles.muted}>None running</span>;
  if (season.kind === "ABSOLUTE") {
    const parts = windowParts({ opens: season.opens, closes: season.closes });
    return <><time dateTime={season.opens}>{parts.opens}</time> – <time dateTime={season.closes}>{parts.closes}</time></>;
  }
  const opens = scannableBoundary(season.opens);
  const closes = scannableBoundary(season.closes);
  return <><time dateTime={opens.dateTime}>{opens.day}</time> – <time dateTime={closes.dateTime}>{closes.day}</time> (every year)</>;
}

/* Each of the four next-season answers keeps its own words: "none in the
   certified period" and "not certified" are opposite facts. */
function nextText(next: NextSeason) {
  switch (next.kind) {
    case "SEASON": {
      const parts = windowParts(next);
      return <><time dateTime={next.opens}>{parts.opens}</time> – <time dateTime={next.closes}>{parts.closes}</time></>;
    }
    case "DEPENDS_ON_HUNTER":
      return <span className={styles.muted}>Depends on your hunt</span>;
    case "NONE_IN_CERTIFIED_PERIOD":
      return <span className={styles.muted}>None certified through {calendarDay(next.through)}</span>;
    case "NOT_CERTIFIED":
      return <span className={styles.muted}>Not certified</span>;
  }
}

function huntLink(zone: ZoneAnswer, speciesId: string): string {
  return huntDeepLink({
    zoneId: zone.zoneId as CanonicalId<"management_zone">,
    speciesId: speciesId as CanonicalId<"species">,
    date: null,
    explore: true,
  });
}

function GroupCard({ group, speciesId, termPlural }: { group: SeasonGroup; speciesId: string; termPlural: string }) {
  const today = group.zones[0];
  /* Grouping is by certified seasons, not by today's state: a unit with a
     published restricted area inside it shares its dates with one that has
     none, and each keeps its own word. */
  const states = [...new Set(group.zones.map((zone) => zone.state))];
  const question = group.zones.every((zone) => zone.question === today.question) ? today.question : undefined;
  return (
    <article className={`${styles.group} ng-glass-card`} aria-labelledby={`group-${group.key}`}>
      <div className={styles.groupHead}>
        <h3 id={`group-${group.key}`} className={styles.groupTitle}>
          {group.zones.length === 1 ? today.fullLabel : `${group.zones.length} ${termPlural}`}
        </h3>
        <span>
          {states.map((state) => (
            <span key={state} className="ng-status" data-status={STATUS_STYLE[state]}>
              {EXPLORATION_WORDING[state].label}
              {states.length > 1 ? ` · ${group.zones.filter((zone) => zone.state === state).length}` : ""}
            </span>
          ))}
        </span>
      </div>
      <p className={styles.zoneNames}>
        {group.zones.map((zone, position) => (
          <span key={zone.designation}>
            {position > 0 ? ", " : ""}
            {zone.fullLabel}
          </span>
        ))}
      </p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Legal animal</th>
              <th scope="col">Methods</th>
              <th scope="col">Dates</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row, position) => (
              <tr key={position}>
                <td>
                  {row.animalClass.kind === "OMITTED" ? <span className={styles.muted}>Not applicable</span> : row.animalClass.text}
                  {row.criterion.kind === "VALUE" ? <span className={styles.authorityWords}>{row.criterion.text}</span> : null}
                </td>
                <td>{row.implements.kind === "OMITTED" ? <span className={styles.muted}>Not applicable</span> : row.implements.text}</td>
                <td>
                  <ul className={styles.windows}>
                    {row.windows.map((window) => (
                      <li key={`${window.opens}-${window.closes}`}>
                        <time dateTime={window.opens}>{windowParts(window).opens}</time>
                        {" – "}
                        <time dateTime={window.closes}>{windowParts(window).closes}</time>
                      </li>
                    ))}
                  </ul>
                  {row.runningToday ? <span className={styles.running}>Running today</span> : null}
                  {row.seasonWords ? <span className={styles.authorityWords}><AuthorityText into={INTERFACE_LANGUAGE} text={row.seasonWords} /></span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {today.conditions.length ? (
        <div className={styles.conditions}>
          <p>Conditions apply</p>
          <ul>
            {today.conditions.map((condition) => (
              <li key={condition.text}>
                <AuthorityText into={INTERFACE_LANGUAGE} text={condition} />
                {condition.source ? <> — <a href={condition.source.url} rel="noopener">{condition.source.publisher}</a></> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {question ? <p className={`${styles.zoneNames} ${styles.note}`}>Hunt asks: {question}</p> : null}
      <div className={styles.actions}>
        <Link className="ng-action-quiet" href={huntLink(today, speciesId)} rel="nofollow">
          Check {today.fullLabel} in Hunt
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}

export default async function SpeciesSeasonsPage({ params }: Props) {
  const { region, species } = await params;
  const page = await speciesSeasonPage(region, species);
  if (!page) notFound();
  const path = `/hunting/${page.region.slug}/${page.speciesSlug}`;
  const faq = speciesFaq(page);

  return (
    <main className="ng-product-page">
      <StructuredData data={datedWebPageJsonLd({
        path,
        name: `${page.name} season in ${page.region.name}`,
        description: speciesMetaDescription(page),
        dateModified: page.date,
        about: page.scientificName ? `${page.name} (${page.scientificName})` : page.name,
        spatialCoverage: page.region.name,
        citations: page.sources,
      })} />
      <StructuredData data={faqPageJsonLd(faq, absoluteUrl(path))} />
      <HuntNav current="/hunting" />

      <div className={`ng-shell ${styles.shell}`}>
        <Breadcrumbs items={[
          { name: "Home", path: "/" },
          { name: "Hunting", path: "/hunting" },
          { name: page.region.name, path: `/hunting/${page.region.slug}` },
          { name: page.name, path },
        ]} />

        <header className={styles.hero}>
          <p className="ng-eyebrow">{page.region.name} · Season dates by {page.layer.officialTerm}</p>
          <h1 className={styles.title}>{`${page.name} season in ${page.region.name}`}</h1>
          {page.scientificName ? <p className={styles.scientific}>{page.scientificName}</p> : null}
        </header>

        <section className={`${styles.answer} ng-glass-panel`} aria-labelledby="today">
          <h2 id="today" className={`ng-section-title ${styles.answerLabel}`}>Status today</h2>
          <p className={styles.answerText}>{speciesDirectAnswer(page)}</p>
          <ul className={styles.counts} aria-label="Units by status">
            {stateBreakdown(page.counts).map(({ state, label, count }) => (
              <li key={state}>
                <span className="ng-status" data-status={STATUS_STYLE[state]}>{label}</span>
                <span className={styles.countNumber}>{count}</span>
              </li>
            ))}
          </ul>
          <span className={styles.asOf}>
            Status for <time dateTime={page.date}>{dayLabel(page.date)}</time> in {page.region.name}
            {page.verifiedAt ? <> · rules last verified <time dateTime={page.verifiedAt}>{calendarDay(page.verifiedAt)}</time></> : null}
            {" "}· a running season is not a licence
          </span>
          <div className={styles.actions}>
            <Link className="ng-action" href={huntDeepLink({ zoneId: null, speciesId: page.speciesId, date: null, explore: true })} rel="nofollow">
              Check your exact location in Hunt
              <span aria-hidden="true">→</span>
            </Link>
            {page.speciesPath ? (
              <Link className="ng-action-quiet" href={page.speciesPath}>{page.name} profile</Link>
            ) : null}
          </div>
        </section>

        {page.groups.length ? (
          <section className={styles.section} aria-labelledby="dates">
            <div className={styles.sectionHead}>
              <p className="ng-eyebrow">Certified season dates</p>
              <h2 id="dates" className={styles.sectionTitle}>{page.name} seasons by {page.layer.officialTerm}</h2>
              <p className={styles.sectionText}>
                Units are grouped where every certified season — legal animal, methods, dates and material conditions —
                is identical. Different opportunities are never merged because their dates overlap.
              </p>
            </div>
            <div className={styles.groups}>
              {page.groups.map((group) => (
                <GroupCard
                  key={group.key}
                  group={group}
                  speciesId={page.speciesId}
                  termPlural={page.layer.officialTermPlural}
                />
              ))}
            </div>
          </section>
        ) : null}

        {page.statusGroups.length ? (
          <section className={styles.section} aria-labelledby="by-unit">
            <div className={styles.sectionHead}>
              <p className="ng-eyebrow">{page.groups.length ? "The other units" : "Status and dates by unit"}</p>
              <h2 id="by-unit" className={styles.sectionTitle}>
                {page.groups.length ? `Other ${page.layer.officialTermPlural}` : `${page.name} seasons by ${page.layer.officialTerm}`}
              </h2>
              <p className={styles.sectionText}>
                What the certified rules state for each unit on {dayLabel(page.date)}: the season running that day, if
                any, and the next certified season after it.
              </p>
            </div>
            <div className={styles.groups}>
              {page.statusGroups.map((group) => (
                <article key={group.key} className={`${styles.group} ng-glass-card`}>
                  <div className={styles.groupHead}>
                    <h3 className={styles.groupTitle}>
                      {group.zones.length === 1 ? group.zones[0].fullLabel : `${group.zones.length} ${page.layer.officialTermPlural}`}
                    </h3>
                    <span className="ng-status" data-status={STATUS_STYLE[group.state]}>{EXPLORATION_WORDING[group.state].label}</span>
                  </div>
                  <dl className={styles.facts}>
                    <div><dt>Season running {dayLabel(page.date)}</dt><dd>{seasonText(group.season)}</dd></div>
                    <div><dt>Next certified season</dt><dd>{nextText(group.next)}</dd></div>
                  </dl>
                  {group.zones[0].detail && group.zones.every((zone) => zone.detail === group.zones[0].detail)
                    ? <p className={styles.zoneNames}>{group.zones[0].detail}</p>
                    : null}
                  {group.zones.length > 1 ? <p className={styles.zoneNames}>{zoneList(group.zones, 400)}</p> : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className={styles.section} aria-labelledby="faq">
          <div className={styles.sectionHead}>
            <p className="ng-eyebrow">Questions</p>
            <h2 id="faq" className={styles.sectionTitle}>{page.name} season in {page.region.name}: answers</h2>
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

        <section className={styles.section} aria-labelledby="limits">
          <div className={styles.sectionHead}>
            <p className="ng-eyebrow">Before you rely on this</p>
            <h2 id="limits" className={styles.sectionTitle}>What this page does not decide</h2>
          </div>
          <ul className={styles.limits}>
            <li>
              Each status is the whole-unit answer for {dayLabel(page.date)}. A season running in a unit is not a licence,
              and it does not tell you about restricted areas, municipal by-laws, land access or legal hours at a
              particular spot — Hunt checks an exact location.
            </li>
            <li>A unit marked &quot;{EXPLORATION_WORDING.UNKNOWN.label}&quot; has no certified rule for this species. That is a gap in North Ground&apos;s coverage, not a closed season.</li>
            <li>
              This page describes sport hunting seasons. It does not describe harvesting under treaty or Aboriginal
              rights, which is a separate legal context North Ground does not evaluate.
            </li>
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="sources">
          <div className={styles.sectionHead}>
            <p className="ng-eyebrow">Provenance</p>
            <h2 id="sources" className={styles.sectionTitle}>Official sources</h2>
            <p className={styles.sectionText}>
              {page.layer.authority} sets these seasons. North Ground reads the regulations, structures each rule and
              cites it here; the authority&apos;s own text is the law.
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
        </section>

        <footer className={styles.footer}>
          <Link href={`/hunting/${page.region.slug}`}>All {page.region.name} seasons</Link>
          <span aria-hidden="true">·</span>
          <Link href="/hunt">North Ground Hunt</Link>
          <span aria-hidden="true">·</span>
          <Link href="/hunting/how-north-ground-verifies">How North Ground verifies</Link>
          {page.speciesPath ? (
            <>
              <span aria-hidden="true">·</span>
              <Link href={page.speciesPath}>{page.name} profile</Link>
            </>
          ) : null}
        </footer>
      </div>
    </main>
  );
}
