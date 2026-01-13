"use client";

import { useEffect, useRef } from "react";
import styles from "../app/page.module.css";
import EnterButton from "./EnterButton";

export default function Hero() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!canHover.matches) return;

    el.style.setProperty("--cx", "50%");
    el.style.setProperty("--cy", "42%");
    el.style.setProperty("--px", "0px");
    el.style.setProperty("--py", "0px");

    const onMove = (e: PointerEvent) => {
      if (!sectionRef.current) return;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        const r = sectionRef.current!.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;

        const cx = Math.max(0.08, Math.min(0.92, x)) * 100;
        const cy = Math.max(0.08, Math.min(0.92, y)) * 100;

        const dx = (x - 0.5) * -14;
        const dy = (y - 0.5) * -10;

        sectionRef.current!.style.setProperty("--cx", `${cx.toFixed(2)}%`);
        sectionRef.current!.style.setProperty("--cy", `${cy.toFixed(2)}%`);
        sectionRef.current!.style.setProperty("--px", `${dx.toFixed(2)}px`);
        sectionRef.current!.style.setProperty("--py", `${dy.toFixed(2)}px`);
      });
    };

    const onLeave = () => {
      if (!sectionRef.current) return;
      sectionRef.current.style.setProperty("--cx", "50%");
      sectionRef.current.style.setProperty("--cy", "42%");
      sectionRef.current.style.setProperty("--px", "0px");
      sectionRef.current.style.setProperty("--py", "0px");
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);

    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <section ref={sectionRef} className={styles.hero} aria-label="Hero">
      <video
        className={styles.heroVideo}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/hero.png"
        webkit-playsinline="true"
      >
        <source
          src={process.env.NEXT_PUBLIC_HERO_MOBILE}
          type="video/mp4"
          media="(max-width: 520px)"
        />
        <source
          src={process.env.NEXT_PUBLIC_HERO_DESKTOP}
          type="video/mp4"
        />
      </video>

      <div className={styles.heroShade} />
      <div className={styles.cursorFx} />

      <div className={styles.heroInner}>
        <div className={styles.heroCtaStack}>
          <p className={styles.heroTagline}>
            Learning the land, one trip at a time.
          </p>
          <EnterButton />
        </div>
      </div>

      <div className={styles.scrollHint} aria-hidden="true">
        <span className={styles.scrollLine} />
      </div>
    </section>
  );
}