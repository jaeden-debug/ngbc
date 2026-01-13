"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const vhRef = useRef(800);

  const [idx, setIdx] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const closingRef = useRef(false);

  // Decide “mobile” for swipe: coarse pointers (phones/tablets) OR narrow screens
  useEffect(() => {
    const apply = () => {
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const narrow = window.matchMedia("(max-width: 820px)").matches;
      setIsMobile(coarse || narrow);

      const h = window.innerHeight || 800;
      vhRef.current = h;
    };

    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);

  // Reset when opened / remounted
  useEffect(() => {
    if (!active) return;
    setIdx(0);
    setOffsetY(0);
    setAnimating(false);
  }, [active, deckKey]);

  // Ensure video starts when overlay opens
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

  const closeDeck = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;

    onClose();

    window.setTimeout(() => {
      closingRef.current = false;
    }, 520);
  }, [onClose]);

  const goTo = useCallback(
    (next: number) => {
      if (!active || animating) return;

      const max = cards.length - 1;

      // allow "next" on last card to close
      if (next > max) {
        closeDeck();
        return;
      }

      const clamped = clamp(next, 0, max);
      if (clamped === idx) return;

      setAnimating(true);
      setIdx(clamped);
      setOffsetY(0);

      window.setTimeout(() => setAnimating(false), 260);
    },
    [active, animating, cards.length, closeDeck, idx]
  );

  const prev = useCallback(() => goTo(idx - 1), [goTo, idx]);
  const next = useCallback(() => goTo(idx + 1), [goTo, idx]);

  // --- Mobile swipe (only when isMobile) ---
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const lastYRef = useRef(0);
  const lastTRef = useRef(0);
  const velRef = useRef(0);

  const isInteractiveTarget = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    if (!el) return false;
    return Boolean(el.closest("button, a, input, textarea, select, label"));
  };

  const commitDrag = useCallback(() => {
    if (!active || animating) return;

    const h = Math.max(520, vhRef.current);
    const threshold = h * 0.16;
    const flick = 900;

    const dy = offsetY;
    const v = velRef.current;

    if (dy < -threshold || v < -flick) {
      next();
      return;
    }

    if (dy > threshold || v > flick) {
      prev();
      return;
    }

    setAnimating(true);
    setOffsetY(0);
    window.setTimeout(() => setAnimating(false), 220);
  }, [active, animating, next, prev, offsetY]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!active || animating) return;
      if (!isMobile) return; // swipe only on mobile
      if (isInteractiveTarget(e.target)) return;

      draggingRef.current = true;
      startYRef.current = e.clientY;
      lastYRef.current = e.clientY;
      lastTRef.current = performance.now();
      velRef.current = 0;

      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [active, animating, isMobile]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!active) return;
      if (!isMobile) return;
      if (!draggingRef.current) return;

      const now = performance.now();
      const dy = e.clientY - startYRef.current;

      const dt = Math.max(10, now - lastTRef.current);
      const step = e.clientY - lastYRef.current;
      velRef.current = (step / dt) * 1000;

      lastYRef.current = e.clientY;
      lastTRef.current = now;

      const h = Math.max(520, vhRef.current);
      const clamped = clamp(dy, -h * 0.36, h * 0.28);
      setOffsetY(clamped);
    },
    [active, isMobile]
  );

  const onPointerUp = useCallback(() => {
    if (!active) return;
    if (!isMobile) return;
    if (!draggingRef.current) return;

    draggingRef.current = false;
    commitDrag();
  }, [active, isMobile, commitDrag]);

  // Keyboard (optional but simple + reliable)
  useEffect(() => {
    if (!active) return;

    const onKey = (e: KeyboardEvent) => {
      if (animating) return;

      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        next();
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        prev();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeDeck();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, animating, closeDeck, next, prev]);

  // Layout math for card positions (kept simple)
  const softenDiv = 10; // stable

  return (
    <section
      id="deck"
      className={`${styles.deck} ${active ? styles.deckActive : ""}`}
      aria-label="Mission Deck"
      data-active={active ? "1" : "0"}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
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
          {cards.map((c, i) => {
            const rel = i - idx;
            const base = rel * 92;
            const y = base + (i === idx ? offsetY / softenDiv : 0);

            const opacity = rel === 0 ? 1 : rel === 1 || rel === -1 ? 0.6 : 0;
            const scale = rel === 0 ? 1 : 0.985;

            return (
              <article
                key={c.title}
                className={`${styles.deckCard} ${i === idx ? styles.deckCardCurrent : ""}`}
                style={{
                  transform: `translate3d(-50%, calc(-50% + ${y}vh), 0) scale(${scale})`,
                  opacity,
                }}
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
                  {!isMobile ? "Use arrows →" : i < cards.length - 1 ? "Swipe ↑ / ↓" : "Swipe up once more to exit"}
                </div>
              </article>
            );
          })}
        </div>

        {/* Desktop arrows */}
        {!isMobile && (
          <>
            <button
              type="button"
              className={`${styles.deckNavArrow} ${styles.deckNavLeft}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                prev();
              }}
              aria-label="Previous card"
              disabled={idx === 0}
            >
              <span className={styles.deckNavIcon} aria-hidden="true">
                ‹
              </span>
            </button>

            <button
              type="button"
              className={`${styles.deckNavArrow} ${styles.deckNavRight}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                next();
              }}
              aria-label={idx === cards.length - 1 ? "Close deck" : "Next card"}
            >
              <span className={styles.deckNavIcon} aria-hidden="true">
                ›
              </span>
            </button>
          </>
        )}

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