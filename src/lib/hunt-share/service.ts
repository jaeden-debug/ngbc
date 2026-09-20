import { randomBytes } from "node:crypto";
import {
  createShareableHuntBrief,
  isValidHuntBriefShareId,
  parseStoredHuntBrief,
  type HuntShareProjectionInput,
  type ShareHuntBriefV1,
  type StoredHuntBriefResult,
} from "./model.ts";
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
): Promise<ShareHuntBriefV1> {
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

export async function getHuntBrief(
  shareId: string,
  store?: HuntBriefStore,
): Promise<HuntBriefLookupResult> {
  if (!isValidHuntBriefShareId(shareId)) return { status: "invalid_id" };
  const stored = await (store ?? defaultHuntBriefStore()).get(shareId);
  return stored === null ? { status: "missing" } : parseStoredHuntBrief(stored);
}
