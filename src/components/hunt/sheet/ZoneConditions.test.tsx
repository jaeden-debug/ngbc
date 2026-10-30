import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { zoneStatesForSpecies } from "../../../lib/hunt/exploration/zone-summary.ts";
import type { CanonicalId } from "../../../lib/content-contract/index.ts";
import ZoneConditions from "./ZoneConditions.tsx";

/**
 * WHAT A `!` OPENS ONTO, READ FROM THE ENGINE'S REAL ANSWERS.
 *
 * Measured 2026-10-30 across every served Canadian zone: the multi-question
 * hunts — British Columbia moose, Alberta moose, Manitoba moose and elk — wore
 * a `!` whose card said only "Turns on what you carry" and "Turns on which
 * licence you hold". The card now names the hunts the rules open, and a
 * question every answer opens sits under "Depends on", not under "Required"
 * beside the licence. Both cases are rendered from the certified bundles, not
 * from fixtures, so a change in the engine that undoes either shows here.
 */

async function card(layerId: string, designation: string, speciesId: string, date: string) {
  const [state] = await zoneStatesForSpecies(speciesId as CanonicalId<"species">, date, [{ layerId, designation }]);
  assert.equal(state.opportunity.hasCurrentLegalOpportunity, true, `${speciesId} in ${designation} must be green on ${date}`);
  const html = renderToStaticMarkup(<ZoneConditions opportunity={state.opportunity} />);
  const sections = html.split("<section").slice(1);
  return { html, sectionWith: (text: string) => sections.find((section) => section.includes(text)) ?? "" };
}

test("a hunt two questions gate names the hunts that open, under Conditions apply", async () => {
  /* BC MU 4-1 in the bow-only weeks of 15 September: two questions (weapon, class) gate it. */
  const { html, sectionWith } = await card("layer:ca-bc-mu", "4-1", "species:moose", "2026-09-15");
  assert.match(sectionWith("Open only for:"), /Conditions apply/);
  assert.match(html, /Open only for: [^<]*Spike-fork/);
  assert.doesNotMatch(html, /Turns on/, "a named combination replaces the vague per-question lines");
});

test("marked questions, unmarked questions and requirements each sit under their own heading", async () => {
  /* BC MU 1-6 mule deer on 30 October: weapon and antler points gate the hunt
     (more open combinations than one line names), age and antlered-or-not do
     not, and the bag limit is a standing requirement. */
  const { html, sectionWith } = await card("layer:ca-bc-mu", "1-6", "species:mule-deer", "2026-10-30");
  const marked = sectionWith("Conditions apply");
  assert.match(marked, /Turns on what you carry/);
  assert.match(marked, /Turns on the antlers&#x27; points/);
  const unmarked = sectionWith("Turns on your age");
  assert.match(unmarked, /[Dd]epends on/);
  assert.match(unmarked, /Turns on whether the animal is antlered/);
  assert.doesNotMatch(unmarked, /Required/);
  assert.doesNotMatch(sectionWith("Bag limit"), /Turns on/, "a question is not a requirement");
  const lines = [...html.matchAll(/<span lang="en-CA">([^<]*)<\/span>/g)].map((match) => match[1]);
  assert.equal(new Set(lines).size, lines.length, `no two lines read the same: ${lines.join(" | ")}`);
});
