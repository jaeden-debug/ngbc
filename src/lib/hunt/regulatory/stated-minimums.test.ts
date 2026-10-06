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
 * A SECOND ROUND OF MUTATION ADDED THREE MORE, batched six at a time so one
 * suite run reports on six values: Manitoba's hunter-orange AREA in both of the
 * authority's units, Newfoundland's shotgun minimum gauge, and Newfoundland's
 * firearm discharge setbacks. Manitoba's ANTLERLESS threshold is the one value
 * that defended itself — its builder quotes M.R. 165/91 s. 1 verbatim and refused
 * to build at all, which is the strongest kind of pin and the pattern the others
 * should eventually follow.
 *
 * A THIRD ROUND swept twelve more figures across New Brunswick, Saskatchewan,
 * Ontario and Colorado. Two were already pinned — New Brunswick's orange area and
 * Colorado's .23 calibre centerfire limit west of I-25 — and ten were not.
 *
 * THAT ROUND ALSO FOUND THAT `npm test` CANNOT MEASURE A BATCH. It is a chain of
 * `&&`, so it stops at the first failing step: twelve mutated figures reported two
 * failures out of three steps run, and the remaining twelve steps never executed.
 * Read as a result, that says "ten are pinned"; it actually says nothing about
 * them. A mutation sweep runs each step on its own and collects the failures.
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
      ["ca-nl-calibre-minimums", /20 gauge/, "shotgun minimum gauge for big game"],
      /* Firearm discharge setbacks. Not equipment but distance, and the same
         shape of fact: a figure a hunter is measured against, in prose, pinned by
         nothing until now. */
      ["ca-nl-firearm-setbacks", /1,000 metres/, "setback from a school, playground or athletic field"],
      ["ca-nl-firearm-setbacks", /300 metres/, "setback from a dwelling"],
    ],
  },
  {
    jurisdiction: "Manitoba",
    file: "ca-mb-2026.json",
    stated: [
      /* The orange AREA, in both of the authority's own units. Manitoba's guide
         publishes "2,580 sq. cm (400 sq. in.)", so both are carried and both must
         hold: §41A keeps an authority's two published figures rather than one of
         them plus our arithmetic. Two conditions carry it — big game and upland —
         and a value is only pinned where the engine reads it, so both are named. */
      ["ca-mb-big-game-hunter-orange", /2,580 cm²/, "orange area, metric, big game"],
      ["ca-mb-big-game-hunter-orange", /400 in²/, "orange area, imperial, big game"],
      ["ca-mb-upland-hunter-orange", /2,580 cm²/, "orange area, metric, upland"],
      ["ca-mb-upland-hunter-orange", /400 in²/, "orange area, imperial, upland"],
    ],
  },
  {
    jurisdiction: "New Brunswick",
    file: "ca-nb-2026.json",
    stated: [
      ["ca-nb-hunter-orange", /\+55\.0 Judd units/, "hunter orange L value, defined instrumentally rather than by name"],
      ["ca-nb-hunter-orange", /\+65\.0/, "hunter orange a value"],
      ["ca-nb-hunter-orange", /\+30\.0/, "hunter orange b value"],
      /* The AREA is pinned by new-brunswick.test.ts; what was not is the
         camouflage threshold, which decides whether a patterned garment counts at
         all. Note the authority's SPACE thousands separator — 2 580 cm², not
         2,580 — and the separator is part of what is asserted, because a scan that
         normalises it reads the figure as 580. */
      ["ca-nb-hunter-orange", /at least 50% hunter orange/, "camouflage blaze orange threshold"],
      ["ca-nb-bow-minimums", /at least 20 kg at or before a 70 cm draw/, "bow minimum draw weight AND the draw length it is measured at"],
      ["ca-nb-bow-minimums", /crossbow at least 20 kg/, "crossbow minimum draw"],
      ["ca-nb-bow-minimums", /at least 20 mm at the widest point/, "arrow blade minimum width"],
      ["ca-nb-pheasant-implements", /no larger than 10 gauge/, "pheasant shotgun maximum bore"],
      ["ca-nb-pheasant-implements", /shot no larger than number 2/, "pheasant maximum shot size"],
    ],
  },
  {
    jurisdiction: "Saskatchewan",
    file: "ca-sk-2026.json",
    stated: [
      /* A patch BELOW a size is permitted, so these are maxima where everything
         else here is a minimum — and the failure direction reverses with them: too
         large tells a hunter a non-compliant garment will do. The two figures also
         differ between garment and cap, so a single number would be wrong for one
         of them. */
      ["ca-sk-hunter-clothing", /less than 100 cm² of the garment/, "maximum patch area on the garment"],
      ["ca-sk-hunter-clothing", /less than 50 cm² of the cap/, "maximum patch area on the cap"],
    ],
  },
  {
    jurisdiction: "Ontario",
    file: "ca-on-major-game-2026.json",
    stated: [
      /* O. Reg. 665/98 s. 79(1)(a) is a RANGE, and the range is the rule: a
         muzzle-loading shotgun outside 10–20 gauge is not permitted for turkey,
         and this condition is the reason turkey is not reported closed to a hunter
         carrying one. The shot sizes are the second half of the same provision. */
      ["turkey-muzzleloader-shotgun-only", /10 to 20 gauge/, "muzzle-loading shotgun permitted bore range"],
      ["turkey-muzzleloader-shotgun-only", /shot size 4, 5, 6 or 7/, "permitted shot sizes"],
    ],
  },
  {
    jurisdiction: "Colorado",
    file: "us-co-small-game-2026.json",
    stated: [
      /* The centerfire limit west of I-25 is pinned by us-colorado.test.ts. These
         three were not. Two conditions state the same bore ceiling for game
         mammals and game birds from two different sections of Chapter W-3, so both
         are named: a value is pinned only where the engine reads it. */
      ["us-co-game-mammal-shotgun", /10 gauge or smaller/, "game mammal shotgun maximum bore"],
      ["us-co-game-mammal-shotgun", /no more than three shells/, "game mammal shotgun magazine limit"],
      ["us-co-game-bird-shotgun", /10 gauge or smaller/, "game bird shotgun maximum bore"],
      ["us-co-air-gun-coyote-bobcat", /\.25 calibre or larger/, "air gun minimum calibre for coyote and bobcat"],
    ],
  },
];

for (const { jurisdiction, file, stated } of MINIMUMS) {
  test(`${jurisdiction} states its numeric minimums in the record the engine reads`, () => {
    const conditions = conditionsOf(file);
    /* EVERY figure is checked and the failures are reported TOGETHER. Asserting
       inside the loop stops at the first one, so a mutation of six values reports
       one — which reads as "five are pinned" when nothing of the sort was
       established. A negative control is only worth running if it can report on
       the whole population it was given. */
    const missing: string[] = [];
    for (const [id, figure, what] of stated) {
      const condition = conditions.get(id);
      if (!condition) {
        missing.push(`${id} is gone, so ${what} has no home`);
        continue;
      }
      /* Both fields, because New Brunswick carries its instrumental definition in
         `note` and Newfoundland carries its minimums in `text`. Neither is the
         whole bundle. */
      const carried = `${condition.text ?? ""}\n${condition.note ?? ""}`;
      if (!figure.test(carried)) missing.push(`${id}: ${what} (${figure.source})`);
    }
    assert.deepEqual(missing, [], `${jurisdiction} no longer states, where the engine reads it:\n  ${missing.join("\n  ")}`);
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
