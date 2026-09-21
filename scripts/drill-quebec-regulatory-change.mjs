#!/usr/bin/env node
/**
 * Regulatory change drill for Québec: prove a changed page is caught, named and
 * sized — without touching the committed bundle.
 *
 *   node scripts/drill-quebec-regulatory-change.mjs --base <dir-of-saved-pages>
 *
 * Save the pages first with
 *   node --experimental-strip-types scripts/build-quebec-regulations.mjs --save-pages <dir> --out <scratch.json>
 *
 * Each drill copies the saved pages, makes one edit of the kind the ministry
 * actually makes, and runs the builder in --check mode against the copy. A drill
 * passes when the builder reacts the way a reviewer would need it to: a change it
 * can read is reported with the rules and designations it touches (exit 2), and a
 * change it cannot read or that contradicts the page's own prose stops the build
 * (exit 1). The committed bundle's bytes are compared before and after.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const COMMITTED = "content/regulatory/ca-qc-2026.json";
const base = process.argv[process.argv.indexOf("--base") + 1];
if (!base || process.argv.indexOf("--base") < 0) {
  console.error("Pass --base <dir> holding the saved Québec season pages.");
  process.exit(1);
}

const DRILLS = [
  {
    name: "season date change",
    page: "orignal",
    // Moose, zones 12, 14, 26 and 27, firearms season: opening moved by a day.
    from: "Du 10<span class=\"nbsp\">&nbsp;</span>octobre au 25<span class=\"nbsp\">&nbsp;</span>octobre 2026",
    to: "Du 11<span class=\"nbsp\">&nbsp;</span>octobre au 25<span class=\"nbsp\">&nbsp;</span>octobre 2026",
    expectExit: 2,
  },
  {
    name: "implement restriction change",
    page: "orignal",
    // The moose crossbow note gains zone 16.
    from: "L’utilisation de l’arbalète est interdite dans les zones 22, 23 et 24.",
    to: "L’utilisation de l’arbalète est interdite dans les zones 16, 22, 23 et 24.",
    expectExit: 2,
  },
  {
    name: "animal class change",
    page: "cerf-virginie",
    // Deer, zones 6 nord and 6 sud, firearms: RTLB antlered only becomes any deer.
    from: "<td>Cerf de Virginie avec bois (<a href=\"/tourisme-loisirs-sport/activites-sportives-et-de-plein-air/chasse-sportive/gibier/cerf-virginie#c135359\">norme RTLB</a>)</td><td>Du 7",
    to: "<td>Cerf de Virginie avec ou sans bois</td><td>Du 7",
    expectExit: 2,
  },
  {
    name: "per-year class change that contradicts the page's own prose",
    page: "orignal",
    /* Zone 28 firearms: 2026 becomes "Orignal" (antlerless allowed) while the
       prose above the table still says antlerless without a permit is 2027 only
       in zone 28. The builder must refuse, not certify either version. */
    from: "<p><strong>2026 </strong>Orignal avec bois</p><p><strong>2027 </strong>Orignal</p></td><td>Du 26",
    to: "<p><strong>2026 </strong>Orignal</p><p><strong>2027 </strong>Orignal</p></td><td>Du 26",
    expectExit: 1,
  },
  {
    name: "new footnote the builder has never read",
    page: "orignal",
    from: "<p><strong>Note</strong>",
    to: "<p>Note : La chasse est interdite le dimanche dans la zone 7.</p><p><strong>Note</strong>",
    expectExit: 1,
  },
];

const hashOf = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const before = hashOf(COMMITTED);
const results = [];

for (const drill of DRILLS) {
  const dir = mkdtempSync(join(tmpdir(), "qc-drill-"));
  try {
    cpSync(base, dir, { recursive: true });
    const file = join(dir, `${drill.page}.html`);
    const html = readFileSync(file, "utf8");
    const occurrences = html.split(drill.from).length - 1;
    if (occurrences < 1) throw new Error(`Drill "${drill.name}": the text to change is not on the saved page`);
    // Only the first occurrence: one edit, like the ministry's.
    writeFileSync(file, html.replace(drill.from, drill.to));

    const run = spawnSync(process.execPath, [
      "--experimental-strip-types", "scripts/build-quebec-regulations.mjs",
      "--pages", dir, "--designations", COMMITTED, "--check",
    ], { encoding: "utf8" });
    const output = `${run.stdout}\n${run.stderr}`
      .split("\n")
      .filter((line) => line.trim() && !/ExperimentalWarning|MODULE_TYPELESS|Reparsing|To eliminate|Use `node/.test(line))
      .join("\n");
    const radius = /blast radius: (\d+) rule\(s\), (\d+) designation\(s\)/.exec(output);
    results.push({
      drill: drill.name,
      exit: run.status,
      expected: drill.expectExit,
      passed: run.status === drill.expectExit,
      rules: radius ? Number(radius[1]) : null,
      designations: radius ? Number(radius[2]) : null,
      output,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const after = hashOf(COMMITTED);
for (const result of results) {
  console.log(`\n## ${result.drill} — exit ${result.exit} (expected ${result.expected}) ${result.passed ? "PASS" : "FAIL"}`);
  if (result.rules !== null) console.log(`   blast radius: ${result.rules} rule(s), ${result.designations} designation(s)`);
  console.log(result.output.split("\n").slice(0, 14).map((line) => `   ${line}`).join("\n"));
}
console.log(`\nCommitted bundle ${before === after ? "UNTOUCHED" : "MODIFIED"} (${before.slice(0, 16)} → ${after.slice(0, 16)})`);
const failed = results.filter((result) => !result.passed).length + (before === after ? 0 : 1);
console.log(failed ? `${failed} drill check(s) FAILED` : `All ${results.length} drills behaved as a reviewer needs.`);
process.exit(failed ? 1 : 0);
