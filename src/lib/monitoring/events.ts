/**
 * Operational events, written as one JSON line each so the platform's log
 * search can filter and count them (`"ng_event":"rate_limit.store_unavailable"`).
 *
 * WHAT MAY BE LOGGED. Event names, route names, counts, durations and error
 * class names. Never a coordinate, an address, a search string, a client IP or
 * a request body (CLAUDE.md §49): an operational log is not a place to keep
 * where a hunter was.
 *
 * THROTTLING. A failing dependency fails on every request; one line per event
 * name per interval per instance says the same thing, with a count of what was
 * folded into it, without burying everything else in the log.
 */

export type EventLevel = "info" | "warn" | "error";
export type EventFields = Record<string, string | number | boolean | null>;

interface Throttle {
  windowEndsAt: number;
  suppressed: number;
}

export interface EventLogger {
  log(name: string, level: EventLevel, fields?: EventFields): void;
}

export function createEventLogger({
  write = (level: EventLevel, line: string) => {
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.info(line);
  },
  intervalMs = 60_000,
  now = Date.now,
  maxNames = 200,
}: {
  write?: (level: EventLevel, line: string) => void;
  intervalMs?: number;
  now?: () => number;
  maxNames?: number;
} = {}): EventLogger {
  const throttles = new Map<string, Throttle>();

  return {
    log(name, level, fields = {}) {
      const currentTime = now();
      const throttle = throttles.get(name);
      if (throttle && throttle.windowEndsAt > currentTime) {
        throttle.suppressed += 1;
        return;
      }
      if (!throttle && throttles.size >= maxNames) {
        const oldest = throttles.keys().next().value;
        if (typeof oldest === "string") throttles.delete(oldest);
      }
      const suppressed = throttle?.suppressed ?? 0;
      throttles.set(name, { windowEndsAt: currentTime + intervalMs, suppressed: 0 });
      write(
        level,
        JSON.stringify({
          ng_event: name,
          level,
          at: new Date(currentTime).toISOString(),
          ...fields,
          ...(suppressed ? { suppressed_since_last: suppressed } : {}),
        }),
      );
    },
  };
}

export const events = createEventLogger();
