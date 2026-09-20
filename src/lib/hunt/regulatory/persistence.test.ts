import assert from "node:assert/strict";
import { test } from "node:test";
import majorGame from "../../../../content/regulatory/ca-on-major-game-2026.json" with { type: "json" };
import smallGame from "../../../../content/regulatory/ca-on-small-game-2026.json" with { type: "json" };
import { REPRESENTABLE_DIMENSIONS } from "../../../../scripts/publish-regulations.mjs";

/**
 * The database must be able to say what a rule is conditional on.
 *
 * A conditional rule persisted without its conditions reads as unconditional. In
 * Ontario that is not abstract: the WMU 71 deer rule permits shotguns, muzzle-
 * loaders and bows and excludes rifles through a footnote, under a table heading
 * that names rifles. Stored flat, the row tells a rifle hunter the season is
 * open. These tests fail the build rather than let that reach the store.
 */

const bundles = [
  { name: "small game", bundle: smallGame as { rules: Array<Record<string, unknown>> } },
  { name: "major game", bundle: majorGame as { rules: Array<Record<string, unknown>> } },
];

test("every dimension in every certified bundle is one the publisher can store", () => {
  for (const { name, bundle } of bundles) {
    for (const rule of bundle.rules) {
      const appliesWhen = (rule.appliesWhen ?? {}) as Record<string, unknown>;
      for (const dimension of Object.keys(appliesWhen)) {
        assert.ok(
          REPRESENTABLE_DIMENSIONS.has(dimension),
          `${name}: rule ${rule.id} turns on "${dimension}", which the publisher would drop`,
        );
      }
    }
  }
});

test("a stated closure never carries season dates", () => {
  // "None" in a non-resident cell is the authority closing the season. A row
  // that says so and also carries dates would contradict itself, and the
  // database constraint refuses it — this catches it before the write.
  for (const { name, bundle } of bundles) {
    for (const rule of bundle.rules) {
      if (rule.declaredNoSeason !== true) continue;
      assert.equal(rule.seasonPhrase ?? null, null, `${name}: ${rule.id} declares no season but states one`);
    }
  }
});

test("the major-game bundle really does carry conditional rules", () => {
  // Guards the guard: if this bundle ever stopped carrying conditions, the test
  // above would pass vacuously and the protection would be silently gone.
  const conditional = (majorGame as { rules: Array<Record<string, unknown>> }).rules
    .filter((rule) => Object.keys((rule.appliesWhen ?? {}) as object).length > 0);
  assert.ok(conditional.length > 50, `expected many conditional rules, found ${conditional.length}`);

  const implementRestricted = conditional.filter((rule) => {
    const implements_ = (rule.appliesWhen as Record<string, unknown>).permittedImplements;
    return Array.isArray(implements_) && !implements_.includes("RIFLE");
  });
  assert.ok(
    implementRestricted.length > 0,
    "expected at least one rule that excludes rifles — that is the case the schema exists for",
  );
});
