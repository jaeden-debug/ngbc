import { Redis } from "@upstash/redis";
import type { ShareHuntBriefV1 } from "./model.ts";

const KEY_PREFIX = "north-ground:hunt-brief:v1:";

export class HuntBriefStoreConfigurationError extends Error {
  constructor() {
    super("Hunt Brief persistence is not configured");
    this.name = "HuntBriefStoreConfigurationError";
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

function redisFromEnvironment(environment: NodeJS.ProcessEnv = process.env): Redis {
  const url = environment.UPSTASH_REDIS_REST_URL?.trim();
  const token = environment.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) throw new HuntBriefStoreConfigurationError();
  return new Redis({ url, token });
}

export class UpstashHuntBriefStore implements HuntBriefStore {
  constructor(private readonly redis: Redis) {}

  async create(brief: ShareHuntBriefV1): Promise<"created" | "exists"> {
    const result = await this.redis.set(`${KEY_PREFIX}${brief.shareId}`, brief, { nx: true });
    return result === "OK" ? "created" : "exists";
  }

  async get(shareId: string): Promise<unknown | null> {
    return this.redis.get(`${KEY_PREFIX}${shareId}`);
  }
}

export class UpstashShareCreationLimiter implements ShareCreationLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly limit = 8,
    private readonly windowSeconds = 600,
  ) {}

  async check(key: string): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const redisKey = `north-ground:hunt-share-rate:${key}`;
    const count = await this.redis.incr(redisKey);
    if (count === 1) await this.redis.expire(redisKey, this.windowSeconds);
    const ttl = await this.redis.ttl(redisKey);
    return {
      allowed: count <= this.limit,
      retryAfterSeconds: ttl > 0 ? ttl : this.windowSeconds,
    };
  }
}

let redis: Redis | null = null;

function defaultRedis(): Redis {
  if (!redis) redis = redisFromEnvironment();
  return redis;
}

export function defaultHuntBriefStore(): HuntBriefStore {
  return new UpstashHuntBriefStore(defaultRedis());
}

export function defaultShareCreationLimiter(): ShareCreationLimiter {
  return new UpstashShareCreationLimiter(defaultRedis());
}
