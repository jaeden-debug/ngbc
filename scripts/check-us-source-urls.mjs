#!/usr/bin/env node
/**
 * Check that every URL North Ground cites for a United States jurisdiction is
 * still served.
 *
 * WHY THIS EXISTS. Connecticut's stored authority URL was dead for ten days and
 * nothing noticed, because nothing checks these URLs. It returned a plain HTTP
 * 404 — catchable by the most ordinary check there is — so the reason it survived
 * was the absence of the check, not the subtlety of the failure. §58 is explicit
 * that a source silently failing is unacceptable.
 *
 * WHY IT IS A SCRIPT AND NOT A TEST. §59: unit tests must not depend on live
 * government APIs. A test that fails when a state's web server has a bad morning
 * is a test people learn to ignore, and then it is not a check at all.
 *
 * THE SOFT-404 PROBLEM IS THE POINT. A great many government sites answer HTTP
 * 200 for a page that does not exist:
 *
 *   - ArcGIS Hub returns its client shell, 200, for ANY unknown slug. Vermont's
 *     nonexistent terms page returned 65,868 bytes against a real page's 65,865.
 *   - Connecticut's portal 200s and redirects to `/en/404error/?item=…`.
 *   - Several agency sites serve a generic shell of identical size for every
 *     unrecognised path.
 *
 * So a 200 is reported as SOFT_404_SUSPECTED when the response carries a
 * 404 marker or lands on a URL that says so. That is a suspicion, not a verdict:
 * the script says what it observed and leaves the judgement to a person, because
 * a heuristic that silently condemned a live page would be worse than no check.
 *
 * Usage: node scripts/check-us-source-urls.mjs [--json]
 * Exit 0 always: this reports, it does not gate. A CI gate on a third party's
 * uptime would fail for reasons that are not ours.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AGENT = "Mozilla/5.0 (compatible; NorthGroundSourceCheck/1.0)";
const TIMEOUT_MS = 25_000;
const CONCURRENCY = 6;

/** Every URL a US jurisdiction cites, with what cites it. */
function collect() {
  const seen = new Map();
  const add = (url, cite) => {
    if (typeof url !== "string" || !url.startsWith("http")) return;
    /* A service endpoint is checked as itself; a bare ArcGIS REST root without
       ?f=json renders an HTML page and is not the thing we rely on. */
    const key = url;
    if (!seen.has(key)) seen.set(key, { url, cites: [] });
    seen.get(key).cites.push(cite);
  };

  const jurisdictions = JSON.parse(
    readFileSync(join(ROOT, "src/lib/hunt/united-states/jurisdictions.generated.json"), "utf8"));
  for (const j of jurisdictions.jurisdictions ?? jurisdictions) {
    const code = j.code ?? j.id;
    if (j.authority?.url) add(j.authority.url, `${code} authority`);
    if (j.officialSourceUrl) add(j.officialSourceUrl, `${code} officialSourceUrl`);
    for (const source of j.officialSources ?? []) add(source.url, `${code} source ${source.id ?? source.scope}`);
  }

  const findings = JSON.parse(
    readFileSync(join(ROOT, "content/registry/us-map-licence-findings.json"), "utf8"));
  for (const finding of findings.findings ?? []) {
    /* The licence URL is the one that matters most: it is the evidence for a
       reuse claim, and a licence we can no longer read is a claim we can no
       longer support. */
    if (finding.licence?.url?.startsWith("http")) add(finding.licence.url, `${finding.state} licence`);
  }
  return [...seen.values()];
}

const SOFT_404 = /404error|\/404\b|page[-_ ]not[-_ ]found|"errors"\s*:|Service not found/i;

async function check(entry) {
  const started = Date.now();
  try {
    const res = await fetch(entry.url, {
      headers: { "User-Agent": AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await res.text().catch(() => "");
    const landed = res.url && res.url !== entry.url ? res.url : null;
    let verdict = res.ok ? "OK" : `HTTP_${res.status}`;
    if (res.ok && (SOFT_404.test(landed ?? "") || SOFT_404.test(body.slice(0, 4000)))) {
      verdict = "SOFT_404_SUSPECTED";
    }
    return { ...entry, status: res.status, bytes: body.length, landed, verdict, ms: Date.now() - started };
  } catch (error) {
    /*
     * THE CAUSE IS THE FINDING, NOT THE FAILURE.
     *
     * `fetch` reports every one of these as the same useless string, "fetch
     * failed", and the first run of this script duly reported Mississippi as
     * UNREACHABLE. It is not: mdwfp.com answers HTTP 200 with 268,866 bytes to
     * curl, and Node rejects it because the site does not serve its intermediate
     * certificate — "unable to verify the first certificate". A browser and curl
     * succeed where Node does not.
     *
     * Recording that as unreachable would have invented a blocker for a state
     * whose site works, which is the over-strict error §8 names. So the cause is
     * unwrapped and classified, because the remedies differ completely: an
     * incomplete chain is the publisher's misconfiguration and still readable by
     * another client; a connect timeout is a host that will not talk to us at
     * all; a 403 is a refusal of this reader specifically.
     */
    const message = String(error?.message ?? error);
    const cause = String(error?.cause?.message ?? error?.cause ?? "");
    const both = `${message} ${cause}`;
    const verdict = /certificate|CERT_|self.signed|altnames|SSL|TLS/i.test(both)
      ? "TLS_CHAIN_PROBLEM"
      : /timeout|ETIMEDOUT|abort/i.test(both)
        ? "CONNECT_TIMEOUT"
        : /ECONNREFUSED/i.test(both)
          ? "CONNECTION_REFUSED"
          : /ENOTFOUND|EAI_AGAIN|dns/i.test(both)
            ? "DNS_FAILURE"
            : "UNREACHABLE";
    return {
      ...entry, status: 0, bytes: 0, landed: null, verdict,
      detail: (cause || message).slice(0, 160),
      /* Said plainly, because the next reader will otherwise repeat the mistake. */
      note: verdict === "TLS_CHAIN_PROBLEM"
        ? "Node rejects this; curl and browsers may accept it. Verify with a second client before recording a blocker."
        : undefined,
      ms: Date.now() - started,
    };
  }
}

async function main() {
  const entries = collect();
  const results = [];
  /* Bounded concurrency: this hits other people's servers, and a burst of 150
     parallel requests is indistinguishable from abuse at the far end. */
  const queue = [...entries];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    for (let next = queue.shift(); next; next = queue.shift()) results.push(await check(next));
  }));

  const rank = { CONNECTION_REFUSED: 0, CONNECT_TIMEOUT: 1, DNS_FAILURE: 1, UNREACHABLE: 2, TLS_CHAIN_PROBLEM: 3, SOFT_404_SUSPECTED: 4, OK: 9 };
  results.sort((a, b) => (rank[a.verdict] ?? 3) - (rank[b.verdict] ?? 3) || a.url.localeCompare(b.url));

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ checkedAt: new Date().toISOString(), total: results.length, results }, null, 2));
    return;
  }

  const bad = results.filter((r) => r.verdict !== "OK");
  console.log(`Checked ${results.length} United States source URLs. ${results.length - bad.length} OK, ${bad.length} need a look.\n`);
  for (const r of bad) {
    console.log(`${r.verdict.padEnd(20)} ${r.url}`);
    console.log(`  cited by: ${r.cites.join(", ")}`);
    if (r.landed) console.log(`  landed on: ${r.landed}`);
    if (r.detail) console.log(`  detail: ${r.detail}`);
    if (r.note) console.log(`  NOTE: ${r.note}`);
    console.log(`  ${r.status} | ${r.bytes} bytes | ${r.ms} ms`);
  }
  if (!bad.length) console.log("Every cited URL answered.");
  /* Deliberately exit 0. See the header: this reports, it does not gate. */
}

main();
