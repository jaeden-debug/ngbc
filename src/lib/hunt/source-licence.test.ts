import assert from "node:assert/strict";
import test from "node:test";
import {
  licenceHash, licencePermitsServing, licencePermitsStoredCopy, licenceRecordIsIntact, type SourceLicence,
} from "./source-licence.ts";
import { US_ZONE_LAYERS } from "./united-states/layers.ts";

/**
 * The licence record is the gate between a publisher's terms and what North
 * Ground does with a dataset. These hold the four rules that make it a gate
 * rather than a comment.
 */

function licence(overrides: Partial<SourceLicence> = {}): SourceLicence {
  const statedAs = overrides.statedAs ?? "Open Government Licence – Canada";
  return {
    statedAs,
    url: "https://example.gov/dataset/terms",
    retrievedAt: "2026-09-22",
    sha256: licenceHash(statedAs),
    permittedUse: "COMMERCIAL_PERMITTED",
    attribution: "The publisher",
    ...overrides,
    ...(overrides.statedAs ? { sha256: overrides.sha256 ?? licenceHash(overrides.statedAs) } : {}),
  };
}

test("only a recorded grant permits use: silence, restriction and an absent record never do", () => {
  assert.equal(licencePermitsServing(licence({ permittedUse: "COMMERCIAL_PERMITTED" })), true);
  assert.equal(licencePermitsServing(licence({ permittedUse: "PUBLIC_DOMAIN" })), true);
  assert.equal(licencePermitsServing(licence({ permittedUse: "UNRESOLVED" })), false);
  assert.equal(licencePermitsServing(licence({ permittedUse: "RESTRICTED" })), false);
  assert.equal(licencePermitsServing(undefined), false, "a dataset with no recorded licence is never served");
});

test("using and keeping are different permissions: a live query may be allowed where a copy is not", () => {
  /* Saskatchewan's case: the item grants commercial use and the same item says
     "Not for resale", so the live service may be queried while storing and
     redistributing the file is for a person to settle. */
  const saskatchewan = licence({
    statedAs: "Saskatchewan Unrestricted Use Data Licence … Not for resale",
    permittedUse: "COMMERCIAL_PERMITTED",
    redistribution: "UNRESOLVED",
  });
  assert.equal(licencePermitsServing(saskatchewan), true, "the live service may be queried");
  assert.equal(licencePermitsStoredCopy(saskatchewan), false, "but no copy may be ingested or stored");

  // An open licence covers both.
  const ogl = licence({ redistribution: "PERMITTED" });
  assert.equal(licencePermitsServing(ogl), true);
  assert.equal(licencePermitsStoredCopy(ogl), true);

  // Absent is read as unresolved, never as permission.
  assert.equal(licencePermitsStoredCopy(licence()), false, "an unstated redistribution is not a grant");
  assert.equal(licencePermitsStoredCopy(licence({ redistribution: "PROHIBITED" })), false);
  // A copy is never permitted where the use itself is not.
  assert.equal(licencePermitsStoredCopy(licence({ permittedUse: "UNRESOLVED", redistribution: "PERMITTED" })), false);
  assert.equal(licencePermitsStoredCopy(undefined), false);
});

test("the recorded wording is hashed, so a reworded licence is a visible change", () => {
  const recorded = licence({ statedAs: "CC-BY Idaho Fish and Game" });
  assert.equal(licenceRecordIsIntact(recorded), true);
  assert.equal(recorded.sha256, licenceHash("CC-BY Idaho Fish and Game"));
  assert.match(recorded.sha256, /^sha256:[0-9a-f]{64}$/);

  // The publisher changes a word; the record no longer matches its own hash.
  assert.equal(licenceRecordIsIntact({ ...recorded, statedAs: "CC-BY-NC Idaho Fish and Game" }), false);
  // Hashing is over the exact text: whitespace is not normalised away.
  assert.notEqual(licenceHash("Open Government Licence"), licenceHash("Open Government  Licence"));
});

test("an evidence package's licence record uses the canonical vocabulary and stores no derived permission", async () => {
  /* Both licence blocks in the evidence corpus were written by hand, and both
     were wrong the same two ways — which is what a hand-written second model
     of an existing type produces.

     `permittedUse` had invented values ("COMMERCIAL", "NOT_ESTABLISHED"), and
     both records STORED `licencePermitsServing` and `licencePermitsStoredCopy`,
     which this module COMPUTES. A stored derived permission is how a record
     comes to assert a permission and deny establishing one in the same breath:
     each field reads plausibly alone, and only the pair is wrong, so a
     reviewer reads past it.

     The first attempt at fixing it replaced one invented value with another
     and kept the booleans. That is why this assertion exists and a corrected
     record does not: a fix that does not close the shape invites the next
     instance to look different enough to pass. */
  const { readdir, readFile } = await import("node:fs/promises");
  const root = "content/regulatory/evidence";
  const canonical = new Set(["COMMERCIAL_PERMITTED", "PUBLIC_DOMAIN", "NON_COMMERCIAL_ONLY", "PROHIBITED", "UNRESOLVED"]);
  const redistribution = new Set(["PERMITTED", "UNRESOLVED", "PROHIBITED"]);
  let checked = 0;

  for (const jurisdiction of await readdir(root)) {
    for (const file of await readdir(`${root}/${jurisdiction}`)) {
      const at = `${jurisdiction}/${file}`;
      const parsed = JSON.parse(await readFile(`${root}/${at}`, "utf8")) as {
        source?: { licence?: Record<string, unknown> };
      };
      const licence = parsed.source?.licence;
      if (!licence) continue;
      checked += 1;

      assert.ok(canonical.has(licence.permittedUse as string),
        `${at}: permittedUse ${JSON.stringify(licence.permittedUse)} is not one of the canonical values`);
      if (licence.redistribution !== undefined) {
        assert.ok(redistribution.has(licence.redistribution as string),
          `${at}: redistribution ${JSON.stringify(licence.redistribution)} is not canonical`);
      }
      for (const derived of ["licencePermitsServing", "licencePermitsStoredCopy"]) {
        assert.ok(!(derived in licence),
          `${at}: ${derived} is COMPUTED from permittedUse and redistribution and must never be stored`);
      }
      /* `statedAs` means the publisher's words. Ours belongs in its own field,
         and a record with no publisher statement carries neither rather than
         borrowing the quotation field to hold a finding. */
      if (typeof licence.statedAs === "string") {
        assert.doesNotMatch(licence.statedAs, /North Ground/,
          `${at}: statedAs is the publisher's words — a North Ground finding belongs in northGroundFinding`);
      }
    }
  }

  /* An empty sweep would pass every assertion above. */
  assert.ok(checked >= 2, `expected to check at least 2 licence records, checked ${checked}`);
});

/* ── The owner's 2026-10-06 live-read decision ───────────────────────────── */

test("unstated terms permit a LIVE read and can never permit a stored copy", () => {
  /*
   * THE DECISION AND THE TRAP IN IT. Silence about redistribution is not a
   * prohibition on ordinary read-only requests to a public service, so
   * LIVE_READ_NO_STATED_TERMS serves. But "unstated terms do not grant
   * redistribution rights" — and the way that would be lost is a record with
   * this state and `redistribution: "PERMITTED"`, which is incoherent rather
   * than permissive: terms nobody stated cannot have granted anything.
   *
   * `licencePermitsStoredCopy` therefore refuses the state STRUCTURALLY rather
   * than by reading the field. This is the counterfactual: the hostile record
   * below would open a storage path under a field-reading implementation.
   */
  const base = {
    statedAs: "NONE STATED.",
    url: "https://example.gov/service?f=json",
    retrievedAt: "2026-10-06",
    attribution: null,
  } as const;

  const liveRead: SourceLicence = { ...base, sha256: licenceHash(base.statedAs), permittedUse: "LIVE_READ_NO_STATED_TERMS", redistribution: "UNRESOLVED" };
  assert.equal(licencePermitsServing(liveRead), true, "a public service with no stated terms may be queried live");
  assert.equal(licencePermitsStoredCopy(liveRead), false, "and never stored");

  /* THE COUNTERFACTUAL. Same state, with redistribution asserted PERMITTED. */
  const hostile: SourceLicence = { ...liveRead, redistribution: "PERMITTED" };
  assert.equal(licencePermitsStoredCopy(hostile), false,
    "a LIVE_READ_NO_STATED_TERMS record cannot grant storage even by claiming redistribution is permitted");

  /* And the states that genuinely can carry a stored copy still do, so the
     guard above narrows nothing it should not. */
  const open: SourceLicence = { ...base, sha256: licenceHash(base.statedAs), permittedUse: "COMMERCIAL_PERMITTED", redistribution: "PERMITTED" };
  assert.equal(licencePermitsStoredCopy(open), true);
  const unresolved: SourceLicence = { ...base, sha256: licenceHash(base.statedAs), permittedUse: "UNRESOLVED", redistribution: "PERMITTED" };
  assert.equal(licencePermitsServing(unresolved), false, "UNRESOLVED still blocks serving; the decision narrowed silence, not refusal");
});

test("a live-read layer is served and is not ingested anywhere", () => {
  /*
   * The policy is only as good as its consumers. Every layer whose licence is
   * LIVE_READ_NO_STATED_TERMS must resolve LIVE_SERVICE — a stored resolution
   * would be the mirror the decision forbids, and it would look like ordinary
   * coverage.
   */
  const liveRead = US_ZONE_LAYERS.filter((layer) => layer.licence?.permittedUse === "LIVE_READ_NO_STATED_TERMS");
  assert.ok(liveRead.length >= 1, "no live-read layer found, so this test may be asserting nothing");
  for (const layer of liveRead) {
    assert.equal(layer.resolution, "LIVE_SERVICE", `${layer.id} holds unstated terms and must not be stored`);
    assert.equal(licencePermitsStoredCopy(layer.licence), false, `${layer.id}`);
  }
});

test("terms that address warranty rather than use are their own finding, and permit nothing", () => {
  /*
   * Measured 2026-10-07 on Colorado, Montana and Wyoming. All three were about
   * to be treated as the silence case the owner's §44 decision unblocked — and
   * all three have real paragraphs. Colorado's item licenceInfo is a warranty
   * disclaimer with an indemnity; Wyoming's is a warranty disclaimer plus a
   * recommendation to acquire the data directly; Montana's grants ACCESS and
   * disclaims warranties. None of them says anything about reuse.
   *
   * §44's condition is a positive control proving the search could have found
   * terms HAD ANY EXISTED. Here the search found terms. So this state serves
   * nothing: it exists so the finding is reported as itself rather than folded
   * into silence (which would over-claim) or into refusal (which would
   * under-claim, the direction nobody reports).
   */
  const warranty: SourceLicence = {
    statedAs: "ANY DATA OR INFORMATION PROVIDED BY THE DEPARTMENT IS PROVIDED \"AS IS\" WITHOUT WARRANTY OF ANY KIND.",
    url: "https://example.invalid/terms",
    retrievedAt: "2026-10-07",
    sha256: licenceHash("ANY DATA OR INFORMATION PROVIDED BY THE DEPARTMENT IS PROVIDED \"AS IS\" WITHOUT WARRANTY OF ANY KIND."),
    permittedUse: "TERMS_SILENT_ON_USE",
    redistribution: "UNRESOLVED",
    attribution: "An authority",
  };
  assert.equal(licencePermitsServing(warranty), false, "serving on this state is the owner's decision, not ours");
  assert.equal(licencePermitsStoredCopy(warranty), false);
  assert.equal(licenceRecordIsIntact(warranty), true);

  /* And the storage refusal is STRUCTURAL: claiming redistribution cannot open
     a path, exactly as for the silence state. */
  assert.equal(licencePermitsStoredCopy({ ...warranty, redistribution: "PERMITTED" }), false,
    "terms that do not address use cannot have granted redistribution");

  /* It is a DIFFERENT finding from silence, and both refuse storage. */
  const silence: SourceLicence = { ...warranty, permittedUse: "LIVE_READ_NO_STATED_TERMS" };
  assert.equal(licencePermitsServing(silence), true, "silence was unblocked for live reads by the owner");
  assert.equal(licencePermitsStoredCopy(silence), false);
  assert.notEqual(warranty.permittedUse, silence.permittedUse);
});
