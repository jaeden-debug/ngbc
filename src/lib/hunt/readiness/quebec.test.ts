import assert from "node:assert/strict";
import test from "node:test";
import { quebecOrange, QUEBEC_READINESS_SPECIES, resolveQuebecReadiness } from "./quebec.ts";

/**
 * Québec's Ready to Hunt, tested on what a partial checklist must not do.
 *
 * The happy path — "a licence is required" — passes under almost any encoding.
 * What is worth pinning is the method-dependent orange exemption, the two
 * categories that are deliberately unresolved, and the fact that the whole
 * thing reports itself as incomplete. Each is a place where a plausible
 * implementation is confidently wrong in a direction nobody reports.
 */

const zone = "management_zone:ca-qc-zone-10o";
const check = (speciesId: string, answers: Record<string, string> = {}) =>
  resolveQuebecReadiness({ speciesId, date: "2026-09-29", zoneId: zone, answers });

/* ── Scope ───────────────────────────────────────────────────────────────── */

test("the checklist covers Québec small game, and says nothing about big game", () => {
  /*
   * DECLARED. Scope is a claim: what is listed here has been read in the
   * consolidated regulations. Moose, deer, bear and turkey run through
   * different licences, tags and draws nobody has read, so a checklist for
   * them would be built from the nearest thing to hand.
   */
  assert.deepEqual([...QUEBEC_READINESS_SPECIES], [
    "species:arctic-hare", "species:eastern-cottontail", "species:ruffed-grouse",
    "species:sharp-tailed-grouse", "species:snowshoe-hare", "species:spruce-grouse",
  ]);
  const moose = check("species:moose");
  assert.equal(moose.coverage, "UNAVAILABLE");
  assert.equal(moose.authorizations.length, 0);
  assert.ok(moose.limitations[0].length > 40, "says why, rather than showing an empty card");
});

/* ── Hunter orange ───────────────────────────────────────────────────────── */

test("grouse with a firearm needs orange, and the specification is the law's own minimum", () => {
  /*
   * No exemption reaches a grouse: art. 17.3(1°)(b) names American crow, rock
   * pigeon and three frogs, and no grouse is among them. Verified by walking
   * all seven paragraphs, not by failing to find one.
   */
  const orange = check("species:ruffed-grouse", { HUNT_METHOD: "SHOTGUN" }).orange;
  assert.equal(orange?.status, "REQUIRED");
  /* Never shortened to "wear orange". The minimum is the fact. */
  assert.match(orange?.specification ?? "", /2,580 cm²/);
  assert.match(orange?.specification ?? "", /595 and 605 nm/);
  assert.match(orange?.specification ?? "", /back, the shoulders and the chest/);
});

test("hare BY SNARE is exempt from orange, and hare by rifle is not", () => {
  /*
   * THE TRAP THIS TEST EXISTS FOR. art. 17.3(1°)(c) puts arctic hare, snowshoe
   * hare and eastern cottontail in the exemption — but only « au moyen d'un
   * collet ». The species is in the exemption and the METHOD is the condition,
   * which is exactly the shape a reader skims past. Getting it wrong in one
   * direction tells a lawful snare-setter they must wear orange; in the other
   * it tells a rifle hunter they need not.
   */
  assert.equal(check("species:arctic-hare", { HUNT_METHOD: "SNARE" }).orange?.status, "NOT_REQUIRED");
  assert.equal(check("species:snowshoe-hare", { HUNT_METHOD: "SNARE" }).orange?.status, "NOT_REQUIRED");
  assert.equal(check("species:eastern-cottontail", { HUNT_METHOD: "SNARE" }).orange?.status, "NOT_REQUIRED");
  assert.equal(check("species:arctic-hare", { HUNT_METHOD: "RIFLE" }).orange?.status, "REQUIRED");
  assert.equal(check("species:arctic-hare", { HUNT_METHOD: "BOW" }).orange?.status, "REQUIRED");
});

test("hare with no method given is CONDITIONAL, never guessed either way", () => {
  /* REQUIRED would be stricter than the source for a snare hunter;
     NOT_REQUIRED would be looser for everyone else. Neither is available. */
  const orange = check("species:arctic-hare").orange;
  assert.equal(orange?.status, "CONDITIONAL");
  assert.match(orange?.summary ?? "", /snare/i);
});

test("a grouse never inherits the hare exemption", () => {
  /* A SNARE answer on a species the exemption does not name must not exempt
     it: the paragraph names hare and cottontail, and nothing else. */
  assert.equal(check("species:ruffed-grouse", { HUNT_METHOD: "SNARE" }).orange?.status, "REQUIRED");
});

test("orange carries the exceptions North Ground cannot see, rather than resolving them", () => {
  /*
   * Several art. 17.3 exemptions turn on facts about the place or the party —
   * a bow-only sector in a réserve faunique or zec, a leased territory where
   * everyone uses a bow, a bird-of-prey hunt where nobody carries a weapon,
   * agreement beneficiaries in agreement territories. North Ground holds none
   * of that geography, so they are surfaced, never silently applied.
   */
  const orange = check("species:ruffed-grouse", { HUNT_METHOD: "SHOTGUN" }).orange;
  assert.ok((orange?.exceptions.length ?? 0) >= 5);
  assert.ok(orange?.exceptions.some((line) => /guide|accompanying/i.test(line)),
    "the duty binds a guide or accompanying person too");
  assert.ok(orange?.exceptions.some((line) => /bird of prey/i.test(line)));
});

test("every orange statement cites the instrument that actually carries it", () => {
  /*
   * r. 1, NOT r. 12. The Règlement sur la chasse is the obvious place — it
   * holds the licences, the engin types and the seasons — and contains no
   * orange provision at all: zero occurrences of « orang » in 114,000
   * characters, against 283 for « chasse ». Attributing this to r. 12 would
   * be the fifth wrong-instrument finding on this program, so the citation is
   * asserted rather than trusted.
   */
  const orange = check("species:ruffed-grouse", { HUNT_METHOD: "SHOTGUN" }).orange;
  assert.ok(orange?.provenance.length);
  for (const entry of orange?.provenance ?? []) {
    assert.match(entry.citation, /r\. 1, art\. 17\./, `${entry.citation} cites r. 1`);
    assert.doesNotMatch(entry.citation, /r\. 12/, "orange is not in the Règlement sur la chasse");
    assert.ok(entry.url.length > 0);
  }
});

/* ── What is deliberately unresolved ─────────────────────────────────────── */

test("the checklist reports itself as PARTIAL, never VERIFIED", () => {
  /* Two whole categories are unread. VERIFIED would tell a hunter the list is
     complete when it is not, which is the claim this milestone exists to stop. */
  for (const speciesId of QUEBEC_READINESS_SPECIES) {
    assert.equal(check(speciesId).coverage, "PARTIAL", speciesId);
  }
});

test("methods and ammunition are ABSENT, not empty", () => {
  /*
   * An empty category renders as a heading with nothing under it, which reads
   * as "no restrictions" — the one thing silence must never mean. Absent is
   * the contract's "North Ground has not established this".
   */
  const result = check("species:ruffed-grouse", { HUNT_METHOD: "SHOTGUN" });
  assert.equal(result.methods, undefined);
  assert.equal(result.ammunition, undefined);
});

test("the unresolved categories are named in the limitations, with the reason", () => {
  /*
   * DECLARED, so deleting a row fails here. An unresolved method is not an
   * absent method: the engin types ARE defined (r. 12 art. 31) and it is
   * Annexe III — which has no body text on the official consolidation — that
   * says which type is permitted where. A specification of an implement is not
   * a permission to use it, so nothing is derived from the definitions.
   */
  const limitations = check("species:ruffed-grouse").limitations.join("\n");
  assert.match(limitations, /methods and ammunition are NOT yet covered/i);
  assert.match(limitations, /Annexe III/);
  assert.match(limitations, /Fees are NOT shown/i);
  assert.match(limitations, /tarification/i);
});

test("no fee is ever shown, because none has been read", () => {
  /*
   * §41A: a fee appears only when applicability AND currentness are both
   * established. Québec's sit in a separate tarification regulation nobody has
   * read, so every row is CHECK_OFFICIAL. An old or current-looking number is
   * not shown merely because one was found.
   */
  for (const speciesId of QUEBEC_READINESS_SPECIES) {
    for (const item of check(speciesId).authorizations) {
      assert.equal(item.price.kind, "CHECK_OFFICIAL", `${speciesId} / ${item.officialName}`);
    }
  }
});

/* ── Authorizations ──────────────────────────────────────────────────────── */

test("the snare licence needs no hunter certificate, and the small game licence does", () => {
  /*
   * art. 7.1 requires a valid certificat du chasseur for a resident licence,
   * and expressly carves out two — the frog licence and the hare-or-cottontail-
   * by-snare licence. So a snare hunt requires neither the certificate nor a
   * firearms licence, and flattening the two paths would demand paperwork the
   * regulation does not.
   */
  const snare = check("species:arctic-hare", { HUNT_METHOD: "SNARE" });
  const names = snare.authorizations.map((item) => item.officialName);
  assert.deepEqual(names, ["Hare or eastern cottontail by snare licence"]);

  const rifle = check("species:arctic-hare", { HUNT_METHOD: "RIFLE" });
  const rifleNames = rifle.authorizations.map((item) => item.officialName);
  assert.ok(rifleNames.includes("Certificat du chasseur"));
  assert.ok(rifleNames.includes("Small game hunting licence"));
  assert.ok(rifleNames.includes("Possession and Acquisition Licence (PAL)"));
});

test("a firearms licence is required for a firearm and not for a bow or a snare", () => {
  const pal = (answers: Record<string, string>) =>
    check("species:arctic-hare", answers).authorizations.find((item) => item.kind === "FIREARMS_LICENCE");
  assert.equal(pal({ HUNT_METHOD: "SHOTGUN" })?.status, "REQUIRED");
  assert.equal(pal({ HUNT_METHOD: "BOW" }), undefined);
  assert.equal(pal({ HUNT_METHOD: "SNARE" }), undefined);
});

test("every authorization carries a citation and a way to get it", () => {
  for (const speciesId of QUEBEC_READINESS_SPECIES) {
    for (const item of check(speciesId).authorizations) {
      assert.ok(item.provenance.length, `${item.officialName} has provenance`);
      for (const entry of item.provenance) {
        assert.ok(entry.citation.trim().length > 0);
        assert.ok(entry.url.startsWith("http"));
      }
      assert.ok(item.purchase?.infoUrl.startsWith("http"), `${item.officialName} says where to get it`);
    }
  }
});

test("North Ground never claims to know what a hunter holds", () => {
  for (const speciesId of QUEBEC_READINESS_SPECIES) {
    const result = check(speciesId);
    assert.ok(result.limitations.some((line) => /cannot check what you hold/i.test(line)), speciesId);
  }
});

test("quebecOrange is pure in its inputs, so the sheet and the brief cannot disagree", () => {
  /* Two surfaces render this; one derivation produces it. */
  const a = quebecOrange("species:arctic-hare", { HUNT_METHOD: "SNARE" });
  const b = quebecOrange("species:arctic-hare", { HUNT_METHOD: "SNARE" });
  assert.deepEqual(a, b);
});

/* ── Language ────────────────────────────────────────────────────────────── */

test("the ministry's licence names stay French, and stop claiming to be English", () => {
  /*
   * « Certificat du chasseur », « Permis de chasse au petit gibier ». The row
   * builder hardcoded `en-CA`, so a screen reader pronounced them with English
   * phonetics and nothing on screen showed it.
   *
   * THE NAMES ARE NOT TRANSLATED. §47 keeps an official name in the authority's
   * own words, and a licence a hunter has to ask a vendor for by name is
   * exactly what that rule exists for. What was wrong was the label.
   *
   * The language is DECLARED by the jurisdiction module rather than stored in
   * the bundle: Ontario's readiness bundle is generated, so a field hand-added
   * to a generated file disappears at the next rebuild — silently, with the
   * mislabel back and nothing to show it.
   */
  const result = check("species:snowshoe-hare");
  const rows = result.requirements ?? [];
  assert.ok(rows.length > 0, "Québec states authorizations for snowshoe hare");
  for (const row of rows) {
    assert.equal(row.officialName.lang, "fr-CA", row.officialName.text);
    assert.equal(row.officialName.owner, "AUTHORITY");
    // And the name itself is untouched — never rendered into English.
    assert.doesNotMatch(row.officialName.text, /\blicence for\b|\bhunter certificate\b/i);
  }
});
