import assert from "node:assert/strict";
import test from "node:test";
import { createEventLogger } from "./events.ts";
import { describeRequestError } from "./request-error.ts";

test("an event is one JSON line, and a repeat inside the interval is counted, not written", () => {
  let time = 0;
  const lines: Array<{ level: string; line: string }> = [];
  const logger = createEventLogger({ write: (level, line) => lines.push({ level, line }), intervalMs: 60_000, now: () => time });

  logger.log("rate_limit.store_unavailable.hunt-zones", "error", { reason: "timeout" });
  logger.log("rate_limit.store_unavailable.hunt-zones", "error", { reason: "timeout" });
  logger.log("rate_limit.store_unavailable.hunt-zones", "error", { reason: "timeout" });
  logger.log("rate_limit.denied.hunt-evaluate", "info");
  assert.equal(lines.length, 2, "a different event is not folded into another");

  time = 60_000;
  logger.log("rate_limit.store_unavailable.hunt-zones", "error", { reason: "timeout" });
  assert.equal(lines.length, 3);
  const third = JSON.parse(lines[2].line);
  assert.equal(third.ng_event, "rate_limit.store_unavailable.hunt-zones");
  assert.equal(third.level, "error");
  assert.equal(third.reason, "timeout");
  assert.equal(third.suppressed_since_last, 2);
  assert.equal(lines[2].level, "error");
});

test("a request error records the route and the error, never the query or a header", () => {
  const error = Object.assign(new TypeError("zone geometry was not an object"), { digest: "1234567" });
  const record = describeRequestError(
    error,
    { path: "/api/hunt/zones?bounds=-77.1,45.2,-76.9,45.4&zoom=11", method: "GET" },
    { routePath: "/api/hunt/zones", routeType: "route" },
    () => new Date("2026-10-30T12:00:00Z"),
  );
  assert.deepEqual(record, {
    ng_event: "request_error",
    level: "error",
    at: "2026-10-30T12:00:00.000Z",
    method: "GET",
    path: "/api/hunt/zones",
    route: "/api/hunt/zones",
    route_type: "route",
    render_source: null,
    error_name: "TypeError",
    error_message: "zone geometry was not an object",
    digest: "1234567",
  });
  assert.ok(!JSON.stringify(record).includes("45.2"), "the viewport never reaches the log");
});

test("a thrown non-error and an overlong message are still recorded, bounded", () => {
  const thrown = describeRequestError("plain string", { path: "/hunt", method: "GET" }, { routePath: "/hunt", routeType: "render" });
  assert.equal(thrown.error_name, "string");
  assert.equal(thrown.error_message, "plain string");
  const long = describeRequestError(new Error("x".repeat(1_000)), { path: "/", method: "GET" }, { routePath: "/", routeType: "render" });
  assert.equal(long.error_message.length, 301);
});
