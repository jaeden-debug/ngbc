"use client";

import { useId } from "react";
import type { RequiredDimension } from "../../lib/hunt/regulatory/dimensions";
import styles from "./Hunt.module.css";

/**
 * The one outstanding fact, asked in the hunter's terms.
 *
 * This appears only when North Ground already holds the applicable rules and
 * cannot finish without something only the hunter knows. That distinction is the
 * whole point of the component: it is not an error state and not a gap in
 * coverage, so it never borrows the vocabulary of either. The engine decides
 * what to ask — nothing here declares a form per species.
 *
 * The reason is always shown. A person asked for their residency deserves to
 * know it is because the province publishes different dates for residents and
 * non-residents, not because a form wanted a field filled.
 */
export default function HuntQuestion({
  dimension,
  answered,
  onAnswer,
  disabled,
}: {
  dimension: RequiredDimension;
  /** Answers already given, so the sequence can show what it has. */
  answered: Array<{ question: string; answer: string }>;
  onAnswer: (dimensionId: string, value: string) => void;
  disabled: boolean;
}) {
  const headingId = useId();

  return (
    <section className={`${styles.question} ng-glass-panel`} aria-labelledby={headingId}>
      <p className="ng-eyebrow">One more fact</p>
      <h3 className={styles.questionTitle} id={headingId}>{dimension.question}</h3>
      <p className={styles.questionReason}>{dimension.reason}</p>

      {answered.length > 0 ? (
        <ul className={styles.questionAnswered}>
          {answered.map((entry) => (
            <li key={entry.question}>
              <span className={styles.questionAnsweredLabel}>{entry.question}</span>
              <strong>{entry.answer}</strong>
            </li>
          ))}
        </ul>
      ) : null}

      {/* A radiogroup rather than a listbox: these are mutually exclusive facts
          about one hunt, and only a value the dimension offered is ever sent. */}
      <div className={styles.questionOptions} role="radiogroup" aria-labelledby={headingId}>
        {dimension.options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={false}
            className={`${styles.questionOption} ng-glass-card`}
            disabled={disabled}
            onClick={() => onAnswer(dimension.id, option.value)}
          >
            <span className={styles.questionOptionLabel}>{option.label}</span>
            {option.detail ? <span className={styles.questionOptionDetail}>{option.detail}</span> : null}
          </button>
        ))}
      </div>

      <p className={styles.questionSource}>
        {/* Traceable, like every other regulatory statement in Hunt. */}
        This distinction comes from {dimension.sourceSection
          ? `${dimension.sourceSection}, `
          : ""}the official source behind this result. Your answer selects which
        published rule applies — North Ground does not verify it.
      </p>
    </section>
  );
}
