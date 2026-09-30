import assert from "node:assert/strict";
import test from "node:test";
import { catalogueSpecies } from "../intelligence/species-catalogue.ts";
import { NOVA_SCOTIA_BUNDLE, NOVA_SCOTIA_SPECIES, novaScotiaCoverageReport } from "./nova-scotia.ts";

test("Nova Scotia defines no hunting year, and none is invented", () => {
  /* §41A: never invent an annual licence period where the authority defines none.
     Nova Scotia defines none, and that is a finding rather than a gap — so the
     field is null rather than absent, and the bundle records the negative control
     that establishes it plus the four different validity bases the authority uses
     instead of a year. */
  assert.equal(NOVA_SCOTIA_BUNDLE.licenceYear, null, "a hunting year here would be invented");
  const why = (NOVA_SCOTIA_BUNDLE as unknown as { whyThereIsNoLicenceYear: Record<string, unknown> }).whyThereIsNoLicenceYear;
  assert.match(String(why.negativeControl), /ZERO times/);
  /* The control is only worth having because it names what DID appear: "licence"
     occurs 152 times in the Act while "licence year" occurs 0. A zero with no
     positive control is indistinguishable from a failed search. */
  assert.match(String(why.negativeControl), /152/);
  assert.ok(Array.isArray(why.whatTheAuthorityDefinesInstead));
  assert.ok((why.whatTheAuthorityDefinesInstead as unknown[]).length >= 2,
    "the authority uses more than one validity basis, and they are not equivalent");
});

test("silence means CLOSED on the authority's own words, and the words are the Act's", () => {
  /* Nova Scotia's absence provision is STATUTORY rather than regulatory, unlike
     Manitoba's, and broader: Manitoba's M.R. 165/91 s. 3 is licence-scoped while
     Wildlife Act s. 39(2) is general to all wildlife. */
  const absence = NOVA_SCOTIA_BUNDLE.absence;
  assert.equal(absence.meaning, "CLOSED");
  assert.equal(absence.words?.owner, "AUTHORITY", "the quotation is the Act's, not ours");
  assert.match(String(absence.words?.citation), /Wildlife Act.*s\. 39/);
  assert.match(String(absence.words?.text), /except during the open season for that species/);

  /* And the closed default is DEFEASIBLE, which has to travel with it. Wildlife
     Act s. 21 lets the Minister by order either prohibit OR ALLOW hunting in any
     defined area, with no prescribed publication channel — so CLOSED is correct
     and cannot be stated as certain. */
  const limit = (absence as unknown as { theStandingLimitOnEveryClosedClaim: Record<string, string> })
    .theStandingLimitOnEveryClosedClaim;
  assert.match(limit.statedAs, /either prohibit or allow/);
  assert.match(limit.whyItMatters, /defeasible/);
});

test("every encoded season is province-wide, and that is not a claim about the zones", () => {
  /* THE FINDING THAT MAKES NOVA SCOTIA A DIFFERENT DATA SHAPE FROM MANITOBA.
     Deer Hunting Regulations ss. 10(4) and 11(4) say taking deer under either
     stamp "is not restricted to any specific deer management zone". So the zone
     governs the animal class and the stamp, never the dates — where Manitoba puts
     the area on the season row.

     Every rule therefore spans all twelve zones. The test asserts that, and it
     asserts the bundle says WHY, because "all twelve zones" read without the
     reason looks like a claim that the zones are the seasons' geography. */
  /* `units` maps the identifier the authority uses to the canonical zone id, and
     a rule's `ghas` names the IDENTIFIER — because `areaOf` resolves a point's
     zone id to an identifier and `appliesInWorld` matches on that. This bundle
     first shipped with zone ids in both, which made `areaOf` return null for
     every point and answered CLOSED across the province; see
     `engine-answers-somewhere.test.ts`, which asks the engine rather than the
     bundle and is the check that catches it. */
  const units = NOVA_SCOTIA_BUNDLE.units ?? [];
  assert.equal(units.length, 12);
  assert.equal(NOVA_SCOTIA_BUNDLE.officialUnitCount, 12);
  const designations = units.map((unit) => unit.identifier);
  assert.deepEqual(designations, ["101", "102", "103", "104", "105", "106", "107", "108", "109", "110", "111", "112"]);
  for (const unit of units) assert.equal(unit.zoneId, `management_zone:ca-ns-dmz-${unit.identifier}`);
  for (const rule of NOVA_SCOTIA_BUNDLE.rules) {
    if (rule.declaredNoSeason) continue;
    assert.deepEqual(rule.geography?.include?.ghas, designations, `${rule.id} is province-wide`);
  }
  const why = (NOVA_SCOTIA_BUNDLE as unknown as { whyEveryRuleIncludesAllTwelveZones: string })
    .whyEveryRuleIncludesAllTwelveZones;
  assert.match(why, /is not restricted to any specific deer management zone/);
  assert.match(why, /NOT A CLAIM THAT THE ZONES ARE THE GEOGRAPHY/);
});

test("a relative date rule keeps its rule as well as its derived dates", () => {
  /* Nova Scotia writes almost no literal dates: deer, moose and bear seasons are
     ordinals over weekdays. Storing only the ISO dates would lose the rule and
     answer 2027 wrongly; storing only the rule would make the bundle uncheckable.
     So both travel, and certifiedPeriod ends at 2026-12-31 because the derivation
     is certified for that year alone. */
  const general = NOVA_SCOTIA_BUNDLE.rules.find((rule) => rule.id.endsWith("deer-general"))!;
  assert.match(String(general.windows[0].statedAs), /the last Friday in October until the second Saturday in December/);
  assert.equal(general.windows[0].opensIso, "2026-10-30");
  assert.equal(general.windows[0].closesIso, "2026-12-12");
  assert.equal(NOVA_SCOTIA_BUNDLE.certifiedPeriod.to, "2026-12-31");
  assert.match(String(NOVA_SCOTIA_BUNDLE.certifiedPeriod.reason), /certified for that year alone|determination/);
});

test("moose is answerable as CLOSED without any moose geometry", () => {
  /* The Moose Hunting Regulations give four zone-scoped windows, and North Ground
     holds no licensed moose polygons, so none of them could be resolved at a
     point. It does not matter: the ministerial determination closes EVERY zone
     uniformly, and a uniform closure needs no geography.

     This is the case worth pinning, because the tempting answer was UNKNOWN — and
     UNKNOWN where the authority has affirmatively closed the season is the
     under-claim §8 says nobody ever reports. */
  const moose = NOVA_SCOTIA_BUNDLE.rules.find((rule) => rule.speciesId === "species:moose")!;
  assert.equal(moose.declaredNoSeason, true);
  assert.deepEqual(moose.windows, []);
  const extra = moose as unknown as Record<string, string>;
  assert.match(extra.whyThisIsAnswerableWithoutMooseGeometry, /uniform closure needs no polygon/);
  /* Established as a DETERMINATION rather than as regulation text, with a control:
     "suspend" occurs zero times in the regulations while "open season" occurs 9. */
  assert.match(extra.negativeControl, /ZERO times/);
  assert.match(extra.negativeControl, /9 times/);
  /* And one species, two populations, opposite legal status — mainland moose is
     endangered. A species-keyed model carrying one moose record gets mainland
     Nova Scotia wrong the year Cape Breton reopens. */
  assert.match(extra.twoPopulationsOneSpecies, /ENDANGERED/);
});

test("one season can have two closing dates, because Sunday cuts by METHOD", () => {
  /* Snowshoe hare runs "Nov. 1st to last day of Feb." — and HUNTING ends Saturday
     2027-02-27 because Sundays after December 31 are closed, while SNARING runs to
     Sunday 2027-02-28 under Act s. 71(2). A model storing one closing date is
     wrong for one of them.

     Bear is the same shape in the other direction: it opens 2026-09-14 but the
     Sunday exception starts October 1, so two Sundays inside the stated window are
     closed to hunting while snaring is expressly excepted. */
  const hare = NOVA_SCOTIA_BUNDLE.rules.find((rule) => rule.speciesId === "species:snowshoe-hare")!;
  assert.match((hare as unknown as Record<string, string>).sundaySplitsTheAnswerByMETHOD, /two different last days/);

  const hunting = NOVA_SCOTIA_BUNDLE.rules.find((rule) => rule.id.endsWith("bear-hunting"))!;
  const snaring = NOVA_SCOTIA_BUNDLE.rules.find((rule) => rule.id.endsWith("bear-snaring"))!;
  assert.match((hunting as unknown as Record<string, string>).sundayRemovesTwoDays, /2026-09-20 and 2026-09-27/);
  assert.ok(hunting.conditionIds.includes("ca-ns-sunday"), "bear hunting carries the Sunday condition");
  assert.ok(!snaring.conditionIds.includes("ca-ns-sunday"),
    "bear snaring is expressly excepted by the regulation, so it must not carry it");
  assert.equal(hunting.limits?.bag, 1);
  assert.equal(snaring.limits?.bag, 2, "different authorizations, different bag limits");
});

test("a condition declares its scope, and only the genuinely zone-specific one is ZONE", () => {
  /* The owner's rule: scope is a property of the rule, declared where the rule is
     encoded, and never inferred from how often a marker fires. Nova Scotia has
     exactly one ZONE-scoped condition — whether antlerless deer may be taken,
     which is a per-zone ministerial determination — and everything else is
     province-wide by construction.

     Inferring from frequency would flip it: zoom into the seven zones that
     require an antlerless stamp and its share reads 100%, so it would reclassify
     as universal and vanish exactly where the hunter is looking. */
  const conditions = NOVA_SCOTIA_BUNDLE.sources.flatMap((source) => source.conditions ?? []);
  assert.ok(conditions.length >= 9, `expected the full condition set, got ${conditions.length}`);
  for (const condition of conditions) {
    const scope = (condition as unknown as { scope?: string }).scope;
    assert.ok(scope === "JURISDICTION" || scope === "ZONE", `${condition.id} must declare its scope`);
  }
  const zoneScoped = conditions.filter((condition) => (condition as unknown as { scope: string }).scope === "ZONE");
  assert.deepEqual(zoneScoped.map((condition) => condition.id), ["ca-ns-antlered-only-unless-determined"]);
  assert.match(String((zoneScoped[0] as unknown as { note: string }).note), /inferring its scope from how often it fires/);
});

test("every species with a rule is in the catalogue, and the two that are not are named as gaps", () => {
  /* The moderator's warning: a species encoded but never canonicalized is
     silently unanswerable, because an unknown id is refused as UNVERIFIED. So
     every rule's species must resolve — and the two Nova Scotia entitlements that
     cannot be encoded are recorded as species-lane requests rather than dropped. */
  const known = new Set(catalogueSpecies().map((species) => species.speciesId));
  for (const speciesId of NOVA_SCOTIA_SPECIES) {
    assert.ok(known.has(speciesId), `${speciesId} has a rule and no catalogue entry`);
  }
  assert.equal(NOVA_SCOTIA_SPECIES.length, 8);

  const gaps = NOVA_SCOTIA_BUNDLE.deliberatelyNotEncoded;
  const notCanonicalized = gaps.find((gap) => gap.reason === "SPECIES_NOT_CANONICALIZED")!;
  assert.match(notCanonicalized.what, /bullfrog and porcupine/);
  /* bullfrog is the interesting one: an AMPHIBIAN with a real open season, which a
     catalogue restricted to birds and mammals will not have. */
  assert.match(String((notCanonicalized as unknown as Record<string, string>).note), /AMPHIBIAN/);
});

test("the pheasant season is left unresolved rather than forced onto the wrong geography", () => {
  /* The one Nova Scotia season written geographically, and the province publishes
     no county polygons. Three candidates were tested and each failed for its own
     reason, which is what makes this an absence rather than a shrug. Mapping it
     onto the deer zones would invent a boundary no authority gave us. */
  const gap = NOVA_SCOTIA_BUNDLE.deliberatelyNotEncoded.find((entry) => entry.what.includes("pheasant"))!;
  assert.equal(gap.reason, "GEOGRAPHY_ABSENT");
  const tested = String((gap as unknown as Record<string, string>).whatWasTested);
  assert.match(tested, /LINE features/, "one candidate returns lines, not areas");
  assert.match(tested, /EMPTY properties/, "one returns features with no attributes");
  assert.match(tested, /49 MUNICIPAL counties are not the 18 GEOGRAPHIC counties/);
  assert.ok(!NOVA_SCOTIA_SPECIES.includes("species:ring-necked-pheasant"),
    "pheasant must not be answerable while its geography is unresolved");
});

test("the six unreadable prohibition orders are a standing limitation, not a footnote", () => {
  /* The most consequential gap in the jurisdiction. Six area closures are in
     force under Act s. 21 and the Registrar marks their text "(no text)", so in
     six named localities North Ground knows a prohibition EXISTS, knows its
     citation and county, and cannot read its terms or extent.

     It is precisely the case where "I found no restriction" would be a false
     negative where a restriction is known to exist — so it must appear on every
     answer rather than only near those places, because their extent is exactly
     what cannot be read. */
  const gap = NOVA_SCOTIA_BUNDLE.deliberatelyNotEncoded.find((entry) => entry.reason === "NO_PUBLISHED_TEXT")!;
  assert.match(gap.detail, /\(no text\)/);
  assert.match(String((gap as unknown as Record<string, string>).whyThisIsTheMostConsequentialGap), /false negative/);
});

test("the coverage the report counts is the coverage the bundle holds", () => {
  /* §8: capability reporting measures deliverable answers. The report reaches
     Nova Scotia only through a served layer whose rules are certified, so this
     asserts the two agree rather than trusting either. */
  const coverage = novaScotiaCoverageReport();
  assert.equal(coverage.species.length, 8);
  assert.equal(coverage.species.reduce((total, row) => total + row.rules, 0), NOVA_SCOTIA_BUNDLE.rules.length);
  assert.equal(coverage.officialUnits, 12);
});
