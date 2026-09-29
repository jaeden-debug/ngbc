/** Does `?explore=1` restore on a RELOAD of the same link? Counts markers, twice. */
import { chromium } from "playwright";
const BASE = process.argv[2] ?? "http://localhost:3100";
const LINK = process.argv[3] ?? "/hunt?zone=ca-on-wmu-57&species=moose&date=2026-10-15&explore=1";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
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
    markers: document.querySelectorAll("[data-zone-marker]").length,
    markersByLabel: document.querySelectorAll("[aria-label*='has conditions']").length,
    zoneLabels: document.querySelectorAll("[class*='mapZoneLabel'],[data-zone-label]").length,
    renderer: document.querySelector("[data-map-ready='true']") ? "google"
      : document.querySelector("[class*='zoneCanvas']") ? "canvas" : "none",
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
  console.log("  zone-status calls:", JSON.stringify(calls.splice(0)));
  return seen;
};
await page.goto(`${BASE}${LINK}`);
const first = await look("first load:");
await page.reload();
const second = await look("after reload:");
console.log("\nREPRODUCED:", first.markers > 0 && second.markers === 0 ? "YES — markers on first load, none on reload"
  : first.markers === second.markers ? `no — same both times (${first.markers})` : `partial — ${first.markers} then ${second.markers}`);
console.log("URL changed between loads:", first.search !== second.search, `(${first.search} -> ${second.search})`);
await browser.close();
