"use client";

import { useEffect, useId, useRef, useState } from "react";
import { hasSpeciesCoverageIn, speciesAsksQuestionIn, type SpeciesSelectorOption } from "../../lib/hunt/coverage";
import type { CanonicalId } from "../../lib/content-contract";
import styles from "./Hunt.module.css";

interface SpeciesSelectProps {
  value: CanonicalId<"species"> | null;
  onChange: (id: CanonicalId<"species">) => void;
  options: SpeciesSelectorOption[];
  jurisdictionId?: CanonicalId<"jurisdiction">;
  disabled?: boolean;
}

/**
 * Species chooser.
 *
 * The production species library appears here, while regulatory coverage remains
 * an explicit, separate state. Species without a certified rule are discoverable
 * but disabled for evaluation.
 *
 * No thumbnail is shown, because no accurately identified licensed photograph has
 * been certified for this species. A wrong bird beside a legal answer is a
 * correctness failure, not a missing nicety, so the slot holds a neutral mark
 * until real imagery is approved.
 */
export default function SpeciesSelect({ value, onChange, options, jurisdictionId, disabled }: SpeciesSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [query, setQuery] = useState("");

  const listboxId = useId();
  const labelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((species) => species.id === value) ?? null;
  const normalize = (term: string) => term.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-CA");
  const normalizedQuery = normalize(query.trim());
  const visibleOptions = options.filter((species) => {
    if (!normalizedQuery) return true;
    return [species.displayName, species.scientificName, ...species.searchTerms]
      .some((term) => normalize(term).includes(normalizedQuery));
  });
  const groupedOptions = visibleOptions.reduce<Map<string, Array<{ species: SpeciesSelectorOption; index: number }>>>((groups, species, index) => {
    const entries = groups.get(species.category) ?? [];
    entries.push({ species, index });
    groups.set(species.category, entries);
    return groups;
  }, new Map());

  /* Opening is an interaction, so the highlighted option is chosen there rather
     than in an effect that would render the list twice. */
  function openList() {
    const index = visibleOptions.findIndex((species) => species.id === value);
    setActiveIndex(index >= 0 ? index : 0);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => searchRef.current?.focus());

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (listRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  function choose(index: number) {
    const species = visibleOptions[index];
    if (!species || !hasSpeciesCoverageIn(species, jurisdictionId)) return;
    onChange(species.id);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onListKeyDown(event: React.KeyboardEvent<HTMLUListElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => visibleOptions.length ? (index + 1) % visibleOptions.length : 0);
        return;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => (index <= 0 ? Math.max(0, visibleOptions.length - 1) : index - 1));
        return;
      case "Home": event.preventDefault(); setActiveIndex(0); return;
      case "End": event.preventDefault(); setActiveIndex(Math.max(0, visibleOptions.length - 1)); return;
      case "Enter": case " ": event.preventDefault(); choose(activeIndex); return;
      case "Escape": case "Tab":
        setOpen(false);
        if (event.key === "Escape") {
          event.preventDefault();
          buttonRef.current?.focus();
        }
        return;
      default: return;
    }
  }

  return (
    <div className={styles.field}>
      <span className="ng-label" id={labelId}>Species</span>

      <button
        ref={buttonRef}
        type="button"
        className={`${styles.speciesTrigger} ng-glass-control`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${labelId} ${listboxId}-value`}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openList();
          }
        }}
      >
        <span className={styles.speciesThumb} aria-hidden="true">
          <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
            <path d="M14.6 4.2c1.6 1 2.3 3 1.8 4.9-.6 2.3-2.6 4-4.9 4.4l-2.2.4-2.5 2.6-1.2-1.2 2.6-2.6.4-2.2c.4-2.3 2-4.3 4.3-5l1.7-.5-.6 1.3 1.6-2.1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
        </span>

        <span className={styles.speciesText} id={`${listboxId}-value`}>
          {selected ? (
            <>
              <span className={styles.speciesName}>{selected.displayName}</span>
              <span className={styles.speciesLatin}>{selected.scientificName}</span>
            </>
          ) : (
            <span className={styles.speciesName}>Choose a species</span>
          )}
        </span>

        <svg className={styles.speciesChevron} width="13" height="13" viewBox="0 0 14 14" aria-hidden="true" fill="none">
          <path d="m3 5 4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <ul
          ref={listRef}
          className={`${styles.speciesList} ng-glass-popover`}
          id={listboxId}
          role="listbox"
          aria-labelledby={labelId}
        >
          <li className={styles.speciesSearchRow} role="presentation">
            <label className="ng-sr-only" htmlFor={`${listboxId}-search`}>Search species by common, scientific or alternate name</label>
            <input
              ref={searchRef}
              id={`${listboxId}-search`}
              className={styles.speciesSearch}
              type="search"
              role="combobox"
              aria-expanded="true"
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={visibleOptions.length ? `${listboxId}-option-${activeIndex}` : undefined}
              placeholder="Search species"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
              onKeyDown={(event) => {
                if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", "Escape"].includes(event.key)) onListKeyDown(event as unknown as React.KeyboardEvent<HTMLUListElement>);
              }}
            />
          </li>
          {[...groupedOptions.entries()].map(([category, entries]) => (
            <li key={category} role="presentation" className={styles.speciesGroup}>
              <span className={styles.speciesGroupLabel}>{category}</span>
              <ul role="group" aria-label={category} className={styles.speciesGroupList}>
                {entries.map(({ species, index }) => {
                  const available = hasSpeciesCoverageIn(species, jurisdictionId);
                  const where = jurisdictionId
                    ? "Rules available here"
                    : `Rules: ${species.regulatoryJurisdictions.map(({ name }) => name).join(", ")}`;
                  const coverageLabel = !available
                    ? jurisdictionId ? "No certified rules here" : "Knowledge profile · no certified rules"
                    : speciesAsksQuestionIn(species, jurisdictionId) ? `${where} · asks a question` : where;
                  return <li
                    key={species.id}
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    aria-selected={species.id === value}
                    aria-disabled={!available}
                    data-active={index === activeIndex || undefined}
                    className={styles.speciesOption}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(index)}
                  >
                    <span className={styles.speciesThumb} aria-hidden="true">
                      <svg width="17" height="17" viewBox="0 0 20 20" fill="none"><path d="M14.6 4.2c1.6 1 2.3 3 1.8 4.9-.6 2.3-2.6 4-4.9 4.4l-2.2.4-2.5 2.6-1.2-1.2 2.6-2.6.4-2.2c.4-2.3 2-4.3 4.3-5l1.7-.5-.6 1.3 1.6-2.1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
                    </span>
                    <span className={styles.speciesText}>
                      <span className={styles.speciesName}>{species.displayName}</span>
                      <span className={styles.speciesLatin}>{species.scientificName}</span>
                    </span>
                    <span className={styles.speciesCoverage} data-verified={available || undefined}>
                      {coverageLabel}
                    </span>
                    {species.id === value ? <svg className={styles.speciesCheck} width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none"><path d="m2.5 7.3 3 3 6-6.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
                  </li>;
                })}
              </ul>
            </li>
          ))}
          {!visibleOptions.length ? <li className={styles.speciesEmpty} role="presentation">No production species match that search.</li> : null}
        </ul>
      ) : null}

      <p className={styles.fieldNote}>
        {options.length} species profiles are published. A Hunt evaluation runs only for a species with certified rules in the jurisdiction you choose.
      </p>
    </div>
  );
}
