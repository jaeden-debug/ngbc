import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { basename } from "node:path";
import test from "node:test";

/**
 * Hunter orange reaches a hunter in every jurisdiction that requires it — and
 * the surface it arrives on is recorded, because it is not the same one
 * everywhere.
 *
 * THE SHAPE OF THIS DEFECT IS NOT DISAGREEMENT, IT IS PARTITION. The crossbow
 * gap was two sources saying different things about one fact. This is one fact
 * living in a DIFFERENT PLACE per jurisdiction, with each place internally
 * correct and no surface showing both:
 *
 *     Manitoba, New Brunswick   orange is a REGULATORY CONDITION — it earns a
 *                               `!` on the map and appears in the zone card
 *     Ontario, Québec           orange is a READINESS field — it appears in
 *                               Ready to Hunt and nowhere on the map
 *
 * No jurisdiction has both, so nothing contradicts anything. What breaks is
 * what a hunter LEARNS: someone who found Manitoba's orange requirement as a
 * condition marker will scan an Ontario zone, see no marker, and have been
 * given no reason to look in Ready to Hunt. The absence of a `!` reads as the
 * absence of a requirement, which is the silent direction again.
 *
 * This test does not decide which home is right — that is a product decision
 * about where a standing legal requirement belongs, and §41A already leans
 * toward "said once" for a jurisdiction-wide rule. What it refuses to allow is
 * a jurisdiction arriving with orange in NEITHER place, which would be silence
 * about a requirement a hunter can be turned away or prosecuted for missing.
 */

const REGULATORY = new URL("../../../../content/regulatory/", import.meta.url);

/** Where each jurisdiction's hunter-orange requirement is held today. */
type OrangeHome = "CONDITION" | "READINESS" | "BOTH" | "NEITHER";

function jurisdictionKey(file: string): string {
  return basename(file).replace(/-\d{4}\.json$/, "").replace(/\.json$/, "");
}

function conditionJurisdictions(): Set<string> {
  const found = new Set<string>();
  for (const file of readdirSync(new URL(".", REGULATORY).pathname)) {
    if (!file.endsWith(".json")) continue;
    let bundle: { sources?: Array<{ conditions?: Array<{ id?: string; text?: string }> }> };
    try {
      bundle = JSON.parse(readFileSync(new URL(file, REGULATORY), "utf8"));
    } catch { continue; }
    for (const source of bundle.sources ?? []) {
      for (const condition of source.conditions ?? []) {
        if (/orange/i.test(`${condition.id ?? ""}${condition.text ?? ""}`)) found.add(jurisdictionKey(file));
      }
    }
  }
  return found;
}

function readinessJurisdictions(): Set<string> {
  const found = new Set<string>();
  const dir = new URL("readiness/", REGULATORY);
  for (const file of readdirSync(dir.pathname)) {
    if (!file.endsWith(".json")) continue;
    let bundle: { orange?: unknown };
    try {
      bundle = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
    } catch { continue; }
    if (bundle.orange) found.add(jurisdictionKey(file));
  }
  return found;
}

function homes(): Map<string, OrangeHome> {
  const conditions = conditionJurisdictions();
  const readiness = readinessJurisdictions();
  const out = new Map<string, OrangeHome>();
  for (const key of new Set([...conditions, ...readiness])) {
    const inCondition = conditions.has(key);
    const inReadiness = readiness.has(key);
    out.set(key, inCondition && inReadiness ? "BOTH" : inCondition ? "CONDITION" : "READINESS");
  }
  return out;
}

/**
 * The split as it stands, pinned so it cannot change without someone deciding.
 *
 * Not an endorsement of either home. A jurisdiction moving from one to the
 * other, or gaining both, fails here and is a product decision rather than a
 * data edit.
 */
const EXPECTED: Readonly<Record<string, OrangeHome>> = {
  "ca-mb": "CONDITION",
  "ca-nb": "CONDITION",
  "ca-on": "READINESS",
  "ca-qc": "READINESS",
};

test("hunter orange is found in the corpus at all", () => {
  /* A positive control: every assertion below is satisfied by finding nothing,
     so a renamed field or a changed id would turn this file green while orange
     vanished from the product. */
  const found = homes();
  assert.ok(found.size >= 4, `orange was located in only ${found.size} jurisdictions`);
  assert.ok([...found.values()].includes("CONDITION"), "at least one jurisdiction carries it as a condition");
  assert.ok([...found.values()].includes("READINESS"), "and at least one as a readiness field");
});

test("no jurisdiction requires orange and holds it nowhere", () => {
  /*
   * The failure this exists to prevent. A jurisdiction landing with orange in
   * neither home is silence about a requirement a hunter can be turned away or
   * prosecuted for missing — and silence is indistinguishable from "not
   * required" on every surface we have.
   */
  const found = homes();
  const missing = Object.keys(EXPECTED).filter((key) => !found.has(key));
  assert.deepEqual(missing, [], `these jurisdictions hold hunter orange in neither place: ${missing.join(", ")}`);
});

test("the split between the two homes is recorded, not drifting", () => {
  const found = homes();
  const drifted: string[] = [];
  for (const [key, home] of found) {
    const expected = EXPECTED[key];
    if (!expected) {
      drifted.push(`${key}: newly carries orange as ${home}; record where it belongs`);
    } else if (expected !== home) {
      drifted.push(`${key}: was ${expected}, is now ${home}`);
    }
  }
  assert.deepEqual(drifted, [], `hunter orange moved home without a decision:\n  ${drifted.join("\n  ")}`);
});

test("the two homes reach a hunter on different surfaces, which is the finding", () => {
  /*
   * Stated as an assertion so it is not merely a comment: today the split is
   * real, and it means the same requirement arrives by map marker in one
   * province and by Ready to Hunt in another. If this ever fails because every
   * jurisdiction uses one home, the inconsistency has been resolved and this
   * test should be deleted rather than updated.
   */
  const found = homes();
  const asCondition = [...found].filter(([, home]) => home === "CONDITION").map(([key]) => key);
  const asReadiness = [...found].filter(([, home]) => home === "READINESS").map(([key]) => key);
  assert.ok(asCondition.length > 0 && asReadiness.length > 0,
    "orange is now held the same way everywhere — delete this test and say so");
});
