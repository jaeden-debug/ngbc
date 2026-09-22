import { randomBytes } from "node:crypto";
import {
  createShareableHuntBrief,
  isValidHuntBriefShareId,
  parseStoredHuntBrief,
  type HuntShareProjectionInput,
  type ShareHuntBrief,
  type StoredHuntBriefResult,
} from "./model.ts";
import { withDeadline } from "./deadline.ts";
import { defaultHuntBriefStore, type HuntBriefStore } from "./store.ts";

export function generateHuntBriefShareId(): string {
  return randomBytes(18).toString("base64url");
}

export async function persistHuntBrief(
  input: HuntShareProjectionInput | unknown,
  options: {
    store?: HuntBriefStore;
    now?: () => Date;
    generateId?: () => string;
  } = {},
): Promise<ShareHuntBrief> {
  const store = options.store ?? defaultHuntBriefStore();
  const now = options.now ?? (() => new Date());
  const generateId = options.generateId ?? generateHuntBriefShareId;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const shareId = generateId();
    const brief = createShareableHuntBrief(input, {
      shareId,
      createdAt: now().toISOString(),
    });
    if ((await store.create(brief)) === "created") return brief;
  }

  throw new Error("Unable to allocate a unique Hunt Brief share ID");
}

export type HuntBriefLookupResult =
  | StoredHuntBriefResult
  | { status: "missing" }
  | { status: "invalid_id" };

/**
 * How long the brief page waits for its snapshot. During the 2026-09-21
 * Supabase outage every call took ~20 s to fail, so an unbounded lookup held a
 * reader at a blank page for that long before "temporarily unavailable". The
 * bound matches the spatial lookup's; exceeding it throws, and the page renders
 * its unavailable state — never "this brief does not exist".
 */
export const BRIEF_LOAD_TIMEOUT_MS = 2_500;

export async function getHuntBrief(
  shareId: string,
  store?: HuntBriefStore,
  { timeoutMs = BRIEF_LOAD_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<HuntBriefLookupResult> {
  if (!isValidHuntBriefShareId(shareId)) return { status: "invalid_id" };
  const resolved = store ?? defaultHuntBriefStore();
  const stored = await withDeadline((signal) => resolved.get(shareId, { signal }), timeoutMs, "Hunt Brief lookup timed out");
  return stored === null ? { status: "missing" } : parseStoredHuntBrief(stored);
}
