import assert from "node:assert/strict";
import test from "node:test";
import type { IsoDate } from "../../content-contract/index.ts";
import { albertaLegalTime } from "./alberta-legal-time.ts";
import { OBSERVED_CLOCK_OVERRIDES, tzdataAgrees } from "./observed-clock.ts";
import { JURISDICTION_TIME_BASIS, basisDisagreements, timeBasisFor } from "./time-basis.ts";

/**
 * The declared time basis of every served jurisdiction, and what these checks
 * can and cannot see.
 *
 * THEY CATCH the platform's tz database moving underneath us: a runtime upgrade
 * that changes what a zone does parts company with the declared basis here.
 *
 * THEY CANNOT CATCH the law moving while tzdata stays put, which is what both
 * Manitoba and Alberta did. That needs a person reading a legislature, and no
 * assertion in this file substitutes for it — which is why each row carries
 * whether the authority was actually read.
 */

test("only the two known lags disagree with the platform", () => {
  /*
   * Manitoba and Alberta both legislated permanent daylight time while tzdata
   * still returns them to standard time in winter, so both appear — in January
   * only, because in July the two bases agree.
   *
   * ANY OTHER ENTRY APPEARING means the tz database changed under us, which is
   * the failure this check exists for.
   */
  const found = basisDisagreements().map((entry) => `${entry.jurisdictionId} ${entry.month}`).sort();
  assert.deepEqual(found, ["jurisdiction:ca-ab january", "jurisdiction:ca-mb january"]);
});

test("every jurisdiction that disagrees with the platform has an override", () => {
  /* A declared basis the platform does not implement, with nothing rendering
     it, is a row that documents a defect instead of fixing one. */
  const overridden = new Set(OBSERVED_CLOCK_OVERRIDES.map((entry) => entry.timeZone));
  for (const entry of basisDisagreements()) {
    assert.ok(overridden.has(entry.timeZone), `${entry.jurisdictionId} disagrees with tzdata and nothing renders its clock`);
  }
  /* And the converse: an override for a zone whose basis is not declared is an
     offset nobody can trace to an instrument. */
  for (const override of OBSERVED_CLOCK_OVERRIDES) {
    const declared = JURISDICTION_TIME_BASIS.find((basis) => basis.timeZone === override.timeZone);
    assert.ok(declared, `${override.timeZone} has an override and no declared basis`);
    assert.equal(declared!.expected.january, override.offsetMinutes, "the override and the basis must state the same law");
  }
});

test("Alberta's clock no longer steps an hour at the boundary", () => {
  /*
   * Found by this sweep rather than by a report, and fixed 32 days before it
   * would have reached a hunter. The step is the signature: 08:03 to 07:05 is
   * an hour of clock, not an hour of sun.
   */
  const at = (date: string) => albertaLegalTime("species:white-tailed-deer", { latitude: 53.55, longitude: -113.49 }, date as IsoDate, "America/Edmonton" as never);
  const before = at("2026-10-31");
  const after = at("2026-11-01");
  assert.ok(before.status === "RESOLVED" && after.status === "RESOLVED");
  if (before.status !== "RESOLVED" || after.status !== "RESOLVED") return;
  const minutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
  assert.ok(Math.abs(minutes(after.window.opensAt) - minutes(before.window.opensAt)) <= 5, "an hour means the basis changed, not the sun");
  assert.ok(after.observedClock, "and the divergence is stated");
});

test("each row says whether anyone read the authority", () => {
  /*
   * The distinction the file exists for. A row that asserted a basis without
   * naming it as an assertion is how `manitoba-legal-time.ts` carried a true
   * sentence that became false with nothing failing.
   */
  for (const entry of JURISDICTION_TIME_BASIS) {
    assert.ok(entry.establishedBy.length > 20, `${entry.jurisdictionId} must name what establishes its basis`);
    assert.match(entry.sourceUrl, /^https:\/\//);
    if (entry.verification.status === "VERIFIED") {
      assert.match(entry.verification.on, /^\d{4}-\d{2}-\d{2}$/);
    } else {
      assert.ok(entry.verification.reason.length > 40, `${entry.jurisdictionId} must say why it is unverified`);
    }
  }
  /* Only what was actually read at the source is VERIFIED. Two of seven, and
     saying so is the point — a sweep that marked all seven checked would be
     the assumption it was written to remove. */
  const verified = JURISDICTION_TIME_BASIS.filter((entry) => entry.verification.status === "VERIFIED").map((entry) => entry.jurisdictionId);
  assert.deepEqual(verified.sort(), ["jurisdiction:ca-ab", "jurisdiction:ca-mb"]);
});

test("a jurisdiction Hunt serves but has not declared is visible as a gap", () => {
  assert.ok(timeBasisFor("jurisdiction:ca-mb"));
  /* Newfoundland, Nova Scotia, New Brunswick, PEI and the served American
     states have layers and no declared basis yet. `timeBasisFor` returns null
     rather than a default, so nothing can read a missing row as a checked one. */
  assert.equal(timeBasisFor("jurisdiction:ca-nl"), null);
  assert.equal(timeBasisFor("jurisdiction:us-mt"), null);
});

test("an override that is no longer needed fails the suite", () => {
  for (const entry of OBSERVED_CLOCK_OVERRIDES) {
    assert.equal(
      tzdataAgrees(entry),
      false,
      `This runtime's tzdata now agrees with ${entry.authority} for ${entry.timeZone}. Delete the override; the basis row stays.`,
    );
  }
});
