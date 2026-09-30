import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalId } from "../content-contract/index.ts";
import { contentRepository } from "../content/repository.ts";
import { speciesIdentityCatalogue } from "./provider/catalogue.ts";
import { normalizeText, readNames } from "./provider/identity.ts";
import { needsProviderImage, publishQueue } from "./provider/plan.ts";
import { isUnsplashImageUrl, unsplashRenditions, withUnsplashReferral } from "./provider/unsplash.ts";
import { publishable, verifySpecies, type ProviderCandidate, type ReviewDecision } from "./provider/verify.ts";
import { speciesPhotoDataUrl } from "./social.ts";
import { providerMedia, SupabaseSpeciesMediaStore } from "./store.ts";
import { requiresVisibleCredit, uncreditedSurfaceMedia } from "./types.ts";
import { createUnsplashClient } from "../../../scripts/species-images/unsplash-api.mjs";
import { readSearchCache, reuseCachedSearch, writeSearchCache } from "../../../scripts/species-images/search-cache.mjs";

/*
 * The species-image pipeline's guarantees. A search result is a candidate;
 * only a photographer's caption naming the exact species can identify it, a
 * manual image always wins, and an unidentified species keeps its placeholder.
 */

const catalogue = speciesIdentityCatalogue();
const identity = (slug: string) => {
  const found = catalogue.identities.get(`species:${slug}`);
  assert.ok(found, `species:${slug} is in the catalogue`);
  return found;
};

let counter = 0;
function candidate(description: string | null, overrides: Partial<ProviderCandidate> = {}): ProviderCandidate {
  counter += 1;
  return {
    provider: "unsplash",
    id: `photo${counter}`,
    description,
    altDescription: null,
    width: 4000,
    height: 3000,
    likes: 10,
    imageUrl: `https://images.unsplash.com/photo-${counter}?ixid=abc&ixlib=rb-4.1.0`,
    thumbUrl: `https://images.unsplash.com/photo-${counter}?w=400`,
    photographerName: "Jane Doe",
    photographerProfileUrl: "https://unsplash.com/@janedoe",
    sourcePageUrl: `https://unsplash.com/photos/photo${counter}`,
    downloadLocation: `https://api.unsplash.com/photos/photo${counter}/download?ixid=abc`,
    sponsored: false,
    query: "test",
    rank: 0,
    ...overrides,
  };
}
const judge = (slug: string, candidates: ProviderCandidate[], reviews: Record<string, ReviewDecision> = {}) =>
  verifySpecies(identity(slug), catalogue.lexicon, [{ query: "q", total: candidates.length, candidates }], reviews);

test("a caption with the binomial verifies; a caption with the exact common name is high confidence", () => {
  assert.equal(judge("american-alligator", [candidate("American alligator (Alligator mississippiensis) basking")]).status, "VERIFIED");
  assert.equal(judge("american-alligator", [candidate("An American alligator basking in the Everglades")]).status, "HIGH_CONFIDENCE");
});

test("a generic word never verifies a specific species", () => {
  for (const [slug, caption] of [
    ["mottled-duck", "A duck on a pond"],
    ["mottled-duck", "duck"],
    ["dusky-grouse", "A grouse in the forest"],
    ["axis-deer", "deer in the meadow"],
    ["gray-rat-snake", "a snake on a rock"],
  ] as const) {
    const verdict = judge(slug, [candidate(caption)]);
    assert.equal(verdict.chosen, null, `${slug}: “${caption}”`);
    assert.equal(verdict.status, "NO_MATCH");
  }
});

test("a name made of describing words cannot identify on its own", () => {
  const verdict = judge("green-frog", [candidate("A green frog sitting on a lily pad")]);
  assert.equal(verdict.chosen, null);
  assert.equal(verdict.status, "NEEDS_REVIEW");
  assert.match(verdict.reason, /generic words/);
  assert.equal(judge("green-frog", [candidate("Green frog (Lithobates clamitans)")]).status, "VERIFIED");
});

test("the machine-written alt description never identifies anything", () => {
  const verdict = judge("gray-partridge", [candidate(null, { altDescription: "A grey partridge bird standing on a rock" })]);
  assert.equal(verdict.status, "NO_MATCH");
  assert.equal(verdict.chosen, null);
});

test("a binomial belonging to another species blocks approval", () => {
  const verdict = judge("mottled-duck", [candidate("Mottled duck (Anas platyrhynchos) on the Gulf Coast")]);
  assert.equal(verdict.chosen, null);
  assert.equal(verdict.status, "NEEDS_REVIEW");
  assert.match(verdict.reason, /platyrhynchos|mallard/);
});

test("a binomial that is not the species' own blocks approval, even outside the catalogue", () => {
  const verdict = judge("mouflon", [candidate("The mouflon or Ovis gmelini, a wild sheep native to the Caspian region")]);
  assert.equal(verdict.chosen, null);
  assert.equal(verdict.status, "NEEDS_REVIEW");
  assert.match(verdict.reason, /ovis gmelini/);
  // A subspecies of the species' own binomial is its own.
  assert.equal(judge("bighorn-sheep", [candidate("Desert bighorn sheep (Ovis canadensis nelsoni)")]).status, "VERIFIED");
  // A genus that is also an English word is not read out of ordinary prose.
  assert.equal(judge("canada-lynx", [candidate("Canada lynx stares at prey")]).status, "HIGH_CONFIDENCE");
});

test("protected lookalikes never take each other's photograph", () => {
  // A trumpeter swan page needs its own binomial; a caption naming the tundra swan is a conflict, not a match.
  assert.equal(judge("trumpeter-swan", [candidate("Trumpeter swan on the river")]).chosen, null);
  assert.equal(judge("trumpeter-swan", [candidate("Tundra swan on the river")]).chosen, null);
  assert.equal(judge("gunnison-sage-grouse", [candidate("Greater sage-grouse lekking in Wyoming")]).chosen, null);
  assert.equal(judge("whooping-crane", [candidate("Sandhill cranes and one whooping crane")]).chosen, null);
  const greater = judge("greater-sage-grouse", [candidate("Greater sage-grouse lekking in Wyoming")]);
  assert.equal(greater.status, "HIGH_CONFIDENCE");
  assert.equal(greater.chosen?.candidate.id !== undefined, true);
});

test("a name shared by two catalogue species identifies neither", () => {
  for (const slug of ["ermine", "american-ermine"]) {
    assert.equal(judge(slug, [candidate("A stoat in its white winter ermine coat")]).chosen, null);
  }
  const reading = readNames("American black duck", identity("mallard"), catalogue.lexicon);
  assert.deepEqual(reading.identifying, []);
});

test("a name inside a longer known name belongs to the longer name", () => {
  const verdict = judge("feral-ferret", [candidate("Black-footed ferret at dusk")]);
  assert.equal(verdict.chosen, null);
  const lemur = judge("ringtail", [candidate("Ringtail lemur in Madagascar")]);
  assert.equal(lemur.chosen, null);
});

test("paintings, decoys, taxidermy and dead animals are never candidates", () => {
  for (const caption of [
    "Title: Patrijs Publisher: Rijksmuseum Date: 1759 — a grey partridge",
    "Hand-carved mallard decoy",
    "Taxidermy wild turkey at the lodge",
    "Dead coyote by the road",
    "Gray Partridge 1835 Robert Havell after John James Audubon Associated Names",
    "A close-up of a gray partridge taken after the hunt",
  ]) {
    const verdict = judge("gray-partridge", [candidate(caption)]);
    assert.equal(verdict.chosen, null, caption);
  }
});

test("the visual check can reject a candidate but never add one", () => {
  const good = candidate("Northern bobwhite (Colinus virginianus) calling");
  const reject: ReviewDecision = { decision: "REJECT", speciesId: "species:northern-bobwhite", reason: "caption names it but the bird shown is a scaled quail" };
  const rejected = judge("northern-bobwhite", [good], { [`unsplash:${good.id}`]: reject });
  assert.equal(rejected.chosen, null);
  assert.equal(rejected.status, "NEEDS_REVIEW");
  const unnamed = candidate("Beautiful bird");
  const accept: ReviewDecision = { decision: "ACCEPT", speciesId: "species:northern-bobwhite", altText: "Northern bobwhite" };
  assert.equal(judge("northern-bobwhite", [unnamed], { [`unsplash:${unnamed.id}`]: accept }).chosen, null);
});

test("identity outranks looks: a verified photo beats a better-liked high-confidence one", () => {
  const liked = candidate("Wild turkey strutting", { likes: 900 });
  const binomial = candidate("Wild turkey, Meleagris gallopavo", { likes: 1 });
  const verdict = judge("wild-turkey", [liked, binomial]);
  assert.equal(verdict.chosen?.candidate.id, binomial.id);
});

test("sponsored, Unsplash+ and small images are not published", () => {
  assert.equal(judge("american-bison", [candidate("American bison", { sponsored: true })]).chosen, null);
  assert.equal(judge("american-bison", [candidate("American bison", { imageUrl: "https://plus.unsplash.com/premium_photo-1" })]).chosen, null);
  const small = judge("american-bison", [candidate("American bison", { width: 640, height: 480 })]);
  assert.equal(small.chosen, null);
  assert.equal(small.status, "NEEDS_REVIEW");
});

test("an alias resolves to the canonical species, which carries the one image identity", async () => {
  for (const query of ["wild boar", "feral hog", "feral swine", "wild pig"]) {
    const [first] = await contentRepository.searchSpecies(query, { locale: "en-CA" });
    assert.equal(first?.id, "species:wild-boar", query);
  }
  const owners = catalogue.lexicon.owners.get(normalizeText("feral swine"));
  assert.deepEqual([...owners ?? []], ["species:wild-boar"]);
  assert.equal(judge("wild-boar", [candidate("Feral swine rooting in a Texas pasture")]).status, "HIGH_CONFIDENCE");
});

/* ── Precedence and the read model ────────────────────────────────────── */

const MANUAL_ASSET = "11111111-1111-4111-8111-111111111111";
const PROVIDER_ROW = {
  species_id: "species:moose",
  provider: "unsplash",
  provider_asset_id: "AbC_123-xyz",
  image_url: "https://images.unsplash.com/photo-1549471013-3364d7220b75?ixid=abc&ixlib=rb-4.1.0",
  width: 4000,
  height: 3000,
  photographer_name: "Jane Doe",
  photographer_profile_url: "https://unsplash.com/@janedoe",
  source_page_url: "https://unsplash.com/photos/AbC_123-xyz",
  licence: "Unsplash License",
  alt_text: "Bull moose standing in a shallow pond",
  focal_x: 50,
  focal_y: 50,
};

function fakeClient(tables: Record<string, unknown[]>): SupabaseClient {
  const query = (rows: unknown[]) => {
    const chain = {
      select: () => chain,
      eq: (column: string, value: unknown) => query(rows.filter((row) => (row as Record<string, unknown>)[column] === value)),
      in: (column: string, values: unknown[]) => query(rows.filter((row) => values.includes((row as Record<string, unknown>)[column]))),
      then: (resolve: (value: { data: unknown[]; error: null }) => void) => resolve({ data: rows, error: null }),
    };
    return chain;
  };
  return { from: (table: string) => query(tables[table] ?? []) } as unknown as SupabaseClient;
}

const manualTables = {
  species_primary_media: [{ species_id: "species:moose", asset_id: MANUAL_ASSET }],
  species_media_assets: [{ id: MANUAL_ASSET, species_id: "species:moose", alt_text: "Moose", caption: null, creator: "North Ground", licence: "All rights reserved", status: "active", focal_x: 50, focal_y: 50 }],
  species_media_renditions: ["avatar", "card", "profile", "cover"].map((variant) => ({ asset_id: MANUAL_ASSET, variant, width: 100, height: 100 })),
};

test("a manual image beats a verified provider image", async () => {
  const store = new SupabaseSpeciesMediaStore(fakeClient({ ...manualTables, species_provider_media: [{ ...PROVIDER_ROW, status: "active" }] }));
  const media = await store.getPrimary("species:moose" as CanonicalId<"species">);
  assert.equal(media?.source, "MANUAL");
  assert.equal(media?.assetId, MANUAL_ASSET);
});

test("a verified provider image beats the placeholder, and carries its credit to rendering", async () => {
  const store = new SupabaseSpeciesMediaStore(fakeClient({ species_provider_media: [{ ...PROVIDER_ROW, status: "active" }] }));
  const media = await store.getPrimary("species:moose" as CanonicalId<"species">);
  assert.equal(media?.source, "PROVIDER");
  assert.equal(media?.altText, "Bull moose standing in a shallow pond");
  assert.equal(media?.credit?.creatorName, "Jane Doe");
  assert.equal(media?.credit?.creatorUrl, "https://unsplash.com/@janedoe?utm_source=north_ground&utm_medium=referral");
  assert.equal(media?.credit?.providerUrl, "https://unsplash.com/?utm_source=north_ground&utm_medium=referral");
  for (const rendition of Object.values(media!.renditions)) assert.ok(isUnsplashImageUrl(rendition.url), rendition.url);
  assert.equal(requiresVisibleCredit(media!), true);
});

test("an unresolved species stays the placeholder, and a retired provider image is not served", async () => {
  const store = new SupabaseSpeciesMediaStore(fakeClient({ species_provider_media: [{ ...PROVIDER_ROW, status: "retired" }] }));
  assert.equal(await store.getPrimary("species:moose" as CanonicalId<"species">), null);
  assert.equal(await store.getPrimary("species:mexican-duck" as CanonicalId<"species">), null);
});

test("one species' provider image never appears for another species", async () => {
  const store = new SupabaseSpeciesMediaStore(fakeClient({ species_provider_media: [{ ...PROVIDER_ROW, species_id: "species:greater-sage-grouse", status: "active" }] }));
  const map = await store.getPrimaryMap(["species:gunnison-sage-grouse", "species:greater-sage-grouse"] as CanonicalId<"species">[]);
  assert.equal(map.has("species:gunnison-sage-grouse" as CanonicalId<"species">), false);
  assert.equal(map.get("species:greater-sage-grouse" as CanonicalId<"species">)?.speciesId, "species:greater-sage-grouse");
});

test("a provider row whose URL is not the provider's is never rendered", () => {
  assert.equal(providerMedia({ ...PROVIDER_ROW, image_url: "https://evil.example/moose.jpg" }), null);
  assert.throws(() => withUnsplashReferral("https://evil.example/@x"));
});

test("provider images are hotlinked at Imgix sizes and never re-encoded into our social cards", async () => {
  const renditions = unsplashRenditions(PROVIDER_ROW.image_url, { width: 4000, height: 3000 });
  assert.equal(new URL(renditions.card.url).searchParams.get("w"), "960");
  assert.equal(new URL(renditions.card.url).searchParams.get("ixid"), "abc");
  assert.deepEqual([renditions.profile.width, renditions.profile.height], [1600, 1200]);
  const media = providerMedia(PROVIDER_ROW)!;
  assert.equal(await speciesPhotoDataUrl(media, 1200, 630), null);
});

test("re-running never overwrites a manual image or an existing provider image", () => {
  const current = { manual: new Set(["species:moose"]), provider: new Map([["species:elk", {}]]) };
  assert.equal(needsProviderImage("species:moose", current), false);
  assert.equal(needsProviderImage("species:elk", current), false);
  assert.equal(needsProviderImage("species:axis-deer", current), true);
  const queue = publishQueue([
    { speciesId: "species:moose", outcome: "APPROVED" },
    { speciesId: "species:elk", outcome: "APPROVED" },
    { speciesId: "species:axis-deer", outcome: "APPROVED" },
    { speciesId: "species:nilgai", outcome: "NEEDS_REVIEW" },
  ], current);
  assert.deepEqual(queue.map(({ speciesId }) => speciesId), ["species:axis-deer"]);
});

/* ── Credentials and resumption ───────────────────────────────────────── */

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

test("the Unsplash credentials never reach application code", () => {
  const offenders = filesUnder(join(process.cwd(), "src"))
    .filter((file) => /\.(ts|tsx|js|mjs|css)$/.test(file) && !file.endsWith(".test.ts"))
    .filter((file) => /UNSPLASH_(ACCESS|SECRET)_KEY|UNSPLASH_APPLICATION_ID|api\.unsplash\.com|NEXT_PUBLIC_UNSPLASH/.test(readFileSync(file, "utf8")));
  assert.deepEqual(offenders, []);
});

test("the API client never logs its key and waits out a closed rate-limit window", async () => {
  const key = "secret-access-key-for-test";
  const lines: string[] = [];
  const headers = (remaining: number) => new Headers({ "x-ratelimit-remaining": String(remaining), "x-ratelimit-limit": "50" });
  // A probe that reports the window open while the API still refuses (a cached
  // answer, seen in production) must not exhaust the request: five refusals, then success.
  const refusedThenProbe = () => [
    new Response("Rate Limit Exceeded", { status: 403, headers: headers(0) }),
    new Response("[]", { status: 200, headers: headers(49) }),
  ];
  const responses = [
    new Response(JSON.stringify({ total: 1, results: [] }), { status: 200, headers: headers(1) }),
    new Response("[]", { status: 200, headers: headers(49) }),
    ...refusedThenProbe(), ...refusedThenProbe(), ...refusedThenProbe(), ...refusedThenProbe(), ...refusedThenProbe(),
    new Response(JSON.stringify({ total: 2, results: [] }), { status: 200, headers: headers(48) }),
  ];
  const seen: string[] = [];
  const client = createUnsplashClient({
    accessKey: key,
    log: (line: string) => lines.push(line),
    fetchImpl: (async (url: string, init: { headers: Record<string, string> }) => {
      assert.ok(responses.length, `unexpected extra request to ${url}`);
      seen.push(url);
      assert.equal(init.headers.Authorization, `Client-ID ${key}`);
      return responses.shift()!;
    }) as unknown as typeof fetch,
    sleepImpl: async () => {},
  });
  assert.equal((await client.search("moose")).total, 1);
  assert.equal((await client.search("elk")).total, 2);
  assert.ok(lines.some((line) => /waiting for the hourly window/.test(line)));
  assert.ok(lines.every((line) => !line.includes(key)));
  assert.ok(seen.every((url) => !url.includes(key)));
});

test("an interrupted harvest resumes from its cache without repeating a request", () => {
  const dir = mkdtempSync(join(tmpdir(), "species-images-"));
  assert.equal(reuseCachedSearch(readSearchCache(dir, "moose", "Moose")), false);
  writeSearchCache(dir, "moose", "Moose", { fetchedAt: new Date().toISOString(), total: 1, results: [] });
  assert.equal(reuseCachedSearch(readSearchCache(dir, "moose", "Moose")), true);
  const old = { fetchedAt: "2020-01-01T00:00:00Z" };
  assert.equal(reuseCachedSearch(old), true, "a stale search is reused unless a refresh is asked for");
  assert.equal(reuseCachedSearch(old, { refresh: true }), false);
});

test("the identity policy names only catalogue species", () => {
  const policy = JSON.parse(readFileSync(join(process.cwd(), "content", "species-media", "identity-policy.json"), "utf8"));
  for (const id of Object.keys(policy.species)) assert.ok(catalogue.identities.has(id), id);
});

test("every accepted image in the visual check carries factual alt text", () => {
  const file = join(process.cwd(), "content", "species-media", "unsplash-review.json");
  const { decisions } = JSON.parse(readFileSync(file, "utf8")) as { decisions: Record<string, ReviewDecision> };
  for (const [id, decision] of Object.entries(decisions)) {
    assert.ok(catalogue.identities.has(decision.speciesId), `${id}: ${decision.speciesId}`);
    if (decision.decision === "ACCEPT") {
      const alt = decision.altText?.trim() ?? "";
      assert.ok(alt.length > 0 && alt.length <= 300, `${id} alt text`);
      assert.doesNotMatch(alt, /beautiful|majestic|stunning|gorgeous/i, `${id} alt text is factual`);
    } else {
      assert.ok(decision.reason?.trim(), `${id} rejection has a reason`);
    }
  }
});

test("every catalogue species has exactly one image outcome in the audit", () => {
  const audit = JSON.parse(readFileSync(join(process.cwd(), "docs", "species-images-audit.json"), "utf8")) as {
    summary: { totalSpecies: number };
    species: Array<{ speciesId: string; outcome: string }>;
  };
  const ids = audit.species.map(({ speciesId }) => speciesId);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), [...catalogue.identities.keys()].sort());
  // A finished run holds only the first four; the rest name a run still in progress, never a silent gap.
  const allowed = new Set(["MANUAL", "PUBLISHED", "NEEDS_REVIEW", "NO_MATCH", "APPROVED", "AWAITING_VISUAL_CHECK", "NOT_SEARCHED"]);
  for (const row of audit.species) assert.ok(allowed.has(row.outcome), `${row.speciesId}: ${row.outcome}`);
  assert.equal(audit.summary.totalSpecies, ids.length);
  const counted = ["manual", "providerPublished", "needsReview", "noMatch", "approvedNotPublished", "awaitingVisualCheck", "notSearched"]
    .reduce((sum, key) => sum + Number((audit.summary as Record<string, unknown>)[key] ?? 0), 0);
  assert.equal(counted, ids.length, "the summary accounts for every species once");
});

test("publishable means identified, not excluded, large enough and not rejected", () => {
  const verdict = judge("american-alligator", [candidate("American alligator")]);
  assert.equal(publishable(verdict.chosen!), true);
});

test("the content security policy lets the browser load Unsplash images and nothing else of Unsplash's", async () => {
  const { default: config } = await import("../../../next.config.ts");
  const rules = await config.headers!();
  const csp = rules.flatMap(({ headers }) => headers).find(({ key }) => key === "Content-Security-Policy")!.value;
  const directive = (name: string) => csp.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";
  assert.match(directive("img-src"), /(^| )https:\/\/images\.unsplash\.com( |$)/);
  // The browser never talks to the API: the key stays on the pipeline's machine.
  assert.doesNotMatch(csp, /api\.unsplash\.com/);
  assert.doesNotMatch(directive("connect-src"), /unsplash/);
  assert.doesNotMatch(directive("script-src"), /unsplash/);
});

test("Hunt's compact surfaces never receive a provider image, and keep every image of ours", async () => {
  const store = new SupabaseSpeciesMediaStore(fakeClient({
    ...manualTables,
    species_provider_media: [{ ...PROVIDER_ROW, species_id: "species:axis-deer", status: "active" }],
  }));
  const map = await store.getPrimaryMap(["species:moose", "species:axis-deer"] as CanonicalId<"species">[]);
  assert.equal(map.size, 2);
  const hunt = uncreditedSurfaceMedia(map);
  assert.deepEqual(Object.keys(hunt), ["species:moose"]);
  assert.equal(hunt["species:moose"].source, "MANUAL");
});
