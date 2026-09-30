#!/usr/bin/env node
/**
 * Browser certification of the species surface, in a real Hunt.
 *
 *   node scripts/certify-species-surface.mjs --base http://localhost:3000
 *   node scripts/certify-species-surface.mjs --base https://www.northgroundbushcraft.com --shots out/
 *   node scripts/certify-species-surface.mjs --base <preview> --share <vercel share link> --cpu-throttle 4
 *
 * WHY THIS EXISTS. On 2026-09-29 production served all 25 certified surfaces
 * with 200s, every backend test was green, and no Hunt client ever requested
 * one: the renderer was on an unmerged branch. Endpoint tests cannot see that
 * defect. This walks what a hunter does — Find game, choose a species — and
 * fails unless the browser REQUESTED the surface, RECEIVED it, and PAINTED it.
 *
 * Checks, each reported by name:
 *   ruffed grouse   request 200 with a CONTINUOUS surface; the surface element
 *                   is visible, belongs to grouse, and has painted pixels
 *   switch          wild turkey replaces grouse; grouse is gone at once
 *   mallard         both kinds arrive (SAMPLE_PLOT + MODELLED_RASTER)
 *   no surface      moose: nothing painted, and the legend says why in words
 *   zone card       (only where zones draw) tap a zone, close it: species,
 *                   explore, date and surface persist
 *   markers         any `!` condition marker is a focusable control
 *   conditions      Ontario moose opened from a zone link: a TAPPED `!` opens
 *                   a popover naming condition ids, and "View details" opens
 *                   the card whose "Conditions apply" block holds the same ids
 *   all species     (--all-species) every certified surface opened from its
 *                   shareable link is requested, received and painted;
 *                   --record FILE writes what painted, keyed by artifact hash
 *                   (--production --commit SHA marks it production-verified)
 *
 * Works against a local build (ZoneCanvas fallback without a Maps key) and
 * against a Google-map deployment. Exit code 1 on any failed check.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : fallback;
};
const base = (flag("base", "http://localhost:3000")).replace(/\/$/, "");
const shots = flag("shots", null);
const viewports = (flag("viewports", "390x844,1280x800")).split(",").map((v) => v.split("x").map(Number));
const executablePath = flag("chromium", process.env.CHROMIUM_PATH || undefined);
/* A protected preview: visiting a Vercel share link first sets its cookie. */
const share = flag("share", null);
const throttle = Number(flag("cpu-throttle", "1"));
/* CI reaches the provinces' live GIS, whose availability is not this code's to
   certify; `--no-zone-card` leaves the tap-a-zone step to the manual runs. */
const zoneCard = !args.includes("--no-zone-card");
const allSpecies = args.includes("--all-species");
const recordPath = flag("record", null);
const production = args.includes("--production");
const commit = flag("commit", null);
/* Species that painted, for --record. */
const painted = new Map();

const results = [];
const record = (viewport, name, pass, detail) => {
  results.push({ viewport, name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} [${viewport}] ${name}${detail ? ` — ${detail}` : ""}`);
};

/** Painted pixels of the surface element, read from the element itself. */
/** Every certified surface: the survey fields, North Ground's models and the records grids. */
function certifiedEntries() {
  return ["surface-registry.json", "model-registry.json", "range-habitat-registry.json"]
    .flatMap((file) => JSON.parse(readFileSync(`content/intelligence/${file}`, "utf8")).surfaces);
}

async function paintedFraction(page) {
  return page.evaluate(async () => {
    const el = document.querySelector("[data-species-surface]");
    if (!el) return { present: false };
    const visible = getComputedStyle(el).display !== "none" && el.getAttribute("data-surface-painted") === "true";
    let canvas = el;
    if (el.tagName.toLowerCase() === "image") {
      const href = el.getAttribute("href");
      const img = new Image();
      img.src = href;
      await img.decode();
      canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d").drawImage(img, 0, 0);
    }
    if (!(canvas instanceof HTMLCanvasElement) || !canvas.width) return { present: true, visible, fraction: 0 };
    const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
    let painted = 0;
    /* `neutral` is SURVEYED_NONE — ground surveyed where the species was not
       found — which is not on the ramp and must not be counted as yellow. */
    const hues = { neutral: 0, blue: 0, cyan: 0, green: 0, yellow: 0, orange: 0, red: 0 };
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 8) continue;
      painted += 1;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      /* The neutral is a warm grey (205,199,184) at alpha 0.12; where an edge
         fades it further, 8-bit rounding tints it past a plain chroma test. */
      const nearNeutral = data[i + 3] <= 40 && Math.abs(r - 205) + Math.abs(g - 199) + Math.abs(b - 184) < 70;
      if (Math.max(r, g, b) - Math.min(r, g, b) < 30 || nearNeutral) hues.neutral += 1;
      else if (r > 200 && g < 90) hues.red += 1;
      else if (r > 200 && g < 170) hues.orange += 1;
      else if (r > 180 && g > 170) hues.yellow += 1;
      else if (g > 150 && b > 150) hues.cyan += 1;
      else if (g > b && g > r) hues.green += 1;
      else hues.blue += 1;
    }
    return {
      present: true,
      visible,
      species: el.getAttribute("data-surface-species"),
      layers: (el.getAttribute("data-surface-layers") ?? "").split(" ").filter(Boolean),
      fraction: painted / (data.length / 4),
      hues,
    };
  });
}

async function chooseSpecies(page, name) {
  await page.click('button[aria-label^="Find game"]');
  await page.getByRole("button", { name: new RegExp(`^${name}`, "i") }).first().click({ timeout: 15_000 });
}

async function legendText(page) {
  return page.evaluate(() => {
    const button = [...document.querySelectorAll("button[aria-controls][aria-expanded]")]
      .find((el) => / layer\. /.test(el.getAttribute("aria-label") ?? ""));
    return button?.getAttribute("aria-label") ?? "";
  });
}

async function run(width, height) {
  const tag = `${width}x${height}`;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: width < 600 ? 2 : 1,
    isMobile: width < 600,
    hasTouch: width < 600,
  });
  const page = await context.newPage();
  if (throttle > 1) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  }
  if (share) await page.goto(share, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const surfaceReplies = [];
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("/api/hunt/species-surface")) return;
    const started = response.request().timing().startTime;
    let body = null;
    try { body = await response.json(); } catch { /* not JSON */ }
    const size = Number(response.headers()["content-length"] ?? 0) || (await response.body().catch(() => Buffer.alloc(0))).length;
    surfaceReplies.push({
      species: new URL(url).searchParams.get("speciesId"),
      status: response.status(),
      kinds: (body?.surfaces ?? []).map((s) => `${s.geometryKind}:${s.continuity}`),
      ids: (body?.surfaces ?? []).map((s) => s.id),
      bytes: size,
      at: started,
    });
  });
  const shot = async (name) => {
    if (!shots) return;
    mkdirSync(shots, { recursive: true });
    /* JPEG: these are read by a person, and a committed PNG of a map is
       megabytes for nothing a reviewer can see. */
    await page.screenshot({ path: join(shots, `${tag}-${name}.jpg`), type: "jpeg", quality: 72 });
  };

  await page.goto(`${base}/hunt`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(1500);

  /* 1. Ruffed grouse — the acceptance species. */
  const t0 = Date.now();
  await chooseSpecies(page, "Ruffed grouse");
  await page.waitForSelector('[data-species-surface][data-surface-species="species:ruffed-grouse"][data-surface-painted="true"]', { timeout: 20_000 }).catch(() => null);
  const drawnMs = Date.now() - t0;
  await page.waitForTimeout(800);
  const grouseReply = surfaceReplies.find((r) => r.species === "species:ruffed-grouse");
  record(tag, "ruffed grouse: surface requested", Boolean(grouseReply), grouseReply ? `${grouseReply.status}, ${grouseReply.bytes} B` : "no request was made");
  record(tag, "ruffed grouse: continuous raster received", grouseReply?.status === 200 && grouseReply.kinds.includes("MODELLED_RASTER:CONTINUOUS"), grouseReply?.kinds.join(","));
  const grouse = await paintedFraction(page);
  record(tag, "ruffed grouse: surface painted and visible", grouse.present && grouse.visible && grouse.species === "species:ruffed-grouse" && grouse.fraction > 0.01,
    `painted ${(100 * (grouse.fraction ?? 0)).toFixed(1)}% in ${drawnMs} ms; hues ${JSON.stringify(grouse.hues)}`);
  const renders = await page.evaluate(() => performance.getEntriesByName("species-surface-render").map((e) => Math.round(e.duration)));
  if (renders.length) console.log(`     [${tag}] surface render ms: ${renders.join(", ")}`);
  record(tag, "ruffed grouse: URL carries species and explore", /species=ruffed-grouse/.test(page.url()) && /explore=1/.test(page.url()), page.url());
  record(tag, "ruffed grouse: legend present", /Ruffed grouse layer\./i.test(await legendText(page)), (await legendText(page)).slice(0, 160));
  await shot("1-ruffed-grouse");

  /* 2. Condition markers stay real controls. */
  const markers = await page.evaluate(() => [...document.querySelectorAll("button")]
    .filter((b) => b.textContent?.trim() === "!").map((b) => ({ label: b.getAttribute("aria-label"), focusable: b.tabIndex >= 0 })));
  record(tag, "condition markers are focusable controls", markers.every((m) => m.focusable && m.label), `${markers.length} markers`);

  /* 3. Zone card over the layer: tap a zone, close it, the layer persists. */
  const dateBefore = new URL(page.url()).searchParams.get("date");
  /* Zones exist on the Google map when the legend has counted any; on the
     fallback canvas they are DOM paths. */
  const zones = await page.evaluate(() => document.querySelectorAll("[data-zone-key]").length
    + (/\b[1-9]\d* zones? with a hunt open/.test([...document.querySelectorAll("button[aria-label]")].map((b) => b.getAttribute("aria-label")).join(" ")) ? 1 : 0));
  /* A zone the hunter can actually see and reach: a drawn zone label (labels
     let taps through to the polygon under them) or a fallback-canvas path,
     whose point is on the map rather than under the sheet, a control or the
     key. The map's centre is no good — at the opening camera it is Hudson Bay. */
  const target = await page.evaluate(() => {
    const onMap = (x, y) => {
      const hit = document.elementFromPoint(x, y);
      return Boolean(hit && (hit.closest(".gm-style") || hit.closest("svg")?.querySelector("[data-zone-key]")));
    };
    const candidates = [
      ...[...document.querySelectorAll('[class*="mapZoneLabel"]')].map((el) => ({ el, kind: "label" })),
      ...[...document.querySelectorAll("path[data-zone-key]")].map((el) => ({ el, kind: "path" })),
    ].map(({ el, kind }) => {
      const r = el.getBoundingClientRect();
      return { kind, text: el.textContent || el.getAttribute("data-zone-key"), x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width };
    }).filter((c) => c.w > 0 && c.y > 90 && c.y < innerHeight * 0.55 && c.x > 20 && c.x < innerWidth - 20 && onMap(c.x, c.y));
    return candidates[Math.floor(candidates.length / 2)] ?? null;
  });
  if (!zoneCard) {
    console.log(`     [${tag}] zone card step skipped (--no-zone-card)`);
  } else if (target) {
    if (width < 600) await page.touchscreen.tap(target.x, target.y);
    else await page.mouse.click(target.x, target.y);
    const closeButton = page.locator('button[aria-label^="Close "]:not([aria-label="Close menu"])').first();
    const opened = await closeButton.waitFor({ timeout: 10_000 }).then(() => true).catch(() => false);
    if (opened) {
      await shot("2-zone-card");
      const heading = await page.evaluate(() => [...document.querySelectorAll("h2")].map((h) => h.textContent).join(" | "));
      const card = await page.evaluate(() => document.body.innerText);
      record(tag, "zone card opens over the layer", true, `tapped ${target.kind} "${target.text}" → ${heading.slice(0, 100)}`);
      record(tag, "zone card answers for ruffed grouse", /ruffed grouse/i.test(card), "");
      await closeButton.click();
      await page.waitForTimeout(1500);
      const after = await paintedFraction(page);
      const url = page.url();
      record(tag, "closing the zone card keeps species, explore, date and surface",
        /species=ruffed-grouse/.test(url) && /explore=1/.test(url) && after.visible && after.species === "species:ruffed-grouse"
          && (dateBefore === null || new URL(url).searchParams.get("date") === dateBefore),
        url);
      await shot("3-after-close");
    } else {
      record(tag, "zone card opens over the layer", false, `tapped ${target.kind} "${target.text}" at ${Math.round(target.x)},${Math.round(target.y)}; no card`);
    }
  } else {
    record(tag, "zone card opens over the layer", zones === 0, zones === 0 ? "no zones drawn here (provider unreachable) — skipped" : "no reachable zone on screen");
  }

  /* 3b. Maniwaki, the owner's diagnostic case, entered as a hunter enters a
     place: the composer. The card and the surface around it are captured so
     a person can hold the map to the route-level diagnosis. */
  if (zoneCard) {
    /* At rest the composer is one tap away; the field exists once it opens. */
    const field = page.locator("input[type='search']").first();
    let suggested = false;
    for (let attempt = 0; attempt < 2 && !suggested && await field.count(); attempt += 1) {
      await field.click();
      await field.fill("Maniwaki");
      suggested = await page.waitForFunction(() => document.querySelectorAll("[role=option]").length > 0, null, { timeout: 25_000 }).then(() => true, () => false);
    }
    /* A walk that cannot start is a failure, never a silent skip. */
    record(tag, "maniwaki: the composer suggests the place", suggested, suggested ? "" : "no suggestion (composer or geocoder)");
    if (suggested) {
      await page.locator("[role=option]").first().click();
      const resolved = await page.waitForFunction(() => /Zone/.test(document.getElementById("hunt-zone-title")?.textContent ?? ""), null, { timeout: 40_000 }).then(() => true, () => false);
      await page.waitForTimeout(3000);
      const zoneName = await page.evaluate(() => document.getElementById("hunt-zone-title")?.textContent ?? "");
      const card = await page.evaluate(() => document.body.innerText);
      record(tag, "maniwaki: search resolves a Québec zone with a ruffed grouse answer", resolved && /ruffed grouse/i.test(card), zoneName.trim());
      await shot("3b-maniwaki-card");
      const close = page.locator('button[aria-label^="Close "]:not([aria-label="Close menu"])').first();
      if (await close.count()) { await close.click(); await page.waitForTimeout(3000); }
      const around = await paintedFraction(page);
      record(tag, "maniwaki: grouse surface painted around the zone", around.visible && around.species === "species:ruffed-grouse", `hues ${JSON.stringify(around.hues)}`);
      await shot("3c-maniwaki-surface");
    }
  }

  /* 4. Switch to wild turkey: grouse disappears at once. */
  await chooseSpecies(page, "Wild turkey");
  const immediately = await paintedFraction(page);
  record(tag, "switch: grouse heat gone immediately", immediately.species !== "species:ruffed-grouse" || !immediately.visible, `element species=${immediately.species}`);
  await page.waitForSelector('[data-species-surface][data-surface-species="species:wild-turkey"][data-surface-painted="true"]', { timeout: 20_000 }).catch(() => null);
  const turkey = await paintedFraction(page);
  record(tag, "switch: wild turkey painted", turkey.visible && turkey.species === "species:wild-turkey" && turkey.fraction > 0.02, `${(100 * (turkey.fraction ?? 0)).toFixed(1)}%`);
  await shot("4-wild-turkey");

  /* 5. Mallard: both kinds of evidence. Opened from a link, as a shared
     Hunt is, so the camera is the opening one and covers the eastern plot
     survey — the zone-card step above may have left it out west, where the
     plots genuinely do not reach. */
  await page.goto(`${base}/hunt?species=mallard&explore=1`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector('[data-species-surface][data-surface-species="species:mallard"][data-surface-painted="true"]', { timeout: 20_000 }).catch(() => null);
  await page.waitForTimeout(800);
  const mallardKinds = [...new Set(surfaceReplies.filter((r) => r.species === "species:mallard").flatMap((r) => r.kinds))];
  record(tag, "mallard: plots and field both arrive", mallardKinds.includes("SAMPLE_PLOT:DISCRETE") && mallardKinds.includes("MODELLED_RASTER:CONTINUOUS"), mallardKinds.join(","));
  const mallard = await paintedFraction(page);
  record(tag, "mallard: painted", mallard.visible && mallard.species === "species:mallard", `${(100 * (mallard.fraction ?? 0)).toFixed(1)}%`);
  await shot("5-mallard");

  /* 5b. Conditions: what a `!` means, found by TAPPING it — never by focus,
     which is how a marker the map's gesture layer swallowed passed before.
     It needs the provinces' live zone geometry, like the zone-card step. */
  if (zoneCard) {
  /* A case with material conditions ON THE DAY THIS RUNS, asked of the same
     engine the map uses: seasons turn on the date, so a fixed case goes
     silent between seasons (WMU 49 moose is closed on 30 September and
     tag-gated on 20 October). Today first, then the pinned date. */
  const today = await page.evaluate(() => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" }));
  const candidates = [
    { species: "moose", layerId: "layer:ca-on-wmu", designation: "49", zone: "ca-on-wmu-49" },
    { species: "white-tailed-deer", layerId: "layer:ca-ab-wmu", designation: "936", zone: "ca-ab-wmu-936" },
    { species: "moose", layerId: "layer:ca-qc-zone-chasse", designation: "10O", zone: "ca-qc-zone-10o" },
  ];
  let conditionCase = null;
  for (const date of [today, "2026-10-20"]) {
    for (const candidate of candidates) {
      const answer = await page.evaluate(async ({ candidate, date }) => {
        const response = await fetch("/api/hunt/zone-status", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ speciesId: `species:${candidate.species}`, date, zones: [{ layerId: candidate.layerId, designation: candidate.designation }] }),
        });
        const body = await response.json().catch(() => ({}));
        return body.states?.[0]?.opportunity ?? null;
      }, { candidate, date });
      if (answer?.hasMaterialConditions) { conditionCase = { ...candidate, date }; break; }
    }
    if (conditionCase) break;
  }
  record(tag, "conditions: the engine names a case with material conditions", Boolean(conditionCase),
    conditionCase ? `${conditionCase.species} in ${conditionCase.zone} on ${conditionCase.date}` : "no candidate has material conditions today or on 2026-10-20");
  const caseUrl = conditionCase
    ? `${base}/hunt?zone=${conditionCase.zone}&species=${conditionCase.species}&date=${conditionCase.date}&explore=1`
    : `${base}/hunt?zone=ca-on-wmu-49&species=moose&explore=1`;
  await page.goto(caseUrl, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(4000);
  await shot("5a-condition-zone-card");
  const cardClose = page.locator('button[aria-label^="Close "]:not([aria-label="Close menu"])').first();
  const cardIds = async () => page.evaluate(() => [...document.querySelectorAll('[data-zone-conditions] li[data-condition-id][data-material="true"]')].map((li) => li.getAttribute("data-condition-id")));
  const linkedCardIds = await cardIds();
  record(tag, "conditions: the linked zone's card names its conditions", linkedCardIds.length > 0, linkedCardIds.join(", ") || "no conditions block");
  /* Zone evidence does not turn on the date; WMU 49 holds Ontario's moose harvest records. */
  if (!conditionCase || conditionCase.zone !== "ca-on-wmu-49") {
    await page.goto(`${base}/hunt?zone=ca-on-wmu-49&species=moose&explore=1`, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(4000);
  }
  const evidenceShown = await page.evaluate(() => document.querySelector("[data-zone-evidence]")?.textContent ?? "");
  record(tag, "zone evidence: the card shows the authority's own figures", /moose/i.test(evidenceShown) && /not a count of animals/i.test(evidenceShown), evidenceShown.slice(0, 140));
  /* A density is animals, not hunting: Alberta's aerial survey of WMU 204, flown
     in 2019, dated by its own survey and cited to its own report. */
  await page.goto(`${base}/hunt?zone=ca-ab-wmu-204&species=mule-deer&explore=1`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector('[data-zone-evidence][data-evidence-metric="POPULATION_DENSITY"]', { timeout: 20_000 }).catch(() => null);
  const density = await page.evaluate(() => {
    const block = document.querySelector('[data-zone-evidence][data-evidence-metric="POPULATION_DENSITY"]');
    return { text: block?.textContent ?? "", link: block?.querySelector("a")?.getAttribute("href") ?? "" };
  });
  record(tag, "zone evidence: an Alberta unit shows its aerial-survey density, dated and cited",
    /0\.74 mule deer per km²/.test(density.text) && /2019/.test(density.text) && /whole unit/.test(density.text) && /open\.alberta\.ca\/publications\//.test(density.link),
    `${density.text.slice(0, 160)} → ${density.link}`);
  await shot("5d-alberta-density-card");
  if (conditionCase?.zone === "ca-on-wmu-49") {
    await page.goto(caseUrl, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(4000);
  }
  if (conditionCase && conditionCase.zone !== "ca-on-wmu-49") {
    await page.goto(caseUrl, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(4000);
  }
  if (await cardClose.count()) { await cardClose.click(); await page.waitForTimeout(2500); }
  const marker = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")].filter((b) => b.textContent?.trim() === "!");
    for (const b of buttons) {
      const r = b.getBoundingClientRect();
      const x = r.x + r.width / 2;
      const y = r.y + r.height / 2;
      if (r.width && y > 90 && y < innerHeight * 0.6 && x > 10 && x < innerWidth - 10 && document.elementFromPoint(x, y) === b) {
        return { x, y, label: b.getAttribute("aria-label") };
      }
    }
    return null;
  });
  if (!marker) {
    record(tag, "conditions: a `!` is on screen to tap", false, "no unobstructed marker");
  } else {
    if (width < 600) await page.touchscreen.tap(marker.x, marker.y);
    else await page.mouse.click(marker.x, marker.y);
    const popover = page.locator('[role="dialog"][aria-label^="Conditions on the current hunting opportunity"]');
    const opened = await popover.waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
    const popoverIds = opened ? await popover.locator("li[data-condition-id]").evaluateAll((els) => els.map((el) => el.getAttribute("data-condition-id"))) : [];
    record(tag, "conditions: tapping `!` opens its conditions", opened && popoverIds.length > 0, `${marker.label} → ${popoverIds.join(", ") || "nothing"}`);
    await shot("5b-condition-popover");
    if (opened) {
      await popover.getByRole("button", { name: "View details" }).click();
      await cardClose.waitFor({ timeout: 10_000 }).catch(() => null);
      await page.waitForTimeout(2500);
      const ids = await cardIds();
      record(tag, "conditions: the card names the same conditions the `!` did",
        popoverIds.length > 0 && popoverIds.every((id) => ids.includes(id)), `popover ${popoverIds.join(",")} · card ${ids.join(",")}`);
      await shot("5c-condition-card");
      if (await cardClose.count()) await cardClose.click();
    }
  }
  }

  /* 6. A species whose best evidence is range + habitat (§41B, "Every
     Hunt-eligible species has a map"): moose used to be the no-surface case
     and now falls one tier instead of to nothing. The conditions walk above
     left the page on moose, so come back to mallard first: what is tested is
     one species' surface giving way to another's, with no leak. */
  if (zoneCard) {
    await page.goto(`${base}/hunt?species=mallard&explore=1`, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForSelector('[data-species-surface][data-surface-species="species:mallard"][data-surface-painted="true"]', { timeout: 25_000 }).catch(() => null);
  }
  /* A control something else covers is a finding, not a reason to stop
     certifying the species that follow. */
  const chose = await chooseSpecies(page, "Moose").then(() => null, (error) => error.message.split("\n")[0]);
  if (chose) record(tag, "range + habitat: moose can be chosen", false, chose);
  await page.waitForSelector('[data-species-surface][data-surface-species="species:moose"][data-surface-painted="true"]', { timeout: 25_000 }).catch(() => null);
  await page.waitForTimeout(800);
  const moose = await paintedFraction(page);
  const mooseLegend = await legendText(page);
  record(tag, "range + habitat: previous heat gone", moose.species !== "species:mallard", `element species=${moose.species ?? "none"}`);
  record(tag, "range + habitat: moose painted from its own surface", moose.visible && moose.species === "species:moose" && (moose.layers ?? []).some((id) => id.startsWith("surface:range-habitat-moose")),
    `${(100 * (moose.fraction ?? 0)).toFixed(1)}% painted; layers ${(moose.layers ?? []).join(",") || "none"}; hues ${JSON.stringify(moose.hues)}`);
  record(tag, "range + habitat: the key says what it is and how much weight it bears, never density",
    /Range \+ habitat · evidence (moderate|limited)/i.test(mooseLegend) && /habitat opportunity/i.test(mooseLegend) && !/\bdensity\b/i.test(mooseLegend.replace(/not a density/gi, "")), mooseLegend.slice(0, 220));
  await shot("6-moose");

  /* 7. Every certified surface, opened from its shareable link — each LAYER
     judged on its own. A species can hold a survey field, a model beyond it
     and a records grid; one of them painting must never stand in for another. */
  if (allSpecies) {
    const bySpecies = new Map();
    for (const entry of certifiedEntries()) bySpecies.set(entry.speciesId, [...(bySpecies.get(entry.speciesId) ?? []), entry]);
    for (const [speciesId, entries] of bySpecies) {
      const slug = speciesId.replace("species:", "");
      await page.goto(`${base}/hunt?species=${slug}&explore=1`, { waitUntil: "networkidle", timeout: 90_000 });
      await page.waitForSelector(`[data-species-surface][data-surface-species="${speciesId}"][data-surface-painted="true"]`, { timeout: 25_000 }).catch(() => null);
      await page.waitForTimeout(400);
      const reply = surfaceReplies.filter((r) => r.species === speciesId).at(-1);
      const seen = await paintedFraction(page);
      /* Painted means ON THE RAMP. Surveyed-none grey covers the whole survey
         area whatever the species, so a surface that drew only grey would
         pass a bare painted-pixel count while showing no animal anywhere. */
      const onRamp = seen.hues ? Object.entries(seen.hues).filter(([hue]) => hue !== "neutral").reduce((sum, [, n]) => sum + n, 0) : 0;
      for (const entry of entries) {
        const served = reply?.status === 200 && reply.ids.includes(entry.artifactId);
        const layerPainted = seen.visible && seen.species === speciesId && (seen.layers ?? []).includes(entry.artifactId);
        const survey = (entry.evidenceClass ?? "STRUCTURED_SURVEY") === "STRUCTURED_SURVEY";
        const label = survey ? slug : `${slug} (${entry.evidenceClass === "NORTH_GROUND_MODEL" ? "model" : "records"})`;
        /* Drawn here; whether this opening view holds any of the layer's ground
           is a fact about the camera (a phone opens on the east), so a survey
           layer's detected ground and a model's or records grid's painted
           squares are required in at least one view, judged after them all. */
        const drawn = survey
          ? served && reply.kinds.includes("MODELLED_RASTER:CONTINUOUS") && seen.visible && seen.species === speciesId && seen.fraction > 0.005 && layerPainted
          : served;
        record(tag, `all species: ${label} ${survey ? "drawn" : "served"}`, drawn,
          `${reply?.status ?? "no request"}${served ? "" : ` without ${entry.artifactId}`}, ${(100 * (seen.fraction ?? 0)).toFixed(1)}% drawn, ${layerPainted ? "layer painted in this view" : "layer not in this view"}${survey ? `, ${onRamp} px on the ramp` : ""}`);
        if (drawn) {
          const prior = painted.get(entry.artifactHash);
          painted.set(entry.artifactHash, {
            speciesId,
            label,
            survey,
            viewports: [...(prior?.viewports ?? []), tag],
            paintedIn: [...(prior?.paintedIn ?? []), ...(layerPainted ? [tag] : [])],
            onRamp: Math.max(prior?.onRamp ?? 0, onRamp),
          });
        }
      }
    }
  }

  await browser.close();
  return surfaceReplies;
}

const all = [];
for (const [width, height] of viewports) all.push(...await run(width, height));
if (allSpecies) {
  /* Painted means ON THE RAMP somewhere for a survey field: surveyed-none grey
     covers the whole survey area whatever the species, so a surface that drew
     only grey would be "drawn" while showing no animal anywhere. A model or a
     records grid must have painted its own layer in at least one view. */
  for (const entry of certifiedEntries()) {
    const seen = painted.get(entry.artifactHash);
    if ((entry.evidenceClass ?? "STRUCTURED_SURVEY") === "STRUCTURED_SURVEY") {
      record("all", `all species: ${entry.speciesId.replace("species:", "")} shows detected ground`, (seen?.onRamp ?? 0) > 200, `${seen?.onRamp ?? 0} px on the ramp at best`);
    } else {
      record("all", `all species: ${seen?.label ?? entry.artifactId} painted`, (seen?.paintedIn?.length ?? 0) > 0, `painted in ${(seen?.paintedIn ?? []).join(", ") || "no view"}`);
    }
  }
}
const sizes = all.filter((r) => r.status === 200).map((r) => r.bytes).sort((a, b) => a - b);
console.log(`\nsurface replies: ${all.length}; 200 sizes (bytes, transferred): min ${sizes[0] ?? 0}, median ${sizes[Math.floor(sizes.length / 2)] ?? 0}, max ${sizes.at(-1) ?? 0}`);
const failed = results.filter((r) => !r.pass);
console.log(`${results.length - failed.length}/${results.length} checks passed against ${base}`);

/* The verification record: only artifacts that painted on EVERY viewport. */
if (recordPath && allSpecies) {
  const current = JSON.parse(readFileSync(recordPath, "utf8"));
  const at = new Date().toISOString().slice(0, 10);
  const key = production ? "productionVerified" : "rendered";
  let wrote = 0;
  for (const [hash, seen] of painted) {
    /* Served on every viewport, and seen: a survey field with detected ground
       on the ramp, a model or records grid painting its own layer somewhere. */
    if (seen.viewports.length !== viewports.length) continue;
    if (seen.survey ? seen.onRamp <= 200 : !seen.paintedIn.length) continue;
    current[key][hash] = { speciesId: seen.speciesId, at, base, ...(production ? { commit: commit ?? "unrecorded" } : {}) };
    if (production) current.rendered[hash] = { speciesId: seen.speciesId, at, base };
    wrote += 1;
  }
  writeFileSync(recordPath, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`recorded ${wrote} ${key} surface(s) in ${recordPath}`);
}
process.exit(failed.length ? 1 : 0);
