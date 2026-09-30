import assert from "node:assert/strict";
import test from "node:test";
import { parseRelativeDate, parseRelativeWindow, resolveRelativeDate, resolveRelativeWindow } from "./relative-date.ts";

/**
 * ONTARIO'S SEASONS ARE RULES, AND THE YEAR IS ESTABLISHED RATHER THAN INFERRED.
 *
 * The certified bundle carried Ontario's seasons as the regulations summary
 * prints them — "September 19 to December 15", with no year — so 119 of 135
 * major-game rules had no window anything could evaluate. A yearless string in
 * a 2026 guide is not a 2026 window until something says which year it governs.
 *
 * O. Reg. 670/98 says. Its tables do not print dates at all:
 *
 *   Table 5, item 1: "From September 1 to the Friday preceding the Saturday
 *   closest to October 8, IN ANY YEAR."
 *
 * The rule holds for every year; a date is what it produces for one. So the
 * rule is what is stored and the date is derived, exactly as Nova Scotia's
 * bundle already does — except derived by code rather than by hand, because
 * Ontario publishes 74 season phrases and hand-deriving them would be a few
 * hundred chances to be off by one on the fact a hunter checks first.
 *
 * THE CERTIFICATION, and it is the reason this is more than a parser: all 56
 * distinct date segments the ministry published for 2026 are produced by
 * O. Reg. 670/98's own rules, resolved for 2026. Two independent derivations —
 * the ministry's and this one — agreeing on every segment.
 */

const on = (phrase: string) => {
  const window = parseRelativeWindow(phrase);
  assert.ok(window, `refused: ${phrase}`);
  const resolved = resolveRelativeWindow(window, 2026);
  assert.ok(resolved, `unresolvable: ${phrase}`);
  return `${resolved.from} → ${resolved.to}`;
};

test("Table 5 item 1: the ministry's own 2026 answer, from the rule", () => {
  /* October 8 2026 is a Thursday. The Saturdays either side are the 3rd (five
     days back) and the 10th (two days on), so the closest is the 10th and the
     Friday preceding it is the 9th. The summary prints September 1 to
     October 9. */
  assert.equal(
    on("September 1 to the Friday preceding the Saturday closest to October 8"),
    "2026-09-01 → 2026-10-09",
  );
});

test("the archery season in WMUs 76A–81B, all three of its windows", () => {
  /* Class of Firearm 1 — bow — residents only, non-residents closed. The middle
     window is the one that exposed the harness rather than the resolver: at 137
     characters it was outside a length cap I had put on the extraction, and its
     absence read as a season the instrument did not support. */
  assert.equal(
    on("October 1 to the Sunday immediately prior to the first Monday in November"),
    "2026-10-01 → 2026-11-01",
  );
  assert.equal(
    on("the Saturday next following the first Monday in November to the Sunday immediately prior to the Monday next following November 28"),
    "2026-11-07 → 2026-11-29",
  );
  assert.equal(
    on("the Saturday next following the Monday next following November 28 to December 31"),
    "2026-12-05 → 2026-12-31",
  );
});

test("an end anchored to the window's own start", () => {
  /* "From the Monday next following November 28 to the Friday next following"
     — the anchor is not in the text because the text already said it. November
     28 2026 is a Saturday, so the Monday following is the 30th and the Friday
     following that is December 4. */
  assert.equal(on("the Monday next following November 28 to the Friday next following"), "2026-11-30 → 2026-12-04");
  /* Second Monday in November 2026 is the 9th, so the Saturday prior is the
     7th — and the second Sunday following THAT is the 15th, not the 22nd. The
     anchor is the window's start, never the expression the start was built
     from, which is the mistake I made writing this line. */
  assert.equal(
    on("the Saturday prior to the second Monday in November to the second Sunday next following"),
    "2026-11-07 → 2026-11-15",
  );
  /* And it cannot be answered outside a window, by construction. */
  assert.equal(resolveRelativeDate(parseRelativeDate("the Friday next following")!, 2026), null);
});

test("an end that is a bare day in the start's month", () => {
  assert.equal(on("October 1 to 4"), "2026-10-01 → 2026-10-04");
  assert.equal(on("October 8 to 14"), "2026-10-08 → 2026-10-14");
  /* Backwards is refused rather than rolled into the next month: the authority
     does not write a season that ends before it begins. */
  const backwards = parseRelativeWindow("October 8 to 4");
  assert.equal(backwards && resolveRelativeWindow(backwards, 2026), null);
});

test("the named holidays are Canadian, and only the two the tables name", () => {
  assert.equal(resolveRelativeDate(parseRelativeDate("Labour Day")!, 2026), "2026-09-07");
  assert.equal(resolveRelativeDate(parseRelativeDate("Thanksgiving Monday")!, 2026), "2026-10-12");
  assert.equal(on("the Tuesday next following Labour Day to October 31"), "2026-09-08 → 2026-10-31");
  assert.equal(on("the Tuesday following Thanksgiving Monday to November 15"), "2026-10-13 → 2026-11-15");
  /* A bare "Thanksgiving" would be November in the United States, so there is
     no such token to be wrong with. */
  assert.equal(parseRelativeDate("Thanksgiving"), null);
  assert.equal(parseRelativeDate("Victoria Day"), null);
});

test("relative days are strictly before or strictly after, never the same day", () => {
  /* October 3 2026 IS a Saturday. "The Saturday closest to October 3" is that
     day; the Friday preceding it is October 2, not October 9 — and "the Saturday
     next following October 3" is the 10th, not the 3rd. An inclusive reading
     moves a season by a week in one year out of seven and looks right in the
     other six. */
  assert.equal(resolveRelativeDate(parseRelativeDate("the Saturday closest to October 3")!, 2026), "2026-10-03");
  assert.equal(
    resolveRelativeDate(parseRelativeDate("the Friday preceding the Saturday closest to October 3")!, 2026),
    "2026-10-02",
  );
  assert.equal(resolveRelativeDate(parseRelativeDate("the Saturday next following October 3")!, 2026), "2026-10-10");
});

test("the split is the first one that parses, because the operators contain \" to \"", () => {
  /* "closest to" and "prior to" both hold a separator. Splitting at the first
     one cut inside the operator and refused fourteen real season phrases. */
  assert.equal(on("the Saturday closest to September 17 to December 15"), "2026-09-19 → 2026-12-15");
  assert.equal(
    on("the Saturday closest to September 17 to the Friday preceding the Saturday closest to October 1"),
    "2026-09-19 → 2026-10-02",
  );
  /* And the property that rule was protecting still holds: a trailing
     qualifier fails every candidate split, so a row whose dates are right only
     for some hunters or some land stays unencodable. */
  assert.equal(parseRelativeWindow("October 1 to December 15 (only on farmland)"), null);
  assert.equal(parseRelativeWindow("October 1 to December 15, for Ducks other than Eiders"), null);
});

test("forms the instrument uses that are deliberately refused", () => {
  /* Alternating weekly seasons — "there shall be Monday to Sunday seasons every
     other week ending at the latest on the third Sunday in December" — are a
     different construct, not a window, and guessing which weeks would invent
     open days. */
  assert.equal(
    parseRelativeWindow("the first Monday following the last Sunday in September, there shall be Monday to Sunday seasons every other week"),
    null,
  );
  /* A phrase with no separator at all is an extraction artefact, and it is
     refused rather than repaired: two merged table cells are not one season. */
  assert.equal(
    parseRelativeWindow("the third Monday in November the Sunday immediately prior to the Monday next following November 28"),
    null,
  );
});
