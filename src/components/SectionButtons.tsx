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

export default function SectionButtons() {
  return (
    <div className={styles.ctaRow}>
      {/* Replace href once you have the real channel URL */}
      <a className={`${styles.ctaAlt}`} href="#" aria-label="Watch the latest video">
        Watch the Latest
      </a>

      <button
        type="button"
        className={`${styles.ctaAlt} ${styles.ctaAltGhost}`}
        onClick={() => scrollToId("crew", 520)}
      >
        Learn More
      </button>
    </div>
  );
}