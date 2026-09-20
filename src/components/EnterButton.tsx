"use client";

import Link from "next/link";
import styles from "../app/page.module.css";

/**
 * The homepage's one big move.
 *
 * "Enter the North" now goes straight into Hunt. It used to open the mission deck,
 * which is still reachable from the quieter control beneath it — the headline
 * action belongs to the product a visitor came to use, not to an introduction.
 */
export default function EnterButton({ onStory }: { onStory: () => void }) {
  return (
    <>
      <Link id="enter-btn" className={styles.cta} href="/hunt">
        <span className={styles.ctaText}>Enter the North</span>

        <span className={`${styles.corner} ${styles.tl}`} />
        <span className={`${styles.corner} ${styles.tr}`} />
        <span className={`${styles.corner} ${styles.bl}`} />
        <span className={`${styles.corner} ${styles.br}`} />

        <span className={`${styles.trace} ${styles.traceTop}`} />
        <span className={`${styles.trace} ${styles.traceRight}`} />
        <span className={`${styles.trace} ${styles.traceBottom}`} />
        <span className={`${styles.trace} ${styles.traceLeft}`} />
      </Link>

      <button id="story-btn" type="button" className={styles.heroSecondary} onClick={onStory}>
        Who we are
      </button>
    </>
  );
}
