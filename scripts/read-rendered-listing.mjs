#!/usr/bin/env node
/**
 * A public page that lists its files only to a browser running its own
 * JavaScript, read the way a person's browser reads it.
 *
 *   node scripts/read-rendered-listing.mjs --out .research/rendered
 *
 * Reads `.research/request.json` → "rendered": [{ "id", "url" }]. For each,
 * opens the page in Chromium with North Ground's own user agent, waits for the
 * network to settle, and writes the links the rendered page shows and the
 * requests the page itself made (its own data endpoints). Nothing is clicked
 * past a login, a consent wall or a CAPTCHA; a page that asks for one is
 * written down as asking (CLAUDE.md §44: browser-rendered retrieval within the
 * site's normal public access, never around a deliberate restriction).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : ".research/rendered";
const USER_AGENT = "NorthGroundBushcraft/1.0 (+https://www.northgroundbushcraft.com)";
const request = JSON.parse(readFileSync(".research/request.json", "utf8"));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const index = [];
for (const { id, url } of request.rendered ?? []) {
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();
  const requests = [];
  page.on("request", (r) => { if (["xhr", "fetch", "document"].includes(r.resourceType())) requests.push({ method: r.method(), url: r.url(), type: r.resourceType() }); });
  const entry = { id, url, retrievedAt: new Date().toISOString() };
  try {
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
    entry.status = response?.status() ?? null;
    await page.waitForTimeout(4_000);
    entry.title = await page.title();
    entry.links = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => ({ text: (a.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 160), href: a.href })));
    entry.text = (await page.evaluate(() => document.body?.innerText ?? "")).slice(0, 20_000);
    entry.requests = requests;
    process.stdout.write(`ok   ${id} ${entry.status} ${entry.links.length} links, ${requests.length} requests\n`);
  } catch (error) {
    entry.error = String(error);
    entry.requests = requests;
    process.stdout.write(`FAIL ${id}: ${error}\n`);
  }
  writeFileSync(join(OUT, `${id}.json`), `${JSON.stringify(entry, null, 1)}\n`);
  index.push({ id, url, status: entry.status ?? null, error: entry.error ?? null });
  await context.close();
}
await browser.close();
writeFileSync(join(OUT, "index.json"), `${JSON.stringify(index, null, 1)}\n`);
