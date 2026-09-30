/**
 * Run EVERY source check, and report the worst thing any of them found.
 *
 * THE DEFECT THIS REPLACES, measured 2026-09-30. `check:regulatory-sources` was
 * a chain of `&&`, so the first non-zero exit stopped it. Québec's builder has
 * been failing on an unclassified paragraph since 22 September, which meant the
 * Manitoba check — six links further down — HAD NOT RUN ONCE IN NINE DAYS.
 *
 * In those nine days Manitoba reissued its hunting guide, and the check that
 * would have said so never executed. Its own exit code was right all along: it
 * exits 2, the watch's word for "a source moved". Nobody ever saw it.
 *
 * The daily workflow reported SUCCESS every one of those days, because a failed
 * read is classified `unreadable` and only `moved` fails the run. So the signal
 * existed, the mechanism existed, and one `&&` stood between them.
 *
 * Two rules follow, and they are the whole of this file:
 *
 *   1. ONE SOURCE'S FAILURE MUST NEVER HIDE ANOTHER'S. Every check runs.
 *   2. THE WORST FINDING IS THE ANSWER. A moved source outranks an unreadable
 *      one, because a moved source can change a hunter's answer while an
 *      unreadable one merely stops being verified.
 *
 * Exit codes are the source watch's: 0 unchanged, 2 a source moved and a human
 * must read the diff, 1 something could not be read.
 */
import { spawnSync } from "node:child_process";

const CHECKS = [
  ["Ontario regulations", ["scripts/build-ontario-regulations.mjs"]],
  ["Ontario major game", ["scripts/build-ontario-major-game.mjs"]],
  ["Québec regulations", ["--experimental-strip-types", "scripts/build-quebec-regulations.mjs"]],
  ["Québec overlays", ["scripts/build-quebec-overlays.mjs"]],
  ["Québec zone layer", ["scripts/check-quebec-zone-layer.mjs"]],
  ["Manitoba regulations", ["scripts/build-manitoba-regulations.mjs"]],
  ["Alberta regulations", ["scripts/build-alberta-regulations.mjs"]],
  ["British Columbia regulations", ["scripts/build-british-columbia-regulations.mjs"]],
  ["Overlay zone index", ["scripts/build-overlay-zone-index.mjs"]],
  ["Ontario readiness", ["scripts/build-ontario-readiness.mjs"]],
  ["Montana upland", ["scripts/build-us-mt-upland.mjs"]],
  ["Idaho pronghorn", ["scripts/build-us-id-pronghorn.mjs"]],
  ["United States coverage evidence", ["scripts/build-us-coverage-evidence.mjs"]],
  ["United States coverage matrix", ["--experimental-strip-types", "scripts/build-us-state-coverage-matrix.mjs"]],
];

const results = [];
for (const [name, args] of CHECKS) {
  const run = spawnSync(process.execPath, [...args, "--check"], { encoding: "utf8" });
  const output = `${run.stdout ?? ""}${run.stderr ?? ""}`.trim();
  const status = run.status ?? 1;
  results.push({ name, status, output });
  const word = status === 0 ? "unchanged" : status === 2 ? "MOVED" : "UNREADABLE";
  process.stdout.write(`\n=== ${name}: ${word}\n`);
  if (status !== 0) process.stdout.write(`${output.split("\n").slice(-6).join("\n")}\n`);
}

const moved = results.filter((result) => result.status === 2);
const unreadable = results.filter((result) => result.status !== 0 && result.status !== 2);

process.stdout.write(
  `\n${results.length} source checks: ${results.length - moved.length - unreadable.length} unchanged, ` +
    `${moved.length} moved, ${unreadable.length} unreadable.\n`,
);
for (const result of moved) process.stdout.write(`  MOVED       ${result.name}\n`);
for (const result of unreadable) process.stdout.write(`  UNREADABLE  ${result.name}\n`);

/* A moved source outranks an unreadable one: it can change an answer a hunter
   is given, where an unreadable one has merely stopped being verified. Both are
   reported; the exit code carries the more urgent. */
process.exit(moved.length ? 2 : unreadable.length ? 1 : 0);
