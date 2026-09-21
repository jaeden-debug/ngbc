import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const SPECIES_MEDIA_ADMIN_COOKIE = "ng_species_media_admin";
const SESSION_SECONDS = 8 * 60 * 60;

export class SpeciesMediaAdminConfigurationError extends Error {
  constructor() {
    super("Species media administration is not configured");
    this.name = "SpeciesMediaAdminConfigurationError";
  }
}

export interface SpeciesMediaAdmin {
  userId: string;
  reviewerName: string;
}

interface SessionPayload { v: 1; sub: string; exp: number }

function configuration(environment: NodeJS.ProcessEnv = process.env) {
  const url = environment.SUPABASE_URL?.trim();
  const publishableKey = environment.SUPABASE_PUBLISHABLE_KEY?.trim();
  const sessionSecret = environment.SPECIES_MEDIA_ADMIN_SESSION_SECRET?.trim();
  const ids = new Set((environment.SPECIES_MEDIA_ADMIN_USER_IDS ?? "")
    .split(",").map((value) => value.trim()).filter(Boolean));
  const reviewerName = environment.SPECIES_MEDIA_ADMIN_NAME?.trim() || "North Ground administrator";
  if (!url || !publishableKey || !sessionSecret || sessionSecret.length < 32 || !ids.size) {
    throw new SpeciesMediaAdminConfigurationError();
  }
  return { url, publishableKey, sessionSecret, ids, reviewerName };
}

function signature(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

export function createAdminSessionToken(
  userId: string,
  environment: NodeJS.ProcessEnv = process.env,
  now = Date.now(),
): string {
  const { sessionSecret, ids } = configuration(environment);
  if (!ids.has(userId)) throw new Error("ADMIN_NOT_ALLOWED");
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    sub: userId,
    exp: Math.floor(now / 1_000) + SESSION_SECONDS,
  } satisfies SessionPayload)).toString("base64url");
  return `${payload}.${signature(payload, sessionSecret).toString("base64url")}`;
}

export function verifyAdminSessionToken(
  token: string | undefined,
  environment: NodeJS.ProcessEnv = process.env,
  now = Date.now(),
): SpeciesMediaAdmin | null {
  if (!token) return null;
  const { sessionSecret, ids, reviewerName } = configuration(environment);
  const [payload, supplied] = token.split(".");
  if (!payload || !supplied) return null;
  const expected = signature(payload, sessionSecret);
  let suppliedBuffer: Buffer;
  try { suppliedBuffer = Buffer.from(supplied, "base64url"); } catch { return null; }
  if (suppliedBuffer.length !== expected.length || !timingSafeEqual(suppliedBuffer, expected)) return null;
  let parsed: SessionPayload;
  try { parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload; } catch { return null; }
  if (parsed.v !== 1 || typeof parsed.sub !== "string" || !ids.has(parsed.sub)) return null;
  if (!Number.isSafeInteger(parsed.exp) || parsed.exp <= Math.floor(now / 1_000)) return null;
  return { userId: parsed.sub, reviewerName };
}

export async function currentSpeciesMediaAdmin(): Promise<SpeciesMediaAdmin | null> {
  try {
    return verifyAdminSessionToken((await cookies()).get(SPECIES_MEDIA_ADMIN_COOKIE)?.value);
  } catch (error) {
    if (error instanceof SpeciesMediaAdminConfigurationError) return null;
    throw error;
  }
}

export async function authenticateSpeciesMediaAdmin(
  email: string,
  password: string,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<{ admin: SpeciesMediaAdmin; token: string } | null> {
  const config = configuration(environment);
  const client = createClient(config.url, config.publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user || !config.ids.has(data.user.id)) return null;
  return {
    admin: { userId: data.user.id, reviewerName: config.reviewerName },
    token: createAdminSessionToken(data.user.id, environment),
  };
}

export const speciesMediaAdminCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: SESSION_SECONDS,
};
