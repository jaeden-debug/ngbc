export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface Counter {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  maxEntries?: number;
  now?: () => number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
}

export function createRateLimiter({
  limit,
  windowMs,
  maxEntries = 5_000,
  now = Date.now,
}: RateLimiterOptions): RateLimiter {
  const counters = new Map<string, Counter>();

  function prune(currentTime: number) {
    for (const [key, counter] of counters) {
      if (counter.resetAt <= currentTime) counters.delete(key);
    }

    while (counters.size >= maxEntries) {
      const oldest = counters.keys().next().value;
      if (typeof oldest !== "string") break;
      counters.delete(oldest);
    }
  }

  return {
    check(key) {
      const currentTime = now();
      let counter = counters.get(key);

      if (!counter || counter.resetAt <= currentTime) {
        if (counters.size >= maxEntries) prune(currentTime);
        counter = { count: 0, resetAt: currentTime + windowMs };
        counters.set(key, counter);
      }

      counter.count += 1;
      return {
        allowed: counter.count <= limit,
        retryAfterSeconds: Math.max(1, Math.ceil((counter.resetAt - currentTime) / 1_000)),
      };
    },
  };
}

export function getClientAddress(request: Request): string {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip");

  return forwarded?.split(",", 1)[0]?.trim() || "unknown";
}
