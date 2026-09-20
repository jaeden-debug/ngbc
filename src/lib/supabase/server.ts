import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export class SupabaseServerConfigurationError extends Error {
  constructor() {
    super("Supabase server access is not configured");
    this.name = "SupabaseServerConfigurationError";
  }
}

let client: SupabaseClient | null = null;

export function createSupabaseServerClient(environment: NodeJS.ProcessEnv = process.env): SupabaseClient {
  const url = environment.SUPABASE_URL?.trim();
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) throw new SupabaseServerConfigurationError();

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "X-Client-Info": "north-ground-server" } },
  });
}

export function defaultSupabaseServerClient(): SupabaseClient {
  if (!client) client = createSupabaseServerClient();
  return client;
}

