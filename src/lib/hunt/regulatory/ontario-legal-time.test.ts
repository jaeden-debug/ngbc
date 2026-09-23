import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import type { IsoDate } from "../../content-contract/index.ts";
import { intersectLegalTime, legalTimeFor, SOLAR_UNCERTAINTY_MINUTES } from "./legal-time.ts";
import { ontarioHoursRules } from "./ontario-legal-time.ts";
import { ontarioStatutoryClock } from "./statutory-time.ts";
import { sunriseSunset } from "./solar.ts";

const on = (value: string) => value as IsoDate;
/* Peterborough, in WMU 60 — one of the units Table 7.2 item 1 names. */
const POINT = { latitude: 44.3, longitude: -78.31666666666666 };

const windowFor = (speciesId: string, unit: string | undefined, date: string) => {
  const clock = ontarioStatutoryClock(POINT, on(date));
  if (clock.status !== "RESOLVED") return clock;
  const rules = ontarioHoursRules(speciesId, unit, on(date));
  return intersectLegalTime(rules.map((rule) => legalTimeFor(rule, POINT, on(date), clock.zone as never)));
};

test("spring turkey closes at 7 p.m., not half an hour after sunset", () => {
  /*
   * THE FINDING THIS WHOLE PIECE OF WORK EXISTS FOR. O. Reg. 670/98 Table 7.2
   * item 1 gives "½ hour before sunrise to 7 p.m." Half an hour after sunset in
   * mid-May at this point is about 21:00. Computing from the Act's general rule
   * alone would publish roughly two hours of unlawful hunting, with a source
   * link beside it.
   */
  const turkey = windowFor("species:wild-turkey", "60", "2026-05-15");
  assert.equal(turkey.status, "RESOLVED");
  assert.equal(turkey.status === "RESOLVED" && turkey.window.closesAt, "19:00");

  /* The general rule alone, for the same point and day, to show the size of it. */
  const general = windowFor("species:white-tailed-deer", "60", "2026-05-15");
  assert.equal(general.status === "RESOLVED" && general.window.closesAt, "21:00");
});

test("the opening end is the same in both, so only the binding end moves", () => {
  /* Both rules open half an hour before sunrise, so the intersection changes
     the close and leaves the open where the Act puts it. */
  const turkey = windowFor("species:wild-turkey", "60", "2026-05-15");
  const general = windowFor("species:white-tailed-deer", "60", "2026-05-15");
  assert.equal(
    turkey.status === "RESOLVED" && turkey.window.opensAt,
    general.status === "RESOLVED" && general.window.opensAt,
  );
});

test("the turkey window applies only to turkey, in season, in a named unit", () => {
  /* Fall turkey: Table 7.2 items 2 and 3 say "None except as provided for in
     subsection 20 (1) of the Act", so the general rule governs. */
  const fall = windowFor("species:wild-turkey", "60", "2026-10-15");
  assert.notEqual(fall.status === "RESOLVED" && fall.window.closesAt, "19:00");

  /* A unit the table does not name, inside the spring dates. */
  const unnamed = windowFor("species:wild-turkey", "1", "2026-05-15");
  assert.notEqual(unnamed.status === "RESOLVED" && unnamed.window.closesAt, "19:00");

  /* No unit resolved at all: the table cannot be shown to apply. */
  const noUnit = windowFor("species:wild-turkey", undefined, "2026-05-15");
  assert.notEqual(noUnit.status === "RESOLVED" && noUnit.window.closesAt, "19:00");
});

test("a bare unit number in the table reaches its lettered subdivisions", () => {
  /*
   * O. Reg. 670/98 s. 4 says so outright: a unit referred to by whole number
   * includes the units published by that number with a letter. The table names
   * "36", so 36A and 36B are named — and the regulation states the rule rather
   * than leaving it to be inferred, unlike the federal "53 to 59" case.
   */
  for (const unit of ["36", "36A", "36B"]) {
    const result = windowFor("species:wild-turkey", unit, "2026-05-15");
    assert.equal(result.status === "RESOLVED" && result.window.closesAt, "19:00", unit);
  }
  /* A lettered unit the table names reaches only itself, not its bare number. */
  const bare66 = windowFor("species:wild-turkey", "66", "2026-05-15");
  assert.notEqual(bare66.status === "RESOLVED" && bare66.window.closesAt, "19:00");
});

test("the computed solar times sit inside the margin against the authority's own table", () => {
  /*
   * Fish and Wildlife Conservation Act s. 110 makes a confirmation certified by
   * the NRC Herzberg Institute admissible as proof of sunrise and sunset in a
   * prosecution under s. 20 — so Ontario's statute names the table this is
   * checked against, rather than us choosing one.
   *
   * The recorded comparison is replayed here; it never touches the network.
   */
  const record = JSON.parse(readFileSync("fixtures/hunt/ca-on-legal-time-verification.json", "utf8")) as {
    point: { latitude: number; longitude: number };
    samples: { date: string; nrcDaylight: { sunrise: string; sunset: string } }[];
    result: { worstDeviationSeconds: number; marginMinutes: number };
  };

  for (const sample of record.samples) {
    const [year, month, day] = sample.date.split("-").map(Number);
    const solar = sunriseSunset(record.point.latitude, record.point.longitude, { year, month, day });
    assert.ok(!("polar" in solar), sample.date);
    if ("polar" in solar) continue;

    for (const [event, published] of [["sunrise", sample.nrcDaylight.sunrise], ["sunset", sample.nrcDaylight.sunset]] as const) {
      const mine = solar[event];
      const [hour, minute] = published.split(":").map(Number);
      /* The authority publishes whole minutes; compare against that minute. */
      const theirs = new Date(Date.UTC(year, month - 1, day, hour + 4, minute));
      const deviation = Math.abs(mine.getTime() - theirs.getTime()) / 1000;
      assert.ok(
        deviation <= record.result.marginMinutes * 60,
        `${sample.date} ${event}: ${Math.round(deviation)}s exceeds the ${record.result.marginMinutes}-minute margin`,
      );
    }
  }
  assert.ok(record.result.worstDeviationSeconds < SOLAR_UNCERTAINTY_MINUTES * 60);
});
