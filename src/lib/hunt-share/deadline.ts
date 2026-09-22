/**
 * Run a storage call with a hard deadline.
 *
 * A plain timer rather than `AbortSignal.timeout`, whose timer is unref'd: it
 * does not keep the process alive, so the deadline only held while some other
 * I/O happened to. The call is both signalled (a store that honours the signal
 * cancels the request itself) and raced (the caller returns on time from one
 * that does not). The timer is cleared as soon as the answer arrives, so a fast
 * call does not keep an invocation alive for the full bound.
 */
export async function withDeadline<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(message)), timeoutMs);
  try {
    return await Promise.race([
      run(controller.signal),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => reject(controller.signal.reason), { once: true });
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
