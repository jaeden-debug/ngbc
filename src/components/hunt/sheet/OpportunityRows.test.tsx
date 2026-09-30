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

test("nothing a reader sees is a raw enum token, including a compound one", () => {
  /*
   * THE ENUMERATED VERSION OF THIS TEST MISSED A LIVE DEFECT, which is why it
   * is written as a shape instead. The test above checks a fixed list of
   * tokens surrounded by tags, and the filter was rendering
   * `<option>ANTLERED or ANTLERLESS</option>` — a COMPOUND class the adapter
   * builds by joining two tokens with " or ". No single token is adjacent to a
   * tag there, so every pattern in the list passed while the control shouted a
   * raw value at the hunter, two inches from a card rendering the same token as
   * "Antlered or Antlerless". A list can only catch the shapes someone thought
   * of; this catches the shape of shouting.
   *
   * So: assert over ALL visible text, for any run of three or more capitals.
   * Band labels are uppercased in CSS and title case in the markup, so a
   * failure here is a token that escaped a labeller.
   */
  const rows = bundleRows("ca-qc-2026.json");
  assert.ok(rows.length > 0, "positive control: rows to render");
  const html = renderToStaticMarkup(<OpportunityRows rows={rows} date="2026-10-05" />);

  /* Text nodes only: attribute values legitimately carry the raw token, because
     `<option value="ANTLERED or ANTLERLESS">` is the identity the filter
     matches on and must NOT be localised. */
  const visible = html.replace(/<[^>]*>/g, "\u0001");
  const shouted = [...new Set(visible.match(/[A-Z]{3,}[A-Z_ ]*/g) ?? [])].map((run) => run.trim());
  assert.deepEqual(shouted, [], `raw enum tokens reached the reader: ${shouted.join(", ")}`);
});

test("a compound animal class is labelled the same way in the filter and on the card", () => {
  /*
   * ONE TOKEN, ONE RENDERING. The defect was not that the filter was wrong in
   * isolation — it was that two places in one component formatted the same
   * value differently, so a hunter saw a card say "Antlered or Antlerless" and
   * the control above it say "ANTLERED or ANTLERLESS" and had no way to know
   * they were the same season.
   */
  const compound = row({ animalClass: stated("ANTLERED or ANTLERLESS") });
  const other = row({ animalClass: stated("ANTLERED"), implements: stated(["RIFLE"]) });
  const html = renderToStaticMarkup(<OpportunityRows rows={[compound, other]} date="2026-10-05" />);

  assert.match(html, /<option value="ANTLERED or ANTLERLESS">Antlered or Antlerless<\/option>/,
    "the filter offers the compound in words, keeping the raw token as its value");
  assert.match(html, /<dd[^>]*>Antlered or Antlerless<\/dd>/, "and the card says the same words");
  assert.equal(html.match(/Antlered or Antlerless/g)?.length, 2, "the same wording in both places, once each");
});
