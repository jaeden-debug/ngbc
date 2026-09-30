/**
 * The Unsplash API, for the species-image pipeline only.
 *
 * Only the Access Key is used: ordinary photo search, photo detail and the
 * download event are public actions (`Authorization: Client-ID …`). The Secret
 * Key and Application ID are never read — nothing here needs OAuth.
 *
 * The key lives in this process only. It is never logged, never written to a
 * cache or report, and never reaches the Next.js application: the site
 * hotlinks the URLs the API returned and needs no key to display them.
 *
 * Rate limits are the application's own (`X-Ratelimit-Limit`, 50/hour in demo
 * mode). The client never spends the last request of a window, waits for the
 * window to reset rather than retrying into a 403, and retries only transient
 * failures (network, 5xx), with backoff.
 */
import { readFileSync } from "node:fs";

const API = "https://api.unsplash.com";
const WAIT_STEP_MS = 5 * 60 * 1000;

export function loadUnsplashAccessKey() {
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
  const key = process.env.UNSPLASH_ACCESS_KEY?.trim();
  if (!key) throw new Error("UNSPLASH_ACCESS_KEY is required (server-only; never NEXT_PUBLIC_).");
  return key;
}

export class UnsplashRateLimited extends Error {
  constructor(message) {
    super(message);
    this.name = "UnsplashRateLimited";
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {{ accessKey: string, log?: (line: string) => void, fetchImpl?: typeof fetch, maxWaitMs?: number, sleepImpl?: (ms: number) => Promise<void> }} options
 */
export function createUnsplashClient({ accessKey, log = () => {}, fetchImpl = fetch, maxWaitMs = 2 * 60 * 60 * 1000, sleepImpl = sleep }) {
  let remaining = null;
  let limit = null;

  async function waitForWindow(reason) {
    let waited = 0;
    log(`rate limit: ${reason}; waiting for the hourly window`);
    while (waited < maxWaitMs) {
      await sleepImpl(WAIT_STEP_MS);
      waited += WAIT_STEP_MS;
      // Probing costs nothing when the window is still closed (403 is not counted),
      // and it is the only signal of a reset the API gives. The query is unique
      // so no cache can answer for the API: a cached "49 left" once reopened a
      // window that was still closed.
      const probe = await fetchImpl(`${API}/photos?per_page=1&page=${1 + (Date.now() % 97)}&_=${Date.now()}`, { headers: headers(), cache: "no-store" }).catch(() => null);
      const left = Number(probe?.headers.get("x-ratelimit-remaining"));
      if (probe && probe.status !== 403 && Number.isFinite(left) && left > 1) {
        remaining = left;
        log(`rate limit: window open again (${left} left)`);
        return;
      }
    }
    throw new UnsplashRateLimited(`window did not reopen within ${Math.round(maxWaitMs / 60000)} min`);
  }

  function headers() {
    return { Authorization: `Client-ID ${accessKey}`, "Accept-Version": "v1" };
  }

  async function get(path) {
    // Attempts are for transient failures only; waiting out a rate-limit window
    // is bounded by maxWaitMs per wait, not by this count.
    let attempt = 0;
    while (attempt < 4) {
      if (remaining !== null && remaining <= 1) await waitForWindow(`${remaining} left of ${limit}`);
      let response;
      try {
        response = await fetchImpl(`${API}${path}`, { headers: headers(), cache: "no-store" });
      } catch (error) {
        attempt += 1;
        if (attempt === 4) throw error;
        await sleepImpl(2 ** attempt * 2000);
        continue;
      }
      const left = Number(response.headers.get("x-ratelimit-remaining"));
      if (Number.isFinite(left)) remaining = left;
      const cap = Number(response.headers.get("x-ratelimit-limit"));
      if (Number.isFinite(cap)) limit = cap;
      if (response.status === 403) {
        const body = await response.text();
        if (/rate limit/i.test(body)) {
          remaining = 0;
          await waitForWindow("403 Rate Limit Exceeded");
          continue;
        }
        throw new Error(`Unsplash ${path.split("?")[0]} → 403`);
      }
      if (response.status >= 500) {
        attempt += 1;
        await sleepImpl(2 ** attempt * 2000);
        continue;
      }
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Unsplash ${path.split("?")[0]} → ${response.status}`);
      return response.json();
    }
    throw new Error(`Unsplash ${path.split("?")[0]} failed after retries`);
  }

  return {
    get remaining() { return remaining; },
    get limit() { return limit; },
    /** One page of search results (max 30), content_filter=high so nothing unsuitable is offered. */
    search(query, { perPage = 30, page = 1 } = {}) {
      const params = new URLSearchParams({ query, per_page: String(perPage), page: String(page), content_filter: "high" });
      return get(`/search/photos?${params}`);
    },
    photo(id) {
      return get(`/photos/${encodeURIComponent(id)}`);
    },
    /**
     * The download event, sent once when a photo is chosen for use — the
     * equivalent of inserting it into a document. It is not an image request
     * and is never sent per page view.
     */
    async trackDownload(downloadLocation) {
      const url = new URL(downloadLocation);
      if (url.origin !== API || !/^\/photos\/[^/]+\/download$/.test(url.pathname)) {
        throw new Error("download_location is not an Unsplash API download endpoint");
      }
      return get(`${url.pathname}${url.search}`);
    },
  };
}
