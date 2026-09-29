import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * The mobile composer's layout invariants, asserted against the source.
 *
 * WHY THE SOURCE AND NOT A RENDER. The regression was a pair of CSS `order`
 * declarations in a CSS Module: with the composer open on a phone the field
 * took `order: 1` and the results scroller `order: 0`, so the input was drawn
 * LAST — on the visible bottom edge, immediately above the keyboard. jsdom
 * applies no CSS Module and computes no layout, so a component test renders
 * that defect and sees nothing wrong; a browser run is the only other witness
 * and it did not catch it either, because the anchoring was deliberate at the
 * time.
 *
 * So these assert the INVARIANTS that make the layout impossible to reinstate,
 * not pixels or offsets. Owner, 2026-09-29, reproduced on iPhone Safari: the
 * field must keep its place and the keyboard must only take viewport away.
 */

const css = readFileSync("src/components/hunt/HuntApp.module.css", "utf8");
const composer = readFileSync("src/components/hunt/sheet/PlaceComposer.tsx", "utf8");
const app = readFileSync("src/components/hunt/HuntApp.tsx", "utf8");
const sheet = readFileSync("src/components/hunt/HuntSheet.tsx", "utf8");

/**
 * Every rule that applies while the phone composer is open, WITHOUT comments.
 *
 * The comments are stripped because the first version of this test matched its
 * own prose: the block above explains the defect by quoting `order: 1`, and a
 * scan of the raw file found that and failed. A detector that reads commentary
 * as code is the same mistake as one that reads an English sentence's French
 * proper noun as French.
 */
function composerOpenRules(): string {
  const rules = css
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("}")
    .filter((block) => block.includes('[data-composer="open"]'))
    .join("}\n");
  assert.ok(rules.length > 0, "the composer-open state still has styles to check");
  return rules;
}

test("the search field is never moved below what it offers", () => {
  /*
   * THE REGRESSION ITSELF. `order` is the only thing that moved the field, and
   * the fix is that there is now none in this state: document order is visual
   * order, and the field is first in the DOM.
   *
   * If a future change needs `order` here it needs this test to change too,
   * which is the point — moving the input to the keyboard's edge is a product
   * decision the owner has already made once, in the other direction.
   */
  assert.doesNotMatch(
    composerOpenRules(),
    /\border\s*:/,
    "no `order` in the composer-open state: it is what put the field above the keyboard",
  );
});

test("the field comes before the list it controls, in the document", () => {
  /* Belt and braces for the above: even with no `order`, the field has to be
     written first for document order to put it at the top. */
  const field = composer.indexOf("styles.searchField");
  const scroll = composer.indexOf("composerScroll");
  assert.ok(field > 0 && scroll > 0, "both regions are still present");
  assert.ok(field < scroll, "the field is authored before the region that scrolls below it");
});

test("exactly one scroller while the composer is open", () => {
  /*
   * Two nested scrollers is how content becomes unreachable with a thumb, and
   * the owner asked for no nested body scrolling. The sheet body stops
   * scrolling and the recents list gives up its own max-height, leaving the
   * composer's own region as the one that scrolls.
   */
  const rules = composerOpenRules();
  assert.match(rules, /\.sheetBody\s*\{\s*overflow:\s*hidden/, "the sheet body stops scrolling");
  assert.match(rules, /composerScroll[\s\S]*?overflow-y:\s*auto/, "the composer's own region scrolls");
  assert.match(rules, /recentScroll[\s\S]*?overflow:\s*visible/, "the recents list gives up its scroller");
});

test("nothing of North Ground's floats above the native keyboard", () => {
  /*
   * The owner saw a control bar above the iOS keyboard — key, card, location
   * and a dismiss button. That is Safari's own AutoFill/QuickType accessory
   * bar, which a web page cannot remove. What this asserts is the half we
   * control: that North Ground adds no bar of its own and no keyboard-dismiss
   * control, so the native bar can never be mistaken for ours again.
   */
  const hunt = [css, composer, app, sheet].join("\n");
  assert.doesNotMatch(hunt, /position:\s*fixed[^}]*bottom:\s*0/, "no fixed bar pinned to the bottom");
  assert.doesNotMatch(hunt, /aria-label="(Close|Hide|Dismiss) (the )?keyboard"/i, "no keyboard-dismiss control");
  assert.doesNotMatch(composer, /keyboardAccessory|accessoryBar|KeyboardBar/, "no accessory-bar component");
});

test("the field tells the platform it is a location search", () => {
  /*
   * So Safari treats it as a search rather than as credentials or payment: the
   * AutoFill offers a page can influence are the ones that follow from
   * semantics. `type="search"` and no autofill token are the levers that exist.
   */
  assert.match(composer, /type="search"/);
  assert.match(composer, /inputMode="search"/);
  assert.match(composer, /enterKeyHint="search"/);
  assert.match(composer, /autoComplete="off"/);
  assert.doesNotMatch(composer, /autoComplete="(street-address|postal-code|address-line\d|cc-|current-password|username)/);
  assert.doesNotMatch(composer, /<form\b/, "a lone input inside a form is what invites credential autofill");
});

test("one viewport model, and only the shell reads it for layout", () => {
  /*
   * The keyboard is compensated ONCE, in HuntApp, by insetting the shell to
   * the visible band. A second component computing its own offset is how the
   * duplicated compensation bug happened before; the sheet may READ the
   * viewport to decide whether a focused control is hidden, but it must not
   * translate anything by it.
   */
  assert.match(app, /visibleBand\(/, "the shell uses the shared band arithmetic");
  assert.doesNotMatch(sheet, /visibleBand\(/, "the sheet does not compute its own band");
  assert.doesNotMatch(sheet, /transform:[^;]*visualViewport|translateY\([^)]*viewport/i, "the sheet is never translated by the viewport");
  assert.doesNotMatch(css, /calc\([^)]*100dvh[^)]*keyboard/i, "no keyboard-specific viewport unit arithmetic");
});

test("focus is taken once, and never re-taken after a dismissal", () => {
  /*
   * Swiping the keyboard down is a decision and the app does not overrule it.
   * The one focus call is keyed on `autoFocus` so it fires when the composer
   * opens and not again, and it uses `preventScroll` so it cannot fight the
   * layout by scrolling the field into view.
   */
  const focusCalls = composer.match(/\.focus\(/g) ?? [];
  assert.equal(focusCalls.length, 2, "one on open, one on clearing the field — and no others");
  assert.match(composer, /focus\(\{ preventScroll: true \}\)/, "opening focus never scrolls the layout");
  assert.match(composer, /\[autoFocus, inputRef\]/, "the opening focus is keyed on autoFocus, so a dismissal does not re-fire it");
});

test("the sheet is measured in the shell's coordinates, not the viewport's", () => {
  /*
   * The second defect the keyboard caused, found by certifying the first: the
   * header's rect is viewport-relative and the shell is inset to the band, so
   * feeding one to `sheetHeights` charged the band's top to the sheet twice —
   * and, because the inset in the DOM is a state behind, the error survived the
   * keyboard's dismissal. The arithmetic and its property live in
   * `exploration/viewport.ts`; this asserts the component still goes through it.
   */
  const measure = app.slice(app.indexOf("const measure = ()"), app.indexOf("setHeights(sheetHeights("));
  assert.ok(measure.length > 0, "the measuring function is still there to check");
  assert.match(measure, /headerBottomInBand\(/, "the header is converted into the shell's coordinates");
  assert.doesNotMatch(
    measure,
    /headerBottom\s*=\s*headerRef\.current\?\.getBoundingClientRect\(\)\.bottom/,
    "a bare viewport-relative header bottom is the bug itself",
  );
});
