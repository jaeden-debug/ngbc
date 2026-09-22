/**
 * Certify the Hunt application end to end, in a real browser.
 *
 *   node scripts/certify-hunt-app.mjs [baseUrl] [--only name,name] [--brief] [--auth url]
 *
 * Each scenario drives Chromium the way a hunter would and checks what they
 * would see — and what must never happen: a result shown for other inputs, a
 * coordinate in a URL, the device's position reaching the evaluation, a map
 * that goes blank while it moves, a page wider than the phone. `--brief` also
 * creates one Hunt Brief through the Share dialog, which writes to storage, so
 * it is off by default. `--auth` names a URL each fresh browser opens first —
 * a protected preview's share link — so its access cookie is set.
 *
 * The regulatory answers themselves are certified elsewhere (the jurisdiction
 * suites and scripts/certify-hunt-cases.mjs); this proves the interface asks
 * the same engine and presents its answer truthfully.
 *
 * Exit 0 when every check passes, 1 otherwise.
 */
import { chromium } from "playwright";

const args = process.argv.slice(2);
const BASE = args.find((arg, index) => !arg.startsWith("--") && !["--only", "--auth"].includes(args[index - 1])) ?? "http://localhost:3104";
const ONLY = args.includes("--only") ? new Set(args[args.indexOf("--only") + 1].split(",")) : null;
const BRIEF = args.includes("--brief");
const AUTH = args.includes("--auth") ? args[args.indexOf("--auth") + 1] : null;

const BANCROFT = { latitude: 45.0573, longitude: -77.8546 };
const OTTAWA = { latitude: 45.4215, longitude: -75.6972 };
const results = [];

function check(scenario, name, ok, detail = "") {
  results.push({ scenario, name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${scenario} · ${name}${detail ? ` — ${detail}` : ""}`);
}

async function newPage(browser, options = {}) {
  const { width = 390, height = 844, geolocation, permissions = [], share = "stub" } = options;
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    isMobile: width < 700,
    hasTouch: width < 700,
    ...(geolocation ? { geolocation } : {}),
    permissions,
  });
  const page = await context.newPage();
  if (AUTH) await page.goto(AUTH);
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // Refused map keys on unlisted local ports are reported by Google itself; not the application's.
    if (/RefererNotAllowedMapError|Failed to load resource.*(404|401)/.test(text)) return;
    // Anything Google's own map scripts log about their own hosts (a refused
    // origin answers with a CORS failure on its internal RPC) is theirs, not Hunt's.
    if (/maps\.googleapis\.com|maps\.gstatic\.com/.test(`${text} ${message.location()?.url ?? ""}`)) return;
    // Vercel injects its toolbar into preview deployments only; the site's CSP refuses it there.
    if (/vercel\.live\//.test(text)) return;
    consoleErrors.push(text.slice(0, 200));
  });
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message.slice(0, 200)}`));
  if (share === "stub") {
    await page.addInitScript(() => {
      window.__shared = [];
      Object.defineProperty(navigator, "share", { configurable: true, value: async (data) => { window.__shared.push(data); } });
    });
  } else if (share === "none") {
    await page.addInitScript(() => { Object.defineProperty(navigator, "share", { configurable: true, value: undefined }); });
  }
  const requests = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) requests.push({ at: Date.now(), method: request.method(), path: url.pathname, search: url.search, body: request.postData() ?? "" });
  });
  return { context, page, consoleErrors, requests };
}

async function waitFor(page, predicate, timeout = 20_000, arg) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await page.evaluate(predicate, arg).catch(() => false)) return true;
    await page.waitForTimeout(200);
  }
  return false;
}

const zoneTitle = (page) => page.evaluate(() => document.getElementById("hunt-zone-title")?.textContent ?? null);
const answerStatus = (page) => page.evaluate(() => document.querySelector("[class*=answerStatus] .ng-status, [class*=answerStatus] [data-state]")?.textContent?.trim() ?? null);

async function mapReady(page) {
  return waitFor(page, () => Number(document.querySelector("[data-zones]")?.getAttribute("data-zones") ?? 0) > 0, 45_000);
}

async function chooseSpecies(page, name) {
  await page.locator("button[data-kind='species']").first().click();
  await page.getByRole("button", { name: new RegExp(`^${name}`, "i") }).first().click();
}

/* ── Scenarios ─────────────────────────────────────────────────────────── */

const scenarios = {
  async locationGranted(browser) {
    const s = "A location granted";
    const { context, page, consoleErrors, requests } = await newPage(browser, { geolocation: BANCROFT, permissions: ["geolocation"] });
    await page.goto(`${BASE}/hunt`);
    check(s, "the map draws official zones", await mapReady(page));
    await page.getByRole("button", { name: "Use my location" }).first().click();
    const resolved = await waitFor(page, () => document.getElementById("hunt-zone-title")?.textContent === "WMU 57", 30_000);
    check(s, "the zone the device is in resolves", resolved, String(await zoneTitle(page)));
    check(s, "the sheet says where you are", await page.getByText("You are in this zone").isVisible().catch(() => false));
    await chooseSpecies(page, "Ruffed grouse");
    const answered = await waitFor(page, () => /In season/.test(document.querySelector("[class*=answerStatus]")?.textContent ?? ""), 30_000);
    check(s, "choosing a species evaluates without a submit", answered, String(await answerStatus(page)));
    check(s, "no Check-this-hunt button exists", (await page.getByRole("button", { name: /check this hunt/i }).count()) === 0);
    const evaluate = requests.find((request) => request.path === "/api/hunt/evaluate");
    check(s, "the evaluation is sent the hunt point only", evaluate && /"latitude":45\.0573/.test(evaluate.body));
    await page.getByRole("button", { name: /^Share WMU 57/ }).click();
    await page.waitForTimeout(500);
    const shared = await page.evaluate(() => window.__shared?.[0] ?? null);
    check(s, "Share uses the device share sheet", Boolean(shared));
    check(s, "the shared link names zone, species and day", shared && /zone=ca-on-wmu-57&species=ruffed-grouse&date=\d{4}-\d{2}-\d{2}/.test(shared.url), shared?.url);
    check(s, "the shared link and text carry no coordinate", shared && !/45\.05|77\.85|lat|lng/i.test(`${shared.url} ${shared.text}`));
    check(s, "the shared text states no legal status", shared && !/in season|closed|open|conditional/i.test(shared.text), shared?.text);
    check(s, "the page URL carries no coordinate", !/45\.05|77\.85/.test(page.url()), page.url());
    // A species whose rules turn on the hunter asks, one fact at a time, and the question is shown whole.
    await chooseSpecies(page, "White-tailed deer");
    const asked = await waitFor(page, () => Boolean(document.querySelector("[role=radiogroup]")), 30_000);
    check(s, "deer asks one question before any status", asked && (await page.locator("[class*=answerStatus] .ng-status").count()) === 0);
    const snap = await page.evaluate(() => document.querySelector("section[data-layout]")?.getAttribute("data-snap"));
    check(s, "the question is shown whole (sheet raised)", snap === "full", String(snap));
    await page.getByRole("radio").first().click();
    const next = await waitFor(page, () => /What will you be hunting with/.test(document.body.innerText), 30_000);
    check(s, "answering asks the next fact", next);
    check(s, "no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
    await context.close();
  },

  async locationDenied(browser) {
    const s = "B location denied, then search";
    const { context, page, consoleErrors } = await newPage(browser);
    await page.goto(`${BASE}/hunt`);
    await mapReady(page);
    await page.getByRole("button", { name: "Use my location" }).first().click();
    const explained = await waitFor(page, () => /Location is off|could not find|took too long|does not share/.test(document.body.innerText), 15_000);
    check(s, "a refusal is explained, not a dead end", explained);
    await page.getByRole("button", { name: /^Search a place$/ }).first().click();
    await page.getByRole("combobox", { name: "Where are you hunting?" }).fill("Winnipeg");
    const suggested = await waitFor(page, () => document.querySelectorAll("[role=option]").length > 0, 20_000);
    // A screen reader hears "Bancroft, ON, Canada", not the two lines run together.
    const option = await page.locator("[role=option]").first().evaluate((element) => ({
      text: (element.textContent ?? "").trim(),
      primary: (element.querySelector("[class*=optionPrimary]")?.textContent ?? "").trim(),
      secondary: Boolean(element.querySelector("[class*=optionSecondary]")),
    })).catch(() => ({ text: "", primary: "", secondary: false }));
    check(s, "a place suggestion reads as one phrase", !option.secondary || option.text.startsWith(`${option.primary}, `), option.text);
    check(s, "place search suggests", suggested);
    if (suggested) {
      await page.locator("[role=option]").first().click();
      const resolved = await waitFor(page, () => /^GHA /.test(document.getElementById("hunt-zone-title")?.textContent ?? ""), 30_000);
      check(s, "a searched place resolves its official zone", resolved, String(await zoneTitle(page)));
      // A city point can sit in a portion the authority restricts; whatever the engine says, it says it with a status word.
      await chooseSpecies(page, "Ruffed grouse");
      const answered = await waitFor(page, () => Boolean(document.querySelector("[class*=answerStatus] .ng-status")), 30_000);
      check(s, "the searched place is evaluated automatically", answered, String(await answerStatus(page)));
    }
    check(s, "no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
    await context.close();
  },

  async deepLinks(browser) {
    const s = "C shared links";
    const { context, page, consoleErrors } = await newPage(browser);
    await page.goto(`${BASE}/hunt?zone=ca-on-wmu-57&species=ruffed-grouse&date=2026-10-01`);
    const restored = await waitFor(page, () => document.getElementById("hunt-zone-title")?.textContent === "WMU 57", 30_000);
    check(s, "the zone is restored and selected", restored, String(await zoneTitle(page)));
    check(s, "the species is restored", (await page.locator("button[data-kind='species']").first().textContent())?.includes("Ruffed grouse"));
    check(s, "the day is restored", /Oct 1/.test((await page.locator("button[data-kind='date']").first().textContent()) ?? ""));
    const state = await waitFor(page, () => Boolean(document.querySelector("[class*=answer] [data-state]")), 30_000);
    check(s, "the whole-zone answer for the species appears", state);
    check(s, "the link's parameters survive", /zone=ca-on-wmu-57/.test(page.url()) && /date=2026-10-01/.test(page.url()), page.url());
    const title = await page.title();
    check(s, "the page title names the shared hunt", /Ruffed grouse · WMU 57 \(Ontario\)/.test(title), title);

    await page.goto(`${BASE}/hunt?zone=57&species=unicorn&date=2026-02-30`);
    await mapReady(page);
    check(s, "a malformed link says it was only partly read", await page.getByText("Part of this link could not be read").isVisible().catch(() => false));
    check(s, "a malformed link selects nothing", (await zoneTitle(page)) === null);

    await page.goto(`${BASE}/hunt?zone=ca-on-wmu-999`);
    const refused = await waitFor(page, () => /not one North Ground draws/.test(document.body.innerText), 45_000);
    check(s, "a zone that does not exist is refused, not invented", refused);

    await page.goto(`${BASE}/hunt?species=${encodeURIComponent("species:ruffed-grouse")}`);
    await page.waitForTimeout(800);
    check(s, "old species-profile links still preselect", (await page.locator("button[data-kind='species']").first().textContent().catch(() => ""))?.includes("Ruffed grouse"));
    check(s, "no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
    await context.close();
  },

  async staleAnswers(browser) {
    const s = "D rapid changes never show a stale answer";
    const { context, page } = await newPage(browser, { geolocation: BANCROFT, permissions: ["geolocation"] });
    // Answers arrive in the reverse of the order they were asked for.
    const delays = { "species:white-tailed-deer": 2_600, "species:moose": 1_600, "species:ruffed-grouse": 150 };
    await page.route("**/api/hunt/evaluate", async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}");
      await new Promise((resolve) => setTimeout(resolve, delays[body.speciesId] ?? 0));
      await route.continue();
    });
    await page.goto(`${BASE}/hunt`);
    await mapReady(page);
    await page.getByRole("button", { name: "Use my location" }).first().click();
    await waitFor(page, () => document.getElementById("hunt-zone-title")?.textContent === "WMU 57", 30_000);
    await chooseSpecies(page, "White-tailed deer");
    await page.waitForTimeout(200);
    await chooseSpecies(page, "Moose");
    await page.waitForTimeout(200);
    await chooseSpecies(page, "Ruffed grouse");
    await page.waitForTimeout(4_500);
    const chip = await page.locator("button[data-kind='species']").first().textContent();
    const question = await page.locator("[role=radiogroup]").count();
    const status = await answerStatus(page);
    check(s, "the chosen species is the last one chosen", chip?.includes("Ruffed grouse"), chip);
    check(s, "no deer or moose question is left on screen", question === 0);
    check(s, "the answer shown is grouse's", /In season/.test(status ?? ""), String(status));
    await context.close();
  },

  async geometryStress(browser) {
    const s = "E/F geometry stays drawn through zoom and pan";
    const { context, page, requests, consoleErrors } = await newPage(browser, { width: 1440, height: 900 });
    await page.goto(`${BASE}/hunt?zone=ca-on-wmu-57`);
    await mapReady(page);
    await waitFor(page, () => document.getElementById("hunt-zone-title")?.textContent === "WMU 57", 30_000);
    const overview = Number(await page.getAttribute("[data-zones]", "data-zones"));
    let minimum = overview;
    const sample = async () => { minimum = Math.min(minimum, Number(await page.getAttribute("[data-zones]", "data-zones"))); };
    await page.mouse.move(900, 450);
    for (let round = 0; round < 3; round += 1) {
      for (let step = 0; step < 5; step += 1) { await page.mouse.wheel(0, -400); await page.waitForTimeout(250); await sample(); }
      for (let step = 0; step < 5; step += 1) { await page.mouse.wheel(0, 400); await page.waitForTimeout(250); await sample(); }
    }
    for (let pan = 0; pan < 6; pan += 1) {
      await page.mouse.move(900, 450);
      await page.mouse.down();
      await page.mouse.move(600 + (pan % 2) * 600, 300, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(300);
      await sample();
    }
    await page.waitForTimeout(1_500);
    check(s, "every served zone stays on the map", overview > 400 && minimum === overview, `overview ${overview}, minimum ${minimum}`);
    const selected = await zoneTitle(page);
    check(s, "the selected zone stays selected", selected === "WMU 57", String(selected));
    const zoneRequests = requests.filter((request) => request.path === "/api/hunt/zones");
    const unique = new Set(zoneRequests.map((request) => request.search)).size;
    check(s, "no runaway geometry requests", zoneRequests.length <= 30, `${zoneRequests.length} requests, ${unique} distinct`);
    check(s, "no duplicate geometry requests", zoneRequests.length - unique <= 1, `${zoneRequests.length - unique} repeats`);
    check(s, "no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
    await context.close();
  },

  async responsive(browser) {
    const s = "H responsive";
    const sizes = [[320, 568], [360, 740], [375, 812], [390, 844], [393, 852], [412, 915], [430, 932], [667, 375], [844, 390], [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1920, 1080]];
    for (const [width, height] of sizes) {
      const { context, page, consoleErrors } = await newPage(browser, { width, height });
      await page.goto(`${BASE}/hunt?zone=ca-mb-gha-38&species=ruffed-grouse`);
      await mapReady(page);
      await waitFor(page, () => Boolean(document.getElementById("hunt-zone-title")), 20_000);
      // The basemap settles one way or the other; with Google, its attribution has drawn.
      await waitFor(page, () => document.querySelector("[data-basemap]")?.getAttribute("data-basemap") !== "loading", 20_000);
      const basemap = await page.getAttribute("[data-basemap]", "data-basemap");
      if (basemap === "google") await waitFor(page, () => [...document.querySelectorAll(".gm-style a, .gm-style button, .gm-style span")].some((element) => /Terms/.test(element.textContent ?? "")), 10_000);
      await page.waitForTimeout(700);
      const layout = await page.evaluate(() => {
        const sheet = document.querySelector("section[data-layout]")?.getBoundingClientRect();
        const map = document.querySelector("[data-zones]")?.getBoundingClientRect();
        const terms = [...document.querySelectorAll(".gm-style a, .gm-style button, .gm-style span")].find((element) => /Terms/.test(element.textContent ?? ""));
        let termsVisible = null;
        if (terms) {
          const rect = terms.getBoundingClientRect();
          const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          termsVisible = Boolean(hit && hit.closest(".gm-style"));
        }
        return {
          overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          sheetVisible: Boolean(sheet && sheet.height > 40 && sheet.top < window.innerHeight),
          mapShare: map ? (map.width * map.height) / (window.innerWidth * window.innerHeight) : 0,
          termsVisible,
          title: document.getElementById("hunt-zone-title")?.textContent ?? null,
        };
      });
      const label = `${width}×${height}`;
      check(s, `${label} no horizontal overflow`, !layout.overflow);
      check(s, `${label} sheet or panel on screen with the zone`, layout.sheetVisible && layout.title === "GHA 38", layout.title);
      check(s, `${label} the map keeps most of the screen`, layout.mapShare > 0.35, layout.mapShare.toFixed(2));
      check(s, `${label} the basemap settled`, basemap === "google" || basemap === "boundary", String(basemap));
      if (basemap === "google") check(s, `${label} Google's terms are drawn and not covered`, layout.termsVisible === true, String(layout.termsVisible));
      check(s, `${label} no console errors`, consoleErrors.length === 0, consoleErrors.join(" | "));
      await context.close();
    }
  },

  async keyboard(browser) {
    const s = "keyboard";
    const { context, page } = await newPage(browser, { width: 1440, height: 900 });
    await page.goto(`${BASE}/hunt`);
    await mapReady(page);
    const names = [];
    for (let index = 0; index < 8; index += 1) {
      await page.keyboard.press("Tab");
      names.push(await page.evaluate(() => {
        const element = document.activeElement;
        return element ? (element.getAttribute("aria-label") || element.textContent || element.tagName).trim().slice(0, 40) : "";
      }));
    }
    check(s, "reading order is header, then the answer, then the map", names[0].includes("North Ground") && names.slice(0, 5).join(" / ").includes("Use my location"), names.join(" / "));
    await page.getByRole("button", { name: /Map layers/ }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: /^List the \d+ zones in view$/ }).focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    await page.keyboard.type("57");
    await page.waitForTimeout(300);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    const opened = await waitFor(page, () => document.getElementById("hunt-zone-title")?.textContent === "WMU 57", 15_000);
    check(s, "a zone can be chosen from the zones list without a pointer", opened);
    const focusLanded = await waitFor(page, () => document.activeElement?.id === "hunt-zone-title", 2_000);
    const focused = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
    check(s, "focus moves to the chosen zone's heading", focusLanded, String(focused));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    check(s, "Escape closes the zone", (await zoneTitle(page)) === null);
    await context.close();
  },

  async threeLocations(browser) {
    const s = "I device, hunt and vendor locations stay apart";
    // The device is in Ottawa; the hunt is at Bancroft, chosen on the map through a link.
    const { context, page, requests } = await newPage(browser, { geolocation: OTTAWA, permissions: ["geolocation"] });
    await page.goto(`${BASE}/hunt?zone=ca-on-wmu-57&species=ruffed-grouse`);
    await waitFor(page, () => document.getElementById("hunt-zone-title")?.textContent === "WMU 57", 30_000);
    await page.getByRole("button", { name: "Check an exact spot" }).click();
    await page.getByRole("button", { name: "Check this spot" }).click();
    const answered = await waitFor(page, () => /In season/.test(document.querySelector("[class*=answerStatus]")?.textContent ?? ""), 30_000);
    check(s, "the chosen spot is evaluated", answered);
    const evaluation = requests.filter((request) => request.path === "/api/hunt/evaluate").at(-1);
    check(s, "the device position never reaches the evaluation", evaluation && !/45\.42|75\.69/.test(evaluation.body), evaluation?.body?.slice(0, 80));
    await page.getByRole("button", { name: /rules, sources and what you need/i }).first().click().catch(() => {});
    const vendor = page.getByRole("button", { name: "Find a licence vendor near me" });
    await vendor.waitFor({ timeout: 15_000 }).catch(() => {});
    if (await vendor.count()) {
      const before = requests.length;
      await vendor.click();
      await page.waitForTimeout(3_000);
      const after = requests.slice(before).filter((request) => /\/api\/hunt\/(evaluate|zone|zone-summary)/.test(request.path));
      check(s, "a vendor search asks no zone and no evaluation", after.length === 0, after.map((request) => request.path).join(", "));
      check(s, "the hunt is still WMU 57", (await zoneTitle(page)) === "WMU 57");
    } else {
      check(s, "Ready to Hunt offers the vendor search", false, "button not found");
    }
    await context.close();
  },

  async shareFallback(browser) {
    const s = "share without a device share sheet";
    const { context, page } = await newPage(browser, { width: 1280, height: 800, share: "none", permissions: ["clipboard-read", "clipboard-write"] });
    await page.goto(`${BASE}/hunt?zone=ca-ab-wmu-102&species=ruffed-grouse&date=2026-10-01`);
    await waitFor(page, () => document.getElementById("hunt-zone-title")?.textContent === "WMU 102", 30_000);
    await page.getByRole("button", { name: /^Share WMU 102/ }).click();
    await page.waitForTimeout(600);
    const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
    check(s, "the link is copied instead", /\/hunt\?zone=ca-ab-wmu-102&species=ruffed-grouse&date=2026-10-01$/.test(copied), copied);
    check(s, "copying is confirmed on screen", await page.getByText("Link copied").isVisible().catch(() => false));
    await context.close();
  },

  async brief(browser) {
    if (!BRIEF) return;
    const s = "Hunt Brief from the new answer";
    const { context, page, requests } = await newPage(browser, { width: 1280, height: 800 });
    await page.goto(`${BASE}/hunt?zone=ca-on-wmu-57&species=ruffed-grouse`);
    await waitFor(page, () => document.getElementById("hunt-zone-title")?.textContent === "WMU 57", 30_000);
    await page.getByRole("button", { name: "Check an exact spot" }).click();
    await page.getByRole("button", { name: "Check this spot" }).click();
    await waitFor(page, () => /In season/.test(document.querySelector("[class*=answerStatus]")?.textContent ?? ""), 30_000);
    // The long form carries the brief, as it carries the sources; a wide panel already shows it.
    const details = page.getByRole("button", { name: /^Details/ }).first();
    if (await details.count()) await details.click();
    await page.getByRole("button", { name: "Share Hunt Brief" }).click();
    await page.getByRole("button", { name: "Copy link" }).click();
    const created = await waitFor(page, () => /Hunt Brief link|link ready|temporarily unavailable/i.test(document.body.innerText), 20_000);
    const share = requests.find((request) => request.path === "/api/hunt/share");
    check(s, "the brief request is made", created && Boolean(share));
    check(s, "the brief request carries the checklist and no coordinate", share && /"readiness"/.test(share.body) && !/latitude|longitude/.test(share.body));
    const link = await page.locator("input[aria-label='Hunt Brief link']").inputValue().catch(() => "");
    if (link) {
      const response = await page.request.get(link);
      check(s, "the brief opens", response.status() === 200, `${response.status()} ${link}`);
    }
    await context.close();
  },
};

const browser = await chromium.launch();
for (const [name, run] of Object.entries(scenarios)) {
  if (ONLY && !ONLY.has(name)) continue;
  try {
    await run(browser);
  } catch (error) {
    check(name, "ran to completion", false, error instanceof Error ? error.message.split("\n")[0] : String(error));
  }
}
await browser.close();

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed against ${BASE}`);
process.exit(failed.length ? 1 : 0);
