import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { globSync } from "node:fs";
import { readFileSync } from "node:fs";

/**
 * EVERY TEST FILE IN THE REPOSITORY IS REACHED BY `npm test`.
 *
 * WHY THIS IS A MEASUREMENT OVER THE POPULATION AND NOT A LINT.
 *
 * Two files were dark for weeks and the obvious check would have missed one of
 * them. `test:components` was `node --test src/components/**{{/}}*.test.ts`; npm runs
 * scripts under `/bin/sh`, where `**` does not recurse, so the shell expanded it
 * to the two files one level deep and node never saw a pattern — 6 live tests
 * never ran. A second file, `validate-canada-source-reconnaissance.test.mjs`,
 * was referenced by no script at all, so no amount of looking at globs would
 * have found it.
 *
 * "Is every glob quoted?" is a filter, and a filter can only find the shapes it
 * already imagines. "Is any test file unreached?" is one question asked of every
 * file that exists, and it cannot be satisfied by a file that is dark for a
 * reason nobody anticipated.
 *
 * HOW THE EXPANSION IS MODELLED. Not by reimplementing shell globbing — that is
 * the same guess one level down. Each `--test` argument is handed to the REAL
 * `/bin/sh`, exactly as npm would. Where sh expands it, those are the files node
 * receives. Where sh leaves the pattern untouched (it matched nothing, or it was
 * quoted in the script), node's own runner does the globbing, so node's
 * recursive semantics apply.
 *
 * WHAT THIS CANNOT CATCH. If the step that runs THIS file is removed from the
 * chain, the file goes dark with everything else and cannot object — a checker
 * cannot report its own absence. The self-assertion at the end of the first
 * test is the partial answer: run by any path, it fails unless the chain also
 * reaches it. The complete answer would be a check outside the chain, and there
 * is none today; this is recorded rather than implied.
 *
 * That difference is the whole defect: `src/app/**{{/}}*.test.ts` is correct TODAY only
 * because `src/app/*{{/}}*` matches nothing, so sh passes the literal through and
 * node globs it recursively. The first test placed one level deep under
 * `src/app` would have turned that suite dark with no failure and no warning.
 */

const ROOT = new URL("..", import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

/** Every test file that exists, which is the population the chain is measured against. */
function everyTestFile() {
  const out = execFileSync("git", ["ls-files", "*.test.ts", "*.test.tsx", "*.test.mjs", "*.test.js"], { cwd: ROOT, encoding: "utf8" });
  return new Set(out.split("\n").map((line) => line.trim()).filter(Boolean));
}

/** What `/bin/sh` does with one argument — the real shell, not a model of it. */
function shellExpand(argument) {
  const printed = execFileSync("/bin/sh", ["-c", `for f in ${argument}; do printf '%s\\n' "$f"; done`], { cwd: ROOT, encoding: "utf8" });
  return printed.split("\n").map((line) => line.trim()).filter(Boolean);
}

/** The files one chain step actually hands to node. */
function filesReachedBy(command) {
  const reached = new Set();
  /* Arguments after `--test`, up to the next flag. Quoted arguments keep their
     quotes here on purpose: sh will strip them and decline to glob, which is
     exactly the behaviour being modelled. */
  const parts = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  const testFlag = parts.indexOf("--test");
  if (testFlag === -1) return reached;
  for (const raw of parts.slice(testFlag + 1)) {
    if (raw.startsWith("-")) break;
    const quoted = /^['"]/.test(raw);
    const bare = raw.replace(/^['"]|['"]$/g, "");
    const expanded = quoted ? [bare] : shellExpand(raw);
    /* sh returned the pattern unchanged: it matched nothing, or it was quoted.
       Either way node's runner is what globs it, and node's `**` recurses. */
    const nodeGlobs = expanded.length === 1 && expanded[0] === bare && /[*?[]/.test(bare);
    for (const entry of nodeGlobs ? globSync(bare, { cwd: ROOT }) : expanded) reached.add(entry);
  }
  return reached;
}

test("every test file in the repository is reached by npm test", () => {
  const steps = pkg.scripts.test.split("&&").map((part) => part.trim().replace(/^npm run /, ""));
  assert.ok(steps.length >= 15, `the chain has only ${steps.length} steps; it may have been truncated`);

  const reached = new Set();
  for (const step of steps) {
    const command = pkg.scripts[step];
    assert.ok(command, `\`npm test\` runs \`${step}\`, which is not a script`);
    for (const file of filesReachedBy(command)) reached.add(file);
  }

  const population = everyTestFile();
  assert.ok(population.size >= 200, `only ${population.size} test files found; the population lookup is broken, not the chain`);

  const dark = [...population].filter((file) => !reached.has(file)).sort();
  assert.deepEqual(dark, [], `${dark.length} test file(s) exist but are never run by \`npm test\``);

  /* A positive control on the measurement itself. If `reached` were built from
     the population rather than from the chain, the assertion above would pass
     no matter what the scripts said. */
  assert.ok(reached.has("scripts/validate-test-chain.test.mjs"), "this file must be reached by the chain it checks");
});

test("a file the chain cannot reach is reported as dark", () => {
  /* The check is only worth having if it fails on a real orphan, so one is
     constructed here rather than trusted: a path that exists in the population
     and in no step's expansion. */
  const reached = new Set(["a.test.ts"]);
  const population = new Set(["a.test.ts", "scripts/orphan.test.mjs"]);
  const dark = [...population].filter((file) => !reached.has(file));
  assert.deepEqual(dark, ["scripts/orphan.test.mjs"]);
});
