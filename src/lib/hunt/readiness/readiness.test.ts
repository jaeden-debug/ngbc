import { legalTimeNotCertified } from "../regulatory/legal-time.ts";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CanonicalId } from "../../content-contract/index.ts";
import type { RegulatoryResult, ZoneResolution } from "../types.ts";
import { resolveReadiness } from "./index.ts";
import { ontarioOrange, resolveOntarioReadiness } from "./ontario.ts";
import { matchCondition, priceState, resolveAuthorizations } from "./resolve.ts";
import type { AuthorizationRecord, Price } from "./types.ts";
import bundle from "../../../../content/regulatory/readiness/ca-on-2026.json" with { type: "json" };

/**
 * Ready to Hunt, exercised against Ontario's generated data.
 *
 * The cases are chosen from the law, not from the code: each is a day and a
 * place where a plausible simplification gives a hunter the wrong answer.
 */

const NOW = new Date("2026-09-21T15:00:00Z");
const GROUSE = "species:ruffed-grouse";
const DEER = "species:white-tailed-deer";
const BEAR = "species:american-black-bear";
const TURKEY = "species:wild-turkey";
const MOOSE = "species:moose";
const wmu = (unit: string) => `management_zone:ca-on-wmu-${unit.toLowerCase()}`;
const ready = (speciesId: string, unit: string, date: string, answers: Record<string, string> = {}) =>
  resolveOntarioReadiness({ speciesId, date, zoneId: wmu(unit), answers }, NOW);
const item = (result: ReturnType<typeof ready>, id: string) => result.authorizations.find((entry) => entry.id === id);

/* ── Authorizations compose from the law ─────────────────────────────────── */

describe("what a hunt requires", () => {
  it("requires an Outdoors Card for every hunt, because no licence can be issued without one", () => {
    for (const species of [GROUSE, DEER, BEAR, TURKEY, MOOSE]) {
      assert.equal(item(ready(species, "60", "2026-10-15", { RESIDENCY: "RESIDENT" }), "authorization:ca-on-outdoors-card")?.status, "REQUIRED");
    }
  });

  it("names the hunter education course as the Outdoors Card's prerequisite, once", () => {
    const card = item(ready(GROUSE, "60", "2026-10-15"), "authorization:ca-on-outdoors-card")!;
    assert.deepEqual(card.prerequisites.map((entry) => entry.officialName), ["Ontario Hunter Education Course"]);
    // The small game licence needs an Outdoors Card, but that is already its own
    // line, so saying so again would only lengthen the list.
    assert.deepEqual(item(ready(GROUSE, "60", "2026-10-15"), "authorization:ca-on-small-game-licence")!.prerequisites, []);
  });

  it("composes turkey as a small game licence AND a turkey tag, as s. 28(4) does", () => {
    // The fee schedule lists a turkey tag alone; the law says a turkey licence
    // is the small game licence together with the tag. A beginner reading only
    // the fee list would buy the tag and hunt illegally.
    const ids = ready(TURKEY, "60", "2026-04-30", { HUNT_METHOD: "SHOTGUN" }).authorizations.map((entry) => entry.id);
    assert.ok(ids.includes("authorization:ca-on-small-game-licence"));
    assert.ok(ids.includes("authorization:ca-on-wild-turkey-tag"));
  });

  it("requires the bear validation certificate of a non-resident and not of a resident", () => {
    const certificate = "authorization:ca-on-bear-hunting-validation-certificate";
    assert.equal(item(ready(BEAR, "60", "2026-09-15", { RESIDENCY: "NON_RESIDENT" }), certificate)?.status, "REQUIRED");
    assert.equal(item(ready(BEAR, "60", "2026-09-15", { RESIDENCY: "RESIDENT" }), certificate), undefined);
  });

  it("says a moose tag is required unless the hunter is in a party with a tag holder", () => {
    const tag = item(ready(MOOSE, "46", "2026-10-22", { RESIDENCY: "RESIDENT", TAG_TYPE: "GUN" }), "authorization:ca-on-moose-tag")!;
    assert.equal(tag.status, "CONDITIONAL");
    assert.match(tag.conditionText!, /party/);
    assert.equal(tag.draw?.required, true, "a moose tag comes from the draw, not the counter");
  });

  it("carries the non-resident deer restriction to antlered deer", () => {
    const licence = item(ready(DEER, "60", "2026-11-05", { RESIDENCY: "NON_RESIDENT", HUNT_METHOD: "SHOTGUN" }), "authorization:ca-on-deer-licence")!;
    assert.match(licence.note ?? "", /only antlered deer/);
  });
});

describe("federal and provincial requirements together", () => {
  it("adds the federal firearms licence to Ontario's licences for a gun hunter", () => {
    const result = ready(DEER, "60", "2026-11-05", { RESIDENCY: "RESIDENT", HUNT_METHOD: "SHOTGUN" });
    const firearms = item(result, "authorization:ca-federal-firearms-licence")!;
    assert.equal(firearms.status, "REQUIRED");
    assert.equal(firearms.authority, "Canadian Firearms Program (RCMP)");
    assert.ok(item(result, "authorization:ca-on-deer-licence"), "the provincial licence is still required alongside it");
  });

  it("drops the firearms licence for a bow hunter, who the law exempts", () => {
    assert.equal(item(ready(DEER, "60", "2026-10-15", { RESIDENCY: "RESIDENT", HUNT_METHOD: "BOW" }), "authorization:ca-federal-firearms-licence"), undefined);
  });

  it("asks nothing extra about a small-game hunter's method: it says when the licence applies", () => {
    // Small game never asks for the implement, and the firearms licence is not
    // a reason to start: it is shown as conditional, with the condition in words.
    const firearms = item(ready(GROUSE, "60", "2026-10-15"), "authorization:ca-federal-firearms-licence")!;
    assert.equal(firearms.status, "CONDITIONAL");
    assert.match(firearms.conditionText!, /gun/);
    assert.match(firearms.conditionText!, /bow/);
  });

  it("keeps an unencoded authorization as a required line rather than dropping it", () => {
    const [entry] = resolveAuthorizations(
      [{ authorizationId: "authorization:us-co-elk-license", provenance: [] }],
      new Map(),
      { answers: {}, licenceYearToday: 2026 },
    );
    assert.equal(entry.status, "UNKNOWN");
    assert.match(entry.officialName, /not yet described/);
    assert.equal(entry.price.kind, "CHECK_OFFICIAL");
  });
});

/* ── Prices ──────────────────────────────────────────────────────────────── */

describe("prices", () => {
  it("shows resident and non-resident fees apart, never together", () => {
    const resident = item(ready(DEER, "60", "2026-11-05", { RESIDENCY: "RESIDENT", HUNT_METHOD: "SHOTGUN" }), "authorization:ca-on-deer-licence")!;
    const nonResident = item(ready(DEER, "60", "2026-11-05", { RESIDENCY: "NON_RESIDENT", HUNT_METHOD: "SHOTGUN" }), "authorization:ca-on-deer-licence")!;
    assert.equal(resident.price.kind, "VERIFIED");
    assert.equal(nonResident.price.kind, "VERIFIED");
    const amounts = (entry: typeof resident) => entry.price.kind === "VERIFIED" ? entry.price.prices.map((price) => price.amount) : [];
    assert.deepEqual(amounts(resident), [43.86]);
    assert.deepEqual(amounts(nonResident), [240.81]);
  });

  it("asks for the category, and shows no figure, when fees differ by residency and nobody has said", () => {
    const licence = item(ready(GROUSE, "60", "2026-10-15"), "authorization:ca-on-small-game-licence")!;
    assert.deepEqual(licence.price, { kind: "NEEDS_CATEGORY", dimension: "RESIDENCY" });
  });

  it("shows a fee that does not depend on residency without asking", () => {
    const card = item(ready(GROUSE, "60", "2026-10-15"), "authorization:ca-on-outdoors-card")!;
    assert.equal(card.price.kind, "VERIFIED");
  });

  it("keeps the published figure before tax and says tax is added", () => {
    const card = item(ready(GROUSE, "60", "2026-10-15"), "authorization:ca-on-outdoors-card")!;
    assert.ok(card.price.kind === "VERIFIED");
    assert.equal(card.price.prices[0].amount, 8.57);
    assert.equal(card.price.prices[0].taxNote, "+ 13% HST");
  });

  it("picks the turkey tag for the season the hunt date falls in, without asking", () => {
    const spring = item(ready(TURKEY, "60", "2026-04-30", { RESIDENCY: "RESIDENT", HUNT_METHOD: "SHOTGUN" }), "authorization:ca-on-wild-turkey-tag")!;
    const fall = item(ready(TURKEY, "60", "2026-10-20", { RESIDENCY: "RESIDENT", HUNT_METHOD: "SHOTGUN" }), "authorization:ca-on-wild-turkey-tag")!;
    assert.ok(spring.price.kind === "VERIFIED" && fall.price.kind === "VERIFIED");
    assert.deepEqual(spring.price.prices.map((price) => price.variant), ["spring"]);
    assert.deepEqual(fall.price.prices.map((price) => price.variant), ["fall"]);
  });

  it("does not present a fee from another licence year as current", () => {
    const record = (bundle.authorizations as unknown as AuthorizationRecord[]).find((entry) => entry.id === "authorization:ca-on-outdoors-card")!;
    const lastYear: AuthorizationRecord = { ...record, prices: record.prices.map((price: Price) => ({ ...price, licenceYear: 2025 })) };
    const state = priceState(lastYear, { answers: {}, licenceYearToday: 2026 });
    assert.equal(state.kind, "CHECK_OFFICIAL");
    assert.ok(state.kind === "CHECK_OFFICIAL" && /2025/.test(state.reason));
  });

  it("says to check the official fee where none was read, rather than inventing one", () => {
    const certificate = item(ready(BEAR, "60", "2026-09-15", { RESIDENCY: "NON_RESIDENT", HUNT_METHOD: "RIFLE" }), "authorization:ca-on-bear-hunting-validation-certificate")!;
    assert.equal(certificate.price.kind, "CHECK_OFFICIAL");
  });

  it("turns over with the licence year in Ontario's calendar, not UTC's", () => {
    // 04:30 UTC on 1 January 2027 is still 31 December 2026 in Ontario.
    const newYearsEve = resolveOntarioReadiness(
      { speciesId: GROUSE, date: "2026-10-15", zoneId: wmu("60"), answers: {} },
      new Date("2027-01-01T04:30:00Z"),
    );
    assert.equal(item(newYearsEve, "authorization:ca-on-outdoors-card")!.price.kind, "VERIFIED");
    const newYear = resolveOntarioReadiness(
      { speciesId: GROUSE, date: "2026-10-15", zoneId: wmu("60"), answers: {} },
      new Date("2027-01-01T05:30:00Z"),
    );
    assert.equal(item(newYear, "authorization:ca-on-outdoors-card")!.price.kind, "CHECK_OFFICIAL");
  });
});

/* ── Hunter orange, O. Reg. 665/98 s. 26 ─────────────────────────────────── */

describe("hunter orange", () => {
  it("requires it of a grouse hunter because the elk season is open", () => {
    // 21 September, WMU 60: the elk season opens today. Nothing about grouse
    // requires orange; the elk season does, for every hunter in the unit.
    const orange = ontarioOrange(GROUSE, wmu("60"), "2026-09-21");
    assert.equal(orange.status, "REQUIRED");
    assert.match(orange.summary, /elk/);
  });

  it("requires it during a muzzle-loader season, which the summary's 'gun season' obscures", () => {
    // s. 26(1)(a) exempts only seasons "restricted to the use of bows only".
    // WMU 60's deer muzzle-loader season runs 30 November to 6 December.
    assert.equal(ontarioOrange(GROUSE, wmu("60"), "2026-12-02").status, "REQUIRED");
  });

  it("does not require it during a bows-only deer season when nothing else is open", () => {
    // 10 October, WMU 60: deer archery and bear are open; elk has closed.
    assert.equal(ontarioOrange(GROUSE, wmu("60"), "2026-10-10").status, "NOT_REQUIRED");
  });

  it("exempts a small-game hunter from the bear-season requirement, as s. 26(4)(a) does", () => {
    const orange = ontarioOrange(GROUSE, wmu("60"), "2026-10-10");
    assert.match(orange.summary, /small-game hunters are exempt during bear season/);
  });

  it("makes a bear hunter's orange conditional on the tree-stand exception", () => {
    const orange = ontarioOrange(BEAR, wmu("60"), "2026-09-15");
    assert.equal(orange.status, "CONDITIONAL");
    assert.deepEqual(orange.exceptions, ["While in a tree stand hunting bear."]);
  });

  it("gives the tree-stand exception no force while a deer gun season is open", () => {
    // The exception is to s. 26(1)(b) only. During a gun season for deer,
    // s. 26(1)(a) applies to the bear hunter in the tree stand too.
    const orange = ontarioOrange(BEAR, wmu("60"), "2026-11-05");
    assert.equal(orange.status, "REQUIRED");
    assert.deepEqual(orange.exceptions, []);
  });

  it("counts a controlled deer hunt, which is not certified as a hunt but is an open season", () => {
    // WMU 53B's controlled deer hunt (code 300) runs 2 to 8 November.
    const controlled = bundle.overlappingSeasons.find((season) => season.huntCode === "300")!;
    assert.ok(controlled.zoneIds.includes(wmu("53B")));
    const orange = ontarioOrange(GROUSE, wmu("53B"), "2026-11-04");
    assert.equal(orange.status, "REQUIRED");
    // The only general season open in 53B that day is bear, which exempts a
    // small-game hunter. The controlled hunt is the whole reason — so the
    // answer must say so, or this test could pass for some other reason.
    assert.match(orange.summary, /controlled deer hunt \(hunt code 300\)/);
  });

  it("states the minimum garment the law sets, not just 'wear orange'", () => {
    const orange = ontarioOrange(GROUSE, wmu("60"), "2026-09-21");
    assert.match(orange.specification!, /400 square inches/);
    assert.match(orange.specification!, /head cover/);
    assert.match(orange.specification!, /visible from all sides/);
    assert.match(orange.specification!, /Camouflage orange does not count/);
  });

  it("says it cannot tell, rather than 'not required', outside the certified period", () => {
    // February 2027: the 2026 deer summary no longer speaks for the date.
    assert.equal(ontarioOrange("species:snowshoe-hare", wmu("60"), "2027-02-15").status, "CONDITIONAL");
  });

  it("cites the law for every orange answer", () => {
    for (const date of ["2026-09-21", "2026-10-10", "2026-12-02"]) {
      const orange = ontarioOrange(GROUSE, wmu("60"), date);
      assert.ok(orange.provenance.length > 0);
      assert.ok(orange.provenance.every((entry) => entry.tier === "LAW" && /O\. Reg\. 665\/98 s\. 26/.test(entry.citation)));
    }
  });
});

/* ── Legal methods versus North Ground's advice ──────────────────────────── */

describe("legal methods and recommendations stay apart", () => {
  it("lists only what the law allows on this hunt, and names what it rules out", () => {
    // WMU 71: footnote 1 removes rifles from the deer gun season.
    const methods = ready(DEER, "71", "2026-11-10", { RESIDENCY: "RESIDENT", HUNT_METHOD: "SHOTGUN" }).methods!;
    assert.ok(!methods.allowed.some((entry) => entry.method === "RIFLE"));
    const rifle = methods.notAllowed.find((entry) => entry.method === "RIFLE");
    assert.ok(rifle, "WMU 71 rules rifles out of the deer gun season");
    // And it must be ruled out BY A SOURCE, not by our silence: this is the
    // only thing separating it from the case below.
    assert.equal(rifle.status, "PROHIBITED");
    assert.ok(rifle.provenance.length > 0, "a prohibition shown to a hunter carries the law that imposes it");
  });

  it("never turns 'North Ground has no rule' into 'the law prohibits it'", () => {
    /* Ontario's bundle holds no deer rules for WMU 1A and no moose rules for
       WMU 10. Before this was fixed, both answered "Not allowed: Rifle,
       Shotgun, Muzzleloader, Bow" — four legal prohibitions asserted to a
       hunter, with no source behind any of them, because the code took the
       complement of a hardcoded method list.

       A wrongly-open answer is caught in the field by a hunter who checks. A
       wrongly-closed one is never caught, because nobody complains about being
       told no. So absence of knowledge must never render as prohibition. */
    for (const [species, unit, date] of [[DEER, "1A", "2026-11-10"], [MOOSE, "10", "2026-10-15"]] as const) {
      const methods = ready(species, unit, date).methods!;
      assert.deepEqual(
        methods.notAllowed.map((entry) => entry.method), [],
        `${species} in WMU ${unit}: nothing is prohibited on our say-so`,
      );
    }
  });

  it("keeps a prohibition the summary states outright, even for a method it never lists as allowed", () => {
    /* Ontario's turkey table names the rifle as not permitted (O. Reg. 665/98
       s. 79(1)) and never lists it among allowed methods. A fix that walked
       only the allowed methods would drop it silently — losing a real,
       sourced prohibition while tidying away the invented ones. */
    const rifle = ready(TURKEY, "60", "2026-04-30").methods!.notAllowed.find((entry) => entry.method === "RIFLE");
    assert.ok(rifle, "the turkey summary rules out rifles and that must survive");
    assert.equal(rifle.status, "PROHIBITED");
    assert.ok(rifle.provenance.some((source) => source.citation.includes("665/98")), "cited to the regulation that says so");
  });

  it("gives every prohibition a source, always", () => {
    /* The property, not the instance: whatever the hunt, a NOT-ALLOWED line
       either carries the law behind it or does not appear. */
    const hunts = [
      [DEER, "71", "2026-11-10"], [DEER, "60", "2026-11-10"], [DEER, "1A", "2026-11-10"],
      [TURKEY, "60", "2026-04-30"], [MOOSE, "10", "2026-10-15"], [MOOSE, "15A", "2026-10-15"],
      [GROUSE, "60", "2026-10-15"], [BEAR, "60", "2026-10-15"],
    ] as const;
    for (const [species, unit, date] of hunts) {
      for (const entry of ready(species, unit, date).methods?.notAllowed ?? []) {
        assert.equal(entry.status, "PROHIBITED");
        assert.ok(
          entry.provenance.length > 0,
          `${species} in WMU ${unit}: ${entry.method} is shown as prohibited with no source`,
        );
      }
    }
  });

  it("never lists a recommendation as an allowed method, or an allowed method as a recommendation", () => {
    const result = ready(TURKEY, "60", "2026-04-30", { HUNT_METHOD: "SHOTGUN" });
    assert.ok(result.methods!.recommended.every((entry) => entry.layer === "NORTH_GROUND_KNOWLEDGE"));
    assert.ok(result.ammunition!.recommended.every((entry) => entry.layer === "NORTH_GROUND_KNOWLEDGE"));
    assert.ok(result.methods!.allowed.every((entry) => !("layer" in entry)));
    assert.ok(result.ammunition!.required.every((entry) => !("layer" in entry)));
  });

  it("keeps the legal turkey shot restriction separate from the recommended load", () => {
    const ammunition = ready(TURKEY, "60", "2026-04-30", { HUNT_METHOD: "SHOTGUN" }).ammunition!;
    assert.match(ammunition.required[0].summary, /4, 5, 6 or 7/);
    assert.equal(ammunition.required[0].provenance[0].citation, "O. Reg. 665/98 s. 79(1)(a)");
    assert.match(ammunition.recommended[0].text, /No\. 4, 5 or 6/);
  });

  it("keeps every recommended turkey shot size inside the legal range", () => {
    for (const entry of bundle.recommendations.turkey) {
      for (const size of (entry as { shotSizes?: number[] }).shotSizes ?? []) {
        assert.ok([4, 5, 6, 7].includes(size), `No. ${size} is outside turkey's legal shot sizes`);
      }
    }
  });

  it("offers no calibre advice for big game, where North Ground has no defensible basis", () => {
    for (const species of [DEER, BEAR, MOOSE]) {
      const result = ready(species, "60", "2026-11-05", { RESIDENCY: "RESIDENT", HUNT_METHOD: "SHOTGUN", TAG_TYPE: "GUN" });
      assert.deepEqual(result.methods?.recommended ?? [], []);
      assert.deepEqual(result.ammunition?.recommended ?? [], []);
    }
  });

  it("does not change the regulatory status: the checklist exists only for a permitted hunt", () => {
    const zone: ZoneResolution = {
      status: "RESOLVED", zoneId: wmu("60") as CanonicalId<"management_zone">, jurisdictionId: "jurisdiction:ca-on" as CanonicalId<"jurisdiction">,
      sourceId: "source:x" as CanonicalId<"source">, message: "",
    };
    const regulation = (status: RegulatoryResult["status"]): RegulatoryResult => ({
      status, summary: "", legalTime: legalTimeNotCertified("", "test authority"), requirements: [], limitations: [], sourceIds: [], verifiedAt: "",
    });
    assert.ok(resolveReadiness({ speciesId: GROUSE, date: "2026-10-15" }, zone, regulation("CONDITIONAL"), { now: NOW }));
    for (const status of ["CLOSED", "UNKNOWN", "NEEDS_VERIFICATION", "CONFLICT"] as const) {
      assert.equal(resolveReadiness({ speciesId: GROUSE, date: "2026-10-15" }, zone, regulation(status), { now: NOW }), undefined, status);
    }
  });

  it("restricts the rifle itself while a big-game season is open, and says why", () => {
    const rifle = ready(GROUSE, "60", "2026-09-21").methods!.allowed.find((entry) => entry.method === "RIFLE")!;
    assert.match(rifle.restriction!, /No centre-fire rifle/);
    assert.match(rifle.restriction!, /^In force today: .*elk.* open here\./i);
  });
});

/* ── Unsupported ─────────────────────────────────────────────────────────── */

describe("what the checklist does not know", () => {
  it("says a jurisdiction without a checklist is not covered, and links its own source", () => {
    const zone: ZoneResolution = {
      status: "RESOLVED", zoneId: "management_zone:ca-mb-gha-26" as CanonicalId<"management_zone">,
      jurisdictionId: "jurisdiction:ca-mb" as CanonicalId<"jurisdiction">, sourceId: "source:x" as CanonicalId<"source">, message: "",
    };
    const regulation: RegulatoryResult = {
      status: "CONDITIONAL", summary: "", legalTime: legalTimeNotCertified("", "test authority"), requirements: [], limitations: [], sourceIds: [], verifiedAt: "",
    };
    const result = resolveReadiness({ speciesId: GROUSE, date: "2026-10-15" }, zone, regulation, { now: NOW, fallbackInfoUrl: "https://example.test/mb" })!;
    assert.equal(result.coverage, "UNAVAILABLE");
    assert.equal(result.jurisdictionName, "Manitoba");
    assert.equal(result.officialInfoUrl, "https://example.test/mb");
    assert.deepEqual(result.authorizations, [], "an empty list with no explanation could read as 'nothing needed'");
    assert.match(result.limitations[0], /not built a Ready to Hunt checklist for Manitoba/);
  });

  it("treats a condition nobody has answered as unknown, never as met", () => {
    assert.equal(matchCondition({ residency: ["NON_RESIDENT"] }, {}), "UNKNOWN");
    assert.equal(matchCondition({ residency: ["NON_RESIDENT"] }, { RESIDENCY: "RESIDENT" }), "NO_MATCH");
    assert.equal(matchCondition({ methods: ["RIFLE", "SHOTGUN"] }, { HUNT_METHOD: "BOW" }), "NO_MATCH");
    assert.equal(matchCondition({ methods: ["CROSSBOW"] }, { HUNT_METHOD: "BOW" }), "MATCH", "the engine's 'bow' includes crossbows");
  });
});

describe("answers the checklist does not understand", () => {
  it("treats an unrecognised residency as unanswered rather than as a category with no requirements", async () => {
    const { readinessAnswers } = await import("./index.ts");
    assert.deepEqual(readinessAnswers({ RESIDENCY: "MARTIAN", HUNT_METHOD: "SLINGSHOT" }), {});
    assert.deepEqual(readinessAnswers({ RESIDENCY: "RESIDENT", HUNT_METHOD: "BOW" }), { RESIDENCY: "RESIDENT", HUNT_METHOD: "BOW" });
  });
});
