import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { LegalTimeRule } from "./legal-time.ts";
import { SASKATCHEWAN_HOURS } from "./saskatchewan.ts";
import { NEW_BRUNSWICK_HOURS } from "./new-brunswick.ts";
import { NEWFOUNDLAND_BIG_GAME_HOURS } from "./newfoundland-legal-time.ts";

/**
 * A BUNDLE'S `legalHours` BLOCK IS A SECOND HOME FOR A RULE THE ENGINE READS
 * SOMEWHERE ELSE.
 *
 * The builders emit a `legalHours` block into the bundle; the engine evaluates
 * the rule exported from the jurisdiction's module. Both quote the same
 * authority, both carry the same offsets, and nothing compared them.
 *
 * FOUND BY A MUTATION PASS THAT HAD NO POSITIVE CONTROL BECAUSE OF THIS DEFECT.
 * Five safety-relevant figures were changed in Saskatchewan's builder and the
 * bundle rebuilt; the whole suite stayed green. Four of them were genuinely
 * unpinned (now pinned in `saskatchewan.test.ts`, by condition id). The fifth
 * was the legal-hours sentence, which I had included as a CONTROL precisely
 * because `legal-hours-sign.test.ts` pins it — and it passed anyway, because
 * that test reads `SASKATCHEWAN_HOURS` from the module while the mutation moved
 * the bundle's copy. The control was reading the other home.
 *
 * That is the same shape as `crossesYear`: one fact, two homes, no comparison —
 * and the same shape as a guard anchored to a cross-check note instead of to the
 * operative record. A test pinned to a second copy reports the fact as held
 * while the copy the engine reads drifts. This is the comparison.
 */

const COMPARED: ReadonlyArray<readonly [string, LegalTimeRule]> = [
  ["ca-sk-2026.json", SASKATCHEWAN_HOURS],
  ["ca-nb-2026.json", NEW_BRUNSWICK_HOURS],
  ["ca-nl-2026.json", NEWFOUNDLAND_BIG_GAME_HOURS],
];

/**
 * Nova Scotia's block describes a PUBLISHED TABLE, not an offset: General
 * Wildlife Regulations s. 11(3) defines "sunrise" and "sunset" as the tabulated
 * values in Schedule A, which North Ground has not transcribed and whose rows our
 * astronomy must never replace. Its module is `legalTimeNotCertified`, so there
 * is no rule to compare field-for-field. Named rather than silently skipped.
 */
const NO_COMPARABLE_RULE = new Set(["ca-ns-2026.json"]);

/**
 * ONE HOME, NOT TWO: the module evaluates the bundle's own block, so there is
 * no second copy to drift. Iowa states hours per species (571 IAC 96 — fixed
 * 8 a.m. to 4:30 p.m. for pheasant, sunrise to sunset for cottontail, no
 * restriction for squirrels) and `iowa.ts` reads `IOWA_BUNDLE.legalHours[speciesId]`.
 * Named with the module that reads it, and checked below, so a module that
 * later grows its own constant cannot stay listed here.
 */
const READ_FROM_THE_BUNDLE: ReadonlyMap<string, string> = new Map([["us-ia-2026.json", "iowa.ts"]]);

const DIRECTORY = join(process.cwd(), "content", "regulatory");

function bundlesWithAnHoursBlock(): string[] {
  return readdirSync(DIRECTORY)
    .filter((name) => name.endsWith(".json"))
    .filter((name) => {
      try { return Boolean(JSON.parse(readFileSync(join(DIRECTORY, name), "utf8")).legalHours); }
      catch { return false; }
    });
}

test("every bundle that states its own hours is compared to the rule the engine reads", () => {
  const withBlock = bundlesWithAnHoursBlock();
  /* The positive control: an empty sweep and a clean one are the same output. */
  assert.ok(withBlock.length >= 3, `only ${withBlock.length} bundles carry a legalHours block, so this may be reading nothing`);

  const compared = new Set(COMPARED.map(([file]) => file));
  assert.deepEqual(
    withBlock.filter((name) => !compared.has(name) && !NO_COMPARABLE_RULE.has(name) && !READ_FROM_THE_BUNDLE.has(name)),
    [],
    "a bundle emits a legalHours block that nothing compares to a module rule — add it above, or name why it has none",
  );
  /* And a name here for a bundle that no longer carries a block would mean this
     is comparing something that is not there. */
  for (const [file] of COMPARED) {
    assert.ok(withBlock.includes(file), `${file} is compared here and no longer carries a legalHours block`);
  }
});

test("the bundle's copy and the module's rule say the same thing", () => {
  for (const [file, rule] of COMPARED) {
    const block = JSON.parse(readFileSync(join(DIRECTORY, file), "utf8")).legalHours as Record<string, unknown>;
    assert.equal(block.basis, rule.basis, `${file}: basis`);
    /* The authority's own words are the fact, so a difference here is one of the
       two having been edited without the other. */
    assert.equal(block.statedAs, rule.statedAs,
      `${file}: the bundle and the module quote the authority differently, so one of them has drifted`);
    assert.equal(block.section, rule.section, `${file}: section`);

    /* Offsets only where the bundle states them: Newfoundland's block carries the
       sentence and leaves the arithmetic to the module, which is a deliberate
       difference rather than a drift. */
    if (rule.basis === "SUNRISE_SUNSET_OFFSET" && "beforeSunriseMinutes" in block) {
      assert.equal(block.beforeSunriseMinutes, rule.beforeSunriseMinutes, `${file}: beforeSunriseMinutes`);
      assert.equal(block.afterSunsetMinutes, rule.afterSunsetMinutes, `${file}: afterSunsetMinutes`);
    }
  }
});

test("a bundle named as the engine's only home really is read from the bundle", () => {
  for (const [file, module] of READ_FROM_THE_BUNDLE) {
    const source = readFileSync(join(process.cwd(), "src", "lib", "hunt", "regulatory", module), "utf8");
    assert.match(source, /_BUNDLE\.legalHours\[/, `${module} no longer reads ${file}'s legalHours block, so it has a second home to compare`);
    assert.doesNotMatch(source, /:\s*LegalTimeRule\s*=\s*\{/, `${module} declares its own LegalTimeRule constant beside ${file}'s block`);
  }
});
