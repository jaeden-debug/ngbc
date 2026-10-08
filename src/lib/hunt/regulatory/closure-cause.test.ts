import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ALBERTA_BUNDLE, evaluateAlberta } from "./alberta.ts";
import { BRITISH_COLUMBIA_BUNDLE, evaluateBritishColumbia } from "./british-columbia.ts";
import { MANITOBA_BUNDLE, evaluateManitoba } from "./manitoba.ts";
import { NEW_BRUNSWICK_BUNDLE, evaluateNewBrunswick } from "./new-brunswick.ts";
import { NEWFOUNDLAND_BUNDLE, evaluateNewfoundland } from "./newfoundland.ts";
import { NOVA_SCOTIA_BUNDLE, evaluateNovaScotia } from "./nova-scotia.ts";
import { SASKATCHEWAN_BUNDLE, evaluateSaskatchewan } from "./saskatchewan.ts";
import { COLORADO_BUNDLE, evaluateColorado } from "./us-colorado.ts";
import { IOWA_BUNDLE, evaluateIowa } from "./iowa.ts";
import { IDAHO_BUNDLE, evaluateIdaho } from "./us-idaho.ts";
import { MONTANA_BUNDLE, evaluateMontana } from "./us-montana.ts";
import { WYOMING_BUNDLE, evaluateWyoming } from "./us-wyoming.ts";
import { absenceFor, dedupeDeclarations } from "./conditional-engine.ts";
import { ALBERTA_VOCABULARY } from "./alberta.ts";
import { BRITISH_COLUMBIA_VOCABULARY } from "./british-columbia.ts";
import { MANITOBA_VOCABULARY } from "./manitoba.ts";
import { NEW_BRUNSWICK_VOCABULARY } from "./new-brunswick.ts";
import { NEWFOUNDLAND_VOCABULARY } from "./newfoundland.ts";
import { NOVA_SCOTIA_VOCABULARY } from "./nova-scotia.ts";
import { SASKATCHEWAN_VOCABULARY } from "./saskatchewan.ts";
import { COLORADO_VOCABULARY } from "./us-colorado.ts";
import { IOWA_VOCABULARY } from "./iowa.ts";
import { IDAHO_VOCABULARY } from "./us-idaho.ts";
import { MONTANA_VOCABULARY } from "./us-montana.ts";
import { WYOMING_VOCABULARY } from "./us-wyoming.ts";
import type { HuntInput, RegulatoryResult } from "../types.ts";

/**
 * WHY A CLOSED ANSWER CARRIES ITS CAUSE.
 *
 * CLOSED was one word over three different facts. "The law does not list this
 * place, and an unlisted place is closed here" cites the provision that closes
 * unlisted places; "every rule reaching this place declares no season" cites
 * those rules; "rules reach it and none is open today" cites a date. All three
 * arrived as free prose in `summary`, with the authority's own words for the
 * first one — held, provenanced, in `absence.words` — left behind in the
 * bundle while our `explanation` was spliced into the sentence.
 *
 * WHAT THESE TESTS ASK. Not that the prose reads a certain way. That the cause
 * is present on every CLOSED answer, that it agrees with the sentence derived
 * from it, and that an AUTHORITY quotation reaches a consumer tagged rather
 * than dissolved into North Ground's wording.
 */

interface Wired {
  key: string;
  bundle: { units?: readonly { identifier: string; zoneId: string }[]; rules: readonly { speciesId: string }[] };
  evaluate(input: HuntInput): { result?: RegulatoryResult };
  /**
   * The jurisdiction's own dimensions, used to drive the branches that exist
   * only once a hunter has described something.
   *
   * Without them three CLOSED sites are unreachable, and the first version of
   * this file asserted zero missing causes while 648 answers had none: the
   * hunt-code site fires only when a PLACE-scoped answer names an
   * authorization whose area is elsewhere.
   */
  vocabulary: { dimensions: readonly { id: string; options: readonly { value: string }[] }[] };
}

/* Every bundle the conditional engine drives. Ontario is bespoke and has its
   own tests; it does not read an absence. */
const WIRED: Wired[] = [
  { key: "ca-ab", bundle: ALBERTA_BUNDLE, evaluate: evaluateAlberta, vocabulary: ALBERTA_VOCABULARY },
  { key: "ca-bc", bundle: BRITISH_COLUMBIA_BUNDLE, evaluate: evaluateBritishColumbia, vocabulary: BRITISH_COLUMBIA_VOCABULARY },
  { key: "ca-mb", bundle: MANITOBA_BUNDLE, evaluate: evaluateManitoba, vocabulary: MANITOBA_VOCABULARY },
  { key: "ca-nb", bundle: NEW_BRUNSWICK_BUNDLE, evaluate: evaluateNewBrunswick, vocabulary: NEW_BRUNSWICK_VOCABULARY },
  { key: "ca-nl", bundle: NEWFOUNDLAND_BUNDLE, evaluate: evaluateNewfoundland, vocabulary: NEWFOUNDLAND_VOCABULARY },
  { key: "ca-ns", bundle: NOVA_SCOTIA_BUNDLE, evaluate: evaluateNovaScotia, vocabulary: NOVA_SCOTIA_VOCABULARY },
  { key: "ca-sk", bundle: SASKATCHEWAN_BUNDLE, evaluate: evaluateSaskatchewan, vocabulary: SASKATCHEWAN_VOCABULARY },
  { key: "us-co", bundle: COLORADO_BUNDLE, evaluate: evaluateColorado, vocabulary: COLORADO_VOCABULARY },
  { key: "us-ia", bundle: IOWA_BUNDLE, evaluate: evaluateIowa, vocabulary: IOWA_VOCABULARY },
  { key: "us-id", bundle: IDAHO_BUNDLE, evaluate: evaluateIdaho, vocabulary: IDAHO_VOCABULARY },
  { key: "us-mt", bundle: MONTANA_BUNDLE, evaluate: evaluateMontana, vocabulary: MONTANA_VOCABULARY },
  { key: "us-wy", bundle: WYOMING_BUNDLE, evaluate: evaluateWyoming, vocabulary: WYOMING_VOCABULARY },
] as unknown as Wired[];

const DATES = ["2026-05-04", "2026-10-15", "2026-11-20"];

/**
 * Every CLOSED answer the wired bundles produce.
 *
 * The places come from each bundle's OWN `units`, because `areaOf` maps a
 * zoneId through them and a made-up id reaches no rule at all. A first run
 * built ids by hand and measured 1,719 fewer answers, every one of a single
 * cause — the sweep was testing the no-rules branch twelve times over.
 */
let cache: { key: string; speciesId: string; where: string; date: string; result: RegulatoryResult }[] | null = null;

function closedAnswers(): { key: string; speciesId: string; where: string; date: string; result: RegulatoryResult }[] {
  if (cache) return cache;
  const out: { key: string; speciesId: string; where: string; date: string; result: RegulatoryResult }[] = [];
  for (const entry of WIRED) {
    const species = [...new Set(entry.bundle.rules.map((rule) => rule.speciesId))];
    const units = (entry.bundle.units ?? []).slice(0, 4);
    const places = [
      ...units.map((unit) => ({ zoneId: unit.zoneId, zoneName: unit.identifier, designation: unit.identifier, latitude: 50, longitude: -100, overlays: new Set<string>() })),
      /* A point placed in the jurisdiction with no unit, as the boundary
         resolver places it (§41A). */
      { zoneId: undefined, zoneName: undefined, latitude: 50, longitude: -100, overlays: new Set<string>() },
    ];
    /* No answers, then one answer per option for the first two dimensions. */
    const answerSets: Record<string, string>[] = [{}];
    for (const dimension of entry.vocabulary.dimensions.slice(0, 2)) {
      for (const option of dimension.options.slice(0, 3)) answerSets.push({ [dimension.id]: option.value });
    }
    for (const speciesId of species) {
      for (const place of places) {
        for (const date of DATES) {
          for (const answers of answerSets) {
            const evaluation = entry.evaluate({
              speciesId, speciesName: speciesId.replace("species:", ""), date, place, answers,
            } as unknown as HuntInput);
            const result = evaluation?.result;
            if (result?.status === "CLOSED") {
              out.push({ key: entry.key, speciesId, where: place.zoneName ?? "(no unit)", date, result });
            }
          }
        }
      }
    }
  }
  cache = out;
  return out;
}

test("every CLOSED answer says why it is closed", () => {
  const answers = closedAnswers();
  /* A positive control on the sweep itself: a harness that reaches no CLOSED
     answer passes every assertion below while proving nothing. */
  /* 352 at the time of writing, over 12 bundles. The floor is well under it
     so an added season cannot fail this, and well over zero so a harness that
     stops reaching the engine does. */
  assert.ok(answers.length > 250, `only ${answers.length} CLOSED answers reached; the sweep is not driving the engine`);
  const missing = answers.filter((answer) => !answer.result.closure);
  assert.equal(missing.length, 0,
    missing.slice(0, 3).map((a) => `${a.key} ${a.speciesId} ${a.where} ${a.date}`).join("; "));

  /* All three causes must be reached, or a branch is untested. */
  const kinds = new Set(answers.map((answer) => answer.result.closure!.kind));
  assert.deepEqual([...kinds].sort(),
    ["AUTHORIZATION_COVERS_ANOTHER_AREA", "DECLARED_NO_SEASON", "NO_SEASON_OPEN_ON_DATE", "UNLISTED_PLACE"]);
});

test("the sentence is derived from the cause, so the two cannot disagree", () => {
  for (const answer of closedAnswers()) {
    const { closure, summary } = answer.result;
    const at = `${answer.key} ${answer.speciesId} ${answer.where} ${answer.date}`;
    if (closure!.kind === "DECLARED_NO_SEASON") {
      /* Each declaration's own words appear in the sentence built from it. */
      for (const declaration of closure!.declarations) {
        assert.ok(summary.includes(declaration.why.text), `${at}: declaration missing from summary`);
      }
      assert.ok(closure!.declarations.length > 0, `${at}: no declarations`);
    }
    if (closure!.kind === "NO_SEASON_OPEN_ON_DATE") {
      assert.match(summary, /is open on this date/, at);
    } else {
      /*
       * The converse, which the first version of this test left out — and a
       * mutation proved it: replacing the UNLISTED_PLACE arm of the sentence
       * with `false` sent every unlisted-place answer down the date branch,
       * telling a hunter no season is open on this date for a place the law
       * does not list at all, and all five tests still passed.
       */
      assert.doesNotMatch(summary, /is open on this date/, `${at}: ${closure!.kind} answered with the date sentence`);
    }
    if (closure!.kind === "UNLISTED_PLACE") {
      assert.match(summary, /authorises hunting/, at);
    }
    if (closure!.kind === "AUTHORIZATION_COVERS_ANOTHER_AREA") {
      assert.match(summary, /does not cover/, at);
    }
  }
});

test("an unlisted place carries the provision that closes it, with the authority's words tagged", () => {
  const unlisted = closedAnswers().filter((answer) => answer.result.closure!.kind === "UNLISTED_PLACE");
  assert.ok(unlisted.length > 0, "no UNLISTED_PLACE answer reached");
  for (const answer of unlisted) {
    const closure = answer.result.closure as Extract<RegulatoryResult["closure"], { kind: "UNLISTED_PLACE" }>;
    const at = `${answer.key} ${answer.speciesId} ${answer.where}`;
    /* The citation travels. Without it a consumer has the cause and no way to
       show what establishes it. */
    assert.ok(closure.section, `${at}: no section`);
    if (closure.basis?.owner === "AUTHORITY") {
      /*
       * The point of the field: the authority's own words reach a consumer
       * WHOLE and tagged, instead of our paraphrase of them. They are
       * deliberately NOT required to appear in the summary — splicing a
       * quotation into our sentence unmarked is the §47 defect this milestone
       * fixed in the seasons listing.
       */
      assert.ok(closure.basis.text.length > 10, `${at}: empty quotation`);
      assert.ok(closure.basis.sourceId && closure.basis.citation && closure.basis.lang, `${at}: quotation without provenance`);
    }
  }
  /* Six of the seven CLOSED-absence bundles state the rule in the authority's
     own words; a run where none does means the wiring dropped them. */
  const quoted = new Set(unlisted.filter((a) => a.result.closure!.kind === "UNLISTED_PLACE"
    && (a.result.closure as { basis?: { owner: string } }).basis?.owner === "AUTHORITY").map((a) => a.key));
  assert.ok(quoted.size >= 5, `only ${quoted.size} bundles carried an authority quotation into the result`);
});

test("a tag whose area is elsewhere is not a closure of this place", () => {
  /*
   * §8 runs in both directions. A hunter holding a tag for another area has
   * not been told that this place is shut — the sentence must say that the
   * TAG does not reach here, and the cause must name the authorization so a
   * consumer can offer the hunts that do.
   */
  const elsewhere = closedAnswers().filter((answer) => answer.result.closure!.kind === "AUTHORIZATION_COVERS_ANOTHER_AREA");
  assert.ok(elsewhere.length > 0, "no AUTHORIZATION_COVERS_ANOTHER_AREA answer reached");
  for (const answer of elsewhere) {
    const closure = answer.result.closure as Extract<RegulatoryResult["closure"], { kind: "AUTHORIZATION_COVERS_ANOTHER_AREA" }>;
    assert.ok(closure.authorization.length > 0, "an authorization cause with no authorization named");
    assert.match(answer.result.summary, /does not authorise hunting here/, `${answer.key} ${answer.speciesId}`);
    assert.doesNotMatch(answer.result.summary, /is open on this date/, `${answer.key}: answered as a date closure`);
  }
});

test("a declared closure keeps whose words it is, and a quotation keeps its provenance", () => {
  /*
   * `closureStatedAs` said "the authority's own words" and held both kinds,
   * and this test first asserted the opposite aggregate — that every value is
   * North Ground's. Twelve of the corpus's twenty-three are the authority's:
   * Montana's p. 9 "Closed West of the Continental Divide." and p. 10 "Closed
   * to all hunting", each matched against the booklet by that build script's
   * own reader, and Wyoming's Chapter 7 "Closed" cell. The aggregate was wrong
   * in the direction that strips provenance, which is the defect this
   * milestone exists to remove.
   *
   * So what is asserted is not an owner but that the owner is DECLARED, and
   * that a quotation arrives able to be shown as one.
   */
  const declared = closedAnswers().filter((answer) => answer.result.closure!.kind === "DECLARED_NO_SEASON");
  assert.ok(declared.length > 0, "no DECLARED_NO_SEASON answer reached");
  const owners = new Set<string>();
  for (const answer of declared) {
    const closure = answer.result.closure as Extract<RegulatoryResult["closure"], { kind: "DECLARED_NO_SEASON" }>;
    for (const declaration of closure.declarations) {
      const at = `${answer.key} ${answer.speciesId}`;
      assert.ok(["AUTHORITY", "NORTH_GROUND"].includes(declaration.why.owner), `${at}: undeclared owner`);
      owners.add(declaration.why.owner);
      assert.ok(declaration.about.length > 0, "a declaration with no label");
      if (declaration.why.owner === "AUTHORITY") {
        /* A quotation that cannot be cited cannot be shown as a quotation. */
        assert.ok(declaration.why.sourceId && declaration.why.citation && declaration.why.lang, `${at}: quotation without provenance`);
        /* Our page citation must not be inside the authority's sentence. */
        assert.doesNotMatch(declaration.why.text, /\(p\. \d+\)\.?$/, `${at}: a citation left inside the quotation`);
        /* And the sentence shows it as one. */
        assert.ok(answer.result.summary.includes(`\u201c${declaration.why.text}\u201d`),
          `${at}: an authority quotation rendered unquoted in the summary`);
      } else {
        assert.ok(!answer.result.summary.includes(`\u201c${declaration.why.text}\u201d`),
          `${at}: North Ground's own wording shown as a quotation`);
      }
    }
  }
  /* Both kinds must be reached, or the distinction is untested. */
  assert.deepEqual([...owners].sort(), ["AUTHORITY", "NORTH_GROUND"]);
});

test("no AUTHORITY quotation is spliced into the absence sentence", () => {
  /*
   * The guard, stated where it can fail. Six bundles hold the absence rule as
   * an `AuthorityQuotation`; the sentence must come from our `explanation`,
   * and where a bundle has none the quotation is still not borrowed.
   */
  for (const entry of WIRED) {
    for (const speciesId of new Set(entry.bundle.rules.map((rule) => rule.speciesId))) {
      const absence = absenceFor(entry.bundle as never, speciesId as never);
      if (absence.words?.owner !== "AUTHORITY") continue;
      const quotation = absence.words.text;
      for (const answer of closedAnswers().filter((a) => a.key === entry.key && a.speciesId === speciesId)) {
        assert.ok(!answer.result.summary.includes(quotation),
          `${entry.key} ${speciesId}: the authority's words were spliced into our sentence`);
      }
    }
  }
});

test("an unlisted place is also answered where the hunter described the hunt", () => {
  /*
   * The same cause from the OTHER site. The engine answers an unlisted place
   * twice over: once where no rule reaches the point at all, and once where
   * rules reach it and the hunter's own answer leaves none of them standing.
   * Only the second says "matching what you described", and the sweep above
   * never reaches it — the answer that does lies outside the first two
   * dimensions it drives. Replacing that arm of the sentence with `false` sent
   * every unlisted-place answer down the date branch and all six tests passed,
   * which is why this case is pinned by name.
   */
  const answer = evaluateColorado({
    speciesId: "species:chukar", speciesName: "chukar", date: "2026-10-15",
    place: { zoneId: "management_zone:us-co-gmu-1", zoneName: "1", latitude: 40.5, longitude: -106.5, overlays: new Set() },
    answers: { HUNT_METHOD: "RIFLE" },
  } satisfies Parameters<typeof evaluateColorado>[0]).result!;
  assert.equal(answer.status, "CLOSED");
  assert.equal(answer.closure!.kind, "UNLISTED_PLACE");
  assert.match(answer.summary, /matching what you described/);
  assert.doesNotMatch(answer.summary, /is open on this date/);
  /* Colorado states the rule itself; the citation has to travel with it. */
  const closure = answer.closure as Extract<RegulatoryResult["closure"], { kind: "UNLISTED_PLACE" }>;
  assert.ok(closure.section, "no section on the cause");
});

test("two closure declarations that differ are both kept", () => {
  /*
   * Tested directly, because the engine cannot reach it: every
   * DECLARED_NO_SEASON answer in the corpus carries exactly one declaration
   * (38 of 38, measured 2026-10-07), so collapsing the dedupe key to a
   * constant broke nothing the sweep could see. Montana holds 18 closure rules
   * and will reach it; the behaviour is pinned before it does.
   */
  const kept = dedupeDeclarations([
    { about: "Indian reservation", why: { owner: "NORTH_GROUND", text: "closed to upland birds with a state licence" } },
    { about: "Indian reservation", why: { owner: "NORTH_GROUND", text: "closed to upland birds with a state licence" } },
    { about: "No elk season", why: { owner: "NORTH_GROUND", text: "closed to upland birds with a state licence" } },
    { about: "Indian reservation", why: { owner: "NORTH_GROUND", text: "closed to all hunting" } },
  ]);
  assert.equal(kept.length, 3, "a distinct label or a distinct reason is a distinct declaration");
  assert.deepEqual(kept.map((entry) => entry.about), ["Indian reservation", "No elk season", "Indian reservation"]);
});

test("every closure basis in the corpus declares its owner coherently", () => {
  /*
   * A POPULATION CHECK, not a filter question.
   *
   * The reachability sweep above asserts provenance only on the declarations
   * its four units per bundle happen to reach. Stripping `sourceId` and
   * `citation` from Wyoming's Area 72 quotation broke nothing: that record is
   * real, shipped, and outside the swept units. So this reads every bundle
   * instead, which cannot be escaped by where a record sits.
   */
  const dir = join(process.cwd(), "content", "regulatory");
  const owners: Record<string, number> = {};
  const authorityText = new Set<string>();
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".json"))) {
    const bundle = JSON.parse(readFileSync(join(dir, file), "utf8")) as {
      rules?: { id?: string; closureBasis?: Record<string, unknown>; closureSummary?: unknown }[];
    };
    for (const rule of bundle.rules ?? []) {
      /* The old bare-string field must not come back by any route. */
      assert.equal(rule.closureSummary, undefined, `${file} ${rule.id}: closureSummary is gone`);
      const basis = rule.closureBasis;
      if (!basis) continue;
      const at = `${file} ${rule.id}`;
      assert.ok(basis.owner === "AUTHORITY" || basis.owner === "NORTH_GROUND", `${at}: undeclared owner`);
      owners[String(basis.owner)] = (owners[String(basis.owner)] ?? 0) + 1;
      assert.equal(typeof basis.text, "string", `${at}: no text`);
      if (basis.owner === "AUTHORITY") {
        assert.ok(basis.sourceId, `${at}: a quotation with no source`);
        assert.ok(basis.citation, `${at}: a quotation with no citation`);
        assert.ok(basis.lang, `${at}: a quotation with no language`);
        /* The page number belongs in `citation`. "Closed to all hunting
           (p. 10)." is not a sentence Montana prints. */
        assert.doesNotMatch(String(basis.text), /\(p+\.\s*\d+\)\.?$/, `${at}: our citation inside the quotation`);
        authorityText.add(String(basis.text));
      } else {
        for (const field of ["sourceId", "citation", "lang"]) {
          assert.equal(basis[field], undefined, `${at}: North Ground's wording carrying ${field}`);
        }
      }
    }
  }
  /*
   * The three values established as the authority's, pinned by text so a
   * re-tag fails while a new bundle's own closures do not. Each was matched
   * against its source by the reader in its own build script —
   * build-us-mt-upland.mjs:191 and :111,166, build-us-wy-elk.mjs:121.
   */
  for (const words of ["Closed to all hunting", "Closed West of the Continental Divide.", "Closed"]) {
    assert.ok(authorityText.has(words), `"${words}" is no longer the authority's; 12 of 23 values were, measured 2026-10-07`);
  }
  assert.ok(owners.AUTHORITY > 0 && owners.NORTH_GROUND > 0,
    `both kinds must exist: ${JSON.stringify(owners)}`);
});
