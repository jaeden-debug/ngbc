import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FEDERAL_REQUIREMENTS, federalHuntingMargin, federalRequirementsFor,
} from "./federal-requirements.ts";

/**
 * Federal requirements compose with provincial ones. Neither replaces the
 * other, and a hunter must satisfy both.
 */

test("every requirement cites the section a hunter can read", () => {
  for (const requirement of FEDERAL_REQUIREMENTS) {
    assert.match(requirement.section, /^s\. \d/, requirement.id);
    assert.ok(requirement.statedAs.trim().length > 0, requirement.id);
    assert.ok(requirement.summary.trim().length > 0, requirement.id);
  }
});

test("the permit and the stamp are two requirements, not one", () => {
  /* A permit without the stamp on it does not authorise hunting, and a hunter
     who reads them as one line buys one and is stopped for the other. */
  const ids = FEDERAL_REQUIREMENTS.map((requirement) => requirement.id);
  assert.ok(ids.includes("federal_requirement:permit"));
  assert.ok(ids.includes("federal_requirement:habitat-stamp"));
});

test("an exception the regulation states is recorded, never dropped", () => {
  const permit = FEDERAL_REQUIREMENTS.find((entry) => entry.id === "federal_requirement:permit")!;
  assert.ok(permit.exceptions?.some((text) => /general hunting licence/.test(text)));
  assert.ok(permit.exceptions?.some((text) => /murre/i.test(text)));
});

test("a species the regulation excepts does not carry the requirement at all", () => {
  /*
   * Non-toxic shot does not apply to American Woodcock. Showing it with a
   * footnote would state a stricter rule than the law, and a hunter turned
   * away from a legal hunt is a failure too.
   */
  const forWoodcock = federalRequirementsFor("species:american-woodcock").map((entry) => entry.id);
  assert.ok(!forWoodcock.includes("federal_requirement:non-toxic-shot"));

  const forMallard = federalRequirementsFor("species:mallard").map((entry) => entry.id);
  assert.ok(forMallard.includes("federal_requirement:non-toxic-shot"), "a duck hunter must use non-toxic shot");
});

test("the legal-hours margin is computed from the regulation's own latitude split", () => {
  /* s. 28(3) states this exactly enough to compute, which is the condition
     §41A puts on showing a legal hunting window at all. */
  assert.equal(federalHuntingMargin(49.3).minutes, 30);
  assert.equal(federalHuntingMargin(52.5).minutes, 30);
  assert.equal(federalHuntingMargin(64.0).minutes, 60);
  assert.match(federalHuntingMargin(64.0).statedAs, /north of 60/);
  /* Exactly on the line is south of it: the rule says "north of 60°N". */
  assert.equal(federalHuntingMargin(60).minutes, 30);
});

test("nothing here claims to replace a provincial requirement", () => {
  for (const requirement of FEDERAL_REQUIREMENTS) {
    const text = `${requirement.summary} ${requirement.statedAs}`;
    assert.doesNotMatch(text, /instead of|rather than the provincial|replaces/i, requirement.id);
  }
});
