#!/usr/bin/env node
/**
 * The species-image pipeline.
 *
 *   npm run species:images                 # harvest → verify → report (no publishing)
 *   npm run species:images -- harvest      # search Unsplash for species still without an image
 *   npm run species:images -- verify       # classify cached candidates; no network
 *   npm run species:images -- sheets       # contact sheets of approvable candidates, for the visual check
 *   npm run species:images -- publish      # publish reviewed, approved images (tracks the download once)
 *   npm run species:images -- report       # docs/species-images-audit.{json,md}
 *
 * Precedence is MANUAL > VERIFIED PROVIDER IMAGE > PLACEHOLDER, and it is
 * enforced twice: a species with a manual PRIMARY is never searched, verified
 * or published, and the read model prefers the manual image regardless.
 *
 * Search results are candidate discovery. Identity is decided by
 * src/lib/species-media/provider/verify.ts from the photographer's own
 * caption; the visual check in content/species-media/unsplash-review.json can
 * only reject.
 *
 * Harvest is resumable: every search response is cached under
 * .cache/species-images/ (gitignored, metadata only — never image files), so an
 * interrupted run continues where it stopped and a re-run spends no requests
 * on species it has already searched.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { createUnsplashClient, loadUnsplashAccessKey } from "./species-images/unsplash-api.mjs";
import { readSearchCache as readCache, reuseCachedSearch, writeSearchCache } from "./species-images/search-cache.mjs";
import { needsProviderImage, publishQueue } from "../src/lib/species-media/provider/plan.ts";
import { speciesIdentityCatalogue } from "../src/lib/species-media/provider/catalogue.ts";
import { readNames } from "../src/lib/species-media/provider/identity.ts";
import { publishable, unsplashCandidate, verifySpecies } from "../src/lib/species-media/provider/verify.ts";

const args = process.argv.slice(2);
const command = args.find((arg) => !arg.startsWith("--")) ?? "run";
const option = (name, fallback = null) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const CACHE = option("cache", join(process.cwd(), ".cache", "species-images"));
const log = (line) => {
  const stamped = `${new Date().toISOString()} ${line}`;
  console.log(stamped);
  mkdirSync(CACHE, { recursive: true });
  appendFileSync(join(CACHE, "pipeline.log"), `${stamped}\n`);
};

/* ── Environment (server-only) ─────────────────────────────────────────── */

function supabaseEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
        if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^"|"$/g, "");
      }
    } catch {
      /* absent is fine */
    }
  }
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (server-only).");
  return { url, key };
}

async function rest(path, { method = "GET", body, prefer } = {}) {
  const { url, key } = supabaseEnv();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`Supabase ${method} ${path.split("?")[0]} → ${response.status}`);
    error.status = response.status;
    error.body = text;
    throw error;
  }
  return text ? JSON.parse(text) : null;
}

/** Species that already carry an image: manual PRIMARY, and active provider images. */
export async function currentImages() {
  const manual = new Set((await rest("species_primary_media?select=species_id")).map((row) => row.species_id));
  let provider = new Map();
  try {
    const rows = await rest("species_provider_media?select=species_id,provider,provider_asset_id,verification_status,photographer_name,source_page_url&status=eq.active");
    provider = new Map(rows.map((row) => [row.species_id, row]));
  } catch (error) {
    if (error.status !== 404) throw error;
  }
  return { manual, provider };
}

/* ── Harvest ───────────────────────────────────────────────────────────── */

const ELIGIBILITY_ORDER = ["HUNTABLE", "LIMITED_TAKE", "NUISANCE_OR_INVASIVE_TAKE", "NON_QUARRY", "UNKNOWN"];
const HERP_GROUPS = /species_group:(snakes|lizards|turtles|frogs|salamanders|crocodilians|reptiles|amphibians)/;

const readSearchCache = (slug, query) => readCache(CACHE, slug, query);

function harvestOrder(species) {
  const rank = (entry) => [
    HERP_GROUPS.test(entry.groupIds.join(" ")) ? 1 : 0,
    ELIGIBILITY_ORDER.indexOf(entry.takeEligibility) === -1 ? 9 : ELIGIBILITY_ORDER.indexOf(entry.takeEligibility),
  ];
  return [...species].sort((a, b) => {
    const [ra, rb] = [rank(a), rank(b)];
    return ra[0] - rb[0] || ra[1] - rb[1];
  });
}

/** A cached search names this species somewhere in a photographer's caption. */
function searchNamesSpecies(entry, identity, lexicon) {
  return (entry?.results ?? []).some((photo) => {
    const reading = readNames(photo.description ?? "", identity, lexicon);
    return reading.scientific || reading.identifying.length > 0;
  });
}

async function harvest() {
  const catalogue = speciesIdentityCatalogue();
  const { manual, provider } = await currentImages();
  // --include-manual: manual species to search anyway (to find where their photograph came from).
  const provenance = new Set((option("include-manual", "") ?? "").split(",").filter(Boolean).map((slug) => `species:${slug}`));
  const limit = Number(option("limit", "0")) || Infinity;
  const refresh = flag("refresh");
  const pending = harvestOrder(catalogue.species.filter((entry) =>
    provenance.has(entry.speciesId) || needsProviderImage(entry.speciesId, { manual, provider })));
  // Provenance searches (looking for where an existing manual image came from) go first.
  pending.sort((a, b) => Number(provenance.has(b.speciesId)) - Number(provenance.has(a.speciesId)));
  log(`harvest: ${pending.length} species to search (${manual.size} manual, ${provider.size} provider images skipped)`);

  const client = createUnsplashClient({ accessKey: loadUnsplashAccessKey(), log });
  let spent = 0;
  const search = async (entry, query, pass) => {
    const cached = readSearchCache(entry.slug, query);
    if (reuseCachedSearch(cached, { refresh })) return cached;
    if (spent >= limit) return null;
    const response = await client.search(query);
    spent += 1;
    const record = {
      provider: "unsplash",
      speciesId: entry.speciesId,
      query,
      pass,
      fetchedAt: new Date().toISOString(),
      total: response?.total ?? 0,
      results: response?.results ?? [],
    };
    writeSearchCache(CACHE, entry.slug, query, record);
    log(`search ${entry.slug} "${query}" → ${record.results.length}/${record.total} (remaining ${client.remaining})`);
    return record;
  };

  // Pass 1: the primary query for every pending species.
  for (const entry of pending) {
    if (spent >= limit) break;
    await search(entry, catalogue.identities.get(entry.speciesId).queries[0], 1);
  }
  // Pass 2: an identifying alias, only where the first search named nothing.
  for (const entry of pending) {
    if (spent >= limit) break;
    const identity = catalogue.identities.get(entry.speciesId);
    if (identity.queries.length < 2) continue;
    const first = readSearchCache(entry.slug, identity.queries[0]);
    if (!first || searchNamesSpecies(first, identity, catalogue.lexicon)) continue;
    await search(entry, identity.queries[1], 2);
  }
  log(`harvest: ${spent} requests spent`);
}

/* ── Verify (no network) ───────────────────────────────────────────────── */

const REVIEW_FILE = join(process.cwd(), "content", "species-media", "unsplash-review.json");
const CREDITS_FILE = join(process.cwd(), "content", "species-media", "manual-credits.json");
const FINDINGS_FILE = join(process.cwd(), "content", "species-media", "manual-image-findings.json");

function readReviews() {
  if (!existsSync(REVIEW_FILE)) return {};
  return JSON.parse(readFileSync(REVIEW_FILE, "utf8")).decisions ?? {};
}

function cachedSearches(entry, identity) {
  return identity.queries.flatMap((query) => {
    const cached = readSearchCache(entry.slug, query);
    if (!cached) return [];
    return [{ query, total: cached.total, candidates: cached.results.map((photo, rank) => unsplashCandidate(photo, query, rank)) }];
  });
}

/**
 * Every catalogue species gets exactly one outcome: MANUAL, PUBLISHED (an
 * active provider image), or a verdict from its cached searches.
 */
async function verify({ quiet = false } = {}) {
  const catalogue = speciesIdentityCatalogue();
  const { manual, provider } = await currentImages();
  const reviews = readReviews();
  const outcomes = catalogue.species.map((entry) => {
    const identity = catalogue.identities.get(entry.speciesId);
    const base = { speciesId: entry.speciesId, slug: entry.slug, commonName: entry.commonName, scientificName: entry.scientificName };
    if (manual.has(entry.speciesId)) return { ...base, outcome: "MANUAL", status: "MANUAL", reason: "administrator-assigned image; never replaced by automation" };
    const searches = cachedSearches(entry, identity);
    const verdict = verifySpecies(identity, catalogue.lexicon, searches, reviews);
    const live = provider.get(entry.speciesId);
    const chosen = verdict.chosen;
    return {
      ...base,
      outcome: live ? "PUBLISHED" : !searches.length ? "NOT_SEARCHED" : chosen ? (chosen.review?.decision === "ACCEPT" ? "APPROVED" : "AWAITING_VISUAL_CHECK") : verdict.status,
      status: live ? "PUBLISHED" : verdict.status,
      reason: live ? `active ${live.provider} image ${live.provider_asset_id}` : verdict.reason,
      searched: verdict.searched,
      chosen: chosen ? {
        id: chosen.candidate.id,
        status: chosen.status,
        reason: chosen.reason,
        description: chosen.candidate.description,
        altDescription: chosen.candidate.altDescription,
        photographer: chosen.candidate.photographerName,
        sourcePageUrl: chosen.candidate.sourcePageUrl,
        query: chosen.candidate.query,
        captive: chosen.captive,
        subjectSex: chosen.subjectSex,
        review: chosen.review,
      } : null,
      namedCandidates: verdict.named.slice(0, 5).map((candidate) => ({
        id: candidate.candidate.id,
        status: candidate.status,
        reason: candidate.reason,
        publishable: publishable(candidate),
        review: candidate.review?.decision ?? null,
      })),
    };
  });
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(join(CACHE, "verification.json"), JSON.stringify(outcomes, null, 1));
  const counts = outcomes.reduce((acc, row) => ({ ...acc, [row.outcome]: (acc[row.outcome] ?? 0) + 1 }), {});
  if (!quiet) log(`verify: ${outcomes.length} species → ${JSON.stringify(counts)}`);
  return outcomes;
}

/* ── Contact sheets for the visual check ───────────────────────────────── */

/**
 * The visual check can only REJECT. It looks at the one candidate the
 * deterministic verification would publish; a rejection moves the species to
 * its next candidate (or to NEEDS_REVIEW) on the next verify.
 */
async function sheets() {
  const sharp = (await import("sharp")).default;
  const outcomes = await verify({ quiet: true });
  const pending = outcomes.filter((row) => row.outcome === "AWAITING_VISUAL_CHECK");
  const catalogue = speciesIdentityCatalogue();
  const dir = join(CACHE, "sheets");
  mkdirSync(join(CACHE, "thumbs"), { recursive: true });
  mkdirSync(dir, { recursive: true });
  const cell = { w: 400, h: 300, label: 36 };
  const perSheet = 9;
  const index = [];
  for (let start = 0; start < pending.length; start += perSheet) {
    const batch = pending.slice(start, start + perSheet);
    const composites = [];
    for (const [offset, row] of batch.entries()) {
      const entry = catalogue.species.find(({ speciesId }) => speciesId === row.speciesId);
      const identity = catalogue.identities.get(row.speciesId);
      const candidate = cachedSearches(entry, identity).flatMap(({ candidates }) => candidates).find(({ id }) => id === row.chosen.id);
      const thumbFile = join(CACHE, "thumbs", `${candidate.id}.jpg`);
      if (!existsSync(thumbFile)) {
        const response = await fetch(candidate.thumbUrl);
        writeFileSync(thumbFile, Buffer.from(await response.arrayBuffer()));
      }
      const n = start + offset + 1;
      const x = (offset % 3) * cell.w;
      const y = Math.floor(offset / 3) * (cell.h + cell.label);
      const image = await sharp(thumbFile).resize(cell.w, cell.h, { fit: "contain", background: "#111" }).toBuffer();
      const text = `${n}. ${row.commonName}`.replace(/[<>&]/g, "");
      const label = Buffer.from(`<svg width="${cell.w}" height="${cell.label}"><rect width="100%" height="100%" fill="#000"/><text x="6" y="25" font-size="20" font-family="Helvetica" fill="#fff">${text}</text></svg>`);
      composites.push({ input: label, left: x, top: y }, { input: image, left: x, top: y + cell.label });
      index.push({ n, speciesId: row.speciesId, commonName: row.commonName, scientificName: row.scientificName, id: candidate.id, status: row.chosen.status, description: candidate.description, altDescription: candidate.altDescription });
    }
    const rows = Math.ceil(batch.length / 3);
    const file = join(dir, `sheet-${String(start / perSheet + 1).padStart(3, "0")}.jpg`);
    await sharp({ create: { width: cell.w * 3, height: rows * (cell.h + cell.label), channels: 3, background: "#111" } })
      .composite(composites).jpeg({ quality: 82 }).toFile(file);
  }
  writeFileSync(join(dir, "index.json"), JSON.stringify(index, null, 1));
  log(`sheets: ${pending.length} candidates on ${Math.ceil(pending.length / perSheet)} sheets in ${dir}`);
}

/* ── Publish ───────────────────────────────────────────────────────────── */

const SELECTED_BY = "species-images pipeline";

/**
 * Publishes approved images: deterministic VERIFIED/HIGH_CONFIDENCE, not
 * rejected, and with the visual check's alt text. The manual relationship is
 * re-read immediately before each write, so an upload made mid-run wins.
 */
async function publish() {
  const outcomes = await verify({ quiet: true });
  const catalogue = speciesIdentityCatalogue();
  const approved = publishQueue(outcomes, await currentImages());
  const client = createUnsplashClient({ accessKey: loadUnsplashAccessKey(), log });
  const trackedFile = join(CACHE, "tracked-downloads.json");
  const tracked = existsSync(trackedFile) ? JSON.parse(readFileSync(trackedFile, "utf8")) : {};
  let published = 0;
  for (const row of approved) {
    // Re-read immediately before writing: an administrator's upload made mid-run wins.
    if (!needsProviderImage(row.speciesId, await currentImages())) continue;
    const entry = catalogue.species.find(({ speciesId }) => speciesId === row.speciesId);
    const identity = catalogue.identities.get(row.speciesId);
    const candidate = cachedSearches(entry, identity).flatMap(({ candidates }) => candidates).find(({ id }) => id === row.chosen.id);
    const review = row.chosen.review;
    if (!review?.altText?.trim()) {
      log(`publish: ${row.slug} skipped — the visual check recorded no alt text`);
      continue;
    }
    // The download event: once per chosen photo, recorded before the write so a retry does not repeat it.
    if (!tracked[candidate.id]) {
      await client.trackDownload(candidate.downloadLocation);
      tracked[candidate.id] = new Date().toISOString();
      writeFileSync(trackedFile, JSON.stringify(tracked, null, 1));
    }
    await rest("species_provider_media", {
      method: "POST",
      prefer: "return=minimal",
      body: {
        species_id: row.speciesId,
        provider: "unsplash",
        provider_asset_id: candidate.id,
        verification_status: row.chosen.status,
        verification_reason: row.chosen.reason,
        search_query: candidate.query,
        canonical_species_name: entry.commonName,
        scientific_name: entry.scientificName,
        image_url: candidate.imageUrl,
        width: candidate.width,
        height: candidate.height,
        photographer_name: candidate.photographerName,
        photographer_profile_url: candidate.photographerProfileUrl,
        source_page_url: candidate.sourcePageUrl,
        alt_text: review.altText.trim(),
        subject_sex: review.subjectSex ?? row.chosen.subjectSex ?? "UNKNOWN",
        focal_x: review.focal?.x ?? 50,
        focal_y: review.focal?.y ?? 50,
        provider_description: candidate.description?.slice(0, 2000) ?? null,
        provider_alt_description: candidate.altDescription?.slice(0, 1000) ?? null,
        download_tracked_at: tracked[candidate.id],
        visual_check: review.reviewer ?? "visual check",
        selected_by: SELECTED_BY,
      },
    });
    published += 1;
    log(`publish: ${row.slug} ← unsplash:${candidate.id} (${row.chosen.status})`);
  }
  log(`publish: ${published} published`);
}

/** Retires a published provider image and records the rejection so it is never chosen again. */
async function retire() {
  const slug = option("species");
  const reason = option("reason");
  if (!slug || !reason) throw new Error("retire needs --species <slug> --reason <text>");
  const speciesId = `species:${slug}`;
  const rows = await rest(`species_provider_media?species_id=eq.${encodeURIComponent(speciesId)}&status=eq.active&select=id,provider,provider_asset_id`);
  if (!rows.length) throw new Error(`${slug} has no active provider image`);
  const [row] = rows;
  await rest(`species_provider_media?id=eq.${row.id}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: { status: "retired", retired_at: new Date().toISOString(), retired_reason: reason },
  });
  const file = existsSync(REVIEW_FILE) ? JSON.parse(readFileSync(REVIEW_FILE, "utf8")) : { decisions: {} };
  file.decisions[`${row.provider}:${row.provider_asset_id}`] = { decision: "REJECT", speciesId, reason, reviewer: "retired after publication" };
  writeFileSync(REVIEW_FILE, `${JSON.stringify(file, null, 2)}\n`);
  log(`retire: ${slug} unsplash:${row.provider_asset_id} — ${reason}`);
}

/* ── Manual-image credits ─────────────────────────────────────────────── */

/**
 * Applies content/species-media/manual-credits.json to the manual assets it
 * names: the photographer as creator, the Unsplash License, and the links the
 * credit renders. Only the credit changes; the image itself is untouched.
 */
async function creditManual() {
  const { credits } = JSON.parse(readFileSync(CREDITS_FILE, "utf8"));
  const names = new Map(speciesIdentityCatalogue().species.map((entry) => [entry.speciesId, entry.commonName]));
  const primaries = new Map((await rest("species_primary_media?select=species_id,asset_id")).map((row) => [row.species_id, row.asset_id]));
  let applied = 0;
  for (const [speciesId, credit] of Object.entries(credits)) {
    if (primaries.get(speciesId) !== credit.assetId) {
      log(`credit-manual: ${speciesId} skipped — its current image is not asset ${credit.assetId}`);
      continue;
    }
    await rest(`species_media_assets?id=eq.${credit.assetId}&status=eq.active`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: {
        creator: credit.photographerName,
        licence: credit.licence,
        credit_provider: credit.provider,
        credit_provider_asset_id: credit.providerAssetId,
        credit_creator_url: credit.photographerProfileUrl,
        credit_source_url: credit.sourcePageUrl,
        credit_evidence: `${credit.method}; published-to-provider thumbnail distance ${credit.unsplashThumbToPublishedDistance}/256`,
        // The upload route's "— verified North Ground species photograph" claims a photograph that is not ours.
        alt_text: names.get(speciesId) ?? undefined,
        updated_at: new Date().toISOString(),
      },
    });
    applied += 1;
  }
  log(`credit-manual: ${applied} manual images credited`);
}

/**
 * For manual images with no recorded source: compares the published rendition
 * with every result of that species' search by 256-bit difference hash. A match
 * is recorded only when it is unambiguous — within 45 bits, and every other
 * result at least 80 bits away (unrelated photographs measure 80+).
 */
async function discoverManualSources() {
  const sharp = (await import("sharp")).default;
  const dhash = async (buffer) => {
    const px = await sharp(buffer).rotate().grayscale().resize(17, 16, { fit: "fill" }).raw().toBuffer();
    const bits = [];
    for (let y = 0; y < 16; y += 1) for (let x = 0; x < 16; x += 1) bits.push(px[y * 17 + x] > px[y * 17 + x + 1] ? 1 : 0);
    return bits;
  };
  const distance = (a, b) => a.reduce((n, bit, i) => n + (bit !== b[i]), 0);
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.northgroundbushcraft.com").replace(/\/$/, "");
  const file = JSON.parse(readFileSync(CREDITS_FILE, "utf8"));
  const primaries = await rest("species_primary_media?select=species_id,asset_id");
  const catalogue = speciesIdentityCatalogue();
  const results = [];
  for (const { species_id: speciesId, asset_id: assetId } of primaries) {
    if (file.credits[speciesId]) continue;
    const entry = catalogue.species.find((row) => row.speciesId === speciesId);
    const searches = entry ? cachedSearches(entry, catalogue.identities.get(speciesId)) : [];
    if (!searches.length) { results.push({ speciesId, found: false, why: "not searched" }); continue; }
    const published = await fetch(`${site}/api/species-media/${assetId}/cover`);
    if (!published.ok) { results.push({ speciesId, found: false, why: `published rendition ${published.status}` }); continue; }
    const target = await dhash(Buffer.from(await published.arrayBuffer()));
    const scored = [];
    for (const candidate of searches.flatMap(({ candidates }) => candidates)) {
      const thumb = candidate.thumbUrl.replace(/([?&])w=\d+/, "$1w=200");
      const response = await fetch(thumb).catch(() => null);
      if (!response?.ok) continue;
      scored.push({ candidate, d: distance(target, await dhash(Buffer.from(await response.arrayBuffer()))) });
    }
    scored.sort((a, b) => a.d - b.d);
    const [best, next] = scored;
    const unambiguous = best && best.d <= 45 && (!next || next.d >= 80);
    results.push({ speciesId, found: Boolean(unambiguous), best: best ? { id: best.candidate.id, d: best.d } : null, next: next?.d ?? null });
    if (!unambiguous) continue;
    file.credits[speciesId] = {
      assetId,
      provider: "unsplash",
      providerAssetId: best.candidate.id,
      photographerName: best.candidate.photographerName,
      photographerProfileUrl: best.candidate.photographerProfileUrl,
      sourcePageUrl: best.candidate.sourcePageUrl,
      licence: "Unsplash License",
      method: "PIXEL_MATCH",
      originalFile: null,
      originalToPublishedDistance: null,
      unsplashThumbToPublishedDistance: best.d,
      nextBestDistance: next?.d ?? null,
    };
  }
  writeFileSync(CREDITS_FILE, `${JSON.stringify(file, null, 2)}\n`);
  for (const row of results) log(`discover: ${row.speciesId} ${row.found ? `FOUND unsplash:${row.best.id} (${row.best.d}/256, next ${row.next})` : `not found (${row.why ?? `best ${row.best?.d ?? "-"}, next ${row.next ?? "-"}`})`}`);
}

/* ── Report ────────────────────────────────────────────────────────────── */

const OUTCOME_WORDS = {
  MANUAL: "Manual image already present",
  PUBLISHED: "Provider image published",
  APPROVED: "Approved, not yet published",
  AWAITING_VISUAL_CHECK: "Identified, awaiting the visual check",
  NEEDS_REVIEW: "Needs review — left as placeholder",
  NO_MATCH: "No trustworthy match — left as placeholder",
  NOT_SEARCHED: "Not searched yet",
};

async function report() {
  const outcomes = await verify({ quiet: true });
  const { provider } = await currentImages();
  const count = (outcome) => outcomes.filter((row) => row.outcome === outcome).length;
  const credits = JSON.parse(readFileSync(CREDITS_FILE, "utf8")).credits;
  const findings = JSON.parse(readFileSync(FINDINGS_FILE, "utf8"));
  const unestablished = new Set(findings.originNotEstablished.species);
  const summary = {
    generatedAt: new Date().toISOString(),
    totalSpecies: outcomes.length,
    manual: count("MANUAL"),
    manualCreditedToUnsplash: Object.keys(credits).length,
    manualOriginNotEstablished: unestablished.size,
    manualLikelyWrongSpecies: Object.values(findings.likelyWrongSpecies).filter(({ confidence }) => confidence === "HIGH").length,
    providerPublished: count("PUBLISHED"),
    providerPublishedVerified: [...provider.values()].filter((row) => row.verification_status === "VERIFIED").length,
    providerPublishedHighConfidence: [...provider.values()].filter((row) => row.verification_status === "HIGH_CONFIDENCE").length,
    approvedNotPublished: count("APPROVED"),
    awaitingVisualCheck: count("AWAITING_VISUAL_CHECK"),
    needsReview: count("NEEDS_REVIEW"),
    noMatch: count("NO_MATCH"),
    notSearched: count("NOT_SEARCHED"),
  };
  const rows = outcomes.map(({ speciesId, commonName, scientificName, outcome, status, reason }) => {
    const live = outcome === "PUBLISHED" ? provider.get(speciesId) : null;
    if (outcome === "MANUAL") {
      const credit = credits[speciesId];
      const finding = findings.likelyWrongSpecies[speciesId];
      const origin = credit
        ? `Unsplash — photo by ${credit.photographerName} (${credit.sourcePageUrl}), credited`
        : unestablished.has(speciesId) ? "origin not established (see manual-image-findings.json)" : "origin not recorded";
      return {
        speciesId, commonName, scientificName, outcome, status,
        reason: finding ? `${origin}. LIKELY WRONG SPECIES (${finding.confidence}): ${finding.evidence}` : origin,
        image: null,
      };
    }
    return {
      speciesId, commonName, scientificName, outcome,
      status: live ? live.verification_status : status,
      reason: live ? `${live.verification_status}: photo by ${live.photographer_name} (${live.source_page_url})` : reason,
      image: live ? { provider: live.provider, id: live.provider_asset_id, photographer: live.photographer_name, sourcePageUrl: live.source_page_url } : null,
    };
  });
  const docs = join(process.cwd(), "docs");
  writeFileSync(join(docs, "species-images-audit.json"), `${JSON.stringify({ summary, species: rows }, null, 1)}\n`);
  const section = (outcome) => {
    const list = rows.filter((row) => row.outcome === outcome);
    if (!list.length) return "";
    return `\n## ${OUTCOME_WORDS[outcome]} (${list.length})\n\n| Species | Scientific name | Why |\n|---|---|---|\n${
      list.map((row) => `| ${row.commonName} | *${row.scientificName}* | ${String(row.reason).replace(/\|/g, "\\|")} |`).join("\n")}\n`;
  };
  const md = `# Species images — audit

Generated by \`npm run species:images -- report\` on ${summary.generatedAt.slice(0, 10)}. Every published species has exactly one outcome.

| | Species |
|---|---|
| Total species | ${summary.totalSpecies} |
| Manual image already present | ${summary.manual} — ${summary.manualCreditedToUnsplash} credited to their Unsplash photographer, ${summary.manualOriginNotEstablished} with no established origin, ${summary.manualLikelyWrongSpecies} likely showing another species (left unchanged, as asked) |
| Unsplash image published, visually checked | ${summary.providerPublished} (${summary.providerPublishedVerified} VERIFIED by binomial, ${summary.providerPublishedHighConfidence} HIGH_CONFIDENCE by common name) |
| Needs review — placeholder kept | ${summary.needsReview} |
| No trustworthy match — placeholder kept | ${summary.noMatch} |
| Approved, not yet published | ${summary.approvedNotPublished} |
| Awaiting the visual check | ${summary.awaitingVisualCheck} |
| Not searched yet | ${summary.notSearched} |

How a photograph is identified: \`src/lib/species-media/provider/verify.ts\`. Species-specific rules and why: \`content/species-media/identity-policy.json\`. Visual-check decisions: \`content/species-media/unsplash-review.json\`.
${["PUBLISHED", "NEEDS_REVIEW", "NO_MATCH", "APPROVED", "AWAITING_VISUAL_CHECK", "NOT_SEARCHED", "MANUAL"].map(section).join("")}`;
  writeFileSync(join(docs, "species-images-audit.md"), md);
  log(`report: ${JSON.stringify(summary)}`);
}

/* ── Entry ─────────────────────────────────────────────────────────────── */

async function run() {
  await harvest();
  await report();
}

const commands = { run, harvest, verify: () => verify(), sheets, publish, retire, "credit-manual": creditManual, "discover-manual-sources": discoverManualSources, report };
if (!commands[command]) {
  console.error(`Unknown command "${command}". Use: ${Object.keys(commands).join(", ")}`);
  process.exit(2);
}
await commands[command]();
