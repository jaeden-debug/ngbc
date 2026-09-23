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
// The notice-recovery scenario waits out a real 60 s retry, so it is asked for.
const SLOW = args.includes("--slow");
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

/** Press "Use my location", wherever this state keeps it. */
async function pressUseMyLocation(page) {
  const direct = page.getByRole("button", { name: /Use my location/ });
  if (await direct.count() && await direct.first().isVisible().catch(() => false)) {
    await direct.first().click();
    return;
  }
  await page.locator("input[type='search']").first().click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /Use my location/ }).first().click();
}

/*
 * Choosing a species the way a hunter now does (owner, 2026-09-23): the zone
 * card has no dropdown. From a species answer you come back out through
 * `All species in [zone]`; from the card's list you tap a species directly, and
 * `View all species` reaches the ones the list cannot offer.
 */
async function chooseSpecies(page, name) {
  const back = page.getByRole("button", { name: /^All species in / }).first();
  if (await back.count()) {
    await back.click();
    /* Wait for the card to actually be back on its list rather than guessing at
       a delay: the list is what offers the next species, and a fixed pause was
       sometimes shorter than the re-render. */
    await waitFor(page, () => [...document.querySelectorAll("button")].some((b) => b.textContent?.trim() === "View all species"), 20_000);
  }
  /* The helper asserts its own postcondition. Clicking a row in a list that is
     re-rendering can land on a node React is about to replace, and a silent
     miss here surfaces thirty seconds later as an unrelated timeout. */
  const named = () => page.evaluate((want) => {
    const shown = document.querySelector("[class*=speciesName]")?.textContent?.trim()
      ?? document.querySelector("button[data-kind='species'] [class*=chipLabel]")?.textContent?.trim() ?? "";
    return shown.toLowerCase().startsWith(want.toLowerCase());
  }, name);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const row = page.getByRole("button", { name: new RegExp(`^${name}`, "i") }).first();
    if (await row.count()) await row.click().catch(() => {});
    else {
      const viewAll = page.getByRole("button", { name: "View all species" }).first();
      if (await viewAll.count()) await viewAll.click();
      else await page.locator("button[data-kind='species']").first().click();
      await page.getByRole("button", { name: new RegExp(`^${name}`, "i") }).first().click();
    }
    if (await waitFor(page, () => true, 1) && await named()) return;
    await page.waitForTimeout(600);
    if (await named()) return;
  }
  throw new Error(`could not choose ${name}`);
}

/** What the surface says it is answering about, wherever it names it. */
async function speciesNamed(page) {
  return page.evaluate(() => {
    const heading = document.querySelector("[class*=speciesName]")?.textContent?.trim();
    if (heading) return heading;
    return document.querySelector("button[data-kind='species'] [class*=chipLabel]")?.textContent?.trim() ?? "";
  });
}

/* ── Scenarios ─────────────────────────────────────────────────────────── */

const scenarios = {
  async locationGranted(browser) {
    const s = "A location granted";
    const { context, page, consoleErrors, requests } = await newPage(browser, { geolocation: BANCROFT, permissions: ["geolocation"] });
    await page.goto(`${BASE}/hunt`);
    check(s, "the map draws official zones", await mapReady(page));
    await pressUseMyLocation(page);
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
    const whenAsked = await page.evaluate(() => ({
      statuses: [...document.querySelectorAll("[class*=answerStatus] .ng-status")].map((e) => e.textContent?.trim() ?? ""),
      named: document.querySelector("[class*=speciesName]")?.textContent?.trim() ?? "",
    }));
    check(s, "deer asks one question before any status", asked && whenAsked.statuses.length === 0, JSON.stringify(whenAsked));
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
    await page.locator("input[type='search']").first().click();
    await page.waitForTimeout(400);
    await pressUseMyLocation(page);
    const explained = await waitFor(page, () => /not sharing your location|could not find|took too long|does not share/.test(document.body.innerText), 15_000);
    check(s, "a refusal is explained, not a dead end", explained);
    await page.locator("input[type='search']").first().click();
    await page.locator("input[type='search']").first().fill("Winnipeg");
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
    /* The zone card has no species control any more (owner, 2026-09-23), so
       this asserts the CAPABILITY the link carries rather than a chip that no
       longer exists: a shared link naming a species still answers for it. */
    const restoredSpecies = await waitFor(page, () => /Ruffed grouse/.test(document.querySelector("[class*=sheetBody]")?.textContent ?? ""), 30_000);
    check(s, "the species the link names is answered for", restoredSpecies);
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
    check(s, "old species-profile links still preselect", (await speciesNamed(page)).includes("Ruffed grouse"), await speciesNamed(page));
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
    await pressUseMyLocation(page);
    await waitFor(page, () => document.getElementById("hunt-zone-title")?.textContent === "WMU 57", 30_000);
    await chooseSpecies(page, "White-tailed deer");
    await page.waitForTimeout(200);
    await chooseSpecies(page, "Moose");
    await page.waitForTimeout(200);
    await chooseSpecies(page, "Ruffed grouse");
    await page.waitForTimeout(4_500);
    // Wait for the answer rather than sampling once: under load the engine
    // can still be answering, and a slow answer is not a stale one.
    await waitFor(page, () => Boolean(document.querySelector("[class*=answerStatus] .ng-status, [class*=answerStatus] [data-state]")?.textContent?.trim()), 20_000);
    const chip = await speciesNamed(page);
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
    /*
     * The baseline has to be taken once every authority has answered.
     *
     * The count climbs as each layer's drawing arrives, so a read taken between
     * two answers is a real number of a half-loaded map — 253 of the 1425 that
     * are coming. Two equal reads a quarter-second apart was not enough: a
     * pause between one authority and the next looks exactly like a finished
     * map. So settled means BOTH that the count has stopped moving for two
     * seconds AND that no geometry request has been made in that time.
     */
    const settled = async () => {
      let last = -1;
      let steadySince = Date.now();
      const deadline = Date.now() + 60_000;
      while (Date.now() < deadline) {
        const now = Number(await page.getAttribute("[data-zones]", "data-zones"));
        const lastRequest = requests.filter((entry) => entry.path === "/api/hunt/zones").at(-1)?.at ?? 0;
        if (now !== last) { last = now; steadySince = Date.now(); }
        if (now > 0 && Date.now() - steadySince > 2_000 && Date.now() - lastRequest > 2_000) return now;
        await page.waitForTimeout(250);
      }
      return last;
    };
    const overview = await settled();
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
    /*
     * The invariant is `minimum === overview`: zooming and panning may never
     * LOSE a zone that was drawn. The floor beside it stops that passing on an
     * empty map, where 0 === 0.
     *
     * This failed intermittently and the count in the failure (253) made it
     * look as though the viewport change had shrunk what the map draws. It had
     * not: settled, this view draws all 1425 served zones, the same as before.
     * The baseline was simply being read while the camera was still flying to
     * WMU 57, so it measured a frame of the journey. The wait above is the fix;
     * the floor is left where it was, because nothing about what the map draws
     * actually changed.
     */
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
      if (basemap === "google") await waitFor(page, () => [...document.querySelectorAll(".gm-style a, .gm-style button, .gm-style span")].some((element) => /Terms/.test(element.textContent ?? "")), 20_000);
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

  async locationReachable(browser) {
    // The owner could not use their location on www: with a zone open and no
    // species chosen, the control was not on screen at all.
    const s = "B2 your location is offered in every state";
    for (const [label, width, height] of [["phone", 390, 844], ["desktop", 1280, 800]]) {
      for (const [state, url] of [["opening screen", "/hunt"], ["a zone card", "/hunt?zone=ca-on-wmu-57"], ["a zone and species", "/hunt?zone=ca-on-wmu-57&species=ruffed-grouse"]]) {
        const { context, page } = await newPage(browser, { width, height });
        await page.goto(`${BASE}${url}`);
        await mapReady(page);
        if (url !== "/hunt") await waitFor(page, () => Boolean(document.getElementById("hunt-zone-title")), 30_000);
        await page.waitForTimeout(600);
        let offered = await page.getByRole("button", { name: /Use my location/ }).count();
        if (!offered) {
          // At rest it lives inside the composer, one tap away.
          await page.locator("input[type='search']").first().click();
          await page.waitForTimeout(400);
          offered = await page.getByRole("button", { name: /Use my location/ }).count();
        }
        check(s, `${label}, ${state}`, offered > 0, `${offered} controls`);
        // A refusal is always answered in words, wherever it was pressed.
        if (offered) {
          await page.evaluate(() => { navigator.geolocation.getCurrentPosition = (_ok, fail) => fail({ code: 1, message: "denied" }); });
          await pressUseMyLocation(page);
          const said = await waitFor(page, () => /not sharing your location|Search for a place/i.test(document.body.innerText), 8_000);
          check(s, `${label}, ${state}: a refusal is explained`, said);
        }
        await context.close();
      }
    }
  },

  async noticeRecovery(browser) {
    if (!SLOW) return;
    /* One transient outage used to be permanent: the notice was set from the
       last completed answer, and a map nobody moves never asks again. */
    const s = "E2 a settled map heals itself";
    const { context, page, requests } = await newPage(browser, { width: 1280, height: 800 });
    let failNext = true;
    await page.route("**/api/hunt/zones*", async (route) => {
      const response = await route.fetch();
      const text = await response.text();
      const zoom = Number(new URL(route.request().url()).searchParams.get("zoom") ?? 0);
      const headers = { ...response.headers(), "content-type": "application/json" };
      let payload = null;
      try { payload = JSON.parse(text); } catch { /* not JSON: pass it through */ }
      if (!payload || zoom < 9 || !failNext || !(payload.layers ?? []).length) {
        return route.fulfill({ status: response.status(), headers, body: text });
      }
      failNext = false;
      // The authority answered; this one layer did not.
      const layers = payload.layers.map((layer, index) => (index === 0 ? { ...layer, status: "PROVIDER_ERROR" } : layer));
      requests.push({ mocked: layers[0]?.id });
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ ...payload, status: "PARTIAL", layers }) });
    });
    await page.goto(`${BASE}/hunt?zone=ca-on-wmu-57`);
    await mapReady(page);
    await waitFor(page, () => Boolean(document.getElementById("hunt-zone-title")), 30_000);
    const raised = await waitFor(page, () => /detailed boundaries did not load/.test(document.body.innerText), 30_000);
    check(s, "an outage raises the notice", raised, `${requests.filter((request) => request.mocked).length} detail answers failed on purpose`);
    // Nothing is touched from here: no pan, no zoom, no click.
    const cleared = await waitFor(page, () => !/detailed boundaries did not load/.test(document.body.innerText), 90_000);
    check(s, "the notice clears itself without the map being touched", cleared);
    await context.close();
  },

  async entryAndMemory(browser) {
    const s = "B3 one composer, one state, and it is remembered";
    const { context, page } = await newPage(browser, { width: 390, height: 844 });
    await page.goto(`${BASE}/hunt`);
    await mapReady(page);
    await page.waitForTimeout(600);
    const field = page.locator("input[type='search']").first();
    /* The placeholder is a HINT and never a place (owner, 2026-09-23): a
       chosen place is the field's value, so it can be told from a suggestion. */
    check(s, "the resting sheet is the prompt and one field",
      await field.count() === 1 && (await field.getAttribute("placeholder")) === "Search anywhere",
      String(await field.getAttribute("placeholder")));
    check(s, "no second way in competes with it", await page.getByRole("button", { name: /^Search a place$/ }).count() === 0);
    // One tap: focused, with its other ways of choosing a place inside it.
    await field.click();
    await page.waitForTimeout(600);
    const opened = await page.evaluate(() => ({
      focused: document.activeElement?.getAttribute("type") === "search",
      rows: [...document.querySelectorAll("[class*=optionPrimary]")].map((element) => element.textContent),
    }));
    check(s, "one tap reaches a focused field", opened.focused);
    check(s, "its other ways of choosing are rows inside it", opened.rows.includes("Use my location") && opened.rows.includes("Choose a spot on the map"), opened.rows.join(" / "));

    /* The keyless place provider rate-limits when scenarios search back to
       back, so one retry separates "the app is broken" from "the provider
       said wait". */
    let suggested = false;
    for (let attempt = 0; attempt < 2 && !suggested; attempt += 1) {
      if (attempt) {
        await field.fill("");
        await page.waitForTimeout(3_000);
      }
      await field.pressSequentially("Bancroft Ontario", { delay: 90 });
      suggested = await waitFor(page, () => document.querySelectorAll("[role=option]").length > 0, 20_000);
    }
    check(s, "the place provider answers", suggested);
    if (!suggested) {
      await context.close();
      return;
    }
    await page.locator("[role=option]").first().click();
    await waitFor(page, () => Boolean(document.getElementById("hunt-zone-title")), 30_000);
    await page.waitForTimeout(2_500);
    const searched = await page.evaluate(() => ({
      title: document.getElementById("hunt-zone-title")?.textContent,
      field: (() => { const field = document.querySelector("input[type='search']"); return field ? (field.value || field.getAttribute("placeholder")) : null; })(),
      selectedOnMap: document.querySelectorAll("[class*=mapZoneLabel][data-selected='true']").length,
      pins: document.querySelectorAll("[class*=mapPin]").length,
      url: location.search,
    }));
    /* A searched place reaches the state a zone tap reaches: pin, highlight,
       card. Which zone that is depends on the place provider the deployment
       uses, so what is checked is that everything names the SAME one. */
    const zoneFromUrl = /zone=([a-z0-9-]+)/.exec(searched.url)?.[1] ?? null;
    check(s, "a searched place opens its zone's card", /^WMU \d/.test(searched.title ?? ""), String(searched.title));
    check(s, "its zone is highlighted on the map", searched.selectedOnMap === 1 && searched.pins >= 1, `${searched.selectedOnMap} selected, ${searched.pins} pins`);
    const urlNamesTheCard = Boolean(zoneFromUrl && searched.title && zoneFromUrl.endsWith(searched.title.replace(/^WMU /, "").toLowerCase()));
    check(s, "the field, the sheet and the URL agree", /Bancroft/i.test(searched.field ?? "") && urlNamesTheCard, `${searched.field} :: ${searched.url} :: ${searched.title}`);

    const searchedZone = searched.title;
    // Tapping another zone must not leave the old place in the field.
    await page.getByRole("button", { name: /Map layers/ }).click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /^List the \d+ zones in view$/ }).click();
    await page.waitForTimeout(600);
    const others = page.getByRole("button", { name: new RegExp(`^WMU (?!${(searched.title ?? "WMU 57").replace(/^WMU /, "")}\\b)\\d`) });
    if (await others.count()) await others.first().click();
    await page.waitForTimeout(1_500);
    const elsewhere = await page.evaluate(() => ({
      title: document.getElementById("hunt-zone-title")?.textContent,
      field: (() => { const field = document.querySelector("input[type='search']"); return field ? (field.value || field.getAttribute("placeholder")) : null; })(),
    }));
    check(s, "a zone you tap does not claim to be the place you searched",
      elsewhere.title === searchedZone || elsewhere.field === "Search anywhere", `${elsewhere.title} :: ${elsewhere.field}`);

    // Coming back: the place, the zone and the recents are still there.
    await page.goto(`${BASE}/hunt`);
    await waitFor(page, () => Boolean(document.getElementById("hunt-zone-title")), 40_000);
    await page.waitForTimeout(2_000);
    const back = await page.evaluate(() => ({
      title: document.getElementById("hunt-zone-title")?.textContent,
      field: (() => { const field = document.querySelector("input[type='search']"); return field ? (field.value || field.getAttribute("placeholder")) : null; })(),
    }));
    check(s, "coming back to /hunt restores the hunt without searching again", back.title === searchedZone && /Bancroft/i.test(back.field ?? ""), `${back.title} :: ${back.field}`);
    await page.locator("input[type='search']").first().click();
    await page.waitForTimeout(500);
    const recents = await page.evaluate(() => [...document.querySelectorAll("[class*=optionPrimary]")].map((element) => element.textContent));
    check(s, "recent places come back too", recents.some((row) => /Bancroft/.test(row ?? "")), recents.slice(0, 3).join(" / "));

    // Start over forgets all of it.
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /Menu/ }).first().click();
    await page.getByRole("button", { name: /Start over/ }).click();
    await page.waitForTimeout(1_200);
    // The control that ran unmounted itself; focus has to come back somewhere real.
    const afterStartOver = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? document.activeElement?.tagName ?? "");
    check(s, "start over returns focus to the menu, not to the top of the page", /Menu/.test(afterStartOver), afterStartOver);
    await page.goto(`${BASE}/hunt`);
    await mapReady(page);
    await page.waitForTimeout(1_500);
    const cleared = await page.evaluate(() => ({
      title: document.getElementById("hunt-zone-title")?.textContent ?? null,
      field: (() => { const field = document.querySelector("input[type='search']"); return field ? (field.value || field.getAttribute("placeholder")) : null; })(),
      stored: (() => { try { return Object.keys(localStorage).filter((key) => key.startsWith("north-ground")).length; } catch { return -1; } })(),
    }));
    check(s, "start over leaves nothing behind", cleared.title === null && cleared.field === "Search anywhere" && cleared.stored === 0, JSON.stringify(cleared));
    await context.close();
  },

  async cartography(browser) {
    const s = "D map reads at three scales";
    const { context, page, consoleErrors } = await newPage(browser, { width: 1280, height: 800 });
    /* Google draws polygons into a canvas, so what the map is TOLD to draw is
       the honest thing to check: every style the app applies is recorded. */
    await page.addInitScript(() => {
      window.__zoneStyles = [];
      const hook = () => {
        const P = window.google?.maps?.Polygon?.prototype;
        if (!P || P.__probed) return false;
        P.__probed = true;
        const original = P.setOptions;
        P.setOptions = function (options) {
          if (options && options.strokeColor) window.__zoneStyles.push({ ...options, at: Date.now() });
          return original.call(this, options);
        };
        return true;
      };
      const timer = setInterval(() => { if (hook()) clearInterval(timer); }, 40);
    });
    await page.goto(`${BASE}/hunt?zone=ca-on-wmu-57`);
    await mapReady(page);
    await waitFor(page, () => Boolean(document.getElementById("hunt-zone-title")), 30_000);
    await waitFor(page, () => (window.__zoneStyles ?? []).length > 20, 20_000);
    await page.waitForTimeout(1_500);

    const styles = () => page.evaluate(() => {
      /* Every style applied since the page opened: the controller only
         re-applies what changed, so the chosen zone's style is set once. */
      const recent = window.__zoneStyles;
      const bone = recent.filter((entry) => String(entry.strokeColor).toLowerCase() === "#f0ead8");
      const others = recent.filter((entry) => String(entry.strokeColor).toLowerCase() !== "#f0ead8");
      return {
        boneCount: bone.length,
        heaviestBone: Math.max(0, ...bone.map((entry) => entry.strokeWeight ?? 0)),
        heaviestOther: Math.max(0, ...others.map((entry) => entry.strokeWeight ?? 0)),
        strongestBoneFill: Math.max(0, ...bone.map((entry) => entry.fillOpacity ?? 0)),
        strongestOtherFill: Math.max(0, ...others.map((entry) => entry.fillOpacity ?? 0)),
        tones: [...new Set(others.map((entry) => String(entry.fillColor).toLowerCase()))].length,
        topZ: Math.max(0, ...bone.map((entry) => entry.zIndex ?? 0)),
        otherZ: Math.max(0, ...others.map((entry) => entry.zIndex ?? 0)),
      };
    });

    const local = await styles();
    check(s, "the chosen zone wears the only bone outline", local.boneCount >= 1, `${local.boneCount} bone styles`);
    check(s, "and the heaviest line on the map", local.heaviestBone > local.heaviestOther, `${local.heaviestBone} vs ${local.heaviestOther}`);
    check(s, "and the strongest fill", local.strongestBoneFill >= local.strongestOtherFill, `${local.strongestBoneFill} vs ${local.strongestOtherFill}`);
    check(s, "and sits above everything else", local.topZ > local.otherZ, `${local.topZ} vs ${local.otherZ}`);
    check(s, "jurisdictions are told apart by tone", local.tones >= 2, `${local.tones} tones drawn`);

    await page.getByRole("button", { name: /Map layers/ }).click();
    await page.waitForTimeout(300);
    await page.evaluate(() => { window.__zoneStyles.length = 0; });
    await page.getByRole("button", { name: /^Light$/ }).click();
    await page.waitForTimeout(900);
    const light = await styles();
    await page.evaluate(() => { window.__zoneStyles.length = 0; });
    await page.getByRole("button", { name: /^Strong$/ }).click();
    await page.waitForTimeout(900);
    const strong = await styles();
    check(s, "boundary visibility changes how strongly they are drawn",
      strong.strongestOtherFill > light.strongestOtherFill, `${light.strongestOtherFill} → ${strong.strongestOtherFill}`);

    await page.getByRole("checkbox", { name: /Zone boundaries/ }).first().uncheck();
    await page.waitForTimeout(900);
    const hidden = await page.evaluate(() => [...document.querySelectorAll("[class*=mapZoneLabel]")].filter((element) => element.offsetParent).length);
    check(s, "zone boundaries can be switched off", hidden === 0, `${hidden} labels still drawn`);
    check(s, "no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
    await context.close();
  },

  async speciesGeography(browser) {
    /* Newfoundland writes its seasons in species geographies. The boundary a
       hunter reads an answer against must be that species' own, or they read a
       black bear season against a moose area. */
    const s = "D2 the drawn geography follows the species";
    const { context, page, requests } = await newPage(browser, { width: 1280, height: 800 });
    const zoneAsks = () => requests.filter((request) => request.path === "/api/hunt/zones").map((request) => request.search);

    await page.goto(`${BASE}/hunt`);
    await mapReady(page);
    await page.waitForTimeout(800);
    check(s, "with no species chosen, the default geography is asked for", zoneAsks().length > 0 && zoneAsks().every((search) => !/species=/.test(search)), zoneAsks().slice(-1).join(""));

    for (const [name, id] of [["black bear", "species%3Aamerican-black-bear"], ["moose", "species%3Amoose"]]) {
      const before = zoneAsks().length;
      await page.goto(`${BASE}/hunt?species=${id.replace("%3A", ":")}`);
      await mapReady(page);
      const asked = await waitFor(page, () => true, 50) && await (async () => {
        for (let attempt = 0; attempt < 40; attempt += 1) {
          if (zoneAsks().slice(before).some((search) => search.includes(id))) return true;
          await page.waitForTimeout(250);
        }
        return false;
      })();
      check(s, `${name} is drawn in its own geography`, asked, zoneAsks().slice(-1).join(""));
      const drawn = Number(await page.getAttribute("[data-zones]", "data-zones"));
      check(s, `and the map still has official zones for ${name}`, drawn > 0, `${drawn} zones`);
    }
    await context.close();
  },

  async selectableNotAnswerable(browser) {
    /* British Columbia is drawn and resolves points; no rule there is
       certified. A hunter must be able to choose a species and learn their
       zone, and must never be shown a season for it. */
    const s = "D3 a drawn jurisdiction can be explored before its rules are certified";
    const { context, page } = await newPage(browser, { width: 1280, height: 800 });
    await page.goto(`${BASE}/hunt?zone=ca-bc-mu-1-15`);
    await mapReady(page);
    await waitFor(page, () => Boolean(document.getElementById("hunt-zone-title")), 30_000);
    await page.waitForTimeout(1_500);
    check(s, "the zone resolves and is named in the authority's terms", (await zoneTitle(page)) === "MU 1-15", String(await zoneTitle(page)));

    // The card's own way to every species, including the ones it cannot answer for.
    await page.getByRole("button", { name: "View all species" }).first().click();
    await page.waitForTimeout(800);
    const groups = await page.evaluate(() => [...document.querySelectorAll("h3")].map((heading) => heading.textContent ?? ""));
    check(s, "the selector says these are boundaries without certified rules",
      groups.some((title) => /Boundaries only in British Columbia/.test(title)), groups.join(" / "));
    const moose = page.getByRole("button", { name: /^Moose/ }).first();
    check(s, "a species can still be chosen", await moose.count() > 0);
    await moose.click();
    /* The ANSWER, not the sheet. The sheet also holds the zone's summary for
       every species and the server-rendered explainer, both of which say
       "In season" about other things — so reading the sheet would have this
       check fail the moment a jurisdiction gains rules for anything. */
    await waitFor(page, () => /Not covered here/.test(document.querySelector("[class*=answer][data-status]")?.textContent ?? ""), 20_000);
    const answer = await page.evaluate(() => document.querySelector("[class*=answer][data-status]")?.textContent?.replace(/\s+/g, " ") ?? "");
    check(s, "the answer is an explicit UNKNOWN naming the authority",
      /Not covered here/.test(answer) && /Government of British Columbia/.test(answer), answer.slice(0, 120));
    check(s, "and never a season, a limit or a date",
      !/In season|Closed|Season:|bag limit|Sept|Oct|Nov/i.test(answer), answer.slice(0, 160));
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
    // Opening the preview is what creates the brief; the link appears in its own field.
    await page.getByRole("button", { name: "Share Hunt Brief" }).click();
    const created = await waitFor(page, () => Boolean(document.querySelector("input[aria-label='Hunt Brief link']")?.value), 20_000);
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

  /* The date field was only ever exercised through the URL and through date.ts's
     pure functions, so nobody had typed into it while it held a date — which is
     the only state a hunter ever meets it in. It ignored every keystroke. */
  async typingADate(browser) {
    const s = "typing a date";
    const { context, page, consoleErrors } = await newPage(browser, { width: 390, height: 844 });
    await page.goto(`${BASE}/hunt?zone=ca-on-wmu-57&species=ruffed-grouse`);
    await waitFor(page, () => document.getElementById("hunt-zone-title")?.textContent === "WMU 57", 30_000);
    await page.locator("button[data-kind='date']").first().click();
    const field = page.locator("input[placeholder='YYYY/MM/DD']");
    const before = await field.inputValue();
    check(s, "the field opens holding the day in view", /^\d{4}\/\d{2}\/\d{2}$/.test(before), before);

    // One tap, eight digits, no separator key — the whole promise. The finished
    // date commits and the page closes behind it, so the URL is the evidence.
    await field.click();
    await field.type("20261225");
    const took = await waitFor(page, () => /date=2026-12-25/.test(location.search), 10_000);
    check(s, "eight digits replace the day already there", took, page.url());
    await page.locator("button[data-kind='date']").first().click();
    check(s, "and the field comes back holding it", (await field.inputValue()) === "2026/12/25", await field.inputValue());

    // A finished impossible date is refused with a reason, not rolled forward.
    await field.click();
    await field.type("20260231");
    const refusal = await page.locator("[data-tone='error']").first().textContent().catch(() => "");
    check(s, "February 31st is refused with the reason", /February 2026 has 28 days/.test(refusal ?? ""), refusal);
    check(s, "and the refused date is not taken", /date=2026-12-25/.test(page.url()), page.url());
    check(s, "no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
    await context.close();
  },

  /* A link names a zone. The map opens on a viewport. Once the opening request
     became the viewport rather than the country, a phone opening a link to a
     zone a province away found it in nothing it had drawn — and said so, in
     those words, about a zone North Ground draws. */
  async linkToADistantZone(browser) {
    const s = "a link to a zone the opening view does not reach";
    const { context, page } = await newPage(browser, { width: 390, height: 844 });
    // The opening camera looks at central Canada; this unit is on the Pacific.
    await page.goto(`${BASE}/hunt?zone=ca-bc-mu-1-15`);
    await mapReady(page);
    const restored = await waitFor(page, () => document.getElementById("hunt-zone-title")?.textContent === "MU 1-15", 40_000);
    check(s, "a phone restores a zone outside its opening view", restored, String(await zoneTitle(page)));
    check(s, "and the link keeps its zone", /zone=ca-bc-mu-1-15/.test(page.url()), page.url());
    const notice = await page.evaluate(() => document.body.innerText);
    check(s, "and is never told the zone is not one North Ground draws",
      !/not one North Ground draws/.test(notice));

    // A zone that really is not drawn is still refused, on the same screen.
    await page.goto(`${BASE}/hunt?zone=ca-bc-mu-999-99`);
    const refused = await waitFor(page, () => /not one North Ground draws/.test(document.body.innerText), 45_000);
    check(s, "a zone that does not exist is still refused on a phone", refused);
    await context.close();
  },

  /*
   * The pair that decides whether "Applies here today" is a band or a wall.
   *
   * Populated inside a named territory the ministry draws, EMPTY on a plain
   * point in the same province. The empty half is the assertion that matters:
   * a contextual band that populates everywhere is the wall growing back under
   * a better name.
   */
  async contextualBand(browser) {
    const s = "what applies HERE, and nowhere else";
    const { context, page } = await newPage(browser, { width: 390, height: 844 });
    const read = async (place, expectZone) => {
      await page.goto(`${BASE}/hunt?species=ruffed-grouse`);
      await mapReady(page);
      await page.locator("input[type='search']").first().click();
      await page.locator("input[type='search']").first().fill(place);
      const suggested = await waitFor(page, () => document.querySelectorAll("[role=option]").length > 0, 25_000);
      if (!suggested) return null;
      await page.locator("[role=option]").first().click();
      await waitFor(page, () => expectZone.test(document.getElementById("hunt-zone-title")?.textContent ?? ""), 40_000);
      await waitFor(page, () => Boolean(document.querySelector("[class*=answerStatus]")), 30_000);
      const details = page.getByRole("button", { name: /^Details/ }).first();
      if (await details.count()) await details.click();
      await page.waitForTimeout(2_500);
      return page.evaluate(() => {
        const band = [...document.querySelectorAll("h3")].find((h) => /Applies here today/i.test(h.textContent ?? ""));
        const wall = [...document.querySelectorAll("h3")].find((h) => /does not resolve/i.test(h.textContent ?? ""));
        return {
          band: Boolean(band),
          bandLines: band?.parentElement?.querySelectorAll("li").length ?? 0,
          bandCollapsed: band ? Boolean(band.closest("details")) : false,
          wallLines: wall?.closest("details")?.querySelectorAll("li").length ?? 0,
          zone: document.getElementById("hunt-zone-title")?.textContent ?? "",
        };
      });
    };

    const rigaud = await read("Rigaud, Quebec", /^Zone 8/);
    check(s, "a named territory the ministry draws puts a line beside the status",
      rigaud && rigaud.band && rigaud.bandLines > 0 && rigaud.bandCollapsed === false, JSON.stringify(rigaud));

    const plain = await read("Maniwaki, Quebec", /^Zone 10/);
    check(s, "and a plain point in the same province shows NO such band",
      plain && plain.band === false, JSON.stringify(plain));
    check(s, "while both still carry the province's standing limitations, collapsed",
      plain && plain.wallLines > 0 && rigaud && rigaud.wallLines > 0,
      `${JSON.stringify(plain)} :: ${JSON.stringify(rigaud)}`);
    await context.close();
  },

  /* The narrowest screen anyone still hunts with. Pinned BEFORE the answer is
     rebuilt around structured rows, so a regression in the rebuild shows up as
     a failure here rather than as something a hunter finds outdoors. */
  async narrowScreen(browser) {
    const s = "320px, where the map must still be a map";
    const { context, page, consoleErrors } = await newPage(browser, { width: 320, height: 700 });

    await page.goto(`${BASE}/hunt`);
    await mapReady(page);
    const opening = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      win: window.innerWidth,
    }));
    check(s, "the opening state does not scroll sideways", opening.doc <= opening.win, JSON.stringify(opening));

    await page.goto(`${BASE}/hunt?zone=ca-qc-zone-10o&species=ruffed-grouse`);
    await waitFor(page, () => document.getElementById("hunt-zone-title")?.textContent === "Zone 10 West", 40_000);
    await waitFor(page, () => Boolean(document.querySelector("[class*=answer] [data-state], [class*=answerStatus]")), 30_000);
    const answered = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }));
    check(s, "and neither does a full answer", answered.doc <= answered.win, JSON.stringify(answered));

    /* §41A: the map is sized to what the sheet leaves, so the sheet never hides
       the provider's attribution — which is a licence term, not a detail. */
    // Google draws its own attribution after the map settles; wait for it rather than race it.
    await waitFor(page, () => [...document.querySelectorAll("a")].some((a) => /Terms/i.test(a.textContent ?? "")), 30_000);
    const attribution = await page.evaluate(() => {
      const link = [...document.querySelectorAll("a")].find((a) => /Terms/i.test(a.textContent ?? ""));
      const sheet = document.querySelector("[class*=sheet]");
      if (!link || !sheet) return null;
      const l = link.getBoundingClientRect();
      const b = sheet.getBoundingClientRect();
      return { onScreen: l.top >= 0 && l.bottom <= window.innerHeight && l.right <= window.innerWidth, aboveSheet: l.bottom <= b.top + 1 };
    });
    check(s, "the provider's attribution is on screen and clear of the sheet", attribution?.onScreen && attribution?.aboveSheet, JSON.stringify(attribution));

    // The two map controls are what a hunter reaches for; neither may be under the sheet.
    for (const name of ["Show my location on the map", "Map layers and season colours"]) {
      const reachable = await page.evaluate((label) => {
        const button = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === label);
        if (!button) return null;
        const r = button.getBoundingClientRect();
        if (r.width < 44 || r.height < 44) return { fail: "too small", w: r.width, h: r.height };
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { covered: !button.contains(hit) && hit !== button, onScreen: r.right <= window.innerWidth && r.bottom <= window.innerHeight };
      }, name);
      check(s, `"${name}" is reachable`, reachable && !reachable.fail && reachable.onScreen && !reachable.covered, `${name}: ${JSON.stringify(reachable)}`);
    }

    /* Nothing waits below the screen for a drag: whatever is longer than the
       sheet's resting height scrolls inside it. */
    const scrolls = await page.evaluate(() => {
      const body = document.querySelector("[class*=sheetBody]");
      if (!body) return null;
      if (body.scrollHeight <= body.clientHeight) return { needed: false };
      body.scrollTop = body.scrollHeight;
      return { needed: true, moved: body.scrollTop > 0 };
    });
    check(s, "the sheet scrolls to its end at its resting height", scrolls && (scrolls.needed === false || scrolls.moved), JSON.stringify(scrolls));

    // §40: a state is never colour alone.
    const stated = await page.evaluate(() => (document.querySelector("[class*=answerStatus], [class*=answer] [data-state]")?.textContent ?? "").trim());
    check(s, "the status is a word, not a colour", /[A-Za-z]{3,}/.test(stated), stated);

    /* The point answer, on the same narrow screen, and its provenance: the
       sources are COLLAPSED, but present in the document a crawler and an
       answer engine receive, and they open like any disclosure. */
    await page.getByRole("button", { name: "Check an exact spot" }).click();
    await page.getByRole("button", { name: "Check this spot" }).click();
    await waitFor(page, () => /In season/.test(document.querySelector("[class*=answerStatus]")?.textContent ?? ""), 30_000);
    const details = page.getByRole("button", { name: /^Details/ }).first();
    if (await details.count()) await details.click();
    await waitFor(page, () => Boolean(document.querySelector("details#hunt-answer-sources")), 30_000);
    const sources = await page.evaluate(() => {
      const box = document.querySelector("details#hunt-answer-sources");
      if (!box) return null;
      const before = { open: box.open, chars: box.textContent?.length ?? 0 };
      box.querySelector("summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return { ...before, opens: box.open };
    });
    check(s, "the sources are collapsed, in the HTML, and open on a click",
      sources && sources.open === false && sources.chars > 200 && sources.opens === true, JSON.stringify(sources));
    /* The scan is status → dates → the authority's own segment → limits, and
       the segment is QUOTED and tagged in the language it was published in.
       Where the rules behind a season disagree it is absent, and nothing takes
       its place — a North Ground substitute there would be attributing a name
       to a ministry that never wrote it. */
    const segment = await page.evaluate(() => {
      const value = document.querySelector("[class*=facts] dd");
      const note = value?.querySelector("[class*=factNote]");
      return {
        beforeProse: !/[A-Z][a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+/.test(value?.textContent ?? ""),
        label: note?.textContent?.trim() ?? null,
        lang: note?.getAttribute("lang") ?? null,
      };
    });
    check(s, "the authority's season segment is quoted and language-tagged, or absent",
      segment.label === null || (/^«.+»$/.test(segment.label) && Boolean(segment.lang)), JSON.stringify(segment));
    const prose = await page.evaluate(() => {
      const paragraph = [...document.querySelectorAll("h3")].find((h) => /Why this answer/i.test(h.textContent ?? ""));
      return { moved: Boolean(paragraph?.closest("details")) };
    });
    check(s, "and the paragraph that used to lead the answer is behind a disclosure", prose.moved, JSON.stringify(prose));

    /* Each limitation goes where its AUTHOR's scope sends it, and the three
       destinations are the whole point: what applies here is never collapsed,
       what is always true is said once, and the authority's own words sit with
       the source they describe rather than in a hunter's way. */
    const scoped = await page.evaluate(() => {
      const heading = [...document.querySelectorAll("h3")].find((h) => /does not resolve/i.test(h.textContent ?? ""));
      const here = [...document.querySelectorAll("h3")].find((h) => /Applies here today/i.test(h.textContent ?? ""));
      return {
        // Present AND collapsed — a vanished wall must not pass as a tidy one.
        generalLines: heading?.closest("details")?.querySelectorAll("li").length ?? 0,
        generalCollapsed: Boolean(heading?.closest("details")),
        hereShown: Boolean(here),
        hereCollapsed: here ? Boolean(here.closest("details")) : false,
        /* French in the scan is allowed in exactly one place: the authority's
           own name for the season segment, inside the facts list, quoted. A
           ministry caveat is prose and belongs in Sources; a segment name is a
           NAME and belongs beside the dates the owner asked to see. Anything
           French anywhere else in the scan is the wall coming back. */
        frenchInTheWay: [...document.querySelectorAll("[lang='fr-CA']")]
          .filter((e) => !e.closest("details") && !e.closest("[class*=facts]")).length,
        frenchQuotesInScan: [...document.querySelectorAll("blockquote[lang='fr-CA']")].filter((q) => !q.closest("details")).length,
        frenchTagged: [...document.querySelectorAll("blockquote")].every((q) => q.getAttribute("lang")),
      };
    });
    check(s, "the general limitations are still all there, said once and collapsed",
      scoped.generalCollapsed && scoped.generalLines > 0, JSON.stringify(scoped));
    check(s, "anything that applies here is never behind a disclosure", scoped.hereCollapsed === false, JSON.stringify(scoped));
    /* §47: the ministry's French is preserved, tagged and attributed in Sources
       — the answer to an untranslated wall is attribution, not a paraphrase of
       law invented by a renderer. */
    check(s, "the ministry's French prose is out of the scan path, and every quotation is tagged",
      scoped.frenchInTheWay === 0 && scoped.frenchQuotesInScan === 0 && scoped.frenchTagged, JSON.stringify(scoped));
    const overflowAfter = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }));
    check(s, "the long answer still does not scroll sideways", overflowAfter.doc <= overflowAfter.win, JSON.stringify(overflowAfter));
    check(s, "no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
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
