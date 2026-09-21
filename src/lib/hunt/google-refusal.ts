/**
 * Why a server-side Google request failed, in terms that are safe to log.
 *
 * Every Google provider in Hunt falls back to a keyless one, which keeps Hunt
 * answering and would also hide a broken key indefinitely. On 2026-09-21 the
 * production key began to be refused by Google Weather and Places, and the only
 * visible sign was Open-Meteo and Nominatim quietly answering instead.
 *
 * So a refusal is logged, but only as Google's enumerated status and reason
 * (`PERMISSION_DENIED, API_KEY_HTTP_REFERRER_BLOCKED`). Google's prose message is
 * never kept, because it can quote the request. The key, the query, the
 * coordinate and the date are never logged: together they say where and when
 * someone intends to hunt.
 */

interface GoogleErrorBody {
  error?: { status?: unknown; details?: Array<{ reason?: unknown }> };
}

const isEnumerated = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Z][A-Z0-9_]{1,63}$/.test(value);

/** An Error naming the service, the HTTP status and Google's enumerated reason. */
export async function googleRefusal(service: string, response: Response): Promise<Error> {
  const reason = await response.json().then(
    (body: GoogleErrorBody) => [body.error?.status, ...(body.error?.details ?? []).map((detail) => detail?.reason)]
      .filter(isEnumerated)
      .join(", "),
    () => "",
  );
  return new Error(`${service} returned ${response.status}${reason ? ` (${reason})` : ""}`);
}

/** The legacy Geocoding API refuses with HTTP 200 and a status field instead. */
export function googleStatusRefusal(service: string, status: unknown): Error {
  return new Error(`${service} answered ${isEnumerated(status) ? status : "an unrecognised status"}`);
}

export function logGoogleFailure(tag: string, service: string, error: unknown): void {
  const detail = error instanceof Error && error.message.startsWith(service)
    ? error.message
    : `${service} failed: ${error instanceof Error ? error.name : "unknown error"}`;
  console.warn(`[${tag}] ${detail}`);
}
