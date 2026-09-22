#!/usr/bin/env node
/**
 * Regulatory change drill for a United States bundle: prove a changed source is
 * caught, named and sized, without touching anything committed.
 *
 *   node scripts/build-us-mt-upland.mjs --check --save-sources <dir>
 *   node scripts/drill-us-regulatory-change.mjs --state mt --base <dir>
 *
 * The first command records every source a live check reads (a PDF as its
 * extracted text, a map service as its JSON). Each drill copies the recording,
 * makes one edit of a kind the state actually makes, and runs the builder in
 * --check mode against the copy, offline. A drill passes when the builder
 * reacts as a reviewer needs:
 *
 *   exit 2  a change it can read, reported with the rules it touches, the
 *           districts or units they reach, and the before/after values
 *   exit 1  a change it cannot read, or wording it relies on that moved; the
 *           build stops rather than certifying either version
 *
 * The committed files are hashed before and after; a drill that changed any
 * of them fails the run. Nothing is promoted: promoting a change is a
 * reviewer's decision made against the report.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const STATES = {
  mt: {
    builder: "scripts/build-us-mt-upland.mjs",
    committed: ["content/regulatory/us-mt-upland-2026.json", "content/regulatory/us-mt-overlays.json", "content/regulatory/us-mt-certified-units.json"],
    drills: [
      {
        name: "season date change (nonresident public-land sharp-tailed grouse opens a day later)",
        kind: "pdf", page: 9,
        from: "Sep. 01 - Jan. 01 Sep. 11 - Jan. 01 Bag Limit: 4 daily.",
        to: "Sep. 01 - Jan. 01 Sep. 12 - Jan. 01 Bag Limit: 4 daily.",
        expectExit: 2,
      },
      {
        name: "bag limit change (sharp-tailed grouse 4 → 3 daily)",
        kind: "pdf", page: 9, from: "Bag Limit: 4 daily.", to: "Bag Limit: 3 daily.", expectExit: 2,
      },
      {
        // The age is a question's own options ("15 or younger"), so a new age
        // must stop the build rather than silently keep asking the old one.
        name: "youth eligibility change (15 and under → 17 and under)",
        kind: "pdf", page: 10, from: "youth ages 15 and under", to: "youth ages 17 and under", expectExit: 1,
      },
      {
        name: "partridge portion extended (Carbon County Jan. 10 → Jan. 15)",
        kind: "pdf", page: 9, from: "Sep. 01 - Jan. 10 Sep. 11 - Jan. 10", to: "Sep. 01 - Jan. 15 Sep. 11 - Jan. 15", expectExit: 2,
      },
      {
        name: "district geography change (sharp-tailed grouse no longer closed west of the Divide)",
        kind: "pdf", page: 9, from: "four times the daily bag limit. Closed West of the Continental Divide. Falconry",
        to: "four times the daily bag limit. Falconry", expectExit: 1,
      },
      {
        name: "reservation rule reworded",
        kind: "pdf", page: 4, from: "unless provided for in a cooperative agreement", to: "except where a cooperative agreement provides", expectExit: 1,
      },
      {
        name: "amended validity (the Commission extends the licence year)",
        kind: "pdf", page: 2, from: "valid March 1, 2026, through Feb. 28, 2027", to: "valid March 1, 2026, through March 31, 2027", expectExit: 1,
      },
      {
        name: "a new restricted area appears in FWP's layer",
        kind: "json", match: "huntingDistricts/MapServer/2/query",
        edit: (value) => ({ ...value, features: [...value.features, { attributes: { OBJECTID: 99999, PORTIONNAME: "New Closure Area" } }] }),
        expectExit: 1,
      },
      {
        name: "a reservation disappears from the Census layer",
        kind: "json", match: "AIANNHA/MapServer/2/query",
        edit: (value) => ({ ...value, features: value.features.filter((feature) => feature.attributes.GEOID !== "2490R") }),
        expectExit: 1,
      },
    ],
  },
};

STATES.id = {
  builder: "scripts/build-us-id-pronghorn.mjs",
  committed: ["content/regulatory/us-id-pronghorn-2026.json", "content/regulatory/us-id-certified-units.json"],
  drills: [
    {
      name: "season date change (hunt 4007 closes Oct 31 instead of Oct 24)",
      kind: "pdf", page: 64, from: "4007 39 40 Sep 25 - Oct 24", to: "4007 39 40 Sep 25 - Oct 31", expectExit: 2,
    },
    {
      name: "quota change (hunt 4007: 40 → 35 tags)",
      kind: "pdf", page: 64, from: "4007 39 40 Sep 25", to: "4007 39 35 Sep 25", expectExit: 2,
    },
    {
      name: "hunt area widened (Hunt Area 30A-1 gains Unit 31)",
      kind: "pdf", page: 68, from: "All of Units 21A, 29, 30, and 30A.", to: "All of Units 21A, 29, 30, 30A, and 31.", expectExit: 2,
    },
    {
      // A clause the reader does not understand must stop the build rather
      // than be read as whole units.
      name: "hunt area reworded into a clause the reader does not know",
      kind: "pdf", page: 68, from: "All of Units 21A, 29, 30, and 30A.", to: "Units 21A, 29, 30, and 30A north of Interstate 84.", expectExit: 1,
    },
    {
      name: "a new correction is published",
      kind: "pdf", page: 2, raw: true,
      from: "72-HOUR TRAP CHECK REQUIREMENT\n96", to: "72-HOUR TRAP CHECK REQUIREMENT\n96\nPRONGHORN HUNT 4007 DATES\n64", expectExit: 1,
    },
    {
      name: "hunting hours reworded",
      kind: "pdf", page: 96, from: "one-half hour after sunset", to: "sunset", expectExit: 1,
    },
    {
      name: "the Hunt Planner disagrees on hunt 4007's quota",
      kind: "json", match: "huntplanner",
      edit: (value) => ({ ...value, rows: value.rows.map((row) => (row.number === "4007" ? { ...row, permits: 45 } : row)) }),
      expectExit: 2,
    },
    {
      name: "a unit disappears from Idaho's unit layer",
      kind: "json", match: "Hunting/MapServer/3",
      edit: (value) => ({ ...value, features: value.features.filter((feature) => String(feature.attributes.NAME).trim() !== "39") }),
      expectExit: 1,
    },
  ],
};

const args = process.argv.slice(2);
const state = STATES[args[args.indexOf("--state") + 1]];
const base = args.includes("--base") ? args[args.indexOf("--base") + 1] : undefined;
if (!state || !base) {
  console.error(`Usage: node scripts/drill-us-regulatory-change.mjs --state ${Object.keys(STATES).join("|")} --base <recorded sources>`);
  process.exit(1);
}

const hashOf = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const before = Object.fromEntries(state.committed.map((path) => [path, hashOf(path)]));

function recordFor(dir, kind, match) {
  for (const file of readdirSync(dir).filter((name) => name.startsWith(`${kind}-`))) {
    const record = JSON.parse(readFileSync(join(dir, file), "utf8"));
    if (kind === "pdf" || record.url.includes(match)) return { path: join(dir, file), record };
  }
  throw new Error(`No recorded ${kind} source matching ${match ?? "a PDF"}`);
}

let failures = 0;
for (const drill of state.drills) {
  const dir = mkdtempSync(join(tmpdir(), "ng-us-drill-"));
  try {
    cpSync(base, dir, { recursive: true });
    const { path, record } = recordFor(dir, drill.kind, drill.match);
    if (drill.kind === "pdf") {
      const pages = record.value.pages;
      const index = drill.page - 1;
      // Drill edits act on the flattened text the builder reads, so collapse the
      // page first — unless the builder reads the page's lines (`raw`).
      const text = drill.raw ? pages[index] : pages[index].replace(/ /g, " ").replace(/\s+/g, " ").trim();
      if (!text.includes(drill.from)) throw new Error(`Drill "${drill.name}": the recorded text no longer contains "${drill.from}"`);
      pages[index] = text.replace(drill.from, drill.to);
    } else {
      record.value = drill.edit(record.value);
    }
    writeFileSync(path, JSON.stringify(record));
    const run = spawnSync("node", [state.builder, "--check", "--sources", dir], { encoding: "utf8" });
    const output = `${run.stdout}${run.stderr}`.trim();
    const ok = run.status === drill.expectExit;
    if (!ok) failures += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${drill.name}: exit ${run.status} (expected ${drill.expectExit})`);
    for (const line of output.split("\n").filter((entry) => !/Warning|Reparsing|To eliminate|trace-warnings/.test(entry)).slice(0, 14)) {
      console.log(`      ${line}`);
    }
  } catch (error) {
    failures += 1;
    console.log(`FAIL  ${drill.name}: ${error.message}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const touched = state.committed.filter((path) => hashOf(path) !== before[path]);
if (touched.length) {
  console.log(`FAIL  committed files changed during the drill: ${touched.join(", ")}`);
  failures += 1;
}
console.log(`\n${state.drills.length - failures} of ${state.drills.length} drills behaved as a reviewer needs; committed files ${touched.length ? "CHANGED" : "untouched"}.`);
process.exit(failures ? 1 : 0);
