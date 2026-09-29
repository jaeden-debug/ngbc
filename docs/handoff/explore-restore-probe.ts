/** Does `?explore=1` restore on a RELOAD of the same link? Counts markers, twice. */
import { chromium } from "playwright";
const BASE = process.argv[2] ?? "http://localhost:3100";
const LINK = process.argv[3] ?? "/hunt?zone=ca-on-wmu-57&species=moose&date=2026-10-15&explore=1";
const browser = await chromium.launch();
const W = Number(process.argv[4] ?? 375), H = Number(process.argv[5] ?? 812);
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: W < 700, isMobile: W < 700 });
const page = await ctx.newPage();
const consoleErrors: string[] = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 110)); });
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 110)}`));
/* THE POSITIVE CONTROL. A zero marker count means nothing on its own: it is the
   same output whether the layer is broken, the viewport holds no conditional
   zone, or the answers never arrived. So capture what the server actually
   returned and count green zones too — a zero is only believable beside a
   non-zero that proves the instrument works. */
const calls: Array<Record<string, unknown>> = [];
page.on("response", async (r) => {
  if (!r.url().includes("/api/hunt/zone-status")) return;
  try {
    const body = await r.json() as { states?: Array<{ designation?: string; opportunity: { hasCurrentLegalOpportunity: boolean; hasMaterialConditions: boolean } }> };
    const states = body.states ?? [];
    const conditional = states.filter((s) => s.opportunity.hasMaterialConditions).map((s) => s.designation ?? "?");
    calls.push({ zones: states.length,
                 open: states.filter((s) => s.opportunity.hasCurrentLegalOpportunity).length,
                 withConditions: conditional.length,
                 conditionalZones: conditional,
                 askedFor: states.map((s) => s.designation ?? "?").slice(0, 20) } as never);
  } catch { calls.push({ zones: -1 }); }
});
const look = async (label: string) => {
  for (let i = 0; i < 150; i += 1) {
    const n = await page.evaluate(() => document.querySelectorAll("[data-zone-marker]").length);
    if (n > 0) break;
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(2500);
  const seen = await page.evaluate(() => ({
    /* DID THE LAYER MOUNT AT ALL? Asked before anything is counted. A thin
       layer and an absent layer both yield few marks, and they are different
       faults: the first is label rationing, the second is the species layer
       never mounting. The total button count tells them apart — a page with a
       dozen buttons has no layer, whatever the marker count says. */
    totalButtons: document.querySelectorAll("button").length,
    legend: (() => {
      const el = [...document.querySelectorAll("*")].find((e) => /zones open|with evidence|with !/i.test(e.textContent ?? "") && e.children.length < 8);
      return el ? (el.textContent ?? "").trim().slice(0, 90) : null;
    })(),
    speciesShown: document.querySelector("section[data-layout] h2,section[data-layout] h1")?.textContent?.trim().slice(0, 30) ?? null,
    markers: document.querySelectorAll("[data-zone-marker]").length,
    markersByLabel: document.querySelectorAll("[aria-label*='has conditions']").length,
    zoneLabels: document.querySelectorAll("[class*='mapZoneLabel'],[data-zone-label]").length,
    /* Which renderer actually drew this. The two express the `!` differently,
       so a claim established on one is not a claim about the other. */
    renderer: document.querySelector(".gm-style") ? "google"
      : document.querySelector("[class*='zoneCanvas'],svg[class*='zoneCanvas']") ? "canvas" : "unknown",
    googleTiles: document.querySelectorAll(".gm-style img").length,
    /* The camera, because a marker hangs off a LABEL and labels are rationed by
       how much room a zone has on screen. If the two loads frame differently,
       a differing marker count is label rationing, not a restore race. */
    camera: (() => {
      const svg = document.querySelector("svg[viewBox]");
      return svg ? svg.getAttribute("viewBox") : null;
    })(),
    labelTexts: [...document.querySelectorAll("[class*='mapZoneLabel'],[data-zone-label]")].map((e) => (e.textContent ?? "").trim()).slice(0, 20),
    search: location.search,
    findGamePressed: document.querySelector("[aria-label*='Find game'],[aria-label*='find game']")?.getAttribute("aria-pressed") ?? null,
    zoneHeading: document.querySelector("section[data-layout] h1,section[data-layout] h2")?.textContent?.trim().slice(0, 34) ?? null,
  }));
  console.log(label.padEnd(14), JSON.stringify(seen));
  console.log("  zone-status calls:", JSON.stringify(calls.splice(0)).slice(0, 180));
  console.log("  console errors:", consoleErrors.length ? consoleErrors.splice(0).slice(0, 3) : "none");
  return seen;
};
/*
 * A RETURNING BROWSER, not a clean one.
 *
 * The report came from a browser that had been used on the site all afternoon,
 * so its profile held a stored session; a fresh context holds none. §41A says a
 * link wins and nothing stored is restored over it, which is exactly the rule a
 * race would break — and it can only be broken when there IS something stored.
 * So warm the profile first, in the same context, before opening the link.
 */
if (process.env.WARM === "1") {
  await page.goto(`${BASE}/hunt`);
  await page.waitForTimeout(9000);
  const stored = await page.evaluate(() => Object.keys(localStorage).length);
  console.log(`warmed: ${stored} localStorage keys before opening the link`);
}
await page.goto(`${BASE}${LINK}`);
const first = await look("first load:");
await page.reload();
const second = await look("after reload:");
console.log("\nREPRODUCED:", first.markers > 0 && second.markers === 0 ? "YES — markers on first load, none on reload"
  : first.markers === second.markers ? `no — same both times (${first.markers})` : `partial — ${first.markers} then ${second.markers}`);
console.log("URL changed between loads:", first.search !== second.search, `(${first.search} -> ${second.search})`);
await browser.close();
