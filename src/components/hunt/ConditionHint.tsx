"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { conditionDigest } from "../../lib/hunt/exploration/species-layer";
import { INTERFACE_LANGUAGE } from "../../lib/hunt/translation";
import type { ZoneSpeciesAnswer } from "../../lib/hunt/exploration/states";
import AuthorityText from "./sheet/AuthorityText";
import styles from "./HuntApp.module.css";

/**
 * What the `!` on a green zone means, in one glance.
 *
 * §41A: "the most important one to three conditions, with any remainder counted
 * rather than listed, and a path into the zone sheet where the complete sourced
 * answer already lives. The popover never duplicates the sheet."
 *
 * Every line here comes from `ZoneOpportunity.conditions`, which the regulatory
 * engine established — there is no hand-written map prose in this component,
 * and adding some would put a regulatory sentence in a React file (§57). The
 * only words this file owns are the heading, the "+n more" and the action.
 *
 * THE CONDITIONS THAT EARNED THE MARKER, and only those (`conditionDigest`):
 * the licence every zone shares is in the legend and the card, not here.
 *
 * IN THE READER'S LANGUAGE. A condition may be an authority's own French.
 * Where North Ground holds a reading, it is shown labelled, with the original
 * one control away (`AuthorityText`, §41A); where it holds none, the line is
 * counted into the remainder and read in the card, which carries the original
 * and its provenance. Untranslated French on a map would be unreadable, and a
 * translation without its original would be the authority's words rewritten.
 */
export default function ConditionHint({
  zoneKey,
  zoneLabel,
  answer,
  at,
  onClose,
  onOpenZone,
  surface,
}: {
  zoneKey: string;
  zoneLabel: string;
  answer: ZoneSpeciesAnswer;
  /** Canvas/container pixels of the indicator this belongs to. */
  at: { x: number; y: number };
  onClose: () => void;
  onOpenZone: (key: string) => void;
  /** The map's own size, so the popover is kept inside it. */
  surface: { width: number; height: number } | null;
}) {
  const ref = useRef<HTMLDivElement>(null);

  /* Escape closes and a tap outside closes, as every popover does. Focus moves
     in, so a keyboard reaches the conditions it just opened. */
  useEffect(() => {
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    const onDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  const { shown, further } = conditionDigest(answer, INTERFACE_LANGUAGE);
  const WIDTH = 248;
  const half = WIDTH / 2;
  const left = surface ? Math.min(Math.max(at.x, half + 8), Math.max(half + 8, surface.width - half - 8)) : at.x;

  /*
   * Above the indicator where there is room, below it where there is not —
   * decided by MEASURING the popover, not by guessing its height.
   *
   * A constant threshold put it at y = -39 the first time it opened over a
   * zone near the top of the map: the guess (150 px) was smaller than the
   * popover (190 px), so "there is room above" was false and the popover was
   * simply not on screen. Its content was correct and a screen reader could
   * read it, which is exactly why nothing else caught it.
   *
   * Placed imperatively because the measurement comes from the DOM: reading a
   * rendered height into React state to re-render with it is the cascading
   * effect React asks authors not to write. The element IS the external system
   * here, so the effect writes to it.
   */
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const height = element.offsetHeight;
    const below = at.y - height - 24 < 0;
    element.dataset.below = below ? "true" : "";
    /* Hidden until it has been placed, so it never flashes at the unmeasured
       position — which on a zone near the top of the map is off the screen. */
    element.style.visibility = "visible";
    element.style.top = `${below ? at.y + 20 : at.y - 16}px`;
    if (surface) {
      /* And never below the bottom edge either: a popover a thumb cannot reach
         is the same failure at the other end of the screen. */
      const overflow = (below ? at.y + 20 + height : at.y - 16) - (surface.height - 8);
      if (overflow > 0) element.style.top = `${Math.max(8, (below ? at.y + 20 : at.y - 16) - overflow)}px`;
    }
  });

  return (
    <div
      ref={ref}
      className={`${styles.conditionHint} ng-glass-overlay`}
      role="dialog"
      aria-label={`Conditions on the current hunting opportunity in ${zoneLabel}`}
      tabIndex={-1}
      /* `top` and `data-below` are set by the layout effect above, once the
         popover's real height is known. */
      style={{ left: `${left}px`, top: `${at.y}px`, width: `${WIDTH}px`, visibility: "hidden" }}
    >
      <p className={styles.conditionHintTitle}>A hunt is open here, with conditions</p>
      <ul className={styles.conditionHintList}>
        {shown.map((condition) => (
          <li key={condition.id} data-condition-id={condition.id}>
            {/* An authority's words are quoted and North Ground's are not; a
                reading is labelled. Both decided by the record, never guessed
                from the text (`limitation.ts`). */}
            <AuthorityText into={INTERFACE_LANGUAGE} text={{ text: condition.text, lang: condition.lang, owner: condition.owner }} />
          </li>
        ))}
      </ul>
      {further > 0 ? <p className={styles.conditionHintMore}>+{further} more in the zone&apos;s answer</p> : null}
      <button
        type="button"
        className={styles.conditionHintAction}
        onClick={() => { onOpenZone(zoneKey); onClose(); }}
      >
        View details
      </button>
    </div>
  );
}
