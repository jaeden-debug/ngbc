"use client";

import { useId, useRef, useState } from "react";
import { DISPLAY_PATTERN, formatDateInput, isoToDisplay, parseDateInput, readableIso } from "../../../lib/hunt/date";
import type { DatePreset } from "../../../lib/hunt/exploration/date-presets";
import Calendar from "../Calendar";
import styles from "../HuntApp.module.css";

/**
 * "When are you hunting?" — Today, or a day chosen on the calendar
 * or typed. One selected day: the buttons, the typed field and the calendar
 * all read and write the same ISO value and cannot disagree.
 *
 * Typing is the fast path. `20261115` becomes `2026/11/15` without the slash
 * key, and an impossible date is refused with a reason, never rolled forward.
 */
export default function DatePage({ value, today, onChoose }: {
  value: string;
  /** The device's own today, or null before the page has mounted. */
  today: string | null;
  onChoose: (iso: string, preset: DatePreset | null) => void;
}) {
  const id = useId();
  const [text, setText] = useState(() => isoToDisplay(value));
  /* True only between the focus that selected the field and the click that ended
     it, so a SECOND click can still put the caret where someone aimed it. */
  const justSelected = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const preset: DatePreset | null = value === today ? "today" : null;

  function onInput(raw: string) {
    const formatted = formatDateInput(raw);
    setText(formatted);
    const parsed = parseDateInput(formatted);
    if (parsed.status === "OK") {
      setError(null);
      if (parsed.iso !== value) onChoose(parsed.iso!, null);
      return;
    }
    // Half-typed is not wrong; only a finished, impossible date is.
    setError(parsed.status === "INVALID" ? parsed.message! : null);
  }

  return (
    <div className={styles.page}>
      <div className={styles.presetRow} role="group" aria-label="Quick dates">
        {today ? (
          <button type="button" className={styles.presetButton} aria-pressed={preset === "today"} onClick={() => onChoose(today, "today")}>
            Today
          </button>
        ) : null}
      </div>

      <label className={styles.fieldLabel} htmlFor={`${id}-typed`}>Or type a date</label>
      <input
        id={`${id}-typed`}
        className={`${styles.dateInput} ng-numeric`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        placeholder={DISPLAY_PATTERN}
        value={text}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-note`}
        /*
         * The field already holds a date, so the first keystroke has to REPLACE
         * it. Without this, tapping the field put the caret after ten characters
         * and every digit typed was dropped — the promise that typing `20261225`
         * is enough was true only for an empty field, which this one never is.
         * `maxLength` is gone with it: `formatDateInput` already caps the digits,
         * and the attribute was what silently swallowed those keystrokes.
         * The mouseup guard keeps a desktop click from collapsing the selection
         * the focus just made; a second click still places a caret.
         */
        onFocus={(event) => { event.currentTarget.select(); justSelected.current = true; }}
        onMouseUp={(event) => { if (justSelected.current) event.preventDefault(); justSelected.current = false; }}
        onBlurCapture={() => { justSelected.current = false; }}
        onChange={(event) => onInput(event.target.value)}
        onBlur={() => {
          const parsed = parseDateInput(text);
          if (parsed.status === "EMPTY") { setText(isoToDisplay(value)); setError(null); }
          else if (parsed.status !== "OK") setError(parsed.message ?? `Enter a date as ${DISPLAY_PATTERN}.`);
        }}
      />
      <p className={styles.fieldNote} id={`${id}-note`} role="status" data-tone={error ? "error" : undefined}>
        {error ?? readableIso(value)}
      </p>

      <div className={styles.calendarWrap}>
        <Calendar
          value={value}
          onSelect={(iso) => { setText(isoToDisplay(iso)); setError(null); onChoose(iso, null); }}
          onClose={() => { /* The calendar lives in the page; choosing a day is enough. */ }}
        />
      </div>
    </div>
  );
}
