import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShareHuntBriefV1 } from "./model.ts";
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
  create(brief: ShareHuntBriefV1): Promise<"created" | "exists">;
  get(shareId: string): Promise<unknown | null>;
}

export interface ShareCreationLimiter {
  check(key: string): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
}

export class InMemoryHuntBriefStore implements HuntBriefStore {
  readonly values = new Map<string, unknown>();

  async create(brief: ShareHuntBriefV1): Promise<"created" | "exists"> {
    if (this.values.has(brief.shareId)) return "exists";
    this.values.set(brief.shareId, structuredClone(brief));
    return "created";
  }

  async get(shareId: string): Promise<unknown | null> {
    const value = this.values.get(shareId);
    return value === undefined ? null : structuredClone(value);
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

  async create(brief: ShareHuntBriefV1): Promise<"created" | "exists"> {
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
