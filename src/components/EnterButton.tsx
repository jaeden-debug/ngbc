"use client";

import styles from "../app/page.module.css";

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function scrollToId(id: string, duration = 520) {
  const el = document.getElementById(id);
  if (!el) return;

  const start = window.scrollY;
  const end = el.getBoundingClientRect().top + window.scrollY;
  const diff = end - start;

  const t0 = performance.now();

  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / duration);
    const eased = easeOutCubic(t);
    window.scrollTo(0, start + diff * eased);
    if (t < 1) requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}

export default function EnterButton() {
  const onClick = () => {
    scrollToId("deck", 520);

    // Activate deck after scroll starts so it feels like a transition
    window.setTimeout(() => {
      window.dispatchEvent(new Event("ngbc:enterDeck"));
    }, 200);
  };

  return (
    <button type="button" className={styles.cta} onClick={onClick}>
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