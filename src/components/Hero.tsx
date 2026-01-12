"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../app/page.module.css";
import EnterButton from "./EnterButton";

export default function Hero() {
  const ref = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!canHover.matches) return;

    const onMove = (e: PointerEvent) => {
      if (!ref.current) return;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        const r = ref.current!.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 100;
        const y = ((e.clientY - r.top) / r.height) * 100;

        const cx = Math.max(10, Math.min(90, x));
        const cy = Math.max(10, Math.min(90, y));

        ref.current!.style.setProperty("--cx", `${cx}%`);
        ref.current!.style.setProperty("--cy", `${cy}%`);
      });
    };

    const onLeave = () => {
      if (!ref.current) return;
      ref.current.style.setProperty("--cx", "50%");
      ref.current.style.setProperty("--cy", "40%");
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
    <section
      ref={ref}
      className={styles.hero}
      aria-label="Hero"
      data-video-ready={videoReady ? "1" : "0"}
      data-video-failed={videoFailed ? "1" : "0"}
    >
      {/* VIDEO LAYER */}
      {!videoFailed && (
        <video
          className={styles.heroVideo}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onCanPlay={() => setVideoReady(true)}
          onPlaying={() => setVideoReady(true)}
          onError={() => setVideoFailed(true)}
        >
          <source src="/ngbc.mp4" type="video/mp4" />
        </video>
      )}

      {/* PNG FALLBACK (only when video fails OR until video is ready) */}
      <div className={styles.heroImgFallback} aria-hidden="true" />

      <div className={styles.heroShade} />
      <div className={styles.cursorFx} />

      <div className={styles.heroInner}>
        <EnterButton />
      </div>

      <div className={styles.scrollHint} aria-hidden="true">
        <span className={styles.scrollLine} />
      </div>
    </section>
  );
}