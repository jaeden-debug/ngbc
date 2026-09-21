"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./page.module.css";

export interface LibrarySpecies {
  id: string;
  commonName: string;
  scientificName: string;
  frenchName: string | null;
  category: string;
  canonicalUrl: string;
  searchTerms: string[];
  regulatoryJurisdictions: string[];
  image: { url: string; alt: string } | null;
}

/* Diacritic-insensitive so `orignal` finds Moose and `Canard colvert` finds
   Mallard without the reader switching keyboard layouts. */
const normalize = (value: string) =>
  value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("en-CA");

const ALL = "All";

export default function SpeciesLibrary({ species }: { species: LibrarySpecies[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);

  /* Category counts follow the search, so a filter never advertises results the
     current query cannot produce. */
  const searched = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return species;
    return species.filter((item) => item.searchTerms.some((term) => normalize(term).includes(needle)));
  }, [query, species]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of searched) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    return [
      { name: ALL, count: searched.length },
      ...[...counts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "en-CA"))
        .map(([name, count]) => ({ name, count })),
    ];
  }, [searched]);

  const visible = useMemo(
    () => (category === ALL ? searched : searched.filter((item) => item.category === category)),
    [category, searched],
  );

  const filtering = Boolean(query.trim()) || category !== ALL;

  return (
    <>
      {/* Category sections used to supply the page's H2s. Filtering replaced them,
          so the two regions carry the structure instead — hidden visually, because
          a search field and a result list do not need to be captioned on screen,
          but present for anyone navigating by heading. */}
      <section className={`${styles.controls} ng-glass-panel`} aria-labelledby="find-heading">
        <h2 className="ng-visually-hidden" id="find-heading">Find a species</h2>
        <label className="ng-visually-hidden" htmlFor="species-search">
          Search species by common, scientific, French or hunter name
        </label>
        <div className={styles.searchField}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 18 18" aria-hidden="true" fill="none">
            <circle cx="8" cy="8" r="5.3" stroke="currentColor" strokeWidth="1.5" />
            <path d="m12.2 12.2 3.3 3.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            className={styles.search}
            id="species-search"
            type="search"
            value={query}
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="wolf, doe, orignal, Canard colvert…"
          />
        </div>

        <div className={styles.filters} role="group" aria-label="Filter by category">
          {categories.map((item) => (
            <button
              key={item.name}
              type="button"
              className={styles.filter}
              aria-pressed={category === item.name}
              onClick={() => setCategory(item.name)}
            >
              {item.name}
              <span className={styles.filterCount}>{item.count}</span>
            </button>
          ))}
        </div>
      </section>

      <p className={styles.resultLine} aria-live="polite">
        <span>
          {visible.length} {visible.length === 1 ? "species" : "species"}
          {category === ALL ? "" : ` in ${category}`}
        </span>
        {filtering ? (
          <button type="button" className={styles.reset} onClick={() => { setQuery(""); setCategory(ALL); }}>
            Clear
          </button>
        ) : null}
      </p>

      <h2 className="ng-visually-hidden" id="results-heading">Species</h2>
      {visible.length ? (
        <ul className={styles.grid} aria-labelledby="results-heading">
          {visible.map((item) => (
            <li key={item.id} className={`${styles.card} ng-glass-card`}>
              <Link className={styles.cardLink} href={item.canonicalUrl}>
                <span className={styles.cardTop}>
                  <span className={styles.cardCategory}>{item.category}</span>
                  {item.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- contract-gated external media. */
                    <img className={styles.thumb} src={item.image.url} alt={item.image.alt} loading="lazy" />
                  ) : null}
                </span>
                {/* With no verified photograph the name carries the card. A
                    placeholder box here would read as missing content rather
                    than as the deliberate standard it is. */}
                <span className={styles.cardName}>{item.commonName}</span>
                <span className={styles.cardScientific}>{item.scientificName}</span>
                {item.frenchName ? <span className={styles.cardFrench}>{item.frenchName}</span> : null}
                <span className={styles.cardFoot}>
                  <span className="ng-coverage" data-coverage={item.regulatoryJurisdictions.length ? "VERIFIED" : "IN_DEVELOPMENT"}>
                    {item.regulatoryJurisdictions.length
                      ? `Rules: ${item.regulatoryJurisdictions.join(", ")}`
                      : "Knowledge profile · no certified rules"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className={`${styles.empty} ng-glass-card`}>
          <p className={styles.emptyTitle}>No published species matches that search</p>
          <p className={styles.emptyNote}>
            Try a common, scientific, French or hunter name. Research-only records are not
            published here, so a species North Ground has not yet written up will not appear.
          </p>
        </div>
      )}
    </>
  );
}
