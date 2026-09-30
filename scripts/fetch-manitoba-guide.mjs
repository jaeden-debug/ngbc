#!/usr/bin/env node
/**
 * Read Manitoba's hunting guide as published now, and as it was when North
 * Ground transcribed it, so the change can be reviewed rather than accepted.
 *
 *   node scripts/fetch-manitoba-guide.mjs --out .research/manitoba-guide
 *
 * The cross-check (`content/regulatory/sources/ca-mb-hunting-guide-2026-
 * crosscheck.json`) was transcribed from one exact PDF, identified by its
 * sha256. The province replaced the file; the builder refuses to use the
 * transcription until it is redone (§45: a changed government document
 * triggers review). This reads the current PDF, and looks in the Internet
 * Archive for a capture whose bytes hash to the transcribed version, so the
 * two texts can be compared page by page. It interprets nothing.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : ".research/manitoba-guide";
const crosscheck = JSON.parse(readFileSync("content/regulatory/sources/ca-mb-hunting-guide-2026-crosscheck.json", "utf8"));
const URL_ = crosscheck.source.url;
const TRANSCRIBED = crosscheck.source.sha256;
const USER_AGENT = "NorthGroundBushcraft/1.0 (+https://www.northgroundbushcraft.com)";

const sha = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
async function bytesOf(url) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(180_000), redirect: "follow" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt === 3) throw new Error(`${url}: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 3000 * attempt));
    }
  }
}
function text(bytes) {
  const run = spawnSync("python3", ["scripts/pdf-text.py"], { input: bytes, maxBuffer: 256 * 1024 * 1024 });
  if (run.status !== 0) throw new Error(`pdf-text.py: ${run.stderr.toString().slice(0, 200)}`);
  return JSON.parse(run.stdout.toString());
}

mkdirSync(OUT, { recursive: true });
const index = { url: URL_, transcribedHash: TRANSCRIBED, retrievedAt: new Date().toISOString().slice(0, 10), current: null, archived: [] };

const current = await bytesOf(URL_);
index.current = { sha256: sha(current), bytes: current.length, textFile: "current.json" };
writeFileSync(join(OUT, "current.json"), `${JSON.stringify({ sha256: index.current.sha256, ...text(current) })}\n`);

/* Every capture the Archive holds of this URL, newest first, one per distinct digest. */
const cdx = await (await fetch(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(URL_.replace(/^https?:\/\//, ""))}&output=json&filter=statuscode:200&collapse=digest`, { headers: { "user-agent": USER_AGENT } })).json().catch(() => []);
const captures = cdx.slice(1).map(([, timestamp, original, , , digest]) => ({ timestamp, original, digest })).reverse();
for (const capture of captures.slice(0, 12)) {
  try {
    const bytes = await bytesOf(`https://web.archive.org/web/${capture.timestamp}id_/${capture.original}`);
    const row = { ...capture, sha256: sha(bytes), bytes: bytes.length };
    if (row.sha256 === TRANSCRIBED || row.sha256 === index.current.sha256) {
      row.textFile = `archived-${capture.timestamp}.json`;
      writeFileSync(join(OUT, row.textFile), `${JSON.stringify({ sha256: row.sha256, ...text(bytes) })}\n`);
    }
    index.archived.push(row);
  } catch (error) {
    index.archived.push({ ...capture, error: String(error.message).slice(0, 200) });
  }
}
writeFileSync(join(OUT, "index.json"), `${JSON.stringify(index, null, 2)}\n`);
process.stdout.write(`current ${index.current.sha256} (${index.current.bytes} B); ${captures.length} captures; transcribed version ${index.archived.some((row) => row.sha256 === TRANSCRIBED) ? "FOUND" : "not found"} in the Archive\n`);
