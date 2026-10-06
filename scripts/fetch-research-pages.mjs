#!/usr/bin/env node
/**
 * Read named authority documents, and occurrence facets, from a runner.
 *
 * Research a development container cannot reach — an agency page, a regulation,
 * a survey report — is read here as it is served and written down unchanged
 * beside its sha256 and extracted text. Nothing is interpreted: deciding what a
 * document establishes is the researcher's job, with the document in hand.
 *
 *   node scripts/fetch-research-pages.mjs --out .research/pages
 *
 * Requests come from `.research/request.json`:
 *
 *   "pages":      [{ "id": "ca-ccr-472", "url": "https://…" }]
 *   "gbifFacets": [{ "id": "red-deer", "names": ["Cervus elaphus"] }]
 *
 * The client says who it is (§44: never present a user-agent we are not). A
 * refused page is recorded as refused, with its status, never retried under
 * another identity.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : ".research/pages";
mkdirSync(OUT, { recursive: true });
const request = JSON.parse(readFileSync(".research/request.json", "utf8"));
const USER_AGENT = "NorthGroundBushcraft/1.0 (+https://www.northgroundbushcraft.com)";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const safeId = (id) => String(id).replace(/[^a-z0-9._-]/gi, "-");

/* HTML to readable text: scripts and styles dropped, block ends kept as line
   breaks so a table row stays a line, entities decoded. */
function htmlText(html) {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|tr|li|h[1-6]|section|article|table|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&eacute;/g, "é").replace(/&egrave;/g, "è")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/* PDF text with the same pinned extractor the regulatory builders use, page by page. */
function pdfText(path) {
  const script = [
    "import sys, pypdf",
    "reader = pypdf.PdfReader(sys.argv[1])",
    "for i, page in enumerate(reader.pages, 1):",
    "    print(f'=== page {i} ===')",
    "    print(page.extract_text() or '')",
  ].join("\n");
  return execFileSync("python3", ["-c", script, path], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
}

const index = [];
for (const page of request.pages ?? []) {
  const id = safeId(page.id);
  const entry = { id, url: page.url, retrievedAt: new Date().toISOString() };
  try {
    const response = await fetch(page.url, { headers: { "user-agent": USER_AGENT }, redirect: "follow", signal: AbortSignal.timeout(120_000) });
    entry.status = response.status;
    entry.finalUrl = response.url;
    entry.contentType = response.headers.get("content-type") ?? "";
    const bytes = Buffer.from(await response.arrayBuffer());
    entry.bytes = bytes.length;
    entry.sha256 = sha256(bytes);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const isPdf = entry.contentType.includes("pdf") || bytes.subarray(0, 5).toString() === "%PDF-";
    const raw = join(OUT, `${id}.${isPdf ? "pdf" : "html"}`);
    writeFileSync(raw, bytes);
    const text = isPdf ? pdfText(raw) : htmlText(bytes.toString("utf8"));
    writeFileSync(join(OUT, `${id}.txt`), text);
    entry.textChars = text.length;
    process.stdout.write(`ok   ${id} ${entry.status} ${entry.bytes} B\n`);
  } catch (error) {
    entry.error = String(error.message ?? error);
    process.stdout.write(`FAIL ${id}: ${entry.error}\n`);
  }
  index.push(entry);
}
if (index.length) writeFileSync(join(OUT, "index.json"), `${JSON.stringify(index, null, 2)}\n`);

/* Occurrence facets: where and how a name has been recorded in Canada and the
   United States, and the latest records themselves, so a reader can see
   whether they are a population, escapes, captives or another animal. */
const GBIF = "https://api.gbif.org/v1";
const get = async (url) => {
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
  return response.json();
};
const facets = [];
for (const want of request.gbifFacets ?? []) {
  const id = safeId(want.id);
  const out = { id, names: want.names, matches: [], countries: {} };
  try {
    for (const name of want.names) {
      const match = await get(`${GBIF}/species/match?name=${encodeURIComponent(name)}`);
      out.matches.push({ name, usageKey: match.usageKey ?? null, acceptedUsageKey: match.acceptedUsageKey ?? null, matchType: match.matchType, rank: match.rank, status: match.status, canonicalName: match.canonicalName, species: match.species ?? null });
    }
    const keys = [...new Set(out.matches.flatMap((m) => [m.usageKey, m.acceptedUsageKey]).filter(Boolean))];
    const taxa = keys.map((key) => `taxonKey=${key}`).join("&");
    for (const country of ["US", "CA"]) {
      const base = `${GBIF}/occurrence/search?${taxa}&country=${country}&hasCoordinate=true&year=1990,2026`;
      const facetUrl = `${base}&limit=0&facet=stateProvince&facet=basisOfRecord&facet=establishmentMeans&facet=degreeOfEstablishment&facet=year&facet=datasetKey&facet=scientificName&facetLimit=80`;
      const summary = await get(facetUrl);
      const records = await get(`${base}&limit=300`);
      out.countries[country] = {
        count: summary.count,
        facets: Object.fromEntries((summary.facets ?? []).map((f) => [f.field, f.counts])),
        records: (records.results ?? []).map((r) => ({
          key: r.key, eventDate: r.eventDate ?? null, year: r.year ?? null, stateProvince: r.stateProvince ?? null, county: r.county ?? null,
          locality: r.locality ?? null, lat: r.decimalLatitude ?? null, lon: r.decimalLongitude ?? null,
          basisOfRecord: r.basisOfRecord, establishmentMeans: r.establishmentMeans ?? null, degreeOfEstablishment: r.degreeOfEstablishment ?? null,
          scientificName: r.scientificName, verbatimScientificName: r.verbatimScientificName ?? null, datasetName: r.datasetName ?? null,
          institutionCode: r.institutionCode ?? null, occurrenceRemarks: r.occurrenceRemarks ? String(r.occurrenceRemarks).slice(0, 300) : null,
          license: r.license ?? null, issues: r.issues ?? [],
        })),
      };
    }
    process.stdout.write(`ok   gbif ${id} US ${out.countries.US.count} CA ${out.countries.CA.count}\n`);
  } catch (error) {
    out.error = String(error.message ?? error);
    process.stdout.write(`FAIL gbif ${id}: ${out.error}\n`);
  }
  facets.push(out);
}
if (facets.length) writeFileSync(join(OUT, "gbif-facets.json"), `${JSON.stringify(facets, null, 2)}\n`);
