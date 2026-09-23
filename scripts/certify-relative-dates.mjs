#!/usr/bin/env node
/**
 * Certify the relative-date parser against the AUTHORITY'S OWN published dates.
 *
 *   node --import tsx scripts/certify-relative-dates.mjs [--offline]
 *
 * Schedule 3 writes a season as a rule — "the Saturday after the first Monday
 * in October to the first Sunday after January 19". Environment and Climate
 * Change Canada then publishes, in its provincial hunting regulations
 * summaries, the CALENDAR DATES that rule produces for the season in force.
 * Those two documents are the same authority stating the same season twice,
 * once as a rule and once as days.
 *
 * So every window this build computes must appear, to the day, among the
 * windows that authority published for the same province. An implementation
 * verified only against its own reading of the rule is verified against
 * nothing: the reading and the check would share any mistake in it. This is
 * the same standard the legal-time work was held to against USNO's tables.
 *
 * The published summary is a SUPERSET — it also carries the rows this build
 * refuses — so the test is containment, never equality. A computed window the
 * authority did not publish fails the certification and is not explained away.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  MBR_CITATION, MBR_URL, cellItems, partHtml, partTables, scheduleThree, sha256,
} from "./federal-migratory-source.mjs";
import { parseRelativeWindow, resolveRelativeWindow } from "../src/lib/hunt/regulatory/relative-date.ts";

const CACHE = "/tmp/mbr2022.html";
const RECORD = "fixtures/hunt/ca-federal-relative-date-certification.json";

/**
 * The season the summaries in force describe, and the year its openings fall
 * in. Declared, because a build must not certify itself against whatever
 * happens to be on the website later.
 */
const SEASON = { label: "August 2026 to July 2027", openingYear: 2026 };

/** The parts whose seasons use relative dates, with the authority's summary. */
const PARTS = [
  { part: 10, name: "British Columbia", summary: "british-columbia" },
  { part: 6, name: "Ontario", summary: "ontario" },
  { part: 5, name: "Quebec", summary: "quebec" },
];

const SUMMARY_URL = (slug) =>
  `https://www.canada.ca/en/environment-climate-change/services/migratory-game-bird-hunting/regulations-provincial-territorial-summaries/${slug}.html`;

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

/** "2026-10-10" → "October 10", the form the summaries print. */
const asDay = (iso) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;

/** Every "Month D to Month D" the authority's summary page prints. */
function publishedWindows(html) {
  const text = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[\s ]+/g, " ");
  const month = MONTHS.join("|");
  const windows = new Set();
  for (const match of text.matchAll(
    new RegExp(`((?:${month}) \\d{1,2}) (?:to|–|-) ((?:${month}) \\d{1,2})`, "g"),
  )) {
    windows.add(`${match[1]} to ${match[2]}`);
  }
  return windows;
}

/**
 * A summary page, checked to BE one.
 *
 * A cached file is not a cached document. An earlier fetch of a wrong URL left
 * Canada.ca's 404 page at two of these paths, and because the files existed
 * this script read them and reported every British Columbia and Ontario window
 * as disagreeing with the authority. Nothing was wrong with the dates; the
 * measurement was wrong, and it was wrong in the direction that LOOKS like a
 * defect, which is the only reason it was caught. So the document is verified
 * before it is believed, and a non-200 is never written to the cache.
 */
function assertIsASummary(html, slug) {
  const flat = html.replace(/<[^>]+>/g, " ").replace(/[\s\u00a0]+/g, " ");
  if (!/Hunting regulations summary for migratory birds/i.test(flat)) {
    throw new Error(`the document cached for ${slug} is not a hunting regulations summary`);
  }
  if (!flat.includes(SEASON.label)) {
    throw new Error(`the ${slug} summary is not for ${SEASON.label}; this build must not certify against another season`);
  }
}

async function summaryFor(slug, offline) {
  const cache = `/tmp/mbsum-${slug}.html`;
  if (existsSync(cache)) {
    const html = readFileSync(cache, "utf8");
    assertIsASummary(html, slug);
    return html;
  }
  if (offline) throw new Error(`no cached summary for ${slug}; run without --offline`);
  const response = await fetch(SUMMARY_URL(slug));
  if (!response.ok) throw new Error(`${slug} summary returned HTTP ${response.status}`);
  const html = await response.text();
  assertIsASummary(html, slug);
  writeFileSync(cache, html);
  return html;
}

async function main() {
  const offline = process.argv.includes("--offline");
  const regulation = readFileSync(CACHE, "utf8");
  const schedule = scheduleThree(regulation);

  const report = { citation: MBR_CITATION, sourceUrl: MBR_URL, documentHash: sha256(regulation),
    season: SEASON, verifiedAgainst: [], jurisdictions: [] };
  let failures = 0;

  for (const { part, name, summary } of PARTS) {
    const html = await summaryFor(summary, offline);
    const published = publishedWindows(html);
    report.verifiedAgainst.push({ jurisdiction: name, url: SUMMARY_URL(summary),
      publishedWindows: published.size, documentHash: sha256(html) });

    /* Every distinct season string this Part writes relatively. */
    const stated = new Set();
    for (const table of partTables(partHtml(schedule, part, name))) {
      for (const row of table.grid) {
        for (const item of cellItems(row[4] ?? "")) {
          const text = item.replace(/^\((?:[a-z]+|[ivx]+|[A-Z])\)\s*/, "").trim();
          if (/\b(first|second|third|fourth|last)\s+[A-Z]?[a-z]*day\b/i.test(text)) stated.add(text);
        }
      }
    }

    const computed = [];
    const refused = [];
    for (const text of [...stated].sort()) {
      const window = parseRelativeWindow(text);
      if (!window) { refused.push(text); continue; }
      const days = resolveRelativeWindow(window, SEASON.openingYear);
      if (!days) { refused.push(text); continue; }
      const asPublished = `${asDay(days.from)} to ${asDay(days.to)}`;
      const agrees = published.has(asPublished);
      if (!agrees) failures += 1;
      computed.push({ statedAs: text, computed: days, asPublished, agrees });
    }

    console.log(`\n${name}: ${computed.length} computed, ${refused.length} refused`);
    for (const entry of computed) {
      console.log(`  ${entry.agrees ? "OK  " : "FAIL"} ${entry.asPublished}   <= ${entry.statedAs}`);
    }
    for (const text of refused) console.log(`  refused  ${text}`);

    report.jurisdictions.push({ jurisdiction: name, part, computed, refused });
  }

  const total = report.jurisdictions.reduce((sum, j) => sum + j.computed.length, 0);
  const refusedTotal = report.jurisdictions.reduce((sum, j) => sum + j.refused.length, 0);
  report.result = failures === 0 ? "VERIFIED" : "DISAGREES";
  report.computed = total;
  report.refused = refusedTotal;
  report.disagreements = failures;

  console.log(`\n${report.result}: ${total - failures}/${total} computed windows match the authority's own published dates; ${refusedTotal} refused.`);
  writeFileSync(RECORD, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`record: ${RECORD}`);
  if (failures > 0) process.exitCode = 1;
}

await main();
