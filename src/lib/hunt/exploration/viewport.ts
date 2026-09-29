/**
 * The band a phone can actually show, and the rules about when it has moved.
 *
 * This is the one piece of arithmetic behind the mobile keyboard, extracted so
 * it can be tested without a browser. It used to live inline in `HuntApp`,
 * where the only thing that could exercise it was a full Playwright run — so a
 * regression in it shipped with a green `npm test`.
 *
 * THE FACT IT ENCODES: a phone keyboard does two things at once. It shrinks the
 * visual viewport AND scrolls it down, so `visualViewport.offsetTop` becomes
 * non-zero. A `position: fixed` shell is fixed to the LAYOUT viewport, which
 * never moves, so compensating for the height alone leaves the shell's top
 * above the visible area and its bottom short of it. Both edges or neither.
 */

export interface VisibleBand {
  /** Distance from the layout viewport's top to the first visible row. */
  top: number;
  /** How tall the visible band is. */
  height: number;
  /** Distance from the band's last visible row to the layout viewport's bottom. */
  bottom: number;
}

export interface ViewportReading {
  /** `window.innerHeight` — the LAYOUT viewport, which a keyboard does not change. */
  innerHeight: number;
  /** `visualViewport.height`, when the browser has one. */
  viewportHeight?: number;
  /** `visualViewport.offsetTop`, when the browser has one. */
  viewportTop?: number;
}

/**
 * The band, from a reading of the two viewports.
 *
 * A browser without `visualViewport` reports the layout viewport, which is the
 * correct answer there: with nothing to tell us otherwise, everything is
 * visible.
 */
export function visibleBand({ innerHeight, viewportHeight, viewportTop }: ViewportReading): VisibleBand {
  const height = Math.round(viewportHeight ?? innerHeight);
  const top = Math.round(viewportTop ?? 0);
  return { top, height, bottom: Math.max(0, innerHeight - top - height) };
}

/**
 * Whether a new reading is worth re-laying-out for.
 *
 * iOS reports a toolbar sliding, and a keyboard opening, as a STREAM of
 * resizes. Following every one of them is the stutter; a threshold keeps the
 * real changes — rotation, a settled keyboard, a settled toolbar — and drops
 * the frames of an animation. The top is held to a tighter threshold than the
 * height because a small scroll of the visual viewport moves the whole shell,
 * while a few pixels of height change nothing anyone can see.
 */
const HEIGHT_THRESHOLD_PX = 24;
const TOP_THRESHOLD_PX = 8;

export function bandHasMoved(previous: VisibleBand, next: VisibleBand): boolean {
  return Math.abs(next.height - previous.height) > HEIGHT_THRESHOLD_PX
    || Math.abs(next.top - previous.top) > TOP_THRESHOLD_PX;
}

/** A band nothing has measured yet, so the first reading always counts as movement. */
export const UNMEASURED_BAND: VisibleBand = { top: -1, height: -1, bottom: -1 };

/**
 * Whether an Enter keypress should submit.
 *
 * An IME — Japanese, Chinese and Korean input, and a phone's own predictive
 * keyboard — uses Enter to COMMIT the characters being composed, and that
 * keystroke arrives as a plain Enter. Submitting on it searches for half a word
 * and takes the keyboard away while someone is still typing. `isComposing` is
 * the platform's own answer; keyCode 229 is how browsers said the same thing
 * before it existed.
 */
export function submitsOnEnter(event: { key: string; isComposing?: boolean; keyCode?: number }): boolean {
  if (event.key !== "Enter") return false;
  return !event.isComposing && event.keyCode !== 229;
}

/**
 * Whether closing the composer should take the keyboard with it.
 *
 * Only on the open -> closed EDGE. Blurring whenever it is closed would fight a
 * hunter who has swiped the keyboard down and then tapped the field again,
 * which is the one thing the owner asked us not to do: an interactive
 * dismissal is a decision, and the app does not get to overrule it.
 */
export function closingShouldBlur(wasOpen: boolean, isOpen: boolean): boolean {
  return wasOpen && !isOpen;
}
