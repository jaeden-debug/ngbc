import type { Instrumentation } from "next";
import { describeRequestError } from "./lib/monitoring/request-error";

/**
 * Every unhandled server error — a page render, a route handler, the proxy —
 * becomes one structured log line (`"ng_event":"request_error"`), so a failure
 * can be found and counted in the platform's logs instead of discovered by a
 * hunter. Nothing that locates anyone is written: see `request-error.ts`.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  console.error(JSON.stringify(describeRequestError(error, request, context)));
};
