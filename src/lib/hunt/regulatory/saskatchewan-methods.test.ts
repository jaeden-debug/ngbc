import assert from "node:assert/strict";
import test from "node:test";
import {
  KNOWN_DRAFTING_INCONSISTENCIES, METHOD_ENVELOPES, SASKATCHEWAN_IMPLEMENTS, SECTION_ENVELOPES,
  envelopeContains, implementsPermittedIn,
} from "./saskatchewan-methods.ts";

test("every season the regulation names has a recorded envelope, and there are 39", () => {
  /* The regulation carries 39 method-envelope subsections. The count is asserted
     because the failure mode is a season added by amendment whose envelope nobody
     read — it would fall through `implementsPermittedIn` with a throw rather than
     silently permitting the wrong set, but the count is what makes the gap visible. */
  assert.equal(Object.keys(SECTION_ENVELOPES).length, 39);
  for (const [season, envelope] of Object.entries(SECTION_ENVELOPES)) {
    assert.ok(METHOD_ENVELOPES[envelope], `${season} names an envelope that does not exist`);
    assert.ok(implementsPermittedIn(season).length > 0);
  }
  /* And an unrecorded season throws rather than defaulting to something. */
  assert.throws(() => implementsPermittedIn("walrus archery"), /No method envelope recorded/);
});

test("the ladder nests within each species — the mistake this file exists to prevent", () => {
  /* A bow is lawful in the muzzleloader season, and the section titled
     "muzzle-loading firearm open seasons" is open to a bow and a crossbow too.
     Keying it MUZZLELOADER alone — which the heading invites — tells a bow hunter
     CLOSED when the season is open to them. */
  const deer = ["archery", "crossbow", "muzzle-loading firearm", "shotgun", "rifle"]
    .map((rung) => `white-tailed deer ${rung}`);
  for (let i = 1; i < deer.length; i += 1) {
    assert.ok(envelopeContains(deer[i], deer[i - 1]),
      `${deer[i]} must permit everything ${deer[i - 1]} permits`);
    assert.ok(implementsPermittedIn(deer[i]).length > implementsPermittedIn(deer[i - 1]).length,
      `${deer[i]} must permit strictly more than ${deer[i - 1]}`);
  }
  assert.deepEqual([...implementsPermittedIn("white-tailed deer archery")], ["BOW"]);
  assert.deepEqual([...implementsPermittedIn("white-tailed deer muzzle-loading firearm")],
    ["BOW", "CROSSBOW", "MUZZLELOADER"]);
  assert.deepEqual([...implementsPermittedIn("white-tailed deer rifle")], [...SASKATCHEWAN_IMPLEMENTS]);

  /* The antlerless ladder is identical to the antlered one. Asserted rather than
     assumed: a difference between them would be a real asymmetry in the law. */
  for (const rung of ["archery", "crossbow", "muzzle-loading firearm", "shotgun", "rifle"]) {
    assert.deepEqual(
      [...implementsPermittedIn(`antlerless white-tailed deer ${rung}`)],
      [...implementsPermittedIn(`white-tailed deer ${rung}`)],
      `the antlerless ${rung} envelope differs from the antlered one`);
  }
});

test("two species break the five-rung pattern, and that is the regulation's shape", () => {
  /* MOOSE HAS NO BOW-ONLY SEASON. Its archery season is "moose archery and
     crossbow special" and permits both, so a builder that assumed every species
     has a bow-only rung would invent one. */
  assert.deepEqual([...implementsPermittedIn("moose archery and crossbow special")], ["BOW", "CROSSBOW"]);
  assert.ok(!Object.keys(SECTION_ENVELOPES).includes("moose archery"),
    "there is no moose archery season to find");

  /* MULE DEER'S GENERAL LADDER HAS NO SHOTGUN RUNG. Only the ANTLERLESS mule deer
     ladder does. Inventing one would open a season that does not exist. */
  assert.ok(!Object.keys(SECTION_ENVELOPES).includes("mule deer shotgun special"),
    "mule deer has no shotgun special season");
  assert.ok(Object.keys(SECTION_ENVELOPES).includes("antlerless mule deer shotgun special"),
    "but antlerless mule deer does");

  /* AND THE GENERAL ELK AND MOOSE SEASONS ARE NAMED FOR NO METHOD AT ALL — "elk
     open seasons", "moose open seasons" — so a heading-driven reading would have no
     method for them, while their own envelopes permit everything lawful. */
  assert.equal(SECTION_ENVELOPES.elk, "ALL_LAWFUL_MEANS");
  assert.equal(SECTION_ENVELOPES.moose, "ALL_LAWFUL_MEANS");
});

test("an envelope's permitted set matches the words it records", () => {
  /* The table is data read out of the regulation, so the invariant worth holding is
     that each entry's `statedAs` and `permits` say the same thing — a transcription
     that named one more means than it listed would otherwise be invisible. */
  const named: Array<[string, string]> = [
    ["BOW", "bow and arrow"], ["CROSSBOW", "crossbow"],
    ["MUZZLELOADER", "muzzle-loading firearm"], ["SHOTGUN", "shotgun"],
  ];
  for (const envelope of Object.values(METHOD_ENVELOPES)) {
    if (envelope.openEnvelope) {
      /* The open envelope lists no means; it defers, and must say where to. */
      assert.match(envelope.statedAs, /The Wildlife Regulations, 1981/);
      assert.ok(envelope.deferredTo, `${envelope.id} defers and must name where`);
      assert.deepEqual([...envelope.permits], [...SASKATCHEWAN_IMPLEMENTS]);
      continue;
    }
    assert.ok(!envelope.deferredTo, `${envelope.id} lists its means and defers to nothing`);
    for (const [implement, words] of named) {
      assert.equal(envelope.statedAs.includes(words), envelope.permits.includes(implement as never),
        `${envelope.id}: "${words}" and ${implement} disagree`);
    }
    /* A listed envelope never reaches a rifle — that is what distinguishes it. */
    assert.ok(!envelope.permits.includes("RIFLE"), `${envelope.id} lists means and cannot include a rifle`);
  }
});

test("the regulation's own drafting inconsistency is recorded, not corrected", () => {
  assert.equal(KNOWN_DRAFTING_INCONSISTENCIES.length, 1);
  assert.match(KNOWN_DRAFTING_INCONSISTENCIES[0], /s\. 41\(1\)/);
  assert.match(KNOWN_DRAFTING_INCONSISTENCIES[0], /permitted means are unaffected/);
});
