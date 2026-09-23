"use client";

import { useEffect, useState } from "react";
import styles from "./HuntApp.module.css";

/**
 * A small nudge toward Find Game, and then it stops.
 *
 * Find Game answers a question nothing else on this screen answers — "where
 * can I hunt THIS" rather than "what can I hunt here" — and a buck on a map
 * control does not say that on its own. So it says it, once in a while.
 *
 * The rules that keep a hint from becoming nagging, all of them deliberate:
 *
 * - It waits for a quiet map. Appearing over someone mid-search is an
 *   interruption, not a hint.
 * - It appears at most three times ON THIS DEVICE, ever, and never again once
 *   Find Game has been used. The count is a per-viewer convenience, kept in
 *   the browser like a remembered tab; it is never sent anywhere.
 * - It bounces only where motion is welcome. `prefers-reduced-motion` gets the
 *   same hint, still.
 * - It is a real button, so a keyboard reaches it and a screen reader is told
 *   what it does — not a decoration announcing itself.
 * - It sits beside the control it points at, clear of the map's attribution:
 *   a hint that covers a licence term is worse than no hint.
 */

const KEY = "north-ground.hunt.hint.find-game.v1";
const MAX_SHOWINGS = 3;
const QUIET_BEFORE_MS = 9_000;
/* Long enough to notice it, read it and reach it. Under eight seconds a
   hunter glancing up from the map can lose it mid-reach, which makes a hint
   into a flicker. */
const VISIBLE_MS = 12_000;

function seen(): number {
  try {
    const raw = window.localStorage.getItem(KEY);
    const count = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(count) ? count : 0;
  } catch {
    /* A browser that does not remember simply sees the hint again. */
    return 0;
  }
}

function remember(count: number): void {
  try { window.localStorage.setItem(KEY, String(count)); } catch { /* not remembering is fine */ }
}

/** Once Find Game has been used, the hint has done its job for good. */
export function retireFindGameHint(): void {
  remember(MAX_SHOWINGS);
}

/**
 * `Start over` leaves NOTHING behind (§41A), and this counter is part of
 * nothing. Exempting it would have been the easier change and the wrong one:
 * the promise is that the device is clean afterwards, not that it is clean
 * except for the things we found convenient to keep.
 */
export function forgetFindGameHint(): void {
  try { window.localStorage.removeItem(KEY); } catch { /* nothing to forget */ }
}

export default function FindGameHint({ active, onOpen }: { active: boolean; onOpen: () => void }) {
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    if (!active) return;
    const count = seen();
    if (count >= MAX_SHOWINGS) return;
    const appear = window.setTimeout(() => {
      setShowing(true);
      remember(count + 1);
    }, QUIET_BEFORE_MS);
    return () => window.clearTimeout(appear);
  }, [active]);

  useEffect(() => {
    if (!showing) return;
    const hide = window.setTimeout(() => setShowing(false), VISIBLE_MS);
    return () => window.clearTimeout(hide);
  }, [showing]);

  /* The hint goes the moment the thing it points at is no longer offered. */
  useEffect(() => { if (!active) setShowing(false); }, [active]);

  if (!showing) return null;
  return (
    <button
      type="button"
      className={styles.findGameHint}
      onClick={() => { setShowing(false); retireFindGameHint(); onOpen(); }}
    >
      Find game
      <span className={styles.findGameHintTail} aria-hidden="true" />
    </button>
  );
}
