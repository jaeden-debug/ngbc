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
      if (Math.max(r, g, b) - Math.min(r, g, b) < 30) hues.neutral += 1;
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
    const field = page.getByRole("searchbox").first();
    if (await field.count()) {
      await field.click();
      await field.fill("Maniwaki");
      await page.waitForTimeout(2500);
      const option = page.getByRole("option").first();
      if (await option.count()) await option.click(); else await page.keyboard.press("Enter");
      await page.waitForTimeout(6000);
      const card = await page.evaluate(() => document.body.innerText);
      const zoneName = (card.match(/Zone \d+[A-Za-z ]*/) ?? [""])[0];
      record(tag, "maniwaki: search resolves a Québec zone with a ruffed grouse answer", /zone/i.test(zoneName) && /ruffed grouse/i.test(card), zoneName.trim());
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
  await page.goto(`${base}/hunt?zone=ca-on-wmu-49&species=moose&explore=1`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(4000);
  const cardClose = page.locator('button[aria-label^="Close "]:not([aria-label="Close menu"])').first();
  const cardIds = async () => page.evaluate(() => [...document.querySelectorAll('[data-zone-conditions] li[data-condition-id][data-material="true"]')].map((li) => li.getAttribute("data-condition-id")));
  const linkedCardIds = await cardIds();
  record(tag, "conditions: the linked zone's card names its conditions", linkedCardIds.length > 0, linkedCardIds.join(", ") || "no conditions block");
  const evidenceShown = await page.evaluate(() => document.querySelector("[data-zone-evidence]")?.textContent ?? "");
  record(tag, "zone evidence: the card shows the authority's own figures", /moose/i.test(evidenceShown) && /not a count of animals/i.test(evidenceShown), evidenceShown.slice(0, 140));
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

  /* 6. A species with no surface: nothing painted, and words say why. */
  await chooseSpecies(page, "Moose");
  await page.waitForTimeout(2500);
  const moose = await paintedFraction(page);
  const mooseLegend = await legendText(page);
  record(tag, "no surface: previous heat gone", !moose.present || !moose.visible || moose.species !== "species:mallard", `element species=${moose.species ?? "none"}`);
  record(tag, "no surface: legend says no fine-grained evidence", /no fine-grained evidence held|no evidence on this ground/i.test(mooseLegend), mooseLegend.slice(0, 160));
  await shot("6-moose");

  /* 7. Every certified surface, opened from its shareable link. */
  if (allSpecies) {
    const registry = JSON.parse(readFileSync("content/intelligence/surface-registry.json", "utf8"));
    for (const entry of registry.surfaces) {
      const slug = entry.speciesId.replace("species:", "");
      await page.goto(`${base}/hunt?species=${slug}&explore=1`, { waitUntil: "networkidle", timeout: 90_000 });
      await page.waitForSelector(`[data-species-surface][data-surface-species="${entry.speciesId}"][data-surface-painted="true"]`, { timeout: 25_000 }).catch(() => null);
      const reply = surfaceReplies.filter((r) => r.species === entry.speciesId).at(-1);
      const seen = await paintedFraction(page);
      const pass = reply?.status === 200 && reply.kinds.includes("MODELLED_RASTER:CONTINUOUS") && seen.visible && seen.species === entry.speciesId && seen.fraction > 0.005;
      record(tag, `all species: ${slug} painted`, pass, `${reply?.status ?? "no request"}, ${(100 * (seen.fraction ?? 0)).toFixed(1)}%`);
      if (pass) {
        const prior = painted.get(entry.artifactHash);
        painted.set(entry.artifactHash, { speciesId: entry.speciesId, viewports: [...(prior?.viewports ?? []), tag] });
      }
    }
  }

  await browser.close();
  return surfaceReplies;
}

const all = [];
for (const [width, height] of viewports) all.push(...await run(width, height));
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
    if (seen.viewports.length !== viewports.length) continue;
    current[key][hash] = { speciesId: seen.speciesId, at, base, ...(production ? { commit: commit ?? "unrecorded" } : {}) };
    if (production) current.rendered[hash] = { speciesId: seen.speciesId, at, base };
    wrote += 1;
  }
  writeFileSync(recordPath, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`recorded ${wrote} ${key} surface(s) in ${recordPath}`);
}
process.exit(failed.length ? 1 : 0);
