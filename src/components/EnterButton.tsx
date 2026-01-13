"use client";

import styles from "../app/page.module.css";

export default function EnterButton() {
  const onClick = () => {
    // Set the overlay state immediately (so you see an instant response)
    document.documentElement.dataset.deck = "1";

    // Dispatch on next frame so MissionDeck's listener is definitely attached
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("ngbc:enterDeck"));
    });
  };

  return (
    <button id="enter-btn" type="button" className={styles.cta} onClick={onClick}>
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