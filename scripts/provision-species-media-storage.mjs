import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const bucket = "species-media";
const { data: buckets, error: listError } = await client.storage.listBuckets();
if (listError) throw listError;
const existing = buckets.find(({ id }) => id === bucket);
const options = { public: false, fileSizeLimit: 15 * 1024 * 1024, allowedMimeTypes: ["image/webp"] };
const { error } = existing
  ? await client.storage.updateBucket(bucket, options)
  : await client.storage.createBucket(bucket, options);
if (error) throw error;
console.log(`${bucket}: private, WebP-only, 15 MiB limit`);
