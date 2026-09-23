"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { dragHeight, resolveSnap, stepSnap, type SheetHeights, type SheetSnap } from "../../lib/hunt/exploration/sheet";
import styles from "./HuntApp.module.css";

/**
 * The one contextual surface: a bottom sheet on phones, a floating panel on
 * wider screens. Same content, same order, same state.
 *
 * On a phone the sheet rests at peek, half or full. It is dragged by its grabber
 * and header at any height, and by its whole face while it is not yet full —
 * a drag only begins after the finger has moved, so every button in it still
 * taps. At full, its body scrolls and the header lowers it. A focused control
 * that sits below the visible part raises the sheet to full, so the keyboard
 * never lands on something hidden.
 */

interface HuntSheetProps {
  layout: "sheet" | "panel";
  snap: SheetSnap;
  heights: SheetHeights | null;
  onSnap: (snap: SheetSnap) => void;
  /** Names the region for assistive technology. */
  label: string;
  /** Grabber-row content: always visible, and the drag handle at full height. */
  header?: ReactNode;
  children: ReactNode;
}

const DRAG_THRESHOLD_PX = 6;

export default function HuntSheet({ layout, snap, heights, onSnap, label, header, children }: HuntSheetProps) {
  const sheetRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  /* The sheet is full height and slid down, so only `--sheet-h` of it shows.
     The body is told what that leaves, or its lower half sits off-screen where
     nothing can reach it — which is what hid the actions at peek and half. */
  useEffect(() => {
    const header = headerRef.current;
    const sheet = sheetRef.current;
    if (!header || !sheet) return;
    const measure = () => sheet.style.setProperty("--sheet-head", `${Math.round(header.getBoundingClientRect().height)}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  const suppressClickUntilRef = useRef(0);
  const dragRef = useRef<{
    id: number; startY: number; startHeight: number; lastY: number; lastT: number; velocity: number; active: boolean;
    inBody: boolean; scrollable: boolean;
  } | null>(null);

  const isSheet = layout === "sheet";

  const setLiveHeight = useCallback((height: number | null) => {
    const element = sheetRef.current;
    if (!element) return;
    if (height === null) element.style.removeProperty("--sheet-h");
    else element.style.setProperty("--sheet-h", `${Math.round(height)}px`);
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (!isSheet || !heights) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const inHeader = headerRef.current?.contains(event.target as Node) ?? false;
    // Text fields take their own gestures.
    if ((event.target as HTMLElement).closest("input, textarea, select, [data-no-drag]")) return;
    const body = bodyRef.current;
    const inBody = !inHeader && (body?.contains(event.target as Node) ?? false);
    dragRef.current = {
      id: event.pointerId, startY: event.clientY, startHeight: heights[snap],
      lastY: event.clientY, lastT: event.timeStamp, velocity: 0, active: false,
      // Reading has the first claim on a gesture that starts in the body.
      inBody, scrollable: inBody && body ? body.scrollHeight - body.clientHeight > 2 : false,
    };
  }, [isSheet, heights, snap]);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId || !heights) return;
    const delta = drag.startY - event.clientY;
    if (!drag.active) {
      if (Math.abs(delta) < DRAG_THRESHOLD_PX) return;
      /* Inside scrollable content the gesture is a scroll — until the content
         is at its top and the hand pulls down, which lowers the sheet. */
      if (drag.inBody && drag.scrollable) {
        const atTop = (bodyRef.current?.scrollTop ?? 0) <= 0;
        if (!(atTop && delta < 0)) {
          dragRef.current = null;
          return;
        }
      }
      drag.active = true;
      sheetRef.current?.setPointerCapture(event.pointerId);
      sheetRef.current?.setAttribute("data-dragging", "true");
    }
    const elapsed = Math.max(1, event.timeStamp - drag.lastT);
    // Smoothed, so one jittery sample does not decide a flick.
    drag.velocity = drag.velocity * 0.4 + ((drag.lastY - event.clientY) / elapsed) * 0.6;
    drag.lastY = event.clientY;
    drag.lastT = event.timeStamp;
    setLiveHeight(dragHeight(heights, drag.startHeight, delta));
  }, [heights, setLiveHeight]);

  const endDrag = useCallback((event: React.PointerEvent<HTMLElement>, cancelled: boolean) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    dragRef.current = null;
    if (!drag.active || !heights) return;
    sheetRef.current?.removeAttribute("data-dragging");
    suppressClickUntilRef.current = Date.now() + 250;
    const height = dragHeight(heights, drag.startHeight, drag.startY - event.clientY);
    setLiveHeight(null);
    onSnap(cancelled ? snap : resolveSnap(heights, height, drag.velocity));
  }, [heights, onSnap, setLiveHeight, snap]);

  /* A drag that ends over a button must not also press it. */
  useEffect(() => {
    const element = sheetRef.current;
    if (!element) return;
    const swallow = (event: MouseEvent) => {
      if (Date.now() < suppressClickUntilRef.current) {
        event.stopPropagation();
        event.preventDefault();
      }
    };
    element.addEventListener("click", swallow, true);
    return () => element.removeEventListener("click", swallow, true);
  }, []);

  /* Keyboard focus never lands on something below the visible part of the sheet. */
  const onFocusCapture = useCallback((event: React.FocusEvent<HTMLElement>) => {
    if (!isSheet || snap === "full") return;
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    if (rect.bottom > window.innerHeight - 4) onSnap("full");
  }, [isSheet, snap, onSnap]);

  /* Closed is a real state, so the control that reopens it says what it does
     rather than inheriting the grabber's wording. */
  const closed = isSheet && snap === "closed";
  const grabberLabel = closed ? "Open the panel" : snap === "full" ? "Lower the panel" : "Raise the panel";

  return (
    <section
      ref={sheetRef}
      className={`${styles.sheet} ng-glass-popover`}
      data-layout={layout}
      data-snap={isSheet ? snap : undefined}
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => endDrag(event, false)}
      onPointerCancel={(event) => endDrag(event, true)}
      onFocusCapture={onFocusCapture}
    >
      <div className={styles.sheetHeader} ref={headerRef}>
        {isSheet && heights ? (
          <button
            type="button"
            className={styles.grabber}
            aria-label={grabberLabel}
            aria-expanded={snap !== "closed" && snap !== "peek"}
            onClick={() => onSnap(snap === "full" ? stepSnap(heights, snap, -1) : stepSnap(heights, snap, 1))}
          >
            <span aria-hidden="true" />
          </button>
        ) : null}
        {/* Closed shows the pill and nothing else: the header would otherwise
            keep naming a card the hunter has just dismissed. */}
        {closed ? null : header}
      </div>
      <div className={styles.sheetBody} ref={bodyRef} data-scroll="true" hidden={closed || undefined}>
        {children}
      </div>
    </section>
  );
}
