import assert from "node:assert/strict";
import test from "node:test";
import {
  bandHasMoved, closingShouldBlur, submitsOnEnter, UNMEASURED_BAND, visibleBand,
} from "./viewport.ts";

/* An iPhone 13/14/15 in portrait, and the same phone with the keyboard up.
   The numbers are the ones measured on the device, not invented. */
const CLOSED = { innerHeight: 812, viewportHeight: 812, viewportTop: 0 };
const KEYBOARD = { innerHeight: 812, viewportHeight: 470, viewportTop: 150 };

test("a keyboard moves BOTH edges, and compensating for one is the defect", () => {
  const band = visibleBand(KEYBOARD);
  assert.deepEqual(band, { top: 150, height: 470, bottom: 192 });
  /* The defect this exists to prevent: the shell was inset by the bottom only,
     so it spanned [0, 620] while the band was [150, 620] — its top 150px above
     the screen (the header pushed away) and 150px of uncovered ground at the
     bottom (the black strip). Both numbers come from the same omission. */
  const bottomOnly = { top: 0, height: band.height, bottom: KEYBOARD.innerHeight - band.height };
  assert.equal(bottomOnly.top, 0, "the broken shell starts at the layout viewport's top");
  assert.equal(band.top - bottomOnly.top, 150, "which is 150px above what the hunter can see");
  assert.notEqual(bottomOnly.bottom, band.bottom, "and leaves a strip at the bottom with nothing in it");
});

test("the band with no keyboard is the whole screen", () => {
  assert.deepEqual(visibleBand(CLOSED), { top: 0, height: 812, bottom: 0 });
});

test("a browser without visualViewport reports the layout viewport, which is correct there", () => {
  assert.deepEqual(visibleBand({ innerHeight: 900 }), { top: 0, height: 900, bottom: 0 });
});

test("the bottom never goes negative, however the two viewports disagree", () => {
  // Reported on some browsers mid-animation: a visual viewport taller than the layout one.
  const band = visibleBand({ innerHeight: 800, viewportHeight: 900, viewportTop: 0 });
  assert.equal(band.bottom, 0);
});

test("a stream of resize frames is not a layout change, but a keyboard is", () => {
  const settled = visibleBand(CLOSED);
  // iOS emits the toolbar's animation as many small resizes; following them is the stutter.
  assert.equal(bandHasMoved(settled, visibleBand({ ...CLOSED, viewportHeight: 800 })), false, "12px of height");
  assert.equal(bandHasMoved(settled, visibleBand({ ...CLOSED, viewportHeight: 786 })), true, "26px of height");
  // The top is held tighter: a small scroll of the visual viewport moves the WHOLE shell.
  assert.equal(bandHasMoved(settled, visibleBand({ ...CLOSED, viewportTop: 6 })), false);
  assert.equal(bandHasMoved(settled, visibleBand({ ...CLOSED, viewportTop: 10 })), true);
  // A keyboard is never missed.
  assert.equal(bandHasMoved(settled, visibleBand(KEYBOARD)), true);
  // And the first reading of all always counts, so nothing waits for a second event.
  assert.equal(bandHasMoved(UNMEASURED_BAND, visibleBand(CLOSED)), true);
});

test("Enter submits, except while an IME is composing", () => {
  assert.equal(submitsOnEnter({ key: "Enter" }), true);
  assert.equal(submitsOnEnter({ key: "a" }), false);
  /* The defect: an IME uses Enter to COMMIT the characters being composed, so
     this arrives as a plain Enter. Submitting on it searched for half a word
     and took the keyboard away mid-sentence. */
  assert.equal(submitsOnEnter({ key: "Enter", isComposing: true }), false);
  assert.equal(submitsOnEnter({ key: "Enter", keyCode: 229 }), false, "browsers older than isComposing");
  assert.equal(submitsOnEnter({ key: "Enter", isComposing: false, keyCode: 13 }), true);
});

test("closing the search blurs, and nothing else does", () => {
  assert.equal(closingShouldBlur(true, false), true, "the open -> closed edge");
  /* The rule this protects: a hunter who swipes the keyboard down and then taps
     the field again must get the keyboard back. Blurring whenever the composer
     is closed would take it away again on the next render. */
  assert.equal(closingShouldBlur(false, false), false, "already closed is not an edge");
  assert.equal(closingShouldBlur(false, true), false, "opening never blurs");
  assert.equal(closingShouldBlur(true, true), false, "still open never blurs");
});
