"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SUPPORTED_SPECIES, type SupportedSpeciesId } from "../../lib/hunt/coverage";
import styles from "./Hunt.module.css";

interface SpeciesSelectProps {
  value: SupportedSpeciesId | null;
  onChange: (id: SupportedSpeciesId) => void;
  disabled?: boolean;
}

/**
 * Species chooser.
 *
 * Only species with a certified regulatory record appear. The research registry
 * holds 127 North American species; listing them here — even greyed out — would
 * imply North Ground can answer a hunt for them, and it cannot yet. The count of
 * what is listed is stated plainly underneath instead.
 *
 * No thumbnail is shown, because no accurately identified licensed photograph has
 * been certified for this species. A wrong bird beside a legal answer is a
 * correctness failure, not a missing nicety, so the slot holds a neutral mark
 * until real imagery is approved.
 */
export default function SpeciesSelect({ value, onChange, disabled }: SpeciesSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const listboxId = useId();
  const labelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = SUPPORTED_SPECIES.find((species) => species.id === value) ?? null;

  /* Opening is an interaction, so the highlighted option is chosen there rather
     than in an effect that would render the list twice. */
  function openList() {
    const index = SUPPORTED_SPECIES.findIndex((species) => species.id === value);
    setActiveIndex(index >= 0 ? index : 0);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => listRef.current?.focus());

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
    const species = SUPPORTED_SPECIES[index];
    if (!species) return;
    onChange(species.id);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onListKeyDown(event: React.KeyboardEvent<HTMLUListElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % SUPPORTED_SPECIES.length);
        return;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => (index <= 0 ? SUPPORTED_SPECIES.length - 1 : index - 1));
        return;
      case "Home": event.preventDefault(); setActiveIndex(0); return;
      case "End": event.preventDefault(); setActiveIndex(SUPPORTED_SPECIES.length - 1); return;
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
          tabIndex={-1}
          aria-activedescendant={`${listboxId}-option-${activeIndex}`}
          onKeyDown={onListKeyDown}
        >
          {SUPPORTED_SPECIES.map((species, index) => (
            <li
              key={species.id}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={species.id === value}
              data-active={index === activeIndex || undefined}
              className={styles.speciesOption}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(index)}
            >
              <span className={styles.speciesThumb} aria-hidden="true">
                <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
                  <path d="M14.6 4.2c1.6 1 2.3 3 1.8 4.9-.6 2.3-2.6 4-4.9 4.4l-2.2.4-2.5 2.6-1.2-1.2 2.6-2.6.4-2.2c.4-2.3 2-4.3 4.3-5l1.7-.5-.6 1.3 1.6-2.1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
              </span>
              <span className={styles.speciesText}>
                <span className={styles.speciesName}>{species.displayName}</span>
                <span className={styles.speciesLatin}>{species.scientificName}</span>
              </span>
              {species.id === value ? (
                <svg className={styles.speciesCheck} width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none">
                  <path d="m2.5 7.3 3 3 6-6.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <p className={styles.fieldNote}>
        {SUPPORTED_SPECIES.length === 1
          ? "One species currently has a certified regulatory record. More are added one verified source at a time."
          : `${SUPPORTED_SPECIES.length} species currently have a certified regulatory record.`}
      </p>
    </div>
  );
}
