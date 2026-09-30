#!/usr/bin/env node
/**
 * North Ground species habitat models: fitted, validated on ground they were
 * not fitted to, and published only if they pass a bar declared before the
 * fit. Certified into `content/intelligence/model-registry.json`.
 *
 *   node scripts/build-habitat-model.mjs --model ruffed-grouse [--research .research] [--report-only]
 *   node scripts/build-habitat-model.mjs --model moose
 *
 * WHAT A MODEL IS HERE (§41B). A species-specific, versioned relationship
 * between what covers the ground and the best measurement of the animal North
 * Ground holds, used to say something about ground that measurement does not
 * reach. It is never presented before measured evidence, never called a
 * density or a count, and never drawn where it was not tested.
 *
 * THERE IS NO GENERIC FORMULA. Each definition below names its own response,
 * its own predictors (chosen from the species' published habitat associations,
 * never tuned against the result), its own season, and its own bar. The
 * WEIGHTS are fitted, not judged, and every one is written into the artifact.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { auc, fitGlm, haversineKm, pointInPolygon, polygonAreaKm2, predictGlm, spearman, standardiser, youden } from "./lib/model-math.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const MODEL = flag("--model", null);
const RESEARCH = flag("--research", ".research");
const REPORT_ONLY = args.includes("--report-only");
const sha = (text) => `sha256:${createHash("sha256").update(text).digest("hex")}`;

/* ---------------- the land-cover foundation ---------------- */

const FOUNDATION_DIR = "content/intelligence/foundation";
const manifest = JSON.parse(readFileSync(join(FOUNDATION_DIR, "landcover-2019-0.1deg.json"), "utf8"));
const rawFoundation = readFileSync(join(FOUNDATION_DIR, manifest.artifact.file));
if (sha(rawFoundation) !== manifest.artifact.sha256) throw new Error("land-cover foundation does not match its manifest hash");
const shares = gunzipSync(rawFoundation);
const G = manifest.grid;
const GROUP = Object.fromEntries(manifest.groups.map((g, i) => [g.name, i]));
const NG = manifest.groups.length;
const cellOf = (lat, lon) => {
  const row = Math.floor((G.north - lat) / G.cell);
  const col = Math.floor((lon - G.west) / G.cell);
  return row >= 0 && row < G.rows && col >= 0 && col < G.columns ? { row, col } : null;
};
const share = (row, col, group) => shares[(row * G.columns + col) * NG + GROUP[group]] / 100;
const landShare = (row, col) => 1 - share(row, col, "SEA") - share(row, col, "NO_DATA");

/** Predictor values for one foundation cell, as shares of its land. */
function predictorsAt(row, col, predictors) {
  const land = landShare(row, col);
  if (land < 0.5) return null;
  return predictors.map((p) => p.groups.reduce((s, g) => s + share(row, col, g), 0) / land);
}

/** Mean predictors over foundation cells within `radiusKm` of a point. */
function predictorsNear(lat, lon, radiusKm, predictors) {
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const sum = new Array(predictors.length).fill(0);
  let n = 0;
  for (let la = lat - dLat; la <= lat + dLat + 1e-9; la += G.cell) {
    for (let lo = lon - dLon; lo <= lon + dLon + 1e-9; lo += G.cell) {
      const cell = cellOf(la, lo);
      if (!cell) continue;
      const cLat = G.north - (cell.row + 0.5) * G.cell;
      const cLon = G.west + (cell.col + 0.5) * G.cell;
      if (haversineKm(lat, lon, cLat, cLon) > radiusKm) continue;
      const values = predictorsAt(cell.row, cell.col, predictors);
      if (!values) continue;
      values.forEach((v, j) => { sum[j] += v; });
      n += 1;
    }
  }
  return n ? sum.map((v) => v / n) : null;
}

/* ---------------- model definitions ---------------- */

const FOREST_PREDICTORS = {
  broadleaf: { name: "Deciduous broadleaf forest", groups: ["BROADLEAF_CLOSED", "BROADLEAF_OPEN"] },
  mixed: { name: "Mixed forest", groups: ["MIXED_CLOSED", "MIXED_OPEN"] },
  needleleaf: { name: "Needleleaf forest", groups: ["NEEDLELEAF_CLOSED", "NEEDLELEAF_OPEN"] },
  shrub: { name: "Shrubland", groups: ["SHRUB"] },
  herbaceous: { name: "Grassland and herbaceous cover", groups: ["HERBACEOUS"] },
  cropland: { name: "Cropland", groups: ["CROPLAND"] },
  wetland: { name: "Herbaceous wetland", groups: ["HERBACEOUS_WETLAND"] },
  water: { name: "Open water", groups: ["WATER"] },
  built: { name: "Built-up land", groups: ["BUILT"] },
  treelessNorth: { name: "Moss, lichen, bare ground and ice", groups: ["MOSS_LICHEN", "BARE_SPARSE", "SNOW_ICE"] },
};

const MODELS = {
  "ruffed-grouse": {
    id: "model:north-ground-ruffed-grouse-habitat",
    version: "1.0.0",
    speciesId: "species:ruffed-grouse",
    /* The survey field already covers ground within reach of routes; this
       model speaks only where the field is silent. */
    role: "BEYOND_SURVEY_FIELD",
    season: {
      observedSeason: "June (the Breeding Bird Survey it is fitted to)",
      matchesHuntingSeason: false,
      warning: "Fitted to a June survey of a bird that does not migrate: where it breeds is where it lives in the autumn, but how many there are changes with the year's brood.",
    },
    literature: [
      "Rusch, D. H., S. Destefano, M. C. Reynolds and D. Lauten (2020). Ruffed Grouse (Bonasa umbellus), version 1.0. In Birds of the World (A. F. Poole, Ed.). Cornell Lab of Ornithology. — habitat: deciduous and mixed forest, especially aspen and young regenerating stands; absent from open grassland, cropland and tundra.",
    ],
    predictors: ["broadleaf", "mixed", "needleleaf", "shrub", "cropland", "wetland", "water", "built", "treelessNorth"],
    radiusKm: 25,
    lambda: 1,
    /* Declared before fitting. */
    bar: { detectionAuc: 0.8, abundanceSpearman: 0.25 },
    folds: 5,
    blockDegrees: 5,
    maxDistanceKm: 300,
  },
  moose: {
    id: "model:north-ground-moose-winter-habitat",
    version: "1.0.0",
    speciesId: "species:moose",
    role: "WITHIN_VALIDATED_DOMAIN",
    season: {
      observedSeason: "Winter (the aerial surveys it is fitted to)",
      matchesHuntingSeason: false,
      warning: "Fitted to winter aerial surveys. Moose move between summer and winter range, so where they are in the autumn hunt can differ.",
    },
    literature: [
      "Street, G. M., et al. and Alberta's own survey reports describe moose use of deciduous and mixed forest browse, shrubland and wetland margins, and avoidance of cropland-dominated and open prairie landscapes; the associations are qualitative and the weights here are fitted.",
    ],
    predictors: ["broadleaf", "mixed", "needleleaf", "shrub", "herbaceous", "cropland", "wetland", "water", "treelessNorth"],
    lambda: 2,
    bar: { crossValidatedSpearman: 0.5, externalSpearman: 0.3 },
    blockDegrees: 2,
    folds: 5,
  },
};

/* ---------------- shared evaluation ---------------- */

function blockFold(lat, lon, blockDegrees, folds) {
  const bx = Math.floor((lon + 180) / blockDegrees);
  const by = Math.floor((lat + 90) / blockDegrees);
  return (bx * 7 + by * 3) % folds;
}

function rankAgainst(reference) {
  const sorted = [...reference].sort((a, b) => a - b);
  return (value) => {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] <= value) lo = mid + 1; else hi = mid; }
    return Math.max(0, Math.min(1000, Math.round((1000 * lo) / sorted.length)));
  };
}

/* ---------------- ruffed grouse: fitted to routes, painted beyond the field ---------------- */

function grouse(def) {
  const routes = JSON.parse(readFileSync(join(RESEARCH, "bbs-routes", "ruffed-grouse.json"), "utf8"));
  const predictors = def.predictors.map((key) => FOREST_PREDICTORS[key]);
  const data = [];
  for (const [lat, lon, count, years] of routes.sites) {
    const x = predictorsNear(lat, lon, def.radiusKm, predictors);
    if (x) data.push({ lat, lon, count, years, x });
  }
  const detected = (d) => d.count > 0;
  const fit = (rows) => {
    const st = standardiser(rows.map((d) => d.x));
    const logit = fitGlm(rows.map((d) => st.apply(d.x)), rows.map((d) => (detected(d) ? 1 : 0)), { family: "binomial", lambda: def.lambda, weights: rows.map((d) => d.years) });
    const pos = rows.filter(detected);
    const pois = fitGlm(pos.map((d) => st.apply(d.x)), pos.map((d) => d.count), { family: "poisson", lambda: def.lambda, weights: pos.map((d) => d.years) });
    return { st, logit, pois };
  };
  /* Held out by 5° blocks: every route is predicted by a model that saw no route in its block. */
  const heldP = new Array(data.length);
  const heldC = new Array(data.length);
  for (let f = 0; f < def.folds; f += 1) {
    const train = data.filter((d) => blockFold(d.lat, d.lon, def.blockDegrees, def.folds) !== f);
    const m = fit(train);
    data.forEach((d, i) => {
      if (blockFold(d.lat, d.lon, def.blockDegrees, def.folds) !== f) return;
      const x = m.st.apply(d.x);
      heldP[i] = predictGlm(m.logit, x, "binomial");
      heldC[i] = predictGlm(m.pois, x, "poisson");
    });
  }
  const labels = data.map((d) => (detected(d) ? 1 : 0));
  const detectionAuc = auc(heldP, labels);
  const det = data.map((d, i) => [d, i]).filter(([d]) => detected(d));
  const abundanceSpearman = spearman(det.map(([, i]) => heldC[i]), det.map(([d]) => d.count));
  const threshold = youden(heldP, labels);
  const validation = {
    method: `Held out by ${def.blockDegrees}° blocks in ${def.folds} folds: each route predicted by a model fitted without any route in its block.`,
    routes: data.length,
    detected: det.length,
    detectionAuc: Number(detectionAuc.toFixed(3)),
    abundanceSpearman: Number(abundanceSpearman.toFixed(3)),
    threshold: Number(threshold.threshold.toFixed(4)),
    youdenJ: Number(threshold.j.toFixed(3)),
    bar: def.bar,
  };
  validation.passed = validation.detectionAuc >= def.bar.detectionAuc && validation.abundanceSpearman >= def.bar.abundanceSpearman;
  const full = fit(data);
  return { data, predictors, validation, full, detectedCounts: det.map(([d]) => d.count), routeFile: sha(readFileSync(join(RESEARCH, "bbs-routes", "ruffed-grouse.json"))) };
}

function paintGrouse(def, fitted) {
  const field = JSON.parse(readFileSync("content/intelligence/surfaces/ruffed-grouse.json", "utf8"));
  const grid = field.grid;
  const supported = new Set(field.cells.row.map((r, i) => r * grid.cols + field.cells.col[i]));
  const env = fitted.predictors.map((_, j) => {
    const values = fitted.data.map((d) => d.x[j]).sort((a, b) => a - b);
    return [values[0], values[values.length - 1]];
  });
  const routes = fitted.data;
  const rank = rankAgainst(fitted.detectedCounts);
  const cells = { row: [], col: [], intensity: [] };
  let considered = 0;
  for (let r = 0; r < grid.rows; r += 1) {
    const lat = grid.south + (r + 0.5) * grid.latStep;
    for (let c = 0; c < grid.cols; c += 1) {
      if (supported.has(r * grid.cols + c)) continue;
      const lon = grid.west + (c + 0.5) * grid.lonStep;
      const x = predictorsNear(lat, lon, Math.max(15, (grid.latStep * 111) / 2), fitted.predictors);
      if (!x) continue;
      if (x.some((v, j) => v < env[j][0] || v > env[j][1])) continue;
      let near = Infinity;
      for (const d of routes) { if (Math.abs(d.lat - lat) > 3 || Math.abs(d.lon - lon) > 6) continue; near = Math.min(near, haversineKm(lat, lon, d.lat, d.lon)); }
      if (near > def.maxDistanceKm) continue;
      considered += 1;
      const z = fitted.full.st.apply(x);
      const p = predictGlm(fitted.full.logit, z, "binomial");
      if (p < fitted.validation.threshold) continue;
      cells.row.push(r);
      cells.col.push(c);
      cells.intensity.push(rank(predictGlm(fitted.full.pois, z, "poisson")));
    }
  }
  return { grid, cells, considered };
}

/* ---------------- moose: fitted to Alberta's unit densities ---------------- */

function unitsFrom(file) {
  return JSON.parse(readFileSync(join(RESEARCH, "units", file), "utf8")).units;
}

function unitMeans(unit, predictors) {
  const sum = new Array(predictors.length).fill(0);
  let n = 0;
  const cells = [];
  for (const polygon of unit.polygons) {
    const xs = polygon[0].map(([x]) => x);
    const ys = polygon[0].map(([, y]) => y);
    for (let lat = Math.floor(Math.min(...ys) / G.cell) * G.cell + G.cell / 2; lat <= Math.max(...ys); lat += G.cell) {
      for (let lon = Math.floor(Math.min(...xs) / G.cell) * G.cell + G.cell / 2; lon <= Math.max(...xs); lon += G.cell) {
        if (!pointInPolygon(lon, lat, polygon)) continue;
        const cell = cellOf(lat, lon);
        if (!cell) continue;
        const x = predictorsAt(cell.row, cell.col, predictors);
        if (!x) continue;
        x.forEach((v, j) => { sum[j] += v; });
        n += 1;
        cells.push(cell);
      }
    }
  }
  return n ? { x: sum.map((v) => v / n), cells } : null;
}

function moose(def) {
  const predictors = def.predictors.map((key) => FOREST_PREDICTORS[key]);
  const bundle = JSON.parse(readFileSync("content/intelligence/ca-ab-moose-aerial-survey.json", "utf8"));
  const units = new Map(unitsFrom("ca-ab-wmu.json").map((u) => [u.designation, u]));
  const data = [];
  for (const record of bundle.evidence) {
    if (typeof record.normalizedValue !== "number") continue; // conflicts and part-of-unit figures are not training truth
    const designation = record.geographyId.replace("management_zone:ca-ab-wmu-", "");
    const unit = units.get(designation);
    if (!unit) continue;
    const m = unitMeans(unit, predictors);
    if (!m) continue;
    const centre = unit.polygons[0][0].reduce((s, [x, y]) => [s[0] + x, s[1] + y], [0, 0]).map((v) => v / unit.polygons[0][0].length);
    data.push({ designation, density: record.rawValue, x: m.x, lon: centre[0], lat: centre[1] });
  }
  const fit = (rows) => {
    const st = standardiser(rows.map((d) => d.x));
    const beta = fitGlm(rows.map((d) => st.apply(d.x)), rows.map((d) => Math.log(d.density)), { family: "gaussian", lambda: def.lambda });
    return { st, beta };
  };
  const loo = data.map((d, i) => {
    const m = fit(data.filter((_, k) => k !== i));
    return predictGlm(m.beta, m.st.apply(d.x), "gaussian");
  });
  const blocked = new Array(data.length);
  for (let f = 0; f < def.folds; f += 1) {
    const train = data.filter((d) => blockFold(d.lat, d.lon, def.blockDegrees, def.folds) !== f);
    if (train.length === data.length) continue;
    const m = fit(train);
    data.forEach((d, i) => { if (blockFold(d.lat, d.lon, def.blockDegrees, def.folds) === f) blocked[i] = predictGlm(m.beta, m.st.apply(d.x), "gaussian"); });
  }
  const observed = data.map((d) => Math.log(d.density));
  const full = fit(data);
  /* External: the same model asked about Ontario's and British Columbia's units,
     ranked against their harvest per km². Harvest is hunting, not animals, so
     this can only fail a model, never certify a density. */
  const external = {};
  for (const [jurisdiction, file, bundleFile] of [["jurisdiction:ca-on", "ca-on-wmu.json", "ca-on-moose-harvest.json"], ["jurisdiction:ca-bc", "ca-bc-mu.json", "ca-bc-moose-harvest.json"]]) {
    if (!existsSync(join(RESEARCH, "units", file))) continue;
    const harvest = JSON.parse(readFileSync(join("content/intelligence", bundleFile), "utf8"));
    const unitsHere = new Map(unitsFrom(file).map((u) => [u.designation.toUpperCase(), u]));
    const pairs = [];
    for (const record of harvest.evidence) {
      if (record.metric !== "HARVEST_TOTAL" || typeof record.rawValue !== "number") continue;
      const designation = record.geographyId.replace(/^management_zone:ca-(on-wmu|bc-mu)-/, "").toUpperCase();
      const unit = unitsHere.get(designation);
      if (!unit) continue;
      const area = unit.polygons.reduce((s, p) => s + polygonAreaKm2(p), 0);
      const m = unitMeans(unit, predictors);
      if (!m || area < 50) continue;
      pairs.push([predictGlm(full.beta, full.st.apply(m.x), "gaussian"), record.rawValue / area]);
    }
    const rho = spearman(pairs.map(([p]) => p), pairs.map(([, h]) => h));
    external[jurisdiction] = { units: pairs.length, spearmanWithHarvestPerKm2: rho === null ? null : Number(rho.toFixed(3)) };
  }
  const validation = {
    method: `Leave one unit out, and held out by ${def.blockDegrees}° blocks in ${def.folds} folds, against log winter density. External: predicted unit means ranked against Ontario's and British Columbia's moose harvest per km².`,
    units: data.length,
    leaveOneOutSpearman: Number(spearman(loo, observed).toFixed(3)),
    blockedSpearman: Number(spearman(blocked.filter((v) => v !== undefined), observed.filter((_, i) => blocked[i] !== undefined)).toFixed(3)),
    external,
    bar: def.bar,
  };
  validation.passed = validation.blockedSpearman >= def.bar.crossValidatedSpearman && validation.leaveOneOutSpearman >= def.bar.crossValidatedSpearman;
  validation.paintedJurisdictions = ["jurisdiction:ca-ab", ...Object.entries(external).filter(([, e]) => (e.spearmanWithHarvestPerKm2 ?? -1) >= def.bar.externalSpearman).map(([j]) => j)];
  return { data, predictors, full, validation };
}

function paintMoose(def, fitted) {
  const env = fitted.predictors.map((_, j) => {
    const values = fitted.data.map((d) => d.x[j]).sort((a, b) => a - b);
    return [values[0], values[values.length - 1]];
  });
  const rank = rankAgainst(fitted.data.map((d) => d.density));
  const files = { "jurisdiction:ca-ab": "ca-ab-wmu.json", "jurisdiction:ca-on": "ca-on-wmu.json", "jurisdiction:ca-bc": "ca-bc-mu.json" };
  const cells = new Map();
  for (const jurisdiction of fitted.validation.paintedJurisdictions) {
    for (const unit of unitsFrom(files[jurisdiction])) {
      const m = unitMeans(unit, fitted.predictors);
      if (!m) continue;
      for (const { row, col } of m.cells) {
        const x = predictorsAt(row, col, fitted.predictors);
        if (!x || x.some((v, j) => v < env[j][0] || v > env[j][1])) continue;
        const value = Math.exp(predictGlm(fitted.full.beta, fitted.full.st.apply(x), "gaussian"));
        cells.set(row * G.columns + col, rank(value));
      }
    }
  }
  /* The foundation grid, re-expressed south-up like every other raster. */
  const grid = { latStep: G.cell, lonStep: G.cell, south: G.south, west: G.west, rows: G.rows, cols: G.columns };
  const out = { row: [], col: [], intensity: [] };
  for (const [key, intensity] of [...cells].sort((a, b) => a[0] - b[0])) {
    const northRow = Math.floor(key / G.columns);
    out.row.push(G.rows - 1 - northRow);
    out.col.push(key % G.columns);
    out.intensity.push(intensity);
  }
  return { grid, cells: out };
}

/* ---------------- run ---------------- */

const def = MODELS[MODEL];
if (!def) throw new Error(`--model must be one of ${Object.keys(MODELS).join(", ")}`);
const fitted = MODEL === "ruffed-grouse" ? grouse(def) : moose(def);
process.stdout.write(`${def.id} v${def.version}\n${JSON.stringify(fitted.validation, null, 2)}\n`);
const coefficients = def.predictors.map((key, j) => ({
  predictor: FOREST_PREDICTORS[key].name,
  sourceGroups: FOREST_PREDICTORS[key].groups,
  ...(fitted.full.logit
    ? { detection: Number((fitted.full.logit[j + 1] / fitted.full.st.sd[j]).toFixed(4)), abundance: Number((fitted.full.pois[j + 1] / fitted.full.st.sd[j]).toFixed(4)) }
    : { logDensity: Number((fitted.full.beta[j + 1] / fitted.full.st.sd[j]).toFixed(4)) }),
}));
const report = { model: def.id, version: def.version, speciesId: def.speciesId, validation: fitted.validation, coefficients };
mkdirSync("content/intelligence/models", { recursive: true });
writeFileSync(join("content/intelligence/models", `${MODEL}-validation.json`), `${JSON.stringify(report, null, 2)}\n`);
if (REPORT_ONLY || !fitted.validation.passed) {
  process.stdout.write(fitted.validation.passed ? "report only; nothing published\n" : "BELOW THE DECLARED BAR: nothing is published, and the report says why\n");
  process.exit(0);
}

const painted = MODEL === "ruffed-grouse" ? paintGrouse(def, fitted) : paintMoose(def, fitted);
const artifact = {
  id: `surface:${def.id.replace("model:", "")}-${def.version}`,
  speciesId: def.speciesId,
  metric: MODEL === "ruffed-grouse" ? "MODELLED_BIRDS_PER_ROUTE" : "MODELLED_WINTER_DENSITY_INDEX",
  unit: MODEL === "ruffed-grouse" ? "modelled birds per survey route" : "modelled index on Alberta's winter survey scale",
  sitesSurveyed: fitted.data.length,
  sitesDetected: MODEL === "ruffed-grouse" ? fitted.validation.detected : fitted.data.length,
  source: {
    authority: "North Ground (model)",
    title: `${def.id} v${def.version}`,
    url: "https://www.northgroundbushcraft.com/hunt",
    licence: "North Ground model output; inputs under CC0 1.0 (Breeding Bird Survey), CC BY 4.0 (Copernicus land cover) and the Open Government Licence – Alberta",
    attribution: `${manifest.source.attribution} ${MODEL === "ruffed-grouse" ? "Fitted to the North American Breeding Bird Survey (USGS and CWS, CC0)." : "Fitted to Alberta's aerial ungulate survey reports (Open Government Licence – Alberta)."}`,
    retrievedAt: new Date().toISOString().slice(0, 10),
    verifiedAt: new Date().toISOString().slice(0, 10),
  },
  limitations: MODEL === "ruffed-grouse"
    ? [
        "A model of where the land resembles ground where the survey finds ruffed grouse. It is not a count, not a survey and not presence.",
        "Drawn only beyond the survey field's reach, within 300 km of a survey route, and only where every land-cover share lies inside the range the model was fitted on.",
        "Land cover is from 2019 and does not know the age of a forest; young aspen and mature aspen look alike to it.",
        "Ground the model does not colour is ground it could not speak to, not ground it found empty.",
      ]
    : [
        "A model of winter moose habitat, scaled to Alberta's winter aerial survey densities. It is not a count, not a density measurement and not presence.",
        `Drawn only in the provinces where it held up: ${fitted.validation.paintedJurisdictions.map((j) => j.replace("jurisdiction:ca-", "").toUpperCase()).join(", ")}.`,
        "Fitted to one figure per unit, so the variation it draws inside a unit comes from the land cover alone; that is an inference, and it is labelled as one.",
        "Land cover is from 2019 and does not know the age of a forest, recent fire or harvest.",
      ],
  observationPeriod: MODEL === "ruffed-grouse" ? { from: "2016-01-01", through: "2025-12-31" } : { from: "2015-01-01", through: "2025-12-31" },
  methodology: { id: def.id, version: def.version },
  methodologyStatedAs: MODEL === "ruffed-grouse"
    ? `Logistic model of detection and Poisson model of count among detecting routes (ridge λ=${def.lambda}), on land-cover shares within ${def.radiusKm} km of each of ${fitted.validation.routes} Breeding Bird Survey routes. Held out by ${def.blockDegrees}° blocks: detection AUC ${fitted.validation.detectionAuc}, count Spearman ${fitted.validation.abundanceSpearman} (bar ${def.bar.detectionAuc} and ${def.bar.abundanceSpearman}, declared before fitting). A cell is coloured where predicted detection clears the held-out Youden threshold (${fitted.validation.threshold}).`
    : `Linear model of log winter density (ridge λ=${def.lambda}) on land-cover shares averaged over each of ${fitted.validation.units} Alberta units. Leave-one-out Spearman ${fitted.validation.leaveOneOutSpearman}, ${def.blockDegrees}° block Spearman ${fitted.validation.blockedSpearman} (bar ${def.bar.crossValidatedSpearman}, declared before fitting).`,
  scaleStatedAs: MODEL === "ruffed-grouse"
    ? "Beyond the survey's reach, a habitat model's prediction on the survey's own scale: red is where it predicts counts like the top tenth of routes that found grouse. Where land resembles grouse ground, not a count."
    : "A winter habitat model placed on Alberta's surveyed densities: red is where it predicts densities like the top tenth of surveyed units. Where land resembles winter moose ground, not a count.",
  season: def.season,
  model: {
    id: def.id,
    version: def.version,
    inputs: [
      { id: manifest.id, hash: manifest.artifact.sha256 },
      ...(MODEL === "ruffed-grouse" ? [{ id: "source:us-bbs-2026-release (per-route values)", hash: fitted.routeFile }] : [{ id: "content/intelligence/ca-ab-moose-aerial-survey.json", hash: sha(readFileSync("content/intelligence/ca-ab-moose-aerial-survey.json")) }]),
    ],
    literature: def.literature,
    coefficients,
    validation: fitted.validation,
  },
  grid: painted.grid,
  cells: painted.cells,
};
const text = `${JSON.stringify(artifact)}\n`;
const path = join("content/intelligence/models", `${MODEL}.json`);
writeFileSync(path, text);
const registryPath = "content/intelligence/model-registry.json";
const registry = JSON.parse(readFileSync(registryPath, "utf8"));
registry.surfaces = registry.surfaces.filter((entry) => entry.speciesId !== def.speciesId);
registry.surfaces.push({
  speciesId: def.speciesId,
  surfaceKind: "NORTH_GROUND_MODEL",
  evidenceClass: "NORTH_GROUND_MODEL",
  artifactId: artifact.id,
  artifactPath: path,
  artifactHash: sha(text),
  sourceDatasetId: def.id,
  metric: artifact.metric,
  unit: artifact.unit,
  effectiveResolutionMetres: MODEL === "ruffed-grouse" ? 25000 : 11000,
  effectiveResolutionStatedAs: MODEL === "ruffed-grouse"
    ? `Land cover averaged within about 25 km of each cell of the survey's ${painted.grid.lonStep}° × ${painted.grid.latStep}° grid`
    : "Land cover per 0.1° cell (about 11 km); fitted to whole-unit densities, so finer detail is the land cover's, not the survey's",
  season: def.season.observedSeason,
  matchesHuntingSeason: false,
  tier: "T4_DERIVED_HABITAT",
  grade: "D",
  methodologyId: def.id,
  methodologyVersion: def.version,
  interpolationPermitted: true,
  coverage: "PARTIAL_DATA",
  unmappedGround: "NO_EVIDENCE_HELD",
  sitesSurveyed: artifact.sitesSurveyed,
  sitesDetected: artifact.sitesDetected,
  supportedCells: painted.cells.row.length,
  surveyedAndNoneFound: 0,
});
registry.surfaces.sort((a, b) => a.speciesId.localeCompare(b.speciesId));
writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
process.stdout.write(`published ${path}: ${painted.cells.row.length} cells\n`);
