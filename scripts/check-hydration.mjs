/**
 * Does the page the server sends match the page the browser builds?
 *
 * A hydration mismatch means the server rendered one thing and the browser
 * rendered another. React patches over it and the visible page usually looks
 * fine, which is why this class of defect ships: the only signal is a console
 * error nobody is watching.
 *
 * It is not cosmetic. When /hunt mismatched, the HTML served to every crawler,
 * answer engine and reader without JavaScript carried TOMORROW's hunt date for
 * four hours each evening, and the date is the second most important input to a
 * regulatory answer.
 *
 * The configuration is the whole point: the server runs in UTC, as it does on
 * Vercel, and the browser does not. A developer's machine shares one zone
 * between both and cannot see this at any hour.
 *
 * Ontario alone is not enough, and that is easy to miss: Ontario and UTC share a
 * calendar day for twenty hours of every twenty-four, so a check run in Ontario
 * at 14:00 UTC would pass a regression of the very bug it exists for. Kiritimati
 * (UTC+14) is on a different day from UTC from 10:00 UTC onward and Pago Pago
 * (UTC-11) is until 10:59, so between them some browser disagrees with the
 * server about the date at every moment of the day — verified for all 96
 * quarter-hours. CI can therefore run whenever it runs.
 *
 *   node scripts/check-hydration.mjs [baseUrl]
 *
 * Exit 0 clean, 1 if any page mismatched or logged an error.
 */
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://127.0.0.1:3210";

/**
 * Pages that render on the server and hydrate in the browser.
 *
 * `status` is the status the page is SUPPOSED to answer with; a 404 page that
 * returns 404 is correct, and the browser logging that it did is not an error.
 * `ssr` is text that must be present in the HTML before any JavaScript runs —
 * which is what a crawler, an answer engine and a reader on a slow connection
 * actually receive.
 */
const PAGES = [
  { path: "/", name: "home", status: 200 },
  { path: "/hunt", name: "hunt", status: 200, ssr: "Your zone. Your season. Your hunt." },
  { path: "/hunting/species", name: "species library", status: 200 },
  { path: "/hunting/species/ruffed-grouse", name: "species profile", status: 200, ssr: "Ruffed grouse" },
  // Unknown species slugs used to reach `notFound()` mid-stream and serve a
  // 404 whose body existed only in the RSC payload — an empty page without
  // JavaScript. `dynamicParams = false` fixed it; this keeps it fixed.
  { path: "/hunting/species/not-a-real-species", name: "unknown species", status: 404, ssr: "Off the marked trail" },
  { path: "/this-route-does-not-exist", name: "unknown route", status: 404, ssr: "Off the marked trail" },
  // A missing Hunt Brief used to be the same empty 404: its IDs are dynamic, so
  // `dynamicParams` was not available. The proxy now decides "missing" before
  // the page renders and rewrites to a real 404 page. A malformed ID is decided
  // without touching storage, so this exercises proxy, rewrite and page the
  // same way in CI as in production.
  {
    path: "/hunt/share/bad",
    name: "hunt brief (malformed id)",
    status: 404,
    ssr: "This Hunt Brief isn\u2019t available",
  },
  // A well-formed ID that names no brief answers 404 with storage and 200
  // "temporarily unavailable" without it — correctly, since without storage
  // nobody can tell whether it exists. So its status is not pinned; it is
  // still checked for hydration either way.
  { path: "/hunt/share/definitely-not-a-real-brief", name: "hunt brief (missing)" },
];

/**
 * React reports hydration problems as #418, #419, #423 and #425 in production
 * builds and as readable text in development. Both are caught; a production
 * build is what CI runs, so the numbers are what usually appear.
 */
const HYDRATION = /Minified React error #(418|419|423|425)\b|hydrat|did not match|server.rendered HTML/i;

/** Noise that is not the application's to fix and never indicates a mismatch. */
const IGNORED = [
  // The browser logs a line for every non-2xx response, including the page's
  // own deliberate 404. Failed sub-resources are caught from the network below,
  // where the document itself can be told apart from a broken asset.
  /Failed to load resource/i,
  /preloaded using link preload but not used/i,
  /google\.maps\.Marker is deprecated/i,
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
];

/**
 * Ontario is the reader the product is built for. The other two guarantee that
 * at least one browser is on a different calendar day from the UTC server, at
 * whatever hour this runs.
 */
const BROWSER_TIME_ZONES = ["America/Toronto", "Pacific/Kiritimati", "Pacific/Pago_Pago"];

async function main() {
  const browser = await chromium.launch();
  const failures = [];

  for (const timeZone of BROWSER_TIME_ZONES) {
  console.log(`\n— browser in ${timeZone}`);
  const context = await browser.newContext({ timezoneId: timeZone, locale: "en-CA" });

  for (const page of PAGES) {
    const tab = await context.newPage();
    const problems = [];

    tab.on("console", (message) => {
      if (message.type() !== "error" && message.type() !== "warning") return;
      const text = message.text();
      if (IGNORED.some((pattern) => pattern.test(text))) return;
      if (HYDRATION.test(text)) problems.push({ kind: "HYDRATION", text });
      else if (message.type() === "error") problems.push({ kind: "CONSOLE", text });
    });
    tab.on("pageerror", (error) => {
      const text = error?.message ?? String(error);
      if (IGNORED.some((pattern) => pattern.test(text))) return;
      problems.push({ kind: HYDRATION.test(text) ? "HYDRATION" : "PAGE", text });
    });

    const url = `${BASE}${page.path}`;
    // A broken image, script or stylesheet — anything other than the page itself.
    tab.on("response", (response) => {
      if (response.url() === url || response.request().resourceType() === "document") return;
      if (response.status() >= 400) {
        problems.push({ kind: "SUBRESOURCE", text: `${response.status()} ${response.url()}` });
      }
    });

    try {
      const response = await tab.goto(url, { waitUntil: "load", timeout: 60_000 });
      const status = response?.status() ?? 0;
      if (status >= 500) problems.push({ kind: "HTTP", text: `HTTP ${status}` });
      else if (page.status && status !== page.status) {
        problems.push({ kind: "HTTP", text: `expected ${page.status}, got ${status}` });
      }
      // Hydration errors surface after the bundle runs, not at load.
      await tab.waitForTimeout(3_000);
    } catch (error) {
      problems.push({ kind: "NAVIGATION", text: error?.message ?? String(error) });
    }

    // What a reader without JavaScript receives. Fetched separately rather than
    // read from the live DOM, which by now reflects what the browser built.
    if (page.ssr) {
      const html = await (await fetch(url)).text();
      // The BODY, and nothing but. The first version of this check searched the
      // whole document and passed a 404 whose body was empty, because "Page not
      // found" is also the <title> — which is in <head>, always server-rendered,
      // and says nothing about whether a reader sees a page. It could not fail.
      const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? "";
      const serverRendered = body.replace(/<script[\s\S]*?<\/script>/gi, "");
      if (!serverRendered.includes(page.ssr)) {
        problems.push({
          kind: "SSR",
          text: `"${page.ssr}" is not in the server-rendered HTML — only JavaScript would show it`,
        });
      }
    }

    const hydration = problems.filter((problem) => problem.kind === "HYDRATION");
    const label = `${page.name} (${page.path}) [${timeZone}]`;
    if (problems.length) {
      failures.push({ page: label, problems });
      console.error(`FAIL  ${label}`);
      for (const problem of problems) console.error(`        ${problem.kind}: ${problem.text.slice(0, 300)}`);
    } else {
      console.log(`ok    ${label}`);
    }
    if (hydration.length) console.error(`        ^ the server and the browser disagreed about this page`);

    await tab.close();
  }
  await context.close();
  }

  await browser.close();

  if (failures.length) {
    console.error(`\n${failures.length} of ${PAGES.length * BROWSER_TIME_ZONES.length} page loads failed.`);
    console.error("A hydration mismatch means the HTML served to crawlers is not the page a reader sees.");
    process.exit(1);
  }
  console.log(
    `\nAll ${PAGES.length} pages hydrated cleanly in ${BROWSER_TIME_ZONES.length} browser time zones ` +
    "against a UTC server — including at least one on a different calendar day from it.",
  );
}

main().catch((error) => {
  console.error(`Hydration check failed to run: ${error?.message ?? error}`);
  process.exit(1);
});
