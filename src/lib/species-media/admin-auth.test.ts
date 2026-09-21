import assert from "node:assert/strict";
import test from "node:test";
import { createAdminSessionToken, SpeciesMediaAdminConfigurationError, verifyAdminSessionToken } from "./admin-auth.ts";

const userId = "11111111-1111-4111-8111-111111111111";
const environment = {
  NODE_ENV: "test",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  SPECIES_MEDIA_ADMIN_SESSION_SECRET: "a-private-test-secret-that-is-longer-than-32-characters",
  SPECIES_MEDIA_ADMIN_USER_IDS: userId,
  SPECIES_MEDIA_ADMIN_NAME: "Test reviewer",
} satisfies NodeJS.ProcessEnv;

test("creates a signed, expiring session only for an allowlisted Supabase user", () => {
  const now = Date.UTC(2026, 8, 21, 12);
  const token = createAdminSessionToken(userId, environment, now);
  assert.deepEqual(verifyAdminSessionToken(token, environment, now + 1_000), {
    userId,
    reviewerName: "Test reviewer",
  });
  assert.equal(verifyAdminSessionToken(token, environment, now + (8 * 60 * 60 * 1_000)), null);
  assert.throws(() => createAdminSessionToken("22222222-2222-4222-8222-222222222222", environment), /ADMIN_NOT_ALLOWED/);
});

test("rejects tampered sessions and revoked administrators", () => {
  const token = createAdminSessionToken(userId, environment);
  assert.equal(verifyAdminSessionToken(`${token}x`, environment), null);
  assert.equal(verifyAdminSessionToken(token, { ...environment, SPECIES_MEDIA_ADMIN_USER_IDS: "33333333-3333-4333-8333-333333333333" }), null);
});

test("fails closed when admin configuration is incomplete", () => {
  assert.throws(() => verifyAdminSessionToken("anything", { NODE_ENV: "test" }), SpeciesMediaAdminConfigurationError);
});
