import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "../../../components/Breadcrumbs";
import HuntNav from "../../../components/hunt/HuntNav";
import StructuredData from "../../../components/StructuredData";
import { CANADA_JURISDICTIONS } from "../../../lib/hunt/canada/registry";
import { EXPLORATION_WORDING } from "../../../lib/hunt/exploration/states";
import { regulatoryEntryFor } from "../../../lib/hunt/regulatory/registry";
import { seasonRegions } from "../../../lib/hunt/season-pages/regions";
import { OPEN_GRAPH_BASE } from "../../../lib/seo/open-graph";
import { aboutPageJsonLd } from "../../../lib/seo/structured-data";
import { CONTACT_EMAIL } from "../../../lib/site";
import styles from "../[region]/season.module.css";

const PATH = "/hunting/how-north-ground-verifies";
const TITLE = "How North Ground Verifies Hunting Seasons and Zones";
const DESCRIPTION =
  "Where North Ground Hunt's zones and season answers come from, how each rule is read from the official regulations and cited, what each status word means, and what North Ground does not decide.";
const SITE_CARD = { url: "/opengraph-image", width: 1200, height: 630, alt: "North Ground" };

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...OPEN_GRAPH_BASE, type: "website", url: PATH, title: TITLE, description: DESCRIPTION, images: [SITE_CARD] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [SITE_CARD.url] },
};

const STATES = ["SEASON_AVAILABLE", "SEASON_EXCEPT_AREAS", "CHECK_REQUIREMENTS", "NEEDS_VERIFICATION", "CONFLICT", "CLOSED", "UNKNOWN", "NOT_CERTIFIED"] as const;

export default function HowNorthGroundVerifiesPage() {
  const regions = seasonRegions();
  /* Counted from the engine's own coverage report at build, never typed. */
  const coverage = regions.map((region) => {
    const entry = regulatoryEntryFor(region.jurisdictionId);
    const species = entry?.coverage().species.filter((row) => row.rules > 0).length ?? 0;
    return {
      region,
      species,
      units: region.layers.reduce((total, { designations }) => total + designations.length, 0),
      terms: region.layers.map(({ layer }) => layer.officialTermPlural ?? `${layer.officialTerm}s`),
      authority: [...new Set(region.layers.map(({ layer }) => layer.authority))].join(", "),
    };
  });
  const outOfScope = CANADA_JURISDICTIONS.filter((jurisdiction) => jurisdiction.scope).map((jurisdiction) => jurisdiction.nameEn);

  return (
    <main className="ng-product-page">
      <StructuredData data={aboutPageJsonLd({ path: PATH, name: TITLE, description: DESCRIPTION })} />
      <HuntNav current="/hunting" />
      <div className={`ng-shell ${styles.shell}`}>
        <Breadcrumbs items={[
          { name: "Home", path: "/" },
          { name: "Hunting", path: "/hunting" },
          { name: "How North Ground verifies", path: PATH },
        ]} />

        <header className={styles.hero}>
          <p className="ng-eyebrow">Methodology</p>
          <h1 className={styles.title}>How North Ground verifies</h1>
        </header>

        <section className={`${styles.answer} ng-glass-panel`} aria-labelledby="short">
          <h2 id="short" className={`ng-section-title ${styles.answerLabel}`}>In short</h2>
          <p className={styles.answerText}>
            Every hunting zone North Ground draws comes from the authority&apos;s own published map service, and every
            season answer comes from a rule North Ground read in that authority&apos;s official regulations, structured
            into data and cited with its source and the date it was checked. A deterministic engine — not an AI model —
            decides each status. Where North Ground has not certified a rule, the answer says so; it never reads a gap
            as a closed season.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="zones">
          <div className={styles.sectionHead}>
            <p className="ng-eyebrow">Zones</p>
            <h2 id="zones" className={styles.sectionTitle}>Where the boundaries come from</h2>
            <p className={styles.sectionText}>
              Each line on the Hunt map traces to a named authority&apos;s own GIS service. North Ground never draws an
              approximate or decorative regulatory boundary; when a provider is down, the map says so rather than
              guessing. Drawing a boundary is not a claim that the rules inside it are certified, and every zone card
              says which. Map geometry and phone GPS are not a legal survey: near a boundary, Hunt flags the line and
              names the neighbouring zone where it can.
            </p>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="rules">
          <div className={styles.sectionHead}>
            <p className="ng-eyebrow">Seasons</p>
            <h2 id="rules" className={styles.sectionTitle}>How a rule is certified</h2>
          </div>
          <ol className={styles.limits}>
            <li><strong>Read the official source.</strong> The province&apos;s regulation, order or published hunting summary — the authority&apos;s own document, never a third-party copy.</li>
            <li><strong>Structure the fact.</strong> Species, zone, dates, legal animal class, permitted methods and material conditions become separate fields, so &quot;antlered, bow, October&quot; and &quot;either sex, rifle, November&quot; stay two different opportunities.</li>
            <li><strong>Keep the provenance.</strong> Each rule carries its authority, source link, the date it was retrieved and the date it was last verified.</li>
            <li><strong>Leave gaps as gaps.</strong> Where the authority does not settle a fact — a class, a method, a zone&apos;s geography — it stays &quot;not established&quot;. North Ground does not fill it in to make an answer look complete.</li>
            <li><strong>Answer from one engine.</strong> The map, each zone card, Hunt&apos;s full answer and the province season pages all ask the same rules engine, so they cannot disagree.</li>
          </ol>
        </section>

        <section className={styles.section} aria-labelledby="words">
          <div className={styles.sectionHead}>
            <p className="ng-eyebrow">Status words</p>
            <h2 id="words" className={styles.sectionTitle}>What each answer means</h2>
            <p className={styles.sectionText}>
              North Ground never says a season is &quot;open to you&quot;: a season running is not a licence, and it does
              not know what you hold.
            </p>
          </div>
          <div className={`${styles.tableWrap} ng-glass-card`}>
            <table className={styles.table}>
              <thead><tr><th scope="col">Status</th><th scope="col">Meaning</th></tr></thead>
              <tbody>
                {STATES.map((state) => (
                  <tr key={state}>
                    <th scope="row"><span aria-hidden="true">{EXPLORATION_WORDING[state].glyph}</span> {EXPLORATION_WORDING[state].label}</th>
                    <td>{EXPLORATION_WORDING[state].detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="coverage">
          <div className={styles.sectionHead}>
            <p className="ng-eyebrow">Coverage</p>
            <h2 id="coverage" className={styles.sectionTitle}>Where North Ground holds certified rules</h2>
            <p className={styles.sectionText}>
              Counted from the certified rules themselves. Coverage is per species and per zone, and each season page
              lists the units it covers and the ones it does not.
            </p>
          </div>
          <div className={`${styles.tableWrap} ng-glass-card`}>
            <table className={styles.table}>
              <thead>
                <tr><th scope="col">Province</th><th scope="col">Zones</th><th scope="col">Authority</th><th scope="col">Certified species</th></tr>
              </thead>
              <tbody>
                {coverage.map((row) => (
                  <tr key={row.region.slug}>
                    <th scope="row"><Link href={`/hunting/${row.region.slug}`}>{row.region.name}</Link></th>
                    <td>{row.units} {row.terms.join(", ")}</td>
                    <td>{row.authority}</td>
                    <td className="ng-numeric">{row.species}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {outOfScope.length ? (
            <p className={`${styles.sectionText} ${styles.note}`}>
              Out of scope for now: {outOfScope.join(" and ")}. Federal migratory game bird seasons are not listed on the
              province season pages.
            </p>
          ) : null}
        </section>

        <section className={styles.section} aria-labelledby="limits">
          <div className={styles.sectionHead}>
            <p className="ng-eyebrow">Limits</p>
            <h2 id="limits" className={styles.sectionTitle}>What North Ground does not decide</h2>
          </div>
          <ul className={styles.limits}>
            <li>It is not the law. The responsible authority&apos;s own regulations govern; confirm current requirements before you hunt.</li>
            <li>It does not check your licence, tags, draw results or eligibility.</li>
            <li>It does not describe harvesting under treaty or Aboriginal rights, which is a separate legal context North Ground does not evaluate.</li>
            <li>A province-wide or whole-zone answer does not resolve municipal by-laws, private land, access or restricted areas at a particular spot; Hunt checks an exact location where it can.</li>
            <li>AI never decides legal status, zone membership or licence requirements.</li>
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="corrections">
          <div className={styles.sectionHead}>
            <p className="ng-eyebrow">Corrections</p>
            <h2 id="corrections" className={styles.sectionTitle}>Found something wrong?</h2>
            <p className={styles.sectionText}>
              Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with the page, the zone and the official
              source. A wrong regulatory answer is treated as a defect, not a typo.
            </p>
          </div>
        </section>

        <footer className={styles.footer}>
          <Link href="/hunt">North Ground Hunt</Link>
          <span aria-hidden="true">·</span>
          <Link href="/hunting">Hunting</Link>
          <span aria-hidden="true">·</span>
          <Link href="/hunting/species">Species library</Link>
        </footer>
      </div>
    </main>
  );
}
