/**
 * The record written for an unhandled server error.
 *
 * It carries the route, the method, the kind of work that failed and the
 * error's own class, message and digest. It deliberately leaves out the query
 * string and every header: Hunt's map requests put the viewport's bounds in
 * the query, and headers carry the client address, and neither belongs in an
 * error log (CLAUDE.md §49). The route PATTERN (`/api/hunt/[zone]`) is kept
 * alongside the path so errors group by handler rather than by URL.
 */

const MAX_MESSAGE_LENGTH = 300;

export interface RequestErrorRecord {
  ng_event: "request_error";
  level: "error";
  at: string;
  method: string;
  path: string;
  route: string;
  route_type: string;
  render_source: string | null;
  error_name: string;
  error_message: string;
  digest: string | null;
}

export function describeRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routePath: string; routeType: string; renderSource?: string },
  now: () => Date = () => new Date(),
): RequestErrorRecord {
  const value = error instanceof Error ? error : null;
  const digest =
    error && typeof error === "object" && "digest" in error && typeof (error as { digest: unknown }).digest === "string"
      ? (error as { digest: string }).digest
      : null;
  const message = value ? value.message : String(error);
  return {
    ng_event: "request_error",
    level: "error",
    at: now().toISOString(),
    method: request.method,
    path: request.path.split("?", 1)[0].split("#", 1)[0],
    route: context.routePath,
    route_type: context.routeType,
    render_source: context.renderSource ?? null,
    error_name: value?.name ?? typeof error,
    error_message: message.length > MAX_MESSAGE_LENGTH ? `${message.slice(0, MAX_MESSAGE_LENGTH)}…` : message,
    digest,
  };
}
