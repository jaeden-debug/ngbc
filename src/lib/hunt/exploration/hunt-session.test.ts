import assert from "node:assert/strict";
import test from "node:test";
import type { HuntEvaluation } from "../types.ts";
import { currentResult, evaluationKey, huntSessionReducer, initialSession, type HuntSession, type HuntSessionEvent } from "./hunt-session.ts";

const POINT = { latitude: 45.0573, longitude: -77.8546 };
const start = initialSession({ speciesId: null, date: "2026-09-22", dateExplicit: false, explore: false });
const run = (events: HuntSessionEvent[], from: HuntSession = start) => events.reduce(huntSessionReducer, from);

function result(status: string): HuntEvaluation {
  return { regulation: { status } } as unknown as HuntEvaluation;
}

test("a response is shown only for the question it answers", () => {
  const deer = evaluationKey({ point: POINT, speciesId: "species:white-tailed-deer", date: "2026-09-22", answers: {} });
  const moose = evaluationKey({ point: POINT, speciesId: "species:moose", date: "2026-09-22", answers: {} });
  let state = run([{ type: "SPECIES_CHOSEN", speciesId: "species:white-tailed-deer" }, { type: "EVALUATION_STARTED", key: deer }]);
  // The hunter switches to moose before the deer answer arrives.
  state = run([{ type: "SPECIES_CHOSEN", speciesId: "species:moose" }, { type: "EVALUATION_STARTED", key: moose }], state);
  state = huntSessionReducer(state, { type: "EVALUATION_SUCCEEDED", key: deer, result: result("CLOSED") });
  assert.equal(state.evaluation.kind, "loading", "the late deer answer is dropped");
  assert.equal(currentResult(state, moose), null);
  state = huntSessionReducer(state, { type: "EVALUATION_SUCCEEDED", key: moose, result: result("CONDITIONAL") });
  assert.equal(currentResult(state, moose)?.regulation.status, "CONDITIONAL");
  assert.equal(currentResult(state, deer), null, "a result is never shown for other inputs");
});

test("a failure for an old question does not replace the current one", () => {
  const a = evaluationKey({ point: POINT, speciesId: "species:moose", date: "2026-09-22", answers: {} });
  const b = evaluationKey({ point: POINT, speciesId: "species:moose", date: "2026-09-23", answers: {} });
  let state = run([{ type: "EVALUATION_STARTED", key: a }, { type: "EVALUATION_STARTED", key: b }]);
  state = huntSessionReducer(state, { type: "EVALUATION_FAILED", key: a, message: "timeout" });
  assert.deepEqual(state.evaluation, { kind: "loading", key: b });
});

test("species, date and place each start a new hunt: answers and the old answer are cleared", () => {
  const answered = run([
    { type: "SPECIES_CHOSEN", speciesId: "species:white-tailed-deer" },
    { type: "ANSWERED", dimensionId: "RESIDENCY", value: "RESIDENT" },
    { type: "EVALUATION_STARTED", key: "k" },
    { type: "EVALUATION_SUCCEEDED", key: "k", result: result("CONDITIONAL") },
  ]);
  for (const event of [
    { type: "SPECIES_CHOSEN", speciesId: "species:moose" },
    { type: "DATE_CHOSEN", iso: "2026-11-10" },
    { type: "LOCATION_CHANGED" },
  ] as HuntSessionEvent[]) {
    const after = huntSessionReducer(answered, event);
    assert.deepEqual(after.answers, {}, `${event.type} clears the answers`);
    assert.deepEqual(after.evaluation, { kind: "idle" }, `${event.type} clears the answer`);
  }
});

test("choosing the same species or day again changes nothing", () => {
  const state = run([{ type: "SPECIES_CHOSEN", speciesId: "species:moose" }, { type: "ANSWERED", dimensionId: "RESIDENCY", value: "RESIDENT" }]);
  assert.equal(huntSessionReducer(state, { type: "SPECIES_CHOSEN", speciesId: "species:moose" }), state);
  const dated = huntSessionReducer(state, { type: "DATE_CHOSEN", iso: "2026-10-01" });
  assert.equal(huntSessionReducer(dated, { type: "DATE_CHOSEN", iso: "2026-10-01" }), dated);
});

test("the device's own today replaces only the server's default, never a chosen day", () => {
  const corrected = huntSessionReducer(start, { type: "DEFAULT_DATE_CORRECTED", iso: "2026-09-21" });
  assert.deepEqual(corrected.date, { iso: "2026-09-21", explicit: false });
  const linked = initialSession({ speciesId: null, date: "2026-11-10", dateExplicit: true, explore: false });
  assert.equal(huntSessionReducer(linked, { type: "DEFAULT_DATE_CORRECTED", iso: "2026-09-21" }), linked);
});

test("explore needs a species to colour by", () => {
  assert.equal(huntSessionReducer(start, { type: "EXPLORE_SET", on: true }).explore, false);
  const withSpecies = run([{ type: "SPECIES_CHOSEN", speciesId: "species:moose" }, { type: "EXPLORE_SET", on: true }]);
  assert.equal(withSpecies.explore, true);
  assert.equal(huntSessionReducer(withSpecies, { type: "SPECIES_CLEARED" }).explore, false);
  assert.equal(initialSession({ speciesId: null, date: "2026-09-22", dateExplicit: false, explore: true }).explore, false);
});

test("evaluation keys ignore the order answers were given in, and nothing else", () => {
  const one = evaluationKey({ point: POINT, speciesId: "s", date: "d", answers: { RESIDENCY: "R", HUNT_METHOD: "BOW" } });
  const two = evaluationKey({ point: POINT, speciesId: "s", date: "d", answers: { HUNT_METHOD: "BOW", RESIDENCY: "R" } });
  assert.equal(one, two);
  assert.notEqual(one, evaluationKey({ point: POINT, speciesId: "s", date: "d", answers: { HUNT_METHOD: "RIFLE", RESIDENCY: "R" } }));
  assert.notEqual(one, evaluationKey({ point: { ...POINT, latitude: 45.06 }, speciesId: "s", date: "d", answers: { HUNT_METHOD: "BOW", RESIDENCY: "R" } }));
});

test("a thousand random edits never show a result for inputs other than the current ones", () => {
  let seed = 7;
  const next = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const species = ["species:moose", "species:white-tailed-deer", "species:ruffed-grouse"] as const;
  const dates = ["2026-09-22", "2026-10-01", "2026-11-10"];
  let state = start;
  const keyOf = (s: HuntSession) => s.speciesId ? evaluationKey({ point: POINT, speciesId: s.speciesId, date: s.date.iso, answers: s.answers }) : null;
  const issued: string[] = [];
  for (let step = 0; step < 1_000; step += 1) {
    const roll = next();
    let event: HuntSessionEvent;
    if (roll < 0.2) event = { type: "SPECIES_CHOSEN", speciesId: species[Math.floor(next() * species.length)] };
    else if (roll < 0.35) event = { type: "DATE_CHOSEN", iso: dates[Math.floor(next() * dates.length)] };
    else if (roll < 0.45) event = { type: "ANSWERED", dimensionId: "RESIDENCY", value: next() < 0.5 ? "RESIDENT" : "NON_RESIDENT" };
    else if (roll < 0.6 && keyOf(state)) { const key = keyOf(state)!; issued.push(key); event = { type: "EVALUATION_STARTED", key }; }
    else if (issued.length) {
      // Any previously issued request may answer at any time, in any order.
      const key = issued[Math.floor(next() * issued.length)];
      event = next() < 0.8
        ? { type: "EVALUATION_SUCCEEDED", key, result: result(key) }
        : { type: "EVALUATION_FAILED", key, message: "x" };
    } else continue;
    state = huntSessionReducer(state, event);
    if (state.evaluation.kind === "ready") {
      assert.equal(state.evaluation.key, (state.evaluation.result.regulation.status as string), "the result shown answers its own key");
    }
    const key = keyOf(state);
    const shown = currentResult(state, key);
    if (shown) assert.equal(shown.regulation.status, key);
  }
});

