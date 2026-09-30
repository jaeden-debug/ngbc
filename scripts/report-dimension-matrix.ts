/**
 * WHAT SHARE OF THE ROWS A HUNTER SCANS CAN WE ACTUALLY RENDER?
 *
 * Every number here is computed from the published bundles at call time. None
 * is typed in, because §8 requires capability reporting to measure deliverable
 * answers and a hand-kept figure measures the last person who edited it.
 *
 * Run after each jurisdiction:  npm run report:matrix
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  animalClassesOf, implementsOf, isProfiled, profileFor, read, rendersScannableRow, resolves,
  type ClassBundle, type Dimension, type RuleShape,
} from "../src/lib/hunt/regulatory/dimension-matrix.ts";

const DIMENSIONS: Dimension[] = [
  "DATES", "ANIMAL_CLASS", "PHYSICAL_CRITERIA", "IMPLEMENT",
  "HUNTER_CLASS", "AUTHORIZATION", "LIMITS", "LEGAL_HOURS", "CONDITIONS", "PROVENANCE",
];

const DIR = path.join(process.cwd(), "content/regulatory");
type Bundle = ClassBundle & { jurisdictionId?: string; rules?: RuleShape[] };

const bundles = readdirSync(DIR)
  .filter((name) => name.endsWith(".json"))
  .map((name) => [name, JSON.parse(readFileSync(path.join(DIR, name), "utf8")) as Bundle] as const)
  .filter(([, bundle]) => Array.isArray(bundle.rules) && bundle.rules.length);

/* Big game only: the scannable row is defined over species whose class is
   material, and mixing small game in would move the percentage without any
   rule changing. */
const bigGame = (rule: RuleShape): boolean =>
  !!rule.speciesId && isProfiled(rule.speciesId) && profileFor(rule.speciesId)?.ANIMAL_CLASS === "MATERIAL";

const pad = (value: string, width: number) => value.padEnd(width);
const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");

let corpusRows = 0;
let corpusScannable = 0;

console.log("\nSCANNABLE ROWS — dates + implement + animal class, together, per rule\n");
console.log(`${pad("jurisdiction", 26)}${pad("big-game rules", 16)}${pad("scannable", 12)}share`);

for (const [name, bundle] of bundles) {
  const rules = (bundle.rules ?? []).filter(bigGame);
  if (!rules.length) continue;
  const scannable = rules.filter((rule) => rendersScannableRow(rule, rule.speciesId!, bundle)).length;
  corpusRows += rules.length;
  corpusScannable += scannable;
  console.log(`${pad(name.replace(".json", ""), 26)}${pad(String(rules.length), 16)}${pad(String(scannable), 12)}${pct(scannable, rules.length)}`);
}
console.log(`${pad("TOTAL", 26)}${pad(String(corpusRows), 16)}${pad(String(corpusScannable), 12)}${pct(corpusScannable, corpusRows)}`);

console.log("\nPER DIMENSION — how each fact reads, across the same rules");
console.log("(PROSE_ONLY is the authority's words without the fact: real, and not computable.)\n");
console.log(`${pad("dimension", 20)}${pad("present", 12)}${pad("prose only", 12)}${pad("absent", 10)}base`);

const allRules = bundles.flatMap(([, bundle]) =>
  (bundle.rules ?? []).filter(bigGame).map((rule) => [rule, bundle] as const),
);

for (const dimension of DIMENSIONS) {
  const tally = { PRESENT: 0, PROSE_ONLY: 0, ABSENT: 0 };
  /*
   * PHYSICAL_CRITERIA is reported over the rules that NAME a class, not over
   * every rule. A rule stating no class has no membership test to resolve, and
   * counting those as satisfied read 94% while 232 of the rows carried no
   * class at all — a number that is arithmetically true and invites exactly
   * the inference §8 forbids.
   */
  const base = dimension === "PHYSICAL_CRITERIA"
    ? allRules.filter(([rule]) => animalClassesOf(rule).length > 0)
    : allRules;
  for (const [rule, bundle] of base) tally[read(rule, dimension, bundle)] += 1;
  const note = base.length === allRules.length ? "all rules" : `${base.length} naming a class`;
  console.log(`${pad(dimension, 20)}${pad(`${tally.PRESENT} (${pct(tally.PRESENT, base.length)})`, 12)}${pad(String(tally.PROSE_ONLY), 12)}${pad(String(tally.ABSENT), 10)}${note}`);
}

/* The gap this run cares about most: a class named by a rule that nothing
   defines. It reads as an answer and is not one. */
const undefinedClasses = new Map<string, number>();
for (const [rule, bundle] of allRules) {
  const named = animalClassesOf(rule);
  if (!named.length) continue;
  if (resolves(rule, "PHYSICAL_CRITERIA", bundle)) continue;
  const key = `${rule.speciesId} ${named.join("+")}`;
  undefinedClasses.set(key, (undefinedClasses.get(key) ?? 0) + 1);
}
if (undefinedClasses.size) {
  console.log("\nCLASSES NAMED BY A RULE WITH NO RESOLVED TEST\n");
  for (const [key, count] of [...undefinedClasses].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pad(String(count), 6)}${key.replace("species:", "")}`);
  }
}

const noImplement = allRules.filter(([rule]) => !implementsOf(rule).length).length;
console.log(`\n${noImplement} big-game rules carry no structured implement.\n`);
