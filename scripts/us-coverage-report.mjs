#!/usr/bin/env node
/**
 * The United States coverage matrix, printed from evidence.
 *
 *   node --experimental-strip-types scripts/us-coverage-report.mjs
 *
 * Three lanes, never substituted for one another: MAP (can Hunt identify the
 * official geography, and is it licensed to), REGULATIONS (can it answer a
 * species on a date in a place), INTELLIGENCE (optional harvest evidence). A
 * state with no intelligence layer is not incomplete.
 */
import { unitedStatesCertification } from "../src/lib/hunt/united-states/certification.ts";
import { UNITED_STATES_JURISDICTIONS } from "../src/lib/hunt/united-states/registry.ts";

const summary = unitedStatesCertification();
const states = UNITED_STATES_JURISDICTIONS.filter((entry) => entry.kind !== "federal");
const withEvidence = new Map(summary.states.map((entry) => [entry.code, entry]));

console.log(`UNITED STATES COVERAGE — ${states.length} states and the District of Columbia, ${withEvidence.size} with any evidence\n`);
console.log("STATE  MAP              REGULATIONS   INTELLIGENCE  DETAIL");
for (const jurisdiction of states) {
  const code = jurisdiction.code.slice(3);
  const entry = withEvidence.get(code);
  if (!entry) continue;
  const detail = entry.map.detail
    ?? `${entry.regulations.rules} rules, ${entry.regulations.species.length} species, ${entry.regulations.cases} cases`;
  console.log(`${code.padEnd(6)} ${entry.map.status.padEnd(16)} ${entry.regulations.status.padEnd(13)} ${entry.intelligence.status.padEnd(13)} ${detail}`);
}
const none = states.length - withEvidence.size;
console.log(`\nMAP          ${JSON.stringify(summary.totals.map)}`);
console.log(`REGULATIONS  ${JSON.stringify(summary.totals.regulations)}`);
console.log(`INTELLIGENCE ${JSON.stringify(summary.totals.intelligence)}`);
console.log(`\n${none} states and D.C. have no evidence of any kind: no reviewed geography service and no bundle, so every query there is UNKNOWN.`);
if (summary.licenceBlocked.length) {
  console.log("\nWaiting on a person, not on engineering:");
  for (const blocked of summary.licenceBlocked) console.log(`  ${blocked.code}: ${blocked.blockedBy}`);
}
