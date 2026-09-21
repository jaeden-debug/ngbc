#!/usr/bin/env node
/**
 * Rehearse a change to the ministry's hunting-zone layer, offline.
 *
 *   node scripts/check-quebec-zone-layer.mjs --save /tmp/qc-layer   # once, from the live service
 *   node scripts/drill-quebec-zone-layer-change.mjs --base /tmp/qc-layer
 *
 * Each scenario edits a copy of the saved responses the way the ministry
 * plausibly could — a boundary edit, a dropped island, a new zone, a new data
 * vintage, a schema change — and runs the real check against it. The check must
 * name the change and exit 2; a partial read must exit 1, never pass as
 * unchanged; and the committed fingerprint must be byte-identical afterwards.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const COMMITTED = "content/regulatory/ca-qc-zone-layer.json";
const base = process.argv[process.argv.indexOf("--base") + 1];
if (!process.argv.includes("--base") || !base) {
  console.error("Usage: node scripts/drill-quebec-zone-layer-change.mjs --base <dir saved by check-quebec-zone-layer.mjs --save>");
  process.exit(1);
}

const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const committedBefore = digest(COMMITTED);

/* Every page, in order, as one list; written back re-paged, so a scenario can add
   or remove a record anywhere and the check still reads it as the service would. */
function pages(dir) {
  return readdirSync(dir)
    .filter((name) => /^features-\d+\.json$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
    .map((name) => ({ name, page: JSON.parse(readFileSync(join(dir, name), "utf8")) }));
}
function rewrite(dir, edit, { numberMatched } = {}) {
  const original = pages(dir);
  const rows = original.flatMap(({ page }) => page.features);
  const edited = edit(rows);
  for (const { name } of original) rmSync(join(dir, name));
  const total = numberMatched ?? edited.length;
  for (let start = 0; start < edited.length; start += 1000) {
    writeFileSync(join(dir, `features-${start}.json`), JSON.stringify({
      ...original[0].page, numberMatched: total, totalFeatures: total, features: edited.slice(start, start + 1000),
    }));
  }
  // Asked past its last record, the service answers with an empty page.
  if (total > edited.length) {
    writeFileSync(join(dir, `features-${edited.length}.json`), JSON.stringify({
      ...original[0].page, numberMatched: total, totalFeatures: total, features: [],
    }));
  }
}
const find = (rows, zone) => rows.findIndex((row) => row.properties.Zone === zone);

const SCENARIOS = [
  { name: "unchanged", exit: 0, expect: /unchanged/ },
  {
    name: "a boundary edit in 10O (one record's area +0.5%)", exit: 2, expect: /CHANGED {2}zone 10O: area \d+ -> \d+ m² \(\+0\.5%\)/,
    apply: (dir) => rewrite(dir, (rows) => {
      const row = rows[find(rows, "10O")];
      row.properties.Shape_Area *= 1.005;
      return rows;
    }),
  },
  {
    name: "an island dropped from 19SE", exit: 2, expect: /CHANGED {2}zone 19SE: 8091 -> 8090 records/,
    apply: (dir) => rewrite(dir, (rows) => rows.filter((_, index) => index !== find(rows, "19SE"))),
  },
  {
    name: "a new zone 30", exit: 2, expect: /ADDED {4}zone 30/,
    apply: (dir) => rewrite(dir, (rows) => [...rows, {
      type: "Feature", id: "Zone_chasse_da3_sefaq.99999", geometry: null,
      properties: { Zone: "30", Shape_Area: 1e9, Latitude: 50, Longitude: -70 },
    }]),
  },
  {
    name: "a new data vintage", exit: 2, expect: /METADATA keywords/,
    apply: (dir) => {
      const path = join(dir, "capabilities.xml");
      writeFileSync(path, readFileSync(path, "utf8").replace("zones_de_chasse_2022_03_23_Qlite", "zones_de_chasse_2026_09_01_Qlite"));
    },
  },
  {
    name: "the area attribute withdrawn", exit: 2, expect: /SCHEMA {3}removed Shape_Area/,
    apply: (dir) => {
      const path = join(dir, "schema.xml");
      writeFileSync(path, readFileSync(path, "utf8").replace(/<xsd:element [^>]*name="Shape_Area"[^>]*\/>/, ""));
      rewrite(dir, (rows) => rows.map((row) => ({ ...row, properties: { ...row.properties, Shape_Area: undefined } })));
    },
  },
  {
    name: "a label point moved with the same area", exit: 2, expect: /zone 27O: same records and area, but/,
    apply: (dir) => rewrite(dir, (rows) => {
      rows[find(rows, "27O")].properties.Latitude += 0.01;
      return rows;
    }),
  },
  {
    name: "a partial read (one record short of numberMatched)", exit: 1, expect: /Incomplete read of the zone layer: 9502 of 9503/,
    apply: (dir) => rewrite(dir, (rows) => rows.slice(1), { numberMatched: 9503 }),
  },
  {
    name: "the layer no longer listed", exit: 1, expect: /no longer lists SmartFaunePub:Zone_chasse_da3_sefaq/,
    apply: (dir) => {
      const path = join(dir, "capabilities.xml");
      writeFileSync(path, readFileSync(path, "utf8").replaceAll("SmartFaunePub:Zone_chasse_da3_sefaq", "SmartFaunePub:Zone_chasse_retired"));
    },
  },
];

let failures = 0;
for (const scenario of SCENARIOS) {
  const dir = mkdtempSync(join(tmpdir(), "qc-layer-drill-"));
  cpSync(base, dir, { recursive: true });
  scenario.apply?.(dir);
  const run = spawnSync(process.execPath, ["scripts/check-quebec-zone-layer.mjs", "--check", "--from", dir], { encoding: "utf8" });
  const output = `${run.stdout}${run.stderr}`;
  const ok = run.status === scenario.exit && scenario.expect.test(output);
  failures += ok ? 0 : 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${scenario.name}: exit ${run.status}`);
  const named = output.split("\n").find((line) => scenario.expect.test(line));
  if (named) console.log(`        ${named.trim()}`);
  if (!ok) console.log(output.split("\n").map((line) => `        | ${line}`).join("\n"));
  rmSync(dir, { recursive: true, force: true });
}

const untouched = digest(COMMITTED) === committedBefore;
console.log(`${untouched ? "PASS" : "FAIL"}  the committed fingerprint is byte-identical after every scenario`);
if (!untouched) failures += 1;
console.log(failures ? `\n${failures} scenario(s) failed.` : `\nAll ${SCENARIOS.length} scenarios behaved; nothing was re-ingested or published.`);
process.exit(failures ? 1 : 0);
