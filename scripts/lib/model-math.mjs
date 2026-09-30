/**
 * The arithmetic species habitat models are fitted and judged with. Small,
 * dependency-free and deterministic: the same inputs give the same model on
 * any machine, which is what "reproducible or unpublished" (§41B) requires.
 */

/** Solve A x = b by Gaussian elimination with partial pivoting. A is n×n. */
export function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let k = 0; k < n; k += 1) {
    let pivot = k;
    for (let i = k + 1; i < n; i += 1) if (Math.abs(M[i][k]) > Math.abs(M[pivot][k])) pivot = i;
    [M[k], M[pivot]] = [M[pivot], M[k]];
    const p = M[k][k];
    if (Math.abs(p) < 1e-12) throw new Error("singular system");
    for (let i = k + 1; i < n; i += 1) {
      const f = M[i][k] / p;
      if (!f) continue;
      for (let j = k; j <= n; j += 1) M[i][j] -= f * M[k][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i -= 1) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j += 1) sum -= M[i][j] * x[j];
    x[i] = sum / M[i][i];
  }
  return x;
}

/** Column means and standard deviations, and a function that standardises a row with them. */
export function standardiser(rows) {
  const k = rows[0].length;
  const mean = new Array(k).fill(0);
  const sd = new Array(k).fill(0);
  for (const row of rows) for (let j = 0; j < k; j += 1) mean[j] += row[j] / rows.length;
  for (const row of rows) for (let j = 0; j < k; j += 1) sd[j] += (row[j] - mean[j]) ** 2 / rows.length;
  for (let j = 0; j < k; j += 1) sd[j] = Math.sqrt(sd[j]) || 1;
  return { mean, sd, apply: (row) => [1, ...row.map((v, j) => (v - mean[j]) / sd[j])] };
}

/**
 * A generalised linear model with a ridge penalty on every coefficient but the
 * intercept, fitted by iteratively reweighted least squares.
 *
 * family: "binomial" (logit link), "poisson" (log link) or "gaussian" (identity).
 * `weights` are prior weights per observation (e.g. years a route was run).
 */
export function fitGlm(X, y, { family, lambda, weights, iterations = 50 }) {
  const n = X.length;
  const p = X[0].length;
  const w0 = weights ?? new Array(n).fill(1);
  let beta = new Array(p).fill(0);
  if (family === "poisson") beta[0] = Math.log(Math.max(1e-6, y.reduce((s, v, i) => s + v * w0[i], 0) / w0.reduce((s, v) => s + v, 0)));
  if (family === "binomial") {
    const m = y.reduce((s, v, i) => s + v * w0[i], 0) / w0.reduce((s, v) => s + v, 0);
    beta[0] = Math.log(Math.max(1e-6, m) / Math.max(1e-6, 1 - m));
  }
  for (let it = 0; it < iterations; it += 1) {
    const A = Array.from({ length: p }, () => new Array(p).fill(0));
    const b = new Array(p).fill(0);
    for (let i = 0; i < n; i += 1) {
      const eta = X[i].reduce((s, v, j) => s + v * beta[j], 0);
      let mu;
      let wi;
      let z;
      if (family === "binomial") {
        mu = 1 / (1 + Math.exp(-eta));
        wi = Math.max(mu * (1 - mu), 1e-9);
        z = eta + (y[i] - mu) / wi;
      } else if (family === "poisson") {
        mu = Math.exp(Math.min(eta, 30));
        wi = Math.max(mu, 1e-9);
        z = eta + (y[i] - mu) / wi;
      } else {
        wi = 1;
        z = y[i];
      }
      const weight = wi * w0[i];
      for (let j = 0; j < p; j += 1) {
        b[j] += weight * X[i][j] * z;
        for (let k = 0; k < p; k += 1) A[j][k] += weight * X[i][j] * X[i][k];
      }
    }
    for (let j = 1; j < p; j += 1) A[j][j] += lambda;
    const next = solve(A, b);
    const change = next.reduce((s, v, j) => Math.max(s, Math.abs(v - beta[j])), 0);
    beta = next;
    if (family === "gaussian" || change < 1e-9) break;
  }
  return beta;
}

export function predictGlm(beta, x, family) {
  const eta = x.reduce((s, v, j) => s + v * beta[j], 0);
  if (family === "binomial") return 1 / (1 + Math.exp(-eta));
  if (family === "poisson") return Math.exp(Math.min(eta, 30));
  return eta;
}

/** Area under the ROC curve: the chance a random positive outranks a random negative. */
export function auc(scores, labels) {
  const pairs = scores.map((s, i) => [s, labels[i]]).sort((a, b) => a[0] - b[0]);
  let rank = 0;
  let positives = 0;
  let sumRanks = 0;
  for (let i = 0; i < pairs.length;) {
    let j = i;
    while (j < pairs.length && pairs[j][0] === pairs[i][0]) j += 1;
    const mid = (i + 1 + j) / 2;
    for (let k = i; k < j; k += 1) if (pairs[k][1]) { positives += 1; sumRanks += mid; }
    rank = j;
    i = j;
  }
  const negatives = pairs.length - positives;
  if (!positives || !negatives) return null;
  return (sumRanks - (positives * (positives + 1)) / 2) / (positives * negatives);
}

function ranks(values) {
  const order = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const out = new Array(values.length);
  for (let i = 0; i < order.length;) {
    let j = i;
    while (j < order.length && order[j][0] === order[i][0]) j += 1;
    for (let k = i; k < j; k += 1) out[order[k][1]] = (i + j + 1) / 2;
    i = j;
  }
  return out;
}

/** Spearman's rank correlation, ties at mid-rank. */
export function spearman(a, b) {
  if (a.length < 3) return null;
  const ra = ranks(a);
  const rb = ranks(b);
  const mean = (ra.length + 1) / 2;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < ra.length; i += 1) {
    num += (ra[i] - mean) * (rb[i] - mean);
    da += (ra[i] - mean) ** 2;
    db += (rb[i] - mean) ** 2;
  }
  return num / Math.sqrt(da * db);
}

/** The threshold that maximises sensitivity + specificity − 1 (Youden's J). */
export function youden(scores, labels) {
  const candidates = [...new Set(scores)].sort((a, b) => a - b);
  const positives = labels.filter(Boolean).length;
  const negatives = labels.length - positives;
  let best = { threshold: 0.5, j: -1 };
  for (const t of candidates) {
    let tp = 0;
    let tn = 0;
    for (let i = 0; i < scores.length; i += 1) {
      if (scores[i] >= t && labels[i]) tp += 1;
      if (scores[i] < t && !labels[i]) tn += 1;
    }
    const j = tp / positives + tn / negatives - 1;
    if (j > best.j) best = { threshold: t, j };
  }
  return best;
}

/** Great-circle distance in km. */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

/** Whether a point is inside a polygon given as rings of [lon, lat] (even-odd). */
export function pointInPolygon(lon, lat, rings) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** A polygon's area in km², on a local equal-area approximation adequate for a unit. */
export function polygonAreaKm2(rings) {
  let area = 0;
  for (const ring of rings) {
    const lat0 = ring.reduce((s, [, y]) => s + y, 0) / ring.length;
    const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180);
    const ky = 110.57;
    let a = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * kx * ring[i][1] * ky - ring[i][0] * kx * ring[j][1] * ky;
    area += a / 2;
  }
  return Math.abs(area);
}
