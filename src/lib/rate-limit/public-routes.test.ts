import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

/**
 * NO PUBLIC ENDPOINT COUNTS IN ONE INSTANCE'S MEMORY ALONE.
 *
 * Asked of every route that exists rather than of a list of the ones we
 * remembered: a new public route that reaches for `createRateLimiter` directly
 * fails here. Administrator routes are exempt because they sit behind an
 * authenticated session; their one pre-authentication step, sign-in, has its
 * own fail-closed durable limiter.
 */
const routes = readdirSync("src/app/api", { recursive: true, encoding: "utf8" })
  .filter((path) => path === "route.ts" || path.endsWith("/route.ts"))
  .map((path) => `src/app/api/${path}`);
const limits = readFileSync("src/lib/rate-limit/public-limits.ts", "utf8");
const declared = [...limits.matchAll(/^\s+"([a-z-]+)": \{ limit: \d+, windowMs: [\d_ *]+ \},$/gm)].map((match) => match[1]);

test("the scan sees the routes it is about (positive control)", () => {
  assert.ok(routes.length >= 10, `found ${routes.length} routes`);
  assert.ok(declared.length >= 9, `found ${declared.length} declared budgets`);
});

test("no public route builds a process-local limiter", () => {
  const offenders = routes.filter(
    (path) => !path.startsWith("src/app/api/admin/") && readFileSync(path, "utf8").includes("createRateLimiter"),
  );
  assert.deepEqual(offenders, []);
});

test("every declared budget is used by a route, and every route's budget is declared", () => {
  const used = new Set<string>();
  for (const path of routes) {
    for (const match of readFileSync(path, "utf8").matchAll(/sharedRateLimiter\("([a-z-]+)"\)/g)) used.add(match[1]);
  }
  assert.deepEqual([...used].sort(), [...declared].sort());
});
