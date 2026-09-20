"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  DISPLAY_PATTERN, formatDateInput, isoToDisplay, parseDateInput, readableIso, todayIso,
} from "../../lib/hunt/date";
import Calendar from "./Calendar";
import styles from "./Hunt.module.css";

interface DateFieldProps {
  /** The single selected hunt day, ISO. */
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
}

/**
 * The Hunt date composer.
 *
 * One selected day, three ways in: the Today chip, typing, and the calendar. The
 * ISO value owned by the page is the only state that matters; the text shown here
 * is a rendering of it, and is only allowed to drift from it while someone is
 * mid-keystroke.
 *
 * Typing is the fast path. `20260808` becomes `2026/08/08` without anyone reaching
 * for the slash key, which matters on a phone in the cold.
 */
export default function DateField({ value, onChange, disabled }: DateFieldProps) {
  const inputId = useId();
  const errorId = useId();
  const legendId = useId();

  const [text, setText] = useState(() => isoToDisplay(value));
  const [error, setError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  /* The last day this field itself emitted. A value that comes back from the page
     unchanged from what was typed here must not re-render the text, or the caret
     jumps mid-keystroke; a value chosen elsewhere — the Today chip, the calendar —
     must. Adjusting during render rather than in an effect keeps the two controls
     from ever painting a disagreeing frame. */
  const [emitted, setEmitted] = useState<string | null>(null);
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (value !== emitted) {
      setText(isoToDisplay(value));
      setError(null);
    }
  }

  const inputRef = useRef<HTMLInputElement>(null);
  const calendarButtonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const today = todayIso();
  const isToday = value === today;

  /* Escape closes the calendar from anywhere, not only from inside the grid: the
     control that opened it keeps focus until a day is reached by keyboard. */
  useEffect(() => {
    if (!calendarOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || calendarButtonRef.current?.contains(target)) return;
      setCalendarOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setCalendarOpen(false);
      calendarButtonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [calendarOpen]);

  function closeCalendar(returnFocus = true) {
    setCalendarOpen(false);
    if (returnFocus) calendarButtonRef.current?.focus();
  }

  function onInput(raw: string) {
    const formatted = formatDateInput(raw);
    setText(formatted);

    const parsed = parseDateInput(formatted);
    if (parsed.status === "OK") {
      setError(null);
      if (parsed.iso !== value) {
        setEmitted(parsed.iso!);
        onChange(parsed.iso!);
      }
      return;
    }
    // A half-typed date is not an error; only a finished, impossible one is.
    setError(parsed.status === "INVALID" ? parsed.message! : null);
  }

  function onBlur() {
    const parsed = parseDateInput(text);
    if (parsed.status === "OK") return;
    if (parsed.status === "EMPTY") {
      setText(isoToDisplay(value));
      setError(null);
      return;
    }
    setError(parsed.message ?? `Enter a date as ${DISPLAY_PATTERN}.`);
  }

  return (
    <fieldset className={styles.field} disabled={disabled}>
      <legend className="ng-label" id={legendId}>When are you hunting?</legend>

      <div className={styles.segmented}>
        <button
          type="button"
          className={`${styles.segment} ng-glass-control`}
          aria-pressed={isToday}
          data-active={isToday || undefined}
          onClick={() => {
            setCalendarOpen(false);
            onChange(today);
          }}
        >
          Today
        </button>
        <button
          ref={calendarButtonRef}
          type="button"
          className={`${styles.segment} ng-glass-control`}
          aria-pressed={!isToday}
          aria-expanded={calendarOpen}
          data-active={!isToday || undefined}
          onClick={() => setCalendarOpen((open) => !open)}
        >
          Choose date
        </button>
      </div>

      <div className={styles.dateRow}>
        <div className={`${styles.dateInputWrap} ng-glass-control`} data-invalid={error ? "true" : undefined}>
          <label className="ng-visually-hidden" htmlFor={inputId}>
            Hunt date, {DISPLAY_PATTERN}
          </label>
          <input
            ref={inputRef}
            id={inputId}
            className={`${styles.dateInput} ng-numeric`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            placeholder={DISPLAY_PATTERN}
            maxLength={10}
            value={text}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
            onChange={(event) => onInput(event.target.value)}
            onBlur={onBlur}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onBlur();
              }
            }}
          />

          <button
            type="button"
            className={styles.dateCalendarButton}
            aria-expanded={calendarOpen}
            onClick={() => setCalendarOpen((open) => !open)}
          >
            <span className="ng-visually-hidden">
              {calendarOpen ? "Close the calendar" : "Open the calendar"}
            </span>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none">
              <rect x="2" y="3" width="12" height="11" rx="2.4" stroke="currentColor" strokeWidth="1.3" />
              <path d="M2 6.6h12M5.4 1.7v2.5M10.6 1.7v2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {calendarOpen ? (
          <div className={styles.calendarAnchor} ref={popoverRef}>
            <Calendar
              value={value}
              labelledBy={legendId}
              onSelect={(iso) => onChange(iso)}
              onClose={() => closeCalendar()}
            />
          </div>
        ) : null}
      </div>

      <p className={styles.dateNote} id={errorId} role="status" aria-live="polite" data-tone={error ? "error" : undefined}>
        {error ?? readableIso(value)}
      </p>
    </fieldset>
  );
}
