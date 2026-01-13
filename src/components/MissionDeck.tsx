"use client";

import type React from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import styles from "../app/page.module.css";
import useLockBodyScroll from "./useLockBodyScroll";

type Card = {
  kicker: string;
  title: string;
  lines: string[];
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export default function MissionDeck({
  open,
  deckKey,
  onClose,
}: {
  open: boolean;
  deckKey: number;
  onClose: () => void;
}) {
  const cards: Card[] = useMemo(
    () => [
      {
        kicker: "Mission",
        title: "Cousins. North. Always learning.",
        lines: [
          "We’re Jaeden + Laith — cousins obsessed with the outdoors.",
          "We learn by doing. We earn every lesson.",
        ],
      },
      {
        kicker: "What we do",
        title: "Challenges, experiments, real field tests.",
        lines: [
          "Shelter builds, winter systems, navigation, fire, camp craft.",
          "Gear gets tested — we show what holds up.",
        ],
      },
      {
        kicker: "The vibe",
        title: "Cinematic footage. Honest results.",
        lines: ["No clumps of text. No fake survival.", "Just cold air, hard work, clean visuals."],
      },
    ],
    []
  );

  const active = open;

  useLockBodyScroll(active);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cardElsRef = useRef<(HTMLElement | null)[]>([]);

  const vhRef = useRef(800);
  const [viewportH, setViewportH] = useState(800);

  const [idx, setIdx] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [animating, setAnimating] = useState(false);

  const closingRef = useRef(false);

  useEffect(() => {
    const apply = () => {
      const h = window.innerHeight || 800;
      vhRef.current = h;
      setViewportH(h);
    };

    const id = requestAnimationFrame(apply);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);

    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    requestAnimationFrame(() => {
      const v = videoRef.current;
      if (!v) return;
      const p = v.play();
      if (p && typeof (p as Promise<void>).catch === "function") {
        (p as Promise<void>).catch(() => {});
      }
    });
  }, [active]);

  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const lastYRef = useRef(0);
  const lastTRef = useRef(0);
  const velRef = useRef(0);
  const wheelAccRef = useRef(0);

  const closeDeck = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;

    draggingRef.current = false;
    wheelAccRef.current = 0;

    onClose();

    window.setTimeout(() => {
      closingRef.current = false;
    }, 520);
  }, [onClose]);

  const goTo = useCallback(
    (next: number) => {
      if (!active || animating) return;

      const max = cards.length - 1;
      const clamped = clamp(next, 0, max);
      if (clamped === idx) return;

      setAnimating(true);
      setIdx(clamped);
      setOffsetY(0);

      window.setTimeout(() => setAnimating(false), 360);
    },
    [active, animating, cards.length, idx]
  );

  const commitDrag = useCallback(() => {
    if (!active || animating) return;

    const h = Math.max(520, vhRef.current);
    const threshold = h * 0.18;
    const flick = 900;

    const dy = offsetY;
    const v = velRef.current;

    if (dy < -threshold || v < -flick) {
      if (idx === cards.length - 1) closeDeck();
      else goTo(idx + 1);
      return;
    }

    if (dy > threshold || v > flick) {
      goTo(idx - 1);
      return;
    }

    setAnimating(true);
    setOffsetY(0);
    window.setTimeout(() => setAnimating(false), 260);
  }, [active, animating, cards.length, closeDeck, goTo, idx, offsetY]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!active || animating) return;

      draggingRef.current = true;
      startYRef.current = e.clientY;
      lastYRef.current = e.clientY;
      lastTRef.current = performance.now();
      velRef.current = 0;

      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [active, animating]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!active) return;
      if (!draggingRef.current) return;

      const now = performance.now();
      const dy = e.clientY - startYRef.current;

      const dt = Math.max(10, now - lastTRef.current);
      const step = e.clientY - lastYRef.current;
      velRef.current = (step / dt) * 1000;

      lastYRef.current = e.clientY;
      lastTRef.current = now;

      const h = Math.max(520, vhRef.current);
      const clamped = clamp(dy, -h * 0.42, h * 0.32);
      setOffsetY(clamped);
    },
    [active]
  );

  const onPointerUp = useCallback(() => {
    if (!active) return;
    if (!draggingRef.current) return;
    draggingRef.current = false;
    commitDrag();
  }, [active, commitDrag]);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!active || animating) return;

      e.preventDefault();

      wheelAccRef.current += e.deltaY;
      const h = Math.max(520, vhRef.current);
      const wheelThreshold = h * 0.12;

      if (wheelAccRef.current > wheelThreshold) {
        wheelAccRef.current = 0;
        goTo(idx + 1);
      } else if (wheelAccRef.current < -wheelThreshold) {
        wheelAccRef.current = 0;
        goTo(idx - 1);
      }
    },
    [active, animating, goTo, idx]
  );

  useEffect(() => {
    if (!active) return;

    const onKey = (e: KeyboardEvent) => {
      if (animating) return;

      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        if (idx === cards.length - 1) closeDeck();
        else goTo(idx + 1);
      }
      if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goTo(idx - 1);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeDeck();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, animating, cards.length, closeDeck, goTo, idx]);

  const softenDiv = Math.max(6, viewportH / 100);

  useLayoutEffect(() => {
    const els = cardElsRef.current;

    for (let i = 0; i < cards.length; i++) {
      const el = els[i];
      if (!el) continue;

      const rel = i - idx;
      const base = rel * 92;
      const y = base + (i === idx ? offsetY / softenDiv : 0);

      const opacity = rel === 0 ? 1 : rel === 1 || rel === -1 ? 0.6 : 0;
      const scale = rel === 0 ? 1 : 0.985;

      el.style.transform = `translate3d(-50%, calc(-50% + ${y}vh), 0) scale(${scale})`;
      el.style.opacity = String(opacity);
    }
  }, [cards, idx, offsetY, softenDiv]);

  return (
    <section
      id="deck"
      className={`${styles.deck} ${active ? styles.deckActive : ""}`}
      aria-label="Mission Deck"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      data-active={active ? "1" : "0"}
    >
      <div key={deckKey}>
        <video
          ref={videoRef}
          className={styles.deckVideo}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/hero.png"
        >
          <source src="/ngbcmobilebg.mp4" type="video/mp4" media="(max-width: 520px)" />
          <source src="/ngbcbg.mp4" type="video/mp4" />
        </video>

        <div className={styles.deckShade} aria-hidden="true" />

        <div className={styles.deckCards} aria-live="polite">
          {cards.map((c, i) => (
            <article
              ref={(el) => {
                cardElsRef.current[i] = el;
              }}
              key={c.title}
              className={`${styles.deckCard} ${i === idx ? styles.deckCardCurrent : ""}`}
            >
              <div className={styles.deckKickerRow}>
                <span className={styles.deckKicker}>{c.kicker}</span>
                <span className={styles.deckRule} />
              </div>

              <h2 className={styles.deckTitle}>{c.title}</h2>

              <div className={styles.deckLines}>
                {c.lines.map((line) => (
                  <p key={line} className={styles.deckLine}>
                    {line}
                  </p>
                ))}
              </div>

              <div className={styles.deckHint}>
                {i < cards.length - 1 ? "Swipe / scroll ↓" : "One more ↓ to exit"}
              </div>
            </article>
          ))}
        </div>

        <button
          type="button"
          className={styles.deckExit}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            closeDeck();
          }}
          aria-label="Exit deck"
        >
          Exit
        </button>
      </div>
    </section>
  );
}