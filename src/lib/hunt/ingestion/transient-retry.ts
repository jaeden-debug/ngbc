/**
 * Reading an authority's service again when the service, not the request, is
 * at fault.
 *
 * A government GIS endpoint can be intermittently unwell without being wrong,
 * and a single bad answer part-way through thousands of parity reads used to
 * abort an entire certification run. Measured on 2026-09-23: Statistics
 * Canada's boundary service answered one identical geometry request 500, 200,
 * 500; British Columbia's WFS answered 400 once mid-run and then 200 on four
 * consecutive probes of the byte-identical request.
 *
 * A retry is only ever the same question asked again, so the policy is narrow
 * and stated rather than inferred:
 *
 *   - 5xx, 429 and transport failures are the service's fault and are retried.
 *   - 4xx means the request is wrong and is NOT retried, with one exception a
 *     caller must opt into per status and justify with evidence.
 *
 * Every retry is announced. A service that needs coaxing is a fact about the
 * source, and smoothing it into silence would hide a degrading authority.
 */

export type RetryOptions = {
  /** What to call this read in a retry notice ("layer:ca-pe-province"). */
  readonly label: string;
  /** Who is being read, for the error a caller finally sees. */
  readonly authority: string;
  /** Total attempts, including the first. */
  readonly attempts?: number;
  /**
   * Statuses this particular service is known to return transiently, beyond
   * 5xx and 429. Opt in only with measured evidence, and say what it is.
   */
  readonly alsoTransient?: readonly number[];
};

class TransientSourceError extends Error {
  /* Declared and assigned rather than a constructor parameter property, which
     Node cannot strip when it runs TypeScript directly. */
  readonly status: number;

  constructor(status: number) {
    super(`transient source status ${status}`);
    this.status = status;
  }
}

/**
 * Fetch `url`, retrying only the failures above. `onResponse` turns a
 * successful response into the caller's value; throwing inside it is never
 * retried, because a malformed body is not a transient fault.
 */
export async function readSource<T>(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit,
  options: RetryOptions,
  onResponse: (response: Response) => Promise<T>,
): Promise<T> {
  const attempts = options.attempts ?? 4;
  const transient = new Set<number>([429, ...(options.alsoTransient ?? [])]);
  for (let attempt = 1; ; attempt += 1) {
    const last = attempt >= attempts;
    try {
      const response = await fetcher(url, init);
      if (!response.ok) {
        const retryable = response.status >= 500 || transient.has(response.status);
        if (retryable && !last) throw new TransientSourceError(response.status);
        throw new Error(`${options.authority} returned ${response.status}`);
      }
      return await onResponse(response);
    } catch (cause) {
      /* fetch reports a transport failure as TypeError; a timeout aborts. */
      const transport = cause instanceof TypeError || (cause instanceof Error && cause.name === "TimeoutError");
      if (!(cause instanceof TransientSourceError) && !(transport && !last)) throw cause;
      const reason = cause instanceof TransientSourceError ? `HTTP ${cause.status}` : "transport failure";
      console.warn(`  ${options.label}: ${reason} from ${options.authority}; retrying (${attempt}/${attempts - 1})`);
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
    }
  }
}
