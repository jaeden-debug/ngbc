import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

/**
 * An authority's words reach the screen through `AuthorityText`, and nowhere
 * else.
 *
 * THE TWO DEFECTS THIS IS NAMED FOR, both found on production at 320px on the
 * Québec answer:
 *
 *   - The season segment rendered « Armes à feu et à air comprimé, arbalète et
 *     arc » with `lang` and nothing else. A screen reader pronounced it
 *     correctly; a sighted English reader was handed the ministry's French with
 *     nothing saying what it was.
 *   - The special-area blockquote rendered the bare `statedAs` string in curly
 *     quotes with NO `lang` at all — even though the same record carries
 *     `words`, an `AuthorityQuotation` with its own language, right beside it.
 *     The renderer was reading the wrong one of the two.
 *
 * Both were invisible to the production scan because it only looks inside
 * `[class*=facts]` and neither element is there. A scan that has to be pointed
 * at the right part of the page will keep missing the parts nobody pointed it
 * at, so the rule is enforced here instead, over the source, where "the right
 * part of the page" is not a parameter.
 *
 * `AuthorityText` is what carries §41A: the `lang` that makes a screen reader
 * switch voice, the quotation marks decided by AUTHORSHIP rather than by hand,
 * and — where no reading exists — the sentence saying which language the
 * authority published in and that North Ground holds none. Hand-quoting is the
 * observable symptom of bypassing all three.
 */

const COMPONENT_ROOT = new URL("../../", import.meta.url).pathname;
/** The one component whose job is to render an authority's words. */
const OWNER = "AuthorityText.tsx";

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.tsx$/.test(entry)) out.push(path);
  }
  return out;
}

/** Comments are prose about the rule and must not be mistaken for the rule. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const FILES = sourceFiles(COMPONENT_ROOT).filter((path) => !path.endsWith(OWNER));

test("there are components to scan, and the owner exists", () => {
  /* A positive control: every assertion below passes over an empty file list,
     so a broken walk would turn this whole file green. */
  assert.ok(FILES.length > 15, `expected the component tree, walked ${FILES.length} files`);
  assert.ok(sourceFiles(COMPONENT_ROOT).some((path) => path.endsWith(OWNER)), "AuthorityText must exist to be the one way through");
});

test("no component quotes an authority's words by hand", () => {
  /*
   * The guillemets are the tell. `AuthorityText` adds them from the record's
   * OWNER — an authority's words are quoted whichever language they are in, and
   * North Ground's reading of them is not, because it is a quotation of nobody.
   * A component writing them itself has decided authorship by hand, and has
   * almost certainly not also decided `lang` and the no-reading sentence.
   */
  const offenders: string[] = [];
  for (const path of FILES) {
    const body = withoutComments(readFileSync(path, "utf8"));
    if (body.includes("«") || body.includes("»")) offenders.push(path.replace(COMPONENT_ROOT, ""));
  }
  assert.deepEqual(offenders, [], `these hand-quote an authority instead of using ${OWNER}:\n  ${offenders.join("\n  ")}`);
});

test("no component tags a language and then renders the text raw", () => {
  /*
   * The exact shape the season segment had: `lang={x.lang}` on an element whose
   * only child is `{x.text}`. That is a record which KNOWS its language being
   * rendered without the component that knows what to say about it — correct
   * for a screen reader and silent for everyone else.
   */
  const offenders: string[] = [];
  for (const path of FILES) {
    const body = withoutComments(readFileSync(path, "utf8"));
    /* `lang={…}` on an element, then an interpolation of `.text`, before the
       element closes and without an `AuthorityText` between them. */
    const pattern = /lang=\{[^}]*\.lang\}[^<]*\{[^}]*\.text\}/g;
    for (const match of body.match(pattern) ?? []) {
      offenders.push(`${path.replace(COMPONENT_ROOT, "")}: ${match.replace(/\s+/g, " ").slice(0, 80)}`);
    }
  }
  assert.deepEqual(offenders, [], `these render authority text raw under a lang tag:\n  ${offenders.join("\n  ")}`);
});

/**
 * Fields that are the BARE twin of a provenance-bearing record.
 *
 * `OverlayFeature` carries `words` — an `AuthorityQuotation` with its own
 * `lang`, owner and citation — and `statedAs`, the same sentence as a plain
 * string. Both are deliberate: the string is for matching and logging, the
 * quotation is for rendering. The live defect was a component reading the
 * string, so the language it needed was present in the record and absent from
 * the screen.
 *
 * A named list can go stale, and this one will: it is here because the
 * relationship "bare twin of a provenanced field" is not expressible in the
 * type system today. Adding a field with the same shape means adding it here.
 */
const BARE_TWINS = ["statedAs"];

/**
 * ...but only on the type where that relationship was VERIFIED.
 *
 * The first version of this check matched `.statedAs` anywhere and found seven
 * more sites — in `HuntAnswer`, `LegalHours` and `HuntBriefCard`. They are NOT
 * the same defect. `AllocationDetail`, `LegalTimeResult` and the hunt-code
 * types carry a `statedAs` with NO provenanced twin beside it, so reading it is
 * the only thing a component can do and is correct.
 *
 * Generalising a rule from one type to every type sharing a FIELD NAME is how a
 * correct habit goes wrong when carried across. `OverlayFeature` is the type
 * where `words` and `statedAs` are deliberate siblings; a type that grows the
 * same pair is added here, having been read rather than matched.
 */
const TWIN_BEARING = /overlay\w*\./i;

test("a component renders the provenanced twin, never the bare string", () => {
  /*
   * THE MUTATION THAT FOUND THIS TEST. The first version of this file caught
   * only guillemets, so reverting the overlay blockquote to its hand-quoted
   * curly-quote form passed it — the gate missed the exact defect it was
   * written for. Quote characters are the symptom; reading the bare field is
   * the cause, and this is the cause.
   */
  const offenders: string[] = [];
  for (const path of FILES) {
    const body = withoutComments(readFileSync(path, "utf8"));
    for (const field of BARE_TWINS) {
      /* Rendered, meaning inside a JSX interpolation — not merely tested for
         presence, which is what a `?` guard legitimately does. */
      const pattern = new RegExp(`\\{[^}]*\\.${field}\\}`, "g");
      for (const match of body.match(pattern) ?? []) {
        if (!TWIN_BEARING.test(match)) continue;
        offenders.push(`${path.replace(COMPONENT_ROOT, "")}: ${match.slice(0, 60)}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `these render a bare string whose provenanced twin exists:\n  ${offenders.join("\n  ")}`);
});

