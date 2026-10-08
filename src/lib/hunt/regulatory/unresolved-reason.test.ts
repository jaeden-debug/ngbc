import assert from "node:assert/strict";
import test from "node:test";
import { MANITOBA_BUNDLE, MANITOBA_VOCABULARY, evaluateManitoba } from "./manitoba.ts";
import { SASKATCHEWAN_BUNDLE, SASKATCHEWAN_VOCABULARY, evaluateSaskatchewan } from "./saskatchewan.ts";
import { BRITISH_COLUMBIA_BUNDLE, BRITISH_COLUMBIA_VOCABULARY, evaluateBritishColumbia } from "./british-columbia.ts";
import { MONTANA_BUNDLE, MONTANA_VOCABULARY, evaluateMontana } from "./us-montana.ts";
import { evaluateFederal } from "./federal.ts";
import type { RegulatoryResult } from "../types.ts";

/**
 * WHY AN UNRESOLVED ANSWER CARRIES ITS REASON.
 *
 * UNKNOWN, NEEDS_VERIFICATION and CONFLICT were three words over a dozen
 * different facts, each reaching a consumer as a sentence and nothing else.
 * "We have not certified this species here" is a gap the owner can close;
 * "the federal Regulations do not name this species" is a fact about the law;
 * "the Regulations DO set a season and we declined to encode it" is a decision
 * of ours; "we could not place the point in a unit" is geography; "the rules
 * here ask a question our model has no value for" names the question. A
 * coverage report that counted them together would be measuring unrelated
 * things, which §8 treats as misreporting our own capability.
 *
 * CONFLICT was worse: §8 forbids choosing between disagreeing sources, so the
 * whole value of the answer is in showing both — and the answer carried
 * neither which sources disagreed nor what each one said.
 */

const PLACE = (zoneId: string, name: string) => ({
  zoneId, zoneName: name, designation: name, latitude: 50, longitude: -100, overlays: new Set<string>(),
});

interface Driven {
  key: string;
  bundle: { units?: readonly { identifier: string; zoneId: string }[]; rules: readonly { speciesId: string }[]; certifiedPeriod: { from: string; to: string } };
  vocabulary: { dimensions: readonly { id: string; options: readonly { value: string }[] }[] };
  evaluate(input: never): { result?: RegulatoryResult };
}

/* Four bundles chosen for what they can REACH, not for coverage: Manitoba has
   the corpus's only recorded source dispute, British Columbia the only
   unestablished geography, Saskatchewan and Montana a province-wide and a
   statewide model. */
const DRIVEN: Driven[] = [
  { key: "ca-mb", bundle: MANITOBA_BUNDLE, vocabulary: MANITOBA_VOCABULARY, evaluate: evaluateManitoba },
  { key: "ca-sk", bundle: SASKATCHEWAN_BUNDLE, vocabulary: SASKATCHEWAN_VOCABULARY, evaluate: evaluateSaskatchewan },
  { key: "ca-bc", bundle: BRITISH_COLUMBIA_BUNDLE, vocabulary: BRITISH_COLUMBIA_VOCABULARY, evaluate: evaluateBritishColumbia },
  { key: "us-mt", bundle: MONTANA_BUNDLE, vocabulary: MONTANA_VOCABULARY, evaluate: evaluateMontana },
] as unknown as Driven[];

let cache: { key: string; result: RegulatoryResult; at: string }[] | null = null;

/** Every non-resolved answer these bundles produce over a bounded input space. */
function unresolvedAnswers(): { key: string; result: RegulatoryResult; at: string }[] {
  if (cache) return cache;
  const out: { key: string; result: RegulatoryResult; at: string }[] = [];
  for (const entry of DRIVEN) {
    const species = [...new Set(entry.bundle.rules.map((rule) => rule.speciesId))];
    /* A species no rule in this bundle names, to reach the coverage gap. */
    species.push("species:nonexistent-for-this-bundle");
    const units = (entry.bundle.units ?? []).slice(0, 6);
    const places = [
      ...units.map((unit) => PLACE(unit.zoneId, unit.identifier)),
      { zoneId: undefined, zoneName: undefined, latitude: 50, longitude: -100, overlays: new Set<string>() },
    ];
    const answerSets: Record<string, string>[] = [{}];
    for (const dimension of entry.vocabulary.dimensions) {
      for (const option of dimension.options) answerSets.push({ [dimension.id]: option.value });
    }
    /*
     * One PAIR of answers, because the only CONFLICT in the corpus needs two.
     * With single answers alone the swept population held no conflict at all,
     * and a mutation that put an `unresolved` reason on a conflict as well as
     * its readings passed every test here.
     */
    answerSets.push({ LICENCE_TYPE: "NON_CANADIAN_ARCHERY_WTD", HUNT_METHOD: "BOW" });
    /* One date outside the certified period, the rest inside it. */
    const dates = ["2026-09-10", "2026-10-20", "2026-11-01", "2099-01-01"];
    for (const speciesId of species) {
      for (const place of places) {
        for (const date of dates) {
          for (const answers of answerSets) {
            let evaluation;
            try {
              evaluation = entry.evaluate({
                speciesId, speciesName: speciesId.replace("species:", ""), date, place, answers,
              } as never);
            } catch { continue; }
            const result = evaluation?.result;
            if (!result) continue;
            if (result.status === "UNKNOWN" || result.status === "NEEDS_VERIFICATION" || result.status === "CONFLICT") {
              out.push({ key: entry.key, result, at: `${entry.key} ${speciesId} ${place.zoneName ?? "(no unit)"} ${date} ${JSON.stringify(answers)}` });
            }
          }
        }
      }
    }
  }
  cache = out;
  return out;
}

test("every unresolved answer says why, and every conflict names its sides", () => {
  const answers = unresolvedAnswers();
  /* A positive control on the harness: nothing below can fail if it reaches
     nothing, and a sweep that skews to one date reaches one reason. */
  assert.ok(answers.length > 500, `only ${answers.length} unresolved answers reached`);

  const missing = answers.filter(({ result }) =>
    result.status === "CONFLICT" ? !result.conflict : !result.unresolved);
  assert.equal(missing.length, 0, missing.slice(0, 3).map((entry) => entry.at).join("; "));

  /* Each field belongs to its own statuses and must not appear on the others:
     a CONFLICT with an `unresolved` reason would be claiming both that the
     sources disagree and that there is no answer to disagree about. */
  for (const { result, at } of answers) {
    if (result.status === "CONFLICT") assert.equal(result.unresolved, undefined, `${at}: a conflict carrying an unresolved reason`);
    else assert.equal(result.conflict, undefined, `${at}: ${result.status} carrying a conflict`);
    assert.equal(result.closure, undefined, `${at}: an unresolved answer carrying a closure cause`);
  }

  /* The reasons this input space can actually reach, named so a variant that
     stops being produced fails rather than quietly disappearing. */
  const kinds = new Set(answers.flatMap(({ result }) => result.unresolved ? [result.unresolved.kind] : []));
  /*
   * Measured, not guessed. UNIT_NOT_NAMED_BY_ANY_RULE is deliberately absent:
   * it needs a unit the bundle lists that no rule for the species names, and
   * in a bundle whose absence means CLOSED that point answers CLOSED instead.
   * Ontario's own tests cover it; asserting it here would have failed for a
   * reason that is about these four bundles rather than about the field.
   */
  for (const expected of [
    "SPECIES_NOT_CERTIFIED", "DATE_OUTSIDE_CERTIFIED_PERIOD",
    "POINT_NOT_PLACED_IN_A_UNIT", "GEOGRAPHY_NOT_ESTABLISHED",
  ]) {
    assert.ok(kinds.has(expected as never), `${expected} is no longer reached; reached: ${[...kinds].join(", ")}`);
  }
});

test("a conflict carries both readings, and the dispute's own statement", () => {
  /*
   * Manitoba's cross-check against its own guide is the corpus's only recorded
   * dispute: M.R. 165/91 reaches GHA 7A for the non-Canadian archery licence
   * only through the range "5-8", and the guide lists no such season there.
   * The regulation and the guide disagree, North Ground will not choose, and
   * the answer must show both sides.
   */
  const answer = evaluateManitoba({
    speciesId: "species:white-tailed-deer", speciesName: "white-tailed deer", date: "2026-09-10",
    place: PLACE("management_zone:ca-mb-gha-7a", "7A"),
    answers: { LICENCE_TYPE: "NON_CANADIAN_ARCHERY_WTD", HUNT_METHOD: "BOW" },
  } satisfies Parameters<typeof evaluateManitoba>[0]).result!;

  assert.equal(answer.status, "CONFLICT");
  /* A conflict is not also an absence of an answer: both sides have one. */
  assert.equal(answer.unresolved, undefined);
  const conflict = answer.conflict!;
  /* Two sides, never one: a conflict with a single reading is not a conflict. */
  assert.equal(conflict.readings.length, 2);
  /* `about` is the dispute's own statement, not a restatement of the status. */
  assert.match(conflict.about, /M\.R\. 165\/91/);
  assert.match(conflict.about, /GHA 7A/);
  /* The two sides are the two readings, and they say different things —
     otherwise there was nothing to refuse to choose between. */
  const [holds, doesNot] = conflict.readings;
  assert.match(holds.statedBy, /reaches here/);
  assert.match(doesNot.statedBy, /does not/);
  assert.notEqual(holds.says, doesNot.says);
  /*
   * WHICH SIDE SAYS WHAT, pinned by value.
   *
   * The regulation reaches GHA 7A through the range, so under the reading
   * where the disputed provision holds there IS a season (CONDITIONAL); the
   * guide lists none, so under the other reading there is not (CLOSED).
   * Swapping the two passed every other assertion in this file — the sides
   * were named and their contents were interchangeable, which is the same
   * inversion as reading a heading for a provision.
   */
  assert.equal(holds.says, "CONDITIONAL");
  assert.equal(doesNot.says, "CLOSED");
});

test("a federal species the Regulations do not name is not a coverage gap", () => {
  /*
   * Two different facts that shared one word. The Migratory Birds Regulations
   * simply do not name a white-tailed deer; reporting that as a gap in North
   * Ground's coverage would overstate the work outstanding, and §8 forbids
   * understating what the evidence establishes as much as overstating it.
   */
  const federal = evaluateFederal("species:white-tailed-deer", "jurisdiction:ca-mb", { latitude: 50, longitude: -100 }, "2026-10-20" as never);
  assert.equal(federal.status, "UNKNOWN");
  assert.equal(federal.unresolved?.kind, "SPECIES_NOT_NAMED_BY_THE_INSTRUMENT");
  assert.equal(
    federal.unresolved?.kind === "SPECIES_NOT_NAMED_BY_THE_INSTRUMENT" ? federal.unresolved.instrument : undefined,
    "Migratory Birds Regulations, 2022",
  );
});

test("a modelling gap names the question it could not answer", () => {
  /*
   * The difference between a gap someone can close and a shrug. Where the
   * rules reaching a place turn on a fact the model offers no value for, the
   * answer carries the question itself.
   */
  const withQuestions = unresolvedAnswers()
    .map(({ result }) => result.unresolved)
    .filter((reason) => reason?.kind === "MODEL_LACKS_A_REQUIRED_VALUE");
  for (const reason of withQuestions) {
    assert.ok(reason!.kind === "MODEL_LACKS_A_REQUIRED_VALUE" && reason.questions.length > 0,
      "a modelling gap that does not name its question is a shrug");
  }
});

test("an unestablished geography keeps the kind the geography module declared", () => {
  /*
   * `WorldSet.unknowns` has declared GAME_BIRD_ZONE, SPECIAL and DISPUTE since
   * it was written, and the answer flattened all three into one sentence. A
   * game-bird zone line, a special area and a disputed reading are three
   * different problems with three different fixes.
   */
  const geographic = unresolvedAnswers()
    .map(({ result }) => result.unresolved)
    .filter((reason) => reason?.kind === "GEOGRAPHY_NOT_ESTABLISHED");
  assert.ok(geographic.length > 0, "no GEOGRAPHY_NOT_ESTABLISHED answer reached");
  for (const reason of geographic) {
    assert.ok(reason!.kind === "GEOGRAPHY_NOT_ESTABLISHED" && reason.facts.length > 0,
      "an unestablished geography with no facts named");
    if (reason!.kind !== "GEOGRAPHY_NOT_ESTABLISHED") continue;
    for (const fact of reason.facts) {
      assert.ok(["GAME_BIRD_ZONE", "SPECIAL", "DISPUTE"].includes(fact.kind), `undeclared kind ${fact.kind}`);
      assert.ok(fact.statedAs.length > 10, "a fact with no statement");
    }
  }
});

test("no unresolved reason is ever a statement that there is no season", () => {
  /* §8, as a property of the whole population rather than of one sentence. */
  for (const { result, at } of unresolvedAnswers()) {
    assert.notEqual(result.status, "CLOSED", at);
    /*
     * The phrase appears in these answers on purpose — "that is a gap in
     * North Ground's coverage, NOT A STATEMENT THAT there is no season" is
     * exactly what §8 requires them to say. The first version of this
     * assertion failed on its own disclaimer. What must never appear is the
     * phrase asserted rather than denied.
     */
    assert.doesNotMatch(result.summary, /(?<!not a statement that )(?<!not evidence that )there is no season/,
      `${at}: ${result.summary.slice(0, 90)}`);
  }
});
