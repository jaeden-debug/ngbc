/**
 * How fast Hunt is for someone on a phone: the numbers a release is judged by.
 *
 *   node scripts/measure-hunt-performance.mjs <baseUrl> [--runs 3] [--label name] [--auth url]
 *
 * Runs Chromium with Lighthouse's mobile profile applied through the DevTools
 * protocol — 4x CPU slowdown and a slow-4G link (150 ms RTT, 1.6 Mbps down,
 * 750 Kbps up) on a 390x844 touch screen — and reports, per run and as medians:
 *
 *   LCP, CLS, total blocking time and the longest task during load;
 *   first-load JavaScript for /hunt, raw, gzip and brotli, measured from the
 *   exact files the page requested;
 *   time to the first official zone on the map and to the first zone label;
 *   API requests made on open;
 *   the longest task while the map is panned.
 *
 * The same script measures any deployment, so a before/after comparison runs
 * both through identical conditions. It never evaluates a hunt and never
 * creates a Hunt Brief.
 */
import { chromium } from "playwright";
import { brotliCompressSync, gzipSync, constants } from "node:zlib";

const args = process.argv.slice(2);
const base = args.find((arg, index) => !arg.startsWith("--") && !["--runs", "--label", "--auth"].includes(args[index - 1])) ?? "http://localhost:3104";
// A protected preview's share link, opened once per run before measuring so its access cookie is set.
const auth = args.includes("--auth") ? args[args.indexOf("--auth") + 1] : null;
const runs = Number(args[args.indexOf("--runs") + 1] || 3) || 3;
const label = args.includes("--label") ? args[args.indexOf("--label") + 1] : base;

const NETWORK = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };
const CPU_SLOWDOWN = 4;

function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/* Sized from the bytes the page itself received, so a protected preview's
   login page can never be counted as JavaScript. */
function firstLoadJs(scripts, bodies) {
  let raw = 0, gzip = 0, brotli = 0;
  for (const url of scripts) {
    const body = bodies.get(url) ?? Buffer.alloc(0);
    raw += body.length;
    gzip += gzipSync(body, { level: 9 }).length;
    brotli += brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
  }
  return { files: scripts.length, raw, gzip, brotli };
}

async function run(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  });
  const page = await context.newPage();
  if (auth) await page.goto(auth, { timeout: 120_000 });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", NETWORK);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN });

  const apiRequests = [];
  const scripts = new Set();
  const bodies = new Map();
  page.on("response", async (response) => {
    const request = response.request();
    if (request.resourceType() !== "script" || new URL(request.url()).origin !== new URL(base).origin) return;
    const body = await response.body().catch(() => null);
    if (body) bodies.set(request.url(), body);
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) apiRequests.push(`${request.method()} ${url.pathname}${url.search}`);
    if (request.resourceType() === "script" && url.origin === new URL(base).origin) scripts.add(request.url());
  });

  await page.addInitScript(() => {
    const vitals = { lcp: 0, lcpElement: null, cls: 0, longTasks: [], firstZone: null, firstLabel: null };
    window.__vitals = vitals;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        vitals.lcp = entry.startTime;
        // What the largest paint was: the poster, a map tile, text — the cause of a slow run.
        const element = entry.element;
        vitals.lcpElement = element ? `${element.tagName.toLowerCase()}${element.className ? `.${String(element.className).split(" ")[0].replace(/^.*__/, "")}` : ""}` : entry.url.slice(0, 40);
      }
    })
      .observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) vitals.cls += entry.value; })
      .observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => { for (const entry of list.getEntries()) vitals.longTasks.push({ start: entry.startTime, duration: entry.duration }); })
      .observe({ type: "longtask", buffered: true });
    const poll = () => {
      // New Hunt states its drawn zones; the old one is read from its labels. Either way: official geometry on screen.
      const surface = document.querySelector("[data-zones]");
      const zones = surface ? Number(surface.getAttribute("data-zones")) : 0;
      const labels = [...document.querySelectorAll("[class*=mapZoneLabel]")].filter((element) => element.style.display !== "none" && element.textContent);
      if (vitals.firstZone === null && (zones > 0 || labels.length > 0)) vitals.firstZone = performance.now();
      if (vitals.firstLabel === null && labels.length > 0) vitals.firstLabel = performance.now();
      if (vitals.firstLabel === null) requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  });

  const response = await page.goto(`${base}/hunt`, { waitUntil: "load", timeout: 120_000 });
  const posterInHtml = (await response.text()).includes("data:image/svg+xml");
  // First-load JavaScript is what the page asked for up to its load event; chunks warmed later on idle are not counted.
  const firstLoadScripts = [...scripts];
  // The page's CSP forbids eval, so waitForFunction's polling cannot run here; poll with evaluate instead.
  for (let waited = 0; waited < 60_000; waited += 250) {
    if (await page.evaluate(() => window.__vitals.firstLabel !== null)) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(2_500);
  const load = await page.evaluate(() => {
    const v = window.__vitals;
    const tbt = v.longTasks.reduce((total, task) => total + Math.max(0, task.duration - 50), 0);
    const surface = document.querySelector("[data-zones]");
    return {
      lcp: v.lcp, lcpElement: v.lcpElement, cls: v.cls, tbt, longestTask: Math.max(0, ...v.longTasks.map((task) => task.duration)), firstZone: v.firstZone, firstLabel: v.firstLabel,
      tasksBefore: v.longTasks.length, zonesNow: surface?.getAttribute("data-zones") ?? null, labelsNow: document.querySelectorAll("[class*=mapZoneLabel]").length,
    };
  });
  const openRequests = [...apiRequests];

  // Pan the map with a finger-sized drag, three times, and read the longest task while it moved.
  const before = await page.evaluate(() => window.__vitals.longTasks.length);
  for (let index = 0; index < 3; index += 1) {
    await page.mouse.move(200, 300);
    await page.mouse.down();
    for (let step = 1; step <= 12; step += 1) await page.mouse.move(200 - step * 12, 300 + step * 6, { steps: 1 });
    await page.mouse.up();
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1_500);
  const pan = await page.evaluate((from) => {
    const tasks = window.__vitals.longTasks.slice(from);
    return { panTasks: tasks.length, longestPanTask: Math.max(0, ...tasks.map((task) => task.duration)) };
  }, before);

  await context.close();
  return { ...load, ...pan, posterInHtml, openRequests, bodies, scripts: firstLoadScripts, laterScripts: [...scripts].filter((url) => !firstLoadScripts.includes(url)) };
}

const browser = await chromium.launch();
const results = [];
for (let index = 0; index < runs; index += 1) results.push(await run(browser));
await browser.close();

const js = firstLoadJs(results[0].scripts, results[0].bodies);
const later = firstLoadJs(results[0].laterScripts, results[0].bodies);
const summary = {
  label,
  conditions: `Chromium, 390x844 touch, ${CPU_SLOWDOWN}x CPU, 150 ms RTT, 1.6 Mbps down, cache disabled, ${runs} runs (medians)`,
  lcpMs: median(results.map((result) => result.lcp)),
  cls: median(results.map((result) => result.cls)),
  tbtMs: median(results.map((result) => result.tbt)),
  longestLoadTaskMs: median(results.map((result) => result.longestTask)),
  firstZoneMs: median(results.map((result) => result.firstZone)),
  firstLabelMs: median(results.map((result) => result.firstLabel)),
  longestPanTaskMs: median(results.map((result) => result.longestPanTask)),
  apiRequestsOnOpen: results[0].openRequests,
  firstLoadJs: js,
  laterOnDemandJs: later,
  maxLcpMs: Math.max(...results.map((result) => result.lcp)),
  perRun: results.map(({ lcp, lcpElement, posterInHtml, cls, tbt, firstZone, firstLabel, longestPanTask, zonesNow, labelsNow }) => ({ lcp, lcpElement, posterInHtml, cls, tbt, firstZone, firstLabel, longestPanTask, zonesNow, labelsNow })),
};
console.log(JSON.stringify(summary, null, 2));
