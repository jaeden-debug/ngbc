"use client";

import styles from "../app/page.module.css";

export default function EnterButton() {
  const onClick = () => {
    // Flip the UI state immediately (CSS transition for Hero + Deck overlay)
    document.documentElement.dataset.deck = "1";

    // Tell MissionDeck to activate (start video, enable card controls)
    window.dispatchEvent(new Event("ngbc:enterDeck"));
  };

  return (
    <button
      id="enter-btn"
      type="button"
      className={styles.cta}
      onClick={onClick}
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