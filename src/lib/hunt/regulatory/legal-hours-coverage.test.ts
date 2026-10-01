import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

/**
 * Every jurisdiction's solar offset is swept, and the semantic guard beside
 * this one is kept COMPLETE as jurisdictions are added.
 *
 * WHY THIS EXISTS, AND IT IS NOT A SECOND COPY OF `legal-hours-sign.test.ts`.
 * That file does the richer check — it reads each rule's `statedAs` sentence and
 * asserts the sign agrees with the authority's own words. It is the better test.
 * But it reaches its subjects through FIFTEEN NAMED IMPORTS, and a list only
 * covers what someone remembered to add to it.
 *
 * Measured rather than assumed: a new file carrying
 * `beforeSunriseMinutes: -30` — the exact defect that denied New Brunswick,
 * Newfoundland and Saskatchewan hunters the first half hour of lawful light
 * every day of every season — leaves `legal-hours-sign.test.ts` GREEN, because
 * nothing imports it. The fourteenth jurisdiction is the one at risk, and it is
 * the one nobody is looking at.
 *
 * So this sweeps the DIRECTORY instead of a list. Two assertions:
 *
 *   1. No production rule opens AFTER sunrise via a negative offset.
 *
 * THE SYNC ASSERTION IS RETIRED. This file also held "every file declaring an
 * offset is reachable from the semantic guard", which forced that guard's
 * fifteen hand-kept imports to grow. `legal-hours-sign.test.ts` now DISCOVERS
 * its own subjects, so there is no list left to hold in step, and a check that
 * guards a list outliving the list is debt.
 *
 * WHAT STAYS, AND WHY IT IS NOT REDUNDANT. Discovery reaches a rule by IMPORTING
 * its module, and skips a module that throws on import because it needs runtime
 * context. This reads the literal out of the SOURCE, so it still covers a module
 * discovery cannot load — a different mechanism, which is the point. Two checks
 * that fail together are one check.
 */

const DIR = new URL(".", import.meta.url);
const FIELD = "beforeSunriseMinutes";

/** Production rule modules — tests and the sweep itself are not subjects. */
function productionFiles(): string[] {
  return readdirSync(DIR.pathname)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.endsWith(".d.ts"))
    .sort();
}

function read(file: string): string {
  return readFileSync(new URL(file, DIR), "utf8");
}

/** Files that DECLARE an offset value, not merely mention the field in prose. */
function filesDeclaringAnOffset(): string[] {
  return productionFiles().filter((f) => new RegExp(`${FIELD}:\\s*-?\\d`).test(read(f)));
}

test("the sweep finds the offsets at all", () => {
  /*
   * A POSITIVE CONTROL, because every assertion below is satisfied by finding
   * nothing. Rename the field, move the modules, change the literal style, and
   * this file would otherwise go green while no jurisdiction's hours were
   * checked by it again.
   */
  const declaring = filesDeclaringAnOffset();
  assert.ok(
    declaring.length >= 10,
    `only ${declaring.length} files declare ${FIELD}; the sweep has stopped finding its subjects`,
  );
});

test("no jurisdiction opens its legal window AFTER sunrise through a negative offset", () => {
  /*
   * `legalTimeFor` shifts the clock by `-beforeSunriseMinutes`, so a NEGATIVE
   * value opens LATE. The field name is the convention; a window that genuinely
   * opens after sunrise is a different fact and needs its own basis.
   */
  const offenders: string[] = [];
  for (const file of filesDeclaringAnOffset()) {
    const lines = read(file).split("\n");
    lines.forEach((line, i) => {
      const match = new RegExp(`${FIELD}:\\s*(-\\d+)`).exec(line);
      if (match) offenders.push(`${file}:${i + 1} ${FIELD}: ${match[1]} — opens AFTER sunrise`);
    });
  }
  assert.deepEqual(offenders, [], `a hunter loses lawful morning here:\n  ${offenders.join("\n  ")}`);
});
