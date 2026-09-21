import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShareHuntBrief } from "./model.ts";
import { defaultSupabaseServerClient, SupabaseServerConfigurationError } from "../supabase/server.ts";

export class HuntBriefStoreConfigurationError extends Error {
  constructor() {
    super("Hunt Brief persistence is not configured");
    this.name = "HuntBriefStoreConfigurationError";
  }
}

export class HuntBriefStoreUnavailableError extends Error {
  constructor() {
    super("Hunt Brief persistence is unavailable");
    this.name = "HuntBriefStoreUnavailableError";
  }
}

export interface HuntBriefStore {
  create(brief: ShareHuntBrief): Promise<"created" | "exists">;
  get(shareId: string): Promise<unknown | null>;
  /**
   * Whether a brief is stored under this ID, without fetching the snapshot.
   *
   * Asked before a page renders, so a missing brief can be answered as a real
   * 404 page instead of reaching `notFound()`. Throws when storage cannot be
   * read — a caller must be able to tell "no such brief" from "cannot tell".
   *
   * Accepts a signal so the caller can bound it. The proxy asks this before any
   * response starts, and an unbounded wait there holds the reader at a blank
   * screen for as long as storage takes to fail.
   */
  exists(shareId: string, options?: { signal?: AbortSignal }): Promise<boolean>;
}

export interface ShareCreationLimiter {
  check(key: string): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
}

export class InMemoryHuntBriefStore implements HuntBriefStore {
  readonly values = new Map<string, unknown>();

  async create(brief: ShareHuntBrief): Promise<"created" | "exists"> {
    if (this.values.has(brief.shareId)) return "exists";
    this.values.set(brief.shareId, structuredClone(brief));
    return "created";
  }

  async get(shareId: string): Promise<unknown | null> {
    const value = this.values.get(shareId);
    return value === undefined ? null : structuredClone(value);
  }

  async exists(shareId: string): Promise<boolean> {
    return this.values.has(shareId);
  }
}

export class InMemoryShareCreationLimiter implements ShareCreationLimiter {
  private readonly counts = new Map<string, number>();

  constructor(private readonly limit = 8) {}

  async check(key: string): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return { allowed: next <= this.limit, retryAfterSeconds: 600 };
  }
}

export class SupabaseHuntBriefStore implements HuntBriefStore {
  constructor(private readonly client: SupabaseClient) {}

  async create(brief: ShareHuntBrief): Promise<"created" | "exists"> {
    const { error } = await this.client.from("hunt_brief_snapshots").insert({
      public_share_id: brief.shareId,
      schema_version: brief.version,
      snapshot: brief,
      created_at: brief.createdAt,
      regulatory_verified_at: brief.regulatory.verifiedAt ?? null,
    });
    if (!error) return "created";
    if (error.code === "23505") return "exists";
    throw new HuntBriefStoreUnavailableError();
  }

  async get(shareId: string): Promise<unknown | null> {
    const { data, error } = await this.client
      .from("hunt_brief_snapshots")
      .select("snapshot")
      .eq("public_share_id", shareId)
      .maybeSingle();
    if (error) throw new HuntBriefStoreUnavailableError();
    return data?.snapshot ?? null;
  }

  async exists(shareId: string, options?: { signal?: AbortSignal }): Promise<boolean> {
    // The ID column only. The snapshot is fetched by the page, for the briefs
    // that exist; a missing brief now costs one indexed lookup and no render.
    let query = this.client
      .from("hunt_brief_snapshots")
      .select("public_share_id")
      .eq("public_share_id", shareId);
    // Cancels the request itself, not only the wait for it.
    if (options?.signal) query = query.abortSignal(options.signal);
    const { data, error } = await query.maybeSingle();
    if (error) throw new HuntBriefStoreUnavailableError();
    return data !== null;
  }
}

export class SupabaseShareCreationLimiter implements ShareCreationLimiter {
  constructor(
    private readonly client: SupabaseClient,
    private readonly limit = 8,
    private readonly windowSeconds = 600,
  ) {}

  async check(key: string): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const { data, error } = await this.client.rpc("consume_hunt_share_rate_limit", {
      p_identity_hash: key,
      p_limit: this.limit,
      p_window_seconds: this.windowSeconds,
    });
    const result = Array.isArray(data) ? data[0] : data;
    if (error || !result || typeof result.allowed !== "boolean" || typeof result.retry_after_seconds !== "number") {
      throw new HuntBriefStoreUnavailableError();
    }
    return { allowed: result.allowed, retryAfterSeconds: result.retry_after_seconds };
  }
}

function configuredClient(): SupabaseClient {
  try {
    return defaultSupabaseServerClient();
  } catch (error) {
    if (error instanceof SupabaseServerConfigurationError) throw new HuntBriefStoreConfigurationError();
    throw error;
  }
}

export function defaultHuntBriefStore(): HuntBriefStore {
  return new SupabaseHuntBriefStore(configuredClient());
}

export function defaultShareCreationLimiter(): ShareCreationLimiter {
  return new SupabaseShareCreationLimiter(configuredClient());
}
