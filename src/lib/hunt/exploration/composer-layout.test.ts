import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/*
 * The open composer keeps the field at the TOP of the search sheet, with what it
 * offers scrolling below (owner, 2026-09-29, from a physical iPhone). The
 * rejected layout pinned the field to the keyboard by giving it `order: 1` and
 * its results `order: 0`. These are layout invariants read from source, so a
 * reintroduction fails here before any browser runs; the rendered geometry is
 * certified in scripts/certify-hunt-app.mjs (keyboardStateMachine).
 */
const css = readFileSync(new URL("../../../components/hunt/HuntApp.module.css", import.meta.url), "utf8");
const composer = readFileSync(new URL("../../../components/hunt/sheet/PlaceComposer.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../../../components/hunt/HuntApp.tsx", import.meta.url), "utf8");

function rulesFor(selectorFragment: string): string[] {
  return [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter(([, selector]) => selector.includes(selectorFragment))
    .map(([, , body]) => body);
}

test("the open composer's field and its results are never visually reordered", () => {
  for (const fragment of [".composerOpen .searchField", ".composerScroll"]) {
    const rules = rulesFor(fragment);
    assert.ok(rules.length > 0, `${fragment} has rules`);
    for (const body of rules) assert.doesNotMatch(body, /(^|[;\s])order\s*:/, `${fragment} must not set order`);
  }
  assert.doesNotMatch(css, /composerAnchored/, "the rejected anchored layout is gone");
});

test("the field comes before what it offers in the markup", () => {
  const field = composer.indexOf("className={styles.searchField}");
  const results = composer.indexOf("className={styles.composerScroll}");
  assert.ok(field > 0 && results > 0, "both regions exist");
  assert.ok(field < results, "field first, results after");
});

test("the search field has search semantics and no keyboard-dismiss control exists", () => {
  const input = composer.slice(composer.indexOf("<input"), composer.indexOf("/>", composer.indexOf("<input")));
  assert.match(input, /type="search"/);
  assert.match(input, /enterKeyHint="search"/);
  assert.doesNotMatch(input, /autoComplete="(?:current-password|new-password|username|cc-[a-z-]+|street-address|address-line\d|postal-code|email|tel)"/,
    "a place search must not claim credential, payment or address autofill semantics");
  assert.doesNotMatch(composer, /aria-label="(?:Dismiss|Hide|Close) keyboard"/i);
});

test("nothing refocuses the field on its own", () => {
  /* PlaceComposer's only timed focus is its autoFocus effect, so the guarantee
     is that Hunt never turns it on. (An earlier version of this test matched
     `setTimeout\([^)]*focus\(` and passed for the wrong reason: `[^)]*` stops
     at the arrow function's own `()`, so it could never have failed.) */
  const usage = app.slice(app.indexOf("<PlaceComposer"), app.indexOf("/>", app.indexOf("<PlaceComposer")));
  assert.ok(usage.length > 0, "Hunt renders the composer");
  assert.match(usage, /autoFocus=\{false\}/, "Hunt never auto-focuses the composer");
  /* The one timed focus left is for the explicit "Search another place" action,
     where the field is not yet mounted. It must stay behind that flag: opened
     by tapping the field, a second focus ran during the sheet's rise. */
  const timedFocus = [...app.matchAll(/^.*setTimeout\(\s*\(\)\s*=>\s*composerRef\.current\?\.focus.*$/gm)].map(([line]) => line);
  assert.ok(timedFocus.length > 0, "the explicit-action focus is still found, so this check can fail");
  for (const line of timedFocus) assert.match(line, /if \(options\?\.focusField\)/, `unguarded timed refocus: ${line.trim()}`);
  assert.match(app, /openComposer\(true, \{ focusField: true \}\)/, "only the explicit action asks for focus");
});

test("the search field leaves iOS word suggestions on, so Safari does not fill that strip with AutoFill buttons", () => {
  const input = composer.slice(composer.indexOf("<input"), composer.indexOf("/>", composer.indexOf("<input")));
  assert.doesNotMatch(input, /autoCorrect="off"/, "autocorrect off hides QuickType and shows AutoFill icons (owner, physical iPhone, 2026-09-29)");
  assert.doesNotMatch(input, /spellCheck=\{false\}/);
});
