"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { SpeciesSearchResult } from "../../../lib/content/repository";
import styles from "./page.module.css";

export default function SpeciesLibrary({ species }: { species: SpeciesSearchResult[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("en-CA");
    if (!needle) return species;
    return species.filter((item) => [item.commonName, item.scientificName, ...item.aliases]
      .some((term) => term.toLocaleLowerCase("en-CA").includes(needle)));
  }, [query, species]);

  const groups = new Map<string, SpeciesSearchResult[]>();
  for (const item of filtered) groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
  return (
    <>
      <label className={styles.searchLabel} htmlFor="species-library-search">Search common, scientific or alternate names</label>
      <input
        className={styles.search}
        id="species-library-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Try whitetail, orignal, Canard colvert…"
      />
      <p className={styles.count} aria-live="polite">{filtered.length} {filtered.length === 1 ? "species" : "species"}</p>
      {[...groups.entries()].map(([group, items]) => (
        <section className={styles.group} key={group} aria-labelledby={`group-${group.replaceAll(" ", "-")}`}>
          <h2 id={`group-${group.replaceAll(" ", "-")}`}>{group}</h2>
          <div className={styles.grid}>
            {items.map((item) => (
              <article className={styles.card} key={item.id}>
                <div className={styles.noPhoto} aria-label="No verified species photograph published">NG · verified profile</div>
                <h3><Link href={item.canonicalUrl}>{item.commonName}</Link></h3>
                <p className={styles.scientific}>{item.scientificName}</p>
                <p className={styles.coverage}>{item.id === "species:ruffed-grouse" ? "Ontario Hunt rules available for the certified WMU 57 slice" : "Species profile available · Hunt rules in development"}</p>
              </article>
            ))}
          </div>
        </section>
      ))}
      {!filtered.length ? <p className={styles.empty}>No published species match that search. Research-only records are not shown.</p> : null}
    </>
  );
}
