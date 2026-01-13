"use client";

import styles from "../app/page.module.css";

export default function EnterButton({ onEnter }: { onEnter: () => void }) {
  return (
    <button
      id="enter-btn"
      type="button"
      className={styles.cta}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onEnter();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEnter();
        }
      }}
    >
      <span className={styles.ctaText}>Enter the North</span>

      <span className={`${styles.corner} ${styles.tl}`} />
      <span className={`${styles.corner} ${styles.tr}`} />
      <span className={`${styles.corner} ${styles.bl}`} />
      <span className={`${styles.corner} ${styles.br}`} />

      <span className={`${styles.trace} ${styles.traceTop}`} />
      <span className={`${styles.trace} ${styles.traceRight}`} />
      <span className={`${styles.trace} ${styles.traceBottom}`} />
      <span className={`${styles.trace} ${styles.traceLeft}`} />
    </button>
  );
}