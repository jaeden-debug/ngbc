/**
 * Alberta's aerial ungulate surveys, as animals per square kilometre.
 *
 * WHY THIS IS WORTH INGESTING EVEN THOUGH IT IS NOT FINER THAN A ZONE. Every
 * other heat value North Ground held for big game is HARVEST — a record of
 * hunting, which tracks access and effort as much as animals. Alberta publishes
 * what a hunter actually asked: animals per km², with the authority's own 90%
 * confidence interval, survey year and method. §41B is explicit that where an
 * authority publishes an absolute density it is preferred over harvest at the
 * same resolution. The resolution does not improve; what the number MEANS does.
 *
 * WHAT IT MAY NEVER DO. It is a figure for a whole management unit, so it is
 * emitted as MANAGEMENT_ZONE and can never set the value of a cell in the
 * continental surface — §41B's coarse-evidence prohibition, enforced in
 * `surfaceSitesFrom`, which refuses this geometry by name. A zone density
 * multiplied across pixels would let a regulatory boundary shape the animal
 * surface while looking like biology.
 *
 * WINTER IS NOT AUTUMN. These are flown in winter, when ungulates are yarded
 * and visible against snow. That is not the distribution a hunter meets in
 * October, and every bundle carries the season it was flown in, read from the
 * report rather than assumed.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CACHE = join(ROOT, ".cache", "ab-surveys");
const OUT_DIR = join(ROOT, "content", "intelligence");
const CATALOGUE = "https://open.alberta.ca/api/3/action/package_search?q=%22aerial+ungulate+survey%22&rows=200";

export const SOURCE = {
  id: "source:ca-ab-aerial-ungulate-surveys",
  authority: "Alberta Environment and Protected Areas",
  title: "Wildlife Management Unit aerial ungulate survey reports",
  url: "https://open.alberta.ca/dataset?q=aerial+ungulate+survey",
  licence: "Open Government Licence – Alberta",
  licenceUrl: "https://open.alberta.ca/licence",
  attribution: "Contains information licensed under the Open Government Licence – Alberta.",
};

/** The survey species these reports name, to the catalogue's own ids. */
const SPECIES = {
  "mule deer": "species:mule-deer",
  "white-tailed deer": "species:white-tailed-deer",
  "moose": "species:moose",
  "elk": "species:elk",
  "pronghorn": "species:pronghorn",
  "bighorn sheep": "species:bighorn-sheep",
  "mountain goat": "species:mountain-goat",
  "bison": "species:wood-bison",
};

/**
 * A row of Table 1, or null.
 *
 * REFUSED RATHER THAN REPAIRED. WMU 116's own table carries
 * "White-tailed Deer 2003 Total Minimum Count 388 0.0.19" — a density with two
 * decimal points, in the authority's published document. A parser that coerced
 * that to 0.019 or 0.19 would be inventing a figure and attributing it to
 * Alberta. Anything that does not match cleanly is returned with its raw text
 * and counted, so the refusals are visible instead of silently thinned.
 */
export function parseTableRow(line) {
  const species = Object.keys(SPECIES).find((name) => line.toLowerCase().startsWith(name));
  if (!species) return null;
  const rest = line.slice(species.length).trim();
  /*
   * NOT A ROW IS NOT A REFUSAL, and conflating them made the refusal count
   * meaningless: these reports are prose, so every sentence beginning "mule
   * deer were observed…" looked like a rejected table row. 478 of them drowned
   * the handful that matter. A line only becomes a candidate row when a YEAR
   * follows the species name, which is what a table row always has and a
   * sentence never does.
   */
  if (!/^\d{4}\b/.test(rest)) return null;
  /*
   * The shapes Alberta actually publishes, each read rather than dropped:
   *   2025            a single survey year
   *   2024/25         a survey flown across a winter, which most of them are
   *   2024-2025       the same span written with a hyphen or a dash, which
   *                   Alberta uses at least as often — 88 rows were refused as
   *                   ROW_SHAPE for this alone
   *   (1021-2312)     a confidence interval
   *   (192 – 475)     the same, spaced, with an en dash
   *   NA              a row whose method yields no interval at all
   * The year is taken as the one the season ENDS in, because that is the year
   * the authority prints alone when it prints one.
   */
  const match = /^(\d{4})(?:[/–—-](\d{2,4}))?\s+([A-Za-z ]+?)\s+([\d,]+)\s*(?:\(\s*([\d,]+)\s*[–—-]\s*([\d,]+)\s*\)|NA\b)?\s+([\d.]+)\b/.exec(rest);
  if (!match) {
    /*
     * "WE COULD NOT READ IT" AND "THERE IS NOTHING TO TAKE" ARE DIFFERENT
     * FINDINGS, and calling both ROW_SHAPE hid the larger one behind the
     * smaller. Alberta publishes minimum total counts with no surveyed area,
     * so the density column is literally "NA" or "-":
     *
     *   Elk 2015 Minimum total count 153 NA NA
     *   White-tailed Deer 2009 Minimum Total Count 319 NA - -
     *
     * Those rows are read perfectly. The authority did not publish a density
     * for that unit, which is a fact about the source, not a weakness in this
     * parser — and 80 rows reported as ROW_SHAPE invited someone to go fix an
     * extractor that was working. §41B: UNAVAILABLE is a finding about the
     * data; only a genuine parse failure is a finding about us.
     */
    const readable = /^(\d{4})(?:[/–—-]\d{2,4})?\s+[A-Za-z ]+?\s+[\d,]+\b/.test(rest);
    const noDensity = readable && !/\d+\.\d+/.test(rest.replace(/\(.*?\)/g, ""));
    return { raw: line, refused: noDensity ? "NO_DENSITY_PUBLISHED" : "ROW_SHAPE" };
  }
  const density = Number(match[7]);
  if (!Number.isFinite(density) || !/^\d+\.\d+$|^\d+$/.test(match[7])) return { raw: line, refused: "DENSITY_MALFORMED" };
  const number = (value) => (value === undefined ? null : Number(value.replace(/,/g, "")));
  const start = Number(match[1]);
  const endSuffix = match[2];
  const year = endSuffix ? (endSuffix.length === 2 ? Math.floor(start / 100) * 100 + Number(endSuffix) : Number(endSuffix)) : start;
  return {
    speciesId: SPECIES[species],
    year,
    seasonSpans: endSuffix ? `${start}/${endSuffix}` : null,
    method: match[3].trim(),
    abundance: number(match[4]),
    ciLow: number(match[5]),
    ciHigh: number(match[6]),
    densityPerKm2: density,
  };
}

/** The months the report says it flew in, or null. Read, never assumed. */
export function surveyMonths(text) {
  const hit = /(?:surveys? (?:was|were) (?:flown|conducted)|flown|conducted)[^.]{0,80}?\b(January|February|March|November|December)\b[^.]{0,40}?(?:through|to|and)?\s*(?:early |late |mid-)?(January|February|March|November|December)?/i.exec(text);
  if (!hit) return null;
  return [hit[1], hit[2]].filter(Boolean).map((month) => month[0].toUpperCase() + month.slice(1).toLowerCase());
}

/**
 * Every management unit a report's title names.
 *
 * Alberta titles these three ways and the first pattern found only the first:
 * "Wildlife Management Unit 116", "Wildlife management units 436, 437, 438 and
 * 439", and "WMU 332". Thirty of 126 reports were dropped as untitled until the
 * other two were read — including every multi-unit survey, which is the shape
 * that carries the most units per report.
 *
 * A report naming several units reports ONE figure for all of them together, so
 * the figure is attributed to each named unit and says so; it is not divided
 * among them, which would invent a per-unit number the survey never produced.
 */
export function wmusOf(title) {
  const listed = /Wildlife management units?\s+([\d,\sA-Z]+?(?:\s+and\s+\d+[A-Z]?)?)\s+(?:aerial|bighorn|elk|moose|survey|count)/i.exec(title);
  if (listed) {
    const units = listed[1].match(/\d+[A-Z]?/g) ?? [];
    if (units.length) return units;
  }
  const single = /(?:Wildlife Management Unit|WMU)s?\s+(\d+[A-Z]?)/i.exec(title);
  return single ? [single[1]] : [];
}

/** Kept for the single-unit case the rest of the script reads. */
export function wmuOf(title) {
  return wmusOf(title)[0] ?? null;
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function pdfText(buffer) {
  const run = spawnSync("python3", [join(HERE, "pdf-text.py")], { input: buffer, maxBuffer: 64 * 1024 * 1024 });
  if (run.status !== 0) throw new Error(`pdf-text.py exited ${run.status}: ${run.stderr?.toString().slice(0, 200)}`);
  return JSON.parse(run.stdout.toString()).pages.join("\n");
}

async function cached(name, url) {
  mkdirSync(CACHE, { recursive: true });
  const path = join(CACHE, name);
  if (!existsSync(path)) {
    /* A government host that stops answering must not hang the build. One
       report going quiet is a refusal to record, not a reason to stall. */
    const response = await fetch(url, { signal: AbortSignal.timeout(45_000) });
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    writeFileSync(path, Buffer.from(await response.arrayBuffer()));
  }
  return readFileSync(path);
}

export async function build({ retrievedAt = new Date().toISOString().slice(0, 10) } = {}) {
  const catalogue = JSON.parse(await (await fetch(CATALOGUE)).text()).result.results;
  const reports = [];
  const refusals = [];
  for (const entry of catalogue) {
    const wmus = wmusOf(entry.title);
    const wmu = wmus[0];
    const pdf = entry.resources?.find((resource) => resource.format === "PDF");
    if (!wmu || !pdf) {
      refusals.push({ title: entry.title, reason: wmu ? "NO_PDF" : "NO_WMU_IN_TITLE" });
      continue;
    }
    let buffer;
    try {
      buffer = await cached(`${wmu}-${entry.id}.pdf`, pdf.url);
    } catch (error) {
      refusals.push({ wmu, title: entry.title, reason: "UNREADABLE", detail: error instanceof Error ? error.message : String(error) });
      continue;
    }
    const text = pdfText(buffer).replace(/[ \t]+/g, " ");
    const rows = [];
    /*
     * A table row the extractor split across two lines — "Mule Deer 2003 Random
     * Stratified" / "Block 1793 (1350-2236) 0.86" — is one row in the document
     * and must be read as one. A line that starts like a row and does not finish
     * like one is joined to the next before parsing.
     */
    const raw = text.split("\n").map((value) => value.trim());
    const joined = [];
    for (let index = 0; index < raw.length; index += 1) {
      const line = raw[index];
      const looksUnfinished = /^[A-Za-z' -]+\s+\d{4}(?:\/\d{2,4})?\s+[A-Za-z ]*$/.test(line);
      joined.push(looksUnfinished && raw[index + 1] ? `${line} ${raw[index + 1]}` : line);
    }
    for (const line of joined) {
      const row = parseTableRow(line);
      if (!row) continue;
      if (row.refused) { refusals.push({ wmu, raw: row.raw, reason: row.refused }); continue; }
      rows.push(row);
    }
    reports.push({ wmu, wmus, title: entry.title, url: pdf.url, hash: sha256(buffer), months: surveyMonths(text), rows });
  }

  /* The most recent year per species per unit. The historical rows are context,
     and mixing years across units would compare a 2025 figure with a 2003 one. */
  const latest = new Map();
  for (const report of reports) {
    for (const row of report.rows) {
      /* A multi-unit survey's figure is attributed to each unit it names, and
         the record says the survey covered them together. It is never divided
         among them: that would be a per-unit number the survey never produced. */
      for (const unit of report.wmus) {
        const key = `${row.speciesId}|${unit}`;
        const held = latest.get(key);
        if (!held || row.year > held.row.year) latest.set(key, { report, row, unit });
      }
    }
  }

  const bySpecies = new Map();
  for (const { report, row, unit } of latest.values()) {
    const list = bySpecies.get(row.speciesId) ?? [];
    list.push({ report, row, unit });
    bySpecies.set(row.speciesId, list);
  }
  return { reports, refusals, bySpecies, retrievedAt };
}

export function bundleFor(speciesId, entries, retrievedAt, refusals = []) {
  const values = entries.map(({ row }) => row.densityPerKm2);
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (value) => {
    const below = sorted.filter((other) => other < value).length;
    const equal = sorted.filter((other) => other === value).length;
    return Number(((below + equal / 2) / sorted.length).toFixed(4));
  };
  const months = [...new Set(entries.flatMap(({ report }) => report.months ?? []))];
  return {
    schemaVersion: 1,
    methodologyVersion: "opportunity-v1",
    speciesId,
    jurisdictionId: "jurisdiction:ca-ab",
    coverage: "PARTIAL_DATA",
    /*
     * WHAT WAS READ AND WHAT WAS NOT, in the bundle rather than on a terminal.
     *
     * The refusals were counted and printed and went nowhere — the same shape
     * as evidence built, committed and unreachable, which is the defect this
     * repository has now produced four times. A consumer reading this file saw
     * only what came through, and a row the authority published but we could
     * not parse is indistinguishable from a row that does not exist.
     *
     * Every count here is derived from the run that produced the evidence.
     */
    reading: {
      reportsRead: refusals.readReports ?? null,
      reportsRefused: (refusals.entries ?? []).filter((entry) => entry.title).length,
      rowsRefused: (refusals.entries ?? []).filter((entry) => entry.raw).length,
      /* The shapes, not the instances: a reader needs to know WHAT could not be
         read, and the count of each, to judge whether the gap is systematic. */
      refusedBy: Object.entries(
        (refusals.entries ?? []).reduce((tally, entry) => {
          tally[entry.reason] = (tally[entry.reason] ?? 0) + 1;
          return tally;
        }, {}),
      ).sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, count })),
      /* A worked example of each shape, so the next person fixing this does not
         have to re-run the extractor to see one. */
      examples: Object.values(
        (refusals.entries ?? []).reduce((seen, entry) => {
          if (!seen[entry.reason] && entry.raw) seen[entry.reason] = { reason: entry.reason, row: entry.raw.slice(0, 120) };
          return seen;
        }, {}),
      ),
    },
    latestObservationYear: Math.max(...entries.map(({ row }) => row.year)),
    seasonalBasis: {
      observedSeason: months.length
        ? `Flown in ${months.join(" and ")}, when ungulates are yarded and visible against snow`
        : "Flown in winter, when ungulates are yarded and visible against snow",
      matchesHuntingSeason: false,
      warning:
        "Counted from the air in winter. Where these animals are in the autumn is a different question, and an aerial survey does not answer it.",
    },
    limitations: [
      "A figure for a whole Wildlife Management Unit. It says nothing about where inside the unit the animals are, and may never be drawn finer than the unit.",
      "The authority's own estimate with its 90% confidence interval; the interval is part of the figure and is carried with it.",
      "Surveys are flown in different years in different units, so two units may be compared only with their years in view.",
      "The evidence does not determine hunting legality, land access, or permission to hunt.",
      "Rows the extractor could not read are counted in `reading` and are NOT represented here. An absent unit is a unit not read, never a unit with no animals.",
    ],
    source: {
      ...SOURCE,
      resourceUrl: SOURCE.url,
      sourceHash: sha256(entries.map(({ report }) => report.hash).sort().join("|")),
      retrievedAt,
      verifiedAt: retrievedAt,
    },
    evidence: entries.map(({ report, row, unit }) => ({
      id: `evidence:ab-aerial-${speciesId.replace("species:", "")}-wmu-${unit.toLowerCase()}`,
      speciesId,
      jurisdictionId: "jurisdiction:ca-ab",
      geographyId: `management_zone:ca-ab-wmu-${unit.toLowerCase()}`,
      geographyType: "MANAGEMENT_ZONE",
      sourceId: SOURCE.id,
      metric: "POPULATION_DENSITY",
      rawValue: row.densityPerKm2,
      normalizedValue: rank(row.densityPerKm2),
      unit: "animals per square kilometre",
      sampleSize: row.abundance ?? undefined,
      methodology: `${row.method} survey, ${row.seasonSpans ?? row.year}. Abundance ${row.abundance}${row.ciLow !== null ? ` (90% CI ${row.ciLow}–${row.ciHigh})` : ", no confidence interval published"}.${report.wmus.length > 1 ? ` Surveyed together with ${report.wmus.filter((other) => other !== unit).join(", ")}; the figure is the survey's, for those units as a whole.` : ""}`,
      observationPeriod: { from: `${row.year}-01-01`, through: `${row.year}-03-31` },
      retrievedAt,
      verifiedAt: retrievedAt,
      confidence: row.ciLow === null ? "MODERATE" : "HIGH",
      spatialPrecision: "Alberta Wildlife Management Unit, as the authority reports it",
      version: "ab-aerial-1",
      superseded: false,
    })),
  };
}

export async function main(argv = process.argv.slice(2)) {
  const check = argv.includes("--check");
  const { reports, refusals, bySpecies, retrievedAt } = await build();
  let differed = 0;
  const written = [];
  for (const [speciesId, entries] of [...bySpecies].sort((a, b) => a[0].localeCompare(b[0]))) {
    /* A species measured in one or two units cannot be ranked against anything;
       a percentile over two values is not a ranking, it is a coin. */
    if (entries.length < 5) {
      process.stdout.write(`  SKIP  ${speciesId} — ${entries.length} unit(s) surveyed; too few to rank\n`);
      continue;
    }
    const bundle = bundleFor(speciesId, entries, retrievedAt, { entries: refusals, readReports: reports.length });
    const path = join(OUT_DIR, `ca-ab-${speciesId.replace("species:", "")}-density.json`);
    const next = `${JSON.stringify(bundle, null, 2)}\n`;
    const strip = (text) => text.replace(/"(retrievedAt|verifiedAt)": "\d{4}-\d{2}-\d{2}"/g, '"$1": "-"');
    if (check) {
      const current = existsSync(path) ? readFileSync(path, "utf8") : "";
      if (strip(current) !== strip(next)) { differed += 1; process.stdout.write(`  DIFFERS  ${path.replace(`${ROOT}/`, "")}\n`); }
    } else {
      writeFileSync(path, next);
    }
    written.push({ speciesId, units: entries.length });
    process.stdout.write(`  ${check ? "check" : "built"}  ${speciesId.padEnd(34)} ${String(entries.length).padStart(3)} units\n`);
  }
  process.stdout.write(`\n${reports.length} of ${reports.length + refusals.filter((r) => r.title).length} reports read, ${written.length} species bundle(s), ${refusals.length} refusal(s).\n`);
  for (const refusal of refusals.slice(0, 8)) {
    process.stdout.write(`  refused ${refusal.reason}: ${(refusal.raw ?? refusal.title ?? "").slice(0, 90)}\n`);
  }
  if (check && differed) {
    process.stderr.write(`\nAlberta density source changed: ${differed} bundle(s) differ. Rebuild and review.\n`);
    process.exit(2);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
