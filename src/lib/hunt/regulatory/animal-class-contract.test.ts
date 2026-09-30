import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { classDefect, classesFor, type LegalAnimalClass } from "./physical-criterion.ts";

/**
 * THE CONTRACT EVERY JURISDICTION'S LEGAL ANIMAL CLASSES MUST MEET.
 *
 * Written across the published bundles rather than beside one builder, because
 * both defects this catches were introduced by a second jurisdiction agreeing
 * with itself and not with the first:
 *
 * - **Two shapes for one fact.** Québec keyed a map by species at the bundle
 *   root; Ontario hung an array off each species' source record — in the same
 *   week, neither wrong on its own. The matrix's own header already documents
 *   what that costs for implements.
 * - **Two meanings for one absence.** A class with no criterion is either "the
 *   authority measures nothing" or "we could not resolve the test", and
 *   without a stated status they are the same bytes.
 *
 * A per-builder test would have passed on both.
 */

const DIR = path.join(process.cwd(), "content/regulatory");

interface Bundle {
  legalAnimalClasses?: readonly LegalAnimalClass[];
  rules?: readonly { speciesId?: string; animalClasses?: unknown }[];
  sources?: readonly Record<string, unknown>[];
  [key: string]: unknown;
}

const bundles = readdirSync(DIR)
  .filter((name) => name.endsWith(".json"))
  .map((name) => [name, JSON.parse(readFileSync(path.join(DIR, name), "utf8")) as Bundle] as const);

test("every published class is well-formed on its own terms", () => {
  const defects: string[] = [];
  let checked = 0;
  for (const [name, bundle] of bundles) {
    for (const entry of bundle.legalAnimalClasses ?? []) {
      checked += 1;
      const defect = classDefect(entry);
      if (defect) defects.push(`${name}: ${defect}`);
    }
  }
  assert.deepEqual(defects, []);
  /* A positive control: an empty corpus would satisfy the assertion above
     without checking anything, and has done so elsewhere in this repository. */
  assert.ok(checked >= 9, `expected the Québec and Ontario classes, saw ${checked}`);
});

test("classes live at the bundle root, in one flat array, and nowhere else", () => {
  const strays: string[] = [];
  for (const [name, bundle] of bundles) {
    if (bundle.legalAnimalClasses !== undefined) {
      assert.ok(Array.isArray(bundle.legalAnimalClasses), `${name}: not an array`);
    }
    /* Anywhere BUT the root is the shape that already happened. */
    const walk = (node: unknown, at: string): void => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach((item) => walk(item, at));
      for (const [key, value] of Object.entries(node)) {
        if (key === "legalAnimalClasses") strays.push(`${name}${at}.${key}`);
        walk(value, `${at}.${key}`);
      }
    };
    for (const [key, value] of Object.entries(bundle)) {
      if (key !== "legalAnimalClasses") walk(value, `.${key}`);
    }
  }
  assert.deepEqual(strays, []);
});

test("a negation names a class that exists, in the same bundle", () => {
  for (const [name, bundle] of bundles) {
    const ids = new Set((bundle.legalAnimalClasses ?? []).map((entry) => entry.id));
    for (const entry of bundle.legalAnimalClasses ?? []) {
      if (entry.negates) assert.ok(ids.has(entry.negates), `${name}: ${entry.id} negates a class that is not here`);
    }
  }
});

test("classesFor selects by species, not by position", () => {
  const qc = bundles.find(([name]) => name === "ca-qc-2026.json")![1];
  const deer = classesFor(qc, "species:white-tailed-deer");
  const turkey = classesFor(qc, "species:wild-turkey");
  assert.equal(deer.length, 3);
  assert.equal(turkey.length, 2);
  assert.ok(deer.every((entry) => entry.appliesToSpecies.includes("species:white-tailed-deer")));
  assert.equal(classesFor(qc, "species:american-black-bear").length, 0);
  assert.equal(classesFor(undefined, "species:moose").length, 0);
});

test("exactly one class in the corpus is UNRESOLVED, and it says why", () => {
  /* Not a count for its own sake: if this number moves, either a gap was
     closed or a new one was introduced, and both deserve to be read. */
  const unresolved = bundles.flatMap(([name, bundle]) =>
    (bundle.legalAnimalClasses ?? [])
      .filter((entry) => entry.criterionStatus === "UNRESOLVED")
      .map((entry) => `${name}:${entry.id}`),
  );
  assert.deepEqual(unresolved, ["ca-qc-2026.json:legal_animal_class:ca-qc-deer-antlered-rtlb"]);
});
