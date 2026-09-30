/**
 * The harvest's checkpoint. Each search response is one file, written only
 * after the response arrived, so an interrupted run resumes at the first
 * species without one and never spends a request twice. Metadata only: no
 * image file is ever stored.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const FRESH_DAYS = 30;

export function searchCachePath(cacheDir, slug, query) {
  const hash = createHash("sha1").update(query.toLowerCase()).digest("hex").slice(0, 12);
  return join(cacheDir, "unsplash", "search", slug, `${hash}.json`);
}

export function readSearchCache(cacheDir, slug, query) {
  const file = searchCachePath(cacheDir, slug, query);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
}

export function writeSearchCache(cacheDir, slug, query, record) {
  const file = searchCachePath(cacheDir, slug, query);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(record));
}

/** A cached search is reused unless a refresh was asked for and it is older than FRESH_DAYS. */
export function reuseCachedSearch(entry, { refresh = false, now = Date.now() } = {}) {
  if (!entry) return false;
  if (!refresh) return true;
  return now - Date.parse(entry.fetchedAt) < FRESH_DAYS * 86_400_000;
}
