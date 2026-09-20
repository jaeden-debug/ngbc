/**
 * Report what changed between two generated regulatory bundles.
 *
 *   node scripts/regulatory-change-report.mjs <previous.json> <next.json>
 *
 * Used by the review workflow and by the source-change drill. It reports; it
 * never promotes. A changed legal interpretation reaches production only when a
 * person rebuilds, reads this, and re-certifies.
 *
 * Exit codes: 0 no rule changed, 3 rules changed and need review.
 */
import { readFileSync } from "node:fs";
import { diffBundles, formatBundleDiff } from "./ontario-source.mjs";

const [previousPath, nextPath] = process.argv.slice(2);
if (!previousPath || !nextPath) {
  console.error("Usage: node scripts/regulatory-change-report.mjs <previous.json> <next.json>");
  process.exit(1);
}

const previous = JSON.parse(readFileSync(previousPath, "utf8"));
const next = JSON.parse(readFileSync(nextPath, "utf8"));
const diff = diffBundles(previous, next);
const total = diff.added.length + diff.removed.length + diff.changed.length;

console.log(`content hash: ${previous.contentHash ?? previous.source?.contentHash} -> ${next.contentHash ?? next.source?.contentHash}`);
console.log(`rules: ${(previous.rules ?? []).length} -> ${(next.rules ?? []).length}`);

if (!total) {
  console.log("No rule changed.");
  process.exit(0);
}

console.log(`\n${total} rule change(s) require review:\n`);
console.log(formatBundleDiff(diff));
console.log("\nNothing has been published. Re-certify before promoting this bundle.");
process.exit(3);
