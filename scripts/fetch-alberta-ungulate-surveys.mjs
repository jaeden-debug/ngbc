#!/usr/bin/env node
/**
 * Read Alberta's Wildlife Management Unit aerial ungulate survey reports.
 *
 *   node scripts/fetch-alberta-ungulate-surveys.mjs --out .research/alberta-ungulate
 *
 * WHY. For moose, white-tailed deer and mule deer the only public Canadian
 * evidence finer than "harvest in this unit" is Alberta's aerial surveys:
 * animals per km² with a 90% confidence interval, by unit and species, under
 * the Open Government Licence – Alberta (docs/research/species-density-
 * evidence.md). They are published as PDF reports, one per survey, through
 * the province's open-data catalogue.
 *
 * WHAT THIS DOES. It asks the catalogue's own API (CKAN) for every survey
 * report, records each one's title, publisher, licence as the catalogue
 * states it, and resource URLs, downloads each PDF, and writes the text the
 * pinned pypdf extracts page by page, with the PDF's sha256. It interprets
 * nothing: the density figures are read from this text by
 * `build-alberta-ungulate-density.mjs`, which refuses on wording it does not
 * recognise.
 *
 * WHERE IT RUNS. On a runner (`.github/workflows/fetch-research.yml`); a
 * development container may not reach open.alberta.ca. The text it writes is
 * working material for a branch, not a published artifact: only the derived
 * facts, each citing its report, go to main.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : ".research/alberta-ungulate";
const API = "https://open.alberta.ca/api/3/action/package_search";
const USER_AGENT = "NorthGroundBushcraft/1.0 (+https://www.northgroundbushcraft.com)";

/* A survey report: a unit (or units) and an ungulate species, surveyed. */
const SURVEY_TITLE = /(ungulate|moose|deer|elk|sheep|goat|pronghorn|antelope|bison).*survey|survey.*(ungulate|moose|deer|elk|sheep|goat|pronghorn)/i;

async function get(url, read, attempts = 3) {
  let last;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(120_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return await read(response);
    } catch (error) {
      last = error;
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
  throw last;
}

async function catalogue() {
  const queries = ["aerial ungulate survey", "moose survey wildlife management unit", "deer survey wildlife management unit", "ungulate survey"];
  const packages = new Map();
  for (const q of queries) {
    for (let start = 0; ; start += 100) {
      const url = `${API}?q=${encodeURIComponent(q)}&rows=100&start=${start}`;
      const body = await get(url, (r) => r.json());
      const results = body.result?.results ?? [];
      for (const pkg of results) if (SURVEY_TITLE.test(pkg.title ?? "")) packages.set(pkg.id, pkg);
      if (start + 100 >= (body.result?.count ?? 0) || !results.length) break;
    }
  }
  return [...packages.values()].sort((a, b) => a.title.localeCompare(b.title));
}

function pdfText(bytes) {
  const run = spawnSync("python3", ["scripts/pdf-text.py"], { input: bytes, maxBuffer: 256 * 1024 * 1024 });
  if (run.status !== 0) throw new Error(`pdf-text.py exited ${run.status}: ${run.stderr.toString().slice(0, 300)}`);
  return JSON.parse(run.stdout.toString());
}

mkdirSync(join(OUT, "text"), { recursive: true });
const packages = await catalogue();
const index = [];
for (const pkg of packages) {
  const entry = {
    id: pkg.id,
    name: pkg.name,
    title: pkg.title,
    publisher: pkg.organization?.title ?? null,
    licenceId: pkg.license_id ?? null,
    licenceTitle: pkg.license_title ?? null,
    catalogueUrl: `https://open.alberta.ca/publications/${pkg.name}`,
    metadataModified: pkg.metadata_modified ?? null,
    resources: [],
  };
  for (const resource of pkg.resources ?? []) {
    const isPdf = /pdf/i.test(resource.format ?? "") || /\.pdf($|\?)/i.test(resource.url ?? "");
    const row = { id: resource.id, name: resource.name ?? null, url: resource.url, format: resource.format ?? null, lastModified: resource.last_modified ?? null };
    if (isPdf) {
      try {
        const bytes = await get(resource.url, async (r) => Buffer.from(await r.arrayBuffer()));
        row.sha256 = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
        row.bytes = bytes.length;
        const text = pdfText(bytes);
        row.pages = text.pages.length;
        row.textFile = `text/${resource.id}.json`;
        writeFileSync(join(OUT, row.textFile), `${JSON.stringify({ url: resource.url, sha256: row.sha256, pypdf: text.pypdf, pages: text.pages })}\n`);
      } catch (error) {
        row.error = String(error.message ?? error).slice(0, 300);
      }
    }
    entry.resources.push(row);
  }
  index.push(entry);
  process.stdout.write(`${entry.resources.some((r) => r.textFile) ? "read" : "NO PDF"}  ${entry.licenceId ?? "?"}  ${entry.title}\n`);
}
writeFileSync(join(OUT, "index.json"), `${JSON.stringify({ retrievedAt: new Date().toISOString().slice(0, 10), api: API, packages: index }, null, 2)}\n`);
const read = index.filter((p) => p.resources.some((r) => r.textFile)).length;
process.stdout.write(`\n${index.length} survey publications listed; ${read} with PDF text\n`);
