#!/usr/bin/env node
/**
 * Regulatory change drill for Manitoba: prove a changed source is caught, named
 * and sized, without touching the committed bundle.
 *
 *   node scripts/build-manitoba-regulations.mjs --check --save-sources <dir>
 *   node scripts/drill-manitoba-regulatory-change.mjs --base <dir>
 *
 * The first command records every source a live check reads. Each drill copies
 * that recording, makes one edit of a kind the province actually makes, and runs
 * the builder in --check mode against the copy, offline. A drill passes when the
 * builder reacts as a reviewer needs:
 *
 *   exit 2  a change it can read, reported with the rules and conditions it
 *           touches, the areas they reach and the before/after values
 *   exit 1  a change it cannot read, or wording it relies on that moved; the
 *           build stops rather than certifying either version
 *
 * The committed bundle, overlay catalogue and certified-unit list are hashed
 * before and after; a drill that changed any of them fails the run.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recordedFileFor } from "./manitoba-source.mjs";

const COMMITTED = [
  "content/regulatory/ca-mb-2026.json",
  "content/regulatory/ca-mb-overlays.json",
  "content/regulatory/ca-mb-certified-units.json",
];
const SEASONS = "https://web2.gov.mb.ca/laws/regs/current/165-91.php";
const AREAS = "https://web2.gov.mb.ca/laws/regs/current/220-86.php";
const GUIDE = "https://www.gov.mb.ca/nrnd/fish-wildlife/pubs/fish_wildlife/huntingguide.pdf";

const base = process.argv.includes("--base") ? process.argv[process.argv.indexOf("--base") + 1] : undefined;
if (!base) {
  console.error("Pass --base <dir> holding sources recorded with --save-sources.");
  process.exit(1);
}

/* The resident general white-tailed deer archery row for Areas 26 and 36. The
   row cell spans four equipment rows; the first occurrence is Schedule B, Part A. */
const WHITESHELL_ROW = "Areas&nbsp;26, 36 (excluding Whiteshell Game Bird Refuge)</td>\n\t\t<td class=\"center\">Archery</td>\n\t\t<td class=\"center\">Aug.&nbsp;31 – Nov. 8</td>";

const DRILLS = [
  {
    name: "season date change",
    url: SEASONS,
    // Resident archery white-tailed deer in GHAs 26 and 36 opens a day earlier.
    from: WHITESHELL_ROW,
    to: WHITESHELL_ROW.replace("Aug.&nbsp;31 – Nov. 8", "Aug.&nbsp;30 – Nov. 8"),
    expectExit: 2,
  },
  {
    name: "GHA membership change in a season row",
    url: SEASONS,
    /* GHA 36 leaves the four resident deer rows that share the Areas 26, 36
       cell. Under s. 3 that closes resident general deer hunting in 36. */
    from: WHITESHELL_ROW,
    to: WHITESHELL_ROW.replace("Areas&nbsp;26, 36 (excluding Whiteshell Game Bird Refuge)", "Area&nbsp;26"),
    expectExit: 2,
  },
  {
    name: "an area gains a second season for the same licence and equipment",
    url: SEASONS,
    /* GHA 35 already has its own resident archery row. Adding it to this one
       would give it two, and the regulation would no longer say which applies. */
    from: WHITESHELL_ROW,
    to: WHITESHELL_ROW.replace("Areas&nbsp;26, 36", "Areas&nbsp;26, 35, 36"),
    expectExit: 1,
  },
  {
    name: "GHA membership change in a game bird hunting zone",
    url: AREAS,
    // M.R. 220/86 s. 1.1: GHA 21 moves into game bird hunting zone 4.
    from: "All that portion of the province that lies within game hunting areas 22, 23,",
    to: "All that portion of the province that lies within game hunting areas 21, 22, 23,",
    expectExit: 2,
  },
  {
    name: "condition change",
    url: SEASONS,
    // s. 10.3(a): GHA 8 is no longer an area where deer hunting in a moose season needs a moose licence.
    from: "in areas&nbsp;5, 6, 6A, 7, 8, 10, 11, 15 and 15A during a moose season",
    to: "in areas&nbsp;5, 6, 6A, 7, 10, 11, 15 and 15A during a moose season",
    expectExit: 2,
  },
  {
    name: "wording a rule rests on changes",
    url: SEASONS,
    // s. 11(1), which the one-deer bag limit quotes, now says something else.
    from: "The bag limit is one white-tailed deer for the following types",
    to: "The bag limit is two white-tailed deer for the following types",
    expectExit: 1,
  },
  {
    name: "equipment term the builder has never read",
    url: SEASONS,
    from: WHITESHELL_ROW,
    to: WHITESHELL_ROW.replace(">Archery<", ">Archery and Air Rifle<"),
    expectExit: 1,
  },
  {
    name: "the guide used for the cross-check is republished",
    url: GUIDE,
    append: "\n% republished\n",
    expectExit: 2,
  },
];

const hashOf = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const before = COMMITTED.map(hashOf);
const results = [];

for (const drill of DRILLS) {
  const dir = mkdtempSync(join(tmpdir(), "mb-drill-"));
  try {
    cpSync(base, dir, { recursive: true });
    const file = recordedFileFor(dir, drill.url);
    if (drill.append) {
      appendFileSync(file, drill.append);
    } else {
      const text = readFileSync(file, "utf8");
      if (!text.includes(drill.from)) throw new Error(`Drill "${drill.name}": the text to change is not in the recorded source`);
      // Only the first occurrence: one edit, like the province's.
      writeFileSync(file, text.replace(drill.from, drill.to));
    }

    const run = spawnSync(process.execPath, [
      "scripts/build-manitoba-regulations.mjs", "--check", "--sources", dir,
    ], { encoding: "utf8" });
    const output = `${run.stdout}\n${run.stderr}`
      .split("\n")
      .filter((line) => line.trim() && !/ExperimentalWarning|MODULE_TYPELESS|Reparsing|To eliminate|Use `node/.test(line))
      .join("\n");
    results.push({ drill: drill.name, exit: run.status, expected: drill.expectExit, passed: run.status === drill.expectExit, output });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const after = COMMITTED.map(hashOf);
const untouched = before.every((hash, index) => hash === after[index]);
for (const result of results) {
  console.log(`\n## ${result.drill} — exit ${result.exit} (expected ${result.expected}) ${result.passed ? "PASS" : "FAIL"}`);
  const lines = result.output.split("\n");
  const radius = lines.find((line) => line.includes("BLAST RADIUS"));
  if (radius) console.log(`   ${radius.trim()}`);
  console.log(lines.filter((line) => !line.includes("BLAST RADIUS")).slice(0, 16).map((line) => `   ${line}`).join("\n"));
}
console.log(`\nCommitted bundle, overlays and certified units ${untouched ? "UNTOUCHED" : "MODIFIED"}.`);
const failed = results.filter((result) => !result.passed).length + (untouched ? 0 : 1);
console.log(failed ? `${failed} drill check(s) FAILED` : `All ${results.length} drills behaved as a reviewer needs.`);
process.exit(failed ? 1 : 0);
