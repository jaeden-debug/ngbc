import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import type { RuleShape } from "./dimension-matrix.ts";
import { implementsOf } from "./dimension-matrix.ts";

/**
 * One regulatory truth about legal methods, across the two places that hold it.
 *
 * Hunt answers "what may I hunt with" from TWO sources that were built
 * separately and have never been compared:
 *
 *   - the certified rules' `permittedImplements`, per season — what the
 *     opportunity card, the method filter and the zone answer read;
 *   - the readiness bundle's method table, per species — what Ready to Hunt
 *     reads, with per-method restrictions and provenance.
 *
 * A hunter can see both in one session. Where they disagree, the product says
 * two different things about the same law and neither surface knows.
 *
 * WHAT THIS FOUND ON ITS FIRST RUN, and it is live rather than hypothetical:
 * Ontario's readiness table permits CROSSBOW for white-tailed deer, moose,
 * black bear and wild turkey. The certified rules for those four species list
 * BOW, MUZZLELOADER, RIFLE and SHOTGUN and no crossbow.
 *
 * The readiness side is the better-evidenced one. Its turkey entry cites LAW —
 * O. Reg. 665/98 s. 79(3), quoting "a draw weight of at least 45 kilograms at
 * the release latch mechanism" — and a regulation does not specify a crossbow's
 * draw weight for a species crossbows may not be used on. So the RULES are
 * missing a legal method, and the direction matters: a hunter filtering for a
 * crossbow gets nothing where crossbow hunting is legal, which is North
 * Ground's "no results" standing where the law's answer should be. §8 names
 * that as the over-strict failure, and notes that nobody ever reports it.
 *
 * The divergence is PINNED rather than tolerated, so a fifth species cannot
 * join it quietly and closing it is a deliberate edit.
 */

const REGULATORY = new URL("../../../../content/regulatory/", import.meta.url);

/**
 * Species where the two sources are known to disagree today, with the token.
 *
 * Each entry is a defect in the certified rules awaiting extraction by the
 * regulatory lane, not a licence for the disagreement. When a method is added
 * to the rules this test fails and the entry is deleted.
 */
const KNOWN_DIVERGENCE: Readonly<Record<string, readonly string[]>> = {
  /*
   * EMPTY, and that is the point. It held four crossbow entries — deer, moose,
   * black bear and turkey — until the regulatory lane read O. Reg. 670/98 s. 6
   * through O. Reg. 665/98 ss. 69 and 82 and encoded the crossbow on all 135
   * Ontario rules. The log's own test then failed, as designed, and the
   * entries were deleted rather than left describing a gap that had closed.
   *
   * Keep the mechanism. An empty log still fails the agreement test the moment
   * the two sources diverge again, and a future entry has to be deleted the
   * same way.
   */
};

interface ReadinessBundle {
  methods?: Record<string, { allowed?: Record<string, unknown> }>;
  speciesMethods?: Record<string, { methods: string }>;
}

function readinessMethods(file: string): Map<string, Set<string>> {
  const bundle = JSON.parse(readFileSync(new URL(`readiness/${file}`, REGULATORY), "utf8")) as ReadinessBundle;
  const out = new Map<string, Set<string>>();
  for (const [speciesId, entry] of Object.entries(bundle.speciesMethods ?? {})) {
    const allowed = bundle.methods?.[entry.methods]?.allowed ?? {};
    out.set(speciesId, new Set(Object.keys(allowed)));
  }
  return out;
}

function ruleMethods(jurisdictionPrefix: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const file of readdirSync(new URL(".", REGULATORY).pathname)) {
    if (!file.startsWith(jurisdictionPrefix) || !file.endsWith(".json")) continue;
    let bundle: { rules?: RuleShape[] };
    try {
      bundle = JSON.parse(readFileSync(new URL(file, REGULATORY), "utf8"));
    } catch { continue; }
    for (const rule of bundle.rules ?? []) {
      const speciesId = rule.speciesId;
      if (!speciesId) continue;
      const tokens = implementsOf(rule);
      if (!tokens.length) continue;
      const set = out.get(speciesId) ?? new Set<string>();
      for (const token of tokens) set.add(token);
      out.set(speciesId, set);
    }
  }
  return out;
}

test("both sources are readable and overlap, or this test proves nothing", () => {
  /* A positive control. Every assertion below passes over an empty overlap, so
     a renamed bundle or a changed field would turn this file green while the
     two sources drifted freely. */
  const readiness = readinessMethods("ca-on-2026.json");
  const rules = ruleMethods("ca-on-");
  assert.ok(readiness.size >= 4, `readiness declares methods for ${readiness.size} species`);
  assert.ok(rules.size >= 4, `the rules declare implements for ${rules.size} species`);
  const overlap = [...readiness.keys()].filter((speciesId) => rules.has(speciesId));
  assert.ok(overlap.length >= 4, `the two sources overlap on ${overlap.length} species`);
});

test("the two sources agree about legal methods, except where the gap is recorded", () => {
  const readiness = readinessMethods("ca-on-2026.json");
  const rules = ruleMethods("ca-on-");

  const unrecorded: string[] = [];
  for (const [speciesId, allowed] of readiness) {
    const stated = rules.get(speciesId);
    if (!stated) continue; // no certified rule states implements; nothing to compare
    const known = new Set(KNOWN_DIVERGENCE[speciesId] ?? []);
    for (const method of allowed) {
      if (stated.has(method) || known.has(method)) continue;
      unrecorded.push(`${speciesId}: readiness permits ${method}, the rules do not`);
    }
    /* And the other direction: a rule permitting a method readiness does not
       know about would mean Ready to Hunt understates what a hunter may carry. */
    for (const method of stated) {
      if (allowed.has(method)) continue;
      unrecorded.push(`${speciesId}: the rules permit ${method}, readiness does not`);
    }
  }
  assert.deepEqual(unrecorded, [], `the two sources disagree and it is not recorded:\n  ${unrecorded.join("\n  ")}`);
});

