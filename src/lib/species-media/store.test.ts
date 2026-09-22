import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalId } from "../content-contract/index.ts";
import { SpeciesMediaPersistenceError, SupabaseSpeciesMediaStore, type PublishSpeciesMediaInput } from "./store.ts";

/**
 * The publish RPC is one transaction. A statement timeout (57014) arrives only
 * after PostgreSQL rolled it back, so it is asked once more; nothing else is.
 * Seen in production on 2026-09-22: a replace returned WRITE_FAILED during a
 * burst of statement timeouts from unrelated database jobs.
 */

const INPUT = {
  assetId: "11111111-1111-4111-8111-111111111111",
  speciesId: "species:snowshoe-hare" as CanonicalId<"species">,
  expectedCurrentAssetId: "22222222-2222-4222-8222-222222222222",
  renditions: [],
} as unknown as PublishSpeciesMediaInput;

const TIMEOUT = { code: "57014", message: "canceling statement due to statement timeout" };
const CHANGED = { code: "P0001", message: "PRIMARY_MEDIA_CHANGED" };

function client(answers: Array<{ code: string; message: string } | null>, current: string | null = null) {
  const calls: string[] = [];
  const fake = {
    rpc: async (name: string) => {
      calls.push(name);
      return { data: null, error: answers.shift() ?? null };
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: current ? { asset_id: current } : null, error: null }) }) }) }),
  } as unknown as SupabaseClient;
  return { fake, calls };
}

test("a statement timeout is asked once more, and a success then publishes once", async () => {
  const { fake, calls } = client([TIMEOUT, null]);
  await new SupabaseSpeciesMediaStore(fake).publishPrimary(INPUT);
  assert.equal(calls.length, 2);
});

test("two timeouts are reported as a busy write, never retried a third time", async () => {
  const { fake, calls } = client([TIMEOUT, TIMEOUT]);
  await assert.rejects(new SupabaseSpeciesMediaStore(fake).publishPrimary(INPUT),
    (error: unknown) => error instanceof SpeciesMediaPersistenceError && error.code === "WRITE_BUSY");
  assert.equal(calls.length, 2);
});

test("a retry that finds our own asset already current is success, not a conflict", async () => {
  const { fake } = client([TIMEOUT, CHANGED], INPUT.assetId);
  await new SupabaseSpeciesMediaStore(fake).publishPrimary(INPUT);
});

test("a retry that meets someone else's newer image is a real conflict", async () => {
  const { fake } = client([TIMEOUT, CHANGED], "33333333-3333-4333-8333-333333333333");
  await assert.rejects(new SupabaseSpeciesMediaStore(fake).publishPrimary(INPUT),
    (error: unknown) => error instanceof SpeciesMediaPersistenceError && error.code === "PRIMARY_MEDIA_CHANGED");
});

test("a conflict or any other failure is not retried", async () => {
  for (const [first, code] of [[CHANGED, "PRIMARY_MEDIA_CHANGED"], [{ code: "23505", message: "duplicate key" }, "WRITE_FAILED"]] as const) {
    const { fake, calls } = client([first]);
    await assert.rejects(new SupabaseSpeciesMediaStore(fake).publishPrimary(INPUT),
      (error: unknown) => error instanceof SpeciesMediaPersistenceError && error.code === code);
    assert.equal(calls.length, 1);
  }
});

test("repositioning a photograph records who moved it and when", async () => {
  const updates: Array<Record<string, unknown>> = [];
  const client = {
    from: () => ({
      update: (values: Record<string, unknown>) => {
        updates.push(values);
        return { eq: () => ({ eq: () => ({ select: async () => ({ data: [{ id: INPUT.assetId }], error: null }) }) }) };
      },
    }),
  } as unknown as SupabaseClient;
  const moved = await new SupabaseSpeciesMediaStore(client)
    .setFocalPoint(INPUT.assetId, { x: 31.3, y: 70 }, "25613234-3273-4baa-8c0d-6a794f88eb0e");
  assert.equal(moved, true);
  assert.equal(updates[0].focal_x, 31.3);
  assert.equal(updates[0].focal_y, 70);
  assert.equal(updates[0].updated_by, "25613234-3273-4baa-8c0d-6a794f88eb0e");
  assert.match(String(updates[0].updated_at), /^\d{4}-\d{2}-\d{2}T/);
});
