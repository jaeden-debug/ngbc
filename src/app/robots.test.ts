import assert from "node:assert/strict";
import test from "node:test";
import { OVERVIEW_URL } from "../lib/hunt/exploration/overview";
import robots from "./robots";

/* Google's rule: the most specific (longest) matching path wins, and allow wins a tie. */
function allowed(path: string): boolean {
  const rules = robots().rules;
  const rule = Array.isArray(rules) ? rules[0] : rules;
  const list = (value: string | string[] | undefined) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
  const longest = (prefixes: string[]) => Math.max(-1, ...prefixes.filter((prefix) => path.startsWith(prefix)).map((prefix) => prefix.length));
  return longest(list(rule.allow)) >= longest(list(rule.disallow));
}

test("a robots-obeying renderer may fetch the geometry Hunt's opening map draws", () => {
  // Refused, the map reports every authority's service as "not answering".
  assert.equal(allowed(new URL(OVERVIEW_URL, "https://example.test").pathname), true);
});

test("species photos stay crawlable and the rest of /api/ stays closed", () => {
  assert.equal(allowed("/api/species-media/abc/profile"), true);
  for (const path of ["/api/hunt/evaluate", "/api/hunt/zone", "/api/hunt/zone-summary", "/api/hunt/share", "/api/subscribe", "/api/admin/species-media"]) {
    assert.equal(allowed(path), false, path);
  }
});
