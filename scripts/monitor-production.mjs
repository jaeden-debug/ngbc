#!/usr/bin/env node
/**
 * Is production answering, and answering the right thing?
 *
 * A synthetic check run on a schedule from outside Vercel (CLAUDE.md §58: a
 * source silently failing for six months is unacceptable, and so is the site).
 * Each check asks production a question whose answer is known not to change
 * with the date — a page renders, a point resolves to its official zone, the
 * engine returns a well-formed answer — and records how long it took.
 *
 * It deliberately does NOT assert a season's status: that turns on the date and
 * the rules, and a monitor that pins one is a monitor that pages someone the
 * day a season closes. Shape and vocabulary are asserted; legality is the
 * engine's tests' job.
 *
 *   node scripts/monitor-production.mjs [--base https://www.northgroundbushcraft.com] [--json report.json]
 *
 * Exit 1 when any check fails. Slow-but-correct is reported, not failed.
 */

import { writeFile } from "node:fs/promises";

const argument = (name, fallback) =>
  process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback;
const base = argument("--base", "https://www.northgroundbushcraft.com").replace(/\/$/, "");
const jsonOut = argument("--json", null);
const TIMEOUT_MS = 20_000;
const SLOW_MS = 5_000;

/* The API refuses any origin but its own canonical one, as a browser would send. */
const apiHeaders = { origin: base, "content-type": "application/json", "user-agent": "north-ground-production-monitor" };
const today = new Date().toISOString().slice(0, 10);

/* Maniwaki, Québec: inside Zone de chasse 10O, far from its boundary. */
const MANIWAKI = { latitude: 46.375, longitude: -75.966, zoneId: "management_zone:ca-qc-zone-10o" };
const REGULATORY_STATUSES = new Set(["OPEN", "CLOSED", "CONDITIONAL", "UNKNOWN", "CONFLICT", "NEEDS_VERIFICATION"]);

const checks = [
  {
    name: "Homepage renders",
    request: () => fetch(`${base}/`),
    verify: async (response) => {
      expectStatus(response, 200);
      const html = await response.text();
      if (!html.includes("North Ground")) throw new Error("the page does not name North Ground");
    },
  },
  {
    name: "Hunt renders",
    request: () => fetch(`${base}/hunt`),
    verify: async (response) => {
      expectStatus(response, 200);
      if (!(await response.text()).includes("<main")) throw new Error("no <main> in the Hunt page");
    },
  },
  {
    name: "Species profile renders",
    request: () => fetch(`${base}/hunting/species/white-tailed-deer`),
    verify: async (response) => expectStatus(response, 200),
  },
  {
    name: "Sitemap is served",
    request: () => fetch(`${base}/sitemap.xml`),
    verify: async (response) => {
      expectStatus(response, 200);
      if (!(await response.text()).includes("<urlset")) throw new Error("not a sitemap");
    },
  },
  {
    name: "A point resolves to its official zone",
    request: () =>
      fetch(`${base}/api/hunt/zone`, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({ latitude: MANIWAKI.latitude, longitude: MANIWAKI.longitude }),
      }),
    verify: async (response) => {
      expectStatus(response, 200);
      const body = await response.json();
      if (body.status !== "RESOLVED") throw new Error(`zone status ${body.status}: ${body.message ?? ""}`);
      if (body.zone?.id !== MANIWAKI.zoneId) throw new Error(`resolved to ${body.zone?.id}, expected ${MANIWAKI.zoneId}`);
    },
  },
  {
    name: "The engine answers a Hunt",
    request: () =>
      fetch(`${base}/api/hunt/evaluate`, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({
          latitude: MANIWAKI.latitude,
          longitude: MANIWAKI.longitude,
          date: today,
          speciesId: "species:white-tailed-deer",
        }),
      }),
    verify: async (response) => {
      expectStatus(response, 200);
      const body = await response.json();
      if (body.zone?.status !== "RESOLVED" || body.zone?.zoneId !== MANIWAKI.zoneId) {
        throw new Error(`zone ${body.zone?.status} ${body.zone?.zoneId}`);
      }
      if (!REGULATORY_STATUSES.has(body.regulation?.status)) {
        throw new Error(`regulatory status ${JSON.stringify(body.regulation?.status)} is not in the engine's vocabulary`);
      }
    },
  },
];

function expectStatus(response, expected) {
  if (response.status !== expected) throw new Error(`HTTP ${response.status}, expected ${expected}`);
}

async function run(check) {
  let lastError = null;
  /* One retry, for a network blip only. A wrong answer is not retried: it is the finding. */
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const started = performance.now();
    let response;
    try {
      response = await check.request();
    } catch (error) {
      lastError = `network: ${error?.cause?.code ?? error?.message ?? error}`;
      continue;
    }
    try {
      await check.verify(response);
      const ms = Math.round(performance.now() - started);
      return { name: check.name, ok: true, ms, slow: ms > SLOW_MS, deployment: response.headers.get("x-vercel-id") };
    } catch (error) {
      return { name: check.name, ok: false, ms: Math.round(performance.now() - started), error: error.message };
    }
  }
  return { name: check.name, ok: false, ms: null, error: lastError };
}

const originalFetch = globalThis.fetch;
globalThis.fetch = (url, init = {}) => originalFetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });

const results = [];
for (const check of checks) results.push(await run(check));
const failed = results.filter((result) => !result.ok);

const lines = [
  `Production monitor — ${base} — ${new Date().toISOString()}`,
  "",
  "| Check | Result | Time |",
  "| --- | --- | --- |",
  ...results.map(
    (result) =>
      `| ${result.name} | ${result.ok ? (result.slow ? "OK (slow)" : "OK") : `FAILED — ${result.error}`} | ${result.ms ?? "—"} ms |`,
  ),
  "",
  failed.length ? `${failed.length} of ${results.length} checks failed.` : `All ${results.length} checks passed.`,
];
console.log(lines.join("\n"));
if (jsonOut) await writeFile(jsonOut, `${JSON.stringify({ base, at: new Date().toISOString(), results }, null, 2)}\n`);
process.exitCode = failed.length ? 1 : 0;
