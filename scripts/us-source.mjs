/**
 * Shared source handling for the United States regulatory builders.
 *
 * Each state publishes its seasons differently — Montana and Wyoming as PDF
 * booklets and chapters, Idaho through a planner feed beside its booklet,
 * Colorado as brochures — but what happens to a source is the same:
 *
 *   fetch it, hash it, refuse to build from anything but the reviewed bytes
 *   when checking, extract its text reproducibly, and stamp provenance with a
 *   calendar day in the state's own time zone.
 *
 * Nothing here interprets a rule. The builders match the text against the
 * wording they expect and stop on anything else.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { diffConditionalBundles, formatConditionalDiff } from "./manitoba-source.mjs";
import { jurisdictionToday, readPreviousBundle, retrievedAtFor } from "./ontario-source.mjs";

/* ── Recording, for change drills ───────────────────────────────────────
   `--save-sources <dir>` records every source a build reads; `--sources <dir>`
   builds from a recording, offline. A drill copies a recording, edits one
   thing the authority might change, and checks what the builder reports. A
   PDF is recorded as its extracted text, which is what the builder reads and
   what a drill edits. */

let recording = null;

export function recordSourcesFromArgs(argv = process.argv) {
  const at = (flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
  const save = at("--save-sources");
  const replay = at("--sources");
  if (save) { mkdirSync(save, { recursive: true }); recording = { mode: "save", dir: save }; }
  else if (replay) recording = { mode: "replay", dir: replay };
}

const recordedFile = (kind, url) => join(recording.dir, `${kind}-${createHash("sha256").update(url).digest("hex").slice(0, 16)}.json`);

function recorded(kind, url, produce) {
  if (recording?.mode === "replay") return JSON.parse(readFileSync(recordedFile(kind, url), "utf8")).value;
  return Promise.resolve(produce()).then((value) => {
    if (recording?.mode === "save") writeFileSync(recordedFile(kind, url), JSON.stringify({ url, value }));
    return value;
  });
}

export { jurisdictionToday, readPreviousBundle, retrievedAtFor };

/* Some state web servers refuse requests without a browser-like agent. The
   agent string identifies North Ground plainly; it does not impersonate one. */
const HEADERS = {
  "user-agent": "Mozilla/5.0 (compatible; NorthGroundRegulatoryBuilder/1.0; +https://www.northgroundbushcraft.com)",
  accept: "*/*",
};

export function sha256(content) {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

export async function fetchBytes(url, { timeoutMs = 120_000 } = {}) {
  if (!/^https:\/\//.test(url)) throw new Error(`Refusing a non-https source: ${url}`);
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function fetchJson(url, options) {
  return recorded("json", url, async () => JSON.parse((await fetchBytes(url, options)).toString("utf8")));
}

/**
 * A PDF's page texts and the hash of its bytes, read once. From a recording,
 * the texts are the recorded (possibly drill-edited) ones.
 */
export async function fetchPdf(url) {
  return recorded("pdf", url, async () => {
    const bytes = await fetchBytes(url);
    const { pypdf, pages } = pdfPages(bytes);
    return { sha256: sha256(bytes), pypdf, pages };
  });
}

/** Text of each page, through the pinned pypdf (see scripts/pdf-text.py). */
export function pdfPages(bytes) {
  const run = spawnSync("python3", [new URL("./pdf-text.py", import.meta.url).pathname], { input: bytes, maxBuffer: 256 * 1024 * 1024 });
  if (run.status !== 0) {
    throw new Error(`PDF text extraction failed (exit ${run.status}): ${run.stderr?.toString().trim() || "no output"}`);
  }
  const parsed = JSON.parse(run.stdout.toString("utf8"));
  return { pypdf: parsed.pypdf, pages: parsed.pages };
}

/**
 * A page's text with layout whitespace collapsed and PDF typography made
 * comparable: line breaks and runs of spaces become one space, and a word
 * hyphenated across a line end stays hyphenated (Montana writes "pri-vately"
 * across lines in column heads, which is matched as printed).
 */
export function flatten(text) {
  return text.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Sept: 9, Oct: 10, Nov: 11, Dec: 12 };

/**
 * A printed date range in a licence year that starts in March ("Sep. 01 -
 * Jan. 01" in Montana's 2026 licence year is 2026-09-01 to 2027-01-01).
 * Months before the licence year's first month fall in the following year.
 * Anything not in the expected shape stops the build.
 */
export function parseRange(printed, { licenceYear, firstMonth = 3 }) {
  const match = /^([A-Z][a-z]{2,3})\.?\s+(\d{1,2})\s*[-–]\s*([A-Z][a-z]{2,3})\.?\s+(\d{1,2})$/.exec(printed.trim());
  if (!match || !MONTHS[match[1]] || !MONTHS[match[3]]) throw new Error(`Unreadable date range "${printed}"`);
  const iso = (month, day) => {
    const year = month < firstMonth ? licenceYear + 1 : licenceYear;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCMonth() !== month - 1) throw new Error(`"${printed}" names a day that does not exist`);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };
  const opensIso = iso(MONTHS[match[1]], Number(match[2]));
  const closesIso = iso(MONTHS[match[3]], Number(match[4]));
  if (closesIso < opensIso) throw new Error(`"${printed}" closes before it opens`);
  return { opensIso, closesIso, statedAs: printed.trim() };
}

/** The one match of `pattern` in `text`, or a build failure naming what was expected. */
export function expectOne(text, pattern, what) {
  const matches = [...text.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))];
  if (matches.length !== 1) {
    throw new Error(`${what}: expected exactly one match of the published wording, found ${matches.length}. The source may have changed.`);
  }
  return matches[0];
}

/**
 * Write the outputs, or with --check compare them. Exit 2 when a source moved
 * since the committed bundle was built, 3 when the committed files are not
 * what this builder produces from unchanged sources.
 */
export function writeOrCheck({ check, outputs, bundlePath, contentHash, previous, label }) {
  if (check) {
    if (!previous) {
      console.error(`${bundlePath} does not exist.`);
      process.exit(3);
    }
    if (previous.contentHash !== contentHash) {
      console.error(`SOURCE MOVED: ${label} changed since ${bundlePath} was built. Review the rule-level diff before rebuilding.`);
      const diff = diffConditionalBundles(previous, outputs[bundlePath]);
      console.error(formatConditionalDiff(diff));
      process.exit(2);
    }
    for (const [path, value] of Object.entries(outputs)) {
      let current = null;
      try { current = readFileSync(path, "utf8"); } catch { /* reported below */ }
      if (current !== `${JSON.stringify(value, null, 2)}\n`) {
        console.error(`${path} is missing or is not what this builder produces from unchanged sources. Was it edited by hand?`);
        process.exit(3);
      }
    }
    console.log(`${label}: sources unchanged; ${Object.keys(outputs).join(", ")} reproduce exactly.`);
    return;
  }
  for (const [path, value] of Object.entries(outputs)) writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(outputs).join(", ")}.`);
}
