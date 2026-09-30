import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Every condition in every regulatory bundle carries its own source.
 *
 * WHY THIS EXISTS, AND WHY IT IS A DATA TEST RATHER THAN A TYPE.
 *
 * `condition.ts` says the design's whole point is that "a condition keeps its
 * own provenance. Not 'text (section)' in one string, because a renderer cannot
 * then group several conditions under one source affordance, cannot link the
 * right instrument, and cannot be tested for having one."
 *
 * Nova Scotia shipped with ten conditions that each carried `citation` instead
 * of `sourceId` and `sourceSection`. The engine reads the contract's names, so
 * all ten reached a hunter with BOTH provenance fields undefined: a licence
 * requirement, a bag restriction and a Sunday prohibition, each stated as fact
 * with nothing behind it. Nothing failed. Nothing rendered an error. The
 * citation was sitting in the file the whole time, under a name no consumer
 * reads.
 *
 * TypeScript could not catch it, and that is the durable lesson rather than an
 * excuse: a bundle is JSON loaded with an import assertion and cast through
 * `as unknown as`, so its shape is checked by nothing between the producer's
 * keyboard and the hunter's screen. The invariant therefore has to be asserted
 * against the FILES, and against all of them — not against the one province
 * that got it wrong, and not through the registry, because a bundle that is
 * written but not yet wired is exactly when a shape defect is cheapest to fix
 * and easiest to miss.
 *
 * It reads the directory rather than a list, so a new jurisdiction is covered
 * by existing here rather than by someone remembering to add it.
 */

const BUNDLES = join(process.cwd(), "content", "regulatory");

interface Condition { id?: unknown; text?: unknown; sourceId?: unknown; sourceSection?: unknown }
interface Source { id?: unknown; conditions?: Condition[] }
interface Bundle { bundleId?: unknown; sources?: Source[] }

function bundles(): Array<{ file: string; bundle: Bundle }> {
  return readdirSync(BUNDLES)
    .filter((file) => file.endsWith(".json"))
    .map((file) => ({ file, bundle: JSON.parse(readFileSync(join(BUNDLES, file), "utf8")) as Bundle }))
    .filter((entry) => Array.isArray(entry.bundle.sources));
}

test("every bundle is read, so the sweep cannot pass by finding nothing", () => {
  /* The positive control. An empty directory and a clean directory produce the
     same green test, and a glob that silently matches nothing is how a sweep
     comes to measure its own filter instead of the tree. */
  const found = bundles();
  assert.ok(found.length >= 6, `expected the regulatory bundles, found ${found.length}`);
  const conditions = found.flatMap((entry) => (entry.bundle.sources ?? []).flatMap((source) => source.conditions ?? []));
  assert.ok(conditions.length >= 50, `expected the bundles' conditions, found ${conditions.length}`);
});

test("no condition states a requirement without naming the provision it rests on", () => {
  const offenders: string[] = [];
  for (const { file, bundle } of bundles()) {
    for (const source of bundle.sources ?? []) {
      for (const condition of source.conditions ?? []) {
        const id = typeof condition.id === "string" ? condition.id : "(unnamed)";
        if (typeof condition.text !== "string" || !condition.text.trim()) offenders.push(`${file} ${id}: no text`);
        if (typeof condition.sourceId !== "string" || !condition.sourceId.startsWith("source:")) {
          offenders.push(`${file} ${id}: sourceId is ${JSON.stringify(condition.sourceId)}`);
        }
        if (typeof condition.sourceSection !== "string" || !condition.sourceSection.trim()) {
          offenders.push(`${file} ${id}: sourceSection is ${JSON.stringify(condition.sourceSection)}`);
        }
      }
    }
  }
  assert.deepEqual(offenders, [], `conditions reaching a hunter with no provenance:\n${offenders.join("\n")}`);
});

test("a condition's sourceId is one of the bundle's own declared sources", () => {
  /* A provenance field pointing at a source the bundle does not carry is worse
     than an absent one: the engine hands the id to a renderer that will look it
     up, find nothing, and show the condition bare — the same outcome as no
     provenance, arrived at by a path that looks correct in the file. */
  const offenders: string[] = [];
  for (const { file, bundle } of bundles()) {
    const declared = new Set((bundle.sources ?? []).map((source) => source.id).filter((id): id is string => typeof id === "string"));
    for (const source of bundle.sources ?? []) {
      for (const condition of source.conditions ?? []) {
        if (typeof condition.sourceId === "string" && !declared.has(condition.sourceId)) {
          offenders.push(`${file} ${String(condition.id)}: cites ${condition.sourceId}, which this bundle does not declare`);
        }
      }
    }
  }
  assert.deepEqual(offenders, [], offenders.join("\n"));
});

test("`citation` is never used where the contract says sourceSection", () => {
  /* The exact shape Nova Scotia had. It is banned by name rather than left to
     the two tests above, because a producer copying an older bundle would
     otherwise reintroduce the field, satisfy them by ALSO adding
     `sourceSection`, and leave two places for the same fact to disagree. */
  const offenders: string[] = [];
  for (const { file, bundle } of bundles()) {
    for (const source of bundle.sources ?? []) {
      for (const condition of source.conditions ?? []) {
        if ("citation" in (condition as Record<string, unknown>)) offenders.push(`${file} ${String(condition.id)}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `conditions carrying \`citation\` instead of \`sourceSection\`:\n${offenders.join("\n")}`);
});

test("a bundle claiming a content hash has declared what was hashed", () => {
  /* `source-rights.ts` holds this as A_SNAPSHOT_HASH_IMPLIES_A_PERMITTED_SNAPSHOT:
     a hash asserts that a permitted copy of the source exists to verify against.
     Nova Scotia carried a bare top-level sha256 with no subject and nothing
     verifying it, which is an unearned trust signal — so the field was removed
     rather than explained. A bundle may still carry one, but only where the
     source it covers declares its own archival right. */
  for (const { file, bundle } of bundles()) {
    const hash = (bundle as Record<string, unknown>).contentHash;
    if (hash === undefined) continue;
    assert.match(String(hash), /^sha256:[0-9a-f]{64}$/, `${file}: contentHash is not a sha256`);
    const sources = (bundle.sources ?? []) as Array<Record<string, unknown>>;
    /* Four ways a bundle legitimately declares its subject, all already in use:
       a per-source `contentHash` (Manitoba, Ontario, Québec), a named map of
       `sourceHashes` (Alberta, British Columbia, Idaho, Montana — "pdf",
       "wmu100", "overlays"), Manitoba's `scheduleHashes`, or an explicit
       `archiveState` saying the snapshot right was established. What none of
       them is: a bare hash at the top of the file with no subject anywhere. */
    assert.ok(
      sources.some((source) => ["contentHash", "sourceHashes", "scheduleHashes", "archiveState"].some((field) => source[field] !== undefined)),
      `${file}: claims a bundle-level contentHash while no source declares a snapshot it could be a hash of`,
    );
  }
});
