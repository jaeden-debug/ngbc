import assert from "node:assert/strict";
import { test } from "node:test";
import { canadaCoverageReport } from "./report.ts";

/**
 * Spatial coverage is not regulatory coverage, and the gap between them is the
 * one this file exists to keep visible.
 *
 * Eleven of eleven in-scope jurisdictions have parity-certified geography, and
 * six of them hold zero certified rules. A hunter there gets a correctly named
 * zone and no season. That is honest and it is not coverage, so nothing may
 * report it as one.
 */

function inScope() {
  return canadaCoverageReport().jurisdictions.filter(
    (entry) => entry.scope?.state !== "OUT_OF_SCOPE" && entry.kind !== "federal",
  );
}

test("a jurisdiction that answers seasons never silently stops answering them", () => {
  /*
   * The regression direction, and the one worth a build failure.
   *
   * These five were taken from zero to certified rules by deliberate work. A
   * refactor, a bad merge or a dropped bundle that returns one of them to zero
   * would leave its zones drawn and its answers gone — which looks, from the
   * map, exactly like a jurisdiction nobody has started yet. Pinned by name
   * because the whole point is that losing one must be loud.
   */
  const answering = new Set(inScope().filter((entry) => entry.regulatory.rules > 0).map((entry) => entry.code));
  for (const code of ["CA-ON", "CA-QC", "CA-MB", "CA-AB", "CA-BC"]) {
    assert.ok(answering.has(code), `${code} has lost its certified regulatory rules`);
  }
});

test("every jurisdiction with drawn zones and no rules declares what is missing", () => {
  /*
   * Not a failure — six jurisdictions are legitimately mid-milestone. What
   * would be a failure is one of them going quiet about it: §9 says a remaining
   * gap must be intentionally UNKNOWN rather than accidentally absent, and an
   * empty `knownGaps` on a zero-rule jurisdiction is a claim of completeness
   * made by omission.
   */
  for (const entry of inScope()) {
    if (entry.regulatory.rules > 0) continue;
    assert.ok(
      entry.knownGaps.length > 0,
      `${entry.code} has zones, no rules, and says nothing about why`,
    );
  }
});

test("coreGameComplete cannot be met while any in-scope jurisdiction holds zero rules", () => {
  /*
   * The milestone and the counts are computed separately, so they can disagree.
   * If they ever do, the milestone is the one that would be quoted.
   */
  const zero = inScope().filter((entry) => entry.regulatory.rules === 0);
  const { coreGameComplete } = canadaCoverageReport().milestones;
  if (zero.length > 0) {
    assert.equal(coreGameComplete.met, false,
      `coreGameComplete claims met while ${zero.map((e) => e.code).join(", ")} hold zero rules`);
  }
});

test("the gate can fail — a zero-rule jurisdiction is detected", () => {
  /* Positive control: without it, the assertions above pass whether or not
     they can see anything, which is the shape this repository keeps finding. */
  const zero = inScope().filter((entry) => entry.regulatory.rules === 0).map((entry) => entry.code);
  assert.ok(zero.length > 0, "expected the remaining zero-rule jurisdictions to be visible to this gate");
  /*
   * UPDATED TWICE ON 2026-09-30, and the updates are the point of the line.
   *
   * Nova Scotia and then Newfoundland and Labrador both left this list on the
   * same day — Nova Scotia with 11 rules over 8 species from six codified
   * instruments, Newfoundland with 13 rules over 3 species from an annual Order
   * and three standing species orders. All three Atlantic jurisdictions the
   * owner named were here that morning; Prince Edward Island is the one left,
   * and it is blocked on a source rather than on work: its 11-page regulation
   * contains no season dates at all and the instrument that carries them has
   * not been located.
   *
   * The positive control is kept rather than weakened. Something must still be
   * VISIBLE to this gate, so it cannot pass by seeing nothing, and naming the
   * jurisdictions explicitly means the next one to leave fails this line and is
   * updated deliberately.
   */
  assert.ok(zero.includes("CA-PE"),
    "Prince Edward Island is the Atlantic jurisdiction still holding zero rules");
  for (const left of ["CA-NS", "CA-NL", "CA-NB", "CA-SK"]) {
    assert.ok(!zero.includes(left), `${left} holds certified rules and must no longer be counted as zero-rule`);
  }
  /* And the gate must still see the four boundary-only jurisdictions, which is
     what makes the "can fail" claim above true rather than incidental. */
  for (const stillZero of ["CA-YT"]) {
    assert.ok(zero.includes(stillZero), `${stillZero} holds no rules and must be visible to this gate`);
  }
});
