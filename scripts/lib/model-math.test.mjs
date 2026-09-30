import assert from "node:assert/strict";
import test from "node:test";
import { auc, fitGlm, haversineKm, pointInPolygon, polygonAreaKm2, predictGlm, spearman, standardiser, youden } from "./model-math.mjs";

/* A small deterministic generator, so these tests never depend on Math.random. */
function lcg(seed) {
  let state = seed >>> 0;
  return () => ((state = (1664525 * state + 1013904223) >>> 0) / 2 ** 32);
}

test("AUC and Spearman agree with hand-computed cases", () => {
  assert.equal(auc([0.1, 0.2, 0.8, 0.9], [0, 0, 1, 1]), 1);
  assert.equal(auc([0.9, 0.8, 0.2, 0.1], [0, 0, 1, 1]), 0);
  assert.equal(auc([0.5, 0.5, 0.5, 0.5], [0, 1, 0, 1]), 0.5, "ties count half");
  assert.equal(auc([1, 2, 3], [1, 1, 1]), null, "no negatives, no AUC");
  assert.equal(spearman([1, 2, 3, 4], [10, 20, 30, 40]), 1);
  assert.equal(spearman([1, 2, 3, 4], [4, 3, 2, 1]), -1);
  assert.equal(spearman([1, 2], [1, 2]), null, "too few to rank");
});

test("a logistic fit recovers the sign and rough size of a known effect", () => {
  const random = lcg(7);
  const rows = [];
  const labels = [];
  for (let i = 0; i < 2000; i += 1) {
    const x = [random(), random()];
    const p = 1 / (1 + Math.exp(-(-1 + 3 * x[0] - 2 * x[1])));
    rows.push(x);
    labels.push(random() < p ? 1 : 0);
  }
  const st = standardiser(rows);
  const beta = fitGlm(rows.map(st.apply), labels, { family: "binomial", lambda: 0.01 });
  const perUnit = [beta[1] / st.sd[0], beta[2] / st.sd[1]];
  assert.ok(Math.abs(perUnit[0] - 3) < 0.6, `x0 effect ${perUnit[0]}`);
  assert.ok(Math.abs(perUnit[1] + 2) < 0.6, `x1 effect ${perUnit[1]}`);
  const scores = rows.map((x) => predictGlm(beta, st.apply(x), "binomial"));
  assert.ok(auc(scores, labels) > 0.7);
  const cut = youden(scores, labels);
  assert.ok(cut.threshold > 0 && cut.threshold < 1 && cut.j > 0);
});

test("a ridge penalty shrinks, and never touches the intercept", () => {
  const rows = [[0], [1], [2], [3], [4], [5]];
  const y = [1, 3, 5, 7, 9, 11];
  const st = standardiser(rows);
  const loose = fitGlm(rows.map(st.apply), y, { family: "gaussian", lambda: 0 });
  const tight = fitGlm(rows.map(st.apply), y, { family: "gaussian", lambda: 100 });
  assert.ok(Math.abs(loose[1] / st.sd[0] - 2) < 1e-9, "unpenalised least squares is exact");
  assert.ok(Math.abs(tight[1]) < Math.abs(loose[1]), "the slope shrinks");
  assert.ok(Math.abs(tight[0] - 6) < 1e-9 && Math.abs(loose[0] - 6) < 1e-9, "the intercept is the mean either way");
});

test("a Poisson fit recovers a rate", () => {
  const random = lcg(11);
  const rows = [];
  const counts = [];
  for (let i = 0; i < 3000; i += 1) {
    const x = [random()];
    const mu = Math.exp(0.5 + 1.5 * x[0]);
    /* Knuth's method, deterministic under the generator. */
    let k = 0;
    let p = 1;
    const limit = Math.exp(-mu);
    do { k += 1; p *= random(); } while (p > limit);
    rows.push(x);
    counts.push(k - 1);
  }
  const st = standardiser(rows);
  const beta = fitGlm(rows.map(st.apply), counts, { family: "poisson", lambda: 0.01 });
  assert.ok(Math.abs(beta[1] / st.sd[0] - 1.5) < 0.2, `slope ${beta[1] / st.sd[0]}`);
});

test("geometry helpers", () => {
  assert.ok(Math.abs(haversineKm(45, -75, 46, -75) - 111.2) < 0.5);
  const square = [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]];
  assert.equal(pointInPolygon(0.5, 0.5, square), true);
  assert.equal(pointInPolygon(1.5, 0.5, square), false);
  const withHole = [square[0], [[0.25, 0.25], [0.75, 0.25], [0.75, 0.75], [0.25, 0.75], [0.25, 0.25]]];
  assert.equal(pointInPolygon(0.5, 0.5, withHole), false, "a hole is not inside");
  /* One degree square at the equator is about 111.3 × 110.6 km. */
  assert.ok(Math.abs(polygonAreaKm2(square) - 12309) < 150);
});
