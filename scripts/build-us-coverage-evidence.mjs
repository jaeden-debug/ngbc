#!/usr/bin/env node
/**
 * Gather the evidence behind every United States coverage claim into one
 * generated file, so no state's status can be typed by hand.
 *
 *   node scripts/build-us-coverage-evidence.mjs            write the evidence
 *   node scripts/build-us-coverage-evidence.mjs --check    exit 3 if it differs
 *
 * What counts as evidence, and nothing else does:
 *
 *   MAP           a recorded live-parity certification in fixtures/hunt/
 *                 (its point count and its disagreements)
 *   REGULATIONS   a generated bundle in content/regulatory/ (its rules,
 *                 species and certified period) and a certification-case file
 *                 whose cases were written from the law
 *   INTELLIGENCE  a harvest/effort/success evidence set — none exists yet, and
 *                 its absence is never a coverage gap
 *
 * The statuses themselves are computed at call time in
 * `src/lib/hunt/united-states/certification.ts`, which also reads each layer's
 * licence and serving flags. This file only says what was found on disk.
 */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const OUT = "content/registry/us-coverage-evidence.generated.json";
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const stateOf = (id) => (typeof id === "string" && id.startsWith("jurisdiction:us-") ? id.slice("jurisdiction:us-".length).toUpperCase() : null);

function parityRecords() {
  const records = {};
  for (const file of readdirSync("fixtures/hunt").filter((name) => /^us-.*-live-parity\.json$/.test(name))) {
    const record = read(`fixtures/hunt/${file}`);
    const state = stateOf(record.jurisdiction);
    if (!state) throw new Error(`${file} names no United States jurisdiction`);
    (records[state] ??= []).push({
      layerId: record.layer,
      authority: record.authority,
      service: record.service,
      sourceVersion: record.sourceVersion,
      resolution: record.resolution,
      legalStanding: record.legalStanding,
      certifiedOn: record.certifiedOn,
      units: record.units,
      points: record.points,
      disagreements: record.disagreements,
    });
  }
  for (const list of Object.values(records)) list.sort((a, b) => a.layerId.localeCompare(b.layerId));
  return records;
}

function caseFiles() {
  const files = {};
  for (const file of readdirSync("fixtures/hunt").filter((name) => /^ca-|^us-/.test(name) && name.endsWith("-certification-cases.json"))) {
    const record = read(`fixtures/hunt/${file}`);
    const state = stateOf(record.jurisdiction);
    if (!state) continue;
    files[state] = { file: `fixtures/hunt/${file}`, cases: record.cases.length, writtenOn: record.writtenOn };
  }
  return files;
}

function bundles() {
  const found = {};
  for (const file of readdirSync("content/regulatory").filter((name) => /^us-.*\.json$/.test(name))) {
    const record = read(`content/regulatory/${file}`);
    if (!Array.isArray(record.rules) || !record.jurisdictionId) continue;
    const state = stateOf(record.jurisdictionId);
    if (!state) continue;
    (found[state] ??= []).push({
      bundleId: record.bundleId,
      file: `content/regulatory/${file}`,
      sourceVersion: record.sourceVersion,
      retrievedAt: record.retrievedAt,
      certifiedPeriod: record.certifiedPeriod ?? null,
      rules: record.rules.length,
      species: [...new Set(record.rules.map((rule) => rule.speciesId))].sort(),
      huntCodes: record.huntCodes?.length ?? 0,
    });
  }
  for (const list of Object.values(found)) list.sort((a, b) => a.bundleId.localeCompare(b.bundleId));
  return found;
}

const evidence = {
  schemaVersion: 1,
  generatedFrom: [
    "fixtures/hunt/us-*-live-parity.json",
    "fixtures/hunt/us-*-certification-cases.json",
    "content/regulatory/us-*.json",
  ],
  parity: parityRecords(),
  cases: caseFiles(),
  bundles: bundles(),
  /* No harvest, effort or success evidence set is certified for any state. An
     absent intelligence layer is not missing coverage: a state can serve Hunt
     completely without one. */
  intelligence: {},
};
const body = `${JSON.stringify(evidence, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const current = readFileSync(OUT, "utf8");
  if (current !== body) {
    const hash = (value) => createHash("sha256").update(value).digest("hex").slice(0, 12);
    console.error(`${OUT} is out of date (on disk ${hash(current)}, from evidence ${hash(body)}). Run: node scripts/build-us-coverage-evidence.mjs`);
    process.exit(3);
  }
  console.log(`${OUT} matches the evidence on disk.`);
} else {
  writeFileSync(OUT, body);
  const states = new Set([...Object.keys(evidence.parity), ...Object.keys(evidence.bundles)]);
  console.log(`Wrote ${OUT}: ${states.size} states with evidence (${Object.keys(evidence.parity).length} with a parity record, ${Object.keys(evidence.bundles).length} with a bundle, ${Object.keys(evidence.cases).length} with cases).`);
}
