import assert from "node:assert/strict";
import test from "node:test";
import type { CanonicalId } from "../../content-contract/index.ts";
import { quoting } from "../provenance.ts";
import type { HuntDimensionAnswers } from "./dimensions.ts";
import { evaluateManitoba, manitobaCoverageReport, MANITOBA_BUNDLE, MANITOBA_SPECIES } from "./manitoba.ts";
import { limitationText } from "../limitation.ts";

/**
 * Manitoba, evaluated from the committed bundle.
 *
 * Every expectation below was read from M.R. 165/91 as consolidated on
 * 2026-06-16 (last amendment M.R. 46/2026), not from the engine's output. The
 * places are real: coordinates inside the named Game Hunting Areas.
 */

const RUFFED = "species:ruffed-grouse";
const SHARP_TAILED = "species:sharp-tailed-grouse";
const DEER = "species:white-tailed-deer";
const SHILO = "special_geography:ca-mb-cfb-shilo";
const MACDONALD = "special_geography:ca-mb-gha-38-rm-of-macdonald";
const WHITESHELL = "special_geography:ca-mb-whiteshell-game-bird-refuge";
const MULE_DEER = "species:mule-deer";
const ELK = "species:elk";
const MOOSE = "species:moose";
const BEAR = "species:american-black-bear";
const HECLA = "special_geography:ca-mb-hecla-island";
const TURTLE_MOUNTAIN_PASTURE = "special_geography:ca-mb-turtle-mountain-community-pasture";
const GHA9A_MOOSE_ZONE = "special_geography:ca-mb-gha-9a-prohibited-moose-hunting-zone";

function at(gha: string, latitude: number, longitude: number, overlays: string[] | null = []) {
  return {
    zoneId: `management_zone:ca-mb-gha-${gha.toLowerCase()}`,
    zoneName: `Game Hunting Area ${gha}`,
    latitude,
    longitude,
    overlays: overlays === null ? null : new Set(overlays),
  };
}

const PLACES = {
  gha1: at("1", 58.5, -99.0), // far north, game bird zone 1
  gha7: at("7", 54.0, -97.5),
  gha7a: at("7A", 54.5, -98.0),
  gha13: at("13", 51.1, -100.7),
  gha14Band: at("14", 52.9, -100.6), // between 52.70° and 53.05°: zone 2 or 3
  gha22: at("22", 51.0, -97.8),
  gha23a: at("23A", 50.3, -99.4),
  gha25bFar: at("25B", 50.9, -97.6), // south Interlake, far from Oak Hammock
  gha25bNearOakHammock: at("25B", 50.2, -97.2),
  gha26: at("26", 50.2, -95.6),
  gha30: at("30", 49.95, -100.1),
  gha33: at("33", 49.5, -97.5),
  gha36: at("36", 49.85, -95.53),
  gha38: at("38", 49.79, -97.27),
};

function evaluate(speciesId: string, date: string, place: ReturnType<typeof at>, answers: HuntDimensionAnswers = {}) {
  const speciesName = speciesId.replace("species:", "").replace(/-/g, " ");
  return evaluateManitoba({ speciesId, speciesName, date, place, answers });
}

function status(evaluation: ReturnType<typeof evaluate>) {
  return evaluation.completeness === "NEEDS_INPUT" ? `ASK ${evaluation.required?.id}` : evaluation.result?.status;
}

/* ── The bundle itself ──────────────────────────────────────────────────── */

test("the bundle is the 2026-27 hunting year, from the consolidation in force since 16 June 2026", () => {
  assert.equal(MANITOBA_BUNDLE.jurisdictionId, "jurisdiction:ca-mb");
  assert.equal(MANITOBA_BUNDLE.sourceVersion, "M.R. 46/2026");
  assert.deepEqual(
    { from: MANITOBA_BUNDLE.certifiedPeriod.from, to: MANITOBA_BUNDLE.certifiedPeriod.to },
    { from: "2026-06-16", to: "2027-03-31" },
  );
  assert.equal(MANITOBA_BUNDLE.officialUnitCount, 62);
  assert.deepEqual([...MANITOBA_SPECIES], [RUFFED, SHARP_TAILED, "species:spruce-grouse", DEER, MULE_DEER, ELK, MOOSE, BEAR].sort());
  for (const rule of MANITOBA_BUNDLE.rules) {
    for (const window of rule.windows) {
      assert.ok(window.opensIso >= "2026-04-01" && window.closesIso <= "2027-03-31", `${rule.id} ${window.opensIso}`);
      assert.ok(window.opensIso <= window.closesIso, rule.id);
    }
  }
});

test("absence is closed because the regulation says so, and the provision is quoted AS the regulation's", () => {
  assert.equal(MANITOBA_BUNDLE.absence.meaning, "CLOSED");
  assert.equal(MANITOBA_BUNDLE.absence.section, "M.R. 165/91 s. 3");
  const words = MANITOBA_BUNDLE.absence.words!;
  /* Manitoba's absence rests on the regulation's OWN sentence — the generator
     verifies it verbatim with `requireProvision` — so it must be declared the
     authority's and carry the provenance that makes quoting it checkable.
     Alberta's, Idaho's and Montana's absence sentences are North Ground's
     reasoning and must not reach this branch. */
  assert.equal(words.owner, "AUTHORITY");
  assert.match(words.text, /may only hunt .* in an area designated in this regulation for such a species, licence and equipment type/);
  assert.equal(words.owner === "AUTHORITY" && words.citation, "M.R. 165/91 s. 3");
});

/* ── Grouse: direct, whatever the licence ───────────────────────────────── */

test("a grouse hunter is asked nothing: every licence gives the same season", () => {
  const evaluation = evaluate(RUFFED, "2026-09-20", PLACES.gha26);
  assert.equal(evaluation.completeness, "RESOLVED");
  assert.equal(evaluation.result?.status, "CONDITIONAL");
  assert.deepEqual(evaluation.result?.season, { kind: "ABSOLUTE", opens: "2026-09-08", closes: "2027-01-01", datesInclusive: true });
  assert.deepEqual(evaluation.result?.limits, { daily: 6, possession: 12 });
});

test("zones 1 and 2 open on 1 September; zones 3 and 4 on 8 September", () => {
  assert.equal(status(evaluate(RUFFED, "2026-09-01", PLACES.gha1)), "CONDITIONAL");
  assert.equal(status(evaluate(RUFFED, "2026-09-07", PLACES.gha26)), "CLOSED");
  assert.equal(status(evaluate(RUFFED, "2026-09-08", PLACES.gha26)), "CONDITIONAL");
  assert.equal(status(evaluate(RUFFED, "2026-08-31", PLACES.gha1)), "CLOSED");
});

test("a season that crosses the year closes on 1 January 2027, inclusive", () => {
  assert.equal(status(evaluate(RUFFED, "2027-01-01", PLACES.gha26)), "CONDITIONAL");
  assert.equal(status(evaluate(RUFFED, "2027-01-02", PLACES.gha26)), "CLOSED");
});

test("in the zone 2/3 band the answer stands only where both zones agree", () => {
  const early = evaluate(RUFFED, "2026-09-05", PLACES.gha14Band);
  assert.equal(early.result?.status, "NEEDS_VERIFICATION");
  assert.ok(early.result?.limitations.some((line) => /line between game bird hunting zones 2 and 3/.test(line.text)));

  const later = evaluate(RUFFED, "2026-10-05", PLACES.gha14Band);
  assert.equal(later.result?.status, "CONDITIONAL");
  // Both possible seasons are named; the one shown is open in either zone.
  assert.match(later.result?.summary ?? "", /Sept\. 1 – Jan\. 1; or Open season, Sept\. 8 – Jan\. 1/);
  assert.deepEqual(later.result?.season, { kind: "ABSOLUTE", opens: "2026-09-08", closes: "2027-01-01", datesInclusive: true });
  assert.ok(later.result?.limitations.some((line) => /The answer is the same either way/.test(line.text)));
});

test("sharp-tailed grouse carry the reduced limit only in the areas the regulation names", () => {
  assert.deepEqual(evaluate(SHARP_TAILED, "2026-10-05", PLACES.gha30).result?.limits, { daily: 4, possession: 8 });
  assert.deepEqual(evaluate(SHARP_TAILED, "2026-10-05", PLACES.gha26).result?.limits, { daily: 6, possession: 12 });
});

test("CFB Shilo is carved out of the grouse season, and an unchecked boundary is not guessed", () => {
  assert.equal(status(evaluate(RUFFED, "2026-10-05", PLACES.gha30)), "CONDITIONAL");
  assert.equal(status(evaluate(RUFFED, "2026-10-05", at("30", 49.75, -99.5, [SHILO]))), "CLOSED");
  const unchecked = evaluate(RUFFED, "2026-10-05", at("30", 49.75, -99.5, null));
  assert.equal(unchecked.result?.status, "NEEDS_VERIFICATION");
  // Outside the base's proven extent, an unavailable overlay changes nothing.
  assert.equal(status(evaluate(RUFFED, "2026-10-05", at("30", 49.95, -100.1, null))), "CONDITIONAL");
});

test("the Oak Hammock control area has no polygon: near it the answer waits, far from it the answer stands", () => {
  assert.equal(status(evaluate(RUFFED, "2026-10-05", PLACES.gha25bNearOakHammock)), "NEEDS_VERIFICATION");
  assert.equal(status(evaluate(RUFFED, "2026-10-05", PLACES.gha25bFar)), "CONDITIONAL");
});

test("upland bird hunters are told to wear hunter orange only while the general deer season is open", () => {
  const during = evaluate(RUFFED, "2026-11-20", PLACES.gha26).result!;
  assert.ok(during.requirements.some((line) => /hunter orange/.test(line) && /s\. 10\(3\)/.test(line)));
  const before = evaluate(RUFFED, "2026-10-05", PLACES.gha26).result!;
  assert.ok(!before.requirements.some((line) => /hunter orange/.test(line)));
});

/* ── White-tailed deer: conditional ─────────────────────────────────────── */

test("where no licence designates an area, deer is closed there by s. 3", () => {
  const evaluation = evaluate(DEER, "2026-11-20", PLACES.gha1);
  assert.equal(evaluation.completeness, "RESOLVED");
  assert.equal(evaluation.result?.status, "CLOSED");
  assert.match(evaluation.result?.summary ?? "", /s\. 3/);
});

test("on a date no deer season is open, nothing is asked", () => {
  const evaluation = evaluate(DEER, "2026-07-01", PLACES.gha23a);
  assert.equal(evaluation.completeness, "RESOLVED");
  assert.equal(evaluation.result?.status, "CLOSED");
  assert.match(evaluation.result?.summary ?? "", /for any licence or equipment/);
});

test("a deer hunter is asked residency, then licence, then equipment — and only while it matters", () => {
  assert.equal(status(evaluate(DEER, "2026-10-14", PLACES.gha23a)), "ASK RESIDENCY");
  const licence = evaluate(DEER, "2026-10-14", PLACES.gha23a, { RESIDENCY: "MANITOBA_RESIDENT" });
  assert.equal(status(licence), "ASK LICENCE_TYPE");
  // Every Manitoba resident deer licence is offered, including the third, which
  // is not designated in GHA 23A: holding only that one here is a closed answer.
  assert.deepEqual(licence.required?.options.map((option) => option.value), ["MB_RESIDENT_GENERAL_WTD", "MB_RESIDENT_SECOND_WTD", "MB_RESIDENT_THIRD_WTD"]);
  const third = evaluate(DEER, "2026-10-14", PLACES.gha23a, { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_THIRD_WTD" });
  assert.equal(third.result?.status, "CLOSED");
  assert.match(third.result?.summary ?? "", /matching what you described authorises/);
  const method = evaluate(DEER, "2026-10-14", PLACES.gha23a, { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_GENERAL_WTD" });
  assert.equal(status(method), "ASK HUNT_METHOD");
  assert.equal(method.required?.options.find((option) => option.value === "BOW")?.detail, "Long, recurved or compound bow");
});

test("the youth muzzleloader week asks age, and only then", () => {
  const base = { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_GENERAL_WTD", HUNT_METHOD: "MUZZLELOADER" };
  assert.equal(status(evaluate(DEER, "2026-10-14", PLACES.gha23a, base)), "ASK HUNTER_AGE");
  assert.equal(status(evaluate(DEER, "2026-10-14", PLACES.gha23a, { ...base, HUNTER_AGE: "UNDER_18" })), "CONDITIONAL");
  assert.equal(status(evaluate(DEER, "2026-10-14", PLACES.gha23a, { ...base, HUNTER_AGE: "ADULT" })), "CLOSED");
  // From 19 October every muzzleloader hunter has the season, so age is not asked.
  assert.equal(status(evaluate(DEER, "2026-10-20", PLACES.gha23a, base)), "CONDITIONAL");
});

test("a crossbow is not archery: it is closed in an archery-only window", () => {
  const answers = { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_GENERAL_WTD" };
  assert.equal(status(evaluate(DEER, "2026-09-10", PLACES.gha23a, { ...answers, HUNT_METHOD: "BOW" })), "CONDITIONAL");
  assert.equal(status(evaluate(DEER, "2026-09-10", PLACES.gha23a, { ...answers, HUNT_METHOD: "CROSSBOW" })), "CLOSED");
});

test("in zone A the all-equipment season also runs 21 September to 18 October, with the moose-licence condition", () => {
  const answers = { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_GENERAL_WTD", HUNT_METHOD: "RIFLE" };
  const evaluation = evaluate(DEER, "2026-10-01", PLACES.gha7, answers);
  assert.equal(evaluation.result?.status, "CONDITIONAL");
  assert.deepEqual(evaluation.result?.season, { kind: "ABSOLUTE", opens: "2026-09-21", closes: "2026-10-18", datesInclusive: true });
  assert.ok(evaluation.result?.requirements.some((line) => /draw general moose licence/.test(line) && /10\.3\(a\)/.test(line)));
  // No moose season runs 9-29 November in GHA 7, so the condition is not stated then.
  const november = evaluate(DEER, "2026-11-20", PLACES.gha7, answers).result!;
  assert.ok(!november.requirements.some((line) => /moose/.test(line)));
});

test("in GHAs 13 and 18 a deer hunter during an elk season is told of the elk-licence condition", () => {
  const answers = { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_GENERAL_WTD", HUNT_METHOD: "BOW" };
  const evaluation = evaluate(DEER, "2026-09-05", PLACES.gha13, answers).result!;
  assert.equal(evaluation.status, "CONDITIONAL");
  assert.ok(evaluation.requirements.some((line) => /draw archery elk licence/.test(line) && /10\.3\(b\)/.test(line)));
});

test("CWD sampling is required in the surveillance zone and not outside it", () => {
  const answers = { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_GENERAL_WTD", HUNT_METHOD: "RIFLE" };
  assert.ok(evaluate(DEER, "2026-11-20", PLACES.gha23a, answers).result!.requirements.some((line) => /CWD mandatory surveillance zone/.test(line)));
  assert.ok(!evaluate(DEER, "2026-11-20", PLACES.gha26, answers).result!.requirements.some((line) => /CWD/.test(line)));
});

test("a second licence is antlerless-only and conditional on the general licence", () => {
  const evaluation = evaluate(DEER, "2026-11-20", PLACES.gha23a, { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_SECOND_WTD", HUNT_METHOD: "RIFLE" }).result!;
  assert.equal(evaluation.status, "CONDITIONAL");
  assert.ok(evaluation.requirements.some((line) => /one antlerless white-tailed deer/.test(line)));
  assert.ok(evaluation.requirements.some((line) => /also hold a Manitoba resident general white-tailed deer licence/.test(line)));
});

test("a non-Canadian resident is not asked for a licence where only one could apply", () => {
  // In GHA 22 only the non-Canadian archery licence is designated, and its
  // season ended on 8 November.
  const evaluation = evaluate(DEER, "2026-11-20", PLACES.gha22, { RESIDENCY: "NON_CANADIAN_RESIDENT" });
  assert.equal(evaluation.completeness, "RESOLVED");
  assert.equal(evaluation.result?.status, "CLOSED");
});

test("GHA 7A under a non-Canadian archery licence is a conflict North Ground will not resolve", () => {
  const evaluation = evaluate(DEER, "2026-10-15", PLACES.gha7a, { RESIDENCY: "NON_CANADIAN_RESIDENT", LICENCE_TYPE: "NON_CANADIAN_ARCHERY_WTD", HUNT_METHOD: "BOW" });
  assert.equal(evaluation.result?.status, "CONFLICT");
  assert.ok(evaluation.result?.limitations.some((line) => /range "5-8"/.test(line.text) && /guide lists no/.test(line.text)));
  // A Manitoba resident's licences do not reach 7A at all: that is closed, not a conflict.
  assert.equal(status(evaluate(DEER, "2026-10-15", PLACES.gha7a, { RESIDENCY: "MANITOBA_RESIDENT" })), "CLOSED");
});

test("where the regulation and the guide differ, the regulation governs and the difference is disclosed", () => {
  const canadian = evaluate(DEER, "2026-12-05", PLACES.gha33, { RESIDENCY: "CANADIAN_RESIDENT", HUNT_METHOD: "BOW" }).result!;
  assert.equal(canadian.status, "CLOSED");
  assert.ok(canadian.limitations.some((line) => /2026 guide shows 2026-08-31 to 2026-12-20/.test(line.text) && /regulation, which controls/.test(line.text)));
  const resident = evaluate(DEER, "2026-12-05", PLACES.gha33, { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_GENERAL_WTD", HUNT_METHOD: "BOW" }).result!;
  assert.equal(resident.status, "CONDITIONAL");
});

test("the Macdonald part of GHA 38 is its own geography", () => {
  const answers = { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_GENERAL_WTD", HUNT_METHOD: "BOW" };
  assert.equal(status(evaluate(DEER, "2026-10-01", at("38", 49.79, -97.27, [MACDONALD]), answers)), "CONDITIONAL");
  assert.equal(status(evaluate(DEER, "2026-10-01", at("38", 49.79, -97.27, []), answers)), "CLOSED");
  assert.equal(status(evaluate(DEER, "2026-10-01", at("38", 49.79, -97.27, null), answers)), "NEEDS_VERIFICATION");
});

test("the Whiteshell Game Bird Refuge is excluded from the GHA 36 deer seasons", () => {
  const answers = { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_GENERAL_WTD", HUNT_METHOD: "BOW" };
  assert.equal(status(evaluate(DEER, "2026-10-01", PLACES.gha36, answers)), "CONDITIONAL");
  assert.equal(status(evaluate(DEER, "2026-10-01", at("36", 49.84, -95.53, [WHITESHELL]), answers)), "CLOSED");
});

/* ── Untrusted answers, and the edges of what is certified ─────────────── */

test("an answer the question does not offer leaves it open, never narrowing into a closure", () => {
  assert.equal(status(evaluate(DEER, "2026-11-20", PLACES.gha23a, { RESIDENCY: "DEFINITELY_A_RESIDENT" })), "ASK RESIDENCY");
  assert.equal(
    status(evaluate(DEER, "2026-11-20", PLACES.gha23a, { RESIDENCY: "NON_CANADIAN_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_GENERAL_WTD" })),
    "ASK LICENCE_TYPE",
  );
  // On 10 September only archery is open in GHA 7, so the method decides it.
  const bazooka = evaluate(DEER, "2026-09-10", PLACES.gha7, { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_GENERAL_WTD", HUNT_METHOD: "BAZOOKA" });
  assert.equal(bazooka.completeness, "NEEDS_INPUT");
  assert.equal(bazooka.required?.id, "HUNT_METHOD");
  // Where every method is open, an unreadable one changes nothing and is not needed.
  const anyMethod = evaluate(DEER, "2026-10-01", PLACES.gha7, { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_GENERAL_WTD", HUNT_METHOD: "BAZOOKA" });
  assert.equal(anyMethod.result?.status, "CONDITIONAL");
});

test("outside the certified period the answer is not closed, it is uncertified", () => {
  for (const date of ["2026-06-15", "2027-04-01"]) {
    const evaluation = evaluate(RUFFED, date, PLACES.gha26);
    assert.equal(evaluation.result?.status, "NEEDS_VERIFICATION");
    assert.match(evaluation.result?.summary ?? "", /outside that period/);
  }
});

test("a published restriction at the point stops a CONDITIONAL answer", () => {
  const evaluation = evaluateManitoba({
    speciesId: RUFFED, speciesName: "ruffed grouse", date: "2026-10-05", place: PLACES.gha26, answers: {},
    restrictions: [{
      name: "Example Game Bird Refuge",
      words: quoting(
        "No person shall hunt ... a game bird",
        "source:ca-mb-wildlife-lands-service" as CanonicalId<"source">,
        "Wildlife Lands service",
        "en-CA",
      ),
      sourceId: "source:ca-mb-wildlife-lands-service",
    }],
  });
  assert.equal(evaluation.result?.status, "NEEDS_VERIFICATION");
  const line = evaluation.result?.limitations[0];
  assert.equal(line?.label, "Example Game Bird Refuge", "the refuge is named beside the quotation");
  assert.equal(line?.text, "No person shall hunt ... a game bird", "and the quotation is the authority's words alone");
  assert.ok(line && limitationText(line).startsWith("Example Game Bird Refuge: « No person shall hunt"));
});

test("a species Manitoba's bundle does not certify is unknown, not closed", () => {
  /* Caribou (Schedule E) is not encoded. */
  const evaluation = evaluate("species:caribou", "2026-10-01", PLACES.gha7);
  assert.equal(evaluation.result?.status, "UNKNOWN");
  assert.match(evaluation.result?.summary ?? "", /gap in North Ground's coverage/);
});

/* ── Mule deer, elk, moose and black bear ───────────────────────────────── */

const gha9 = at("9", 56.0, -98.5);
const gha9a = (overlays: string[] = []) => at("9A", 54.9, -97.4, overlays);
const gha21a = (overlays: string[] = []) => at("21A", 51.1, -96.7, overlays);
const gha29 = (overlays: string[] = []) => at("29", 49.05, -99.95, overlays); // inside the pasture's extent
const gha23 = at("23", 50.9, -100.3);
const gha2 = at("2", 57.5, -95.5);
const gha34a = at("34A", 49.9, -96.9);
const gha5 = at("5", 54.3, -101.6);

test("a Manitoba resident general moose licence opens GHA 9 from 21 September to 18 October, for one male moose", () => {
  const answers = { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_GENERAL_MOOSE", HUNT_METHOD: "RIFLE" };
  const result = evaluate(MOOSE, "2026-10-01", gha9, answers).result!;
  assert.equal(result.status, "CONDITIONAL");
  assert.deepEqual(result.season, { kind: "ABSOLUTE", opens: "2026-09-21", closes: "2026-10-18", datesInclusive: true });
  assert.ok(result.requirements.some((line) => /1 male moose/.test(line)));
  // Between the two GHA 9 seasons (19 October to 29 November) there is none.
  assert.equal(status(evaluate(MOOSE, "2026-11-10", gha9, answers)), "CLOSED");
});

test("moose hunting is closed in GHA 13, where Schedule D lists no season", () => {
  assert.equal(status(evaluate(MOOSE, "2026-10-01", PLACES.gha13, { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_GENERAL_MOOSE", HUNT_METHOD: "RIFLE" })), "CLOSED");
});

test("an archery moose licence opens GHA 9A outside the Cross Lake portion only, and only to a bow", () => {
  const answers = { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_ARCHERY_MOOSE" };
  assert.equal(status(evaluate(MOOSE, "2026-09-05", gha9a(), { ...answers, HUNT_METHOD: "BOW" })), "CONDITIONAL");
  assert.equal(status(evaluate(MOOSE, "2026-09-05", gha9a([GHA9A_MOOSE_ZONE]), { ...answers, HUNT_METHOD: "BOW" })), "CLOSED");
  assert.equal(status(evaluate(MOOSE, "2026-09-05", gha9a(), { ...answers, HUNT_METHOD: "RIFLE" })), "CLOSED");
});

test("an elk licence for GHA 23 also opens male moose there, one animal in all (s. 16)", () => {
  const result = evaluate(MOOSE, "2026-12-01", gha23, { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_DRAW_GENERAL_ELK", HUNT_METHOD: "RIFLE" }).result!;
  assert.equal(result.status, "CONDITIONAL");
  assert.ok(result.requirements.some((line) => /one elk or one male moose/.test(line)));
  assert.ok(result.requirements.some((line) => /big game draw/.test(line)));
});

test("a draw general elk licence takes a male elk in October and any elk in December in GHA 13", () => {
  const answers = { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_DRAW_GENERAL_ELK", HUNT_METHOD: "RIFLE" };
  const october = evaluate(ELK, "2026-10-10", PLACES.gha13, answers).result!;
  assert.equal(october.status, "CONDITIONAL");
  assert.ok(october.requirements.some((line) => /1 male elk/.test(line)));
  const december = evaluate(ELK, "2026-12-15", PLACES.gha13, answers).result!;
  assert.equal(december.status, "CONDITIONAL");
  assert.ok(december.requirements.some((line) => /\b1 elk\b/.test(line)));
  assert.equal(status(evaluate(ELK, "2026-11-10", PLACES.gha13, answers)), "CLOSED");
});

test("the Turtle Mountain Community Pasture is excluded from the fall draw general elk season only", () => {
  const general = { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_DRAW_GENERAL_ELK", HUNT_METHOD: "RIFLE" };
  assert.equal(status(evaluate(ELK, "2026-10-01", gha29([TURTLE_MOUNTAIN_PASTURE]), general)), "CLOSED");
  assert.equal(status(evaluate(ELK, "2026-10-01", gha29(), general)), "CONDITIONAL");
  // The December season and the archery season carry no such exclusion.
  assert.equal(status(evaluate(ELK, "2026-12-15", gha29([TURTLE_MOUNTAIN_PASTURE]), general)), "CONDITIONAL");
  assert.equal(status(evaluate(ELK, "2026-09-05", gha29([TURTLE_MOUNTAIN_PASTURE]), { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_DRAW_ARCHERY_ELK", HUNT_METHOD: "BOW" })), "CONDITIONAL");
});

test("black bear: Hecla Island is excluded from GHA 21A, and the female-with-cub rule is stated", () => {
  const answers = { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_GENERAL_BLACK_BEAR", HUNT_METHOD: "RIFLE" };
  const open = evaluate(BEAR, "2026-09-01", gha21a(), answers).result!;
  assert.equal(open.status, "CONDITIONAL");
  assert.ok(open.requirements.some((line) => /female bear accompanied by a cub/.test(line)));
  assert.ok(open.requirements.some((line) => /hunter orange/.test(line)));
  assert.equal(status(evaluate(BEAR, "2026-09-01", gha21a([HECLA]), answers)), "CLOSED");
});

test("black bear: GHA 2 is closed to non-Canadian residents and GHA 34A is archery for Manitoba residents only", () => {
  assert.equal(status(evaluate(BEAR, "2026-09-01", gha2, { RESIDENCY: "NON_CANADIAN_RESIDENT", LICENCE_TYPE: "NON_CANADIAN_GENERAL_BLACK_BEAR", HUNT_METHOD: "RIFLE" })), "CLOSED");
  assert.equal(status(evaluate(BEAR, "2026-09-01", gha2, { RESIDENCY: "CANADIAN_RESIDENT", LICENCE_TYPE: "CANADIAN_RESIDENT_GENERAL_BLACK_BEAR", HUNT_METHOD: "RIFLE" })), "CONDITIONAL");
  assert.equal(status(evaluate(BEAR, "2026-09-01", gha34a, { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_GENERAL_BLACK_BEAR", HUNT_METHOD: "BOW" })), "CONDITIONAL");
  assert.equal(status(evaluate(BEAR, "2026-09-01", gha34a, { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_GENERAL_BLACK_BEAR", HUNT_METHOD: "RIFLE" })), "CLOSED");
  assert.equal(status(evaluate(BEAR, "2026-09-01", gha34a, { RESIDENCY: "CANADIAN_RESIDENT", LICENCE_TYPE: "CANADIAN_RESIDENT_GENERAL_BLACK_BEAR", HUNT_METHOD: "BOW" })), "CLOSED");
});

test("black bear hunters are exempt from hunter orange until 30 June", () => {
  const spring = evaluate(BEAR, "2026-06-20", gha9, { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_GENERAL_BLACK_BEAR", HUNT_METHOD: "RIFLE" }).result!;
  assert.equal(spring.status, "CONDITIONAL");
  assert.ok(!spring.requirements.some((line) => /hunter orange/.test(line)));
});

test("mule deer: a general licence in GHA 5 during the moose season carries the draw moose licence condition (s. 11.4)", () => {
  const result = evaluate(MULE_DEER, "2026-10-01", gha5, { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_GENERAL_MULE_DEER", HUNT_METHOD: "RIFLE" }).result!;
  assert.equal(result.status, "CONDITIONAL");
  assert.ok(result.requirements.some((line) => /must not hunt mule deer here during a moose season/.test(line)));
  assert.ok(result.requirements.some((line) => /CWD mandatory surveillance zone/.test(line)));
});

test("mule deer: GHA 33 opens a shotgun and muzzleloader season, not a rifle one", () => {
  const answers = { RESIDENCY: "MANITOBA_RESIDENT", LICENCE_TYPE: "MB_RESIDENT_GENERAL_MULE_DEER" };
  assert.equal(status(evaluate(MULE_DEER, "2026-10-01", PLACES.gha33, { ...answers, HUNT_METHOD: "SHOTGUN" })), "CONDITIONAL");
  assert.equal(status(evaluate(MULE_DEER, "2026-10-01", PLACES.gha33, { ...answers, HUNT_METHOD: "RIFLE" })), "CLOSED");
});

test("the big game tables agree with the 2026 guide everywhere", () => {
  const bigGame = ["mule-deer", "elk", "moose", "american-black-bear"];
  assert.deepEqual((MANITOBA_BUNDLE.crossCheck.regulationControls as { table: string }[]).filter((finding) => bigGame.includes(finding.table)), []);
  assert.deepEqual((MANITOBA_BUNDLE.crossCheck.disputes as { table: string }[]).filter((finding) => bigGame.includes(finding.table)), []);
});

/* ── Coverage ───────────────────────────────────────────────────────────── */

test("coverage is computed from the rules: grouse everywhere, deer only where designated", () => {
  const report = manitobaCoverageReport();
  const row = (id: string) => report.species.find((entry) => entry.speciesId === id)!;
  assert.equal(row(RUFFED).unitsReached, 62);
  assert.equal(row(RUFFED).requiresInput, false);
  assert.equal(row(DEER).requiresInput, true);
  assert.equal(row(DEER).unitsReached + row(DEER).unitsClosedByAbsence, 62);
  assert.equal(row(DEER).unitsUnknown, 0);
  assert.equal(report.disputes, 2);
});

test("Manitoba's GIS services carry the OpenMB attribution; the regulations do not", async () => {
  const { manitobaSourceRecords } = await import("./manitoba.ts");
  const [gha, regulation] = manitobaSourceRecords(["source:ca-mb-gha-service", "source:ca-mb-hunting-seasons-regulation"])
    .sort((a, b) => a.id.localeCompare(b.id));
  assert.equal(gha.licence, "OpenMB Information and Data Use Licence");
  assert.match(gha.attribution ?? "", /^Contains information from the Manitoba government, licensed under the OpenMB/);
  assert.equal(regulation.attribution, undefined);
});
