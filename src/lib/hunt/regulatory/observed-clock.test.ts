import assert from "node:assert/strict";
import test from "node:test";
import type { IsoDate } from "../../content-contract/index.ts";
import { manitobaLegalTime } from "./manitoba-legal-time.ts";
import {
  OBSERVED_CLOCK_OVERRIDES, observedClockOverride, platformOffsetMinutes, renderingZone, tzdataAgrees,
} from "./observed-clock.ts";
import { ontarioLegalTime } from "./ontario-legal-time.ts";

/**
 * Manitoba's permanent daylight time, and the rule that the law outranks the
 * platform's timezone database.
 *
 * The live defect, measured on production 2026-09-30: Winnipeg, white-tailed
 * deer, 20 November 2026 returned **07:21 to 17:07** when the law permits
 * **08:21 to 18:07**. Solar instants were right; the clock printed from them
 * was an hour early, because tzdata still moved Manitoba to CST on 1 November
 * and the province had legislated that it would not.
 *
 * An hour early is the unsafe direction — a hunter in the field with a rifle
 * before it is legal — and it was live on the map.
 */

const WINNIPEG = { latitude: 49.895, longitude: -97.138 };
const deer = (date: string) =>
  manitobaLegalTime("species:white-tailed-deer", WINNIPEG, date as IsoDate, "America/Winnipeg" as never);

test("Manitoba's clock after 1 November is the one the province legislated", () => {
  const result = deer("2026-11-20");
  assert.equal(result.status, "RESOLVED");
  if (result.status !== "RESOLVED") return;
  assert.deepEqual(result.window, { opensAt: "08:21", closesAt: "18:07" }, "the values the defect got wrong by an hour");
  assert.ok(result.observedClock, "and the divergence is stated rather than silent");
  /* The note now quotes the PROCLAMATION rather than the press release the fix
     originally shipped on. The press release was the right thing to act on and
     the wrong thing to keep citing. */
  const note = result.observedClock!.status === "SAME_AS_STATUTORY" ? result.observedClock!.statedAs : "";
  assert.match(note, /we name October 31, 2026, as the day on which/);
  assert.match(note, /S\.M\. 2023, c\. 4/);
});

test("there is no one-hour step at the boundary, which is what a wrong basis looks like", () => {
  /*
   * THE STRONGEST CHECK HERE. Sunrise moves a minute or two a day in late
   * autumn. If the clock basis changed underneath the answer, 31 October and
   * 1 November would be an hour apart — which is exactly what production did.
   * A continuous progression across the date the province changed is the proof
   * that the override lands where the law does.
   */
  const before = deer("2026-10-31");
  const after = deer("2026-11-01");
  assert.ok(before.status === "RESOLVED" && after.status === "RESOLVED");
  if (before.status !== "RESOLVED" || after.status !== "RESOLVED") return;
  const minutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
  const step = minutes(after.window.opensAt) - minutes(before.window.opensAt);
  assert.ok(Math.abs(step) <= 5, `sunrise moved ${step} minutes overnight; an hour means the basis changed, not the sun`);
  assert.equal(before.observedClock, undefined, "31 October needs no override: both bases agree");
  assert.ok(after.observedClock, "1 November does");
});

test("the override applies from the date the province named, and not before", () => {
  assert.equal(observedClockOverride("America/Winnipeg", "2026-10-31" as IsoDate), null);
  assert.ok(observedClockOverride("America/Winnipeg", "2026-11-01" as IsoDate));
  assert.equal(renderingZone("America/Winnipeg", "2026-10-31" as IsoDate), "America/Winnipeg");
  assert.equal(renderingZone("America/Winnipeg", "2026-11-01" as IsoDate), "Etc/GMT+5");
  /* Etc/GMT+5 is UTC-5: the POSIX sign is inverted, and getting it backwards
     would move the clock the wrong way by two hours rather than fixing it. */
  assert.equal(platformOffsetMinutes("Etc/GMT+5", "2026-11-20" as IsoDate), -300);
});

test("no other jurisdiction is touched", () => {
  const ontario = ontarioLegalTime("species:white-tailed-deer", "57", { latitude: 45.0, longitude: -78.4 }, "2026-11-20" as IsoDate);
  assert.equal(ontario.status, "RESOLVED");
  if (ontario.status !== "RESOLVED") return;
  /* Ontario carries its own observedClock for the Atikokan question, which this
     change must not disturb. What must be absent is Manitoba's override. */
  const note = ontario.observedClock?.status === "SAME_AS_STATUTORY" ? ontario.observedClock.statedAs : "";
  assert.doesNotMatch(note, /comes into force/, "Ontario still switches, and tzdata knows it");
  assert.equal(renderingZone("America/Toronto", "2026-11-20" as IsoDate), "America/Toronto");
  assert.equal(renderingZone("America/Regina", "2026-11-20" as IsoDate), "America/Regina");
});

test("every override is still needed, and this test is how it retires", () => {
  /*
   * An override that outlives the lag becomes a second source of truth that is
   * right by coincidence. When the platform's tz database carries Manitoba's
   * change, `tzdataAgrees` turns true and this fails — telling a human to
   * delete the entry rather than letting two authorities drift apart quietly.
   *
   * It is deliberately a failure and not a warning. A warning in a green suite
   * is the same as the source-change notice that exited 0 while Manitoba's
   * hours were wrong for nine days.
   */
  for (const entry of OBSERVED_CLOCK_OVERRIDES) {
    assert.equal(
      tzdataAgrees(entry),
      false,
      `This runtime's tzdata now agrees with ${entry.authority} for ${entry.timeZone}. The override is obsolete — delete it from OBSERVED_CLOCK_OVERRIDES.`,
    );
  }
});

test("each override cites the authority that changed the law", () => {
  for (const entry of OBSERVED_CLOCK_OVERRIDES) {
    assert.ok(entry.authority && entry.statedAs.length > 20, `${entry.timeZone} must quote the authority`);
    assert.match(entry.sourceUrl, /^https:\/\//);
    assert.match(entry.from, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(platformOffsetMinutes(entry.renderAs, entry.from), entry.offsetMinutes, "the rendering zone must actually be the declared offset");
  }
});
