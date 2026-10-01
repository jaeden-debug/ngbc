import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * THE NUMERIC MINIMUMS A HUNTER'S EQUIPMENT MUST MEET, PINNED WHERE THE ENGINE
 * READS THEM.
 *
 * Found by mutation, not by reading. Changing Newfoundland's rifle minimum from
 * .243 to .270 calibre in its builder, rebuilding and running the whole suite
 * passed; so did changing New Brunswick's hunter-orange colour specification
 * from L +55.0 to +45.0 Judd units. Both are legal minimums a hunter is measured
 * against, and nothing held either in place.
 *
 * READING COULD NOT HAVE FOUND THEM. They live in condition prose, so there is
 * no field whose absence looks wrong — a jurisdiction with a pinned minimum and
 * one without are indistinguishable in the data. "Is this pinned" is only
 * answered by changing it and seeing whether anything notices.
 *
 * AND MY FIRST VERSION OF THIS TEST WAS A FALSE PIN, WHICH IS THE LESSON.
 * It searched the whole bundle text for `.243 calibre` and passed the mutation,
 * because the figure appears TWICE: once in the operative condition
 * `ca-nl-calibre-minimums`, and once in a verification note reading "The .243
 * calibre minimum, with no Labrador exception." Mutating the operative one left
 * the note, and the note satisfied the assertion. A test pinned to a second copy
 * of a fact is worse than no test: it reports the fact as held while the copy the
 * engine reads drifts.
 *
 * So each figure is asserted INSIDE the condition that carries it, by id.
 *
 * WHAT IS ASSERTED IS THE FIGURE AND ITS UNIT, never the sentence — wording may
 * legitimately be rewritten, .243 may not become .270. The failure direction is
 * both: a minimum set too high turns away a hunter whose rifle is legal, too low
 * tells them an unlawful one will do, and §62 puts the orange specification
 * closest to safety of anything here.
 */

interface Condition { id: string; text?: string; note?: string }

function conditionsOf(file: string): Map<string, Condition> {
  const bundle = JSON.parse(readFileSync(`content/regulatory/${file}`, "utf8")) as {
    sources?: Array<{ conditions?: Condition[] }>;
  };
  const all = (bundle.sources ?? []).flatMap((source) => source.conditions ?? []);
  assert.ok(all.length > 5, `${file}: only ${all.length} conditions — not the real bundle`);
  return new Map(all.map((condition) => [condition.id, condition]));
}

/** Each figure the authority states, and the condition record that must carry it. */
const MINIMUMS: Array<{ jurisdiction: string; file: string; stated: Array<[string, RegExp, string]> }> = [
  {
    jurisdiction: "Newfoundland and Labrador",
    file: "ca-nl-2026.json",
    stated: [
      ["ca-nl-calibre-minimums", /\.243 calibre/, "rifle minimum"],
      ["ca-nl-calibre-minimums", /100 grains/, "minimum bullet weight"],
      ["ca-nl-calibre-minimums", /1,500 foot-pounds/, "minimum muzzle energy"],
      ["ca-nl-bow-minimums", /20 kilograms/, "long bow and compound bow minimum draw"],
      ["ca-nl-bow-minimums", /68 kilograms/, "crossbow minimum draw"],
    ],
  },
  {
    jurisdiction: "New Brunswick",
    file: "ca-nb-2026.json",
    stated: [
      ["ca-nb-hunter-orange", /\+55\.0 Judd units/, "hunter orange L value, defined instrumentally rather than by name"],
      ["ca-nb-hunter-orange", /\+65\.0/, "hunter orange a value"],
      ["ca-nb-hunter-orange", /\+30\.0/, "hunter orange b value"],
    ],
  },
];

for (const { jurisdiction, file, stated } of MINIMUMS) {
  test(`${jurisdiction} states its numeric minimums in the record the engine reads`, () => {
    const conditions = conditionsOf(file);
    for (const [id, figure, what] of stated) {
      const condition = conditions.get(id);
      assert.ok(condition, `${jurisdiction}: condition ${id} is gone, so ${what} has no home`);
      /* Both fields, because New Brunswick carries its instrumental definition in
         `note` and Newfoundland carries its minimums in `text`. Neither is the
         whole bundle. */
      const carried = `${condition.text ?? ""}\n${condition.note ?? ""}`;
      assert.match(carried, figure, `${jurisdiction} ${id}: ${what} — this figure is no longer stated here`);
    }
  });
}

test("Newfoundland's crossbow draw is its own figure, not the bow's", () => {
  /*
   * 68 kg against 20 kg — more than three times — so a transposition is not a
   * rounding error, it is telling a crossbow hunter a 20 kg draw is lawful. Both
   * numbers survive a swap and only their roles are wrong, which is why the
   * relation is asserted and not just the figures.
   */
  const bows = conditionsOf("ca-nl-2026.json").get("ca-nl-bow-minimums");
  assert.ok(bows?.text);
  assert.match(bows.text, /long bow or compound bow must draw at least 20 kilograms/i);
  assert.match(bows.text, /crossbow at least 68 kilograms/i);
  assert.ok(!/crossbow (?:must draw )?at least 20 kilograms/i.test(bows.text),
    "a crossbow may not carry the long bow's figure");
});
