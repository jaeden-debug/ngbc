import assert from "node:assert/strict";
import { test } from "node:test";
import majorGame from "../../../../content/regulatory/ca-on-major-game-2026.json" with { type: "json" };
import manitoba from "../../../../content/regulatory/ca-mb-2026.json" with { type: "json" };
import smallGame from "../../../../content/regulatory/ca-on-small-game-2026.json" with { type: "json" };
import {
  effectivePeriod, groupMemberships, REPRESENTABLE_DIMENSIONS, ruleColumns, ruleDifferences,
} from "../../../../scripts/publish-regulations.mjs";

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
  { name: "Manitoba", bundle: manitoba as unknown as { rules: Array<Record<string, unknown>> } },
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

/* ── Manitoba: a rule is more than its dates and its conditions ─────────── */

type Rule = Record<string, unknown> & { id: string };
const MB = manitoba as unknown as {
  certifiedPeriod: { from: string; to: string };
  rules: Rule[];
  groups: Array<Record<string, unknown> & { id: string; zoneIds: string[]; partialZoneIds?: string[] }>;
};
const mbRule = (predicate: (rule: Rule) => boolean) => {
  const rule = MB.rules.find(predicate);
  assert.ok(rule, "the bundle holds the case this test is about");
  return rule;
};

test("a Manitoba rule is stored with everything the engine evaluates", () => {
  for (const rule of MB.rules) {
    const row = ruleColumns(MB, rule);
    // The windows, the rule's geography and its disputes are what make GHA 7A a
    // CONFLICT and CFB Shilo closed to grouse. Dropped, the row reads as settled.
    assert.deepEqual(row.season_windows, rule.windows ?? []);
    assert.deepEqual(row.geography, rule.geography ?? null);
    assert.deepEqual(row.disputes, rule.disputes ?? []);
    assert.deepEqual(row.notes, rule.notes ?? []);
    assert.deepEqual(row.limits, rule.limits ?? {});
    assert.deepEqual(row.applies_when, rule.appliesWhen ?? {});
  }
  const disputed = mbRule((rule) => Array.isArray(rule.disputes) && rule.disputes.length > 0);
  assert.ok((ruleColumns(MB, disputed).disputes as unknown[]).length > 0);
});

test("a Manitoba rule is in force for the certified period, not a calendar year", () => {
  // No Manitoba rule carries a calendar source year. Writing one would have
  // produced "undefined-01-01".
  for (const rule of MB.rules) {
    assert.deepEqual(effectivePeriod(MB, rule), { from: "2026-06-16", to: "2027-03-31" });
  }
  assert.throws(() => effectivePeriod({}, { id: "regulatory_rule:x" }), /no source year/);
  assert.deepEqual(effectivePeriod({}, { id: "regulatory_rule:x", sourceYear: 2026 }), { from: "2026-01-01", to: null });
});

test("a group that excludes part of an area stores that area as a partial member", () => {
  // "Areas 26 and 36 (excluding Whiteshell Game Bird Refuge)": all of 26, part of 36.
  const whiteshell = MB.groups.find((group) => String(group.officialSpec).includes("Whiteshell"));
  assert.ok(whiteshell);
  const members = groupMemberships(whiteshell);
  assert.deepEqual(
    members.filter(({ membership }) => membership === "PARTIAL").map(({ zoneId }) => zoneId),
    ["management_zone:ca-mb-gha-36"],
  );
  assert.ok(members.some(({ zoneId, membership }) => zoneId === "management_zone:ca-mb-gha-26" && membership === "FULL"));
  // Every member of every group is counted once.
  for (const group of MB.groups) {
    const ids = groupMemberships(group).map(({ zoneId }) => zoneId);
    assert.equal(new Set(ids).size, ids.length, `${group.id} lists a zone twice`);
  }
});

test("the read-back check sees a dropped condition, and does not see key order", () => {
  const rule = mbRule((candidate) => Object.keys((candidate.appliesWhen ?? {}) as object).length > 1);
  const expected = ruleColumns(MB, rule);
  const reordered = Object.fromEntries(Object.entries(expected).reverse().map(([key, value]) => [
    key,
    value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).reverse()) : value,
  ]));
  assert.deepEqual(ruleDifferences(expected, reordered), []);

  const flattened = { ...expected, applies_when: {} };
  assert.deepEqual(ruleDifferences(expected, flattened).map(({ column }) => column), ["applies_when"]);
  const undated = { ...expected, season_windows: [] };
  assert.deepEqual(ruleDifferences(expected, undated).map(({ column }) => column), ["season_windows"]);
});
