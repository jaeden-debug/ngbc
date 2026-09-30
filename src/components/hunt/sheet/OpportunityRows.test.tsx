import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { RuleShape } from "../../../lib/hunt/regulatory/dimension-matrix.ts";
import { opportunityRowsFrom } from "../../../lib/hunt/regulatory/opportunity-adapter.ts";
import { FORBIDDEN_GUESSES } from "../../../lib/hunt/regulatory/opportunity-presentation.ts";
import { stated, UNRESOLVED, type ResolvedOpportunity } from "../../../lib/hunt/regulatory/opportunity-row.ts";
import OpportunityRows from "./OpportunityRows.tsx";

const DEER = "species:white-tailed-deer";

function bundleRows(file: string): ResolvedOpportunity[] {
  const bundle = JSON.parse(readFileSync(new URL(`../../../../content/regulatory/${file}`, import.meta.url), "utf8")) as {
    rules?: RuleShape[];
  };
  return opportunityRowsFrom({ speciesId: DEER, rules: (bundle.rules ?? []).filter((rule) => rule.speciesId === DEER) });
}

const row = (over: Partial<ResolvedOpportunity> = {}): ResolvedOpportunity => ({
  ruleId: "regulatory_rule:test",
  speciesId: DEER,
  animalClass: stated("ANTLERED"),
  criterion: null,
  implements: stated(["RIFLE", "CROSSBOW"]),
  windows: [{ opens: "2026-10-01", closes: "2026-10-14", datesInclusive: true }],
  conditionIds: [],
  ...over,
});

test("a real jurisdiction's rules render as cards, through the whole chain", () => {
  /* Bundle to pixels with nothing invented in between, and over the two shapes
     rather than one. */
  for (const [name, file] of [["Québec", "ca-qc-2026.json"], ["Alberta", "ca-ab-2026.json"]] as const) {
    const rows = bundleRows(file);
    assert.ok(rows.length > 0, `positive control: ${name} produced rows`);
    const html = renderToStaticMarkup(<OpportunityRows rows={rows} date="2026-10-05" />);
    assert.match(html, /What is open here/);
    assert.match(html, /Antlered|Antlerless/, `${name}: no legal animal rendered`);
    /* No raw enum reaches a reader. */
    for (const token of ["ANTLERED", "ANTLERLESS", "CROSSBOW", "MUZZLELOADER", "RIFLE"]) {
      assert.doesNotMatch(html, new RegExp(`>\\s*${token}\\s*<`), `${name}: raw token ${token} rendered`);
    }
  }
});

test("the four sentences a hunter would act on are never rendered", () => {
  const html = renderToStaticMarkup(
    <OpportunityRows rows={[row({ animalClass: UNRESOLVED, implements: UNRESOLVED })]} date="2026-10-05" />,
  );
  for (const phrase of FORBIDDEN_GUESSES) {
    assert.ok(!html.includes(phrase), `an unresolved row rendered "${phrase}"`);
  }
  assert.match(html, /Not established/, "an unestablished dimension says so");
});

test("a past season is not called closed anywhere on the card", () => {
  const html = renderToStaticMarkup(<OpportunityRows rows={[row()]} date="2027-03-01" />);
  assert.match(html, /No further published season/);
  assert.doesNotMatch(html, /\bclosed\b|\bshut\b|\bended\b|season is over/i);
});

test("an empty filter result is never presented as a closed season", () => {
  /*
   * Filtering is affirmative, so an empty result can mean the law says no OR
   * that North Ground has not established the method. Saying "closed" would put
   * our silence where the law's answer belongs.
   */
  const html = renderToStaticMarkup(
    <OpportunityRows rows={[row({ implements: stated(["BOW"]) })]} date="2026-10-05" filter={{ implement: "RIFLE" }} />,
  );
  assert.match(html, /it is not a closed season/);
  assert.doesNotMatch(html, /Antlered/, "the non-matching row is not shown");
});

test("the filters offer only what the rows in context support", () => {
  const html = renderToStaticMarkup(
    <OpportunityRows
      rows={[row({ implements: stated(["BOW"]) }), row({ animalClass: stated("ANTLERLESS"), implements: stated(["RIFLE"]) })]}
      date="2026-10-05"
    />,
  );
  assert.match(html, /<option value="BOW">Bow<\/option>/);
  assert.match(html, /<option value="RIFLE">Rifle<\/option>/);
  assert.doesNotMatch(html, /value="CROSSBOW"/, "a method no row here permits is never offered");
  /* "Any" is the default and is selected, so React writes `selected` on it —
     matched loosely rather than pinning React's attribute order. */
  assert.match(html, /<option value=""[^>]*>Any<\/option>/);
});

test("without a change handler the controls are read-only rather than broken", () => {
  /*
   * A server-rendered surface has no handler. A select that looks live and
   * does nothing is worse than one that says it cannot be used, so the absence
   * of a handler disables it rather than silently dropping the change.
   */
  const rows = [row({ implements: stated(["BOW"]) }), row({ implements: stated(["RIFLE"]) })];
  const readOnly = renderToStaticMarkup(<OpportunityRows rows={rows} date="2026-10-05" />);
  assert.match(readOnly, /<select[^>]*disabled/);

  const interactive = renderToStaticMarkup(<OpportunityRows rows={rows} date="2026-10-05" onFilterChange={() => {}} />);
  assert.doesNotMatch(interactive, /<select[^>]*disabled/, "given a handler, the control works");
});

test("a single-choice dimension shows no filter at all", () => {
  /* A control with one option is a control that cannot do anything, and it
     costs a hunter outdoors a tap to discover that. */
  const html = renderToStaticMarkup(<OpportunityRows rows={[row({ implements: stated(["BOW"]) })]} date="2026-10-05" />);
  assert.doesNotMatch(html, /<select/);
});

test("identical opportunities render once, carrying both date ranges", () => {
  const october = row({ windows: [{ opens: "2026-10-01", closes: "2026-10-14", datesInclusive: true }] });
  const november = row({ windows: [{ opens: "2026-11-01", closes: "2026-11-20", datesInclusive: true }] });
  const html = renderToStaticMarkup(<OpportunityRows rows={[october, november]} date="2026-10-05" />);
  assert.equal(html.match(/<article/g)?.length, 1, "one opportunity, one card");
  assert.match(html, /2026-10-01 to 2026-10-14/);
  assert.match(html, /2026-11-01 to 2026-11-20/);
});

test("legally distinct opportunities on the same dates render as two cards", () => {
  const days = [{ opens: "2026-10-01", closes: "2026-10-31", datesInclusive: true }];
  const html = renderToStaticMarkup(
    <OpportunityRows
      rows={[
        row({ animalClass: stated("ANTLERED"), implements: stated(["RIFLE"]), windows: days }),
        row({ animalClass: stated("ANTLERLESS"), implements: stated(["BOW"]), windows: days }),
      ]}
      date="2026-10-05"
    />,
  );
  assert.equal(html.match(/<article/g)?.length, 2, "same dates, different law: two cards");
});

test("the controls are real controls, and the band is a word before it is a colour", () => {
  const html = renderToStaticMarkup(
    <OpportunityRows rows={[row(), row({ animalClass: stated("ANTLERLESS") })]} date="2026-10-05" />,
  );
  /* §48: a meaning carried by colour alone is a defect. */
  assert.match(html, /Open on this date/);
  /* §40: a control reachable with gloves on — the size is in the stylesheet and
     the label is here, so a screen reader names it rather than reading "combo
     box". */
  assert.match(html, /<span class="[^"]*">Animal<\/span>/);
  assert.match(html, /<span class="[^"]*">Method<\/span>/);
});
