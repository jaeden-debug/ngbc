"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addMonths, daysInMonth, isoParts, isoToDisplay, MONTH_NAMES, readableIso, toIso, todayIso,
  WEEKDAY_INITIALS, WEEKDAY_NAMES, weekdayOf,
} from "../../lib/hunt/date";
import styles from "./Hunt.module.css";

interface CalendarProps {
  /** The single selected hunt day, ISO. */
  value: string;
  onSelect: (iso: string) => void;
  onClose: () => void;
  labelledBy?: string;
}

interface Cell {
  iso: string;
  day: number;
  outside: boolean;
}

function monthGrid(year: number, month: number): Cell[] {
  const cells: Cell[] = [];
  const leading = weekdayOf(year, month, 1);
  const previous = addMonths(year, month, -1);
  const previousLength = daysInMonth(previous.year, previous.month);

  for (let index = leading - 1; index >= 0; index -= 1) {
    const day = previousLength - index;
    cells.push({ iso: toIso(previous.year, previous.month, day), day, outside: true });
  }
  for (let day = 1; day <= daysInMonth(year, month); day += 1) {
    cells.push({ iso: toIso(year, month, day), day, outside: false });
  }
  const next = addMonths(year, month, 1);
  for (let day = 1; cells.length % 7 !== 0; day += 1) {
    cells.push({ iso: toIso(next.year, next.month, day), day, outside: true });
  }
  return cells;
}

/**
 * The Hunt calendar.
 *
 * It holds no date of its own: `value` is the one selected hunt day, shared with
 * the text field, so the two controls can never disagree. The only local state is
 * which month is on screen and which cell holds the keyboard.
 *
 * No day is disabled. A date outside a source's period is a real question with a
 * real answer — the evaluator says the record does not cover it — and greying it
 * out here would hide that answer behind an unexplained dead control.
 */
export default function Calendar({ value, onSelect, onClose, labelledBy }: CalendarProps) {
  const selected = isoParts(value) ?? isoParts(todayIso())!;
  const [view, setView] = useState({ year: selected.year, month: selected.month });
  const [focusedIso, setFocusedIso] = useState(value);

  const gridRef = useRef<HTMLDivElement>(null);
  const shouldFocusRef = useRef(false);
  const today = todayIso();

  const weeks = useMemo(() => {
    const cells = monthGrid(view.year, view.month);
    const rows: Cell[][] = [];
    for (let index = 0; index < cells.length; index += 7) rows.push(cells.slice(index, index + 7));
    return rows;
  }, [view]);

  /* Keyboard navigation moves a roving focus between days, and crossing a month
     edge brings that month into view rather than trapping the user. */
  useEffect(() => {
    if (!shouldFocusRef.current) return;
    shouldFocusRef.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>('[data-focused="true"]')?.focus();
  }, [focusedIso, view]);

  function moveFocus(iso: string) {
    const parts = isoParts(iso);
    if (!parts) return;
    shouldFocusRef.current = true;
    setFocusedIso(iso);
    if (parts.year !== view.year || parts.month !== view.month) {
      setView({ year: parts.year, month: parts.month });
    }
  }

  function shiftDays(iso: string, days: number): string {
    const parts = isoParts(iso);
    if (!parts) return iso;
    const stamp = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
    return toIso(stamp.getUTCFullYear(), stamp.getUTCMonth() + 1, stamp.getUTCDate());
  }

  function onGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const parts = isoParts(focusedIso);
    if (!parts) return;

    switch (event.key) {
      case "ArrowLeft": event.preventDefault(); moveFocus(shiftDays(focusedIso, -1)); return;
      case "ArrowRight": event.preventDefault(); moveFocus(shiftDays(focusedIso, 1)); return;
      case "ArrowUp": event.preventDefault(); moveFocus(shiftDays(focusedIso, -7)); return;
      case "ArrowDown": event.preventDefault(); moveFocus(shiftDays(focusedIso, 7)); return;
      case "Home": {
        event.preventDefault();
        moveFocus(shiftDays(focusedIso, -weekdayOf(parts.year, parts.month, parts.day)));
        return;
      }
      case "End": {
        event.preventDefault();
        moveFocus(shiftDays(focusedIso, 6 - weekdayOf(parts.year, parts.month, parts.day)));
        return;
      }
      case "PageUp": case "PageDown": {
        event.preventDefault();
        const delta = event.key === "PageUp" ? -1 : 1;
        const target = event.shiftKey
          ? { year: parts.year + delta, month: parts.month }
          : addMonths(parts.year, parts.month, delta);
        const day = Math.min(parts.day, daysInMonth(target.year, target.month));
        moveFocus(toIso(target.year, target.month, day));
        return;
      }
      case "Enter": case " ": {
        event.preventDefault();
        onSelect(focusedIso);
        onClose();
        return;
      }
      case "Escape": event.preventDefault(); onClose(); return;
      default: return;
    }
  }

  function step(delta: number) {
    setView((current) => addMonths(current.year, current.month, delta));
  }

  const heading = `${MONTH_NAMES[view.month - 1]} ${view.year}`;

  return (
    <div className={`${styles.calendar} ng-glass-popover`} role="dialog" aria-modal="false" aria-labelledby={labelledBy}>
      <div className={styles.calendarHead}>
        <button
          type="button"
          className={styles.calendarStep}
          onClick={() => step(-1)}
          aria-label={`Previous month, ${MONTH_NAMES[addMonths(view.year, view.month, -1).month - 1]} ${addMonths(view.year, view.month, -1).year}`}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none">
            <path d="M9 2 4 7l5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <p className={styles.calendarMonth} aria-live="polite">{heading}</p>

        <button
          type="button"
          className={styles.calendarStep}
          onClick={() => step(1)}
          aria-label={`Next month, ${MONTH_NAMES[addMonths(view.year, view.month, 1).month - 1]} ${addMonths(view.year, view.month, 1).year}`}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none">
            <path d="m5 2 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className={styles.calendarWeekdays} aria-hidden="true">
        {WEEKDAY_INITIALS.map((initial, index) => (
          <span key={WEEKDAY_NAMES[index]}>{initial}</span>
        ))}
      </div>

      <div
        className={styles.calendarGrid}
        role="grid"
        aria-label={`${heading}. Use the arrow keys to move between days.`}
        ref={gridRef}
        onKeyDown={onGridKeyDown}
      >
        {weeks.map((week) => (
          <div className={styles.calendarRow} role="row" key={week[0].iso}>
            {week.map((cell) => {
              const isSelected = cell.iso === value;
              const isToday = cell.iso === today;
              const isFocused = cell.iso === focusedIso;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  role="gridcell"
                  className={styles.calendarDay}
                  data-outside={cell.outside || undefined}
                  data-selected={isSelected || undefined}
                  data-today={isToday || undefined}
                  data-focused={isFocused || undefined}
                  aria-selected={isSelected}
                  aria-current={isToday ? "date" : undefined}
                  tabIndex={isFocused ? 0 : -1}
                  aria-label={`${readableIso(cell.iso)}${isToday ? ", today" : ""}`}
                  onFocus={() => setFocusedIso(cell.iso)}
                  onClick={() => {
                    onSelect(cell.iso);
                    onClose();
                  }}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className={styles.calendarFoot}>
        <button
          type="button"
          className={styles.calendarToday}
          onClick={() => {
            onSelect(today);
            onClose();
          }}
        >
          Today
        </button>
        <p className={styles.calendarSelected}>Selected {isoToDisplay(value)}</p>
      </div>
    </div>
  );
}
