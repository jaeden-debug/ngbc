"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CanonicalId } from "../../../lib/content-contract";
import { hasSpeciesCoverageIn, speciesAsksQuestionIn, type SpeciesSelectorOption } from "../../../lib/hunt/coverage";
import { EXPLORATION_WORDING, type ExplorationState as ZoneState } from "../../../lib/hunt/exploration/states";
import SpeciesPrimaryImage from "../../species/SpeciesPrimaryImage";
import styles from "../HuntApp.module.css";

/**
 * "What are you hunting?"
 *
 * Species with certified rules where the hunter is looking come first, each
 * with what the rules say for the whole zone on the chosen day when that is
 * known. Every published species can still be chosen: one without certified
 * rules here gets an honest "not covered" answer rather than a disabled row,
 * because a hunter asking about it deserves to know where the gap is.
 */

const NORMALIZE = (term: string) => term.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("en-CA");

export default function SpeciesPage({
  options, value, jurisdictionId, jurisdictionName, zoneStates, onChoose, autoFocus,
}: {
  options: SpeciesSelectorOption[];
  value: CanonicalId<"species"> | null;
  jurisdictionId?: CanonicalId<"jurisdiction">;
  jurisdictionName?: string;
  /** The whole-zone state per species on the chosen day, where the zone summary has loaded. */
  zoneStates: ReadonlyMap<string, ZoneState> | null;
  onChoose: (id: CanonicalId<"species">) => void;
  autoFocus: boolean;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    if (!autoFocus) return;
    const timer = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60);
    return () => window.clearTimeout(timer);
  }, [autoFocus]);

  const groups = useMemo(() => {
    const needle = NORMALIZE(query.trim());
    const matches = options.filter((species) => !needle || [species.displayName, species.scientificName, ...species.searchTerms]
      .some((term) => NORMALIZE(term).includes(needle)));
    const here = matches.filter((species) => hasSpeciesCoverageIn(species, jurisdictionId));
    const rest = matches.filter((species) => !hasSpeciesCoverageIn(species, jurisdictionId));
    // In season first, where the zone has said; then alphabetical.
    const rank = (species: SpeciesSelectorOption) => {
      const state = zoneStates?.get(species.id);
      return state === "SEASON_AVAILABLE" ? 0 : state === "SEASON_EXCEPT_AREAS" ? 1 : state === "CHECK_REQUIREMENTS" ? 2 : 3;
    };
    here.sort((a, b) => rank(a) - rank(b) || a.displayName.localeCompare(b.displayName));
    rest.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return { here, rest };
  }, [options, query, jurisdictionId, zoneStates]);

  const hereTitle = jurisdictionId ? `Certified rules in ${jurisdictionName ?? "this jurisdiction"}` : "Certified rules somewhere North Ground covers";
  const restTitle = jurisdictionId ? "No certified rules here yet" : "Species profiles without certified rules";

  const row = (species: SpeciesSelectorOption, covered: boolean) => {
    const state = covered ? zoneStates?.get(species.id) : undefined;
    const detail = !covered
      ? jurisdictionId ? `Not covered in ${jurisdictionName ?? "this jurisdiction"}` : "Knowledge profile only"
      : state ? `${EXPLORATION_WORDING[state].glyph} ${EXPLORATION_WORDING[state].label}`
      : jurisdictionId ? (speciesAsksQuestionIn(species, jurisdictionId) ? "Rules here · asks a question" : "Rules here")
      : `Rules: ${species.regulatoryJurisdictions.map(({ name }) => name).join(", ")}`;
    return (
      <li key={species.id}>
        <button
          type="button"
          className={styles.optionRow}
          aria-pressed={species.id === value}
          data-covered={covered || undefined}
          onClick={() => onChoose(species.id)}
        >
          <span className={styles.speciesAvatar} aria-hidden="true">
            {species.image ? <SpeciesPrimaryImage media={species.image} variant="avatar" className={styles.speciesAvatarImage} /> : (
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M14.6 4.2c1.6 1 2.3 3 1.8 4.9-.6 2.3-2.6 4-4.9 4.4l-2.2.4-2.5 2.6-1.2-1.2 2.6-2.6.4-2.2c.4-2.3 2-4.3 4.3-5l1.7-.5-.6 1.3 1.6-2.1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
            )}
          </span>
          <span className={styles.optionText}>
            <span className={styles.optionPrimary}>{species.displayName}</span>
            <span className={styles.optionSecondary} data-state={state}>{detail}</span>
          </span>
          {species.id === value ? (
            <svg className={styles.optionCheck} width="16" height="16" viewBox="0 0 14 14" aria-hidden="true" fill="none">
              <path d="m2.5 7.3 3 3 6-6.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </button>
      </li>
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.searchField} data-compact="true">
        <label className="ng-visually-hidden" htmlFor={`${id}-q`}>Search species by common, scientific or alternate name</label>
        <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" fill="none">
          <circle cx="8.5" cy="8.5" r="5.75" stroke="currentColor" strokeWidth="1.7" />
          <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          id={`${id}-q`}
          className={styles.searchInput}
          type="search"
          autoComplete="off"
          spellCheck={false}
          placeholder="Search species"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {groups.here.length ? (
        <section aria-labelledby={`${id}-here`}>
          <h3 className={styles.listTitle} id={`${id}-here`}>{hereTitle}</h3>
          <ul className={styles.optionList}>{groups.here.map((species) => row(species, true))}</ul>
        </section>
      ) : null}
      {groups.rest.length ? (
        <section aria-labelledby={`${id}-rest`}>
          <h3 className={styles.listTitle} id={`${id}-rest`}>{restTitle}</h3>
          <ul className={styles.optionList}>{groups.rest.map((species) => row(species, false))}</ul>
        </section>
      ) : null}
      {!groups.here.length && !groups.rest.length ? (
        <p className={styles.inlineNotice} role="status">No published species matches that search.</p>
      ) : null}
    </div>
  );
}
