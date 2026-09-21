#!/usr/bin/env node
/**
 * Certify Hunt against real places, through the same endpoints a person uses.
 *
 *   node scripts/certify-hunt-cases.mjs --base https://www.northgroundbushcraft.com \
 *     --cases fixtures/hunt/ca-mb-certification-cases.json [--out <record.json>]
 *
 * Every case's expected answer is written from the law before the case is run
 * (the cases file says how). This script only asks and compares: a case that
 * disagrees is a finding, and the run exits 1.
 *
 * It also measures what a person waits for: the zone lookup and the full
 * evaluation for each case, and the map geometry for the jurisdiction's
 * viewports at three zooms, with payload sizes. Requests are spaced to stay
 * inside the endpoints' own rate limits.
 */

import { readFileSync, writeFileSync } from "node:fs";

const flag = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
const base = flag("--base")?.replace(/\/$/, "");
const casesPath = flag("--cases");
const out = flag("--out");
if (!base || !casesPath) {
  console.error("Usage: node scripts/certify-hunt-cases.mjs --base <url> --cases <cases.json> [--out <record.json>]");
  process.exit(1);
}

const { cases, jurisdiction, viewports = [] } = JSON.parse(readFileSync(casesPath, "utf8"));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function timed(path, init) {
  const started = performance.now();
  const response = await fetch(`${base}${path}`, { ...init, signal: AbortSignal.timeout(30_000) });
  const text = await response.text();
  return { status: response.status, ms: Math.round(performance.now() - started), bytes: Buffer.byteLength(text), body: text ? JSON.parse(text) : null };
}

const post = (path, body) => timed(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

const designation = (officialName) => officialName?.match(/(?:Game Hunting Area|Wildlife Management Unit|Zone de chasse) (\S+)$/)?.[1]?.toUpperCase() ?? null;

const results = [];
for (const item of cases) {
  const zone = await post("/api/hunt/zone", { latitude: item.latitude, longitude: item.longitude });
  const evaluation = await post("/api/hunt/evaluate", {
    latitude: item.latitude, longitude: item.longitude, date: item.date, speciesId: item.speciesId,
    ...(item.answers ? { answers: item.answers } : {}),
  });
  // The evaluate endpoint allows 30 a minute; stay well inside it.
  await pause(2_200);

  const result = evaluation.body ?? {};
  const regulation = result.regulation ?? {};
  const actual = {
    httpStatus: evaluation.status,
    gha: designation(result.zone?.officialName),
    zoneName: result.zone?.officialName ?? null,
    status: result.completeness === "NEEDS_INPUT" ? undefined : regulation.status,
    completeness: result.completeness,
    required: result.required?.id,
    nearBoundary: result.zone?.nearBoundary ?? false,
    daily: regulation.limits?.daily,
    possession: regulation.limits?.possession,
  };
  const text = JSON.stringify([regulation.summary, regulation.requirements, regulation.limitations]);
  const failures = [];
  const expect = item.expect;
  if (evaluation.status !== 200) failures.push(`HTTP ${evaluation.status}: ${JSON.stringify(result).slice(0, 200)}`);
  if ("gha" in expect && expect.gha !== null && actual.gha !== expect.gha) failures.push(`zone ${actual.gha} (expected GHA ${expect.gha})`);
  if (expect.zoneName && actual.zoneName !== expect.zoneName) failures.push(`zone "${actual.zoneName}"`);
  for (const key of ["status", "completeness", "required", "nearBoundary", "daily", "possession"]) {
    if (key in expect && actual[key] !== expect[key]) failures.push(`${key} ${actual[key]} (expected ${expect[key]})`);
  }
  for (const phrase of expect.mentions ?? []) {
    if (!text.includes(phrase)) failures.push(`does not mention "${phrase}"`);
  }
  for (const phrase of expect.absent ?? []) {
    if (text.includes(phrase)) failures.push(`mentions "${phrase}", which must be absent`);
  }
  /* Inside a territory closed to all hunting nothing may read as a season. */
  if (expect.noSeason && (regulation.season || regulation.limits || regulation.legalTime?.status === "RULE_ONLY")) {
    failures.push("states a season, bag limit or legal hours");
  }
  /* The sources that decided the answer (the rules' and the boundary's) must
     all be the jurisdiction's own; a field note's supporting page is not. */
  if (expect.authorityPrefix) {
    const decisive = new Set([...(regulation.sourceIds ?? []), result.zone?.sourceId].filter(Boolean));
    const foreign = [...decisive].filter((id) => !id.startsWith(expect.authorityPrefix));
    if (foreign.length) failures.push(`authority includes ${foreign.join(", ")}`);
  }
  results.push({
    id: item.id, place: item.place, date: item.date, speciesId: item.speciesId,
    expected: expect, actual, summary: regulation.summary,
    passed: failures.length === 0, failures,
    timing: { zoneMs: zone.ms, zoneBytes: zone.bytes, evaluateMs: evaluation.ms, evaluateBytes: evaluation.bytes },
  });
  console.log(`${failures.length ? "FAIL" : "pass"}  ${item.id.padEnd(40)} ${String(actual.status ?? `ASK ${actual.required}`).padEnd(20)} zone ${String(zone.ms).padStart(5)} ms, answer ${String(evaluation.ms).padStart(5)} ms  ${failures.join("; ")}`);
}

/* Map geometry: what the map downloads for this jurisdiction's viewports. */
const geometry = [];
for (const viewport of viewports) {
  const response = await timed(`/api/hunt/zones?bounds=${viewport.bounds}&zoom=${viewport.zoom}`);
  const features = response.body?.features ?? [];
  geometry.push({
    label: viewport.label, zoom: viewport.zoom, status: response.body?.status, ms: response.ms, bytes: response.bytes,
    features: features.length,
    byLayer: Object.fromEntries([...new Set(features.map((feature) => feature.layerId))].map((id) => [id, features.filter((feature) => feature.layerId === id).length])),
  });
  console.log(`map   ${viewport.label.padEnd(40)} ${String(response.body?.status).padEnd(8)} ${String(features.length).padStart(4)} features ${String(Math.round(response.bytes / 1024)).padStart(5)} KB ${String(response.ms).padStart(5)} ms`);
  await pause(600);
}

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
};
const zoneTimes = results.map((result) => result.timing.zoneMs);
const evaluateTimes = results.map((result) => result.timing.evaluateMs);
const evaluateBytes = results.map((result) => result.timing.evaluateBytes);
const summary = {
  passed: results.filter((result) => result.passed).length,
  failed: results.filter((result) => !result.passed).length,
  zoneLookupMs: { median: percentile(zoneTimes, 0.5), p90: percentile(zoneTimes, 0.9), max: Math.max(...zoneTimes) },
  evaluationMs: { median: percentile(evaluateTimes, 0.5), p90: percentile(evaluateTimes, 0.9), max: Math.max(...evaluateTimes) },
  evaluationBytes: { median: percentile(evaluateBytes, 0.5), max: Math.max(...evaluateBytes) },
};
console.log(`\n${summary.passed} of ${results.length} cases agree with the law.`);
console.log(`zone lookup  median ${summary.zoneLookupMs.median} ms, p90 ${summary.zoneLookupMs.p90} ms`);
console.log(`evaluation   median ${summary.evaluationMs.median} ms, p90 ${summary.evaluationMs.p90} ms; payload median ${Math.round(summary.evaluationBytes.median / 1024)} KB`);

if (out) {
  writeFileSync(out, `${JSON.stringify({ jurisdiction, base, certifiedAt: new Date().toISOString(), summary, geometry, results }, null, 2)}\n`);
  console.log(`Recorded ${out}`);
}
process.exit(summary.failed ? 1 : 0);
