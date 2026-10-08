import assert from "node:assert/strict";
import test from "node:test";
import bundle from "../../../content/regulatory/ca-on-major-game-2026.json" with { type: "json" };
import { evaluateOntarioMajorGame } from "./regulatory/major-game.ts";
import type { ZoneResolution } from "./types.ts";

/**
 * §8'S LEGAL HARVEST OPPORTUNITIES REACH THE RESULT, AND ABSENCE KEEPS ITS CAUSE.
 *
 * The fundamental regulatory object is an opportunity — species × geography ×
 * date × animal class × implement × conditions — not a season. `regulation.season`
 * is ONE window with no class and no implement, so a consumer cannot tell
 * "antlered with a bow in October" from "either sex with a rifle in November"
 * from it. The engine computes the rows; `evaluate.ts` discarded them.
 */

interface Rule { declaredNoSeason?: boolean; seasonPhrase?: string; windows?: unknown[]; speciesId: string; regulatoryGroupId?: string }
interface Group { id: string; officialIdentifiers?: string[] }
const rules = (bundle as unknown as { rules: Rule[] }).rules;
const groups = (bundle as unknown as { groups: Group[] }).groups;

const at = (designation: string): ZoneResolution => ({
  status: "RESOLVED",
  zoneId: `management_zone:ca-on-wmu-${designation.toLowerCase()}` as ZoneResolution["zoneId"],
  officialName: `WMU ${designation}`,
  message: "",
});

test("a season that is open but could not be enumerated says so, instead of reporting no opportunity", () => {
  /*
   * THE DEFECT THIS LOCKS. Two bundle rules carry a published `seasonPhrase`
   * — "May 1 to May 7" — and an EMPTY `windows` array. The season evaluation
   * parses the phrase, so the answer is CONDITIONAL; the opportunity adapter
   * reads `windows`, finds none, and skips the rule. Dropping the field then
   * made that indistinguishable from "nothing applies here".
   *
   * Measured: 35 such answers — American black bear in WMUs 82A, 83A, 83B, 83C
   * and 84 across the seven published days. §41A paints a CONDITIONAL zone
   * green, so this is a green zone with nothing behind it.
   */
  const unenumerable = rules.filter((rule) => !rule.declaredNoSeason && rule.seasonPhrase && (rule.windows ?? []).length === 0);
  assert.ok(unenumerable.length > 0, "positive control: the bundle still contains a rule with a phrase and no window");

  let conditional = 0;
  let gapReported = 0;
  for (const rule of unenumerable) {
    const group = groups.find((entry) => entry.id === rule.regulatoryGroupId);
    for (const designation of group?.officialIdentifiers ?? []) {
      for (const date of ["2026-05-01", "2026-05-04", "2026-05-07"]) {
        const outcome = evaluateOntarioMajorGame({ speciesId: rule.speciesId, date } as never, at(designation), {} as never);
        if (outcome.result?.status !== "CONDITIONAL") continue;
        conditional++;
        assert.ok(
          !outcome.opportunities?.length,
          "this test's subject is the case with no rows; if rows now exist the adapter was fixed and this test should be re-read",
        );
        if (outcome.opportunityGap === "WINDOW_NOT_MACHINE_READABLE") gapReported++;
      }
    }
  }
  assert.ok(conditional > 0, "positive control: these rules really do produce CONDITIONAL answers");
  assert.equal(gapReported, conditional, "every in-season answer with no rows must report WHY it has none");
});

test("a closure reports no gap, because nothing applies rather than nothing being readable", () => {
  /*
   * The other side, and the one that keeps the vocabulary honest: a declared
   * closure genuinely has no opportunity, so it must NOT claim a gap. If every
   * absence reported a gap the field would mean nothing.
   */
  const closure = rules.find((rule) => rule.declaredNoSeason);
  assert.ok(closure, "positive control: the bundle contains a declared closure");
  const group = groups.find((entry) => entry.id === closure.regulatoryGroupId);
  const designation = (group?.officialIdentifiers ?? [])[0];
  assert.ok(designation, "the closure's group names a unit");

  const outcome = evaluateOntarioMajorGame({ speciesId: closure.speciesId, date: "2026-07-04" } as never, at(designation), {} as never);
  assert.notEqual(outcome.opportunityGap, "WINDOW_NOT_MACHINE_READABLE", "a closure is not an unreadable window");
});

test("the reason survives all the way to the evaluation, not just to the engine", async () => {
  /*
   * THE GAP A COUNTERFACTUAL FOUND. The two tests above prove the ENGINE
   * reports why it could not enumerate. They do not prove the EVALUATION keeps
   * it: collapsing `evaluate.ts` to always answer ENUMERATED left both of them
   * green, and the contract test green too, because that fixture's answer has
   * no gap to lose.
   *
   * So this drives one of the measured 35 end to end — American black bear,
   * WMU 82A, inside the published 1–7 May window — and asserts the evaluation
   * says NOT_ENUMERATED rather than reporting an empty list that reads as "no
   * opportunity here".
   */
  const { evaluateHunt } = await import("./evaluate.ts");
  const zone82a: ZoneResolution = {
    status: "RESOLVED",
    zoneId: "management_zone:ca-on-wmu-82a" as ZoneResolution["zoneId"],
    jurisdictionId: "jurisdiction:ca-on" as ZoneResolution["jurisdictionId"],
    officialName: "WMU 82A",
    message: "",
  };
  const evaluation = await evaluateHunt(
    { latitude: 48.5, longitude: -89.2, date: "2026-05-04", speciesId: "species:american-black-bear" } as never,
    {
      resolveZone: async () => zone82a,
      weather: async (_lat: number, _lon: number, date: string) => ({ status: "UNAVAILABLE" as const, summary: "x", date, sourceId: "source:open-meteo" as const }),
      now: () => new Date("2026-04-01T12:00:00Z"),
    } as never,
  );

  assert.equal(evaluation.regulation.status, "CONDITIONAL", "positive control: this is the in-season case, which §41A paints green");
  assert.equal(evaluation.opportunities.kind, "NOT_ENUMERATED", "an in-season answer with no rows must not read as having none");
  if (evaluation.opportunities.kind === "NOT_ENUMERATED") {
    assert.equal(evaluation.opportunities.reason, "WINDOW_NOT_MACHINE_READABLE");
  }
});
