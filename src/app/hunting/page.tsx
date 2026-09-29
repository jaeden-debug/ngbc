import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "../../components/Breadcrumbs";
import HuntNav from "../../components/hunt/HuntNav";
import { contentRepository } from "../../lib/content/repository";
import { officialTermPlural, ZONE_LAYERS } from "../../lib/hunt/zone-layers";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Hunting in Canada & USA | Zones, Seasons & Species",
  description:
    "Explore hunting zones, supported season information and species identification with North Ground Hunt across supported areas in Canada and the United States.",
  alternates: {
    canonical: "/hunting",
  },
  openGraph: {
    type: "website",
    url: "/hunting",
    title: "Hunting in Canada & USA | Zones, Seasons & Species",
    description:
      "Explore hunting zones, supported season information and species identification with North Ground Hunt across supported areas in Canada and the United States.",
  },
  twitter: {
    card: "summary",
    title: "Hunting in Canada & USA | Zones, Seasons & Species",
    description:
      "Explore hunting zones, supported season information and species identification with North Ground Hunt across supported areas in Canada and the United States.",
  },
};

interface HuntingJurisdiction {
  id: string;
  name: string;
  country: "CA" | "US";
  terms: string[];
  rulesServing: boolean;
}

function servingJurisdictions(): HuntingJurisdiction[] {
  const jurisdictions = new Map<string, HuntingJurisdiction>();

  for (const layer of ZONE_LAYERS) {
    if (!layer.serving) continue;

    const existing = jurisdictions.get(layer.jurisdictionId);
    const term = officialTermPlural(layer);

    if (existing) {
      if (!existing.terms.includes(term)) existing.terms.push(term);
      existing.rulesServing ||= layer.rulesServing === true;
      continue;
    }

    jurisdictions.set(layer.jurisdictionId, {
      id: layer.jurisdictionId,
      name: layer.jurisdictionName,
      country: layer.country,
      terms: [term],
      rulesServing: layer.rulesServing === true,
    });
  }

  return [...jurisdictions.values()].sort((left, right) => {
    if (left.country !== right.country) return left.country === "CA" ? -1 : 1;
    return left.name.localeCompare(right.name, "en-CA");
  });
}

export default async function HuntingPage() {
  const resources = await contentRepository.getPublishedResources({ locale: "en-CA" });
  const speciesCount = resources.filter((resource) => resource.type === "species").length;
  const jurisdictions = servingJurisdictions();

  const canadianJurisdictions = jurisdictions.filter(({ country }) => country === "CA");
  const unitedStatesJurisdictions = jurisdictions.filter(({ country }) => country === "US");

  return (
    <main className="ng-product-page">
      <HuntNav current="/hunting" />

      <div className={`ng-shell ${styles.shell}`}>
        <Breadcrumbs
          items={[
            { name: "Home", path: "/" },
            { name: "Hunting", path: "/hunting" },
          ]}
        />

        <header className={styles.hero}>
          <p className="ng-eyebrow">North Ground Hunting</p>
          <h1 className={styles.title}>Hunting</h1>
          <p className={styles.lede}>
            Hunting-zone and supported season tools alongside species identification
            and field knowledge for hunters in Canada and the United States.
          </p>
        </header>

        <section className={styles.paths} aria-labelledby="hunting-paths">
          <h2 id="hunting-paths" className="ng-visually-hidden">
            Explore North Ground Hunting
          </h2>

          <article className={`${styles.pathCard} ${styles.huntCard} ng-glass-panel`}>
            <div>
              <p className="ng-eyebrow">Interactive tool</p>
              <h3 className={styles.pathTitle}>Find your hunting zone</h3>
              <p className={styles.pathText}>
                Use your location or search a place, identify the official management
                area, then choose a species and date to check the regulatory information
                North Ground currently supports.
              </p>
            </div>

            <Link className="ng-action" href="/hunt">
              Open Hunt
              <span aria-hidden="true">→</span>
            </Link>
          </article>

          <article className={`${styles.pathCard} ng-glass-card`}>
            <div>
              <p className="ng-eyebrow">Field knowledge</p>
              <h3 className={styles.pathTitle}>Explore {speciesCount} species profiles</h3>
              <p className={styles.pathText}>
                Browse identification, habitat, field marks, scientific names and hunter
                terminology. Species knowledge is separate from hunting permission.
              </p>
            </div>

            <Link className="ng-action-quiet" href="/hunting/species">
              Browse species
              <span aria-hidden="true">→</span>
            </Link>
          </article>
        </section>

        <section className={styles.coverage} aria-labelledby="coverage-title">
          <div className={styles.sectionIntro}>
            <p className="ng-eyebrow">Current coverage</p>
            <h2 id="coverage-title" className={styles.sectionTitle}>
              Where Hunt maps today
            </h2>
            <p className={styles.sectionText}>
              North Ground currently presents official hunting-management geography for
              the jurisdictions below. Regulatory coverage varies by jurisdiction,
              management area and species.
            </p>
          </div>

          <div className={styles.coverageGroups}>
            {canadianJurisdictions.length > 0 ? (
              <div className={`${styles.coverageGroup} ng-glass-card`}>
                <h3 className={styles.coverageCountry}>Canada</h3>
                <div className={styles.jurisdictionList}>
                  {canadianJurisdictions.map((jurisdiction) => (
                    <div className={styles.jurisdiction} key={jurisdiction.id}>
                      <div>
                        <strong>{jurisdiction.name}</strong>
                        <span>{jurisdiction.terms.join(" · ")}</span>
                      </div>
                      <span
                        className={styles.rulesState}
                        data-rules={jurisdiction.rulesServing ? "available" : "boundary"}
                      >
                        {jurisdiction.rulesServing
                          ? "Some regulatory coverage"
                          : "Boundary coverage"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {unitedStatesJurisdictions.length > 0 ? (
              <div className={`${styles.coverageGroup} ng-glass-card`}>
                <h3 className={styles.coverageCountry}>United States</h3>
                <div className={styles.jurisdictionList}>
                  {unitedStatesJurisdictions.map((jurisdiction) => (
                    <div className={styles.jurisdiction} key={jurisdiction.id}>
                      <div>
                        <strong>{jurisdiction.name}</strong>
                        <span>{jurisdiction.terms.join(" · ")}</span>
                      </div>
                      <span
                        className={styles.rulesState}
                        data-rules={jurisdiction.rulesServing ? "available" : "boundary"}
                      >
                        {jurisdiction.rulesServing
                          ? "Some regulatory coverage"
                          : "Boundary coverage"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <p className={styles.coverageNote}>
            A mapped boundary does not by itself establish an open season. Hunt evaluates
            supported regulatory information using the selected place, species and date.
          </p>
        </section>

        <section className={styles.model} aria-labelledby="model-title">
          <div className={styles.sectionIntro}>
            <p className="ng-eyebrow">How it works</p>
            <h2 id="model-title" className={styles.sectionTitle}>
              Three different questions
            </h2>
          </div>

          <div className={styles.modelGrid}>
            <div className={styles.modelItem}>
              <span className="ng-section-title">Zone</span>
              <p>Official hunting-management geography identifies the area you are in.</p>
            </div>

            <div className={styles.modelItem}>
              <span className="ng-section-title">Species</span>
              <p>Identification, habitat and field knowledge describe the animal.</p>
            </div>

            <div className={styles.modelItem}>
              <span className="ng-section-title">Season</span>
              <p>
                Regulatory information is evaluated by species, place and date where
                North Ground has certified support.
              </p>
            </div>
          </div>

          <p className={styles.authorityNote}>
            Biological knowledge is not permission to hunt, and map geometry is not a
            regulatory determination. Always follow the legislation, regulations and
            instructions of the responsible authority.
          </p>
        </section>

        <footer className={styles.footer}>
          <Link href="/hunt">North Ground Hunt</Link>
          <span aria-hidden="true">·</span>
          <Link href="/hunting/species">Species library</Link>
          <span aria-hidden="true">·</span>
          <Link href="/">North Ground</Link>
        </footer>
      </div>
    </main>
  );
}
